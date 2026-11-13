import { PRIORITY_LABELS, STATUS_LABELS, formatThaiDateTime, type Ticket } from '@repair/core';
import Link from 'next/link';

export function TicketTable({ items }: { items: Ticket[] }) {
  if (items.length === 0) return <p className="panel empty">ยังไม่มีใบแจ้งซ่อม</p>;
  return (
    <div className="table-wrap ticket-table">
      <table>
        <thead>
          <tr>
            <th>เลขที่</th>
            <th>หัวข้อ</th>
            <th>สถานะ</th>
            <th>ความเร่งด่วน</th>
            <th>วันที่แจ้ง</th>
          </tr>
        </thead>
        <tbody>
          {items.map((t) => (
            <tr key={t.id}>
              <td className="nowrap">
                <Link href={`/tickets/${t.id}`}>{t.ticketNo}</Link>
              </td>
              <td className="ticket-subject">{t.title}</td>
              <td>
                <span className={`status status-${t.status}`}>{STATUS_LABELS[t.status]}</span>
              </td>
              <td className="priority-cell">
                {t.priority === 'urgent' ? <span className="priority priority-urgent">{PRIORITY_LABELS.urgent}</span> : PRIORITY_LABELS[t.priority]}
              </td>
              <td className="nowrap date-cell">{formatThaiDateTime(t.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
