// ============================================================
// Redis State Helper — generic load/save with distributed lock
// Designed for serverless (Vercel) — no in-memory state when Redis available.
// Falls back to globalThis store when Redis NOT available (dev mode).
// ============================================================

import { redis, redisGet, redisSet, redisDel } from './redis-client'

const LOCK_TTL_SECONDS = 5
const LOCK_RETRY_DELAY_MS = 50
const LOCK_MAX_WAIT_MS = 2000

/**
 * Acquire a distributed lock using Redis SET NX EX.
 * Returns a release function if lock acquired, or null if timeout.
 * When Redis is unavailable, returns a no-op release (no real locking in dev).
 */
export async function acquireLock(key: string): Promise<(() => Promise<void>) | null> {
  if (!redis) return () => Promise.resolve()  // no Redis = no-op lock (dev mode)

  const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const lockKey = `lock:${key}`
  const start = Date.now()

  while (Date.now() - start < LOCK_MAX_WAIT_MS) {
    try {
      const result = await redis.set(lockKey, token, 'EX', LOCK_TTL_SECONDS, 'NX')
      if (result === 'OK') {
        return async () => {
          try {
            const current = await redis.get(lockKey)
            if (current === token) await redis.del(lockKey)
          } catch {
            // ignore release errors
          }
        }
      }
    } catch {
      return () => Promise.resolve()  // Redis error — fail open
    }
    await new Promise((r) => setTimeout(r, LOCK_RETRY_DELAY_MS))
  }

  return null
}

/**
 * Atomic load-mutate-save with lock.
 * If lock can't be acquired, runs mutation anyway (best-effort, may race).
 */
export async function withLock<T>(
  key: string,
  mutator: () => Promise<T>,
): Promise<T> {
  const release = await acquireLock(key)
  try {
    return await mutator()
  } finally {
    if (release) await release()
  }
}

// ---- In-memory fallback (dev mode when Redis not configured) ----
// Per-key store that persists across requests within the same Node.js process.
// Used ONLY when Redis is not available (e.g. local dev without Redis).

const globalForMemStore = globalThis as unknown as {
  __memStore?: Map<string, unknown>
}

if (!globalForMemStore.__memStore) {
  globalForMemStore.__memStore = new Map()
}

const memStore = globalForMemStore.__memStore

/**
 * Generic get with Redis + in-memory fallback.
 * Returns null if key doesn't exist anywhere.
 */
export async function stateGet<T>(key: string): Promise<T | null> {
  if (redis) {
    return redisGet<T>(key)
  }
  // Dev fallback
  return (memStore.get(key) as T) ?? null
}

/**
 * Generic set with Redis + in-memory fallback.
 */
export async function stateSet<T>(key: string, value: T, ttlSeconds?: number): Promise<boolean> {
  if (redis) {
    return redisSet<T>(key, value, ttlSeconds)
  }
  // Dev fallback
  memStore.set(key, value)
  return true
}

/**
 * Generic del with Redis + in-memory fallback.
 */
export async function stateDel(key: string): Promise<boolean> {
  if (redis) {
    return redisDel(key)
  }
  memStore.delete(key)
  return true
}

export function isRedisAvailable(): boolean {
  return redis !== null && redis.status === 'ready'
}

export { redisGet, redisSet, redisDel }
