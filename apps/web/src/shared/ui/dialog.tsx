import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';
import { Button } from './button';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  /** Use a full-height sheet on small screens (search, pickers). */
  mobileSheet?: boolean;
}

export function Dialog({ open, onOpenChange, title, description, children, className, mobileSheet }: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 animate-fade bg-black/60 backdrop-blur-[2px]" />
        <RadixDialog.Content
          aria-describedby={description ? undefined : undefined}
          className={cn(
            'fixed z-50 flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden border border-line bg-panel shadow-pop animate-pop focus:outline-none',
            mobileSheet
              ? 'inset-x-0 bottom-0 rounded-t-2xl sm:inset-auto sm:start-1/2 sm:top-[12vh] sm:w-[min(36rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:rounded-2xl rtl:sm:translate-x-1/2'
              : 'start-1/2 top-1/2 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl rtl:translate-x-1/2',
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <RadixDialog.Title className="text-base font-semibold">{title}</RadixDialog.Title>
              {description ? (
                <RadixDialog.Description className="mt-0.5 text-sm text-muted">{description}</RadixDialog.Description>
              ) : (
                <RadixDialog.Description className="sr-only">{title}</RadixDialog.Description>
              )}
            </div>
            <RadixDialog.Close asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Close">
                <X className="size-4" />
              </Button>
            </RadixDialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
