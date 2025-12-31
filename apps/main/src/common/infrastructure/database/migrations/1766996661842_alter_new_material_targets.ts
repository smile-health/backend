import { sql, type Kysely } from "kysely"
import { Database } from "../types/index.js"

const TABLE_NAME = "ws_material_targets"

export async function up(db: Kysely<Database>): Promise<void> {
  await sql`TRUNCATE TABLE ${sql.table(TABLE_NAME)}`.execute(db)

  const data_target_non_bias_primary = [
    4014, 4069, 4030, 4016, 4026, 4011, 4022, 4056, 4037,
  ]

  const data_target_non_bias_additional = [3986, 3984, 3982, 4032, 4033]

  const data_target_bias_primary = [4022, 4012, 4037, 4015]

  const data_target_bias_additional = [3986, 3984, 4032, 4033]

  const data_target_immunization = [
    {
      global_id: 4014,
      start_ideal_days: 0,
      end_ideal_days: 7,
      restricted_ideal_day: 8,
      parent: false,
    },
    {
      global_id: 4069,
      start_ideal_days: 30,
      end_ideal_days: 359,
      restricted_ideal_day: 360,
      parent: false,
    },
    {
      global_id: 4030,
      start_ideal_days: 30,
      end_ideal_days: 1799,
      parent: false,
    },
    {
      global_id: 4030,
      start_ideal_days: 60,
      end_ideal_days: 1799,
      parent: true,
    },
    {
      global_id: 4030,
      start_ideal_days: 90,
      end_ideal_days: 1799,
      parent: true,
    },
    {
      global_id: 4030,
      start_ideal_days: 120,
      end_ideal_days: 1799,
      parent: true,
    },
    {
      global_id: 4011,
      start_ideal_days: 60,
      end_ideal_days: 1799,
      restricted_ideal_day: 1800,
      parent: false,
    },
    {
      global_id: 4011,
      start_ideal_days: 90,
      end_ideal_days: 1799,
      restricted_ideal_day: 1800,
      parent: true,
    },
    {
      global_id: 4011,
      start_ideal_days: 120,
      end_ideal_days: 1799,
      restricted_ideal_day: 1800,
      parent: true,
    },
    {
      global_id: 4011,
      start_ideal_days: 540,
      end_ideal_days: 1799,
      restricted_ideal_day: 1800,
      parent: true,
    },
    {
      global_id: 4056,
      start_ideal_days: 60,
      end_ideal_days: 209,
      restricted_ideal_day: 210,
      parent: false,
    },
    {
      global_id: 4056,
      start_ideal_days: 90,
      end_ideal_days: 209,
      restricted_ideal_day: 210,
      parent: true,
    },
    {
      global_id: 4056,
      start_ideal_days: 120,
      end_ideal_days: 209,
      restricted_ideal_day: 210,
      parent: true,
    },
    {
      global_id: 4026,
      start_ideal_days: 60,
      end_ideal_days: 1799,
      restricted_ideal_day: 1800,
      parent: false,
    },
    {
      global_id: 4026,
      start_ideal_days: 90,
      end_ideal_days: 1799,
      restricted_ideal_day: 1800,
      parent: true,
    },
    {
      global_id: 4026,
      start_ideal_days: 360,
      end_ideal_days: 1799,
      restricted_ideal_day: 1800,
      parent: true,
    },
    {
      global_id: 4016,
      start_ideal_days: 120,
      end_ideal_days: 1799,
      restricted_ideal_day: 1800,
      parent: false,
    },
    {
      global_id: 4016,
      start_ideal_days: 270,
      end_ideal_days: 1799,
      restricted_ideal_day: 1800,
      parent: true,
    },
    {
      global_id: 4022,
      start_ideal_days: 270,
      end_ideal_days: 1799,
      parent: false,
    },
    {
      global_id: 4022,
      start_ideal_days: 540,
      end_ideal_days: 1799,
      parent: true,
    },
    {
      global_id: 4017,
      start_ideal_days: 300,
      end_ideal_days: 1799,
      restricted_ideal_day: 1800,
      parent: false,
    },
    {
      global_id: 4022,
      start_ideal_days: 2555,
      restricted_ideal_day: 4380,
      parent: false,
    },
    {
      global_id: 4012,
      start_ideal_days: 2555,
      restricted_ideal_day: 2920,
      parent: false,
    },
    {
      global_id: 4037,
      start_ideal_days: 2920,
      restricted_ideal_day: 4380,
      parent: false,
    },
    {
      global_id: 4037,
      start_ideal_days: 4015,
      restricted_ideal_day: 4380,
      parent: true,
    },
    {
      global_id: 4015,
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

  for (const materialId of data_target_non_bias_primary) {
    const materials = await db
      .selectFrom("ws_materials")
      .select(["id"])
      .where("global_id", "=", materialId)
      .where("program_id", "=", 1)
      .where("material_level_id", "=", 3)
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

  for (const materialId of data_target_non_bias_additional) {
    const materials = await db
      .selectFrom("ws_materials")
      .select(["id"])
      .where("global_id", "=", materialId)
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

  for (const materialId of data_target_bias_primary) {
    const materials = await db
      .selectFrom("ws_materials")
      .select(["id"])
      .where("global_id", "=", materialId)
      .where("program_id", "=", 1)
      .where("material_level_id", "=", 3)
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

  for (const materialId of data_target_bias_additional) {
    const materials = await db
      .selectFrom("ws_materials")
      .select(["id"])
      .where("global_id", "=", materialId)
      .where("program_id", "=", 1)
      .where("material_level_id", "=", 3)
      .execute()

    for (const material of materials) {
      if (!existingMaterialIds.has(material.id)) {
        if (materialId !== 3986) {
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
      .where("global_id", "=", immunizationData.global_id)
      .where("program_id", "=", 1)
      .where("material_level_id", "=", 3)
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
