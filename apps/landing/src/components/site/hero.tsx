import { ArrowRight, Phone, PhoneOff } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { CalendarMock } from './calendar-mock';

const APP_URL = 'https://app.wakeupba.be';

function CallCard() {
  return (
    <div className="ring-shake rounded-2xl border border-line bg-background p-4">
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
    <section>
      <div className="mx-auto max-w-6xl px-6 pb-14 pt-20 sm:pb-20 sm:pt-28">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="rise rise-1 text-4xl font-semibold leading-[1.06] tracking-tight sm:text-6xl">
            Color a meeting red.
            <br />
            Your phone rings before it.
          </h1>
          <p className="rise rise-2 mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted">
            Wake Up Babe calls you before the meetings you mark as important, straight through Do Not Disturb.
            Notifications get ignored. Phone calls get answered.
          </p>
          <div className="rise rise-3 mt-9 flex flex-wrap items-center justify-center gap-3">
            <ButtonLink href={APP_URL} size="lg">
              Start free
            </ButtonLink>
            <ButtonLink href="#how" variant="ghost" size="lg" className="gap-1.5">
              How it works
              <ArrowRight className="size-4" aria-hidden />
            </ButtonLink>
          </div>
        </div>

        <div className="rise rise-4 stage-glow mt-16 rounded-3xl border border-line-soft p-5 sm:mt-20 sm:p-10">
          <div className="mx-auto grid max-w-3xl items-center gap-5 lg:grid-cols-[1.1fr_1fr] lg:gap-8">
            <CalendarMock />
            <CallCard />
          </div>
        </div>
      </div>
    </section>
  );
}
