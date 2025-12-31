import { ClientConfig } from "../type.js"

/* eslint-disable @typescript-eslint/no-empty-object-type */
export type BiofarmaConfig = ClientConfig & {
  client_user_id: number
  client_activity_id: number
}

export interface BiofarmaTokenRequest {
  username: string
  password: string
}

export interface BiofarmaTokenResponse {
  status: boolean
  should_update_password: boolean
  last_update_password: string | null
  flagging: number
  token_type: string
  user: string
  access_token: string
  expires_in: number
}

export interface BiofarmaOrdersRequest {
  start_date?: string
  end_date?: string
  search?: string
}

export interface BiofarmaOrderBase {
  "NOMOR DO": string
  "TANGGAL DO": string
  "NOMOR PO": string
  "KODE AREA": string | number // KODE AREA can be string or number
  PENGIRIM: string
  "TUJUAN PENGIRIMAN": string
  ALAMAT: string
  "NAMA PRODUK": string
  "KODE PRODUK KEMENKES": string | null
  "NO BATCH": string
  "EXPIRED DATE": string
  "JUMLAH VIAL": number
  "JUMLAH DOSIS": number
  "JUMLAH VIAL DITERIMA": number
  "JUMLAH DOSIS DITERIMA": number
  STATUS: string
  "TANGGAL KIRIM": string
  "TANGGAL TERIMA": string
  "JENIS LAYANAN": number
  "NO SURAT": string
  "TANGGAL RELEASE": string | null
  KETERANGAN: string | null
  ENTRANCETYPE: string
  GRANTCOUNTRY: string
  MANUFACTURCOUNTRY: string
}

export interface BiofarmaProvinceOrder extends BiofarmaOrderBase {}

export interface BiofarmaHubOrder extends BiofarmaOrderBase {
  row_number: number
}

export interface BiofarmaProvinceDashboardOrder {
  no: number
  nomor_do: string
  tanggal_do: string
  nomor_po: string
  kode_area: string
  pengiriman: string
  tujuan_pengiriman: string
  alamat: string
  nama_produk: string
  no_batch: string
  expired_date: string
  jumlah_vial: number
  jumlah_dosis: number
  status: string
  tanggal_terima: string
  jenis_layanan: string | null
  nomor_surat_alokasi: string | null
  keterangan: string | null
  kode_hub: string | null
  tipe_vaksin: string
  tanggal_pickup: string
  nama_smdv: string
  do_pusat: string
}

export interface BiofarmaHubDashboardOrder {
  no: number
  nomor_do: string
  tanggal_do: string
  kode_area: number
  pengiriman: string
  tujuan_pengiriman: string
  alamat: string
  nama_produk: string
  no_batch: string
  expired_date: string
  jumlah_vial: number
  jumlah_dosis: number
  status: string
  tanggal_terima: string
  jenis_layanan: string | null
  nomor_surat_alokasi: string | null
  keterangan: string | null
  nomor_po: string
  kode_hub: string
  tipe_vaksin: string
  tanggal_pickup: string
}

export interface BiofarmaPaginatedResponse<T> {
  current_page: number
  data: T[]
  first_page_url: string
  from: number
  last_page: number
  last_page_url: string
  next_page_url: string | null
  per_page: number
  prev_page_url: string | null
  to: number
  total: number
}

export interface BiofarmaProvinceOrdersResponse
  extends BiofarmaPaginatedResponse<BiofarmaProvinceOrder> {}

export interface BiofarmaHubOrdersResponse
  extends BiofarmaPaginatedResponse<BiofarmaHubOrder> {}

export interface BiofarmaProvinceDashboardResponse
  extends BiofarmaPaginatedResponse<BiofarmaProvinceDashboardOrder> {}

export interface BiofarmaHubDashboardResponse
  extends BiofarmaPaginatedResponse<BiofarmaHubDashboardOrder> {}
