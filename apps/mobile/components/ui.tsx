import { withAlpha, type Theme, type TicketStatus } from '@repair/core';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useTheme } from '../lib/theme';

function paletteOf(t: Theme) {
  return {
    primary: t.accentA,
    accentB: t.accentB,
    onAccent: t.onAccent,
    link: t.link,
    text: t.text,
    muted: t.muted,
    border: withAlpha(t.text, 0.16),
    error: t.danger,
    bg: t.bg,
    // translucent so the aurora shows through like the web's glass cards
    card: withAlpha(t.card, t.scheme === 'dark' ? 0.72 : 0.78),
    field: withAlpha(t.bg, t.scheme === 'dark' ? 0.6 : 0.7),
    surface: withAlpha(t.text, 0.06),
    status: t.status,
  };
}

export type Palette = ReturnType<typeof paletteOf>;

function makeStyles(c: Palette) {
  return StyleSheet.create({
    // Android draws edge to edge, so a screen without a navigator header or tab bar must keep clear of the status and navigation bars itself
    safe: { flex: 1 },
    screen: { flexGrow: 1, padding: 16, gap: 12 },
    field: { gap: 6 },
    label: { fontSize: 16, fontWeight: '600', color: c.text },
    title: { fontSize: 24, fontWeight: '700', color: c.text },
    text: { fontSize: 16, color: c.text },
    input: { minHeight: 44, borderWidth: 1, borderColor: c.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: c.text, backgroundColor: c.field },
    invalid: { borderColor: c.error },
    error: { color: c.error, fontSize: 15 },
    hint: { color: c.muted, fontSize: 14 },
    card: { gap: 6, padding: 14, borderRadius: 16, backgroundColor: c.card, borderWidth: 1, borderColor: c.border },
    button: { minHeight: 48, minWidth: 44, borderRadius: 8, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    primary: {},
    secondary: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
    disabled: { opacity: 0.5 },
    pressed: { opacity: 0.85 },
    primaryText: { color: c.onAccent, fontSize: 16, fontWeight: '700' },
    secondaryText: { color: c.text, fontSize: 16, fontWeight: '600' },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { minHeight: 44, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, borderColor: c.border, justifyContent: 'center', backgroundColor: c.surface },
    chipOn: { backgroundColor: c.primary, borderColor: c.primary },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    notice: { gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: withAlpha(c.status.inProgress, 0.45), backgroundColor: withAlpha(c.status.inProgress, 0.12) },
  });
}

export function statusColor(c: Palette, status: TicketStatus): string {
  switch (status) {
    case 'new':
      return c.status.new;
    case 'assigned':
      return c.status.assigned;
    case 'in_progress':
      return c.status.inProgress;
    case 'done':
      return c.status.done;
    default:
      return c.muted;
  }
}

/** the current theme's colors and styles; recomputed only when the theme changes */
export function useUi() {
  const { theme } = useTheme();
  return useMemo(() => {
    const colors = paletteOf(theme);
    return { colors, styles: makeStyles(colors), scheme: theme.scheme };
  }, [theme]);
}

export function Alert({ children }: { children: ReactNode }) {
  const { styles } = useUi();
  return (
    <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>
      {children}
    </Text>
  );
}

// the error is also the input's hint, so a screen reader reads it when the field gets focus
export function Field({ label, error, style, ...input }: TextInputProps & { label: string; error?: string | undefined }) {
  const { styles, colors, scheme } = useUi();
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={error}
        placeholderTextColor={colors.muted}
        selectionColor={colors.primary}
        keyboardAppearance={scheme}
        style={[styles.input, error ? styles.invalid : null, style]}
        {...input}
      />
      {error ? <Alert>{error}</Alert> : null}
    </View>
  );
}

export function Button({
  label,
  onPress,
  disabled,
  kind = 'primary',
  accessibilityLabel = label,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  kind?: 'primary' | 'secondary';
  accessibilityLabel?: string;
}) {
  const { styles, colors } = useUi();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, kind === 'primary' ? styles.primary : styles.secondary, disabled ? styles.disabled : pressed ? styles.pressed : null]}
    >
      {kind === 'primary' ? <LinearGradient colors={[colors.primary, colors.accentB]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} /> : null}
      <Text style={kind === 'primary' ? styles.primaryText : styles.secondaryText}>{label}</Text>
    </Pressable>
  );
}

// a radio group of chips stands in for <select>, which React Native does not have
export function Choices<T extends string | number>({
  label,
  options,
  value,
  onChange,
  error,
}: {
  label: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T | null;
  onChange: (v: T) => void;
  error?: string | undefined;
}) {
  const { styles } = useUi();
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={label} accessibilityHint={error} style={styles.chips}>
        {options.map((o) => (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityLabel={o.label}
            accessibilityState={{ checked: o.value === value }}
            onPress={() => onChange(o.value)}
            style={[styles.chip, o.value === value ? styles.chipOn : null]}
          >
            <Text style={o.value === value ? styles.primaryText : styles.secondaryText}>{o.label}</Text>
          </Pressable>
        ))}
      </View>
      {error ? <Alert>{error}</Alert> : null}
    </View>
  );
}
