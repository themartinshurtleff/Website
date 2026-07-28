-- Secure client announcement control plane.
--
-- Clients never read these tables directly. Authenticated callers use Edge
-- Functions, which validate the user and call the service-only RPCs below.

create table if not exists public.client_announcements (
  id uuid primary key default gen_random_uuid(),
  revision integer not null default 1 check (revision > 0),
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  severity text not null default 'info'
    check (severity in ('info', 'warning', 'maintenance', 'critical', 'release')),
  title text not null
    check (char_length(btrim(title)) between 1 and 120),
  body text not null
    check (char_length(btrim(body)) between 1 and 4000),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  platforms text[] not null default array['all']::text[],
  channels text[] not null default array['beta']::text[],
  min_version text,
  max_version text,
  access_tiers text[] not null default array[]::text[],
  service_scopes text[] not null default array[]::text[],
  dismissible boolean not null default true,
  requires_ack boolean not null default false,
  action_label text,
  action_url text,
  created_by uuid not null references auth.users(id) on delete restrict,
  published_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint client_announcements_schedule_check
    check (ends_at is null or ends_at > starts_at),
  constraint client_announcements_platforms_check
    check (
      cardinality(platforms) > 0
      and platforms <@ array['all','web','desktop','windows','macos']::text[]
      and not ('all' = any(platforms) and cardinality(platforms) > 1)
    ),
  constraint client_announcements_channels_check
    check (
      cardinality(channels) > 0
      and channels <@ array['beta','stable','internal']::text[]
    ),
  constraint client_announcements_access_tiers_check
    check (
      access_tiers <@ array[
        'waitlist','free','referral_verified','beta','pro','admin'
      ]::text[]
    ),
  constraint client_announcements_service_scopes_check
    check (
      service_scopes <@ array[
        'all','terminal','website','auth','market_data','execution'
      ]::text[]
      and not ('all' = any(service_scopes) and cardinality(service_scopes) > 1)
    ),
  constraint client_announcements_ack_check
    check (not requires_ack or not dismissible),
  constraint client_announcements_action_check
    check (
      (action_label is null) = (action_url is null)
      and (
        action_label is null
        or (
          char_length(btrim(action_label)) between 1 and 40
          and char_length(action_url) between 1 and 2048
        )
      )
    ),
  constraint client_announcements_min_version_length_check
    check (min_version is null or char_length(min_version) between 1 and 64),
  constraint client_announcements_max_version_length_check
    check (max_version is null or char_length(max_version) between 1 and 64)
);

create index if not exists client_announcements_active_idx
  on public.client_announcements (status, starts_at, ends_at);
create index if not exists client_announcements_updated_idx
  on public.client_announcements (updated_at desc);

create table if not exists public.client_announcement_state (
  singleton boolean primary key default true check (singleton),
  revision bigint not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now()
);

insert into public.client_announcement_state (singleton, revision)
values (true, 0)
on conflict (singleton) do nothing;

create table if not exists public.client_announcement_audit (
  id bigint generated always as identity primary key,
  request_id uuid not null unique,
  actor_id uuid not null references auth.users(id) on delete restrict,
  announcement_id uuid not null,
  action text not null
    check (action in ('create_draft','update','publish','archive')),
  from_revision integer,
  to_revision integer not null,
  before_state jsonb,
  after_state jsonb not null,
  snapshot_revision bigint not null,
  created_at timestamptz not null default now()
);

create index if not exists client_announcement_audit_announcement_idx
  on public.client_announcement_audit (announcement_id, created_at desc);
create index if not exists client_announcement_audit_actor_idx
  on public.client_announcement_audit (actor_id, created_at desc);

create table if not exists public.client_announcement_rate_limits (
  bucket text primary key,
  window_started_at timestamptz not null,
  request_count integer not null check (request_count > 0),
  updated_at timestamptz not null default now()
);

alter table public.client_announcements enable row level security;
alter table public.client_announcement_state enable row level security;
alter table public.client_announcement_audit enable row level security;
alter table public.client_announcement_rate_limits enable row level security;

revoke all on public.client_announcements from anon, authenticated;
revoke all on public.client_announcement_state from anon, authenticated;
revoke all on public.client_announcement_audit from anon, authenticated;
revoke all on public.client_announcement_rate_limits from anon, authenticated;
revoke all on sequence public.client_announcement_audit_id_seq from anon, authenticated;

create or replace function public.client_announcement_actor_is_admin(p_actor uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = p_actor
      and access_tier = 'admin'
      and coalesce(access_status, 'active') not in ('revoked', 'cancelled')
  );
$$;

revoke all on function public.client_announcement_actor_is_admin(uuid)
  from public, anon, authenticated;
grant execute on function public.client_announcement_actor_is_admin(uuid)
  to service_role;

create or replace function public.consume_client_announcement_rate_limit(
  p_bucket text,
  p_limit integer,
  p_window_seconds integer
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_row public.client_announcement_rate_limits%rowtype;
  v_window interval;
begin
  if p_bucket is null or char_length(p_bucket) < 3 or char_length(p_bucket) > 200 then
    raise exception 'invalid_rate_limit_bucket';
  end if;
  if p_limit < 1 or p_limit > 1000 then
    raise exception 'invalid_rate_limit_limit';
  end if;
  if p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'invalid_rate_limit_window';
  end if;

  v_window := make_interval(secs => p_window_seconds);

  insert into public.client_announcement_rate_limits (
    bucket,
    window_started_at,
    request_count,
    updated_at
  )
  values (p_bucket, v_now, 1, v_now)
  on conflict (bucket) do update
  set
    window_started_at = case
      when client_announcement_rate_limits.window_started_at + v_window <= v_now
        then v_now
      else client_announcement_rate_limits.window_started_at
    end,
    request_count = case
      when client_announcement_rate_limits.window_started_at + v_window <= v_now
        then 1
      else client_announcement_rate_limits.request_count + 1
    end,
    updated_at = v_now
  returning * into v_row;

  allowed := v_row.request_count <= p_limit;
  retry_after_seconds := case
    when allowed then 0
    else greatest(
      1,
      ceil(extract(epoch from (v_row.window_started_at + v_window - v_now)))::integer
    )
  end;
  return next;
end;
$$;

revoke all on function public.consume_client_announcement_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_client_announcement_rate_limit(text, integer, integer)
  to service_role;

create or replace function public.get_client_announcement_snapshot(
  p_user uuid,
  p_platform text,
  p_os text,
  p_channel text
)
returns table (
  id uuid,
  revision integer,
  severity text,
  title text,
  body text,
  starts_at timestamptz,
  ends_at timestamptz,
  min_version text,
  max_version text,
  service_scopes text[],
  dismissible boolean,
  requires_ack boolean,
  action_label text,
  action_url text,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with audience as (
    select coalesce(
      (select access_tier from public.profiles where profiles.id = p_user),
      'waitlist'
    ) as access_tier
  )
  select
    a.id,
    a.revision,
    a.severity,
    a.title,
    a.body,
    a.starts_at,
    a.ends_at,
    a.min_version,
    a.max_version,
    a.service_scopes,
    a.dismissible,
    a.requires_ack,
    a.action_label,
    a.action_url,
    a.updated_at
  from public.client_announcements a
  cross join audience
  where a.status = 'published'
    and a.starts_at <= now()
    and (a.ends_at is null or a.ends_at > now())
    and p_platform in ('web', 'desktop')
    and p_channel in ('beta', 'stable', 'internal')
    and (
      'all' = any(a.platforms)
      or p_platform = any(a.platforms)
      or (p_os is not null and p_os = any(a.platforms))
    )
    and p_channel = any(a.channels)
    and (
      cardinality(a.access_tiers) = 0
      or audience.access_tier = any(a.access_tiers)
    )
  order by
    case a.severity
      when 'critical' then 1
      when 'maintenance' then 2
      when 'warning' then 3
      when 'release' then 4
      else 5
    end,
    a.published_at desc nulls last,
    a.id;
$$;

revoke all on function public.get_client_announcement_snapshot(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.get_client_announcement_snapshot(uuid, text, text, text)
  to service_role;

create or replace function public.mutate_client_announcement(
  p_actor uuid,
  p_action text,
  p_request_id uuid,
  p_announcement_id uuid default null,
  p_expected_revision integer default null,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_audit public.client_announcement_audit%rowtype;
  v_before public.client_announcements%rowtype;
  v_after public.client_announcements%rowtype;
  v_snapshot_revision bigint;
  v_bump_snapshot boolean := false;
begin
  if not public.client_announcement_actor_is_admin(p_actor) then
    raise exception 'admin_required';
  end if;
  if p_action not in ('create_draft', 'update', 'publish', 'archive') then
    raise exception 'invalid_announcement_action';
  end if;

  select * into v_existing_audit
  from public.client_announcement_audit
  where request_id = p_request_id;

  if found then
    if v_existing_audit.actor_id <> p_actor then
      raise exception 'request_id_conflict';
    end if;
    return jsonb_build_object(
      'idempotent', true,
      'announcement', v_existing_audit.after_state,
      'snapshot_revision', v_existing_audit.snapshot_revision
    );
  end if;

  if p_action = 'create_draft' then
    insert into public.client_announcements (
      severity,
      title,
      body,
      starts_at,
      ends_at,
      platforms,
      channels,
      min_version,
      max_version,
      access_tiers,
      service_scopes,
      dismissible,
      requires_ack,
      action_label,
      action_url,
      created_by
    )
    values (
      p_payload->>'severity',
      p_payload->>'title',
      p_payload->>'body',
      (p_payload->>'starts_at')::timestamptz,
      nullif(p_payload->>'ends_at', '')::timestamptz,
      array(select jsonb_array_elements_text(p_payload->'platforms')),
      array(select jsonb_array_elements_text(p_payload->'channels')),
      nullif(p_payload->>'min_version', ''),
      nullif(p_payload->>'max_version', ''),
      array(select jsonb_array_elements_text(p_payload->'access_tiers')),
      array(select jsonb_array_elements_text(p_payload->'service_scopes')),
      (p_payload->>'dismissible')::boolean,
      (p_payload->>'requires_ack')::boolean,
      nullif(p_payload->>'action_label', ''),
      nullif(p_payload->>'action_url', ''),
      p_actor
    )
    returning * into v_after;
  else
    if p_announcement_id is null or p_expected_revision is null then
      raise exception 'announcement_identity_required';
    end if;

    select * into v_before
    from public.client_announcements
    where id = p_announcement_id
    for update;

    if not found then
      raise exception 'announcement_not_found';
    end if;
    if v_before.revision <> p_expected_revision then
      raise exception 'revision_conflict';
    end if;
    if v_before.status = 'archived' then
      raise exception 'announcement_archived';
    end if;

    if p_action = 'update' then
      update public.client_announcements
      set
        revision = revision + 1,
        severity = p_payload->>'severity',
        title = p_payload->>'title',
        body = p_payload->>'body',
        starts_at = (p_payload->>'starts_at')::timestamptz,
        ends_at = nullif(p_payload->>'ends_at', '')::timestamptz,
        platforms = array(select jsonb_array_elements_text(p_payload->'platforms')),
        channels = array(select jsonb_array_elements_text(p_payload->'channels')),
        min_version = nullif(p_payload->>'min_version', ''),
        max_version = nullif(p_payload->>'max_version', ''),
        access_tiers = array(select jsonb_array_elements_text(p_payload->'access_tiers')),
        service_scopes = array(select jsonb_array_elements_text(p_payload->'service_scopes')),
        dismissible = (p_payload->>'dismissible')::boolean,
        requires_ack = (p_payload->>'requires_ack')::boolean,
        action_label = nullif(p_payload->>'action_label', ''),
        action_url = nullif(p_payload->>'action_url', ''),
        updated_at = now()
      where id = p_announcement_id
      returning * into v_after;
      v_bump_snapshot := v_before.status = 'published';
    elsif p_action = 'publish' then
      update public.client_announcements
      set
        revision = revision + 1,
        status = 'published',
        published_by = p_actor,
        published_at = now(),
        updated_at = now()
      where id = p_announcement_id
      returning * into v_after;
      v_bump_snapshot := true;
    else
      update public.client_announcements
      set
        revision = revision + 1,
        status = 'archived',
        ends_at = case
          when starts_at < now() and (ends_at is null or ends_at > now()) then now()
          else ends_at
        end,
        updated_at = now()
      where id = p_announcement_id
      returning * into v_after;
      v_bump_snapshot := v_before.status = 'published';
    end if;
  end if;

  if v_bump_snapshot then
    update public.client_announcement_state
    set revision = revision + 1, updated_at = now()
    where singleton
    returning revision into v_snapshot_revision;
  else
    select revision into v_snapshot_revision
    from public.client_announcement_state
    where singleton;
  end if;

  insert into public.client_announcement_audit (
    request_id,
    actor_id,
    announcement_id,
    action,
    from_revision,
    to_revision,
    before_state,
    after_state,
    snapshot_revision
  )
  values (
    p_request_id,
    p_actor,
    v_after.id,
    p_action,
    v_before.revision,
    v_after.revision,
    case when v_before.id is null then null else to_jsonb(v_before) end,
    to_jsonb(v_after),
    v_snapshot_revision
  );

  return jsonb_build_object(
    'idempotent', false,
    'announcement', to_jsonb(v_after),
    'snapshot_revision', v_snapshot_revision
  );
end;
$$;

revoke all on function public.mutate_client_announcement(
  uuid, text, uuid, uuid, integer, jsonb
) from public, anon, authenticated;
grant execute on function public.mutate_client_announcement(
  uuid, text, uuid, uuid, integer, jsonb
) to service_role;

create or replace function public.broadcast_client_announcement_invalidation(
  p_snapshot_revision bigint,
  p_announcement_id uuid,
  p_announcement_revision integer,
  p_operation text
)
returns void
language plpgsql
security definer
set search_path = public, realtime
as $$
begin
  if p_operation not in ('publish', 'update', 'archive') then
    raise exception 'invalid_broadcast_operation';
  end if;

  perform realtime.send(
    jsonb_build_object(
      'schema_version', 1,
      'snapshot_revision', p_snapshot_revision,
      'announcement_id', p_announcement_id,
      'announcement_revision', p_announcement_revision,
      'operation', p_operation
    ),
    'announcement_changed',
    'client:announcements',
    true
  );
end;
$$;

revoke all on function public.broadcast_client_announcement_invalidation(
  bigint, uuid, integer, text
) from public, anon, authenticated;
grant execute on function public.broadcast_client_announcement_invalidation(
  bigint, uuid, integer, text
) to service_role;

create or replace function public.prevent_client_announcement_audit_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'client_announcement_audit_is_append_only';
end;
$$;

drop trigger if exists client_announcement_audit_append_only
  on public.client_announcement_audit;
create trigger client_announcement_audit_append_only
before update or delete on public.client_announcement_audit
for each row execute function public.prevent_client_announcement_audit_mutation();

revoke all on function public.prevent_client_announcement_audit_mutation()
  from public, anon, authenticated;

drop policy if exists "authenticated receive announcement broadcasts"
  on realtime.messages;
create policy "authenticated receive announcement broadcasts"
on realtime.messages
for select
to authenticated
using (
  realtime.topic() = 'client:announcements'
  and realtime.messages.extension = 'broadcast'
);
