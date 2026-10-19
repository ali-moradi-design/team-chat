const NAME_KEY = 'chatDisplayName';
const USER_KEY = 'chatUserId';

export function loadDisplayName(): string | null {
  try {
    return localStorage.getItem(NAME_KEY);
  } catch {
    return null;
  }
}

export function saveDisplayName(name: string): void {
  localStorage.setItem(NAME_KEY, name);
}

export function loadUserId(): string | null {
  try {
    return localStorage.getItem(USER_KEY);
  } catch {
    return null;
  }
}

export function saveUserId(id: string): void {
  localStorage.setItem(USER_KEY, id);
}
