import { SORT_TYPE } from "@/common/constants/general.js"
import { associate } from "@smile-health/lib/utils.js"
import { Context } from "hono"
import { sql } from "kysely"
import { BaseRepository } from "../base.repository.js"
import {
  ManufactureDetailRequestDTO,
  ManufacturePaginatedRequestDTO,
} from "./manufacture.schema.js"

export class ManufactureRepository extends BaseRepository<"manufactures"> {
  constructor() {
    super("manufactures")
  }

  SELECTED_COLUMNS = [
    "manufactures.id",
    "manufactures.name",
    "manufactures.type",
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
    "manufacture_types.name as type_name",
    "users.firstname",
    "users.lastname",
  ] as const

  async findAll(c: Context, params: ManufacturePaginatedRequestDTO) {
    let query = c.var.trx
      .selectFrom("manufactures")
      .innerJoin(
        "manufacture_types",
        "manufactures.type",
        "manufacture_types.id"
      )
      .leftJoin(
        "manufacture_workspaces",
        "manufactures.id",
        "manufacture_workspaces.manufacture_id"
      )
      .innerJoin("users", "manufactures.updated_by", "users.id")
      .where("manufactures.deleted_at", "is", null)
      .distinct()
      .select(this.SELECTED_COLUMNS)

    if (params.keyword) {
      query = query.where("manufactures.name", "like", `%${params.keyword}%`)
    }
    if (params.type !== null && params.type !== undefined) {
      query = query.where("manufactures.type", "=", params.type)
    }
    if (params.status !== null && params.status !== undefined) {
      query = query.where("manufactures.status", "=", params.status)
    }

    const programIds = params.program_ids ?? []
    if (programIds.length) {
      query = query.where((eb) => {
        const hasZero = programIds.includes(0)
        const onlyZero = hasZero && programIds.length === 1
        const filteredIds = programIds.filter((id) => id !== 0)

        if (onlyZero) {
          return eb("manufacture_workspaces.workspace_id", "is", null)
        }

        if (hasZero) {
          return eb.or([
            eb("manufacture_workspaces.workspace_id", "is", null),
            eb("manufacture_workspaces.workspace_id", "in", filteredIds),
          ])
        }

        return eb("manufacture_workspaces.workspace_id", "in", programIds)
      })
    }

    switch (params.sort_by) {
      case "name":
        query = query.orderBy("manufactures.name", params.sort_type)
        break
      case "type":
        query = query.orderBy("type_name", params.sort_type)
        break
      case "status":
        query = query.orderBy(
          sql`CASE WHEN manufactures.status = 1 THEN 'active' ELSE 'inactive' END`,
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
        query = query.orderBy("manufactures.id", SORT_TYPE.DESC)
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
          sql<number>`count(distinct ${sql.ref("manufactures.id")})`.as("total")
        )
        .executeTakeFirstOrThrow(),
    ])

    return {
      data: manufactures,
      total: Number(count?.total ?? 0),
    }
  }

  async findById(c: Context, param: ManufactureDetailRequestDTO) {
    const filteredColumns = this.SELECTED_COLUMNS.filter(
      (column) => column !== "users.firstname" && column !== "users.lastname"
    )

    const result = await c.var.trx
      .selectFrom("manufactures")
      .innerJoin(
        "manufacture_types",
        "manufactures.type",
        "manufacture_types.id"
      )
      .where("manufactures.id", "=", param.id)
      .select(filteredColumns)
      .executeTakeFirst()

    return result
  }

  async findAllTypes(c: Context) {
    const result = await c.var.trx
      .selectFrom("manufacture_types")
      .select(["id", "name"])
      .where("deleted_at", "is", null)
      .execute()

    return result
  }

  async findAllTypesStream(c: Context) {
    const result = c.var.trx
      .selectFrom("manufacture_types")
      .select(["id", "name"])
      .where("deleted_at", "is", null)
      .stream()

    return result
  }

  async findByTypeID(c: Context, id: number) {
    const type = await c.var.trx
      .selectFrom("manufacture_types")
      .where("id", "=", id)
      .select(["id", "name"])
      .executeTakeFirst()

    return type
  }

  async findAndGroupByTypeID(c: Context, ids: number[]) {
    const types = await c.var.trx
      .selectFrom("manufacture_types")
      .where("id", "in", ids)
      .select(["id", "name"])
      .execute()

    return associate(types, "id")
  }

  async findInWorkspace(c: Context, id: number) {
    const records = await c.var.trx
      .selectFrom("manufacture_workspaces")
      .innerJoin(
        "manufactures",
        "manufactures.id",
        "manufacture_workspaces.manufacture_id"
      )
      .where("manufacture_id", "=", id)
      .select([
        "manufacture_workspaces.id as manufacture_id",
        "manufacture_workspaces.workspace_id as program_id",
      ])
      .selectAll("manufactures")
      .execute()

    return records
  }

  // Used by user module
  getStreamData(c: Context) {
    return c.var.trx
      .selectFrom("manufactures")
      .where("deleted_at", "is", null)
      .select(["id", "name"])
      .stream()
  }
}
