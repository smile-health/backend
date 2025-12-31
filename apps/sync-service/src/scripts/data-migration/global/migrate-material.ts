import { db as syncDB } from "@/common/infrastructure/database/index.js"
import { db } from "@/scripts/db.platform.js"
import {
  deleteTableMapping,
  deleteTableMaster,
  getMapGlobalMaterialIds,
  getMapGlobalUserIds,
  getMapMaterialIds,
  getMapUserIds,
  insertTableMapping,
  resetIncrement,
} from "@/scripts/helper.js"
import { MasterMaterials, Materials } from "@/scripts/types.js"
import { DB, MaterialRelations } from "@/scripts/types.platform.js"
import { associateField, collect } from "@smile/lib/utils.js"
import { Selectable, Transaction, sql } from "kysely"
import { getMigrationDB } from "../../db.migration.js"
import { MAP_EXISTING_TO_PLATFORM } from "../const.js"
import { IMMUNIZATION } from "../constants/program.js"

const MAP_MATERIAL_TYPE = {
  1: 1,
  2: 4,
  3: 3,
  4: 1,
  5: 4,
  6: 1,
  7: 4,
  8: 1,
  9: 5,
  10: 1,
  11: 1,
  12: 1,
}

const MAP_MATERIAL_UNIT_CONSUMPTION = {
  buah: 1,
  dosis: 2,
  ml: 3,
  tablet: 4,
  gram: 5,
}

const MAP_MATERIAL_UNIT_DISTRIBUTION = {
  box: 6,
  vial: 7,
  bungkus: 8,
  pack: 9,
}

type MigrationMasterMaterialDTO = Partial<Selectable<MasterMaterials>>
type MaterialsDTO = Partial<Selectable<Materials>>
type MaterialRelationsDTO = Selectable<MaterialRelations>

const formatDuration = (startTime: Date, endTime: Date): string => {
  const durationMs = endTime.getTime() - startTime.getTime()
  const hours = Math.floor(durationMs / (1000 * 60 * 60))
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((durationMs % (1000 * 60)) / 1000)
  return `${hours}h ${minutes}m ${seconds}s`
}

export const migrateMaterial = async (
  isHierarchy: boolean,
  programId = 1,
  truncate: boolean = false
) => {
  const startTime = new Date()
  console.info(`Migration materials started at: ${startTime.toLocaleString()}`)
  console.info("migrating materials...", isHierarchy, programId)

  // Truncate tables if requested
  if (truncate && !isHierarchy && programId === IMMUNIZATION) {
    console.log("Deleting previous Immunization data...")

    const programIds = MAP_EXISTING_TO_PLATFORM[programId] ?? []
    await deleteTableMaster("materials", programIds)
    await deleteTableMapping("materials", programIds)
    await db
      .deleteFrom("material_relations")
      .where(
        "child_material_id",
        "not in",
        db.selectFrom("materials").select("id")
      )
      .execute()
    await resetIncrement(db, "material_relations")
  }

  const migrationDB = getMigrationDB(programId)
  const platformProgramIds = MAP_EXISTING_TO_PLATFORM[programId] ?? [programId]

  let materialCount = 0
  let materialWorkspaceCount = 0
  try {
    await db.transaction().execute(async (trx) => {
      // Disable foreign key checks to allow migration of materials with non-existent users
      await sql`SET FOREIGN_KEY_CHECKS = 0`.execute(trx)
      const existingMaterials = await migrationDB
        .selectFrom("master_materials")
        .select([
          "id",
          "name",
          "description",
          "kfa_level_id",
          "code",
          "kfa_code",
          "unit",
          "unit_of_distribution",
          "pieces_per_unit",
          "temperature_sensitive",
          "temperature_min",
          "temperature_max",
          "is_vaccine",
          "is_openvial",
          "managed_in_batch",
          "status",
          "is_so",
          "parent_id",
          "created_by",
          "updated_by",
          "deleted_by",
          "created_at",
          "updated_at",
          "deleted_at",
        ])
        .where("deleted_at", "is", null)
        .orderBy("id")
        .execute()
      materialCount = existingMaterials.length

      console.info(`migrating ${existingMaterials.length} materials`)

      const existingCretedByIds = collect(existingMaterials, "created_by")
      const existingUpdatedByIds = collect(existingMaterials, "updated_by")
      const existingMaterialIds = collect(existingMaterials, "id")

      const [
        mappedPlatformCreatedByGlobalIds,
        mappedPlatformUpdatedByGlobalIds,
        mapWsMaterialIds,
        mapGlobalMaterialIds,
      ] = await Promise.all([
        getMapGlobalUserIds(existingCretedByIds),
        getMapGlobalUserIds(existingUpdatedByIds),
        getMapMaterialIds(platformProgramIds, existingMaterialIds),
        getMapGlobalMaterialIds(platformProgramIds, existingMaterialIds),
      ])

      for (const existingMaterial of existingMaterials) {
        console.log(`migrating material ${existingMaterial.id}`)

        let materialTypeID = 2 // default for immun

        if (programId === 2) {
          materialTypeID =
            MAP_MATERIAL_TYPE[existingMaterial.is_vaccine ?? 0] ?? 1
        }

        let materialUnitConsumptionId =
          MAP_MATERIAL_UNIT_CONSUMPTION[existingMaterial.unit ?? "dosis"]
        let materialUnitDistributioId =
          MAP_MATERIAL_UNIT_DISTRIBUTION[
            existingMaterial.unit_of_distribution ?? "box"
          ]

        materialUnitConsumptionId ??= MAP_MATERIAL_UNIT_CONSUMPTION["dosis"]
        materialUnitDistributioId ??= MAP_MATERIAL_UNIT_DISTRIBUTION["box"]

        const globaMaterial = await trx
          .selectFrom("materials")
          .selectAll()
          .where(
            "id",
            "=",
            mapGlobalMaterialIds[Number(existingMaterial.id)] ?? 0
          )
          .executeTakeFirst()

        const globalMaterialByCode = await trx
          .selectFrom("materials")
          .selectAll()
          .where((eb) =>
            eb.or([
              eb("name", "=", existingMaterial.name),
              eb("code", "=", existingMaterial.code),
            ])
          )
          .executeTakeFirst()

        const platformCreatedByGlobalId =
          mappedPlatformCreatedByGlobalIds[existingMaterial.created_by ?? 0] ??
          0
        const platformUpdatedByGlobalId =
          mappedPlatformUpdatedByGlobalIds[existingMaterial.updated_by ?? 0] ??
          0

        const globalId = await insertMaterials(
          trx,
          existingMaterial,
          globaMaterial,
          globalMaterialByCode,
          {
            isHierarchy,
            materialTypeID,
            materialUnitConsumptionId,
            materialUnitDistributioId,
            platformCreatedByGlobalId,
            platformUpdatedByGlobalId,
          }
        )

        if (isHierarchy && existingMaterial.parent_id) {
          console.log(
            `update material relation: ${existingMaterial.id} <-> ${existingMaterial.parent_id}`
          )

          const wsMaterials = await trx
            .selectFrom("material_workspaces as mw")
            .where("id", "in", Object.values(mapWsMaterialIds).map(Number))
            .select(["mw.id", "mw.material_id"])
            .execute()
          const mapMaterialIds = associateField(
            wsMaterials,
            "id",
            "material_id"
          )
          const toMaterialId =
            mapMaterialIds[
              mapWsMaterialIds[existingMaterial.parent_id ?? 0] ?? 0
            ] ?? 0

          const materialRelation = await trx
            .selectFrom("material_relations")
            .where("child_material_id", "=", globalId)
            .where("parent_material_id", "=", toMaterialId)
            .selectAll()
            .executeTakeFirst()

          await createMaterialRelations(
            trx,
            globalId,
            toMaterialId,
            materialRelation
          )
        } else {
          const materialActivities = await migrationDB
            .selectFrom("master_material_has_activities")
            .where("master_material_id", "=", existingMaterial.id)
            .select(["activity_id"])
            .execute()

          const programIds =
            materialActivities.length > 0
              ? collect(
                  await syncDB
                    .selectFrom("mapping_activities")
                    .select(["program_id"])
                    .where(
                      "existing_activity_id",
                      "in",
                      materialActivities.map((a) => a.activity_id)
                    )
                    .where("existing_program_id", "=", programId)
                    .execute(),
                  "program_id"
                )
              : platformProgramIds

          for (const progId of programIds) {
            const [mappedPlatformCreatedByIds, mappedPlatformUpdateByIds] =
              await Promise.all([
                getMapUserIds(progId, [existingMaterial.created_by ?? 0]),
                getMapUserIds(progId, [existingMaterial.created_by ?? 0]),
              ])

            const platformCreatedById =
              mappedPlatformCreatedByIds[existingMaterial.created_by ?? 0] ?? 0
            const platformUpdatedById =
              mappedPlatformUpdateByIds[existingMaterial.updated_by ?? 0] ?? 0

            // insert to workspace
            await insertMaterialProgram(
              trx,
              globalId,
              progId,
              existingMaterial,
              { platformCreatedById, platformUpdatedById }
            )
            materialWorkspaceCount++
          }
        }
      }
      // Re-enable foreign key checks after migration is complete
      await sql`SET FOREIGN_KEY_CHECKS = 1`.execute(trx)
    })
    const endTime = new Date()
    const duration = formatDuration(startTime, endTime)

    console.info(
      `\n🎉 Migration materials finished at: ${endTime.toLocaleString()}`
    )
    console.info(`📊 Total duration: ${duration}`)
    console.info(`📈 Summary:`)
    console.info(`   - Materials: ${materialCount} records`)
    console.info(`   - Material Workspaces: ${materialWorkspaceCount} records`)
    console.info("✅ All global material migration completed successfully")
    process.exit(0)
  } catch (error) {
    console.error("migration failed:")
    console.error(error)
    process.exit(1)
  }
}

async function insertMaterials(
  trx: Transaction<DB>,
  existingMaterial: MigrationMasterMaterialDTO,
  globaMaterial: MaterialsDTO | undefined,
  globalMaterialByCode: MaterialsDTO | undefined,
  otherProps: {
    isHierarchy: boolean
    materialTypeID: number
    materialUnitConsumptionId: number
    materialUnitDistributioId: number
    platformCreatedByGlobalId: number
    platformUpdatedByGlobalId: number
  }
) {
  let code: string
  if (globalMaterialByCode) {
    code = `${existingMaterial.code}_${existingMaterial.name}`
  } else {
    code = existingMaterial.code ?? ""
  }

  let globalId: number
  if (globalMaterialByCode && otherProps.isHierarchy) {
    globalId = Number(globaMaterial?.id)
  } else {
    const result = await trx
      .insertInto("materials")
      .values({
        name: existingMaterial.name ?? "",
        description: existingMaterial.description,
        material_level_id: existingMaterial.kfa_level_id ?? 3,
        code: code,
        hierarchy_code: existingMaterial.kfa_code,
        unit_of_consumption_id: otherProps.materialUnitConsumptionId,
        unit_of_distribution_id: otherProps.materialUnitDistributioId,
        consumption_unit_per_distribution_unit:
          existingMaterial.pieces_per_unit!,
        is_temperature_sensitive: existingMaterial.temperature_sensitive ?? 0,
        min_retail_price: 0,
        max_retail_price: 0,
        min_temperature: existingMaterial.temperature_min ?? 0,
        max_temperature: existingMaterial.temperature_min ?? 0,
        material_type_id: otherProps.materialTypeID,
        is_managed_in_batch: existingMaterial.managed_in_batch ?? 0,
        status: existingMaterial.status ?? 1,
        is_stock_opname_mandatory: existingMaterial.is_so ?? 0,
        created_by: otherProps.platformCreatedByGlobalId,
        updated_by: otherProps.platformUpdatedByGlobalId,
        deleted_by: existingMaterial.deleted_at ? 29187 : null,
        created_at: existingMaterial.created_at,
        updated_at: existingMaterial.updated_at,
        deleted_at: existingMaterial.deleted_at,
      })
      .executeTakeFirst()

    globalId = Number(result.insertId)
  }

  return globalId
}

async function insertMaterialProgram(
  trx: Transaction<DB>,
  globalId: number,
  progId: number,
  existingMaterial: MigrationMasterMaterialDTO,
  otherProps: {
    platformCreatedById: number
    platformUpdatedById: number
  }
) {
  // insert to workspace
  const materialWorkspace = await trx
    .selectFrom("material_workspaces")
    .where("material_id", "=", globalId)
    .where("workspace_id", "=", progId)
    .selectAll()
    .executeTakeFirst()
  let wsGlobalId = Number(materialWorkspace?.id)
  let platformGlobalId = Number(materialWorkspace?.material_id)

  if (!materialWorkspace) {
    const res = await trx
      .insertInto("material_workspaces")
      .values({
        material_id: globalId,
        workspace_id: progId,
        is_open_vial: existingMaterial.is_openvial,
        created_by: otherProps.platformCreatedById,
        updated_by: otherProps.platformUpdatedById,
      })
      .executeTakeFirst()
    wsGlobalId = Number(res.insertId)
    platformGlobalId = Number(globalId)
  }

  // update global id
  await insertTableMapping(
    "materials",
    progId,
    {
      [existingMaterial.id!]: wsGlobalId,
    },
    {
      [existingMaterial.id!]: platformGlobalId,
    }
  )
}

async function createMaterialRelations(
  trx: Transaction<DB>,
  globalId: number,
  toMaterialId: number,
  materialRelation: MaterialRelationsDTO | undefined
) {
  if (!materialRelation) {
    await trx
      .insertInto("material_relations")
      .values({
        child_material_id: globalId,
        parent_material_id: Number(toMaterialId),
      })
      .execute()
  }
}
