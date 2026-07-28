-- Keep new founding member numbers above any numbers assigned manually before
-- the private founding-offer rollout. A fresh, unused sequence is left alone
-- so the first new member still receives number 1.

do $$
declare
  v_existing_max int;
  v_last_value bigint;
  v_is_called boolean;
  v_floor bigint;
begin
  select max(founding_member_number)
    into v_existing_max
    from public.profiles;

  if v_existing_max is null then
    return;
  end if;

  select last_value, is_called
    into v_last_value, v_is_called
    from public.founding_member_seq;

  v_floor := greatest(
    v_existing_max::bigint,
    case when v_is_called then v_last_value else 0 end
  );

  perform setval('public.founding_member_seq', v_floor, true);
end;
$$;
