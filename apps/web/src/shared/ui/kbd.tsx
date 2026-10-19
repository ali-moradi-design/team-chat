import { cn } from '../lib/cn';

export const Kbd = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <kbd
    dir="ltr"
    className={cn(
      'rounded-md border border-line bg-elevated px-1.5 py-0.5 font-sans text-[11px] font-medium text-muted',
      className,
    )}
  >
    {children}
  </kbd>
);
