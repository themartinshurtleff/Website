-- ============================================================================
-- 004_stripe_billing.sql
-- Additive Stripe billing support for the existing entitlement model.
--
-- Stripe is only a billing provider here. Terminal access is still derived by
-- public.recalc_entitlements(), which remains the single authority for
-- access_tier, terminal_access, entitlements, and token claim inputs.
-- ============================================================================

alter table public.profiles add column if not exists stripe_customer_id text;
alter table public.profiles add column if not exists stripe_subscription_id text;

create unique index if not exists profiles_stripe_customer_uidx
  on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;

create unique index if not exists profiles_stripe_subscription_uidx
  on public.profiles (stripe_subscription_id)
  where stripe_subscription_id is not null;

comment on column public.profiles.stripe_customer_id is
  'Stripe customer id for hosted checkout and customer portal sessions.';

comment on column public.profiles.stripe_subscription_id is
  'Current Stripe subscription id used by the Stripe webhook to reconcile access.';

-- Extend the end-user update guard from 002 so Stripe identity fields cannot be
-- self-written by a logged-in browser client.
create or replace function public.guard_profile_security_columns()
returns trigger
language plpgsql
security invoker
as $$
begin
  -- Allow table owner / SECURITY DEFINER chains and the service role. Block
  -- only genuine end-user writes.
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
     or new.billing_customer_id is distinct from old.billing_customer_id
     or new.stripe_customer_id is distinct from old.stripe_customer_id
     or new.stripe_subscription_id is distinct from old.stripe_subscription_id
     or new.shopify_subscription_id is distinct from old.shopify_subscription_id
     or new.shopify_order_id   is distinct from old.shopify_order_id
     or new.plan_started_at    is distinct from old.plan_started_at
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

-- Keep existing authenticated profile edits narrow after adding Stripe fields.
revoke update on public.profiles from authenticated;
grant update (email, marketing_opt_in, cohort, invite_code, signup_source)
  on public.profiles to authenticated;

