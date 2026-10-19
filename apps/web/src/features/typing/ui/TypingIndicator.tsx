import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useUsers } from '@/entities/user';
import { useTyping, useTypingUserIds } from '../model/typing';

/** Reserves its height so the timeline never jumps when someone starts typing. */
export function TypingIndicator({
  conversationId,
  meId,
}: {
  conversationId: string;
  meId: string;
}) {
  const { t } = useTranslation();
  const ids = useTypingUserIds(conversationId, meId);
  const byId = useUsers((s) => s.byId);

  useEffect(() => {
    if (ids.length === 0) return;
    const timer = setInterval(() => useTyping.getState().prune(), 1000);
    return () => clearInterval(timer);
  }, [ids.length]);

  const name = (id: string) => byId[id]?.name ?? t('common.unknownUser');
  const text =
    ids.length === 0
      ? ''
      : ids.length === 1
        ? t('typing.one', { a: name(ids[0]!) })
        : ids.length === 2
          ? t('typing.two', { a: name(ids[0]!), b: name(ids[1]!) })
          : t('typing.many');

  return (
    <div className="flex h-6 items-center gap-2 px-5 text-xs text-muted" aria-live="polite">
      {text && (
        <>
          <span className="flex gap-0.5" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="size-1 rounded-full bg-muted"
                style={{ animation: `blink 1.2s ${i * 0.2}s infinite` }}
              />
            ))}
          </span>
          <span className="truncate">{text}</span>
        </>
      )}
    </div>
  );
}
