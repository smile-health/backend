import { DB } from "@/common/infrastructure/database/types/db.js"
import { Context } from "@smile/lib/types/context.js"
import { associate, group } from "@smile/lib/utils.js"
import {
  ComparisonOperatorExpression,
  ReferenceExpression,
  SelectQueryBuilder,
} from "kysely"
import { GetUserQueries, SyncUserRequest, UserResponse } from "./user.schema.js"

type TableUser = keyof Pick<DB, "users">
export class UserRepository {
  async findUserByGlobalID(c: Context<DB>, globalID: number) {
    return c.var.trx
      .selectFrom("users")
      .selectAll()
      .where("global_id", "=", globalID)
      .executeTakeFirst()
  }

  async findEntityByGlobalID(c: Context<DB>, globalID: number) {
    return c.var.trx
      .selectFrom("entities")
      .selectAll()
      .where("global_id", "=", globalID)
      .executeTakeFirst()
  }

  async upsertUser(c: Context<DB>, data: SyncUserRequest) {
    if (data.user.id) {
      return await c.var.trx
        .updateTable("users")
        .set(data.user)
        .where("id", "=", data.user.id)
        .execute()
    }

    return await c.var.trx.insertInto("users").values(data.user).execute()
  }

  async getBasicDetailMapped(c: Context<DB>, userIDs: number[]) {
    if (userIDs.length === 0) return {}
    const users = await c.var.trx
      .selectFrom("users as u")
      .select(["id", "username", "firstname", "lastname"])
      .where("u.id", "in", userIDs)
      .execute()

    for (const user of users) {
      const firstName = !user?.firstname ? "" : user?.firstname
      const lastName = !user?.lastname ? "" : user?.lastname
      const fullname = `${firstName} ${lastName}`.trim()
      user["fullname"] = fullname
    }

    return associate(users, "id")
  }

  async findAll(
    c: Context,
    queries: GetUserQueries
  ): Promise<{ users: UserResponse[]; total: number }> {
    let query = c.var.trx.selectFrom("users")
    query = this.#conditionWhereClause(query, queries)

    const queryAll = queries.isPaginate
      ? query
          .limit(queries.paginate)
          .offset(queries.offset)
          .selectAll()
          .execute()
      : query.selectAll().execute()

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
    c: Context<DB>,
    whereClause: ReferenceExpression<DB, TableUser>,
    operator: ComparisonOperatorExpression,
    value: T,
    isWhere: boolean = false
  ) {
    return await c.var.trx
      .selectFrom("users")
      .$if(isWhere, (eb) => eb.where(whereClause, operator, value))
      .selectAll()
      .execute()
  }

  async getByIDsMapped(c: Context<DB>, ids: number[]) {
    const users = await c.var.trx
      .selectFrom("users")
      .where("id", "in", ids)
      .select(["id", "username", "firstname", "lastname"])
      .execute()
    return group(users, "id")
  }

  #conditionWhereClause(
    query: SelectQueryBuilder<DB, "users", object>,
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
    if (request.entity_id) {
      query = query.where("entity_id", "=", request.entity_id)
    }

    return query
  }
}
