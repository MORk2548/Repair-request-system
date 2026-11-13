import { addComment, type Comment } from '@repair/api';
import { commentSchema, formatThaiDateTime } from '@repair/core';
import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { db } from '../lib/supabase';
import { Alert, Button, Field, colors, styles } from './ui';

export function CommentList({
  ticketId,
  comments,
  people,
  onAdded,
}: {
  ticketId: string;
  comments: Comment[];
  people: Record<string, string>;
  onAdded: () => void;
}) {
  const busy = useRef(false);
  const [body, setBody] = useState('');
  const [invalid, setInvalid] = useState<string | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [sending, setSending] = useState(false);

  async function submit() {
    if (busy.current) return;
    const parsed = commentSchema.safeParse(body);
    if (!parsed.success) return setInvalid(parsed.error.issues[0]!.message);
    setInvalid(undefined);
    setFailed(false);
    busy.current = true;
    setSending(true);
    try {
      await addComment(db, ticketId, parsed.data);
      setBody('');
      onAdded();
    } catch {
      setFailed(true);
    } finally {
      busy.current = false;
      setSending(false);
    }
  }

  return (
    <View style={{ gap: 8 }}>
      <Text accessibilityRole="header" style={styles.label}>
        ความคิดเห็น
      </Text>
      {comments.length === 0 ? <Text style={styles.hint}>ยังไม่มีความคิดเห็น</Text> : null}
      {comments.map((c) => (
        <View key={c.id} style={{ gap: 2, padding: 10, borderRadius: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
          <Text style={styles.hint}>
            <Text style={{ fontWeight: '700', color: colors.text }}>{people[c.authorId] ?? 'ไม่ทราบชื่อ'}</Text> {formatThaiDateTime(c.createdAt)}
          </Text>
          <Text style={{ fontSize: 16, color: colors.text }}>{c.body}</Text>
        </View>
      ))}
      <Field label="เขียนความคิดเห็น" value={body} onChangeText={setBody} error={invalid} multiline style={{ minHeight: 80, textAlignVertical: 'top' }} />
      {failed ? <Alert>ส่งความคิดเห็นไม่สำเร็จ กรุณาลองอีกครั้ง</Alert> : null}
      <Button label="ส่งความคิดเห็น" disabled={sending} onPress={() => void submit()} />
    </View>
  );
}
