import { DB } from "@/common/infrastructure/database/types/db.js"
import { CustomContext } from "@smile-health/lib/types/context.js"
import { logError } from "@/common/logger.repository.js"
import { SERVER_URL } from "@/common/constant/url.js"
import { AxiosError } from "axios"
import { getExistingId } from "@/common/mapping.repository.js"
import { getSmile } from "@/openapi/order-cancel.js"
import { OrderCancelIncomingMessage } from "./order-status-cancel.schema.js"

export class OrderStatusCancelGateway {
  constructor() {}

  public async update(
    c: CustomContext<DB>,
    message: OrderCancelIncomingMessage
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

      await getSmile().putOrderIdCancel(getMappingDataOrder, payload.data, {
        baseURL: SERVER_URL[payload.program_id],
        headers,
      })

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
