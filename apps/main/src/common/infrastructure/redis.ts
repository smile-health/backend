import { Redis } from "ioredis"
import env from "@/config/env.js"
import { logger } from "@smile-health/lib/logger.js"

let connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected'
let lastConnectionAttempt: Date | null = null
let connectionError: Error | null = null

export const redis = new Redis({
  maxRetriesPerRequest: undefined,
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD,
  lazyConnect: true,
})

redis.on("connect", () => {
  connectionStatus = 'connecting'
  lastConnectionAttempt = new Date()
  console.log(`🔌 [MAIN-REDIS] Connecting to Redis at ${env.REDIS_HOST}:${env.REDIS_PORT}...`)
})

redis.on("ready", () => {
  connectionStatus = 'connected'
  connectionError = null
  console.log(`✅ [MAIN-REDIS] Redis connection established to ${env.REDIS_HOST}:${env.REDIS_PORT}`)
})

redis.on("error", (err) => {
  connectionStatus = 'error'
  connectionError = err
  console.error(`❌ [MAIN-REDIS] Redis error to ${env.REDIS_HOST}:${env.REDIS_PORT}:`, err.message)
})

redis.on("close", () => {
  connectionStatus = 'disconnected'
  console.log(`🔌 [MAIN-REDIS] Redis connection closed to ${env.REDIS_HOST}:${env.REDIS_PORT}`)
})

redis.on("reconnecting", () => {
  connectionStatus = 'connecting'
  console.log(`♻️ [MAIN-REDIS] Redis reconnecting to ${env.REDIS_HOST}:${env.REDIS_PORT}...`)
})

export function getConnectionStatus() {
  return {
    status: connectionStatus,
    lastAttempt: lastConnectionAttempt,
    error: connectionError,
    isConnected: connectionStatus === 'connected',
    host: `${env.REDIS_HOST}:${env.REDIS_PORT}`,
    service: 'main'
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
    // Test connection with a simple ping
    const result = await redis.ping()
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

// Token caching utilities
export class TokenCache {
  private static readonly TOKEN_PREFIX = 'auth:token:'
  private static readonly USER_PREFIX = 'auth:user:'
  private static get TTL() { return env.REDIS_TTL }

  static async getTokenValidation(token: string) {
    if (!env.ENABLE_CACHE) return null
    
    try {
      const cacheKey = `${this.TOKEN_PREFIX}${token}`
      const cached = await redis.get(cacheKey)
      return cached ? JSON.parse(cached) : null
    } catch (error) {
      logger.warn('Redis token cache read error:', error)
      return null
    }
  }

  static async setTokenValidation(token: string, validationResult: any) {
    if (!env.ENABLE_CACHE) return
    
    try {
      const cacheKey = `${this.TOKEN_PREFIX}${token}`
      await redis.setex(cacheKey, this.TTL, JSON.stringify(validationResult))
    } catch (error) {
      logger.warn('Redis token cache write error:', error)
    }
  }

  static async getUserWorkspaces(keycloakId: string) {
    if (!env.ENABLE_CACHE) return null
    
    try {
      const cacheKey = `${this.USER_PREFIX}${keycloakId}`
      const cached = await redis.get(cacheKey)
      return cached ? JSON.parse(cached) : null
    } catch (error) {
      logger.warn('Redis user cache read error:', error)
      return null
    }
  }

  static async setUserWorkspaces(keycloakId: string, userWorkspaces: any) {
    if (!env.ENABLE_CACHE) return
    
    try {
      const cacheKey = `${this.USER_PREFIX}${keycloakId}`
      await redis.setex(cacheKey, this.TTL, JSON.stringify(userWorkspaces))
    } catch (error) {
      logger.warn('Redis user cache write error:', error)
    }
  }

  static async invalidateToken(token: string) {
    if (!env.ENABLE_CACHE) return
    
    try {
      const cacheKey = `${this.TOKEN_PREFIX}${token}`
      await redis.del(cacheKey)
    } catch (error) {
      logger.warn('Redis token cache invalidation error:', error)
    }
  }

  static async invalidateUser(keycloakId: string) {
    if (!env.ENABLE_CACHE) return
    
    try {
      const cacheKey = `${this.USER_PREFIX}${keycloakId}`
      await redis.del(cacheKey)
    } catch (error) {
      logger.warn('Redis user cache invalidation error:', error)
    }
  }
}

export default redis
