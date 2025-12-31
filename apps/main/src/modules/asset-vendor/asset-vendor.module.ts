import { Context } from "hono"
import { AssetVendorRepository } from "./asset-vendor.repository.js"
import {
  GetAssetVendorsQueryParams,
  EditStatusAssetVendorRequest,
} from "./asset-vendor.schema.js"
import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { AssetVendorExport } from "./asset-vendor.excel.js"
import moment from "moment"

export class AssetVendorModule {
  constructor(private readonly repository: AssetVendorRepository) {}

  async updateStatus(
    c: Context,
    id: number,
    body: EditStatusAssetVendorRequest
  ) {
    const userId = this.getUserGlobalId(c)
    const currentDate = new Date()

    const auditData = {
      updated_by: userId,
      updated_at: currentDate,
    }

    const assetVendorWorkspaceData = {
      ...body,
      ...auditData,
    }

    await this.repository.updateAssetVendorWorkspaceById(
      c,
      id,
      c.get("programId"),
      assetVendorWorkspaceData
    )
  }

  async detail(c: Context, id: number) {
    const detail = await this.repository.getAssetVendorById(
      c,
      id,
      c.get("programId")
    )
    const result = detail ? this.setMainResponse(c, detail) : undefined
    return result
  }

  async list(c: Context, params: GetAssetVendorsQueryParams) {
    const { list, total } = await this.repository.getListAssetVendor(
      c,
      c.get("programId"),
      params
    )
    const result = list.map((item) => this.setMainResponse(c, item))
    return new PaginatedResponse(params, result, total)
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
        header: c.var.t("asset_vendor.label.status"),
        width: 30,
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

    const list = await this.repository.getListAssetVendorWithoutPaginate(
      c,
      c.get("programId"),
      params
    )
    if (list.length === 0) return await excelTemplate.generate()

    const results = list.map((item) => this.setMainResponse(c, item))

    await excelTemplate.addRows(
      title,
      results.map((item) => ({
        id: item.id,
        name: item.name,
        asset_vendor_type_name: item.asset_vendor_type.name,
        description: item.description,
        status: item.status.name,
        updated_by: item.user_updated_by.fullname,
        updated_at: moment(item.updated_at)
          .tz(timezone)
          .format("YYYY-MM-DD HH:mm"),
      }))
    )

    return await excelTemplate.generate()
  }

  private getStatusObject(c: Context, status: number) {
    if (status === 0)
      return { id: 0, name: c.var.t("asset_vendor.label.inactive") }
    if (status === 1)
      return { id: 1, name: c.var.t("asset_vendor.label.active") }
    return null
  }

  private setMainResponse(c: Context, item) {
    const response = {
      id: item.id,
      global_id: item.global_id,
      name: item.name,
      description: item.description,
      created_at: item.created_at,
      updated_at: item.updated_at,
      asset_vendor_type: {
        id: item.asset_vendor_type_id,
        name: this.translateSmart(c, item.asset_vendor_type_name),
      },
      status: this.getStatusObject(c, item.status_id),
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
    return response
  }

  private getUserGlobalId(c: Context) {
    const user = c.var.user as { global_id?: number }
    return Number(user?.global_id ?? 0)
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
}
