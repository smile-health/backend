import { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function seed(db: Kysely<Database>): Promise<void> {
  const materialSubtypesTable = "material_subtypes"
  const materialSubtypeRelationsTable = "material_subtype_relations"

  const materialSubtypes = [
    { name: "vaccine", material_type_id: 2 },
    { name: "diluents", material_type_id: 2 },
    { name: "injection_device", material_type_id: 4 },
    { name: "storage_box", material_type_id: 3 },
  ]

  for (const subtype of materialSubtypes) {
    await db
      .insertInto(materialSubtypesTable)
      .values(subtype)
      .onDuplicateKeyUpdate({
        name: subtype.name,
      })
      .execute()
  }

  const materialSubtypeRelations = [
    { id: 1, from_material_subtype_id: 1, to_material_subtype_id: 2 }, // Vaccine -> Diluents
    { id: 2, from_material_subtype_id: 1, to_material_subtype_id: 3 }, // Vaccine -> Injection Device
    { id: 3, from_material_subtype_id: 3, to_material_subtype_id: 4 }, // Injection Device -> Storage Box
  ]

  for (const relation of materialSubtypeRelations) {
    await db
      .insertInto(materialSubtypeRelationsTable)
      .values(relation)
      .onDuplicateKeyUpdate({
        from_material_subtype_id: relation.from_material_subtype_id,
        to_material_subtype_id: relation.to_material_subtype_id,
      })
      .execute()
  }
}
