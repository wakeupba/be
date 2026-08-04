export type Plan = 'situationship' | 'ride_or_die';

export type EventState = 'scheduled' | 'calling' | 'acknowledged' | 'snoozed' | 'missed' | 'cancelled';

export type CallOutcome =
  | 'pending'
  | 'answered_ack'
  | 'answered_snooze'
  | 'answered_no_input'
  | 'no_answer'
  | 'failed';

export const PLAN_LIMITS: Record<Plan, { callsPerMonth: number; label: string }> = {
  situationship: { callsPerMonth: 5, label: 'Situationship' },
  ride_or_die: { callsPerMonth: 50, label: 'Ride or Die' },
};

/**
 * Prepaid top-up packs. Priced at the plan's effective rate (10¢/call) so
 * packs never undercut the subscription, and gated to active subscribers:
 * they are extra calls on a plan, not an alternative to one. The per-period
 * cap is a card-testing guard, not an economics lever.
 */
export const TOPUP_PACK = { calls: 20, priceUsd: 2, maxPerPeriod: 10 } as const;

/** prepaid credits spend only while the paid plan is active; on downgrade
 * they freeze (kept, unusable) until a resubscribe — otherwise
 * subscribe-once, stockpile packs, cancel would beat the subscription */
export function creditsUsable(plan: Plan): boolean {
  return plan === 'ride_or_die';
}

export const LEAD_MINUTE_OPTIONS = [10, 15, 30] as const;
export type LeadMinutes = (typeof LEAD_MINUTE_OPTIONS)[number];

export interface MeDto {
  id: string;
  email: string;
  displayName: string | null;
  phone: string | null;
  /** the permanent number calls come from; users save it as a contact */
  brandNumber: string;
  plan: Plan;
  callsUsed: number;
  callsLimit: number;
  extraCredits: number;
  triggerColorId: string;
  leadMinutes: LeadMinutes;
  timezone: string;
  dndVerified: boolean;
  /** false until the Dodo account and products are configured server-side */
  billingEnabled: boolean;
  /** false after a disconnect: no sync, no calls, until reconnected */
  calendarConnected: boolean;
}

export interface UpcomingEventDto {
  id: string;
  title: string;
  startsAt: number;
  callAt: number;
  state: EventState;
  attendeeCount: number;
}

/**
 * Answer to an on-demand calendar refresh. 'cooling_down' means the list is
 * the one from the last check rather than a new one, which the UI should say
 * out loud: a refresh that looks like it did nothing is what makes people
 * click it again.
 */
export interface CalendarSyncDto {
  status: 'synced' | 'cooling_down' | 'failed';
  checkedAt: number;
  nextRefreshAt: number;
  events: UpcomingEventDto[];
}

export interface CallHistoryDto {
  id: string;
  /** null for DND verification test calls, which have no calendar event */
  eventId: string | null;
  eventTitle: string;
  eventStartsAt: number | null;
  attendeeCount: number | null;
  /** the Google Calendar color that flagged this event */
  colorId: string | null;
  /** deep link to the event in Google Calendar */
  calendarLink: string | null;
  attempt: number;
  createdAt: number;
  placedAt: number | null;
  answeredAt: number | null;
  endedAt: number | null;
  outcome: CallOutcome;
  isTest: boolean;
  /** telephony provider reference, for support */
  providerCallId: string | null;
}

export interface FeatureCardDto {
  key: string;
  title: string;
  description: string;
  votes: number;
  votedByMe: boolean;
}

export const UPCOMING_FEATURES: ReadonlyArray<{ key: string; title: string; description: string }> = [
  {
    key: 'press_5_running_late',
    title: 'Press 5: tell them you are joining late',
    description: 'One keypress on the call notifies attendees you are 5 minutes out.',
  },
  {
    key: 'ai_suggested_flags',
    title: 'AI thinks this one matters',
    description: 'We suggest meetings worth flagging. You confirm, we call.',
  },
  {
    key: 'talk_to_the_call',
    title: 'Talk to the call',
    description: 'Tell the voice what to do instead of pressing buttons.',
  },
  {
    key: 'color_lead_times',
    title: 'Color = lead time',
    description: 'Red rings 15 minutes before, orange rings 5 minutes before.',
  },
  {
    key: 'regions_eu_in',
    title: 'EU and India numbers',
    description: 'Local caller IDs so the call never looks like spam.',
  },
  {
    key: 'smart_briefings',
    title: 'Smarter briefings',
    description: 'The call summarizes the agenda, not just the title.',
  },
];

export { fromBase64Url, hmacSign, hmacVerify, toBase64Url } from './crypto';
export { readSession, SESSION_COOKIE } from './session';
