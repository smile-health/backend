import env from "@/config/env.js"
import { ClickhouseDialect } from "@founderpath/kysely-clickhouse"
import { DatabaseManager } from "@smile/lib/database.js"
import { TracedClickHouseClient, clickhouseTracer } from "@smile/lib/tracing.js"
import { CompiledQuery } from "kysely"
import { Database } from "./types/index.js"

let connectionStatus: "disconnected" | "connecting" | "connected" | "error" =
  "disconnected"
let lastConnectionAttempt: Date | null = null
let connectionError: Error | null = null

export const dialect = new ClickhouseDialect({
  options: {
    url: env.CLICKHOUSE_DATABASE_URL,
  },
})

const rawSlave = new DatabaseManager<Database>(dialect, env.APP_DEBUG).getDB()

// Wrap with tracing
export const slave = rawSlave
  ? env.ENABLE_CLICKHOUSE_TRACING
    ? new TracedClickHouseClient(rawSlave)
    : rawSlave
  : null

if (slave) {
  console.log(
    `🔌 [MAIN-SLAVE] ClickHouse slave database initialized with URL: ${env.CLICKHOUSE_DATABASE_URL ? "[CONFIGURED]" : "[NOT_CONFIGURED]"}`
  )
  connectionStatus = env.CLICKHOUSE_DATABASE_URL ? "connected" : "disconnected"
  lastConnectionAttempt = new Date()
} else {
  console.log(
    `⚠️ [MAIN-SLAVE] ClickHouse slave database not configured - CLICKHOUSE_DATABASE_URL is missing`
  )
  connectionStatus = "error"
  connectionError = new Error("CLICKHOUSE_DATABASE_URL not configured")
}

// adapter to execute update query in clickhouse
export const executeUpdateQuery = async (query: CompiledQuery) => {
  const { sql, parameters } = query

  // Match: UPDATE `tablename` SET or UPDATE tablename SET
  const regex = /update\s+(?:`(\w+)`|(\w+))\s+set\s+(.*)/i

  const match = sql.match(regex)
  if (!match) {
    return "Invalid UPDATE statement"
  }

  // match[1] will have backticked name, match[2] will have non-backticked name
  const tableName = match[1] || match[2]
  const setClause = match[3]

  // Preserve the backticks in output if they were in input
  const formattedTableName = match[1] ? `\`${tableName}\`` : tableName

  if (env.ENABLE_CLICKHOUSE_TRACING) {
    return await clickhouseTracer.traceQuery(
      "UPDATE",
      `ALTER TABLE ${formattedTableName} UPDATE ${setClause}`,
      parameters as any[]
    )(() =>
      slave
        ?.getClient()
        .executeQuery(
          CompiledQuery.raw(
            `ALTER TABLE ${formattedTableName} UPDATE ${setClause}`,
            parameters as unknown[]
          )
        )
    )
  } else {
    return await slave
      ?.getClient()
      .executeQuery(
        CompiledQuery.raw(
          `ALTER TABLE ${formattedTableName} UPDATE ${setClause}`,
          parameters as unknown[]
        )
      )
  }
}

export function getConnectionStatus() {
  return {
    status: connectionStatus,
    lastAttempt: lastConnectionAttempt,
    error: connectionError,
    isConnected: connectionStatus === "connected" && !!slave,
    host: env.CLICKHOUSE_DATABASE_URL || "not-configured",
    service: "main-slave",
  }
}

export async function healthCheck() {
  const status = getConnectionStatus()
  if (!status.isConnected || !slave) {
    return {
      healthy: false,
      service: "clickhouse-slave",
      status: status.status,
      error: status.error?.message || "Slave database not configured",
    }
  }

  try {
    // Test connection with a simple query
    await slave?.query("SELECT name FROM system.tables LIMIT 1")
    connectionStatus = "connected"
    connectionError = null
    return {
      healthy: true,
      service: "clickhouse-slave",
      status: "connected",
    }
  } catch (error) {
    connectionStatus = "error"
    connectionError = error as Error
    console.error(
      `❌ [MAIN-SLAVE] Health check failed:`,
      (error as Error).message
    )
    return {
      healthy: false,
      service: "clickhouse-slave",
      status: "error",
      error: (error as Error).message,
    }
  }
}
