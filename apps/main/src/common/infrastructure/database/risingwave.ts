import { PostgresDialect } from "kysely"
import { Pool } from "pg"
import { env } from "@/config/env.js"
import { DatabaseManager } from "@smile/lib/database.js"

let connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected'
let lastConnectionAttempt: Date | null = null
let connectionError: Error | null = null
let risingwavePool: Pool | null = null
let risingwaveDialect: PostgresDialect | null = null

// Initialize RisingWave connection only if URL is configured
const initializeRisingWave = () => {
  if (!env.RISINGWAVE_DATABASE_URL || env.RISINGWAVE_DATABASE_URL.trim() === '') {
    console.log(`⚠️ [MAIN-RISINGWAVE] RisingWave database not configured - RISINGWAVE_DATABASE_URL is missing or empty`)
    connectionStatus = 'disconnected'
    connectionError = new Error('RISINGWAVE_DATABASE_URL not configured')
    return null
  }

  try {
    risingwavePool = new Pool({
      connectionString: env.RISINGWAVE_DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    })

    // Add error handling for pool
    risingwavePool.on('error', (err) => {
      console.error('❌ [MAIN-RISINGWAVE] Pool error:', err.message)
      connectionStatus = 'error'
      connectionError = err
    })

    risingwaveDialect = new PostgresDialect({ pool: risingwavePool })
    
    const risingwaveDB = new DatabaseManager<any>(risingwaveDialect, env.APP_DEBUG).getDB()
    
    console.log(`🔌 [MAIN-RISINGWAVE] RisingWave database initialized successfully`)
    connectionStatus = 'connected'
    lastConnectionAttempt = new Date()
    connectionError = null
    
    return risingwaveDB
  } catch (error) {
    console.error('❌ [MAIN-RISINGWAVE] Failed to initialize RisingWave:', error)
    connectionStatus = 'error'
    connectionError = error as Error
    return null
  }
}

export const risingwave = initializeRisingWave()

export const testRisingWaveConnection = async (): Promise<boolean> => {
  try {
    if (!risingwave) {
      console.log('⚠️ [MAIN-RISINGWAVE] Cannot test connection - RisingWave not initialized')
      return false
    }

    if (!risingwavePool) {
      console.log('⚠️ [MAIN-RISINGWAVE] Cannot test connection - Connection pool not available')
      return false
    }

    connectionStatus = 'connecting'
    lastConnectionAttempt = new Date()
    
    // Simple health check query using raw SQL to avoid Kysely dynamic issues
    const result = await risingwave.selectFrom(risingwave.dynamic.raw('(SELECT 1 as health) as health_check')).select('health').execute()
    
    if (result && result.length > 0) {
      connectionStatus = 'connected'
      connectionError = null
      console.log('✅ [MAIN-RISINGWAVE] Connection test successful')
      return true
    } else {
      throw new Error('Health check query returned no results')
    }
  } catch (error) {
    connectionStatus = 'error'
    connectionError = error as Error
    console.error('❌ [MAIN-RISINGWAVE] Connection test failed:', error)
    return false
  }
}

export const getRisingWaveConnectionStatus = () => ({
  status: connectionStatus,
  lastAttempt: lastConnectionAttempt,
  error: connectionError?.message,
  isConfigured: !!env.RISINGWAVE_DATABASE_URL && env.RISINGWAVE_DATABASE_URL.trim() !== '',
  isInitialized: !!risingwave,
})

// Graceful shutdown function
export const closeRisingWaveConnection = async (): Promise<void> => {
  try {
    if (risingwavePool) {
      await risingwavePool.end()
      console.log('🔌 [MAIN-RISINGWAVE] Connection pool closed gracefully')
    }
  } catch (error) {
    console.error('❌ [MAIN-RISINGWAVE] Error closing connection pool:', error)
  }
}

// Export pool and dialect for advanced usage (optional) with specific names to avoid conflicts
export { risingwavePool as pool, risingwaveDialect as dialect }

export default risingwave
