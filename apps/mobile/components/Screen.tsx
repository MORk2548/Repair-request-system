import { withAlpha } from '@repair/core';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useTheme } from '../lib/theme';

function Aurora() {
  const { theme } = useTheme();
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let loop: Animated.CompositeAnimation | undefined;
    let live = true;
    // animate only on an explicit "motion is fine"; anything else (an error, a test double) keeps the light still
    Promise.resolve(AccessibilityInfo.isReduceMotionEnabled()).then(
      (reduce) => {
        if (reduce !== false || !live) return;
        const leg = (to: number) => Animated.timing(drift, { toValue: to, duration: 12000, easing: Easing.inOut(Easing.sin), useNativeDriver: true });
        loop = Animated.loop(Animated.sequence([leg(1), leg(0)]));
        loop.start();
      },
      () => {},
    );
    return () => {
      live = false;
      loop?.stop();
    };
  }, [drift]);

  const strength = theme.scheme === 'dark' ? 0.42 : 0.2;
  // fading to the same hue at zero alpha avoids the grey seam iOS draws when fading to 'transparent'
  const band = (color: string) => [withAlpha(color, 0), withAlpha(color, strength), withAlpha(color, 0)] as const;
  const shift = (from: number, to: number) => drift.interpolate({ inputRange: [0, 1], outputRange: [from, to] });

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient colors={[theme.bg, theme.glow]} start={{ x: 0.5, y: 0.35 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
      <Animated.View style={[styles.band, { top: -80, transform: [{ rotate: '-16deg' }, { translateX: shift(-50, 40) }] }]}>
        <LinearGradient colors={band(theme.accentA)} style={styles.fill} />
      </Animated.View>
      <Animated.View style={[styles.band, { top: 60, height: 300, transform: [{ rotate: '12deg' }, { translateX: shift(40, -50) }] }]}>
        <LinearGradient colors={band(theme.accentB)} style={styles.fill} />
      </Animated.View>
    </View>
  );
}

/** a screen's background: the theme color with the aurora behind its content */
export function Screen({ children, edges, style }: { children: ReactNode; edges?: Edge[]; style?: StyleProp<ViewStyle> }) {
  const { theme } = useTheme();
  return (
    <SafeAreaView {...(edges ? { edges } : {})} style={[{ flex: 1, backgroundColor: theme.bg }, style]}>
      <Aurora />
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  band: { position: 'absolute', left: '-35%', width: '170%', height: 260 },
  fill: { flex: 1 },
});
