import { BabeMark } from '@/components/brand/mark';
import { GITHUB_URL } from '@/lib/site';
import { ThemeControl } from './theme-control';

/* The footer is also the internal link graph: it is the only thing on the site
 * that points at the explainer pages, so every page links to them and they are
 * one hop from anywhere. */
const LINK_GROUPS = [
  {
    heading: 'Product',
    links: [
      { label: 'How it works', href: '/#how' },
      { label: 'Pricing', href: '/pricing/' },
      { label: 'FAQ', href: '/#faq' },
    ],
  },
  {
    heading: 'Learn',
    links: [
      { label: 'Calendar call reminders', href: '/google-calendar-phone-call-reminders/' },
      { label: 'Reminders through DND', href: '/do-not-disturb-meeting-reminders/' },
      { label: 'Reminder options compared', href: '/calendar-reminder-alternatives/' },
    ],
  },
  {
    heading: 'Open source',
    links: [
      { label: 'GitHub', href: GITHUB_URL },
      { label: 'Self-hosting', href: `${GITHUB_URL}#self-hosting` },
      { label: 'License', href: `${GITHUB_URL}/blob/main/LICENSE` },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Contact', href: '/contact/' },
      { label: 'Privacy', href: '/privacy/' },
      { label: 'Terms', href: '/terms/' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="footer-dawn">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-12 py-16 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1.1fr_1fr_0.7fr]">
          <div className="max-w-xs">
            <div className="flex items-center gap-2 font-semibold tracking-tight">
              <BabeMark className="size-7" />
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

        <div className="flex flex-col gap-4 border-t border-line-soft py-7 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-[12px] text-muted-2">© 2026 Wake Up Babe</p>
          <div className="flex items-center gap-4">
            <p className="font-mono text-[12px] text-muted-2">wakeupba.be</p>
            <ThemeControl />
          </div>
        </div>
      </div>
    </footer>
  );
}
