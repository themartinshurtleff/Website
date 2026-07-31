-- Permanently remove one email and its account data from TradeNet Supabase.
--
-- Run in the intended Supabase project's SQL Editor as an owner/admin.
-- The entire operation is transactional. Any error rolls everything back.
--
-- IMPORTANT:
-- 1. Replace BOTH email values below with the same normalized email.
-- 2. Keep v_allow_billed_account_purge false unless any Stripe subscription has
--    already been canceled and the Stripe customer has been handled separately.
-- 3. This does not delete Stripe customers, subscriptions, invoices, or payments.
-- 4. Removing and re-adding a waitlist row does not automatically add an email
--    to the frozen founding cohort.

begin;

do $purge$
declare
  v_target_email text := lower(btrim('EMAIL_TO_DELETE@example.com'));
  v_confirm_email text := lower(btrim('EMAIL_TO_DELETE@example.com'));

  -- Deliberate safety latch for accounts with billing or redeemed-offer data.
  v_allow_billed_account_purge boolean := false;

  v_user_id uuid;
  v_auth_user_count integer;
  v_stripe_customer_id text;
  v_stripe_subscription_id text;
  v_stripe_schedule_id text;
  v_checkout_session_id text;
  v_founding_state text;
  v_deleted_announcements integer := 0;
begin
  if v_target_email = ''
     or v_target_email = 'email_to_delete@example.com'
     or v_target_email <> v_confirm_email then
    raise exception
      'Set both email values to the same real target email before running';
  end if;

  select count(*), (array_agg(id order by created_at))[1]
    into v_auth_user_count, v_user_id
    from auth.users
   where lower(btrim(email)) = v_target_email;

  if v_auth_user_count > 1 then
    raise exception
      'Refusing purge: multiple auth users match %', v_target_email;
  end if;

  select
    coalesce(p.stripe_customer_id, f.stripe_customer_id),
    coalesce(p.stripe_subscription_id, f.stripe_subscription_id),
    f.stripe_schedule_id,
    f.checkout_session_id,
    f.state
    into
      v_stripe_customer_id,
      v_stripe_subscription_id,
      v_stripe_schedule_id,
      v_checkout_session_id,
      v_founding_state
    from (select 1) seed
    left join public.profiles p
      on p.id = v_user_id
    left join public.founding_offer_eligibility f
      on f.email_norm = v_target_email
      or (v_user_id is not null and f.user_id = v_user_id);

  if not v_allow_billed_account_purge
     and (
       v_stripe_customer_id is not null
       or v_stripe_subscription_id is not null
       or v_stripe_schedule_id is not null
       or v_checkout_session_id is not null
       or v_founding_state in ('reserved', 'redeemed')
     ) then
    raise exception
      'Refusing billed/founding purge for %. Handle Stripe first, then set v_allow_billed_account_purge=true if permanent local deletion is intended',
      v_target_email;
  end if;

  -- Remove announcement records owned by this account and their audit history.
  if v_user_id is not null then
    delete from public.client_announcement_audit
     where actor_id = v_user_id
        or announcement_id in (
          select id
            from public.client_announcements
           where created_by = v_user_id
              or published_by = v_user_id
        );

    delete from public.client_announcements
     where created_by = v_user_id
        or published_by = v_user_id;

    get diagnostics v_deleted_announcements = row_count;

    if v_deleted_announcements > 0 then
      update public.client_announcement_state
         set revision = revision + 1,
             updated_at = now()
       where singleton;
    end if;
  end if;

  -- Remove entitlement, referral, revocation, and billing-ledger traces.
  delete from public.access_events
   where v_user_id is not null
     and user_id = v_user_id;

  delete from public.bitunix_verifications
   where v_user_id is not null
     and user_id = v_user_id;

  delete from public.revocations
   where v_user_id is not null
     and sub = v_user_id;

  delete from public.pending_entitlements
   where email_norm = v_target_email;

  delete from public.billing_events
   where lower(payload::text) like '%' || v_target_email || '%'
      or (
        v_user_id is not null
        and payload::text like '%' || v_user_id::text || '%'
      )
      or (
        v_stripe_customer_id is not null
        and payload::text like '%' || v_stripe_customer_id || '%'
      )
      or (
        v_stripe_subscription_id is not null
        and payload::text like '%' || v_stripe_subscription_id || '%'
      )
      or (
        v_stripe_schedule_id is not null
        and payload::text like '%' || v_stripe_schedule_id || '%'
      )
      or (
        v_checkout_session_id is not null
        and payload::text like '%' || v_checkout_session_id || '%'
      );

  -- Remove the private founding row before its source waitlist row.
  delete from public.founding_offer_eligibility
   where email_norm = v_target_email
      or (v_user_id is not null and user_id = v_user_id);

  update public.founding_offer_config
     set cohort_size = (
           select count(*)::integer
             from public.founding_offer_eligibility
         ),
         updated_at = now()
   where id = 1;

  delete from public.waitlist
   where lower(btrim(email)) = v_target_email;

  -- Remove profile explicitly. Deleting auth.users would also cascade it.
  delete from public.profiles
   where (v_user_id is not null and id = v_user_id)
      or lower(btrim(email)) = v_target_email;

  -- Remove non-FK auth records that can retain the UUID or email.
  if v_user_id is not null then
    delete from auth.refresh_tokens
     where user_id = v_user_id::text;

    delete from auth.flow_state
     where user_id = v_user_id
        or linking_target_id = v_user_id;
  end if;

  delete from auth.saml_relay_states
   where lower(btrim(for_email)) = v_target_email;

  delete from auth.audit_log_entries
   where lower(payload::text) like '%' || v_target_email || '%'
      or (
        v_user_id is not null
        and payload::text like '%' || v_user_id::text || '%'
      );

  -- This cascades through identities, sessions, MFA, OAuth grants, one-time
  -- tokens, and WebAuthn records that reference auth.users.
  delete from auth.users
   where lower(btrim(email)) = v_target_email;

  -- Fail closed if any direct email-bearing row survived.
  if exists (
    select 1 from auth.users
     where lower(btrim(email)) = v_target_email
    union all
    select 1 from public.profiles
     where lower(btrim(email)) = v_target_email
    union all
    select 1 from public.waitlist
     where lower(btrim(email)) = v_target_email
    union all
    select 1 from public.pending_entitlements
     where email_norm = v_target_email
    union all
    select 1 from public.founding_offer_eligibility
     where email_norm = v_target_email
  ) then
    raise exception 'Purge verification failed for %', v_target_email;
  end if;

  raise notice 'Permanent Supabase purge completed for %', v_target_email;
end
$purge$;

commit;
