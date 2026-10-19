import { describe, expect, it } from 'vitest';
import { RateLimiter } from '../src/lib/rateLimit';
import { sanitizeText } from '../src/lib/sanitize';
import {
  channelNameKey,
  dmKey,
  normalizeChannelName,
} from '../src/modules/conversations/domain/conversation';
import { isValidEmoji } from '../src/modules/messages/domain/message';
import { matchesSignature, sanitizeFileName } from '../src/modules/files/domain/file';
import { hueFromHandle } from '../src/modules/users/domain/user';
import { loadConfig } from '../src/config/env';

describe('RateLimiter', () => {
  it('allows a burst then refills over time', () => {
    let now = 0;
    const l = new RateLimiter(2, 4, () => now);
    expect([1, 2, 3, 4, 5].map(() => l.tryConsume('k'))).toEqual([true, true, true, true, false]);
    now += 1000;
    expect([1, 2, 3].map(() => l.tryConsume('k'))).toEqual([true, true, false]);
    expect(l.tryConsume('other')).toBe(true);
  });
});

describe('sanitizeText', () => {
  it('strips control and bidi-override characters and caps length', () => {
    expect(sanitizeText('a\u0000b‮c\r\nd', 100)).toBe('abc\nd');
    expect(sanitizeText('  abcdef ', 3)).toBe('abc');
  });
});

describe('conversation domain', () => {
  it('normalises channel names', () => {
    expect(normalizeChannelName('  #Design Team ')).toBe('Design-Team');
    expect(channelNameKey('Design Team')).toBe('design-team');
  });
  it('builds an order-independent DM key', () => {
    expect(dmKey(['b', 'a', 'b'])).toBe('a,b');
  });
});

describe('emoji validation', () => {
  it.each([
    ['👍', true],
    ['❤️', true],
    ['🇮🇷', true],
    ['1️⃣', true],
    ['abc', false],
    ['a👍', false],
    ['', false],
  ])('%s → %s', (v, ok) => expect(isValidEmoji(v)).toBe(ok));
});

describe('file signatures', () => {
  it('checks magic bytes', () => {
    expect(
      matchesSignature(
        'image/png',
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]),
      ),
    ).toBe(true);
    expect(matchesSignature('image/png', Buffer.from('GIF89a'))).toBe(false);
    expect(matchesSignature('text/plain', Buffer.from([0x41, 0x00, 0x42]))).toBe(false);
    expect(matchesSignature('application/pdf', Buffer.from('%PDF-1.7'))).toBe(true);
  });
  it('sanitises file names', () => {
    expect(sanitizeFileName('../../etc/passwd')).toBe('passwd');
    expect(sanitizeFileName('..hidden‮txt.exe')).toBe('hiddentxt.exe');
    expect(sanitizeFileName('')).toBe('file');
  });
});

describe('misc', () => {
  it('derives a stable avatar hue', () => {
    expect(hueFromHandle('ali')).toBe(hueFromHandle('ali'));
    expect(hueFromHandle('ali')).toBeLessThan(360);
  });
  it('requires a JWT secret in production', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toThrow(/JWT_SECRET/);
    expect(
      loadConfig({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(32) } as NodeJS.ProcessEnv)
        .cookieSecure,
    ).toBe(true);
  });
});
