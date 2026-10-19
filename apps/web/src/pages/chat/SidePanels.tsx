import type { Message } from '@team-chat/shared';
import { SearchPanel } from '@/features/search';
import type { Panel } from '@/widgets/conversation';
import { DetailsPanel, PinsPanel } from '@/widgets/details-panel';

export default function SidePanels({
  panel,
  conversationId,
  onJump,
  onClose,
}: {
  panel: Panel;
  conversationId: string | null;
  onJump: (m: Message) => void;
  onClose: () => void;
}) {
  if (panel.type === 'details' && conversationId)
    return <DetailsPanel conversationId={conversationId} onClose={onClose} />;
  if (panel.type === 'pins' && conversationId)
    return <PinsPanel conversationId={conversationId} onJump={onJump} onClose={onClose} />;
  if (panel.type === 'search')
    return (
      <SearchPanel
        conversationId={conversationId ?? undefined}
        {...(panel.q ? { initialQuery: panel.q } : {})}
        onJump={onJump}
        onClose={onClose}
      />
    );
  return null;
}
