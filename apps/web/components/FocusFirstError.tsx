'use client';

import { useEffect } from 'react';

// Every form validates on submit and marks bad fields aria-invalid; the errors can sit above the screen
// (or under the phone's sticky header) while the user is at the submit button, so move focus to the first one.
export function FocusFirstError() {
  useEffect(() => {
    const onSubmit = (e: SubmitEvent) => {
      const form = e.target as HTMLFormElement;
      // after React has committed the errors the handler just set
      requestAnimationFrame(() => form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
    };
    document.addEventListener('submit', onSubmit);
    return () => document.removeEventListener('submit', onSubmit);
  }, []);
  return null;
}
