import { IntegrationClients } from "@/common/infrastructure/database/types/db.js"
import axios, { AxiosError } from "axios"
import https from "https"
import { Selectable } from "kysely"
import { env } from "process"
import {
  CanCancelOrder,
  CanReceiveOrder,
  ClientConfig,
  Request,
  Result,
} from "../type.js"
import moment from "moment"

interface TokenResponse {
  access_token: string
  token_type: string
}

type Payload = {
  key: string
  line: string
  line_ref: string
  tanggal_terima: string
  nama_penerima: string
  jabatan_penerima: string
  note: string
  status: "receive" | "cancel"
  is_backorder: boolean
  data: {
    lot_no: string
    tgl_kadaluarsa: string
    tgl_produksi: string
    product_name: string
    kfa_code: string
    qty: number
    unit: string
    unit_price?: number
    total_price?: number
    note?: string
  }[]
}

export class DinGateway implements CanCancelOrder, CanReceiveOrder {
  protected username: string
  protected password: string
  protected apiKey: string

  constructor(private readonly client: Selectable<IntegrationClients>) {
    const config = this.getConfig()
    const key = client.key.toUpperCase()

    this.username = config.credentials["client_id"] ?? env[`${key}_USERNAME`]
    this.password =
      config.credentials["client_secret"] ?? env[`${key}_PASSWORD`]
    this.apiKey = config.credentials["api_key"] ?? env[`${key}_API_KEY`]
  }

  public getClientID() {
    return this.client.id
  }

  private getConfig(): ClientConfig {
    return this.client.config as unknown as ClientConfig
  }

  public async receiveOrder(req: Request): Promise<Result> {
    const url = this.getConfig().endpoints["receive"]

    const payload = this.buildRequest(req, "receive")

    const fulfilledAt = (req.payload as { fulfilled_at?: string })?.fulfilled_at
    const tanggalTerima = fulfilledAt
      ? `${fulfilledAt} ${moment().format("HH:mm:ss")}`
      : moment().format("YYYY-MM-DD HH:mm:ss")

    return await this.doRequest(url, {
      ...payload,
      tanggal_terima: tanggalTerima,
      nama_penerima:
        req.user?.firstname +
        (req.user?.lastname ? ` ${req.user.lastname}` : ""),
    })
  }

  public async cancelOrder(req: Request): Promise<Result> {
    const url = this.getConfig().endpoints["cancel"]
    const payload = this.buildRequest(req, "cancel")

    return await this.doRequest(url, payload)
  }

  private buildRequest(req: Request, action: "receive" | "cancel"): Payload {
    const orderMetadata = req.order.metadata as object

    return {
      ...(req.payload as object),
      status: action,
      key: orderMetadata["key"],
      line: orderMetadata["line"],
      line_ref: orderMetadata["line_ref"],
      tanggal_terima: "",
      nama_penerima: "",
      jabatan_penerima: "",
      note: "-",
      is_backorder: false,
      data: req.items.map((item) => {
        const itemMetadata = item.metadata as object
        return {
          lot_no: itemMetadata["lot_no"],
          tgl_kadaluarsa: itemMetadata["tgl_kadaluarsa"],
          tgl_produksi: itemMetadata["tgl_produksi"],
          product_name: itemMetadata["product_name"],
          kfa_code: itemMetadata["kfa_code"],
          qty: item.qty ?? 0,
          unit: itemMetadata["unit"],
          unit_price: itemMetadata["unit_price"],
          total_price: itemMetadata["total_price"],
          note: itemMetadata["note"] ?? "-",
        }
      }),
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
          "x-apisslapikey": this.apiKey,
        },
      })

      return resp.data as TokenResponse
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

  private async doRequest(url: string, data: Payload): Promise<Result> {
    try {
      const token = await this.getToken()
      const axiosInstance = axios.create({
        httpsAgent: new https.Agent({
          rejectUnauthorized: false,
        }),
      })

      const resp = await axiosInstance({
        url,
        method: "post",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token.access_token}`,
          "x-apisslapikey": this.apiKey,
        },
        data,
      })

      return {
        request: {
          url,
          method: resp.config.method?.toUpperCase() || "POST",
          body: data,
        },
        response: {
          status: resp.status,
          body: resp.data,
        },
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        this.logger?.error("Request failed", {
          status: err.response?.status,
          data: err.response?.data,
          url: err.config?.url,
          method: err.config?.method,
        })

        const axErr = err as AxiosError
        return {
          request: {
            url: axErr.config?.url ?? url,
            method: axErr.config?.method?.toUpperCase() ?? "POST",
            body: data,
          },
          response: {
            status: axErr.response?.status ?? 500,
            body: JSON.stringify(axErr.response?.data) ?? "Unknown error",
            error: axErr,
          },
        }
      } else {
        console.error("Non-Axios Error:", err)
        this.logger?.error(`Request failed: ${err}`)

        return {
          request: {
            url,
            method: "POST",
            body: data,
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

  logger = {
    error: (message: string, meta?: unknown) => {
      console.error(
        `[ERROR] ${message}`,
        meta ? JSON.stringify(meta, null, 2) : ""
      )
    },
  }
}
