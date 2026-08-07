-- Tighten public API privileges after the 2026-08-03 reconnaissance event.
-- RLS already prevented data disclosure. These grants make the intended
-- access model explicit and remove obsolete permissive waitlist policies.

begin;

revoke all on table public.access_events from anon, authenticated;
revoke all on table public.app_config from anon, authenticated;
revoke all on table public.billing_events from anon, authenticated;
revoke all on table public.bitunix_verifications from anon, authenticated;
revoke all on table public.pending_entitlements from anon, authenticated;
revoke all on table public.revocations from anon, authenticated;

grant all on table public.access_events to service_role;
grant all on table public.app_config to service_role;
grant all on table public.billing_events to service_role;
grant all on table public.bitunix_verifications to service_role;
grant all on table public.pending_entitlements to service_role;
grant all on table public.revocations to service_role;

revoke all on table public.profiles from anon;
revoke insert, delete, truncate, references, trigger
  on table public.profiles from authenticated;
grant select, update on table public.profiles to authenticated;
grant all on table public.profiles to service_role;

revoke all on table public.waitlist from public, anon, authenticated;
revoke all (id, email, source, created_at)
  on table public.waitlist from public, anon, authenticated;
grant insert (email, source) on table public.waitlist to anon, authenticated;
grant select, insert, update, delete on table public.waitlist to service_role;

drop policy if exists "Anon can select waitlist" on public.waitlist;
drop policy if exists "Anon can update waitlist" on public.waitlist;
drop policy if exists "Anon can insert waitlist" on public.waitlist;
drop policy if exists "Anyone can insert waitlist" on public.waitlist;
drop policy if exists "Service role can read waitlist" on public.waitlist;

create policy "Anyone can insert waitlist"
  on public.waitlist
  for insert
  to anon, authenticated
  with check (true);

create policy "Service role can read waitlist"
  on public.waitlist
  for select
  to service_role
  using (true);

revoke execute on function public.handle_new_user()
  from public, anon, authenticated;
revoke execute on function public.guard_profile_security_columns()
  from public, anon, authenticated;
revoke execute on function public.update_updated_at()
  from public, anon, authenticated;

commit;
