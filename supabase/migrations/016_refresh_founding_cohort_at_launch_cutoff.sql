-- Freeze the founding cohort at the final launch cutoff.
--
-- Run this migration immediately before opening the first invitation wave.
-- It includes every unique normalized waitlist email present at execution
-- time. Later waitlist inserts are intentionally not enrolled automatically.

begin;

lock table public.waitlist in share mode;
lock table public.founding_offer_config in row exclusive mode;
lock table public.founding_offer_eligibility in share row exclusive mode;

with earliest_per_email as (
  select distinct on (lower(btrim(w.email)))
         w.id,
         lower(btrim(w.email)) as email_norm,
         w.created_at
    from public.waitlist w
   where w.email is not null
     and btrim(w.email) <> ''
   order by lower(btrim(w.email)), w.created_at, w.id
),
cohort_total as (
  select count(*)::int as cohort_size
    from earliest_per_email
)
update public.founding_offer_config c
   set cohort_size = t.cohort_size,
       updated_at = now()
  from cohort_total t
 where c.id = 1;

-- Free the final ranking range before the upsert. Existing rows can move when
-- older waitlist entries are added or corrected, and the unique position
-- constraint is immediate rather than deferred. This temporary offset is
-- rolled back with the transaction if any later assertion fails.
update public.founding_offer_eligibility
   set cohort_position = cohort_position + 1000000,
       updated_at = now();

with earliest_per_email as (
  select distinct on (lower(btrim(w.email)))
         w.id,
         lower(btrim(w.email)) as email_norm,
         w.created_at
    from public.waitlist w
   where w.email is not null
     and btrim(w.email) <> ''
   order by lower(btrim(w.email)), w.created_at, w.id
),
ranked_cohort as (
  select e.*,
         row_number() over (order by e.created_at, e.id)::int as cohort_position
    from earliest_per_email e
)
insert into public.founding_offer_eligibility (
  email_norm,
  waitlist_id,
  waitlist_created_at,
  cohort_position
)
select email_norm,
       id,
       created_at,
       cohort_position
  from ranked_cohort
on conflict (email_norm) do update
set waitlist_id = excluded.waitlist_id,
    waitlist_created_at = excluded.waitlist_created_at,
    cohort_position = excluded.cohort_position,
    updated_at = now();

do $$
declare
  v_configured_size int;
  v_eligibility_count int;
  v_max_position int;
begin
  select cohort_size
    into v_configured_size
    from public.founding_offer_config
   where id = 1;

  select count(*), max(cohort_position)
    into v_eligibility_count, v_max_position
    from public.founding_offer_eligibility;

  if v_eligibility_count <> v_configured_size
     or v_max_position <> v_configured_size then
    raise exception
      'founding cohort cutoff mismatch: configured %, rows %, max position %',
      v_configured_size,
      v_eligibility_count,
      v_max_position;
  end if;
end;
$$;

commit;
