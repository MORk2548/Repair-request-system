'use client';

import { attachPhoto, createTicket, listEquipment, type Category, type Equipment } from '@repair/api';
import {
  MAX_PHOTO_BYTES,
  MAX_PHOTOS,
  PHOTO_MIME_TYPES,
  PRIORITIES,
  PRIORITY_LABELS,
  createTicketSchema,
  type Priority,
  type Ticket,
} from '@repair/core';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { createBrowserDb } from '../lib/supabase-browser';

type Fields = { title: string; description: string; categoryId: string; priority: Priority; location: string };
type FieldErrors = Partial<Record<keyof Fields, string>>;

const SEARCH_DELAY_MS = 300;
const photoTypes: readonly string[] = PHOTO_MIME_TYPES;

export function TicketForm({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const clientRequestId = useRef(crypto.randomUUID());
  const busy = useRef(false);
  const [fields, setFields] = useState<Fields>({ title: '', description: '', categoryId: '', priority: 'normal', location: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [equipmentQuery, setEquipmentQuery] = useState('');
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [matches, setMatches] = useState<Equipment[]>([]);
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState(false);

  useEffect(() => {
    const q = equipmentQuery.trim();
    setMatches([]);
    if (!q || equipment) return;
    let live = true;
    const timer = setTimeout(() => {
      listEquipment(createBrowserDb(), { q }).then(
        (rows) => live && setMatches(rows),
        () => live && setMatches([]),
      );
    }, SEARCH_DELAY_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [equipmentQuery, equipment]);

  const set = (name: keyof Fields) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setFields((f) => ({ ...f, [name]: e.target.value }));

  const describe = (name: keyof Fields) =>
    errors[name] ? { 'aria-invalid': true, 'aria-describedby': `${name}-error` } : {};

  function pickEquipment(e: Equipment) {
    setEquipment(e);
    setEquipmentQuery(`${e.assetTag} ${e.name}`);
    const location = e.installLocation;
    if (location) setFields((f) => ({ ...f, location }));
  }

  function addPhotos(e: ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])];
    e.target.value = '';
    if (photos.length + files.length > MAX_PHOTOS) return setPhotoError(`แนบรูปได้ไม่เกิน ${MAX_PHOTOS} รูป`);
    if (files.some((f) => !photoTypes.includes(f.type) || f.size > MAX_PHOTO_BYTES)) {
      return setPhotoError('รูปต้องเป็น JPEG, PNG หรือ WebP และไม่เกิน 5 MB');
    }
    setPhotoError(null);
    setPhotos((p) => [...p, ...files]);
  }

  async function uploadPhotos(t: Ticket) {
    const db = createBrowserDb();
    const failed: File[] = [];
    for (const f of photos) {
      try {
        await attachPhoto(db, t.id, { data: f, mime: f.type, size: f.size, name: f.name });
      } catch {
        failed.push(f);
      }
    }
    setPhotos(failed);
    if (failed.length === 0) router.push('/tickets');
  }

  async function run(step: () => Promise<void>) {
    if (busy.current) return;
    busy.current = true;
    setSending(true);
    try {
      await step();
    } finally {
      busy.current = false;
      setSending(false);
    }
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy.current) return;
    const parsed = createTicketSchema.safeParse({
      ...fields,
      categoryId: Number(fields.categoryId),
      equipmentId: equipment?.id ?? null,
      clientRequestId: clientRequestId.current,
    });
    if (!parsed.success) {
      const found: FieldErrors = {};
      for (const issue of parsed.error.issues) found[issue.path[0] as keyof Fields] ??= issue.message;
      return setErrors(found);
    }
    setErrors({});
    void run(async () => {
      setSubmitError(false);
      let created: Ticket;
      try {
        created = await createTicket(createBrowserDb(), parsed.data);
      } catch {
        return setSubmitError(true);
      }
      setTicket(created);
      await uploadPhotos(created);
    });
  }

  const uploadFailed = ticket !== null && photos.length > 0 && !sending;

  return (
    <form className="panel" onSubmit={submit} noValidate>
      <fieldset className="form-grid" disabled={ticket !== null}>
        <div className="field full">
          <label htmlFor="title">หัวข้อ</label>
          <input id="title" value={fields.title} onChange={set('title')} {...describe('title')} />
          {errors.title && <p id="title-error" className="field-error">{errors.title}</p>}
        </div>

        <div className="field full">
          <label htmlFor="description">รายละเอียด</label>
          <textarea id="description" rows={4} value={fields.description} onChange={set('description')} {...describe('description')} />
          {errors.description && <p id="description-error" className="field-error">{errors.description}</p>}
        </div>

        <div className="field">
          <label htmlFor="categoryId">หมวดหมู่</label>
          <select id="categoryId" value={fields.categoryId} onChange={set('categoryId')} {...describe('categoryId')}>
            <option value="">เลือกหมวดหมู่</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {errors.categoryId && <p id="categoryId-error" className="field-error">{errors.categoryId}</p>}
        </div>
        <div className="field">
          <label htmlFor="priority">ความเร่งด่วน</label>
          <select id="priority" value={fields.priority} onChange={set('priority')}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
        </div>

        <div className="field full">
          <label htmlFor="equipment">อุปกรณ์ (ไม่บังคับ)</label>
          <input
            id="equipment"
            placeholder="ค้นด้วยรหัสทรัพย์สินหรือชื่อ"
            autoComplete="off"
            value={equipmentQuery}
            onChange={(e) => {
              setEquipmentQuery(e.target.value);
              setEquipment(null);
            }}
          />
          {matches.length > 0 && (
            <ul className="matches">
              {matches.map((m) => (
                <li key={m.id}>
                  <button type="button" onClick={() => pickEquipment(m)}>
                    <strong>{m.assetTag}</strong> {m.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="field full">
          <label htmlFor="location">สถานที่</label>
          <input id="location" value={fields.location} onChange={set('location')} {...describe('location')} />
          {errors.location && <p id="location-error" className="field-error">{errors.location}</p>}
        </div>

        <div className="field full">
          <label htmlFor="photos">รูป</label>
          <input
            id="photos"
            type="file"
            multiple
            accept={PHOTO_MIME_TYPES.join(',')}
            onChange={addPhotos}
            aria-describedby="photos-hint"
          />
          <p id="photos-hint" className="field-hint">
            ไม่เกิน {MAX_PHOTOS} รูป รูปละไม่เกิน 5 MB (JPEG, PNG, WebP)
          </p>
          {photoError && <p className="field-error" role="alert">{photoError}</p>}
          {photos.length > 0 && (
            <ul className="photos">
              {photos.map((f, i) => (
                <li key={`${f.name}-${i}`}>
                  <span>{f.name}</span>
                  <button type="button" className="button button-secondary" aria-label={`ลบรูป ${f.name}`} onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}>
                    ลบ
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </fieldset>

      {submitError && <p className="alert alert-error" role="alert">ส่งใบแจ้งซ่อมไม่สำเร็จ กรุณาลองอีกครั้ง</p>}

      {uploadFailed ? (
        <div className="alert alert-warning" role="alert">
          <p>สร้างใบแจ้งซ่อมแล้ว แต่อัปโหลดรูปไม่สำเร็จ</p>
          <div className="actions">
            <button type="button" className="button" onClick={() => void run(() => uploadPhotos(ticket))}>
              ลองอัปโหลดรูปอีกครั้ง
            </button>
            <Link href="/tickets">ไปที่รายการใบแจ้งซ่อม</Link>
          </div>
        </div>
      ) : (
        <div className="form-footer">
          <button type="submit" className="button" disabled={sending || ticket !== null} aria-busy={sending}>
            ส่งใบแจ้งซ่อม
          </button>
        </div>
      )}
    </form>
  );
}
