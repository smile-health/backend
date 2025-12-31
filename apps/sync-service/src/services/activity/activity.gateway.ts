import { DB } from "@/common/infrastructure/database/types/db.js"
import { CustomContext } from "@smile/lib/types/context.js"
import { ActivityIncomingMessage } from "./activity.schema.js"
import { logError } from "@/common/logger.repository.js"
import { SERVER_URL } from "@/common/constant/url.js"
import { getSmile } from "@/openapi/activity.js"
import { AxiosError } from "axios"
import { insertMapping } from "@/common/mapping.repository.js"

export class ActivityGateway {
  constructor() {}

  public async create(c: CustomContext<DB>, message: ActivityIncomingMessage) {
    try {
      const { headers, payload } = message

      const response = await getSmile().postV2MasterActivity(payload, {
        baseURL: SERVER_URL[payload.program_id],
        headers,
      })

      const mappingActivityData = {
        program_id: payload.program_id,
        platform_activity_id: payload.id,
        existing_activity_id: response.data.id,
      }

      await insertMapping(c, "mapping_activities", mappingActivityData)

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

  /**
   * Update or create if we are missing data from mapping_activities
   *
   * @param c
   * @param message
   */
  public async udpate(c: CustomContext<DB>, message: ActivityIncomingMessage) {
    try {
      const { headers, payload } = message

      const mappingActivity = await c.var.trx
        .selectFrom("mapping_activities")
        .where("platform_activity_id", "=", payload.id)
        .where("program_id", "=", payload.program_id)
        .selectAll()
        .executeTakeFirst()

      if (mappingActivity) {
        await getSmile().putV2MasterActivityId(
          mappingActivity.existing_activity_id,
          payload,
          { baseURL: SERVER_URL[payload.program_id], headers }
        )
      } else {
        const response = await getSmile().postV2MasterActivity(payload, {
          baseURL: SERVER_URL[payload.program_id],
          headers,
        })

        const mappingActivityData = {
          program_id: payload.program_id,
          platform_activity_id: payload.id,
          existing_activity_id: response.data.id,
        }

        await insertMapping(c, "mapping_activities", mappingActivityData)
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

  public async delete(c: CustomContext<DB>, message: ActivityIncomingMessage) {
    try {
      const { headers, payload } = message

      const mappingActivity = await c.var.trx
        .selectFrom("mapping_activities")
        .where("platform_activity_id", "=", payload.id)
        .where("program_id", "=", payload.program_id)
        .selectAll()
        .executeTakeFirst()

      if (mappingActivity) {
        await getSmile().deleteV2MasterActivityId(
          mappingActivity.existing_activity_id,
          {
            baseURL: SERVER_URL[payload.program_id],
            headers,
          }
        )

        await c.var.trx
          .updateTable("mapping_budget_sources")
          .set({ deleted_at: new Date() })
          .where("id", "=", mappingActivity.id)
          .execute()
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
