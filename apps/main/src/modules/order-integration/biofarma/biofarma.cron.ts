/* eslint-disable @typescript-eslint/no-explicit-any */
import { IMMUNIZATION_PROGRAM_ID } from "@/common/constants/common.js"
import { ORDER_CANCEL_REASON, ORDER_STATUS } from "@/common/constants/order.js"
import {
  DB,
  IntegrationBiofarmaSmdvOrders,
} from "@/common/infrastructure/database/types/db.js"
import { OrderCentralDeliveryModule } from "@/modules/order-central-delivery/order-central-delivery.module.js"
import { OrderStatusCancelModule } from "@/modules/order-status/order-status-cancel/order-status-cancel.module.js"
import { collect, differ, group } from "@smile/lib/utils.js"
import { Context } from "hono"
import { Insertable } from "kysely"
import _ from "lodash"
import moment from "moment"
import { BiofarmaGateway } from "./biofarma.gateway.js"
import { BiofarmaRepository } from "./biofarma.repository.js"
import {
  BiofarmaHubDashboardOrder,
  BiofarmaOrderBase,
  BiofarmaOrdersRequest,
  BiofarmaProvinceDashboardOrder,
} from "./biofarma.schema.js"

export class BiofarmaCron {
  constructor(
    private readonly repo: BiofarmaRepository,
    private readonly gateway: BiofarmaGateway,
    private readonly createOrderModule: OrderCentralDeliveryModule,
    private readonly cancelOrderModule: OrderStatusCancelModule
  ) {}

  public async syncOrders(
    c: Context,
    type: "hub" | "province",
    startDate?: string,
    endDate?: string
  ) {
    const request: BiofarmaOrdersRequest = {
      start_date: startDate,
      end_date: endDate,
    }

    let rawData: BiofarmaOrderBase[] = []

    // fetch data from biofarma endpoints
    console.log("hit biofarma endpoint...")
    if (type === "hub") {
      const response = await this.gateway.getHubOrders(request)
      rawData = response.data
    } else if (type === "province") {
      const response = await this.gateway.getProvinceOrders(request)
      rawData = response.data
    } else {
      throw new Error("Invalid order type. Must be 'hub' or 'province'.")
    }
    console.log("done hit biofarma endpoint...")

    const mapOrder = group(
      rawData.map((order) => this.mapBiofarmaToIntegration(type, order)),
      "no_do"
    )
    const nomorDOs = _.uniq(Object.keys(mapOrder))
    const materialCodes = _.uniq(collect(rawData, "NAMA PRODUK"))
    const entityCodes = _.uniq(collect(rawData, "KODE AREA")).map(String)

    const [
      existingOrders,
      mapEntity,
      mapMaterial,
      mapActivity,
      mapBudgetSource,
    ] = await Promise.all([
      this.repo.getMapOrderByNomorDO(c, nomorDOs),
      this.repo.getMapEntityIdByCode(c, ["00", ...entityCodes]),
      this.repo.getMapMaterialByCode(c, materialCodes),
      this.repo.getMapActivityByProgramId(c),
      this.repo.getMapBudgetSourceByProgramId(c),
    ])

    // fetch existing order, only create for changed items and new orders
    const existingNomorDOs = Object.keys(existingOrders)
    const nomorDOsToCreate = differ(nomorDOs, existingNomorDOs)

    for (const [noDO, order] of Object.entries(existingOrders)) {
      if (!order.metadata) {
        console.log(`update metadata for ${noDO}`)
        await this.repo.updateOrderMetadata(
          c,
          order.id,
          this.buildMetadata(mapOrder[noDO] ?? [])
        )
        continue
      }

      if (
        (order.order_status_id === ORDER_STATUS.CANCELED ||
          order.order_status_id) === ORDER_STATUS.FULFILLED
      ) {
        console.log(`order already canceled/fulfilled for ${noDO}`)
        continue
      }

      const isItemUnchanged = _.isEqual(
        order.metadata,
        this.buildMetadata(mapOrder[noDO] ?? [])
      )

      // cancel order if item changed, then treat it as new order
      if (!isItemUnchanged) {
        console.log(`items is changed for ${noDO}`)
        await this.gateway.cancelSmileOrder(
          order.id,
          {
            order_cancel_reason_id: ORDER_CANCEL_REASON.OTHERS,
            other_reason: "Data Biofarma berubah",
          },
          order.program_id
        )
        nomorDOsToCreate.push(noDO)
      } else {
        console.log(`items unchanged for ${noDO}`)
      }
    }

    console.log(`insert ${nomorDOs.length} rows into smile orders`)
    // create new orders along with changed items
    for (const noDO of nomorDOsToCreate) {
      const items = mapOrder[noDO]

      if (!items || items.length === 0 || !items[0]) {
        console.log(`no items found for ${noDO}`)
        continue
      }

      const firstItem = items[0]
      const programId =
        mapMaterial[firstItem.produk]?.program_id ?? IMMUNIZATION_PROGRAM_ID
      const customerId = mapEntity[items![0]!.kode_area]![programId]
      const vendorId = mapEntity["00"]![programId]
      const budgetSourceId = mapBudgetSource[programId] ?? 0

      if (!customerId || !vendorId) {
        console.log(`customer/vendor not found for ${noDO}`)
        continue
      }

      const mapItems = group(items, "produk")
      const payload = {
        activity_id:
          mapActivity[programId] ?? this.gateway.getClientActivityId(),
        customer_id: customerId,
        vendor_id: vendorId,
        delivery_type_id: firstItem.service_type ?? 3,
        is_allocated: 1,
        po_number: firstItem.no_po,
        do_number: firstItem.no_do,
        metadata: JSON.stringify(this.buildMetadata(items)),
        batchCodeMapping: [],
        order_items: Object.entries(mapItems).map(([materialCode, items]) => ({
          material_id: mapMaterial[materialCode]?.id ?? 0,
          is_managed_in_batch: true,
          stocks: items.map((item) => ({
            batch_code: item.no_batch,
            ordered_qty:
              item.jm_vial * (mapMaterial[materialCode]?.pieces_per_unit ?? 1),
            expired_date: item.expired_date ?? undefined,
            manufacture_name: "Biofarma",
            budget_source_id: budgetSourceId,
            total_price: item.unit_price > 0 ? item.unit_price * item.jm_dosis: undefined,
          })),
        })),
      }

      try {
        const createdOrder = await this.gateway.createSmileOrder(
          payload,
          programId
        )
        existingOrders[noDO] = {
          id: createdOrder.id, // Assuming the response has an 'id' field
          program_id: programId ?? IMMUNIZATION_PROGRAM_ID,
          delivery_number: noDO,
          metadata: payload.metadata,
          order_status_id: ORDER_STATUS.SHIPPED,
        }
      } catch (error: any) {
        console.log(`failed to create order for ${noDO}: ${error.message}`)
      }
    }

    await this.repo.insertBiofarmaOrders(
      c,
      Object.values(mapOrder)
        .flatMap((row) => row)
        .map((item) => ({
          ...item,
          exist_smile: existingOrders[item.no_do]?.id,
          expired_date: item.expired_date ? new Date(item.expired_date): null,
        }))
    )
  }

  public async syncDashboard(
    c: Context,
    type: "hub" | "province",
    startDate: string,
    endDate: string
  ) {
    const request: BiofarmaOrdersRequest = {
      start_date: startDate,
      end_date: endDate,
    }

    let rawData:
      | BiofarmaHubDashboardOrder[]
      | BiofarmaProvinceDashboardOrder[] = []

    console.log("hit biofarma endpoint...")
    if (type === "hub") {
      const response = await this.gateway.getHubDashboard(request)
      rawData = response.data
    } else if (type === "province") {
      const response = await this.gateway.getProvinceDashboard(request)
      rawData = response.data
    } else {
      throw new Error("Invalid dashboard type. Must be 'hub' or 'province'.")
    }

    const mappedData: Insertable<DB["integration_biofarma_smdv_orders"]>[] =
      rawData.map((item) => this.mapBiofarmaDashboardToSmdvOrder(type, item))

    console.log(
      `insert ${mappedData.length} rows into integration_biofarma_smdv_orders`
    )
    const BATCH_SIZE = 10000
    for (let i = 0; i < mappedData.length; i += BATCH_SIZE) {
      const batch = mappedData.slice(i, i + BATCH_SIZE)
      await this.repo.insertBiofarmaSmdvOrders(c, batch)
    }
  }

  private buildMetadata(
    items: ReturnType<typeof this.mapBiofarmaToIntegration>[]
  ) {
    const firstItem = items[0]
    if (!firstItem) {
      return { client_key: this.gateway.getClientKey() }
    }

    return {
      client_key: this.gateway.getClientKey(),
      biofarma_type: firstItem.biofarma_type,
      no_do: firstItem.no_do,
      kode_area: firstItem.kode_area,
      pengirim: firstItem.pengirim,
      tujuan: firstItem.tujuan,
      alamat: firstItem.alamat,
      tanggal_kirim: firstItem.tanggal_kirim?.toISOString() ?? null,
      tanggal_terima: firstItem.tanggal_terima?.toISOString() ?? null,
      service_type: firstItem.service_type,
      no_document: firstItem.no_document,
      released_date: firstItem.released_date?.toISOString() ?? null,
      notes: firstItem.notes,
      entrance_type: firstItem.entrance_type,
      grant_country: firstItem.grant_country,
      items: items.map((item) => ({
        tanggal_do: item.tanggal_do
          ? moment(item.tanggal_do).format("YYYY-MM-DD")
          : null,
        no_po: item.no_po,
        produk: item.produk,
        no_batch: item.no_batch,
        jm_dosis: item.jm_dosis,
        jm_vial: item.jm_vial,
        jm_vial_terima: item.jm_vial_terima,
        jm_dosis_terima: item.jm_dosis_terima,
        status: item.status,
        expired_date: item.expired_date
          ? moment(item.expired_date).format("YYYY-MM-DD")
          : null,
        manufacture_country: item.manufacture_country,
        code_product_kemenkes: item.code_product_kemenkes,
        unit_price: item.unit_price,
      })),
    }
  }

  private mapBiofarmaToIntegration(
    type: "hub" | "province",
    item: BiofarmaOrderBase
  ) {
    let kodeArea = item["KODE AREA"]
    const changeKodeArea = [
      { src: 1608, dest: 1609 },
      { src: 1609, dest: 1608 },
    ]
    changeKodeArea.forEach((kode) => {
      if (item["KODE AREA"] === kode.src) {
        kodeArea = kode.dest
      }
    })

    return {
      biofarma_id: item["row_number"] ?? null,
      no_do: item["NOMOR DO"],
      tanggal_do: item["TANGGAL DO"] ? new Date(item["TANGGAL DO"]) : null,
      no_po: item["NOMOR PO"],
      kode_area: String(kodeArea),
      pengirim: item["PENGIRIM"],
      tujuan: item["TUJUAN PENGIRIMAN"],
      alamat: item["ALAMAT"],
      produk: item["NAMA PRODUK"],
      no_batch: item["NO BATCH"],
      expired_date: item["EXPIRED DATE"]
        ? moment(item["EXPIRED DATE"]).format("YYYY-MM-DD")
        : null,
      jm_vial: item["JUMLAH VIAL"],
      jm_dosis: item["JUMLAH DOSIS"],
      jm_vial_terima: item["JUMLAH VIAL DITERIMA"],
      jm_dosis_terima: item["JUMLAH DOSIS DITERIMA"],
      status: item["STATUS"],
      tanggal_kirim: item["TANGGAL KIRIM"]
        ? new Date(item["TANGGAL KIRIM"])
        : null,
      tanggal_terima: item["TANGGAL TERIMA"]
        ? new Date(item["TANGGAL TERIMA"])
        : null,
      biofarma_type: type,
      service_type: item["JENIS LAYANAN"] || null,
      no_document: item["NO SURAT"] || null,
      released_date: item["TANGGAL RELEASE"]
        ? new Date(item["TANGGAL RELEASE"])
        : null,
      notes: item["KETERANGAN"] || null,
      code_product_kemenkes: item["KODE PRODUK KEMENKES"] || null,
      entrance_type: item["ENTRANCETYPE"] || null,
      grant_country: item["GRANTCOUNTRY"] || null,
      manufacture_country: item["MANUFACTURCOUNTRY"] || null,
      unit_price: Number(item["UNIT PRICE"] || 0),
    }
  }

  private mapBiofarmaDashboardToSmdvOrder(
    type: "hub" | "province",
    item: BiofarmaHubDashboardOrder | BiofarmaProvinceDashboardOrder
  ) {
    const baseData = {
      biofarma_id: item.no,
      nomor_do: item.nomor_do,
      tanggal_do: item.tanggal_do ? new Date(item.tanggal_do) : null,
      nomor_po: item.nomor_po || null,
      kode_area: String(item.kode_area),
      pengiriman: item.pengiriman,
      tujuan_pengiriman: item.tujuan_pengiriman,
      alamat: item.alamat,
      nama_produk: item.nama_produk,
      no_batch: item.no_batch,
      expired_date: item.expired_date
        ? moment(item.expired_date).format("YYYY-MM-DD")
        : null,
      jumlah_vial: item.jumlah_vial,
      jumlah_dosis: item.jumlah_dosis,
      status: item.status,
      tanggal_terima: item.tanggal_terima
        ? new Date(item.tanggal_terima)
        : null,
      jenis_layanan: item.jenis_layanan || null,
      nomor_surat_alokasi: item.nomor_surat_alokasi || null,
      keterangan: item.keterangan || null,
      tipe_vaksin: item.tipe_vaksin,
      tanggal_pickup: item.tanggal_pickup
        ? new Date(item.tanggal_pickup)
        : null,
    }

    if (type === "province") {
      const provinceItem = item as BiofarmaProvinceDashboardOrder
      return {
        ...baseData,
        kode_hub: provinceItem.kode_hub || null,
        nama_smdv: provinceItem.nama_smdv,
        do_pusat: provinceItem.do_pusat,
      } as Insertable<IntegrationBiofarmaSmdvOrders>
    } else {
      const hubItem = item as BiofarmaHubDashboardOrder
      return {
        ...baseData,
        kode_hub: hubItem.kode_hub || null,
        nama_smdv: null, // Hub dashboard response does not have nama_smdv
        do_pusat: null, // Hub dashboard response does not have do_pusat
      } as Insertable<IntegrationBiofarmaSmdvOrders>
    }
  }
}
