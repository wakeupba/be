const STEPS = [
  {
    number: '01',
    title: 'Connect your calendar',
    body: 'Sign in with Google. We ask for read-only access, so we can see events but never touch them.',
  },
  {
    number: '02',
    title: 'Color the meetings that matter',
    body: 'Mark any event red in Google Calendar, the same way you already color things. That is the whole workflow.',
  },
  {
    number: '03',
    title: 'Answer the call',
    body: 'Your phone rings before the meeting with a short briefing. Press 1 to acknowledge, press 2 and we call again in 5 minutes.',
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="border-b border-line-soft">
      <div className="mx-auto max-w-5xl border-x border-line-soft px-6 py-16 sm:py-20">
        <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-muted-2">How it works</p>
        <h2 className="mt-3 max-w-md text-2xl font-semibold tracking-tight sm:text-3xl">
          No new app to live in. Your calendar is the interface.
        </h2>
        <div className="mt-10 grid gap-px overflow-hidden rounded-card border border-line-soft bg-line-soft sm:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.number} className="bg-background p-6">
              <p className="font-mono text-[12px] tabular-nums text-muted-2">{step.number}</p>
              <h3 className="mt-3 text-[15px] font-semibold">{step.title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
