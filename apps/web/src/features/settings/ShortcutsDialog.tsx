import { useTranslation } from 'react-i18next';
import { useDialogs } from '@/shared/lib/dialogs';
import { Dialog, Kbd } from '@/shared/ui';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = isMac ? '⌘' : 'Ctrl';

export function ShortcutsDialog() {
  const { t } = useTranslation();
  const open = useDialogs((s) => s.shortcuts);
  const close = useDialogs((s) => s.close);
  const rows: Array<[string, string[]]> = [
    [t('shortcuts.switcher'), [MOD, 'K']],
    [t('shortcuts.send'), ['Enter']],
    [t('shortcuts.newline'), ['Shift', 'Enter']],
    [t('shortcuts.editLast'), ['↑']],
    [t('shortcuts.bold'), [MOD, 'B']],
    [t('shortcuts.italic'), [MOD, 'I']],
    [t('shortcuts.code'), [MOD, 'E']],
    [t('shortcuts.prevUnread'), ['Alt', '⇧', '↑']],
    [t('shortcuts.nextUnread'), ['Alt', '⇧', '↓']],
    [t('shortcuts.closePanel'), ['Esc']],
    [t('shortcuts.help'), ['?']],
  ];
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close('shortcuts')} title={t('shortcuts.title')} mobileSheet>
      <ul className="divide-y divide-line px-5 py-1">
        {rows.map(([label, keys]) => (
          <li key={label} className="flex items-center justify-between gap-4 py-2.5 text-sm">
            <span>{label}</span>
            <span className="flex gap-1">{keys.map((k) => <Kbd key={k}>{k}</Kbd>)}</span>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
