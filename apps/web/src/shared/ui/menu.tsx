import * as Dropdown from '@radix-ui/react-dropdown-menu';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from '../lib/cn';

export const Menu = Dropdown.Root;
export const MenuTrigger = Dropdown.Trigger;

export function MenuContent({ className, children, ...props }: ComponentPropsWithoutRef<typeof Dropdown.Content>) {
  return (
    <Dropdown.Portal>
      <Dropdown.Content
        sideOffset={6}
        collisionPadding={8}
        className={cn(
          'z-50 min-w-48 animate-pop rounded-xl border border-line bg-panel p-1 shadow-pop focus:outline-none',
          className,
        )}
        {...props}
      >
        {children}
      </Dropdown.Content>
    </Dropdown.Portal>
  );
}

export function MenuItem({
  icon,
  danger,
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof Dropdown.Item> & { icon?: ReactNode; danger?: boolean }) {
  return (
    <Dropdown.Item
      className={cn(
        'flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none data-[highlighted]:bg-elevated',
        danger ? 'text-danger-ink' : 'text-fg',
        className,
      )}
      {...props}
    >
      {icon && <span className="grid size-4 place-items-center text-muted">{icon}</span>}
      {children}
    </Dropdown.Item>
  );
}

export const MenuSeparator = () => <Dropdown.Separator className="my-1 h-px bg-line" />;
export const MenuLabel = ({ children }: { children: ReactNode }) => (
  <Dropdown.Label className="px-2.5 py-1.5 text-xs font-medium text-faint">{children}</Dropdown.Label>
);
