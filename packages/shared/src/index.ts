export type Plan = 'situationship' | 'ride_or_die';

export type EventState =
  | 'scheduled'
  | 'calling'
  | 'acknowledged'
  | 'snoozed'
  | 'missed'
  | 'cancelled';

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

export const LEAD_MINUTE_OPTIONS = [10, 15, 30] as const;
export type LeadMinutes = (typeof LEAD_MINUTE_OPTIONS)[number];

export interface MeDto {
  id: string;
  email: string;
  displayName: string | null;
  phone: string | null;
  plan: Plan;
  callsUsed: number;
  callsLimit: number;
  extraCredits: number;
  triggerColorId: string;
  leadMinutes: LeadMinutes;
  timezone: string;
  dndVerified: boolean;
}

export interface UpcomingEventDto {
  id: string;
  title: string;
  startsAt: number;
  callAt: number;
  state: EventState;
  attendeeCount: number;
}

export interface CallHistoryDto {
  id: string;
  eventTitle: string;
  attempt: number;
  placedAt: number | null;
  outcome: CallOutcome;
  isTest: boolean;
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
