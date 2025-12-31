import { Kysely, MysqlDialect } from "kysely"
import fs from "fs"
import path from "path"
import { createPool } from "mysql2"

async function getTableCount(db: Kysely<unknown>, table: string) {
  const result = await db
    .selectFrom(table)
    .select((eb) => eb.fn.countAll().as("count"))
    .executeTakeFirst()

  return Number(result?.count ?? 0)
}

async function getTablesWithName(db: Kysely<unknown>, databaseName: string) {
  try {
    const result = await db
      .selectFrom("information_schema.tables")
      .select("table_name" as any)
      .where("table_schema", "=", databaseName)
      .execute()

    return result.map((row: any) => row.TABLE_NAME)
  } catch (error) {
    console.error(`Error fetching tables for database ${databaseName}:`, error)
    return []
  }
}

export async function compareDatabases() {
  // Create new Kysely instances for imm3 and log3 with explicit connection configs
  const imm3Pool = createPool({
    database: process.env.IMUN_DB_NAME,
    host: process.env.IMUN_DB_HOST,
    user: process.env.IMUN_DB_USER,
    port: Number(process.env.IMUN_DB_PORT),
    password: process.env.IMUN_DB_PASSWORD,
    connectionLimit: 10,
    timezone: "Z",
  })
  const imm3Dialect = new MysqlDialect({ pool: imm3Pool })
  const imm3DB = new Kysely({ dialect: imm3Dialect })
  const imm3DBName = process.env.IMUN_DB_NAME || ""

  const log3Pool = createPool({
    database: process.env.LOGISTIK_DB_NAME,
    host: process.env.LOGISTIK_DB_HOST,
    user: process.env.LOGISTIK_DB_USER,
    port: Number(process.env.LOGISTIK_DB_PORT),
    password: process.env.LOGISTIK_DB_PASSWORD,
    connectionLimit: 10,
    timezone: "Z",
  })
  const log3Dialect = new MysqlDialect({ pool: log3Pool })
  const log3DB = new Kysely({ dialect: log3Dialect })
  const log3DBName = process.env.LOGISTIK_DB_NAME || ""

  // Create new Kysely instance for smile5 with explicit connection config
  const smile5Pool = createPool({
    database: process.env.MIGRATION_DB_NAME,
    host: process.env.MIGRATION_DB_HOST,
    user: process.env.MIGRATION_DB_USER,
    port: Number(process.env.MIGRATION_DB_PORT),
    password: process.env.MIGRATION_DB_PASSWORD,
    connectionLimit: 10,
    timezone: "Z",
  })
  const smile5Dialect = new MysqlDialect({ pool: smile5Pool })
  const smile5DB = new Kysely({ dialect: smile5Dialect })
  const smile5DBName = process.env.MIGRATION_DB_NAME || ""

  // Get tables from each DB
  const imm3Tables = await getTablesWithName(imm3DB, imm3DBName)
  const log3Tables = await getTablesWithName(log3DB, log3DBName)
  const smile5Tables = await getTablesWithName(smile5DB, smile5DBName)

  // Create a set of all tables
  const allTablesSet = new Set<string>()
  imm3Tables.forEach((t) => allTablesSet.add(t))
  log3Tables.forEach((t) => allTablesSet.add(t))
  smile5Tables.forEach((t) => allTablesSet.add(t))
  const allTables = Array.from(allTablesSet)

  console.log(
    "Comparing tables and record counts between imm3, log3, and smile5 databases...\n"
  )

  console.log("Databases included in comparison:")
  if (imm3Tables.length > 0) console.log(" - imm3")
  if (log3Tables.length > 0) console.log(" - log3")
  if (smile5Tables.length > 0) console.log(" - smile5")

  // Prepare CSV content
  const csvLines = ["Table,imm3,log3,smile5"]

  for (const table of allTables) {
    const imm3Has = imm3Tables.includes(table)
    const log3Has = log3Tables.includes(table)
    const smile5Has = smile5Tables.includes(table)

    const imm3Count = imm3Has
      ? await getTableCount(imm3DB, table)
      : "Not present"
    const log3Count = log3Has
      ? await getTableCount(log3DB, table)
      : "Not present"
    const smile5Count = smile5Has
      ? await getTableCount(smile5DB, table)
      : "Not present"

    csvLines.push(`${table},${imm3Count},${log3Count},${smile5Count}`)

    console.log(`Table: ${table}`)
    console.log(`  imm3:   ${imm3Count}`)
    console.log(`  log3:   ${log3Count}`)
    console.log(`  smile5: ${smile5Count}`)
    console.log("")
  }

  // Write CSV to file
  const csvContent = csvLines.join("\n")
  const outputDir = path.resolve("apps/sync-service")
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }
  const outputPath = path.join(outputDir, "compare-dbs-output.csv")
  fs.writeFileSync(outputPath, csvContent, "utf-8")
  console.log(`Comparison CSV written to ${outputPath}`)

  // Destroy DB connections
  await imm3DB.destroy()
  await log3DB.destroy()
  await smile5DB.destroy()
}
