import { Redis } from "ioredis"
import { logger } from "./logger.js"

export interface CacheConfig {
  redis: Redis
  enableCache: boolean
  ttl: number
}

export class TokenCache {
  private redis: Redis
  private enableCache: boolean
  private ttl: number
  private tokenPrefix: string
  private userPrefix: string
  private accountPrefix: string
  private profilePrefix: string

  constructor(config: CacheConfig, servicePrefix: string = 'auth') {
    this.redis = config.redis
    this.enableCache = config.enableCache
    this.ttl = config.ttl
    this.tokenPrefix = `${servicePrefix}:token:`
    this.userPrefix = `${servicePrefix}:user:`
    this.accountPrefix = `${servicePrefix}:account:`
    this.profilePrefix = `${servicePrefix}:profile:`
  }

  async getTokenValidation(token: string) {
    if (!this.enableCache) return null
    
    try {
      const cacheKey = `${this.tokenPrefix}${token}`
      const cached = await this.redis.get(cacheKey)
      return cached ? JSON.parse(cached) : null
    } catch (error) {
      logger.warn('Redis token cache read error:', error)
      return null
    }
  }

  async setTokenValidation(token: string, validationResult: any) {
    if (!this.enableCache) return
    
    try {
      const cacheKey = `${this.tokenPrefix}${token}`
      await this.redis.setex(cacheKey, this.ttl, JSON.stringify(validationResult))
    } catch (error) {
      logger.warn('Redis token cache write error:', error)
    }
  }

  async getUserByUsername(username: string) {
    if (!this.enableCache) return null
    
    try {
      const cacheKey = `${this.userPrefix}username:${username}`
      const cached = await this.redis.get(cacheKey)
      return cached ? JSON.parse(cached) : null
    } catch (error) {
      logger.warn('Redis user cache read error:', error)
      return null
    }
  }

  async setUserByUsername(username: string, user: any) {
    if (!this.enableCache) return
    
    try {
      const cacheKey = `${this.userPrefix}username:${username}`
      await this.redis.setex(cacheKey, this.ttl, JSON.stringify(user))
    } catch (error) {
      logger.warn('Redis user cache write error:', error)
    }
  }

  async getAccountById(accountId: string) {
    if (!this.enableCache) return null
    
    try {
      const cacheKey = `${this.accountPrefix}${accountId}`
      const cached = await this.redis.get(cacheKey)
      return cached ? JSON.parse(cached) : null
    } catch (error) {
      logger.warn('Redis account cache read error:', error)
      return null
    }
  }

  async setAccountById(accountId: string, account: any) {
    if (!this.enableCache) return
    
    try {
      const cacheKey = `${this.accountPrefix}${accountId}`
      await this.redis.setex(cacheKey, this.ttl, JSON.stringify(account))
    } catch (error) {
      logger.warn('Redis account cache write error:', error)
    }
  }

  async getProfileValidation(token: string) {
    if (!this.enableCache) return null
    
    try {
      const cacheKey = `${this.profilePrefix}${token}`
      const cached = await this.redis.get(cacheKey)
      return cached ? JSON.parse(cached) : null
    } catch (error) {
      logger.warn('Redis profile cache read error:', error)
      return null
    }
  }

  async setProfileValidation(token: string, profileData: any) {
    if (!this.enableCache) return
    
    try {
      const cacheKey = `${this.profilePrefix}${token}`
      await this.redis.setex(cacheKey, this.ttl, JSON.stringify(profileData))
    } catch (error) {
      logger.warn('Redis profile cache write error:', error)
    }
  }

  async invalidateToken(token: string) {
    if (!this.enableCache) return
    
    try {
      const cacheKey = `${this.tokenPrefix}${token}`
      await this.redis.del(cacheKey)
    } catch (error) {
      logger.warn('Redis token cache invalidation error:', error)
    }
  }

  async invalidateUser(username: string) {
    if (!this.enableCache) return
    
    try {
      const cacheKey = `${this.userPrefix}username:${username}`
      await this.redis.del(cacheKey)
    } catch (error) {
      logger.warn('Redis user cache invalidation error:', error)
    }
  }

  async invalidateAccount(accountId: string) {
    if (!this.enableCache) return
    
    try {
      const cacheKey = `${this.accountPrefix}${accountId}`
      await this.redis.del(cacheKey)
    } catch (error) {
      logger.warn('Redis account cache invalidation error:', error)
    }
  }

  async invalidateProfile(token: string) {
    if (!this.enableCache) return
    
    try {
      const cacheKey = `${this.profilePrefix}${token}`
      await this.redis.del(cacheKey)
    } catch (error) {
      logger.warn('Redis profile cache invalidation error:', error)
    }
  }
}

// Factory function for creating TokenCache instances
export function createTokenCache(config: CacheConfig, servicePrefix?: string): TokenCache {
  return new TokenCache(config, servicePrefix)
}