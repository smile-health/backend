import {
  DEVICE_TYPE,
  USER_GENDER,
  USER_ROLE,
} from "@/common/constants/users.js"
import { Database } from "@/common/infrastructure/database/types/index.js"
import { CustomContext } from "@smile-health/lib/types/context.js"
import {
  associate,
  associateField,
  getLabelByKey,
  group,
} from "@smile-health/lib/utils.js"
import { Context } from "hono"
import { SelectQueryBuilder, sql } from "kysely"
import moment from "moment"
import { ChangePasswordRequest } from "../account/account.schema.js"
import { BaseRepository } from "../base.repository.js"
import {
  GetUserQueries,
  TCreateUserReq,
  TExistData,
  UpdateLastLoginRequest,
  UserChangeLogsRequest,
  UserChangeLogsResponse,
  UserResponse,
} from "./user.schema.js"
import { CustomContext } from "@smile-health/lib/types/context.js"

export class UserRepository extends BaseRepository<"users"> {
  constructor() {
    super("users", false)
  }

  userViewColumns(c: Context) {
    const { role } = c.var

    const cols = [
      "users.address",
      "users.application_version",
      "users.change_password",
      "users.created_at",
      "users.created_by",
      "users.date_of_birth",
      "users.deleted_at",
      "users.deleted_by",
      "users.email",
      "users.entity_id",
      "users.external_properties",
      "users.fcm_token",
      "users.firstname",
      "users.gender",
      "users.id",
      "users.imei_number",
      "users.iota_app_gui_theme",
      "users.keycloak_uuid",
      "users.last_device",
      "users.last_login",
      "users.last_mobile_access",
      "users.lastname",
      "users.manufacture_id",
      "users.mobile_phone",
      "users.mobile_phone_2",
      "users.mobile_phone_brand",
      "users.mobile_phone_model",
      "users.password",
      "users.permission",
      "users.role",
      "users.sim_id",
      "users.sim_provider",
      "users.status",
      "users.timezone_id",
      "users.token_login",
      "users.updated_at",
      "users.updated_by",
      "users.user_uuid",
      "users.username",
      "users.view_only",
      "users.village_id",
    ]
    if (role === USER_ROLE.SUPERADMIN) {
      cols.push("users.daily_recap_email")
    }

    return cols
  }

  async findAll(c: Context, queries: GetUserQueries) {
    const { client, trx } = c.var
    let query = trx
      .selectFrom("users")
      .leftJoin("integration_associations as a", (join) =>
        join.onRef("a.internal_id", "=", "users.id").on("a.type", "=", "user")
      )
      .$if(!!client, (qb) => qb.where("a.client_id", "=", client!.getId()))
      .select(["a.metadata", "a.client_id as integration_client_id"])

    const conditionWhereClause = await this.#conditionWhereClause(
      c,
      query,
      queries
    )
    query = conditionWhereClause.q

    const { sort_by, sort_type, isPaginate, paginate, offset } = queries

    const sortBy = sort_by || "updated_at"
    const sortType = sort_type || "desc"

    let orderByColumn: any = "users.updated_at"
    if (sortBy == "role_label") {
      query = query.leftJoin(
        "roles",
        "roles.id",
        "users.role"
      ) as SelectQueryBuilder<Database, "users" | "roles", {}>
      orderByColumn = "roles.name"
    } else if (sortBy == "entity_label") {
      orderByColumn = "entities.name"
    } else if (sortBy == "fullname") {
      orderByColumn = "users.firstname"
    } else {
      orderByColumn = `users.${sortBy}`
    }

    const cols = this.userViewColumns(c)

    let q = query
      .orderBy(orderByColumn, sortType as "asc" | "desc")
      .select(cols as Array<keyof Database["users"]>)
      .where("users.deleted_at", "is", null)

    if (isPaginate) {
      q = q.limit(paginate).offset(offset)
    }

    const queryAll = q.execute()

    const [users, count] = await Promise.all([
      queryAll,
      query
        .select((fn) => fn.fn.countAll().as("total"))
        .executeTakeFirstOrThrow(),
    ])

    return {
      users,
      total: Number(count?.total ?? 0),
    }
  }

  async bulkCreate(c: Context, data: Omit<TCreateUserReq, "workspace_ids">[]) {
    const result = await c.var.trx
      .insertInto("users")
      .values(data)
      .executeTakeFirst()
    return result
  }

  async findByUsername(c: Context, username: string) {
    return c.var.trx
      .selectFrom("users as u")
      .leftJoin("roles", "roles.id", "u.role")
      .where("username", "=", username)
      .where("u.deleted_at", "is", null)
      .selectAll("u")
      .select(["roles.id as role_id", "roles.name as role_label"])
      .executeTakeFirst()
  }

  async findById(c: Context, id: number | string): Promise<UserResponse> {
    const cols = this.userViewColumns(c)
    const { client, trx } = c.var

    const result = await trx
      .selectFrom("users")
      .leftJoin("roles", "roles.id", "users.role")
      .$if(typeof id === "string", (qb) =>
        qb.where("users.user_uuid", "=", id as string)
      )
      .$if(typeof id !== "string", (qb) =>
        qb.where("users.id", "=", id as number)
      )
      .leftJoin("integration_associations as a", (join) =>
        join.onRef("a.internal_id", "=", "users.id").on("a.type", "=", "user")
      )
      .$if(!!client, (qb) => qb.where("a.client_id", "=", client!.getId()))
      .select([
        ...cols,
        "roles.id as role_id",
        "roles.name as role_label",
        "a.metadata",
        "a.client_id as integration_client_id",
      ])
      .where("users.deleted_at", "is", null)
      .executeTakeFirst()

    const gender_label = getLabelByKey(USER_GENDER, result?.gender)

    const { metadata, ...restResult } = result ?? {}

    return {
      ...(restResult ?? {}),
      external_properties: metadata ?? result?.external_properties,
      integration_client_id: result?.integration_client_id,
      gender_label,
      external_roles: result?.external_roles ?? [], // Provide default empty array if missing
    } as UserResponse
  }

  async getMapProgramUserId(c: Context, id: number) {
    const rows = await c.var.trx
      .selectFrom("user_workspaces")
      .where("user_id", "=", id)
      .where("user_workspaces.deleted_at", "is", null)
      .selectAll()
      .execute()
    return associateField(rows, "workspace_id", "id")
  }

  async updateUserTokenLogin(c: Context, data: unknown, id: number) {
    return await c.var.trx
      .updateTable("users")
      .set(data!)
      .where("id", "=", id)
      .executeTakeFirst()
  }

  async updatePassword(c: Context, data: ChangePasswordRequest, id: number) {
    const result = await c.var.trx
      .updateTable("users")
      .set({ password: data?.new_password })
      .where("id", "=", id)
      .executeTakeFirstOrThrow()

    return result
  }

  async invalidateToken(c: Context, userID: number) {
    await c.var.trx
      .updateTable("users")
      .set({ token_login: null, fcm_token: null })
      .where("id", "=", userID)
      .executeTakeFirstOrThrow()
  }

  async dataExists(c: Context, data: TExistData<string>) {
    let query = c.var.trx
      .selectFrom("users as u")
      .leftJoin("roles", "roles.id", "u.role")
      .select([
        "u.id",
        "u.username",
        "u.firstname",
        "u.lastname",
        "u.email",
        "u.keycloak_uuid",
        "u.user_uuid",
        "roles.name as role_label",
      ])
      .where("u.deleted_at", "is", null)

    if (data.column == "id") {
      query = query.where("u.id", "=", Number(data.value.trim()))
    }
    if (data.column == "email") {
      query = query.where("u.email", "=", data.value)
    }
    if (data.column == "username") {
      query = query.where("u.username", "=", data.value)
    }

    const result = await query.executeTakeFirst()
    return result
  }

  async checkUsernameEmail(c: Context, username: string, email: string) {
    const query = c.var.trx
      .selectFrom("users as u")
      .leftJoin("roles", "roles.id", "u.role")
      .select([
        "u.id",
        "u.username",
        "u.firstname",
        "u.lastname",
        "u.email",
        "u.keycloak_uuid",
        "u.user_uuid",
        "roles.name as role_label",
      ])
      .where((eb) =>
        eb.or([eb("u.username", "=", username), eb("u.email", "=", email)])
      )

    const result = await query.executeTakeFirst()
    return result
  }

  async findByIDs(c: Context, ids: number[]) {
    const result = await c.var.trx
      .selectFrom("users")
      .where("id", "in", ids)
      .where("users.deleted_at", "is", null)
      .execute()
    return result
  }

  async createChangeLogs(c: Context, data: UserChangeLogsRequest) {
    const result = await c.var.trx
      .insertInto("user_changelogs")
      .values(data)
      .executeTakeFirst()
    return result
  }

  async findChangeLogs(c: Context, id: number) {
    const result = (await c.var.trx
      .selectFrom("user_changelogs")
      .where("user_changelogs.user_id", "=", id)
      .selectAll()
      .orderBy("created_at desc")
      .execute()) as UserChangeLogsResponse[]
    return result
  }

  async getByIDsMapped(c: Context, ids: number[]) {
    const users = await c.var.trx
      .selectFrom("users")
      .where("id", "in", ids)
      .where("users.deleted_at", "is", null)
      .select(["id", "username", "firstname", "lastname"])
      .execute()
    return group(users, "id")
  }

  async findStream(c: Context, queries: GetUserQueries) {
    let query = c.var.trx.selectFrom("users")
    const conditionWhereClause = await this.#conditionWhereClause(
      c,
      query,
      queries
    )
    query = conditionWhereClause.q
    return query.selectAll().where("users.deleted_at", "is", null).stream()
  }

  async updateUserLastAndFcmByUUID(
    c: Context,
    data: UpdateLastLoginRequest,
    id: string
  ) {
    return await c.var.trx
      .updateTable("users")
      .set({
        fcm_token: data.fcm_token,
        last_login: moment().format("YYYY-MM-DD HH:mm:ss"),
        last_device: DEVICE_TYPE[data.last_device!],
      })
      .where((eb) =>
        eb.or({
          "users.keycloak_uuid": id,
          "users.user_uuid": id,
        })
      )
      .executeTakeFirst()
  }

  async getBasicDetailMapped(c: Context, userIDs: number[]) {
    if (userIDs.length === 0) return {}
    const users = await c.var.trx
      .selectFrom("users")
      .select(["id", "username", "firstname", "lastname"])
      .where("id", "in", userIDs)
      .where("users.deleted_at", "is", null)
      .execute()

    for (const user of users) {
      const firstName = !user?.firstname ? "" : user?.firstname
      const lastName = !user?.lastname ? "" : user?.lastname
      const fullname = `${firstName} ${lastName}`.trim()
      user["fullname"] = fullname
    }

    return associate(users, "id")
  }

  async findInWorkspace(c: Context, id: number) {
    const records = await c.var.trx
      .selectFrom("user_workspaces")
      .innerJoin("users", "users.id", "user_workspaces.user_id")
      .where("users.id", "=", id)
      .where("users.deleted_at", "is", null)
      .where("user_workspaces.deleted_at", "is", null)
      .select([
        "user_workspaces.id as user_id",
        "user_workspaces.workspace_id as program_id",
      ])
      .execute()

    return records
  }

  // TODO: temporarily use ws_users for asset notif since notification list use ws_users
  async getUserByEntityId(c: CustomContext<Database>, entityId: number) {
    return c.var.trx
      .selectFrom("ws_users as u")
      .leftJoin("ws_entities as e", (join) =>
        join.onRef("e.id", "=", "u.entity_id")
      )
      .selectAll("u")
      .select([
        sql`NULL`.as("program_id"),
        "e.name as entity_name",
        "e.regency_id as entity_regency_id",
        "e.province_id as entity_province_id",
        "e.type as entity_type",
        "e.entity_tag_id as entity_tag_id",
      ])
      .where("u.deleted_by", "is", null)
      .where((eb) =>
        eb.or([
          eb("u.fcm_token", "is not", null),
          eb("u.mobile_phone", "is not", null),
        ])
      )
      .where("e.global_id", "=", entityId)
      .groupBy("u.global_id")
      .execute()
  }

  async getUserSuperAdmin(c: CustomContext<Database>) {
    return c.var.trx
      .selectFrom("ws_users as u")
      .leftJoin("ws_entities as e", (join) =>
        join.onRef("e.id", "=", "u.entity_id")
      )
      .selectAll("u")
      .select([
        sql`NULL`.as("program_id"),
        "e.name as entity_name",
        "e.regency_id as entity_regency_id",
        "e.province_id as entity_province_id",
        "e.type as entity_type",
        "e.entity_tag_id as entity_tag_id",
      ])
      .where("u.deleted_by", "is", null)
      .where((eb) =>
        eb.or([
          eb("u.fcm_token", "is not", null),
          eb("u.mobile_phone", "is not", null),
        ])
      )
      .where("u.role", "=", 1)
      .groupBy("u.global_id")
      .execute()
  }

  async getUserVendorByCustomerId(
    c: CustomContext<Database>,
    entityId: number
  ) {
    const customerVendor = await c.var.trx
      .selectFrom("customer_vendors as cv")
      .selectAll()
      .where("cv.customer_id", "=", entityId)
      .executeTakeFirst()

    if (!customerVendor) return []

    return await this.getUserByEntityId(c, customerVendor.id)
  }

  readonly #conditionWhereClause = async (
    c: Context,
    q: SelectQueryBuilder<Database, "users", object>,
    req: GetUserQueries
  ) => {
    if (req.keyword) {
      q = q.where((eb) =>
        eb.or([
          eb("users.username", "like", `%${req.keyword}%`),
          eb("users.firstname", "like", `%${req.keyword}%`),
          eb("users.lastname", "like", `%${req.keyword}%`),
        ])
      )
    }
    if (req.user_uuid) {
      q = q.where("users.user_uuid", "=", req.user_uuid)
    }
    if (req.role) {
      q = q.where("users.role", "=", req.role)
    }
    if (req.entity_id) {
      q = q.where("users.entity_id", "=", req.entity_id)
    }
    if (req.start_date) {
      q = q.where("users.last_login", ">=", req.start_date)
    }
    if (req.end_date) {
      q = q.where("users.last_login", "<=", req.end_date)
    }
    // Determine if we need to join the entities table
    const needJoinEntities =
      (req.province_id?.length ?? 0) > 0 ||
      (req.regency_id?.length ?? 0) > 0 ||
      req.sort_by === "entity_label"

    if (needJoinEntities) {
      q = q.leftJoin("entities", "entities.id", "users.entity_id")
    }

    if ((req.province_id?.length ?? 0) > 0) {
      q = (
        q as SelectQueryBuilder<Database, "users" | "entities", object>
      ).where("entities.province_id", "in", req.province_id ?? [])
    }

    if ((req.regency_id?.length ?? 0) > 0) {
      q = (
        q as SelectQueryBuilder<Database, "users" | "entities", object>
      ).where("entities.regency_id", "in", req.regency_id ?? [])
    }

    if (req.program_ids && req.program_ids.length > 0) {
      const userPrograms = await c.var.trx
        .selectFrom("user_workspaces")
        .where(
          "workspace_id",
          "in",
          req.program_ids.map((val) => Number(val))
        )
        .select("user_id")
        .execute()
      const userIds =
        userPrograms.length > 0
          ? [...new Set(userPrograms.map((val) => val.user_id))]
          : [-1]

      q = q.where("users.id", "in", userIds)
    }

    if (req.external_properties) {
      q = q.where("users.external_properties", "is not", null)
    }

    return {
      q,
    }
  }
}
