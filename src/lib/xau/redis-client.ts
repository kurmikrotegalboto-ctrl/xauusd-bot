// ============================================================
// Redis Client — Singleton with graceful fallback
// If REDIS_URL is not set or connection fails, app still works
// (in-memory only, no persistence). When Redis is available,
// all state is auto-saved and restored on restart.
// ============================================================

import Redis from 'ioredis'

const globalForRedis = globalThis as unknown as { __xauRedis?: Redis | null }

function createClient(): Redis | null {
  const url = process.env.REDIS_URL || process.env.REDIS_TLS_URL
  if (!url) {
    console.log('[redis] REDIS_URL not set — running in-memory only (no persistence)')
    return null
  }

  try {
    const client = new Redis(url, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy: (times) => {
        if (times > 5) {
          console.error('[redis] Max retries reached, giving up')
          return null
        }
        return Math.min(times * 200, 2000)
      },
      reconnectOnError: (err) => {
        const targetErrors = ['READONLY', 'NOAUTH', 'ECONNRESET']
        if (targetErrors.some((e) => err.message.includes(e))) {
          return true
        }
        return false
      },
      // TLS for rediss:// URLs (Railway/Render use TLS)
      tls: url.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
    })

    client.on('connect', () => console.log('[redis] Connected'))
    client.on('error', (err) => console.error('[redis] Error:', err.message))
    client.on('reconnecting', () => console.log('[redis] Reconnecting...'))

    return client
  } catch (e) {
    console.error('[redis] Failed to create client:', e)
    return null
  }
}

const redis: Redis | null = globalForRedis.__xauRedis ?? createClient()
if (!globalForRedis.__xauRedis) {
  globalForRedis.__xauRedis = redis
}

export { redis }

// ---- Helper functions with try/catch (graceful fallback) ----

export async function redisGet<T>(key: string): Promise<T | null> {
  if (!redis) return null
  try {
    const data = await redis.get(key)
    if (!data) return null
    return JSON.parse(data) as T
  } catch (e) {
    console.error(`[redis] GET ${key} failed:`, e)
    return null
  }
}

export async function redisSet<T>(key: string, value: T, ttlSeconds?: number): Promise<boolean> {
  if (!redis) return false
  try {
    const data = JSON.stringify(value)
    if (ttlSeconds) {
      await redis.set(key, data, 'EX', ttlSeconds)
    } else {
      await redis.set(key, data)
    }
    return true
  } catch (e) {
    console.error(`[redis] SET ${key} failed:`, e)
    return false
  }
}

export async function redisDel(key: string): Promise<boolean> {
  if (!redis) return false
  try {
    await redis.del(key)
    return true
  } catch (e) {
    console.error(`[redis] DEL ${key} failed:`, e)
    return false
  }
}

export function isRedisAvailable(): boolean {
  return redis !== null && redis.status === 'ready'
}
