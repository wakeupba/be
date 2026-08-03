/** best-effort device detection for setup instructions; null = unknown/desktop */
export function detectPlatform(): 'ios' | 'android' | null {
  if (typeof navigator === 'undefined') return null;
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) return 'ios';
  if (/Android/i.test(navigator.userAgent)) return 'android';
  return null;
}
