import { getTicket, listTechnicians } from '@repair/api';
import { PRIORITY_LABELS, STATUS_LABELS, eventLabel, formatThaiDateTime } from '@repair/core';
import { notFound } from 'next/navigation';
import { CommentList } from '../../../../components/CommentList';
import { StatusActions } from '../../../../components/StatusActions';
import { getSession } from '../../../../lib/session';

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, user, role } = await getSession();
  const [ticket, technicians] = await Promise.all([getTicket(db, id), role === 'reporter' ? [] : listTechnicians(db)]);
  if (!ticket) notFound();
  const { people } = ticket;
  const name = (personId: string | null) => (personId ? (people[personId] ?? 'ไม่ทราบชื่อ') : '-');

  return (
    <div className="stack">
      <div className="stack tight">
        <p className="hint">{ticket.ticketNo}</p>
        <div className="row">
          <h1>{ticket.title}</h1>
          <span className={`badge status-${ticket.status}`}>{STATUS_LABELS[ticket.status]}</span>
        </div>
      </div>

      {/* keyed by version so a refresh after any change starts the panel fresh */}
      <StatusActions key={ticket.version} ticket={ticket} user={{ id: user.id, role }} technicians={technicians} />

      <section className="card">
        <dl className="details">
          <dt>ความเร่งด่วน</dt>
          <dd className={ticket.priority === 'urgent' ? 'urgent' : undefined}>{PRIORITY_LABELS[ticket.priority]}</dd>
          <dt>หมวดหมู่</dt>
          <dd>{ticket.categoryName ?? '-'}</dd>
          {ticket.equipment && (
            <>
              <dt>อุปกรณ์</dt>
              <dd>
                {ticket.equipment.assetTag} {ticket.equipment.name}
              </dd>
            </>
          )}
          <dt>สถานที่</dt>
          <dd>{ticket.location}</dd>
          <dt>ผู้แจ้ง</dt>
          <dd>{name(ticket.reporterId)}</dd>
          <dt>ช่างผู้รับผิดชอบ</dt>
          <dd>{name(ticket.assigneeId)}</dd>
          <dt>วันที่แจ้ง</dt>
          <dd>{formatThaiDateTime(ticket.createdAt)}</dd>
          <dt>อัปเดตล่าสุด</dt>
          <dd>{formatThaiDateTime(ticket.updatedAt)}</dd>
          {ticket.resolvedAt && (
            <>
              <dt>วันที่แก้ไขเสร็จ</dt>
              <dd>{formatThaiDateTime(ticket.resolvedAt)}</dd>
            </>
          )}
        </dl>
      </section>

      <section className="stack tight" aria-labelledby="description-heading">
        <h2 id="description-heading">รายละเอียด</h2>
        <p className="body">{ticket.description}</p>
      </section>

      {ticket.resolution && (
        <section className="stack tight" aria-labelledby="resolution-heading">
          <h2 id="resolution-heading">วิธีแก้ไข</h2>
          <p className="body">{ticket.resolution}</p>
        </section>
      )}

      {ticket.photos.length > 0 && (
        <section className="stack tight" aria-labelledby="photos-heading">
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
        </section>
      )}

      <section className="stack tight" aria-labelledby="timeline-heading">
        <h2 id="timeline-heading">ประวัติ</h2>
        <ol className="timeline">
          {ticket.events.map((e) => (
            <li key={e.id}>
              <p className="meta">
                <strong>{eventLabel(e)}</strong> โดย {name(e.actorId)} <time dateTime={e.createdAt}>{formatThaiDateTime(e.createdAt)}</time>
              </p>
              {e.action === 'reassigned' && e.detail && <p className="body">เหตุผล: {e.detail}</p>}
              {e.action === 'status' && e.toStatus === 'done' && e.detail && <p className="body">วิธีแก้ไข: {e.detail}</p>}
            </li>
          ))}
        </ol>
      </section>

      <CommentList ticketId={ticket.id} comments={ticket.comments} people={people} />
    </div>
  );
}
