// instrumentation-client.ts
// Sentry client-side initialization (Next.js 15+ convention — replaces
// sentry.client.config.ts). Loaded automatically by Next.js on the client.

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  // SDK v11: replaces sendDefaultPii — disable automatic PII collection.
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    urlQueryParams: false,
    httpBodies: [],
  },
  // Error tracking only — performance tracing stays off to avoid
  // overhead and extra data collection.
  tracesSampleRate: 0,
  beforeSend(event) {
    // Strip credentials from any request data Sentry attaches.
    if (event.request?.headers) {
      delete event.request.headers.cookie;
      delete event.request.headers.authorization;
      delete event.request.headers["x-csrf-token"];
    }
    return event;
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
