import { Check } from 'lucide-react';

/*
 * Art panels for the three how-it-works steps. Each is a real product
 * artifact as a static fixture: the messy uncolored week, the google
 * calendar color menu, and the iphone call screen. Uniform h-44 slots.
 */

const GCAL_BLUE = '#039be5';

/* [title, top, height, indent]: indent staggers chips sideways so overlapping
 * meetings pile up the way a real overbooked week does */
type MessyChip = [string, number, number, number];

const INDENTS = ['left-1 right-1', 'left-1 right-6', 'left-4 right-1', 'left-2 right-3'];

const MESSY_DAYS: Array<{ label: string; date: string; chips: MessyChip[] }> = [
  {
    label: 'MON',
    date: '14',
    chips: [
      ['Sprint sync', 4, 22, 0],
      ['Interview', 24, 30, 2],
      ['All hands', 52, 26, 1],
      ['Budget review', 76, 22, 3],
      ['Sales call', 96, 30, 0],
      ['Vendor call', 124, 24, 2],
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
    ],
  },
  {
    label: 'WED',
    date: '16',
    chips: [
      ['Planning', 8, 30, 1],
      ['Board prep', 36, 22, 0],
      ['Customer call', 56, 28, 3],
      ['Design crit', 82, 20, 1],
      ['Late sync', 100, 30, 2],
      ['Follow-ups', 128, 22, 0],
    ],
  },
];

export function MessyWeekArt() {
  return (
    <div className="relative h-44 overflow-hidden border-b border-line-soft bg-background">
      <div className="grid h-8 grid-cols-3 border-b border-line-soft">
        {MESSY_DAYS.map((day) => (
          <div
            key={day.label}
            className="flex items-center justify-center gap-1 border-r border-line-soft last:border-r-0"
          >
            <span className="font-mono text-[9px] tracking-wide text-muted-2">{day.label}</span>
            <span className="text-[11px] font-medium text-muted">{day.date}</span>
          </div>
        ))}
      </div>
      <div className="relative grid h-[144px] grid-cols-3">
        {MESSY_DAYS.map((day) => (
          <div key={day.label} className="relative border-r border-line-soft last:border-r-0">
            {day.chips.map(([title, top, height, indent]) => (
              <div
                key={title}
                className={`absolute ${INDENTS[indent]} truncate rounded-[3px] px-1.5 py-0.5 text-[9px] font-medium leading-tight text-white ring-1 ring-white`}
                style={{ top, height, backgroundColor: GCAL_BLUE }}
              >
                {title}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

const GCAL_PALETTE = [
  '#7986cb',
  '#33b679',
  '#8e24aa',
  '#e67c73',
  '#f6bf26',
  '#f4511e',
  '#039be5',
  '#616161',
  '#3f51b5',
  '#0b8043',
  '#d50000',
];

export function ColorPickerArt() {
  return (
    <div className="relative flex h-44 flex-col items-center justify-center gap-3 overflow-hidden border-b border-line-soft bg-background px-8">
      <div
        className="w-full max-w-56 rounded-[4px] px-2.5 py-1.5 text-white"
        style={{ backgroundColor: '#d50000' }}
      >
        <p className="text-[11.5px] font-medium leading-tight">Quarterly board review</p>
        <p className="text-[10px] text-white/85">2:30 to 3:15 PM</p>
      </div>
      {/* google calendar color menu, tomato selected */}
      <div className="rounded-lg border border-line bg-background p-3 shadow-[0_4px_16px_rgba(24,24,27,0.08)]">
        <div className="grid grid-cols-6 gap-2">
          {GCAL_PALETTE.map((color) => (
            <span
              key={color}
              className="flex size-4 items-center justify-center rounded-full"
              style={{ backgroundColor: color }}
            >
              {color === '#d50000' && <Check className="size-3 text-white" strokeWidth={3} aria-hidden />}
            </span>
          ))}
        </div>
        <p className="mt-2 text-center font-mono text-[9px] text-muted-2">Tomato</p>
      </div>
    </div>
  );
}

export function IphoneCallArt() {
  return (
    <div className="relative flex h-44 items-end justify-center overflow-hidden border-b border-line-soft bg-background">
      <div className="relative h-36 w-52 rounded-t-[2rem] border border-b-0 border-zinc-600/40 bg-[linear-gradient(165deg,#4b5563_0%,#27272a_55%,#101014_100%)] px-4 pt-2.5">
        {/* dynamic island */}
        <span className="mx-auto block h-[18px] w-20 rounded-full bg-black" aria-hidden />
        <div className="mt-5 text-center">
          <p className="text-[11px] text-white/55">incoming call</p>
          <p className="mt-1 text-[19px] font-light tracking-tight text-white">Wake Up Babe</p>
          <p className="mt-0.5 text-[10.5px] text-white/55">wakeupba.be</p>
        </div>
      </div>
    </div>
  );
}
