'use client';

import { adminUpdateUser, type Department } from '@repair/api';
import { ROLES, ROLE_LABELS, updateUserSchema, type AdminUser, type Role } from '@repair/core';
import { useState, type FormEvent } from 'react';
import { Field, fieldErrors } from './Field';
import { ActionError, useAction } from './useAction';

const COLUMNS = 6;

export function UserRow({ user, departments, isSelf }: { user: AdminUser; departments: Department[]; isSelf: boolean }) {
  const { pending, error, run } = useAction();
  const [mode, setMode] = useState<'view' | 'edit' | 'confirm'>('view');
  const department = departments.find((d) => d.id === user.departmentId);

  if (mode === 'edit') {
    return (
      <tr>
        <td colSpan={COLUMNS}>
          <UserEditForm user={user} departments={departments} isSelf={isSelf} onDone={() => setMode('view')} />
        </td>
      </tr>
    );
  }

  const toggle = () => run((db) => adminUpdateUser(db, { userId: user.id, isActive: !user.isActive })).then((ok) => ok && setMode('view'));

  return (
    <tr>
      <td>{user.displayName}</td>
      <td>{user.email}</td>
      <td>{ROLE_LABELS[user.role]}</td>
      <td>{department?.name ?? '-'}</td>
      <td>{user.isActive ? 'ใช้งาน' : 'ปิดใช้งาน'}</td>
      <td>
        {mode === 'confirm' ? (
          <div className="stack tight">
            <p className="description">
              {user.isActive ? 'ยืนยันปิดใช้งาน' : 'ยืนยันเปิดใช้งาน'} {user.displayName} หรือไม่
            </p>
            <div className="row">
              <button type="button" className={user.isActive ? 'button button-danger' : 'button'} disabled={pending} onClick={() => void toggle()}>
                ยืนยัน
              </button>
              <button type="button" className="button button-secondary" disabled={pending} onClick={() => setMode('view')}>
                ยกเลิก
              </button>
            </div>
          </div>
        ) : (
          <div className="row">
            <button type="button" className="button button-secondary" onClick={() => setMode('edit')}>
              แก้ไข
            </button>
            {!isSelf && (
              <button type="button" className={user.isActive ? 'button button-danger' : 'button button-secondary'} onClick={() => setMode('confirm')}>
                {user.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
              </button>
            )}
          </div>
        )}
        <ActionError error={error} />
      </td>
    </tr>
  );
}

type Fields = { displayName: string; role: Role; departmentId: string };

function UserEditForm({ user, departments, isSelf, onDone }: { user: AdminUser; departments: Department[]; isSelf: boolean; onDone: () => void }) {
  const { pending, error, run } = useAction();
  const [fields, setFields] = useState<Fields>({ displayName: user.displayName, role: user.role, departmentId: user.departmentId?.toString() ?? '' });
  const [errors, setErrors] = useState<Partial<Record<keyof Fields, string>>>({});
  const options = departments.filter((d) => d.isActive || d.id === user.departmentId);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = updateUserSchema.safeParse({
      userId: user.id,
      displayName: fields.displayName,
      // an admin's own role is not sent, so the Edge Function never sees a self-demotion
      ...(!isSelf && { role: fields.role }),
      departmentId: fields.departmentId ? Number(fields.departmentId) : null,
    });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    if (await run((db) => adminUpdateUser(db, parsed.data))) onDone();
  }

  return (
    <form onSubmit={submit} noValidate aria-label={`แก้ไข ${user.displayName}`}>
      <div className="row">
        <Field label="ชื่อ" error={errors.displayName}>
          {(p) => <input {...p} value={fields.displayName} onChange={(e) => setFields((f) => ({ ...f, displayName: e.target.value }))} />}
        </Field>
        {!isSelf && (
          <Field label="บทบาท" error={errors.role}>
            {(p) => (
              <select {...p} value={fields.role} onChange={(e) => setFields((f) => ({ ...f, role: e.target.value as Role }))}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            )}
          </Field>
        )}
        <Field label="แผนก" error={errors.departmentId}>
          {(p) => (
            <select {...p} value={fields.departmentId} onChange={(e) => setFields((f) => ({ ...f, departmentId: e.target.value }))}>
              <option value="">ไม่ระบุ</option>
              {options.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>
      <ActionError error={error} />
      <div className="actions">
        <button type="submit" className="button" disabled={pending} aria-busy={pending}>
          บันทึก
        </button>
        <button type="button" className="button button-secondary" disabled={pending} onClick={onDone}>
          ยกเลิก
        </button>
      </div>
    </form>
  );
}
