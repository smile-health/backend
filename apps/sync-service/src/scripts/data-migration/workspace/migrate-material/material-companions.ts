/* eslint-disable @typescript-eslint/no-explicit-any */
import { collect } from "@smile/lib/utils.js"
import { Kysely, Transaction } from "kysely"
import { getMapMaterialIds } from "../../../helper.js"
import { MigrationDB } from "../../../types.js"
import { DB } from "../../../types.platform.js"

export const migrateMaterialCompanions = async (
  trx: Transaction<DB>,
  migrationDB: Kysely<MigrationDB>,
  programId: number,
  materialIds: number[]
) => {
  // migrating companions
  const companions = await migrationDB
    .selectFrom("master_material_has_companions as mc")
    .select(["master_material_id", "master_material_companion_id"])
    .where("master_material_id", "in", materialIds)
    .execute()

  if (companions.length === 0) {
    return
  }

  const mapGlobalIds = await getMapMaterialIds(
    programId,
    collect(companions, "master_material_id", "master_material_companion_id")
  )

  await trx
    .insertInto("ws_material_companions")
    .values(
      companions.map((companion) => ({
        material_id: mapGlobalIds[companion.master_material_id ?? 0] ?? 0,
        companion_id: mapGlobalIds[companion.master_material_companion_id ?? 0] ?? 0,
      }))
    )
    .executeTakeFirst()
}
