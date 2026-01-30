import { DISPOSAL_INSTRUCTIONS } from "@/common/constants/disposal.js"
import { USER_ROLE } from "@/common/constants/user.js"
import { BaseRepository } from "@/modules/base.repository.js"
import { ValidationError } from "@smile-health/lib/error.js"
import { Context } from "hono"
import { sql } from "kysely"
import {
  DisposalInstruction,
  DisposalInstructionComment,
  DisposalInstructionItem,
} from "./disposal-instruction.model.js"
import { DisposalInstructionListPaginatedRequestDTO } from "./disposal-instruction.schema.js"

export class DisposalInstructionRepository extends BaseRepository<"ws_disposal_instructions"> {
  constructor() {
    super("ws_disposal_instructions", false, true)
  }

  async checkEntityInProgram(
    c: Context,
    entityId: number,
    programId: number
  ): Promise<boolean> {
    const entity = await c.var.trx
      .selectFrom("ws_entities")
      .select(["id"])
      .where("id", "=", entityId)
      .where("program_id", "=", programId)
      .where("deleted_at", "is", null)
      .executeTakeFirst()

    return !!entity
  }

  async createInstruction(
    c: Context,
    instruction: Omit<
      DisposalInstruction,
      | "id"
      | "created_at"
      | "updated_at"
      | "deleted_at"
      | "created_by"
      | "updated_by"
      | "deleted_by"
    >
  ): Promise<number> {
    try {
      const result = await c.var.trx
        .insertInto("ws_disposal_instructions")
        .values({
          entity_id: instruction.entity_id,
          activity_id: instruction.activity_id,
          disposal_instruction_type_id:
            instruction.disposal_instruction_type_id,
          device_type: instruction.device_type,
          report_number: instruction.report_number,
          item_count: instruction.item_count,
          status: instruction.status,
          created_by: c.var.userId ?? 0,
          updated_by: c.var.userId ?? 0,
        })
        .executeTakeFirstOrThrow()

      return Number(result.insertId)
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("Duplicate entry") &&
        error.message.includes("report_number")
      ) {
        const existingInstruction = await this.findByReportNumber(
          c,
          instruction.report_number
        )
        if (existingInstruction) {
          return existingInstruction.id
        }
        const validationError = new ValidationError(
          c.var.t("disposal_instruction.error.already_exists", {
            reportNumber: instruction.report_number ?? "N/A"
          })
        )
        throw validationError
      }
      throw error
    }
  }

  async createInstructionItem(
    c: Context,
    item: Omit<
      DisposalInstructionItem,
      | "id"
      | "created_at"
      | "updated_at"
      | "deleted_at"
      | "created_by"
      | "updated_by"
      | "deleted_by"
    >
  ): Promise<number> {
    const result = await c.var.trx
      .insertInto("ws_disposal_transactions")
      .values({
        disposal_instruction_id: item.disposal_instruction_id,
        disposal_transaction_type_id: item.disposal_transaction_type_id ?? 4,
        disposal_method_id:
          item.disposal_method_id ?? DISPOSAL_INSTRUCTIONS.METHOD,
        stock_disposal_id: item.stock_disposal_id ?? 1,
        entity_id: item.entity_id,
        activity_id: item.activity_id,
        material_id: item.material_id,
        change_qty: item.change_qty ?? 0,
        opening_qty: item.opening_qty ?? 0,
        open_vial: item.open_vial ?? 0,
        disposal_discard_qty: item.disposal_discard_qty ?? 0,
        disposal_received_qty: item.disposal_received_qty ?? 0,
        created_by: c.var.userId ?? 0,
        updated_by: c.var.userId ?? 0,
      })
      .executeTakeFirstOrThrow()

    return Number(result.insertId)
  }

  async createInstructionComment(
    c: Context,
    comment: Omit<
      DisposalInstructionComment,
      | "id"
      | "created_at"
      | "updated_at"
      | "deleted_at"
      | "created_by"
      | "updated_by"
      | "deleted_by"
    >
  ): Promise<number> {
    const result = await c.var.trx
      .insertInto("ws_disposal_instruction_comments")
      .values({
        disposal_instruction_id: comment.disposal_instruction_id,
        comment: comment.comment,
        status: comment.status,
        user_id: comment.user_id ?? c.var.userId ?? 0,
      })
      .executeTakeFirstOrThrow()

    return Number(result.insertId)
  }

  async findById(c: Context, id: number): Promise<DisposalInstruction | null> {
    const instruction = await c.var.trx
      .selectFrom("ws_disposal_instructions")
      .selectAll()
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .where("activity_id", "in", c.var.activityIds)
      .executeTakeFirst()

    if (!instruction) return null

    return {
      ...instruction,
      disposal_instruction_type_id:
        instruction.disposal_instruction_type_id ?? 0,
      device_type: instruction.device_type ?? null,
      report_number: instruction.report_number ?? null,
      item_count: instruction.item_count ?? null,
      status: instruction.status ?? null,
      created_by: instruction.created_by ?? 0,
      updated_by: instruction.updated_by ?? 0,
      deleted_by: instruction.deleted_by ?? null,
    }
  }

  async findByReportNumber(
    c: Context,
    reportNumber: string | null
  ): Promise<DisposalInstruction | null> {
    if (reportNumber === null) {
      return null
    }

    const instruction = await c.var.trx
      .selectFrom("ws_disposal_instructions")
      .selectAll()
      .where("report_number", "=", reportNumber)
      .where("deleted_at", "is", null)
      .executeTakeFirst()

    if (!instruction) return null

    return {
      ...instruction,
      disposal_instruction_type_id:
        instruction.disposal_instruction_type_id ?? 0,
      device_type: instruction.device_type ?? null,
      report_number: instruction.report_number ?? null,
      item_count: instruction.item_count ?? null,
      status: instruction.status ?? null,
      created_by: instruction.created_by ?? 0,
      updated_by: instruction.updated_by ?? 0,
      deleted_by: instruction.deleted_by ?? null,
    }
  }

  async findInstructionItems(c: Context, instructionId: number) {
    const items = await c.var.trx
      .selectFrom("ws_disposal_transactions as dt")
      .innerJoin("ws_disposal_stocks as ds", "ds.id", "dt.stock_disposal_id")
      .innerJoin("ws_stocks as s", "s.id", "ds.stock_id")
      .innerJoin(
        "ws_transaction_reasons as tr",
        "tr.id",
        "ds.transaction_reason_id"
      )
      .leftJoin("ws_batches as b", "s.batch_id", "b.id")
      .leftJoin("ws_manufactures as m", "m.id", "b.manufacture_id")
      .selectAll(["dt", "ds", "s"])
      .select("dt.disposal_discard_qty as disposal_discard_qty")
      .select("dt.disposal_received_qty as disposal_received_qty")
      .select("tr.title as transaction_reason_title")
      .select("b.code as batch_code")
      .select("b.status as batch_status")
      .select(["b.production_date", "b.expired_date"])
      .select("m.name as manufacture_name")
      .where("disposal_instruction_id", "=", instructionId)
      .where("dt.deleted_at", "is", null)
      .execute()

    return items
  }

  async findInstructionComments(
    c: Context,
    instructionId: number
  ): Promise<any[]> {
    const comments = await c.var.trx
      .selectFrom("ws_disposal_instruction_comments")
      .selectAll()
      .where("disposal_instruction_id", "=", instructionId)
      .where("deleted_at", "is", null)
      .execute()

    return comments
  }

  async findDisposalStockByIdAndTransactionReason(
    c: Context,
    id: number,
    transactionReasonId: number
  ) {
    return c.var.trx
      .selectFrom("ws_disposal_stocks")
      .leftJoin("ws_stocks", "ws_disposal_stocks.stock_id", "ws_stocks.id")
      .select([
        "ws_disposal_stocks.id",
        "ws_disposal_stocks.disposal_discard_qty",
        "ws_disposal_stocks.disposal_received_qty",
        "ws_disposal_stocks.disposal_shipped_qty",
        "ws_disposal_stocks.disposal_qty",
        "ws_stocks.material_id",
      ])
      .where("ws_disposal_stocks.id", "=", id)
      .where(
        "ws_disposal_stocks.transaction_reason_id",
        "=",
        transactionReasonId
      )
      .forUpdate()
      .executeTakeFirst()
  }

  async updateDisposalStock(
    c: Context,
    id: number,
    data: {
      disposal_discard_qty: number
      disposal_received_qty: number
      disposal_qty: number
    }
  ) {
    const result = await c.var.trx
      .updateTable("ws_disposal_stocks")
      .set({
        disposal_discard_qty: Number(data.disposal_discard_qty) || 0,
        disposal_received_qty: Number(data.disposal_received_qty) || 0,
        disposal_qty: Number(data.disposal_qty) || 0,
        updated_by: c.var.userId,
        updated_at: new Date(),
      })
      .where("id", "=", id)
      .executeTakeFirst()

    return result
  }

  async findAll(
    c: Context,
    params: DisposalInstructionListPaginatedRequestDTO
  ) {
    const page = params.page ? Number(params.page) : 1
    const paginate = params.paginate ? Number(params.paginate) : 50
    const offset = (page - 1) * paginate

    const { roleId, userEntity } = c.var

    const query = c.var.trx
      .selectFrom("ws_disposal_instructions as di")
      .innerJoin("ws_entities as e", "e.id", "di.entity_id")
      .innerJoin("ws_activities as a", "a.id", "di.activity_id")
      .where("activity_id", "in", c.var.activityIds)
      .where("di.deleted_at", "is", null)
      .where("e.deleted_at", "is", null)
      .$if(roleId !== USER_ROLE.SUPERADMIN, (qb) =>
        qb.where("di.entity_id", "=", userEntity.id)
      )
      .$if(!!params.bast_no, (qb) =>
        qb.where("di.report_number", "like", `%${params.bast_no}%`)
      )
      .$if(!!params.instruction_type, (qb) =>
        qb.where(
          "di.disposal_instruction_type_id",
          "=",
          params.instruction_type ?? 0
        )
      )
      .$if(!!params.from_date, (qb) =>
        qb.where("di.created_at", ">=", new Date(params.from_date!))
      )
      .$if(!!params.to_date, (qb) => {
        const toDate = new Date(params.to_date!)
        toDate.setHours(23, 59, 59, 999)
        return qb.where("di.created_at", "<=", toDate)
      })
      .$if(!!params.activity_id, (qb) =>
        qb.where("di.activity_id", "=", params.activity_id ?? 0)
      )
      .$if(!!params.entity_province_id, (qb) =>
        qb.where("e.province_id", "=", String(params.entity_province_id))
      )
      .$if(!!params.entity_city_id, (qb) =>
        qb.where("e.regency_id", "=", String(params.entity_city_id))
      )
      .$if(!!params.entity_id, (qb) =>
        qb.where("e.id", "=", params.entity_id ?? 0)
      )
      .$if(!!params.entity_tag_id, (qb) =>
        qb.where("e.entity_tag_id", "=", params.entity_tag_id ?? 0)
      )

    const [data, total] = await Promise.all([
      query
        .select([
          "di.id",
          "di.entity_id",
          "di.activity_id",
          "di.report_number",
          "di.disposal_instruction_type_id",
          "di.status",
          "di.device_type",
          "di.created_at",
          "di.updated_at",
          "di.created_by",
          "di.updated_by",
          "e.name as entity_name",
          "a.name as activity_name",
          sql`json_object(
            'id', di.disposal_instruction_type_id
          )`.as("disposal_instruction_type"),
        ])
        .orderBy("di.created_at", "desc")
        .limit(paginate)
        .offset(offset)
        .execute(),
      query
        .select((eb) => eb.fn.count("di.id").distinct().as("total"))
        .executeTakeFirstOrThrow(),
    ])

    const totalResult = Number(total?.total) || 0

    return {
      data,
      total: totalResult,
    }
  }

  async findAllInstructionTypes(c: Context, params: any) {
    const page = params.page ? Number(params.page) : 1
    const paginate = params.paginate ? Number(params.paginate) : 100
    const offset = (page - 1) * paginate

    const query = c.var.trx
      .selectFrom("ws_disposal_instruction_types")
      .select(["id", "title"])
      .where("deleted_at", "is", null)

    const [data, total] = await Promise.all([
      query.orderBy("id", "asc").limit(paginate).offset(offset).execute(),
      query
        .select((eb) => eb.fn.count("id").as("total"))
        .executeTakeFirstOrThrow(),
    ])

    const totalResult = Number(total?.total) || 0

    return {
      data,
      total: totalResult,
    }
  }

  async findInstructionTypeById(c: Context, id: number) {
    return c.var.trx
      .selectFrom("ws_disposal_instruction_types")
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .select(["id", "title"])
      .executeTakeFirstOrThrow()
  }

  async getStreamData(
    c: Context,
    params: DisposalInstructionListPaginatedRequestDTO
  ) {
    const { roleId, userEntity } = c.var

    const query = c.var.trx
      .selectFrom("ws_disposal_instructions as di")
      .innerJoin("ws_entities as e", "e.id", "di.entity_id")
      .innerJoin("ws_activities as a", "a.id", "di.activity_id")
      .leftJoin("ws_users as u", "u.id", "di.created_by")
      .leftJoin(
        "ws_disposal_instruction_types as dtt",
        "dtt.id",
        "di.disposal_instruction_type_id"
      )
      .where("di.deleted_at", "is", null)
      .where("e.deleted_at", "is", null)
      .$if(roleId !== USER_ROLE.SUPERADMIN, (qb) =>
        qb.where("di.entity_id", "=", userEntity.id)
      )
      .$if(!!params.bast_no, (qb) =>
        qb.where("di.report_number", "like", `%${params.bast_no}%`)
      )
      .$if(!!params.instruction_type, (qb) =>
        qb.where(
          "di.disposal_instruction_type_id",
          "=",
          params.instruction_type ?? 0
        )
      )
      .$if(!!params.from_date, (qb) =>
        qb.where("di.created_at", ">=", new Date(params.from_date!))
      )
      .$if(!!params.to_date, (qb) => {
        const toDate = new Date(params.to_date!)
        toDate.setHours(23, 59, 59, 999)
        return qb.where("di.created_at", "<=", toDate)
      })
      .$if(!!params.activity_id, (qb) =>
        qb.where("di.activity_id", "=", params.activity_id ?? 0)
      )
      .$if(!!params.entity_province_id, (qb) =>
        qb.where("e.province_id", "=", String(params.entity_province_id))
      )
      .$if(!!params.entity_city_id, (qb) =>
        qb.where("e.regency_id", "=", String(params.entity_city_id))
      )
      .$if(!!params.entity_id, (qb) =>
        qb.where("e.id", "=", params.entity_id ?? 0)
      )
      .$if(!!params.entity_tag_id, (qb) =>
        qb.where("e.entity_tag_id", "=", params.entity_tag_id ?? 0)
      )

    return query
      .select([
        "di.report_number",
        "e.name as entity_name",
        "a.name as activity_name",
        "dtt.title as disposal_instruction_type_title",
        "di.item_count",
        "di.status",
        "di.created_at",
        sql`u.firstname || ' ' || u.lastname`.as("user_created_fullname"),
      ])
      .orderBy("di.created_at", "desc")
      .stream()
  }

  async getDetailedStreamData(
    c: Context,
    params: DisposalInstructionListPaginatedRequestDTO
  ) {
    const { roleId, userEntity } = c.var

    const query = c.var.trx
      .selectFrom("ws_disposal_instructions as di")
      .innerJoin("ws_entities as e", "e.id", "di.entity_id")
      .innerJoin("ws_activities as a", "a.id", "di.activity_id")
      .innerJoin(
        "ws_disposal_transactions as dt",
        "dt.disposal_instruction_id",
        "di.id"
      )
      .leftJoin("ws_disposal_stocks as ds", "ds.id", "dt.stock_disposal_id")
      .leftJoin("ws_stocks as s", "s.id", "ds.stock_id")
      .leftJoin("ws_materials as m", "m.id", "dt.material_id")
      .leftJoin("ws_batches as b", "b.id", "s.batch_id")
      .leftJoin("ws_manufactures as mn", "mn.id", "b.manufacture_id")
      .leftJoin(
        "ws_transaction_reasons as tr",
        "tr.id",
        "ds.transaction_reason_id"
      )
      .leftJoin("ws_users as u", "u.id", "di.created_by")
      .leftJoin(
        "ws_disposal_instruction_types as dtt",
        "dtt.id",
        "di.disposal_instruction_type_id"
      )
      .leftJoin("locations as province", "province.id", "e.province_id")
      .leftJoin("locations as regency", "regency.id", "e.regency_id")
      .leftJoin(
        "locations as subdistrict",
        "subdistrict.id",
        "e.sub_district_id"
      )
      .leftJoin("entity_types as et", "et.id", "e.type")
      .where("di.deleted_at", "is", null)
      .where("e.deleted_at", "is", null)
      .$if(roleId !== USER_ROLE.SUPERADMIN, (qb) =>
        qb.where("di.entity_id", "=", userEntity.id)
      )
      .$if(!!params.bast_no, (qb) =>
        qb.where("di.report_number", "like", `%${params.bast_no}%`)
      )
      .$if(!!params.instruction_type, (qb) =>
        qb.where(
          "di.disposal_instruction_type_id",
          "=",
          params.instruction_type ?? 0
        )
      )
      .$if(!!params.from_date, (qb) =>
        qb.where("di.created_at", ">=", new Date(params.from_date!))
      )
      .$if(!!params.to_date, (qb) => {
        const toDate = new Date(params.to_date!)
        toDate.setHours(23, 59, 59, 999)
        return qb.where("di.created_at", "<=", toDate)
      })
      .$if(!!params.activity_id, (qb) =>
        qb.where("di.activity_id", "=", params.activity_id ?? 0)
      )
      .$if(!!params.entity_province_id, (qb) =>
        qb.where("e.province_id", "=", String(params.entity_province_id))
      )
      .$if(!!params.entity_city_id, (qb) =>
        qb.where("e.regency_id", "=", String(params.entity_city_id))
      )
      .$if(!!params.entity_id, (qb) =>
        qb.where("e.id", "=", params.entity_id ?? 0)
      )
      .$if(!!params.entity_tag_id, (qb) =>
        qb.where("e.entity_tag_id", "=", params.entity_tag_id ?? 0)
      )

    return query
      .select([
        "di.report_number",
        "e.id as entity_id",
        "e.name as entity_name",
        "et.name as entity_type",
        "province.name as province_name",
        "regency.name as regency_name",
        "subdistrict.name as subdistrict_name",
        "dt.material_id",
        "m.name as name",
        "m.code as code",
        "b.code as batch_code",
        "b.expired_date",
        "mn.name as manufacture_name",
        "tr.title as transaction_reason",
        "a.name as activity_name",
        "dt.opening_qty",
        "dt.change_qty",
        "dtt.title",
        "di.created_at",
        sql`COALESCE(NULLIF(CONCAT(COALESCE(u.firstname, ''), ' ', COALESCE(u.lastname, '')), ' '), u.username, CAST(di.created_by AS CHAR))`.as(
          "user_created_fullname"
        ),
        "u.username as user_created_username",
      ])
      .orderBy("di.created_at", "desc")
      .stream()
  }

  async getBasicDetailMapped(c: Context, disposalStockIds: number[]) {
    if (disposalStockIds.length === 0) return {}

    const disposal_stocks = await c.var.trx
      .selectFrom("ws_disposal_stocks as ds")
      .innerJoin("ws_stocks as s", "s.id", "ds.stock_id")
      .innerJoin(
        "ws_transaction_reasons as tr",
        "tr.id",
        "ds.transaction_reason_id"
      )
      .innerJoin("ws_activities as a", "a.id", "s.activity_id")
      .leftJoin("ws_batches as b", "s.batch_id", "b.id")
      .leftJoin("ws_manufactures as mn", "mn.id", "b.manufacture_id")
      .where("ds.deleted_at", "is", null)
      .where("s.deleted_at", "is", null)
      .where("ds.id", "in", disposalStockIds)
      .select([
        "ds.id as id",
        "s.id as stock_id",
        "s.entity_id",
        "s.batch_id",
        "s.material_id as material_id",
        "s.activity_id as activity_id",
        "ds.transaction_reason_id as transaction_reason_id",
        "ds.disposal_qty as disposal_qty",
        "ds.disposal_discard_qty",
        "ds.disposal_received_qty",
        "ds.disposal_shipped_qty",
        "ds.updated_at",
        sql`if(b.id is null, null, json_object(
          'id', b.id,
          'code', b.code,
          'production_date', b.production_date,
          'expired_date', b.expired_date,
          'manufacture', json_object(
            'id', mn.id,
            'name', mn.name,
            'address', mn.address
          )
        ))`.as("batch"),
        sql`if(a.id is null, null, json_object(
          'id', a.id,
          'name', a.name,
          'code', a.code
        ))`.as("activity"),
        sql`if(tr.id is null, null, json_object(
          'id', tr.id,
          'title', tr.title,
          'title_en', tr.title_en
        ))`.as("transaction_reason"),
      ])
      .execute()

    const map = {}
    disposal_stocks.forEach((stock) => {
      map[stock.id] = stock
    })

    return map
  }
}
