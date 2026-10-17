const WINDOW_MS = 60_000;
const PER_IP_PER_MINUTE = 10;
const DAILY_AI_CAP = Number(process.env.DAILY_AI_CAP ?? 200);

const hits = new Map<string, number[]>();
let dailyCount = 0;
let dailyDate = new Date().toISOString().slice(0, 10);

export type LimitResult = "ok" | "too_many" | "daily_cap";

/** In-memory limiter for a single Railway instance. Fails closed on the daily cap. */
export function checkLimit(ip: string, now = Date.now()): LimitResult {
  const today = new Date(now).toISOString().slice(0, 10);
  if (today !== dailyDate) {
    dailyDate = today;
    dailyCount = 0;
  }
  if (dailyCount >= DAILY_AI_CAP) return "daily_cap";

  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= PER_IP_PER_MINUTE) {
    hits.set(ip, recent);
    return "too_many";
  }
  recent.push(now);
  hits.set(ip, recent);
  dailyCount += 1;

  if (hits.size > 10_000) hits.clear(); // bound memory
  return "ok";
}
