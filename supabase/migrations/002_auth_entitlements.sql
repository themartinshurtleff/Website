-- ============================================================================
-- 002_auth_entitlements.sql
-- TradeNet identity + billing + entitlements layer.
--
-- Canonical design: features/auth-access/implementation-plan-2026-06-15 (§3-§5)
-- Binding spec:      features/auth-access/agent-tasks-2026-06-15 (§0.5, §1.1-§1.5)
-- Tier model:        features/auth-access/beta-access-model-2026-06-15
--
-- Fully additive and idempotent. Safe to re-run. Applies as one unit.
--
-- KEY MODEL DECISIONS (reconcile older plan vs newer binding beta-model):
--   * subscription_tier  = COMMERCIAL field (what was bought). Granular values
--     kept in the CHECK for forward-compat + reporting. NEVER a security claim.
--   * access_tier        = DERIVED security tier (written ONLY by
--     recalc_entitlements). For the beta launch, every active-paid
--     subscription_tier (founding/pro_monthly/pro_annual) collapses to
--     access_tier='pro' (all paid beta products -> one 'pro' entitlement;
--     monthly vs annual differ only in plan_expires_at). Re-expand later by
--     editing recalc step 4 only -- no schema change, no token refresh.
--   * tradenet_access / terminal_access = "this account has DATA access" (free
--     preview or better) -- NOT "desktop eligible". true for free/referral/beta/
--     pro/admin; false ONLY for waitlist/revoked (genuinely no data). The
--     servers serve free its TIER_MATRIX allowance (BTC, min_timeframe_ms
--     300000, limited features); they 403 only terminal_access=false
--     (waitlist/revoked). "Free = web-only" is a DESKTOP-CLIENT product gate:
--     the desktop app refuses to run when tradenet_tier='free'. It is NOT a
--     server/claim deny -- a free user pulling BTC via API just gets the free
--     allowance, which is harmless. (Corrected 2026-06-15 per Martin: an earlier
--     pass set free terminal_access=false, which would have 403'd free entirely.)
--   * The servers' in-code TIER_MATRIX (agent-tasks §0.5.5) is the AUTHORITY
--     for gating. The entitlements jsonb written here is a faithful mirror for
--     the website/account display; keep the two in sync when tiers change.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Extensions
-- ----------------------------------------------------------------------------
create extension if not exists pgcrypto;   -- gen_random_uuid()

-- ----------------------------------------------------------------------------
-- 1. profiles: additive columns (idempotent)
-- ----------------------------------------------------------------------------
alter table public.profiles add column if not exists access_status            text    default 'waitlist';
alter table public.profiles add column if not exists access_tier              text    default 'waitlist';
alter table public.profiles add column if not exists terminal_access          boolean default false;
alter table public.profiles add column if not exists entitlements             jsonb   default '{}'::jsonb;
alter table public.profiles add column if not exists entitlements_version     int     default 1;
alter table public.profiles add column if not exists access_source            text;
alter table public.profiles add column if not exists access_expires_at        timestamptz;
alter table public.profiles add column if not exists plan_started_at          timestamptz;
alter table public.profiles add column if not exists plan_expires_at          timestamptz;

-- billing provider fields
alter table public.profiles add column if not exists billing_provider         text;
alter table public.profiles add column if not exists billing_status           text;
alter table public.profiles add column if not exists billing_customer_id      text;

-- Bitunix (PHASE 2 -- columns + derivation exist; no verify flow built this pass)
alter table public.profiles add column if not exists bitunix_uid              text;
alter table public.profiles add column if not exists bitunix_referral_verified boolean default false;
alter table public.profiles add column if not exists bitunix_deposit_verified  boolean default false;
alter table public.profiles add column if not exists bitunix_deposit_usd       numeric;
alter table public.profiles add column if not exists bitunix_volume_30d_usd    numeric;
alter table public.profiles add column if not exists bitunix_last_checked_at   timestamptz;
alter table public.profiles add column if not exists bitunix_access_expires_at timestamptz;

-- misc / marketing / cohort
alter table public.profiles add column if not exists founding_member_number  int;
alter table public.profiles add column if not exists signup_source           text;
alter table public.profiles add column if not exists cohort                  text;
alter table public.profiles add column if not exists invite_code             text;
alter table public.profiles add column if not exists marketing_opt_in        boolean default false;
alter table public.profiles add column if not exists last_entitlement_sync_at timestamptz;

-- subscription_tier CHECK: widen to the full set (agent-tasks §1.1).
-- Drop whatever constraint 001 created (name may vary) then add the canonical one.
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%subscription_tier%'
  loop
    execute format('alter table public.profiles drop constraint %I', c);
  end loop;
end $$;

alter table public.profiles
  add constraint profiles_subscription_tier_check
  check (subscription_tier in
    ('free','referral_verified','beta','founding','pro_monthly','pro_annual','admin'));

-- access_status / access_tier value guards
alter table public.profiles drop constraint if exists profiles_access_status_check;
alter table public.profiles
  add constraint profiles_access_status_check
  check (access_status in ('waitlist','active','comped','past_due','revoked'));

alter table public.profiles drop constraint if exists profiles_access_tier_check;
alter table public.profiles
  add constraint profiles_access_tier_check
  check (access_tier in ('waitlist','free','referral_verified','beta','pro','admin'));

-- ----------------------------------------------------------------------------
-- 2. Indexes
-- ----------------------------------------------------------------------------
create index if not exists profiles_email_lower_idx       on public.profiles (lower(email));
create index if not exists profiles_status_tier_idx       on public.profiles (access_status, access_tier);
create index if not exists profiles_bitunix_uid_idx       on public.profiles (bitunix_uid);
create unique index if not exists profiles_founding_number_uidx
  on public.profiles (founding_member_number)
  where founding_member_number is not null;

-- ----------------------------------------------------------------------------
-- 3. New tables (RLS on all; service-role only unless noted)
-- ----------------------------------------------------------------------------

-- 3a. revocations -- the deny set. Servers poll this (agent-tasks §0.5.1/§0.5.3).
create table if not exists public.revocations (
  sub         uuid primary key,
  min_version int  not null,
  revoked_at  timestamptz not null default now(),
  reason      text,
  updated_at  timestamptz not null default now()
);
create index if not exists revocations_updated_at_idx on public.revocations (updated_at);
alter table public.revocations enable row level security;
drop policy if exists "revocations service role" on public.revocations;
create policy "revocations service role" on public.revocations
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- 3b. billing_events -- idempotency ledger (unique provider event id).
create table if not exists public.billing_events (
  id                uuid primary key default gen_random_uuid(),
  provider          text not null,
  provider_event_id text not null,
  topic             text,
  payload           jsonb,
  created_at        timestamptz not null default now(),
  unique (provider, provider_event_id)
);
alter table public.billing_events enable row level security;
drop policy if exists "billing_events service role" on public.billing_events;
create policy "billing_events service role" on public.billing_events
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- 3c. pending_entitlements -- pay-before-signup, keyed by normalized email.
create table if not exists public.pending_entitlements (
  id                      uuid primary key default gen_random_uuid(),
  email_norm              text not null,
  subscription_tier       text,
  billing_provider        text,
  billing_status          text,
  plan_started_at         timestamptz,
  plan_expires_at         timestamptz,
  created_at              timestamptz not null default now()
);
create index if not exists pending_entitlements_email_idx on public.pending_entitlements (email_norm);
alter table public.pending_entitlements enable row level security;
drop policy if exists "pending_entitlements service role" on public.pending_entitlements;
create policy "pending_entitlements service role" on public.pending_entitlements
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- 3d. access_events -- append-only audit of every entitlement transition.
create table if not exists public.access_events (
  id         bigint generated always as identity primary key,
  user_id    uuid,
  event      text,
  old_tier   text,
  new_tier   text,
  old_status text,
  new_status text,
  detail     jsonb,
  created_at timestamptz not null default now()
);
create index if not exists access_events_user_idx on public.access_events (user_id, created_at);
alter table public.access_events enable row level security;
drop policy if exists "access_events service role" on public.access_events;
create policy "access_events service role" on public.access_events
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- 3e. bitunix_verifications -- PHASE 2 stub table.
create table if not exists public.bitunix_verifications (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid,
  bitunix_uid     text,
  deposit_usd     numeric,
  volume_30d_usd  numeric,
  verified        boolean default false,
  checked_at      timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists bitunix_verifications_user_idx on public.bitunix_verifications (user_id);
alter table public.bitunix_verifications enable row level security;
drop policy if exists "bitunix_verifications service role" on public.bitunix_verifications;
create policy "bitunix_verifications service role" on public.bitunix_verifications
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- 3f. app_config -- single-row launch posture switch (read by recalc only).
create table if not exists public.app_config (
  id                  int primary key default 1 check (id = 1),
  public_beta_preview boolean not null default true,  -- true = open beta: unmatched profiles resolve to 'free'
  updated_at          timestamptz not null default now()
);
insert into public.app_config (id) values (1) on conflict (id) do nothing;
alter table public.app_config enable row level security;
drop policy if exists "app_config service role" on public.app_config;
create policy "app_config service role" on public.app_config
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- ----------------------------------------------------------------------------
-- 4. founding_member_number atomic source (agent-tasks §0.5.8 -- NOT max+1).
--    Dormant in beta (beta sells pro_monthly/pro_annual, not founding) but
--    wired for forward-compat.
-- ----------------------------------------------------------------------------
-- No hard maxvalue: a cap of 100 would make nextval() RAISE at exhaustion and
-- trigger a billing retry storm. The "first 100 founders" rule is enforced in
-- application logic (the webhook stops assigning past 100); the sequence itself
-- never crashes. Dormant in beta regardless (beta sells pro_monthly/pro_annual).
create sequence if not exists public.founding_member_seq as int minvalue 1;

-- ----------------------------------------------------------------------------
-- 5. RLS write-lock on security columns (agent-tasks §1.1 / correction #8).
--    Two layers of defense:
--      (a) column-level privileges: authenticated may UPDATE only safe columns.
--      (b) a BEFORE UPDATE guard trigger: hard-blocks changes to locked columns
--          from any non-service / non-definer context (belt and suspenders).
--    recalc_entitlements() is SECURITY DEFINER owned by the migration role, so
--    it bypasses both. Billing webhooks use the service role, which bypasses
--    both. Locked: subscription_tier, access_tier, terminal_access,
--    entitlements, entitlements_version (+ all billing/bitunix derivation cols).
-- ----------------------------------------------------------------------------

-- (a) column privileges. Revoke blanket UPDATE, grant back only safe columns.
revoke update on public.profiles from authenticated;
grant  update (email, marketing_opt_in, cohort, invite_code, signup_source)
       on public.profiles to authenticated;

-- Keep the existing own-row select policy from 001; ensure update policy has a
-- WITH CHECK so a user cannot repoint their row id. (001's policy had none.)
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- (b) guard trigger.
create or replace function public.guard_profile_security_columns()
returns trigger
language plpgsql
security invoker
as $$
begin
  -- Allow when running as the table owner / a SECURITY DEFINER chain
  -- (recalc, handle_new_user) or as the service role. In those contexts
  -- auth.uid() is null (no end-user JWT). Block only genuine end-user writes.
  if auth.uid() is null or auth.role() = 'service_role' then
    return new;
  end if;

  if new.subscription_tier    is distinct from old.subscription_tier
     or new.access_tier        is distinct from old.access_tier
     or new.terminal_access    is distinct from old.terminal_access
     or new.entitlements       is distinct from old.entitlements
     or new.entitlements_version is distinct from old.entitlements_version
     or new.access_status      is distinct from old.access_status
     or new.billing_status     is distinct from old.billing_status
     or new.billing_provider   is distinct from old.billing_provider
     or new.plan_expires_at    is distinct from old.plan_expires_at
     or new.founding_member_number is distinct from old.founding_member_number
     or new.bitunix_referral_verified is distinct from old.bitunix_referral_verified
     or new.bitunix_deposit_verified  is distinct from old.bitunix_deposit_verified
  then
    raise exception 'profiles: security/entitlement columns are not user-writable';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_profile_security_columns on public.profiles;
create trigger guard_profile_security_columns
  before update on public.profiles
  for each row execute function public.guard_profile_security_columns();

-- ----------------------------------------------------------------------------
-- 6. Entitlements derivation helper -- the TIER_MATRIX mirror.
--    Returns the {symbols, features, limits, terminal_access} for an access_tier.
--    MUST stay in sync with the servers' in-code TIER_MATRIX (the authority).
-- ----------------------------------------------------------------------------
create or replace function public.tier_entitlements(p_tier text)
returns jsonb
language sql
immutable
as $$
  select case p_tier
    when 'admin' then jsonb_build_object(
      'terminal_access', true,
      'symbols', jsonb_build_array('BTC','ETH','SOL'),
      'features', jsonb_build_object('live_heatmap',true,'live_dom',true,'live_tape',true,'footprint',true,'vap',true,'export',true,'data_taps',true),
      'limits', jsonb_build_object('min_timeframe_ms',0,'max_panes',0,'rest_per_min',1000,'ws_connections',20,'heavy_per_min',10,'export_mb_per_day',10240,'history_days',3650))
    when 'pro' then jsonb_build_object(
      'terminal_access', true,
      'symbols', jsonb_build_array('BTC','ETH','SOL'),
      'features', jsonb_build_object('live_heatmap',true,'live_dom',true,'live_tape',true,'footprint',true,'vap',true,'export',true,'data_taps',true),
      'limits', jsonb_build_object('min_timeframe_ms',0,'max_panes',0,'rest_per_min',300,'ws_connections',5,'heavy_per_min',2,'export_mb_per_day',500,'history_days',90))
    when 'beta' then jsonb_build_object(
      'terminal_access', true,
      'symbols', jsonb_build_array('BTC','ETH','SOL'),
      'features', jsonb_build_object('live_heatmap',true,'live_dom',true,'live_tape',true,'footprint',true,'vap',true,'export',true,'data_taps',true),
      'limits', jsonb_build_object('min_timeframe_ms',0,'max_panes',6,'rest_per_min',240,'ws_connections',4,'heavy_per_min',1,'export_mb_per_day',100,'history_days',30))
    when 'referral_verified' then jsonb_build_object(
      'terminal_access', true,
      'symbols', jsonb_build_array('BTC','ETH','SOL'),
      'features', jsonb_build_object('live_heatmap',true,'live_dom',true,'live_tape',true,'footprint',true,'vap',true,'export',false,'data_taps',true),
      'limits', jsonb_build_object('min_timeframe_ms',0,'max_panes',4,'rest_per_min',180,'ws_connections',3,'heavy_per_min',1,'export_mb_per_day',0,'history_days',30))
    when 'free' then jsonb_build_object(
      'terminal_access', true,   -- has DATA access (BTC/>=5m free allowance on any client). Desktop-eligibility is a separate tier!='free' client gate.
      'symbols', jsonb_build_array('BTC'),
      'features', jsonb_build_object('live_heatmap',false,'live_dom',false,'live_tape',false,'footprint',false,'vap',false,'export',false,'data_taps',false),
      'limits', jsonb_build_object('min_timeframe_ms',300000,'max_panes',1,'rest_per_min',30,'ws_connections',0,'heavy_per_min',0,'export_mb_per_day',0,'history_days',1))
    else jsonb_build_object(  -- waitlist
      'terminal_access', false,
      'symbols', jsonb_build_array(),
      'features', jsonb_build_object('live_heatmap',false,'live_dom',false,'live_tape',false,'footprint',false,'vap',false,'export',false,'data_taps',false),
      'limits', jsonb_build_object('min_timeframe_ms',0,'max_panes',0,'rest_per_min',0,'ws_connections',0,'heavy_per_min',0,'export_mb_per_day',0,'history_days',0))
  end;
$$;

-- ----------------------------------------------------------------------------
-- 7. recalc_entitlements(p_user) -- the SINGLE authoritative writer.
--    Ordered, first-match-wins, with READ-TIME expiry clamp. See header for the
--    beta tier-collapse and free=web-only decisions.
-- ----------------------------------------------------------------------------
create or replace function public.recalc_entitlements(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  pr           public.profiles%rowtype;
  v_tier       text;
  v_term       boolean;
  v_ent        jsonb;
  v_preview    boolean;
  v_old_tier   text;
  v_old_stat   text;
  v_new_version int;
begin
  select * into pr from public.profiles where id = p_user;
  if not found then
    return;
  end if;

  -- Resilient read of the launch-posture flag (never block a recalc/signup on a
  -- missing/corrupt app_config row).
  begin
    select public_beta_preview into v_preview from public.app_config where id = 1;
  exception when others then
    v_preview := false;
  end;
  v_preview := coalesce(v_preview, false);

  v_old_tier := pr.access_tier;
  v_old_stat := pr.access_status;
  -- Compute the post-bump version ONCE and use it for both the profile UPDATE
  -- and the deny-set row, so they can never drift apart.
  v_new_version := pr.entitlements_version + 1;

  -- Ordered derivation (implementation-plan §3, beta-collapsed).
  if pr.access_status = 'revoked' then
    v_tier := 'waitlist';                                   -- 1. revoked beats all
  elsif pr.subscription_tier = 'admin' then
    v_tier := 'admin';                                      -- 2. admin
  elsif pr.access_status = 'past_due' then
    v_tier := 'free';                                       -- 3. lapsed payer -> free preview
  elsif pr.billing_status = 'active'
        and pr.subscription_tier in ('founding','pro_monthly','pro_annual')
        and (pr.plan_expires_at is null or pr.plan_expires_at > now()) then
    v_tier := 'pro';                                        -- 4. active paid -> 'pro' (beta collapse) + read-time clamp
  elsif pr.subscription_tier = 'beta' or pr.access_status = 'comped' then
    v_tier := 'beta';                                       -- 5. manual testers
  elsif pr.bitunix_referral_verified
        and pr.bitunix_deposit_verified
        and coalesce(pr.bitunix_deposit_usd, 0) >= 150
        and (pr.bitunix_access_expires_at is null or pr.bitunix_access_expires_at > now()) then
    v_tier := 'referral_verified';                          -- 6. Bitunix (phase 2) + read-time clamp
  elsif pr.access_status = 'active' or v_preview then
    v_tier := 'free';                                       -- 7. public beta preview
  else
    v_tier := 'waitlist';                                   -- 8. nothing
  end if;

  v_ent  := public.tier_entitlements(v_tier);
  v_term := (v_ent->>'terminal_access')::boolean;

  update public.profiles
     set access_tier              = v_tier,
         terminal_access          = v_term,
         entitlements             = v_ent || jsonb_build_object('plan', v_tier),
         entitlements_version     = v_new_version,
         last_entitlement_sync_at = now()
   where id = p_user;

  -- Deny set: hard revoke writes/refreshes the row at the NEW version so any
  -- token with a lower version is rejected even during a Supabase outage.
  -- Any non-revoked terminal state clears it (re-subscribe path).
  if v_tier = 'waitlist' and pr.access_status = 'revoked' then
    insert into public.revocations (sub, min_version, reason, revoked_at, updated_at)
    values (p_user, v_new_version, 'revoked', now(), now())
    on conflict (sub) do update
      set min_version = excluded.min_version,
          reason      = excluded.reason,
          revoked_at  = now(),
          updated_at  = now();
  else
    delete from public.revocations where sub = p_user;
  end if;

  insert into public.access_events (user_id, event, old_tier, new_tier, old_status, new_status, detail)
  values (p_user, 'recalc', v_old_tier, v_tier, v_old_stat, pr.access_status,
          jsonb_build_object('subscription_tier', pr.subscription_tier,
                             'billing_status', pr.billing_status,
                             'plan_expires_at', pr.plan_expires_at));
end;
$$;

revoke all on function public.recalc_entitlements(uuid) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 8. custom_access_token_hook -- writes EXACTLY the 4 claims (agent-tasks §0.5.6).
--    Missing profile -> least privilege. Never errors token issuance.
-- ----------------------------------------------------------------------------
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  claims  jsonb;
  uid     uuid;
  pr      public.profiles%rowtype;
begin
  claims := coalesce(event->'claims', '{}'::jsonb);
  begin
    uid := (event->>'user_id')::uuid;
  exception when others then
    uid := null;
  end;

  if uid is not null then
    select * into pr from public.profiles where id = uid;
  end if;

  if found then
    claims := jsonb_set(claims, '{tradenet_access}', to_jsonb(coalesce(pr.terminal_access, false)));
    claims := jsonb_set(claims, '{tradenet_tier}',   to_jsonb(coalesce(pr.access_tier, 'waitlist')));
    claims := jsonb_set(claims, '{tradenet_status}', to_jsonb(coalesce(pr.access_status, 'waitlist')));
    claims := jsonb_set(claims, '{tradenet_entitlements_version}', to_jsonb(coalesce(pr.entitlements_version, 0)));
  else
    -- least privilege for missing/unreadable profile
    claims := jsonb_set(claims, '{tradenet_access}', 'false'::jsonb);
    claims := jsonb_set(claims, '{tradenet_tier}',   '"waitlist"'::jsonb);
    claims := jsonb_set(claims, '{tradenet_status}', '"waitlist"'::jsonb);
    claims := jsonb_set(claims, '{tradenet_entitlements_version}', '0'::jsonb);
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$$;

-- supabase_auth_admin runs the hook; end-user roles must not.
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;
-- The hook reads profiles as supabase_auth_admin; grant the minimal read.
grant usage on schema public to supabase_auth_admin;
grant select on public.profiles to supabase_auth_admin;

-- ----------------------------------------------------------------------------
-- 9. handle_new_user: extend to claim pending_entitlements by normalized email,
--    then recalc. (agent-tasks §0.5.9 -- inline SQL, one account per email,
--    most-recent wins, never moves a grant onto a populated profile by email.)
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pend public.pending_entitlements%rowtype;
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);

  -- Pending-purchase claim + initial recalc. Wrapped so that NO transient
  -- failure here can ever block account creation (the profile row already
  -- exists; entitlements converge on the next recalc / cron pass).
  begin
    -- Claim the most-recent matching pending purchase, if any, then delete all
    -- matches for this email so it can't be replayed.
    select * into pend
      from public.pending_entitlements
     where email_norm = lower(trim(new.email))
     order by created_at desc
     limit 1;

    if found then
      update public.profiles
         set subscription_tier       = coalesce(pend.subscription_tier, subscription_tier),
             billing_provider        = pend.billing_provider,
             billing_status          = pend.billing_status,
             plan_started_at         = pend.plan_started_at,
             plan_expires_at         = pend.plan_expires_at,
             access_status           = case when pend.subscription_tier is not null then 'active' else access_status end,
             access_source           = 'pending_entitlement_claim'
       where id = new.id;

      delete from public.pending_entitlements where email_norm = lower(trim(new.email));
    end if;

    perform public.recalc_entitlements(new.id);
  exception when others then
    raise warning 'handle_new_user: pending-claim/recalc skipped for %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

-- trigger already exists from 001 (on_auth_user_created); function is replaced in place.

-- ----------------------------------------------------------------------------
-- 10. pg_cron reconciler (agent-tasks §1.5) -- RECONCILER ONLY. The read-time
--     clamp in recalc is the real gate. This just normalizes expired-but-still-
--     elevated rows every 15 min for reporting/consistency.
-- ----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;

    -- (re)register idempotently
    if exists (select 1 from cron.job where jobname = 'recalc_expired_entitlements') then
      perform cron.unschedule('recalc_expired_entitlements');
    end if;

    perform cron.schedule(
      'recalc_expired_entitlements',
      '*/15 * * * *',
      $cron$
        do $inner$
        declare r record;
        begin
          for r in
            select id from public.profiles
            where access_tier not in ('free','waitlist')
              and (
                (plan_expires_at is not null and plan_expires_at < now())
                or (bitunix_access_expires_at is not null and bitunix_access_expires_at < now())
              )
          loop
            perform public.recalc_entitlements(r.id);
          end loop;
        end
        $inner$;
      $cron$
    );
  else
    raise notice 'pg_cron not available; enable it in the Supabase dashboard then re-run section 10.';
  end if;
end $$;

-- ============================================================================
-- End 002. Apply 003_beta_backfill.sql BEFORE flipping any server to enforce.
-- ============================================================================
