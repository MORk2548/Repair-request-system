begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

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

insert into public.categories (name) values ('notif-test-category');
-- a trigger logs the ticket's creation event
insert into public.tickets (client_request_id, title, description, category_id, location, reporter_id) values
  ('20000000-0000-0000-0000-000000000009', 'title', 'description',
   (select id from public.categories where name = 'notif-test-category'), 'Building A', '00000000-0000-0000-0000-00000000000a');

insert into public.notifications (id, user_id, event_id) overriding system value
select n.id, n.user_id,
  (select e.id from public.ticket_events e join public.tickets t on t.id = e.ticket_id where t.client_request_id = '20000000-0000-0000-0000-000000000009')
from (values (900001, '00000000-0000-0000-0000-00000000000a'::uuid), (900002, '00000000-0000-0000-0000-00000000000b'), (900003, '00000000-0000-0000-0000-00000000000f')) n(id, user_id);

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select results_eq($$select id from public.notifications$$, $$values (900001::bigint)$$, 'a user sees only their own rows');

select throws_ok(
  $$insert into public.notifications (user_id, event_id) select user_id, event_id from public.notifications where id = 900001$$,
  '42501', null, 'a client cannot insert');

with u as (update public.notifications set read_at = now() where id = 900002 returning 1)
select is((select count(*) from u), 0::bigint, 'updating another user''s read_at changes 0 rows');

with u as (update public.notifications set read_at = now() where id = 900001 returning 1)
select is((select count(*) from u), 1::bigint, 'a user marks their own row read');

select throws_ok($$update public.notifications set user_id = '00000000-0000-0000-0000-00000000000b' where id = 900001$$,
  '42501', null, 'a column other than read_at cannot be changed');

select throws_ok($$delete from public.notifications where id = 900001$$, '42501', null, 'a client cannot delete');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000f');
select is((select count(*) from public.notifications), 0::bigint, 'a deactivated user sees 0 rows');

select * from finish();
rollback;
