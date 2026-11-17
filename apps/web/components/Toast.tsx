'use client';

import { useEffect, useState } from 'react';

const EVENT = 'app-toast';

// A save often closes the edit row that made it, so the message lives in one Toaster on the page, not in the form.
export const toast = (text: string) => window.dispatchEvent(new CustomEvent<string>(EVENT, { detail: text }));

export function Toaster() {
  const [message, setMessage] = useState<{ text: string; key: number } | null>(null);

  useEffect(() => {
    const show = (e: Event) => setMessage({ text: (e as CustomEvent<string>).detail, key: Date.now() });
    window.addEventListener(EVENT, show);
    return () => window.removeEventListener(EVENT, show);
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [message]);

  // the live region stays mounted so screen readers announce each new message
  return (
    <div className="toast-region" role="status" aria-live="polite">
      {message && (
        <p key={message.key} className="toast">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 12.5 9.2 17 19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {message.text}
        </p>
      )}
    </div>
  );
}
