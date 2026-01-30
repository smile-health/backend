import env from "@/config/env.js"
import { DatabaseTracingPlugin } from "@smile-health/lib/database-tracing.plugin.js"
import { DatabaseManager } from "@smile-health/lib/database.js"
import { TracedDatabaseManager } from "@smile-health/lib/tracing.js"
import { promises as fs } from "fs"
import { FileMigrationProvider, Migrator, MysqlDialect } from "kysely"
import { createPool } from "mysql2"
import path from "path"
import { Database, NotificationDatabase } from "./types/index.js"

console.log(
  `🔌 Attempting to connect to MySQL database at ${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}...`
)

export const pool = createPool({
  database: env.DB_NAME,
  host: env.DB_HOST,
  user: env.DB_USER,
  port: env.DB_PORT,
  password: env.DB_PASSWORD,
  connectionLimit: 10,
  timezone: "Z",
})

pool.on("connection", (connection) => {
  console.log(
    `✅ MySQL connection established as id ${connection.threadId} to ${env.DB_HOST}:${env.DB_PORT}`
  )
})

pool.on("error", (err) => {
  console.error(
    `❌ MySQL connection error to ${env.DB_HOST}:${env.DB_PORT}:`,
    err.message
  )
  if (err.code === "PROTOCOL_CONNECTION_LOST") {
    console.error("💀 MySQL connection was closed.")
  }
  if (err.code === "ER_CON_COUNT_ERROR") {
    console.error("🚫 MySQL has too many connections.")
  }
  if (err.code === "ECONNREFUSED") {
    console.error("🔒 MySQL connection was refused.")
  }
  if (err.code === "ETIMEDOUT") {
    console.error(
      `⏰ MySQL connection TIMEOUT to ${env.DB_HOST}:${env.DB_PORT} - Check if MySQL server is running and accessible`
    )
  }
})

export const dialect = new MysqlDialect({
  pool,
})

// Create database manager with enhanced tracing
const dbManager = new DatabaseManager<Database>(dialect, env.APP_DEBUG)
const baseDb = dbManager.getDB()

// Add database tracing plugin
const tracingPlugin = new DatabaseTracingPlugin()
const dbWithTracing = baseDb.withPlugin(tracingPlugin)
// Set the database instance on the plugin so it can compile queries
tracingPlugin.setDatabase(dbWithTracing as any)

// Create traced database manager for high-level operations
export const tracedDb = new TracedDatabaseManager<Database>(dbWithTracing)
export const db = dbWithTracing

// notification db
export const poolNotification = createPool({
  database: env.DB_NAME_NOTIFICATION,
  host: env.DB_HOST,
  user: env.DB_USER,
  port: env.DB_PORT,
  password: env.DB_PASSWORD,
  connectionLimit: 10,
  timezone: "Z",
})

export const dialectNotification = new MysqlDialect({
  pool: poolNotification,
})

// Create notification database manager with enhanced tracing
const notificationDbManager = new DatabaseManager<NotificationDatabase>(
  dialectNotification,
  env.APP_DEBUG
)
const baseNotificationDb = notificationDbManager.getDB()

// Add database tracing plugin
const notificationTracingPlugin = new DatabaseTracingPlugin()
const notificationDbWithTracing = baseNotificationDb.withPlugin(
  notificationTracingPlugin
)
// Set the database instance on the plugin so it can compile queries
notificationTracingPlugin.setDatabase(notificationDbWithTracing as any)

// Create traced notification database manager
export const tracedNotificationDb =
  new TracedDatabaseManager<NotificationDatabase>(notificationDbWithTracing)
export const notificationDb = notificationDbWithTracing

// Configure custom migration and lock table names
const migrator = new Migrator({
  db,
  provider: new FileMigrationProvider({
    fs,
    path,
    migrationFolder: path.resolve(__dirname, "./migrations"),
  }),
  migrationTableName: "kysely_migration",
  migrationLockTableName: "kysely_migration_lock",
  allowUnorderedMigrations: true,
})

// Run migrations
export async function runMigrations() {
  const { error, results } = await migrator.migrateToLatest()

  if (results) {
    results.forEach((result) => {
      console.log(`${result.direction} migration: ${result.migrationName}`)
    })
  }

  if (error) {
    console.error("Migration failed:", error)
    process.exit(1)
  } else {
    console.log("Migrations completed successfully.")
  }

  process.exit(0)
}

// Rollback to a specific migration or the last one
export async function rollbackMigration() {
  const { error, results } = await migrator.migrateDown()

  if (results) {
    results.forEach((result) => {
      console.log(`Rolled back migration: ${result.migrationName}`)
    })
  }

  if (error) {
    console.error("Rollback failed:", error)
    process.exit(1)
  } else {
    console.log("Rollback completed successfully.")
  }

  process.exit(0)
}

export const testMySQLConnection = async (): Promise<{
  success: boolean
  message: string
  details?: any
}> => {
  try {
    console.log(
      `🔍 Testing MySQL connection to ${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}...`
    )

    // Test main database connection
    const mainDbTest = await new Promise((resolve, reject) => {
      pool.getConnection((err, connection) => {
        if (err) {
          reject(err)
          return
        }

        connection.ping((pingErr) => {
          connection.release()
          if (pingErr) {
            reject(pingErr)
          } else {
            resolve(true)
          }
        })
      })
    })

    // Test notification database connection
    const notificationDbTest = await new Promise((resolve, reject) => {
      poolNotification.getConnection((err, connection) => {
        if (err) {
          reject(err)
          return
        }

        connection.ping((pingErr) => {
          connection.release()
          if (pingErr) {
            reject(pingErr)
          } else {
            resolve(true)
          }
        })
      })
    })

    console.log(`✅ MySQL connection test successful!`)
    return {
      success: true,
      message: `Successfully connected to MySQL at ${env.DB_HOST}:${env.DB_PORT}`,
      details: {
        mainDatabase: env.DB_NAME,
        notificationDatabase: env.DB_NAME_NOTIFICATION,
        host: env.DB_HOST,
        port: env.DB_PORT,
      },
    }
  } catch (error: any) {
    console.error(`❌ MySQL connection test failed:`, error.message)
    return {
      success: false,
      message: `Failed to connect to MySQL: ${error.message}`,
      details: {
        errorCode: error.code,
        errorMessage: error.message,
        host: env.DB_HOST,
        port: env.DB_PORT,
        database: env.DB_NAME,
      },
    }
  }
}

// Auto-test connection on startup
testMySQLConnection()
  .then((result) => {
    if (result.success) {
      console.log(`🎉 Database connection verified: ${result.message}`)
    } else {
      console.error(`🚨 Database connection failed: ${result.message}`)
    }
  })
  .catch((error) => {
    console.error(`🚨 Database connection test error:`, error)
  })
