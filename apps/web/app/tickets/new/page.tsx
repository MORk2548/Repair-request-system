import { listCategories } from '@repair/api';
import { TicketForm } from '../../../components/TicketForm';
import { createServerDb } from '../../../lib/supabase-server';

export default async function NewTicketPage() {
  const categories = await listCategories(await createServerDb());
  return (
    <div className="stack">
      <h1>แจ้งซ่อม</h1>
      <TicketForm categories={categories} />
    </div>
  );
}
