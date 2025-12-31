import { Context } from "hono"
import { DB } from "@/common/infrastructure/database/types/db.js"
import { BaseRepository } from "../base.repository.js"
import { ORDER_TYPE, ORDER_STATUS } from "@/common/constants/order.js"
import { DRAFT_STATUS_EVENT_REPORT } from "@/common/constants/event-report.js"
import { GetEventReportQueries } from "./event-report.schema.js"
import { sql } from "kysely"
import { USER_ROLE } from "@/common/constants/user.js"
export class EventReportRepository extends BaseRepository<"ws_event_reports"> {
  constructor() {
    super("ws_event_reports")
  }

  #generateQueryListEventReportWhereClause(
    c: Context<DB>,
    query: any,
    params: GetEventReportQueries | undefined,
    entityId: number | undefined,
    roleId: number | undefined,
    regencyId: number | undefined,
    provinceId: number | undefined
  ) {
    if (params !== undefined) {
      const {
        order_id,
        status,
        do_number,
        entity_id,
        entity_tag_id,
        regency_id,
        province_id,
        from_arrived_date,
        to_arrived_date,
        order_id_do_number,
        id,
      } = params

      if (order_id)
        query = query.where("wser.order_id", "like", `%${order_id}%`)
      if (status) query = query.where("wser.status_id", "=", status)
      if (do_number)
        query = query.where("wser.do_number", "like", `%${do_number}%`)
      if (entity_id) query = query.where("wse.id", "=", entity_id)
      if (entity_tag_id)
        query = query.where("wse.entity_tag_id", "=", entity_tag_id)
      if (regency_id) query = query.where("wse.regency_id", "=", regency_id)
      if (province_id) query = query.where("wse.province_id", "=", province_id)
      if (from_arrived_date)
        query = query.where("wser.arrived_date", ">=", from_arrived_date)
      if (to_arrived_date)
        query = query.where("wser.arrived_date", "<=", to_arrived_date)
      if (id) query = query.where("wser.id", "=", id)

      if (order_id_do_number) {
        const orderIdNumber = Number(order_id_do_number)

        query = query.where((eb) => {
          if (!isNaN(orderIdNumber)) {
            return eb.or([
              eb("wser.order_id", "like", `%${orderIdNumber}%`),
              eb("wser.do_number", "like", `%${orderIdNumber}%`),
            ])
          } else {
            return eb("wser.do_number", "like", `%${order_id_do_number}%`)
          }
        })
      }
    }

    query = this.#applyRolesFilter(
      query,
      roleId,
      entityId,
      regencyId,
      provinceId
    )

    return query
  }

  #applyRolesFilter(
    query: any,
    roleId?: number,
    entityId?: number,
    regencyId?: number,
    provinceId?: number
  ) {
    if (roleId === USER_ROLE.MANAGER) {
      if (regencyId === 0)
        query = query.where("wse.province_id", "=", provinceId)
      if (regencyId !== 0)
        query = query.where("wser.entity_id", "=", Number(entityId))
    }
    return query
  }

  async getOrderById(c: Context, id: number, programId: number) {
    return c.var.trx
      .selectFrom("ws_order_lists")
      .where("order_id", "=", id)
      .where("program_id", "=", programId)
      .where("type_id", "in", [
        ORDER_TYPE.REQUEST,
        ORDER_TYPE.DISTRIBUTION,
        ORDER_TYPE.CENTRAL_DISTRIBUTION,
      ])
      .where("status_id", "in", [ORDER_STATUS.SHIPPED, ORDER_STATUS.FULFILLED])
      .selectAll()
      .executeTakeFirst()
  }

  async getMaterialProgramById(c: Context, id: number, programId: number) {
    return c.var.trx
      .selectFrom("ws_materials as wsm")
      .where("wsm.program_id", "=", programId)
      .where("wsm.id", "=", id)
      .select(["wsm.id", "wsm.name"])
      .executeTakeFirst()
  }

  async getEntityProgramById(c: Context, id: number, programId: number) {
    return c.var.trx
      .selectFrom("ws_entities as wse")
      .where("wse.program_id", "=", programId)
      .where("wse.id", "=", id)
      .where("wse.entity_tag_id", "=", 1)
      .select(["wse.id", "wse.name", "wse.code"])
      .executeTakeFirst()
  }

  async getEventReportById(c: Context, id: number, programId: number) {
    return await c.var.trx
      .selectFrom("ws_event_reports as wser")
      .leftJoin("ws_entities as wse", (join) =>
        join
          .onRef("wse.id", "=", "wser.entity_id")
          .on("wse.program_id", "=", programId)
          .on("wse.deleted_at", "is", null)
      )
      .where("wser.id", "=", id)
      .where("wser.program_id", "=", programId)
      .where("wser.deleted_at", "is", null)
      .select([
        "wser.id",
        "wser.status_id",
        "wser.order_id",
        "wser.do_number",
        "wser.arrived_date",
        "wser.has_order",
        "wser.link as slip_link",
        "wser.created_by",
        "wser.updated_by",
        "wser.created_at",
        "wser.updated_at",
        "wse.name as entity_name",
        "wse.id as entity_id",
        "wse.province_id",
        "wse.address",
        "wse.type",
      ])
      .executeTakeFirst()
  }

  async getListUser(c: Context, listID: number[]) {
    return await c.var.trx
      .selectFrom("ws_users")
      .select(["id", "firstname", "lastname"])
      .where("deleted_by", "is", null)
      .where("id", "in", listID)
      .execute()
  }

  async getListReason(c: Context, listID: number[]) {
    return await c.var.trx
      .selectFrom("ws_event_report_reasons")
      .select(["id", "title"])
      .where("deleted_at", "is", null)
      .where("id", "in", listID)
      .execute()
  }

  async getListComment(c: Context, reportId: number) {
    return await c.var.trx
      .selectFrom("ws_event_report_comments")
      .select(["id", "comment", "created_by", "created_at"])
      .where("deleted_at", "is", null)
      .where("report_id", "=", reportId)
      .execute()
  }

  async getHistoryChangeStatusByReportId(
    c: Context,
    reportId: number,
    statusId: number
  ) {
    return await c.var.trx
      .selectFrom("ws_event_report_histories")
      .select(["id", "status_id", "created_by", "created_at"])
      .where("report_id", "=", reportId)
      .where("status_id", "=", statusId)
      .executeTakeFirst()
  }

  async getListEventReport(
    c: Context,
    params: GetEventReportQueries,
    entityId: number | undefined,
    roleId: number | undefined,
    programId: number
  ) {
    const { page, paginate } = params
    const offset = (page - 1) * paginate

    let query = c.var.trx
      .selectFrom("ws_event_reports as wser")
      .innerJoin("ws_event_report_items as wseri", (join) =>
        join
          .onRef("wser.id", "=", "wseri.report_id")
          .on("wseri.deleted_at", "is", null)
      )
      .leftJoin("ws_entities as wse", (join) =>
        join
          .onRef("wse.id", "=", "wser.entity_id")
          .on("wse.program_id", "=", programId)
          .on("wse.deleted_at", "is", null)
      )
      .where("wser.program_id", "=", programId)
      .where("wser.deleted_at", "is", null)

    query = this.#generateQueryListEventReportWhereClause(
      c,
      query,
      params,
      entityId,
      roleId,
      Number(c.var.userEntity.regency_id),
      Number(c.var.userEntity.province_id)
    )

    const list = await query
      .select([
        "wser.id",
        "wser.status_id",
        "wse.name",
        "wser.order_id",
        "wser.do_number",
        "wser.arrived_date",
        "wser.created_at",
        "wser.updated_at",
      ])
      .orderBy("wser.id", "desc")
      .groupBy("wser.id")
      .select(sql`COUNT(*) OVER ()`.as("total"))
      .limit(paginate)
      .offset(offset)
      .execute()

    return { list, total: list[0]?.total }
  }

  async statusCount(
    c: Context,
    programId: number,
    entityId: number | undefined,
    roleId: number | undefined
  ) {
    let query = c.var.trx
      .selectFrom("ws_event_reports as wser")
      .leftJoin("ws_entities as wse", (join) =>
        join
          .onRef("wse.id", "=", "wser.entity_id")
          .on("wse.program_id", "=", programId)
          .on("wse.deleted_at", "is", null)
      )

    query = this.#generateQueryListEventReportWhereClause(
      c,
      query,
      undefined,
      entityId,
      roleId,
      Number(c.var.userEntity.regency_id),
      Number(c.var.userEntity.province_id)
    )

    const result = await query
      .select(["wser.status_id"])
      .select((eb) => eb.fn.count<number>("wser.id").as("count"))
      .where("wser.deleted_at", "is", null)
      .where("wser.program_id", "=", programId)
      .groupBy("wser.status_id")
      .execute()

    return result
  }

  async getListEventReportStream(
    c: Context,
    params: GetEventReportQueries,
    entityId: number | undefined,
    roleId: number | undefined,
    programId: number
  ) {
    let query = c.var.trx
      .selectFrom("ws_event_report_items as wseri")
      .innerJoin("ws_event_reports as wser", (join) =>
        join
          .onRef("wser.id", "=", "wseri.report_id")
          .on("wser.deleted_at", "is", null)
          .on("wser.program_id", "=", programId)
      )
      .innerJoin("ws_entities as wse", (join) =>
        join
          .onRef("wse.id", "=", "wser.entity_id")
          .on("wse.program_id", "=", programId)
          .on("wse.deleted_at", "is", null)
      )
      .leftJoin("locations as province", (join) =>
        join.onRef("province.id", "=", "wse.province_id")
      )
      .leftJoin("locations as regency", (join) =>
        join.onRef("regency.id", "=", "wse.regency_id")
      )
      .leftJoin("ws_materials as wm", (join) =>
        join
          .onRef("wm.id", "=", "wseri.material_id")
          .on("wm.deleted_at", "is", null)
      )
      .innerJoin("ws_event_report_reasons as parent_reason", (join) =>
        join.onRef("parent_reason.id", "=", "wseri.reason_id")
      )
      .innerJoin("ws_event_report_reasons as child_reason", (join) =>
        join.onRef("child_reason.id", "=", "wseri.child_reason_id")
      )
      .leftJoin("ws_event_report_comments as comment", (join) =>
        join
          .onRef("comment.report_id", "=", "wser.id")
          .on("comment.deleted_at", "is", null)
      )
      .leftJoin("ws_event_report_status as status", (join) =>
        join.onRef("status.id", "=", "wser.status_id")
      )
      .leftJoin("ws_event_report_histories as history", (join) =>
        join
          .onRef("history.report_id", "=", "wser.id")
          .on("history.status_id", "in", [
            DRAFT_STATUS_EVENT_REPORT.REPORTED_COMPLETED,
            DRAFT_STATUS_EVENT_REPORT.REPORT_CANCELED,
          ])
      )

    query = this.#generateQueryListEventReportWhereClause(
      c,
      query,
      params,
      entityId,
      roleId,
      Number(c.var.userEntity.regency_id),
      Number(c.var.userEntity.province_id)
    )

    const stream = await query
      .where("wser.program_id", "=", programId)
      .where("wser.deleted_at", "is", null)
      .select([
        "wser.id",
        "wser.order_id",
        "wser.do_number",
        "wser.link",
        "wser.arrived_date",
        "wser.status_id",
        "wser.created_at",
        "wser.updated_at",
        "wseri.custom_material",
        "wseri.no_batch",
        "wseri.qty",
        "wseri.expired_date",
        "wser.has_order",
        "parent_reason.title as parent_reason_title",
        "child_reason.title as child_reason_title",
        "wm.name as material_name",
        "wse.name",
        "province.name as province_name",
        "regency.name as regency_name",
        "wse.id as entity_id",
        "comment.comment",
        "status.title as status_title",
        "history.created_at as finished_at",
      ])
      .orderBy("wser.id", "asc")
      .orderBy("comment.created_at", "desc")
      .groupBy("wseri.id")
      .stream()

    return stream
  }
}
