import { listCategories, listEquipment, type Category, type Equipment } from '@repair/api';
import { MAX_PHOTOS, PRIORITIES, PRIORITY_LABELS, createTicketSchema, type Priority } from '@repair/core';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, KeyboardAvoidingView, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Alert, Button, Choices, Field, colors, styles } from '../../components/ui';
import { pickPhotos, preparePhoto } from '../../lib/photos';
import { db } from '../../lib/supabase';
import { useTicketSubmit } from '../../lib/useTicketSubmit';

type Fields = { title: string; description: string; categoryId: number | null; priority: Priority; location: string };
type FieldErrors = Partial<Record<keyof Fields, string>>;

const SEARCH_DELAY_MS = 300;
const priorityOptions = PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }));

export default function NewTicketScreen() {
  const router = useRouter();
  const form = useTicketSubmit(() => router.back());
  const [categories, setCategories] = useState<Category[]>([]);
  const [fields, setFields] = useState<Fields>({ title: '', description: '', categoryId: null, priority: 'normal', location: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [equipmentQuery, setEquipmentQuery] = useState('');
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [matches, setMatches] = useState<Equipment[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const locked = form.ticket !== null;

  useEffect(() => {
    listCategories(db).then(setCategories, () => setLoadError(true));
  }, []);

  useEffect(() => {
    const q = equipmentQuery.trim();
    setMatches([]);
    if (!q || equipment) return;
    let live = true;
    const timer = setTimeout(() => {
      listEquipment(db, { q }).then(
        (rows) => live && setMatches(rows),
        () => live && setMatches([]),
      );
    }, SEARCH_DELAY_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [equipmentQuery, equipment]);

  const set = (name: 'title' | 'description' | 'location') => (value: string) => setFields((f) => ({ ...f, [name]: value }));

  function pickEquipment(e: Equipment) {
    setEquipment(e);
    setEquipmentQuery(`${e.assetTag} ${e.name}`);
    const location = e.installLocation;
    if (location) setFields((f) => ({ ...f, location }));
  }

  async function addPhotos(source: 'camera' | 'library') {
    const room = MAX_PHOTOS - form.photos.length;
    if (room <= 0) return setPhotoError(`แนบรูปได้ไม่เกิน ${MAX_PHOTOS} รูป`);
    const picked = await pickPhotos(source, room);
    if (typeof picked === 'string') return setPhotoError(picked);
    if (picked.length === 0) return;
    // Android's picker may ignore selectionLimit
    if (picked.length > room) return setPhotoError(`แนบรูปได้ไม่เกิน ${MAX_PHOTOS} รูป`);
    try {
      const prepared = await Promise.all(picked.map((a, i) => preparePhoto(a, form.photos.length + i)));
      setPhotoError(null);
      form.setPhotos((p) => [...p, ...prepared]);
    } catch {
      setPhotoError('เตรียมรูปไม่สำเร็จ กรุณาเลือกรูปอื่น');
    }
  }

  function submit() {
    if (form.sending) return;
    const parsed = createTicketSchema.safeParse({ ...fields, equipmentId: equipment?.id ?? null, clientRequestId: form.clientRequestId });
    if (!parsed.success) {
      const found: FieldErrors = {};
      for (const issue of parsed.error.issues) found[issue.path[0] as keyof Fields] ??= issue.message;
      return setErrors(found);
    }
    setErrors({});
    void form.submit(parsed.data);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      {/* on iOS the native header is translucent and floats over the screen; this makes the scroll view start below it */}
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
        <View pointerEvents={locked ? 'none' : 'auto'} style={{ gap: 12, opacity: locked ? 0.6 : 1 }}>
          <Field label="หัวข้อ" value={fields.title} onChangeText={set('title')} error={errors.title} editable={!locked} />
          <Field label="รายละเอียด" value={fields.description} onChangeText={set('description')} error={errors.description} multiline numberOfLines={4} style={{ minHeight: 100, textAlignVertical: 'top' }} editable={!locked} />
          {loadError ? <Alert>โหลดหมวดหมู่ไม่สำเร็จ กรุณากลับไปแล้วเปิดใหม่</Alert> : null}
          <Choices
            label="หมวดหมู่"
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            value={fields.categoryId}
            onChange={(categoryId) => setFields((f) => ({ ...f, categoryId }))}
            error={errors.categoryId}
          />
          <Choices label="ความเร่งด่วน" options={priorityOptions} value={fields.priority} onChange={(priority) => setFields((f) => ({ ...f, priority }))} />

          <Field
            label="อุปกรณ์ (ไม่บังคับ)"
            placeholder="ค้นด้วยรหัสทรัพย์สินหรือชื่อ"
            autoCorrect={false}
            value={equipmentQuery}
            editable={!locked}
            onChangeText={(q) => {
              setEquipmentQuery(q);
              setEquipment(null);
            }}
          />
          {matches.map((m) => (
            <Pressable
              key={m.id}
              accessibilityRole="button"
              accessibilityLabel={`${m.assetTag} ${m.name}`}
              onPress={() => pickEquipment(m)}
              style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}
            >
              <Text>
                <Text style={{ fontWeight: '700' }}>{m.assetTag}</Text> {m.name}
              </Text>
            </Pressable>
          ))}

          <Field label="สถานที่" value={fields.location} onChangeText={set('location')} error={errors.location} editable={!locked} />

          <View style={styles.field}>
            <Text style={styles.label}>รูป</Text>
            <Text style={styles.hint}>ไม่เกิน {MAX_PHOTOS} รูป</Text>
            <View style={styles.row}>
              <Button kind="secondary" label="ถ่ายรูป" onPress={() => void addPhotos('camera')} />
              <Button kind="secondary" label="เลือกจากคลังรูป" onPress={() => void addPhotos('library')} />
            </View>
            {photoError ? <Alert>{photoError}</Alert> : null}
            <View style={styles.row}>
              {form.photos.map((p, i) => (
                <View key={p.uri} style={{ alignItems: 'center', gap: 4 }}>
                  <Image source={{ uri: p.uri }} style={{ width: 88, height: 88, borderRadius: 8 }} accessibilityIgnoresInvertColors />
                  <Button kind="secondary" label="ลบ" accessibilityLabel={`ลบรูป ${p.name}`} onPress={() => form.setPhotos((ps) => ps.filter((_, j) => j !== i))} />
                </View>
              ))}
            </View>
          </View>
        </View>

        {form.submitError ? <Alert>ส่งใบแจ้งซ่อมไม่สำเร็จ กรุณาลองอีกครั้ง</Alert> : null}

        {form.uploadFailed ? (
          <View style={styles.notice}>
            <Alert>สร้างใบแจ้งซ่อมแล้ว แต่อัปโหลดรูปไม่สำเร็จ</Alert>
            <Button label="ลองอัปโหลดรูปอีกครั้ง" onPress={() => void form.retryUpload()} />
            <Button kind="secondary" label="ไปที่รายการใบแจ้งซ่อม" onPress={() => router.back()} />
          </View>
        ) : (
          <Button label="ส่งใบแจ้งซ่อม" onPress={submit} disabled={form.sending || locked} />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
