'use client';

import { Phone } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { BabeMark } from '@/components/brand/mark';
import { ButtonLink } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { detectPlatform } from '@/lib/platform';

const API = process.env.NEXT_PUBLIC_API_ORIGIN ?? '';

function IphoneGuide() {
  return (
    <Panel className="p-4">
      <p className="label-mono text-muted-foreground">iPhone</p>
      <ol className="mt-2 flex list-decimal flex-col gap-1.5 pl-4 text-[13px] leading-relaxed text-muted-foreground">
        <li>Open the saved contact and tap Edit.</li>
        <li>Tap Ringtone.</li>
        <li>
          Turn on <span className="text-foreground">Emergency Bypass</span>, then Done.
        </li>
      </ol>
    </Panel>
  );
}

function AndroidGuide() {
  return (
    <Panel className="p-4">
      <p className="label-mono text-muted-foreground">Android</p>
      <ol className="mt-2 flex list-decimal flex-col gap-1.5 pl-4 text-[13px] leading-relaxed text-muted-foreground">
        <li>Open the saved contact and tap the star to favorite it.</li>
        <li>In Settings, open Do Not Disturb.</li>
        <li>
          Under People, allow calls from <span className="text-foreground">starred contacts</span>.
        </li>
      </ol>
    </Panel>
  );
}

/* the qr handoff target: public, phone-first, no auth needed. the phone only
 * needs the contact; the verification call is triggered from the desktop */
export default function MobileSetupPage() {
  // detected after mount so the static export hydrates cleanly; until then
  // both guides render, which is also the desktop behavior
  const [platform, setPlatform] = useState<'ios' | 'android' | null>(null);
  useEffect(() => setPlatform(detectPlatform()), []);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-sm flex-col gap-4 px-5 py-10">
      <div className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
        <BabeMark className="size-6" />
        Wake Up Babe
      </div>

      <h1 className="text-xl font-semibold tracking-tight">Save the contact, allow it through.</h1>

      <ButtonLink href={`${API}/contact.vcf`} size="lg" className="justify-center">
        <Phone size={16} aria-hidden />
        Add Wake Up Babe to contacts
      </ButtonLink>
      {platform === 'android' && (
        <p className="-mt-2 font-mono text-[11px] leading-relaxed text-muted-foreground/70">
          this saves a contact file, open it from your notifications to import
        </p>
      )}

      {/* the detected device's steps lead; the other platform stays reachable */}
      {platform === 'android' ? (
        <>
          <AndroidGuide />
          <details>
            <summary className="cursor-pointer font-mono text-[11px] text-muted-foreground/70">
              on iPhone instead?
            </summary>
            <div className="mt-2">
              <IphoneGuide />
            </div>
          </details>
        </>
      ) : platform === 'ios' ? (
        <>
          <IphoneGuide />
          <details>
            <summary className="cursor-pointer font-mono text-[11px] text-muted-foreground/70">
              on Android instead?
            </summary>
            <div className="mt-2">
              <AndroidGuide />
            </div>
          </details>
        </>
      ) : (
        <>
          <IphoneGuide />
          <AndroidGuide />
        </>
      )}

      <p className="font-mono text-[11px] leading-relaxed text-muted-foreground/70">
        done here? head back to your computer and request the test call.
      </p>
    </div>
  );
}
