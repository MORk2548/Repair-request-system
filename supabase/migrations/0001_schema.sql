create type public.app_role as enum ('reporter', 'technician', 'admin');
create type public.ticket_status as enum ('new', 'assigned', 'in_progress', 'done', 'closed', 'cancelled');
create type public.ticket_priority as enum ('low', 'normal', 'urgent');
create type public.equipment_status as enum ('active', 'under_repair', 'retired');
create type public.ticket_event_action as enum ('created', 'status', 'assigned', 'reassigned', 'comment');

create table public.departments (
  id int generated always as identity primary key,
  name text not null,
  is_active boolean not null default true
);

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  department_id int references public.departments,
  display_name text not null,
  role public.app_role not null,
  is_active boolean not null default true,
  expo_push_token text,
  created_at timestamptz not null default now()
);

create table public.categories (
  id int generated always as identity primary key,
  name text not null,
  sort_order int not null default 0,
  is_active boolean not null default true
);

create table public.equipment (
  id int generated always as identity primary key,
  asset_tag text not null unique,
  name text not null,
  serial_no text,
  department_id int references public.departments,
  install_location text,
  status public.equipment_status not null default 'active'
);

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_no text not null unique,
  client_request_id uuid not null unique,
  title text not null check (char_length(btrim(title)) between 3 and 100),
  description text not null check (char_length(btrim(description)) between 1 and 2000),
  category_id int not null references public.categories,
  equipment_id int references public.equipment,
  priority public.ticket_priority not null default 'normal',
  location text not null check (char_length(btrim(location)) between 1 and 100),
  status public.ticket_status not null default 'new',
  reporter_id uuid not null default auth.uid() references public.profiles,
  assignee_id uuid references public.profiles,
  resolution text,
  resolved_at timestamptz,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.tickets (reporter_id);
create index on public.tickets (assignee_id);
create index on public.tickets (status);

create table public.ticket_events (
  id bigint generated always as identity primary key,
  ticket_id uuid not null references public.tickets on delete cascade,
  actor_id uuid references public.profiles,
  action public.ticket_event_action not null,
  from_status public.ticket_status,
  to_status public.ticket_status,
  detail text,
  created_at timestamptz not null default now()
);
create index on public.ticket_events (ticket_id);

create table public.ticket_comments (
  id bigint generated always as identity primary key,
  ticket_id uuid not null references public.tickets on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index on public.ticket_comments (ticket_id);

create table public.ticket_attachments (
  id bigint generated always as identity primary key,
  ticket_id uuid not null references public.tickets on delete cascade,
  uploader_id uuid not null default auth.uid() references public.profiles,
  file_name text not null,
  storage_path text not null unique,
  created_at timestamptz not null default now()
);
create index on public.ticket_attachments (ticket_id);

create table public.ticket_counters (
  ym text primary key,
  last int not null
);

create function public.generate_ticket_no(at timestamptz) returns text
language sql security definer set search_path = '' as $$
  insert into public.ticket_counters as c (ym, last)
  values (pg_catalog.to_char($1 at time zone 'Asia/Bangkok', 'YYMM'), 1)
  on conflict (ym) do update set last = c.last + 1
  returning 'RQ-' || c.ym || '-' || pg_catalog.lpad(c.last::text, greatest(4, pg_catalog.length(c.last::text)), '0');
$$;

create function public.tickets_set_ticket_no() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.ticket_no := public.generate_ticket_no(pg_catalog.now());
  return new;
end $$;

create trigger set_ticket_no before insert on public.tickets
for each row execute function public.tickets_set_ticket_no();

create function public.tickets_set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end $$;

create trigger set_updated_at before update on public.tickets
for each row execute function public.tickets_set_updated_at();

create function public.tickets_log_created() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.ticket_events (ticket_id, actor_id, action, to_status)
  values (new.id, new.reporter_id, 'created', 'new');
  return null;
end $$;

create trigger log_created after insert on public.tickets
for each row execute function public.tickets_log_created();

create function public.enforce_photo_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- the row lock serializes concurrent uploads so two of them cannot both see four photos
  perform 1 from public.tickets where id = new.ticket_id for update;
  if (select pg_catalog.count(*) from public.ticket_attachments where ticket_id = new.ticket_id) >= 5 then
    raise exception using errcode = 'P0001', message = 'photo_limit';
  end if;
  return new;
end $$;

create trigger enforce_photo_limit before insert on public.ticket_attachments
for each row execute function public.enforce_photo_limit();

revoke execute on function
  public.generate_ticket_no(timestamptz),
  public.tickets_set_ticket_no(),
  public.tickets_set_updated_at(),
  public.tickets_log_created(),
  public.enforce_photo_limit()
from public, anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ticket-photos', 'ticket-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']);
