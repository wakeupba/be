import { cva, type VariantProps } from 'class-variance-authority';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/*
 * Keycap buttons: bordered, compact, inset top highlight instead of a drop
 * shadow. Primary is a foreground inversion; no gradients, no glows.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/40 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'bg-foreground text-background border border-foreground shadow-[inset_0_0.7px_0_rgba(255,255,255,0.25)] hover:bg-foreground/90',
        secondary:
          'bg-background text-foreground border border-line shadow-[inset_0_0.7px_0_rgba(255,255,255,0.7)] hover:bg-surface',
        ghost: 'text-muted hover:text-foreground hover:bg-surface',
      },
      size: {
        default: 'h-9 px-4',
        lg: 'h-10 px-5',
        sm: 'h-8 px-3 text-[13px]',
      },
    },
    defaultVariants: { variant: 'primary', size: 'default' },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

type ButtonLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & VariantProps<typeof buttonVariants>;

export function ButtonLink({ className, variant, size, ...props }: ButtonLinkProps) {
  return <a className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
