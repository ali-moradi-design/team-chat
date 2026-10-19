import {
  CornerUpLeft,
  Link2,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  SmilePlus,
  Trash2,
  Copy,
} from 'lucide-react';
import { Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { Message } from '@team-chat/shared';
import { emitAckAction, toggleReaction } from '@/entities/message';
import { LazyEmojiPicker } from '@/features/emoji-picker';
import {
  Button,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Spinner,
  Tooltip,
} from '@/shared/ui';
import { useMessageActions } from '../model/context';

const QUICK = ['👍', '❤️', '😂'];

export function messageLink(m: Message): string {
  return `${location.origin}/c/${m.conversationId}?m=${m.id}`;
}

export function MessageToolbar({ message: m }: { message: Message }) {
  const { t } = useTranslation();
  const ctx = useMessageActions();
  const [pickerOpen, setPickerOpen] = useState(false);
  const canEdit = m.authorId === ctx.meId;
  const canDelete = canEdit || ctx.isAdmin || ctx.isChannelManager;
  const canPin = !m.threadRootId;

  const copy = async (text: string, ok: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(ok);
    } catch {
      toast.error(t('common.error'));
    }
  };

  const pin = async () => {
    const res = await emitAckAction('message:pin', { messageId: m.id, pinned: !m.pinned });
    if (!res.ok) toast.error(t('message.pinFailed'));
  };

  return (
    <div
      role="toolbar"
      aria-label={t('message.more')}
      className="flex items-center gap-0.5 rounded-xl border border-line bg-panel p-0.5 shadow-pop"
    >
      {QUICK.map((e) => (
        <Button
          key={e}
          variant="ghost"
          size="icon-sm"
          aria-label={e}
          onClick={() => toggleReaction(m, e, ctx.meId)}
          className="text-base"
        >
          {e}
        </Button>
      ))}
      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <Tooltip label={t('message.react')}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={t('message.react')}>
              <SmilePlus className="size-4" />
            </Button>
          </PopoverTrigger>
        </Tooltip>
        <PopoverContent align="end">
          <Suspense
            fallback={
              <div className="grid h-60 w-72 place-items-center">
                <Spinner />
              </div>
            }
          >
            <LazyEmojiPicker
              onPick={(e) => {
                toggleReaction(m, e, ctx.meId);
                setPickerOpen(false);
              }}
            />
          </Suspense>
        </PopoverContent>
      </Popover>
      {!ctx.inThread && (
        <Tooltip label={t('message.replyInThread')}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t('message.replyInThread')}
            onClick={() => ctx.onReply(m)}
          >
            <CornerUpLeft className="size-4 rtl:-scale-x-100" />
          </Button>
        </Tooltip>
      )}
      <Menu>
        <Tooltip label={t('message.more')}>
          <MenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={t('message.more')}>
              <MoreHorizontal className="size-4" />
            </Button>
          </MenuTrigger>
        </Tooltip>
        <MenuContent align="end">
          {canEdit && (
            <MenuItem icon={<Pencil className="size-4" />} onSelect={() => ctx.onEdit(m)}>
              {t('message.edit')}
            </MenuItem>
          )}
          {canPin && (
            <MenuItem
              icon={m.pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
              onSelect={() => void pin()}
            >
              {m.pinned ? t('message.unpin') : t('message.pin')}
            </MenuItem>
          )}
          {m.text && (
            <MenuItem
              icon={<Copy className="size-4" />}
              onSelect={() => void copy(m.text, t('message.textCopied'))}
            >
              {t('message.copyText')}
            </MenuItem>
          )}
          <MenuItem
            icon={<Link2 className="size-4" />}
            onSelect={() => void copy(messageLink(m), t('message.linkCopied'))}
          >
            {t('message.copyLink')}
          </MenuItem>
          {canDelete && (
            <>
              <MenuSeparator />
              <MenuItem
                danger
                icon={<Trash2 className="size-4" />}
                onSelect={() => ctx.onDelete(m)}
              >
                {t('message.delete')}
              </MenuItem>
            </>
          )}
        </MenuContent>
      </Menu>
    </div>
  );
}
