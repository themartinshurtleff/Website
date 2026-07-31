-- Make concurrent founding Checkout requests converge on one Stripe session.
-- Rebinding the same reservation/session pair is safe. A different session
-- remains rejected, and token-only cleanup cannot clear an already-bound row.

create or replace function public.bind_founding_checkout_session(
  p_user uuid,
  p_reservation_token uuid,
  p_session_id text,
  p_session_url text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated int;
begin
  update public.founding_offer_eligibility
     set checkout_session_id = p_session_id,
         checkout_session_url = p_session_url,
         updated_at = now()
   where user_id = p_user
     and state = 'reserved'
     and reservation_token = p_reservation_token
     and reservation_expires_at > now()
     and (
       checkout_session_id is null
       or checkout_session_id = p_session_id
     )
     and (
       checkout_session_url is null
       or checkout_session_url = p_session_url
     );

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

revoke all on function public.bind_founding_checkout_session(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.bind_founding_checkout_session(uuid, uuid, text, text)
  to service_role;

create or replace function public.release_founding_offer_reservation(
  p_user uuid,
  p_reservation_token uuid default null,
  p_session_id text default null,
  p_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated int;
begin
  update public.founding_offer_eligibility
     set state = case
                   when claim_deadline is not null and claim_deadline <= now()
                     then 'expired'
                   else 'invited'
                 end,
         reservation_token = null,
         reservation_plan = null,
         reservation_started_at = null,
         reservation_expires_at = null,
         checkout_session_id = null,
         checkout_session_url = null,
         last_error = left(p_reason, 500),
         updated_at = now()
   where user_id = p_user
     and state = 'reserved'
     and (
       (
         p_session_id is not null
         and checkout_session_id = p_session_id
       )
       or (
         p_session_id is null
         and p_reservation_token is not null
         and reservation_token = p_reservation_token
         and checkout_session_id is null
       )
     );

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

revoke all on function public.release_founding_offer_reservation(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.release_founding_offer_reservation(uuid, uuid, text, text)
  to service_role;
