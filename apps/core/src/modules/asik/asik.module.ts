import { DB } from "@/common/infrastructure/database/types/db.js"
import axios, { AxiosInstance } from "axios"
import https from "https"
import { Kysely } from "kysely"
import moment from "moment"
import { AsikRepository } from "./asik.repository.js"
import { AsikAggregateSyncRequestDTO } from "./asik.schema.js"

type Trx = Kysely<DB>

type AsikAggregateItem = {
  smile_id: number | string | null
  pos_imunisasi: string | null
  vendor_id: number | string | null
  puskesmas: string | null
  vaksin: string | null
  batch_number: string | null
  injection_date: string | Date | null
  aggregate: number | string | null
  smile_province_id: number | string | null
  smile_regency_id: number | string | null
  smile_subdistrict_id: number | string | null
  vendor_province_id: number | string | null
  vendor_regency_id: number | string | null
  vendor_subdistrict_id: number | string | null
}

const toNullableInt = (value: unknown): number | null => {
  if (value === null || value === undefined) return null
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null
    return Math.trunc(value)
  }

  if (typeof value === "string") {
    const s = value.trim()
    if (!s) return null
    const n = Number(s)
    if (!Number.isFinite(n)) return null
    return Math.trunc(n)
  }

  return null
}

const toNullableDate = (value: unknown): Date | null => {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value === "string") {
    const s = value.trim()
    if (!s) return null
    const d = new Date(s)
    return Number.isNaN(d.getTime()) ? null : d
  }

  return null
}

export class AsikModule {
  private http: AxiosInstance | null = null
  private readonly materialCache = new Map<string, number | null>()

  constructor(private readonly repo: AsikRepository) {}

  private getHttp(): AxiosInstance {
    if (this.http) return this.http

    const baseURL = process.env.ASIK_URL
    if (!baseURL) {
      throw new Error("ASIK_URL is required")
    }

    this.http = axios.create({
      baseURL,
      timeout: 5_000_000,
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    })

    return this.http
  }

  private async login(): Promise<string> {
    const http = this.getHttp()

    const client_id = process.env.ASIK_CLIENT_ID
    const client_secret = process.env.ASIK_CLIENT_SECRET

    if (!client_id || !client_secret) {
      throw new Error("ASIK_CLIENT_ID and ASIK_CLIENT_SECRET are required")
    }

    const dataForm = new URLSearchParams()
    dataForm.append("client_id", client_id)
    dataForm.append("client_secret", client_secret)

    const response = await http.post(
      "/oauth2/v1/accesstoken?grant_type=client_credentials",
      dataForm
    )

    const token = response?.data?.access_token
    if (!token) {
      throw new Error("Failed to get ASIK access token")
    }

    return token
  }

  private async fetchAggregatePage(
    token: string,
    inputDate: string,
    page: number
  ): Promise<AsikAggregateItem[]> {
    const http = this.getHttp()

    const response = await http.post(
      "/asik-smile/api/v1/get-daily-aggregate",
      {
        data_input_date: inputDate,
        page,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    )

    const items = response?.data?.data
    if (!Array.isArray(items)) return []

    return items
  }

  private async getMaterialId(
    trx: Trx,
    vaksinRaw: string
  ): Promise<number | null> {
    const key = vaksinRaw.trim().toLowerCase()
    if (this.materialCache.has(key)) return this.materialCache.get(key) ?? null

    const vaksin = key === "polio tetes" ? "Polio Dropper" : vaksinRaw
    const materialId = await this.repo.findMaterialIdByNameLike(trx, vaksin)
    this.materialCache.set(key, materialId)

    return materialId
  }

  async syncAggregate(trx: Trx, params: AsikAggregateSyncRequestDTO) {
    const inputDateStr = params.input_date ?? moment().format("YYYY-MM-DD")
    const inputDate = new Date(`${inputDateStr}T00:00:00.000Z`)

    let page = params.page
    if (!page) {
      const lastPage = await this.repo.getLastSavedPage(trx, inputDate)
      page = lastPage ? lastPage + 1 : 1
    }

    const token = await this.login()

    let inserted = 0
    let processedPages = 0
    let lastProcessedPage: number | null = null
    let currentPage = page

    while (true) {
      const items = await this.fetchAggregatePage(
        token,
        inputDateStr,
        currentPage
      )
      if (!items.length) break

      const batchCodes = Array.from(
        new Set(
          items
            .map((i) => i.batch_number)
            .filter((v): v is string => !!v && v.trim().length > 0)
        )
      )

      const batches = await this.repo.findBatchesByCodes(trx, batchCodes)
      const batchByCode = new Map(batches.map((b) => [b.code, b]))

      const rows = [] as Array<
        import("kysely").Insertable<DB["integration_asik_aggregate"]>
      >

      for (const item of items) {
        const batchCodeAsik = item.batch_number ?? null
        const matchedBatch =
          batchCodeAsik && batchByCode.has(batchCodeAsik)
            ? batchByCode.get(batchCodeAsik)
            : null

        const vaksin = item.vaksin ?? null
        const materialId = vaksin ? await this.getMaterialId(trx, vaksin) : null

        rows.push({
          customer_id: toNullableInt(item.smile_id),
          pos_imunisasi_asik: item.pos_imunisasi ?? null,
          vendor_id: toNullableInt(item.vendor_id),
          puskesmas_asik: item.puskesmas ?? null,
          material_id: materialId,
          vaksin_asik: vaksin,
          batch_number_asik: batchCodeAsik,
          batch_id_smile: matchedBatch?.id ?? null,
          batch_code_smile: matchedBatch?.code ?? batchCodeAsik,
          injection_date: toNullableDate(item.injection_date),
          aggregate: toNullableInt(item.aggregate),
          input_date: inputDate,
          pos_imunisasi_asik_province_id: toNullableInt(item.smile_province_id),
          pos_imunisasi_asik_regency_id: toNullableInt(item.smile_regency_id),
          pos_imunisasi_asik_subdistrict_id: toNullableInt(
            item.smile_subdistrict_id
          ),
          puskesmas_asik_province_id: toNullableInt(item.vendor_province_id),
          puskesmas_asik_regency_id: toNullableInt(item.vendor_regency_id),
          puskesmas_asik_subdistrict_id: toNullableInt(
            item.vendor_subdistrict_id
          ),
          page: currentPage,
        })
      }

      await this.repo.upsertAggregates(trx, rows)

      inserted += rows.length
      processedPages += 1
      lastProcessedPage = currentPage

      if (!params.iterate) break
      if (processedPages >= params.max_pages) {
        throw new Error("Max pages limit reached")
      }

      currentPage += 1
    }

    return {
      input_date: inputDateStr,
      start_page: page,
      end_page: lastProcessedPage,
      pages_processed: processedPages,
      inserted,
    }
  }
}
