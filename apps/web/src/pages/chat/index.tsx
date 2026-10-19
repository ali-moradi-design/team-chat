import { MessageSquareText, Menu as MenuIcon } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import type { Message } from '@team-chat/shared';
import { useConversations } from '@/entities/conversation';
import { cn } from '@/shared/lib/cn';
import { useDialogs } from '@/shared/lib/dialogs';
import { useIsDesktop, useIsTablet } from '@/shared/lib/media';
import { Button, EmptyState } from '@/shared/ui';
import {
  ConversationView,
  panelFromParams,
  panelToParams,
  type Panel,
} from '@/widgets/conversation';
import { Sidebar } from '@/widgets/sidebar';
import { ConnectionBanner } from '@/widgets/status';
import { ThreadPanel } from '@/widgets/thread-panel';

// Rarely-used UI is split out and loaded after the first paint.
const Overlays = lazy(() => import('./Overlays'));
const SidePanels = lazy(() => import('./SidePanels'));

function useAfterFirstPaint(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const idle = (
      window as unknown as {
        requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
      }
    ).requestIdleCallback;
    const id = idle
      ? idle(() => setReady(true), { timeout: 1500 })
      : window.setTimeout(() => setReady(true), 300);
    return () =>
      idle
        ? (window as unknown as { cancelIdleCallback: (n: number) => void }).cancelIdleCallback(id)
        : clearTimeout(id);
  }, []);
  return ready;
}

function useGlobalShortcuts(activeId: string | null) {
  const open = useDialogs((s) => s.open);
  const navigate = useNavigate();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement | null)?.closest(
        'input, textarea, select, [contenteditable=true]',
      );
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        open('quick');
      } else if (e.key === '?' && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        open('shortcuts');
      } else if (e.altKey && e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        const convs = Object.values(useConversations.getState().byId).filter(
          (c) => c.unreadCount > 0 && !c.muted,
        );
        convs.sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? ''));
        if (convs.length === 0) return;
        const idx = convs.findIndex((c) => c.id === activeId);
        const next =
          e.key === 'ArrowDown'
            ? convs[(idx + 1) % convs.length]
            : convs[(idx - 1 + convs.length) % convs.length];
        if (next) void navigate(`/c/${next.id}`);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, navigate, activeId]);
}

export function ChatPage() {
  const { t } = useTranslation();
  const { conversationId } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const isTablet = useIsTablet();
  const sidebarOpen = useDialogs((s) => s.sidebarOpen);
  const setSidebar = useDialogs((s) => s.setSidebar);
  const open = useDialogs((s) => s.open);
  const loaded = useConversations((s) => s.loaded);
  const byId = useConversations((s) => s.byId);
  const activeId = conversationId ?? null;

  useEffect(() => {
    useConversations.getState().setActive(activeId);
    return () => useConversations.getState().setActive(null);
  }, [activeId]);

  useGlobalShortcuts(activeId);

  // Notification click / toast action
  useEffect(() => {
    const h = (e: Event) => void navigate(`/c/${(e as CustomEvent<string>).detail}`);
    window.addEventListener('tc:open-conversation', h);
    return () => window.removeEventListener('tc:open-conversation', h);
  }, [navigate]);

  // "/" → first sensible conversation (desktop/tablet); on phones the drawer opens instead.
  useEffect(() => {
    if (!loaded || conversationId) return;
    const all = Object.values(byId);
    if (all.length === 0) return;
    if (!isTablet) return setSidebar(true);
    const general = all.find((c) => c.name === 'general');
    const recent = [...all].sort((a, b) =>
      (b.lastMessageAt ?? b.createdAt).localeCompare(a.lastMessageAt ?? a.createdAt),
    )[0];
    void navigate(`/c/${(general ?? recent)!.id}`, { replace: true });
  }, [loaded, conversationId, byId, isTablet, navigate, setSidebar]);

  // Conversation disappeared (left, removed): go back.
  useEffect(() => {
    if (loaded && conversationId && !byId[conversationId]) {
      const t = setTimeout(() => {
        if (!useConversations.getState().byId[conversationId])
          void navigate('/', { replace: true });
      }, 1200);
      return () => clearTimeout(t);
    }
  }, [loaded, conversationId, byId, navigate]);

  const panel = useMemo(() => panelFromParams(params), [params]);
  const setPanel = useCallback(
    (p: Panel | null) => setParams((cur) => panelToParams(p, cur), { replace: false }),
    [setParams],
  );

  const jump = useCallback(
    (m: Message) => {
      const next = new URLSearchParams(params);
      next.set('m', m.id);
      if (!isDesktop) {
        next.delete('panel');
        next.delete('thread');
        next.delete('q');
      }
      void navigate({ pathname: `/c/${m.conversationId}`, search: next.toString() });
    },
    [navigate, params, isDesktop],
  );

  // Esc closes the side panel (dialogs handle their own Esc first).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || !panel) return;
      if (document.querySelector('[role=dialog], [role=menu], [role=listbox]')) return;
      if ((e.target as HTMLElement | null)?.closest('textarea, input')) return;
      setPanel(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panel, setPanel]);

  const closeSidebar = useCallback(() => setSidebar(false), [setSidebar]);
  const highlightId = params.get('m') ?? undefined;

  const panelContent = !panel ? null : panel.type === 'thread' ? (
    <ThreadPanel rootId={panel.rootId} onClose={() => setPanel(null)} />
  ) : (
    <Suspense fallback={<div className="h-full bg-panel" />}>
      <SidePanels
        panel={panel}
        conversationId={activeId}
        onJump={jump}
        onClose={() => setPanel(null)}
      />
    </Suspense>
  );
  const overlaysReady = useAfterFirstPaint();

  return (
    <div className="flex h-dvh flex-col bg-surface">
      <a href="#conversation" className="skip-link">
        {t('common.skipToContent')}
      </a>
      <ConnectionBanner />
      <div className="flex min-h-0 flex-1">
        {/* Docked sidebar ≥ md, drawer below */}
        {isTablet ? (
          <aside className="w-72 shrink-0 border-e border-line lg:w-80">
            <Sidebar activeId={activeId} onNavigate={closeSidebar} />
          </aside>
        ) : (
          sidebarOpen && (
            <div className="fixed inset-0 z-40 flex">
              <button
                type="button"
                aria-label={t('common.close')}
                className="absolute inset-0 animate-fade bg-black/60"
                onClick={closeSidebar}
              />
              <aside className="relative z-10 h-full w-[min(20rem,88vw)] animate-slide-in border-e border-line shadow-pop [--slide-from:-24px] rtl:[--slide-from:24px]">
                <Sidebar activeId={activeId} onNavigate={closeSidebar} />
              </aside>
            </div>
          )
        )}

        <main
          id="conversation"
          tabIndex={-1}
          className="flex min-h-0 min-w-0 flex-1 focus:outline-none"
        >
          {activeId ? (
            <ConversationView
              conversationId={activeId}
              highlightId={highlightId}
              panel={panel}
              onPanel={setPanel}
            />
          ) : (
            <div className="flex flex-1 flex-col">
              {!isTablet && (
                <header className="flex h-14 items-center border-b border-line bg-panel px-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSidebar(true)}
                    aria-label={t('sidebar.open')}
                  >
                    <MenuIcon className="size-5" />
                  </Button>
                </header>
              )}
              <div className="grid flex-1 place-items-center">
                <EmptyState
                  icon={<MessageSquareText className="size-6" />}
                  title={t('conversation.selectTitle')}
                >
                  {t('conversation.selectBody')}
                  <div className="mt-4">
                    <Button variant="secondary" onClick={() => open('quick')}>
                      {t('sidebar.search')}
                    </Button>
                  </div>
                </EmptyState>
              </div>
            </div>
          )}

          {/* Side panel: docked ≥ lg, overlay below */}
          {panelContent && isDesktop && (
            <div className="w-[22rem] shrink-0 animate-slide-in border-s border-line xl:w-[26rem]">
              {panelContent}
            </div>
          )}
        </main>
      </div>

      {panelContent && !isDesktop && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <button
            type="button"
            aria-label={t('common.close')}
            className={cn('absolute inset-0 animate-fade bg-black/60', !isTablet && 'hidden')}
            onClick={() => setPanel(null)}
          />
          <div className="relative z-10 h-full w-full animate-slide-in border-s border-line shadow-pop sm:w-[26rem]">
            {panelContent}
          </div>
        </div>
      )}

      {overlaysReady && (
        <Suspense fallback={null}>
          <Overlays onSearch={(q) => setPanel({ type: 'search', q })} />
        </Suspense>
      )}
    </div>
  );
}
