import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { useSession } from '@/entities/session';
import { Spinner } from '@/shared/ui';
import { NotFoundPage } from '@/pages/not-found';
import { useRealtime } from './realtime/useRealtime';

const ChatPage = lazy(() => import('@/pages/chat').then((m) => ({ default: m.ChatPage })));
const LoginPage = lazy(() => import('@/pages/login').then((m) => ({ default: m.LoginPage })));

const Splash = () => (
  <div className="grid h-dvh place-items-center text-muted">
    <Spinner className="size-6" />
  </div>
);

function Authed() {
  useRealtime();
  return (
    <Routes>
      <Route path="/" element={<ChatPage />} />
      <Route path="/c/:conversationId" element={<ChatPage />} />
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export function App() {
  const status = useSession((s) => s.status);
  const bootstrap = useSession((s) => s.bootstrap);
  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  if (status === 'loading') return <Splash />;
  return (
    <BrowserRouter>
      <Suspense fallback={<Splash />}>{status === 'authed' ? <Authed /> : <LoginPage />}</Suspense>
    </BrowserRouter>
  );
}
