-- Waitlist signup is public, but its contents are operator-only.
-- Supabase table grants are independent from RLS policies, so lock both down.

alter table public.waitlist enable row level security;

revoke all on public.waitlist from public, anon, authenticated;
grant insert (email, source) on public.waitlist to anon, authenticated;
-- Temporary compatibility for the currently deployed upsert statement.
-- No anonymous UPDATE policy exists, so conflict updates remain denied.
grant update (email, source) on public.waitlist to anon, authenticated;
grant select, insert, update, delete on public.waitlist to service_role;

drop policy if exists "Anyone can insert waitlist" on public.waitlist;
create policy "Anyone can insert waitlist"
  on public.waitlist
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Service role can read waitlist" on public.waitlist;
create policy "Service role can read waitlist"
  on public.waitlist
  for select
  to service_role
  using (true);
