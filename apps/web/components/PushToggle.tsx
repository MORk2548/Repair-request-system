'use client';

import { useEffect, useState } from 'react';
import { createBrowserDb } from '../lib/supabase-browser';
import { disablePush, enablePush, readPushState, type PushState } from '../lib/webPush';

const TEXT: Record<PushState, string> = {
  unsupported: 'เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือนขึ้นหน้าจอ',
  'home-screen': 'บน iPhone หรือ iPad ให้กดปุ่มแชร์ เลือก "เพิ่มไปยังหน้าจอโฮม" แล้วเปิดระบบจากไอคอนบนหน้าจอโฮม จากนั้นกลับมาเปิดการแจ้งเตือนที่หน้านี้',
  denied: 'เบราว์เซอร์ปิดสิทธิ์การแจ้งเตือนของเว็บนี้ไว้ เปิดสิทธิ์ได้ในการตั้งค่าเว็บไซต์ของเบราว์เซอร์ แล้วโหลดหน้านี้ใหม่',
  off: 'ยังไม่ได้เปิดบนอุปกรณ์นี้ เปิดแล้วจะได้รับแจ้งเตือนขึ้นหน้าจอแม้ปิดเว็บไปแล้ว',
  on: 'เปิดอยู่บนอุปกรณ์นี้',
};

export function PushToggle() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    readPushState(createBrowserDb()).then(setState, () => setState('off'));
  }, []);

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      const db = createBrowserDb();
      if (state === 'on') {
        await disablePush(db);
        setState('off');
      } else {
        setState(await enablePush(db));
      }
    } catch {
      setError(state === 'on' ? 'ปิดการแจ้งเตือนไม่สำเร็จ ลองใหม่อีกครั้ง' : 'เปิดการแจ้งเตือนไม่สำเร็จ ลองใหม่อีกครั้ง');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel" aria-labelledby="push-heading">
      <h2 id="push-heading">แจ้งเตือนขึ้นหน้าจอ</h2>
      {state === null ? (
        <p className="muted">กำลังตรวจสอบ…</p>
      ) : (
        <>
          <p>{TEXT[state]}</p>
          {(state === 'off' || state === 'on') && (
            <button type="button" className={state === 'on' ? 'button button-secondary' : 'button'} disabled={busy} onClick={toggle}>
              {state === 'on' ? 'ปิดการแจ้งเตือน' : 'เปิดการแจ้งเตือน'}
            </button>
          )}
        </>
      )}
      {error && (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
