import { DinGateway } from "@/gateways/din/din.gateway.js"
import { IMMUNIZATION } from "@/scripts/data-migration/constants/program.js"
import { getMigrationDB } from "@/scripts/db.migration.js"
import { db } from "@/scripts/db.platform.js"
import { sql } from "kysely"

interface MsiResponseData {
  kabkota: {
    kode: string
  }
}

interface MsiResponseBody {
  data: MsiResponseData[]
  status_code: number
  message: string
  page: number
  total_page: number
}

export async function removeDuplicateMsi(programId = IMMUNIZATION) {
  const migrationDB = getMigrationDB(programId)

  console.log("Starting removeDuplicateMsi script...")

  // 1. Initialize DinGateway client
  const dinClient = await db
    .selectFrom("integration_clients")
    .selectAll()
    .where("key", "=", "din")
    .executeTakeFirst()

  if (!dinClient) {
    console.error("Din integration client not found.")
    return
  }

  const dinGateway = new DinGateway(dinClient)

  // 2. Query for duplicate id_satu_sehat
  const duplicateMsiRecords = await migrationDB
    .selectFrom("mapping_entities as me")
    .innerJoin("entities as e", "e.id", "me.id_entitas_smile")
    .select([
      "me.id_satu_sehat",
      sql<string>`GROUP_CONCAT(me.id_entitas_smile)`.as("ids"),
      sql<string>`GROUP_CONCAT(e.name)`.as("names"),
      sql<string>`GROUP_CONCAT(e.regency_id)`.as("regencies"),
      sql<number>`count(*)`.as("total"),
    ])
    .where("e.deleted_at", "is", null)
    .groupBy("id_satu_sehat")
    .having(sql`count(*)`, ">", 1)
    .execute()

  console.log(`Found ${duplicateMsiRecords.length} duplicate MSI records.`)

  for (const record of duplicateMsiRecords) {
    const { id_satu_sehat, ids, regencies } = record
    const entityIds = ids.split(",")
    const entityRegencies = regencies.split(",")

    console.log(
      `Processing duplicate MSI: ${id_satu_sehat} with entities: ${ids}`
    )

    if (!id_satu_sehat) {
      console.warn("id_satu_sehat is null. Skipping.")
      continue
    }

    // 3. Call getMSI for each duplicate
    try {
      const msiResponse = await dinGateway.getMSI(String(id_satu_sehat))

      if (
        msiResponse.response.status === 200 &&
        typeof msiResponse.response.body === "object" &&
        msiResponse.response.body !== null &&
        "data" in msiResponse.response.body &&
        Array.isArray((msiResponse.response.body as MsiResponseBody).data) &&
        (msiResponse.response.body as MsiResponseBody).data.length > 0
      ) {
        const apiKabkotaKode = (msiResponse.response.body as MsiResponseBody)
          .data[0]?.kabkota.kode
        if (!apiKabkotaKode) {
          console.warn(
            `Could not extract kabkota.kode for MSI: ${id_satu_sehat}`
          )
          continue // Skip to the next duplicate MSI
        }

        // 4. Compare and remove duplicates
        for (let i = 0; i < entityIds.length; i++) {
          const entityId = entityIds[i]
          const entityRegency = entityRegencies[i]

          if (entityId && entityRegency !== apiKabkotaKode) {
            console.log(
              `Removing id_satu_sehat ${id_satu_sehat} for entity ${entityId} (regency mismatch: ${entityRegency} !== ${apiKabkotaKode})`
            )
            await migrationDB
              .deleteFrom("mapping_entities")
              .where("id_entitas_smile", "=", Number(entityId))
              .where("id_satu_sehat", "=", id_satu_sehat)
              .execute()
          }
        }
      } else {
        console.warn(
          `Failed to get MSI data for ${id_satu_sehat}: Status ${msiResponse.response.status}, Body: ${msiResponse.response.body}`
        )
      }

      // remove duplicate for special case
      await migrationDB
        .deleteFrom("mapping_entities")
        .where("id_entitas_smile", "in", [26122, 38411, 1005578, 15219, 130])
        .execute()
    } catch (error) {
      console.error(`Error processing MSI ${id_satu_sehat}:`, error)
    }
  }

  console.log("Finished removeDuplicateMsi script.")
}
