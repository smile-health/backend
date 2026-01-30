import { SERVER_URL } from "@/common/constant/url.js"
import { DB } from "@/common/infrastructure/database/types/db.js"
import { logError } from "@/common/logger.repository.js"
import {
  getExistingId,
  getMapExistingIds,
  insertMapping,
} from "@/common/mapping.repository.js"
import { getSmile, PostV2OrderBody } from "@/openapi/order.js"
import { CustomContext } from "@smile-health/lib/types/context.js"
import { AxiosError } from "axios"
import moment from "moment"
import { OrderIncomingMessage } from "./order.schema.js"

export class OrderGateway {
  public async create(c: CustomContext<DB>, message: OrderIncomingMessage) {
    try {
      const { headers, payload } = message
      const programId = payload.program_id

      const platformMaterialIds = payload.order_items.map(
        (orderItem) => orderItem.material_id
      )

      const [
        existingCustomerId,
        existingVendorId,
        existingActivityId,
        mappedExistingMaterialIds,
      ] = await Promise.all([
        getExistingId(c, "entities", payload.customer_id, programId),
        getExistingId(c, "entities", payload.vendor_id, programId),
        getExistingId(c, "activities", payload.activity_id, programId),
        getMapExistingIds(c, "materials", platformMaterialIds, programId),
      ])

      const orderData: PostV2OrderBody = {
        customer_id: existingCustomerId,
        vendor_id: existingVendorId,
        activity_id: existingActivityId,
        required_date: payload.required_date
          ? moment(payload.required_date).format("YYYY-MM-DD")
          : null,
        order_comment: {
          comment: payload.order_comment,
        },
        order_items: payload.order_items.map((orderItem) => {
          return {
            ordered_qty: orderItem.ordered_qty,
            material_id: mappedExistingMaterialIds[orderItem.material_id],
            reason_id: orderItem.order_reason_id,
            recommended_stock: orderItem.recommended_stock,
            other_reason: orderItem.other_reason,
          }
        }),
        status: payload.order_status_id,
        type: payload.order_type_id,
      }

      const response = await getSmile().postV2Order(orderData, {
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
}
