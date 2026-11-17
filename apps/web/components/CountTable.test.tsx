import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { CountTable } from './CountTable';

const rows = [
  { key: 'a', label: 'ไฟฟ้า', count: 1 },
  { key: 'b', label: 'ประปา', count: 3 },
  { key: 'c', label: 'อื่น ๆ', count: 0 },
];

const shown = () => screen.getAllByRole('row').slice(1).map((r) => r.textContent);

test('a sorted table lists the largest count first, with its share of the total', () => {
  render(<CountTable caption="ตามหมวด" heading="หมวด" rows={rows} total={4} sorted />);
  expect(shown()).toEqual(['ประปา3 (75%)', 'ไฟฟ้า1 (25%)', 'อื่น ๆ0 (0%)']);
});

test('an unsorted table keeps the given order, draws bars relative to the largest count and none for zero', () => {
  const { container } = render(<CountTable caption="ตามสถานะ" heading="สถานะ" rows={rows} total={4} />);
  expect(shown()[0]).toBe('ไฟฟ้า1 (25%)');
  const widths = [...container.querySelectorAll<HTMLElement>('.bar')].map((b) => b.style.width);
  expect(widths).toEqual(['33.3333%', '100%']);
  expect(screen.getByRole('table', { name: 'ตามสถานะ' })).toBeTruthy();
});
