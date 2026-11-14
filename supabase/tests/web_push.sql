begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'rep-a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'rep-b@test.local'),
  ('00000000-0000-0000-0000-00000000000f', 'inactive@test.local');

insert into public.profiles (id, display_name, role, is_active) values
  ('00000000-0000-0000-0000-00000000000a', 'Reporter A', 'reporter', true),
  ('00000000-0000-0000-0000-00000000000b', 'Reporter B', 'reporter', true),
  ('00000000-0000-0000-0000-00000000000f', 'Inactive', 'reporter', false);

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select public.save_web_push_subscription('https://push.test/shared', 'p-a', 'auth-a');
select public.save_web_push_subscription('https://push.test/only-a', 'p-a2', 'auth-a2');
select results_eq($$select endpoint from public.web_push_subscriptions order by endpoint$$,
  $$values ('https://push.test/only-a'), ('https://push.test/shared')$$, 'a user saves a subscription per browser');

select throws_ok(
  $$insert into public.web_push_subscriptions (user_id, endpoint, p256dh, auth) values ('00000000-0000-0000-0000-00000000000a', 'https://push.test/x', 'p', 'a')$$,
  '42501', null, 'a client cannot insert directly');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select public.save_web_push_subscription('https://push.test/shared', 'p-b', 'auth-b');
select results_eq($$select endpoint, p256dh from public.web_push_subscriptions$$,
  $$values ('https://push.test/shared', 'p-b')$$, 'the next user on a browser takes its endpoint over with new keys');

with d as (delete from public.web_push_subscriptions where endpoint = 'https://push.test/only-a' returning 1)
select is((select count(*) from d), 0::bigint, 'deleting another user''s subscription changes 0 rows');

select throws_ok($$update public.web_push_subscriptions set p256dh = 'x'$$, '42501', null, 'a client cannot update directly');

with d as (delete from public.web_push_subscriptions where endpoint = 'https://push.test/shared' returning 1)
select is((select count(*) from d), 1::bigint, 'a user deletes their own subscription');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select results_eq($$select endpoint from public.web_push_subscriptions$$,
  $$values ('https://push.test/only-a')$$, 'the previous user lost the taken-over endpoint');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000f');
select throws_ok($$select public.save_web_push_subscription('https://push.test/f', 'p', 'a')$$, 'P0001', 'forbidden', 'a deactivated user cannot subscribe');

select * from finish();
rollback;
