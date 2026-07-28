-- ============================================================================
-- 008_stripe_webhook_ordering_guard.sql
-- Make Stripe entitlement transitions atomic and resilient to webhook order.
--
-- Refunds and disputes are hard revocations. Stripe can deliver those events
-- before checkout, invoice, or subscription events from the same purchase.
-- A stale paid event must never restore access after the hard revocation.
-- ============================================================================

create or replace function public.apply_stripe_billing_state(
  p_user uuid,
  p_subscription_id text,
  p_subscription_created_at timestamptz,
  p_customer_id text,
  p_subscription_tier text,
  p_billing_status text,
  p_access_status text,
  p_plan_started_at timestamptz,
  p_plan_expires_at timestamptz,
  p_may_clear_revocation boolean
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_revoked_at timestamptz;
  v_has_revocation boolean := false;
  v_repair_revocation boolean := false;
begin
  select *
    into v_profile
    from public.profiles
   where id = p_user
   for update;

  if not found then
    return 'unresolved';
  end if;

  select revoked_at
    into v_revoked_at
    from public.revocations
   where sub = p_user;
  v_has_revocation := found;

  -- Repair an inconsistent legacy row conservatively. A hard-revoked profile
  -- is still denied even if its deny-set row was lost.
  if not v_has_revocation and v_profile.access_status = 'revoked' then
    v_has_revocation := true;
    v_repair_revocation := true;
    v_revoked_at := coalesce(
      v_profile.last_entitlement_sync_at,
      v_profile.updated_at,
      now()
    );

    insert into public.revocations (
      sub,
      min_version,
      reason,
      revoked_at,
      updated_at
    )
    values (
      p_user,
      v_profile.entitlements_version,
      'repaired_hard_revocation',
      v_revoked_at,
      now()
    )
    on conflict (sub) do nothing;
  end if;

  if v_has_revocation then
    -- Only a different subscription created after the revocation can restore
    -- access. Updates from the revoked subscription remain permanently stale.
    if p_may_clear_revocation
       and p_subscription_created_at is not null
       and p_subscription_created_at > v_revoked_at
       and (
         v_profile.stripe_subscription_id is null
         or p_subscription_id is distinct from v_profile.stripe_subscription_id
       )
    then
      delete from public.revocations where sub = p_user;
    else
      update public.profiles
         set billing_provider       = 'stripe',
             billing_customer_id    = coalesce(p_customer_id, billing_customer_id),
             stripe_customer_id     = coalesce(p_customer_id, stripe_customer_id),
             stripe_subscription_id = coalesce(p_subscription_id, stripe_subscription_id),
             subscription_tier      = coalesce(p_subscription_tier, subscription_tier),
             plan_started_at        = coalesce(p_plan_started_at, plan_started_at),
             plan_expires_at        = coalesce(p_plan_expires_at, plan_expires_at),
             access_status          = 'revoked'
       where id = p_user;

      if v_repair_revocation
         or v_profile.access_status is distinct from 'revoked'
         or coalesce(v_profile.terminal_access, false)
      then
        perform public.recalc_entitlements(p_user);
      end if;

      return 'revoked_event_ignored';
    end if;
  end if;

  update public.profiles
     set billing_provider       = 'stripe',
         billing_status         = coalesce(p_billing_status, billing_status),
         access_status          = coalesce(p_access_status, access_status),
         access_source          = 'stripe',
         billing_customer_id    = coalesce(p_customer_id, billing_customer_id),
         stripe_customer_id     = coalesce(p_customer_id, stripe_customer_id),
         stripe_subscription_id = coalesce(p_subscription_id, stripe_subscription_id),
         subscription_tier      = coalesce(p_subscription_tier, subscription_tier),
         plan_started_at        = coalesce(p_plan_started_at, plan_started_at),
         plan_expires_at        = coalesce(p_plan_expires_at, plan_expires_at)
   where id = p_user;

  perform public.recalc_entitlements(p_user);
  return 'applied';
end;
$$;

create or replace function public.apply_stripe_hard_revocation(
  p_user uuid,
  p_billing_status text,
  p_reason text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
begin
  if p_billing_status not in ('refunded', 'disputed') then
    raise exception 'invalid_stripe_hard_revocation_status';
  end if;

  select *
    into v_profile
    from public.profiles
   where id = p_user
   for update;

  if not found then
    return 'unresolved';
  end if;

  update public.profiles
     set billing_provider = 'stripe',
         billing_status   = p_billing_status,
         access_status    = 'revoked',
         access_source    = left(coalesce(p_reason, 'stripe_hard_revocation'), 100)
   where id = p_user;

  perform public.recalc_entitlements(p_user);

  update public.revocations
     set reason = left(coalesce(p_reason, 'stripe_hard_revocation'), 200),
         updated_at = now()
   where sub = p_user;

  return 'hard_revoked';
end;
$$;

revoke all on function public.apply_stripe_billing_state(
  uuid,
  text,
  timestamptz,
  text,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  boolean
) from public, anon, authenticated;

revoke all on function public.apply_stripe_hard_revocation(
  uuid,
  text,
  text
) from public, anon, authenticated;

grant execute on function public.apply_stripe_billing_state(
  uuid,
  text,
  timestamptz,
  text,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  boolean
) to service_role;

grant execute on function public.apply_stripe_hard_revocation(
  uuid,
  text,
  text
) to service_role;

comment on function public.apply_stripe_billing_state(
  uuid,
  text,
  timestamptz,
  text,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  boolean
) is
  'Atomically applies Stripe subscription state while preserving hard revocations against stale events.';

comment on function public.apply_stripe_hard_revocation(
  uuid,
  text,
  text
) is
  'Atomically revokes Stripe-funded access for a refund or dispute.';
