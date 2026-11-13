'use client';

import { THEMES, THEME_IDS, type ThemeId } from '@repair/core';
import { useId, useState } from 'react';

export function ThemePicker({ current }: { current: ThemeId }) {
  const [value, setValue] = useState(current);
  const name = useId();

  function pick(id: ThemeId) {
    setValue(id);
    const root = document.documentElement;
    root.dataset.theme = id;
    root.dataset.scheme = THEMES[id].scheme;
    document.cookie = `theme=${id}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <fieldset className="theme-picker">
      <legend className="visually-hidden">ธีมสี</legend>
      {THEME_IDS.map((id) => (
        <label key={id} className="swatch" title={THEMES[id].label}>
          <input type="radio" name={name} className="visually-hidden" aria-label={THEMES[id].label} checked={value === id} onChange={() => pick(id)} />
          <span style={{ background: `linear-gradient(135deg, ${THEMES[id].accentA}, ${THEMES[id].accentB})`, borderColor: THEMES[id].bg }} />
        </label>
      ))}
    </fieldset>
  );
}
