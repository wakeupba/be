import type { ReactNode, SVGProps } from 'react';

/*
 * Scratch page: four unhinged mark candidates rendered at real sizes.
 * Not linked from anywhere; delete before launch.
 */

export const metadata = { title: 'logo lab', robots: { index: false } };

type MarkProps = SVGProps<SVGSVGElement> & { ink?: string; paper?: string };

/* 1. the screaming phone: a phone mid-yell, deadpan flat */
function ScreamingPhone({ ink = '#18181b', paper = '#ffffff', ...props }: MarkProps) {
  return (
    <svg viewBox="0 0 32 32" {...props} role="img" aria-label="screaming phone mark">
      <rect x="7" y="3" width="18" height="26" rx="4.5" fill={ink} />
      <circle cx="12.5" cy="12" r="2.6" fill={paper} />
      <circle cx="19.5" cy="12" r="2.6" fill={paper} />
      <circle cx="12.5" cy="12" r="1.1" fill={ink} />
      <circle cx="19.5" cy="12" r="1.1" fill={ink} />
      <ellipse cx="16" cy="20.5" rx="3.4" ry="4.4" fill={paper} />
      {/* yell lines */}
      <path d="M3.5 9.5 L5.5 11" stroke={ink} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M2.5 15.5 L5 15.5" stroke={ink} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M3.5 21.5 L5.5 20" stroke={ink} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M28.5 9.5 L26.5 11" stroke={ink} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M29.5 15.5 L27 15.5" stroke={ink} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M28.5 21.5 L26.5 20" stroke={ink} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/* 2. the double-text: babe / babe?? */
function DoubleText({ ink = '#18181b', paper = '#ffffff', ...props }: MarkProps) {
  return (
    <svg viewBox="0 0 32 32" {...props} role="img" aria-label="double text mark">
      <rect x="3" y="4" width="17" height="10" rx="5" fill={ink} opacity="0.35" />
      <rect x="3" y="17" width="24" height="11" rx="5.5" fill={ink} />
      <circle cx="10" cy="22.5" r="1.4" fill={paper} />
      <circle cx="15" cy="22.5" r="1.4" fill={paper} />
      <circle cx="20" cy="22.5" r="1.4" fill={paper} />
    </svg>
  );
}

/* 2b. the double-text with words, for sizes where type survives */
function DoubleTextWords({ ink = '#18181b', paper = '#ffffff', ...props }: MarkProps) {
  return (
    <svg viewBox="0 0 64 40" {...props} role="img" aria-label="double text mark with words">
      <rect x="2" y="2" width="34" height="15" rx="7.5" fill={ink} opacity="0.35" />
      <text x="10" y="13" fontFamily="var(--font-geist-mono)" fontSize="9" fill={paper}>
        babe
      </text>
      <rect x="2" y="21" width="48" height="16" rx="8" fill={ink} />
      <text x="10" y="32.5" fontFamily="var(--font-geist-mono)" fontSize="9" fill={paper}>
        babe??
      </text>
    </svg>
  );
}

/* 3. the unblinking eyes */
function UnblinkingEyes({ ink = '#18181b', paper = '#ffffff', ...props }: MarkProps) {
  return (
    <svg viewBox="0 0 32 32" {...props} role="img" aria-label="unblinking eyes mark">
      <circle cx="10" cy="16" r="7" fill={paper} stroke={ink} strokeWidth="2.4" />
      <circle cx="22" cy="16" r="7" fill={paper} stroke={ink} strokeWidth="2.4" />
      <circle cx="10" cy="14.5" r="2.6" fill={ink} />
      <circle cx="22" cy="14.5" r="2.6" fill={ink} />
    </svg>
  );
}

/* 3b. side-eye: both pupils hard left, watching you leave */
function SideEye({ ink = '#18181b', paper = '#ffffff', ...props }: MarkProps) {
  return (
    <svg viewBox="0 0 32 32" {...props} role="img" aria-label="side-eye mark">
      <circle cx="10" cy="16" r="7" fill={paper} stroke={ink} strokeWidth="2.4" />
      <circle cx="22" cy="16" r="7" fill={paper} stroke={ink} strokeWidth="2.4" />
      <circle cx="6.8" cy="16.5" r="2.5" fill={ink} />
      <circle cx="18.8" cy="16.5" r="2.5" fill={ink} />
    </svg>
  );
}

/* 3c. googly: one eye bigger, fully deranged */
function Googly({ ink = '#18181b', paper = '#ffffff', ...props }: MarkProps) {
  return (
    <svg viewBox="0 0 32 32" {...props} role="img" aria-label="googly eyes mark">
      <circle cx="10" cy="17" r="8.5" fill={paper} stroke={ink} strokeWidth="2.4" />
      <circle cx="23.5" cy="14" r="5.5" fill={paper} stroke={ink} strokeWidth="2.4" />
      <circle cx="12" cy="15" r="3" fill={ink} />
      <circle cx="22.5" cy="12.8" r="2.1" fill={ink} />
    </svg>
  );
}

/* 3d. half-lidded: flat upper eyelids, thoroughly unimpressed */
function HalfLidded({ ink = '#18181b', paper = '#ffffff', ...props }: MarkProps) {
  return (
    <svg viewBox="0 0 32 32" {...props} role="img" aria-label="half-lidded eyes mark">
      <path
        d="M3 13 a7 7 0 0 0 14 3 a 7 7 0 0 0 -0.6 -3 z"
        fill={paper}
        stroke={ink}
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path
        d="M15.6 13 a7 7 0 0 0 14 3 a 7 7 0 0 0 -0.6 -3 z"
        fill={paper}
        stroke={ink}
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <circle cx="10.5" cy="15.5" r="2.4" fill={ink} />
      <circle cx="23" cy="15.5" r="2.4" fill={ink} />
    </svg>
  );
}

/* 4. the missed-call badge: 47 missed calls from wake up babe */
function MissedCallBadge(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" {...props} role="img" aria-label="47 missed calls mark">
      <circle cx="16" cy="16" r="14" fill="#ef4444" />
      <text
        x="16"
        y="21"
        textAnchor="middle"
        fontFamily="var(--font-geist-sans)"
        fontWeight="700"
        fontSize="13"
        fill="#ffffff"
      >
        47
      </text>
    </svg>
  );
}

function Tile({ dark = false, children }: { dark?: boolean; children: ReactNode }) {
  return (
    <div
      className={`flex h-24 items-center justify-center rounded-xl border border-line ${dark ? 'bg-foreground' : 'bg-background'}`}
    >
      {children}
    </div>
  );
}

function Row({
  name,
  note,
  renderMark,
}: {
  name: string;
  note: string;
  renderMark: (size: number, dark: boolean) => ReactNode;
}) {
  return (
    <section className="border-t border-line-soft py-10">
      <h2 className="text-xl font-semibold">{name}</h2>
      <p className="mt-1 max-w-lg text-[14px] text-muted">{note}</p>
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Tile>{renderMark(72, false)}</Tile>
        <Tile>
          <span className="flex items-center gap-2 font-semibold tracking-tight">
            {renderMark(24, false)}
            Wake Up Babe
          </span>
        </Tile>
        <Tile>{renderMark(16, false)}</Tile>
        <Tile dark>{renderMark(40, true)}</Tile>
      </div>
    </section>
  );
}

export default function LogoLab() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">logo lab</h1>
      <p className="mt-2 font-mono text-[12px] text-muted-2">
        four unhinged candidates · big / nav lockup / favicon / dark
      </p>

      <div className="mt-10">
        <Row
          name="1. the screaming phone"
          note="A phone mid-yell. Cute at first glance, faintly threatening once you know what it does. Which is accurate."
          renderMark={(s, dark) => (
            <ScreamingPhone
              width={s}
              height={s}
              ink={dark ? '#ffffff' : '#18181b'}
              paper={dark ? '#18181b' : '#ffffff'}
            />
          )}
        />
        <Row
          name="2. the double-text"
          note="babe / babe?? The purest artifact of clinginess. Bubbles alone at small sizes, words when there is room."
          renderMark={(s, dark) =>
            s >= 40 ? (
              <DoubleTextWords
                width={s * 1.6}
                height={s}
                ink={dark ? '#ffffff' : '#18181b'}
                paper={dark ? '#18181b' : '#ffffff'}
              />
            ) : (
              <DoubleText
                width={s}
                height={s}
                ink={dark ? '#ffffff' : '#18181b'}
                paper={dark ? '#18181b' : '#ffffff'}
              />
            )
          }
        />
        <Row
          name="3. the unblinking eyes"
          note="We are up. Now you are up. Blinks once a minute on the site, never in your dreams."
          renderMark={(s, dark) => (
            <UnblinkingEyes
              width={s}
              height={s}
              ink={dark ? '#ffffff' : '#18181b'}
              paper={dark ? '#18181b' : '#ffffff'}
            />
          )}
        />
        <Row
          name="3b. side-eye"
          note="Both pupils hard to one side. Unmistakably eyes, and it is watching you leave."
          renderMark={(s, dark) => (
            <SideEye
              width={s}
              height={s}
              ink={dark ? '#ffffff' : '#18181b'}
              paper={dark ? '#18181b' : '#ffffff'}
            />
          )}
        />
        <Row
          name="3c. googly"
          note="One eye bigger. Symmetry broken, derangement achieved."
          renderMark={(s, dark) => (
            <Googly
              width={s}
              height={s}
              ink={dark ? '#ffffff' : '#18181b'}
              paper={dark ? '#18181b' : '#ffffff'}
            />
          )}
        />
        <Row
          name="3d. half-lidded"
          note="Flat upper eyelids. Thoroughly unimpressed that you almost missed the board review."
          renderMark={(s, dark) => (
            <HalfLidded
              width={s}
              height={s}
              ink={dark ? '#ffffff' : '#18181b'}
              paper={dark ? '#18181b' : '#ffffff'}
            />
          )}
        />
        <Row
          name="4. the missed-call badge"
          note="47 missed calls from Wake Up Babe. No icon. Just consequences."
          renderMark={(s) => <MissedCallBadge width={s} height={s} />}
        />
      </div>
    </main>
  );
}
