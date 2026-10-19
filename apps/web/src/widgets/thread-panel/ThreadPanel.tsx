import { X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Message } from '@team-chat/shared';
import { useConversation } from '@/entities/conversation';
import {
  MessageItem,
  PendingItem,
  discardPending,
  retryPending,
  toggleReaction,
  useMessages,
  type AuthorView,
} from '@/entities/message';
import { useSession } from '@/entities/session';
import { useUsers } from '@/entities/user';
import { Composer } from '@/features/composer';
import { useConversationTitle } from '@/features/conversation-title';
import {
  DeleteMessageDialog,
  EditMessageBox,
  MessageActionsContext,
  MessageToolbar,
  type MessageActionsContextValue,
} from '@/features/message-actions';
import { useDialogs } from '@/shared/lib/dialogs';
import { Button, EmptyState, Skeleton, type MentionInfo } from '@/shared/ui';

export function ThreadPanel({ rootId, onClose }: { rootId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const me = useSession((s) => s.me)!;
  const thread = useMessages((s) => s.threads[rootId]);
  const users = useUsers((s) => s.byId);
  const byHandle = useUsers((s) => s.byHandle);
  const setLightbox = useDialogs((s) => s.setLightbox);
  const conv = useConversation(thread?.root?.conversationId);
  const titleOf = useConversationTitle();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Message | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  useEffect(() => {
    void useMessages.getState().openThread(rootId);
  }, [rootId]);

  const count = (thread?.replies.length ?? 0) + (thread?.pending.length ?? 0);
  useEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [count, thread?.status]);

  const authorOf = useCallback(
    (id: string): AuthorView => {
      const u = users[id];
      return u
        ? { id, name: u.name, hue: u.hue, isBot: u.isBot }
        : { id, name: t('common.unknownUser'), hue: 20, isBot: false };
    },
    [users, t],
  );
  const resolveMention = useCallback(
    (handle: string): MentionInfo | null => {
      const u = byHandle[handle] ? users[byHandle[handle]!] : undefined;
      return u ? { label: u.name, self: u.id === me.id } : null;
    },
    [byHandle, users, me.id],
  );
  const nameOf = useCallback(
    (id: string) => users[id]?.name ?? t('common.unknownUser'),
    [users, t],
  );
  const onToggleReaction = useCallback(
    (m: Message, e: string) => toggleReaction(m, e, me.id),
    [me.id],
  );

  const isManager =
    !!conv &&
    conv.type === 'channel' &&
    (conv.members.find((m) => m.userId === me.id)?.role === 'owner' || me.role === 'admin');
  const actions = useMemo<MessageActionsContextValue>(
    () => ({
      meId: me.id,
      isAdmin: me.role === 'admin',
      isChannelManager: isManager,
      inThread: true,
      onReply: () => undefined,
      onEdit: (m) => setEditingId(m.id),
      onDelete: setDeleting,
    }),
    [me.id, me.role, isManager],
  );
  const members = useMemo(
    () =>
      conv
        ? conv.members.map((m) => users[m.userId]).filter((u): u is NonNullable<typeof u> => !!u)
        : [],
    [conv, users],
  );

  const renderMsg = (m: Message, grouped: boolean, inThread = true) =>
    editingId === m.id ? (
      <div key={m.id} className="px-3 py-1">
        <EditMessageBox message={m} onDone={() => setEditingId(null)} />
      </div>
    ) : (
      <MessageItem
        key={m.id}
        message={m}
        author={authorOf(m.authorId)}
        grouped={grouped}
        meId={me.id}
        inThread={inThread}
        resolveMention={resolveMention}
        nameOf={nameOf}
        Toolbar={MessageToolbar}
        onToggleReaction={onToggleReaction}
        onOpenImage={setLightbox}
      />
    );

  return (
    <aside className="flex h-full min-h-0 min-w-0 flex-col bg-panel" aria-label={t('thread.title')}>
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <h2 className="font-semibold">{t('thread.title')}</h2>
          {conv && (
            <p className="truncate text-xs text-muted" dir="auto">
              {t('thread.inChannel', {
                name: `${conv.type === 'channel' ? '#' : ''}${titleOf(conv)}`,
              })}
            </p>
          )}
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label={t('common.close')}>
          <X className="size-4" />
        </Button>
      </div>

      <MessageActionsContext.Provider value={actions}>
        <div
          ref={scroller}
          className="min-h-0 flex-1 overflow-y-auto py-2"
          onScroll={(e) => {
            const el = e.currentTarget;
            stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          }}
        >
          {thread?.status === 'loading' && !thread.root && (
            <div className="space-y-4 p-4">
              <Skeleton className="h-16" />
              <Skeleton className="h-10" />
            </div>
          )}
          {thread?.status === 'error' && !thread.root && (
            <EmptyState title={t('thread.loadFailed')} />
          )}
          {thread?.root && (
            <>
              {renderMsg(thread.root, false)}
              <div className="my-2 flex items-center gap-3 px-4 text-xs text-muted">
                <span>{t('thread.repliesCount', { count: thread.replies.length })}</span>
                <span className="h-px flex-1 bg-line" />
              </div>
              {thread.replies.length === 0 && thread.pending.length === 0 && (
                <p className="px-4 py-3 text-sm text-muted">{t('thread.noReplies')}</p>
              )}
              {thread.replies.map((m, i) =>
                renderMsg(
                  m,
                  i > 0 &&
                    thread.replies[i - 1]!.authorId === m.authorId &&
                    new Date(m.createdAt).getTime() -
                      new Date(thread.replies[i - 1]!.createdAt).getTime() <
                      300_000,
                ),
              )}
              {thread.pending.map((p) => (
                <PendingItem
                  key={p.clientMsgId}
                  pending={p}
                  author={authorOf(p.authorId)}
                  grouped={false}
                  onRetry={retryPending}
                  onDiscard={discardPending}
                  resolveMention={resolveMention}
                />
              ))}
            </>
          )}
        </div>
      </MessageActionsContext.Provider>

      {thread?.root && (
        <Composer
          conversationId={thread.root.conversationId}
          threadRootId={rootId}
          draftKey={`thread:${rootId}`}
          placeholder={t('composer.placeholderThread')}
          members={members}
          allowChannelMention={false}
          meId={me.id}
          autoFocus
        />
      )}
      <DeleteMessageDialog message={deleting} onClose={() => setDeleting(null)} />
    </aside>
  );
}
