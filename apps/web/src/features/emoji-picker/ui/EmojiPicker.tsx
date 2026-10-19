import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/shared/ui';
import { cn } from '@/shared/lib/cn';
import { EMOJI_CATEGORIES, getRecentEmoji, pushRecentEmoji, searchEmoji } from '../model/data';

/** Lazy-loaded (see index.ts). Pure data + buttons: no emoji library. */
export default function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(EMOJI_CATEGORIES[0]!.id);
  const recent = useMemo(getRecentEmoji, []);
  const results = useMemo(() => searchEmoji(query), [query]);

  const pick = (e: string) => {
    pushRecentEmoji(e);
    onPick(e);
  };

  const grid = (list: string[]) => (
    <div role="grid" className="grid grid-cols-8 gap-0.5" dir="ltr">
      {list.map((e) => (
        <button
          key={e}
          type="button"
          role="gridcell"
          onClick={() => pick(e)}
          className="grid size-8 place-items-center rounded-lg text-xl transition-colors hover:bg-elevated-2 focus-visible:bg-elevated-2"
        >
          {e}
        </button>
      ))}
    </div>
  );

  const active = EMOJI_CATEGORIES.find((c) => c.id === category)!;
  return (
    <div className="flex w-[19.5rem] max-w-[calc(100vw-1.5rem)] flex-col gap-2 p-2.5">
      <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('common.search')} className="h-9" aria-label={t('common.search')} />
      {query ? (
        <div className="h-52 overflow-y-auto">{results.length ? grid(results.map((r) => r.emoji)) : <p className="p-4 text-center text-sm text-muted">—</p>}</div>
      ) : (
        <>
          <div className="flex gap-1 border-b border-line pb-1.5" dir="ltr">
            {EMOJI_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-label={c.id}
                aria-pressed={c.id === category}
                onClick={() => setCategory(c.id)}
                className={cn('grid size-8 place-items-center rounded-lg text-lg', c.id === category ? 'bg-mention' : 'hover:bg-elevated-2')}
              >
                {c.icon}
              </button>
            ))}
          </div>
          <div className="h-52 overflow-y-auto">
            {category === EMOJI_CATEGORIES[0]!.id && recent.length > 0 && <div className="mb-2">{grid(recent)}</div>}
            {grid(active.items.map((i) => i.split(' ')[0]!))}
          </div>
        </>
      )}
    </div>
  );
}

