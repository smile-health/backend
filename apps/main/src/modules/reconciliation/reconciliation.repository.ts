import { ORDER_STATUS, ORDER_TYPE } from "@/common/constants/order.js"
import { TRANSACTION_TYPE } from "@/common/constants/transaction.js"
import {
  DB,
  WsEntities,
  WsMaterials,
  WsReconciliations,
} from "@/common/infrastructure/database/types/db.js"
import { CustomContext } from "@smile/lib/types/context.js"
import { Context } from "hono"
import { Nullable, SelectQueryBuilder, sql } from "kysely"
import moment from "moment-timezone"
import { BaseRepository } from "../base.repository.js"
import {
  CreateReconciliationDTO,
  GetGenerateReconciliationDTO,
  GetListReconciliationQueries,
} from "./reconciliation.schema.js"

export class ReconciliationRepository extends BaseRepository<"ws_reconciliations"> {
  constructor() {
    super("ws_reconciliations")
  }

  #conditionReconciliationWhereClause(
    query: SelectQueryBuilder<
      DB & { wsr: WsReconciliations } & { wsm: WsMaterials } & {
        wse: Nullable<WsEntities>
      },
      "wsr" | "wsm" | "wse",
      object
    >,
    params: GetListReconciliationQueries
  ) {
    const {
      material_id,
      parent_material_id,
      material_type_id,
      activity_id,
      start_date,
      end_date,
      entity_tag_id,
      entity_id,
      province_id,
      regency_id,
      created_from,
      created_to,
    } = params

    if (activity_id) {
      query = query.where("wsr.activity_id", "=", activity_id)
    }

    if (material_id) {
      query = query.where("wsm.id", "=", material_id)
    }

    if (parent_material_id) {
      query = query.where("wsm.parent_id", "=", parent_material_id)
    }

    if (material_type_id) {
      query = query.where("wsm.material_type_id", "=", material_type_id)
    }

    if (start_date) {
      query = query.where(
        "wsr.start_date",
        ">=",
        sql<Date>`${moment(start_date).format("YYYY-MM-DD 00:00:00")}`
      )
    }

    if (end_date) {
      query = query.where(
        "wsr.end_date",
        "<=",
        sql<Date>`${moment(end_date).format("YYYY-MM-DD 23:59:59")}`
      )
    }

    if (created_from) {
      query = query.where(
        "wsr.created_at",
        ">=",
        sql<Date>`${moment(created_from).format("YYYY-MM-DD 00:00:00")}`
      )
    }

    if (created_to) {
      query = query.where(
        "wsr.created_at",
        "<=",
        sql<Date>`${moment(created_to).format("YYYY-MM-DD 23:59:59")}`
      )
    }

    if (entity_id) {
      query = query.where("wsr.entity_id", "=", entity_id)
    }

    if (entity_tag_id) {
      query = query.where("wse.entity_tag_id", "=", entity_tag_id)
    }

    if (province_id) {
      query = query.where("wse.province_id", "=", String(province_id))
    }

    if (regency_id) {
      query = query.where("wse.regency_id", "=", String(regency_id))
    }

    return query
  }

  async findReconciliationCategoryById(c: Context, id: number) {
    const trx = c.var.trx

    const [category] = await trx
      .selectFrom("reconciliation_categories")
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .select(["id"])
      .limit(1)
      .execute()

    return category
  }

  async findReasonById(c: Context, id: number) {
    const trx = c.var.trx

    const [reason] = await trx
      .selectFrom("reconciliation_reasons_workspaces")
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .where("workspace_id", "=", c.var.programId)
      .select(["id"])
      .limit(1)
      .execute()

    return reason
  }

  async findActionById(c: Context, id: number) {
    const trx = c.var.trx

    const [action] = await trx
      .selectFrom("reconciliation_actions_workspaces")
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .where("workspace_id", "=", c.var.programId)
      .select(["id"])
      .limit(1)
      .execute()

    return action
  }

  async createReconciliation(c: Context, data: CreateReconciliationDTO) {
    const trx = c.var.trx

    const [reconciliation] = await trx
      .insertInto("ws_reconciliations")
      .values({
        program_id: c.var.programId,
        material_id: data.material_id,
        entity_id: data.entity_id,
        activity_id: data.activity_id,
        start_date: new Date(data.start_date),
        end_date: new Date(data.end_date),
        created_by: c.var.userId,
        updated_by: c.var.userId,
      })
      .execute()

    if (
      !reconciliation ||
      typeof Number(reconciliation.insertId) !== "number"
    ) {
      throw new Error("Failed to create reconciliation record")
    }

    for (const item of data.items) {
      const [reconciliationItem] = await trx
        .insertInto("ws_reconciliation_items")
        .values({
          reconciliation_id: Number(reconciliation.insertId),
          reconciliation_category_id: item.reconciliation_category,
          recorded_qty: item.recorded_qty,
          actual_qty: item.actual_qty,
          created_by: c.var.userId,
        })
        .execute()

      if (
        !reconciliationItem ||
        typeof Number(reconciliationItem.insertId) !== "number"
      ) {
        throw new Error("Failed to create reconciliation item record")
      }

      if (item.reasons?.length && item.actions?.length) {
        const reasonActionValues: Array<{
          reconciliation_item_id: number
          reason_id: number
          action_id: number
        }> = []

        // Match reasons and actions by their index position
        // Take the minimum length to avoid out-of-bounds errors
        const minLength = Math.min(item.reasons.length, item.actions.length)

        for (let i = 0; i < minLength; i++) {
          reasonActionValues.push({
            reconciliation_item_id: Number(reconciliationItem.insertId),
            reason_id: Number(item.reasons?.[i]?.id ?? 0),
            action_id: Number(item.actions?.[i]?.id ?? 0),
          })
        }

        if (reasonActionValues.length > 0) {
          await trx
            .insertInto("ws_reconciliation_item_reason_actions")
            .values(reasonActionValues)
            .execute()
        }
      }
    }

    return
  }

  async getGenerateReconciliation(
    c: Context,
    params: GetGenerateReconciliationDTO
  ) {
    const { start_date, end_date, material_id, entity_id, activity_id } = params
    const trx = c.var.trx
    const timezone = c.req.header("timezone") || "UTC"

    const startMoment = moment.tz(start_date, timezone).startOf("day")
    const endMoment = moment.tz(end_date, timezone).endOf("day")
    const tzOffsetMinutes = startMoment.utcOffset()
    const startDateWithTz = moment(startMoment)
      .subtract(tzOffsetMinutes, "minutes")
      .format("YYYY-MM-DD HH:mm:ss")
    const endDateWithTz = moment(endMoment)
      .subtract(tzOffsetMinutes, "minutes")
      .format("YYYY-MM-DD HH:mm:ss")

    // Query 1: Penerimaan
    const receiptsQuery = trx
      .selectFrom("ws_transactions as t")
      .innerJoin("ws_orders as o", "o.id", "t.order_id")
      .innerJoin("ws_stocks as s", "s.id", "t.stock_id")
      .where("t.transaction_type_id", "=", TRANSACTION_TYPE.RECEIPTS)
      .where("o.order_type_id", "in", [
        ORDER_TYPE.REQUEST,
        ORDER_TYPE.DISTRIBUTION,
        ORDER_TYPE.CENTRAL_DISTRIBUTION,
      ])
      .where("o.order_status_id", "=", ORDER_STATUS.FULFILLED)
      .where("t.entity_id", "=", entity_id as number)
      .where("s.material_id", "=", material_id as number)
      .where("t.activity_id", "=", activity_id as number)
      .where("t.created_at", ">=", sql<Date>`${startDateWithTz}`)
      .where("t.created_at", "<=", sql<Date>`${endDateWithTz}`)
      .select([
        sql<string>`1`.as("reconciliation_category"),
        sql<string>`${c.var.t("reconciliation.label.category.received")}`.as(
          "reconciliation_category_label"
        ),
        sql<number>`COALESCE(ABS(sum(t.change_qty)), 0)`.as("recorded_qty"),
      ])

    // Query 2: Pengembalian Distribusi
    const returnDistributionQuery = trx
      .selectFrom("ws_transactions as t")
      .innerJoin("ws_orders as o", "o.id", "t.order_id")
      .innerJoin("ws_stocks as s", "s.id", "t.stock_id")
      .where("t.transaction_type_id", "=", TRANSACTION_TYPE.ISSUES)
      .where("o.order_type_id", "in", [ORDER_TYPE.RETURN])
      .where("o.order_status_id", "in", [
        ORDER_STATUS.SHIPPED,
        ORDER_STATUS.FULFILLED,
      ])
      .where("t.entity_id", "=", entity_id as number)
      .where("s.material_id", "=", material_id as number)
      .where("t.activity_id", "=", activity_id as number)
      .where("t.created_at", ">=", sql<Date>`${startDateWithTz}`)
      .where("t.created_at", "<=", sql<Date>`${endDateWithTz}`)
      .select([
        sql<string>`2`.as("reconciliation_category"),
        sql<string>`${c.var.t("reconciliation.label.category.return")}`.as(
          "reconciliation_category_label"
        ),
        sql<number>`COALESCE(ABS(sum(t.change_qty)), 0)`.as("recorded_qty"),
      ])

    // Query 3: Distribusi
    const distributionQuery = trx
      .selectFrom("ws_transactions as t")
      .innerJoin("ws_orders as o", "o.id", "t.order_id")
      .innerJoin("ws_stocks as s", "s.id", "t.stock_id")
      .where("t.transaction_type_id", "=", TRANSACTION_TYPE.ISSUES)
      .where("o.order_type_id", "in", [
        ORDER_TYPE.REQUEST,
        ORDER_TYPE.DISTRIBUTION,
        ORDER_TYPE.CENTRAL_DISTRIBUTION,
      ])
      .where("o.order_status_id", "in", [
        ORDER_STATUS.SHIPPED,
        ORDER_STATUS.FULFILLED,
      ])
      .where("t.entity_id", "=", entity_id as number)
      .where("s.material_id", "=", material_id as number)
      .where("t.activity_id", "=", activity_id as number)
      .where("t.created_at", ">=", sql<Date>`${startDateWithTz}`)
      .where("t.created_at", "<=", sql<Date>`${endDateWithTz}`)
      .select([
        sql<string>`3`.as("reconciliation_category"),
        sql<string>`${c.var.t("reconciliation.label.category.distribution")}`.as(
          "reconciliation_category_label"
        ),
        sql<number>`COALESCE(ABS(sum(t.change_qty)), 0)`.as("recorded_qty"),
      ])

    // Query 4: Penerimaan Pengembalian
    const receiptReturnQuery = trx
      .selectFrom("ws_transactions as t")
      .innerJoin("ws_orders as o", "o.id", "t.order_id")
      .innerJoin("ws_stocks as s", "s.id", "t.stock_id")
      .where("t.transaction_type_id", "=", TRANSACTION_TYPE.RECEIPTS)
      .where("o.order_type_id", "in", [ORDER_TYPE.RETURN])
      .where("o.order_status_id", "=", ORDER_STATUS.FULFILLED)
      .where("t.entity_id", "=", entity_id as number)
      .where("s.material_id", "=", material_id as number)
      .where("t.activity_id", "=", activity_id as number)
      .where("t.created_at", ">=", sql<Date>`${startDateWithTz}`)
      .where("t.created_at", "<=", sql<Date>`${endDateWithTz}`)
      .select([
        sql<string>`4`.as("reconciliation_category"),
        sql<string>`${c.var.t("reconciliation.label.category.received_return")}`.as(
          "reconciliation_category_label"
        ),
        sql<number>`COALESCE(ABS(sum(t.change_qty)), 0)`.as("recorded_qty"),
      ])

    // Query 5: Konsumsi dikurangi pengembalian faskes
    const consumptionQuery = trx
      .selectFrom("ws_transactions as t")
      .innerJoin("ws_stocks as s", "s.id", "t.stock_id")
      .where("t.transaction_type_id", "in", [
        TRANSACTION_TYPE.CONSUMPTION,
        TRANSACTION_TYPE.RETURN,
      ])
      .where("t.entity_id", "=", entity_id as number)
      .where("s.material_id", "=", material_id as number)
      .where("t.activity_id", "=", activity_id as number)
      .where("t.created_at", ">=", sql<Date>`${startDateWithTz}`)
      .where("t.created_at", "<=", sql<Date>`${endDateWithTz}`)
      .select([
        sql<string>`5`.as("reconciliation_category"),
        sql<string>`${c.var.t("reconciliation.label.category.consumed")}`.as(
          "reconciliation_category_label"
        ),
        sql<number>`COALESCE(ABS(sum(t.change_qty)), 0)`.as("recorded_qty"),
      ])

    // Query 6: Pembuangan
    const discardQuery = trx
      .selectFrom("ws_transactions as t")
      .innerJoin("ws_stocks as s", "s.id", "t.stock_id")
      .where("t.transaction_type_id", "in", [TRANSACTION_TYPE.DISCARDS])
      .where("t.entity_id", "=", entity_id as number)
      .where("s.material_id", "=", material_id as number)
      .where("t.activity_id", "=", activity_id as number)
      .where("t.created_at", ">=", sql<Date>`${startDateWithTz}`)
      .where("t.created_at", "<=", sql<Date>`${endDateWithTz}`)
      .select([
        sql<string>`6`.as("reconciliation_category"),
        sql<string>`${c.var.t("reconciliation.label.category.defect")}`.as(
          "reconciliation_category_label"
        ),
        sql<number>`COALESCE(ABS(sum(t.change_qty)), 0)`.as("recorded_qty"),
      ])

    // Query 7: Sisa Stock
    const stockQuery = trx
      .selectFrom("ws_stocks")
      .where("entity_id", "=", entity_id as number)
      .where("material_id", "=", material_id as number)
      .where("activity_id", "=", activity_id as number)
      .select([
        sql<string>`7`.as("reconciliation_category"),
        sql<string>`${c.var.t("reconciliation.label.category.remaining")}`.as(
          "reconciliation_category_label"
        ),
        sql<number>`COALESCE(ABS(sum(qty)), 0)`.as("recorded_qty"),
      ])

    // Combine all queries with UNION
    const unionQuery = receiptsQuery
      .union(returnDistributionQuery)
      .union(distributionQuery)
      .union(receiptReturnQuery)
      .union(consumptionQuery)
      .union(discardQuery)
      .union(stockQuery)

    const result = await unionQuery.execute()

    return { data: result }
  }

  async getListReconciliation(
    c: Context,
    param: GetListReconciliationQueries,
    programId: number
  ) {
    const { page, paginate } = param
    const offset = (page - 1) * paginate
    const query = c.var.trx
      .selectFrom("ws_reconciliations as wsr")
      .innerJoin("ws_materials as wsm", (join) =>
        join.onRef("wsm.id", "=", "wsr.material_id")
      )
      .leftJoin("ws_entities as wse", (join) =>
        join.onRef("wse.id", "=", "wsr.entity_id")
      )

    const filteredQuery = this.#conditionReconciliationWhereClause(query, param)
      .leftJoin("ws_activities as wsa", (join) =>
        join.onRef("wsa.id", "=", "wsr.activity_id")
      )
      .leftJoin("ws_materials as wsm_parent", (join) =>
        join.onRef("wsm_parent.id", "=", "wsm.parent_id")
      )
      .leftJoin("locations as prov", "prov.id", "wse.province_id")
      .leftJoin("locations as reg", "reg.id", "wse.regency_id")
      .leftJoin("ws_users as wsu_created", "wsu_created.id", "wsr.created_by")
      .leftJoin("ws_users as wsu_updated", "wsu_updated.id", "wsr.updated_by")
      .where("wsr.program_id", "=", programId)
      .where("wsr.deleted_at", "is", null)

    const [count, list] = await Promise.all([
      filteredQuery
        .select((eb) => eb.fn.count("wsr.id").as("total"))
        .executeTakeFirst(),
      filteredQuery
        .select([
          "wsr.id as reconciliation_id",
          "wsr.start_date",
          "wsr.end_date",
          "wsr.created_by",
          "wsr.updated_by",
          "wsr.created_at",
          "wsr.updated_at",
          "wsm.id as material_id",
          "wsm.name as material_name",
          "wsm.code as material_code",
          "wsm_parent.id as material_parent_id",
          "wsm_parent.name as material_parent_name",
          "wsm_parent.code as material_parent_code",
          "wse.id as entity_id",
          "wse.name as entity_name",
          "prov.id as province_id",
          "prov.name as province_name",
          "reg.id as regency_id",
          "reg.name as regency_name",
          "wsa.id as activity_id",
          "wsa.name as activity_name",
          "wsu_created.id as user_id_created",
          "wsu_created.username as username_created",
          "wsu_created.email as email_created",
          "wsu_created.firstname as firstname_created",
          "wsu_created.lastname as lastname_created",
          "wsu_updated.id as user_id_updated",
          "wsu_updated.username as username_updated",
          "wsu_updated.email as email_updated",
          "wsu_updated.firstname as firstname_updated",
          "wsu_updated.lastname as lastname_updated",
        ])
        .orderBy("wsr.updated_at", "desc")
        .limit(paginate)
        .offset(offset)
        .execute(),
    ])

    return {
      total: count?.total ?? 0,
      list,
    }
  }

  async getListReconciliationItems(c: Context, reconciliationIds: number[]) {
    return c.var.trx
      .selectFrom("ws_reconciliation_items as wsri")
      .innerJoin("reconciliation_categories as rc", (join) =>
        join
          .onRef("rc.id", "=", "wsri.reconciliation_category_id")
          .on("rc.deleted_at", "is", null)
      )
      .where("wsri.deleted_at", "is", null)
      .where("wsri.reconciliation_id", "in", reconciliationIds)
      .select([
        "wsri.id",
        "wsri.reconciliation_id",
        "wsri.actual_qty",
        "wsri.recorded_qty",
        "rc.id as reconciliation_category",
        "rc.title as reconciliation_category_label",
      ])
      .execute()
  }

  async getDetailReconciliation(c: Context, id: number, programId: number) {
    return c.var.trx
      .selectFrom("ws_reconciliations as wsr")
      .innerJoin("ws_materials as wsm", "wsm.id", "wsr.material_id")
      .leftJoin("ws_entities as wse", "wse.id", "wsr.entity_id")
      .leftJoin("ws_activities as wsa", "wsa.id", "wsr.activity_id")
      .leftJoin("ws_materials as wsm_parent", "wsm_parent.id", "wsm.parent_id")
      .leftJoin("locations as prov", "prov.id", "wse.province_id")
      .leftJoin("locations as reg", "reg.id", "wse.regency_id")
      .leftJoin("ws_users as wsu_created", "wsu_created.id", "wsr.created_by")
      .leftJoin("ws_users as wsu_updated", "wsu_updated.id", "wsr.updated_by")
      .where("wsr.deleted_at", "is", null)
      .where("wsr.id", "=", id)
      .where("wsr.program_id", "=", programId)
      .select([
        "wsr.id as reconciliation_id",
        "wsr.start_date",
        "wsr.end_date",
        "wsr.created_by",
        "wsr.updated_by",
        "wsr.created_at",
        "wsr.updated_at",
        "wsm.id as material_id",
        "wsm.name as material_name",
        "wsm.code as material_code",
        "wsm_parent.id as material_parent_id",
        "wsm_parent.name as material_parent_name",
        "wsm_parent.code as material_parent_code",
        "wse.id as entity_id",
        "wse.name as entity_name",
        "prov.id as province_id",
        "prov.name as province_name",
        "reg.id as regency_id",
        "reg.name as regency_name",
        "wsa.id as activity_id",
        "wsa.name as activity_name",
        "wsu_created.id as user_id_created",
        "wsu_created.username as username_created",
        "wsu_created.email as email_created",
        "wsu_created.firstname as firstname_created",
        "wsu_created.lastname as lastname_created",
        "wsu_updated.id as user_id_updated",
        "wsu_updated.username as username_updated",
        "wsu_updated.email as email_updated",
        "wsu_updated.firstname as firstname_updated",
        "wsu_updated.lastname as lastname_updated",
      ])
      .executeTakeFirst()
  }

  async getListReconciliationItemReasonAction(
    c: Context,
    reconciliationItemIds: number[]
  ) {
    return c.var.trx
      .selectFrom("ws_reconciliation_item_reason_actions as wsrira")
      .leftJoin("reconciliation_actions_workspaces as raw", (join) =>
        join
          .onRef("raw.id", "=", "wsrira.action_id")
          .on("raw.deleted_at", "is", null)
      )
      .leftJoin("reconciliation_actions as ra", (join) =>
        join
          .onRef("ra.id", "=", "raw.reconciliation_action_id")
          .on("ra.deleted_at", "is", null)
      )
      .leftJoin("reconciliation_reasons_workspaces as rrw", (join) =>
        join
          .onRef("rrw.id", "=", "wsrira.reason_id")
          .on("rrw.deleted_at", "is", null)
      )
      .leftJoin("reconciliation_reasons as rr", (join) =>
        join
          .onRef("rr.id", "=", "rrw.reconciliation_reason_id")
          .on("rr.deleted_at", "is", null)
      )
      .where("wsrira.deleted_at", "is", null)
      .where("wsrira.reconciliation_item_id", "in", reconciliationItemIds)
      .select([
        "wsrira.reconciliation_item_id",
        "rr.id as reconciliation_reason_id",
        "rr.title as reconciliation_reason_title",
        "ra.id as reconciliation_action_id",
        "ra.title as reconciliation_action_title",
      ])
      .execute()
  }

  async getListReconciliationStream(
    c: CustomContext<DB>,
    param: GetListReconciliationQueries,
    programId: number
  ) {
    const query = c.var.trx
      .selectFrom("ws_reconciliations as wsr")
      .innerJoin("ws_materials as wsm", "wsm.id", "wsr.material_id")
      .leftJoin("ws_entities as wse", "wse.id", "wsr.entity_id")

    const filteredQuery = this.#conditionReconciliationWhereClause(query, param)
      .leftJoin("ws_activities as wsa", "wsa.id", "wsr.activity_id")
      .leftJoin("ws_materials as wsm_parent", "wsm_parent.id", "wsm.parent_id")
      .leftJoin(
        "ws_reconciliation_items as wsri",
        "wsri.reconciliation_id",
        "wsr.id"
      )
      .leftJoin(
        "ws_reconciliation_item_reason_actions as wsrira",
        "wsrira.reconciliation_item_id",
        "wsri.id"
      )
      .leftJoin(
        "reconciliation_actions_workspaces as raw",
        "raw.id",
        "wsrira.action_id"
      )
      .leftJoin(
        "reconciliation_actions as ra",
        "ra.id",
        "raw.reconciliation_action_id"
      )
      .leftJoin(
        "reconciliation_reasons_workspaces as rrw",
        "rrw.id",
        "wsrira.reason_id"
      )
      .leftJoin(
        "reconciliation_reasons as rr",
        "rr.id",
        "rrw.reconciliation_reason_id"
      )

      .leftJoin("ws_users as wsu", "wsu.id", "wsr.created_by")
      .where("wsr.program_id", "=", programId)
      .where("wsr.deleted_at", "is", null)

    return filteredQuery
      .select([
        "wsr.id as reconciliation_id",
        "wsr.start_date",
        "wsr.end_date",
        "wsr.created_at",
        "wsm.name as material_name",
        "wse.name as entity_name",
        "wsa.name as activity_name",
        sql<number>`COALESCE(wsri.actual_qty, 0)`.as("actual_qty"),
        sql<number>`COALESCE(wsri.recorded_qty, 0)`.as("recorded_qty"),
        "wsri.reconciliation_category_id",
        "rr.title as reason_title",
        "ra.title as action_title",
        sql<string>`CONCAT_WS(' ', wsu.firstname, wsu.lastname)`.as(
          "created_by"
        ),
      ])
      .orderBy("wsr.updated_at", "desc")
      .stream()
  }
}
