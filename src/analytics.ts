/**
 * Privacy-friendly analytics with Umami: no cookies, nothing personal, and never what people type.
 * Off unless VITE_UMAMI_WEBSITE_ID is set (optionally VITE_UMAMI_SRC for a self-hosted Umami).
 */
declare global {
  interface Window {
    umami?: { track: (event: string, data?: Record<string, string | number>) => void };
  }
}

export function startAnalytics() {
  const id = import.meta.env.VITE_UMAMI_WEBSITE_ID as string | undefined;
  if (!id) return;
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
