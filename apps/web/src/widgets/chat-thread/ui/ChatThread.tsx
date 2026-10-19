import { useEffect, useRef, useState, useCallback } from 'react';
import { TypingIndicator } from '@/features/typing';
import { StatusBanners } from '@/features/presence';
import { retryMessage } from '@/features/send-message';
import { useChatStore } from '@/shared/lib/chat';
import { Button, Spinner } from '@/shared/ui';
import { cn } from '@/shared/lib';
import { MessageList } from './MessageList';

export function ChatThread() {
  const activeRoomId = useChatStore((s) => s.activeRoomId);
  const roomName = useChatStore(
    (s) => s.rooms.find((r) => r.id === s.activeRoomId)?.name ?? s.activeRoomId,
  );
  const messages = useChatStore((s) => s.messagesByRoom[s.activeRoomId] ?? EMPTY_MESSAGES);
  const userId = useChatStore((s) => s.userId);
  const setSidebarOpen = useChatStore((s) => s.setSidebarOpen);
  const sidebarOpen = useChatStore((s) => s.sidebarOpen);
  const presenceLabel = useChatStore((s) => {
    const presence = s.presenceByRoom[s.activeRoomId] ?? [];
    if (presence.length === 0) return '0 online';
    const names = presence
      .slice(0, 4)
      .map((u) => u.displayName)
      .join(', ');
    return `${presence.length} online · ${names}${presence.length > 4 ? '…' : ''}`;
  });
  const connStatus = useChatStore((s) => s.connStatus);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const stuckRef = useRef(true);
  const [stuckToBottom, setStuckToBottom] = useState(true);
  const [unseen, setUnseen] = useState(0);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const prevLenRef = useRef(0);

  useEffect(() => {
    setHistoryLoaded(false);
    const t = setTimeout(() => setHistoryLoaded(true), 400);
    return () => clearTimeout(t);
  }, [activeRoomId]);

  useEffect(() => {
    if (messages.length > 0) setHistoryLoaded(true);
  }, [messages.length]);

  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' });
    stuckRef.current = true;
    setStuckToBottom(true);
    setUnseen(0);
  }, []);

  const onRetry = useCallback((clientMsgId: string) => {
    retryMessage(clientMsgId);
  }, []);

  useEffect(() => {
    const grew = messages.length > prevLenRef.current;
    prevLenRef.current = messages.length;
    if (!grew) return;
    if (stuckRef.current) {
      scrollToBottom(false);
    } else {
      setUnseen((n) => n + 1);
    }
  }, [messages.length, activeRoomId, scrollToBottom]);

  useEffect(() => {
    prevLenRef.current = 0;
    setUnseen(0);
    stuckRef.current = true;
    setStuckToBottom(true);
    requestAnimationFrame(() => scrollToBottom(false));
  }, [activeRoomId, scrollToBottom]);

  function onScroll() {
    const el = scrollerRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = dist < 80;
    stuckRef.current = atBottom;
    setStuckToBottom(atBottom);
    if (atBottom) setUnseen(0);
  }

  const showLoading =
    !historyLoaded && messages.length === 0 && connStatus === 'connected';

  return (
    <section className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-surface">
      <header className="flex items-center gap-3 border-b border-border/80 px-3 py-3.5 md:px-8">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-xl md:hidden"
          aria-label="Open rooms sidebar"
          aria-controls="room-sidebar"
          aria-expanded={sidebarOpen}
          onClick={() => setSidebarOpen(true)}
        >
          ☰
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[17px] font-semibold tracking-tight">
            <span className="text-muted/70">#</span> {roomName}
          </h1>
          <p className="truncate text-xs text-muted">{presenceLabel}</p>
        </div>
      </header>

      <StatusBanners />

      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="relative min-h-0 flex-1 overflow-y-auto"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        {showLoading ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-muted">
            <Spinner className="h-6 w-6" />
            <p className="text-sm">Loading messages…</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-accent/20 bg-accent/10 text-3xl text-accent-fg shadow-lg shadow-accent/5">
              ✦
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                {connStatus === 'connected' ? 'Start the conversation' : 'Waiting for connection'}
              </h2>
              <p className="max-w-md text-sm leading-relaxed text-muted">
                {connStatus === 'connected'
                  ? `Messages appear here in real time. Say hello in #${roomName} — everyone in the room will see it instantly.`
                  : 'Connect to the server to load history and send messages.'}
              </p>
            </div>
          </div>
        ) : (
          <>
            <MessageList messages={messages} userId={userId} onRetry={onRetry} />
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {!stuckToBottom && unseen > 0 ? (
        <button
          type="button"
          onClick={() => scrollToBottom(true)}
          className={cn(
            'absolute bottom-14 left-1/2 z-10 -translate-x-1/2',
            'rounded-full border border-border bg-panel/95 px-3.5 py-1.5 text-xs font-medium text-foreground shadow-xl backdrop-blur',
            'hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
          )}
        >
          {unseen} new message{unseen === 1 ? '' : 's'} ↓
        </button>
      ) : null}

      <TypingIndicator />
    </section>
  );
}

const EMPTY_MESSAGES: never[] = [];
