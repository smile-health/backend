import { DatabaseManager } from "@smile/lib/database.js"
import { MysqlDialect } from "kysely"
import { createPool } from "mysql2"
import { env } from "process"
import { DB } from "./types.platform.js"

const pool = createPool({
  database: env.PLATFORM_DB_NAME,
  host: env.PLATFORM_DB_HOST,
  user: env.PLATFORM_DB_USER,
  port: Number(env.PLATFORM_DB_PORT),
  password: env.PLATFORM_DB_PASSWORD,
  connectionLimit: 10,
  timezone: "Z",
  timeout: 60000, // 60 seconds connection timeout
  // Removed invalid mysql2 options: acquireTimeout, idleTimeout
})

export const dialect = new MysqlDialect({
  pool,
})

export const db = new DatabaseManager<DB>(
  dialect,
  env.APP_DEBUG === "true"
).getDB()
