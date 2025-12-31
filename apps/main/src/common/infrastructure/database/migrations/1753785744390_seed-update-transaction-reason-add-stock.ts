import type { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  // update data in ws_transaction_reasons
  // await db
  //   .updateTable("ws_transaction_reasons")
  //   .set({ status: false })
  //   .where("id", "in", [13, 14, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26])
  //   .where("transaction_type_id", "=", 7)
  //   .execute()
  // await db
  //   .insertInto("ws_transaction_reasons")
  //   .values([
  //     {
  //       id: 84,
  //       title: "hibah",
  //       title_en: "donation",
  //       transaction_type_id: 7,
  //       program_id: 1,
  //       is_other: 0,
  //       is_purchase: 0,
  //       status: 1,
  //     },
  //   ])
  //   .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db
    .updateTable("ws_transaction_reasons")
    .set({ status: true })
    .where("id", "in", [13, 14, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26])
    .where("transaction_type_id", "=", 7)
    .execute()
}
