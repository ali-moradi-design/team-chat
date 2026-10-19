import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { sendMessage } from '@/features/send-message';
import { notifyTyping, stopTyping } from '@/features/typing';
import { useChatStore } from '@/shared/lib/chat';
import { Button } from '@/shared/ui';
import { cn } from '@/shared/lib';

export function ChatComposer() {
  const [text, setText] = useState('');
  const draftRef = useRef(text);
  draftRef.current = text;
  const connStatus = useChatStore((s) => s.connStatus);
  const offline = connStatus !== 'connected';
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  function submit() {
    const value = draftRef.current;
    if (!value.trim()) return;
    sendMessage(value);
    setText('');
    stopTyping();
    requestAnimationFrame(() => taRef.current?.focus());
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="border-t border-border/80 bg-panel/90 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md md:px-8 md:py-4">
      <div
        className={cn(
          'mx-auto flex max-w-3xl items-end gap-2 rounded-3xl border border-border bg-elevated/80 p-2 pl-3',
          'shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]',
          'focus-within:border-accent/35 focus-within:ring-2 focus-within:ring-accent/15',
        )}
      >
        <label className="sr-only" htmlFor="composer">
          Message
        </label>
        <textarea
          id="composer"
          ref={taRef}
          rows={1}
          value={text}
          disabled={offline}
          onChange={(e) => {
            setText(e.target.value);
            notifyTyping();
          }}
          onKeyDown={onKeyDown}
          onBlur={() => stopTyping()}
          placeholder={
            offline ? 'Reconnecting…' : 'Message…  Enter to send · Shift+Enter newline'
          }
          className="max-h-40 min-h-[48px] flex-1 resize-none bg-transparent py-3 text-[15px] leading-relaxed text-foreground placeholder:text-muted/55 focus:outline-none disabled:opacity-50"
        />
        <Button
          onClick={submit}
          disabled={offline || !text.trim()}
          className="mb-1 h-11 shrink-0 rounded-2xl px-5 font-semibold"
          aria-label="Send message"
        >
          Send
        </Button>
      </div>
      <p className="mx-auto mt-2.5 max-w-3xl px-1 text-[11px] text-muted/80">
        Plain text only · max 4000 · Ctrl/⌘+/ focus composer
      </p>
    </div>
  );
}
