import { listCategories, listDepartments } from '@repair/api';
import { LookupForm, LookupRow } from '../../../../components/LookupRow';
import { getSession } from '../../../../lib/session';

export default async function AdminListsPage() {
  const { db } = await getSession();
  const [departments, categories] = await Promise.all([listDepartments(db, { includeInactive: true }), listCategories(db, { includeInactive: true })]);

  return (
    <div className="stack">
      <h1>แผนกและหมวด</h1>
      <p className="hint">รายการที่ปิดใช้งานจะไม่แสดงให้เลือกในฟอร์ม แต่ใบแจ้งซ่อมเดิมยังแสดงชื่อได้ จึงไม่มีการลบ</p>

      <section className="stack" aria-labelledby="departments">
        <h2 id="departments">แผนก</h2>
        <div className="card">
          <LookupForm kind="department" />
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ชื่อ</th>
                <th>สถานะ</th>
                <th>
                  <span className="visually-hidden">จัดการ</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {departments.map((d) => (
                <LookupRow key={d.id} kind="department" item={d} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="stack" aria-labelledby="categories">
        <h2 id="categories">หมวดหมู่</h2>
        <div className="card">
          <LookupForm kind="category" />
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ชื่อ</th>
                <th>ลำดับ</th>
                <th>สถานะ</th>
                <th>
                  <span className="visually-hidden">จัดการ</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <LookupRow key={c.id} kind="category" item={c} />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
