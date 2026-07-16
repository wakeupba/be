'use client';

import Lenis from 'lenis';
import { useEffect } from 'react';

export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // anchors: true animates in-page # jumps instead of teleporting
    const lenis = new Lenis({ autoRaf: true, anchors: true });
    return () => lenis.destroy();
  }, []);
  return null;
}
