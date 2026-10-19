import { Check } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUsers } from '@/entities/user';
import { cn } from '@/shared/lib/cn';
import { Avatar, Input } from '@/shared/ui';

export function PeoplePicker({
  exclude,
  selected,
  onToggle,
  single,
  maxHeight = 'max-h-64',
}: {
  exclude: string[];
  selected: string[];
  onToggle: (id: string) => void;
  single?: boolean;
  maxHeight?: string;
}) {
  const { t } = useTranslation();
  const byId = useUsers((s) => s.byId);
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return Object.values(byId)
      .filter((u) => !exclude.includes(u.id) && (!needle || u.name.toLowerCase().includes(needle) || u.handle.includes(needle)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [byId, exclude, q]);

  return (
    <div className="flex flex-col gap-2">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('dialogs.filterPeople')} aria-label={t('dialogs.filterPeople')} />
      <ul className={cn('overflow-y-auto rounded-xl border border-line', maxHeight)} role="listbox" aria-multiselectable={!single}>
        {list.length === 0 && <li className="p-4 text-center text-sm text-muted">{t('dialogs.noPeople')}</li>}
        {list.map((u) => {
          const on = selected.includes(u.id);
          return (
            <li key={u.id} role="option" aria-selected={on}>
              <button type="button" onClick={() => onToggle(u.id)} className={cn('flex w-full items-center gap-3 px-3 py-2 text-start hover:bg-elevated', on && 'bg-mention')}>
                <Avatar name={u.name} hue={u.hue} size="sm" isBot={u.isBot} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium" dir="auto">{u.name}</span>
                  <span className="block truncate text-xs text-muted" dir="ltr">@{u.handle}</span>
                </span>
                {on && <Check className="size-4 text-accent-ink" />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
