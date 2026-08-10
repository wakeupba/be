'use client';

import { useEffect } from 'react';
import { isAuthenticated } from '@/lib/session';
import { APP_URL } from '@/lib/site';

/*
 * A signed-in visitor on the homepage is somebody who typed the domain to get
 * to their dashboard, so take them there. Mounted on the homepage only: the
 * rest of the site (pricing, privacy, contact) stays reachable signed in,
 * because those pages answer questions accounts still have.
 *
 * replace() rather than an href, so the homepage never enters history and the
 * dashboard's back button does not bounce through a page that immediately
 * redirects again.
 *
 * The page renders normally until the probe answers; on a static export there
 * is nothing server-side to decide this, and a blank page while every
 * signed-out visitor is checked would be the wrong trade.
 */
export function DashboardRedirect() {
  useEffect(() => {
    let live = true;
    isAuthenticated().then((yes) => {
      if (live && yes) window.location.replace(APP_URL);
    });
    return () => {
      live = false;
    };
  }, []);

  return null;
}
