'use client';

import { deleteTicket } from '@repair/api';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createBrowserDb } from '../lib/supabase-browser';

export function DeleteTicket({ ticketId, ticketNo }: { ticketId: string; ticketNo: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function remove() {
    setPending(true);
    setFailed(false);
    try {
      await deleteTicket(createBrowserDb(), ticketId);
      router.replace('/tickets');
      router.refresh();
    } catch {
      setFailed(true);
      setPending(false);
    }
  }

  return (
    <section className="panel" aria-labelledby="delete-heading">
      <h2 id="delete-heading">ลบใบแจ้งซ่อม</h2>
      {confirming ? (
        <>
          <p role="alert" className="alert alert-warning">
            ลบใบ {ticketNo} ถาวร พร้อมรูป ประวัติ และความคิดเห็นทั้งหมด กู้คืนไม่ได้ และจะหายจากรายงานสรุปด้วย
          </p>
          <div className="actions">
            <button type="button" className="button button-danger" disabled={pending} aria-busy={pending} onClick={remove}>
              ยืนยันลบ {ticketNo}
            </button>
            <button type="button" className="button button-secondary" disabled={pending} onClick={() => setConfirming(false)}>
              ยกเลิก
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="muted">ใช้กับใบที่แจ้งผิดหรือแจ้งซ้ำ ถ้างานไม่ต้องทำแล้วแต่อยากเก็บประวัติไว้ ให้ยกเลิกใบแทน</p>
          <button type="button" className="button button-danger" onClick={() => setConfirming(true)}>
            ลบใบแจ้งซ่อม
          </button>
        </>
      )}
      {failed && (
        <p role="alert" className="alert alert-error">
          ลบใบไม่สำเร็จ กรุณาลองอีกครั้ง
        </p>
      )}
    </section>
  );
}
