export type Panel =
  | { type: 'thread'; rootId: string }
  | { type: 'details' }
  | { type: 'pins' }
  | { type: 'search'; q?: string };

export function panelFromParams(params: URLSearchParams): Panel | null {
  const thread = params.get('thread');
  if (thread && /^[a-f\d]{24}$/i.test(thread)) return { type: 'thread', rootId: thread };
  const p = params.get('panel');
  if (p === 'details' || p === 'pins') return { type: p };
  if (p === 'search') return { type: 'search', ...(params.get('q') ? { q: params.get('q')! } : {}) };
  return null;
}

export function panelToParams(panel: Panel | null, keep: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(keep);
  next.delete('thread');
  next.delete('panel');
  next.delete('q');
  if (!panel) return next;
  if (panel.type === 'thread') next.set('thread', panel.rootId);
  else {
    next.set('panel', panel.type);
    if (panel.type === 'search' && panel.q) next.set('q', panel.q);
  }
  return next;
}
