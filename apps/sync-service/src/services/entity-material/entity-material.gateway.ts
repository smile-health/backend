import { SERVER_URL } from "@/common/constant/url.js"
import { DB } from "@/common/infrastructure/database/types/db.js"
import { logError } from "@/common/logger.repository.js"
import { getExistingId, insertMapping } from "@/common/mapping.repository.js"
import { getSmile } from "@/openapi/entity-material.js"
import { CustomContext } from "@smile/lib/types/context.js"
import {
  DeleteEntityMaterialIncomingMessage,
  UpsertEntityMaterialIncomingMessage,
} from "./entity-material.schema.js"
import { AxiosError } from "axios"

export class EntityMaterialGateway {
  constructor() {}

  public async create(
    c: CustomContext<DB>,
    message: UpsertEntityMaterialIncomingMessage
  ) {
    try {
      const { payload, headers } = message
      const [existingEntityId, existingMaterialId, existingActivityId] =
        await Promise.all([
          getExistingId(c, "entities", payload.entity_id, payload.program_id),
          getExistingId(
            c,
            "materials",
            payload.material_id,
            payload.program_id
          ),
          getExistingId(
            c,
            "activities",
            payload.activity_id,
            payload.program_id
          ),
        ])

      const resp = await getSmile().postV2MaterialEntity(
        {
          master_material_id: existingMaterialId,
          entity_id: existingEntityId,
          activity_id: existingActivityId,
          min: payload.min ?? 0,
          max: payload.max ?? 0,
          consumption_rate: payload.consumption_rate ?? 0,
          retailer_price: payload.retailer_price ?? 0,
          tax: payload.tax ?? 0,
        },
        { baseURL: SERVER_URL[payload.program_id], headers }
      )

      const mappingEntityMaterialActivityData = resp.data.map((row) => ({
        program_id: payload.program_id,
        platform_entity_material_activity_id: payload.id,
        existing_entity_material_activity_id: row.id,
        existing_entity_material_id: row.entity_master_material_id,
      }))

      await insertMapping(
        c,
        "mapping_entity_material_activities",
        mappingEntityMaterialActivityData
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

  /**
   * Update or create if we are missing data from mapping_entity_material_activities
   *
   * @param c
   * @param message
   */
  public async update(
    c: CustomContext<DB>,
    message: UpsertEntityMaterialIncomingMessage
  ) {
    try {
      const { payload, headers } = message

      const mappingEma = await c.var.trx
        .selectFrom("mapping_entity_material_activities")
        .where("platform_entity_material_activity_id", "=", payload.id)
        .where("program_id", "=", payload.program_id)
        .selectAll()
        .executeTakeFirst()

      if (!mappingEma) {
        throw new Error("Mapping entity material activity not found")
      }

      const existingEmaId = mappingEma.existing_entity_material_activity_id
      const existingActivityId = await getExistingId(
        c,
        "activities",
        payload.activity_id,
        payload.program_id
      )
      await getSmile().putV2MaterialEntityId(
        existingEmaId.toString(),
        {
          id: existingEmaId,
          entity_master_material_id: mappingEma.existing_entity_material_id,
          activity_id: existingActivityId,
          min: payload.min ?? 0,
          max: payload.max ?? 0,
          consumption_rate: payload.consumption_rate ?? 0,
          retailer_price: payload.retailer_price ?? 0,
          tax: payload.tax ?? 0,
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

  /**
   * Delete from mapping_entity_material_activities
   *
   * @param c
   * @param message
   */
  public async delete(
    c: CustomContext<DB>,
    message: DeleteEntityMaterialIncomingMessage
  ) {
    try {
      const { payload, headers } = message

      const existingEmaId = await getExistingId(
        c,
        "entity_material_activities",
        payload.id,
        payload.program_id
      )

      await getSmile().deleteV2MaterialEntityId(existingEmaId.toString(), {
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
