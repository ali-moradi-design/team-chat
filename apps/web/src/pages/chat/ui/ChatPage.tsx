import { useEffect } from 'react';
import { ChatSidebar } from '@/widgets/chat-sidebar';
import { ChatThread } from '@/widgets/chat-thread';
import { ChatComposer } from '@/widgets/chat-composer';
import { useChatStore } from '@/shared/lib/chat';

export function ChatPage() {
  const setSidebarOpen = useChatStore((s) => s.setSidebarOpen);
  const sidebarOpen = useChatStore((s) => s.sidebarOpen);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && sidebarOpen && window.innerWidth < 768) {
        setSidebarOpen(false);
      }
      // Alt+/ focuses composer
      if (e.key === '/' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        document.getElementById('composer')?.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sidebarOpen, setSidebarOpen]);

  useEffect(() => {
    function onResize() {
      if (window.innerWidth >= 768) setSidebarOpen(true);
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [setSidebarOpen]);

  return (
    <div className="flex h-dvh overflow-hidden bg-surface">
      <a href="#composer" className="skip-link">
        Skip to message composer
      </a>
      <ChatSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <ChatThread />
        <ChatComposer />
      </div>
    </div>
  );
}
