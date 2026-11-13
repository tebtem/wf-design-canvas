/**
 * Privacy-friendly analytics with Umami: no cookies, nothing personal, and never what people type.
 * Uses the Women Facilitating Umami site; VITE_UMAMI_WEBSITE_ID overrides it, and setting it to
 * "off" turns analytics off (for example on preview builds).
 */
const UMAMI_WEBSITE_ID = 'bff116c8-08c7-411d-96ca-bce2decf207d';
declare global {
  interface Window {
    umami?: { track: (event: string, data?: Record<string, string | number>) => void };
  }
}

export function startAnalytics() {
  const id = (import.meta.env.VITE_UMAMI_WEBSITE_ID as string | undefined) || UMAMI_WEBSITE_ID;
  // Never count local development or automated test runs.
  if (id === 'off' || import.meta.env.DEV || ['localhost', '127.0.0.1'].includes(window.location.hostname)) return;
  const s = document.createElement('script');
  s.defer = true;
  s.src = (import.meta.env.VITE_UMAMI_SRC as string | undefined) || 'https://cloud.umami.is/script.js';
  s.dataset.websiteId = id;
  // Only count the canvas's own address, never query strings like workshop codes.
  s.dataset.excludeSearch = 'true';
  document.head.appendChild(s);
}

/** Counts an action, like "pdf-saved". Does nothing when analytics is off. */
export function track(event: string, data?: Record<string, string | number>) {
  try {
    window.umami?.track(event, data);
  } catch {
    // Analytics must never break the canvas.
  }
}
