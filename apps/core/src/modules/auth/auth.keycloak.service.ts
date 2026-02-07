import { fetchData } from "@smile-health/lib/api/fetch.js"
import { BadRequestError } from "@smile-health/lib/error.js"
import { logger } from "@smile-health/lib/logger.js"
import { Context } from "hono"
import { v4 as uuidV4 } from "uuid"
import {
  CreateUserKeycloakRequest,
  UpdateableUser,
} from "./auth.keycloak.schema.js"

export class AuthKeycloakService {
  constructor(
    private readonly serverAuthUrl: string = "http://localhost:5001"
  ) {
    this._testConnection()
  }

  private _testConnection() {
    fetch(this.serverAuthUrl + "/", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((res) => {
        logger.info(`Success Test connection to auth server: ${res.ok}`)
      })
      .catch((error) => {
        logger.error(
          `Falied Test connection to auth server: ${JSON.stringify(error)}`
        )
        return error
      })
  }

  async checkConnection(): Promise<boolean> {
    try {
      const response = await fetch(this.serverAuthUrl + "/health", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        throw new Error(`Auth server returned status: ${response.status}`)
      }

      return true
    } catch (error) {
      logger.error(`Failed to connect to auth server: ${JSON.stringify(error)}`)
      throw new Error(`Auth server connection failed`)
    }
  }

  async validateToken(token: string) {
    try {
      const responseAuthKeycloak = await fetchData("validate-token", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      logger.info(
        `Success Validate Token Auth: ${JSON.stringify(responseAuthKeycloak)}`
      )
      return responseAuthKeycloak
    } catch (error) {
      logger.info(`Failed Validate Token Auth: ${JSON.stringify(error)}`)
      throw new BadRequestError(`Failed Get User`)
    }
  }

  async createUser(
    data: UpdateableUser & {
      role_label: string
      program_ids: string[]
      clients?: CreateUserKeycloakRequest["clients"]
    }
  ): Promise<{ keycloak_uuid: string; user_uuid: string }> {
    try {
      const clients = data.clients ?? []
      const requestAuthKeycloak: CreateUserKeycloakRequest = {
        username: data.username!,
        firstName: data.firstname!,
        lastName: data.lastname ?? undefined,
        email: data.email!,
        credentials: [
          {
            temporary: false,
            type: "password",
            value: data.password!,
          },
        ],
        attributes: {
          appUserId: uuidV4(),
          programId: data.program_ids,
        },
        roles: [data.role_label],
        clients: clients.filter((client) => client.roles?.length > 0),
      }

      const responseAuthKeycloak = await fetchData(
        `${this.serverAuthUrl}/users`,
        {
          method: "POST",
          body: JSON.stringify(requestAuthKeycloak),
        }
      )
      console.log("responseAuthKeycloak", responseAuthKeycloak)

      logger.info(
        `Success Create User Auth: ${JSON.stringify(responseAuthKeycloak)} - payload: ${JSON.stringify(requestAuthKeycloak)}`
      )
      return {
        keycloak_uuid: responseAuthKeycloak?.id,
        user_uuid: requestAuthKeycloak.attributes?.appUserId ?? "",
      }
    } catch (error: any) {
      console.log(error)
      logger.info(`Failed Create User Auth: ${JSON.stringify(error)}`)
      throw new BadRequestError(`Failed Create User`)
    }
  }

  async updateUser(
    idKeycloak: string,
    data: UpdateableUser & {
      enabled?: boolean
      program_ids?: string[]
      role_label?: string
      clients?: CreateUserKeycloakRequest["clients"]
    }
  ) {
    try {
      const clients = data.clients ?? []
      const dataUpdate: Partial<CreateUserKeycloakRequest> = {
        username: data.username!,
        firstName: data.firstname!,
        lastName: data.lastname ?? undefined,
        email: data.email!,
        clients: clients.filter((client) => client.roles?.length > 0),
      }

      if (data.enabled != undefined || data.enabled != null) {
        dataUpdate.enabled = !!data.enabled
      }
      if (data.password) {
        dataUpdate.credentials = [
          {
            temporary: false,
            type: "password",
            value: data.password,
          },
        ]
      }
      if (data.program_ids) {
        dataUpdate.attributes = {
          appUserId: data?.user_uuid!,
          programId: data.program_ids,
        }
      }
      if (data.role_label) {
        dataUpdate.roles = [data.role_label]
      }

      const requestAuthKeycloak: Partial<CreateUserKeycloakRequest> = dataUpdate

      const responseAuthKeycloak = await fetchData(
        `${this.serverAuthUrl}/users/${idKeycloak}`,
        {
          method: "PUT",
          body: JSON.stringify(requestAuthKeycloak),
        }
      )

      logger.info(
        `Success Update User Auth: ${JSON.stringify(responseAuthKeycloak)} - payload: ${JSON.stringify(requestAuthKeycloak)}`
      )
      return responseAuthKeycloak?.id
    } catch (error: any) {
      logger.info(`Failed Update User Auth ${error}`)
      throw new BadRequestError(error)
    }
  }

  async getUser(idKeycloak: string) {
    if (!idKeycloak) return null

    try {
      const responseAuthKeycloak = await fetchData(
        `${this.serverAuthUrl}/users/${idKeycloak}`,
        {
          method: "GET",
        }
      )

      logger.info(
        `Success Get User Auth: ${JSON.stringify(responseAuthKeycloak)} - params: ${idKeycloak}}`
      )
      return {
        data: responseAuthKeycloak,
      }
    } catch (error: any) {
      logger.info(`Failed Get User Auth: ${error}`)
    }
  }

  async deleteUser(c: Context, idKeycloak: string) {
    try {
      await fetchData(`${this.serverAuthUrl}/users/${idKeycloak}`, {
        method: "DELETE",
      })

      logger.info(`Success Delete User Auth: ${idKeycloak}`)
      return
    } catch (error: any) {
      logger.info(`Failed Delete User Keycloak: ${error}`)
      throw new BadRequestError(`Failed Delete User`)
    }
  }
}
