-- ============================================================================
-- 018_affiliate_attribution.sql
-- Private first-touch affiliate attribution and commission accounting.
--
-- Browser clients never read or write these tables. Public referral and claim
-- requests are mediated by Edge Functions; Stripe invoices remain the source
-- of truth for collected revenue and commissions.
-- ============================================================================

create table if not exists public.affiliates (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  display_name text not null,
  status text not null default 'active'
    check (status in ('active', 'paused', 'archived')),
  commission_bps integer not null default 3000
    check (commission_bps between 0 and 10000),
  attribution_window_days integer not null default 30
    check (attribution_window_days between 1 and 365),
  commission_months integer not null default 12
    check (commission_months between 1 and 120),
  hold_days integer not null default 30
    check (hold_days between 0 and 180),
  minimum_payout_cents bigint not null default 5000
    check (minimum_payout_cents >= 0),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint affiliates_slug_format check (
    slug = lower(slug)
    and slug ~ '^[a-z0-9][a-z0-9-]{1,47}[a-z0-9]$'
  ),
  constraint affiliates_display_name_length check (
    char_length(btrim(display_name)) between 1 and 100
  )
);

create unique index if not exists affiliates_slug_uidx
  on public.affiliates (slug);
create index if not exists affiliates_status_idx
  on public.affiliates (status, created_at desc);

create table if not exists public.affiliate_clicks (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete restrict,
  visitor_hash text not null,
  clicked_on date not null,
  first_clicked_at timestamptz not null,
  last_clicked_at timestamptz not null,
  expires_at timestamptz not null,
  hit_count integer not null default 1 check (hit_count > 0),
  landing_path text,
  last_landing_path text,
  campaign text,
  referrer_host text,
  created_at timestamptz not null default now(),
  constraint affiliate_clicks_visitor_hash_format check (
    visitor_hash ~ '^[a-f0-9]{64}$'
  ),
  constraint affiliate_clicks_landing_path_length check (
    landing_path is null or char_length(landing_path) <= 500
  ),
  constraint affiliate_clicks_last_landing_path_length check (
    last_landing_path is null or char_length(last_landing_path) <= 500
  ),
  constraint affiliate_clicks_campaign_length check (
    campaign is null or char_length(campaign) <= 100
  ),
  constraint affiliate_clicks_referrer_host_length check (
    referrer_host is null or char_length(referrer_host) <= 255
  )
);

create unique index if not exists affiliate_clicks_daily_visitor_uidx
  on public.affiliate_clicks (affiliate_id, visitor_hash, clicked_on);
create index if not exists affiliate_clicks_affiliate_time_idx
  on public.affiliate_clicks (affiliate_id, first_clicked_at desc);
create index if not exists affiliate_clicks_expiry_idx
  on public.affiliate_clicks (expires_at);

create table if not exists public.affiliate_attributions (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete restrict,
  click_id uuid not null unique references public.affiliate_clicks(id) on delete restrict,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  commission_bps integer not null check (commission_bps between 0 and 10000),
  commission_months integer not null check (commission_months between 1 and 120),
  hold_days integer not null check (hold_days between 0 and 180),
  attributed_at timestamptz not null default now(),
  commission_started_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists affiliate_attributions_affiliate_time_idx
  on public.affiliate_attributions (affiliate_id, attributed_at desc);

create table if not exists public.affiliate_commissions (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete restrict,
  attribution_id uuid not null references public.affiliate_attributions(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  stripe_invoice_id text not null unique,
  stripe_subscription_id text not null,
  stripe_charge_id text,
  stripe_payment_intent_id text,
  currency text not null,
  collected_cents bigint not null check (collected_cents >= 0),
  tax_cents bigint not null default 0 check (tax_cents >= 0),
  commissionable_cents bigint not null check (commissionable_cents >= 0),
  commission_bps integer not null check (commission_bps between 0 and 10000),
  commission_cents bigint not null check (commission_cents >= 0),
  refunded_cents bigint not null default 0 check (refunded_cents >= 0),
  reversed_commission_cents bigint not null default 0
    check (reversed_commission_cents >= 0),
  paid_at timestamptz not null,
  available_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint affiliate_commissions_currency_format check (
    currency = lower(currency) and currency ~ '^[a-z]{3}$'
  ),
  constraint affiliate_commissions_refund_bounds check (
    refunded_cents <= collected_cents
  ),
  constraint affiliate_commissions_reversal_bounds check (
    reversed_commission_cents <= commission_cents
  )
);

create index if not exists affiliate_commissions_affiliate_time_idx
  on public.affiliate_commissions (affiliate_id, paid_at desc);
create index if not exists affiliate_commissions_user_idx
  on public.affiliate_commissions (user_id, paid_at desc);
create index if not exists affiliate_commissions_charge_idx
  on public.affiliate_commissions (stripe_charge_id)
  where stripe_charge_id is not null;
create index if not exists affiliate_commissions_payment_intent_idx
  on public.affiliate_commissions (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;
create index if not exists affiliate_commissions_available_idx
  on public.affiliate_commissions (affiliate_id, currency, available_at);

create table if not exists public.affiliate_payouts (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete restrict,
  currency text not null default 'usd',
  amount_cents bigint not null check (amount_cents > 0),
  status text not null default 'paid'
    check (status in ('pending', 'paid', 'failed', 'cancelled')),
  method text not null default 'manual',
  reference text not null,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  constraint affiliate_payouts_currency_format check (
    currency = lower(currency) and currency ~ '^[a-z]{3}$'
  ),
  constraint affiliate_payouts_reference_length check (
    char_length(btrim(reference)) between 1 and 200
  ),
  constraint affiliate_payouts_notes_length check (
    notes is null or char_length(notes) <= 1000
  )
);

create index if not exists affiliate_payouts_affiliate_time_idx
  on public.affiliate_payouts (affiliate_id, created_at desc);

alter table public.affiliates enable row level security;
alter table public.affiliate_clicks enable row level security;
alter table public.affiliate_attributions enable row level security;
alter table public.affiliate_commissions enable row level security;
alter table public.affiliate_payouts enable row level security;

revoke all on public.affiliates from anon, authenticated;
revoke all on public.affiliate_clicks from anon, authenticated;
revoke all on public.affiliate_attributions from anon, authenticated;
revoke all on public.affiliate_commissions from anon, authenticated;
revoke all on public.affiliate_payouts from anon, authenticated;

drop trigger if exists affiliates_updated_at on public.affiliates;
create trigger affiliates_updated_at
  before update on public.affiliates
  for each row execute function public.update_updated_at();

drop trigger if exists affiliate_commissions_updated_at
  on public.affiliate_commissions;
create trigger affiliate_commissions_updated_at
  before update on public.affiliate_commissions
  for each row execute function public.update_updated_at();

create or replace function public.record_affiliate_click(
  p_slug text,
  p_visitor_hash text,
  p_landing_path text default null,
  p_campaign text default null,
  p_referrer_host text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_affiliate public.affiliates%rowtype;
  v_click public.affiliate_clicks%rowtype;
begin
  select * into v_affiliate
  from public.affiliates
  where slug = lower(btrim(p_slug))
    and status = 'active';

  if not found then
    raise exception 'affiliate_not_found';
  end if;
  if p_visitor_hash is null or p_visitor_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'affiliate_visitor_invalid';
  end if;

  insert into public.affiliate_clicks (
    affiliate_id,
    visitor_hash,
    clicked_on,
    first_clicked_at,
    last_clicked_at,
    expires_at,
    landing_path,
    last_landing_path,
    campaign,
    referrer_host
  ) values (
    v_affiliate.id,
    p_visitor_hash,
    (v_now at time zone 'UTC')::date,
    v_now,
    v_now,
    v_now + make_interval(days => v_affiliate.attribution_window_days),
    left(nullif(p_landing_path, ''), 500),
    left(nullif(p_landing_path, ''), 500),
    left(nullif(p_campaign, ''), 100),
    left(nullif(p_referrer_host, ''), 255)
  )
  on conflict (affiliate_id, visitor_hash, clicked_on) do update
    set last_clicked_at = v_now,
        hit_count = affiliate_clicks.hit_count + 1,
        last_landing_path = excluded.last_landing_path
  returning * into v_click;

  return jsonb_build_object(
    'click_token', v_click.id,
    'affiliate_slug', v_affiliate.slug,
    'expires_at', v_click.expires_at,
    'attribution_window_days', v_affiliate.attribution_window_days
  );
end;
$$;

revoke all on function public.record_affiliate_click(text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.record_affiliate_click(text, text, text, text, text)
  to service_role;

create or replace function public.claim_affiliate_attribution(
  p_user uuid,
  p_click_token uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.affiliate_attributions%rowtype;
  v_click public.affiliate_clicks%rowtype;
  v_affiliate public.affiliates%rowtype;
  v_attribution public.affiliate_attributions%rowtype;
begin
  if p_user is null or p_click_token is null then
    raise exception 'affiliate_claim_invalid';
  end if;

  select * into v_existing
  from public.affiliate_attributions
  where user_id = p_user;

  if found then
    return jsonb_build_object(
      'status', 'already_attributed',
      'attribution_id', v_existing.id,
      'affiliate_id', v_existing.affiliate_id
    );
  end if;

  select * into v_click
  from public.affiliate_clicks
  where id = p_click_token
  for update;

  if not found or v_click.expires_at <= clock_timestamp() then
    raise exception 'affiliate_click_invalid';
  end if;

  select * into v_affiliate
  from public.affiliates
  where id = v_click.affiliate_id
    and status = 'active';

  if not found then
    raise exception 'affiliate_not_active';
  end if;

  insert into public.affiliate_attributions (
    affiliate_id,
    click_id,
    user_id,
    commission_bps,
    commission_months,
    hold_days
  ) values (
    v_affiliate.id,
    v_click.id,
    p_user,
    v_affiliate.commission_bps,
    v_affiliate.commission_months,
    v_affiliate.hold_days
  )
  returning * into v_attribution;

  return jsonb_build_object(
    'status', 'attributed',
    'attribution_id', v_attribution.id,
    'affiliate_id', v_attribution.affiliate_id,
    'affiliate_slug', v_affiliate.slug
  );
exception
  when unique_violation then
    select * into v_existing
    from public.affiliate_attributions
    where user_id = p_user;
    if found then
      return jsonb_build_object(
        'status', 'already_attributed',
        'attribution_id', v_existing.id,
        'affiliate_id', v_existing.affiliate_id
      );
    end if;
    raise exception 'affiliate_click_already_claimed';
end;
$$;

revoke all on function public.claim_affiliate_attribution(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.claim_affiliate_attribution(uuid, uuid)
  to service_role;

create or replace function public.record_affiliate_commission(
  p_user uuid,
  p_attribution uuid,
  p_invoice_id text,
  p_subscription_id text,
  p_charge_id text,
  p_payment_intent_id text,
  p_currency text,
  p_collected_cents bigint,
  p_tax_cents bigint,
  p_commissionable_cents bigint,
  p_paid_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attribution public.affiliate_attributions%rowtype;
  v_commission public.affiliate_commissions%rowtype;
  v_started_at timestamptz;
  v_commission_cents bigint;
begin
  if p_user is null or p_attribution is null or nullif(p_invoice_id, '') is null
     or nullif(p_subscription_id, '') is null or p_paid_at is null then
    raise exception 'affiliate_commission_identity_invalid';
  end if;
  if lower(coalesce(p_currency, '')) !~ '^[a-z]{3}$'
     or p_collected_cents < 0 or p_tax_cents < 0
     or p_commissionable_cents < 0
     or p_commissionable_cents > p_collected_cents then
    raise exception 'affiliate_commission_amount_invalid';
  end if;

  select * into v_attribution
  from public.affiliate_attributions
  where id = p_attribution
    and user_id = p_user
  for update;

  if not found then
    raise exception 'affiliate_attribution_not_found';
  end if;

  v_started_at := coalesce(v_attribution.commission_started_at, p_paid_at);
  if v_attribution.commission_started_at is null then
    update public.affiliate_attributions
    set commission_started_at = v_started_at
    where id = v_attribution.id;
  end if;

  if p_paid_at >= v_started_at + make_interval(months => v_attribution.commission_months) then
    return jsonb_build_object('status', 'outside_commission_window');
  end if;

  v_commission_cents := round(
    p_commissionable_cents::numeric * v_attribution.commission_bps::numeric / 10000
  )::bigint;

  insert into public.affiliate_commissions (
    affiliate_id,
    attribution_id,
    user_id,
    stripe_invoice_id,
    stripe_subscription_id,
    stripe_charge_id,
    stripe_payment_intent_id,
    currency,
    collected_cents,
    tax_cents,
    commissionable_cents,
    commission_bps,
    commission_cents,
    paid_at,
    available_at
  ) values (
    v_attribution.affiliate_id,
    v_attribution.id,
    v_attribution.user_id,
    p_invoice_id,
    p_subscription_id,
    nullif(p_charge_id, ''),
    nullif(p_payment_intent_id, ''),
    lower(p_currency),
    p_collected_cents,
    p_tax_cents,
    p_commissionable_cents,
    v_attribution.commission_bps,
    v_commission_cents,
    p_paid_at,
    p_paid_at + make_interval(days => v_attribution.hold_days)
  )
  on conflict (stripe_invoice_id) do nothing
  returning * into v_commission;

  if not found then
    select * into v_commission
    from public.affiliate_commissions
    where stripe_invoice_id = p_invoice_id;
    return jsonb_build_object(
      'status', 'duplicate_noop',
      'commission_id', v_commission.id
    );
  end if;

  return jsonb_build_object(
    'status', 'recorded',
    'commission_id', v_commission.id,
    'commission_cents', v_commission.commission_cents,
    'available_at', v_commission.available_at
  );
end;
$$;

revoke all on function public.record_affiliate_commission(
  uuid, uuid, text, text, text, text, text, bigint, bigint, bigint, timestamptz
) from public, anon, authenticated;
grant execute on function public.record_affiliate_commission(
  uuid, uuid, text, text, text, text, text, bigint, bigint, bigint, timestamptz
) to service_role;

create or replace function public.reconcile_affiliate_reversal(
  p_invoice_id text,
  p_charge_id text,
  p_payment_intent_id text,
  p_refunded_cents bigint,
  p_full_reversal boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_commission public.affiliate_commissions%rowtype;
  v_refunded bigint;
  v_reversed bigint;
begin
  select * into v_commission
  from public.affiliate_commissions
  where (nullif(p_invoice_id, '') is not null and stripe_invoice_id = p_invoice_id)
     or (nullif(p_charge_id, '') is not null and stripe_charge_id = p_charge_id)
     or (
       nullif(p_payment_intent_id, '') is not null
       and stripe_payment_intent_id = p_payment_intent_id
     )
  order by created_at desc
  limit 1
  for update;

  if not found then
    return jsonb_build_object('status', 'commission_not_found');
  end if;

  v_refunded := case
    when p_full_reversal then v_commission.collected_cents
    else least(
      v_commission.collected_cents,
      greatest(v_commission.refunded_cents, coalesce(p_refunded_cents, 0))
    )
  end;
  v_reversed := case
    when v_commission.collected_cents = 0 then v_commission.commission_cents
    else round(
      v_commission.commission_cents::numeric
      * v_refunded::numeric
      / v_commission.collected_cents::numeric
    )::bigint
  end;

  update public.affiliate_commissions
  set refunded_cents = v_refunded,
      reversed_commission_cents = least(commission_cents, v_reversed)
  where id = v_commission.id
  returning * into v_commission;

  return jsonb_build_object(
    'status', 'reconciled',
    'commission_id', v_commission.id,
    'refunded_cents', v_commission.refunded_cents,
    'reversed_commission_cents', v_commission.reversed_commission_cents
  );
end;
$$;

revoke all on function public.reconcile_affiliate_reversal(
  text, text, text, bigint, boolean
) from public, anon, authenticated;
grant execute on function public.reconcile_affiliate_reversal(
  text, text, text, bigint, boolean
) to service_role;

create or replace view public.affiliate_admin_summary as
with click_totals as (
  select
    affiliate_id,
    count(*)::bigint as unique_clicks,
    coalesce(sum(hit_count), 0)::bigint as total_clicks
  from public.affiliate_clicks
  group by affiliate_id
),
attribution_totals as (
  select affiliate_id, count(*)::bigint as attributed_accounts
  from public.affiliate_attributions
  group by affiliate_id
),
commission_totals as (
  select
    affiliate_id,
    currency,
    count(*)::bigint as paid_invoices,
    count(distinct user_id)::bigint as paid_customers,
    coalesce(sum(collected_cents), 0)::bigint as gross_collected_cents,
    coalesce(sum(refunded_cents), 0)::bigint as refunded_cents,
    coalesce(sum(collected_cents - refunded_cents), 0)::bigint
      as net_collected_cents,
    coalesce(sum(commission_cents), 0)::bigint as gross_commission_cents,
    coalesce(sum(reversed_commission_cents), 0)::bigint
      as reversed_commission_cents,
    coalesce(sum(
      case when available_at > now()
        then commission_cents - reversed_commission_cents
        else 0 end
    ), 0)::bigint as pending_commission_cents,
    coalesce(sum(
      case when available_at <= now()
        then commission_cents - reversed_commission_cents
        else 0 end
    ), 0)::bigint as matured_commission_cents
  from public.affiliate_commissions
  group by affiliate_id, currency
),
payout_totals as (
  select
    affiliate_id,
    currency,
    coalesce(sum(amount_cents) filter (where status = 'paid'), 0)::bigint
      as paid_commission_cents
  from public.affiliate_payouts
  group by affiliate_id, currency
)
select
  a.id,
  a.slug,
  a.display_name,
  a.status,
  a.commission_bps,
  a.attribution_window_days,
  a.commission_months,
  a.hold_days,
  a.minimum_payout_cents,
  a.created_at,
  coalesce(ct.unique_clicks, 0)::bigint as unique_clicks,
  coalesce(ct.total_clicks, 0)::bigint as total_clicks,
  coalesce(at.attributed_accounts, 0)::bigint as attributed_accounts,
  coalesce(cm.currency, po.currency, 'usd') as currency,
  coalesce(cm.paid_invoices, 0)::bigint as paid_invoices,
  coalesce(cm.paid_customers, 0)::bigint as paid_customers,
  coalesce(cm.gross_collected_cents, 0)::bigint as gross_collected_cents,
  coalesce(cm.refunded_cents, 0)::bigint as refunded_cents,
  coalesce(cm.net_collected_cents, 0)::bigint as net_collected_cents,
  coalesce(cm.gross_commission_cents, 0)::bigint as gross_commission_cents,
  coalesce(cm.reversed_commission_cents, 0)::bigint
    as reversed_commission_cents,
  coalesce(cm.pending_commission_cents, 0)::bigint
    as pending_commission_cents,
  greatest(
    coalesce(cm.matured_commission_cents, 0)
      - coalesce(po.paid_commission_cents, 0),
    0
  )::bigint as available_commission_cents,
  coalesce(po.paid_commission_cents, 0)::bigint as paid_commission_cents,
  (
    coalesce(cm.matured_commission_cents, 0)
      - coalesce(po.paid_commission_cents, 0)
  )::bigint as payout_balance_cents
from public.affiliates a
left join click_totals ct on ct.affiliate_id = a.id
left join attribution_totals at on at.affiliate_id = a.id
left join commission_totals cm on cm.affiliate_id = a.id
left join payout_totals po
  on po.affiliate_id = a.id
  and po.currency = coalesce(cm.currency, po.currency);

revoke all on public.affiliate_admin_summary from public, anon, authenticated;
grant select on public.affiliate_admin_summary to service_role;

create or replace function public.create_affiliate_payout(
  p_affiliate uuid,
  p_actor uuid,
  p_currency text,
  p_reference text,
  p_notes text default null
)
returns public.affiliate_payouts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_affiliate public.affiliates%rowtype;
  v_matured bigint;
  v_paid bigint;
  v_available bigint;
  v_payout public.affiliate_payouts%rowtype;
  v_currency text := lower(coalesce(p_currency, 'usd'));
begin
  if not exists (
    select 1 from public.profiles
    where id = p_actor
      and access_tier = 'admin'
      and coalesce(access_status, 'active') not in ('revoked', 'cancelled')
  ) then
    raise exception 'admin_required';
  end if;
  if nullif(btrim(p_reference), '') is null then
    raise exception 'payout_reference_required';
  end if;

  select * into v_affiliate
  from public.affiliates
  where id = p_affiliate
  for update;
  if not found then raise exception 'affiliate_not_found'; end if;

  select coalesce(sum(commission_cents - reversed_commission_cents), 0)
  into v_matured
  from public.affiliate_commissions
  where affiliate_id = p_affiliate
    and currency = v_currency
    and available_at <= clock_timestamp();

  select coalesce(sum(amount_cents), 0)
  into v_paid
  from public.affiliate_payouts
  where affiliate_id = p_affiliate
    and currency = v_currency
    and status = 'paid';

  v_available := v_matured - v_paid;
  if v_available <= 0 then raise exception 'payout_balance_empty'; end if;
  if v_available < v_affiliate.minimum_payout_cents then
    raise exception 'payout_minimum_not_met';
  end if;

  insert into public.affiliate_payouts (
    affiliate_id,
    currency,
    amount_cents,
    status,
    method,
    reference,
    notes,
    created_by,
    paid_at
  ) values (
    p_affiliate,
    v_currency,
    v_available,
    'paid',
    'manual',
    left(btrim(p_reference), 200),
    left(nullif(p_notes, ''), 1000),
    p_actor,
    clock_timestamp()
  ) returning * into v_payout;

  return v_payout;
end;
$$;

revoke all on function public.create_affiliate_payout(
  uuid, uuid, text, text, text
) from public, anon, authenticated;
grant execute on function public.create_affiliate_payout(
  uuid, uuid, text, text, text
) to service_role;

comment on table public.affiliates is
  'Private affiliate configuration. New accounts receive immutable terms at attribution time.';
comment on table public.affiliate_clicks is
  'Privacy-preserving referral clicks. No raw IP address or user agent is retained.';
comment on table public.affiliate_attributions is
  'First-touch account binding. One authenticated user can have at most one affiliate.';
comment on table public.affiliate_commissions is
  'Invoice-level commission ledger derived only from verified Stripe webhooks.';
comment on table public.affiliate_payouts is
  'Manual payout ledger. Available balances include the configured hold and refund reversals.';
