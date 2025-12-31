import { DB } from "@/common/infrastructure/database/types/db.js"
import { CustomContext } from "@smile/lib/types/context.js"
import { logError } from "@/common/logger.repository.js"
import { SERVER_URL } from "@/common/constant/url.js"
import { AxiosError } from "axios"
import { getExistingId } from "@/common/mapping.repository.js"
import { OrderFulfilledIncomingMessage } from "./order-fulfilled.schema.js"
import {
  getSmile,
  PutV2OrderIdFulfilledBody,
} from "@/openapi/order-fulfilled.js"
import { OrderStatusFulfilledRepository } from "./order-fulfilled.repository.js"

export class OrderStatusFulfilledGateway {
  constructor(
    private readonly orderFulfilledRepository: OrderStatusFulfilledRepository
  ) {}

  public async update(
    c: CustomContext<DB>,
    message: OrderFulfilledIncomingMessage
  ) {
    try {
      const { headers, payload } = message
      const getMappingDataOrder = await getExistingId(
        c,
        "orders",
        payload.data.order_id,
        payload.program_id
      )

      if (!getMappingDataOrder) {
        console.log("No mapping data found for order_id")
        return
      }

      const orderItems = await Promise.all(
        payload.data.order_items.map(async (item) => {
          const [materialId, orderItemId] = await Promise.all([
            getExistingId(c, "materials", item.material_id, payload.program_id),
            getExistingId(c, "order_items", item.id, payload.program_id),
          ])

          const orderStockFulfill = await Promise.all(
            item.order_stock_fulfill.map(async (stock) => {
              const [batchId, orderStockIds] = await Promise.all([
                getExistingId(c, "batches", stock.batch_id, payload.program_id),
                this.orderFulfilledRepository.findOrderStockByOrderItemAndStockIdPlatform(
                  c,
                  item.id,
                  stock.stock_id,
                  payload.program_id
                ),
              ])

              return {
                order_stock_ids: orderStockIds,
                batch_id: batchId,
                status: stock.status,
                fulfill_reason: null,
                other_reason: null,
                qrcode: null, // Ensure qrcode is provided
                received_qty: stock.received_qty,
              }
            })
          )

          return {
            id: orderItemId,
            material_id: materialId,
            order_stock_fulfill: orderStockFulfill,
          }
        })
      )

      const dataOrderStatusFulfilled: PutV2OrderIdFulfilledBody = {
        comment: payload.data.comment,
        fulfilled_at: payload.data.fulfilled_at,
        order_items: orderItems,
      }

      await getSmile().putV2OrderIdFulfilled(
        getMappingDataOrder,
        dataOrderStatusFulfilled,
        {
          baseURL: SERVER_URL[payload.program_id],
          headers,
        }
      )

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
}
