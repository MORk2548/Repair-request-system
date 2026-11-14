'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { createBrowserDb } from '../lib/supabase-browser';
import { PasswordInput } from './PasswordInput';

export function LoginForm() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const [sending, setSending] = useState(false);

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
        <PasswordInput id="password" name="password" autoComplete="current-password" required toggleLabel="แสดงรหัสผ่าน" />
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
