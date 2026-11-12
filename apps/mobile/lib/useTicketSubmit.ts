import { attachPhoto, createTicket } from '@repair/api';
import type { CreateTicketInput, Ticket } from '@repair/core';
import { useRef, useState } from 'react';
import type { PreparedPhoto } from './photos';
import { db } from './supabase';

// create once (same clientRequestId on every retry), then upload photos; failed photos stay for a retry that never creates again
export function useTicketSubmit(onDone: () => void) {
  const clientRequestId = useRef(crypto.randomUUID()).current;
  const busy = useRef(false);
  const [photos, setPhotos] = useState<PreparedPhoto[]>([]);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState(false);

  async function upload(t: Ticket, pending: PreparedPhoto[]) {
    const failed: PreparedPhoto[] = [];
    for (const p of pending) {
      try {
        await attachPhoto(db, t.id, { data: p.data, mime: p.mime, size: p.size, name: p.name });
      } catch {
        failed.push(p);
      }
    }
    setPhotos(failed);
    if (failed.length === 0) onDone();
  }

  async function run(step: () => Promise<void>) {
    if (busy.current) return;
    busy.current = true;
    setSending(true);
    try {
      await step();
    } finally {
      busy.current = false;
      setSending(false);
    }
  }

  const submit = (input: CreateTicketInput) =>
    run(async () => {
      setSubmitError(false);
      let created: Ticket;
      try {
        created = await createTicket(db, input);
      } catch {
        return setSubmitError(true);
      }
      setTicket(created);
      await upload(created, photos);
    });

  const retryUpload = () =>
    run(async () => {
      if (ticket) await upload(ticket, photos);
    });

  return {
    clientRequestId,
    photos,
    setPhotos,
    ticket,
    sending,
    submitError,
    uploadFailed: ticket !== null && photos.length > 0 && !sending,
    submit,
    retryUpload,
  };
}
