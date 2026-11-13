import { THEMES, THEME_IDS } from '@repair/core';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../lib/theme';
import { useUi } from './ui';

export function ThemePicker() {
  const { id, setThemeId } = useTheme();
  const { styles, colors } = useUi();
  return (
    <View style={styles.field}>
      <Text style={styles.label}>ธีมสี</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel="ธีมสี" style={styles.chips}>
        {THEME_IDS.map((t) => (
          <Pressable
            key={t}
            accessibilityRole="radio"
            accessibilityLabel={THEMES[t].label}
            accessibilityState={{ checked: t === id }}
            onPress={() => setThemeId(t)}
            style={[styles.chip, local.item, t === id ? { borderColor: colors.text, borderWidth: 2 } : null]}
          >
            <LinearGradient colors={[THEMES[t].accentA, THEMES[t].accentB]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[local.dot, { borderColor: THEMES[t].bg }]} />
            <Text style={styles.secondaryText}>{THEMES[t].label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const local = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 8 },
  dot: { width: 24, height: 24, borderRadius: 12, borderWidth: 2 },
});
