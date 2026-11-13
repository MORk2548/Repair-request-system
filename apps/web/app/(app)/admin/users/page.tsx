import { adminListUsers, listDepartments } from '@repair/api';
import { InviteUserForm } from '../../../../components/InviteUserForm';
import { UserRow } from '../../../../components/UserRow';
import { getSession } from '../../../../lib/session';

export default async function AdminUsersPage() {
  const { db, user } = await getSession();
  const [users, departments] = await Promise.all([adminListUsers(db), listDepartments(db, { includeInactive: true })]);

  return (
    <div className="stack">
      <header className="page-head">
        <div className="eyebrow">ผู้ดูแลระบบ</div>
        <h1>ผู้ใช้</h1>
        <p>เชิญผู้ใช้ใหม่ทางอีเมล แก้บทบาทและแผนก หรือปิดใช้งานบัญชี</p>
      </header>
      <InviteUserForm departments={departments.filter((d) => d.isActive)} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ชื่อ</th>
              <th>อีเมล</th>
              <th>บทบาท</th>
              <th>แผนก</th>
              <th>สถานะ</th>
              <th>
                <span className="visually-hidden">จัดการ</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <UserRow key={u.id} user={u} departments={departments} isSelf={u.id === user.id} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
