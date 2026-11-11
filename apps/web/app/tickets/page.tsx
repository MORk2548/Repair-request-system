import { listTickets } from '@repair/api';
import Link from 'next/link';
import { TicketTable } from '../../components/TicketTable';
import { createServerDb } from '../../lib/supabase-server';

export default async function TicketsPage({ searchParams }: { searchParams: Promise<{ cursor?: string }> }) {
  const { cursor } = await searchParams;
  const { items, nextCursor } = await listTickets(await createServerDb(), cursor ? { cursor } : {});

  return (
    <div className="stack">
      <div className="row between">
        <h1>ใบแจ้งซ่อม</h1>
        <Link href="/tickets/new" className="button primary">
          แจ้งซ่อม
        </Link>
      </div>
      <TicketTable items={items} />
      <nav className="row between">
        {cursor ? <Link href="/tickets">หน้าแรก</Link> : <span />}
        {nextCursor && <Link href={`/tickets?cursor=${encodeURIComponent(nextCursor)}`}>ถัดไป</Link>}
      </nav>
    </div>
  );
}
