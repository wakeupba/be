/*
 * GENERATED from Twilio's Dialing Permissions API. Do not edit by hand.
 *
 * The countries this Twilio account is permitted to dial at all. Geographic
 * dialing permissions are account state, not code: they are toggled in the
 * Twilio console, and a call to any destination outside them is refused by
 * the carrier at call time with error 21215, no matter what it would have
 * cost. Price is therefore only half the gate, and this set is the other
 * half.
 *
 * Because the source of truth lives in the account and not in the repo,
 * flipping a country on in the console does nothing here: this file must be
 * regenerated (the tooling is internal and lives outside the repo, like the
 * rate table's) before the gate will let that country through. Stale is safe
 * in the same direction as the rate table: a country enabled since the last
 * regeneration is refused rather than assumed reachable.
 *
 * As of 2026-08-11 the account has low-risk numbers enabled for 32 Twilio
 * entries. Those entries are groupings, not ISO countries, so the raw ISO
 * list from the API is wrong on its own: a grouping's ISO code stands for
 * every territory in its name, and the covered territories have no entries
 * of their own to be enabled through. Each such expansion below is spelled
 * out next to the grouping it came from.
 *
 * Deliberately absent, failing closed: the UK crown dependencies (IM, GG,
 * JE) ride +44 but are not in this account's permission list under any
 * entry, so treating them as covered by "United Kingdom" would be a guess
 * about how Twilio classifies their ranges. And AX, EH, YT and KZ appear
 * only inside groupings that are currently disabled (Finland/Aland Islands,
 * Morocco/Western Sahara, Reunion/Mayotte, Russia/Kazakhstan), so they stay
 * out until their groupings are enabled and this file is regenerated.
 */

/** ISO 3166-1 alpha-2 codes the account's voice geographic permissions allow */
export const GEO_PERMITTED_COUNTRIES: ReadonlySet<string> = new Set([
  'AU', // Twilio entry "Australia/Cocos/Christmas Island"
  'CC', // covered by the "Australia/Cocos/Christmas Island" grouping
  'CX', // covered by the "Australia/Cocos/Christmas Island" grouping
  'BD',
  'BM',
  'BR',
  'CL',
  'CO',
  'DE',
  'DK',
  'FO',
  'FR',
  'GB',
  'GU',
  'HK',
  'IE',
  'IL',
  'IN',
  'IS',
  'JP',
  'KR',
  'MN',
  'MX',
  'MY',
  'NO',
  'SJ', // Svalbard has no Twilio entry and dials as Norway's +47, so it goes as Norway goes
  'NZ',
  'PE',
  'PR',
  'RO',
  'SE',
  'SG',
  'TH',
  'US', // Twilio entry "United States/Canada"
  'CA', // covered by the "United States/Canada" grouping: Canada has no entry of its own
  'VI',
]);
