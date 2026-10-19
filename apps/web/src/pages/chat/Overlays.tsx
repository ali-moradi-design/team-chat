import { ConversationDialogs } from '@/features/conversation-dialogs';
import { ImageLightbox } from '@/features/image-lightbox';
import { QuickSwitcher } from '@/features/quick-switcher';
import { AdminDialog, PreferencesDialog, ShortcutsDialog } from '@/features/settings';

/** Global dialogs, loaded as one chunk after the first paint. */
export default function Overlays({ onSearch }: { onSearch: (q: string) => void }) {
  return (
    <>
      <ConversationDialogs />
      <QuickSwitcher onSearch={onSearch} />
      <PreferencesDialog />
      <ShortcutsDialog />
      <AdminDialog />
      <ImageLightbox />
    </>
  );
}
