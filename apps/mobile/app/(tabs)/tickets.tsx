import { listTickets, type Profile } from '@repair/api';
import { PRIORITY_LABELS, STATUS_LABELS, TICKET_STATUSES, formatThaiDateTime, type Ticket, type TicketStatus } from '@repair/core';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { Alert, Button, Choices, statusColor, useUi } from '../../components/ui';
import { db } from '../../lib/supabase';
import { useProfile } from '../../lib/useProfile';

type Segment = 'mine' | 'queue';
type StatusFilter = TicketStatus | 'all';

const VIEWS = [
  { value: 'mine', label: 'งานของฉัน' },
  { value: 'queue', label: 'คิวใบใหม่' },
] as const;
const STATUS_FILTERS = [{ value: 'all' as const, label: 'ทั้งหมด' }, ...TICKET_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))];

function TicketRow({ t, onPress }: { t: Ticket; onPress: () => void }) {
  const { colors, styles } = useUi();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t.ticketNo} ${t.title} ${STATUS_LABELS[t.status]}`}
      onPress={onPress}
      style={[styles.card, { gap: 4 }]}
    >
      <Text style={{ fontWeight: '700', color: colors.text }}>{t.ticketNo}</Text>
      <Text style={{ fontSize: 16, color: colors.text }}>{t.title}</Text>
      <View style={styles.row}>
        <Text style={{ color: statusColor(colors, t.status), fontWeight: '600' }}>{STATUS_LABELS[t.status]}</Text>
        <Text style={{ color: t.priority === 'urgent' ? colors.error : colors.muted }}>{PRIORITY_LABELS[t.priority]}</Text>
        <Text style={styles.hint}>{formatThaiDateTime(t.createdAt)}</Text>
      </View>
    </Pressable>
  );
}

export default function TicketsScreen() {
  const { colors, styles } = useUi();
  const { profile } = useProfile();
  if (profile === undefined) return <ActivityIndicator style={{ flex: 1 }} size="large" color={colors.primary} accessibilityLabel="กำลังโหลด" />;
  if (profile === null) {
    return (
      <View style={styles.screen}>
        <Alert>โหลดข้อมูลผู้ใช้ไม่สำเร็จ กรุณาออกจากระบบแล้วเข้าใหม่</Alert>
      </View>
    );
  }
  return <TicketList me={profile} />;
}

function TicketList({ me }: { me: Profile }) {
  const { colors, styles } = useUi();
  const router = useRouter();
  const [view, setView] = useState<Segment>('mine');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [items, setItems] = useState<Ticket[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  const loadingMore = useRef(false);
  // a page that arrives after the filter changed belongs to the old list
  const generation = useRef(0);

  const filter = useMemo(() => {
    if (me.role === 'technician') return view === 'queue' ? { status: 'new' as const } : { assigneeId: me.id };
    return me.role === 'admin' && status !== 'all' ? { status } : {};
  }, [me, view, status]);

  const reload = useCallback(async () => {
    const mine = ++generation.current;
    try {
      const page = await listTickets(db, filter);
      if (mine !== generation.current) return;
      setItems(page.items);
      setCursor(page.nextCursor);
      setFailed(false);
    } catch {
      if (mine === generation.current) setFailed(true);
    } finally {
      setLoaded(true);
    }
  }, [filter]);

  // back from the new-ticket or detail screen, the list shows what changed
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
    const mine = generation.current;
    try {
      const page = await listTickets(db, { ...filter, cursor });
      if (mine !== generation.current) return;
      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    } catch {
      if (mine === generation.current) setFailed(true);
    } finally {
      loadingMore.current = false;
    }
  }

  return (
    <Screen edges={[]}>
      <View style={{ padding: 16, paddingBottom: 0, gap: 8 }}>
        <Button label="แจ้งซ่อม" onPress={() => router.push('/tickets/new')} />
        {me.role === 'technician' ? <Choices label="มุมมอง" options={VIEWS} value={view} onChange={setView} /> : null}
        {me.role === 'admin' ? <Choices label="สถานะ" options={STATUS_FILTERS} value={status} onChange={setStatus} /> : null}
        {failed ? <Alert>โหลดรายการไม่สำเร็จ ดึงลงเพื่อลองอีกครั้ง</Alert> : null}
      </View>
      <FlatList
        testID="ticket-list"
        data={items}
        keyExtractor={(t) => t.id}
        renderItem={({ item }) => <TicketRow t={item} onPress={() => router.push(`/tickets/${item.id}`)} />}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        refreshing={refreshing}
        onRefresh={() => void refresh()}
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={loaded && !failed ? <Text style={[styles.hint, { textAlign: 'center' }]}>ยังไม่มีใบแจ้งซ่อม</Text> : undefined}
      />
    </Screen>
  );
}
