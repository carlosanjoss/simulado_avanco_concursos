import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const ipRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1 m'),
  analytics: true,
  prefix: 'ratelimit:ip',
});

export const pdfRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(50, '5 m'),
  analytics: true,
  prefix: 'ratelimit:pdf',
});

export const generationRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(2, '1 h'),
  analytics: true,
  prefix: 'ratelimit:generation',
});

export async function checkRateLimit(
  limiter: Ratelimit,
  identifier: string
): Promise<{ allowed: boolean; remaining: number; reset: number }> {
  const { success, limit, remaining, reset } = await limiter.limit(identifier);
  return {
    allowed: success,
    remaining,
    reset,
  };
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  
  return cfConnectingIp || realIp || forwarded?.split(',')[0]?.trim() || 'unknown';
}