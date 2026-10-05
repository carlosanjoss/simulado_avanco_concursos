import { NextRequest, NextResponse } from 'next/server';

const ipRequestCounts = new Map<string, { count: number; resetAt: number }>();
const pdfBatchRequestCounts = new Map<string, { count: number; resetAt: number }>();

const IP_RATE_LIMIT = 10; // 10 requests per hour per IP
const IP_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export function checkIpRateLimit(ip: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const record = ipRequestCounts.get(ip);

  if (!record || now > record.resetAt) {
    ipRequestCounts.set(ip, { count: 1, resetAt: now + IP_WINDOW_MS });
    return { allowed: true, remaining: IP_RATE_LIMIT - 1, resetAt: now + IP_WINDOW_MS };
  }

  if (record.count >= IP_RATE_LIMIT) {
    return { allowed: false, remaining: 0, resetAt: record.resetAt };
  }

  record.count++;
  return { allowed: true, remaining: IP_RATE_LIMIT - record.count, resetAt: record.resetAt };
}

// A 400-page document produces 80 legitimate requests. Keep this bucket
// separate from quiz generation so large PDFs do not consume that stricter cap.
export function checkPdfBatchRateLimit(ip: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const limit = 200;
  const windowMs = 60 * 60 * 1000;
  const record = pdfBatchRequestCounts.get(ip);
  if (!record || now > record.resetAt) {
    pdfBatchRequestCounts.set(ip, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }
  if (record.count >= limit) return { allowed: false, remaining: 0, resetAt: record.resetAt };
  record.count += 1;
  return { allowed: true, remaining: limit - record.count, resetAt: record.resetAt };
}

export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return request.headers.get('x-real-ip') || 'unknown';
}
