import { Search as SearchIcon, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { Message, SearchResponse } from '@team-chat/shared';
import { useConversations } from '@/entities/conversation';
import { useUsers, UserAvatar } from '@/entities/user';
import { useConversationTitle } from '@/features/conversation-title';
import { api } from '@/shared/api/http';
import { useFormatters } from '@/shared/lib/format';
import { Button, EmptyState, Input, Skeleton } from '@/shared/ui';

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

function Highlight({ text, query }: { text: string; query: string }) {
  const words = query.split(/\s+/).filter((w) => w.length > 1);
  if (words.length === 0) return <>{text}</>;
  const re = new RegExp(
    `(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
    'giu',
  );
  return (
    <>
      {text.split(re).map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded bg-accent/40 px-0.5 text-inherit">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

export function SearchPanel({
  conversationId,
  initialQuery = '',
  onJump,
  onClose,
}: {
  conversationId?: string | undefined;
  initialQuery?: string;
  onJump: (m: Message) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const f = useFormatters();
  const titleOf = useConversationTitle();
  const convs = useConversations((s) => s.byId);
  const users = useUsers((s) => s.byId);
  const [q, setQ] = useState(initialQuery);
  const [scope, setScope] = useState(conversationId ?? '');
  const [author, setAuthor] = useState('');
  const debounced = useDebounced(q.trim(), 250);

  useEffect(() => setScope(conversationId ?? ''), [conversationId]);

  const query = useInfiniteQuery({
    queryKey: ['search', debounced, scope, author],
    enabled: debounced.length >= 2,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => {
      const p = new URLSearchParams({ q: debounced });
      if (scope) p.set('conversationId', scope);
      if (author) p.set('authorId', author);
      if (pageParam) p.set('beforeId', pageParam);
      return api<SearchResponse>(`/api/search?${p}`, { signal });
    },
    getNextPageParam: (last) =>
      last.hasMore ? last.results[last.results.length - 1]?.id : undefined,
  });

  const results = useMemo(() => query.data?.pages.flatMap((p) => p.results) ?? [], [query.data]);
  const convOptions = useMemo(
    () => Object.values(convs).sort((a, b) => titleOf(a).localeCompare(titleOf(b))),
    [convs, titleOf],
  );
  const userOptions = useMemo(
    () => Object.values(users).sort((a, b) => a.name.localeCompare(b.name)),
    [users],
  );

  const select =
    'h-9 w-full rounded-lg border border-line bg-elevated px-2 text-sm text-fg focus:border-accent focus:outline-none';

  return (
    <aside className="flex h-full min-h-0 flex-col bg-panel" aria-label={t('search.title')}>
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="font-semibold">{t('search.title')}</h2>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label={t('common.close')}>
          <X className="size-4" />
        </Button>
      </div>
      <div className="flex flex-col gap-2 border-b border-line p-3">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted" />
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('search.placeholder')}
            className="ps-9"
            aria-label={t('search.placeholder')}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-xs text-muted">
            {t('search.inChannel')}
            <select value={scope} onChange={(e) => setScope(e.target.value)} className={select}>
              <option value="">{t('search.anywhere')}</option>
              {convOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.type === 'channel' ? '#' : ''}
                  {titleOf(c)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            {t('search.from')}
            <select value={author} onChange={(e) => setAuthor(e.target.value)} className={select}>
              <option value="">{t('search.anyone')}</option>
              {userOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {debounced.length < 2 && (
          <p className="p-6 text-center text-sm text-muted">{t('search.hint')}</p>
        )}
        {query.isLoading && debounced.length >= 2 && (
          <div className="flex flex-col gap-3 p-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        )}
        {query.isError && (
          <p className="p-6 text-center text-sm text-danger-ink">{t('search.failed')}</p>
        )}
        {query.isSuccess && results.length === 0 && (
          <EmptyState icon={<SearchIcon className="size-6" />} title={t('search.noResults')} />
        )}
        <ul className="p-2">
          {results.map((m) => {
            const conv = convs[m.conversationId];
            const u = users[m.authorId];
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => onJump(m)}
                  className="flex w-full gap-3 rounded-xl px-3 py-2.5 text-start hover:bg-elevated"
                >
                  <UserAvatar userId={m.authorId} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2 text-xs text-muted">
                      <span className="truncate font-semibold text-fg" dir="auto">
                        {u?.name ?? t('common.unknownUser')}
                      </span>
                      {conv && (
                        <span className="truncate" dir="auto">
                          {conv.type === 'channel' ? '#' : ''}
                          {titleOf(conv)}
                        </span>
                      )}
                      <time className="ms-auto shrink-0">{f.dateTime(m.createdAt)}</time>
                    </span>
                    <span className="line-clamp-3 text-sm" dir="auto">
                      <Highlight text={m.text} query={debounced} />
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {query.hasNextPage && (
          <div className="p-3 text-center">
            <Button
              size="sm"
              variant="secondary"
              disabled={query.isFetchingNextPage}
              onClick={() => void query.fetchNextPage()}
            >
              {t('search.loadMore')}
            </Button>
          </div>
        )}
      </div>
    </aside>
  );
}
