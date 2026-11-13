import { listTickets } from '@repair/api';
import type { Role, Ticket } from '@repair/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import TicketsScreen from '../app/(tabs)/tickets';
import { useProfile } from '../lib/useProfile';

jest.mock('@repair/api', () => ({ listTickets: jest.fn() }));
jest.mock('../lib/supabase', () => ({ db: {} }));
jest.mock('../lib/useProfile', () => ({ useProfile: jest.fn() }));
const mockRouter = { push: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useFocusEffect: (effect: () => void) => require('react').useEffect(effect, [effect]) }));

const ticket = (n: number): Ticket => ({
  id: `t-${n}`,
  ticketNo: `RQ-2611-000${n}`,
  title: `ใบที่ ${n}`,
  description: 'x',
  categoryId: 1,
  equipmentId: null,
  priority: 'urgent',
  location: 'ตึก A',
  status: 'new',
  reporterId: 'r',
  assigneeId: null,
  resolution: null,
  resolvedAt: null,
  version: 1,
  createdAt: '2026-11-12T03:05:00Z',
  updatedAt: '2026-11-12T03:05:00Z',
});

const as = (role: Role) => jest.mocked(useProfile).mockReturnValue({ userId: 'me', profile: { id: 'me', displayName: 'ฉัน', role } });
const calls = () => jest.mocked(listTickets).mock.calls.map(([, opts]) => opts);

beforeEach(() => {
  jest.resetAllMocks();
  as('reporter');
});

test('shows Thai labels and loads the next page at the end of the list', async () => {
  jest.mocked(listTickets)
    .mockResolvedValueOnce({ items: [ticket(1)], nextCursor: 'c1' })
    .mockResolvedValueOnce({ items: [ticket(2)], nextCursor: null });
  await render(<TicketsScreen />);

  expect(await screen.findByText('RQ-2611-0001')).toBeTruthy();
  expect(screen.getByText('ใหม่')).toBeTruthy();
  expect(screen.getByText('ด่วน')).toBeTruthy();
  expect(screen.getByText('12/11/2569 10:05')).toBeTruthy();

  await fireEvent(screen.getByTestId('ticket-list'), 'onEndReached');
  expect(await screen.findByText('RQ-2611-0002')).toBeTruthy();
  expect(jest.mocked(listTickets).mock.calls.map(([, opts]) => opts)).toEqual([{}, { cursor: 'c1' }]);

  await fireEvent(screen.getByTestId('ticket-list'), 'onEndReached');
  await waitFor(() => expect(listTickets).toHaveBeenCalledTimes(2));
});

test('shows the empty state and a button to file a ticket', async () => {
  jest.mocked(listTickets).mockResolvedValue({ items: [], nextCursor: null });
  await render(<TicketsScreen />);

  expect(await screen.findByText('ยังไม่มีใบแจ้งซ่อม')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'แจ้งซ่อม' }));
  expect(mockRouter.push).toHaveBeenCalledWith('/tickets/new');
});

test('a row opens its ticket', async () => {
  jest.mocked(listTickets).mockResolvedValue({ items: [ticket(1)], nextCursor: null });
  await render(<TicketsScreen />);
  await fireEvent.press(await screen.findByRole('button', { name: /RQ-2611-0001/ }));
  expect(mockRouter.push).toHaveBeenCalledWith('/tickets/t-1');
});

test('technician sees "งานของฉัน" by default and "คิวใบใหม่" loads new tickets, also when paging', async () => {
  as('technician');
  jest.mocked(listTickets).mockResolvedValue({ items: [ticket(1)], nextCursor: 'c1' });
  await render(<TicketsScreen />);
  await screen.findByText('RQ-2611-0001');
  expect(screen.getByRole('radio', { name: 'งานของฉัน' }).props.accessibilityState.checked).toBe(true);
  expect(calls()).toEqual([{ assigneeId: 'me' }]);

  await fireEvent.press(screen.getByRole('radio', { name: 'คิวใบใหม่' }));
  await waitFor(() => expect(calls()).toEqual([{ assigneeId: 'me' }, { status: 'new' }]));
  await fireEvent(screen.getByTestId('ticket-list'), 'onEndReached');
  await waitFor(() => expect(calls().at(-1)).toEqual({ status: 'new', cursor: 'c1' }));
});

test('admin sees every ticket and a status chip filters the list', async () => {
  as('admin');
  jest.mocked(listTickets).mockResolvedValue({ items: [], nextCursor: null });
  await render(<TicketsScreen />);
  await screen.findByText('ยังไม่มีใบแจ้งซ่อม');
  expect(screen.queryByRole('radio', { name: 'คิวใบใหม่' })).toBeNull();

  await fireEvent.press(screen.getByRole('radio', { name: 'แก้ไขเสร็จ' }));
  await waitFor(() => expect(calls()).toEqual([{}, { status: 'done' }]));
  await fireEvent.press(screen.getByRole('radio', { name: 'ทั้งหมด' }));
  await waitFor(() => expect(calls().at(-1)).toEqual({}));
});
