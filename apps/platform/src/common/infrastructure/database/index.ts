import env from "@/config/env.js"
import { DatabaseManager } from "@smile/lib/database.js"
import {
  MysqlDialect
} from "kysely"
import { createPool } from "mysql2"
import { Database } from "./types/index.js"

export const pool = createPool({
  database: env.DB_NAME,
  host: env.DB_HOST,
  user: env.DB_USER,
  port: env.DB_PORT,
  password: env.DB_PASSWORD,
  connectionLimit: 10,
  timezone: "Z",
})

export const dialect = new MysqlDialect({
  pool,
})

export const db = new DatabaseManager<Database>(dialect, env.APP_DEBUG).getDB()
