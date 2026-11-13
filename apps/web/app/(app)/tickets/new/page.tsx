import { listCategories } from '@repair/api';
import { TicketForm } from '../../../../components/TicketForm';
import { createServerDb } from '../../../../lib/supabase-server';

export default async function NewTicketPage() {
  const categories = await listCategories(await createServerDb());
  return (
    <>
      <header className="page-head">
        <div className="eyebrow">ระบบแจ้งซ่อม</div>
        <h1>แจ้งซ่อม</h1>
        <p>บอกอาการและสถานที่ให้ช่างหาเจอ แนบรูปได้ถ้ามี</p>
      </header>
      <TicketForm categories={categories} />
    </>
  );
}
