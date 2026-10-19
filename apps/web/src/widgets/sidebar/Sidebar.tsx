import {
  BellOff,
  ChevronDown,
  Compass,
  Hash,
  Keyboard,
  LogOut,
  Lock,
  MessageSquarePlus,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
  Users,
} from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { groupConversations, useConversation, useConversations } from '@/entities/conversation';
import { useSession } from '@/entities/session';
import { useUsers, UserAvatar } from '@/entities/user';
import { useConversationTitle } from '@/features/conversation-title';
import { cn } from '@/shared/lib/cn';
import { useDialogs } from '@/shared/lib/dialogs';
import { resolveDark, usePrefs } from '@/shared/lib/prefs';
import {
  Button,
  CountBadge,
  Kbd,
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
  Tooltip,
} from '@/shared/ui';

const ConversationRow = memo(function ConversationRow({
  id,
  active,
  onNavigate,
}: {
  id: string;
  active: boolean;
  onNavigate: () => void;
}) {
  const { t } = useTranslation();
  const conv = useConversation(id);
  const titleOf = useConversationTitle();
  const meId = useSession((s) => s.me?.id ?? '');
  if (!conv) return null;
  const peer =
    conv.type === 'dm' ? (conv.members.find((m) => m.userId !== meId)?.userId ?? meId) : undefined;
  const unread = conv.unreadCount > 0 && !conv.muted;
  const title = titleOf(conv);
  return (
    <li>
      <Link
        to={`/c/${conv.id}`}
        onClick={onNavigate}
        aria-current={active ? 'page' : undefined}
        aria-label={
          unread ? `${title}, ${t('sidebar.unreadBadge', { count: conv.unreadCount })}` : title
        }
        className={cn(
          'group flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[14px] transition-colors',
          active ? 'bg-primary text-primary-fg' : 'text-muted hover:bg-elevated hover:text-fg',
          unread && !active && 'font-semibold text-fg',
          conv.muted && !active && 'opacity-60',
        )}
      >
        <span className="grid w-5 shrink-0 place-items-center">
          {peer ? (
            <UserAvatar userId={peer} size="xs" withPresence />
          ) : conv.isPrivate ? (
            <Lock className="size-3.5" />
          ) : (
            <Hash className="size-4" />
          )}
        </span>
        <span className="min-w-0 flex-1 truncate" dir="auto">
          {title}
        </span>
        {conv.muted && (
          <BellOff className="size-3.5 shrink-0 opacity-70" aria-label={t('sidebar.muted')} />
        )}
        {!conv.muted && (
          <CountBadge
            count={conv.mentionCount > 0 ? conv.mentionCount : conv.unreadCount}
            mention={conv.mentionCount > 0}
            className={active ? 'bg-accent text-accent-fg' : ''}
          />
        )}
      </Link>
    </li>
  );
});

function Section({
  id,
  title,
  action,
  children,
}: {
  id: 'channels' | 'dms';
  title: string;
  action: React.ReactNode;
  children: React.ReactNode;
}) {
  const open = usePrefs((s) => s.sidebarSections[id]);
  const set = usePrefs((s) => s.set);
  const sections = usePrefs((s) => s.sidebarSections);
  return (
    <section>
      <div className="flex items-center justify-between px-1 pb-1">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => set({ sidebarSections: { ...sections, [id]: !open } })}
          className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-semibold uppercase tracking-wide text-muted hover:text-fg"
        >
          <ChevronDown
            className={cn('size-3.5 transition-transform', !open && '-rotate-90 rtl:rotate-90')}
          />
          {title}
        </button>
        {action}
      </div>
      {open && <ul className="flex flex-col gap-0.5">{children}</ul>}
    </section>
  );
}

export function Sidebar({
  activeId,
  onNavigate,
}: {
  activeId: string | null;
  onNavigate: () => void;
}) {
  const { t } = useTranslation();
  const me = useSession((s) => s.me)!;
  const logout = useSession((s) => s.logout);
  const byId = useConversations((s) => s.byId);
  const open = useDialogs((s) => s.open);
  const prefs = usePrefs();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const presence = useUsers((s) => s.presence[me.id]);

  const { channels, dms } = useMemo(() => {
    const g = groupConversations(byId);
    const keep = (c: { id: string; unreadCount: number }) =>
      !unreadOnly || c.unreadCount > 0 || c.id === activeId;
    return { channels: g.channels.filter(keep), dms: g.dms.filter(keep) };
  }, [byId, unreadOnly, activeId]);

  const dark = resolveDark(prefs.theme);
  const iconBtn = 'size-7';

  return (
    <nav aria-label={t('sidebar.channels')} className="flex h-full min-h-0 flex-col bg-panel">
      <div className="flex items-center gap-2.5 px-4 pb-2 pt-4">
        <span className="grid size-8 place-items-center rounded-xl bg-gradient-to-br from-accent to-primary text-accent-fg">
          <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden="true">
            <path d="M5 5a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-4l-4 4v-4H8a3 3 0 0 1-3-3z" />
          </svg>
        </span>
        <span className="min-w-0 flex-1 truncate text-[17px] font-bold tracking-tight">
          {t('common.appName')}
        </span>
        <Tooltip label={t('sidebar.newMessage')}>
          <Button
            variant="secondary"
            size="icon"
            onClick={() => open('newDm')}
            aria-label={t('sidebar.newMessage')}
          >
            <MessageSquarePlus className="size-4" />
          </Button>
        </Tooltip>
      </div>

      <div className="px-3 pb-2">
        <button
          type="button"
          onClick={() => open('quick')}
          className="flex h-9 w-full items-center gap-2 rounded-xl border border-line bg-elevated px-3 text-sm text-muted transition-colors hover:border-line-strong"
        >
          <Search className="size-4" />
          <span className="flex-1 truncate text-start">{t('sidebar.search')}</span>
          <Kbd>Ctrl K</Kbd>
        </button>
        <label className="mt-2 flex cursor-pointer items-center gap-2 px-1 text-xs text-muted">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => setUnreadOnly(e.target.checked)}
            className="size-3.5 accent-[var(--accent)]"
          />
          {t('sidebar.unreadOnly')}
        </label>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-2 pb-3 pt-1">
        <Section
          id="channels"
          title={t('sidebar.channels')}
          action={
            <Menu>
              <Tooltip label={t('sidebar.createChannel')}>
                <MenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className={iconBtn}
                    aria-label={t('sidebar.createChannel')}
                  >
                    <Plus className="size-4" />
                  </Button>
                </MenuTrigger>
              </Tooltip>
              <MenuContent align="end">
                <MenuItem icon={<Plus className="size-4" />} onSelect={() => open('createChannel')}>
                  {t('sidebar.createChannel')}
                </MenuItem>
                <MenuItem icon={<Compass className="size-4" />} onSelect={() => open('browse')}>
                  {t('sidebar.browseChannels')}
                </MenuItem>
              </MenuContent>
            </Menu>
          }
        >
          {channels.map((c) => (
            <ConversationRow
              key={c.id}
              id={c.id}
              active={c.id === activeId}
              onNavigate={onNavigate}
            />
          ))}
          {channels.length === 0 && (
            <li className="px-2.5 py-1 text-sm text-faint">
              {unreadOnly ? t('sidebar.nothingUnread') : t('sidebar.emptyChannels')}
            </li>
          )}
        </Section>
        <Section
          id="dms"
          title={t('sidebar.directMessages')}
          action={
            <Tooltip label={t('sidebar.newMessage')}>
              <Button
                variant="ghost"
                size="icon-sm"
                className={iconBtn}
                onClick={() => open('newDm')}
                aria-label={t('sidebar.newMessage')}
              >
                <Plus className="size-4" />
              </Button>
            </Tooltip>
          }
        >
          {dms.map((c) => (
            <ConversationRow
              key={c.id}
              id={c.id}
              active={c.id === activeId}
              onNavigate={onNavigate}
            />
          ))}
          {dms.length === 0 && (
            <li className="px-2.5 py-1 text-sm text-faint">
              {unreadOnly ? t('sidebar.nothingUnread') : t('sidebar.emptyDms')}
            </li>
          )}
        </Section>
      </div>

      <div className="flex items-center gap-1 border-t border-line p-2.5 safe-pb">
        <Menu>
          <MenuTrigger asChild>
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2 py-1.5 text-start hover:bg-elevated"
              aria-label={t('settings.profile')}
            >
              <UserAvatar userId={me.id} withPresence />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold" dir="auto">
                  {me.name}
                </span>
                <span className="block truncate text-xs text-muted">
                  {t(`presence.${presence ?? 'online'}`)}
                </span>
              </span>
            </button>
          </MenuTrigger>
          <MenuContent align="start" side="top" className="w-60">
            <MenuLabel>{t('settings.signedInAs', { name: me.name })}</MenuLabel>
            <MenuItem icon={<Settings className="size-4" />} onSelect={() => open('prefs')}>
              {t('settings.title')}
            </MenuItem>
            <MenuItem icon={<Keyboard className="size-4" />} onSelect={() => open('shortcuts')}>
              {t('settings.shortcuts')}
            </MenuItem>
            {me.role === 'admin' && (
              <MenuItem icon={<Users className="size-4" />} onSelect={() => open('admin')}>
                {t('sidebar.workspaceMembers')}
              </MenuItem>
            )}
            <MenuSeparator />
            <MenuItem danger icon={<LogOut className="size-4" />} onSelect={() => void logout()}>
              {t('auth.signOut')}
            </MenuItem>
          </MenuContent>
        </Menu>
        <Tooltip label={t('settings.theme')}>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('settings.theme')}
            onClick={() => prefs.set({ theme: dark ? 'light' : 'dark' })}
          >
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
        </Tooltip>
      </div>
    </nav>
  );
}
