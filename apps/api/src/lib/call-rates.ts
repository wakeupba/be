import { CALL_RATES_USD } from '../data/call-rates';

/*
 * What a call to a given number costs us, and whether we are willing to place
 * it at all.
 *
 * Twilio bills programmable voice in whole minutes, rounded up, and our script
 * (two <Say> blocks around an 8s <Gather>) never reaches one. Verified against
 * real calls: 12s, 19s, 22s and 32s to the same Indian mobile each billed
 * exactly $0.0496. So the per-minute rate IS the per-call cost, flat.
 *
 * That matters because we always ring mobiles, and mobile termination is
 * nothing like landline termination. A German landline is under 3 cents; a
 * German mobile is 37. Gating on a country's cheapest rate would wave through
 * exactly the calls that lose the most money.
 */

/** dearest destination we will ring. Above this, onboarding stops and we log
 * the interest instead. Deliberately above break-even (~$0.10/call at
 * $5 for 50): reach in a niche is worth more than margin per call today. */
export const MAX_CALL_RATE_USD = 0.2;

/** longest key in the table, so lookup starts where it can actually hit */
const MAX_PREFIX_DIGITS = 12;

/**
 * USD per call to this number, or undefined when no prefix matches.
 *
 * Longest-prefix wins, because price is per prefix and not per country:
 * +4420 (London) is $0.0158 while +4470 (UK premium) is $1.05. Matching on the
 * country code alone would let every premium range in the world hide behind a
 * cheap one.
 */
export function callRateUsd(e164: string): number | undefined {
  const digits = e164.replace(/\D/g, '');
  for (let end = Math.min(digits.length, MAX_PREFIX_DIGITS); end > 0; end--) {
    const rate = CALL_RATES_USD[digits.slice(0, end)];
    if (rate !== undefined) return rate;
  }
  return undefined;
}

/**
 * Whether we will ring this number today.
 *
 * Fails closed on an unknown prefix. Twilio lists a few countries it cannot
 * route from this account at all (sanctions, no carrier), and an unpriced
 * destination is the one case where guessing is unbounded, so absent means no.
 */
export function isCallableNumber(e164: string): boolean {
  const rate = callRateUsd(e164);
  return rate !== undefined && rate <= MAX_CALL_RATE_USD;
}
