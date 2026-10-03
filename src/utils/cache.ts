import Redis from "ioredis";
import { env } from "../config";
import { logger } from "./logger";

type CacheBackend = "redis" | "memory" | "disabled";

interface MemoryEntry {
  value: string;
  expiresAt: number;
}

const memoryStore = new Map<string, MemoryEntry>();
const MEMORY_MAX_ENTRIES = 500;

let client: Redis | null = null;
let connecting = false;
let backend: CacheBackend = env.cache.enabled ? "redis" : env.isTest ? "disabled" : "memory";

const evictsOldest = (): void => {
  if (memoryStore.size <= MEMORY_MAX_ENTRIES) return;
  const oldest = memoryStore.keys().next();
  if (!oldest.done) memoryStore.delete(oldest.value);
};

function getClient(): Redis | null {
  if (backend !== "redis") return null;
  if (client) return client;
  if (connecting || !env.cache.redisUrl) return null;

  connecting = true;
  const created = new Redis(env.cache.redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 2000,
  });

  created.on("error", (error) => {
    logger.warn("Redis unavailable, serving from in-process memory cache", {
      reason: error instanceof Error ? error.message : String(error),
    });
    client = null;
    connecting = false;
    backend = "memory";
  });

  created
    .connect()
    .then(() => {
      client = created;
      logger.info("Redis cache connected");
    })
    .catch((error) => {
      logger.warn("Redis connection failed, using in-process memory cache", {
        reason: error instanceof Error ? error.message : String(error),
      })
      backend = "memory";
    })
    .finally(() => {
      connecting = false;
    });

  return null;
}

export function cacheStatus(): { backend: CacheBackend; enabled: boolean } {
  return { backend, enabled: backend !== "disabled" };
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getClient();
  if (redis) {
    try {
      const raw = await redis.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch (error) {
      logger.debug("Cache read failed", { key, reason: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }

  if (backend !== "memory") return null;
  const entry = memoryStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    memoryStore.delete(key);
    return null;
  }
  try {
    return JSON.parse(entry.value) as T;
  } catch {
    memoryStore.delete(key);
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
  const ttl = ttlSeconds ?? env.cache.ttlSeconds;
  const serialized = JSON.stringify(value);
  const redis = getClient();
  if (redis) {
    try {
      await redis.set(key, serialized, "EX", ttl);
      return;
    } catch (error) {
      logger.debug("Cache write failed", { key, reason: error instanceof Error ? error.message : String(error) });
      return;
    }
  }

  if (backend !== "memory") return;
  evictsOldest();
  memoryStore.set(key, { value: serialized, expiresAt: Date.now() + ttl * 1000 });
}

export async function cacheDel(...keys: string[]): Promise<void> {
  if (!keys.length) return;
  const redis = getClient();
  if (redis) {
    try {
      await redis.del(...keys);
      return;
    } catch {
      return;
    }
  }
  if (backend !== "memory") return;
  keys.forEach((key) => memoryStore.delete(key));
}

/** Removes every key under a namespace, using SCAN so KEYS is never used. */
export async function cacheDelByPrefix(prefix: string): Promise<void> {
  const redis = getClient();
  if (redis) {
    try {
      let cursor = "0";
      do {
        const [next, found] = await redis.scan(cursor, "MATCH", `${prefix}*`, "COUNT", 200);
        cursor = next;
        if (found.length) await redis.del(...found);
      } while (cursor !== "0");
      return;
    } catch (error) {
      logger.debug("Cache prefix invalidation failed", { prefix, reason: error instanceof Error ? error.message : String(error) });
      return;
    }
  }

  if (backend !== "memory") return;
  for (const key of memoryStore.keys()) {
    if (key.startsWith(prefix)) memoryStore.delete(key);
  }
}

/** Read-through cache helper. Cache failures never break the request path. */
export async function cached<T>(key: string, producer: () => Promise<T>, ttlSeconds?: number): Promise<T> {
  if (backend === "disabled") return producer();

  const hit = await cacheGet<T>(key);
  if (hit !== null) return hit;

  const fresh = await producer();
  await cacheSet(key, fresh, ttlSeconds);
  return fresh;
}

export async function closeCache(): Promise<void> {
  if (client) {
    await client.quit().catch(() => undefined);
    client = null;
  }
  memoryStore.clear();
}