import { Hash, Lock, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import type { ConversationSummary } from '@team-chat/shared';
import { useConversations } from '@/entities/conversation';
import { useSession } from '@/entities/session';
import { useUsers, UserAvatar } from '@/entities/user';
import { useConversationTitle } from '@/features/conversation-title';
import { api } from '@/shared/api/http';
import { cn } from '@/shared/lib/cn';
import { useDialogs } from '@/shared/lib/dialogs';
import { CountBadge, Dialog } from '@/shared/ui';

interface Row {
  key: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  badge?: number;
  run: () => void | Promise<void>;
}

/** Subsequence match: "dsgn" finds "design-team". Lower score = better. */
function score(label: string, q: string): number {
  const l = label.toLowerCase();
  if (!q) return 0;
  const idx = l.indexOf(q);
  if (idx >= 0) return idx === 0 ? 0 : 1 + idx / 100;
  let i = 0;
  for (const ch of l) if (ch === q[i]) i++;
  return i === q.length ? 5 : Infinity;
}

export function QuickSwitcher({ onSearch }: { onSearch: (q: string) => void }) {
  const { t } = useTranslation();
  const open = useDialogs((s) => s.quick);
  const close = useDialogs((s) => s.close);
  const navigate = useNavigate();
  const titleOf = useConversationTitle();
  const convs = useConversations((s) => s.byId);
  const users = useUsers((s) => s.byId);
  const me = useSession((s) => s.me)!;
  const [q, setQ] = useState('');
  const [index, setIndex] = useState(0);
  const list = useRef<HTMLUListElement>(null);

  // Clear on close, not on open: an effect after opening could wipe what was already typed.
  useEffect(() => {
    if (!open) {
      setQ('');
      setIndex(0);
    }
  }, [open]);

  const rows = useMemo<Row[]>(() => {
    const needle = q.trim().toLowerCase();
    const go = (id: string) => () => {
      close('quick');
      void navigate(`/c/${id}`);
    };
    const convRows = Object.values(convs)
      .map((c: ConversationSummary) => ({ c, s: score(titleOf(c), needle) }))
      .filter((x) => x.s !== Infinity)
      .sort(
        (a, b) =>
          a.s - b.s ||
          b.c.unreadCount - a.c.unreadCount ||
          titleOf(a.c).localeCompare(titleOf(b.c)),
      )
      .slice(0, 8)
      .map<Row>(({ c }) => ({
        key: c.id,
        label: titleOf(c),
        badge: c.unreadCount,
        icon:
          c.type === 'dm' ? (
            <UserAvatar
              userId={c.members.find((m) => m.userId !== me.id)?.userId ?? me.id}
              size="xs"
            />
          ) : c.isPrivate ? (
            <Lock className="size-4" />
          ) : (
            <Hash className="size-4" />
          ),
        hint: c.type === 'channel' ? t('quick.channels') : t('quick.people'),
        run: go(c.id),
      }));
    const dmPeers = new Set(
      Object.values(convs)
        .filter((c) => c.type === 'dm' && c.members.length === 2)
        .flatMap((c) => c.members.map((m) => m.userId)),
    );
    const userRows = needle
      ? Object.values(users)
          .filter(
            (u) =>
              u.id !== me.id &&
              !dmPeers.has(u.id) &&
              (score(u.name, needle) !== Infinity || u.handle.includes(needle)),
          )
          .slice(0, 4)
          .map<Row>((u) => ({
            key: `u-${u.id}`,
            label: t('quick.dm', { name: u.name }),
            hint: `@${u.handle}`,
            icon: <UserAvatar userId={u.id} size="xs" />,
            run: async () => {
              try {
                const { conversation } = await api<{ conversation: ConversationSummary }>(
                  '/api/conversations/dm',
                  { body: { userIds: [u.id] } },
                );
                useConversations.getState().upsert(conversation);
                close('quick');
                void navigate(`/c/${conversation.id}`);
              } catch {
                toast.error(t('common.error'));
              }
            },
          }))
      : [];
    const searchRow: Row[] =
      q.trim().length >= 2
        ? [
            {
              key: 'search',
              label: t('quick.searchFor', { q: q.trim() }),
              icon: <Search className="size-4" />,
              run: () => (close('quick'), onSearch(q.trim())),
            },
          ]
        : [];
    return [...convRows, ...userRows, ...searchRow];
  }, [q, convs, users, titleOf, me.id, navigate, close, onSearch, t]);

  useEffect(() => setIndex(0), [q]);
  useEffect(() => {
    list.current?.children[index]?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, rows.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      void rows[index]?.run();
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && close('quick')}
      title={t('quick.title')}
      mobileSheet
      className="sm:top-[10vh]"
    >
      <div onKeyDown={onKey}>
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="size-4 shrink-0 text-muted" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('quick.placeholder')}
            aria-label={t('quick.placeholder')}
            role="combobox"
            aria-expanded="true"
            aria-controls="qs-list"
            dir="auto"
            className="h-12 w-full bg-transparent text-[15px] placeholder:text-faint focus:outline-none"
          />
        </div>
        <ul id="qs-list" ref={list} role="listbox" className="max-h-[50vh] overflow-y-auto p-1.5">
          {rows.length === 0 && (
            <li className="p-6 text-center text-sm text-muted">{t('quick.none')}</li>
          )}
          {rows.map((r, i) => (
            <li key={r.key} role="option" aria-selected={i === index}>
              <button
                type="button"
                onMouseMove={() => setIndex(i)}
                onClick={() => void r.run()}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-start text-sm',
                  i === index && 'bg-elevated',
                )}
              >
                <span className="grid size-5 place-items-center text-muted">{r.icon}</span>
                <span className="min-w-0 flex-1 truncate" dir="auto">
                  {r.label}
                </span>
                {r.hint && <span className="shrink-0 text-xs text-faint">{r.hint}</span>}
                {r.badge ? <CountBadge count={r.badge} /> : null}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Dialog>
  );
}
