begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

-- the local database may already hold tickets created during development
delete from public.ticket_counters;

select is(public.generate_ticket_no('2026-11-30T17:30:00Z'), 'RQ-2612-0001', 'Bangkok time has already rolled into December');
select is(public.generate_ticket_no('2026-12-15T03:00:00Z'), 'RQ-2612-0002', 'same month continues the sequence');
select is(public.generate_ticket_no('2026-11-30T16:59:00Z'), 'RQ-2611-0001', 'November in Bangkok has its own sequence');

select * from finish();
rollback;
