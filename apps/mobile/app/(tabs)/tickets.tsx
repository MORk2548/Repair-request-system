import { listTickets } from '@repair/api';
import { PRIORITY_LABELS, STATUS_LABELS, formatThaiDateTime, type Ticket } from '@repair/core';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { Alert, Button, colors, styles } from '../../components/ui';
import { db } from '../../lib/supabase';

function TicketRow({ t }: { t: Ticket }) {
  return (
    <View accessible style={{ padding: 12, gap: 4, borderRadius: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
      <Text style={{ fontWeight: '700', color: colors.text }}>{t.ticketNo}</Text>
      <Text style={{ fontSize: 16, color: colors.text }}>{t.title}</Text>
      <View style={styles.row}>
        <Text style={{ color: colors.primary }}>{STATUS_LABELS[t.status]}</Text>
        <Text style={{ color: t.priority === 'urgent' ? colors.error : colors.muted }}>{PRIORITY_LABELS[t.priority]}</Text>
        <Text style={styles.hint}>{formatThaiDateTime(t.createdAt)}</Text>
      </View>
    </View>
  );
}

export default function TicketsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<Ticket[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  const loadingMore = useRef(false);

  const reload = useCallback(async () => {
    try {
      const page = await listTickets(db, {});
      setItems(page.items);
      setCursor(page.nextCursor);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoaded(true);
    }
  }, []);

  // back from the new-ticket screen, the list shows the ticket just filed
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  async function refresh() {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }

  async function loadMore() {
    if (!cursor || loadingMore.current) return;
    loadingMore.current = true;
    try {
      const page = await listTickets(db, { cursor });
      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    } catch {
      setFailed(true);
    } finally {
      loadingMore.current = false;
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ padding: 16, paddingBottom: 0, gap: 8 }}>
        <Button label="แจ้งซ่อม" onPress={() => router.push('/tickets/new')} />
        {failed ? <Alert>โหลดรายการไม่สำเร็จ ดึงลงเพื่อลองอีกครั้ง</Alert> : null}
      </View>
      <FlatList
        testID="ticket-list"
        data={items}
        keyExtractor={(t) => t.id}
        renderItem={({ item }) => <TicketRow t={item} />}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        refreshing={refreshing}
        onRefresh={() => void refresh()}
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={loaded && !failed ? <Text style={[styles.hint, { textAlign: 'center' }]}>ยังไม่มีใบแจ้งซ่อม</Text> : undefined}
      />
    </View>
  );
}
