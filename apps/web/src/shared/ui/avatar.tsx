import { cn, initials } from '@/shared/lib';

type Props = {
  name: string;
  className?: string;
  size?: 'sm' | 'md';
};

const hues = [
  'bg-violet-600/80',
  'bg-fuchsia-600/80',
  'bg-sky-600/80',
  'bg-emerald-600/80',
  'bg-amber-600/80',
  'bg-rose-600/80',
  'bg-indigo-600/80',
];

function hueFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h + name.charCodeAt(i) * (i + 1)) % hues.length;
  return hues[h]!;
}

export function Avatar({ name, className, size = 'md' }: Props) {
  return (
    <div
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white',
        hueFor(name),
        size === 'sm' && 'h-7 w-7 text-[10px]',
        size === 'md' && 'h-9 w-9 text-xs',
        className,
      )}
    >
      {initials(name)}
    </div>
  );
}
