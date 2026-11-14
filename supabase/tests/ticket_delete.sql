begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'del-admin@test.local'),
  ('00000000-0000-0000-0000-0000000000a2', 'del-tech@test.local'),
  ('00000000-0000-0000-0000-0000000000a3', 'del-rep@test.local');
insert into public.profiles (id, display_name, role, is_active) values
  ('00000000-0000-0000-0000-0000000000a1', 'Admin', 'admin', true),
  ('00000000-0000-0000-0000-0000000000a2', 'Tech', 'technician', true),
  ('00000000-0000-0000-0000-0000000000a3', 'Rep', 'reporter', true);
insert into public.categories (name) values ('del-test-category');
insert into public.equipment (asset_tag, name, status) values ('DEL-EQ-1', 'Air', 'under_repair');

-- t1: in progress on DEL-EQ-1, one photo; t2: closed 40 days ago; t3: closed 10 days ago
insert into public.tickets (id, client_request_id, title, description, category_id, equipment_id, location, status, reporter_id, assignee_id)
select v.id, v.req, 'title', 'description', (select id from public.categories where name = 'del-test-category'),
  case when v.id = '10000000-0000-0000-0000-0000000000d1'::uuid then (select id from public.equipment where asset_tag = 'DEL-EQ-1') end,
  'A', v.status::public.ticket_status, '00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000a2'
from (values
  ('10000000-0000-0000-0000-0000000000d1'::uuid, '20000000-0000-0000-0000-0000000000d1'::uuid, 'in_progress'),
  ('10000000-0000-0000-0000-0000000000d2', '20000000-0000-0000-0000-0000000000d2', 'closed'),
  ('10000000-0000-0000-0000-0000000000d3', '20000000-0000-0000-0000-0000000000d3', 'closed')
) v(id, req, status);

insert into public.ticket_events (ticket_id, actor_id, action, from_status, to_status, created_at) values
  ('10000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000a3', 'status', 'done', 'closed', now() - interval '40 days'),
  ('10000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000a3', 'status', 'done', 'closed', now() - interval '10 days');

insert into public.ticket_attachments (ticket_id, uploader_id, file_name, storage_path) values
  ('10000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a3', 'a.png', '10000000-0000-0000-0000-0000000000d1/a.png'),
  ('10000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000a3', 'b.png', '10000000-0000-0000-0000-0000000000d2/b.png'),
  ('10000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000a3', 'c.png', '10000000-0000-0000-0000-0000000000d3/c.png');

select results_eq(
  $$select storage_path from public.expired_closed_photos(30, 100)$$,
  $$values ('10000000-0000-0000-0000-0000000000d2/b.png')$$,
  'only photos of tickets closed longer than the given days are due');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select throws_ok($$select * from public.expired_closed_photos(30, 100)$$, '42501', null, 'a signed-in user cannot list due photos');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a2');
select throws_ok($$select public.delete_ticket('10000000-0000-0000-0000-0000000000d1')$$, 'P0001', 'forbidden', 'a technician cannot delete a ticket');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a3');
select throws_ok($$select public.delete_ticket('10000000-0000-0000-0000-0000000000d1')$$, 'P0001', 'forbidden', 'the reporter cannot delete a ticket');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select results_eq($$select public.delete_ticket('10000000-0000-0000-0000-0000000000d1')$$,
  $$values (array['10000000-0000-0000-0000-0000000000d1/a.png'])$$, 'an admin deletes a ticket and gets its photo paths back');

select throws_ok($$select public.delete_ticket('10000000-0000-0000-0000-0000000000d1')$$, 'P0001', 'not_found', 'deleting it again says not_found');

reset role;
select is((select count(*) from public.tickets where id = '10000000-0000-0000-0000-0000000000d1'), 0::bigint, 'the ticket is gone');
select is((select count(*) from public.ticket_attachments where ticket_id = '10000000-0000-0000-0000-0000000000d1'), 0::bigint, 'its attachment rows are gone');
select is((select status::text from public.equipment where asset_tag = 'DEL-EQ-1'), 'active', 'equipment under repair only for that ticket is active again');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select throws_ok($$delete from public.tickets where id = '10000000-0000-0000-0000-0000000000d2'$$, '42501', null, 'even an admin cannot delete tickets directly');

select * from finish();
rollback;
