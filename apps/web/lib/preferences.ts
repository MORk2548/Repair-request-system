// per-browser display settings, kept in cookies so the root layout can set them on <html> before the first paint
export const PREFERENCES = [
  {
    cookie: 'theme',
    attribute: 'theme',
    label: 'โหมดการแสดงผล',
    options: [
      { value: 'light', label: 'สว่าง' },
      { value: 'dark', label: 'มืด' },
    ],
  },
  {
    cookie: 'font_scale',
    attribute: 'fontScale',
    label: 'ขนาดตัวอักษร',
    options: [
      { value: 'normal', label: 'ปกติ' },
      { value: 'large', label: 'ใหญ่' },
      { value: 'xlarge', label: 'ใหญ่มาก' },
    ],
  },
] as const;

export type Preference = (typeof PREFERENCES)[number];
export type Preferences = { [P in Preference as P['cookie']]: P['options'][number]['value'] };

type CookieStore = { get(name: string): { value: string } | undefined };

// an unknown value (an old theme id, a hand-edited cookie) falls back to the first option
export function parsePreferences(cookies: CookieStore): Preferences {
  const pick = (p: Preference) => {
    const value = cookies.get(p.cookie)?.value;
    return p.options.find((o) => o.value === value)?.value ?? p.options[0].value;
  };
  return Object.fromEntries(PREFERENCES.map((p) => [p.cookie, pick(p)])) as Preferences;
}
