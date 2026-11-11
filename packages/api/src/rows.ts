import type { Role, Ticket } from '@repair/core';
import type { Tables } from './database.types';

export type Comment = { id: number; ticketId: string; authorId: string; body: string; createdAt: string };

export type TicketEvent = {
  id: number;
  ticketId: string;
  actorId: string | null;
  action: Tables<'ticket_events'>['action'];
  fromStatus: Ticket['status'] | null;
  toStatus: Ticket['status'] | null;
  detail: string | null;
  createdAt: string;
};

export type Photo = { id: number; url: string };

export type TicketDetail = Ticket & { photos: Photo[]; comments: Comment[]; events: TicketEvent[] };

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

export type Category = Pick<Tables<'categories'>, 'id' | 'name'>;
export type Department = Pick<Tables<'departments'>, 'id' | 'name'>;
export type Equipment = { id: number; assetTag: string; name: string; installLocation: string | null };
export type Technician = { id: string; displayName: string };
export type Profile = { id: string; displayName: string; role: Role };

export const toEquipment = (r: Pick<Tables<'equipment'>, 'id' | 'asset_tag' | 'name' | 'install_location'>): Equipment => ({
  id: r.id,
  assetTag: r.asset_tag,
  name: r.name,
  installLocation: r.install_location,
});

export const toProfile = (r: Pick<Tables<'profiles'>, 'id' | 'display_name' | 'role'>): Profile => ({
  id: r.id,
  displayName: r.display_name,
  role: r.role,
});

// views report every column nullable; technician_options only selects not-null profile columns
export const toTechnician = (r: Tables<'technician_options'>): Technician => ({ id: r.id!, displayName: r.display_name! });
