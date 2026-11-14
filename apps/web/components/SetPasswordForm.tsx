'use client';

import { PASSWORD_RULES, setPasswordSchema } from '@repair/core';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { createBrowserDb } from '../lib/supabase-browser';
import { Field, fieldErrors } from './Field';
import { PasswordInput } from './PasswordInput';

type Errors = Partial<Record<'password' | 'confirm', string>>;

export function SetPasswordForm() {
  const router = useRouter();
  const [errors, setErrors] = useState<Errors>({});
  const [failed, setFailed] = useState(false);
  const [sending, setSending] = useState(false);
  const [password, setPassword] = useState('');

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sending) return;
    const form = new FormData(e.currentTarget);
    const parsed = setPasswordSchema.safeParse({ password: form.get('password'), confirm: form.get('confirm') });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setFailed(false);
    setSending(true);
    const { error } = await createBrowserDb().auth.updateUser({ password: parsed.data.password });
    setSending(false);
    if (error) return setFailed(true);
    router.replace('/tickets');
    router.refresh();
  }

  return (
    <form onSubmit={submit} noValidate>
      <h1>ตั้งรหัสผ่าน</h1>
      <Field label="รหัสผ่านใหม่" error={errors.password}>
        {(p) => (
          <PasswordInput
            {...p}
            toggleLabel="แสดงรหัสผ่านใหม่"
            name="password"
            autoComplete="new-password"
            aria-describedby={[p['aria-describedby'], 'password-rules'].filter(Boolean).join(' ')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        )}
      </Field>
      <ul id="password-rules" className="password-rules" aria-label="เงื่อนไขรหัสผ่าน">
        {PASSWORD_RULES.map((r) => {
          const ok = password !== '' && r.test(password);
          return (
            <li key={r.label} className={ok ? 'rule-ok' : undefined}>
              <span aria-hidden="true">{ok ? '✓' : '•'}</span> {r.label}
              <span className="visually-hidden">{ok ? ' (ผ่านแล้ว)' : ''}</span>
            </li>
          );
        })}
      </ul>
      <Field label="ยืนยันรหัสผ่าน" error={errors.confirm}>
        {(p) => <PasswordInput {...p} toggleLabel="แสดงรหัสผ่านยืนยัน" name="confirm" autoComplete="new-password" />}
      </Field>
      {failed && (
        <p role="alert" className="alert alert-error">
          ตั้งรหัสผ่านไม่สำเร็จ กรุณาลองอีกครั้ง
        </p>
      )}
      <button type="submit" className="button button-block" disabled={sending} aria-busy={sending}>
        บันทึกรหัสผ่าน
      </button>
    </form>
  );
}
