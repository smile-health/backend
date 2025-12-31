/* eslint-disable @typescript-eslint/no-explicit-any */
import { Migrator } from "kysely"
import path from "node:path"
import { TSFileMigrationProvider } from "kysely-ctl"
import { promisify } from "node:util"
import { QueryOptions } from "mysql2"
import env from "@/config/env.js"
import { db, pool } from "./index.js"

export async function migrate() {
  const migrator = new Migrator({
    db,
    provider: new TSFileMigrationProvider({
      migrationFolder: path.join(import.meta.dirname, "./migrations"),
    }),
    allowUnorderedMigrations: true,
  })

  const { error, results } = await migrator.migrateToLatest()

  if (results)
    for (const item of results) {
      if (item.status === "Error") {
        console.error(`failed to execute migration "${item.migrationName}"`)
      }
    }

  if (error) {
    console.error("failed to run `migrateToLatest`")
    console.error(error)
  }
}

export async function truncateAllTables() {
  try {
    const query = promisify(pool.query).bind(pool) as (
      sql: string | QueryOptions,
      values?: any
    ) => Promise<any>

    await query("SET FOREIGN_KEY_CHECKS = 0")

    // Get all table names except kysely_migration and kysely_migration_lock
    const rows = await query(
      `
        SELECT TABLE_NAME
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = ?
      `,
      [env.DB_NAME]
    )

    await Promise.all(
      rows.map((row: { TABLE_NAME: string }) =>
        query({ sql: `TRUNCATE TABLE ${row.TABLE_NAME}` })
      )
    )

    await query("SET FOREIGN_KEY_CHECKS = 1")
    console.log("All tables truncated successfully")
  } catch (error) {
    console.error("Error truncating tables:", error)
    throw error
  }
}
