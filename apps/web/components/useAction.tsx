'use client';

import { AdminError, type Db } from '@repair/api';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { createBrowserDb } from '../lib/supabase-browser';

// one call at a time; refreshes the server page on success. handle(e) returns true when the caller showed the error itself
export function useAction() {
  const router = useRouter();
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(call: (db: Db) => Promise<unknown>, handle?: (e: unknown) => boolean): Promise<boolean> {
    if (busy.current) return false;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      await call(createBrowserDb());
      router.refresh();
      return true;
    } catch (e) {
      if (!handle?.(e)) setError(e instanceof AdminError ? e.message : 'ทำรายการไม่สำเร็จ กรุณาลองอีกครั้ง');
      return false;
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return { pending, error, setError, run };
}

export function ActionError({ error }: { error: string | null }) {
  return error ? (
    <p className="alert alert-error" role="alert">
      {error}
    </p>
  ) : null;
}
