begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'rep-a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'rep-b@test.local'),
  ('00000000-0000-0000-0000-00000000000c', 'tech-1@test.local'),
  ('00000000-0000-0000-0000-00000000000d', 'tech-2@test.local'),
  ('00000000-0000-0000-0000-00000000000e', 'admin@test.local'),
  ('00000000-0000-0000-0000-00000000000f', 'inactive-admin@test.local');

insert into public.profiles (id, display_name, role, is_active) values
  ('00000000-0000-0000-0000-00000000000a', 'Reporter A', 'reporter', true),
  ('00000000-0000-0000-0000-00000000000b', 'Reporter B', 'reporter', true),
  ('00000000-0000-0000-0000-00000000000c', 'Tech 1', 'technician', true),
  ('00000000-0000-0000-0000-00000000000d', 'Tech 2', 'technician', true),
  ('00000000-0000-0000-0000-00000000000e', 'Admin', 'admin', true),
  ('00000000-0000-0000-0000-00000000000f', 'Inactive Admin', 'admin', false);

insert into public.categories (name, is_active) values ('test-active', true), ('test-inactive', false);

insert into public.tickets (id, client_request_id, title, description, category_id, location, status, reporter_id, assignee_id)
select v.id, gen_random_uuid(), v.title, 'description', (select id from public.categories where name = 'test-active'), 'Building A', v.status::public.ticket_status, v.reporter_id, v.assignee_id
from (values
  ('10000000-0000-0000-0000-000000000001'::uuid, 'A new', 'new', '00000000-0000-0000-0000-00000000000a'::uuid, null::uuid),
  ('10000000-0000-0000-0000-000000000002', 'B new', 'new', '00000000-0000-0000-0000-00000000000b', null),
  ('10000000-0000-0000-0000-000000000003', 'A assigned to tech 1', 'assigned', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000c'),
  ('10000000-0000-0000-0000-000000000004', 'B assigned to tech 2', 'assigned', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000d')
) as v(id, title, status, reporter_id, assignee_id);

insert into public.ticket_comments (ticket_id, author_id, body) values
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000b', 'comment on a new ticket'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-00000000000b', 'comment on a ticket of tech 2');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');

select is_empty($$select * from public.tickets where id = '10000000-0000-0000-0000-000000000002'$$, 'reporter A cannot see a ticket of reporter B');
select set_eq(
  $$select id from public.tickets where id::text like '10000000-%'$$,
  $$values ('10000000-0000-0000-0000-000000000001'::uuid), ('10000000-0000-0000-0000-000000000003')$$,
  'reporter A sees only own tickets');
select is_empty($$select * from public.categories where name = 'test-inactive'$$, 'non-admin does not see an inactive category');
select throws_ok($$insert into public.categories (name) values ('reporter category')$$, '42501', null, 'reporter cannot insert a category');
select is_empty($$select * from public.technician_options$$, 'reporter sees no technician options');

select lives_ok(
  $$insert into public.tickets (client_request_id, title, description, category_id, location)
    values ('20000000-0000-0000-0000-000000000001', 'Air conditioner', 'Not cold', (select id from public.categories where name = 'test-active'), 'Room 2')
    returning ticket_no$$,
  'reporter creates a ticket and reads it back');
select alike((select ticket_no from public.tickets where client_request_id = '20000000-0000-0000-0000-000000000001'), 'RQ-____-____', 'insert assigns a ticket number');
select results_eq(
  $$select e.action::text, e.to_status::text, e.actor_id from public.ticket_events e
    join public.tickets t on t.id = e.ticket_id where t.client_request_id = '20000000-0000-0000-0000-000000000001'$$,
  $$values ('created', 'new', '00000000-0000-0000-0000-00000000000a'::uuid)$$,
  'insert records exactly one created event');
select throws_ok(
  $$insert into public.tickets (client_request_id, title, description, category_id, location)
    values ('20000000-0000-0000-0000-000000000001', 'Duplicate', 'Retry', (select id from public.categories where name = 'test-active'), 'Room 2')$$,
  '23505', null, 'a resubmitted client_request_id is rejected');
select throws_ok(
  $$insert into public.tickets (client_request_id, title, description, category_id, location, reporter_id)
    values (gen_random_uuid(), 'Forged', 'Forged', (select id from public.categories where name = 'test-active'), 'Room 2', '00000000-0000-0000-0000-00000000000b')$$,
  '42501', null, 'reporter cannot file a ticket as another user');
select throws_ok(
  $$insert into public.tickets (client_request_id, title, description, category_id, location, equipment_id)
    values (gen_random_uuid(), 'Ghost equipment', 'Missing', (select id from public.categories where name = 'test-active'), 'Room 2', 2147483647)$$,
  '23503', null, 'a ticket cannot reference missing equipment');

select lives_ok(
  $$insert into public.ticket_attachments (ticket_id, file_name, storage_path)
    select '10000000-0000-0000-0000-000000000001', 'p' || n || '.jpg', '10000000-0000-0000-0000-000000000001/' || n || '.jpg' from generate_series(1, 5) n$$,
  'reporter attaches five photos');
select throws_ok(
  $$insert into public.ticket_attachments (ticket_id, file_name, storage_path)
    values ('10000000-0000-0000-0000-000000000001', 'p6.jpg', '10000000-0000-0000-0000-000000000001/6.jpg')$$,
  'P0001', 'photo_limit', 'a sixth photo is rejected');
select throws_ok(
  $$insert into public.ticket_attachments (ticket_id, file_name, storage_path)
    values ('10000000-0000-0000-0000-000000000003', 'x.jpg', '10000000-0000-0000-0000-000000000002/x.jpg')$$,
  '23514', null, 'an attachment cannot point at another ticket''s folder');
select throws_ok(
  $$insert into public.ticket_comments (ticket_id, body) values ('10000000-0000-0000-0000-000000000002', 'not my ticket')$$,
  '42501', null, 'reporter cannot comment on a ticket they cannot see');

select throws_ok(
  $$update public.tickets set status = 'closed' where id = '10000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'reporter cannot update a ticket directly');

select set_eq(
  $$select id from public.ticket_people$$,
  $$values ('00000000-0000-0000-0000-00000000000a'::uuid), ('00000000-0000-0000-0000-00000000000c')$$,
  'ticket_people shows the reporter and the assignee of own tickets only');

select lives_ok(
  $$insert into storage.objects (bucket_id, name) values ('ticket-photos', '10000000-0000-0000-0000-000000000001/a.jpg')$$,
  'reporter uploads a photo to own ticket');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');

select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('ticket-photos', '10000000-0000-0000-0000-000000000001/b.jpg')$$,
  '42501', null, 'reporter B cannot upload to a ticket of reporter A');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('ticket-photos', 'not-a-uuid/c.jpg')$$,
  '42501', null, 'a path without a ticket id is rejected, not a cast error');
select is_empty(
  $$select * from storage.objects where bucket_id = 'ticket-photos' and name like '10000000-0000-0000-0000-000000000001/%'$$,
  'reporter B cannot see photos of reporter A');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');

select set_eq(
  $$select id from public.tickets where id::text like '10000000-%'$$,
  $$values ('10000000-0000-0000-0000-000000000001'::uuid), ('10000000-0000-0000-0000-000000000002'), ('10000000-0000-0000-0000-000000000003')$$,
  'technician sees every new ticket and the ones assigned to them');
select is_empty($$select * from public.tickets where id = '10000000-0000-0000-0000-000000000004'$$, 'technician cannot see a ticket assigned to another technician');
select isnt_empty($$select * from public.ticket_comments where ticket_id = '10000000-0000-0000-0000-000000000002'$$, 'technician sees comments on a new ticket');
select is_empty($$select * from public.ticket_comments where ticket_id = '10000000-0000-0000-0000-000000000004'$$, 'technician cannot see comments on a ticket of another technician');
select set_eq(
  $$select id from public.technician_options where id in ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000d')$$,
  $$values ('00000000-0000-0000-0000-00000000000c'::uuid), ('00000000-0000-0000-0000-00000000000d')$$,
  'technician sees active technicians as options');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000e');

select set_eq(
  $$select id from public.tickets where id::text like '10000000-%'$$,
  $$values ('10000000-0000-0000-0000-000000000001'::uuid), ('10000000-0000-0000-0000-000000000002'), ('10000000-0000-0000-0000-000000000003'), ('10000000-0000-0000-0000-000000000004')$$,
  'admin sees every ticket');
select results_eq(
  $$select status::text from public.tickets where id = '10000000-0000-0000-0000-000000000001'$$,
  $$values ('new')$$,
  'the direct update by the reporter left the status unchanged');
select isnt_empty($$select * from public.categories where name = 'test-inactive'$$, 'admin sees an inactive category');
select lives_ok($$insert into public.categories (name) values ('admin category')$$, 'admin inserts a category');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000f');

select is_empty($$select * from public.tickets$$, 'inactive admin sees no tickets');
select is_empty($$select * from public.categories$$, 'inactive admin sees no categories');

select * from finish();
rollback;
