import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { Message } from '@team-chat/shared';
import { emitAckAction } from '@/entities/message';
import { Button, Dialog } from '@/shared/ui';

export function DeleteMessageDialog({ message, onClose }: { message: Message | null; onClose: () => void }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    if (!message) return;
    setBusy(true);
    const res = await emitAckAction('message:delete', { messageId: message.id });
    setBusy(false);
    if (!res.ok) return void toast.error(t('message.deleteFailed'));
    onClose();
  };
  return (
    <Dialog open={!!message} onOpenChange={(o) => !o && onClose()} title={t('message.deleteTitle')} description={t('message.deleteBody')}>
      <div className="flex justify-end gap-2 p-4">
        <Button variant="ghost" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button variant="danger" disabled={busy} onClick={() => void confirm()}>
          {t('common.delete')}
        </Button>
      </div>
    </Dialog>
  );
}
