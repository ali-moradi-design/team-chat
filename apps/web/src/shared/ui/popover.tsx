import * as RadixPopover from '@radix-ui/react-popover';
import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '../lib/cn';

export const Popover = RadixPopover.Root;
export const PopoverTrigger = RadixPopover.Trigger;
export const PopoverAnchor = RadixPopover.Anchor;

export function PopoverContent({ className, ...props }: ComponentPropsWithoutRef<typeof RadixPopover.Content>) {
  return (
    <RadixPopover.Portal>
      <RadixPopover.Content
        sideOffset={8}
        collisionPadding={8}
        className={cn('z-50 animate-pop rounded-xl border border-line bg-panel shadow-pop focus:outline-none', className)}
        {...props}
      />
    </RadixPopover.Portal>
  );
}
