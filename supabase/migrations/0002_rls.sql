create function public.current_app_role() returns public.app_role
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid() and is_active
$$;

-- takes row values because the tickets select policy must judge a row inside INSERT ... RETURNING, before it is visible by id
create function public.can_see_ticket_row(p_reporter_id uuid, p_assignee_id uuid, p_status public.ticket_status) returns boolean
language sql stable set search_path = '' as $$
  select coalesce(case public.current_app_role()
    when 'admin' then true
    when 'technician' then p_reporter_id = auth.uid() or p_assignee_id = auth.uid() or p_status = 'new'
    when 'reporter' then p_reporter_id = auth.uid()
  end, false)
$$;

create function public.can_see_ticket(p_ticket_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select public.can_see_ticket_row(t.reporter_id, t.assignee_id, t.status)
    from public.tickets t
    where t.id = p_ticket_id
  ), false)
$$;

revoke execute on function
  public.current_app_role(),
  public.can_see_ticket_row(uuid, uuid, public.ticket_status),
  public.can_see_ticket(uuid)
from public, anon;
grant execute on function
  public.current_app_role(),
  public.can_see_ticket_row(uuid, uuid, public.ticket_status),
  public.can_see_ticket(uuid)
to authenticated;

alter table public.departments enable row level security;
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.equipment enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_events enable row level security;
alter table public.ticket_comments enable row level security;
alter table public.ticket_attachments enable row level security;
alter table public.ticket_counters enable row level security;

revoke all on all tables in schema public from anon, authenticated;

grant select, insert, update on public.departments, public.categories, public.equipment to authenticated;

create policy departments_select on public.departments for select to authenticated
  using (public.current_app_role() = 'admin' or (public.current_app_role() is not null and is_active));
create policy departments_insert on public.departments for insert to authenticated
  with check (public.current_app_role() = 'admin');
create policy departments_update on public.departments for update to authenticated
  using (public.current_app_role() = 'admin') with check (public.current_app_role() = 'admin');

create policy categories_select on public.categories for select to authenticated
  using (public.current_app_role() = 'admin' or (public.current_app_role() is not null and is_active));
create policy categories_insert on public.categories for insert to authenticated
  with check (public.current_app_role() = 'admin');
create policy categories_update on public.categories for update to authenticated
  using (public.current_app_role() = 'admin') with check (public.current_app_role() = 'admin');

create policy equipment_select on public.equipment for select to authenticated
  using (public.current_app_role() = 'admin' or (public.current_app_role() is not null and status <> 'retired'));
create policy equipment_insert on public.equipment for insert to authenticated
  with check (public.current_app_role() = 'admin');
create policy equipment_update on public.equipment for update to authenticated
  using (public.current_app_role() = 'admin') with check (public.current_app_role() = 'admin');

grant select, update (expo_push_token) on public.profiles to authenticated;

create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.current_app_role() = 'admin');
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

grant select, insert (client_request_id, title, description, category_id, equipment_id, priority, location)
  on public.tickets to authenticated;

create policy tickets_select on public.tickets for select to authenticated
  using (public.can_see_ticket_row(reporter_id, assignee_id, status));
create policy tickets_insert on public.tickets for insert to authenticated
  with check (public.current_app_role() is not null and reporter_id = auth.uid());

grant select on public.ticket_events to authenticated;

create policy ticket_events_select on public.ticket_events for select to authenticated
  using (public.can_see_ticket(ticket_id));

grant select, insert (ticket_id, body) on public.ticket_comments to authenticated;

create policy ticket_comments_select on public.ticket_comments for select to authenticated
  using (public.can_see_ticket(ticket_id));
create policy ticket_comments_insert on public.ticket_comments for insert to authenticated
  with check (author_id = auth.uid() and public.can_see_ticket(ticket_id));

grant select, insert (ticket_id, file_name, storage_path) on public.ticket_attachments to authenticated;

create policy ticket_attachments_select on public.ticket_attachments for select to authenticated
  using (public.can_see_ticket(ticket_id));
create policy ticket_attachments_insert on public.ticket_attachments for insert to authenticated
  with check (uploader_id = auth.uid() and public.can_see_ticket(ticket_id));

create policy ticket_photos_select on storage.objects for select to authenticated
  using (
    bucket_id = 'ticket-photos'
    and case when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.can_see_ticket(split_part(name, '/', 1)::uuid) else false end
  );
create policy ticket_photos_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'ticket-photos'
    and case when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.can_see_ticket(split_part(name, '/', 1)::uuid) else false end
  );

-- owned by postgres without security_invoker on purpose: they expose names the caller may not read from profiles
create view public.technician_options as
  select id, display_name
  from public.profiles
  where role = 'technician' and is_active and public.current_app_role() in ('technician', 'admin');

create view public.ticket_people as
  select p.id, p.display_name
  from public.profiles p
  where p.id in (
    select t.reporter_id from public.tickets t where public.can_see_ticket(t.id)
    union select t.assignee_id from public.tickets t where public.can_see_ticket(t.id)
    union select e.actor_id from public.ticket_events e where public.can_see_ticket(e.ticket_id)
    union select c.author_id from public.ticket_comments c where public.can_see_ticket(c.ticket_id)
  );

revoke all on public.technician_options, public.ticket_people from anon, authenticated;
grant select on public.technician_options, public.ticket_people to authenticated;
