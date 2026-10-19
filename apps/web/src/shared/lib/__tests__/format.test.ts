import { describe, expect, it } from 'vitest';
import { initials } from '../format';

describe('initials', () => {
  it('handles single and multi-word names', () => {
    expect(initials('Ali')).toBe('AL');
    expect(initials('Ali Moradi')).toBe('AM');
    expect(initials('  ')).toBe('?');
  });
});
