import * as Sentry from "@sentry/nextjs";

// Server-side (route handlers, RSC) error reporting. A no-op until SENTRY_DSN is set.
const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.NODE_ENV,
  tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.05),
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
    // The session handlers see credentials in headers/cookies/bodies; none of it may be sent.
    delete event.request?.cookies;
    delete event.request?.headers;
    delete event.request?.data;
    return event;
  },
});
