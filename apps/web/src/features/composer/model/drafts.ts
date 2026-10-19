const prefix = 'tc:draft:';

export function loadDraft(key: string): string {
  try {
    return localStorage.getItem(prefix + key) ?? '';
  } catch {
    return '';
  }
}

export function saveDraft(key: string, value: string): void {
  try {
    if (value) localStorage.setItem(prefix + key, value);
    else localStorage.removeItem(prefix + key);
  } catch {
    /* storage unavailable */
  }
}
