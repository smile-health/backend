import { db } from "@/common/infrastructure/database/index.js"

export const populateMasterData = async (
  activityIds: number[],
  kfaCodes: string[],
  msiCodes: number[]
) => {
  console.log("seed start...")

  const todayMidnight = new Date()
  todayMidnight.setHours(0, 0, 0, 0)

  await db.transaction().execute(async (trx) => {
    // validate activity
    const activities = await trx
      .selectFrom("ws_activities")
      .where("id", "in", activityIds)
      .selectAll()
      .execute()

    if (
      activities.length !== activityIds.length ||
      !activities[0]?.program_id
    ) {
      console.error("some activity not found")
      process.exit(1)
    }
    const programId = activities[0].program_id

    const materials = await trx
      .selectFrom("materials")
      .where("hierarchy_code", "in", kfaCodes)
      .selectAll()
      .execute()

    const notFoundMaterials = kfaCodes.filter(
      (code) => !materials.some((m) => m.hierarchy_code === code)
    )
    if (notFoundMaterials.length > 0) {
      console.error("not found materials", notFoundMaterials)
      process.exit(1)
    }

    const entities = await trx
      .selectFrom("entities")
      .where("id_satu_sehat", "in", msiCodes)
      .selectAll()
      .execute()

    const notFoundEntities = msiCodes.filter(
      (code) => !entities.some((e) => e.id_satu_sehat === Number(code))
    )
    if (notFoundEntities.length > 0) {
      console.error("not found entities", notFoundEntities)
      process.exit(1)
    }

    const childMaterals = await trx
      .selectFrom("material_relations")
      .select("material_relations.child_material_id")
      .where(
        "parent_material_id",
        "in",
        materials.map((m) => m.id)
      )
      .execute()

    const materialIds = [
      ...new Set([
        ...materials.map((m) => m.id),
        ...childMaterals.map((mr) => mr.child_material_id),
      ]),
    ]

    // populate master data to programs
    await trx
      .insertInto("material_workspaces")
      .values(
        materialIds.map((materialId) => ({
          material_id: materialId,
          workspace_id: programId,
        }))
      )
      .onDuplicateKeyUpdate({
        updated_at: todayMidnight,
      })
      .execute()

    await trx
      .insertInto("entity_workspaces")
      .values(
        entities.map((entity) => ({
          entity_id: entity.id,
          workspace_id: programId,
          is_vendor: 1,
        }))
      )
      .onDuplicateKeyUpdate({
        status: 1,
      })
      .execute()

    // refetch data after assign to program
    const wsMaterials = await trx
      .selectFrom("ws_materials")
      .where("global_id", "in", materialIds)
      .where("program_id", "=", programId)
      .selectAll()
      .execute()
    const wsEntities = await trx
      .selectFrom("ws_entities")
      .where("id_satu_sehat", "in", msiCodes)
      .where("program_id", "=", programId)
      .selectAll()
      .execute()

    for (const activityId of activityIds) {
      // assign material activity
      await trx
        .insertInto("ws_material_activities")
        .values(
          wsMaterials.map((material) => ({
            material_id: material.id,
            activity_id: activityId,
            is_sequence: 0,
          }))
        )
        .execute()

      // assign entity activity
      await trx
        .insertInto("ws_entity_activities")
        .values(
          wsEntities.map((entity) => ({
            entity_id: entity.id,
            activity_id: activityId,
            start_date: todayMidnight,
          }))
        )
        .onDuplicateKeyUpdate({
          updated_at: todayMidnight,
        })
        .execute()

      // assign ema (only parent materials is assigned)
      await trx
        .insertInto("ws_entity_material_activities")
        .values(
          wsEntities.flatMap((entity) =>
            wsMaterials
              .filter((material) => material.parent_id === null)
              .map((material) => ({
                entity_id: entity.id,
                material_id: material.id,
                activity_id: activityId,
              }))
          )
        )
        .onDuplicateKeyUpdate({
          updated_at: todayMidnight,
        })
        .execute()
    }

    const permissions = [
      { action: 7, key: "entity_types", value: 1 },
      { action: 7, key: "entity_types", value: 2 },
      { action: 7, key: "entity_types", value: 3 },
      { action: 7, key: "roles", value: 1 },
      { action: 7, key: "roles", value: 2 },
      { action: 7, key: "roles", value: 3 },
    ]

    await trx
      .insertInto("ws_material_permissions")
      .values(
        permissions.flatMap((permission) =>
          wsMaterials
            .filter((material) => material.parent_id !== null)
            .map((material) => ({
              material_id: material.id,
              action: permission.action,
              key: permission.key,
              value: permission.value,
            }))
        )
      )
      .execute()
  })

  console.log("migration finished")
  process.exit(0)
}
