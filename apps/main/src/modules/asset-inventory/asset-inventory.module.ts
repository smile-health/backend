import { Context } from "hono"
import { AssetInventoryRepository } from "./asset-inventory.repository.js"
import {
  AddAssetInventoryRequest,
  AddAssetInventoryDTO,
  AuditAssetInventoryDTO,
  EditAssetInventoryRequest,
  PartialAuditAssetInventoryDTO,
  EditAssetInventoryDTO,
  GetAssetInventorysQueryParams,
  EditStatusAssetInventoryRequest,
  EditStatusAssetInventoryDTO,
} from "./asset-inventory.schema.js"
import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { AssetInventoryExport } from "./asset-inventory.excel.js"
import moment from "moment"
import { USER_ROLE } from "@/common/constants/user.js"
import { DEVICE_TYPE } from "@/common/constants/device.js"
import { AssetInventoryService } from "./utils/asset-inventory.service.js"

export class AssetInventoryModule {
  constructor(private readonly repository: AssetInventoryRepository) {}

  async getListReminderNotif(c: Context) {
    return await this.repository.getAssetReachesMaintenance(c, 1000, 0)
  }

  async create(c: Context, body: AddAssetInventoryRequest) {
    const userId = Number(c.var.userId)
    const currentDate = new Date()

    const auditData: AuditAssetInventoryDTO = {
      created_by: userId,
      updated_by: userId,
      created_at: currentDate,
      updated_at: currentDate,
    }

    const assetInventoryData: AddAssetInventoryDTO = {
      ...body,
      ...auditData,
      program_id: c.get("programId"),
    }

    const assetInventory = await this.repository.create(c, assetInventoryData)

    const assetInventoryId = Number(assetInventory.insertId)

    return { id: assetInventoryId }
  }

  async update(c: Context, id: number, body: EditAssetInventoryRequest) {
    const userId = Number(c.var.userId)
    const currentDate = new Date()

    const auditData: PartialAuditAssetInventoryDTO = {
      updated_by: userId,
      updated_at: currentDate,
    }

    const newBody = await this.setUpdate(c, id, body)

    const assetInventoryData: EditAssetInventoryDTO = {
      ...newBody,
      ...auditData,
    }

    await this.repository.update(c, assetInventoryData, { id: id })
    
    // send notification if working status changed
    if (c.get("isWorkingStatusChanged")) {
      const assetInventoryService = new AssetInventoryService()
      assetInventoryService.sendStatusChangedNotification(
        c,
        id
      )
    }
  }

  async updateStatus(
    c: Context,
    id: number,
    body: EditStatusAssetInventoryRequest
  ) {
    const userId = Number(c.var.userId)
    const currentDate = new Date()

    const auditData: PartialAuditAssetInventoryDTO = {
      updated_by: userId,
      updated_at: currentDate,
    }

    const assetInventoryData: EditStatusAssetInventoryDTO = {
      ...body,
      ...auditData,
    }

    await this.repository.update(c, assetInventoryData, { id: id })
  }

  async detail(c: Context, id: number) {
    const detail = await this.repository.getAssetInventoryById(
      c,
      id,
      c.get("programId")
    )
    const result = detail ? this.setDetailResponse(c, detail) : undefined

    return result
  }

  async list(c: Context, params: GetAssetInventorysQueryParams) {
    const entityId = await this.getEntityByRole(c)

    const { list, total } = await this.repository.getListAssetInventory(
      c,
      c.get("programId"),
      params,
      entityId
    )

    const result = list.map((item) => this.setListResponse(c, item))

    return new PaginatedResponse(params, result, total)
  }

  async export(c: Context, params: GetAssetInventorysQueryParams) {
    const excelTemplate = new AssetInventoryExport()
    const title = c.var.t("asset_inventory.export.name")
    const timezone = c.req.header("Timezone")
    excelTemplate.setTitle(title)
    excelTemplate.setTimezone(timezone)

    await excelTemplate.initSheet(title)

    excelTemplate.setColumns([
      {
        header: c.var.t("asset_inventory.label.id"),
        width: 20,
      },
      {
        header: c.var.t("asset_inventory.label.serial_number"),
        width: 50,
      },
      {
        header: c.var.t("asset_inventory.label.asset_type_name"),
        width: 30,
      },
      {
        header: c.var.t("asset_inventory.label.manufacture_name"),
        width: 30,
      },
      {
        header: c.var.t("asset_inventory.label.working_status_name"),
        width: 30,
      },
      {
        header: c.var.t("asset_inventory.label.ownership_status"),
        width: 30,
      },
      {
        header: c.var.t("asset_inventory.label.ownership_qty"),
        width: 30,
      },
      {
        header: c.var.t("asset_inventory.label.status"),
        width: 30,
      },
      {
        header: c.var.t("asset_inventory.label.updated_by"),
        width: 30,
      },
      {
        header: c.var.t("asset_inventory.label.updated_at"),
        width: 30,
      },
    ])

    const entityId = await this.getEntityByRole(c)

    const list = await this.repository.getListAssetInventoryWithoutPaginate(
      c,
      c.get("programId"),
      params,
      entityId
    )

    if (list.length === 0) return await excelTemplate.generate()

    const results = list.map((item) => this.setListResponse(c, item))

    await excelTemplate.addRows(
      title,
      results.map((item) => ({
        id: item.id,
        name: this.setAssetInventoryName(item),
        asset_type_name: item.asset_type.name ?? item.other_asset_type_name,
        manufacture_name: item.manufacture.name ?? item.other_manufacture_name,
        working_status_name: item.working_status.name,
        ownership_status:
          item.ownership.id === 1
            ? c.var.t("asset_inventory.label.owned")
            : c.var.t("asset_inventory.label.borrowed"),
        ownership_qty: item.ownership.qty,
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
      return { id: 0, name: c.var.t("asset_inventory.label.inactive") }
    if (status === 1)
      return { id: 1, name: c.var.t("asset_inventory.label.active") }
    return null
  }

  private getOwnershipStatusObject(c: Context, status: number, qty: number) {
    if (status === 1)
      return { id: 1, name: c.var.t("asset_inventory.label.owned"), qty: qty }
    if (status === 2)
      return {
        id: 2,
        name: c.var.t("asset_inventory.label.borrowed"),
        qty: qty,
      }
    return null
  }

  private setListResponse(c: Context, item) {
    const response = {
      id: item.id,
      serial_number: item.serial_number,
      updated_at: item.updated_at,
      other_asset_model_name: item.other_asset_model_name,
      other_asset_type_name: item.other_asset_type_name,
      other_manufacture_name: item.other_manufacture_name,
      asset_model: {
        id: item.asset_model_id,
        name: item.asset_model_name,
        net_capacity: item.net_capacity,
        gross_capacity: item.gross_capacity,
      },
      asset_type: {
        id: item.asset_type_id,
        name: item.asset_type_name,
        min_temperature: item.min_temperature,
        max_temperature: item.max_temperature,
      },
      manufacture: {
        id: item.manufacture_id,
        name: item.manufacture_name,
      },
      working_status: {
        id: item.asset_working_status_id,
        name: this.translateSmart(
          c,
          item.asset_working_status_name,
          "asset_working_status.label"
        ),
      },
      entity: {
        id: item.entity_id,
        name: item.entity_name,
        is_puskesmas: item.entity_is_puskesmas,
      },
      province: {
        id: item.province_id,
        name: item.province_name,
      },
      regency: {
        id: item.regency_id,
        name: item.regency_name,
      },
      ownership: this.getOwnershipStatusObject(
        c,
        item.ownership_status,
        item.ownership_qty
      ),
      status: this.getStatusObject(c, item.status_id),
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

  private setDetailResponse(c: Context, item) {
    const response = {
      id: item.id,
      serial_number: item.serial_number,
      production_year: item.production_year,
      other_asset_model_name: item.other_asset_model_name,
      other_net_capacity: item.other_net_capacity,
      other_gross_capacity: item.other_gross_capacity,
      other_asset_type_name: item.other_asset_type_name,
      other_min_temperature: item.other_min_temperature,
      other_max_temperature: item.other_max_temperature,
      other_manufacture_name: item.other_manufacture_name,
      other_budget_source_name: item.other_budget_source_name,
      other_borrowed_from_entity_name: item.other_borrowed_from_entity_name,
      created_at: item.created_at,
      updated_at: item.updated_at,
      asset_model: {
        id: item.asset_model_id,
        name: item.asset_model_name,
        net_capacity: item.net_capacity,
        gross_capacity: item.gross_capacity,
      },
      asset_type: {
        id: item.asset_type_id,
        name: item.asset_type_name,
        min_temperature: item.min_temperature,
        max_temperature: item.max_temperature,
      },
      manufacture: {
        id: item.manufacture_id,
        name: item.manufacture_name,
      },
      working_status: {
        id: item.asset_working_status_id,
        name: this.translateSmart(
          c,
          item.asset_working_status_name,
          "asset_working_status.label"
        ),
      },
      entity: {
        id: item.entity_id,
        name: item.entity_name,
        is_puskesmas: item.entity_is_puskesmas,
      },
      entity_tag: {
        id: item.entity_tag_id,
        title: c.var.t(`entity_tag.label.${item.entity_tag_title}`),
      },
      province: {
        id: item.province_id,
        name: item.province_name,
      },
      regency: {
        id: item.regency_id,
        name: item.regency_name,
      },
      sub_district: {
        id: item.sub_district_id,
        name: item.sub_district_name,
      },
      village: {
        id: item.village_id,
        name: item.village_name,
      },
      contact_person: {
        first: {
          name: item.contact_person_user_1_name,
          number: item.contact_person_user_1_number,
        },
        second: {
          name: item.contact_person_user_2_name,
          number: item.contact_person_user_2_number,
        },
        third: {
          name: item.contact_person_user_3_name,
          number: item.contact_person_user_3_number,
        },
      },
      ownership: this.getOwnershipStatusObject(
        c,
        item.ownership_status,
        item.ownership_qty
      ),
      borrowed_from: {
        id: item.borrowed_from_entity_id,
        name: item.borrowed_from_entity_name,
      },
      budget_source: {
        id: item.budget_source_id,
        name: item.budget_source_name,
        year: item.budget_year,
      },
      electricity: {
        id: item.asset_electricity_id,
        name: this.translateSmart(
          c,
          item.asset_electricity_name,
          "asset_electricity.label"
        ),
      },
      warranty: {
        asset_vendor_id: item.warranty_asset_vendor_id,
        asset_vendor_name: item.warranty_asset_vendor_name,
        start_date: item.warranty_start_date,
        end_date: item.warranty_end_date,
      },
      calibration: {
        asset_vendor_id: item.calibration_asset_vendor_id,
        asset_vendor_name: item.calibration_asset_vendor_name,
        last_date: item.calibration_last_date,
        schedule_id: item.calibration_schedule_id,
        name: this.translateSmart(
          c,
          item.calibration_schedule_name,
          "asset_calibration_schedule.label"
        ),
      },
      maintenance: {
        asset_vendor_id: item.maintenance_asset_vendor_id,
        asset_vendor_name: item.maintenance_asset_vendor_name,
        last_date: item.maintenance_last_date,
        schedule_id: item.maintenance_schedule_id,
        name: this.translateSmart(
          c,
          item.maintenance_schedule_name,
          "asset_maintenance_schedule.label"
        ),
      },
      status: this.getStatusObject(c, item.status),
      programs: {
        id: item.program_id,
        key: item.program_key,
        name: item.program_name,
        config: item.program_config,
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
    return response
  }

  private translateSmart(c: Context, input: string | null, prefix: string) {
    if (!input) return input

    if (input.startsWith(prefix)) {
      return c.var.t(input)
    }

    const translated = c.var.t(prefix + input)

    if (translated !== prefix + input) {
      return translated
    }

    return input
  }

  private async setUpdate(c: Context, id: number, body) {
    const assetInventory = await this.repository.getAssetInventoryById(
      c,
      id,
      c.get("programId")
    )

    if (!body.asset_model_id && assetInventory.asset_model_id) {
      body.asset_model_id = null
    }

    if (!body.asset_type_id && assetInventory.asset_type_id) {
      body.asset_type_id = null
    }

    if (!body.manufacture_id && assetInventory.manufacture_id) {
      body.manufacture_id = null
    }

    if (!body.budget_source_id && assetInventory.budget_source_id) {
      body.budget_source_id = null
    }

    if (
      !body.borrowed_from_entity_id &&
      assetInventory.borrowed_from_entity_id
    ) {
      body.borrowed_from_entity_id = null
    }

    if (!body.other_asset_model_name && assetInventory.other_asset_model_name) {
      body.other_asset_model_name = null
    }

    if (!body.other_net_capacity && assetInventory.other_net_capacity) {
      body.other_net_capacity = null
    }

    if (!body.other_gross_capacity && assetInventory.other_gross_capacity) {
      body.other_gross_capacity = null
    }

    if (!body.other_asset_type_name && assetInventory.other_asset_type_name) {
      body.other_asset_type_name = null
    }

    if (!body.other_min_temperature && assetInventory.other_min_temperature) {
      body.other_min_temperature = null
    }

    if (!body.other_max_temperature && assetInventory.other_max_temperature) {
      body.other_max_temperature = null
    }

    if (!body.other_manufacture_name && assetInventory.other_manufacture_name) {
      body.other_manufacture_name = null
    }

    if (
      !body.other_budget_source_name &&
      assetInventory.other_budget_source_name
    ) {
      body.other_budget_source_name = null
    }

    if (
      !body.other_borrowed_from_entity_name &&
      assetInventory.other_borrowed_from_entity_name
    ) {
      body.other_borrowed_from_entity_name = null
    }

    if (
      body.asset_working_status_id &&
      body.asset_working_status_id !== assetInventory.asset_working_status_id
    ) {
      c.set("isWorkingStatusChanged", true)
    }

    return body
  }

  private setAssetInventoryName(item) {
    const assetModelName = item.asset_model.name ?? item.other_asset_model_name
    const manufactureName = item.manufacture.name ?? item.other_manufacture_name
    const name = `${item.serial_number} - ${assetModelName} - ${manufactureName}`
    return name
  }

  private async getEntityByRole(c: Context) {
    const { userEntity, deviceType, programId, roleId } = c.var

    let entityId: number | number[]

    if (
      roleId === USER_ROLE.MANAGER &&
      deviceType === DEVICE_TYPE.web &&
      userEntity.type === 1 &&
      userEntity.province_id
    ) {
      const entities = await this.repository.getEntityByProvince(
        c,
        programId,
        userEntity.province_id
      )

      entityId = entities.map((item) => item.id)
    }

    if (
      roleId === USER_ROLE.MANAGER &&
      deviceType === DEVICE_TYPE.web &&
      userEntity.type === 2 &&
      userEntity.regency_id
    ) {
      const entities = await this.repository.getEntityByRegency(
        c,
        programId,
        userEntity.regency_id
      )

      entityId = entities.map((item) => item.id)
    }

    if (deviceType === DEVICE_TYPE.mobile) {
      entityId = userEntity.id
    }

    return entityId
  }
}
