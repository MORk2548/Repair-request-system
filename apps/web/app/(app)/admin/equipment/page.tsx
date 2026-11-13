import { listDepartments, listEquipment } from '@repair/api';
import { EquipmentForm, EquipmentRow } from '../../../../components/EquipmentRow';
import { getSession } from '../../../../lib/session';

export default async function AdminEquipmentPage() {
  const { db } = await getSession();
  const [equipment, departments] = await Promise.all([listEquipment(db, { includeInactive: true }), listDepartments(db, { includeInactive: true })]);

  return (
    <div className="stack">
      <header className="page-head">
        <div className="eyebrow">ผู้ดูแลระบบ</div>
        <h1>อุปกรณ์</h1>
      </header>
      <div className="panel">
        <EquipmentForm departments={departments} />
      </div>
      <p className="muted">สถานะ "กำลังซ่อม" และ "ใช้งาน" ปรับเองตามใบแจ้งซ่อมที่กำลังดำเนินการ ส่วน "ปลดระวาง" ตั้งได้ที่นี่เท่านั้น</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>รหัสทรัพย์สิน</th>
              <th>ชื่อ</th>
              <th>หมายเลขเครื่อง</th>
              <th>แผนก</th>
              <th>สถานที่ติดตั้ง</th>
              <th>สถานะ</th>
              <th>
                <span className="visually-hidden">จัดการ</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {equipment.map((e) => (
              <EquipmentRow key={e.id} equipment={e} departments={departments} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
