import { memo } from 'react';
import type { ChatMessage } from '@/shared/lib/socket';
import { Avatar, Button } from '@/shared/ui';
import { cn, formatTime } from '@/shared/lib';

type Props = {
  message: ChatMessage;
  isOwn: boolean;
  showAvatar: boolean;
  onRetry?: (clientMsgId: string) => void;
};

function MessageBubbleComponent({ message, isOwn, showAvatar, onRetry }: Props) {
  const failed = message.status === 'failed';
  const pending = message.status === 'pending';

  return (
    <div
      className={cn(
        'group flex w-full gap-3 px-4 md:px-8',
        isOwn ? 'flex-row-reverse' : 'flex-row',
      )}
    >
      <div className={cn('w-9 shrink-0 pt-0.5', !showAvatar && 'invisible')}>
        {showAvatar ? <Avatar name={message.displayName} size="md" /> : null}
      </div>

      <div className={cn('flex max-w-[min(680px,82%)] flex-col gap-1', isOwn && 'items-end')}>
        {showAvatar ? (
          <div
            className={cn(
              'flex items-baseline gap-2 px-1.5 text-[11px] text-muted',
              isOwn && 'flex-row-reverse',
            )}
          >
            <span className="font-medium tracking-tight text-foreground/75">
              {message.displayName}
            </span>
            <time dateTime={message.createdAt} className="opacity-70">
              {formatTime(message.createdAt)}
            </time>
          </div>
        ) : null}

        <div
          className={cn(
            'whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-[15px] leading-[1.55]',
            'border shadow-[0_1px_0_rgba(255,255,255,0.03)]',
            isOwn
              ? 'rounded-br-md border-accent/25 bg-gradient-to-br from-accent/25 to-accent/10 text-foreground'
              : 'rounded-bl-md border-border/80 bg-elevated/90 text-foreground',
            failed && 'border-danger/40 bg-danger/10',
            pending && 'opacity-65',
          )}
        >
          {message.text}
        </div>

        {pending || failed ? (
          <div
            className={cn(
              'flex items-center gap-2 px-1.5 text-[11px]',
              failed ? 'text-danger' : 'text-muted',
            )}
          >
            <span>{failed ? 'Failed to send' : 'Sending…'}</span>
            {failed && onRetry ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[11px] text-danger"
                onClick={() => onRetry(message.clientMsgId)}
              >
                Retry
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export const MessageBubble = memo(MessageBubbleComponent);
