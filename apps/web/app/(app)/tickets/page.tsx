import { listTickets } from '@repair/api';
import { STATUS_LABELS, TICKET_STATUSES, type TicketStatus } from '@repair/core';
import Link from 'next/link';
import { TicketTable } from '../../../components/TicketTable';
import { getSession } from '../../../lib/session';

type Search = { cursor?: string; tab?: string; status?: string };

const TABS = [
  { tab: 'mine', label: 'งานของฉัน' },
  { tab: 'queue', label: 'คิวใบใหม่' },
] as const;

const HEADS = {
  reporter: { eyebrow: 'ระบบแจ้งซ่อม', title: 'ใบแจ้งซ่อมของฉัน', intro: 'ใบแจ้งซ่อมที่คุณส่ง เรียงจากใบล่าสุด' },
  technician: { eyebrow: 'งานช่าง', title: 'ใบแจ้งซ่อม', intro: 'งานที่ได้รับมอบหมาย และใบใหม่ที่รอช่างรับ' },
  admin: { eyebrow: 'ผู้ดูแลระบบ', title: 'ใบแจ้งซ่อม', intro: 'ใบแจ้งซ่อมทั้งหมด กรองตามสถานะได้' },
};

const href = (params: Record<string, string | undefined>) => {
  const query = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => e[1] !== undefined)).toString();
  return query ? `/tickets?${query}` : '/tickets';
};

export default async function TicketsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { cursor, tab: rawTab, status: rawStatus } = await searchParams;
  const { db, user, role } = await getSession();

  const tab = role === 'technician' ? (rawTab === 'queue' ? 'queue' : 'mine') : undefined;
  const status = role === 'admin' && TICKET_STATUSES.includes(rawStatus as TicketStatus) ? (rawStatus as TicketStatus) : undefined;
  const filter = tab === 'queue' ? { status: 'new' as const } : tab === 'mine' ? { assigneeId: user.id } : status ? { status } : {};
  const { items, nextCursor } = await listTickets(db, { ...filter, ...(cursor ? { cursor } : {}) });
  const keep = { tab, status };
  const head = HEADS[role];

  return (
    <>
      <header className="page-head">
        <div className="eyebrow">{head.eyebrow}</div>
        <h1>{head.title}</h1>
        <p>{head.intro}</p>
      </header>
      {tab && (
        <nav className="admin-tabs" aria-label="มุมมองใบแจ้งซ่อม">
          {TABS.map((t) => (
            <Link key={t.tab} href={href({ tab: t.tab })} aria-current={t.tab === tab ? 'page' : undefined}>
              {t.label}
            </Link>
          ))}
        </nav>
      )}
      {role === 'admin' && (
        <nav className="admin-tabs" aria-label="กรองตามสถานะ">
          <Link href="/tickets" aria-current={status ? undefined : 'page'}>
            ทั้งหมด
          </Link>
          {TICKET_STATUSES.map((s) => (
            <Link key={s} href={href({ status: s })} aria-current={s === status ? 'page' : undefined}>
              {STATUS_LABELS[s]}
            </Link>
          ))}
        </nav>
      )}
      <TicketTable items={items} />
      {(cursor || nextCursor) && (
        <nav className="pager" aria-label="หน้า">
          {cursor && <Link href={href(keep)}>หน้าแรก</Link>}
          {nextCursor && <Link href={href({ ...keep, cursor: nextCursor })}>ถัดไป</Link>}
        </nav>
      )}
    </>
  );
}
