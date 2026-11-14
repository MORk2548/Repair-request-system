import { getTicket, listTechnicians, markNotificationsRead } from '@repair/api';
import { PRIORITY_LABELS, STATUS_LABELS, eventLabel, formatThaiDateTime } from '@repair/core';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { CommentList } from '../../../../components/CommentList';
import { DeleteTicket } from '../../../../components/DeleteTicket';
import { StatusActions } from '../../../../components/StatusActions';
import { getSession } from '../../../../lib/session';

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, user, role } = await getSession();
  const [ticket, technicians] = await Promise.all([
    getTicket(db, id),
    role === 'reporter' ? [] : listTechnicians(db),
    // opening the ticket reads its notifications; a failure here must not break the page
    markNotificationsRead(db, { ticketId: id }).catch(() => {}),
  ]);
  if (!ticket) notFound();
  const { people } = ticket;
  const name = (personId: string | null) => (personId ? (people[personId] ?? 'ไม่ทราบชื่อ') : '-');
  const item = (label: string, value: ReactNode) => (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );

  return (
    <div className="stack">
      <p>
        <Link href="/tickets">กลับไปที่รายการใบแจ้งซ่อม</Link>
      </p>

      <article className="panel">
        <div className="detail-head">
          <span className="ticket-code">{ticket.ticketNo}</span>
          <span className={`status status-${ticket.status}`}>{STATUS_LABELS[ticket.status]}</span>
        </div>
        <h1>{ticket.title}</h1>
        <dl className="detail-grid">
          {item(
            'ความเร่งด่วน',
            ticket.priority === 'urgent' ? <span className="priority priority-urgent">{PRIORITY_LABELS.urgent}</span> : PRIORITY_LABELS[ticket.priority],
          )}
          {item('หมวดหมู่', ticket.categoryName ?? '-')}
          {ticket.equipment && item('อุปกรณ์', `${ticket.equipment.assetTag} ${ticket.equipment.name}`)}
          {item('สถานที่', ticket.location)}
          {item('ผู้แจ้ง', name(ticket.reporterId))}
          {item('ช่างผู้รับผิดชอบ', name(ticket.assigneeId))}
          {item('วันที่แจ้ง', formatThaiDateTime(ticket.createdAt))}
          {item('อัปเดตล่าสุด', formatThaiDateTime(ticket.updatedAt))}
          {ticket.resolvedAt && item('วันที่แก้ไขเสร็จ', formatThaiDateTime(ticket.resolvedAt))}
        </dl>

        <section aria-labelledby="description-heading">
          <h2 id="description-heading">รายละเอียด</h2>
          <p className="description">{ticket.description}</p>
        </section>

        {ticket.resolution && (
          <section className="article-section" aria-labelledby="resolution-heading">
            <h2 id="resolution-heading">วิธีแก้ไข</h2>
            <p className="description">{ticket.resolution}</p>
          </section>
        )}

        {ticket.photos.length > 0 && (
          <section className="article-section" aria-labelledby="photos-heading">
            <h2 id="photos-heading">รูปถ่าย</h2>
            <ul className="gallery">
              {ticket.photos.map((p, i) => (
                <li key={p.id}>
                  <a href={p.url} target="_blank" rel="noreferrer">
                    <img src={p.url} alt={`รูปที่ ${i + 1} ของใบ ${ticket.ticketNo} (เปิดขนาดเต็ม)`} />
                  </a>
                </li>
              ))}
            </ul>
            {ticket.status === 'closed' && <p className="muted">รูปจะถูกลบอัตโนมัติเมื่อปิดงานครบ 1 เดือน</p>}
          </section>
        )}
      </article>

      {/* keyed by version so a refresh after any change starts the panel fresh */}
      <StatusActions key={ticket.version} ticket={ticket} user={{ id: user.id, role }} technicians={technicians} />

      <section className="panel" aria-labelledby="timeline-heading">
        <h2 id="timeline-heading">ประวัติ</h2>
        <ol className="timeline">
          {ticket.events.map((e) => (
            <li key={e.id}>
              <strong>{eventLabel(e)}</strong>
              <div className="when">
                {name(e.actorId)} · <time dateTime={e.createdAt}>{formatThaiDateTime(e.createdAt)}</time>
              </div>
              {e.action === 'reassigned' && e.detail && <p className="note">เหตุผล: {e.detail}</p>}
              {e.action === 'status' && e.toStatus === 'done' && e.detail && <p className="note">วิธีแก้ไข: {e.detail}</p>}
            </li>
          ))}
        </ol>
      </section>

      <CommentList ticketId={ticket.id} comments={ticket.comments} people={people} />

      {role === 'admin' && <DeleteTicket ticketId={ticket.id} ticketNo={ticket.ticketNo} />}
    </div>
  );
}
