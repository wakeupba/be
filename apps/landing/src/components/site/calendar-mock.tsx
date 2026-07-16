import { GoogleCalendarIcon, GoogleMeetIcon } from '@/components/brand/google';

/*
 * A faithful static Google Calendar day-view fixture. Geometry mirrors the
 * real thing: a time gutter with labels sitting just above each rule, a
 * vertical divider, full-width event chips, and the red now-line spanning
 * only the day column. Hour rows are 64px, top inset 16px.
 */
const HOUR = 64;
const TOP = 16;
const GUTTER = 48;

function minutes(fromOnePm: number): number {
  return TOP + (fromOnePm / 60) * HOUR;
}

interface Chip {
  title: string;
  start: number;
  duration: number;
  color: string;
  meet?: boolean;
}

const CHIPS: Chip[] = [
  { title: 'Team standup', start: 0, duration: 30, color: '#7986cb' },
  { title: '1:1 with Marcus', start: 30, duration: 30, color: '#33b679' },
  { title: 'Quarterly board review', start: 90, duration: 45, color: '#d50000', meet: true },
];

export function CalendarMock() {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-background">
      <div className="flex items-center justify-between border-b border-line-soft px-4 py-3">
        <div className="flex items-center gap-2.5">
          <GoogleCalendarIcon className="size-[18px]" />
          <p className="text-[13px] font-medium">Thursday, July 17</p>
        </div>
        <p className="font-mono text-[12px] tabular-nums text-muted-2">2:15 PM</p>
      </div>

      <div className="relative h-[196px]">
        {/* gutter divider */}
        <span className="absolute inset-y-0 w-px bg-line-soft" style={{ left: GUTTER }} aria-hidden />

        {/* hour rules with labels sitting just above, like the real thing */}
        {['1 PM', '2 PM', '3 PM'].map((hour, index) => (
          <div key={hour}>
            <span
              className="absolute h-px bg-line-soft"
              style={{ top: TOP + index * HOUR, left: GUTTER, right: 0 }}
              aria-hidden
            />
            <span
              className="absolute w-10 text-right font-mono text-[10px] leading-none text-muted-2"
              style={{ top: TOP + index * HOUR - 4, left: 0 }}
            >
              {hour}
            </span>
          </div>
        ))}

        {/* event chips, full column width, google calendar palette */}
        {CHIPS.map((chip) => (
          <div
            key={chip.title}
            className="absolute flex flex-col justify-center rounded-[4px] px-2 text-white"
            style={{
              top: minutes(chip.start) + 1,
              height: (chip.duration / 60) * HOUR - 3,
              left: GUTTER + 6,
              right: 10,
              backgroundColor: chip.color,
            }}
          >
            <p className="truncate text-[11.5px] font-medium leading-tight">{chip.title}</p>
            {chip.meet && (
              <p className="mt-0.5 flex items-center gap-1.5 text-[10.5px] leading-tight text-white/85">
                <GoogleMeetIcon className="h-2.5 w-3" />
                2:30 to 3:15 PM
              </p>
            )}
          </div>
        ))}

        {/* the red now-line at 2:15, spanning only the day column */}
        <div className="absolute z-10" style={{ top: minutes(75), left: GUTTER, right: 0 }} aria-hidden>
          <span className="absolute -left-[5px] -top-[5px] size-2.5 rounded-full bg-[#ea4335]" />
          <span className="absolute inset-x-0 -top-px h-[2px] bg-[#ea4335]" />
        </div>
      </div>
    </div>
  );
}
