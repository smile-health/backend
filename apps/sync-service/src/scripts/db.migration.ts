import { DatabaseManager } from "@smile-health/lib/database.js"
import { Kysely, MysqlDialect } from "kysely"
import { createPool } from "mysql2"
import { MigrationDB } from "./types.js"

export const getMigrationDB = (programId = 1) => {
  const env = process.env
  let cfg = {
    database: env.IMUN_DB_NAME,
    host: env.IMUN_DB_HOST,
    user: env.IMUN_DB_USER,
    port: Number(env.IMUN_DB_PORT),
    password: env.IMUN_DB_PASSWORD,
    connectionLimit: 10,
    timezone: "Z",
  }

  if (programId === 2) {
    cfg = {
      database: env.LOGISTIK_DB_NAME,
      host: env.LOGISTIK_DB_HOST,
      user: env.LOGISTIK_DB_USER,
      port: Number(env.LOGISTIK_DB_PORT),
      password: env.LOGISTIK_DB_PASSWORD,
      connectionLimit: 10,
      timezone: "Z",
    }
  }

  const pool = createPool(cfg)
  const dialect = new MysqlDialect({
    pool,
  })

  return new Kysely<MigrationDB>({
    dialect,
  })
}

const env = process.env

const pool = createPool({
  database: env.MIGRATION_DB_NAME,
  host: env.MIGRATION_DB_HOST,
  user: env.MIGRATION_DB_USER,
  port: Number(env.MIGRATION_DB_PORT),
  password: env.MIGRATION_DB_PASSWORD,
  connectionLimit: 10,
  timezone: "Z",
})

export const dialect = new MysqlDialect({
  pool,
})

export const migrationDB = new DatabaseManager<MigrationDB>(
  dialect,
  env.APP_DEBUG === "true"
).getDB()
