/**
 * PostHog analytics wrapper.
 *
 * Initialises PostHog when PUBLIC_POSTHOG_KEY is set, otherwise every export
 * is a silent no-op — safe to call in dev, tests, and builds without the key.
 */

import posthog from 'posthog-js';

// Public write-only project key — safe to expose in client-side code.
const POSTHOG_KEY = 'phc_nhGFP4vdzuGrL5B7VGoeGRKcAtnPMvEsumoWhWTkp4a5';
const POSTHOG_HOST =
  (import.meta.env.PUBLIC_POSTHOG_HOST as string | undefined) ?? 'https://us.i.posthog.com';

let initialized = false;

/** Call once on page load (BaseLayout). */
export function initAnalytics(): void {
  if (initialized) return;
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    autocapture: false,
    capture_pageview: true,
    capture_pageleave: true,
    disable_session_recording: true,
    persistence: 'memory',
  });
  initialized = true;

  // Global unhandled error tracking
  window.addEventListener('error', (event) => {
    trackError(event.error ?? event.message, { source: 'window.onerror' });
  });
  window.addEventListener('unhandledrejection', (event) => {
    trackError(event.reason, { source: 'unhandledrejection' });
  });
}

/** Capture a named event with optional properties. */
export function trackEvent(name: string, properties?: Record<string, unknown>): void {
  if (!initialized) return;
  posthog.capture(name, properties);
}

/** Capture an error event with context. */
export function trackError(error: unknown, context?: Record<string, unknown>): void {
  if (!initialized) return;
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  posthog.capture('error_occurred', { error_message: message, error_stack: stack, ...context });
}

/**
 * Start a timer. Returns a function that, when called, captures an event
 * with `duration_ms` in its properties.
 */
export function startTimer(): () => number {
  const start = performance.now();
  return () => Math.round(performance.now() - start);
}
