import { Hash, Info, Lock, Menu as MenuIcon, Pin, Search, Users } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Message } from '@team-chat/shared';
import { useConversation } from '@/entities/conversation';
import { useMessages } from '@/entities/message';
import { useSession } from '@/entities/session';
import { useUsers, UserAvatar } from '@/entities/user';
import { Composer } from '@/features/composer';
import { useConversationTitle } from '@/features/conversation-title';
import { DeleteMessageDialog, MessageActionsContext, type MessageActionsContextValue } from '@/features/message-actions';
import { TypingIndicator } from '@/features/typing';
import { cn } from '@/shared/lib/cn';
import { useDialogs } from '@/shared/lib/dialogs';
import { Button, EmptyState, Tooltip } from '@/shared/ui';
import type { Panel } from '../model/panel';
import { Timeline } from './Timeline';

interface Props {
  conversationId: string;
  highlightId?: string | undefined;
  panel: Panel | null;
  onPanel: (p: Panel | null) => void;
}

export function ConversationView({ conversationId, highlightId, panel, onPanel }: Props) {
  const { t } = useTranslation();
  const me = useSession((s) => s.me)!;
  const conv = useConversation(conversationId);
  const titleOf = useConversationTitle();
  const users = useUsers((s) => s.byId);
  const setSidebar = useDialogs((s) => s.setSidebar);
  const setLightbox = useDialogs((s) => s.setLightbox);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Message | null>(null);

  useEffect(() => setEditingId(null), [conversationId]);
  useEffect(() => {
    void useMessages.getState().openConversation(conversationId);
  }, [conversationId]);

  const isManager = !!conv && conv.type === 'channel' && (conv.members.find((m) => m.userId === me.id)?.role === 'owner' || me.role === 'admin');

  const openThread = useCallback((m: Message) => onPanel({ type: 'thread', rootId: m.id }), [onPanel]);
  const actions = useMemo<MessageActionsContextValue>(
    () => ({
      meId: me.id,
      isAdmin: me.role === 'admin',
      isChannelManager: isManager,
      inThread: false,
      onReply: openThread,
      onEdit: (m) => setEditingId(m.id),
      onDelete: setDeleting,
    }),
    [me.id, me.role, isManager, openThread],
  );

  const members = useMemo(() => (conv ? conv.members.map((m) => users[m.userId]).filter((u): u is NonNullable<typeof u> => !!u) : []), [conv, users]);

  const editLast = useCallback(() => {
    const tl = useMessages.getState().timelines[conversationId];
    if (!tl) return;
    for (let i = tl.ids.length - 1; i >= 0; i--) {
      const m = tl.byId[tl.ids[i]!];
      if (m && m.authorId === me.id && !m.deletedAt) return setEditingId(m.id);
    }
  }, [conversationId, me.id]);

  if (!conv) {
    return (
      <div className="grid flex-1 place-items-center">
        <EmptyState icon={<Hash className="size-6" />} title={t('conversation.notFound')} />
      </div>
    );
  }

  const isDm = conv.type === 'dm';
  const title = titleOf(conv);
  const others = conv.members.filter((m) => m.userId !== me.id);
  const placeholder = isDm ? t('composer.placeholderDm', { name: title }) : t('composer.placeholderChannel', { name: conv.name });
  const panelBtn = (active: boolean) => cn(active && 'bg-elevated text-fg');

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface" aria-label={title}>
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-panel px-2 sm:gap-3 sm:px-4">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSidebar(true)} aria-label={t('sidebar.open')}>
          <MenuIcon className="size-5" />
        </Button>
        <button type="button" onClick={() => onPanel({ type: 'details' })} className="flex min-w-0 items-center gap-2 rounded-lg px-1.5 py-1 text-start hover:bg-elevated" aria-label={t('conversation.details')}>
          {isDm ? (
            <span className="flex -space-x-2 rtl:space-x-reverse">
              {(others.length ? others : conv.members).slice(0, 2).map((m) => (
                <UserAvatar key={m.userId} userId={m.userId} size="sm" withPresence={others.length <= 1} />
              ))}
            </span>
          ) : conv.isPrivate ? (
            <Lock className="size-4 shrink-0 text-muted" />
          ) : (
            <Hash className="size-4 shrink-0 text-muted" />
          )}
          <span className="truncate text-base font-semibold" dir="auto">{title}</span>
        </button>
        {conv.topic && <span className="hidden min-w-0 flex-1 truncate border-s border-line ps-3 text-sm text-muted lg:block" dir="auto">{conv.topic}</span>}
        <span className="flex-1" />
        <div className="flex items-center gap-0.5">
          <Tooltip label={t('conversation.members')}>
            <Button variant="ghost" size="sm" className={cn('gap-1.5 px-2', panelBtn(panel?.type === 'details'))} onClick={() => onPanel(panel?.type === 'details' ? null : { type: 'details' })} aria-label={t('conversation.members')}>
              <Users className="size-4" />
              <span className="text-xs tabular-nums">{conv.members.length}</span>
            </Button>
          </Tooltip>
          <Tooltip label={t('conversation.pinned')}>
            <Button variant="ghost" size="icon" className={panelBtn(panel?.type === 'pins')} onClick={() => onPanel(panel?.type === 'pins' ? null : { type: 'pins' })} aria-label={t('conversation.pinned')}>
              <Pin className="size-4" />
            </Button>
          </Tooltip>
          <Tooltip label={t('conversation.search')}>
            <Button variant="ghost" size="icon" className={panelBtn(panel?.type === 'search')} onClick={() => onPanel(panel?.type === 'search' ? null : { type: 'search' })} aria-label={t('conversation.search')}>
              <Search className="size-4" />
            </Button>
          </Tooltip>
          <Tooltip label={t('conversation.details')}>
            <Button variant="ghost" size="icon" className={cn('hidden sm:inline-flex', panelBtn(panel?.type === 'details'))} onClick={() => onPanel(panel?.type === 'details' ? null : { type: 'details' })} aria-label={t('conversation.details')}>
              <Info className="size-4" />
            </Button>
          </Tooltip>
        </div>
      </header>

      <MessageActionsContext.Provider value={actions}>
        <Timeline
          conversationId={conversationId}
          meId={me.id}
          highlightId={highlightId}
          editingId={editingId}
          onEditingChange={setEditingId}
          onOpenThread={openThread}
          onOpenImage={setLightbox}
          channelName={conv.name}
          isDm={isDm}
        />
      </MessageActionsContext.Provider>

      <TypingIndicator conversationId={conversationId} meId={me.id} />
      <Composer
        conversationId={conversationId}
        draftKey={conversationId}
        placeholder={placeholder}
        members={members}
        allowChannelMention={!isDm}
        meId={me.id}
        onEditLast={editLast}
        autoFocus
      />
      <DeleteMessageDialog message={deleting} onClose={() => setDeleting(null)} />
    </section>
  );
}
