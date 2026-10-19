import { AlertCircle, CornerDownRight, FileText, Loader2, Pin } from 'lucide-react';
import { memo, useState, type ComponentType, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { Attachment, Message } from '@team-chat/shared';
import { cn } from '@/shared/lib/cn';
import { useFormatters } from '@/shared/lib/format';
import { Avatar, RichText, Tooltip, type MentionInfo } from '@/shared/ui';
import type { PendingMessage } from '../model/store';

export interface AuthorView {
  id: string;
  name: string;
  hue: number;
  isBot: boolean;
}

export interface MessageItemProps {
  message: Message;
  author: AuthorView;
  grouped: boolean;
  meId: string;
  /** Flash highlight after "jump to message". */
  highlighted?: boolean;
  /** Inside the thread panel: no thread summary, compact. */
  inThread?: boolean;
  resolveMention: (handle: string) => MentionInfo | null;
  nameOf: (userId: string) => string;
  Toolbar?: ComponentType<{ message: Message }>;
  onToggleReaction: (message: Message, emoji: string) => void;
  onOpenThread?: (message: Message) => void;
  onOpenImage?: (a: Attachment) => void;
  /** Extra row content (e.g. "seen by"). */
  footer?: ReactNode;
}

function ImageAttachment({
  a,
  onOpen,
}: {
  a: Attachment;
  onOpen?: ((a: Attachment) => void) | undefined;
}) {
  const [loaded, setLoaded] = useState(false);
  const ratio = a.width && a.height ? a.width / a.height : 4 / 3;
  return (
    <button
      type="button"
      onClick={() => onOpen?.(a)}
      className="group/img relative block max-w-[min(22rem,100%)] overflow-hidden rounded-xl border border-line bg-elevated"
      style={{
        aspectRatio: String(ratio),
        width: `min(${Math.max(Math.min(a.width ?? 352, 352), 64)}px, 100%)`,
      }}
      aria-label={a.name}
    >
      <img
        src={a.thumbUrl ?? a.url}
        alt={a.name}
        width={a.width}
        height={a.height}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={cn(
          'size-full object-cover transition-opacity duration-200',
          loaded ? 'opacity-100' : 'opacity-0',
        )}
      />
      {!loaded && <span className="skeleton absolute inset-0" />}
    </button>
  );
}

export function FileAttachment({ a }: { a: Attachment }) {
  const f = useFormatters();
  return (
    <a
      href={a.url}
      download={a.name}
      className="flex max-w-80 items-center gap-3 rounded-xl border border-line bg-panel px-3 py-2.5 transition-colors hover:bg-elevated"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-mention text-accent-ink">
        <FileText className="size-4.5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium" dir="auto">
          {a.name}
        </span>
        <span className="block text-xs text-muted">{f.bytes(a.size)}</span>
      </span>
    </a>
  );
}

export function Attachments({
  items,
  onOpenImage,
}: {
  items: Attachment[];
  onOpenImage?: ((a: Attachment) => void) | undefined;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-2">
      {items.map((a) =>
        a.kind === 'image' ? (
          <ImageAttachment key={a.fileId} a={a} onOpen={onOpenImage} />
        ) : (
          <FileAttachment key={a.fileId} a={a} />
        ),
      )}
    </div>
  );
}

export const MessageItem = memo(function MessageItem(p: MessageItemProps) {
  const { message: m, author, grouped } = p;
  const { t } = useTranslation();
  const f = useFormatters();
  const mentioned = m.mentions.includes(p.meId) || m.mentionsAll;
  const deleted = !!m.deletedAt;
  const Toolbar = p.Toolbar;

  return (
    <article
      data-message-id={m.id}
      // Focusable so a tap reveals the action toolbar on touch screens (no hover there).
      tabIndex={-1}
      aria-label={`${author.name}, ${f.time(m.createdAt)}`}
      className={cn(
        'msg-row group/msg relative flex gap-3 rounded-xl px-3 outline-none transition-colors hover:bg-elevated/60 focus-within:bg-elevated/60',
        grouped ? 'py-0.5' : 'pt-2 pb-0.5',
        mentioned &&
          !deleted &&
          'bg-mention hover:bg-mention before:absolute before:inset-y-1 before:start-0 before:w-0.5 before:rounded-full before:bg-accent',
        p.highlighted && 'animate-pulse bg-mention',
      )}
    >
      <div className="w-9 shrink-0 pt-0.5">
        {grouped ? (
          <span className="invisible block pt-1 text-center text-[10px] text-faint group-hover/msg:visible">
            {f.time(m.createdAt)}
          </span>
        ) : (
          <Avatar name={author.name} hue={author.hue} isBot={author.isBot} />
        )}
      </div>

      <div className="min-w-0 flex-1">
        {!grouped && (
          <header className="flex items-baseline gap-2">
            <span className="truncate font-semibold" dir="auto">
              {author.name}
            </span>
            {author.isBot && (
              <span className="rounded bg-elevated-2 px-1 text-[10px] font-semibold uppercase text-muted">
                {t('message.bot')}
              </span>
            )}
            <Tooltip label={f.dateTime(m.createdAt)}>
              <time dateTime={m.createdAt} className="shrink-0 text-xs text-muted">
                {f.time(m.createdAt)}
              </time>
            </Tooltip>
            {m.editedAt && !deleted && (
              <span className="text-[11px] text-faint">{t('message.edited')}</span>
            )}
            {m.pinned && !deleted && (
              <span className="inline-flex items-center gap-1 text-[11px] text-accent-ink">
                <Pin className="size-3" /> {t('message.pinned')}
              </span>
            )}
          </header>
        )}

        {deleted ? (
          <p className="text-sm italic text-faint">{t('message.deleted')}</p>
        ) : (
          <>
            {m.text && (
              <RichText
                text={m.text}
                resolveMention={p.resolveMention}
                className="text-[15px] leading-relaxed"
              />
            )}
            {grouped && m.editedAt && (
              <span className="text-[11px] text-faint">{t('message.edited')}</span>
            )}
            <Attachments items={m.attachments} onOpenImage={p.onOpenImage} />
            {m.reactions.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {m.reactions.map((r) => {
                  const mine = r.userIds.includes(p.meId);
                  return (
                    <Tooltip key={r.emoji} label={r.userIds.map(p.nameOf).join(', ')}>
                      <button
                        type="button"
                        aria-pressed={mine}
                        onClick={() => p.onToggleReaction(m, r.emoji)}
                        className={cn(
                          'inline-flex h-6 items-center gap-1.5 rounded-full border px-2 text-xs font-medium transition-colors',
                          mine
                            ? 'border-accent/60 bg-mention text-accent-ink'
                            : 'border-line bg-elevated text-muted hover:border-line-strong',
                        )}
                      >
                        <span className="text-[13px] leading-none">{r.emoji}</span>
                        <span>{r.userIds.length}</span>
                      </button>
                    </Tooltip>
                  );
                })}
              </div>
            )}
          </>
        )}

        {!p.inThread && m.replyCount > 0 && (
          <button
            type="button"
            onClick={() => p.onOpenThread?.(m)}
            className="mt-1 inline-flex items-center gap-1.5 rounded-lg px-1.5 py-0.5 text-xs font-medium text-accent-ink hover:bg-mention"
          >
            <CornerDownRight className="size-3.5 rtl:-scale-x-100" />
            {t('message.replies', { count: m.replyCount })}
            {m.lastReplyAt && (
              <span className="font-normal text-muted">· {f.relative(m.lastReplyAt)}</span>
            )}
          </button>
        )}
        {p.footer}
      </div>

      {Toolbar && !deleted && (
        <div className="absolute -top-3.5 end-3 z-10 hidden group-hover/msg:flex group-focus-within/msg:flex">
          <Toolbar message={m} />
        </div>
      )}
    </article>
  );
});

export const PendingItem = memo(function PendingItem({
  pending,
  author,
  grouped,
  onRetry,
  onDiscard,
  resolveMention,
  onOpenImage,
}: {
  pending: PendingMessage;
  author: AuthorView;
  grouped: boolean;
  onRetry: (p: PendingMessage) => void;
  onDiscard: (p: PendingMessage) => void;
  resolveMention: (handle: string) => MentionInfo | null;
  onOpenImage?: (a: Attachment) => void;
}) {
  const { t } = useTranslation();
  const f = useFormatters();
  const failed = pending.status === 'failed';
  return (
    <article
      className={cn('msg-row flex gap-3 rounded-xl px-3', grouped ? 'py-0.5' : 'pt-2 pb-0.5')}
      aria-busy={!failed}
    >
      <div className="w-9 shrink-0 pt-0.5">
        {!grouped && <Avatar name={author.name} hue={author.hue} isBot={author.isBot} />}
      </div>
      <div className={cn('min-w-0 flex-1', !failed && 'opacity-60')}>
        {!grouped && (
          <header className="flex items-baseline gap-2">
            <span className="font-semibold" dir="auto">
              {author.name}
            </span>
            <time className="text-xs text-muted">{f.time(pending.createdAt)}</time>
          </header>
        )}
        {pending.text && (
          <RichText
            text={pending.text}
            resolveMention={resolveMention}
            className="text-[15px] leading-relaxed"
          />
        )}
        <Attachments items={pending.attachments} onOpenImage={onOpenImage} />
        {failed ? (
          <div
            role="alert"
            className="mt-1 flex flex-wrap items-center gap-2 text-xs text-danger-ink"
          >
            <AlertCircle className="size-3.5" />
            <span>{t('message.failed')}</span>
            <button
              type="button"
              className="font-semibold underline"
              onClick={() => onRetry(pending)}
            >
              {t('common.retry')}
            </button>
            <button
              type="button"
              className="text-muted underline"
              onClick={() => onDiscard(pending)}
            >
              {t('message.discard')}
            </button>
          </div>
        ) : (
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-faint">
            <Loader2 className="size-3 animate-spin" /> {t('message.sending')}
          </div>
        )}
      </div>
    </article>
  );
});
