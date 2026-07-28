-- ============================================================================
-- 009_stripe_subscription_generation_guard.sql
-- Keep newer Stripe subscriptions authoritative and make failed first-payment
-- recovery safe.
--
-- Stripe can deliver events from an older subscription after a customer has
-- started and paid a replacement subscription. Store the Stripe creation time
-- with the current subscription so those stale events cannot downgrade access
-- or replace the current subscription id.
-- ============================================================================

alter table public.profiles
  add column if not exists stripe_subscription_created_at timestamptz;

comment on column public.profiles.stripe_subscription_created_at is
  'Stripe creation time for the current subscription, used to reject stale events from older subscriptions.';

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
     or new.stripe_subscription_created_at
          is distinct from old.stripe_subscription_created_at
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

revoke update (stripe_subscription_created_at) on public.profiles
  from authenticated;

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
  v_different_subscription boolean := false;
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

  v_different_subscription :=
    p_subscription_id is not null
    and v_profile.stripe_subscription_id is not null
    and p_subscription_id is distinct from v_profile.stripe_subscription_id;

  if v_has_revocation then
    -- Keep the revoked subscription pointer in place until a genuinely newer,
    -- successful subscription arrives. An incomplete replacement must not
    -- consume the one transition that is allowed to clear a hard revocation.
    if p_may_clear_revocation
       and p_subscription_created_at is not null
       and p_subscription_created_at > v_revoked_at
       and (
         v_profile.stripe_subscription_id is null
         or v_different_subscription
       )
    then
      delete from public.revocations where sub = p_user;
    else
      update public.profiles
         set billing_provider    = 'stripe',
             billing_customer_id = coalesce(p_customer_id, billing_customer_id),
             stripe_customer_id  = coalesce(p_customer_id, stripe_customer_id),
             access_status       = 'revoked'
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

  if v_different_subscription then
    if p_subscription_created_at is null then
      return 'unordered_subscription_ignored';
    end if;

    if v_profile.stripe_subscription_created_at is not null
       and p_subscription_created_at <=
         v_profile.stripe_subscription_created_at
    then
      return 'stale_subscription_ignored';
    end if;

    -- A newly observed failed or incomplete subscription cannot displace an
    -- existing nonterminal subscription. A newer active subscription may
    -- replace it, and any status may replace a terminal subscription.
    if not p_may_clear_revocation
       and coalesce(v_profile.billing_status, '') not in (
         'cancelled',
         'canceled',
         'incomplete_expired',
         'refunded',
         'disputed'
       )
    then
      return 'subscription_conflict_ignored';
    end if;
  end if;

  update public.profiles
     set billing_provider       = 'stripe',
         billing_status         = coalesce(p_billing_status, billing_status),
         access_status          = coalesce(p_access_status, access_status),
         access_source          = 'stripe',
         billing_customer_id    = coalesce(p_customer_id, billing_customer_id),
         stripe_customer_id     = coalesce(p_customer_id, stripe_customer_id),
         stripe_subscription_id = coalesce(
           p_subscription_id,
           stripe_subscription_id
         ),
         stripe_subscription_created_at = case
           when p_subscription_id is null
             then stripe_subscription_created_at
           when p_subscription_id is not distinct from stripe_subscription_id
             then coalesce(
               p_subscription_created_at,
               stripe_subscription_created_at
             )
           else p_subscription_created_at
         end,
         subscription_tier      = coalesce(
           p_subscription_tier,
           subscription_tier
         ),
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
begin
  if p_billing_status not in ('refunded', 'disputed') then
    raise exception 'invalid_stripe_hard_revocation_status';
  end if;

  perform 1
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
         access_source    = left(
           coalesce(p_reason, 'stripe_hard_revocation'),
           100
         )
   where id = p_user;

  perform public.recalc_entitlements(p_user);

  update public.revocations
     set reason = left(
           coalesce(p_reason, 'stripe_hard_revocation'),
           200
         ),
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
  'Atomically applies only the newest Stripe subscription state while preserving hard revocations.';

comment on function public.apply_stripe_hard_revocation(
  uuid,
  text,
  text
) is
  'Atomically revokes Stripe-funded access for a refund or dispute.';
