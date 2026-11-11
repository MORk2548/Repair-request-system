begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

create function pg_temp.equipment_status(p_tag text) returns text language sql as $$
  select status::text from public.equipment where asset_tag = p_tag
$$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'rep-a@test.local'),
  ('00000000-0000-0000-0000-00000000000c', 'tech-1@test.local'),
  ('00000000-0000-0000-0000-00000000000d', 'tech-2@test.local'),
  ('00000000-0000-0000-0000-00000000000e', 'admin@test.local');

insert into public.profiles (id, display_name, role) values
  ('00000000-0000-0000-0000-00000000000a', 'Reporter A', 'reporter'),
  ('00000000-0000-0000-0000-00000000000c', 'Tech 1', 'technician'),
  ('00000000-0000-0000-0000-00000000000d', 'Tech 2', 'technician'),
  ('00000000-0000-0000-0000-00000000000e', 'Admin', 'admin');

insert into public.categories (name) values ('test-category');
insert into public.equipment (asset_tag, name, status) values
  ('TEST-EQ-REASSIGN', 'Reassigned', 'active'),
  ('TEST-EQ-SHARED', 'Shared', 'active'),
  ('TEST-EQ-RETIRED', 'Retired', 'retired');

insert into public.tickets (id, client_request_id, title, description, category_id, equipment_id, location, status, reporter_id, assignee_id)
select v.id, gen_random_uuid(), 'title', 'description', (select id from public.categories where name = 'test-category'),
  (select id from public.equipment where asset_tag = v.tag), 'Building A', 'assigned', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000c'
from (values
  ('10000000-0000-0000-0000-000000000001'::uuid, 'TEST-EQ-REASSIGN'),
  ('10000000-0000-0000-0000-000000000002', 'TEST-EQ-SHARED'),
  ('10000000-0000-0000-0000-000000000003', 'TEST-EQ-SHARED'),
  ('10000000-0000-0000-0000-000000000004', 'TEST-EQ-RETIRED')
) as v(id, tag);

select pg_temp.act_as('00000000-0000-0000-0000-00000000000e');

select public.transition_ticket('10000000-0000-0000-0000-000000000001', 'in_progress', 1);
select is(pg_temp.equipment_status('TEST-EQ-REASSIGN'), 'under_repair', 'starting work puts the equipment under repair');
select public.reassign_ticket('10000000-0000-0000-0000-000000000001', 2, '00000000-0000-0000-0000-00000000000d', 'busy');
select is(pg_temp.equipment_status('TEST-EQ-REASSIGN'), 'active', 'reassigning an in-progress ticket returns the equipment to active');
select public.transition_ticket('10000000-0000-0000-0000-000000000001', 'cancelled', 3);
select is(pg_temp.equipment_status('TEST-EQ-REASSIGN'), 'active', 'cancelling after the reassign leaves the equipment active');

select public.transition_ticket('10000000-0000-0000-0000-000000000002', 'in_progress', 1);
select public.transition_ticket('10000000-0000-0000-0000-000000000003', 'in_progress', 1);
select public.transition_ticket('10000000-0000-0000-0000-000000000002', 'done', 2, null, 'fixed');
select is(pg_temp.equipment_status('TEST-EQ-SHARED'), 'under_repair', 'finishing one of two in-progress tickets keeps the equipment under repair');
select public.transition_ticket('10000000-0000-0000-0000-000000000003', 'done', 2, null, 'fixed');
select is(pg_temp.equipment_status('TEST-EQ-SHARED'), 'active', 'finishing the last in-progress ticket makes the equipment active');

select public.transition_ticket('10000000-0000-0000-0000-000000000004', 'in_progress', 1);
select public.transition_ticket('10000000-0000-0000-0000-000000000004', 'done', 2, null, 'fixed');
select is(pg_temp.equipment_status('TEST-EQ-RETIRED'), 'retired', 'retired equipment stays retired through a repair');

reset role;
select ok(
  not has_function_privilege('authenticated', 'public.sync_equipment_status(int)', 'execute')
  and not has_function_privilege('anon', 'public.sync_equipment_status(int)', 'execute'),
  'clients cannot call sync_equipment_status');

select * from finish();
rollback;
