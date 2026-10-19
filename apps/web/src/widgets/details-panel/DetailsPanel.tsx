import { BellOff, Bell, LogOut, Pencil, UserMinus, UserPlus, X, Pin } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import type { Message } from '@team-chat/shared';
import { useConversation, useConversations } from '@/entities/conversation';
import { useSession } from '@/entities/session';
import { useUsers, UserAvatar } from '@/entities/user';
import { useConversationTitle } from '@/features/conversation-title';
import { api } from '@/shared/api/http';
import { useDialogs } from '@/shared/lib/dialogs';
import { useFormatters } from '@/shared/lib/format';
import { Button, Dialog, EmptyState, Input, Skeleton } from '@/shared/ui';

function PanelHeader({ title, onClose }: { title: string; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between border-b border-line px-4 py-3">
      <h2 className="min-w-0 truncate font-semibold" dir="auto">
        {title}
      </h2>
      <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label={t('common.close')}>
        <X className="size-4" />
      </Button>
    </div>
  );
}

export function DetailsPanel({
  conversationId,
  onClose,
}: {
  conversationId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const f = useFormatters();
  const me = useSession((s) => s.me)!;
  const conv = useConversation(conversationId);
  const users = useUsers((s) => s.byId);
  const presence = useUsers((s) => s.presence);
  const titleOf = useConversationTitle();
  const setAddPeople = useDialogs((s) => s.setAddPeople);
  const navigate = useNavigate();
  const [editing, setEditing] = useState<'topic' | 'description' | null>(null);
  const [draft, setDraft] = useState('');
  const [confirmLeave, setConfirmLeave] = useState(false);

  if (!conv) return null;
  const isChannel = conv.type === 'channel';
  const myRole = conv.members.find((m) => m.userId === me.id)?.role;
  const manager = isChannel && (myRole === 'owner' || me.role === 'admin');

  const save = async () => {
    if (!editing) return;
    try {
      await api(`/api/conversations/${conv.id}`, { method: 'PATCH', body: { [editing]: draft } });
      setEditing(null);
    } catch {
      toast.error(t('common.error'));
    }
  };

  const mute = async () => {
    const next = !conv.muted;
    useConversations.getState().setMuted(conv.id, next);
    try {
      await api(`/api/conversations/${conv.id}/mute`, { method: 'PUT', body: { muted: next } });
    } catch {
      useConversations.getState().setMuted(conv.id, !next);
      toast.error(t('common.error'));
    }
  };

  const leave = async () => {
    try {
      await api(`/api/conversations/${conv.id}/leave`, { method: 'POST' });
      setConfirmLeave(false);
      void navigate('/');
    } catch {
      toast.error(t('common.error'));
    }
  };

  const remove = async (userId: string) => {
    try {
      await api(`/api/conversations/${conv.id}/members/${userId}`, { method: 'DELETE' });
    } catch {
      toast.error(t('common.error'));
    }
  };

  const section = 'border-b border-line px-4 py-3.5';
  return (
    <aside className="flex h-full min-h-0 flex-col bg-panel" aria-label={t('conversation.details')}>
      <PanelHeader
        title={isChannel ? `${conv.isPrivate ? '🔒 ' : '# '}${conv.name}` : titleOf(conv)}
        onClose={onClose}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {isChannel && (
          <>
            <section className={section}>
              <div className="mb-1 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {t('conversation.topic')}
                </h3>
                {editing !== 'topic' && (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={t('common.edit')}
                    onClick={() => (setDraft(conv.topic ?? ''), setEditing('topic'))}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                )}
              </div>
              {editing === 'topic' ? (
                <div className="flex gap-2">
                  <Input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    maxLength={160}
                    placeholder={t('conversation.topicPlaceholder')}
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && void save()}
                  />
                  <Button variant="primary" size="sm" onClick={() => void save()}>
                    {t('common.save')}
                  </Button>
                </div>
              ) : (
                <p className="text-sm" dir="auto">
                  {conv.topic || <span className="text-muted">{t('conversation.topicEmpty')}</span>}
                </p>
              )}
            </section>
            <section className={section}>
              <div className="mb-1 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {t('conversation.description')}
                </h3>
                {manager && editing !== 'description' && (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={t('common.edit')}
                    onClick={() => (setDraft(conv.description ?? ''), setEditing('description'))}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                )}
              </div>
              {editing === 'description' ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    maxLength={500}
                    rows={3}
                    dir="auto"
                    className="rounded-xl border border-line bg-elevated p-2.5 text-sm focus:border-accent focus:outline-none"
                  />
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                      {t('common.cancel')}
                    </Button>
                    <Button size="sm" variant="primary" onClick={() => void save()}>
                      {t('common.save')}
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm" dir="auto">
                  {conv.description || (
                    <span className="text-muted">{t('conversation.noDescription')}</span>
                  )}
                </p>
              )}
              <p className="mt-2 text-xs text-faint">
                {t('conversation.createdOn', { date: f.dateTime(conv.createdAt) })}
              </p>
            </section>
          </>
        )}

        <section className={section}>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
              {t('conversation.members')} · {f.number(conv.members.length)}
            </h3>
            {isChannel && (!conv.isPrivate || manager) && (
              <Button size="sm" variant="ghost" onClick={() => setAddPeople(conv.id)}>
                <UserPlus className="size-4" /> {t('conversation.invite')}
              </Button>
            )}
          </div>
          <ul className="-mx-1.5">
            {conv.members.map((m) => {
              const u = users[m.userId];
              const status = u?.isBot ? 'online' : (presence[m.userId] ?? 'offline');
              return (
                <li
                  key={m.userId}
                  className="group flex items-center gap-3 rounded-xl px-1.5 py-1.5 hover:bg-elevated"
                >
                  <UserAvatar userId={m.userId} withPresence />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium" dir="auto">
                      {u?.name ?? t('common.unknownUser')}
                      {m.userId === me.id && (
                        <span className="text-muted"> ({t('common.you')})</span>
                      )}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {m.role === 'owner' && isChannel ? `${t('conversation.owner')} · ` : ''}
                      {t(`presence.${status}`)}
                    </span>
                  </span>
                  {manager && m.userId !== me.id && (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
                      aria-label={t('conversation.removeMember')}
                      onClick={() => void remove(m.userId)}
                    >
                      <UserMinus className="size-4" />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <section className="flex flex-col gap-1 p-3">
          <Button variant="ghost" className="justify-start" onClick={() => void mute()}>
            {conv.muted ? <Bell className="size-4" /> : <BellOff className="size-4" />}
            {conv.muted ? t('conversation.unmute') : t('conversation.mute')}
          </Button>
          {isChannel && (
            <Button
              variant="ghost"
              className="justify-start text-danger-ink"
              onClick={() => setConfirmLeave(true)}
            >
              <LogOut className="size-4" /> {t('conversation.leave')}
            </Button>
          )}
        </section>
      </div>

      <Dialog
        open={confirmLeave}
        onOpenChange={setConfirmLeave}
        title={t('conversation.leaveConfirm', { name: conv.name })}
        description={t('conversation.leaveConfirmBody')}
      >
        <div className="flex justify-end gap-2 p-4">
          <Button variant="ghost" onClick={() => setConfirmLeave(false)}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" onClick={() => void leave()}>
            {t('conversation.leave')}
          </Button>
        </div>
      </Dialog>
    </aside>
  );
}

export function PinsPanel({
  conversationId,
  onJump,
  onClose,
}: {
  conversationId: string;
  onJump: (m: Message) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const f = useFormatters();
  const users = useUsers((s) => s.byId);
  const q = useQuery({
    queryKey: ['pins', conversationId],
    queryFn: () => api<{ messages: Message[] }>(`/api/conversations/${conversationId}/pins`),
    staleTime: 0,
  });
  return (
    <aside className="flex h-full min-h-0 flex-col bg-panel" aria-label={t('pins.title')}>
      <PanelHeader title={t('pins.title')} onClose={onClose} />
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {q.isLoading && <Skeleton className="m-2 h-16" />}
        {q.data?.messages.length === 0 && (
          <EmptyState icon={<Pin className="size-6" />} title={t('pins.empty')}>
            {t('pins.emptyBody')}
          </EmptyState>
        )}
        <ul>
          {q.data?.messages.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => onJump(m)}
                className="flex w-full gap-3 rounded-xl px-3 py-2.5 text-start hover:bg-elevated"
              >
                <UserAvatar userId={m.authorId} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2 text-xs text-muted">
                    <span className="truncate font-semibold text-fg" dir="auto">
                      {users[m.authorId]?.name ?? t('common.unknownUser')}
                    </span>
                    <time className="ms-auto shrink-0">{f.dateTime(m.createdAt)}</time>
                  </span>
                  <span className="line-clamp-4 text-sm" dir="auto">
                    {m.text || m.attachments[0]?.name}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
