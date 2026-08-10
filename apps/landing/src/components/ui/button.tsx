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
          'bg-foreground text-background border border-foreground shadow-bevel-primary hover:bg-foreground/90',
        secondary: 'bg-background text-foreground border border-line shadow-bevel-secondary hover:bg-surface',
        ghost: 'text-muted hover:text-foreground hover:bg-surface',
        /* The accent as a fill, reserved for the page's one loud moment. On
         * this site the accent is the calendar red that means "this triggers a
         * call", so a button that places a call is the one place the fill is
         * semantic rather than decorative. text-background flips with the
         * theme, which is what keeps contrast: white on #d92d20 is 4.83:1 in
         * light, #121212 on #f2685a is 6.16:1 in dark. */
        accent: 'bg-accent text-background border border-accent shadow-bevel-primary hover:bg-accent/90',
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
