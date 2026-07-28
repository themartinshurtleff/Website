-- Retain actor UUIDs in announcement history without making auth-user removal
-- impossible during compromise recovery or staging cleanup.

alter table public.client_announcements
  drop constraint if exists client_announcements_created_by_fkey;
alter table public.client_announcements
  drop constraint if exists client_announcements_published_by_fkey;
alter table public.client_announcement_audit
  drop constraint if exists client_announcement_audit_actor_id_fkey;
