import { CloudOff, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useConnection } from '@/shared/socket/client';

/** Visible only while the realtime connection is down (after a short grace so blips stay quiet). */
export function ConnectionBanner() {
  const { t } = useTranslation();
  const state = useConnection((s) => s.state);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (state === 'connected') return setShow(false);
    const id = setTimeout(() => setShow(true), 1500);
    return () => clearTimeout(id);
  }, [state]);

  if (!show || state === 'connected') return null;
  const offline = state === 'offline';
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-accent px-3 py-1.5 text-center text-xs font-semibold text-accent-fg"
    >
      {offline ? <CloudOff className="size-3.5" /> : <Loader2 className="size-3.5 animate-spin" />}
      {offline
        ? t('status.offline')
        : state === 'connecting'
          ? t('status.connecting')
          : t('status.reconnecting')}
    </div>
  );
}
