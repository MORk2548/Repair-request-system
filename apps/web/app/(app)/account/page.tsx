import { getAccount } from '@repair/api';
import { ROLE_LABELS, formatThaiDateTime } from '@repair/core';
import Link from 'next/link';
import { getSession } from '../../../lib/session';

export default async function AccountPage() {
  const { db, user, role } = await getSession();
  const account = await getAccount(db, user.id);
  const item = (label: string, value: string) => (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );

  return (
    <>
      <header className="page-head">
        <div className="eyebrow">บัญชีของฉัน</div>
        <h1>{account?.displayName ?? user.email}</h1>
        <p>ข้อมูลบัญชีของคุณ หากต้องการแก้ไขชื่อ บทบาท หรือแผนก กรุณาติดต่อผู้ดูแลระบบ</p>
      </header>
      <section className="panel">
        <dl className="detail-grid">
          {item('ชื่อที่แสดง', account?.displayName ?? '-')}
          {item('อีเมล', user.email ?? '-')}
          {item('บทบาท', ROLE_LABELS[role])}
          {item('แผนก', account?.departmentName ?? '-')}
          {item('เป็นสมาชิกตั้งแต่', account ? formatThaiDateTime(account.createdAt) : '-')}
          {item('เข้าสู่ระบบล่าสุด', user.last_sign_in_at ? formatThaiDateTime(user.last_sign_in_at) : '-')}
        </dl>
        <p>
          <Link href="/settings">ตั้งค่าการแสดงผล</Link>
        </p>
      </section>
    </>
  );
}
