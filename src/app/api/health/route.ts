import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getProviderConfiguration } from '@/lib/ai-providers';

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks = {
    database: false,
    supabase: false,
    clerk: false,
    openrouter: false,
  };

  const errors: Record<string, string> = {};

  // Test database connection
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch (error) {
    errors.database = error instanceof Error ? error.message : 'Unknown error';
  }

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

  // Test Clerk (check if keys are configured)
  try {
    const clerkPubKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    const clerkSecretKey = process.env.CLERK_SECRET_KEY;
    if (clerkPubKey && clerkSecretKey && !clerkPubKey.includes('SUA_CHAVE')) {
      checks.clerk = true;
    } else {
      errors.clerk = 'Keys not configured';
    }
  } catch (error) {
    errors.clerk = error instanceof Error ? error.message : 'Unknown error';
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
    errors: Object.keys(errors).length > 0 ? errors : undefined,
  }, { status: allHealthy ? 200 : 503 });
}