import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { expect, test } from 'vitest';
import { FocusFirstError } from './FocusFirstError';

function Form() {
  const [bad, setBad] = useState(false);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setBad(true);
      }}
    >
      <input aria-label="ok" />
      <input aria-label="title" aria-invalid={bad || undefined} />
      <input aria-label="place" aria-invalid={bad || undefined} />
      <button type="submit">send</button>
    </form>
  );
}

test('a failed submit moves focus to the first invalid field', async () => {
  render(
    <>
      <FocusFirstError />
      <Form />
    </>,
  );
  screen.getByRole('button', { name: 'send' }).focus();
  fireEvent.submit(screen.getByRole('button', { name: 'send' }).closest('form')!);
  await new Promise((r) => requestAnimationFrame(r));
  await new Promise((r) => requestAnimationFrame(r));
  expect(document.activeElement).toBe(screen.getByLabelText('title'));
});
