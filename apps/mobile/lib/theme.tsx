import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_THEME, THEMES, parseThemeId, type Theme, type ThemeId } from '@repair/core';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

const KEY = 'theme';

type ThemeValue = { id: ThemeId; theme: Theme; setThemeId: (id: ThemeId) => void };

// outside a provider (tests, early screens) every screen gets the default theme
const ThemeContext = createContext<ThemeValue>({ id: DEFAULT_THEME, theme: THEMES[DEFAULT_THEME], setThemeId: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [id, setId] = useState<ThemeId>(DEFAULT_THEME);
  const picked = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then(
      (saved) => {
        // a pick made before storage answered wins
        if (saved !== null && !picked.current) setId(parseThemeId(saved));
      },
      () => {},
    );
  }, []);

  const setThemeId = useCallback((next: ThemeId) => {
    picked.current = true;
    setId(next);
    AsyncStorage.setItem(KEY, next).catch((e) => console.warn('saving the theme failed', e));
  }, []);

  const value = useMemo(() => ({ id, theme: THEMES[id], setThemeId }), [id, setThemeId]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}
