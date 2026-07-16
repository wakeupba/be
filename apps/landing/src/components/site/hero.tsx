import { Phone, PhoneOff, Video } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';

const APP_URL = 'https://app.wakeupba.be';

/*
 * The hero proof is the product itself as static fixtures: the red event in
 * the calendar, and the call it produces. No screenshots, no fake chrome.
 */
function EventCard() {
  return (
    <div className="rounded-card border border-line bg-background p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-2">Your calendar, 2:15 pm</p>
      <div className="mt-3 flex items-start gap-3">
        <span className="mt-1 size-3 shrink-0 rounded-[4px] bg-accent" aria-hidden />
        <div className="min-w-0">
          <p className="truncate text-[15px] font-medium">Quarterly board review</p>
          <p className="mt-0.5 flex items-center gap-1.5 font-mono text-[12px] text-muted">
            <Video className="size-3.5" aria-hidden />
            2:30 PM <span aria-hidden>·</span> Google Meet <span aria-hidden>·</span> 6 attendees
          </p>
        </div>
      </div>
      <p className="mt-3 border-t border-line-soft pt-3 font-mono text-[12px] text-muted-2">
        colored red, rings at 2:15 PM
      </p>
    </div>
  );
}

function CallCard() {
  return (
    <div className="rounded-card border border-line bg-background p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="ring-pulse flex size-10 items-center justify-center rounded-full bg-foreground text-background">
            <Phone className="size-4" aria-hidden />
          </span>
          <div>
            <p className="text-[15px] font-medium leading-tight">Wake Up Babe</p>
            <p className="font-mono text-[12px] text-muted">incoming call</p>
          </div>
        </div>
        <p className="font-mono text-[12px] tabular-nums text-muted-2">2:15 PM</p>
      </div>
      <p className="mt-4 rounded-lg bg-surface px-3 py-2.5 text-[13px] leading-relaxed text-muted">
        Wake up babe. Quarterly board review starts in 15 minutes. 6 people are expected.
      </p>
      <div className="mt-3 flex items-center justify-between border-t border-line-soft pt-3">
        <p className="font-mono text-[12px] text-muted-2">1 acknowledge · 2 snooze</p>
        <div className="flex items-center gap-2" aria-hidden>
          <span className="flex size-7 items-center justify-center rounded-full border border-line text-muted-2">
            <PhoneOff className="size-3.5" />
          </span>
          <span className="flex size-7 items-center justify-center rounded-full bg-success text-white">
            <Phone className="size-3.5" />
          </span>
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="border-b border-line-soft">
      <div className="mx-auto grid max-w-5xl gap-12 border-x border-line-soft px-6 py-16 sm:py-24 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
        <div className="flex flex-col justify-center">
          <a
            href="https://github.com/spoo-me/wakeupbabe"
            className="rise rise-1 inline-flex w-fit items-center gap-2 rounded-full border border-line px-3 py-1 font-mono text-[12px] text-muted transition-colors duration-150 hover:text-foreground"
          >
            open source, AGPL licensed
          </a>
          <h1 className="rise rise-2 mt-5 text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">
            Color a meeting red. Your phone rings before it.
          </h1>
          <p className="rise rise-3 mt-5 max-w-md text-lg leading-relaxed text-muted">
            Wake Up Babe calls you before the meetings you mark as important, through Do Not Disturb.
            Notifications get ignored. Phone calls get answered.
          </p>
          <div className="rise rise-4 mt-8 flex flex-wrap items-center gap-3">
            <ButtonLink href={APP_URL} size="lg">
              Start free
            </ButtonLink>
            <ButtonLink href="#how" variant="secondary" size="lg">
              How it works
            </ButtonLink>
          </div>
          <p className="rise rise-4 mt-4 font-mono text-[12px] text-muted-2">
            5 free calls a month. No card required.
          </p>
        </div>
        <div className="flex flex-col justify-center gap-3">
          <EventCard />
          <div className="flex justify-center" aria-hidden>
            <span className="h-6 w-px bg-line" />
          </div>
          <CallCard />
        </div>
      </div>
    </section>
  );
}
