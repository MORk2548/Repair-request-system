import { listNotifications } from '@repair/api';
import { NotificationList } from '../../../components/NotificationList';
import { getSession } from '../../../lib/session';

export default async function NotificationsPage() {
  const { db } = await getSession();
  const items = await listNotifications(db);
  return (
    <>
      <header className="page-head">
        <div className="eyebrow">ระบบแจ้งซ่อม</div>
        <h1>การแจ้งเตือน</h1>
        <p>ความเคลื่อนไหวของใบแจ้งซ่อมที่เกี่ยวกับคุณ 30 รายการล่าสุด</p>
      </header>
      <NotificationList items={items} />
    </>
  );
}
