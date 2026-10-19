import { useEffect } from 'react';
import { toast } from 'sonner';
import { toPlainPreview, type Message } from '@team-chat/shared';
import { i18next } from '@/shared/i18n';
import { notificationPermission } from '@/shared/lib/browser-notifications';
import { usePrefs } from '@/shared/lib/prefs';

export interface IncomingContext {
  authorName: string;
  conversationTitle: string;
  isDm: boolean;
  muted: boolean;
  /** The user is looking at this conversation right now. */
  viewing: boolean;
  mentioned: boolean;
  open: () => void;
}

/** Decides how loudly to announce a message. Mentions and DMs notify; everything else stays quiet. */
export function notifyIncoming(m: Message, ctx: IncomingContext): void {
  if (ctx.viewing || ctx.muted || m.threadRootId) return;
  if (!ctx.mentioned && !ctx.isDm) return;
  const t = i18next.t.bind(i18next);
  const title = ctx.isDm
    ? t('notifications.dmFrom', { name: ctx.authorName })
    : t('notifications.mentionIn', { name: ctx.authorName, where: ctx.conversationTitle });
  const body = toPlainPreview(m.text, 140) || t('notifications.attachment');

  if (document.visibilityState === 'hidden') {
    if (usePrefs.getState().browserNotifications && notificationPermission() === 'granted') {
      const n = new Notification(title, { body, tag: m.conversationId, icon: '/favicon.svg' });
      n.onclick = () => {
        window.focus();
        ctx.open();
        n.close();
      };
    }
    return;
  }
  toast(title, {
    description: body,
    action: { label: t('notifications.open'), onClick: ctx.open },
    duration: 6000,
  });
}

/** "(3) Team Chat" — mentions are shown as "(@2)". */
export function useUnreadTitle(unread: number, mentions: number): void {
  useEffect(() => {
    const base = i18next.t('common.appName');
    document.title =
      mentions > 0 ? `(@${mentions}) ${base}` : unread > 0 ? `(${unread}) ${base}` : base;
  }, [unread, mentions]);
}
