import { Check, Copy } from 'lucide-react';
import { memo, useState, type ReactNode } from 'react';
import { parseRichText, type RichToken } from '@team-chat/shared';
import { cn } from '../lib/cn';

const cache = new Map<string, RichToken[]>();
function parseCached(text: string): RichToken[] {
  let tokens = cache.get(text);
  if (!tokens) {
    tokens = parseRichText(text);
    if (cache.size > 1000) cache.delete(cache.keys().next().value as string);
    cache.set(text, tokens);
  }
  return tokens;
}

export interface MentionInfo {
  label: string;
  self: boolean;
}

interface Props {
  text: string;
  /** Resolves `@handle` to a display name. Unknown handles render as plain `@handle`. */
  resolveMention?: (handle: string) => MentionInfo | null;
  className?: string;
}

function CodeBlock({ value, lang }: { value: string; lang?: string | undefined }) {
  const [copied, setCopied] = useState(false);
  return (
    <div
      dir="ltr"
      className="group/code relative my-1.5 overflow-hidden rounded-xl border border-line bg-surface text-start"
    >
      {lang && (
        <div className="border-b border-line px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-faint">
          {lang}
        </div>
      )}
      <pre className="overflow-x-auto p-3 font-mono text-[13px] leading-relaxed">
        <code>{value}</code>
      </pre>
      <button
        type="button"
        aria-label="Copy code"
        onClick={() => {
          void navigator.clipboard?.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="absolute end-2 top-2 grid size-7 place-items-center rounded-lg border border-line bg-panel text-muted opacity-0 transition-opacity hover:text-fg focus-visible:opacity-100 group-hover/code:opacity-100"
      >
        {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
      </button>
    </div>
  );
}

function render(
  tokens: RichToken[],
  resolve: Props['resolveMention'],
  keyPrefix = '',
): ReactNode[] {
  return tokens.map((t, i) => {
    const key = `${keyPrefix}${i}`;
    switch (t.type) {
      case 'text':
        return <span key={key}>{t.value}</span>;
      case 'bold':
        return (
          <strong key={key} className="font-semibold">
            {render(t.children, resolve, `${key}.`)}
          </strong>
        );
      case 'italic':
        return <em key={key}>{render(t.children, resolve, `${key}.`)}</em>;
      case 'strike':
        return (
          <s key={key} className="opacity-70">
            {render(t.children, resolve, `${key}.`)}
          </s>
        );
      case 'code':
        return (
          <code
            key={key}
            dir="ltr"
            className="rounded-md border border-line bg-elevated px-1.5 py-0.5 font-mono text-[0.86em]"
          >
            {t.value}
          </code>
        );
      case 'codeblock':
        return <CodeBlock key={key} value={t.value} lang={t.lang} />;
      case 'link':
        return (
          <a
            key={key}
            href={t.href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            dir="ltr"
            className="break-all text-accent-ink underline decoration-accent-ink/40 underline-offset-2 hover:decoration-accent-ink"
          >
            {t.label}
          </a>
        );
      case 'mention': {
        const info =
          t.handle === 'channel' ? { label: 'channel', self: false } : resolve?.(t.handle);
        if (!info) return <span key={key}>@{t.handle}</span>;
        return (
          <span
            key={key}
            className={cn(
              'rounded-md bg-mention px-1 font-semibold text-accent-ink',
              (info.self || t.handle === 'channel') && 'ring-1 ring-accent/50',
            )}
          >
            @{info.label}
          </span>
        );
      }
    }
  });
}

export const RichText = memo(function RichText({ text, resolveMention, className }: Props) {
  return (
    <div
      dir="auto"
      className={cn('whitespace-pre-wrap break-words [overflow-wrap:anywhere]', className)}
    >
      {render(parseCached(text), resolveMention)}
    </div>
  );
});
