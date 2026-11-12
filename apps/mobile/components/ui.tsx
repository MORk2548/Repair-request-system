import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

export const colors = { primary: '#1d4ed8', text: '#111827', muted: '#6b7280', border: '#d1d5db', error: '#b91c1c', bg: '#f9fafb', card: '#ffffff' };

export function Alert({ children }: { children: ReactNode }) {
  return (
    <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>
      {children}
    </Text>
  );
}

// the error is also the input's hint, so a screen reader reads it when the field gets focus
export function Field({ label, error, style, ...input }: TextInputProps & { label: string; error?: string | undefined }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput accessibilityLabel={label} accessibilityHint={error} style={[styles.input, error ? styles.invalid : null, style]} {...input} />
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
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, kind === 'primary' ? styles.primary : styles.secondary, disabled ? styles.disabled : null]}
    >
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

export const styles = StyleSheet.create({
  screen: { flexGrow: 1, padding: 16, gap: 12, backgroundColor: colors.bg },
  field: { gap: 6 },
  label: { fontSize: 16, fontWeight: '600', color: colors.text },
  input: { minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: colors.text, backgroundColor: colors.card },
  invalid: { borderColor: colors.error },
  error: { color: colors.error, fontSize: 15 },
  hint: { color: colors.muted, fontSize: 14 },
  button: { minHeight: 48, minWidth: 44, borderRadius: 8, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.primary },
  disabled: { opacity: 0.5 },
  primaryText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  secondaryText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, borderColor: colors.primary, justifyContent: 'center', backgroundColor: colors.card },
  chipOn: { backgroundColor: colors.primary },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  notice: { gap: 8, padding: 12, borderRadius: 8, backgroundColor: '#fef3c7' },
});
