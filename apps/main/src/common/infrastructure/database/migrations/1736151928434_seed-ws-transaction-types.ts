import { sql, type Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  const transactionTypes = [
    {
      title: "Stock Count",
      title_en: "Stock Count",
      change_type: 2,
      enable: 0,
    },
    { title: "Pengeluaran", title_en: "Issue", change_type: 3, enable: 0 },
    { title: "Penerimaan", title_en: "Receive", change_type: 1, enable: 0 },
    { title: "Pembuangan", title_en: "Discard", change_type: 3, enable: 1 },
    {
      title: "Pengembalian Faskes",
      title_en: "Return of Health Facilities",
      change_type: 1,
      enable: 1,
    },
    {
      title: "Penerimaan Vial Terbuka",
      title_en: "Open Vial Acceptance",
      change_type: 1,
      enable: 0,
    },
    { title: "Add Stock", title_en: "Add Stock", change_type: 1, enable: 1 },
    {
      title: "Remove Stock",
      title_en: "Remove Stock",
      change_type: 3,
      enable: 1,
    },
    { title: "Konsumsi", title_en: "Consumption", change_type: 3, enable: 1 },
    {
      title: "Pembatalan Pembuangan",
      title_en: "Cancellation of Discard",
      change_type: 1,
      enable: 1,
    },
  ]

  await db.insertInto("ws_transaction_types").values(transactionTypes).execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await sql`truncate table ws_transaction_types`.execute(db)
}
