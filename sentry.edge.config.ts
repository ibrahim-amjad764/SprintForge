// sentry.edge.config.ts
// Sentry edge-runtime initialization. Imported from instrumentation.ts
// register() for the edge runtime. Must stay free of Node APIs.

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN),
  // SDK v11: replaces sendDefaultPii — disable automatic PII collection.
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    urlQueryParams: false,
    httpBodies: [],
  },
  tracesSampleRate: 0,
  beforeSend(event) {
    if (event.request?.headers) {
      delete event.request.headers.cookie;
      delete event.request.headers.authorization;
      delete event.request.headers["x-csrf-token"];
    }
    return event;
  },
});
