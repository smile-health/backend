/* eslint-disable @typescript-eslint/no-explicit-any */
import { SERVER_URL } from "@/common/constant/url.js"
import { DB } from "@/common/infrastructure/database/types/db.js"
import { logError } from "@/common/logger.repository.js"
import {
  getExistingId,
  getMapProgramIds,
  insertMapping,
} from "@/common/mapping.repository.js"
import { getSmile } from "@/openapi/user.js"
import { CustomContext } from "@smile/lib/types/context.js"
import { AxiosError } from "axios"
import { isEmpty } from "lodash"
import { DeleteUserIncomingMessage, UpdatePasswordIncomingMessage, UpdateUserStatusIncomingMessage, UpsertUserIncomingMessage, UserDTO } from "./user.schema.js"

export class UserGateway {
  public async upsert(
    c: CustomContext<DB>,
    message: UpsertUserIncomingMessage
  ) {
    try {
      const { payload, headers } = this.sanitizePayload(message)

      const mappingPrograms = await getMapProgramIds(
        c,
        payload.programs.map((p) => p.program_id)
      )

      for (const [progId, plProgramIds] of Object.entries(mappingPrograms)) {
        // do upsert to 3.0
        const existingUserId = await this.doUpsertUser(
          c,
          headers,
          Number(progId),
          payload
        )

        // insert mapping only if key not exist
        await insertMapping(
          c,
          "mapping_users",
          payload.programs
            .filter((p) => plProgramIds.includes(p.program_id))
            .map((p) => ({
              program_id: p.program_id,
              platform_user_id: p.user_id,
              platform_global_id: payload.id,
              existing_user_id: existingUserId,
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

  private async doUpsertUser(
    c: CustomContext<DB>,
    headers: any,
    programId: number,
    payload: UserDTO
  ) {
    const entityId = await getExistingId(
      c,
      "entities",
      payload.entity_id,
      programId
    )

    // check if user already mapped
    const row = await c.var.trx
      .selectFrom("mapping_users")
      .selectAll("mapping_users")
      .innerJoin(
        "mapping_programs",
        "mapping_programs.platform_program_id",
        "mapping_users.program_id"
      )
      .where("platform_global_id", "=", payload.id)
      .where("mapping_programs.existing_program_id", "=", programId)
      .executeTakeFirst()

    // if exist, do update and return existing id
    if (row) {
      await getSmile().putUserId(
        row.existing_user_id.toString(),
        {
          email: payload.email,
          firstname: payload.firstname,
          lastname: payload.lastname,
          password: payload.password,
          username: payload.username,
          role: payload.role,
          entity_id: entityId ?? 1,
          gender: payload.gender,
          date_of_birth: payload.date_of_birth,
          mobile_phone: payload.mobile_phone,
          address: payload.address,
          village_id: Number(
            isEmpty(payload.village_id) ? undefined : payload.village_id
          ),
          timezone_id: 1,
          status: 1,
          view_only: payload.view_only,
          manufacture_id: 1,
        },
        { baseURL: SERVER_URL[programId], headers }
      )

      return row.existing_user_id
    }

    // create new one if not exist, return id returned
    const resp = await getSmile().postUser(
      {
        global_id: payload.id ?? 0,
        email: payload.email,
        firstname: payload.firstname,
        lastname: payload.lastname,
        password: payload.password ?? "Smile123*",
        username: payload.username,
        role: payload.role,
        entity_id: entityId ?? 1,
        gender: payload.gender,
        date_of_birth: payload.date_of_birth,
        mobile_phone: payload.mobile_phone,
        address: payload.address,
        village_id: Number(
          isEmpty(payload.village_id) ? undefined : payload.village_id
        ),
        timezone_id: 1,
        status: 1,
        view_only: payload.view_only,
        manufacture_id: 1,
      },
      { baseURL: SERVER_URL[programId], headers }
    )

    return resp.data.id
  }

  private readonly sanitizePayload = (body: UpsertUserIncomingMessage) => {
    if (body.payload.date_of_birth) {
      body.payload.date_of_birth =
        new Date(body.payload.date_of_birth).toISOString().split("T")[0] + ""
    }

    if (body.payload.mobile_phone) {
      body.payload.mobile_phone = body.payload.mobile_phone.replace("+", "")
    }

    return body
  }

  /**
   * Update user status
   *
   * @param c
   * @param message
   */
  public async updatePassword(
    c: CustomContext<DB>,
    message: UpdatePasswordIncomingMessage
  ) {
    try {
      const { payload, headers } = message

      for (const programId of payload.program_ids) {
        await getSmile().postAuthUpdatePassword(
          {
            password: payload.password,
            password_confirmation: payload.new_password,
            new_password: payload.new_password,
          },
          {
            baseURL: SERVER_URL[programId],
            headers,
          }
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

  public async updateStatus(
    c: CustomContext<DB>,
    message: UpdateUserStatusIncomingMessage
  ) {
    try {
      const { payload, headers } = message

      const [userId, programId] = await Promise.all([
        getExistingId(c, "users", payload.id, payload.program_id),
        getExistingId(c, "programs", payload.program_id),
      ])

      await getSmile().putUserIdStatus(
        userId.toString(),
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
    message: DeleteUserIncomingMessage
  ) {
    try {
      const { payload, headers } = message

      const [userId, programId] = await Promise.all([
        getExistingId(c, "users", payload.id, payload.program_id),
        getExistingId(c, "programs", payload.program_id),
      ])

      await getSmile().deleteUserId(userId.toString(), {
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
}
