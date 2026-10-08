import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getProviderConfiguration } from '@/lib/ai-providers';
import { isEmailConfigured } from '@/lib/email';
import { isNuvemshopConfigured } from '@/lib/nuvemshop';

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks = {
    database: false,
    supabase: false,
    auth: false,
    openrouter: false,
    email: false,
    billing: false,
    monitoring: false,
  };

  const errors: Record<string, string> = {};

  // Test database connection
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch (error) {
    errors.database = error instanceof Error ? error.message : 'Unknown error';
  }

  checks.email = isEmailConfigured();
  if (!checks.email) errors.email = 'Transactional email not configured';
  checks.billing = isNuvemshopConfigured();
  if (!checks.billing) errors.billing = 'Nuvemshop integration not configured';
  checks.monitoring = Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN);
  if (!checks.monitoring) errors.monitoring = 'Sentry not configured';

  // Test Supabase connection
  try {
    // Just check if env vars are configured, don't actually connect during build
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
    if (supabaseUrl && supabaseKey && !supabaseUrl.includes('placeholder')) {
      checks.supabase = true;
    } else {
      errors.supabase = 'Not configured';
    }
  } catch (error) {
    errors.supabase = error instanceof Error ? error.message : 'Unknown error';
  }

  // Test custom auth (JWT secret configured)
  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (jwtSecret && jwtSecret.length >= 32) {
      checks.auth = true;
    } else {
      errors.auth = 'JWT_SECRET not configured (min 32 chars)';
    }
  } catch (error) {
    errors.auth = error instanceof Error ? error.message : 'Unknown error';
  }

  // Test OpenRouter
  try {
    const providers = getProviderConfiguration();
    const openrouter = providers.find(p => p.id === 'openrouter');
    if (openrouter?.configured) {
      checks.openrouter = true;
    } else {
      errors.openrouter = 'API key not configured';
    }
  } catch (error) {
    errors.openrouter = error instanceof Error ? error.message : 'Unknown error';
  }

  const allHealthy = Object.values(checks).every(v => v);

  return NextResponse.json({
    status: allHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks,
    ...(process.env.NODE_ENV === 'development' && Object.keys(errors).length > 0 ? { errors } : {}),
  }, { status: allHealthy ? 200 : 503 });
}
