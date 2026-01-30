import { DB } from "@/common/infrastructure/database/types/db.js"
import { CustomContext } from "@smile-health/lib/types/context.js"
import { logError } from "@/common/logger.repository.js"
import { SERVER_URL } from "@/common/constant/url.js"
import { AxiosError } from "axios"
import {
  getExistingId,
  getPlatformId,
  insertMapping,
} from "@/common/mapping.repository.js"
import { getSmile, PutV2OrderIdShipBody } from "@/openapi/order-shipped.js"
import { getSmile as getSmileDetail } from "@/openapi/detail-order.js"
import { OrderStatusShippedIncomingMessage } from "./order-status-shipped.schema.js"
import moment from "moment"

export class OrderStatusShippedGateway {
  constructor() {}

  public async update(
    c: CustomContext<DB>,
    message: OrderStatusShippedIncomingMessage
  ) {
    try {
      const { headers, payload } = message
      const orderId = payload.data.order_id
      const orderPlatformCommentId = payload.data.id

      const inputStatusShipped: PutV2OrderIdShipBody = {
        comment: payload.data.comment ?? null,
        estimated_date:
          moment(payload.data.estimated_date).format("YYYY-MM-DD") ?? null,
        taken_by_customer: payload.data.taken_by_customer ?? 0,
        sales_ref: payload.data.sales_ref ?? null,
      }

      const getMappingDataOrder = await getExistingId(
        c,
        "orders",
        orderId,
        payload.program_id
      )

      if (getMappingDataOrder) {
        await getSmile().putV2OrderIdShip(
          getMappingDataOrder,
          inputStatusShipped,
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

        if (detailOrder.data.order_comments) {
          const latest = detailOrder.data.order_comments.reduce(
            (latest, current) => {
              return new Date(current.created_at) > new Date(latest.created_at)
                ? current
                : latest
            }
          )

          const existingOrderComment = await getPlatformId(
            c,
            "order_comments",
            latest.id,
            payload.program_id
          )

          if (!existingOrderComment) {
            const mappingOrderCommentData = {
              program_id: payload.program_id,
              platform_order_comment_id: orderPlatformCommentId,
              existing_order_comment_id: Number(latest.id),
            }

            await insertMapping(
              c,
              "mapping_order_comments",
              mappingOrderCommentData
            )
          }
        }

        console.log("Success Sync to 3.0")
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
