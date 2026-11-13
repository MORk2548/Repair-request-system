import { getTicket, listTechnicians, type Technician, type TicketDetail } from '@repair/api';
import { PRIORITY_LABELS, STATUS_LABELS, eventLabel, formatThaiDateTime } from '@repair/core';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CommentList } from '../../components/CommentList';
import { StatusActions } from '../../components/StatusActions';
import { Screen } from '../../components/Screen';
import { Alert, Button, statusColor, useUi } from '../../components/ui';
import { db } from '../../lib/supabase';
import { useProfile } from '../../lib/useProfile';

function Detail({ label, children, urgent }: { label: string; children: ReactNode; urgent?: boolean }) {
  const { colors, styles } = useUi();
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Text style={[styles.hint, { width: 110 }]}>{label}</Text>
      <Text style={{ flex: 1, fontSize: 16, color: urgent ? colors.error : colors.text }}>{children}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const { styles } = useUi();
  return (
    <View style={{ gap: 6 }}>
      <Text accessibilityRole="header" style={styles.label}>
        {title}
      </Text>
      {children}
    </View>
  );
}

export default function TicketScreen() {
  const { colors, styles } = useUi();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useProfile();
  // undefined while the first load runs; null when no ticket has this id or the caller may not see it
  const [ticket, setTicket] = useState<TicketDetail | null | undefined>(undefined);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [failed, setFailed] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const role = profile?.role;

  const load = useCallback(async () => {
    if (!role) return;
    try {
      const [t, techs] = await Promise.all([getTicket(db, id), role === 'reporter' ? [] : listTechnicians(db)]);
      setTicket(t);
      setTechnicians(techs);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [id, role]);

  useEffect(() => {
    void load();
  }, [load]);

  if (failed && !ticket) {
    return (
      <View style={styles.screen}>
        <Alert>โหลดใบแจ้งซ่อมไม่สำเร็จ</Alert>
        <Button label="ลองอีกครั้ง" onPress={() => void load()} />
      </View>
    );
  }
  if (profile === null) {
    return (
      <View style={styles.screen}>
        <Alert>โหลดข้อมูลผู้ใช้ไม่สำเร็จ กรุณาออกจากระบบแล้วเข้าใหม่</Alert>
      </View>
    );
  }
  if (ticket === undefined || !profile) return <ActivityIndicator style={{ flex: 1 }} size="large" accessibilityLabel="กำลังโหลด" />;
  if (ticket === null) {
    return (
      <View style={styles.screen}>
        <Text style={[styles.label, { textAlign: 'center' }]}>ไม่พบใบแจ้งซ่อมนี้</Text>
      </View>
    );
  }

  const name = (personId: string | null) => (personId ? (ticket.people[personId] ?? 'ไม่ทราบชื่อ') : '-');

  return (
    <Screen edges={['bottom', 'left', 'right']}>
      <Stack.Screen options={{ title: ticket.ticketNo }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        {/* on iOS the native header is translucent and floats over the screen; this makes the scroll view start below it */}
        <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={[styles.screen, { gap: 16 }]} keyboardShouldPersistTaps="handled">
          <View style={{ gap: 4 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }}>{ticket.title}</Text>
            <Text style={{ fontSize: 16, color: statusColor(colors, ticket.status), fontWeight: '600' }}>{STATUS_LABELS[ticket.status]}</Text>
          </View>

          {failed ? <Alert>โหลดข้อมูลล่าสุดไม่สำเร็จ กรุณาลองอีกครั้ง</Alert> : null}

          {/* keyed by version so a reload after any change starts the panel fresh */}
          <StatusActions
            key={ticket.version}
            ticket={ticket}
            user={{ id: profile.id, role: profile.role }}
            technicians={technicians}
            onChanged={() => void load()}
            onLeave={() => router.dismissTo('/tickets')}
          />

          <View style={styles.card}>
            <Detail label="ความเร่งด่วน" urgent={ticket.priority === 'urgent'}>
              {PRIORITY_LABELS[ticket.priority]}
            </Detail>
            <Detail label="หมวดหมู่">{ticket.categoryName ?? '-'}</Detail>
            {ticket.equipment ? <Detail label="อุปกรณ์">{`${ticket.equipment.assetTag} ${ticket.equipment.name}`}</Detail> : null}
            <Detail label="สถานที่">{ticket.location}</Detail>
            <Detail label="ผู้แจ้ง">{name(ticket.reporterId)}</Detail>
            <Detail label="ช่างผู้รับผิดชอบ">{name(ticket.assigneeId)}</Detail>
            <Detail label="วันที่แจ้ง">{formatThaiDateTime(ticket.createdAt)}</Detail>
            <Detail label="อัปเดตล่าสุด">{formatThaiDateTime(ticket.updatedAt)}</Detail>
            {ticket.resolvedAt ? <Detail label="วันที่แก้ไขเสร็จ">{formatThaiDateTime(ticket.resolvedAt)}</Detail> : null}
          </View>

          <Section title="รายละเอียด">
            <Text style={{ fontSize: 16, color: colors.text }}>{ticket.description}</Text>
          </Section>

          {ticket.resolution ? (
            <Section title="วิธีแก้ไข">
              <Text style={{ fontSize: 16, color: colors.text }}>{ticket.resolution}</Text>
            </Section>
          ) : null}

          {ticket.photos.length > 0 ? (
            <Section title="รูปถ่าย">
              <View style={styles.row}>
                {ticket.photos.map((p, i) => (
                  <Pressable
                    key={p.id}
                    accessibilityRole="button"
                    accessibilityLabel={`รูปที่ ${i + 1} ของใบ ${ticket.ticketNo} (แตะเพื่อดูขนาดเต็ม)`}
                    onPress={() => setViewing(p.url)}
                  >
                    <Image source={{ uri: p.url }} style={{ width: 96, height: 96, borderRadius: 8 }} accessibilityIgnoresInvertColors />
                  </Pressable>
                ))}
              </View>
            </Section>
          ) : null}

          <Section title="ประวัติ">
            {ticket.events.map((e) => (
              <View key={e.id} style={{ gap: 2 }}>
                <Text style={{ color: colors.text }}>
                  <Text style={{ fontWeight: '700' }}>{eventLabel(e)}</Text> โดย {name(e.actorId)} <Text style={styles.hint}>{formatThaiDateTime(e.createdAt)}</Text>
                </Text>
                {e.action === 'reassigned' && e.detail ? <Text style={{ color: colors.text }}>เหตุผล: {e.detail}</Text> : null}
                {e.action === 'status' && e.toStatus === 'done' && e.detail ? <Text style={{ color: colors.text }}>วิธีแก้ไข: {e.detail}</Text> : null}
              </View>
            ))}
          </Section>

          <CommentList ticketId={ticket.id} comments={ticket.comments} people={ticket.people} onAdded={() => void load()} />
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={viewing !== null} animationType="fade" onRequestClose={() => setViewing(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }}>
          {viewing ? <Image source={{ uri: viewing }} style={{ flex: 1 }} resizeMode="contain" accessibilityLabel={`รูปขนาดเต็มของใบ ${ticket.ticketNo}`} /> : null}
          <View style={{ padding: 16 }}>
            <Button label="ปิดรูป" onPress={() => setViewing(null)} />
          </View>
        </SafeAreaView>
      </Modal>
    </Screen>
  );
}
