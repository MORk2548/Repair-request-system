import Link from 'next/link';

export default function TicketNotFound() {
  return (
    <div className="panel empty stack">
      <h1>ไม่พบใบแจ้งซ่อมนี้</h1>
      <p>ใบแจ้งซ่อมอาจถูกลบ หรือคุณไม่มีสิทธิ์ดูใบนี้</p>
      <p>
        <Link href="/tickets">กลับไปที่รายการใบแจ้งซ่อม</Link>
      </p>
    </div>
  );
}
