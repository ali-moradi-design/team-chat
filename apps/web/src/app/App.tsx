import { useMemo, useState } from 'react';
import { ChatPage } from '@/pages/chat';
import { DisplayNameGate, loadDisplayName, loadUserId } from '@/features/auth-display-name';
import { SocketProvider } from '@/app/providers';
import { useChatStore } from '@/shared/lib/chat';

function initTheme() {
  const saved = (localStorage.getItem('chatTheme') as 'dark' | 'light' | null) ?? 'dark';
  document.documentElement.classList.toggle('dark', saved === 'dark');
  document.documentElement.classList.toggle('light', saved === 'light');
  useChatStore.setState({ theme: saved });
  return saved;
}

export function App() {
  useMemo(() => initTheme(), []);

  const [session, setSession] = useState<{ displayName: string; userId: string } | null>(() => {
    const displayName = loadDisplayName();
    const userId = loadUserId();
    if (displayName && userId) return { displayName, userId };
    return null;
  });

  if (!session) {
    return (
      <DisplayNameGate
        onReady={(displayName, userId) => setSession({ displayName, userId })}
      />
    );
  }

  return (
    <SocketProvider displayName={session.displayName} userId={session.userId}>
      <ChatPage />
    </SocketProvider>
  );
}
