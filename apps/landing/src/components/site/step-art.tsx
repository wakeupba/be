/*
 * Art panels for the three how-it-works steps. Each is a real product
 * artifact as a static fixture. Steps 1 and 2 share the same overbooked
 * week: wobbly and uncolored first, straightened with the one meeting that
 * matters marked red after. Every panel fades into the card with a white
 * shader at the bottom. Uniform h-44 slots.
 */

const GCAL_BLUE = '#039be5';
const GCAL_TOMATO = '#d50000';
const HIGHLIGHTS = new Set(['Interview', 'Board review']);

/* [title, top, height, indent]: indent staggers chips sideways in the messy
 * variant; the tidy variant restacks everything straight and full width */
type WeekChip = [string, number, number, number];

const INDENTS = ['left-1 right-1', 'left-1 right-6', 'left-4 right-1', 'left-2 right-3'];

const WEEK: Array<{ label: string; date: string; chips: WeekChip[] }> = [
  {
    label: 'MON',
    date: '14',
    chips: [
      ['Sprint sync', 4, 22, 0],
      ['Interview', 24, 30, 2], // highlighted in the tidy variant

      ['All hands', 52, 26, 1],
      ['Budget review', 76, 22, 3],
      ['Sales call', 96, 30, 0],
      ['Vendor call', 124, 24, 2],
      ['Wrap-up', 146, 24, 1],
    ],
  },
  {
    label: 'TUE',
    date: '15',
    chips: [
      ['Standup', 0, 16, 0],
      ['1:1 Maya', 14, 24, 2],
      ['Roadmap', 36, 34, 1],
      ['Hiring sync', 68, 20, 3],
      ['Retro', 86, 24, 0],
      ['Onboarding', 108, 18, 2],
      ['Late review', 124, 26, 1],
      ['Deep work', 152, 22, 3],
    ],
  },
  {
    label: 'WED',
    date: '16',
    chips: [
      ['Planning', 8, 30, 1],
      ['Board review', 36, 22, 0], // highlighted in the tidy variant

      ['Customer call', 56, 28, 3],
      ['Design crit', 82, 20, 1],
      ['Late sync', 100, 30, 2],
      ['Follow-ups', 128, 22, 0],
      ['EOD sync', 148, 24, 2],
    ],
  },
];

function ArtFade() {
  return (
    <span
      className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-12 bg-gradient-to-t from-white to-transparent"
      aria-hidden
    />
  );
}

export function WeekArt({ tidy = false }: { tidy?: boolean }) {
  return (
    <div className="relative h-52 overflow-hidden border-b border-line-soft bg-background">
      <div className="grid h-8 grid-cols-3 border-b border-line-soft">
        {WEEK.map((day) => (
          <div
            key={day.label}
            className="flex items-center justify-center gap-1 border-r border-line-soft last:border-r-0"
          >
            <span className="font-mono text-[9px] tracking-wide text-muted-2">{day.label}</span>
            <span className="text-[11px] font-medium text-muted">{day.date}</span>
          </div>
        ))}
      </div>
      <div className="relative grid h-[176px] grid-cols-3">
        {WEEK.map((day) => {
          let stackedTop = 4;
          return (
            <div key={day.label} className="relative border-r border-line-soft last:border-r-0">
              {day.chips.map(([title, top, height, indent]) => {
                const chipTop = tidy ? stackedTop : top;
                if (tidy) stackedTop += height + 3;
                const isHighlighted = tidy && HIGHLIGHTS.has(title);
                const color = isHighlighted ? GCAL_TOMATO : GCAL_BLUE;
                return (
                  <div
                    key={title}
                    className={`absolute ${tidy ? 'left-1 right-1' : INDENTS[indent]} truncate rounded-[3px] px-1.5 py-0.5 text-[9px] font-medium leading-tight text-white ${tidy ? '' : 'ring-1 ring-white'}`}
                    style={{ top: chipTop, height, backgroundColor: color }}
                  >
                    {title}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      <ArtFade />
    </div>
  );
}

export function IphoneCallArt() {
  return (
    <div className="relative flex h-52 items-end justify-center overflow-hidden border-b border-line-soft bg-background">
      <div className="relative h-44 w-64 rounded-t-[2.6rem] border border-b-0 border-zinc-500/40 bg-zinc-800 p-[5px] pb-0">
        <div className="h-full w-full rounded-t-[2.3rem] bg-[linear-gradient(165deg,#4b5563_0%,#27272a_55%,#101014_100%)] px-4 pt-2.5">
          {/* dynamic island */}
          <span className="mx-auto block h-5 w-24 rounded-full bg-black" aria-hidden />
          <div className="mt-5 text-center">
            <p className="text-[11px] text-white/55">incoming call</p>
            <p className="mt-1.5 text-[22px] font-light tracking-tight text-white">Wake Up Babe</p>
            <p className="mt-0.5 text-[10.5px] text-white/55">wakeupba.be</p>
          </div>
        </div>
      </div>
      <ArtFade />
    </div>
  );
}
