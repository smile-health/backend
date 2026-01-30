import env from "@/config/env.js"
import { ClickhouseDialect } from "@founderpath/kysely-clickhouse"
import { DatabaseManager } from "@smile-health/lib/database.js"
import { CompiledQuery } from "kysely"
import { DB } from "../../../scripts/db.platform.js"

export const dialect = new ClickhouseDialect({
  options: {
    url: env.CLICKHOUSE_DATABASE_URL,
  },
})

export const slave = new DatabaseManager<DB>(dialect, env.APP_DEBUG).getDB()

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

  return await slave.executeQuery(
    CompiledQuery.raw(
      `ALTER TABLE ${formattedTableName} UPDATE ${setClause}`,
      parameters as unknown[]
    )
  )
}
