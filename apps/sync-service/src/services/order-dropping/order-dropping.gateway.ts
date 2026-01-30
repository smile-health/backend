import { DB } from "@/common/infrastructure/database/types/db.js"
import { CustomContext } from "@smile-health/lib/types/context.js"
import {
  OrderDroppingIncomingMessage,
  OrderItemDroppingIncomingMessage,
} from "./order-dropping.schema.js"
import { logError } from "@/common/logger.repository.js"
import { SERVER_URL } from "@/common/constant/url.js"
import { AxiosError } from "axios"
import {
  getExistingId,
  getMapExistingIds,
  insertMapping,
} from "@/common/mapping.repository.js"
import {
  getSmile,
  PostV2OrderDroppingBody,
  PostV2OrderDroppingBodyOrderItemsItem,
} from "@/openapi/order-dropping.js"
import moment from "moment"
import { Insertable } from "kysely"

export class OrderDroppingGateway {
  constructor() {}

  public async create(
    c: CustomContext<DB>,
    message: OrderDroppingIncomingMessage
  ) {
    try {
      const { headers, payload } = message
      const programId = payload.program_id
      const batchCodeMapping = Object.assign(
        {},
        ...(payload.batchCodeMapping || [])
      )
      const batchMapping: Insertable<DB["mapping_batches"]>[] = []

      const platformMaterialIds = payload.order_items.map(
        (orderItem) => orderItem.material_id
      )
      const platformStockActivityIds = payload.order_items.flatMap(
        (orderItem) => orderItem.stocks.map((stock) => stock.activity_id)
      )
      const platformStockBudgetSourceIds = payload.order_items.flatMap(
        (orderItem) => orderItem.stocks.map((stock) => stock.budget_source?.id)
      )

      const [
        existingActivityId,
        mappedExistingMaterialIds,
        mappedExistingStockActivityIds,
      ] = await Promise.all([
        getExistingId(c, "activities", payload.activity_id, programId),
        getMapExistingIds(c, "materials", platformMaterialIds, programId),
        getMapExistingIds(c, "activities", platformStockActivityIds, programId),
      ])

      let mappedExistingStockBudgetSourceIds = {}
      if (
        platformStockBudgetSourceIds &&
        platformStockBudgetSourceIds.length > 0
      ) {
        const filteredIds = platformStockBudgetSourceIds.filter(
          (id): id is number => typeof id === "number"
        )

        mappedExistingStockBudgetSourceIds = await getMapExistingIds(
          c,
          "budget_sources",
          filteredIds,
          programId
        )
      }

      const orderData: PostV2OrderDroppingBody = {
        vendor_code: payload.vendor_code,
        customer_code: payload.customer_code,
        activity_id: existingActivityId,
        is_allocated: payload.is_alocated || 1,
        is_manual: payload.is_manual || 0,
        required_date: payload.required_date
          ? moment(payload.required_date).format("YYYY-MM-DD")
          : null,
        type: payload.order_type_id,
        order_comment: {
          comment: payload.order_comment,
        },
        order_items: payload.order_items.map((orderItem) =>
          this.determineOrderItemPayload(
            orderItem,
            mappedExistingStockActivityIds,
            mappedExistingStockBudgetSourceIds
          )
        ),
        no_po: payload.po_number,
        delivery_number: payload.do_number,
        service_type: payload.delivery_type_id,
      }

      const response = await getSmile().postV2OrderDropping(orderData, {
        baseURL: SERVER_URL[programId],
        headers,
      })

      const mappingOrderData = {
        program_id: programId,
        platform_order_id: payload.id,
        existing_order_id: response.data.id,
      }

      const mappingOrderItemsData = payload.order_items.map(
        (orderItemPlatform) => {
          const platformOrderItemId = orderItemPlatform.id

          const existingOrderItem = response.data.order_items.find(
            (orderItemExisting) =>
              orderItemExisting.master_material.id ===
              mappedExistingMaterialIds[orderItemPlatform.material_id]
          )!
          const existingOrderItemId = existingOrderItem.id!
          existingOrderItem.order_stocks?.map((stock) => {
            const platformBatchId = batchCodeMapping[stock.stock.batch.code]
            if (platformBatchId) {
              batchMapping.push({
                existing_batch_id: stock.stock.batch.id,
                platform_batch_id: platformBatchId,
                program_id: programId,
              })
            }
            return stock
          })

          return {
            program_id: programId,
            platform_order_item_id: platformOrderItemId,
            existing_order_item_id: existingOrderItemId,
          }
        }
      )

      await Promise.all([
        insertMapping(c, "mapping_orders", mappingOrderData),
        insertMapping(c, "mapping_order_items", mappingOrderItemsData),
        insertMapping(c, "mapping_batches", batchMapping),
      ])

      if (
        payload.order_comment &&
        payload.order_comment_id &&
        response.data.order_comments[0]
      ) {
        // We are sure that when we sent order_comment to 3.0, the order comment is also creaetd
        // in 3.0 and placed in the first index of the response object
        const mappingOrderCommentData = {
          program_id: programId,
          platform_order_comment_id: payload.order_comment_id,
          existing_order_comment_id: response.data.order_comments[0].id!,
        }

        await insertMapping(
          c,
          "mapping_order_comments",
          mappingOrderCommentData
        )
      }

      console.log("Success Sync to 3.0")
    } catch (error) {
      await logError(c, error)
      if (error instanceof AxiosError) {
        console.log(error.response?.data)
      } else {
        console.log(error)
        throw new Error("An unknown error occurred")
      }
    }
  }

  determineOrderItemPayload(
    orderItem: OrderItemDroppingIncomingMessage,
    mappedExistingStockActivityIds,
    mappedExistingStockBudgetSourceIds
  ): PostV2OrderDroppingBodyOrderItemsItem {
    if (orderItem.material_managed_by_batch) {
      return {
        material_code: orderItem.material_code,
        batches: orderItem.stocks.map((stock) => ({
          activity_id: mappedExistingStockActivityIds[stock.activity_id],
          code: stock.batch.code,
          expired_date: moment(stock.batch.expired_date).format("YYYY-MM-DD"),
          production_date: moment(stock.batch.production_date).format(
            "YYYY-MM-DD"
          ),
          manufacture_name: stock.batch.manufacture.name,
          qty: stock.qty,
          source_material_id: stock.budget_source
            ? mappedExistingStockBudgetSourceIds[stock.budget_source.id]
            : null,
          year: stock.budget_year,
          total_price: stock.total_price,
          price: stock.total_price ? stock.total_price / stock.qty : null,
        })),
      }
    } else {
      return {
        material_code: orderItem.material_code,
        stocks: orderItem.stocks.map((stock) => ({
          qty: stock.qty,
          activity_id: mappedExistingStockActivityIds[stock.activity_id],
          source_material_id: stock.budget_source
            ? mappedExistingStockBudgetSourceIds[stock.budget_source.id]
            : null,
          year: stock.budget_year,
          total_price: stock.total_price,
          price: stock.total_price ? stock.total_price / stock.qty : null,
        })),
      }
    }
  }
}
