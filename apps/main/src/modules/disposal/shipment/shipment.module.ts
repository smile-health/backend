import { ValidationError, NotFoundError } from "@smile/lib/error.js"
import { ShipmentExport, DetailShipmentExport } from "./shipment.excel.js"
import _ from "lodash"
import moment from "moment"
import { DisposalShipmentRepository } from "./shipment.repository.js"
import {
  CreateShipmentRequest,
  GetShipmentQueries,
  CommentShipmentRequest,
  AcceptShipmentRequest,
  CancelShipmentRequest,
  RowType,
} from "./shipment.schema.js"

export class DisposalShipmentModule {
  constructor(private readonly repo: DisposalShipmentRepository) {}

  // List Disposal Shipments
  async list(c: any, query: GetShipmentQueries) {
    // Call repository to get paginated list
    const result = await this.repo.listShipments(c, query)
    return result
  }

  // Count Disposal Shipments
  async count(c: any, query: GetShipmentQueries) {
    // Call repository to get paginated list
    const result = await this.repo.countStatusShipment(c, query)
    return result
  }

  // Create Disposal Shipment
  async create(c: any, body: CreateShipmentRequest) {
    // Additional business validation can be added here
    const result = await this.repo.createShipment(c, body)
    // Optionally publish event
    // await this.publisher.publishShipmentCreated(result.id)
    return result
  }

  // Export Disposal Shipments
  async export(c: any, query: GetShipmentQueries) {
    // Call repository to get data, then generate Excel buffer
    const excelTemplate = new ShipmentExport()
    const title = c.var.t("disposal_method.disposal_shipments")
    excelTemplate.setTitle(title)
    excelTemplate.setTimezone(c.req.header("Timezone"))

    // disposal_shipment.label.xls.entity_id
    await excelTemplate.initSheet(title)
    excelTemplate.setColumns([
      {
        header: "No.",
        width: 20,
      },
      {
        header: c.var.t("disposal_shipment.label.xls.shipment_id"),
        width: 30,
      },
      {
        header: "Status",
        width: 30,
      },
      {
        header: c.var.t("disposal_shipment.label.xls.customer_name"),
        width: 30,
      },
      {
        header: c.var.t("disposal_shipment.label.xls.vendor_name"),
        width: 30,
      },
      {
        header: c.var.t("disposal_shipment.label.xls.activity"),
        width: 30,
      },
      {
        header: c.var.t("disposal_shipment.label.xls.created_by"),
        width: 30,
      },
      {
        header: c.var.t("disposal_shipment.label.xls.created_on"),
        width: 30,
      },
      {
        header: c.var.t("disposal_shipment.label.xls.updated_by"),
        width: 30,
      },
      {
        header: c.var.t("disposal_shipment.label.xls.updated_on"),
        width: 30,
      },
      {
        header: c.var.t("disposal_shipment.label.xls.service_type"),
        width: 30,
      },
      {
        header: c.var.t("disposal_shipment.label.xls.no_document"),
        width: 30,
      },
      {
        header: c.var.t("disposal_shipment.label.xls.comment_shipped"),
        width: 30,
      },
      {
        header: c.var.t("disposal_shipment.label.xls.comment_fulfilled"),
        width: 30,
      },
      {
        header: c.var.t("disposal_shipment.label.xls.cancelled_at"),
        width: 30,
      },
      {
        header: c.var.t("disposal_shipment.label.xls.fulfilled_at"),
        width: 30,
      },
      {
        header: c.var.t("disposal_shipment.label.xls.shipped_at"),
        width: 30,
      },
    ])
    const { data } = await this.repo.listShipments(c, query, false)

    if (data.length === 0) return await excelTemplate.generate()

    await excelTemplate.addRows(
      title,
      data.map((shipment: any, index: number) => ({
        No: index + 1,
        order_id: `KPM-${shipment.id}`,
        status: this.repo.getStatusLabel(shipment.status),
        customer_name: shipment.customer?.name || "",
        vendor_name: shipment.vendor?.name || "",
        activity_name: shipment.activity?.name || "",
        ureated_by:
          `${shipment.user_created_by?.firstname || ""} ${shipment.user_created_by?.lastname || ""}`.trim(),
        created_on: moment(shipment.created_at)
          .local()
          .format("YYYY-MM-DD HH:mm"),
        updated_on: moment(shipment.updated_at)
          .local()
          .format("YYYY-MM-DD HH:mm"),
        updated_by:
          `${shipment.user_updated_by?.firstname || ""} ${shipment.user_updated_by?.lastname || ""}`.trim(),
        service_type: shipment.service_type || "",
        no_document: shipment.no_document || "",
        comment_shipped:
          shipment.disposal_comments?.find(
            (c: any) => c.disposal_shipment_status === 4
          )?.comment || "",
        comment_fulfilled:
          shipment.disposal_comments?.find(
            (c: any) => c.disposal_shipment_status === 5
          )?.comment || "",
        cancelled_at:
          moment(shipment.cancelled_at).local().format("YYYY-MM-DD HH:mm") ||
          "",
        Fulfilled_at:
          moment(shipment.fulfilled_at).local().format("YYYY-MM-DD HH:mm") ||
          "",
        shipped_at:
          moment(shipment.shipped_at).local().format("YYYY-MM-DD HH:mm") || "",
      }))
    )

    return await excelTemplate.generate()
  }

  // Get Disposal Shipment Detail
  async detail(c: any, id: number) {
    const detail = await this.repo.getShipmentDetail(c, id)
    if (!detail) {
      throw new NotFoundError("Disposal Shipment not found")
    }
    return detail
  }

  async comment(c: any, id: number, body: CommentShipmentRequest) {
    const detail = await this.repo.findOne(c, { id })
    if (!detail) {
      throw new NotFoundError("Disposal Shipment not found")
    }
    try {
      return await this.repo.commentShipment(
        c,
        id,
        body,
        Number(c.var.userId),
        detail.status
      )
    } catch (error) {
      throw new ValidationError("Commnet Disposal Shipment not found")
    }
  }

  // Download Memorandum
  async downloadMemorandum(c: any, id: number) {
    // Call repository to get detail, then generate memorandum file
    const detail = await this.repo.getShipmentDetail(c, id)
    if (!detail) {
      throw new ValidationError("Disposal Shipment not found")
    }

    const shipment = await this.repo.getShipmentDetail(c, id)

    if (!shipment) {
      throw new ValidationError("Disposal Shipment not found")
    }

    // Create Excel File
    const excelTemplate = new DetailShipmentExport()
    // Generate memorandum data structure
    const memorandumData = {
      no_ba_pemusnahan: shipment.no_document || `BA-${shipment.id}`,
      id_pemusnahan_smile: `KPM-${shipment.id}`,
      nama_fasilitas_kesehatan: shipment.vendor?.name || "",
      kota: shipment.vendor?.regency_name || "", // Use address as fallback for city
      provinsi: shipment.vendor?.province_name || "", // Use address as fallback for province
      kegiatan: shipment.activity?.name || "",
      materials:
        shipment.disposal_items?.map((item: any, index: number) => {
          return item.disposal_shipment_stocks.map((stock: any) => ({
            nama_material: item.master_material?.name,
            batch: stock.stock?.batch?.code,
            kuantitas: stock.disposal_discard_qty || 0,
            alasan_pemusnahan: stock.transaction_reasons?.title || "Unknown",
          }))
        }) || [],
      sender: {
        name: shipment.vendor?.name || "",
        address: shipment.vendor?.address || "",
        kota: shipment.vendor?.regency_name || "", // Use address as fallback for city
        provinsi: shipment.vendor?.province_name || "", // Use address as fallback for province
      },
      receiver: {
        name: shipment.customer?.name || "",
        address: shipment.customer?.address || "",
        kota: shipment.customer?.regency_name || "", // Use address as fallback for city
        provinsi: shipment.customer?.province_name || "", // Use address as fallback for province
      },
      created_at:
        shipment.created_at?.toISOString() || new Date().toISOString(),
      comments:
        shipment.disposal_comments
          ?.map((comment: any) => comment.comment)
          .join("; ") || "",
    }

    const sheetName = c.var.t("disposal_shipment.label.xls_detail.sheet")

    await excelTemplate.loadFile(c)
    excelTemplate.setTitle(
      `${c.var.t("disposal_shipment.label.xls_detail.title")} ${memorandumData.receiver.name ?? ""}`
    )
    excelTemplate.setTimezone(c.req.header("Timezone"))

    await excelTemplate.addRows(
      sheetName,
      [
        [memorandumData.no_ba_pemusnahan],
        [memorandumData.id_pemusnahan_smile],
        [memorandumData.kegiatan],
        [""],
        [memorandumData.sender.name],
        [memorandumData.sender.kota],
        [memorandumData.sender.provinsi],
      ],
      6,
      "B"
    )

    await excelTemplate.addRows(
      sheetName,
      [
        [memorandumData.receiver.name],
        [memorandumData.receiver.kota],
        [memorandumData.receiver.provinsi],
      ],
      10,
      "D"
    )

    let count = 1
    const rows: RowType[][] = []

    memorandumData.materials.flat().forEach((item) => {
      const row = [
        count,
        item.nama_material,
        item.batch,
        item.kuantitas,
        item.alasan_pemusnahan,
      ]
      rows.push(row)
      count++
    })

    await excelTemplate.addRows(sheetName, rows, 16, "A", {
      border: true,
    })

    const footerIndex = 16 + rows.length + 1

    await excelTemplate.addRows(
      sheetName,
      [
        [c.var.t("disposal_shipment.label.xls_detail.information")],
        [memorandumData.comments],
      ],
      footerIndex,
      "A"
    )
    await excelTemplate.addRows(
      sheetName,
      [
        [
          c.var.t("disposal_shipment.label.xls_detail.first_party"),
          "",
          c.var.t("disposal_shipment.label.xls_detail.second_party"),
        ],
        [""],
        [""],
        [""],
        ["_______________", "", "_______________"],
      ],
      footerIndex + 2,
      "C"
    )

    await excelTemplate.addRows(
      sheetName,
      [
        [
          c.var.t("disposal_shipment.label.xls_detail.date"),
          moment(memorandumData.created_at).local().format("YYYY-MM-DD HH:mm"),
        ],
      ],
      footerIndex + 8,
      "B"
    )

    return excelTemplate.generate()
  }

  // Accept Disposal Shipment
  async accept(c: any, id: number, body: AcceptShipmentRequest) {
    const detail = await this.repo.findOne(c, { id })
    if (!detail) {
      throw new NotFoundError("Disposal Shipment not found")
    }

    await this.repo.acceptShipment(c, id, body, Number(c.var.userId))
    return { id }
  }

  // Cancel Disposal Shipment
  async cancel(c: any, id: number, body: CancelShipmentRequest) {
    const detail = await this.repo.findOne(c, { id })
    if (!detail) {
      throw new NotFoundError("Disposal Shipment not found")
    }

    await this.repo.cancelShipment(c, id, body, Number(c.var.userId))
    return { id }
  }
}
