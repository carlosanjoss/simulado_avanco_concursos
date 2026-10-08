import { NextRequest } from 'next/server';
import {
  checkRateLimit,
  ipRateLimit,
  pdfRateLimit,
  getClientIp,
} from '@/lib/rate-limit-redis';

export async function checkIpRateLimit(ip: string) {
  const result = await checkRateLimit(ipRateLimit, ip);
  return {
    allowed: result.allowed,
    remaining: result.remaining,
    resetAt: result.reset,
  };
}

export async function checkPdfBatchRateLimit(ip: string) {
  const result = await checkRateLimit(pdfRateLimit, ip);
  return {
    allowed: result.allowed,
    remaining: result.remaining,
    resetAt: result.reset,
  };
}

export { getClientIp } from '@/lib/rate-limit-redis';