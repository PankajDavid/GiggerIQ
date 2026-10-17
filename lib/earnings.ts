import { z } from "zod";

export const earningSchema = z.object({
  id: z.string().min(1).max(64),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  platform: z.string().trim().min(1).max(40),
  amount: z.number().finite().min(0).max(100000),
  hours: z.number().finite().min(0).max(24),
});

export type Earning = z.infer<typeof earningSchema>;

export const MAX_ENTRIES = 500;
export const earningsListSchema = z.array(earningSchema).max(MAX_ENTRIES);

export interface Totals {
  totalAmount: number;
  totalHours: number;
  perHour: number;
}

export function computeTotals(entries: Earning[]): Totals {
  const totalAmount = round2(entries.reduce((sum, e) => sum + e.amount, 0));
  const totalHours = round2(entries.reduce((sum, e) => sum + e.hours, 0));
  const perHour = totalHours > 0 ? round2(totalAmount / totalHours) : 0;
  return { totalAmount, totalHours, perHour };
}

/** Parse untrusted stored JSON; drop anything invalid rather than crash. */
export function parseStoredEarnings(raw: string | null): Earning[] {
  if (!raw) return [];
  try {
    const result = earningsListSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : [];
  } catch {
    return [];
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
