import { IntegrationClients } from "@/common/infrastructure/database/types/db.js"
import { logger } from "@smile-health/lib/logger.js"
import axios, { AxiosError } from "axios"
import https from "https"
import { Selectable } from "kysely"
import {
  CanCreateBast,
  CanGetBast,
  Client,
  ClientConfig,
} from "../integration.schema.js"
import { CreateBastRequest, GetBastRequest } from "./wms.schema.js"

export class WMSClient implements Client, CanCreateBast, CanGetBast {
  constructor(private readonly client: Selectable<IntegrationClients>) {}

  public getClientId() {
    return this.client.id
  }

  public async createBast(token: string, payload: CreateBastRequest) {
    const endpoint = this.getConfig().endpoints[`create_bast`]
    return await this.doRequest(endpoint, "post", token, payload)
  }

  public async getBast(token: string, payload: GetBastRequest) {
    const endpoint = this.getConfig().endpoints[`get_bast_detail`]
    return await this.doRequest(endpoint, "get", token, payload)
  }

  private getConfig(): ClientConfig {
    return this.client.config as unknown as ClientConfig
  }

  private async doRequest(
    url: string,
    method: "get" | "post",
    token: string,
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
