import type { ReactNode } from 'react';

export function EmptyState({
  icon,
  title,
  children,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-3 px-6 py-12 text-center">
      {icon && (
        <div className="grid size-14 place-items-center rounded-2xl bg-elevated text-accent-ink">
          {icon}
        </div>
      )}
      <h2 className="text-base font-semibold">{title}</h2>
      {children && <div className="text-sm text-muted">{children}</div>}
    </div>
  );
}
