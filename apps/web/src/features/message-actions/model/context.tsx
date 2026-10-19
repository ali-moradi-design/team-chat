import { createContext, useContext } from 'react';
import type { Message } from '@team-chat/shared';

export interface MessageActionsContextValue {
  meId: string;
  isAdmin: boolean;
  isChannelManager: boolean;
  inThread: boolean;
  onReply: (m: Message) => void;
  onEdit: (m: Message) => void;
  onDelete: (m: Message) => void;
}

export const MessageActionsContext = createContext<MessageActionsContextValue | null>(null);

export function useMessageActions(): MessageActionsContextValue {
  const ctx = useContext(MessageActionsContext);
  if (!ctx) throw new Error('MessageActionsContext missing');
  return ctx;
}
