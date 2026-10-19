import { describe, expect, it } from 'vitest';
import { createFormatters, localeFor } from './format';

describe('formatters', () => {
  it('uses native digits for Persian unless latin digits are requested', () => {
    expect(createFormatters(localeFor('fa', false)).number(12)).toBe('۱۲');
    expect(createFormatters(localeFor('fa', true)).number(12)).toBe('12');
    expect(createFormatters(localeFor('en', false)).number(1234)).toBe('1,234');
  });

  it('always uses the Gregorian calendar', () => {
    const f = createFormatters(localeFor('fa', true));
    expect(f.dateTime(new Date('2026-03-01T10:00:00Z'))).toMatch(/2026/);
  });

  it('formats byte sizes', () => {
    const f = createFormatters('en');
    expect(f.bytes(512)).toBe('512 B');
    expect(f.bytes(2.4 * 1024 * 1024)).toBe('2.4 MB');
  });

  it('labels today and yesterday', () => {
    const f = createFormatters('en');
    const labels = { today: 'Today', yesterday: 'Yesterday' };
    expect(f.dayLabel(new Date(), labels)).toBe('Today');
    expect(f.dayLabel(new Date(Date.now() - 86_400_000), labels)).toBe('Yesterday');
  });
});
