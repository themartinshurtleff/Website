-- Persist the optional signup marketing consent selected by the user.
-- Authentication and other essential service emails do not depend on this flag.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pend public.pending_entitlements%rowtype;
  opted_into_marketing boolean := false;
begin
  opted_into_marketing := lower(
    coalesce(new.raw_user_meta_data ->> 'marketing_opt_in', 'false')
  ) = 'true';

  insert into public.profiles (id, email, marketing_opt_in)
  values (new.id, new.email, opted_into_marketing);

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
