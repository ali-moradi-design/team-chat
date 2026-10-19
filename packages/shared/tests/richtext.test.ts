import { describe, expect, it } from 'vitest';
import { extractMentionHandles, parseRichText, toPlainPreview } from '../src';

describe('parseRichText', () => {
  it('parses bold, italic, strike and inline code', () => {
    const t = parseRichText('a **b** _c_ ~~d~~ `e`');
    expect(t.map((x) => x.type)).toEqual([
      'text',
      'bold',
      'text',
      'italic',
      'text',
      'strike',
      'text',
      'code',
    ]);
  });

  it('parses code blocks and does not format inside them', () => {
    const t = parseRichText('x\n```ts\nconst a = **1**;\n```\ny');
    const block = t.find((x) => x.type === 'codeblock');
    expect(block).toMatchObject({ type: 'codeblock', lang: 'ts', value: 'const a = **1**;' });
  });

  it('only links http(s) and keeps trailing punctuation outside', () => {
    const t = parseRichText('see https://example.com/a, and javascript:alert(1)');
    expect(t.filter((x) => x.type === 'link')).toEqual([
      { type: 'link', href: 'https://example.com/a', label: 'https://example.com/a' },
    ]);
  });

  it('extracts mentions outside code', () => {
    expect(extractMentionHandles('hi @sara and @channel `@omid` mail a@bcd.com')).toEqual([
      'sara',
      'channel',
    ]);
  });

  it('keeps snake_case words intact', () => {
    expect(parseRichText('use some_var_name here')).toEqual([
      { type: 'text', value: 'use some_var_name here' },
    ]);
  });

  it('builds a short plain preview', () => {
    expect(toPlainPreview('**hi** ```x``` there')).toBe('hi [code] there');
  });
});
