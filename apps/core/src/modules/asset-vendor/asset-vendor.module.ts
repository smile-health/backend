import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { Context } from "hono"
import moment from "moment"
import { AssetVendorExport, AssetVendorTemplate } from "./asset-vendor.excel.js"
import { AssetVendorRepository } from "./asset-vendor.repository.js"
import {
  AddAssetVendorDTO,
  AddAssetVendorRequest,
  AuditAssetVendorDTO,
  EditAssetVendorDTO,
  EditAssetVendorRequest,
  GetAssetVendorsQueryParams,
  PartialAuditAssetVendorDTO,
} from "./asset-vendor.schema.js"

export class AssetVendorModule {
  constructor(private readonly repository: AssetVendorRepository) {}

  async create(c: Context, body: AddAssetVendorRequest) {
    const userId = Number(c.var.accountID)
    const currentDate = new Date()

    const auditData: AuditAssetVendorDTO = {
      created_by: userId,
      updated_by: userId,
      created_at: currentDate,
      updated_at: currentDate,
    }

    const assetVendorData: AddAssetVendorDTO = {
      ...body,
      ...auditData,
    }

    const assetVendor = await this.repository.create(c, assetVendorData)

    return { id: Number(assetVendor.insertId) }
  }

  async update(c: Context, id: number, body: EditAssetVendorRequest) {
    const userId = Number(c.var.accountID)
    const currentDate = new Date()

    const auditData: PartialAuditAssetVendorDTO = {
      updated_by: userId,
      updated_at: currentDate,
    }

    const assetVendorData: EditAssetVendorDTO = {
      ...body,
      ...auditData,
    }

    await this.repository.update(c, assetVendorData, { id: id })
  }

  async detail(c: Context, id: number) {
    const detail = await this.repository.getAssetVendorById(c, id)
    const result = this.setDetailFinalResponse(c, detail)

    return result
  }

  async list(c: Context, params: GetAssetVendorsQueryParams) {
    const { parentList, allList, total } =
      await this.repository.getListAssetVendor(c, params)

    const result = this.setListFinalResponse(c, parentList, allList)

    return new PaginatedResponse(params, result, total)
  }

  async template(c: Context) {
    const excelTemplate = new AssetVendorTemplate()
    const title = c.var.t("asset_vendor.template.name")
    excelTemplate.setTitle(title)
    excelTemplate.setTimezone(c.req.header("Timezone"))

    await excelTemplate.loadFile(c.var.t("asset_vendor.template.file"))

    return await excelTemplate.generate()
  }

  async export(c: Context, params: GetAssetVendorsQueryParams) {
    const excelTemplate = new AssetVendorExport()
    const title = c.var.t("asset_vendor.export.name")
    const timezone = c.req.header("Timezone")
    excelTemplate.setTitle(title)
    excelTemplate.setTimezone(timezone)

    await excelTemplate.initSheet(title)

    excelTemplate.setColumns([
      {
        header: c.var.t("asset_vendor.label.id"),
        width: 20,
      },
      {
        header: c.var.t("asset_vendor.label.name"),
        width: 30,
      },
      {
        header: c.var.t("asset_vendor.label.asset_vendor_type_name"),
        width: 30,
      },
      {
        header: c.var.t("asset_vendor.label.description"),
        width: 50,
      },
      {
        header: c.var.t("asset_vendor.label.updated_by"),
        width: 30,
      },
      {
        header: c.var.t("asset_vendor.label.updated_at"),
        width: 30,
      },
    ])

    const { parentList, allList } =
      await this.repository.getListAssetVendorWithoutPaginate(c, params)
    if (parentList.length === 0) return await excelTemplate.generate()

    const results = this.setListFinalResponse(c, parentList, allList)

    await excelTemplate.addRows(
      title,
      results.map((item) => ({
        id: item.id,
        name: item.name,
        asset_vendor_type_name: item.asset_vendor_type.name,
        description: item.description,
        updated_by: item.user_updated_by.fullname,
        updated_at: moment(item.updated_at)
          .tz(timezone)
          .format("YYYY-MM-DD HH:mm"),
      }))
    )

    return await excelTemplate.generate()
  }

  async import(c: Context, rows: AddAssetVendorRequest[]) {
    for (const row of rows) {
      await this.create(c, row)
    }

    const response = this.messageResponse(
      `created, total ${rows.length} rows have been created`
    )
    return response
  }

  private setListFinalResponse(c: Context, parentData, allData) {
    return parentData.map((item) => this.setMainResponse(c, item))
  }

  private setDetailFinalResponse(c: Context, data) {
    if (!data || data.length === 0) return null

    return this.setMainResponse(c, data[0])
  }

  private setMainResponse(c: Context, item) {
    return {
      id: item.id,
      name: item.name,
      description: item.description,
      created_at: item.created_at,
      updated_at: item.updated_at,
      asset_vendor_type: {
        id: item.asset_vendor_type_id,
        name: this.translateSmart(c, item.asset_vendor_type_name),
      },
      user_created_by: {
        id: item.user_created_id,
        username: item.user_created_username,
        firstname: item.user_created_firstname,
        lastname: item.user_created_lastname,
        fullname: item.user_created_fullname,
      },
      user_updated_by: {
        id: item.user_updated_id,
        username: item.user_updated_username,
        firstname: item.user_updated_firstname,
        lastname: item.user_updated_lastname,
        fullname: item.user_updated_fullname,
      },
    }
  }

  private translateSmart(c: Context, input: string) {
    const prefix = "asset_vendor_type.label."

    if (input.startsWith(prefix)) {
      return c.var.t(input)
    }

    const translated = c.var.t(prefix + input)

    if (translated !== prefix + input) {
      return translated
    }

    return input
  }

  private messageResponse(info: string) {
    return {
      success: true,
      message: `Data successfully ${info}`,
    }
  }
}
