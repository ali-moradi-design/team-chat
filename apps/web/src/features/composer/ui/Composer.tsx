import { AtSign, Bold, Code, FileText, Italic, Link2, Paperclip, SendHorizontal, Smile, X } from 'lucide-react';
import { Suspense, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { LIMITS, type User } from '@team-chat/shared';
import { sendMessage } from '@/entities/message';
import { LazyEmojiPicker } from '@/features/emoji-picker';
import { cn } from '@/shared/lib/cn';
import { useFormatters } from '@/shared/lib/format';
import { getSocket } from '@/shared/socket/client';
import { Avatar, Button, Popover, PopoverContent, PopoverTrigger, Spinner, Tooltip } from '@/shared/ui';
import { loadDraft, saveDraft } from '../model/drafts';
import { findMentionQuery, insertAt, insertMention, wrapSelection, type Edit } from '../model/text';
import { useUploads, type UploadItem } from '../model/uploads';

export interface ComposerProps {
  conversationId: string;
  threadRootId?: string;
  draftKey: string;
  placeholder: string;
  members: User[];
  allowChannelMention: boolean;
  meId: string;
  disabled?: boolean;
  disabledReason?: string;
  autoFocus?: boolean;
  onEditLast?: () => void;
  onSent?: () => void;
}

interface MentionOption {
  key: string;
  handle: string;
  label: string;
  hue: number;
  isChannel?: boolean;
}

const MAX_HEIGHT = 220;

function UploadChip({ item, onRemove }: { item: UploadItem; onRemove: () => void }) {
  const { t } = useTranslation();
  const f = useFormatters();
  const errorText =
    item.error === 'tooBig' ? t('composer.tooBig', { size: f.bytes(LIMITS.maxFileSizeBytes) }) : item.error === 'type' ? t('composer.typeNotAllowed') : t('composer.uploadFailed');
  return (
    <li className={cn('relative flex h-14 max-w-56 items-center gap-2.5 overflow-hidden rounded-xl border bg-elevated pe-8 ps-1.5', item.status === 'error' ? 'border-danger-ink/60' : 'border-line')}>
      {item.previewUrl ? (
        <img src={item.previewUrl} alt="" className="size-11 shrink-0 rounded-lg object-cover" />
      ) : (
        <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-mention text-accent-ink">
          <FileText className="size-5" />
        </span>
      )}
      <span className="min-w-0 text-xs">
        <span className="block truncate font-medium" dir="auto">
          {item.name}
        </span>
        <span className={cn('block truncate', item.status === 'error' ? 'text-danger-ink' : 'text-muted')}>
          {item.status === 'error' ? errorText : item.status === 'uploading' ? `${item.progress}%` : f.bytes(item.size)}
        </span>
      </span>
      {item.status === 'uploading' && (
        <span className="absolute inset-x-0 bottom-0 h-0.5 bg-line">
          <span className="block h-full bg-accent transition-[width]" style={{ width: `${item.progress}%` }} />
        </span>
      )}
      <button type="button" onClick={onRemove} aria-label={t('composer.removeFile')} className="absolute end-1 top-1 grid size-6 place-items-center rounded-md text-muted hover:bg-elevated-2 hover:text-fg">
        <X className="size-3.5" />
      </button>
    </li>
  );
}

export function Composer(props: ComposerProps) {
  const { t } = useTranslation();
  const [text, setText] = useState(() => loadDraft(props.draftKey));
  const [mention, setMention] = useState<{ q: ReturnType<typeof findMentionQuery> & object; index: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploads = useUploads();
  const listId = useId();
  const typingState = useRef({ last: 0, timer: 0 as unknown as ReturnType<typeof setTimeout> });
  const dragDepth = useRef(0);

  // ---- draft persistence (per conversation / thread) -----------------------------------------
  const keyRef = useRef(props.draftKey);
  useEffect(() => {
    if (keyRef.current !== props.draftKey) {
      keyRef.current = props.draftKey;
      setText(loadDraft(props.draftKey));
      uploads.reset();
    }
  }, [props.draftKey, uploads]);
  useEffect(() => {
    const id = setTimeout(() => saveDraft(props.draftKey, text), 300);
    return () => clearTimeout(id);
  }, [text, props.draftKey]);

  useEffect(() => {
    if (props.autoFocus) area.current?.focus();
  }, [props.autoFocus, props.draftKey]);

  // ---- auto-resize ---------------------------------------------------------------------------------
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  }, [text]);

  // ---- typing indicator ------------------------------------------------------------------------------
  const emitTyping = useCallback(
    (isTyping: boolean) => {
      getSocket()?.emit('typing', { conversationId: props.conversationId, isTyping });
    },
    [props.conversationId],
  );
  const stopTyping = useCallback(() => {
    clearTimeout(typingState.current.timer);
    if (typingState.current.last) emitTyping(false);
    typingState.current.last = 0;
  }, [emitTyping]);
  useEffect(() => stopTyping, [stopTyping]);

  const noteTyping = (value: string) => {
    if (!value.trim()) return stopTyping();
    const now = Date.now();
    if (now - typingState.current.last > 3000) {
      emitTyping(true);
      typingState.current.last = now;
    }
    clearTimeout(typingState.current.timer);
    typingState.current.timer = setTimeout(stopTyping, 4000);
  };

  // ---- editing helpers ---------------------------------------------------------------------------------
  const apply = (edit: Edit) => {
    setText(edit.value);
    requestAnimationFrame(() => {
      const el = area.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(edit.selectionStart, edit.selectionEnd);
    });
    noteTyping(edit.value);
  };
  const selection = () => ({ start: area.current?.selectionStart ?? text.length, end: area.current?.selectionEnd ?? text.length });
  const wrap = (before: string, after = before) => {
    const { start, end } = selection();
    apply(wrapSelection(text, start, end, before, after));
  };
  const insertEmoji = (emoji: string) => {
    const { start, end } = selection();
    apply(insertAt(text, start, end, emoji));
    setEmojiOpen(false);
  };
  const insertLink = () => {
    const { start, end } = selection();
    const label = text.slice(start, end);
    const edit = insertAt(text, start, end, label || 'https://');
    apply({ ...edit, selectionStart: start, selectionEnd: start + (label || 'https://').length });
  };

  // ---- mentions ---------------------------------------------------------------------------------------------
  const options = useMemo<MentionOption[]>(() => {
    if (!mention) return [];
    const q = mention.q.query.toLowerCase();
    const people = props.members
      .filter((u) => u.id !== props.meId && (u.handle.includes(q) || u.name.toLowerCase().includes(q)))
      .slice(0, 6)
      .map((u) => ({ key: u.id, handle: u.handle, label: u.name, hue: u.hue }));
    const channel: MentionOption[] = props.allowChannelMention && 'channel'.startsWith(q) ? [{ key: 'channel', handle: 'channel', label: t('composer.everyone'), hue: 40, isChannel: true }] : [];
    return [...people, ...channel];
  }, [mention, props.members, props.meId, props.allowChannelMention, t]);

  const refreshMention = (value: string, caret: number) => {
    const q = findMentionQuery(value, caret);
    setMention(q ? { q, index: 0 } : null);
  };
  const pickMention = (opt: MentionOption) => {
    if (!mention) return;
    const caret = area.current?.selectionStart ?? text.length;
    apply(insertMention(text, mention.q, caret, opt.handle));
    setMention(null);
  };

  // ---- sending ---------------------------------------------------------------------------------------------------
  const uploading = uploads.items.some((i) => i.status === 'uploading');
  const ready = uploads.items.filter((i) => i.status === 'done' && i.attachment);
  const canSend = !props.disabled && !uploading && (text.trim().length > 0 || ready.length > 0) && text.length <= LIMITS.messageMaxLength;

  const submit = () => {
    if (!canSend) return;
    sendMessage({
      conversationId: props.conversationId,
      authorId: props.meId,
      text: text.trim(),
      attachments: ready.map((i) => i.attachment!),
      ...(props.threadRootId ? { threadRootId: props.threadRootId } : {}),
    });
    stopTyping();
    setText('');
    saveDraft(props.draftKey, '');
    uploads.reset();
    setMention(null);
    props.onSent?.();
    requestAnimationFrame(() => area.current?.focus());
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return; // IME (Persian, CJK) composition in progress
    if (mention && options.length > 0) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const dir = e.key === 'ArrowDown' ? 1 : -1;
        setMention({ ...mention, index: (mention.index + dir + options.length) % options.length });
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        pickMention(options[mention.index]!);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMention(null);
        return;
      }
    }
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'b') return (e.preventDefault(), wrap('**'));
    if (mod && e.key.toLowerCase() === 'i') return (e.preventDefault(), wrap('_'));
    if (mod && e.key.toLowerCase() === 'e') return (e.preventDefault(), wrap('`'));
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
      return;
    }
    if (e.key === 'ArrowUp' && text === '' && props.onEditLast) {
      e.preventDefault();
      props.onEditLast();
    }
  };

  // ---- files -----------------------------------------------------------------------------------------------------------
  const addFiles = (files: File[]) => {
    const room = LIMITS.maxAttachmentsPerMessage - uploads.items.length;
    if (room <= 0) return;
    uploads.add(files.slice(0, room));
  };
  const onPaste = (e: ClipboardEvent) => {
    const files = [...e.clipboardData.files];
    if (files.length) {
      e.preventDefault();
      addFiles(files);
    }
  };
  const hasFiles = (e: DragEvent) => [...e.dataTransfer.types].includes('Files');
  const onDragEnter = (e: DragEvent) => {
    if (!hasFiles(e)) return;
    dragDepth.current++;
    setDragging(true);
  };
  const onDragLeave = (e: DragEvent) => {
    if (!hasFiles(e)) return;
    if (--dragDepth.current <= 0) setDragging(false);
  };
  const onDrop = (e: DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    addFiles([...e.dataTransfer.files]);
  };

  const left = LIMITS.messageMaxLength - text.length;

  if (props.disabled) {
    return (
      <div className="mx-4 mb-4 rounded-2xl border border-line bg-panel px-4 py-3 text-center text-sm text-muted">{props.disabledReason}</div>
    );
  }

  return (
    <div
      className={cn('relative mx-3 mb-3 rounded-2xl border bg-panel transition-colors focus-within:border-accent/70 sm:mx-4 sm:mb-4', dragging ? 'border-accent border-dashed' : 'border-line')}
      onDragEnter={onDragEnter}
      onDragOver={(e) => hasFiles(e) && e.preventDefault()}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-2xl bg-panel/90 text-sm font-medium text-accent-ink">{t('composer.dropFiles')}</div>
      )}

      {mention && options.length > 0 && (
        <ul id={listId} role="listbox" className="absolute bottom-full start-0 z-20 mb-2 w-72 max-w-full overflow-hidden rounded-xl border border-line bg-panel p-1 shadow-pop">
          {options.map((o, i) => (
            <li key={o.key} role="option" aria-selected={i === mention.index}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pickMention(o)}
                className={cn('flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-start text-sm', i === mention.index && 'bg-elevated')}
              >
                <Avatar name={o.label} hue={o.hue} size="sm" />
                <span className="min-w-0 flex-1 truncate" dir="auto">
                  {o.isChannel ? '@channel' : o.label}
                </span>
                <span className="truncate text-xs text-muted" dir="ltr">
                  {o.isChannel ? '' : `@${o.handle}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {uploads.items.length > 0 && (
        <ul className="flex flex-wrap gap-2 px-3 pt-3">
          {uploads.items.map((i) => (
            <UploadChip key={i.id} item={i} onRemove={() => uploads.remove(i.id)} />
          ))}
        </ul>
      )}

      <textarea
        ref={area}
        value={text}
        rows={1}
        dir="auto"
        placeholder={props.placeholder}
        aria-label={props.placeholder}
        aria-autocomplete="list"
        aria-controls={mention ? listId : undefined}
        enterKeyHint="send"
        onChange={(e) => {
          setText(e.target.value);
          noteTyping(e.target.value);
          refreshMention(e.target.value, e.target.selectionStart);
        }}
        onKeyDown={onKeyDown}
        onKeyUp={(e) => ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key) && refreshMention(text, e.currentTarget.selectionStart)}
        onClick={(e) => refreshMention(text, e.currentTarget.selectionStart)}
        onBlur={() => {
          stopTyping();
          setTimeout(() => setMention(null), 120);
        }}
        onPaste={onPaste}
        className="block max-h-[220px] w-full resize-none bg-transparent px-4 pb-1 pt-3 text-[15px] leading-relaxed text-fg placeholder:text-faint focus:outline-none"
      />

      <div className="flex items-center gap-0.5 px-2 pb-2">
        <Tooltip label={`${t('composer.bold')} (Ctrl+B)`}>
          <Button variant="ghost" size="icon-sm" aria-label={t('composer.bold')} onClick={() => wrap('**')} className="hidden sm:inline-flex">
            <Bold className="size-4" />
          </Button>
        </Tooltip>
        <Tooltip label={`${t('composer.italic')} (Ctrl+I)`}>
          <Button variant="ghost" size="icon-sm" aria-label={t('composer.italic')} onClick={() => wrap('_')} className="hidden sm:inline-flex">
            <Italic className="size-4" />
          </Button>
        </Tooltip>
        <Tooltip label={`${t('composer.code')} (Ctrl+E)`}>
          <Button variant="ghost" size="icon-sm" aria-label={t('composer.code')} onClick={() => wrap('`')} className="hidden sm:inline-flex">
            <Code className="size-4" />
          </Button>
        </Tooltip>
        <Tooltip label={t('composer.link')}>
          <Button variant="ghost" size="icon-sm" aria-label={t('composer.link')} onClick={insertLink} className="hidden sm:inline-flex">
            <Link2 className="size-4" />
          </Button>
        </Tooltip>
        <span className="mx-1 hidden h-4 w-px bg-line sm:block" />
        <Tooltip label={t('composer.mention')}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t('composer.mention')}
            onClick={() => {
              const { start, end } = selection();
              apply(insertAt(text, start, end, '@'));
              requestAnimationFrame(() => area.current && refreshMention(area.current.value, area.current.selectionStart));
            }}
          >
            <AtSign className="size-4" />
          </Button>
        </Tooltip>
        <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
          <Tooltip label={t('composer.emoji')}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={t('composer.emoji')}>
                <Smile className="size-4" />
              </Button>
            </PopoverTrigger>
          </Tooltip>
          <PopoverContent align="start" side="top">
            <Suspense fallback={<div className="grid h-60 w-72 place-items-center"><Spinner /></div>}>
              <LazyEmojiPicker onPick={insertEmoji} />
            </Suspense>
          </PopoverContent>
        </Popover>
        <Tooltip label={t('composer.attach')}>
          <Button variant="ghost" size="icon-sm" aria-label={t('composer.attach')} onClick={() => fileInput.current?.click()}>
            <Paperclip className="size-4" />
          </Button>
        </Tooltip>
        <input
          ref={fileInput}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            addFiles([...(e.target.files ?? [])]);
            e.target.value = '';
          }}
        />

        <span className="flex-1" />
        {left < 400 && (
          <span className={cn('me-2 text-xs tabular-nums', left < 0 ? 'text-danger-ink' : 'text-muted')} aria-live="polite">
            {t('composer.charsLeft', { count: left })}
          </span>
        )}
        <Tooltip label={`${t('composer.send')} (Enter)`}>
          <Button variant={canSend ? 'primary' : 'secondary'} size="icon" aria-label={t('composer.send')} disabled={!canSend} onClick={submit}>
            {uploading ? <Spinner /> : <SendHorizontal className="size-4 rtl:-scale-x-100" />}
          </Button>
        </Tooltip>
      </div>
    </div>
  );
}
