import { createClient } from "@clickhouse/client"
import { NodeClickHouseClient } from "@clickhouse/client/dist/client.js"
import { trace, SpanStatusCode } from "@opentelemetry/api"

export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error"

let connectionStatus: ConnectionStatus = "disconnected"
let connectionError: Error | null = null

const clickhouseSettings: object = {
  url: process.env.CLICKHOUSE_DATABASE_URL,
  clickhouse_settings: {
    output_format_json_quote_64bit_integers: 0,
    use_client_time_zone: 1,
    http_connection_timeout: 100000,
    tcp_keep_alive_timeout: 100000,
    connect_timeout: 100000,
    send_timeout: 100000,
    http_send_timeout: 100000,
    http_receive_timeout: 100000,
  },
  connect_timeout: 100000,
  request_timeout: 100000,
  max_open_connections: 1000,
}

try {
  connectionStatus = "connecting"
  console.log(
    `🔌 [CLICKHOUSE-WAREHOUSE] Initializing ClickHouse client with URL: ${process.env.CLICKHOUSE_DATABASE_URL ? "[CONFIGURED]" : "[NOT_CONFIGURED]"}`
  )

  if (!process.env.CLICKHOUSE_DATABASE_URL) {
    connectionStatus = "error"
    connectionError = new Error("CLICKHOUSE_DATABASE_URL not configured")
    console.log(
      "❌ [CLICKHOUSE-WAREHOUSE] CLICKHOUSE_DATABASE_URL environment variable not configured"
    )
  } else {
    connectionStatus = "connected"
    connectionError = null
    console.log(
      "✅ [CLICKHOUSE-WAREHOUSE] ClickHouse client initialized successfully"
    )
  }
} catch (error) {
  connectionStatus = "error"
  connectionError = error instanceof Error ? error : new Error(String(error))
  console.log(
    `❌ [CLICKHOUSE-WAREHOUSE] ClickHouse client failed initialization: ${error}`
  )
}

export const clickhouse: NodeClickHouseClient = createClient(clickhouseSettings)

// Monitoring functions
export function getConnectionStatus(): ConnectionStatus {
  return connectionStatus
}

export function getConnectionError(): Error | null {
  return connectionError
}

export async function healthCheck(): Promise<boolean> {
  try {
    // Test connection with a simple query
    const conn = await clickhouse.query({
      query: "SELECT 1 as test",
      format: "JSONEachRow",
    })
    await conn.json()
    connectionStatus = "connected"
    connectionError = null
    return true
  } catch (error) {
    connectionStatus = "error"
    connectionError = error instanceof Error ? error : new Error(String(error))
    console.log(`❌ [CLICKHOUSE-WAREHOUSE] Health check failed: ${error}`)
    return false
  }
}

const clickhouseTracer = trace.getTracer("clickhouse-tracer")

// Use ClickHouse v1 client: collect all rows from the stream and parse as JSON
export async function execQuery<T>(
  sql: string,
  query_params?: Record<string, unknown> | undefined
) {
  const sqlPreview = sql.length > 200 ? sql.substring(0, 200) + "..." : sql
  const operation = sql.trim().split(/\s+/)[0]?.toUpperCase() || "QUERY"

  return clickhouseTracer.startActiveSpan(
    `ClickHouse ${operation}`,
    async (span) => {
      const startTime = Date.now()

      span.setAttributes({
        "db.system": "clickhouse",
        "db.operation": operation,
        "db.statement": sqlPreview,
        "db.parameter_count": query_params ? Object.keys(query_params).length : 0,
      })

      try {
        if (process.env.LOG_MODE === "development") {
          console.log(`🟡 [ClickHouse ${operation}]: ${sqlPreview}`)
        }

        const conn = await clickhouse.query({
          query: sql,
          query_params,
          format: "JSONEachRow",
        })
        const data = await conn.json()
        const duration = Date.now() - startTime

        span.setAttributes({
          "db.duration_ms": duration,
          "db.rows_affected": Array.isArray(data) ? data.length : 0,
          "db.success": true,
        })
        span.setStatus({ code: SpanStatusCode.OK })

        return data as T
      } catch (error) {
        const duration = Date.now() - startTime
        connectionStatus = "error"
        connectionError = error instanceof Error ? error : new Error(String(error))

        span.setAttributes({
          "db.duration_ms": duration,
          "db.success": false,
          "db.error": connectionError.message,
        })
        span.recordException(connectionError)
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: connectionError.message,
        })

        throw connectionError
      } finally {
        span.end()
        await clickhouse.close()
      }
    }
  )
}
