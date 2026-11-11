'use client';

import { setPasswordSchema } from '@repair/core';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { createBrowserDb } from '../lib/supabase-browser';
import { Field, fieldErrors } from './Field';

type Errors = Partial<Record<'password' | 'confirm', string>>;

export function SetPasswordForm() {
  const router = useRouter();
  const [errors, setErrors] = useState<Errors>({});
  const [failed, setFailed] = useState(false);
  const [sending, setSending] = useState(false);

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
    <form className="card stack" onSubmit={submit} noValidate>
      <h1>ตั้งรหัสผ่าน</h1>
      <Field label="รหัสผ่านใหม่" error={errors.password}>
        {(p) => <input {...p} name="password" type="password" autoComplete="new-password" />}
      </Field>
      <Field label="ยืนยันรหัสผ่าน" error={errors.confirm}>
        {(p) => <input {...p} name="confirm" type="password" autoComplete="new-password" />}
      </Field>
      {failed && (
        <p role="alert" className="error">
          ตั้งรหัสผ่านไม่สำเร็จ กรุณาลองอีกครั้ง
        </p>
      )}
      <button type="submit" className="primary" disabled={sending} aria-busy={sending}>
        บันทึกรหัสผ่าน
      </button>
    </form>
  );
}
