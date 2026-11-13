import { ForbiddenTransitionError, VersionConflictError, reassignTicket, transitionTicket, type Db, type Technician } from '@repair/api';
import { resolutionSchema, ticketActions, type Role, type Ticket, type TicketAction } from '@repair/core';
import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { db } from '../lib/supabase';
import { Alert, Button, Choices, Field, styles } from './ui';

type Panel = 'idle' | 'assign' | 'done' | 'reassign' | 'cancel' | 'conflict';
type FieldName = 'assignee' | 'resolution' | 'reason';

// the same panels and messages as the web StatusActions
export function StatusActions({
  ticket,
  user,
  technicians,
  onChanged,
  onLeave,
}: {
  ticket: Ticket;
  user: { id: string; role: Role };
  technicians: Technician[];
  onChanged: () => void;
  onLeave: () => void;
}) {
  const busy = useRef(false);
  const [panel, setPanel] = useState<Panel>('idle');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [assignee, setAssignee] = useState<string | null>(null);
  const [resolution, setResolution] = useState('');
  const [reason, setReason] = useState('');

  const base = { ticketId: ticket.id, expectedVersion: ticket.version };
  const actions = ticketActions(ticket, user);

  async function run(call: (db: Db) => Promise<unknown>, after = onChanged) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      await call(db);
      setPanel('idle');
      after();
    } catch (e) {
      if (e instanceof VersionConflictError) setPanel('conflict');
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
    if (a.kind === 'reassign') return open('reassign');
    if (a.needs === 'assignee') return open('assign');
    if (a.needs === 'resolution') return open('done');
    if (a.to === 'cancelled') return open('cancel');
    void run((db) => transitionTicket(db, { ...base, to: a.to }));
  }

  function submit() {
    if (busy.current) return;
    const found: Partial<Record<FieldName, string>> = {};
    if ((panel === 'assign' || panel === 'reassign') && !assignee) found.assignee = 'กรุณาเลือกช่าง';
    if (panel === 'reassign' && reason.trim() === '') found.reason = 'กรุณากรอกเหตุผล';
    const parsedResolution = resolutionSchema.safeParse(resolution);
    if (panel === 'done' && !parsedResolution.success) found.resolution = parsedResolution.error.issues[0]!.message;
    setFieldErrors(found);
    if (Object.keys(found).length > 0) return;

    if (panel === 'assign' && assignee) void run((db) => transitionTicket(db, { ...base, to: 'assigned', assigneeId: assignee }));
    if (panel === 'done' && parsedResolution.success) void run((db) => transitionTicket(db, { ...base, to: 'done', resolution: parsedResolution.data }));
    // a technician who hands the ticket over can no longer see it
    if (panel === 'reassign' && assignee) {
      void run((db) => reassignTicket(db, { ...base, assigneeId: assignee, reason: reason.trim() }), user.role === 'technician' ? onLeave : onChanged);
    }
  }

  const technicianChoices = (label: string, options: Technician[]) => (
    <Choices label={label} options={options.map((t) => ({ value: t.id, label: t.displayName }))} value={assignee} onChange={setAssignee} error={fieldErrors.assignee} />
  );

  if (actions.length === 0) return null;

  return (
    <View accessibilityLabel="จัดการใบแจ้งซ่อม" style={{ gap: 12 }}>
      {panel === 'conflict' ? (
        <View style={styles.notice}>
          <Alert>มีผู้อื่นอัปเดตใบนี้แล้ว กรุณาโหลดใหม่</Alert>
          <Button label="โหลดใหม่" onPress={onChanged} />
        </View>
      ) : panel === 'idle' ? (
        <View style={styles.row}>
          {actions.map((a) => (
            <Button
              key={a.kind === 'transition' ? a.to : a.kind}
              label={a.label}
              kind={a.kind === 'transition' && a.to === 'cancelled' ? 'secondary' : 'primary'}
              disabled={pending}
              onPress={() => choose(a)}
            />
          ))}
        </View>
      ) : panel === 'cancel' ? (
        <View style={{ gap: 8 }}>
          <Text style={styles.label}>ยืนยันยกเลิกใบแจ้งซ่อม {ticket.ticketNo} หรือไม่</Text>
          <View style={styles.row}>
            <Button label="ยืนยันยกเลิกใบแจ้ง" disabled={pending} onPress={() => void run((db) => transitionTicket(db, { ...base, to: 'cancelled' }))} />
            <Button kind="secondary" label="ไม่ยกเลิก" disabled={pending} onPress={() => open('idle')} />
          </View>
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          {panel === 'assign' && technicianChoices('ช่าง', technicians)}
          {panel === 'reassign' && (
            <>
              {technicianChoices(
                'ช่างคนใหม่',
                technicians.filter((t) => t.id !== ticket.assigneeId),
              )}
              <Field label="เหตุผล" value={reason} onChangeText={setReason} error={fieldErrors.reason} multiline style={{ minHeight: 80, textAlignVertical: 'top' }} />
            </>
          )}
          {panel === 'done' && (
            <Field label="วิธีแก้ไข" value={resolution} onChangeText={setResolution} error={fieldErrors.resolution} multiline style={{ minHeight: 100, textAlignVertical: 'top' }} />
          )}
          <View style={styles.row}>
            <Button label="ยืนยัน" disabled={pending} onPress={submit} />
            <Button kind="secondary" label="ย้อนกลับ" disabled={pending} onPress={() => open('idle')} />
          </View>
        </View>
      )}
      {error ? <Alert>{error}</Alert> : null}
    </View>
  );
}
