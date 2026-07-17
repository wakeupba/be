import type { SVGProps } from 'react';

/*
 * The Wake Up Babe mark: half-lidded eyes, mid-wake-up, thoroughly
 * unimpressed that you almost missed the board review. Ink on paper by
 * default; pass ink/paper to invert on dark surfaces.
 */
type MarkProps = SVGProps<SVGSVGElement> & { ink?: string; paper?: string };

export function BabeMark({ ink = '#18181b', paper = '#ffffff', ...props }: MarkProps) {
  return (
    <svg viewBox="0 0 32 32" role="img" aria-label="Wake Up Babe" {...props}>
      <path
        d="M3 13 a7 7 0 0 0 14 3 a 7 7 0 0 0 -0.6 -3 z"
        fill={paper}
        stroke={ink}
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path
        d="M15.6 13 a7 7 0 0 0 14 3 a 7 7 0 0 0 -0.6 -3 z"
        fill={paper}
        stroke={ink}
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <circle cx="10.5" cy="15.5" r="2.4" fill={ink} />
      <circle cx="23" cy="15.5" r="2.4" fill={ink} />
    </svg>
  );
}
