import { db } from "@/common/infrastructure/database/index.js"

type Params = {
  provinceId: string
  regencyId: string
  subDistrictId: string
  programId: number
  vendorId: number
  activityIds: number[]
  codes?: number[]
  names?: string[]
}

const MATERIAL_LEVEL_ID = 2
const ENTITY_TAG_IDS = [
  10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 27, 28, 29,
]

export const populateEntityMaterialsActivityFinalDistribution = async ({
  provinceId,
  regencyId,
  subDistrictId,
  programId,
  vendorId,
  activityIds,
  codes,
  names,
}: Params) => {
  try {
    console.log(
      "Starting population of entity materials and activity vendors customer"
    )

    await db.transaction().execute(async (trx) => {
      // === 1. Ambil global entities ===
      const globalEntities = await trx
        .selectFrom("entities as we")
        .select("we.id")
        .leftJoin("locations as p", "p.id", "we.province_id")
        .leftJoin("locations as r", "r.id", "we.regency_id")
        .leftJoin("locations as sd", "sd.id", "we.sub_district_id")
        .leftJoin("locations as v", "v.id", "we.village_id")
        .where("we.deleted_at", "is", null)
        .where("we.province_id", "=", provinceId)
        .where((eb) =>
          eb.and([
            eb("we.regency_id", "=", regencyId),
            eb("we.sub_district_id", "=", subDistrictId),
            eb.or([
              eb("we.sub_district_id", "is not", null),
              eb("we.sub_district_id", "!=", ""),
            ]),
          ])
        )
        .$if(!!(codes && codes.length > 0), (qb) =>
          qb.where("we.id", "in", codes!)
        )
        .$if(!!(names && names.length > 0), (qb) =>
          qb.where("we.name", "in", names!)
        )
        .where("we.entity_tag_id", "in", ENTITY_TAG_IDS)
        .execute()

      if (globalEntities.length === 0) {
        console.warn("No matching global entities found. Skipping...")
        return
      }

      const globalEntityIds = globalEntities.map((e) => e.id)
      console.info(`Found ${globalEntityIds.length} global entities`)

      // === 2. Insert ke entity_workspace (avoid duplicates) ===
      const workspaceId = programId
      const existingInWorkspace = await trx
        .selectFrom("entity_workspaces")
        .select("entity_id")
        .where("workspace_id", "=", workspaceId)
        .where("entity_id", "in", globalEntityIds)
        .execute()

      const existingEntityIds = new Set(
        existingInWorkspace.map((e) => e.entity_id)
      )

      const newWorkspaceEntities = globalEntityIds
        .filter((id) => !existingEntityIds.has(id))
        .map((entity_id) => ({
          workspace_id: workspaceId,
          entity_id,
          created_at: new Date(),
          updated_at: new Date(),
        }))

      if (newWorkspaceEntities.length > 0) {
        await trx
          .insertInto("entity_workspaces")
          .values(newWorkspaceEntities)
          .execute()
        console.info(
          `Inserted ${newWorkspaceEntities.length} new workspace entities`
        )
      }

      // === 3. Ambil program entities dari ws_entities ===
      const programEntities = await trx
        .selectFrom("ws_entities as we")
        .select("we.id")
        .leftJoin("locations as p", "p.id", "we.province_id")
        .leftJoin("locations as r", "r.id", "we.regency_id")
        .leftJoin("locations as sd", "sd.id", "we.sub_district_id")
        .leftJoin("locations as v", "v.id", "we.village_id")
        .where("we.deleted_at", "is", null)
        .where("we.province_id", "=", provinceId)
        .where((eb) =>
          eb.and([
            eb("we.regency_id", "=", regencyId),
            eb("we.sub_district_id", "=", subDistrictId),
            eb.or([
              eb("we.sub_district_id", "is not", null),
              eb("we.sub_district_id", "!=", ""),
            ]),
          ])
        )
        .$if(!!(codes && codes.length > 0), (qb) =>
          qb.where("we.global_id", "in", codes!)
        )
        .$if(!!(names && names.length > 0), (qb) =>
          qb.where("we.name", "in", names!)
        )
        .where("we.entity_tag_id", "in", ENTITY_TAG_IDS)
        .where("we.program_id", "=", programId)
        .execute()

      if (programEntities.length === 0) {
        throw new Error("No program entities found. Cannot proceed.")
      }

      const programEntityIds = programEntities.map((e) => e.id)
      console.info(`Found ${programEntityIds.length} program entities`)

      // === 4. Insert ke ws_customer_vendors (avoid duplicates) ===
      const existingCustomerVendors = await trx
        .selectFrom("ws_customer_vendors")
        .select(["id", "customer_id"])
        .where("program_id", "=", programId)
        .where("vendor_id", "=", vendorId)
        .where("customer_id", "in", programEntityIds)
        .execute()

      const existingCustomerIds = new Set(
        existingCustomerVendors.map((cv) => cv.customer_id)
      )

      const newCustomerVendors = programEntityIds
        .filter((id) => !existingCustomerIds.has(id))
        .map((customer_id) => ({
          program_id: programId,
          vendor_id: vendorId,
          customer_id,
          is_consumption: 1,
          created_at: new Date(),
          updated_at: new Date(),
        }))

      let allCustomerVendors: Array<{ id: number; customer_id: number }> = [
        ...existingCustomerVendors,
      ]

      if (newCustomerVendors.length > 0) {
        await trx
          .insertInto("ws_customer_vendors")
          .values(newCustomerVendors)
          .executeTakeFirst()

        // Untuk mendapatkan ID yang baru diinsert dengan aman
        const newlyInserted = await trx
          .selectFrom("ws_customer_vendors")
          .select(["id", "customer_id"])
          .where("program_id", "=", programId)
          .where("vendor_id", "=", vendorId)
          .where(
            "customer_id",
            "in",
            newCustomerVendors.map((cv) => cv.customer_id)
          )
          .execute()

        allCustomerVendors = [...existingCustomerVendors, ...newlyInserted]
        console.info(
          `Inserted ${newCustomerVendors.length} new customer-vendors`
        )
      }

      // === 5. Insert ke ws_customer_vendor_activities (avoid duplicates) ===
      const allCustomerVendorIds = allCustomerVendors.map((cv) => cv.id)

      const existingCva = await trx
        .selectFrom("ws_customer_vendor_activities")
        .select(["customer_vendor_id", "activity_id"])
        .where("customer_vendor_id", "in", allCustomerVendorIds)
        .where("activity_id", "in", activityIds)
        .execute()

      const existingCvaSet = new Set(
        existingCva.map((cva) => `${cva.customer_vendor_id}-${cva.activity_id}`)
      )

      const newCvaValues = activityIds.flatMap((activityId) =>
        allCustomerVendors
          .map((cv) => ({
            customer_vendor_id: cv.id,
            activity_id: activityId,
          }))
          .filter(
            (cva) =>
              !existingCvaSet.has(
                `${cva.customer_vendor_id}-${cva.activity_id}`
              )
          )
      )

      if (newCvaValues.length > 0) {
        await trx
          .insertInto("ws_customer_vendor_activities")
          .values(newCvaValues)
          .execute()
        console.info(
          `Inserted ${newCvaValues.length} customer-vendor activities`
        )
      }

      // === 5.1. Insert ke ws_entity_activities (avoid duplicates) ===
      const existingEntityActivities = await trx
        .selectFrom("ws_entity_activities")
        .select(["entity_id", "activity_id"])
        .where("entity_id", "in", programEntityIds)
        .where("activity_id", "in", activityIds)
        .execute()

      const existingEntityActivitySet = new Set(
        existingEntityActivities.map(
          (ea) => `${ea.entity_id}-${ea.activity_id}`
        )
      )

      const newEntityActivities = activityIds.flatMap((activityId) =>
        programEntityIds
          .map((entityId) => ({
            entity_id: entityId,
            activity_id: activityId,
            start_date: new Date(),
            end_date: null,
            created_at: new Date(),
            updated_at: new Date(),
          }))
          .filter(
            (ea) =>
              !existingEntityActivitySet.has(
                `${ea.entity_id}-${ea.activity_id}`
              )
          )
      )

      if (newEntityActivities.length > 0) {
        await trx
          .insertInto("ws_entity_activities")
          .values(newEntityActivities)
          .execute()
        console.info(`Inserted ${newEntityActivities.length} entity activities`)
      } else {
        console.info("No new entity activities to insert")
      }

      // === 6. Insert materials ke ws_entity_material_activities ===
      const materials = await trx
        .selectFrom("ws_materials")
        .select("id")
        .where("program_id", "=", programId)
        .where("material_level_id", "=", MATERIAL_LEVEL_ID)
        .execute()

      if (materials.length === 0) {
        console.warn(
          `No materials found for material_level_id = ${MATERIAL_LEVEL_ID}. Skipping material assignment.`
        )
      } else {
        const materialIds = materials.map((m) => m.id)
        console.info(`Found ${materialIds.length} materials`)

        // Gabungkan program entity IDs dengan vendor ID untuk checking
        const allEntityIdsToCheck = [...programEntityIds, vendorId]

        // Ambil existing combinations untuk program entities DAN vendor
        const existingEma = await trx
          .selectFrom("ws_entity_material_activities")
          .select(["entity_id", "activity_id", "material_id"])
          .where("entity_id", "in", allEntityIdsToCheck)
          .where("activity_id", "in", activityIds)
          .where("material_id", "in", materialIds)
          .execute()

        const existingEmaSet = new Set(
          existingEma.map(
            (ema) => `${ema.entity_id}-${ema.activity_id}-${ema.material_id}`
          )
        )

        // Generate all combinations untuk PROGRAM entities
        const newEmaValues = programEntityIds.flatMap((programEntityId) =>
          activityIds.flatMap((activityId) =>
            materialIds
              .map((materialId) => ({
                entity_id: programEntityId,
                activity_id: activityId,
                material_id: materialId,
                created_at: new Date(),
              }))
              .filter(
                (ema) =>
                  !existingEmaSet.has(
                    `${ema.entity_id}-${ema.activity_id}-${ema.material_id}`
                  )
              )
          )
        )

        // Generate combinations untuk vendor dengan checking duplikasi
        const vendorEmaValues = activityIds.flatMap((activityId) =>
          materialIds
            .map((materialId) => ({
              entity_id: vendorId,
              activity_id: activityId,
              material_id: materialId,
              created_at: new Date(),
            }))
            .filter(
              (ema) =>
                !existingEmaSet.has(
                  `${ema.entity_id}-${ema.activity_id}-${ema.material_id}`
                )
            )
        )

        // Gabungkan semua data
        const allEmaValues = [...newEmaValues, ...vendorEmaValues]

        if (allEmaValues.length > 0) {
          // Batch insert untuk performa lebih baik dengan dataset besar
          const BATCH_SIZE = 1000
          for (let i = 0; i < allEmaValues.length; i += BATCH_SIZE) {
            const batch = allEmaValues.slice(i, i + BATCH_SIZE)
            await trx
              .insertInto("ws_entity_material_activities")
              .values(batch)
              .execute()
          }
          console.info(
            `Inserted ${allEmaValues.length} entity-material activities (${newEmaValues.length} for program entities, ${vendorEmaValues.length} for vendor)`
          )
        } else {
          console.info("No new entity-material activities to insert")
        }
      }
    })

    console.log(
      "Entity, vendor, and material population completed successfully."
    )
    process.exit(0)
  } catch (error) {
    console.error("Error during population:", error)
    process.exit(1)
  }
}
