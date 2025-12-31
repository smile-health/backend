import { DB } from "@/common/infrastructure/database/types/db.js"
import { CustomContext } from "@smile/lib/types/context.js"
import { logError } from "@/common/logger.repository.js"
import { SERVER_URL } from "@/common/constant/url.js"
import { AxiosError } from "axios"
import { getExistingId, insertMapping } from "@/common/mapping.repository.js"
import { getSmile } from "@/openapi/order-comment.js"
import { OrderCommentIncomingMessage } from "./order-comment.schema.js"
import { PostOrderOrderIdCommentBody } from "@/openapi/order-comment.js"

export class OrderCommentGateway {
  constructor() {}

  public async create(
    c: CustomContext<DB>,
    message: OrderCommentIncomingMessage
  ) {
    try {
      const { headers, payload } = message

      const orderCommentData: PostOrderOrderIdCommentBody = {
        ...payload,
        comment: payload.comment ?? "",
      }

      const orderId = await getExistingId(
        c,
        "orders",
        payload.order_id,
        payload.program_id
      )

      const response = await getSmile().postOrderOrderIdComment(
        orderId,
        orderCommentData,
        {
          baseURL: SERVER_URL[payload.program_id],
          headers,
        }
      )

      const mappingOrderCommentData = {
        program_id: payload.program_id,
        platform_order_comment_id: payload.id,
        existing_order_comment_id: Number(response.data.id),
      }

      await insertMapping(c, "mapping_order_comments", mappingOrderCommentData)

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
