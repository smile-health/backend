import { IntegrationClients } from "@/scripts/types.platform.js"
import { logger } from "@smile-health/lib/logger.js"
import axios, { AxiosError } from "axios"
import https from "https"
import { Selectable } from "kysely"
import { env } from "process"
import { URLSearchParams } from "url"
import { ClientConfig, Result } from "./din.schema.js"

interface TokenResponse {
  access_token: string
  token_type: string
}

export class DinGateway {
  protected username: string
  protected password: string

  constructor(private readonly client: Selectable<IntegrationClients>) {
    const config = this.getConfig()
    const key = client.key.toUpperCase()

    this.username = config.credentials["client_id"] ?? env[`${key}_USERNAME`]
    this.password =
      config.credentials["client_secret"] ?? env[`${key}_PASSWORD`]
  }

  public getClientID() {
    return this.client.id
  }

  private getConfig(): ClientConfig {
    return this.client.config as unknown as ClientConfig
  }

  public async getMSI(
    kode_satusehat: string,
    limit: number = 100,
    page: number = 1
  ): Promise<Result> {
    const baseUrl = this.getConfig().endpoints["get_msi"]
    if (!baseUrl) {
      throw new Error("get_msi endpoint not configured")
    }

    const params = new URLSearchParams()
    params.append("limit", limit.toString())
    params.append("page", page.toString())
    params.append("kode_satusehat", kode_satusehat)

    const url = `${baseUrl}?${params.toString()}`

    try {
      const token = await this.getToken()
      const axiosInstance = axios.create({
        httpsAgent: new https.Agent({
          rejectUnauthorized: false,
        }),
      })

      const resp = await axiosInstance.get(url, {
        headers: {
          Authorization: `Bearer ${token.access_token}`,
        },
      })

      return {
        request: {
          url,
          method: "GET",
        },
        response: {
          status: resp.status,
          body: resp.data,
        },
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        logger.error(err.message)

        const axErr = err as AxiosError
        return {
          request: {
            url: axErr.config?.url ?? url,
            method: axErr.config?.method?.toUpperCase() ?? "GET",
          },
          response: {
            status: axErr.response?.status ?? 500,
            body: JSON.stringify(axErr.response?.data) ?? "Unknown error",
            error: axErr,
          },
        }
      } else {
        console.error("Non-Axios Error:", err)
        logger?.error(`Request failed: ${err}`)

        return {
          request: {
            url,
            method: "GET",
          },
          response: {
            status: 500,
            body: String(err),
            error: err as AxiosError,
          },
        }
      }
    }
  }

  public async getToken(): Promise<TokenResponse> {
    const url = this.getConfig().endpoints["token"]
    if (!url) {
      throw new Error("Token endpoint not configured")
    }

    const params = new URLSearchParams()
    params.append("client_id", this.username)
    params.append("client_secret", this.password)

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

      return resp.data as TokenResponse
    } catch (err) {
      if (axios.isAxiosError(err)) {
        logger.error(`Failed to fetch token: ${err.message}`)
      } else {
        console.error("Non-Axios Error:", err)
        logger.error(`Failed to fetch token: ${err}`)
      }

      throw err
    }
  }
}
