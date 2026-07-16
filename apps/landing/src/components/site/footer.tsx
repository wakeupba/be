import { Phone } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';

const APP_URL = 'https://app.wakeupba.be';

const LINK_GROUPS = [
  {
    heading: 'Product',
    links: [
      { label: 'How it works', href: '#how' },
      { label: 'Pricing', href: '#pricing' },
      { label: 'FAQ', href: '#faq' },
    ],
  },
  {
    heading: 'Open source',
    links: [
      { label: 'GitHub', href: 'https://github.com/spoo-me/wakeupbabe' },
      { label: 'Self-hosting', href: 'https://github.com/spoo-me/wakeupbabe#self-hosting' },
      { label: 'License', href: 'https://github.com/spoo-me/wakeupbabe/blob/main/LICENSE' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Privacy', href: '/privacy/' },
      { label: 'Terms', href: '/terms/' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="footer-dawn">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col items-center gap-6 py-24 text-center sm:py-28">
          <h2 className="max-w-md text-3xl font-semibold tracking-tight sm:text-4xl">
            Your next important meeting is coming.
          </h2>
          <p className="text-[15px] text-muted">Color it red. We will do the rest.</p>
          <ButtonLink href={APP_URL} size="lg">
            Start free
          </ButtonLink>
        </div>

        <div className="grid gap-12 border-t border-line-soft py-14 sm:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="max-w-xs">
            <div className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="flex size-6 items-center justify-center rounded-md bg-foreground text-background">
                <Phone className="size-3.5" aria-hidden />
              </span>
              Wake Up Babe
            </div>
            <p className="mt-3 text-[14px] leading-relaxed text-muted">
              Phone calls for the meetings you cannot miss. Read-only calendar access, one permanent number,
              open source.
            </p>
          </div>
          {LINK_GROUPS.map((group) => (
            <div key={group.heading}>
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-2">
                {group.heading}
              </p>
              <ul className="mt-4 flex flex-col gap-2.5">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-[14px] text-muted transition-colors duration-150 hover:text-foreground"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 border-t border-line-soft py-7 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-[12px] text-muted-2">© 2026 Wake Up Babe</p>
          <p className="font-mono text-[12px] text-muted-2">wakeupba.be</p>
        </div>
      </div>
    </footer>
  );
}
