/* eslint-disable @typescript-eslint/no-explicit-any */
import { collect } from "@smile/lib/utils.js"
import { Kysely, Transaction } from "kysely"
import { getMapManufactureIds } from "../../../helper.js"
import { MigrationDB } from "../../../types.js"
import { DB } from "../../../types.platform.js"

export const migrateMaterialManufactures = async (
  trx: Transaction<DB>,
  migrationDB: Kysely<MigrationDB>,
  programId: number,
  materialIds: number[],
  mapGlobalIds = {}
) => {
  // migrating manufactures
  const manufactures = await migrationDB
    .selectFrom("master_material_has_manufactures as mh")
    .select(["master_material_id", "manufacture_id"])
    .where("master_material_id", "in", materialIds)
    .execute()

  if (manufactures.length === 0) {
    return
  }

  const mapManufactureIds = await getMapManufactureIds(
    programId,
    collect(manufactures, "manufacture_id")
  )

  await trx
    .insertInto("ws_material_manufactures")
    .values(
      manufactures.map((manufacture) => ({
        material_id: mapGlobalIds[manufacture.master_material_id ?? 0] ?? 0,
        manufacture_id: mapManufactureIds[manufacture.manufacture_id ?? 0] ?? 0,
      }))
    )
    .executeTakeFirst()
}
