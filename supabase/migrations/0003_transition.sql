create table public.status_transitions (
  from_status public.ticket_status not null,
  to_status public.ticket_status not null,
  role public.app_role not null,
  primary key (from_status, to_status, role)
);

-- must equal TRANSITIONS in packages/core/src/status.ts; packages/core/test/parity.db.test.ts checks it
insert into public.status_transitions (from_status, to_status, role) values
  ('new', 'assigned', 'admin'),
  ('new', 'assigned', 'technician'),
  ('new', 'cancelled', 'reporter'),
  ('new', 'cancelled', 'admin'),
  ('assigned', 'in_progress', 'technician'),
  ('assigned', 'in_progress', 'admin'),
  ('assigned', 'cancelled', 'admin'),
  ('in_progress', 'done', 'technician'),
  ('in_progress', 'done', 'admin'),
  ('done', 'closed', 'reporter'),
  ('done', 'closed', 'admin'),
  ('done', 'in_progress', 'reporter'),
  ('done', 'in_progress', 'admin');

alter table public.status_transitions enable row level security;
revoke all on public.status_transitions from anon, authenticated;

create function public.is_active_technician(p_user uuid) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from public.profiles where id = p_user and role = 'technician' and is_active)
$$;

create function public.transition_ticket(
  p_ticket_id uuid,
  p_to public.ticket_status,
  p_expected_version int,
  p_assignee uuid default null,
  p_resolution text default null
) returns public.tickets
language plpgsql security definer set search_path = '' as $$
declare
  v_role public.app_role := public.current_app_role();
  v_ticket public.tickets;
  v_from public.ticket_status;
begin
  select * into v_ticket from public.tickets where id = p_ticket_id for update;
  -- one error for missing, invisible and forbidden so a caller cannot probe which tickets exist
  if v_ticket.id is null or v_role is null
    or not public.can_see_ticket_row(v_ticket.reporter_id, v_ticket.assignee_id, v_ticket.status) then
    raise exception using errcode = 'P0001', message = 'forbidden_transition';
  end if;
  if v_ticket.version <> p_expected_version then
    raise exception using errcode = 'P0001', message = 'version_conflict';
  end if;
  v_from := v_ticket.status;
  if not exists (
    select 1 from public.status_transitions
    where from_status = v_from and to_status = p_to and role = v_role
  ) then
    raise exception using errcode = 'P0001', message = 'forbidden_transition';
  end if;

  if v_from = 'new' and p_to = 'assigned' and not public.is_active_technician(p_assignee) then
    raise exception using errcode = 'P0001', message = 'assignee_required';
  end if;
  if (v_role = 'reporter' and v_ticket.reporter_id <> auth.uid())
    or (v_role = 'technician' and v_from = 'new' and p_assignee <> auth.uid())
    or (v_role = 'technician' and v_from <> 'new' and v_ticket.assignee_id is distinct from auth.uid()) then
    raise exception using errcode = 'P0001', message = 'forbidden_transition';
  end if;
  if p_to = 'done' and coalesce(pg_catalog.btrim(p_resolution), '') = '' then
    raise exception using errcode = 'P0001', message = 'resolution_required';
  end if;

  update public.tickets set
    status = p_to,
    version = version + 1,
    assignee_id = case when v_from = 'new' and p_to = 'assigned' then p_assignee else assignee_id end,
    resolution = case when p_to = 'done' then pg_catalog.btrim(p_resolution) else resolution end,
    resolved_at = case when p_to = 'done' then pg_catalog.now() when v_from = 'done' then null else resolved_at end
  where id = p_ticket_id
  returning * into v_ticket;

  if v_ticket.equipment_id is not null and p_to in ('in_progress', 'done') then
    update public.equipment
    set status = case when p_to = 'in_progress' then 'under_repair' else 'active' end::public.equipment_status
    where id = v_ticket.equipment_id;
  end if;

  insert into public.ticket_events (ticket_id, actor_id, action, from_status, to_status, detail)
  values (
    p_ticket_id, auth.uid(),
    case when v_from = 'new' and p_to = 'assigned' then 'assigned' else 'status' end::public.ticket_event_action,
    v_from, p_to,
    case when p_to = 'done' or v_from = 'done' then v_ticket.resolution end
  );
  return v_ticket;
end $$;

create function public.reassign_ticket(
  p_ticket_id uuid,
  p_expected_version int,
  p_assignee uuid,
  p_reason text
) returns public.tickets
language plpgsql security definer set search_path = '' as $$
declare
  v_role public.app_role := public.current_app_role();
  v_ticket public.tickets;
  v_from public.ticket_status;
begin
  select * into v_ticket from public.tickets where id = p_ticket_id for update;
  if v_ticket.id is null or v_role is null
    or not public.can_see_ticket_row(v_ticket.reporter_id, v_ticket.assignee_id, v_ticket.status) then
    raise exception using errcode = 'P0001', message = 'forbidden_transition';
  end if;
  if v_ticket.version <> p_expected_version then
    raise exception using errcode = 'P0001', message = 'version_conflict';
  end if;
  v_from := v_ticket.status;
  if not (v_role = 'admin' or (v_role = 'technician' and v_ticket.assignee_id = auth.uid()))
    or v_from not in ('assigned', 'in_progress') then
    raise exception using errcode = 'P0001', message = 'forbidden_transition';
  end if;
  if coalesce(pg_catalog.btrim(p_reason), '') = '' then
    raise exception using errcode = 'P0001', message = 'reason_required';
  end if;
  if not public.is_active_technician(p_assignee) or p_assignee = v_ticket.assignee_id then
    raise exception using errcode = 'P0001', message = 'assignee_required';
  end if;

  update public.tickets set assignee_id = p_assignee, status = 'assigned', version = version + 1
  where id = p_ticket_id
  returning * into v_ticket;

  insert into public.ticket_events (ticket_id, actor_id, action, from_status, to_status, detail)
  values (p_ticket_id, auth.uid(), 'reassigned', v_from, 'assigned', pg_catalog.btrim(p_reason));
  return v_ticket;
end $$;

revoke execute on function
  public.is_active_technician(uuid),
  public.transition_ticket(uuid, public.ticket_status, int, uuid, text),
  public.reassign_ticket(uuid, int, uuid, text)
from public, anon, authenticated;
grant execute on function
  public.transition_ticket(uuid, public.ticket_status, int, uuid, text),
  public.reassign_ticket(uuid, int, uuid, text)
to authenticated;
