begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

create function pg_temp.photo_exists(p_name text) returns boolean language sql security definer as $$
  select exists (select 1 from storage.objects where bucket_id = 'ticket-photos' and name = p_name)
$$;

-- storage blocks direct deletes unless this is set; the Storage API sets it the same way
select set_config('storage.allow_delete_query', 'true', true);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'rep-a@test.local'),
  ('00000000-0000-0000-0000-00000000000e', 'admin@test.local');

insert into public.profiles (id, display_name, role) values
  ('00000000-0000-0000-0000-00000000000a', 'Reporter A', 'reporter'),
  ('00000000-0000-0000-0000-00000000000e', 'Admin', 'admin');

insert into public.categories (name) values ('test-category');

insert into public.tickets (id, client_request_id, title, description, category_id, location, reporter_id)
values ('10000000-0000-0000-0000-000000000001', gen_random_uuid(), 'A new', 'description',
  (select id from public.categories where name = 'test-category'), 'Building A', '00000000-0000-0000-0000-00000000000a');

insert into storage.objects (bucket_id, name, owner_id) values
  ('ticket-photos', '10000000-0000-0000-0000-000000000001/orphan.jpg', '00000000-0000-0000-0000-00000000000a'),
  ('ticket-photos', '10000000-0000-0000-0000-000000000001/attached.jpg', '00000000-0000-0000-0000-00000000000a');

insert into public.ticket_attachments (ticket_id, uploader_id, file_name, storage_path)
values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'attached.jpg',
  '10000000-0000-0000-0000-000000000001/attached.jpg');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000e');
delete from storage.objects where name = '10000000-0000-0000-0000-000000000001/orphan.jpg';
select ok(pg_temp.photo_exists('10000000-0000-0000-0000-000000000001/orphan.jpg'), 'admin cannot delete a photo someone else uploaded');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
delete from storage.objects where name = '10000000-0000-0000-0000-000000000001/attached.jpg';
select ok(pg_temp.photo_exists('10000000-0000-0000-0000-000000000001/attached.jpg'), 'uploader cannot delete an attached photo');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
delete from storage.objects where name = '10000000-0000-0000-0000-000000000001/orphan.jpg';
select ok(not pg_temp.photo_exists('10000000-0000-0000-0000-000000000001/orphan.jpg'), 'uploader deletes an unattached photo');

reset role;
set local role anon;
select throws_ok($$ select public.is_attached_photo('x') $$, '42501', null, 'anon cannot call is_attached_photo');

select * from finish();
rollback;
