import type { Role, Ticket, TicketEventAction, TicketStatus } from '@repair/core';
import type { Tables } from './database.types';

export type Comment = { id: number; ticketId: string; authorId: string; body: string; createdAt: string };

export type TicketEvent = {
  id: number;
  ticketId: string;
  actorId: string | null;
  action: TicketEventAction;
  fromStatus: Ticket['status'] | null;
  toStatus: Ticket['status'] | null;
  detail: string | null;
  createdAt: string;
};

export type Photo = { id: number; url: string };

export type TicketDetail = Ticket & {
  categoryName: string | null;
  equipment: { assetTag: string; name: string } | null;
  // display name by profile id, for the reporter, assignee, comment authors and event actors
  people: Record<string, string>;
  photos: Photo[];
  comments: Comment[];
  events: TicketEvent[];
};

export const toTicket = (r: Tables<'tickets'>): Ticket => ({
  id: r.id,
  ticketNo: r.ticket_no,
  title: r.title,
  description: r.description,
  categoryId: r.category_id,
  equipmentId: r.equipment_id,
  priority: r.priority,
  location: r.location,
  status: r.status,
  reporterId: r.reporter_id,
  assigneeId: r.assignee_id,
  resolution: r.resolution,
  resolvedAt: r.resolved_at,
  version: r.version,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const toComment = (r: Tables<'ticket_comments'>): Comment => ({
  id: r.id,
  ticketId: r.ticket_id,
  authorId: r.author_id,
  body: r.body,
  createdAt: r.created_at,
});

export const toTicketEvent = (r: Tables<'ticket_events'>): TicketEvent => ({
  id: r.id,
  ticketId: r.ticket_id,
  actorId: r.actor_id,
  action: r.action,
  fromStatus: r.from_status,
  toStatus: r.to_status,
  detail: r.detail,
  createdAt: r.created_at,
});

export type Category = { id: number; name: string; sortOrder: number; isActive: boolean };
export type Department = { id: number; name: string; isActive: boolean };
export type Equipment = {
  id: number;
  assetTag: string;
  name: string;
  serialNo: string | null;
  departmentId: number | null;
  installLocation: string | null;
  status: Tables<'equipment'>['status'];
};
export type Technician = { id: string; displayName: string };
export type Profile = { id: string; displayName: string; role: Role };

export type Account = Profile & { departmentName: string | null; createdAt: string };

export const toCategory = (r: Tables<'categories'>): Category => ({ id: r.id, name: r.name, sortOrder: r.sort_order, isActive: r.is_active });

export const toDepartment = (r: Tables<'departments'>): Department => ({ id: r.id, name: r.name, isActive: r.is_active });

export const toEquipment = (r: Tables<'equipment'>): Equipment => ({
  id: r.id,
  assetTag: r.asset_tag,
  name: r.name,
  serialNo: r.serial_no,
  departmentId: r.department_id,
  installLocation: r.install_location,
  status: r.status,
});

export const toAccount = (
  r: Pick<Tables<'profiles'>, 'id' | 'display_name' | 'role' | 'created_at'> & { departments: Pick<Tables<'departments'>, 'name'> | null },
): Account => ({ ...toProfile(r), departmentName: r.departments?.name ?? null, createdAt: r.created_at });

export const toProfile = (r: Pick<Tables<'profiles'>, 'id' | 'display_name' | 'role'>): Profile => ({
  id: r.id,
  displayName: r.display_name,
  role: r.role,
});

// views report every column nullable; technician_options only selects not-null profile columns
export const toTechnician = (r: Tables<'technician_options'>): Technician => ({ id: r.id!, displayName: r.display_name! });

export type Notification = {
  id: number;
  ticketId: string;
  ticketNo: string;
  title: string;
  toStatus: TicketStatus;
  createdAt: string;
  readAt: string | null;
};

type NotificationRow = Pick<Tables<'notifications'>, 'id' | 'read_at'> & {
  ticket_events: Pick<Tables<'ticket_events'>, 'ticket_id' | 'to_status' | 'created_at'> & {
    tickets: Pick<Tables<'tickets'>, 'ticket_no' | 'title'>;
  };
};

// the trigger only queues events that have a to_status, so every notification has one
export const toNotification = (r: NotificationRow): Notification => ({
  id: r.id,
  ticketId: r.ticket_events.ticket_id,
  ticketNo: r.ticket_events.tickets.ticket_no,
  title: r.ticket_events.tickets.title,
  toStatus: r.ticket_events.to_status!,
  createdAt: r.ticket_events.created_at,
  readAt: r.read_at,
});
