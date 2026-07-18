import type { InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-[13px] shadow-soft placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none aria-invalid:border-destructive aria-invalid:ring-destructive/20 disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
