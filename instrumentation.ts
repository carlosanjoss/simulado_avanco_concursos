export async function register() {
  const sentryEnabled = process.env.NODE_ENV === 'production' || process.env.SENTRY_ENABLE_DEV === 'true';
  if (!sentryEnabled) return;

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export { captureRequestError as onRequestError } from '@sentry/nextjs';
