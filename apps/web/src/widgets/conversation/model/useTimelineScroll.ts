import { useVirtualizer, type Virtualizer } from '@tanstack/react-virtual';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { TimelineItem } from '@/entities/message';

const estimate = (item: TimelineItem | undefined) => {
  switch (item?.kind) {
    case 'day':
      return 44;
    case 'divider':
      return 36;
    case 'pending':
      return 60;
    default:
      return 68;
  }
};

interface Options {
  items: TimelineItem[];
  conversationId: string;
  ready: boolean;
  hasMoreOlder: boolean;
  hasMoreNewer: boolean;
  loadOlder: () => void;
  loadNewer: () => void;
  /** key of the divider row, when there is one (scroll there on open) */
  initialTarget?: 'divider' | 'bottom';
}

export interface TimelineScroll {
  parentRef: RefObject<HTMLDivElement | null>;
  virtualizer: Virtualizer<HTMLDivElement, Element>;
  atBottom: boolean;
  positioned: boolean;
  newBelow: number;
  scrollToBottom: (smooth?: boolean) => void;
  scrollToKey: (key: string, align?: 'start' | 'center') => boolean;
}

/**
 * Scroll behaviour of a chat timeline on top of TanStack Virtual:
 *  - opens at the first unread message (or the bottom),
 *  - sticks to the bottom while new messages arrive and the user is at the bottom,
 *  - keeps the viewport still when older pages are prepended,
 *  - counts new messages while the user is reading history.
 */
export function useTimelineScroll(o: Options): TimelineScroll {
  const parentRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [positioned, setPositioned] = useState(false);
  const [newBelow, setNewBelow] = useState(0);
  const atBottomRef = useRef(true);
  const anchor = useRef<{ key: string; delta: number } | null>(null);
  const prev = useRef<{ first?: string; last?: string; cid: string; len: number }>({
    cid: '',
    len: 0,
  });
  const optsRef = useRef(o);
  optsRef.current = o;

  const virtualizer = useVirtualizer({
    count: o.items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => estimate(o.items[i]),
    getItemKey: (i) => o.items[i]?.key ?? i,
    overscan: 10,
  });

  const scrollToBottom = useCallback(
    (smooth = false) => {
      const el = parentRef.current;
      const last = optsRef.current.items.length - 1;
      if (!el || last < 0) return;
      virtualizer.scrollToIndex(last, { align: 'end' });
      // Dynamic row heights settle over a couple of frames: re-pin until the bottom is stable.
      let frames = 0;
      const pin = () => {
        const target = el.scrollHeight - el.clientHeight;
        if (Math.abs(el.scrollTop - target) > 1)
          el.scrollTo({ top: target, behavior: smooth && frames === 0 ? 'smooth' : 'auto' });
        if (++frames < 4) requestAnimationFrame(pin);
      };
      requestAnimationFrame(pin);
    },
    [virtualizer],
  );

  const scrollToKey = useCallback(
    (key: string, align: 'start' | 'center' = 'center') => {
      const idx = optsRef.current.items.findIndex((i) => i.key === key);
      if (idx < 0) return false;
      virtualizer.scrollToIndex(idx, { align });
      requestAnimationFrame(() => virtualizer.scrollToIndex(idx, { align }));
      return true;
    },
    [virtualizer],
  );

  /** Re-derives "is the user at the bottom" from real metrics (content may change without a scroll event). */
  const measureBottom = useCallback(() => {
    const el = parentRef.current;
    if (!el) return;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 96;
    if (bottom !== atBottomRef.current) {
      atBottomRef.current = bottom;
      setAtBottom(bottom);
    }
    if (bottom) setNewBelow(0);
  }, []);

  // New conversation: forget everything about the previous one.
  useLayoutEffect(() => {
    setPositioned(false);
    setAtBottom(true);
    setNewBelow(0);
    atBottomRef.current = true;
    anchor.current = null;
    prev.current = { cid: o.conversationId, len: 0 };
  }, [o.conversationId]);

  // Initial position, once the first page is rendered.
  useLayoutEffect(() => {
    if (positioned || !o.ready || o.items.length === 0 || prev.current.cid !== o.conversationId)
      return;
    const divider =
      o.initialTarget === 'divider' ? o.items.findIndex((i) => i.kind === 'divider') : -1;
    if (divider > 0) {
      virtualizer.scrollToIndex(Math.max(divider - 1, 0), { align: 'start' });
      requestAnimationFrame(() =>
        virtualizer.scrollToIndex(Math.max(divider - 1, 0), { align: 'start' }),
      );
      atBottomRef.current = false;
      setAtBottom(false);
    } else {
      scrollToBottom();
    }
    prev.current = {
      first: o.items[0]?.key,
      last: o.items[o.items.length - 1]?.key,
      cid: o.conversationId,
      len: o.items.length,
    };
    requestAnimationFrame(() => {
      setPositioned(true);
      requestAnimationFrame(measureBottom);
    });
  }, [
    positioned,
    o.ready,
    o.items,
    o.conversationId,
    o.initialTarget,
    virtualizer,
    scrollToBottom,
    measureBottom,
  ]);

  // Items changed after the initial position: stick to bottom, count unseen, or keep the anchor.
  useLayoutEffect(() => {
    if (!positioned) return;
    const first = o.items[0]?.key;
    const last = o.items[o.items.length - 1]?.key;
    const p = prev.current;
    const appended = last !== undefined && last !== p.last;
    const prepended =
      first !== undefined &&
      p.first !== undefined &&
      first !== p.first &&
      o.items.some((i) => i.key === p.first);

    if (prepended && anchor.current) {
      const idx = o.items.findIndex((i) => i.key === anchor.current!.key);
      if (idx >= 0) {
        const item = virtualizer.measurementsCache[idx];
        if (item && parentRef.current)
          parentRef.current.scrollTop = item.start - anchor.current.delta;
      }
    } else if (appended) {
      if (atBottomRef.current) scrollToBottom();
      else {
        const newest = o.items[o.items.length - 1];
        if (newest?.kind === 'message') setNewBelow((n) => n + Math.max(1, o.items.length - p.len));
      }
    }
    prev.current = { first, last, cid: o.conversationId, len: o.items.length };
    const raf = requestAnimationFrame(() => requestAnimationFrame(measureBottom));
    return () => cancelAnimationFrame(raf);
  }, [o.items, o.conversationId, positioned, virtualizer, scrollToBottom, measureBottom]);

  // Keep the bottom pinned when row heights change (images load, fonts swap) while stuck to the bottom.
  useEffect(() => {
    const el = parentRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const inner = el.firstElementChild;
    if (!inner) return;
    let raf = 0;
    const ro = new ResizeObserver(() => {
      // Defer: writing scrollTop inside the callback triggers "ResizeObserver loop" errors.
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (!positioned) return;
        if (atBottomRef.current) el.scrollTop = el.scrollHeight;
        else measureBottom();
      });
    });
    ro.observe(inner);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [positioned, o.conversationId, measureBottom]);

  // Scroll handler: bottom detection, anchor tracking, paging.
  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
        const bottom = distance < 96;
        if (bottom !== atBottomRef.current) {
          atBottomRef.current = bottom;
          setAtBottom(bottom);
        }
        if (bottom) setNewBelow(0);
        const vi =
          virtualizer.getVirtualItems().find((v) => v.end > el.scrollTop) ??
          virtualizer.getVirtualItems()[0];
        const item = vi && optsRef.current.items[vi.index];
        if (vi && item) anchor.current = { key: item.key, delta: vi.start - el.scrollTop };
        const cur = optsRef.current;
        if (el.scrollTop < 500 && cur.hasMoreOlder) cur.loadOlder();
        if (distance < 500 && cur.hasMoreNewer) cur.loadNewer();
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [virtualizer, o.conversationId]);

  // A short first page that does not fill the viewport still needs older messages.
  useEffect(() => {
    const el = parentRef.current;
    if (positioned && el && el.scrollHeight <= el.clientHeight + 40 && o.hasMoreOlder)
      o.loadOlder();
  }, [positioned, o.items.length, o.hasMoreOlder, o]);

  return { parentRef, virtualizer, atBottom, positioned, newBelow, scrollToBottom, scrollToKey };
}
