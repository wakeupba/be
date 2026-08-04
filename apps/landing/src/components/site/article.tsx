import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/*
 * The shell every text page shares: legal documents and the explainer pages.
 *
 * One display moment (the h1), a mono metadata line, then a full-bleed hairline
 * that runs past the reading column. Sections are ruled ledger rows: a tabular
 * mono number in the margin, a hairline above, no cards. Reading, not browsing,
 * so nothing here reveals on scroll.
 */

export function ArticleShell({
  eyebrow,
  title,
  lede,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  lede: string;
  /* ISO date. Rendered long-form for people, carried in <time> for machines. */
  updated?: string;
  children: ReactNode;
}) {
  return (
    <article>
      <header className="border-b border-line-soft">
        <div className="mx-auto max-w-3xl px-6 pb-12 pt-16 sm:pb-16 sm:pt-24">
          <p className="rise rise-1 font-mono text-[12px] uppercase tracking-[0.14em] text-muted-2">
            {eyebrow}
          </p>
          <h1 className="rise rise-2 mt-4 text-3xl font-semibold leading-[1.1] tracking-tight sm:text-4xl">
            {title}
          </h1>
          <p className="rise rise-3 mt-5 max-w-2xl text-[17px] leading-relaxed text-muted">{lede}</p>
          {updated && (
            <p className="rise rise-4 mt-8 font-mono text-[12px] tabular-nums text-muted-2">
              Last updated{' '}
              <time dateTime={updated}>
                {new Date(`${updated}T00:00:00Z`).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  timeZone: 'UTC',
                })}
              </time>
            </p>
          )}
        </div>
      </header>
      <div className="mx-auto max-w-3xl px-6 pb-24 sm:pb-32">{children}</div>
    </article>
  );
}

/* n is the visible section number, so it is mono and tabular. Passing it in
 * rather than counting with a CSS counter keeps the numbers stable when a
 * section moves, which matters when a privacy policy cites its own clauses. */
export function Section({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <section className="border-b border-line-soft py-10 last:border-b-0 last:pb-0">
      <div className="flex gap-4 sm:gap-6">
        <p className="w-6 shrink-0 pt-1 font-mono text-[12px] tabular-nums text-muted-2">{n}</p>
        <div className="min-w-0 flex-1">
          <h2 className="text-[19px] font-semibold tracking-tight">{title}</h2>
          <Prose className="mt-4">{children}</Prose>
        </div>
      </div>
    </section>
  );
}

/* Body copy. Spacing and link treatment live in globals.css under .prose so the
 * page bodies stay readable prose instead of a wall of utility classes. */
export function Prose({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('prose', className)}>{children}</div>;
}

/* A definition row, for the "what we store" tables in the privacy policy. The
 * label is mono because it names a database column, not a concept. */
export function DataRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-line-soft py-3 last:border-b-0 sm:grid-cols-[13rem_1fr] sm:gap-6">
      <p className="font-mono text-[12.5px] leading-relaxed text-foreground">{label}</p>
      <p className="text-[14.5px] leading-relaxed text-muted">{children}</p>
    </div>
  );
}

/* A real comparison table: hairline rules, mono column headers, no zebra
 * striping and no cell borders.
 *
 * On lg it breaks out past the reading column, because five columns inside a
 * 48rem measure wraps every one-word answer onto two lines and the table is the
 * argument on this page.
 *
 * Below sm it stops being a table and becomes labelled blocks, driven entirely
 * by CSS in globals.css against `data-label` (one DOM, no duplicated copy for a
 * crawler to read twice). Horizontal scroll was the first attempt and it was
 * wrong: a fixed layout narrow enough to fit a phone squeezes the verdict column
 * to about eighty pixels, and the rows grow tall enough that the visible cells
 * float in a lot of nothing. */
export function CompareTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: { label: string; cells: ReactNode[] }[];
}) {
  return (
    <div className="compare -mx-6 px-6 sm:overflow-x-auto lg:-mx-20 lg:px-0">
      <table className="w-full border-collapse text-left sm:min-w-[36rem] sm:table-fixed">
        <thead>
          <tr className="border-b border-line">
            <th
              scope="col"
              className="w-[8.5rem] pb-3 pr-5 font-mono text-[11px] font-normal uppercase tracking-[0.14em] text-muted-2"
            >
              Channel
            </th>
            {columns.map((column, index) => (
              <th
                key={column}
                scope="col"
                className={cn(
                  'pb-3 pr-5 align-bottom font-mono text-[11px] font-normal uppercase tracking-[0.14em] text-muted-2 last:pr-0',
                  index === columns.length - 1 ? 'w-auto' : 'w-[7.5rem]',
                )}
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-line-soft last:border-b-0">
              <th scope="row" className="py-4 pr-5 align-top text-[14px] font-medium text-foreground sm:py-4">
                {row.label}
              </th>
              {row.cells.map((cell, index) => (
                <td
                  // biome-ignore lint/suspicious/noArrayIndexKey: cells are positional, tied to the column order
                  key={index}
                  data-label={columns[index]}
                  className="py-4 pr-5 align-top text-[14px] leading-relaxed text-muted last:pr-0"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
