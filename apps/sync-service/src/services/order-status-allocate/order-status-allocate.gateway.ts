import { DB } from "@/common/infrastructure/database/types/db.js"
import { CustomContext } from "@smile-health/lib/types/context.js"
import { logError } from "@/common/logger.repository.js"
import { SERVER_URL } from "@/common/constant/url.js"
import { AxiosError } from "axios"
import {
  getExistingId,
  getMapPlatformIds,
  insertMapping,
} from "@/common/mapping.repository.js"
import {
  getSmile,
  PutV2OrderIdAllocateBodyItem,
} from "@/openapi/order-status-allocate.js"
import { OrderStatusAllocateIncomingMessage } from "./order-status-allocate.schema.js"

export class OrderStatusAllocateGateway {
  constructor() {}

  public async update(
    c: CustomContext<DB>,
    message: OrderStatusAllocateIncomingMessage
  ) {
    try {
      const { headers, payload } = message
      const inputOrderAllocate: PutV2OrderIdAllocateBodyItem[] = []
      const foundOrderId = payload.data.find(
        (item) => item.order_id !== null && item.order_id !== undefined
      )
      const orderId = foundOrderId?.order_id

      const getMappingDataOrder = await getExistingId(
        c,
        "orders",
        orderId,
        payload.program_id
      )

      if (getMappingDataOrder) {
        for (const orderItem of payload.data) {
          const existingStockId = await getExistingId(
            c,
            "stocks",
            orderItem.stock_id,
            payload.program_id
          )

          const existingOrderItemId = await getExistingId(
            c,
            "order_items",
            orderItem.order_item_stock_id,
            payload.program_id
          )

          if (existingStockId && existingOrderItemId) {
            inputOrderAllocate.push({
              order_item_id: Number(existingOrderItemId),
              status: Number(orderItem.order_stock_status_id),
              allocated_stock_id: existingStockId,
              allocated_qty: orderItem.allocated_qty,
            })
          }
        }

        if (inputOrderAllocate.length > 0) {
          const response = await getSmile().putV2OrderIdAllocate(
            Number(getMappingDataOrder),
            inputOrderAllocate,
            {
              baseURL: SERVER_URL[payload.program_id],
              headers,
            }
          )

          const existingOrderItemIds = response.data.order_items
            .flatMap((orderItem) =>
              orderItem.order_stocks?.map(
                (orderStock) => orderStock.order_item_id
              )
            )
            .filter((existingOrderItemId) => existingOrderItemId !== undefined)

          const existingStockIds = response.data.order_items
            .flatMap((stock) =>
              stock.order_stocks?.map((orderStock) => orderStock.stock_id)
            )
            .filter((existingStockId) => existingStockId !== undefined)

          if (existingOrderItemIds.length > 0 && existingStockIds.length > 0) {
            const [mapPlatformOrderItemIds, mapPlatformStockIds] =
              await Promise.all([
                getMapPlatformIds(
                  c,
                  "order_items",
                  existingOrderItemIds,
                  payload.program_id
                ),
                getMapPlatformIds(
                  c,
                  "stocks",
                  existingStockIds,
                  payload.program_id
                ),
              ])

            const mappingOrderStockData = response.data.order_items
              .flatMap((orderItem) =>
                orderItem.order_stocks?.map((orderStock) => {
                  return {
                    program_id: payload.program_id,
                    platform_order_item_stock_id:
                      mapPlatformOrderItemIds[orderStock.order_item_id],
                    platform_stock_id: mapPlatformStockIds[orderStock.stock_id],
                    existing_order_stock_id: orderStock.id,
                  }
                })
              )
              .filter((mappedData) => mappedData !== undefined)

            await insertMapping(
              c,
              "mapping_order_stocks",
              mappingOrderStockData
            )
          }

          console.log("Success Sync to 3.0")
        }
      }
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
}
