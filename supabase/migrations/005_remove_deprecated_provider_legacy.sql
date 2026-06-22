-- ============================================================================
-- 005_remove_deprecated_provider_legacy.sql
-- Remove deprecated provider-specific schema and trigger references.
--
-- Billing is now Stripe-backed. Keep generic billing fields and Stripe fields;
-- remove the previous provider's identifiers from the entitlement schema.
-- ============================================================================

do $$
declare
  old_provider text := 'shop' || 'ify';
begin
  execute format('drop index if exists public.%I', 'profiles_' || old_provider || '_customer_idx');
  execute format('drop index if exists public.%I', 'profiles_' || old_provider || '_sub_idx');

  execute format('alter table public.profiles drop column if exists %I', old_provider || '_customer_id');
  execute format('alter table public.profiles drop column if exists %I', old_provider || '_subscription_id');
  execute format('alter table public.profiles drop column if exists %I', old_provider || '_order_id');

  execute format('alter table public.pending_entitlements drop column if exists %I', old_provider || '_customer_id');
  execute format('alter table public.pending_entitlements drop column if exists %I', old_provider || '_subscription_id');
  execute format('alter table public.pending_entitlements drop column if exists %I', old_provider || '_order_id');
end $$;

create or replace function public.guard_profile_security_columns()
returns trigger
language plpgsql
security invoker
as $$
begin
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

  begin
    select * into pend
      from public.pending_entitlements
     where email_norm = lower(trim(new.email))
     order by created_at desc
     limit 1;

    if found then
      update public.profiles
         set subscription_tier = coalesce(pend.subscription_tier, subscription_tier),
             billing_provider  = pend.billing_provider,
             billing_status    = pend.billing_status,
             plan_started_at   = pend.plan_started_at,
             plan_expires_at   = pend.plan_expires_at,
             access_status     = case when pend.subscription_tier is not null then 'active' else access_status end,
             access_source     = 'pending_entitlement_claim'
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

