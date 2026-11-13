'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { createBrowserDb } from '../lib/supabase-browser';

export function LoginForm() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const [sending, setSending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSending(true);
    setFailed(false);
    const { error } = await createBrowserDb().auth.signInWithPassword({
      email: String(form.get('email')),
      password: String(form.get('password')),
    });
    setSending(false);
    if (error) return setFailed(true);
    router.replace('/tickets');
    router.refresh();
  }

  return (
    <form onSubmit={submit}>
      <h1>เข้าสู่ระบบ</h1>
      <div className="field">
        <label htmlFor="email">อีเมล</label>
        <input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="field">
        <label htmlFor="password">รหัสผ่าน</label>
        <div className="password-field">
          <input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required />
          <button
            type="button"
            className="password-toggle"
            aria-label="แสดงรหัสผ่าน"
            aria-controls="password"
            aria-pressed={showPassword}
            onClick={() => setShowPassword((v) => !v)}
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
              {showPassword && <path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />}
            </svg>
          </button>
        </div>
      </div>
      {failed && (
        <p role="alert" className="alert alert-error">
          อีเมลหรือรหัสผ่านไม่ถูกต้อง
        </p>
      )}
      <button type="submit" className="button button-block" disabled={sending}>
        เข้าสู่ระบบ
      </button>
    </form>
  );
}
