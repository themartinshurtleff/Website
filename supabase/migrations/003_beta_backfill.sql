-- ============================================================================
-- 003_beta_backfill.sql
-- ONE-TIME operational backfill (agent-tasks-2026-06-15 §1.7).
--
-- Run this ONCE, in the Supabase SQL editor, AFTER 002 is applied and BEFORE
-- any server is flipped to TRADENET_AUTH_REQUIRED=true. It gives every current
-- beta tester full claims so no real tester is locked out on enforce day.
--
-- This is NOT idempotent schema -- it is a data action. It is safe to re-run
-- (it only re-asserts the same tier + re-recalcs), but it is intentionally
-- separate from 002 so it is reviewed and run deliberately.
--
-- HOW TO USE:
--   1. Fill BETA_EMAILS with the tester emails (lowercased is fine; matched
--      case-insensitively). Fill ADMIN_EMAILS with internal/admin accounts.
--   2. Run the whole file.
--   3. Verify with the SELECT at the bottom.
-- ============================================================================

do $$
declare
  -- >>> EDIT THESE TWO LISTS <<<
  beta_emails  text[] := array[
    -- 'tester1@example.com',
    -- 'tester2@example.com'
  ]::text[];
  admin_emails text[] := array[
    -- 'martin@tradenet.org'
  ]::text[];
  r record;
begin
  -- Admins first (admin beats beta in recalc anyway, but set the commercial
  -- field correctly).
  for r in
    select id from public.profiles
    where lower(email) = any (select lower(unnest(admin_emails)))
  loop
    update public.profiles
       set subscription_tier = 'admin',
           access_status     = 'active',
           access_source     = 'backfill_admin'
     where id = r.id;
    perform public.recalc_entitlements(r.id);
  end loop;

  -- Beta testers (comped full access).
  for r in
    select id from public.profiles
    where lower(email) = any (select lower(unnest(beta_emails)))
      and lower(email) <> all (select lower(unnest(admin_emails)))
  loop
    update public.profiles
       set subscription_tier = 'beta',
           access_status     = 'comped',
           access_source     = 'backfill_beta'
     where id = r.id;
    perform public.recalc_entitlements(r.id);
  end loop;

  raise notice 'Backfill complete. Admins: %, Beta: %',
    (select count(*) from public.profiles where access_source = 'backfill_admin'),
    (select count(*) from public.profiles where access_source = 'backfill_beta');
end $$;

-- Verify: every backfilled tester should now carry a full tier + terminal_access.
-- select email, subscription_tier, access_tier, access_status, terminal_access,
--        entitlements_version
--   from public.profiles
--  where access_source in ('backfill_admin','backfill_beta')
--  order by access_tier, email;
