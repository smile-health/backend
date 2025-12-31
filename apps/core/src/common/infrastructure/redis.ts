import { Redis } from "ioredis"
import env from "@/config/env.js"
import { trace, context, SpanStatusCode } from "@opentelemetry/api"
import { TracedRedisClient } from "@smile/lib/tracing.js"
import { createTokenCache } from "@smile/lib"
import { logger } from "@smile/lib/logger.js"

let connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected'
let lastConnectionAttempt: Date | null = null
let connectionError: Error | null = null

const redis = new Redis({
  maxRetriesPerRequest: undefined,
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD,
  lazyConnect: true,
})

redis.on("connect", () => {
  connectionStatus = 'connecting'
  lastConnectionAttempt = new Date()
  console.log(`🔌 [CORE-REDIS] Connecting to Redis at ${env.REDIS_HOST}:${env.REDIS_PORT}...`)
})

redis.on("ready", () => {
  connectionStatus = 'connected'
  connectionError = null
  console.log(`✅ [CORE-REDIS] Redis connection established to ${env.REDIS_HOST}:${env.REDIS_PORT}`)
})

redis.on("error", (err) => {
  connectionStatus = 'error'
  connectionError = err
  console.error(`❌ [CORE-REDIS] Redis error to ${env.REDIS_HOST}:${env.REDIS_PORT}:`, err.message)
})

redis.on("close", () => {
  connectionStatus = 'disconnected'
  console.log(`🔌 [CORE-REDIS] Redis connection closed to ${env.REDIS_HOST}:${env.REDIS_PORT}`)
})

redis.on("reconnecting", () => {
  connectionStatus = 'connecting'
  console.log(`♻️ [CORE-REDIS] Redis reconnecting to ${env.REDIS_HOST}:${env.REDIS_PORT}...`)
})

// Enhanced tracing is now handled by TracedRedisClient

// Create traced version by wrapping all Redis methods
// Create enhanced traced Redis client
export const tracedRedis = new TracedRedisClient(redis)

export function getConnectionStatus() {
  return {
    status: connectionStatus,
    lastAttempt: lastConnectionAttempt,
    error: connectionError,
    isConnected: connectionStatus === 'connected',
    host: `${env.REDIS_HOST}:${env.REDIS_PORT}`,
    service: 'core'
  }
}

export async function healthCheck() {
  const status = getConnectionStatus()
  if (!status.isConnected) {
    return {
      healthy: false,
      service: 'redis',
      status: status.status,
      error: status.error?.message
    }
  }

  try {
    // Test connection with a simple ping using traced client
    const result = await tracedRedis.ping()
    if (result === 'PONG') {
      return {
        healthy: true,
        service: 'redis',
        status: 'connected'
      }
    } else {
      return {
        healthy: false,
        service: 'redis',
        status: 'error',
        error: 'Unexpected ping response'
      }
    }
  } catch (error) {
    return {
      healthy: false,
      service: 'redis',
      status: 'error',
      error: (error as Error).message
    }
  }
}

// Create TokenCache instance using shared utility
export const TokenCache = createTokenCache({
  redis: tracedRedis,
  enableCache: env.ENABLE_CACHE,
  ttl: env.REDIS_TTL
}, 'core')

// Export both original and traced Redis clients
export { redis as originalRedis }
export { redis }
export default tracedRedis
