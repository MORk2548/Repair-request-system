'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PREFERENCES, type Preference, type Preferences } from '../lib/preferences';

export function SettingsForm({ current }: { current: Preferences }) {
  const router = useRouter();
  const [values, setValues] = useState(current);

  function choose(p: Preference, value: string) {
    setValues((v) => ({ ...v, [p.cookie]: value }));
    document.documentElement.dataset[p.attribute] = value;
    document.cookie = `${p.cookie}=${value}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  return (
    <form className="panel" onSubmit={(e) => e.preventDefault()}>
      {PREFERENCES.map((p) => (
        <fieldset key={p.cookie} className="choice-group">
          <legend>{p.label}</legend>
          <div className="choices">
            {p.options.map((o) => (
              <label key={o.value} className="choice">
                <input type="radio" name={p.cookie} value={o.value} checked={values[p.cookie] === o.value} onChange={() => choose(p, o.value)} />
                {o.label}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <p className="muted">การตั้งค่านี้บันทึกไว้ในเบราว์เซอร์นี้ และมีผลทันที</p>
    </form>
  );
}
