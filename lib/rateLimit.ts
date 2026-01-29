const RATE_LIMIT = 3;
const WINDOW_MS = 60_000;

const buckets = new Map<string, number[]>();

function prune(timestamps: number[], now: number): number[] {
  return timestamps.filter((timestamp) => now - timestamp < WINDOW_MS);
}

export function checkRateLimit(ip: string): {
  allowed: boolean;
  retryAfter: number;
  remaining: number;
} {
  const now = Date.now();
  const existing = buckets.get(ip) ?? [];
  const recent = prune(existing, now);

  if (recent.length >= RATE_LIMIT) {
    const oldest = recent[0] ?? now;
    const retryAfterMs = WINDOW_MS - (now - oldest);
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil(retryAfterMs / 1000)),
      remaining: 0
    };
  }

  const updated = [...recent, now];
  buckets.set(ip, updated);

  return {
    allowed: true,
    retryAfter: 0,
    remaining: Math.max(0, RATE_LIMIT - updated.length)
  };
}
