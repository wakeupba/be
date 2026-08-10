import {
  AsYouType,
  type CountryCode,
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
} from 'libphonenumber-js/min';

export type { CountryCode };

/*
 * Phone input helpers. The API stores E.164 and we call across countries, so
 * everything resolves to a full international number in the end.
 *
 * How it gets there has two doors, and both stay open: a country given by the
 * caller (a select beside the input) supplies the default, and a typed
 * leading + overrides it. Requiring the + alone was the original contract,
 * and it quietly assumed everyone knows their country code cold; most people
 * know their number the way they would read it aloud locally.
 */

/** as-you-type formatting; national input formats in the given country,
 * and a typed + takes over regardless */
export function formatPhoneDraft(raw: string, country?: CountryCode): string {
  const digits = raw.replace(/[^+\d]/g, '');
  if (!digits.startsWith('+') && !country) return digits;
  // AsYouType is stateful; a fresh instance formats the full string
  return new AsYouType(country).input(digits);
}

export interface ParsedPhone {
  valid: boolean;
  /** E.164, what the API stores; empty until valid */
  e164: string;
  /** human country name, e.g. 'India' */
  country: string | null;
  /** ISO code, e.g. 'IN'; lets a select follow a typed + */
  iso: CountryCode | null;
}

const regionNames = typeof Intl !== 'undefined' ? new Intl.DisplayNames(['en'], { type: 'region' }) : null;

export function parsePhone(raw: string, defaultCountry?: CountryCode): ParsedPhone {
  const parsed = parsePhoneNumberFromString(raw, defaultCountry);
  if (!parsed) return { valid: false, e164: '', country: null, iso: null };
  const country = parsed.country && regionNames ? (regionNames.of(parsed.country) ?? null) : null;
  return { valid: parsed.isValid(), e164: parsed.number, country, iso: parsed.country ?? null };
}

export interface CountryOption {
  iso: CountryCode;
  /** dialing code without the +, e.g. '91' */
  code: string;
  /** display name, e.g. 'India' */
  name: string;
}

/** every country libphonenumber can dial, named and sorted for a select */
export function listCountries(): CountryOption[] {
  return getCountries()
    .map((iso) => ({
      iso,
      code: getCountryCallingCode(iso),
      name: regionNames?.of(iso) ?? (iso as string),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
