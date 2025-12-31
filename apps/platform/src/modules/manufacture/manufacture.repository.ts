import { DB } from "@/common/infrastructure/database/types/db.js"
import { BaseRepository } from "@smile/lib/base/repository.js"
import { ValidationError } from "@smile/lib/error.js"
import { Context } from "@smile/lib/types/context.js"
import { group } from "@smile/lib/utils.js"
import {
  ComparisonOperatorExpression,
  ReferenceExpression,
  SelectQueryBuilder,
} from "kysely"
import {
  ManufacturePaginatedRequestDTO,
  ManufactureSyncRequestDTO,
} from "./manufacture.schema.js"

export class ManufactureRepository extends BaseRepository<DB, "manufactures"> {
  constructor() {
    super("manufactures")
  }

  SELECTED_COLUMNS = [
    "manufactures.id",
    "manufactures.name",
    "manufactures.type",
    "manufactures.reference_id",
    "manufactures.description",
    "manufactures.contact_name",
    "manufactures.phone_number",
    "manufactures.email",
    "manufactures.address",
    "manufactures.status",
    "manufactures.created_by",
    "manufactures.updated_by",
    "manufactures.deleted_by",
    "manufactures.created_at",
    "manufactures.updated_at",
    "manufactures.deleted_at",
  ] as const

  getStreamData(c: Context<DB>) {
    return c.var.trx
      .selectFrom("manufactures")
      .where("deleted_at", "is", null)
      .select(["id", "name"])
      .stream()
  }

  async getByMaterialId(c: Context<DB>, materialID: number) {
    const materialMap = await this.getByMaterialIdMapped(c, [materialID])
    return materialMap[materialID] ?? []
  }

  async getByMaterialIdMapped(c: Context<DB>, materialIDs: number[]) {
    const manufactures = await c.var.trx
      .selectFrom("manufactures as m")
      .innerJoin(
        "master_material_has_manufactures as mm",
        "mm.manufacture_id",
        "m.id"
      )
      .where("master_material_id", "in", materialIDs)
      .select(["m.id", "m.name", "mm.master_material_id"])
      .groupBy("m.id")
      .execute()

    return group(manufactures, "master_material_id")
  }

  async syncMaterialManufactures(
    c: Context<DB>,
    materialId: number,
    manufactureIds: number[]
  ) {
    await c.var.trx
      .deleteFrom("master_material_has_manufactures")
      .where("master_material_id", "=", materialId)
      .execute()

    try {
      for (const manufactureId of manufactureIds) {
        await c.var.trx
          .insertInto("master_material_has_manufactures")
          .values({
            master_material_id: materialId,
            manufacture_id: manufactureId,
          })
          .execute()
      }
    } catch (error) {
      throw new ValidationError("invalid manufactures")
    }
  }

  async upsert(c: Context<DB>, data: ManufactureSyncRequestDTO) {
    if (data.id) {
      return await c.var.trx
        .updateTable("manufactures")
        .set(data)
        .where("id", "=", data.id)
        .execute()
    }

    return await c.var.trx.insertInto("manufactures").values(data).execute()
  }

  async findAll(c: Context<DB>, params: ManufacturePaginatedRequestDTO) {
    let query = c.var.trx
      .selectFrom("manufactures")
      .innerJoin(
        "manufacture_types",
        "manufactures.type",
        "manufacture_types.id"
      )
      .where("manufactures.deleted_at", "is", null)
      .select(this.SELECTED_COLUMNS)

    query = this.#applyWhereClause(query, params)

    const queryAll = params?.isPaginate
      ? query.limit(params.paginate).offset(params.offset!).execute()
      : query.execute()

    const [manufactures, count] = await Promise.all([
      queryAll,
      query
        .select((fn) => fn.fn.countAll().as("total"))
        .executeTakeFirstOrThrow(),
    ])

    return {
      data: manufactures,
      total: Number(count?.total ?? 0),
    }
  }

  #applyWhereClause<T extends object>(
    q: SelectQueryBuilder<DB, "manufactures" | "manufacture_types", T>,
    params: ManufacturePaginatedRequestDTO
  ): SelectQueryBuilder<DB, "manufactures" | "manufacture_types", T> {
    if (params.keyword) {
      q = q.where("manufactures.name", "like", `%${params.keyword}%`)
    }
    if (params.type !== null && params.type !== undefined) {
      q = q.where("manufactures.type", "=", params.type)
    }

    return q
  }

  async findDynamicAll<T>(
    c: Context<DB>,
    whereClause: ReferenceExpression<DB, "manufactures">,
    operator: ComparisonOperatorExpression,
    value: T,
    isWhere: boolean = false
  ) {
    return await c.var.trx
      .selectFrom("manufactures")
      .$if(isWhere, (eb) => eb.where(whereClause, operator, value))
      .selectAll()
      .execute()
  }

  async findDynamic<T>(
    c: Context<DB>,
    whereClause: ReferenceExpression<DB, "manufactures">,
    operator: ComparisonOperatorExpression,
    value: T,
    isWhere: boolean = false
  ) {
    return await c.var.trx
      .selectFrom("manufactures")
      .$if(isWhere, (eb) => eb.where(whereClause, operator, value))
      .selectAll()
      .executeTakeFirst()
  }

  async findAndGroupByTypeID(c: Context<DB>, ids: number[]) {
    const types = await c.var.trx
      .selectFrom("manufacture_types")
      .where("id", "in", ids)
      .select(["id", "name"])
      .execute()

    return group(types, "id")
  }

  async findByTypeID(c: Context<DB>, id: number) {
    const type = await c.var.trx
      .selectFrom("manufacture_types")
      .where("id", "=", id)
      .select(["id", "name"])
      .executeTakeFirst()

    return type
  }
}
