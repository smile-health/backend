import { sql, type Kysely } from "kysely"
import { Database } from "../types/index.js"

const TABLE_NAME = "ws_material_targets"

export async function up(db: Kysely<Database>): Promise<void> {
  await sql`TRUNCATE TABLE ${sql.table(TABLE_NAME)}`.execute(db)

  const data_target_non_bias_primary = [
    "hepatitis-b",
    "bcg bayi",
    "polio",
    "ipv",
    "pcv mdv",
    "hb hib",
    "measles rubella (mr)",
    "Vaksin Rotavac",
    "td",
  ]

  const data_target_non_bias_additional = [
    "ADS 5 ml",
    "ADS 0.5 ml",
    "ADS 0.05 ml",
    "SB 2.5 liter",
    "SB 5 liter",
  ]

  const data_target_bias_primary = [
    "VAKSIN MEASLES RUBELLA (MR) 10 DS/ PARTNERSHIP",
    "DT",
    "VAKSIN TD 10 DS",
    "HPV",
  ]

  const data_target_bias_additional = [
    "ADS 5 ml",
    "ADS 0.5 ml",
    "SB 2.5 liter",
    "SB 5 liter",
  ]

  const data_target_immunization = [
    {
      name: "VAKSIN HEPATITIS-B BAYI",
      start_ideal_days: 0,
      end_ideal_days: 7,
      restricted_ideal_day: 8,
      parent: false,
    },
    {
      name: "VAKSIN BCG BAYI IMPOR",
      start_ideal_days: 30,
      end_ideal_days: 359,
      restricted_ideal_day: 360,
      parent: false,
    },
    {
      name: "VAKSIN POLIO / BOPV 10 DS",
      start_ideal_days: 30,
      end_ideal_days: 1799,
      parent: false,
    },
    {
      name: "VAKSIN POLIO / BOPV 10 DS",
      start_ideal_days: 60,
      end_ideal_days: 1799,
      parent: true,
    },
    {
      name: "VAKSIN POLIO / BOPV 10 DS",
      start_ideal_days: 90,
      end_ideal_days: 1799,
      parent: true,
    },
    {
      name: "VAKSIN POLIO / BOPV 10 DS",
      start_ideal_days: 120,
      end_ideal_days: 1799,
      parent: true,
    },
    {
      name: "VAKSIN DTP HB HIB 5 DS",
      start_ideal_days: 60,
      end_ideal_days: 1799,
      restricted_ideal_day: 1800,
      parent: false,
    },
    {
      name: "VAKSIN DTP HB HIB 5 DS",
      start_ideal_days: 90,
      end_ideal_days: 1799,
      restricted_ideal_day: 1800,
      parent: true,
    },
    {
      name: "VAKSIN DTP HB HIB 5 DS",
      start_ideal_days: 120,
      end_ideal_days: 1799,
      restricted_ideal_day: 1800,
      parent: true,
    },
    {
      name: "VAKSIN DTP HB HIB 5 DS",
      start_ideal_days: 540,
      end_ideal_days: 1799,
      restricted_ideal_day: 1800,
      parent: true,
    },
    {
      name: "Vaksin Rotavac 5 Ds",
      start_ideal_days: 60,
      end_ideal_days: 209,
      restricted_ideal_day: 210,
      parent: false,
    },
    {
      name: "Vaksin Rotavac 5 Ds",
      start_ideal_days: 90,
      end_ideal_days: 209,
      restricted_ideal_day: 210,
      parent: true,
    },
    {
      name: "Vaksin Rotavac 5 Ds",
      start_ideal_days: 120,
      end_ideal_days: 209,
      restricted_ideal_day: 210,
      parent: true,
    },
    {
      name: "PCV MDV",
      start_ideal_days: 60,
      end_ideal_days: 1799,
      restricted_ideal_day: 1800,
      parent: false,
    },
    {
      name: "PCV MDV",
      start_ideal_days: 90,
      end_ideal_days: 1799,
      restricted_ideal_day: 1800,
      parent: true,
    },
    {
      name: "PCV MDV",
      start_ideal_days: 360,
      end_ideal_days: 1799,
      restricted_ideal_day: 1800,
      parent: true,
    },
    {
      name: "VAKSIN IPV 5 DS",
      start_ideal_days: 120,
      end_ideal_days: 1799,
      restricted_ideal_day: 1800,
      parent: false,
    },
    {
      name: "VAKSIN IPV 5 DS",
      start_ideal_days: 270,
      end_ideal_days: 1799,
      restricted_ideal_day: 1800,
      parent: true,
    },
    {
      name: "VAKSIN MEASLES RUBELLA (MR) 10 DS/ PARTNERSHIP",
      start_ideal_days: 270,
      end_ideal_days: 1799,
      parent: false,
    },
    {
      name: "VAKSIN MEASLES RUBELLA (MR) 10 DS/ PARTNERSHIP",
      start_ideal_days: 540,
      end_ideal_days: 1799,
      parent: true,
    },
    {
      name: "JE",
      start_ideal_days: 300,
      end_ideal_days: 1799,
      restricted_ideal_day: 1800,
      parent: false,
    },
    {
      name: "VAKSIN MEASLES RUBELLA (MR) 10 DS/ PARTNERSHIP",
      start_ideal_days: 2555,
      restricted_ideal_day: 4380,
      parent: false,
    },
    {
      name: "DT",
      start_ideal_days: 2555,
      restricted_ideal_day: 2920,
      parent: false,
    },
    {
      name: "VAKSIN TD 10 DS",
      start_ideal_days: 2920,
      restricted_ideal_day: 4380,
      parent: false,
    },
    {
      name: "VAKSIN TD 10 DS",
      start_ideal_days: 4015,
      restricted_ideal_day: 4380,
      parent: true,
    },
    {
      name: "HPV",
      start_ideal_days: 4015,
      restricted_ideal_day: 5840,
      parent: false,
    },
  ]

  const existing = await db.selectFrom(TABLE_NAME).select(["id"]).execute()

  const existingMaterialIds = new Set(existing.map((entry) => entry.id))

  const insertsNonBiasPrimary: Array<{
    material_id: number
    category: "non_bias"
    type: "primary"
  }> = []

  for (const materialName of data_target_non_bias_primary) {
    const materials = await db
      .selectFrom("ws_materials")
      .select(["id"])
      .where("code", "like", `%${materialName}%`)
      .where("parent_id", "is", null)
      .where("program_id", "=", 1)
      .where("material_level_id", "=", 3)
      .where("material_type_id", "=", 2)
      .execute()

    for (const material of materials) {
      if (!existingMaterialIds.has(material.id)) {
        insertsNonBiasPrimary.push({
          material_id: material.id,
          category: "non_bias",
          type: "primary",
        })
      }
    }
  }

  if (insertsNonBiasPrimary.length > 0) {
    await db.insertInto(TABLE_NAME).values(insertsNonBiasPrimary).execute()
  }

  const insertsNonBiasAdditional: Array<{
    material_id: number
    category: "non_bias"
    type: "additional"
  }> = []

  for (const materialName of data_target_non_bias_additional) {
    const materials = await db
      .selectFrom("ws_materials")
      .select(["id"])
      .where("code", "=", materialName)
      .where("parent_id", "is", null)
      .where("program_id", "=", 1)
      .where("material_level_id", "=", 3)
      .execute()

    for (const material of materials) {
      if (!existingMaterialIds.has(material.id)) {
        insertsNonBiasAdditional.push({
          material_id: material.id,
          category: "non_bias",
          type: "additional",
        })
      }
    }
  }

  if (insertsNonBiasAdditional.length > 0) {
    await db.insertInto(TABLE_NAME).values(insertsNonBiasAdditional).execute()
  }

  const insertsBiasPrimary: Array<{
    material_id: number
    category: "bias"
    type: "primary"
    injection_month: string
  }> = []

  for (const materialName of data_target_bias_primary) {
    const materials = await db
      .selectFrom("ws_materials")
      .select(["id"])
      .where("code", "=", materialName)
      .where("parent_id", "is", null)
      .where("program_id", "=", 1)
      .where("material_level_id", "=", 3)
      .where("material_type_id", "=", 2)
      .execute()

    for (const material of materials) {
      if (!existingMaterialIds.has(material.id)) {
        insertsBiasPrimary.push({
          material_id: material.id,
          category: "bias",
          type: "primary",
          injection_month: "november",
        })
        insertsBiasPrimary.push({
          material_id: material.id,
          category: "bias",
          type: "primary",
          injection_month: "august",
        })
      }
    }
  }

  if (insertsBiasPrimary.length > 0) {
    await db.insertInto(TABLE_NAME).values(insertsBiasPrimary).execute()
  }

  const insertsBiasAdditional: Array<{
    material_id: number
    category: "bias"
    type: "additional"
    injection_month: string
  }> = []

  for (const materialName of data_target_bias_additional) {
    const materials = await db
      .selectFrom("ws_materials")
      .select(["id"])
      .where("code", "=", materialName)
      .where("parent_id", "is", null)
      .where("program_id", "=", 1)
      .where("material_level_id", "=", 3)
      .execute()

    for (const material of materials) {
      if (!existingMaterialIds.has(material.id)) {
        if (materialName !== "ADS 5 ml") {
          insertsBiasAdditional.push({
            material_id: material.id,
            category: "bias",
            type: "additional",
            injection_month: "november",
          })
        }
        insertsBiasAdditional.push({
          material_id: material.id,
          category: "bias",
          type: "additional",
          injection_month: "august",
        })
      }
    }
  }

  if (insertsBiasAdditional.length > 0) {
    await db.insertInto(TABLE_NAME).values(insertsBiasAdditional).execute()
  }

  let previousTargetId: number | null = null

  for (let i = 0; i < data_target_immunization.length; i++) {
    const immunizationData = data_target_immunization[i]
    if (!immunizationData) continue

    const isBias = i >= data_target_immunization.length - 5

    const materials = await db
      .selectFrom("ws_materials")
      .select(["id"])
      .where("code", "=", immunizationData.name)
      .where("parent_id", "is", null)
      .where("program_id", "=", 1)
      .where("material_level_id", "=", 3)
      .where("material_type_id", "=", 2)
      .execute()

    for (const material of materials) {
      const result = await db
        .insertInto(TABLE_NAME)
        .values({
          material_id: material.id,
          category: isBias ? "bias" : "non_bias",
          type: "immunization",
          start_ideal_days: immunizationData.start_ideal_days,
          end_ideal_days: immunizationData.end_ideal_days,
          restricted_ideal_day: immunizationData.restricted_ideal_day,
          parent_id: immunizationData.parent ? previousTargetId : null,
        })
        .executeTakeFirst()

      if (result && result.insertId) {
        previousTargetId = Number(result.insertId)
      }
    }
  }
}

export async function down(db: Kysely<Database>): Promise<void> {
  await sql`TRUNCATE TABLE ${sql.table(TABLE_NAME)}`.execute(db)
}
