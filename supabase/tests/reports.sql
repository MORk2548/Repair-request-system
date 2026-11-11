begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'rep@test.local'),
  ('00000000-0000-0000-0000-0000000000a2', 'tech@test.local'),
  ('00000000-0000-0000-0000-0000000000a3', 'admin@test.local'),
  ('00000000-0000-0000-0000-0000000000a4', 'inactive-admin@test.local');
insert into public.profiles (id, display_name, role, is_active) values
  ('00000000-0000-0000-0000-0000000000a1', 'Reporter', 'reporter', true),
  ('00000000-0000-0000-0000-0000000000a2', 'Tech', 'technician', true),
  ('00000000-0000-0000-0000-0000000000a3', 'Admin', 'admin', true),
  ('00000000-0000-0000-0000-0000000000a4', 'Inactive Admin', 'admin', false);
insert into public.categories (name) values ('rpt-cat-a'), ('rpt-cat-b');

-- 2090 keeps these rows apart from seed and leftover data; tickets sit on the Bangkok day boundaries
insert into public.tickets (client_request_id, title, description, category_id, location, status, reporter_id, assignee_id, created_at, resolved_at)
select gen_random_uuid(), 'rpt ' || v.n, 'd', (select id from public.categories where name = v.cat), 'L',
  v.status::public.ticket_status, '00000000-0000-0000-0000-0000000000a1', v.assignee, v.created_at::timestamptz, v.resolved_at::timestamptz
from (values
  (1, 'rpt-cat-a', 'done',   '00000000-0000-0000-0000-0000000000a2'::uuid, '2090-11-30 17:30:00+00', '2090-11-30 19:30:00+00'),
  (2, 'rpt-cat-a', 'done',   '00000000-0000-0000-0000-0000000000a2', '2090-12-31 16:59:59+00', '2090-12-31 20:59:59+00'),
  (3, 'rpt-cat-b', 'new',    null,                                   '2090-12-15 05:00:00+00', null),
  (4, 'rpt-cat-b', 'new',    null,                                   '2090-11-30 16:59:59+00', null),
  (5, 'rpt-cat-b', 'new',    null,                                   '2091-01-01 17:00:00+00', null)
) as v(n, cat, status, assignee, created_at, resolved_at);
-- 1: 1 Dec 00:30 Bangkok (first day), 2: 31 Dec 23:59:59 (last day), 3: mid month,
-- 4: 30 Nov 23:59:59 (day before), 5: 2 Jan 2091 00:00 (day after)

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a3');

create function pg_temp.summary() returns jsonb language sql as $$
  select public.ticket_summary('2090-12-01', '2090-12-31')
$$;
create function pg_temp.category_count(p_name text) returns bigint language sql as $$
  select (c->>'count')::bigint from jsonb_array_elements(pg_temp.summary()->'by_category') c where c->>'name' = p_name
$$;

select is((pg_temp.summary()->>'total')::int, 3, 'counts the tickets in range, both boundary days included, the days around excluded');
select is(pg_temp.category_count('rpt-cat-a'), 2::bigint, 'a ticket created 2090-11-30T17:30Z counts on 1 Dec Bangkok');
select is(pg_temp.category_count('rpt-cat-b'), 1::bigint, 'only the mid-month category b ticket is in range');
select is((pg_temp.summary()->>'avg_resolve_hours')::numeric, 3.0, 'two done tickets taking 2 and 4 hours average 3');
select is(jsonb_array_length(pg_temp.summary()->'by_status'), 6, 'by_status lists every status');
select is((select jsonb_agg(s->>'status') from jsonb_array_elements(pg_temp.summary()->'by_status') s), '["new","assigned","in_progress","done","closed","cancelled"]'::jsonb, 'by_status follows enum order');
select is((select (s->>'count')::int from jsonb_array_elements(pg_temp.summary()->'by_status') s where s->>'status' = 'closed'), 0, 'a status with no tickets is listed with zero');
select is((select (s->>'count')::int from jsonb_array_elements(pg_temp.summary()->'by_status') s where s->>'status' = 'done'), 2, 'done count');
select is(
  (select jsonb_agg(c->>'name') from jsonb_array_elements(pg_temp.summary()->'by_category') c where c->>'name' like 'rpt-cat-%'),
  '["rpt-cat-a","rpt-cat-b"]'::jsonb, 'categories ordered by count desc');
select is(
  (select jsonb_agg(a) from jsonb_array_elements(pg_temp.summary()->'by_assignee') a where a->>'assignee_id' = '00000000-0000-0000-0000-0000000000a2'),
  '[{"assignee_id":"00000000-0000-0000-0000-0000000000a2","name":"Tech","count":2}]'::jsonb, 'assignee row has id, name and count');
select is(
  (select jsonb_agg(a) from jsonb_array_elements(pg_temp.summary()->'by_assignee') a where a->'assignee_id' = 'null'::jsonb),
  '[{"assignee_id":null,"name":null,"count":1}]'::jsonb, 'unassigned tickets form one row with null id and name');
select is(public.ticket_summary('2090-12-02', '2090-12-03')->'avg_resolve_hours', 'null'::jsonb, 'avg is null when nothing resolved');
select is((public.ticket_summary('2090-12-02', '2090-12-03')->>'total')::int, 0, 'an empty range totals zero');
select is(public.ticket_summary('2090-12-02', '2090-12-03')->'by_assignee', '[]'::jsonb, 'an empty range has no assignee rows');
select throws_ok($$select public.ticket_summary('2090-12-31', '2090-12-01')$$, 'P0001', 'invalid_range', 'from after to');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select throws_ok($$select public.ticket_summary('2090-12-01', '2090-12-31')$$, 'P0001', 'forbidden', 'a reporter is refused');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a2');
select throws_ok($$select public.ticket_summary('2090-12-01', '2090-12-31')$$, 'P0001', 'forbidden', 'a technician is refused');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a4');
select throws_ok($$select public.ticket_summary('2090-12-01', '2090-12-31')$$, 'P0001', 'forbidden', 'an inactive admin is refused');

reset role;
set local role anon;
select throws_ok($$select public.ticket_summary('2090-12-01', '2090-12-31')$$, '42501', null, 'anon cannot execute');

select * from finish();
rollback;
