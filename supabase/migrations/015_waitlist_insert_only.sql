-- The website now uses INSERT and treats a duplicate email as success.
-- Remove the temporary upsert compatibility grant from migration 014.

revoke update on public.waitlist from anon, authenticated;
