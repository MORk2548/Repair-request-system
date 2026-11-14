-- One row per (ticket event, user who should hear about it). The Edge Function inserts them with the service
-- role after core's recipientsFor picks the people; the status, ticket and time are joined from ticket_events at read time.
create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_id bigint not null references public.ticket_events (id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create index notifications_user_created_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

revoke all on public.notifications from public, anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create policy notifications_select on public.notifications for select to authenticated
  using (user_id = auth.uid() and public.current_app_role() is not null);
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid() and public.current_app_role() is not null)
  with check (user_id = auth.uid() and public.current_app_role() is not null);

alter publication supabase_realtime add table public.notifications;
