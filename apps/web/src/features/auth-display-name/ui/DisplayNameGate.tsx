import { useState, type FormEvent } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/shared/ui';
import { loadUserId, saveDisplayName, saveUserId } from '../lib/storage';

type Props = {
  onReady: (displayName: string, userId: string) => void;
};

export function DisplayNameGate({ onReady }: Props) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim().replace(/\s+/g, ' ').slice(0, 32);
    if (trimmed.length < 1) {
      setError('Please enter a display name');
      return;
    }
    const userId = loadUserId() ?? uuidv4();
    saveUserId(userId);
    saveDisplayName(trimmed);
    onReady(trimmed, userId);
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface px-4">
      <main
        className="w-full max-w-md rounded-3xl border border-border bg-panel p-8 shadow-2xl shadow-black/40"
        aria-labelledby="welcome-title"
      >
        <div className="mb-6 space-y-2 text-center">
          <div
            className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/20 text-xl text-accent-fg"
            aria-hidden
          >
            ✦
          </div>
          <h1 id="welcome-title" className="text-2xl font-semibold tracking-tight text-foreground">
            Welcome to Chat
          </h1>
          <p className="text-sm leading-relaxed text-muted">
            Pick a display name to join. No account needed — your name is stored locally on this
            device.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <label htmlFor="display-name" className="block text-sm font-medium text-foreground/90">
              Display name
            </label>
            <input
              id="display-name"
              autoFocus
              autoComplete="nickname"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              maxLength={32}
              placeholder="e.g. Ali"
              aria-invalid={!!error}
              aria-describedby={error ? 'name-error' : 'name-hint'}
              className="w-full rounded-xl border border-border bg-elevated px-4 py-3 text-foreground placeholder:text-muted/60 focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
            <p id="name-hint" className="text-xs text-muted">
              1–32 characters. Visible to everyone in the room.
            </p>
          </div>
          {error ? (
            <p id="name-error" className="text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="h-11 w-full rounded-xl">
            Continue to chat
          </Button>
        </form>
      </main>
    </div>
  );
}
