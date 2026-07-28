-- ============================================================================
-- 006_founding_offer_infrastructure.sql
--
-- Private founding-offer eligibility, invitations, reservations, and
-- redemption state. The public waitlist remains an acquisition table only.
--
-- Production snapshot rule:
--   * Preserve the first 464 unique normalized waitlist emails by signup time.
--   * Later public waitlist inserts never become eligible automatically.
--   * Only invited cohort members can claim the founding offer.
--   * A short reservation holds one of 100 purchase slots during Checkout.
--   * A completed redemption consumes the offer permanently.
-- ============================================================================

create extension if not exists pgcrypto;

create table if not exists public.founding_offer_config (
  id                     int primary key default 1 check (id = 1),
  cohort_size            int not null default 464 check (cohort_size > 0),
  purchase_cap           int not null default 100 check (purchase_cap > 0),
  claim_window           interval not null default interval '7 days'
    check (claim_window > interval '0 seconds'),
  reservation_window     interval not null default interval '35 minutes'
    check (reservation_window >= interval '30 minutes'),
  checkout_enabled       boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

insert into public.founding_offer_config (id)
values (1)
on conflict (id) do nothing;

alter table public.founding_offer_config enable row level security;
drop policy if exists "founding_offer_config service role" on public.founding_offer_config;
create policy "founding_offer_config service role"
  on public.founding_offer_config
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

revoke all on public.founding_offer_config from public, anon, authenticated;
grant select, insert, update, delete on public.founding_offer_config to service_role;

create table if not exists public.founding_offer_eligibility (
  id                       uuid primary key default gen_random_uuid(),
  email_norm               text not null unique,
  waitlist_id              uuid,
  waitlist_created_at      timestamptz not null,
  cohort_position          int not null unique check (cohort_position > 0),
  user_id                  uuid unique references auth.users(id) on delete set null,
  state                    text not null default 'eligible'
    check (state in ('eligible', 'invited', 'reserved', 'redeemed', 'expired')),
  invited_at               timestamptz,
  claim_deadline           timestamptz,
  reservation_token        uuid unique,
  reservation_plan         text check (reservation_plan in ('monthly', 'annual')),
  reservation_started_at   timestamptz,
  reservation_expires_at   timestamptz,
  checkout_session_id      text unique,
  checkout_session_url     text,
  founding_member_number   int unique,
  redeemed_at              timestamptz,
  stripe_customer_id       text,
  stripe_subscription_id   text unique,
  stripe_schedule_id       text unique,
  last_error               text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint founding_offer_email_normalized
    check (email_norm <> '' and email_norm = lower(btrim(email_norm))),
  constraint founding_offer_claim_window_valid
    check (
      invited_at is null
      or claim_deadline is null
      or claim_deadline > invited_at
    ),
  constraint founding_offer_redemption_time
    check (state <> 'redeemed' or redeemed_at is not null)
);

create index if not exists founding_offer_state_idx
  on public.founding_offer_eligibility (state);
create index if not exists founding_offer_claim_deadline_idx
  on public.founding_offer_eligibility (claim_deadline)
  where state in ('invited', 'reserved');
create index if not exists founding_offer_reservation_expiry_idx
  on public.founding_offer_eligibility (reservation_expires_at)
  where state = 'reserved';

alter table public.founding_offer_eligibility enable row level security;
drop policy if exists "founding_offer_eligibility service role"
  on public.founding_offer_eligibility;
create policy "founding_offer_eligibility service role"
  on public.founding_offer_eligibility
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

revoke all on public.founding_offer_eligibility from public, anon, authenticated;
grant select, insert, update, delete on public.founding_offer_eligibility to service_role;

comment on table public.founding_offer_eligibility is
  'Private snapshot of the original TradeNet waitlist cohort and founding-offer claim state.';
comment on column public.founding_offer_eligibility.email_norm is
  'Normalized historical email. Never exposed to browser clients.';
comment on column public.founding_offer_eligibility.state is
  'eligible -> invited -> reserved -> redeemed, with expired as a terminal unclaimed state.';

-- Snapshot the first 464 unique normalized emails. This intentionally runs only
-- as part of the migration. There is no trigger from public.waitlist.
with earliest_per_email as (
  select distinct on (lower(btrim(w.email)))
         w.id,
         lower(btrim(w.email)) as email_norm,
         w.created_at
    from public.waitlist w
   where w.email is not null
     and btrim(w.email) <> ''
   order by lower(btrim(w.email)), w.created_at, w.id
),
ranked_cohort as (
  select e.*,
         row_number() over (order by e.created_at, e.id) as cohort_position
    from earliest_per_email e
),
configured_cohort as (
  select r.*
    from ranked_cohort r
    join public.founding_offer_config c on c.id = 1
   where r.cohort_position <= c.cohort_size
)
insert into public.founding_offer_eligibility (
  email_norm,
  waitlist_id,
  waitlist_created_at,
  cohort_position
)
select email_norm,
       id,
       created_at,
       cohort_position::int
  from configured_cohort
on conflict (email_norm) do nothing;

create or replace function public.expire_founding_offer_rows()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.founding_offer_eligibility
     set state = case
                   when claim_deadline is not null and claim_deadline <= now()
                     then 'expired'
                   else 'invited'
                 end,
         reservation_token = null,
         reservation_plan = null,
         reservation_started_at = null,
         reservation_expires_at = null,
         checkout_session_id = null,
         checkout_session_url = null,
         updated_at = now()
   where state = 'reserved'
     and reservation_expires_at is not null
     and reservation_expires_at <= now();

  update public.founding_offer_eligibility
     set state = 'expired',
         reservation_token = null,
         reservation_plan = null,
         reservation_started_at = null,
         reservation_expires_at = null,
         checkout_session_id = null,
         checkout_session_url = null,
         updated_at = now()
   where state in ('invited', 'reserved')
     and claim_deadline is not null
     and claim_deadline <= now();
end;
$$;

revoke all on function public.expire_founding_offer_rows()
  from public, anon, authenticated;
grant execute on function public.expire_founding_offer_rows() to service_role;

create or replace function public.invite_founding_offer(
  p_emails text[],
  p_invited_at timestamptz default now()
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claim_window interval;
  v_updated int;
begin
  if p_emails is null or cardinality(p_emails) = 0 then
    return 0;
  end if;

  select claim_window
    into v_claim_window
    from public.founding_offer_config
   where id = 1;

  update public.founding_offer_eligibility
     set state = 'invited',
         invited_at = p_invited_at,
         claim_deadline = p_invited_at + v_claim_window,
         user_id = coalesce(
           user_id,
           (
             select u.id
               from auth.users u
              where lower(btrim(u.email)) =
                    public.founding_offer_eligibility.email_norm
              order by u.created_at
              limit 1
           )
         ),
         last_error = null,
         updated_at = now()
   where state = 'eligible'
     and email_norm = any (
       array(
         select distinct lower(btrim(value))
           from unnest(p_emails) as requested(value)
          where value is not null and btrim(value) <> ''
       )
     );

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

revoke all on function public.invite_founding_offer(text[], timestamptz)
  from public, anon, authenticated;
grant execute on function public.invite_founding_offer(text[], timestamptz)
  to service_role;

create or replace function public.get_founding_offer_context(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email_norm text;
  v_offer public.founding_offer_eligibility%rowtype;
  v_config public.founding_offer_config%rowtype;
  v_claimed int;
  v_reserved int;
  v_remaining int;
  v_can_claim boolean;
begin
  perform public.expire_founding_offer_rows();

  select lower(btrim(email))
    into v_email_norm
    from auth.users
   where id = p_user;

  select *
    into v_config
    from public.founding_offer_config
   where id = 1;

  select count(*)::int
    into v_claimed
    from public.founding_offer_eligibility
   where state = 'redeemed';

  select count(*)::int
    into v_reserved
    from public.founding_offer_eligibility
   where state = 'reserved'
     and reservation_expires_at > now();

  v_remaining := greatest(v_config.purchase_cap - v_claimed - v_reserved, 0);

  if v_email_norm is null then
    return jsonb_build_object(
      'eligible', false,
      'state', 'standard',
      'checkout_enabled', v_config.checkout_enabled,
      'can_claim', false,
      'remaining_slots', v_remaining
    );
  end if;

  select *
    into v_offer
    from public.founding_offer_eligibility
   where email_norm = v_email_norm;

  if not found then
    return jsonb_build_object(
      'eligible', false,
      'state', 'standard',
      'checkout_enabled', v_config.checkout_enabled,
      'can_claim', false,
      'remaining_slots', v_remaining
    );
  end if;

  if v_offer.user_id is null then
    update public.founding_offer_eligibility
       set user_id = p_user,
           updated_at = now()
     where id = v_offer.id
       and user_id is null;
    v_offer.user_id := p_user;
  elsif v_offer.user_id <> p_user then
    return jsonb_build_object(
      'eligible', false,
      'state', 'account_conflict',
      'checkout_enabled', false,
      'can_claim', false,
      'remaining_slots', v_remaining
    );
  end if;

  v_can_claim :=
    v_config.checkout_enabled
    and v_offer.state in ('invited', 'reserved')
    and v_offer.claim_deadline > now()
    and (
      v_offer.state = 'reserved'
      or v_remaining > 0
    );

  return jsonb_strip_nulls(jsonb_build_object(
    'eligible', true,
    'state', v_offer.state,
    'checkout_enabled', v_config.checkout_enabled,
    'can_claim', v_can_claim,
    'invited_at', v_offer.invited_at,
    'claim_deadline', v_offer.claim_deadline,
    'reservation_plan', v_offer.reservation_plan,
    'reservation_expires_at', v_offer.reservation_expires_at,
    'checkout_session_url',
      case
        when v_offer.state = 'reserved'
         and v_offer.reservation_expires_at > now()
          then v_offer.checkout_session_url
        else null
      end,
    'remaining_slots', v_remaining,
    'founding_member_number', v_offer.founding_member_number
  ));
end;
$$;

revoke all on function public.get_founding_offer_context(uuid)
  from public, anon, authenticated;
grant execute on function public.get_founding_offer_context(uuid)
  to service_role;

create or replace function public.reserve_founding_offer(
  p_user uuid,
  p_plan text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email_norm text;
  v_offer public.founding_offer_eligibility%rowtype;
  v_config public.founding_offer_config%rowtype;
  v_occupied int;
  v_token uuid;
  v_expires_at timestamptz;
begin
  if p_plan not in ('monthly', 'annual') then
    raise exception using errcode = '22023', message = 'invalid_plan';
  end if;

  -- Locking the single config row serializes capacity checks and reservations.
  select *
    into v_config
    from public.founding_offer_config
   where id = 1
   for update;

  if not v_config.checkout_enabled then
    raise exception using errcode = 'P0001', message = 'founding_checkout_disabled';
  end if;

  perform public.expire_founding_offer_rows();

  select lower(btrim(email))
    into v_email_norm
    from auth.users
   where id = p_user;

  if v_email_norm is null then
    raise exception using errcode = 'P0001', message = 'account_email_required';
  end if;

  select *
    into v_offer
    from public.founding_offer_eligibility
   where email_norm = v_email_norm
   for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'founding_offer_not_eligible';
  end if;

  if v_offer.user_id is null then
    update public.founding_offer_eligibility
       set user_id = p_user,
           updated_at = now()
     where id = v_offer.id;
    v_offer.user_id := p_user;
  elsif v_offer.user_id <> p_user then
    raise exception using errcode = 'P0001', message = 'founding_offer_account_conflict';
  end if;

  if v_offer.state = 'eligible' then
    raise exception using errcode = 'P0001', message = 'founding_offer_not_invited';
  elsif v_offer.state = 'expired' then
    raise exception using errcode = 'P0001', message = 'founding_offer_expired';
  elsif v_offer.state = 'redeemed' then
    raise exception using errcode = 'P0001', message = 'founding_offer_already_redeemed';
  end if;

  if v_offer.claim_deadline is null
     or v_offer.claim_deadline <= now() + v_config.reservation_window then
    raise exception using errcode = 'P0001', message = 'founding_offer_deadline_too_close';
  end if;

  if v_offer.state = 'reserved'
     and v_offer.reservation_expires_at > now() then
    if v_offer.reservation_plan <> p_plan then
      raise exception using errcode = 'P0001', message = 'founding_offer_reservation_active';
    end if;

    return jsonb_strip_nulls(jsonb_build_object(
      'reservation_token', v_offer.reservation_token,
      'plan', v_offer.reservation_plan,
      'expires_at', v_offer.reservation_expires_at,
      'checkout_session_id', v_offer.checkout_session_id,
      'checkout_session_url', v_offer.checkout_session_url,
      'reused', true
    ));
  end if;

  select count(*)::int
    into v_occupied
    from public.founding_offer_eligibility
   where state = 'redeemed'
      or (
        state = 'reserved'
        and reservation_expires_at > now()
      );

  if v_occupied >= v_config.purchase_cap then
    raise exception using errcode = 'P0001', message = 'founding_offer_capacity_reached';
  end if;

  v_token := gen_random_uuid();
  v_expires_at := now() + v_config.reservation_window;

  update public.founding_offer_eligibility
     set state = 'reserved',
         reservation_token = v_token,
         reservation_plan = p_plan,
         reservation_started_at = now(),
         reservation_expires_at = v_expires_at,
         checkout_session_id = null,
         checkout_session_url = null,
         last_error = null,
         updated_at = now()
   where id = v_offer.id;

  return jsonb_build_object(
    'reservation_token', v_token,
    'plan', p_plan,
    'expires_at', v_expires_at,
    'reused', false
  );
end;
$$;

revoke all on function public.reserve_founding_offer(uuid, text)
  from public, anon, authenticated;
grant execute on function public.reserve_founding_offer(uuid, text)
  to service_role;

create or replace function public.bind_founding_checkout_session(
  p_user uuid,
  p_reservation_token uuid,
  p_session_id text,
  p_session_url text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated int;
begin
  update public.founding_offer_eligibility
     set checkout_session_id = p_session_id,
         checkout_session_url = p_session_url,
         updated_at = now()
   where user_id = p_user
     and state = 'reserved'
     and reservation_token = p_reservation_token
     and reservation_expires_at > now()
     and checkout_session_id is null;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

revoke all on function public.bind_founding_checkout_session(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.bind_founding_checkout_session(uuid, uuid, text, text)
  to service_role;

create or replace function public.release_founding_offer_reservation(
  p_user uuid,
  p_reservation_token uuid default null,
  p_session_id text default null,
  p_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated int;
begin
  update public.founding_offer_eligibility
     set state = case
                   when claim_deadline is not null and claim_deadline <= now()
                     then 'expired'
                   else 'invited'
                 end,
         reservation_token = null,
         reservation_plan = null,
         reservation_started_at = null,
         reservation_expires_at = null,
         checkout_session_id = null,
         checkout_session_url = null,
         last_error = left(p_reason, 500),
         updated_at = now()
   where user_id = p_user
     and state = 'reserved'
     and (
       (p_reservation_token is not null and reservation_token = p_reservation_token)
       or (p_session_id is not null and checkout_session_id = p_session_id)
     );

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

revoke all on function public.release_founding_offer_reservation(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.release_founding_offer_reservation(uuid, uuid, text, text)
  to service_role;

create or replace function public.redeem_founding_offer(
  p_user uuid,
  p_reservation_token uuid,
  p_session_id text,
  p_customer_id text,
  p_subscription_id text,
  p_schedule_id text
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer public.founding_offer_eligibility%rowtype;
  v_config public.founding_offer_config%rowtype;
  v_redeemed int;
  v_member_number int;
begin
  select *
    into v_config
    from public.founding_offer_config
   where id = 1
   for update;

  select *
    into v_offer
    from public.founding_offer_eligibility
   where user_id = p_user
   for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'founding_offer_not_found';
  end if;

  if v_offer.state = 'redeemed' then
    if v_offer.stripe_subscription_id = p_subscription_id then
      return v_offer.founding_member_number;
    end if;
    raise exception using errcode = 'P0001', message = 'founding_offer_already_redeemed';
  end if;

  if v_offer.state <> 'reserved'
     or v_offer.reservation_token <> p_reservation_token
     or v_offer.checkout_session_id <> p_session_id then
    raise exception using errcode = 'P0001', message = 'founding_offer_reservation_mismatch';
  end if;

  if p_customer_id is null
     or p_subscription_id is null
     or p_schedule_id is null then
    raise exception using errcode = '22004', message = 'founding_offer_stripe_ids_required';
  end if;

  select count(*)::int
    into v_redeemed
    from public.founding_offer_eligibility
   where state = 'redeemed';

  if v_redeemed >= v_config.purchase_cap then
    raise exception using errcode = 'P0001', message = 'founding_offer_capacity_reached';
  end if;

  v_member_number := nextval('public.founding_member_seq')::int;

  update public.founding_offer_eligibility
     set state = 'redeemed',
         founding_member_number = v_member_number,
         redeemed_at = now(),
         stripe_customer_id = p_customer_id,
         stripe_subscription_id = p_subscription_id,
         stripe_schedule_id = p_schedule_id,
         checkout_session_url = null,
         last_error = null,
         updated_at = now()
   where id = v_offer.id;

  update public.profiles
     set founding_member_number = coalesce(founding_member_number, v_member_number)
   where id = p_user;

  return v_member_number;
end;
$$;

revoke all on function public.redeem_founding_offer(uuid, uuid, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.redeem_founding_offer(uuid, uuid, text, text, text, text)
  to service_role;

-- Explicitly remove the superseded broad lookup if an earlier development
-- version was ever applied manually.
drop function if exists public.is_waitlist_member(text);
