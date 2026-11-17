import { act, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { Toaster, toast } from './Toast';

test('shows a message in a polite live region and clears it after 4 seconds', () => {
  vi.useFakeTimers();
  render(<Toaster />);
  act(() => toast('บันทึกอุปกรณ์ AC-0001 แล้ว'));
  expect(screen.getByRole('status').textContent).toBe('บันทึกอุปกรณ์ AC-0001 แล้ว');
  act(() => vi.advanceTimersByTime(4000));
  expect(screen.getByRole('status').textContent).toBe('');
  vi.useRealTimers();
});
