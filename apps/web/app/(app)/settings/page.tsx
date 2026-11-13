import { cookies } from 'next/headers';
import { SettingsForm } from '../../../components/SettingsForm';
import { parsePreferences } from '../../../lib/preferences';

export default async function SettingsPage() {
  return (
    <>
      <header className="page-head">
        <div className="eyebrow">บัญชีของฉัน</div>
        <h1>ตั้งค่า</h1>
        <p>เลือกโหมดการแสดงผลและขนาดตัวอักษรที่อ่านสบาย</p>
      </header>
      <SettingsForm current={parsePreferences(await cookies())} />
    </>
  );
}
