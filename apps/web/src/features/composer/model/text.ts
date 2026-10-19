export interface Edit {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

/** Wraps the selection with `before`/`after` (toggles off when already wrapped). */
export function wrapSelection(value: string, start: number, end: number, before: string, after = before): Edit {
  const selected = value.slice(start, end);
  const hasWrap = value.slice(start - before.length, start) === before && value.slice(end, end + after.length) === after;
  if (hasWrap) {
    return {
      value: value.slice(0, start - before.length) + selected + value.slice(end + after.length),
      selectionStart: start - before.length,
      selectionEnd: end - before.length,
    };
  }
  return {
    value: value.slice(0, start) + before + selected + after + value.slice(end),
    selectionStart: start + before.length,
    selectionEnd: end + before.length,
  };
}

export interface MentionQuery {
  query: string;
  /** Index of the "@" character. */
  from: number;
}

/** Finds an in-progress `@mention` right before the caret. */
export function findMentionQuery(value: string, caret: number): MentionQuery | null {
  const before = value.slice(0, caret);
  const m = /(?:^|[\s(])@([\p{L}\p{N}_]*)$/u.exec(before);
  if (!m) return null;
  return { query: m[1] ?? '', from: caret - (m[1]?.length ?? 0) - 1 };
}

export function insertMention(value: string, q: MentionQuery, caret: number, handle: string): Edit {
  const insert = `@${handle} `;
  const next = value.slice(0, q.from) + insert + value.slice(caret);
  const pos = q.from + insert.length;
  return { value: next, selectionStart: pos, selectionEnd: pos };
}

export function insertAt(value: string, start: number, end: number, text: string): Edit {
  const pos = start + text.length;
  return { value: value.slice(0, start) + text + value.slice(end), selectionStart: pos, selectionEnd: pos };
}
