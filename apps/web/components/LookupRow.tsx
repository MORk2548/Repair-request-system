'use client';

import { saveCategory, saveDepartment, type Db } from '@repair/api';
import { categorySchema, departmentSchema } from '@repair/core';
import { useState, type FormEvent } from 'react';
import { Field, fieldErrors } from './Field';
import { ActionError, useAction } from './useAction';

export type LookupKind = 'department' | 'category';
type Item = { id?: number | undefined; name: string; sortOrder?: number; isActive: boolean };

const schemas = { department: departmentSchema, category: categorySchema };

const save = (db: Db, kind: LookupKind, { id, name, sortOrder = 0, isActive }: Item) =>
  kind === 'category' ? saveCategory(db, { id, name, sortOrder, isActive }) : saveDepartment(db, { id, name, isActive });

export function LookupRow({ kind, item }: { kind: LookupKind; item: Item & { id: number } }) {
  const { pending, error, run } = useAction();
  const [editing, setEditing] = useState(false);
  const columns = kind === 'category' ? 4 : 3;

  if (editing) {
    return (
      <tr>
        <td colSpan={columns}>
          <LookupForm kind={kind} item={item} onDone={() => setEditing(false)} />
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td>{item.name}</td>
      {kind === 'category' && <td>{item.sortOrder}</td>}
      <td>{item.isActive ? 'ใช้งาน' : 'ปิดใช้งาน'}</td>
      <td>
        <div className="row">
          <button type="button" onClick={() => setEditing(true)}>
            แก้ไข
          </button>
          <button type="button" disabled={pending} aria-busy={pending} onClick={() => void run((db) => save(db, kind, { ...item, isActive: !item.isActive }))}>
            {item.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
          </button>
        </div>
        <ActionError error={error} />
      </td>
    </tr>
  );
}

export function LookupForm({ kind, item, onDone }: { kind: LookupKind; item?: Item; onDone?: () => void }) {
  const { pending, error, run } = useAction();
  const [name, setName] = useState(item?.name ?? '');
  const [sortOrder, setSortOrder] = useState(String(item?.sortOrder ?? 0));
  const [errors, setErrors] = useState<Partial<Record<'name' | 'sortOrder', string>>>({});
  const label = kind === 'category' ? 'ชื่อหมวด' : 'ชื่อแผนก';

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = { id: item?.id, name, sortOrder: Number(sortOrder), isActive: item?.isActive ?? true };
    const parsed = schemas[kind].safeParse(value);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    if (!(await run((db) => save(db, kind, value)))) return;
    if (!item) {
      setName('');
      setSortOrder('0');
    }
    onDone?.();
  }

  return (
    <form className="stack" onSubmit={submit} noValidate aria-label={item ? `แก้ไข ${item.name}` : kind === 'category' ? 'เพิ่มหมวด' : 'เพิ่มแผนก'}>
      <div className="row">
        <Field label={label} error={errors.name}>
          {(p) => <input {...p} value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        {kind === 'category' && (
          <Field label="ลำดับ" error={errors.sortOrder}>
            {(p) => <input {...p} type="number" step={1} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />}
          </Field>
        )}
      </div>
      <ActionError error={error} />
      <div className="row">
        <button type="submit" className="primary" disabled={pending} aria-busy={pending}>
          {item ? 'บันทึก' : 'เพิ่ม'}
        </button>
        {onDone && (
          <button type="button" disabled={pending} onClick={onDone}>
            ยกเลิก
          </button>
        )}
      </div>
    </form>
  );
}
