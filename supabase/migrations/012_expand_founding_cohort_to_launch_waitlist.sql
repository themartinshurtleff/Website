-- Expand the private founding-offer snapshot to every unique waitlist member
-- present when this migration runs. Future waitlist inserts are still not
-- enrolled automatically.

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
         row_number() over (order by e.created_at, e.id)::int
           as cohort_position
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
      'founding cohort snapshot mismatch: configured %, rows %, max position %',
      v_configured_size,
      v_eligibility_count,
      v_max_position;
  end if;
end;
$$;
