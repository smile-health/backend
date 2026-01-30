import { DB } from "@/common/infrastructure/database/types/db.js"
import { BaseRepository } from "@smile-health/lib/base/repository.js"
import { associate, collect, group } from "@smile-health/lib/utils.js"
import { Context } from "hono"
import {
  ComparisonOperatorExpression,
  ReferenceExpression,
  SelectQueryBuilder,
  sql,
} from "kysely"
import {
  GetUserQueries,
  UserChangeLogsResponse,
  UserResponse,
} from "./user.schema.js"
import { CustomContext } from "@smile-health/lib/types/context.js"
import { ENTITY_TAG } from "@/common/constants/entity.js"

type TableUser = keyof Pick<DB, "ws_users">
export class UserRepository extends BaseRepository<DB, "ws_users"> {
  constructor() {
    super("ws_users", false)
  }

  async getBasicDetailMappedGeneric(
    c: Context,
    userIDs: number[],
    tableName: "ws_users" | "users"
  ) {
    if (userIDs.length === 0) return {}

    const users = await c.var.trx
      .selectFrom(`${tableName} as u`)
      .select(["id", "username", "firstname", "lastname"])
      .where("u.id", "in", userIDs)
      .execute()

    const mapped = users.map((user) => ({
      ...user,
      fullname: `${user.firstname ?? ""} ${user.lastname ?? ""}`.trim(),
    }))

    return associate(mapped, "id")
  }

  // Aliases for clarity
  async getBasicDetailMapped(c: Context, userIDs: number[]) {
    if (userIDs.length === 0) return {}

    // First, get users from ws_users table
    const wsUsersResult = await this.getBasicDetailMappedGeneric(
      c,
      userIDs,
      "ws_users"
    )

    // Find which userIDs are missing from ws_users result
    const missingUserIds = userIDs.filter((id) => !wsUsersResult[id])

    // If no users are missing, return the ws_users result
    if (missingUserIds.length === 0) {
      return wsUsersResult
    }

    // Get missing users from users table
    const usersResult = await this.getBasicDetailMappedGeneric(
      c,
      missingUserIds,
      "users"
    )

    // Merge the results
    return { ...wsUsersResult, ...usersResult }
  }

  async getBasicDetailMappedTableUser(c: Context, userIDs: number[]) {
    if (userIDs.length === 0) return {}
    return this.getBasicDetailMappedGeneric(c, userIDs, "users")
  }

  async findAll(
    c: Context,
    queries: GetUserQueries
  ): Promise<{ users: UserResponse[]; total: number }> {
    let query = c.var.trx
      .selectFrom("ws_users")
      .leftJoin("user_workspaces as uw", "uw.id", "ws_users.id")
      .where("uw.deleted_at", "is", null)
      .where("ws_users.program_id", "=", c.var.programId)
    query = this.#conditionWhereClause(query, queries)

    const queryAll = queries.isPaginate
      ? query
          .limit(queries.paginate)
          .offset(queries.offset)
          .selectAll("ws_users")
          .execute()
      : query.selectAll("ws_users").execute()

    const [users, count] = await Promise.all([
      queryAll,
      query
        .select((fn) => fn.fn.countAll().as("total"))
        .executeTakeFirstOrThrow(),
    ])

    return {
      users,
      total: Number(count.total ?? 0),
    }
  }

  async findDynamic<T>(
    c: Context,
    whereClause: ReferenceExpression<DB, TableUser>,
    operator: ComparisonOperatorExpression,
    value: T,
    isWhere: boolean = false
  ) {
    return await c.var.trx
      .selectFrom("ws_users")
      .innerJoin("user_workspaces as uw", "uw.id", "ws_users.id")
      .where("uw.deleted_at", "is", null)
      .$if(isWhere, (eb) => eb.where(whereClause, operator, value))
      .selectAll("ws_users")
      .execute()
  }

  async getByIDsMapped(c: Context, ids: number[]) {
    const users = await c.var.trx
      .selectFrom("users")
      .where("id", "in", ids)
      .select(["id", "username", "firstname", "lastname"])
      .execute()
    return group(users, "id")
  }

  async getIdsByWorkspace(c: Context) {
    const workspaceId = c.get("programId")
    const userByWorkspaces = await c.var.trx
      .selectFrom("user_workspaces")
      .selectAll()
      .where("workspace_id", "=", workspaceId)
      .execute()

    return collect(userByWorkspaces, "user_id")
  }

  async getGlobalUserByKeycloakId(c: Context, keycloakId: string) {
    return await c.var.trx
      .selectFrom("users as u")
      .where("u.keycloak_uuid", "=", keycloakId)
      .select(["id", "username", "firstname", "lastname"])
      .executeTakeFirst()
  }

  async getUserWithWorkspaceByKeycloakId(c: Context, keycloakId: string) {
    const result = await c.var.trx
      .selectFrom("ws_users as u")
      .innerJoin("workspaces as w", "w.id", "u.program_id")
      .leftJoin("user_workspaces as uw", "uw.id", "u.id")
      .selectAll("u")
      .select([
        "w.id as program_id",
        "w.name as program_name",
        "w.key as program_key",
        "w.config as program_config",
        "w.program_uuid",
      ])
      .where("u.keycloak_uuid", "=", keycloakId)
      .where("uw.deleted_at", "is", null)
      .execute()

    return result
  }

  async findChangeLogs(c: Context, id: number) {
    const result = (await c.var.trx
      .selectFrom("user_changelogs as uc")
      .innerJoin("ws_users as we", "we.global_id", "uc.user_id")
      .where("we.id", "=", id)
      .selectAll("uc")
      .orderBy("uc.created_at desc")
      .execute()) as UserChangeLogsResponse[]
    return result
  }

  #conditionWhereClause(
    query: SelectQueryBuilder<DB, "ws_users", object>,
    request: GetUserQueries
  ) {
    if (request.keyword) {
      query = query.where((eb) =>
        eb.or([
          eb("username", "like", `%${request.keyword}%`),
          eb("firstname", "like", `%${request.keyword}%`),
          eb("lastname", "like", `%${request.keyword}%`),
        ])
      )
    }
    if (request.role) {
      query = query.where("role", "=", request.role)
    }
    if (request.entity_id) {
      query = query.where("ws_users.entity_id", "=", request.entity_id)
    }
    if (request.status != null || request.status != undefined) {
      query = query.where("ws_users.status", "=", request.status)
    }
    if (request.start_date) {
      query = query.where("ws_users.last_login", ">=", request.start_date)
    }
    if (request.end_date) {
      query = query.where("ws_users.last_login", "<=", request.end_date)
    }
    if (request.province_id || request.regency_id) {
      query = query
        .innerJoin("ws_entities as e", "e.id", "ws_users.entity_id")
        .$if(request.province_id != null, (q) =>
          q.where("e.province_id", "=", `${request.province_id}`)
        )
        .$if(request.regency_id != null, (q) =>
          q.where("e.regency_id", "=", `${request.regency_id}`)
        )
    }

    return query
  }

  async getUserByEntityId(c: CustomContext<DB>, entityId: number) {
    return c.var.trx
      .selectFrom("ws_users as wu")
      .leftJoin("user_workspaces as uw", (join) =>
        join.onRef("uw.id", "=", "wu.id")
      )
      .leftJoin("ws_entities as we", (join) =>
        join.onRef("we.id", "=", "wu.entity_id")
      )
      .leftJoin("workspaces as w", (join) =>
        join.onRef("w.id", "=", "we.program_id")
      )
      .selectAll("wu")
      .select([
        "we.name as entity_name",
        "we.regency_id as entity_regency_id",
        "we.province_id as entity_province_id",
        "we.type as entity_type",
        "w.config as program_config",
        "we.entity_tag_id as entity_tag_id",
      ])
      .where("wu.deleted_by", "is", null)
      .where("uw.deleted_at", "is", null)
      .where((eb) =>
        eb.or([
          eb("wu.fcm_token", "is not", null),
          eb("wu.mobile_phone", "is not", null),
        ])
      )
      .where("wu.entity_id", "=", entityId)
      .execute()
  }

  async getUserVendorByCustomerId(c: CustomContext<DB>, entityId: number) {
    const entity = await c.var.trx
      .selectFrom("ws_entities")
      .select(["type"])
      .where("id", "=", entityId)
      .executeTakeFirst()
    const tagsCustomerToVendor = {
      3: ENTITY_TAG.CITY_DISTRICT_HEALTH_OFFICE,
      2: ENTITY_TAG.PROVINCE_HEALTH_OFFICE,
      1: ENTITY_TAG.MINISTRY_OF_HEALTH,
    }
    const tagVendor = entity ? tagsCustomerToVendor[entity.type] : 0
    return c.var.trx
      .selectFrom("ws_users as wu")
      .leftJoin("user_workspaces as uw", (join) =>
        join.onRef("uw.id", "=", "wu.id")
      )
      .leftJoin("ws_customer_vendors as wcv", (join) =>
        join.onRef("wcv.vendor_id", "=", "wu.entity_id")
      )
      .leftJoin("ws_entities as we", (join) =>
        join.onRef("we.id", "=", "wu.entity_id")
      )
      .selectAll("wu")
      .select([
        "we.name as entity_name",
        "we.regency_id as entity_regency_id",
        "we.province_id as entity_province_id",
        "we.entity_tag_id as entity_tag_id",
        sql`1`.as("is_vendor"),
      ])
      .where("wu.deleted_by", "is", null)
      .where("uw.deleted_at", "is", null)
      .where("wcv.customer_id", "=", entityId)
      .where("we.entity_tag_id", "=", tagVendor)
      .where((eb) =>
        eb.or([
          eb("wu.fcm_token", "is not", null),
          eb("wu.mobile_phone", "is not", null),
        ])
      )
      .execute()
  }

  async updateStatus(c: Context, userId: number, status: number) {
    return await c.var.trx
      .updateTable("user_workspaces")
      .set({
        status: status,
      })
      .where("id", "=", userId)
      .executeTakeFirst()
  }
}
