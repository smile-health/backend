import type { Kysely } from "kysely"
import { addTimestampColumns } from "../helper"

export async function up(db: Kysely<any>): Promise<void> {
  // Create designation_cceigat table
  await db.schema
    .createTable("cceigat_descriptions")
    .addColumn("id", "bigint", (col) => col.primaryKey().autoIncrement())
    .addColumn("name", "varchar(255)", (col) => col.notNull())
    .$call(addTimestampColumns)
    .execute()

  // Create type_pqs table
  await db.schema
    .createTable("pqs_types")
    .addColumn("id", "bigint", (col) => col.primaryKey().autoIncrement())
    .addColumn("name", "varchar(255)", (col) => col.notNull())
    .$call(addTimestampColumns)
    .execute()

  // Insert data into designation_cceigat table
  await db
    .insertInto("cceigat_descriptions")
    .values([
      {
        id: 1,
        name: "Solar direct drive combined refrigerator/freezer",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 2,
        name: "refrigerator & freezer",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 3,
        name: "ice-lined refrigerator/icepack freezer",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 4,
        name: "refrigerator",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 5,
        name: "icelined refrigerator & vac/icepack freezer",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 6,
        name: "icelined refrigerator",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 7,
        name: "Vaccine/icepack freezer",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 8,
        name: "Waterpacks freezer",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 9,
        name: "Solar direct drive refrigerator witout battery",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 10,
        name: "Vaccine Refrigerator or icepack freezer",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 11,
        name: "Icepack freezer",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 12,
        name: "Ice-lined refrigerator",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 13,
        name: "_1. Walk-in cold rooms",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 14,
        name: "Solar direct drive refrigerator",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 15,
        name: "Solar direct drive, ancillary battery refrigerator",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 16,
        name: "icelined refrigerator - water-pack freezer",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 17,
        name: "Solar direct drive refrigerator and freezer",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 18,
        name: "Vaccine Freezer - Ultralow Temperature Storage",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 19,
        name: "Solar battery powered combo refrigerator & freezer",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 20,
        name: "Combined icelined refrigerator/waterpacks freezer",
        created_at: new Date(),
        updated_at: new Date(),
      },
    ])
    .execute()

  // Insert data into type_pqs table
  await db
    .insertInto("pqs_types")
    .values([
      {
        id: 1,
        name: "ARF",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 2,
        name: "ILRF",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 3,
        name: "CRF",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 4,
        name: "SBRF",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 5,
        name: "ILR",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 6,
        name: "AF",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 7,
        name: "WPF",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 8,
        name: "CF",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 9,
        name: "SBRorF",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 10,
        name: "SDR",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 11,
        name: "ILRorF",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 12,
        name: "SBR",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 13,
        name: "SDRF",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 14,
        name: "SDF",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 15,
        name: "SDRorF",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 16,
        name: "ULTF",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 17,
        name: "TPVSA",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 18,
        name: "IRL",
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 19,
        name: "SR",
        created_at: new Date(),
        updated_at: new Date(),
      },
    ])
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  // Drop tables in reverse order
  await db.schema.dropTable("type_pqs").execute()
  await db.schema.dropTable("designation_cceigat").execute()
}
