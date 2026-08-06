import { AsYouType, parsePhoneNumberFromString } from 'libphonenumber-js/min';

/*
 * Phone input helpers. The input always works in international format (the
 * API stores E.164 and we call across countries), so parsing never assumes
 * a default country: the leading + is the contract.
 */

/** as-you-type formatting: '+14155550123' -> '+1 415 555 0123' */
export function formatPhoneDraft(raw: string): string {
  const digits = raw.replace(/[^+\d]/g, '');
  if (!digits.startsWith('+')) return digits;
  // AsYouType is stateful; a fresh instance formats the full string
  return new AsYouType().input(digits);
}

export interface ParsedPhone {
  valid: boolean;
  /** E.164, what the API stores; empty until valid */
  e164: string;
  /** human country name from the dialing prefix, e.g. 'India' */
  country: string | null;
}

const regionNames = typeof Intl !== 'undefined' ? new Intl.DisplayNames(['en'], { type: 'region' }) : null;

export function parsePhone(raw: string): ParsedPhone {
  const parsed = parsePhoneNumberFromString(raw);
  if (!parsed) return { valid: false, e164: '', country: null };
  const country = parsed.country && regionNames ? (regionNames.of(parsed.country) ?? null) : null;
  return { valid: parsed.isValid(), e164: parsed.number, country };
}
