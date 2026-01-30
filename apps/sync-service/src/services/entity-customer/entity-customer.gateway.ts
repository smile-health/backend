import { SERVER_URL } from "@/common/constant/url.js"
import { DB } from "@/common/infrastructure/database/types/db.js"
import { logError } from "@/common/logger.repository.js"
import { getExistingId, getExistingIds } from "@/common/mapping.repository.js"
import { getSmile } from "@/openapi/entity-customer.js"
import { CustomContext } from "@smile-health/lib/types/context.js"
import { AxiosError } from "axios"
import { UpsertEntityCustomerIncomingMessage } from "./entity-customer.schema.js"

export class EntityCustomerGateway {
  constructor() {}

  /**
   * Update or create if we are missing data from mapping_entity_material_activities
   *
   * @param c
   * @param message
   */
  public async update(
    c: CustomContext<DB>,
    message: UpsertEntityCustomerIncomingMessage
  ) {
    try {
      const { payload, headers } = message

      const [existingEntityId, existingCustomerIds] = await Promise.all([
        getExistingId(c, "entities", payload.entity_id, payload.program_id),
        getExistingIds(c, "entities", payload.customer_ids, payload.program_id),
      ])

      await getSmile().putEntityIdCustomers(
        existingEntityId.toString(),
        {
          customer_id: existingCustomerIds,
          is_consumption: payload.is_consumption,
        },
        { baseURL: SERVER_URL[payload.program_id], headers }
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
