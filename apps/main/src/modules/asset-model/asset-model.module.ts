import { Context } from "hono"
import { AssetModelRepository } from "./asset-model.repository.js"
import {
  GetAssetModelsQueryParams,
  EditStatusAssetModelRequest,
} from "./asset-model.schema.js"
import { PaginatedResponse } from "@smile-health/lib/types/paginate.js"
import { AssetModelExport } from "./asset-model.excel.js"
import moment from "moment"

export class AssetModelModule {
  constructor(private readonly repository: AssetModelRepository) {}

  async updateStatus(
    c: Context,
    id: number,
    body: EditStatusAssetModelRequest
  ) {
    const userId = this.getUserGlobalId(c)
    const currentDate = new Date()

    const auditData = {
      updated_by: userId,
      updated_at: currentDate,
    }

    const assetModelWorkspaceData = {
      ...body,
      ...auditData,
    }

    await this.repository.updateAssetModelWorkspaceById(
      c,
      id,
      c.get("programId"),
      assetModelWorkspaceData
    )
  }

  async detail(c: Context, id: number) {
    const detail = await this.repository.getAssetModelById(
      c,
      id,
      c.get("programId")
    )
    const result = detail ? this.setMainResponse(c, detail) : undefined
    return result
  }

  async list(c: Context, params: GetAssetModelsQueryParams) {
    const { list, total } = await this.repository.getListAssetModel(
      c,
      c.get("programId"),
      params
    )
    const result = list.map((item) => this.setMainResponse(c, item))
    return new PaginatedResponse(params, result, total)
  }

  async export(c: Context, params: GetAssetModelsQueryParams) {
    const excelTemplate = new AssetModelExport()
    const title = c.var.t("asset_model.export.name")
    const timezone = c.req.header("Timezone")
    excelTemplate.setTitle(title)
    excelTemplate.setTimezone(timezone)

    await excelTemplate.initSheet(title)

    excelTemplate.setColumns([
      {
        header: c.var.t("asset_model.label.id"),
        width: 20,
      },
      {
        header: c.var.t("asset_model.label.name"),
        width: 30,
      },
      {
        header: c.var.t("asset_model.label.gross_capacity"),
        width: 30,
      },
      {
        header: c.var.t("asset_model.label.net_capacity"),
        width: 30,
      },
      {
        header: c.var.t("asset_model.label.asset_type_name"),
        width: 30,
      },
      {
        header: c.var.t("asset_model.label.manufacture_name"),
        width: 30,
      },
      {
        header: c.var.t("asset_model.label.status"),
        width: 30,
      },
      {
        header: c.var.t("asset_model.label.updated_by"),
        width: 30,
      },
      {
        header: c.var.t("asset_model.label.updated_at"),
        width: 30,
      },
    ])

    const list = await this.repository.getListAssetModelWithoutPaginate(
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
        gross_capacity: item.gross_capacity,
        net_capacity: item.net_capacity,
        asset_type_name: item.asset_type.name,
        manufacture_name: item.manufacture.name,
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
      return { id: 0, name: c.var.t("asset_model.label.inactive") }
    if (status === 1)
      return { id: 1, name: c.var.t("asset_model.label.active") }
    return null
  }

  private setMainResponse(c: Context, item) {
    const response = {
      id: item.id,
      global_id: item.global_id,
      name: item.name,
      net_capacity: item.net_capacity,
      gross_capacity: item.gross_capacity,
      created_at: item.created_at,
      updated_at: item.updated_at,
      asset_type: {
        id: item.asset_type_id,
        name: item.asset_type_name,
      },
      manufacture: {
        id: item.manufacture_id,
        name: item.manufacture_name,
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
}
