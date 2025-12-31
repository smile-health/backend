import { DB } from "@/common/infrastructure/database/types/db.js"
import { Context } from "@smile/lib/types/context.js"
import {
  GetAdditionalQueries,
  ResponseListAdditional,
  ResponseListAdditionalDTO,
} from "./reconciliation-additional.schema.js"

export class ReconciliationAdditionalRepository {
  #getId = (itemList: ResponseListAdditionalDTO) => {
    return (
      itemList.reconciliation_action_id ??
      itemList.reconciliation_reason_id ??
      itemList.id
    )
  }

  #mappingList = (
    c: Context<DB>,
    lists: ResponseListAdditionalDTO[],
    type: string
  ): ResponseListAdditional[] => {
    const translationMap = {
      action: "reconciliation.label.action.",
      reason: "reconciliation.label.reason.",
      category: "reconciliation.label.category.",
    }
    return lists.map((item) => ({
      ...item,
      id: this.#getId(item),
      title: c.var.t(`${translationMap[type]}${item.title}`),
    }))
  }
  async getListAction(
    c: Context<DB>,
    programId: number,
    param: GetAdditionalQueries
  ) {
    const { page, paginate, keyword } = param
    const offset = (page - 1) * paginate
    let query = c.var.trx
      .selectFrom("reconciliation_actions as ra")
      .leftJoin(
        "reconciliation_actions_workspaces as raw",
        "ra.id",
        "raw.reconciliation_action_id"
      )
      .where("ra.deleted_at", "is", null)
      .where("raw.deleted_at", "is", null)
      .where("raw.workspace_id", "=", programId)

    if (keyword) {
      query = query.where("ra.title", "like", `%${keyword}%`)
    }

    const [count, list] = await Promise.all([
      query.select((eb) => eb.fn.count("ra.id").as("total")).executeTakeFirst(),
      query
        .selectAll("ra")
        .select("raw.id as reconciliation_action_id")
        .orderBy("ra.id", "asc")
        .limit(paginate)
        .offset(offset)
        .execute(),
    ])

    return {
      count: count?.total ?? 0,
      list: this.#mappingList(c, list, "action"),
    }
  }

  async getLisReason(
    c: Context<DB>,
    programId: number,
    param: GetAdditionalQueries
  ) {
    const { page, paginate, keyword } = param
    const offset = (page - 1) * paginate
    let query = c.var.trx
      .selectFrom("reconciliation_reasons as rs")
      .leftJoin(
        "reconciliation_reasons_workspaces as rsw",
        "rs.id",
        "rsw.reconciliation_reason_id"
      )
      .where("rs.deleted_at", "is", null)
      .where("rsw.deleted_at", "is", null)
      .where("rsw.workspace_id", "=", programId)

    if (keyword) {
      query = query.where("rs.title", "like", `%${keyword}%`)
    }

    const [count, list] = await Promise.all([
      query.select((eb) => eb.fn.count("rs.id").as("total")).executeTakeFirst(),
      query
        .selectAll("rs")
        .select(["rsw.id as reconciliation_reason_id"])
        .orderBy("rs.id", "asc")
        .limit(paginate)
        .offset(offset)
        .execute(),
    ])

    return {
      count: count?.total ?? 0,
      list: this.#mappingList(c, list, "reason"),
    }
  }

  async getLisCategory(c: Context<DB>, param: GetAdditionalQueries) {
    const { page, paginate, keyword } = param
    const offset = (page - 1) * paginate
    let query = c.var.trx
      .selectFrom("reconciliation_categories as rc")
      .where("rc.deleted_at", "is", null)

    if (keyword) {
      query = query.where("rc.title", "like", `%${keyword}%`)
    }

    const [count, list] = await Promise.all([
      query.select((eb) => eb.fn.count("rc.id").as("total")).executeTakeFirst(),
      query
        .selectAll("rc")
        .orderBy("rc.id", "asc")
        .limit(paginate)
        .offset(offset)
        .execute(),
    ])

    return {
      count: count?.total ?? 0,
      list: this.#mappingList(c, list, "category"),
    }
  }
}
