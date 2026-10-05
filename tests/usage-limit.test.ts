import { describe, expect, it } from 'vitest';
import { canGenerateThisMonth, MONTHLY_QUIZ_LIMIT, getCurrentMonthKey } from '@/lib/usage-limit';

describe('monthly generation limit', () => {
  it('allows only the two configured monthly generations', () => {
    expect(MONTHLY_QUIZ_LIMIT).toBe(2);
    expect(canGenerateThisMonth(0)).toBe(true);
    expect(canGenerateThisMonth(1)).toBe(true);
    expect(canGenerateThisMonth(2)).toBe(false);
    expect(canGenerateThisMonth(3)).toBe(false);
  });

  it('uses an ISO-like date key in the application timezone', () => {
    expect(getCurrentMonthKey(new Date('2026-10-02T01:30:00Z'))).toBe('2026-10');
  });
});
