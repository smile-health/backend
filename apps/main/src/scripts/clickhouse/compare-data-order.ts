import { db } from "@/common/infrastructure/database/index.js"
import { slave } from "@/common/infrastructure/database/slave.js"
import fs from "fs"
import path from "path"

export const compareOrderData = async (programId: number[]) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const fileName = `order_comparison_program_${programId}_${timestamp}.json`
  const outputDir = path.resolve("./comparison-results")
  const outputPath = path.join(outputDir, fileName)

  console.log(`🔍 Comparing order list for program_id: ${programId}...`)

  await db.transaction().execute(async (trx) => {
    const [orderMysql, orderClickHouse] = await Promise.all([
      trx
        .selectFrom("ws_order_lists")
        .select(["order_id"])
        .where("program_id", "in", programId)
        .execute(),
      slave
        .selectFrom("ws_order_lists")
        .select(["order_id"])
        .where("program_id", "in", programId)
        .execute(),
    ])

    if (orderMysql.length === 0) {
      console.error("❌ Not found order list in MySQL")
    }

    if (orderClickHouse.length === 0) {
      console.warn("⚠️ No data found in ClickHouse for this program_id")
    }

    const mysqlOrderIds = new Set(orderMysql.map((o) => Number(o.order_id)))

    const clickhouseOrderIds = new Set(
      orderClickHouse
        .map((o) => {
          const str = String(o.order_id).trim()
          return /^\d+$/.test(str) ? Number(str) : NaN
        })
        .filter((num) => !isNaN(num)) // hanya ambil yang valid number
    )

    const missingInClickHouse = [...mysqlOrderIds].filter(
      (id) => !clickhouseOrderIds.has(id)
    )
    const missingInMysql = [...clickhouseOrderIds].filter(
      (id) => !mysqlOrderIds.has(id)
    )

    const result = {
      programId,
      timestamp,
      mysql: {
        totalOrders: orderMysql.length,
      },
      clickhouse: {
        totalOrders: orderClickHouse.length,
      },
      mismatch: {
        missingInClickHouse,
        missingInMysql,
        totalMissingInClickHouse: missingInClickHouse.length,
        totalMissingInMysql: missingInMysql.length,
      },
      isConsistent:
        missingInClickHouse.length === 0 && missingInMysql.length === 0,
    }

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2))
    console.log(`📂 Comparison result saved to: ${outputPath}`)

    if (missingInClickHouse.length > 0) {
      console.warn(
        `❌ ${missingInClickHouse.length} order(s) found in MySQL but missing in ClickHouse:`
      )
      missingInClickHouse.forEach((id) => console.warn(`   → order_id ${id}`))
    } else {
      console.log("✅ All MySQL order_ids exist in ClickHouse.")
    }

    if (missingInMysql.length > 0) {
      console.warn(
        `❌ ${missingInMysql.length} order(s) found in ClickHouse but missing in MySQL:`
      )
      missingInMysql.forEach((id) => console.warn(`   → order_id ${id}`))
    } else {
      console.log("✅ All ClickHouse order_ids exist in MySQL.")
    }

    if (result.isConsistent) {
      console.log("🎉 Data is fully synchronized.")
    } else {
      console.error("🚨 Data inconsistency detected!")
    }
  })

  console.log("✅ Comparing order finished")
  process.exit(0)
}
