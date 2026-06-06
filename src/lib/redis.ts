import { createClient } from "redis";

type RedisConnection = ReturnType<typeof createClient>;

let client: RedisConnection | null = null;
let pendingConnection: Promise<RedisConnection | null> | null = null;

export async function getRedisClient(): Promise<RedisConnection | null> {
  if (client?.isReady) {
    return client;
  }

  if (pendingConnection) {
    return pendingConnection;
  }

  const url = process.env.REDIS_URL;
  if (!url) {
    return null;
  }

  pendingConnection = (async () => {
    const candidate = createClient({
      url,
      socket: {
        connectTimeout: 500,
        reconnectStrategy: false
      }
    });
    candidate.on("error", () => undefined);
    try {
      await candidate.connect();
      client = candidate;
      return client;
    } catch {
      await candidate.disconnect().catch(() => undefined);
      return null;
    } finally {
      pendingConnection = null;
    }
  })();

  return pendingConnection;
}

export async function deleteCachedConversation(conversationId: string): Promise<void> {
  try {
    const redis = await getRedisClient();
    if (redis) {
      await redis.del(`conversation:${conversationId}:context`);
    }
  } catch {
    return;
  }
}
