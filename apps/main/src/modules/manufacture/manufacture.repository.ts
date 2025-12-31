import { SORT_TYPE } from "@/common/constants/general.js"
import { GLOBAL_MATERIAL_TYPES } from "@/common/constants/material.js"
import { ValidationError } from "@smile/lib/error.js"
import { associate, group } from "@smile/lib/utils.js"
import { Context } from "hono"
import { sql } from "kysely"
import { BaseRepository } from "../base.repository.js"
import { ManufacturePaginatedRequestDTO } from "./manufacture.schema.js"

export class ManufactureRepository extends BaseRepository<"ws_manufactures"> {
  constructor() {
    super("ws_manufactures")
  }

  SELECTED_COLUMNS = [
    "ws_manufactures.id",
    "ws_manufactures.name",
    "ws_manufactures.type",
    "ws_manufactures.description",
    "ws_manufactures.contact_name",
    "ws_manufactures.phone_number",
    "ws_manufactures.email",
    "ws_manufactures.address",
    "ws_manufactures.status",
    "ws_manufactures.created_by",
    "ws_manufactures.updated_by",
    "ws_manufactures.deleted_by",
    "ws_manufactures.created_at",
    "ws_manufactures.updated_at",
    "ws_manufactures.deleted_at",
    "manufacture_types.name as type_name",
    "users.firstname",
    "users.lastname",
  ] as const

  async findAll(c: Context, params: ManufacturePaginatedRequestDTO) {
    let query = c.var.trx
      .selectFrom("ws_manufactures")
      .innerJoin(
        "manufacture_types",
        "ws_manufactures.type",
        "manufacture_types.id"
      )
      .leftJoin(
        "ws_material_manufactures",
        "ws_manufactures.id",
        "ws_material_manufactures.manufacture_id"
      )
      .leftJoin("ws_users as users", "ws_manufactures.updated_by", "users.id")
      .where("ws_manufactures.deleted_at", "is", null)
      .where("ws_manufactures.program_id", "=", c.var.programId)
      .distinct()
      .select(this.SELECTED_COLUMNS)

    if (Array.isArray(params.ids) && params.ids.length > 0) {
      query = query.where("ws_manufactures.id", "in", params.ids)
    }
    if (params.keyword) {
      query = query.where("ws_manufactures.name", "like", `%${params.keyword}%`)
    }
    if (params.type !== null && params.type !== undefined) {
      query = query.where("ws_manufactures.type", "=", params.type)
    }
    if (params.status !== null && params.status !== undefined) {
      query = query.where("ws_manufactures.status", "=", params.status)
    }
    if (params.material_id !== null && params.material_id !== undefined) {
      query = query.where(
        "ws_material_manufactures.material_id",
        "=",
        params.material_id
      )
    }
    if (
      params.is_temperature_sensitive &&
      params.is_temperature_sensitive === 1
    ) {
      const manufactureData =
        await this.getManufactureByIsTemperatureSensitive(c)

      if (manufactureData) {
        query = query.where("ws_manufactures.id", "in", manufactureData.ids)
      }
    }

    switch (params.sort_by) {
      case "name":
        query = query.orderBy("ws_manufactures.name", params.sort_type)
        break
      case "type":
        query = query.orderBy("type_name", params.sort_type)
        break
      case "status":
        query = query.orderBy(
          sql`CASE WHEN ws_manufactures.status = 1 THEN 'active' ELSE 'inactive' END`,
          params.sort_type
        )
        break
      case "updated_by":
        query = query.orderBy(
          sql`CONCAT(users.firstname, ' ', users.lastname)`,
          params.sort_type
        )
        break
      default:
        query = query.orderBy("ws_manufactures.id", SORT_TYPE.DESC)
    }

    const queryAll = params?.isPaginate
      ? query.limit(params.paginate).offset(params.offset).execute()
      : query.execute()

    const [manufactures, count] = await Promise.all([
      queryAll,
      query
        .clearSelect()
        .clearOrderBy()
        .select(
          sql<number>`count(distinct ${sql.ref("ws_manufactures.id")})`.as(
            "total"
          )
        )
        .executeTakeFirstOrThrow(),
    ])

    return {
      data: manufactures,
      total: Number(count?.total ?? 0),
    }
  }

  async findAndGroupByTypeID(c: Context, ids: number[]) {
    const types = await c.var.trx
      .selectFrom("manufacture_types")
      .where("id", "in", ids)
      .select(["id", "name"])
      .execute()

    return associate(types, "id")
  }

  async findByTypeID(c: Context, id: number) {
    const type = await c.var.trx
      .selectFrom("manufacture_types")
      .where("id", "=", id)
      .select(["id", "name"])
      .executeTakeFirst()

    return type
  }

  // Used by material module
  getStreamData(c: Context) {
    return c.var.trx
      .selectFrom("ws_manufactures")
      .where("program_id", "=", c.var.programId)
      .where("deleted_at", "is", null)
      .select(["id", "name"])
      .stream()
  }

  // Used by material module
  async getByMaterialId(c: Context, materialID: number, programId: number) {
    const materialMap = await this.getByMaterialIdMapped(
      c,
      [materialID],
      programId
    )
    return materialMap[materialID] ?? []
  }

  // Used by material module
  async getByMaterialIdMapped(
    c: Context,
    materialIDs: number[],
    programId: number
  ) {
    const manufactures = await c.var.trx
      .selectFrom("ws_manufactures as m")
      .innerJoin("ws_material_manufactures as mm", "mm.manufacture_id", "m.id")
      .where("material_id", "in", materialIDs)
      .where("m.program_id", "=", programId)
      .select(["m.id", "m.name", "mm.material_id"])
      .groupBy(["m.id", "mm.material_id"])
      .execute()

    return group(manufactures, "material_id")
  }

  // Used by material module
  async syncMaterialManufactures(
    c: Context,
    materialId: number,
    manufactureIds: number[]
  ) {
    await c.var.trx
      .deleteFrom("ws_material_manufactures")
      .where("material_id", "=", materialId)
      .execute()

    try {
      for (const manufactureId of manufactureIds) {
        await c.var.trx
          .insertInto("ws_material_manufactures")
          .values({
            material_id: materialId,
            manufacture_id: manufactureId,
          })
          .execute()
      }
    } catch {
      throw new ValidationError("invalid manufactures")
    }
  }

  // used by app mobile data module
  async getMaterialManufactureGroup(c: Context, materialIds: number[]) {
    const data = await c.var.trx
      .selectFrom("ws_material_manufactures as wmm")
      .innerJoin("ws_manufactures as wm", "wmm.manufacture_id", "wm.id")
      .where("wmm.material_id", "in", materialIds)
      .where("wm.program_id", "=", c.var.programId)
      .where((eb) =>
        eb.or([eb("wm.deleted_at", "is", null), eb("wm.status", "=", 1)])
      )
      .select([
        "wmm.material_id",
        "wm.id",
        "wm.name",
        "wm.description",
        "wm.address",
      ])
      .execute()

    return group(data, "material_id")
  }

  // used by app mobile data module
  async getManufactureAssociate(c: Context, ids: number[]) {
    if (ids.length === 0) {
      return {}
    }
    const data = await c.var.trx
      .selectFrom("ws_manufactures as wm")
      .where("wm.id", "in", ids)
      .where("wm.program_id", "=", c.var.programId)
      .select(["wm.id", "wm.name", "wm.description"])
      .execute()

    return associate(data, "id")
  }

  async updateStatus(c: Context, manufactureId: number, status: number) {
    return await c.var.trx
      .updateTable("manufacture_workspaces")
      .set({
        status: status,
        updated_by: c.var.userId,
      })
      .where("id", "=", manufactureId)
      .executeTakeFirst()
  }

  async getManufactureByIsTemperatureSensitive(c: Context) {
    const programId = c.get("programId")
    const isImmunization = c.var.config?.is_immunization

    const manufactures = await c.var.trx
      .selectFrom("ws_manufactures as wm")
      .innerJoin("material_volumes as mv", "wm.global_id", "mv.manufacture_id")
      .innerJoin("materials as m", "m.id", "mv.material_id")
      .innerJoin("material_types as mt", "mt.id", "m.material_type_id")
      .select(["wm.id", "wm.name"])
      .where("m.is_temperature_sensitive", "=", 1)
      .where("wm.program_id", "=", programId)
      .$if(isImmunization === true, (qb) =>
        qb.where("mt.name", "=", GLOBAL_MATERIAL_TYPES[2])
      )
      .execute()

    if (!manufactures || manufactures.length === 0) return null

    const manufactureIds = manufactures.map((item) => item.id)

    const manufactureNames = manufactures.map((item) => item.name.toLowerCase())

    const manufactureData = {
      ids: manufactureIds,
      names: manufactureNames,
    }

    return manufactureData
  }
}
