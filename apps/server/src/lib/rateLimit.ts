/**
 * Token-bucket rate limiter keyed by an arbitrary id (socket id, user id).
 * `ratePerSec` tokens refill per second up to `burst`.
 */
export class RateLimiter {
  private readonly buckets = new Map<string, { tokens: number; lastRefill: number }>();

  constructor(
    private readonly ratePerSec: number,
    private readonly burst: number = ratePerSec,
    private readonly now: () => number = Date.now,
  ) {}

  tryConsume(key: string, cost = 1): boolean {
    const now = this.now();
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { tokens: this.burst, lastRefill: now };
      this.buckets.set(key, bucket);
    }
    const elapsed = (now - bucket.lastRefill) / 1000;
    if (elapsed > 0) {
      bucket.tokens = Math.min(this.burst, bucket.tokens + elapsed * this.ratePerSec);
      bucket.lastRefill = now;
    }
    if (bucket.tokens < cost) return false;
    bucket.tokens -= cost;
    return true;
  }

  remove(key: string): void {
    this.buckets.delete(key);
  }
}
