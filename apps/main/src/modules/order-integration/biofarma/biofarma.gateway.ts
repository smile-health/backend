import { IMMUNIZATION_PROGRAM_ID } from "@/common/constants/common.js"
import { IntegrationClients } from "@/common/infrastructure/database/types/db.js"
import axios from "axios"
import https from "https"
import { Selectable } from "kysely"
import { env } from "process"
import {
  BiofarmaConfig,
  BiofarmaHubDashboardResponse,
  BiofarmaHubOrdersResponse,
  BiofarmaOrdersRequest,
  BiofarmaProvinceDashboardResponse,
  BiofarmaProvinceOrdersResponse,
  BiofarmaTokenResponse,
} from "./biofarma.schema.js"

export class BiofarmaGateway {
  protected username: string
  protected password: string
  protected smileUsername: string
  protected smilePassword: string
  private smileToken: string | null = null

  constructor(private readonly client: Selectable<IntegrationClients>) {
    const config = this.getConfig()
    const key = client.key.toUpperCase()

    this.username = config.credentials["username"] ?? env[`${key}_USERNAME`]
    this.password = config.credentials["password"] ?? env[`${key}_PASSWORD`]
    this.smileUsername =
      config.credentials["smile_username"] ?? env[`${key}_SMILE_USERNAME`]
    this.smilePassword =
      config.credentials["smile_password"] ?? env[`${key}_SMILE_PASSWORD`]
  }

  public getClientID() {
    return this.client.id
  }

  public getClientKey() {
    return this.client.key
  }

  public getClientUserId() {
    return this.getConfig().client_user_id
  }

  public getClientActivityId() {
    return this.getConfig().client_activity_id
  }

  private getConfig(): BiofarmaConfig {
    return this.client.config as unknown as BiofarmaConfig
  }

  public async getSmileToken(): Promise<string | null> {
    if (this.smileToken) {
      return this.smileToken
    }

    const url = this.getConfig().endpoints["get_smile_token"]
    if (!url) {
      throw new Error("Smile Token endpoint not configured")
    }

    const params = new URLSearchParams()
    params.append("username", this.smileUsername)
    params.append("password", this.smilePassword)

    try {
      const axiosInstance = axios.create({
        httpsAgent: new https.Agent({
          rejectUnauthorized: false,
        }),
      })

      const resp = await axiosInstance.post(url, params.toString(), {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      })
      this.smileToken = resp.data.authDetails.access_token
      return this.smileToken
    } catch (err) {
      if (axios.isAxiosError(err)) {
        this.logger?.error(`Failed to fetch smile token: ${err.message}`, {
          status: err.response?.status,
          data: err.response?.data,
          url: err.config?.url,
        })
      } else {
        console.error("Non-Axios Error:", err)
        this.logger?.error(`Failed to fetch smile token: ${err}`)
      }

      throw err
    }
  }

  public async createSmileOrder<T>(
    payload: T,
    programId = IMMUNIZATION_PROGRAM_ID
  ) {
    const url = this.getConfig().endpoints["create_smile_order"]
    if (!url) {
      throw new Error("Create Smile Order endpoint not configured")
    }

    try {
      const axiosInstance = axios.create({
        httpsAgent: new https.Agent({
          rejectUnauthorized: false,
        }),
      })

      const token = await this.getSmileToken()
      const resp = await axiosInstance.post(url, payload, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-Program-Id": programId,
        },
      })
      return resp.data
    } catch (err) {
      if (axios.isAxiosError(err)) {
        this.logger?.error(`Failed to create smile order: ${err.message}`, {
          status: err.response?.status,
          req: payload,
          data: err.response?.data,
          url: err.config?.url,
        })
      } else {
        console.error("Non-Axios Error:", err)
        this.logger?.error(`Failed to create smile order: ${err}`)
      }
    }
  }

  public async cancelSmileOrder(
    orderId: number,
    payload: object,
    programId = IMMUNIZATION_PROGRAM_ID
  ) {
    const token = await this.getSmileToken()
    const url = this.getConfig().endpoints["cancel_smile_order"].replace(
      "{orderId}",
      orderId.toString()
    )
    if (!url) {
      throw new Error("Cancel Smile Order endpoint not configured")
    }

    try {
      const axiosInstance = axios.create({
        httpsAgent: new https.Agent({
          rejectUnauthorized: false,
        }),
      })

      const resp = await axiosInstance.put(`${url}`, payload, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-Program-Id": programId,
        },
      })
      return resp.data
    } catch (err) {
      if (axios.isAxiosError(err)) {
        this.logger?.error(`Failed to cancel smile order: ${err.message}`, {
          status: err.response?.status,
          data: err.response?.data,
          url: err.config?.url,
        })
      } else {
        console.error("Non-Axios Error:", err)
        this.logger?.error(`Failed to cancel smile order: ${err}`)
      }
    }
  }

  public async getToken(): Promise<BiofarmaTokenResponse> {
    const url = this.getConfig().endpoints["get_token"]
    if (!url) {
      throw new Error("Token endpoint not configured")
    }

    const params = new URLSearchParams()
    params.append("username", this.username)
    params.append("password", this.password)

    try {
      const axiosInstance = axios.create({
        httpsAgent: new https.Agent({
          rejectUnauthorized: false,
        }),
      })

      const resp = await axiosInstance.post(url, params.toString(), {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      })

      return resp.data as BiofarmaTokenResponse
    } catch (err) {
      if (axios.isAxiosError(err)) {
        this.logger?.error(`Failed to fetch token: ${err.message}`, {
          status: err.response?.status,
          data: err.response?.data,
          url: err.config?.url,
        })
      } else {
        console.error("Non-Axios Error:", err)
        this.logger?.error(`Failed to fetch token: ${err}`)
      }

      throw err
    }
  }

  private async doRequest<T, R>(
    endpointKey: string,
    method: "get" | "post",
    data?: T,
    params?: Record<string, string>
  ): Promise<R> {
    try {
      const token = await this.getToken() // This getToken is for the original Biofarma API, not Smile
      const url = this.getConfig().endpoints[endpointKey]
      if (!url) {
        throw new Error(`${endpointKey} endpoint not configured`)
      }

      const axiosInstance = axios.create({
        httpsAgent: new https.Agent({
          rejectUnauthorized: false,
        }),
      })

      const resp = await axiosInstance({
        url,
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `${token.token_type} ${token.access_token}`,
        },
        data,
        params,
      })

      return resp.data as R
    } catch (err) {
      if (axios.isAxiosError(err)) {
        this.logger?.error("Request failed", {
          status: err.response?.status,
          data: err.response?.data,
          url: err.config?.url,
          method: err.config?.method,
        })
      } else {
        console.error("Non-Axios Error:", err)
        this.logger?.error(`Request failed: ${err}`)
      }
      throw err
    }
  }

  public async getProvinceOrders(
    req: BiofarmaOrdersRequest
  ): Promise<BiofarmaProvinceOrdersResponse> {
    // first request to get the total data
    const resp: BiofarmaProvinceOrdersResponse = await this.doRequest(
      "get_province_orders",
      "post",
      undefined,
      req as Record<string, string>
    )
    req["show"] = resp.total

    return this.doRequest(
      "get_province_orders",
      "post",
      undefined,
      req as Record<string, string>
    )
  }

  public async getHubOrders(
    req: BiofarmaOrdersRequest
  ): Promise<BiofarmaHubOrdersResponse> {
    // first request to get the total data
    const resp: BiofarmaProvinceOrdersResponse = await this.doRequest(
      "get_hub_orders",
      "post",
      undefined,
      req as Record<string, string>
    )
    req["show"] = resp.total

    return this.doRequest(
      "get_hub_orders",
      "post",
      undefined,
      req as Record<string, string>
    )
  }

  public async getProvinceDashboard(
    req: BiofarmaOrdersRequest
  ): Promise<BiofarmaProvinceDashboardResponse> {
    const resp: BiofarmaProvinceDashboardResponse = await this.doRequest(
      "get_province_dashboard",
      "post",
      undefined,
      req as Record<string, string>
    )
    req["show"] = resp.total

    return this.doRequest(
      "get_province_dashboard",
      "post",
      undefined,
      req as Record<string, string>
    )
  }

  public async getHubDashboard(
    req: BiofarmaOrdersRequest
  ): Promise<BiofarmaHubDashboardResponse> {
    const resp: BiofarmaHubDashboardResponse = await this.doRequest(
      "get_hub_dashboard",
      "post",
      undefined,
      req as Record<string, string>
    )
    req["show"] = resp.total

    return this.doRequest(
      "get_hub_dashboard",
      "post",
      undefined,
      req as Record<string, string>
    )
  }

  private logger = {
    error: (message: string, meta?: unknown) => {
      console.error(
        `[ERROR] ${message}`,
        meta ? JSON.stringify(meta, null, 2) : ""
      )
    },
  }
}
