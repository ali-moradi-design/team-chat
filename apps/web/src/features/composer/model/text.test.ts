import { describe, expect, it } from 'vitest';
import { findMentionQuery, insertMention, wrapSelection } from './text';

describe('wrapSelection', () => {
  it('wraps and unwraps', () => {
    const wrapped = wrapSelection('hello world', 6, 11, '**');
    expect(wrapped.value).toBe('hello **world**');
    const back = wrapSelection(wrapped.value, wrapped.selectionStart, wrapped.selectionEnd, '**');
    expect(back.value).toBe('hello world');
  });
});

describe('mentions', () => {
  it('detects an in-progress mention before the caret', () => {
    expect(findMentionQuery('hi @sa', 6)).toEqual({ query: 'sa', from: 3 });
    expect(findMentionQuery('mail a@b', 8)).toBeNull();
    expect(findMentionQuery('@', 1)).toEqual({ query: '', from: 0 });
    expect(findMentionQuery('سلام @لی', 8)).toEqual({ query: 'لی', from: 5 });
  });

  it('inserts the handle and moves the caret', () => {
    const q = findMentionQuery('hi @sa there', 6)!;
    const edit = insertMention('hi @sa there', q, 6, 'sara');
    expect(edit.value).toBe('hi @sara  there');
    expect(edit.selectionStart).toBe(10);
  });
});
