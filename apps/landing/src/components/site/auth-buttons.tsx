'use client';

import { useEffect, useState } from 'react';
import { ButtonLink } from '@/components/ui/button';
import { isAuthenticated } from '@/lib/session';
import { APP_URL } from '@/lib/site';

/*
 * Progressive enhancement: the static default is the signed-out pair; after
 * load we probe the api with the shared-domain cookie and upgrade in place.
 * The probe is the shared one, so this and the homepage redirect ask once.
 */
export function AuthButtons() {
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    isAuthenticated().then(setAuthenticated);
  }, []);

  if (authenticated) {
    return (
      <ButtonLink href={APP_URL} size="sm">
        Open dashboard
      </ButtonLink>
    );
  }

  return (
    <>
      <ButtonLink href={`${APP_URL}/login/`} variant="secondary" size="sm">
        Sign in
      </ButtonLink>
      <ButtonLink href={`${APP_URL}/login/`} size="sm">
        Start free
      </ButtonLink>
    </>
  );
}
