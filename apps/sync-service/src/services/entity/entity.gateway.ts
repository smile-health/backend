/* eslint-disable @typescript-eslint/no-explicit-any */

import { filterHeaders } from "@/common/common.helper.js"
import { SERVER_URL } from "@/common/constant/url.js"
import {
  DB,
  MappingEntities,
} from "@/common/infrastructure/database/types/db.js"
import { logError } from "@/common/logger.repository.js"
import {
  getMapExistingIds,
  getMapProgramIds,
  insertMapping,
} from "@/common/mapping.repository.js"
import { CustomContext } from "@smile/lib/types/context.js"
import { collect } from "@smile/lib/utils.js"
import { AxiosError } from "axios"
import { Selectable } from "kysely"
import moment from "moment"
import {
  EntityDTO,
  EntityGatewayResponse,
  EntityIncomingMessage,
  EntityOutgoingMessage,
} from "./entity.schema.js"

const MAP_ENITTY_TYPE = {
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 97,
}

export type MappingEntitiesDTO = Selectable<MappingEntities>

export class EntityGateway {
  public async upsert(c: CustomContext<DB>, message: EntityIncomingMessage) {
    try {
      const { payload, headers } = message

      const mappingPrograms = await getMapProgramIds(
        c,
        payload.map((p) => p.program_id)
      )

      for (const [progId, plProgramIds] of Object.entries(mappingPrograms)) {
        const entities = payload.filter((p) =>
          plProgramIds.includes(p.program_id)
        )
        const entity = entities[0]
        if (!entity) continue

        const { id, ...data } = entity
        const entityData: EntityOutgoingMessage = {
          ...data,
          lat: entity.lat !== "" ? entity.lat : "0",
          lng: entity.lng !== "" ? entity.lng : "0",
          entity_tags: [entity.entity_tag_id],
          type: MAP_ENITTY_TYPE[entity.type],
        }

        await this.updateMappingEntityActivity(c, entities, entityData)

        const existingEntityId = await this.doUpsertEntity(
          c,
          headers,
          Number(progId),
          entity,
          entityData
        )

        // insert mapping for all programs in this program group
        await insertMapping(
          c,
          "mapping_entities",
          plProgramIds.map((programId) => ({
            program_id: programId,
            platform_entity_id: id,
            existing_entity_id: existingEntityId,
            platform_global_id: entity.global_id,
          }))
        )
      }

      console.log("Success Sync to 3.0")
    } catch (error) {
      await logError(c, error)
      if (error instanceof AxiosError) {
        console.log(error.response?.data)
      } else {
        console.log(error)
      }
    }
  }

  private async updateMappingEntityActivity(
    c: CustomContext<DB>,
    entities: EntityDTO[],
    entityData: EntityOutgoingMessage
  ) {
    for (const entity of entities) {
      if (!entity.activities || entity.activities.length === 0) continue
      const mapActivityIds = await getMapExistingIds(
        c,
        "activities",
        collect(entity.activities, "activity_id"),
        entity.program_id
      )

      for (const activity of entity.activities) {
        entityData.activities_date?.push({
          activity_id: mapActivityIds[activity.activity_id],
          join_date: moment(activity.start_date).format("YYYY-MM-DD"),
          end_date: moment(activity.end_date).format("YYYY-MM-DD"),
        })
      }
    }
  }

  private async doUpsertEntity(
    c: CustomContext<DB>,
    headers: any,
    programId: number,
    entity: EntityDTO,
    entityData: EntityOutgoingMessage
  ) {
    const row = await c.var.trx
      .selectFrom("mapping_entities")
      .selectAll("mapping_entities")
      .innerJoin(
        "mapping_programs",
        "mapping_programs.platform_program_id",
        "mapping_entities.program_id"
      )
      .where("platform_global_id", "=", entity.global_id)
      .where("mapping_programs.existing_program_id", "=", programId)
      .executeTakeFirst()

    return row
      ? this.updateExistingEntity(
          c,
          headers,
          programId,
          entityData,
          row.existing_entity_id
        )
      : this.createNewEntity(c, headers, programId, entityData)
  }

  private async updateExistingEntity(
    c: CustomContext<DB>,
    headers: any,
    programId: number,
    entityData: EntityOutgoingMessage,
    existingEntityId: number
  ) {
    console.log("Updating existing entity", existingEntityId)
    const response = await fetch(
      `${SERVER_URL[programId]}/entity/${existingEntityId}`,
      {
        method: "PUT",
        headers: filterHeaders(headers),
        body: JSON.stringify(entityData),
      }
    )

    const bodyText = await response.text()
    if (!response.ok) {
      throw new Error(bodyText)
    }
    return existingEntityId
  }

  private async createNewEntity(
    c: CustomContext<DB>,
    headers: any,
    programId: number,
    entityData: EntityOutgoingMessage
  ) {
    console.log("Create new entity")
    const response = await fetch(`${SERVER_URL[programId]}/entity`, {
      method: "POST",
      headers: filterHeaders(headers),
      body: JSON.stringify(entityData),
    })

    const bodyText = await response.text()
    if (!response.ok) {
      throw new Error(bodyText)
    }

    const responseJson: EntityGatewayResponse = JSON.parse(
      bodyText
    ) as EntityGatewayResponse
    return responseJson.id
  }
}
