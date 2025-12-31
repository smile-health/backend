import { IntegrationClients } from "@/common/infrastructure/database/types/db.js"
import { logger } from "@smile/lib/logger.js"
import axios, { AxiosError } from "axios"
import https from "https"
import { Selectable } from "kysely"
import {
  CanGetRoles,
  Client,
  ClientConfig,
  Result,
} from "../integration.schema"
import { AssetInfo } from "./wms.schema"

export class WMSClient implements Client, CanGetRoles {
  constructor(private readonly client: Selectable<IntegrationClients>) {}
  public getId(): number {
    return this.client.id
  }
  public getKey(): string {
    return this.client.key
  }
  public getUUID(): string {
    return this.getConfig().client_uuid
  }
  public getRoleId(): number {
    return this.getConfig().client_role_id
  }

  public async getRoles(): Promise<Result> {
    const endpoint = this.getConfig().endpoints[`get_roles`]
    return await this.doRequest(endpoint)
  }

  public async syncAsset(token: string, payload: AssetInfo) {
    const { id, create, ...data } = payload
    const endpoint = this.getConfig().endpoints[`sync_asset`]
    return await this.doRequest(
      create ? endpoint : `${endpoint}/${id}`,
      create ? "post" : "put",
      token,
      create ? { ...data, id } : { ...data }
    )
  }

  private getConfig(): ClientConfig {
    return this.client.config as unknown as ClientConfig
  }

  private async doRequest(
    url: string,
    method = "get",
    token?: string,
    data?: object
  ) {
    try {
      const axiosInstance = axios.create({
        httpsAgent: new https.Agent({
          rejectUnauthorized: this.getConfig().use_ssl, // Disable SSL verification}
        }),
      })

      const resp = await axiosInstance({
        url,
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        data: method === "post" ? data : undefined,
        params: method === "get" ? data : undefined,
      })

      return {
        request: {
          url: url,
          method: resp.request.method,
          body: data,
        },
        response: {
          status: resp.status,
          body: resp.data,
        },
      }
    } catch (err) {
      logger.error(err)
      const axErr = err as AxiosError
      return {
        request: {
          url: url,
          method: method,
          body: data,
        },
        response: {
          status: axErr.status,
          body: axErr.response?.data,
          error: axErr,
        },
      }
    }
  }
}
