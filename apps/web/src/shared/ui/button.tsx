import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

export const buttonStyles = cva(
  'inline-flex shrink-0 select-none items-center justify-center gap-2 rounded-xl font-medium transition-[background,color,transform,opacity] duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-fg hover:bg-primary-hover',
        accent: 'bg-accent text-accent-fg hover:brightness-110',
        secondary: 'border border-line bg-elevated text-fg hover:bg-elevated-2',
        ghost: 'text-muted hover:bg-elevated hover:text-fg',
        danger: 'bg-danger text-white hover:brightness-125',
      },
      size: {
        sm: 'h-8 px-3 text-[13px]',
        md: 'h-10 px-4 text-sm',
        lg: 'h-11 px-5 text-[15px]',
        icon: 'size-9 rounded-lg',
        'icon-sm': 'size-7 rounded-md',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonStyles> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, type = 'button', ...props },
  ref,
) {
  return <button ref={ref} type={type} className={cn(buttonStyles({ variant, size }), className)} {...props} />;
});
