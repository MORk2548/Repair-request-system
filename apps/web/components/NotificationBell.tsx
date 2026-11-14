'use client';

import type { RealtimeChannel } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { createBrowserDb } from '../lib/supabase-browser';

// renders nothing; any change to this user's notifications (a new one, or one read here or in another tab)
// makes the server layout recount the unread badge
export function NotificationBell({ userId }: { userId: string }) {
  const router = useRouter();
  useEffect(() => {
    const db = createBrowserDb();
    let channel: RealtimeChannel | undefined;
    let unmounted = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // "อ่านทั้งหมด" sends one event per row; refresh once for the burst
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 300);
    };
    // without the user's token the socket joins as anon, and RLS on notifications drops every event
    void db.realtime.setAuth().then(() => {
      if (unmounted) return;
      channel = db
        .channel(`notifications:${userId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, refresh)
        .subscribe();
    });
    return () => {
      unmounted = true;
      clearTimeout(timer);
      if (channel) void db.removeChannel(channel);
    };
  }, [userId, router]);
  return null;
}
