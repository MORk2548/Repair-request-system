'use client';

import { ForbiddenTransitionError, VersionConflictError, reassignTicket, transitionTicket, type Db, type Technician } from '@repair/api';
import { resolutionSchema, ticketActions, type Role, type Ticket, type TicketAction } from '@repair/core';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { createBrowserDb } from '../lib/supabase-browser';

type Panel = { kind: 'idle' } | { kind: 'assign' } | { kind: 'done' } | { kind: 'reassign' } | { kind: 'cancel' } | { kind: 'conflict' };
type Field = 'assignee' | 'resolution' | 'reason';

const idle: Panel = { kind: 'idle' };

export function StatusActions({
  ticket,
  user,
  technicians,
}: {
  ticket: Ticket;
  user: { id: string; role: Role };
  technicians: Technician[];
}) {
  const router = useRouter();
  const busy = useRef(false);
  const [panel, setPanel] = useState<Panel>(idle);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({});
  const [assignee, setAssignee] = useState('');
  const [resolution, setResolution] = useState('');
  const [reason, setReason] = useState('');

  const base = { ticketId: ticket.id, expectedVersion: ticket.version };
  const actions = ticketActions(ticket, user);

  async function run(call: (db: Db) => Promise<unknown>, after: () => void = () => router.refresh()) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      await call(createBrowserDb());
      setPanel(idle);
      after();
    } catch (e) {
      if (e instanceof VersionConflictError) setPanel({ kind: 'conflict' });
      else setError(e instanceof ForbiddenTransitionError ? 'คุณไม่มีสิทธิ์ทำรายการนี้' : 'ทำรายการไม่สำเร็จ กรุณาลองอีกครั้ง');
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  function open(next: Panel) {
    setFieldErrors({});
    setError(null);
    setPanel(next);
  }

  function choose(a: TicketAction) {
    if (a.kind === 'take') return void run((db) => transitionTicket(db, { ...base, to: 'assigned', assigneeId: user.id }));
    if (a.kind === 'reassign') return open({ kind: 'reassign' });
    if (a.needs === 'assignee') return open({ kind: 'assign' });
    if (a.needs === 'resolution') return open({ kind: 'done' });
    if (a.to === 'cancelled') return open({ kind: 'cancel' });
    void run((db) => transitionTicket(db, { ...base, to: a.to }));
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy.current) return;
    const found: Partial<Record<Field, string>> = {};
    if (panel.kind === 'assign' || panel.kind === 'reassign') {
      if (!assignee) found.assignee = 'กรุณาเลือกช่าง';
    }
    if (panel.kind === 'reassign' && reason.trim() === '') found.reason = 'กรุณากรอกเหตุผล';
    const parsedResolution = resolutionSchema.safeParse(resolution);
    if (panel.kind === 'done' && !parsedResolution.success) found.resolution = parsedResolution.error.issues[0]!.message;
    setFieldErrors(found);
    if (Object.keys(found).length > 0) return;

    if (panel.kind === 'assign') void run((db) => transitionTicket(db, { ...base, to: 'assigned', assigneeId: assignee }));
    if (panel.kind === 'done') void run((db) => transitionTicket(db, { ...base, to: 'done', resolution: parsedResolution.data! }));
    if (panel.kind === 'reassign') {
      // a technician who hands the ticket over can no longer see it, so refreshing would land on the not-found page
      const after = user.role === 'technician' ? () => router.push('/tickets') : undefined;
      void run((db) => reassignTicket(db, { ...base, assigneeId: assignee, reason: reason.trim() }), after);
    }
  }

  const describe = (name: Field) => (fieldErrors[name] ? { 'aria-invalid': true, 'aria-describedby': `${name}-error` } : {});
  const fieldError = (name: Field) =>
    fieldErrors[name] && (
      <p id={`${name}-error`} className="error">
        {fieldErrors[name]}
      </p>
    );
  const technicianSelect = (label: string, options: Technician[]) => (
    <div className="field">
      <label htmlFor="assignee">{label}</label>
      <select id="assignee" value={assignee} onChange={(e) => setAssignee(e.target.value)} {...describe('assignee')}>
        <option value="">เลือกช่าง</option>
        {options.map((t) => (
          <option key={t.id} value={t.id}>
            {t.displayName}
          </option>
        ))}
      </select>
      {fieldError('assignee')}
    </div>
  );
  const formButtons = (
    <div className="row">
      <button type="submit" className="primary" disabled={pending}>
        ยืนยัน
      </button>
      <button type="button" disabled={pending} onClick={() => open(idle)}>
        ย้อนกลับ
      </button>
    </div>
  );

  if (actions.length === 0) return null;

  return (
    <section className="card stack" aria-label="จัดการใบแจ้งซ่อม">
      {panel.kind === 'conflict' ? (
        <div className="notice stack" role="alert">
          <p>มีผู้อื่นอัปเดตใบนี้แล้ว กรุณาโหลดใหม่</p>
          <div className="row">
            <button type="button" className="primary" onClick={() => router.refresh()}>
              โหลดใหม่
            </button>
          </div>
        </div>
      ) : panel.kind === 'idle' ? (
        <div className="row">
          {actions.map((a) => (
            <button
              key={a.kind === 'transition' ? a.to : a.kind}
              type="button"
              className={a.kind === 'transition' && a.to === 'cancelled' ? 'danger' : 'primary'}
              disabled={pending}
              aria-busy={pending}
              onClick={() => choose(a)}
            >
              {a.label}
            </button>
          ))}
        </div>
      ) : panel.kind === 'cancel' ? (
        <div className="stack">
          <p>ยืนยันยกเลิกใบแจ้งซ่อม {ticket.ticketNo} หรือไม่</p>
          <div className="row">
            <button type="button" className="danger" disabled={pending} onClick={() => void run((db) => transitionTicket(db, { ...base, to: 'cancelled' }))}>
              ยืนยันยกเลิกใบแจ้ง
            </button>
            <button type="button" disabled={pending} onClick={() => open(idle)}>
              ไม่ยกเลิก
            </button>
          </div>
        </div>
      ) : (
        <form className="stack" onSubmit={submit} noValidate>
          {panel.kind === 'assign' && technicianSelect('ช่าง', technicians)}
          {panel.kind === 'reassign' && (
            <>
              {technicianSelect(
                'ช่างคนใหม่',
                technicians.filter((t) => t.id !== ticket.assigneeId),
              )}
              <div className="field">
                <label htmlFor="reason">เหตุผล</label>
                <textarea id="reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} {...describe('reason')} />
                {fieldError('reason')}
              </div>
            </>
          )}
          {panel.kind === 'done' && (
            <div className="field">
              <label htmlFor="resolution">วิธีแก้ไข</label>
              <textarea id="resolution" rows={4} value={resolution} onChange={(e) => setResolution(e.target.value)} {...describe('resolution')} />
              {fieldError('resolution')}
            </div>
          )}
          {formButtons}
        </form>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
