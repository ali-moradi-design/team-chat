import { ArrowDown, Hash, MessageSquare, RefreshCw } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Attachment, Message } from '@team-chat/shared';
import { useConversation } from '@/entities/conversation';
import { MessageItem, PendingItem, buildItems, discardPending, retryPending, toggleReaction, useMessages, type AuthorView } from '@/entities/message';
import { useUsers } from '@/entities/user';
import { EditMessageBox, MessageToolbar } from '@/features/message-actions';
import { cn } from '@/shared/lib/cn';
import { useFormatters } from '@/shared/lib/format';
import { Button, EmptyState, Skeleton, Spinner, type MentionInfo } from '@/shared/ui';
import { useMarkRead } from '../model/useMarkRead';
import { useTimelineScroll } from '../model/useTimelineScroll';

interface Props {
  conversationId: string;
  meId: string;
  highlightId?: string | undefined;
  editingId: string | null;
  onEditingChange: (id: string | null) => void;
  onOpenThread: (m: Message) => void;
  onOpenImage: (a: Attachment) => void;
  channelName?: string | undefined;
  isDm: boolean;
}

function DaySeparator({ date }: { date: string }) {
  const { t } = useTranslation();
  const f = useFormatters();
  return (
    <div className="flex items-center gap-3 px-4 py-3 text-xs font-medium text-muted" role="separator">
      <span className="h-px flex-1 bg-line" />
      <span className="rounded-full border border-line bg-panel px-3 py-1">{f.dayLabel(date, { today: t('message.today'), yesterday: t('message.yesterday') })}</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

function NewDivider() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3 px-4 py-2 text-xs font-semibold text-accent-ink" role="separator">
      <span className="h-px flex-1 bg-accent/50" />
      <span>{t('message.newMessages')}</span>
      <span className="h-px flex-1 bg-accent/50" />
    </div>
  );
}

function TimelineSkeleton() {
  return (
    <div className="flex flex-col gap-5 p-5" aria-hidden="true">
      {[70, 45, 85, 55, 65, 40].map((w, i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3.5" />
            <Skeleton className="h-3.5" />
            <span className="hidden" style={{ width: `${w}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export const Timeline = memo(function Timeline(p: Props) {
  const { t } = useTranslation();
  const timeline = useMessages((s) => s.timelines[p.conversationId]);
  const conv = useConversation(p.conversationId);
  const users = useUsers((s) => s.byId);
  const byHandle = useUsers((s) => s.byHandle);

  // Where the "new messages" divider goes: captured once when the conversation opens.
  const [divider, setDivider] = useState<{ cid: string; after: string | undefined; unread: number } | null>(null);
  useEffect(() => {
    if (timeline?.status === 'ready' && conv && divider?.cid !== p.conversationId) {
      setDivider({ cid: p.conversationId, after: conv.unreadCount > 0 ? conv.lastReadMessageId : undefined, unread: conv.unreadCount });
    }
  }, [timeline?.status, conv, divider?.cid, p.conversationId]);
  const dividerAfter = divider?.cid === p.conversationId ? divider.after : undefined;

  const pending = useMemo(() => timeline?.pending ?? [], [timeline?.pending]);
  const items = useMemo(
    () => (timeline ? buildItems({ ids: timeline.ids, byId: timeline.byId, pending, dividerAfterId: dividerAfter, meId: p.meId }) : []),
    [timeline, pending, dividerAfter, p.meId],
  );

  const authors = useMemo(() => {
    const out: Record<string, AuthorView> = {};
    for (const u of Object.values(users)) out[u.id] = { id: u.id, name: u.name, hue: u.hue, isBot: u.isBot };
    return out;
  }, [users]);
  const unknown = useMemo<AuthorView>(() => ({ id: '?', name: t('common.unknownUser'), hue: 20, isBot: false }), [t]);

  const resolveMention = useCallback(
    (handle: string): MentionInfo | null => {
      const id = byHandle[handle];
      const u = id ? users[id] : undefined;
      return u ? { label: u.name, self: u.id === p.meId } : null;
    },
    [byHandle, users, p.meId],
  );
  const nameOf = useCallback((id: string) => users[id]?.name ?? t('common.unknownUser'), [users, t]);
  const onToggleReaction = useCallback((m: Message, emoji: string) => toggleReaction(m, emoji, p.meId), [p.meId]);

  const loadOlder = useCallback(() => void useMessages.getState().loadOlder(p.conversationId), [p.conversationId]);
  const loadNewer = useCallback(() => void useMessages.getState().loadNewer(p.conversationId), [p.conversationId]);

  const scroll = useTimelineScroll({
    items,
    conversationId: p.conversationId,
    ready: timeline?.status === 'ready' && divider?.cid === p.conversationId,
    hasMoreOlder: !!timeline?.hasMoreOlder,
    hasMoreNewer: !!timeline?.hasMoreNewer,
    loadOlder,
    loadNewer,
    initialTarget: dividerAfter ? 'divider' : 'bottom',
  });

  const newestId = timeline && !timeline.hasMoreNewer ? timeline.ids[timeline.ids.length - 1] : undefined;
  useMarkRead(p.conversationId, newestId, scroll.atBottom, scroll.positioned);

  // Jump to a specific message (search result, pin, shared link).
  const [flash, setFlash] = useState<string | null>(null);
  const jumped = useRef('');
  useEffect(() => {
    const id = p.highlightId;
    if (!id || !scroll.positioned || jumped.current === `${p.conversationId}:${id}`) return;
    if (timeline?.byId[id]) {
      jumped.current = `${p.conversationId}:${id}`;
      scroll.scrollToKey(id, 'center');
      setFlash(id);
      const timer = setTimeout(() => setFlash(null), 2400);
      return () => clearTimeout(timer);
    }
    void useMessages.getState().jumpTo(p.conversationId, id);
  }, [p.highlightId, p.conversationId, scroll.positioned, timeline?.byId, scroll]);

  const lastOwn = useMemo(() => {
    if (!timeline) return undefined;
    for (let i = timeline.ids.length - 1; i >= 0; i--) if (timeline.byId[timeline.ids[i]!]?.authorId === p.meId) return timeline.ids[i];
    return undefined;
  }, [timeline, p.meId]);

  const seenBy = useMemo(() => {
    if (!conv || conv.type !== 'dm' || !lastOwn) return [];
    return Object.entries(conv.peerReads ?? {}).filter(([uid, mid]) => uid !== p.meId && mid >= lastOwn).map(([uid]) => uid);
  }, [conv, lastOwn, p.meId]);

  const jumpToLatest = async () => {
    if (timeline?.hasMoreNewer) {
      await useMessages.getState().jumpToLatest(p.conversationId);
      requestAnimationFrame(() => scroll.scrollToBottom());
    } else scroll.scrollToBottom(true);
  };

  if (!timeline || (timeline.status === 'loading' && timeline.ids.length === 0)) return <TimelineSkeleton />;
  if (timeline.status === 'error')
    return (
      <EmptyState icon={<RefreshCw className="size-6" />} title={t('conversation.loadFailed')}>
        <Button variant="secondary" className="mt-2" onClick={() => void useMessages.getState().openConversation(p.conversationId)}>
          {t('common.retry')}
        </Button>
      </EmptyState>
    );
  if (timeline.ids.length === 0 && pending.length === 0)
    return (
      <EmptyState icon={p.isDm ? <MessageSquare className="size-6" /> : <Hash className="size-6" />} title={p.isDm ? t('conversation.emptyDmTitle') : t('conversation.emptyChannelTitle', { name: p.channelName })}>
        {p.isDm ? t('conversation.emptyDmBody') : t('conversation.emptyChannelBody')}
      </EmptyState>
    );

  const vItems = scroll.virtualizer.getVirtualItems();
  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scroll.parentRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label={t('common.appName')}
        tabIndex={-1}
        className={cn('absolute inset-0 overflow-y-auto overscroll-contain px-1 [overflow-anchor:none] sm:px-2', !scroll.positioned && 'invisible')}
      >
        <div style={{ height: scroll.virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
          {vItems.map((v) => {
            const item = items[v.index];
            if (!item) return null;
            return (
              <div
                key={v.key}
                data-index={v.index}
                ref={scroll.virtualizer.measureElement}
                style={{ position: 'absolute', top: 0, insetInlineStart: 0, width: '100%', transform: `translateY(${v.start}px)` }}
              >
                {v.index === 0 && (
                  <div className="px-4 pb-1 pt-4 text-center text-xs text-muted">
                    {timeline.loadingOlder ? (
                      <span className="inline-flex items-center gap-2">
                        <Spinner className="size-3" /> {t('conversation.loadingOlder')}
                      </span>
                    ) : !timeline.hasMoreOlder ? (
                      t('conversation.startOfConversation')
                    ) : null}
                  </div>
                )}
                {item.kind === 'day' && <DaySeparator date={item.date} />}
                {item.kind === 'divider' && <NewDivider />}
                {item.kind === 'message' &&
                  (() => {
                    const m = timeline.byId[item.id];
                    if (!m) return null;
                    if (p.editingId === m.id) return <div className="px-3 py-1"><EditMessageBox message={m} onDone={() => p.onEditingChange(null)} /></div>;
                    return (
                      <MessageItem
                        message={m}
                        author={authors[m.authorId] ?? unknown}
                        grouped={item.grouped}
                        meId={p.meId}
                        highlighted={flash === m.id}
                        resolveMention={resolveMention}
                        nameOf={nameOf}
                        Toolbar={MessageToolbar}
                        onToggleReaction={onToggleReaction}
                        onOpenThread={p.onOpenThread}
                        onOpenImage={p.onOpenImage}
                        footer={
                          m.id === lastOwn && seenBy.length > 0 ? (
                            <p className="mt-0.5 text-[11px] text-faint">{p.isDm && seenBy.length === 1 ? t('message.seenBy') : t('message.seenByNames', { names: seenBy.map(nameOf).join(', ') })}</p>
                          ) : undefined
                        }
                      />
                    );
                  })()}
                {item.kind === 'pending' &&
                  (() => {
                    const pm = pending.find((x) => x.clientMsgId === item.clientMsgId);
                    return pm ? <PendingItem pending={pm} author={authors[pm.authorId] ?? unknown} grouped={item.grouped} onRetry={retryPending} onDiscard={discardPending} resolveMention={resolveMention} onOpenImage={p.onOpenImage} /> : null;
                  })()}
              </div>
            );
          })}
        </div>
      </div>

      {(!scroll.atBottom || timeline.hasMoreNewer) && scroll.positioned && (
        <Button variant="primary" size="sm" onClick={() => void jumpToLatest()} className="absolute bottom-3 start-1/2 -translate-x-1/2 rounded-full shadow-pop rtl:translate-x-1/2">
          <ArrowDown className="size-4" />
          {scroll.newBelow > 0 ? t('message.newBelow', { count: scroll.newBelow }) : t('message.jumpToLatest')}
        </Button>
      )}
    </div>
  );
});
