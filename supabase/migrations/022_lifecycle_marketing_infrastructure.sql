-- Durable, provider-neutral lifecycle delivery for account and product events.
-- Public clients cannot read or write this queue. Trusted Edge Functions claim
-- work through the service-role-only RPCs below.

create table if not exists public.lifecycle_milestones (
  user_id       uuid        not null references auth.users(id) on delete cascade,
  milestone     text        not null check (milestone in ('account_created', 'trial_started', 'activated')),
  occurred_at   timestamptz not null default now(),
  source        text        not null check (source ~ '^[a-z0-9_:-]{1,64}$'),
  properties    jsonb       not null default '{}'::jsonb check (jsonb_typeof(properties) = 'object'),
  primary key (user_id, milestone)
);

create table if not exists public.lifecycle_outbox (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references auth.users(id) on delete cascade,
  operation         text        not null check (operation in ('profile_sync', 'marketing_subscribe', 'event')),
  event_name        text,
  event_time        timestamptz,
  properties        jsonb       not null default '{}'::jsonb check (jsonb_typeof(properties) = 'object'),
  idempotency_key   text        not null unique check (length(idempotency_key) between 1 and 255),
  status            text        not null default 'pending'
                                check (status in ('pending', 'processing', 'retry', 'delivered', 'dead_letter')),
  attempts          integer     not null default 0 check (attempts >= 0),
  available_at      timestamptz not null default now(),
  locked_at         timestamptz,
  locked_by         text,
  provider_status   integer,
  provider_result   jsonb,
  last_error        text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  delivered_at      timestamptz,
  constraint lifecycle_outbox_event_shape check (
    (operation = 'event' and event_name is not null and length(event_name) between 1 and 128 and event_time is not null)
    or
    (operation <> 'event' and event_name is null and event_time is null)
  )
);

create table if not exists public.lifecycle_provider_profiles (
  user_id               uuid        primary key references auth.users(id) on delete cascade,
  provider              text        not null default 'klaviyo' check (provider = 'klaviyo'),
  provider_profile_id   text        not null check (length(provider_profile_id) between 1 and 128),
  synced_email          text        not null,
  last_synced_at        timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists lifecycle_outbox_claim_idx
  on public.lifecycle_outbox (status, available_at, created_at)
  where status in ('pending', 'retry', 'processing');

create index if not exists lifecycle_outbox_user_idx
  on public.lifecycle_outbox (user_id, created_at desc);

alter table public.lifecycle_milestones enable row level security;
alter table public.lifecycle_outbox enable row level security;
alter table public.lifecycle_provider_profiles enable row level security;

revoke all on table public.lifecycle_milestones from public, anon, authenticated;
revoke all on table public.lifecycle_outbox from public, anon, authenticated;
revoke all on table public.lifecycle_provider_profiles from public, anon, authenticated;

-- The dispatcher only writes the provider mapping directly. Queue and
-- milestone writes stay behind the SECURITY DEFINER functions below.
grant select, insert, update on table public.lifecycle_provider_profiles
  to service_role;

create or replace function public.enqueue_lifecycle_job(
  p_user_id uuid,
  p_operation text,
  p_event_name text,
  p_event_time timestamptz,
  p_properties jsonb,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  queued_id uuid;
begin
  if p_operation not in ('profile_sync', 'marketing_subscribe', 'event') then
    raise exception 'invalid_lifecycle_operation';
  end if;

  insert into public.lifecycle_outbox (
    user_id,
    operation,
    event_name,
    event_time,
    properties,
    idempotency_key
  ) values (
    p_user_id,
    p_operation,
    case when p_operation = 'event' then p_event_name else null end,
    case when p_operation = 'event' then p_event_time else null end,
    coalesce(p_properties, '{}'::jsonb),
    p_idempotency_key
  )
  on conflict (idempotency_key) do nothing
  returning id into queued_id;

  if queued_id is null then
    select id into queued_id
      from public.lifecycle_outbox
     where idempotency_key = p_idempotency_key;
  end if;

  return queued_id;
end;
$$;

create or replace function public.record_lifecycle_milestone(
  p_user_id uuid,
  p_milestone text,
  p_source text,
  p_properties jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  inserted_at timestamptz;
  metric_name text;
begin
  if p_milestone not in ('account_created', 'trial_started', 'activated') then
    raise exception 'invalid_lifecycle_milestone';
  end if;
  if p_source is null or p_source !~ '^[a-z0-9_:-]{1,64}$' then
    raise exception 'invalid_lifecycle_source';
  end if;
  if jsonb_typeof(coalesce(p_properties, '{}'::jsonb)) <> 'object' then
    raise exception 'invalid_lifecycle_properties';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'lifecycle_profile_missing';
  end if;

  insert into public.lifecycle_milestones (
    user_id,
    milestone,
    occurred_at,
    source,
    properties
  ) values (
    p_user_id,
    p_milestone,
    now(),
    p_source,
    coalesce(p_properties, '{}'::jsonb)
  )
  on conflict (user_id, milestone) do nothing
  returning occurred_at into inserted_at;

  if inserted_at is null then
    return false;
  end if;

  metric_name := case p_milestone
    when 'account_created' then 'Account Created'
    when 'trial_started' then 'Trial Started'
    when 'activated' then 'Activated'
  end;

  perform public.enqueue_lifecycle_job(
    p_user_id,
    'event',
    metric_name,
    inserted_at,
    coalesce(p_properties, '{}'::jsonb) || jsonb_build_object('source', p_source),
    'event:' || p_milestone || ':' || p_user_id::text
  );

  return true;
end;
$$;

create or replace function public.queue_new_account_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.enqueue_lifecycle_job(
    new.id,
    'profile_sync',
    null,
    null,
    jsonb_build_object('reason', 'account_created'),
    'profile_sync:account_created:' || new.id::text
  );

  perform public.record_lifecycle_milestone(
    new.id,
    'account_created',
    'website_signup',
    jsonb_build_object(
      'marketing_opt_in', coalesce(new.marketing_opt_in, false),
      'signup_source', coalesce(new.signup_source, 'website')
    )
  );

  if coalesce(new.marketing_opt_in, false) then
    perform public.enqueue_lifecycle_job(
      new.id,
      'marketing_subscribe',
      null,
      null,
      jsonb_build_object('source', 'website_signup'),
      'marketing_subscribe:signup:' || new.id::text
    );
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_queue_new_account_lifecycle on public.profiles;
create trigger profiles_queue_new_account_lifecycle
  after insert on public.profiles
  for each row execute function public.queue_new_account_lifecycle();

create or replace function public.queue_profile_lifecycle_updates()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  profile_fingerprint text;
begin
  if new.email is distinct from old.email
     or new.subscription_tier is distinct from old.subscription_tier
     or new.access_tier is distinct from old.access_tier
     or new.access_status is distinct from old.access_status
     or new.billing_status is distinct from old.billing_status
     or new.terminal_access is distinct from old.terminal_access
     or new.signup_source is distinct from old.signup_source
     or new.cohort is distinct from old.cohort
     or new.founding_member_number is distinct from old.founding_member_number
     or new.marketing_opt_in is distinct from old.marketing_opt_in
  then
    profile_fingerprint := md5(concat_ws(
      '|',
      lower(trim(coalesce(new.email, ''))),
      coalesce(new.subscription_tier, ''),
      coalesce(new.access_tier, ''),
      coalesce(new.access_status, ''),
      coalesce(new.billing_status, ''),
      coalesce(new.terminal_access::text, ''),
      coalesce(new.signup_source, ''),
      coalesce(new.cohort, ''),
      coalesce(new.founding_member_number::text, ''),
      coalesce(new.marketing_opt_in::text, 'false')
    ));

    perform public.enqueue_lifecycle_job(
      new.id,
      'profile_sync',
      null,
      null,
      jsonb_build_object('reason', 'profile_updated'),
      'profile_sync:' || new.id::text || ':' || profile_fingerprint
    );
  end if;

  if coalesce(new.marketing_opt_in, false)
     and not coalesce(old.marketing_opt_in, false)
  then
    perform public.enqueue_lifecycle_job(
      new.id,
      'marketing_subscribe',
      null,
      null,
      jsonb_build_object('source', 'account_preference'),
      'marketing_subscribe:' || new.id::text || ':' || extract(epoch from new.updated_at)::text
    );
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_queue_lifecycle_updates on public.profiles;
create trigger profiles_queue_lifecycle_updates
  after update on public.profiles
  for each row execute function public.queue_profile_lifecycle_updates();

create or replace function public.claim_lifecycle_jobs(
  p_worker text,
  p_limit integer default 20
)
returns setof public.lifecycle_outbox
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_worker is null or length(p_worker) not between 1 and 128 then
    raise exception 'invalid_lifecycle_worker';
  end if;

  return query
  with candidates as materialized (
    select queued.id
      from public.lifecycle_outbox queued
     where queued.available_at <= now()
       and (
         queued.status in ('pending', 'retry')
         or (queued.status = 'processing' and queued.locked_at < now() - interval '35 minutes')
       )
     order by queued.created_at, queued.id
     limit greatest(1, least(coalesce(p_limit, 20), 50))
     for update skip locked
  )
  update public.lifecycle_outbox queued
     set status = 'processing',
         attempts = queued.attempts + 1,
         locked_at = now(),
         locked_by = p_worker,
         updated_at = now()
    from candidates
   where queued.id = candidates.id
  returning queued.*;
end;
$$;

create or replace function public.complete_lifecycle_job(
  p_job_id uuid,
  p_worker text,
  p_provider_status integer,
  p_provider_result jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.lifecycle_outbox
     set status = 'delivered',
         provider_status = p_provider_status,
         provider_result = coalesce(p_provider_result, '{}'::jsonb),
         last_error = null,
         locked_at = null,
         locked_by = null,
         delivered_at = now(),
         updated_at = now()
   where id = p_job_id
     and status = 'processing'
     and locked_by = p_worker;

  return found;
end;
$$;

create or replace function public.fail_lifecycle_job(
  p_job_id uuid,
  p_worker text,
  p_retryable boolean,
  p_retry_after_seconds integer,
  p_error text,
  p_provider_status integer default null,
  p_provider_result jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.lifecycle_outbox
     set status = case
           when coalesce(p_retryable, false) and attempts < 8 then 'retry'
           else 'dead_letter'
         end,
         available_at = case
           when coalesce(p_retryable, false) and attempts < 8 then
             now() + make_interval(secs => greatest(15, least(coalesce(p_retry_after_seconds, 60), 21600)))
           else available_at
         end,
         provider_status = p_provider_status,
         provider_result = coalesce(p_provider_result, '{}'::jsonb),
         last_error = left(coalesce(p_error, 'lifecycle_delivery_failed'), 1000),
         locked_at = null,
         locked_by = null,
         updated_at = now()
   where id = p_job_id
     and status = 'processing'
     and locked_by = p_worker;

  return found;
end;
$$;

revoke execute on function public.enqueue_lifecycle_job(uuid, text, text, timestamptz, jsonb, text)
  from public, anon, authenticated;
revoke execute on function public.record_lifecycle_milestone(uuid, text, text, jsonb)
  from public, anon, authenticated;
revoke execute on function public.queue_new_account_lifecycle()
  from public, anon, authenticated;
revoke execute on function public.queue_profile_lifecycle_updates()
  from public, anon, authenticated;
revoke execute on function public.claim_lifecycle_jobs(text, integer)
  from public, anon, authenticated;
revoke execute on function public.complete_lifecycle_job(uuid, text, integer, jsonb)
  from public, anon, authenticated;
revoke execute on function public.fail_lifecycle_job(uuid, text, boolean, integer, text, integer, jsonb)
  from public, anon, authenticated;

grant execute on function public.record_lifecycle_milestone(uuid, text, text, jsonb)
  to service_role;
grant execute on function public.claim_lifecycle_jobs(text, integer)
  to service_role;
grant execute on function public.complete_lifecycle_job(uuid, text, integer, jsonb)
  to service_role;
grant execute on function public.fail_lifecycle_job(uuid, text, boolean, integer, text, integer, jsonb)
  to service_role;

comment on table public.lifecycle_outbox is
  'Private provider-neutral outbox for lifecycle profile, consent, and product-event delivery.';
comment on table public.lifecycle_milestones is
  'One-time account/product milestones used to deduplicate lifecycle events.';
