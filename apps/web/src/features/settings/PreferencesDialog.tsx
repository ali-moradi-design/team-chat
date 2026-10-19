import { Bell, Moon, Sun, MonitorSmartphone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { setLanguage } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { useDialogs } from '@/shared/lib/dialogs';
import { usePrefs, type ThemePref } from '@/shared/lib/prefs';
import { Dialog, Switch } from '@/shared/ui';
import { enableBrowserNotifications, notificationPermission } from '../notifications';

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: Array<{ id: T; label: string; icon?: React.ReactNode }>; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl border border-line bg-elevated p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn('flex h-8 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-medium transition-colors', value === o.id ? 'bg-panel text-fg shadow-sm' : 'text-muted hover:text-fg')}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function PreferencesDialog() {
  const { t } = useTranslation();
  const open = useDialogs((s) => s.prefs);
  const close = useDialogs((s) => s.close);
  const prefs = usePrefs();
  const perm = notificationPermission();

  const toggleNotifications = async (on: boolean) => {
    if (!on) return prefs.set({ browserNotifications: false });
    const ok = await enableBrowserNotifications();
    if (!ok) toast.error(t(perm === 'unsupported' ? 'settings.notificationsUnsupported' : 'settings.notificationsBlocked'));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close('prefs')} title={t('settings.title')} mobileSheet>
      <div className="flex flex-col gap-5 p-5">
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">{t('settings.theme')}</h3>
          <Segmented<ThemePref>
            label={t('settings.theme')}
            value={prefs.theme}
            onChange={(theme) => prefs.set({ theme })}
            options={[
              { id: 'dark', label: t('settings.dark'), icon: <Moon className="size-3.5" /> },
              { id: 'light', label: t('settings.light'), icon: <Sun className="size-3.5" /> },
              { id: 'system', label: t('settings.system'), icon: <MonitorSmartphone className="size-3.5" /> },
            ]}
          />
        </section>
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">{t('settings.language')}</h3>
          <Segmented
            label={t('settings.language')}
            value={prefs.lang}
            onChange={(l) => void setLanguage(l)}
            options={[
              { id: 'en', label: 'English' },
              { id: 'fa', label: 'فارسی' },
            ]}
          />
        </section>
        {prefs.lang === 'fa' && (
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">{t('settings.digits')}</h3>
            <Segmented
              label={t('settings.digits')}
              value={prefs.latinDigits ? 'latin' : 'native'}
              onChange={(v) => prefs.set({ latinDigits: v === 'latin' })}
              options={[
                { id: 'native', label: t('settings.digitsNative') },
                { id: 'latin', label: t('settings.digitsLatin') },
              ]}
            />
          </section>
        )}
        <section className="flex items-start justify-between gap-4 rounded-xl border border-line p-3.5">
          <span className="flex gap-3">
            <Bell className="mt-0.5 size-4 text-muted" />
            <span>
              <span className="block text-sm font-medium">{t('settings.notifications')}</span>
              <span className="block text-xs text-muted">{t('settings.notificationsHint')}</span>
            </span>
          </span>
          <Switch checked={prefs.browserNotifications && perm === 'granted'} onCheckedChange={(v) => void toggleNotifications(v)} aria-label={t('settings.notifications')} disabled={perm === 'unsupported'} />
        </section>
      </div>
    </Dialog>
  );
}
