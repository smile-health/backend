import { DB } from "@/common/infrastructure/database/types/db.js"
import { CustomContext } from "@smile/lib/types/context.js"
import { logError } from "@/common/logger.repository.js"
import { SERVER_URL } from "@/common/constant/url.js"
import { AxiosError } from "axios"
import { getExistingId } from "@/common/mapping.repository.js"
import { getSmile } from "@/openapi/order-item.js"
import { OrderItemIncomingMessage } from "./order-item.schema.js"
import { PutV2OrderOrderIdBodyOrderItemsItem } from "@/openapi/order-item.js"

export class OrderItemGateway {
  constructor() {}

  public async update(c: CustomContext<DB>, message: OrderItemIncomingMessage) {
    try {
      const { headers, payload } = message
      let inputOrderItems: PutV2OrderOrderIdBodyOrderItemsItem[] = []

      const foundOrderId = payload.order_items.find(
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
        for (const orderItem of payload.order_items) {
          const existingMaterialId = await getExistingId(
            c,
            "materials",
            orderItem.material_id,
            payload.program_id
          )

          const existingOrderItemId = await getExistingId(
            c,
            "order_items",
            orderItem.id,
            payload.program_id
          )

          if (existingMaterialId && existingOrderItemId) {
            inputOrderItems.push({
              id: existingOrderItemId,
              material_id: existingMaterialId,
              qty: orderItem.qty ?? 0,
              ordered_qty: orderItem.ordered_qty ?? 0,
              reason_id: orderItem.order_reason_id,
              recommend: orderItem.recommended_stock,
              code_kfa_product_template: orderItem.code,
            })
          }
        }

        if (inputOrderItems.length > 0) {
          await getSmile().putV2OrderOrderId(
            Number(getMappingDataOrder),
            {
              order_items: inputOrderItems,
            },
            {
              baseURL: SERVER_URL[payload.program_id],
              headers,
            }
          )

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
