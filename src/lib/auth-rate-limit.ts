import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

type Entry = { count: number; resetAt: number }

declare global {
  var avancoAuthRateLimits: Map<string, Entry> | undefined
}

const localLimits = global.avancoAuthRateLimits ?? new Map<string, Entry>()
if (process.env.NODE_ENV !== 'production') global.avancoAuthRateLimits = localLimits

const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN })
  : null

const distributedLimiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '15 m'), prefix: 'ratelimit:auth' })
  : null

export async function checkAuthRateLimit(identifier: string): Promise<boolean> {
  if (distributedLimiter) return (await distributedLimiter.limit(identifier)).success

  const now = Date.now()
  const current = localLimits.get(identifier)
  if (!current || current.resetAt <= now) {
    localLimits.set(identifier, { count: 1, resetAt: now + 15 * 60 * 1000 })
    return true
  }
  if (current.count >= 10) return false
  current.count += 1
  return true
}

export function getRequestIp(request: Request): string {
  return request.headers.get('cf-connecting-ip')
    || request.headers.get('x-real-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown'
}
