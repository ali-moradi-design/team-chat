import '@/app/styles/index.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';
import { App } from '@/app/App';
import { ErrorBoundary } from '@/app/ErrorBoundary';
import { initI18n } from '@/shared/i18n';
import { applyPrefsToDocument, usePrefs } from '@/shared/lib/prefs';
import { TooltipProvider } from '@/shared/ui';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
});

if (import.meta.env.DEV) {
  // Handy for debugging and E2E: window.__tc.conversations.getState()
  void Promise.all([import('@/entities/conversation'), import('@/entities/message')]).then(
    ([c, m]) => {
      (window as unknown as Record<string, unknown>).__tc = {
        conversations: c.useConversations,
        messages: m.useMessages,
      };
    },
  );
}

// Benign browser notice raised by ResizeObserver-driven layout (virtualized list); not an app error.
window.addEventListener('error', (e) => {
  if (e.message.startsWith('ResizeObserver loop')) e.stopImmediatePropagation();
});

async function start() {
  applyPrefsToDocument(usePrefs.getState());
  await initI18n();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () =>
    applyPrefsToDocument(usePrefs.getState()),
  );
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <App />
            <Toaster
              position="bottom-center"
              theme="system"
              toastOptions={{ className: '!bg-panel !text-fg !border-line' }}
            />
          </TooltipProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </StrictMode>,
  );
}

void start();
