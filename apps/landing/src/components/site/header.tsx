import { Phone } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';

const APP_URL = 'https://app.wakeupba.be';

export function Header() {
  return (
    <header>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <a href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex size-6 items-center justify-center rounded-md bg-foreground text-background">
            <Phone className="size-3.5" aria-hidden />
          </span>
          Wake Up Babe
        </a>
        <nav className="flex items-center gap-1">
          <a
            href="#pricing"
            className="hidden rounded-md px-3 py-1.5 text-sm text-muted transition-colors duration-150 hover:text-foreground sm:block"
          >
            Pricing
          </a>
          <a
            href="#faq"
            className="hidden rounded-md px-3 py-1.5 text-sm text-muted transition-colors duration-150 hover:text-foreground sm:block"
          >
            FAQ
          </a>
          <a
            href="https://github.com/spoo-me/wakeupbabe"
            className="hidden rounded-md px-3 py-1.5 text-sm text-muted transition-colors duration-150 hover:text-foreground sm:block"
          >
            GitHub
          </a>
          <div className="ml-2 flex items-center gap-2">
            <ButtonLink href={APP_URL} variant="secondary" size="sm">
              Sign in
            </ButtonLink>
            <ButtonLink href={APP_URL} size="sm">
              Start free
            </ButtonLink>
          </div>
        </nav>
      </div>
    </header>
  );
}
