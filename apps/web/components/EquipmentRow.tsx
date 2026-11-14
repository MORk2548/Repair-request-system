'use client';

import { DuplicateAssetTagError, saveEquipment, type Department, type Equipment } from '@repair/api';
import { EQUIPMENT_STATUSES, EQUIPMENT_STATUS_LABELS, equipmentSchema, type EquipmentStatus } from '@repair/core';
import { useState, type FormEvent } from 'react';
import { Field, fieldErrors } from './Field';
import { ActionError, useAction } from './useAction';

const COLUMNS = 10;

export function EquipmentRow({ equipment, departments }: { equipment: Equipment; departments: Department[] }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <tr>
        <td colSpan={COLUMNS}>
          <EquipmentForm equipment={equipment} departments={departments} onDone={() => setEditing(false)} />
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td className="nowrap">{equipment.assetTag}</td>
      <td>{equipment.name}</td>
      <td>{equipment.model ?? '-'}</td>
      <td>{equipment.serialNo ?? '-'}</td>
      <td>{[equipment.monitorModel, equipment.monitorSerialNo].filter(Boolean).join(' · ') || '-'}</td>
      <td>{equipment.userName ?? '-'}</td>
      <td>{departments.find((d) => d.id === equipment.departmentId)?.name ?? '-'}</td>
      <td>{equipment.installLocation ?? '-'}</td>
            <td>{EQUIPMENT_STATUS_LABELS[equipment.status]}</td>
      <td>
        <button type="button" className="button button-secondary" onClick={() => setEditing(true)}>
          แก้ไข
        </button>
      </td>
    </tr>
  );
}

type Fields = {
  assetTag: string;
  name: string;
  model: string;
  serialNo: string;
  monitorModel: string;
  monitorSerialNo: string;
  userName: string;
  departmentId: string;
  installLocation: string;
  status: EquipmentStatus;
};

const fieldsOf = (e?: Equipment): Fields => ({
  assetTag: e?.assetTag ?? '',
  name: e?.name ?? '',
  model: e?.model ?? '',
  serialNo: e?.serialNo ?? '',
  monitorModel: e?.monitorModel ?? '',
  monitorSerialNo: e?.monitorSerialNo ?? '',
  userName: e?.userName ?? '',
  departmentId: e?.departmentId?.toString() ?? '',
  installLocation: e?.installLocation ?? '',
  status: e?.status ?? 'active',
});

export function EquipmentForm({ equipment, departments, onDone }: { equipment?: Equipment; departments: Department[]; onDone?: () => void }) {
  const { pending, error, run } = useAction();
  const [fields, setFields] = useState(() => fieldsOf(equipment));
  const [errors, setErrors] = useState<Partial<Record<keyof Fields, string>>>({});
  const options = departments.filter((d) => d.isActive || d.id === equipment?.departmentId);

  const input = (name: Exclude<keyof Fields, 'departmentId' | 'status'>, label: string) => (
    <Field label={label} error={errors[name]}>
      {(p) => <input {...p} value={fields[name]} onChange={(e) => setFields((f) => ({ ...f, [name]: e.target.value }))} />}
    </Field>
  );

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = equipmentSchema.safeParse({ ...fields, departmentId: fields.departmentId ? Number(fields.departmentId) : null });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    const duplicate = (err: unknown) => {
      if (!(err instanceof DuplicateAssetTagError)) return false;
      setErrors({ assetTag: 'รหัสทรัพย์สินนี้มีอยู่แล้ว' });
      return true;
    };
    if (!(await run((db) => saveEquipment(db, { id: equipment?.id, ...parsed.data }), duplicate))) return;
    if (!equipment) setFields(fieldsOf());
    onDone?.();
  }

  return (
    <form onSubmit={submit} noValidate aria-label={equipment ? `แก้ไข ${equipment.assetTag}` : 'เพิ่มอุปกรณ์'}>
      <div className="row">
        {input('assetTag', 'รหัสทรัพย์สิน')}
        {input('name', 'ชื่ออุปกรณ์')}
        {input('userName', 'ผู้ใช้งาน')}
      </div>
      <div className="row">
        {input('model', 'รุ่นเครื่อง')}
        {input('serialNo', 'หมายเลขเครื่อง (SN)')}
      </div>
      <div className="row">
        {input('monitorModel', 'รุ่นจอ')}
        {input('monitorSerialNo', 'หมายเลขจอ (SN)')}
      </div>
      <div className="row">
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
        {input('installLocation', 'สถานที่ติดตั้ง')}
        <Field label="สถานะ" error={errors.status}>
          {(p) => (
            <select {...p} value={fields.status} onChange={(e) => setFields((f) => ({ ...f, status: e.target.value as EquipmentStatus }))}>
              {EQUIPMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {EQUIPMENT_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>
      <ActionError error={error} />
      <div className="actions">
        <button type="submit" className="button" disabled={pending} aria-busy={pending}>
          {equipment ? 'บันทึก' : 'เพิ่มอุปกรณ์'}
        </button>
        {onDone && (
          <button type="button" className="button button-secondary" disabled={pending} onClick={onDone}>
            ยกเลิก
          </button>
        )}
      </div>
    </form>
  );
}
