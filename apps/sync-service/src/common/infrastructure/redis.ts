import { Redis } from "ioredis"
import env from "@/config/env.js"

console.log(`🔌 Attempting to connect to Redis at ${env.REDIS_HOST}:${env.REDIS_PORT}...`)

export const redis = new Redis({
  maxRetriesPerRequest: undefined,
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD,
  connectTimeout: 30000, // 30 second timeout
  lazyConnect: true, // Don't connect immediately
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  maxRetriesPerRequest: 3,
})

// Add comprehensive event listeners for debugging
redis.on("connect", () => {
  console.log(`✅ Redis connection established to ${env.REDIS_HOST}:${env.REDIS_PORT}`)
})

redis.on("ready", () => {
  console.log(`🚀 Redis is ready to receive commands at ${env.REDIS_HOST}:${env.REDIS_PORT}`)
})

redis.on("error", (err) => {
  console.error(`❌ Redis connection error to ${env.REDIS_HOST}:${env.REDIS_PORT}:`, err.message)
  
  if (err.message.includes('ETIMEDOUT') || err.message.includes('timeout')) {
    console.error(`⏰ Redis connection TIMEOUT - This could be the source of your ETIMEDOUT error`)
    console.error(`🔍 Troubleshooting steps:`)
    console.error(`   1. Check if Redis is running: docker ps | grep redis`)
    console.error(`   2. Verify Redis port ${env.REDIS_PORT} is accessible`)
    console.error(`   3. Check network connectivity to ${env.REDIS_HOST}`)
    console.error(`   4. Test Redis connection: redis-cli -h ${env.REDIS_HOST} -p ${env.REDIS_PORT} ping`)
  }
  
  if (err.message.includes('ECONNREFUSED')) {
    console.error(`🔒 Redis connection refused - Server may not be running on ${env.REDIS_HOST}:${env.REDIS_PORT}`)
  }
  
  if (err.message.includes('NOAUTH')) {
    console.error(`🔐 Redis authentication failed - Check password configuration`)
  }
})

redis.on("close", () => {
  console.log(`🔌 Redis connection closed to ${env.REDIS_HOST}:${env.REDIS_PORT}`)
})

redis.on("reconnecting", () => {
  console.log(`🔄 Redis reconnecting to ${env.REDIS_HOST}:${env.REDIS_PORT}...`)
})

// Test connection on startup
redis.connect().catch((err) => {
  console.error(`❌ Failed to connect to Redis at ${env.REDIS_HOST}:${env.REDIS_PORT}:`, err.message)
  if (err.message.includes('ETIMEDOUT')) {
    console.error(`⏰ Redis startup connection TIMEOUT - This is likely the source of your ETIMEDOUT error`)
  }
})
