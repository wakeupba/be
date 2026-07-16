import { GoogleCalendarIcon, GoogleMeetIcon } from '@/components/brand/google';

/*
 * A faithful, static Google Calendar day-view fixture. Real product colors:
 * the chips use actual Google Calendar event palette values, and the red
 * current-time line sits at 2:15 PM, the moment the call fires.
 * Hour rows are 64px; positions are minutes * 64 / 60 from 1 PM.
 */
const HOUR_HEIGHT = 64;

function eventOffset(minutesFromOne: number): number {
  return (minutesFromOne / 60) * HOUR_HEIGHT;
}

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

      <div className="relative h-[224px]">
        {/* hour grid */}
        {['1 PM', '2 PM', '3 PM'].map((hour, index) => (
          <div
            key={hour}
            className="absolute inset-x-0 border-t border-line-soft"
            style={{ top: index * HOUR_HEIGHT + 16 }}
          >
            <span className="absolute -top-2 left-3 w-10 pr-1 text-right font-mono text-[10px] text-muted-2">
              {hour}
            </span>
          </div>
        ))}

        {/* events, google calendar palette */}
        <div
          className="absolute left-16 right-24 rounded-md px-2.5 py-1 text-[12px] font-medium text-white"
          style={{ top: eventOffset(0) + 18, height: 30, backgroundColor: '#7986cb' }}
        >
          Team standup
        </div>
        <div
          className="absolute left-20 right-4 rounded-md px-2.5 py-1 text-[12px] font-medium text-white"
          style={{ top: eventOffset(35) + 18, height: 30, backgroundColor: '#33b679' }}
        >
          1:1 with Sana
        </div>
        <div
          className="absolute left-16 right-8 flex flex-col justify-center gap-0.5 rounded-md px-2.5 py-1.5 text-white"
          style={{ top: eventOffset(90) + 18, height: 48, backgroundColor: '#d50000' }}
        >
          <p className="text-[12px] font-semibold leading-tight">Quarterly board review</p>
          <p className="flex items-center gap-1.5 text-[11px] leading-tight text-white/85">
            <GoogleMeetIcon className="h-2.5 w-3" />
            2:30 to 3:15 PM
          </p>
        </div>

        {/* current time line at 2:15, the call moment */}
        <div className="absolute inset-x-0 z-10 flex items-center" style={{ top: eventOffset(75) + 18 }}>
          <span className="ml-14 size-2.5 rounded-full bg-accent" aria-hidden />
          <span className="h-px grow bg-accent" aria-hidden />
        </div>
      </div>

      <p className="border-t border-line-soft px-4 py-2.5 font-mono text-[11px] text-muted-2">
        colored red, rings 15 minutes before
      </p>
    </div>
  );
}
