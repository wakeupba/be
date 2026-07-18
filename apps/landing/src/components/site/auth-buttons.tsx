'use client';

import { useEffect, useState } from 'react';
import { ButtonLink } from '@/components/ui/button';
import { APP_URL } from '@/lib/site';

const API =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:8787'
    : (process.env.NEXT_PUBLIC_API_ORIGIN ?? 'https://api.wakeupba.be');

/*
 * Progressive enhancement: the static default is the signed-out pair; after
 * load we probe the api with the shared-domain cookie and upgrade in place.
 */
export function AuthButtons() {
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    fetch(`${API}/session`, { credentials: 'include' })
      .then((response) => response.json() as Promise<{ authenticated: boolean }>)
      .then((session) => setAuthenticated(session.authenticated))
      .catch(() => {});
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
      <ButtonLink href={APP_URL} variant="secondary" size="sm">
        Sign in
      </ButtonLink>
      <ButtonLink href={APP_URL} size="sm">
        Start free
      </ButtonLink>
    </>
  );
}
