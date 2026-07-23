-- Server-only, case-insensitive waitlist lookup for launch checkout pricing.
-- The authenticated browser never receives waitlist rows or submits an email
-- to qualify. stripe-checkout calls this with the verified auth.users email.

create or replace function public.is_waitlist_member(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.waitlist
     where lower(trim(email)) = lower(trim(p_email))
  );
$$;

revoke all on function public.is_waitlist_member(text) from public, anon, authenticated;
grant execute on function public.is_waitlist_member(text) to service_role;
