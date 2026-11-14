'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { createBrowserDb } from '../lib/supabase-browser';

// renders nothing; a new notification row for this user makes the server layout recount the unread badge
export function NotificationBell({ userId }: { userId: string }) {
  const router = useRouter();
  useEffect(() => {
    const db = createBrowserDb();
    const channel = db
      .channel(`notifications:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, () => router.refresh())
      .subscribe();
    return () => {
      void db.removeChannel(channel);
    };
  }, [userId, router]);
  return null;
}
