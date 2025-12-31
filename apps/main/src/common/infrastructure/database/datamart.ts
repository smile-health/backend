import { ClickhouseDialect } from "@founderpath/kysely-clickhouse"
import { DatabaseManager } from "@smile/lib/database.js"
import { TracedClickHouseClient } from "@smile/lib/tracing.js"
import { Datamart } from "./types/datamart.js"
import env from "@/config/env.js"

let connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected'
let lastConnectionAttempt: Date | null = null
let connectionError: Error | null = null

export const dialect = new ClickhouseDialect({
  options: {
    url: env.DATAMART_DATABASE_URL,
  },
})

const rawDatamart = env.DATAMART_DATABASE_URL
  ? new DatabaseManager<Datamart>(dialect, env.APP_DEBUG).getDB()
  : null

// Wrap with tracing
export const datamart = rawDatamart
  ? env.ENABLE_CLICKHOUSE_TRACING
    ? new TracedClickHouseClient(rawDatamart)
    : rawDatamart
  : null

if (datamart) {
  console.log(`🔌 [MAIN-DATAMART] Datamart database initialized with URL: ${env.DATAMART_DATABASE_URL ? '[CONFIGURED]' : '[NOT_CONFIGURED]'}`)
  connectionStatus = env.DATAMART_DATABASE_URL ? 'connected' : 'disconnected'
  lastConnectionAttempt = new Date()
} else {
  console.log(`⚠️ [MAIN-DATAMART] Datamart database not configured - DATAMART_DATABASE_URL is missing`)
  connectionStatus = 'error'
  connectionError = new Error('DATAMART_DATABASE_URL not configured')
}

export function getConnectionStatus() {
  return {
    status: connectionStatus,
    lastAttempt: lastConnectionAttempt,
    error: connectionError,
    isConnected: connectionStatus === 'connected' && !!datamart,
    host: env.DATAMART_DATABASE_URL || 'not-configured',
    service: 'main-datamart'
  }
}

export async function healthCheck() {
  const status = getConnectionStatus()
  if (!status.isConnected || !datamart) {
    return {
      healthy: false,
      service: 'clickhouse-datamart',
      status: status.status,
      error: status.error?.message || 'Datamart not configured'
    }
  }

  try {
    // Test connection with a simple query
    await datamart?.query('SELECT name FROM system.tables LIMIT 1')
    connectionStatus = 'connected'
    connectionError = null
    return {
      healthy: true,
      service: 'clickhouse-datamart',
      status: 'connected'
    }
  } catch (error) {
    connectionStatus = 'error'
    connectionError = error as Error
    console.error(`❌ [MAIN-DATAMART] Health check failed:`, (error as Error).message)
    return {
      healthy: false,
      service: 'clickhouse-datamart',
      status: 'error',
      error: (error as Error).message
    }
  }
}
