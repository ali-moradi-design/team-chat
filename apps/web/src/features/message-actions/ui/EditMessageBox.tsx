import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { LIMITS, type Message } from '@team-chat/shared';
import { emitAckAction } from '@/entities/message';
import { Button } from '@/shared/ui';

export function EditMessageBox({ message, onDone }: { message: Message; onDone: () => void }) {
  const { t } = useTranslation();
  const [text, setText] = useState(message.text);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }, [text]);

  const save = async () => {
    const next = text.trim();
    if (!next && message.attachments.length === 0) return;
    if (next === message.text) return onDone();
    setBusy(true);
    const res = await emitAckAction('message:edit', { messageId: message.id, text: next });
    setBusy(false);
    if (!res.ok) return void toast.error(t('message.editFailed'));
    onDone();
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      onDone();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void save();
    }
  };

  return (
    <div className="rounded-xl border border-accent/60 bg-panel p-2">
      <textarea
        ref={ref}
        value={text}
        dir="auto"
        maxLength={LIMITS.messageMaxLength}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKey}
        aria-label={t('message.edit')}
        className="block max-h-60 w-full resize-none bg-transparent px-2 py-1 text-[15px] leading-relaxed focus:outline-none"
      />
      <div className="flex items-center justify-between gap-2 px-1 pt-1">
        <span className="text-xs text-muted">{t('composer.editHint')}</span>
        <div className="flex gap-1.5">
          <Button size="sm" variant="ghost" onClick={onDone}>
            {t('common.cancel')}
          </Button>
          <Button
            size="sm"
            variant="primary"
            disabled={busy || (!text.trim() && message.attachments.length === 0)}
            onClick={() => void save()}
          >
            {t('common.save')}
          </Button>
        </div>
      </div>
    </div>
  );
}
