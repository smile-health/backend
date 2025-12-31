import { SERVER_URL } from "@/common/constant/url.js"
import { DB } from "@/common/infrastructure/database/types/db.js"
import { logError } from "@/common/logger.repository.js"
import {
  getExistingId,
  getPlatformId,
  insertMapping,
} from "@/common/mapping.repository.js"
import { getSmile as getSmileDetail } from "@/openapi/detail-order.js"
import {
  getSmile,
  PutV2OrderConfirmBodyOrderItemsItem,
} from "@/openapi/order-status-confirm.js"
import { CustomContext } from "@smile/lib/types/context.js"
import { AxiosError } from "axios"
import { OrderStatusConfirmIncomingMessage } from "./order-status-confirm.schema.js"

export class OrderStatusConfirmGateway {
  public async update(
    c: CustomContext<DB>,
    message: OrderStatusConfirmIncomingMessage
  ) {
    try {
      const { headers, payload } = message
      const inputOrderConfirm: PutV2OrderConfirmBodyOrderItemsItem[] = []
      const foundOrderId = payload.data.find(
        (item) => item.order_id !== null && item.order_id !== undefined
      )
      const orderId = foundOrderId?.order_id
      const comment = foundOrderId?.comment
      const orderPlatformCommentId = foundOrderId?.comment_id

      const getMappingDataOrder = await getExistingId(
        c,
        "orders",
        orderId,
        payload.program_id
      )

      if (getMappingDataOrder) {
        for (const orderItem of payload.data) {
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
            inputOrderConfirm.push({
              id: existingOrderItemId,
              material_id: existingMaterialId,
              order_id: getMappingDataOrder,
              qty: orderItem.qty ?? 0,
              confirmed_qty: orderItem.confirmed_qty ?? 0,
            })
          }
        }

        if (inputOrderConfirm.length > 0) {
          await getSmile().putV2OrderConfirm(
            Number(getMappingDataOrder),
            {
              comment,
              order_items: inputOrderConfirm,
            },
            {
              baseURL: SERVER_URL[payload.program_id],
              headers,
            }
          )

          const detailOrder = await getSmileDetail().getV2OrderId(
            getMappingDataOrder,
            {
              baseURL: SERVER_URL[payload.program_id],
              headers,
            }
          )

          for (const orderCommentExisting of detailOrder.data // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .order_comments as any[]) {
            if (orderPlatformCommentId)
              await this.createMappingOrderComment(
                c,
                orderCommentExisting,
                payload,
                orderPlatformCommentId
              )
          }

          console.log("Success Sync to 3.0")
        }
      }
    } catch (error) {
      await this.handleError(c, error)
    }
  }

  private async createMappingOrderComment(
    c: CustomContext<DB>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    orderCommentExisting: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payload: any,
    orderPlatformCommentId: number | undefined
  ) {
    if (orderCommentExisting.id) {
      const existingOrderComment = await getPlatformId(
        c,
        "order_comments",
        orderCommentExisting.id,
        payload.program_id
      )

      if (!existingOrderComment) {
        const mappingOrderCommentData = {
          program_id: payload.program_id,
          platform_order_comment_id: orderPlatformCommentId,
          existing_order_comment_id: Number(orderCommentExisting.id),
        }

        await insertMapping(
          c,
          "mapping_order_comments",
          mappingOrderCommentData
        )
      }
    }
  }

  private async handleError(c: CustomContext<DB>, error: unknown) {
    await logError(c, error)
    if (error instanceof AxiosError) {
      console.log(error.response?.data)
    } else {
      console.log(error)
      throw new Error("An unknown error occurred")
    }
  }
}
