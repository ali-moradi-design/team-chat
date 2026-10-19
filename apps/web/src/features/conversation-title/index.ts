import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConversationSummary } from '@team-chat/shared';
import { conversationTitle } from '@/entities/conversation';
import { useSession } from '@/entities/session';
import { useUsers } from '@/entities/user';

type TitleSource = Pick<ConversationSummary, 'type' | 'name' | 'members'>;

/** Returns a function that names a conversation (DMs by their other participants). */
export function useConversationTitle(): (c: TitleSource) => string {
  const { t } = useTranslation();
  const meId = useSession((s) => s.me?.id ?? '');
  const byId = useUsers((s) => s.byId);
  return useCallback(
    (c) =>
      conversationTitle(
        c,
        meId,
        (id) => byId[id]?.name ?? t('common.unknownUser'),
        t('common.you'),
      ),
    [meId, byId, t],
  );
}
