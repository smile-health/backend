import { IntegrationClients } from "@/common/infrastructure/database/types/db.js"
import { OrderCancel } from "@/modules/order-status/order-status-cancel/order-status-cancel.publisher.js"
import { BadRequestError } from "@smile/lib/error.js"
import { logger } from "@smile/lib/logger.js"
import axios, { AxiosError } from "axios"
import https from "https"
import { Selectable } from "kysely"
import moment from "moment"
import { env } from "process"
import {
  CanCancelOrder,
  CanValidateOrder,
  ClientConfig,
  Request,
  Result,
} from "../type.js"
import { ValidateOrderRequest } from "./siha.schemas.js"

type ValidateRequest = {
  permintaan_id: string
  no_surat: string
  tgl_persetujuan: string
  smile_status_permintaan_id: 1
  smile_pesan: string
  category: string
  detil: {
    kode_kfa: string
    smile_status_detil_id: 0 | 1
    smile_jml_validated: number
    external_order_item_id: string
  }[]
}

type CancelRequest = {
  permintaan_id: string
  tgl_pembatalan: string
  alasan_pembatalan: string
}

export class SihaGateway implements CanValidateOrder, CanCancelOrder {
  protected username: string
  protected password: string
  protected useSSL: boolean

  constructor(private readonly client: Selectable<IntegrationClients>) {
    const config = this.getConfig()
    const key = client.key.toUpperCase()

    this.username = config.credentials["username"] ?? env[`${key}_USERNAME`]
    this.password = config.credentials["password"] ?? env[`${key}_PASSWORD`]
    this.useSSL =
      config.credentials["use_ssl"] ?? Boolean(env[`${key}_USE_SSL`] ?? false)
  }

  public getClientID() {
    return this.client.id
  }

  private getConfig(): ClientConfig {
    return this.client.config as unknown as ClientConfig
  }

  public async validateOrder(req: Request): Promise<Result> {
    const config = this.getConfig()
    const orderMetadata = req.order.metadata as object
    const payload = req.payload as ValidateOrderRequest
    const [activityCode, requestId] = orderMetadata["key_ssl"]?.split("_") ?? {}

    const endpoint = config.endpoints[`validate_${activityCode?.toLowerCase()}`]

    return await this.doRequest(endpoint, {
      permintaan_id: String(requestId ?? 0),
      no_surat: payload.letter_number ?? "-",
      tgl_persetujuan: moment().format("YYYY-MM-DD"),
      smile_status_permintaan_id: 1,
      smile_pesan: payload.comment,
      category: orderMetadata["category"],
      detil: req.items
        .filter((item) => !!item.metadata)
        .map((item) => {
          const itemMetadata = item.metadata as object
          return {
            external_order_item_id: itemMetadata["external_order_item_id"],
            kode_kfa: itemMetadata["kode_kfa"],
            smile_status_detil_id: 1,
            smile_jml_validated: item.validated_qty ?? 0,
          }
        }),
    })
  }

  public async cancelOrder(req: Request): Promise<Result> {
    const config = this.getConfig()
    const orderMetadata = req.order.metadata as object
    const payload = req.payload as OrderCancel
    const [activityCode, requestId] = orderMetadata["key_ssl"]?.split("_") ?? {}

    const endpoint = config.endpoints[`cancel_${activityCode?.toLowerCase()}`]

    return await this.doRequest(endpoint, {
      permintaan_id: String(requestId ?? 0),
      tgl_pembatalan: new Date().toISOString().slice(0, 10),
      alasan_pembatalan: payload.comment ?? "-",
    })
  }

  private async doRequest(
    url: string,
    data: ValidateRequest | CancelRequest
  ): Promise<Result> {
    const credentials = Buffer.from(
      `${this.username}:${this.password}`
    ).toString("base64")

    try {
      const axiosInstance = axios.create({
        httpsAgent: new https.Agent({
          rejectUnauthorized: this.useSSL, // Disable SSL verification}
        }),
      })

      const resp = await axiosInstance({
        url,
        method: "post",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${credentials}`,
        },
        data,
      })

      let error
      if (resp.data.status && resp.data.status !== 200) {
        error = new BadRequestError(resp.data.message)
      }

      return {
        request: {
          url: url,
          method: resp.request.method,
          body: data,
        },
        response: {
          status: resp.status,
          body: resp.data,
          error,
        },
      }
    } catch (err) {
      logger.error(err)
      const axErr = err as AxiosError
      return {
        request: {
          url: url,
          method: "post",
          body: data,
        },
        response: {
          status: axErr.status,
          body: String(axErr.response?.data),
          error: axErr,
        },
      }
    }
  }
}
