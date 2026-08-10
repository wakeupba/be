'use client';

import { CaretDown } from '@phosphor-icons/react';
import {
  type CountryCode,
  formatPhoneDraft,
  listCountries,
  type ParsedPhone,
  parsePhone,
} from '@wakeupbabe/shared/phone';
import EXAMPLE_MOBILES from 'libphonenumber-js/examples.mobile.json';
import { getExampleNumber } from 'libphonenumber-js/min';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const COUNTRIES = listCountries();
const KNOWN = new Set<string>(COUNTRIES.map((c) => c.iso));

/*
 * The phone field, same contract as the landing demo: a country select feeds
 * the shared helpers so people type their number the way they would say it
 * aloud, and a typed + still overrides the select, which follows it so the two
 * never disagree about what is being dialled.
 *
 * Owns its own draft and country. Both call sites unmount the field once a
 * number is saved, so there is nothing for a parent to control; what a parent
 * needs is the parse of the full international number, delivered on every
 * edit.
 */
export function PhoneInput({
  numberOnFile,
  onChange,
  autoFocus,
  'aria-label': ariaLabel,
  className,
}: {
  /** the E.164 already saved, if any: its country seeds the select, because
   * someone changing their number is overwhelmingly dialling from the same
   * country as the one on file */
  numberOnFile?: string | null;
  /** every edit, as the parse of the full international number */
  onChange: (parsed: ParsedPhone) => void;
  autoFocus?: boolean;
  'aria-label': string;
  className?: string;
}) {
  const [country, setCountry] = useState<CountryCode>(
    () => (numberOnFile ? parsePhone(numberOnFile).iso : null) ?? 'US',
  );
  const [phone, setPhone] = useState('');
  /* the timezone guess arrives async; once a human has touched either control
   * it must not overrule them */
  const touched = useRef(false);
  const parsed = parsePhone(phone, country);

  useEffect(() => {
    /* Where to point the dialing code when nothing is on file: the machine's
     * timezone. Not the locale, because navigator.language is a language
     * preference, and a Mac set to English (UK) in India answers GB, which is
     * exactly the wrong-by-default this preselect exists to avoid. The clock
     * tracks where the person actually is.
     *
     * Lazy import so anyone with a number on file never loads the tz table. */
    if (numberOnFile) return;
    let live = true;
    (async () => {
      try {
        const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (!zone) return;
        const { getTimezone } = await import('countries-and-timezones');
        const iso = getTimezone(zone)?.countries[0];
        if (live && !touched.current && iso && KNOWN.has(iso)) setCountry(iso as CountryCode);
      } catch {
        // US stays; a silent guess beats a wrong one
      }
    })();
    return () => {
      live = false;
    };
  }, [numberOnFile]);

  const dialCode = useMemo(() => COUNTRIES.find((c) => c.iso === country)?.code ?? '1', [country]);
  /* a real example mobile for the selected country, formatted the way a local
   * would write it: the placeholder teaches the expected shape better than any
   * caption, and it changes when the country does */
  const placeholder = useMemo(
    () => getExampleNumber(country, EXAMPLE_MOBILES)?.formatNational() ?? '',
    [country],
  );

  function edit(raw: string) {
    touched.current = true;
    const next = formatPhoneDraft(raw, country);
    setPhone(next);
    // a typed + names its own country, and the select follows
    let effective = country;
    if (next.startsWith('+')) {
      const typed = parsePhone(next, country);
      if (typed.iso && typed.iso !== country) {
        setCountry(typed.iso);
        effective = typed.iso;
      }
    }
    onChange(parsePhone(next, effective));
  }

  function pick(next: CountryCode) {
    touched.current = true;
    setCountry(next);
    // digits already typed re-read under the new country
    const reread = formatPhoneDraft(phone.replace(/^\+\d*\s*/, ''), next);
    setPhone(reread);
    onChange(parsePhone(reread, next));
  }

  return (
    <div className={cn('flex min-w-0 grow gap-2', className)}>
      {/* A native select wearing a compact face: the chip shows the dialing
       * code, the real control sits invisible on top of it, so keyboards,
       * screen readers and phones all get the platform picker instead of a
       * 240-item styled listbox. No flags: the code plus the option's name is
       * the information. */}
      {/* the ring only for keyboard focus: focus-within also fires on a mouse
       * pick and then sits on the chip for as long as the select holds focus,
       * which read as a stuck double border */}
      <div className="relative flex h-8 shrink-0 items-center gap-1 rounded-lg border border-input bg-transparent pr-2 pl-2.5 font-mono text-[13px] tabular-nums shadow-soft has-[:focus-visible]:border-ring has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50">
        <span>+{dialCode}</span>
        <CaretDown size={11} className="text-muted-foreground" aria-hidden />
        <select
          value={country}
          onChange={(event) => pick(event.target.value as CountryCode)}
          aria-label="Country"
          className="absolute inset-0 w-full cursor-pointer opacity-0"
        >
          {COUNTRIES.map((option) => (
            <option key={option.iso} value={option.iso}>
              {option.name} (+{option.code})
            </option>
          ))}
        </select>
      </div>
      <Input
        type="tel"
        autoFocus={autoFocus}
        value={phone}
        onChange={(event) => edit(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-invalid={phone.length > 3 && !parsed.valid}
        className="font-mono tabular-nums"
      />
    </div>
  );
}
