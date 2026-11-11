import { PRIORITY_LABELS, STATUS_LABELS, formatThaiDateTime, type Ticket } from '@repair/core';
import Link from 'next/link';

export function TicketTable({ items }: { items: Ticket[] }) {
  if (items.length === 0) return <p className="empty">ยังไม่มีใบแจ้งซ่อม</p>;
  return (
    <div className="table-wrap">
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
              <td>{t.title}</td>
              <td>
                <span className={`badge status-${t.status}`}>{STATUS_LABELS[t.status]}</span>
              </td>
              <td className={t.priority === 'urgent' ? 'urgent' : undefined}>{PRIORITY_LABELS[t.priority]}</td>
              <td className="nowrap">{formatThaiDateTime(t.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
