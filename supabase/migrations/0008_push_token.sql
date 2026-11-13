-- A push token identifies a phone, not a person. If the previous user's sign-out could not clear it (offline),
-- the next user on that phone must take it over, or the previous user's notifications keep reaching them.
update public.profiles p set expo_push_token = null
where p.expo_push_token is not null
  and exists (select 1 from public.profiles q where q.expo_push_token = p.expo_push_token and q.id <> p.id);

create unique index profiles_expo_push_token_key on public.profiles (expo_push_token);

create function public.claim_push_token(p_token text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if public.current_app_role() is null then
    raise exception using errcode = 'P0001', message = 'forbidden';
  end if;
  update public.profiles set expo_push_token = null where expo_push_token = p_token and id <> auth.uid();
  update public.profiles set expo_push_token = p_token where id = auth.uid();
end $$;

revoke execute on function public.claim_push_token(text) from public, anon;
grant execute on function public.claim_push_token(text) to authenticated;
