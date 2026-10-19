/**
 * Tiny, dependency-free "light formatting" parser shared by server and web.
 * Output is a token tree, never HTML, so rendering is XSS-safe by construction.
 *
 * Supported: **bold**, _italic_ / *italic*, ~~strike~~, `code`, ```code blocks```,
 * http(s) links and @handle / @channel mentions.
 */
export type RichToken =
  | { type: 'text'; value: string }
  | { type: 'bold' | 'italic' | 'strike'; children: RichToken[] }
  | { type: 'code'; value: string }
  | { type: 'codeblock'; value: string; lang?: string }
  | { type: 'link'; href: string; label: string }
  | { type: 'mention'; handle: string };

const INLINE =
  /(`[^`\n]+`)|(\*\*[^*\n]+?\*\*)|(~~[^~\n]+?~~)|((?<![\w*])\*[^*\s][^*\n]*?\*(?![\w*]))|((?<![\w_])_[^_\s][^_\n]*?_(?![\w_]))|(https?:\/\/[^\s<>]+[^\s<>.,;:!?)\]'"])|((?<![\w@])@(?:[a-z0-9_]{3,20}|channel)\b)/giu;

function parseInline(text: string, depth = 0): RichToken[] {
  const out: RichToken[] = [];
  let last = 0;
  const push = (value: string) => {
    if (value) out.push({ type: 'text', value });
  };

  for (const m of text.matchAll(INLINE)) {
    const start = m.index ?? 0;
    push(text.slice(last, start));
    const raw = m[0];
    if (m[1]) out.push({ type: 'code', value: raw.slice(1, -1) });
    else if (m[2])
      out.push({
        type: 'bold',
        children:
          depth < 2
            ? parseInline(raw.slice(2, -2), depth + 1)
            : [{ type: 'text', value: raw.slice(2, -2) }],
      });
    else if (m[3])
      out.push({
        type: 'strike',
        children:
          depth < 2
            ? parseInline(raw.slice(2, -2), depth + 1)
            : [{ type: 'text', value: raw.slice(2, -2) }],
      });
    else if (m[4] || m[5])
      out.push({
        type: 'italic',
        children:
          depth < 2
            ? parseInline(raw.slice(1, -1), depth + 1)
            : [{ type: 'text', value: raw.slice(1, -1) }],
      });
    else if (m[6]) out.push({ type: 'link', href: raw, label: raw });
    else if (m[7]) out.push({ type: 'mention', handle: raw.slice(1).toLowerCase() });
    last = start + raw.length;
  }
  push(text.slice(last));
  return out;
}

export function parseRichText(text: string): RichToken[] {
  const tokens: RichToken[] = [];
  const fence = /```([a-z0-9+-]*)\n?([\s\S]*?)```/giu;
  let last = 0;
  for (const m of text.matchAll(fence)) {
    const start = m.index ?? 0;
    if (start > last) tokens.push(...parseInline(text.slice(last, start)));
    const lang = m[1] || undefined;
    tokens.push({
      type: 'codeblock',
      value: (m[2] ?? '').replace(/\n$/, ''),
      ...(lang ? { lang } : {}),
    });
    last = start + m[0].length;
  }
  if (last < text.length) tokens.push(...parseInline(text.slice(last)));
  return tokens;
}

/** Unique handles mentioned in a text (outside code). `channel` is returned as-is. */
export function extractMentionHandles(text: string): string[] {
  const found = new Set<string>();
  const walk = (tokens: RichToken[]) => {
    for (const t of tokens) {
      if (t.type === 'mention') found.add(t.handle);
      else if ('children' in t) walk(t.children);
    }
  };
  walk(parseRichText(text));
  return [...found];
}

/** Plain-text preview (for sidebar, notifications). */
export function toPlainPreview(text: string, max = 120): string {
  const flat = text
    .replace(/```[\s\S]*?```/g, ' [code] ')
    .replace(/[*_~`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}
