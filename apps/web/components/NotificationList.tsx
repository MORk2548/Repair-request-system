'use client';

import { markNotificationsRead, type Notification } from '@repair/api';
import { formatThaiDateTime, messageFor } from '@repair/core';
import { useRouter } from 'next/navigation';
import { createBrowserDb } from '../lib/supabase-browser';
import { ActionError, useAction } from './useAction';

export function NotificationList({ items }: { items: Notification[] }) {
  const router = useRouter();
  const all = useAction();
  const unread = items.some((n) => !n.readAt);

  async function open(n: Notification) {
    // failing to mark it read must not keep the user from the ticket
    if (!n.readAt) await markNotificationsRead(createBrowserDb(), { ids: [n.id] }).catch(() => {});
    router.push(`/tickets/${n.ticketId}`);
    // the badge lives in the layout, which a soft navigation does not re-render
    router.refresh();
  }

  if (items.length === 0) return <p className="panel">ยังไม่มีการแจ้งเตือน</p>;

  return (
    <section className="panel" aria-label="รายการแจ้งเตือน">
      {unread && (
        <div className="notification-tools">
          <button type="button" className="button button-secondary" disabled={all.pending} onClick={() => all.run((db) => markNotificationsRead(db, 'all'))}>
            อ่านทั้งหมด
          </button>
        </div>
      )}
      <ActionError error={all.error} />
      <ul className="notification-list">
        {items.map((n) => {
          const m = messageFor(n.toStatus, n.ticketNo);
          return (
            <li key={n.id}>
              <button type="button" className={n.readAt ? 'notification' : 'notification notification-unread'} onClick={() => open(n)}>
                <strong>{m.title}</strong>
                {!n.readAt && <span className="visually-hidden"> (ยังไม่อ่าน)</span>}
                <span className="notification-body">
                  {m.body} · {n.title}
                </span>
                <time className="when" dateTime={n.createdAt}>
                  {formatThaiDateTime(n.createdAt)}
                </time>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
