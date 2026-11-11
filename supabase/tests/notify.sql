begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

-- net.http_request_queue rows are written in this transaction; pg_net's worker only sends committed ones
create function pg_temp.queued(p_request uuid) returns jsonb[] language sql as $$
  select coalesce(array_agg(pg_catalog.jsonb_build_object(
    'to_status', pg_catalog.convert_from(body, 'UTF8')::jsonb ->> 'to_status',
    'secret', headers ->> 'x-webhook-secret',
    'url', url) order by id), '{}')
  from net.http_request_queue
  where pg_catalog.convert_from(body, 'UTF8')::jsonb ->> 'ticket_id' = (select id::text from public.tickets where client_request_id = p_request)
$$;

create function pg_temp.new_ticket(p_request uuid) returns void language sql as $$
  insert into public.tickets (client_request_id, title, description, category_id, location)
  values (p_request, 'title', 'description', (select id from public.categories where name = 'test-category'), 'Building A')
$$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'rep-a@test.local'),
  ('00000000-0000-0000-0000-00000000000c', 'tech-1@test.local');
insert into public.profiles (id, display_name, role) values
  ('00000000-0000-0000-0000-00000000000a', 'Reporter A', 'reporter'),
  ('00000000-0000-0000-0000-00000000000c', 'Tech 1', 'technician');
insert into public.categories (name) values ('test-category');

delete from vault.secrets where name in ('notify_function_url', 'notify_webhook_secret');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select lives_ok($$ select pg_temp.new_ticket('20000000-0000-0000-0000-000000000001') $$, 'a ticket is created without the Vault secrets');
reset role;
select is(pg_temp.queued('20000000-0000-0000-0000-000000000001'), '{}', 'and nothing is queued');

select vault.create_secret('http://kong:8000/functions/v1/notify-ticket-event', 'notify_function_url');
select vault.create_secret('test-secret', 'notify_webhook_secret');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select pg_temp.new_ticket('20000000-0000-0000-0000-000000000002');
reset role;
select is(
  pg_temp.queued('20000000-0000-0000-0000-000000000002'),
  array['{"to_status": "new", "secret": "test-secret", "url": "http://kong:8000/functions/v1/notify-ticket-event"}'::jsonb],
  'creating a ticket queues one post to the function with the secret header'
);

select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select public.transition_ticket((select id from public.tickets where client_request_id = '20000000-0000-0000-0000-000000000002'), 'assigned', 1, '00000000-0000-0000-0000-00000000000c');
reset role;
select is(
  (select array_agg(q ->> 'to_status') from unnest(pg_temp.queued('20000000-0000-0000-0000-000000000002')) q),
  array['new', 'assigned'],
  'a transition queues one more post'
);

insert into public.ticket_events (ticket_id, actor_id, action)
select id, '00000000-0000-0000-0000-00000000000c'::uuid, 'comment'::public.ticket_event_action from public.tickets where client_request_id = '20000000-0000-0000-0000-000000000002';
select is(array_length(pg_temp.queued('20000000-0000-0000-0000-000000000002'), 1), 2, 'an event without a status queues nothing');

select vault.update_secret(id, 'not a url') from vault.secrets where name = 'notify_function_url';
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select lives_ok($$ select pg_temp.new_ticket('20000000-0000-0000-0000-000000000003') $$, 'a broken URL secret does not fail the ticket insert');
reset role;
select is(pg_temp.queued('20000000-0000-0000-0000-000000000003'), '{}', 'and nothing is queued for it');

select ok(not has_function_privilege('authenticated', 'public.notify_ticket_event()', 'execute'), 'authenticated cannot execute the trigger function');
select ok(not has_function_privilege('anon', 'public.notify_ticket_event()', 'execute'), 'anon cannot execute the trigger function');

select * from finish();
rollback;
