import { listTickets } from '@repair/api';
import type { Ticket } from '@repair/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import TicketsScreen from '../app/(tabs)/tickets';

jest.mock('@repair/api', () => ({ listTickets: jest.fn() }));
jest.mock('../lib/supabase', () => ({ db: {} }));
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

beforeEach(() => jest.resetAllMocks());

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
