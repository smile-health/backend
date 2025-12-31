import { Context } from "hono"
import { AssetTypeRepository } from "./asset-type.repository.js"
import {
  GetAssetTypesQueryParams,
  EditStatusAssetTypeRequest,
} from "./asset-type.schema.js"
import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { AssetTypeExport } from "./asset-type.excel.js"
import moment from "moment"

export class AssetTypeModule {
  constructor(private readonly repository: AssetTypeRepository) {}

  async updateStatus(c: Context, id: number, body: EditStatusAssetTypeRequest) {
    const userId = this.getUserGlobalId(c)
    const currentDate = new Date()

    const auditData = {
      updated_by: userId,
      updated_at: currentDate,
    }

    const assetTypeWorkspaceData = {
      ...body,
      ...auditData,
    }

    await this.repository.updateAssetTypeWorkspaceById(
      c,
      id,
      c.get("programId"),
      assetTypeWorkspaceData
    )
  }

  async detail(c: Context, id: number) {
    const detail = await this.repository.getAssetTypeById(
      c,
      id,
      c.get("programId")
    )
    const result = detail ? this.setMainResponse(c, detail) : undefined
    return result
  }

  async list(c: Context, params: GetAssetTypesQueryParams) {
    const { list, total } = await this.repository.getListAssetType(
      c,
      c.get("programId"),
      params
    )
    const result = list.map((item) => this.setMainResponse(c, item))
    return new PaginatedResponse(params, result, total)
  }

  async export(c: Context, params: GetAssetTypesQueryParams) {
    const excelTemplate = new AssetTypeExport()
    const title = c.var.t("asset_type.export.name")
    const timezone = c.req.header("Timezone")
    excelTemplate.setTitle(title)
    excelTemplate.setTimezone(timezone)

    await excelTemplate.initSheet(title)

    excelTemplate.setColumns([
      {
        header: c.var.t("asset_type.label.id"),
        width: 20,
      },
      {
        header: c.var.t("asset_type.label.name"),
        width: 30,
      },
      {
        header: c.var.t("asset_type.label.temperature_range"),
        width: 30,
      },
      {
        header: c.var.t("asset_type.label.description"),
        width: 50,
      },
      {
        header: c.var.t("asset_type.label.status"),
        width: 30,
      },
      {
        header: c.var.t("asset_type.label.updated_by"),
        width: 30,
      },
      {
        header: c.var.t("asset_type.label.updated_at"),
        width: 30,
      },
    ])

    const list = await this.repository.getListAssetTypeWithoutPaginate(
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
        temperature_range: `${item.min_temperature}°C - ${item.max_temperature}°C`,
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
      return { id: 0, name: c.var.t("asset_type.label.inactive") }
    if (status === 1) return { id: 1, name: c.var.t("asset_type.label.active") }
    return null
  }

  private setMainResponse(c: Context, item) {
    const response = {
      id: item.id,
      global_id: item.global_id,
      name: item.name,
      min_temperature: item.min_temperature,
      max_temperature: item.max_temperature,
      description: item.description,
      created_at: item.created_at,
      updated_at: item.updated_at,
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
}
