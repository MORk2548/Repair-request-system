begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

create function pg_temp.token_of(p_user uuid) returns text language sql security definer as $$
  select expo_push_token from public.profiles where id = p_user
$$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'rep-a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'rep-b@test.local'),
  ('00000000-0000-0000-0000-00000000000f', 'inactive@test.local');

insert into public.profiles (id, display_name, role, is_active) values
  ('00000000-0000-0000-0000-00000000000a', 'Reporter A', 'reporter', true),
  ('00000000-0000-0000-0000-00000000000b', 'Reporter B', 'reporter', true),
  ('00000000-0000-0000-0000-00000000000f', 'Inactive', 'reporter', false);

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select lives_ok($$select public.claim_push_token('ExponentPushToken[shared-phone]')$$, 'A registers the phone');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select lives_ok($$select public.claim_push_token('ExponentPushToken[shared-phone]')$$, 'B signs in on the same phone and registers it');

reset role;
select is(pg_temp.token_of('00000000-0000-0000-0000-00000000000b'), 'ExponentPushToken[shared-phone]', 'B now owns the token');
select is(pg_temp.token_of('00000000-0000-0000-0000-00000000000a'), null, 'A no longer holds it, so A''s notifications stop reaching the phone');

select throws_ok(
  $$update public.profiles set expo_push_token = 'ExponentPushToken[shared-phone]' where id = '00000000-0000-0000-0000-00000000000a'$$,
  '23505', null, 'no two profiles can hold the same token');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000f');
select throws_ok($$select public.claim_push_token('ExponentPushToken[other]')$$, 'P0001', 'forbidden', 'an inactive account cannot claim a token');

reset role;
set local role anon;
select throws_ok($$select public.claim_push_token('ExponentPushToken[x]')$$, '42501', null, 'anon cannot call it');

select * from finish();
rollback;
