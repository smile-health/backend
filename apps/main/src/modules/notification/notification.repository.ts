import { ENTITY_TYPE } from "@/common/constants/entity.js"
import { Context } from "hono"
import {
  StockBackToNormalData,
  StopNotificationReasonPaginatedRequestType,
} from "./notification.schema.js"
import { sql } from "kysely"

export class NotificationRepository {
  private readonly stopNotificationReasonSelectedColumns = [
    "ws_stop_notification_reasons.id",
    "ws_stop_notification_reasons.title",
    "ws_stop_notification_reasons.protocol_id",
  ] as const

  async getParentMaterialId(
    c: Context,
    entityId: number,
    materialId: number,
    activityId: number
  ): Promise<number | undefined> {
    const result = await c.var.trx
      .selectFrom("ws_stocks")
      .select("parent_material_id")
      .where("entity_id", "=", entityId)
      .where("material_id", "=", materialId)
      .where("activity_id", "=", activityId)
      .where("deleted_at", "is", null)
      .executeTakeFirst()

    return result?.parent_material_id ?? undefined
  }
  async getEntityMaterialActivityData(
    c: Context,
    entityId: number,
    parentMaterialId: number
  ) {
    return await c.var.trx
      .selectFrom("ws_entity_material_activities as ema")
      .leftJoin("ws_materials as m", (join) =>
        join
          .onRef("m.id", "=", "ema.material_id")
          .on("m.deleted_at", "is", null)
      )
      .leftJoin("ws_entities as e", (join) =>
        join.onRef("e.id", "=", "ema.entity_id").on("e.deleted_at", "is", null)
      )
      .leftJoin("locations as loc", "loc.id", "e.regency_id")
      .select([
        "ema.entity_id",
        "ema.material_id",
        "ema.activity_id",
        "m.name as material_name",
        "m.unit_of_consumption as material_consumption_unit",
        "m.material_type_id",
        "e.name as customer_entity_name",
        sql<number>`sum(ema.min)`.as("min_stock"),
        "e.type as entity_type_id",
        "loc.name as regency_name",
      ])
      .where("ema.entity_id", "=", entityId)
      .where("ema.material_id", "=", parentMaterialId)
      .where("ema.deleted_at", "is", null)
      .groupBy(["ema.entity_id", "ema.material_id"])
      .executeTakeFirst()
  }

  async getCurrentStock(
    c: Context,
    entityId: number,
    parentMaterialId: number,
    activityId?: number
  ) {
    const result = await c.var.trx
      .selectFrom("ws_stocks as s")
      .select((eb) => eb.fn.sum("s.qty").as("current_stock"))
      .where("s.entity_id", "=", entityId)
      .$if(activityId !== undefined, (qb) =>
        qb.where("s.activity_id", "=", activityId!)
      )
      .where("s.parent_material_id", "=", parentMaterialId)
      .where("s.deleted_at", "is", null)
      .executeTakeFirst()

    return Number(result?.current_stock ?? 0)
  }

  async getStockBackToNormalData(
    c: Context,
    entityId: number,
    materialId: number,
    activityId: number
  ): Promise<StockBackToNormalData | null> {
    const parentMaterialId = await this.getParentMaterialId(
      c,
      entityId,
      materialId,
      activityId
    )

    if (!parentMaterialId) {
      return null
    }

    const baseData = await this.getEntityMaterialActivityData(
      c,
      entityId,
      parentMaterialId
    )

    if (!baseData) {
      return null
    }

    const currentStock = await this.getCurrentStock(
      c,
      entityId,
      parentMaterialId
    )

    return {
      entity_id: baseData.entity_id,
      material_id: baseData.material_id,
      activity_id: baseData.activity_id,
      material_name: String(baseData.material_name),
      material_consumption_unit: String(baseData.material_consumption_unit),
      customer_entity_name: String(baseData.customer_entity_name),
      current_stock: currentStock,
      min_stock: Number(baseData.min_stock),
      regency_name: String(baseData.regency_name),
      is_fasyankes: baseData.entity_type_id === ENTITY_TYPE.FASKES,
      material_type_id: Number(baseData.material_type_id),
    }
  }

  async getStopNotificationReasons(
    c: Context,
    params: StopNotificationReasonPaginatedRequestType
  ) {
    let query = c.var.trx
      .selectFrom("ws_stop_notification_reasons")
      .where("ws_stop_notification_reasons.deleted_at", "is", null)
      .select(this.stopNotificationReasonSelectedColumns)

    if (params.protocol_id) {
      query = query.where(
        "ws_stop_notification_reasons.protocol_id",
        "=",
        params.protocol_id
      )
    }

    if (params.paginate && params.page) {
      const offset = (params.page - 1) * params.paginate
      query = query.limit(params.paginate).offset(offset)
    }

    const [data, count] = await Promise.all([
      query.execute(),
      query
        .clearSelect()
        .clearOrderBy()
        .select(
          c.var.trx.fn.count("ws_stop_notification_reasons.id").as("total")
        )
        .executeTakeFirstOrThrow(),
    ])

    return {
      data,
      total: Number(count?.total ?? 0),
    }
  }

  async stopNotification(
    c: Context,
    consumptionId: number,
    reasonId: number,
    userId: number
  ) {
    await c.var.trx
      .updateTable("ws_consumptions")
      .set({
        stop_notification: 1,
      })
      .where("id", "=", consumptionId)
      .execute()

    await c.var.trx
      .insertInto("ws_stop_notification_histories")
      .values({
        consumption_id: consumptionId,
        reason_id: reasonId,
        status: 1,
        created_by: userId,
        updated_by: userId,
      })
      .execute()
  }
}
