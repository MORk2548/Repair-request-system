export const ROLES = ['reporter', 'technician', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const TICKET_STATUSES = ['new', 'assigned', 'in_progress', 'done', 'closed', 'cancelled'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export type Transition = { from: TicketStatus; to: TicketStatus; role: Role };

// One row per (from, to, role); status_transitions in 0003_transition.sql must match (parity.db.test.ts).
export const TRANSITIONS: ReadonlyArray<Transition> = [
  { from: 'new', to: 'assigned', role: 'admin' },
  { from: 'new', to: 'assigned', role: 'technician' },
  { from: 'new', to: 'cancelled', role: 'reporter' },
  { from: 'new', to: 'cancelled', role: 'admin' },
  { from: 'assigned', to: 'in_progress', role: 'technician' },
  { from: 'assigned', to: 'in_progress', role: 'admin' },
  { from: 'assigned', to: 'cancelled', role: 'admin' },
  { from: 'in_progress', to: 'done', role: 'technician' },
  { from: 'in_progress', to: 'done', role: 'admin' },
  { from: 'done', to: 'closed', role: 'reporter' },
  { from: 'done', to: 'closed', role: 'admin' },
  { from: 'done', to: 'in_progress', role: 'reporter' },
  { from: 'done', to: 'in_progress', role: 'admin' },
];

const REASSIGNABLE_STATUSES: ReadonlySet<TicketStatus> = new Set(['assigned', 'in_progress']);
const REASSIGNING_ROLES: ReadonlySet<Role> = new Set(['technician', 'admin']);

export const canTransition = (from: TicketStatus, to: TicketStatus, role: Role): boolean =>
  TRANSITIONS.some((t) => t.from === from && t.to === to && t.role === role);

export const nextStatuses = (from: TicketStatus, role: Role): TicketStatus[] => [
  ...new Set(TRANSITIONS.filter((t) => t.from === from && t.role === role).map((t) => t.to)),
];

export const canReassign = (status: TicketStatus, role: Role): boolean =>
  REASSIGNABLE_STATUSES.has(status) && REASSIGNING_ROLES.has(role);
