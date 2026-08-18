-- Secure account self-service support.
--
-- Email changes are finalized by Supabase Auth, then mirrored into the public
-- profile. Account deletion is service-role only and remains atomic inside the
-- database. Billing-linked and administrative accounts require manual review.

begin;

create or replace function public.sync_profile_email_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.email is distinct from old.email then
    -- Keep an account-bound founding offer attached to the same identity. The
    -- unique email constraint intentionally rejects attempts to move onto an
    -- address that already owns a different founding offer.
    update public.founding_offer_eligibility
       set email_norm = lower(btrim(new.email)),
           user_id = new.id,
           updated_at = now()
     where user_id = new.id
        or (
          user_id is null
          and email_norm = lower(btrim(old.email))
        );

    update public.profiles
       set email = new.email,
           updated_at = now()
     where id = new.id;
  end if;
  return new;
end;
$$;

revoke execute on function public.sync_profile_email_from_auth()
  from public, anon, authenticated;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (new.email is distinct from old.email)
  execute function public.sync_profile_email_from_auth();

comment on column public.founding_offer_eligibility.email_norm is
  'Normalized account email for private founding-offer resolution. The waitlist link preserves cohort provenance.';

create or replace function public.delete_self_service_account(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_email_norm text;
  v_access_tier text;
  v_billing_provider text;
  v_billing_customer_id text;
  v_stripe_customer_id text;
  v_stripe_subscription_id text;
  v_founding_state text;
  v_founding_customer_id text;
  v_founding_subscription_id text;
  v_founding_schedule_id text;
  v_founding_checkout_id text;
  v_founding_waitlist_id uuid;
  v_has_commissions boolean := false;
  v_has_pending_billing boolean := false;
  v_deleted integer := 0;
begin
  if p_user is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_user');
  end if;

  select lower(btrim(email))
    into v_email_norm
    from auth.users
   where id = p_user
   for update;

  if v_email_norm is null then
    return jsonb_build_object('ok', false, 'error', 'account_not_found');
  end if;

  select access_tier,
         billing_provider,
         billing_customer_id,
         stripe_customer_id,
         stripe_subscription_id
    into v_access_tier,
         v_billing_provider,
         v_billing_customer_id,
         v_stripe_customer_id,
         v_stripe_subscription_id
    from public.profiles
   where id = p_user;

  if v_access_tier = 'admin' then
    return jsonb_build_object('ok', false, 'error', 'admin_account_protected');
  end if;

  select state,
         stripe_customer_id,
         stripe_subscription_id,
         stripe_schedule_id,
         checkout_session_id,
         waitlist_id
    into v_founding_state,
         v_founding_customer_id,
         v_founding_subscription_id,
         v_founding_schedule_id,
         v_founding_checkout_id,
         v_founding_waitlist_id
    from public.founding_offer_eligibility
   where user_id = p_user
      or email_norm = v_email_norm
   order by (user_id = p_user) desc
   limit 1;

  select exists (
    select 1
      from public.affiliate_commissions
     where user_id = p_user
  ) into v_has_commissions;

  select exists (
    select 1
      from public.pending_entitlements
     where email_norm = v_email_norm
       and (
         billing_provider is not null
         or subscription_tier is not null
         or billing_status is not null
       )
  ) into v_has_pending_billing;

  if v_billing_provider is not null
     or v_billing_customer_id is not null
     or v_stripe_customer_id is not null
     or v_stripe_subscription_id is not null
     or v_founding_customer_id is not null
     or v_founding_subscription_id is not null
     or v_founding_schedule_id is not null
     or v_founding_checkout_id is not null
     or v_founding_state in ('reserved', 'redeemed')
     or v_has_commissions
     or v_has_pending_billing then
    return jsonb_build_object('ok', false, 'error', 'billing_review_required');
  end if;

  delete from public.affiliate_attributions where user_id = p_user;
  delete from public.access_events where user_id = p_user;
  delete from public.bitunix_verifications where user_id = p_user;
  delete from public.revocations where sub = p_user;
  delete from public.pending_entitlements where email_norm = v_email_norm;

  delete from public.founding_offer_eligibility
   where user_id = p_user
      or email_norm = v_email_norm;

  update public.founding_offer_config
     set cohort_size = (
           select count(*)::integer
             from public.founding_offer_eligibility
         ),
         updated_at = now()
   where id = 1;

  delete from public.waitlist
   where id = v_founding_waitlist_id
      or lower(btrim(email)) = v_email_norm;

  delete from public.profiles where id = p_user;
  delete from auth.users where id = p_user;
  get diagnostics v_deleted = row_count;

  if v_deleted <> 1 then
    raise exception using errcode = 'P0001', message = 'account_delete_failed';
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.delete_self_service_account(uuid)
  from public, anon, authenticated;
grant execute on function public.delete_self_service_account(uuid)
  to service_role;

comment on function public.delete_self_service_account(uuid) is
  'Service-role-only atomic deletion for non-admin accounts without retained billing obligations.';

commit;
