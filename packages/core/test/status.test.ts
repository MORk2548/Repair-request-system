import { test, expect } from 'vitest';
import { canTransition, nextStatuses, canReassign } from '../src/index';

test('admin assigns a new ticket', () => expect(canTransition('new', 'assigned', 'admin')).toBe(true));
test('reporter cannot assign', () => expect(canTransition('new', 'assigned', 'reporter')).toBe(false));
test('technician cannot close', () => expect(canTransition('done', 'closed', 'technician')).toBe(false));
test('closed and cancelled are terminal', () => {
  expect(nextStatuses('closed', 'admin')).toEqual([]);
  expect(nextStatuses('cancelled', 'admin')).toEqual([]);
});
test('reporter can reopen a done ticket', () => expect(nextStatuses('done', 'reporter')).toEqual(['closed', 'in_progress']));
test('technician can take a new ticket', () => expect(nextStatuses('new', 'technician')).toEqual(['assigned']));
test('only staff can reassign, and only while assigned or in progress', () => {
  expect(canReassign('in_progress', 'technician')).toBe(true);
  expect(canReassign('in_progress', 'reporter')).toBe(false);
  expect(canReassign('done', 'admin')).toBe(false);
});
