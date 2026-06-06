import { getRedisClient } from "@/lib/redis";

const LIMIT = 20;
const WINDOW_SECONDS = 60;

interface MemoryWindow {
  count: number;
  expiresAt: number;
}

const memoryWindows = new Map<string, MemoryWindow>();

export class RateLimitError extends Error {
  constructor() {
    super("请求过于频繁，请稍后再试。");
    this.name = "RateLimitError";
  }
}

export async function enforceChatRateLimit(userId: string): Promise<void> {
  const redis = await getRedisClient();
  const key = `rate-limit:chat:${userId}`;
  if (redis) {
    try {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, WINDOW_SECONDS);
      }
      if (count > LIMIT) {
        throw new RateLimitError();
      }
      return;
    } catch (error) {
      if (error instanceof RateLimitError) {
        throw error;
      }
    }
  }

  const now = Date.now();
  const current = memoryWindows.get(key);
  if (!current || current.expiresAt <= now) {
    memoryWindows.set(key, { count: 1, expiresAt: now + WINDOW_SECONDS * 1000 });
    return;
  }
  current.count += 1;
  if (current.count > LIMIT) {
    throw new RateLimitError();
  }
}
