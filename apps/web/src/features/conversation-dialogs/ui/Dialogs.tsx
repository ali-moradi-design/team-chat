import { Hash, Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { createChannelBody, type Conversation, type ConversationSummary } from '@team-chat/shared';
import { useConversations } from '@/entities/conversation';
import { useSession } from '@/entities/session';
import { api, ApiClientError } from '@/shared/api/http';
import { useDialogs } from '@/shared/lib/dialogs';
import { Button, Dialog, EmptyState, Field, Input, Spinner, Switch } from '@/shared/ui';
import { PeoplePicker } from './PeoplePicker';

const toggle = (list: string[], id: string) =>
  list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

function CreateChannelDialog() {
  const { t } = useTranslation();
  const open = useDialogs((s) => s.createChannel);
  const close = useDialogs((s) => s.close);
  const navigate = useNavigate();
  const me = useSession((s) => s.me)!;
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [isPrivate, setPrivate] = useState(false);
  const [members, setMembers] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName('');
      setTopic('');
      setPrivate(false);
      setMembers([]);
      setError(undefined);
    }
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = createChannelBody.safeParse({
      name,
      topic: topic.trim() || undefined,
      isPrivate,
      memberIds: members,
    });
    if (!parsed.success) return setError(t('dialogs.nameTooShort'));
    setBusy(true);
    try {
      const { conversation } = await api<{ conversation: ConversationSummary }>(
        '/api/conversations',
        { body: parsed.data },
      );
      useConversations.getState().upsert(conversation);
      toast.success(t('dialogs.created'));
      close('createChannel');
      void navigate(`/c/${conversation.id}`);
    } catch (err) {
      setError(
        err instanceof ApiClientError && err.status === 409
          ? t('dialogs.nameTaken')
          : t('common.error'),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && close('createChannel')}
      title={t('dialogs.createChannelTitle')}
      description={t('dialogs.createChannelBody')}
      mobileSheet
    >
      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4 p-5">
        <Field label={t('dialogs.channelName')} hint={t('dialogs.channelNameHint')} error={error}>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 start-3 grid place-items-center text-muted">
              {isPrivate ? <Lock className="size-4" /> : <Hash className="size-4" />}
            </span>
            <Input
              value={name}
              onChange={(e) => (setName(e.target.value), setError(undefined))}
              className="ps-9"
              maxLength={48}
              autoFocus
              aria-invalid={!!error}
            />
          </div>
        </Field>
        <Field label={`${t('dialogs.channelTopic')} (${t('common.optional')})`}>
          <Input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={160} />
        </Field>
        <label className="flex items-center justify-between gap-4 rounded-xl border border-line px-3.5 py-3">
          <span>
            <span className="block text-sm font-medium">{t('dialogs.channelPrivate')}</span>
            <span className="block text-xs text-muted">{t('dialogs.channelPrivateHint')}</span>
          </span>
          <Switch
            checked={isPrivate}
            onCheckedChange={setPrivate}
            aria-label={t('dialogs.channelPrivate')}
          />
        </label>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t('dialogs.channelMembers')}</span>
          <PeoplePicker
            exclude={[me.id]}
            selected={members}
            onToggle={(id) => setMembers((m) => toggle(m, id))}
            maxHeight="max-h-44"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => close('createChannel')}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={busy || name.trim().length < 2}>
            {t('common.create')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function NewDmDialog() {
  const { t } = useTranslation();
  const open = useDialogs((s) => s.newDm);
  const close = useDialogs((s) => s.close);
  const navigate = useNavigate();
  const me = useSession((s) => s.me)!;
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setPicked([]);
  }, [open]);

  const start = async () => {
    setBusy(true);
    try {
      const { conversation } = await api<{ conversation: ConversationSummary }>(
        '/api/conversations/dm',
        { body: { userIds: picked } },
      );
      useConversations.getState().upsert(conversation);
      close('newDm');
      void navigate(`/c/${conversation.id}`);
    } catch {
      toast.error(t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && close('newDm')}
      title={t('dialogs.newDmTitle')}
      description={t('dialogs.newDmBody')}
      mobileSheet
    >
      <div className="flex flex-col gap-4 p-5">
        <PeoplePicker
          exclude={[me.id]}
          selected={picked}
          onToggle={(id) => setPicked((p) => toggle(p, id))}
          maxHeight="max-h-72"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-muted">
            {picked.length > 0 && t('dialogs.selected', { count: picked.length })}
          </span>
          <Button
            variant="primary"
            disabled={picked.length === 0 || busy}
            onClick={() => void start()}
          >
            {t('dialogs.newDmStart')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function BrowseDialog() {
  const { t } = useTranslation();
  const open = useDialogs((s) => s.browse);
  const close = useDialogs((s) => s.close);
  const navigate = useNavigate();
  const q = useQuery({
    queryKey: ['browse-channels'],
    queryFn: () => api<{ channels: Conversation[] }>('/api/conversations/browse'),
    enabled: open,
    staleTime: 0,
  });
  const [joining, setJoining] = useState<string>();

  const join = async (c: Conversation) => {
    setJoining(c.id);
    try {
      const { conversation } = await api<{ conversation: ConversationSummary }>(
        `/api/conversations/${c.id}/join`,
        { method: 'POST' },
      );
      useConversations.getState().upsert(conversation);
      toast.success(t('dialogs.joined', { name: c.name }));
      close('browse');
      void navigate(`/c/${c.id}`);
    } catch {
      toast.error(t('common.error'));
    } finally {
      setJoining(undefined);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && close('browse')}
      title={t('dialogs.browseTitle')}
      mobileSheet
    >
      <div className="p-2">
        {q.isLoading && (
          <div className="grid place-items-center p-10">
            <Spinner />
          </div>
        )}
        {q.data && q.data.channels.length === 0 && (
          <EmptyState icon={<Hash className="size-6" />} title={t('dialogs.browseEmpty')} />
        )}
        <ul>
          {q.data?.channels.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-elevated"
            >
              <Hash className="size-4 shrink-0 text-muted" />
              <button
                type="button"
                className="min-w-0 flex-1 text-start"
                onClick={() => void navigate(`/c/${c.id}`)}
              >
                <span className="block truncate text-sm font-medium" dir="auto">
                  {c.name}
                </span>
                <span className="block truncate text-xs text-muted" dir="auto">
                  {c.topic || t('sidebar.members', { count: c.members.length })}
                </span>
              </button>
              <Button
                size="sm"
                variant="secondary"
                disabled={joining === c.id}
                onClick={() => void join(c)}
              >
                {t('dialogs.join')}
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </Dialog>
  );
}

function AddPeopleDialog() {
  const { t } = useTranslation();
  const id = useDialogs((s) => s.addPeople);
  const setAddPeople = useDialogs((s) => s.setAddPeople);
  const conv = useConversations((s) => (id ? s.byId[id] : undefined));
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => setPicked([]), [id]);

  const add = async () => {
    if (!id) return;
    setBusy(true);
    try {
      await api(`/api/conversations/${id}/members`, { body: { userIds: picked } });
      setAddPeople(null);
    } catch {
      toast.error(t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={!!id && !!conv}
      onOpenChange={(o) => !o && setAddPeople(null)}
      title={t('dialogs.addPeopleTitle', { name: conv?.name ?? '' })}
      mobileSheet
    >
      <div className="flex flex-col gap-4 p-5">
        <PeoplePicker
          exclude={conv?.members.map((m) => m.userId) ?? []}
          selected={picked}
          onToggle={(x) => setPicked((p) => toggle(p, x))}
          maxHeight="max-h-72"
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setAddPeople(null)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={picked.length === 0 || busy}
            onClick={() => void add()}
          >
            {t('dialogs.add')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

export function ConversationDialogs() {
  return (
    <>
      <CreateChannelDialog />
      <NewDmDialog />
      <BrowseDialog />
      <AddPeopleDialog />
    </>
  );
}
