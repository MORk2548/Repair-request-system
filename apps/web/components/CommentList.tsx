'use client';

import { addComment, type Comment } from '@repair/api';
import { commentSchema, formatThaiDateTime } from '@repair/core';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { createBrowserDb } from '../lib/supabase-browser';

export function CommentList({ ticketId, comments, people }: { ticketId: string; comments: Comment[]; people: Record<string, string> }) {
  const router = useRouter();
  const busy = useRef(false);
  const [body, setBody] = useState('');
  const [invalid, setInvalid] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [sending, setSending] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy.current) return;
    const parsed = commentSchema.safeParse(body);
    if (!parsed.success) return setInvalid(parsed.error.issues[0]!.message);
    setInvalid(null);
    setFailed(false);
    busy.current = true;
    setSending(true);
    try {
      await addComment(createBrowserDb(), ticketId, parsed.data);
      setBody('');
      router.refresh();
    } catch {
      setFailed(true);
    } finally {
      busy.current = false;
      setSending(false);
    }
  }

  return (
    <section className="stack" aria-labelledby="comments-heading">
      <h2 id="comments-heading">ความคิดเห็น</h2>
      {comments.length === 0 ? (
        <p className="hint">ยังไม่มีความคิดเห็น</p>
      ) : (
        <ol className="comments">
          {comments.map((c) => (
            <li key={c.id}>
              <p className="meta">
                <strong>{people[c.authorId] ?? 'ไม่ทราบชื่อ'}</strong> <time dateTime={c.createdAt}>{formatThaiDateTime(c.createdAt)}</time>
              </p>
              <p className="body">{c.body}</p>
            </li>
          ))}
        </ol>
      )}
      <form className="stack" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="comment">เขียนความคิดเห็น</label>
          <textarea
            id="comment"
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            {...(invalid ? { 'aria-invalid': true, 'aria-describedby': 'comment-error' } : {})}
          />
          {invalid && (
            <p id="comment-error" className="error">
              {invalid}
            </p>
          )}
        </div>
        {failed && (
          <p className="error" role="alert">
            ส่งความคิดเห็นไม่สำเร็จ กรุณาลองอีกครั้ง
          </p>
        )}
        <div className="row">
          <button type="submit" className="primary" disabled={sending}>
            ส่งความคิดเห็น
          </button>
        </div>
      </form>
    </section>
  );
}
