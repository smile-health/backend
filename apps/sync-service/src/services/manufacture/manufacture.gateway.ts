/* eslint-disable @typescript-eslint/no-explicit-any */
import { SERVER_URL } from "@/common/constant/url.js"
import { DB } from "@/common/infrastructure/database/types/db.js"
import { logError } from "@/common/logger.repository.js"
import {
  getExistingId,
  getMapProgramIds,
  insertMapping,
} from "@/common/mapping.repository.js"
import { getSmile } from "@/openapi/manufacture.js"
import { CustomContext } from "@smile-health/lib/types/context.js"
import { AxiosError } from "axios"
import { isEmpty } from "lodash"
import {
  DeleteManufactureIncomingMessage,
  ManufactureDTO,
  MAP_MANUFACTURE_TYPE,
  UpdateManufactureStatusIncomingMessage,
  UpsertManufactureIncomingMessage,
} from "./manufacture.schema.js"

export class ManufactureGateway {
  public async upsert(
    c: CustomContext<DB>,
    message: UpsertManufactureIncomingMessage
  ) {
    try {
      const { payload, headers } = message

      const mappingPrograms = await getMapProgramIds(
        c,
        payload.programs.map((p) => p.program_id)
      )

      for (const [progId, plProgramIds] of Object.entries(mappingPrograms)) {
        const existingManufactureId = await this.doUpsertManufacture(
          c,
          headers,
          Number(progId),
          payload
        )

        // insert mapping for all programs in this program group
        await insertMapping(
          c,
          "mapping_manufactures",
          payload.programs
            .filter((p) => plProgramIds.includes(p.program_id))
            .map((p) => ({
              program_id: p.program_id,
              platform_manufacture_id: p.manufacture_id,
              existing_manufacture_id: existingManufactureId,
              platform_global_id: payload.id,
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
        throw new Error("An unknown error occurred")
      }
    }
  }

  /**
   * Update manufacture status
   *
   * @param c
   * @param message
   */
  public async updateStatus(
    c: CustomContext<DB>,
    message: UpdateManufactureStatusIncomingMessage
  ) {
    try {
      const { payload, headers } = message

      const [manufactureId, programId] = await Promise.all([
        getExistingId(c, "manufactures", payload.id, payload.program_id),
        getExistingId(c, "programs", payload.program_id),
      ])

      await getSmile().putManufactureIdStatus(
        manufactureId.toString(),
        { status: payload.status },
        {
          baseURL: SERVER_URL[programId],
          headers,
        }
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
    message: DeleteManufactureIncomingMessage
  ) {
    try {
      const { payload, headers } = message
      const [manufactureId, programId] = await Promise.all([
        getExistingId(c, "manufactures", payload.id, payload.program_id),
        getExistingId(c, "programs", payload.program_id),
      ])

      await getSmile().deleteManufactureId(manufactureId.toString(), {
        baseURL: SERVER_URL[programId],
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

  private async doUpsertManufacture(
    c: CustomContext<DB>,
    headers: any,
    programId: number,
    manufacture: ManufactureDTO
  ) {
    const row = await c.var.trx
      .selectFrom("mapping_manufactures")
      .selectAll("mapping_manufactures")
      .innerJoin(
        "mapping_programs",
        "mapping_programs.platform_program_id",
        "mapping_manufactures.program_id"
      )
      .where("platform_global_id", "=", manufacture.id)
      .where("mapping_programs.existing_program_id", "=", programId)
      .executeTakeFirst()

    return row
      ? this.updateExistingManufacture(
          c,
          headers,
          programId,
          manufacture,
          row.existing_manufacture_id
        )
      : this.createNewManufacture(c, headers, programId, manufacture)
  }

  private async updateExistingManufacture(
    c: CustomContext<DB>,
    headers: any,
    programId: number,
    manufacture: ManufactureDTO,
    existingManufactureId: number
  ) {
    console.log("Updating existing manufacture", existingManufactureId)
    const manufactureData = this.prepareManufactureData(manufacture)
    await getSmile().putManufactureId(
      existingManufactureId.toString(),
      manufactureData,
      { baseURL: SERVER_URL[programId], headers }
    )
    return existingManufactureId
  }

  private async createNewManufacture(
    c: CustomContext<DB>,
    headers: any,
    programId: number,
    manufacture: ManufactureDTO
  ) {
    console.log("Create new manufacture")
    const manufactureData = this.prepareManufactureData(manufacture)
    const resp = await getSmile().postManufacture(manufactureData, {
      baseURL: SERVER_URL[programId],
      headers,
    })
    return resp.data.id
  }

  private prepareManufactureData(manufacture: ManufactureDTO) {
    const programId = manufacture.programs[0]?.program_id
    const type =
      (programId && MAP_MANUFACTURE_TYPE[programId]?.[manufacture.type]) ??
      manufacture.type

    return {
      reference_id: manufacture.reference_id ?? manufacture.name,
      name: manufacture.name,
      contact_name: this.undefinedIfEmpty(manufacture.contact_name),
      description: this.undefinedIfEmpty(manufacture.description),
      email: this.undefinedIfEmpty(manufacture.email),
      phone_number: this.undefinedIfEmpty(manufacture.phone_number),
      address: this.undefinedIfEmpty(manufacture.address),
      is_asset: manufacture.type === 2 ? 1 : 0,
      status: 1,
      type,
    }
  }

  private undefinedIfEmpty(value: any) {
    return isEmpty(value) ? undefined : value
  }
}
