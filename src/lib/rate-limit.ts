import { NextRequest } from 'next/server';
import {
  checkRateLimit,
  ipRateLimit,
  pdfRateLimit,
  generationRateLimit,
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

export async function checkGenerationRateLimit(ip: string) {
  const result = await checkRateLimit(generationRateLimit, ip);
  return {
    allowed: result.allowed,
    remaining: result.remaining,
    resetAt: result.reset,
  };
}

export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfConnectingIp = request.headers.get('cf-connecting-ip');

  return cfConnectingIp || realIp || forwarded?.split(',')[0]?.trim() || 'unknown';
}