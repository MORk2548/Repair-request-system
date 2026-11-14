'use client';

import { useState, type InputHTMLAttributes } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { id: string; toggleLabel: string };

export function PasswordInput({ toggleLabel, ...input }: Props) {
  const [shown, setShown] = useState(false);
  return (
    <div className="password-field">
      <input {...input} type={shown ? 'text' : 'password'} />
      <button type="button" className="password-toggle" aria-label={toggleLabel} aria-controls={input.id} aria-pressed={shown} onClick={() => setShown((v) => !v)}>
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
          {shown && <path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />}
        </svg>
      </button>
    </div>
  );
}
