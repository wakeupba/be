import { cva, type VariantProps } from 'class-variance-authority';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/*
 * Kumo bevel buttons: primary is a neutral ink inversion with a same-hue
 * vertical gradient and a +30% white inset top highlight. The accent never
 * fills an ordinary button. Everything depresses 1px on press.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-medium transition-colors duration-150 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 active:translate-y-px',
  {
    variants: {
      variant: {
        primary:
          'border border-[color-mix(in_oklab,var(--primary),black_10%)] bg-linear-to-b from-[color-mix(in_oklab,var(--primary),white_15%)] to-[var(--primary)] text-primary-foreground shadow-[inset_0_1px_0_0_color-mix(in_oklab,var(--primary),white_30%)] hover:from-[color-mix(in_oklab,var(--primary),white_22%)]',
        outline: 'border border-border/60 bg-transparent text-foreground shadow-soft hover:bg-muted/60',
        ghost: 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
        destructive: 'bg-destructive/10 text-destructive hover:bg-destructive/15',
      },
      size: {
        default: 'h-8 rounded-lg px-2.5 text-[13px]',
        sm: 'h-7 rounded-md px-2 text-xs',
        lg: 'h-9 rounded-lg px-3.5 text-sm',
      },
    },
    defaultVariants: { variant: 'primary', size: 'default' },
  },
);

export { buttonVariants };

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

type ButtonLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & VariantProps<typeof buttonVariants>;

export function ButtonLink({ className, variant, size, ...props }: ButtonLinkProps) {
  return <a className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
