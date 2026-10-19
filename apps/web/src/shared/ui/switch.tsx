import * as RadixSwitch from '@radix-ui/react-switch';
import { cn } from '../lib/cn';

export function Switch({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof RadixSwitch.Root>) {
  return (
    <RadixSwitch.Root
      className={cn(
        'relative h-6 w-10 shrink-0 rounded-full border border-line bg-elevated-2 transition-colors data-[state=checked]:border-transparent data-[state=checked]:bg-primary',
        className,
      )}
      {...props}
    >
      <RadixSwitch.Thumb className="block size-4.5 translate-x-0.5 rounded-full bg-fg transition-transform data-[state=checked]:translate-x-[1.1rem] data-[state=checked]:bg-white rtl:-translate-x-0.5 rtl:data-[state=checked]:-translate-x-[1.1rem]" />
    </RadixSwitch.Root>
  );
}
