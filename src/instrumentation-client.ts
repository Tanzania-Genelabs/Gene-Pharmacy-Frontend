import * as Sentry from "@sentry/nextjs";

// Browser error reporting. Disabled (a no-op) until NEXT_PUBLIC_SENTRY_DSN is set.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.NODE_ENV,
  tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0.05),
  // Patient, sales and credential data must never reach a third party: collect nothing optional.
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    httpBodies: [],
    urlQueryParams: false,
    stackFrameVariables: false,
    databaseQueryData: false,
    queues: false,
  },
  beforeSend(event) {
    // Query strings can carry search terms (customer phones); keep only the path.
    if (event.request?.url) event.request.url = event.request.url.split("?")[0];
    delete event.request?.cookies;
    delete event.request?.headers;
    return event;
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
