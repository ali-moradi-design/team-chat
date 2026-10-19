import { memo, useMemo } from 'react';
import { MessageBubble } from '@/entities/message';
import type { ChatMessage } from '@/shared/lib/socket';

type Props = {
  messages: ChatMessage[];
  userId: string | null;
  onRetry: (clientMsgId: string) => void;
};

function MessageListComponent({ messages, userId, onRetry }: Props) {
  const items = useMemo(() => {
    return messages.map((m, i) => {
      const prev = messages[i - 1];
      const showAvatar =
        !prev ||
        prev.userId !== m.userId ||
        new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() > 5 * 60_000;
      return { message: m, showAvatar, isOwn: m.userId === userId };
    });
  }, [messages, userId]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-3.5 py-8">
      {items.map(({ message, showAvatar, isOwn }) => (
        <MessageBubble
          key={message.clientMsgId}
          message={message}
          isOwn={isOwn}
          showAvatar={showAvatar}
          onRetry={onRetry}
        />
      ))}
    </div>
  );
}

export const MessageList = memo(MessageListComponent);
