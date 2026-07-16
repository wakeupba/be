import { Phone } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';

const APP_URL = 'https://app.wakeupba.be';

export function Footer() {
  return (
    <footer>
      <div className="mx-auto max-w-5xl border-x border-line-soft px-6">
        <div className="flex flex-col items-start justify-between gap-8 py-14 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Your next important meeting is coming.</h2>
            <p className="mt-2 text-[15px] text-muted">Color it red. We will do the rest.</p>
          </div>
          <ButtonLink href={APP_URL} size="lg">
            Start free
          </ButtonLink>
        </div>
        <div className="flex flex-col gap-4 border-t border-line-soft py-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <span className="flex size-5 items-center justify-center rounded bg-foreground text-background">
              <Phone className="size-3" aria-hidden />
            </span>
            Wake Up Babe
            <span className="font-mono text-[12px] font-normal text-muted-2">wakeupba.be</span>
          </div>
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[12px] text-muted">
            <a
              href="https://github.com/spoo-me/wakeupbabe"
              className="transition-colors duration-150 hover:text-foreground"
            >
              GitHub
            </a>
            <a href="#pricing" className="transition-colors duration-150 hover:text-foreground">
              Pricing
            </a>
            <a href="#faq" className="transition-colors duration-150 hover:text-foreground">
              FAQ
            </a>
            <a href="/privacy/" className="transition-colors duration-150 hover:text-foreground">
              Privacy
            </a>
            <a href="/terms/" className="transition-colors duration-150 hover:text-foreground">
              Terms
            </a>
          </nav>
        </div>
        <p className="border-t border-line-soft py-6 font-mono text-[12px] leading-relaxed text-muted-2">
          AGPL-3.0. Read-only calendar access. Calls come from one permanent number you save once.
        </p>
      </div>
    </footer>
  );
}
