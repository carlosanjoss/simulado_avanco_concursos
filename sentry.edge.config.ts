import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN) && (process.env.NODE_ENV === 'production' || process.env.SENTRY_ENABLE_DEV === 'true'),
  tracesSampleRate: 0.1,
  debug: process.env.SENTRY_DEBUG === 'true',
});
