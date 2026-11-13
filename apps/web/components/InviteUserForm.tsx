'use client';

import { adminCreateUser, type Department } from '@repair/api';
import { ROLES, ROLE_LABELS, createUserSchema, type Role } from '@repair/core';
import { useState, type FormEvent } from 'react';
import { Field, fieldErrors } from './Field';
import { ActionError, useAction } from './useAction';

type Fields = { email: string; displayName: string; role: Role; departmentId: string };
const empty: Fields = { email: '', displayName: '', role: 'reporter', departmentId: '' };

export function InviteUserForm({ departments }: { departments: Department[] }) {
  const { pending, error, run } = useAction();
  const [fields, setFields] = useState<Fields>(empty);
  const [errors, setErrors] = useState<Partial<Record<keyof Fields, string>>>({});
  const [sentTo, setSentTo] = useState<string | null>(null);

  const set = (name: keyof Fields) => (value: string) => setFields((f) => ({ ...f, [name]: value }));

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = createUserSchema.safeParse({ ...fields, departmentId: fields.departmentId ? Number(fields.departmentId) : null });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setSentTo(null);
    if (await run((db) => adminCreateUser(db, parsed.data))) {
      setFields(empty);
      setSentTo(parsed.data.email);
    }
  }

  return (
    <form className="panel" onSubmit={submit} noValidate aria-label="เชิญผู้ใช้">
      <h2>เชิญผู้ใช้</h2>
      <div className="row">
        <Field label="อีเมล" error={errors.email}>
          {(p) => <input {...p} type="email" value={fields.email} onChange={(e) => set('email')(e.target.value)} />}
        </Field>
        <Field label="ชื่อ" error={errors.displayName}>
          {(p) => <input {...p} value={fields.displayName} onChange={(e) => set('displayName')(e.target.value)} />}
        </Field>
      </div>
      <div className="row">
        <Field label="บทบาท" error={errors.role}>
          {(p) => (
            <select {...p} value={fields.role} onChange={(e) => set('role')(e.target.value)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="แผนก" error={errors.departmentId}>
          {(p) => (
            <select {...p} value={fields.departmentId} onChange={(e) => set('departmentId')(e.target.value)}>
              <option value="">ไม่ระบุ</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>
      <ActionError error={error} />
      {sentTo && <p role="status" className="alert alert-success">ส่งคำเชิญไปที่ {sentTo} แล้ว</p>}
      <div className="actions">
        <button type="submit" className="button" disabled={pending} aria-busy={pending}>
          ส่งคำเชิญ
        </button>
      </div>
    </form>
  );
}
