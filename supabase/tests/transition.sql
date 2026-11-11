begin;
create extension if not exists pgtap with schema extensions;
select plan(48);

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
  ('00000000-0000-0000-0000-00000000000f', 'inactive-admin@test.local'),
  ('00000000-0000-0000-0000-000000000010', 'inactive-tech@test.local');

insert into public.profiles (id, display_name, role, is_active) values
  ('00000000-0000-0000-0000-00000000000a', 'Reporter A', 'reporter', true),
  ('00000000-0000-0000-0000-00000000000b', 'Reporter B', 'reporter', true),
  ('00000000-0000-0000-0000-00000000000c', 'Tech 1', 'technician', true),
  ('00000000-0000-0000-0000-00000000000d', 'Tech 2', 'technician', true),
  ('00000000-0000-0000-0000-00000000000e', 'Admin', 'admin', true),
  ('00000000-0000-0000-0000-00000000000f', 'Inactive Admin', 'admin', false),
  ('00000000-0000-0000-0000-000000000010', 'Inactive Tech', 'technician', false);

insert into public.categories (name) values ('test-category');
insert into public.equipment (asset_tag, name) values ('TEST-EQ-1', 'Air conditioner');

insert into public.tickets (id, client_request_id, title, description, category_id, equipment_id, location, status, reporter_id, assignee_id)
select v.id, gen_random_uuid(), v.title, 'description', (select id from public.categories where name = 'test-category'),
  case when v.with_equipment then (select id from public.equipment where asset_tag = 'TEST-EQ-1') end,
  'Building A', v.status::public.ticket_status, v.reporter_id, v.assignee_id
from (values
  ('10000000-0000-0000-0000-000000000001'::uuid, 'A full cycle', true, 'new', '00000000-0000-0000-0000-00000000000a'::uuid, null::uuid),
  ('10000000-0000-0000-0000-000000000002', 'A self assign', false, 'new', '00000000-0000-0000-0000-00000000000a', null),
  ('10000000-0000-0000-0000-000000000003', 'A cancel', false, 'new', '00000000-0000-0000-0000-00000000000a', null),
  ('10000000-0000-0000-0000-000000000004', 'B reassign', false, 'in_progress', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000c'),
  ('10000000-0000-0000-0000-000000000005', 'B done', false, 'done', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000c')
) as v(id, title, with_equipment, status, reporter_id, assignee_id);

-- full cycle on ticket 1 with equipment
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e');

select throws_ok($$select * from public.status_transitions$$, '42501', null, 'clients cannot read status_transitions directly');
select throws_ok(
  $$select public.transition_ticket('10000000-0000-0000-0000-000000000001', 'assigned', 1)$$,
  'P0001', 'assignee_required', 'new -> assigned without an assignee');
select throws_ok(
  $$select public.transition_ticket('10000000-0000-0000-0000-000000000001', 'assigned', 1, '00000000-0000-0000-0000-00000000000a')$$,
  'P0001', 'assignee_required', 'new -> assigned to a reporter');
select throws_ok(
  $$select public.transition_ticket('10000000-0000-0000-0000-000000000001', 'assigned', 1, '00000000-0000-0000-0000-000000000010')$$,
  'P0001', 'assignee_required', 'new -> assigned to an inactive technician');
select results_eq(
  $$select status::text, assignee_id, version from public.transition_ticket('10000000-0000-0000-0000-000000000001', 'assigned', 1, '00000000-0000-0000-0000-00000000000c')$$,
  $$values ('assigned', '00000000-0000-0000-0000-00000000000c'::uuid, 2)$$,
  'admin assigns a new ticket to a technician and the version becomes 2');
select throws_ok(
  $$select public.transition_ticket('10000000-0000-0000-0000-000000000001', 'in_progress', 1)$$,
  'P0001', 'version_conflict', 'a stale expected version is rejected');
select throws_ok(
  $$select public.transition_ticket('10000000-0000-0000-0000-000000000001', 'done', 2, null, 'fixed')$$,
  'P0001', 'forbidden_transition', 'assigned -> done is not in the table');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000d');
select throws_ok(
  $$select public.transition_ticket('10000000-0000-0000-0000-000000000001', 'in_progress', 2)$$,
  'P0001', 'forbidden_transition', 'a technician who is not the assignee cannot start the work');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select results_eq(
  $$select status::text, version from public.transition_ticket('10000000-0000-0000-0000-000000000001', 'in_progress', 2)$$,
  $$values ('in_progress', 3)$$,
  'the assignee starts the work');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e');
select results_eq(
  $$select status::text from public.equipment where asset_tag = 'TEST-EQ-1'$$,
  $$values ('under_repair')$$,
  'equipment is under repair while the ticket is in progress');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select throws_ok(
  $$select public.transition_ticket('10000000-0000-0000-0000-000000000001', 'done', 3)$$,
  'P0001', 'resolution_required', 'in_progress -> done without a resolution');
select throws_ok(
  $$select public.transition_ticket('10000000-0000-0000-0000-000000000001', 'done', 3, null, '   ')$$,
  'P0001', 'resolution_required', 'in_progress -> done with a blank resolution');
select results_eq(
  $$select status::text, resolution, resolved_at is not null, version
    from public.transition_ticket('10000000-0000-0000-0000-000000000001', 'done', 3, null, '  fixed the fan  ')$$,
  $$values ('done', 'fixed the fan', true, 4)$$,
  'the assignee finishes with a trimmed resolution and resolved_at');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e');
select results_eq(
  $$select status::text from public.equipment where asset_tag = 'TEST-EQ-1'$$,
  $$values ('active')$$,
  'equipment is active again after done');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select throws_ok(
  $$select public.transition_ticket('10000000-0000-0000-0000-000000000001', 'closed', 4)$$,
  'P0001', 'forbidden_transition', 'a reporter cannot close a ticket of another reporter');
select throws_ok(
  $$select public.transition_ticket('10000000-0000-0000-0000-000000000001', 'closed', 1)$$,
  'P0001', 'forbidden_transition', 'an invisible ticket gives forbidden_transition before the version check');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select results_eq(
  $$select status::text, resolution, resolved_at, version
    from public.transition_ticket('10000000-0000-0000-0000-000000000001', 'in_progress', 4)$$,
  $$values ('in_progress', 'fixed the fan', null::timestamptz, 5)$$,
  'reopen clears resolved_at and keeps the resolution');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000e');
select results_eq(
  $$select action::text, from_status::text, to_status::text, detail, actor_id from public.ticket_events
    where ticket_id = '10000000-0000-0000-0000-000000000001' and action <> 'created' order by id$$,
  $$values
    ('assigned', 'new', 'assigned', null::text, '00000000-0000-0000-0000-00000000000e'::uuid),
    ('status', 'assigned', 'in_progress', null, '00000000-0000-0000-0000-00000000000c'),
    ('status', 'in_progress', 'done', 'fixed the fan', '00000000-0000-0000-0000-00000000000c'),
    ('status', 'done', 'in_progress', 'fixed the fan', '00000000-0000-0000-0000-00000000000a')$$,
  'each successful call writes one event; reopen records the previous resolution');

-- technician self-assign on ticket 2
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select throws_ok(
  $$select public.transition_ticket('10000000-0000-0000-0000-000000000002', 'assigned', 1, '00000000-0000-0000-0000-00000000000c')$$,
  'P0001', 'forbidden_transition', 'a reporter cannot assign');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select throws_ok(
  $$select public.transition_ticket('10000000-0000-0000-0000-000000000002', 'assigned', 1)$$,
  'P0001', 'assignee_required', 'a technician taking a ticket without an assignee');
select throws_ok(
  $$select public.transition_ticket('10000000-0000-0000-0000-000000000002', 'assigned', 1, '00000000-0000-0000-0000-00000000000d')$$,
  'P0001', 'forbidden_transition', 'a technician cannot assign another technician');
select results_eq(
  $$select status::text, assignee_id, version from public.transition_ticket('10000000-0000-0000-0000-000000000002', 'assigned', 1, '00000000-0000-0000-0000-00000000000c')$$,
  $$values ('assigned', '00000000-0000-0000-0000-00000000000c'::uuid, 2)$$,
  'a technician takes a new ticket for themselves');
select results_eq(
  $$select action::text, from_status::text, to_status::text, detail, actor_id from public.ticket_events
    where ticket_id = '10000000-0000-0000-0000-000000000002' and action <> 'created'$$,
  $$values ('assigned', 'new', 'assigned', null::text, '00000000-0000-0000-0000-00000000000c'::uuid)$$,
  'self-assign writes one assigned event');

-- cancel on ticket 3
select pg_temp.act_as('00000000-0000-0000-0000-00000000000f');
select throws_ok(
  $$select public.transition_ticket('10000000-0000-0000-0000-000000000003', 'cancelled', 1)$$,
  'P0001', 'forbidden_transition', 'an inactive admin cannot transition');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select throws_ok(
  $$select public.transition_ticket('10000000-0000-0000-0000-000000000003', 'cancelled', 1)$$,
  'P0001', 'forbidden_transition', 'a reporter cannot cancel a ticket of another reporter');
select throws_ok(
  $$select public.transition_ticket('10000000-0000-0000-0000-0000000000ff', 'cancelled', 1)$$,
  'P0001', 'forbidden_transition', 'a missing ticket gives forbidden_transition');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select results_eq(
  $$select status::text, version from public.transition_ticket('10000000-0000-0000-0000-000000000003', 'cancelled', 1)$$,
  $$values ('cancelled', 2)$$,
  'a reporter cancels their own new ticket');
select results_eq(
  $$select action::text, from_status::text, to_status::text, detail, actor_id from public.ticket_events
    where ticket_id = '10000000-0000-0000-0000-000000000003' and action <> 'created'$$,
  $$values ('status', 'new', 'cancelled', null::text, '00000000-0000-0000-0000-00000000000a'::uuid)$$,
  'cancel writes one status event');

-- reassign on ticket 4 (in progress, tech 1) and ticket 5 (done, tech 1)
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select throws_ok(
  $$select public.reassign_ticket('10000000-0000-0000-0000-000000000004', 1, '00000000-0000-0000-0000-00000000000d', 'busy')$$,
  'P0001', 'forbidden_transition', 'a reporter cannot reassign');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000d');
select throws_ok(
  $$select public.reassign_ticket('10000000-0000-0000-0000-000000000004', 1, '00000000-0000-0000-0000-00000000000d', 'busy')$$,
  'P0001', 'forbidden_transition', 'a technician who is not the assignee cannot reassign');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select throws_ok(
  $$select public.reassign_ticket('10000000-0000-0000-0000-000000000004', 1, '00000000-0000-0000-0000-00000000000d', null)$$,
  'P0001', 'reason_required', 'reassign without a reason');
select throws_ok(
  $$select public.reassign_ticket('10000000-0000-0000-0000-000000000004', 1, '00000000-0000-0000-0000-00000000000d', '  ')$$,
  'P0001', 'reason_required', 'reassign with a blank reason');
select throws_ok(
  $$select public.reassign_ticket('10000000-0000-0000-0000-000000000004', 1, null, 'busy')$$,
  'P0001', 'assignee_required', 'reassign without an assignee');
select throws_ok(
  $$select public.reassign_ticket('10000000-0000-0000-0000-000000000004', 1, '00000000-0000-0000-0000-00000000000c', 'busy')$$,
  'P0001', 'assignee_required', 'reassign to the current assignee');
select throws_ok(
  $$select public.reassign_ticket('10000000-0000-0000-0000-000000000004', 1, '00000000-0000-0000-0000-000000000010', 'busy')$$,
  'P0001', 'assignee_required', 'reassign to an inactive technician');
select throws_ok(
  $$select public.reassign_ticket('10000000-0000-0000-0000-000000000004', 1, '00000000-0000-0000-0000-00000000000b', 'busy')$$,
  'P0001', 'assignee_required', 'reassign to a reporter');
select throws_ok(
  $$select public.reassign_ticket('10000000-0000-0000-0000-000000000004', 7, '00000000-0000-0000-0000-00000000000d', 'busy')$$,
  'P0001', 'version_conflict', 'reassign with a stale version');
select results_eq(
  $$select status::text, assignee_id, version
    from public.reassign_ticket('10000000-0000-0000-0000-000000000004', 1, '00000000-0000-0000-0000-00000000000d', '  out sick  ')$$,
  $$values ('assigned', '00000000-0000-0000-0000-00000000000d'::uuid, 2)$$,
  'the assignee hands the ticket to another technician');
select throws_ok(
  $$select public.reassign_ticket('10000000-0000-0000-0000-000000000005', 1, '00000000-0000-0000-0000-00000000000d', 'busy')$$,
  'P0001', 'forbidden_transition', 'a done ticket cannot be reassigned');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000e');
select results_eq(
  $$select action::text, from_status::text, to_status::text, detail, actor_id from public.ticket_events
    where ticket_id = '10000000-0000-0000-0000-000000000004' and action <> 'created'$$,
  $$values ('reassigned', 'in_progress', 'assigned', 'out sick', '00000000-0000-0000-0000-00000000000c'::uuid)$$,
  'reassign writes one reassigned event with the trimmed reason');
select throws_ok(
  $$select public.reassign_ticket('10000000-0000-0000-0000-000000000005', 1, '00000000-0000-0000-0000-00000000000d', 'busy')$$,
  'P0001', 'forbidden_transition', 'not even an admin reassigns a done ticket');
select results_eq(
  $$select assignee_id, version from public.reassign_ticket('10000000-0000-0000-0000-000000000004', 2, '00000000-0000-0000-0000-00000000000c', 'back')$$,
  $$values ('00000000-0000-0000-0000-00000000000c'::uuid, 3)$$,
  'admin reassigns any ticket');
select results_eq(
  $$select status::text, assignee_id from public.tickets where id = '10000000-0000-0000-0000-000000000005'$$,
  $$values ('done', '00000000-0000-0000-0000-00000000000c'::uuid)$$,
  'rejected calls leave the ticket unchanged');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000f');
select throws_ok(
  $$select public.reassign_ticket('10000000-0000-0000-0000-000000000004', 3, '00000000-0000-0000-0000-00000000000d', 'busy')$$,
  'P0001', 'forbidden_transition', 'an inactive admin cannot reassign');

reset role;
select ok(
  not has_function_privilege('anon', 'public.transition_ticket(uuid, public.ticket_status, int, uuid, text)', 'execute')
  and not has_function_privilege('anon', 'public.reassign_ticket(uuid, int, uuid, text)', 'execute'),
  'anon cannot execute the transition RPCs');
select ok(
  has_function_privilege('authenticated', 'public.transition_ticket(uuid, public.ticket_status, int, uuid, text)', 'execute')
  and has_function_privilege('authenticated', 'public.reassign_ticket(uuid, int, uuid, text)', 'execute'),
  'authenticated can execute the transition RPCs');
select ok(
  not has_table_privilege('anon', 'public.status_transitions', 'select'),
  'anon cannot read status_transitions');
select is((select count(*)::int from public.status_transitions), 13, 'status_transitions holds 13 rows');

select * from finish();
rollback;
