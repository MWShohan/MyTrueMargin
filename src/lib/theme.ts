export type Theme = 'system' | 'light' | 'dark';

export const THEME_KEY = 'mytruemargin:theme';
export const THEMES: { id: Theme; label: string }[] = [
  { id: 'system', label: 'Match device' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
];

export function loadTheme(): Theme {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

/** Sets the theme on the page and remembers it. 'system' follows the device setting. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
  try {
    if (theme === 'system') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* storage unavailable: the choice lasts for this visit only */
  }
}
