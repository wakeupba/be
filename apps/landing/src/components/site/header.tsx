import { BabeMark } from '@/components/brand/mark';
import { GITHUB_URL } from '@/lib/site';
import { AuthButtons } from './auth-buttons';

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-line-soft bg-header backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <a href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <BabeMark className="blink size-7" />
          Wake Up Babe
        </a>
        <nav className="flex items-center gap-1">
          <a
            href="/pricing/"
            className="hidden rounded-md px-3 py-1.5 text-sm text-muted transition-colors duration-150 hover:text-foreground sm:block"
          >
            Pricing
          </a>
          <a
            href="/#faq"
            className="hidden rounded-md px-3 py-1.5 text-sm text-muted transition-colors duration-150 hover:text-foreground sm:block"
          >
            FAQ
          </a>
          <a
            href={GITHUB_URL}
            className="hidden rounded-md px-3 py-1.5 text-sm text-muted transition-colors duration-150 hover:text-foreground sm:block"
          >
            GitHub
          </a>
          <div className="ml-2 flex items-center gap-2">
            <AuthButtons />
          </div>
        </nav>
      </div>
    </header>
  );
}
