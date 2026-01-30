import { DEVICE_TYPE } from "@/common/constants/device.js"
import { STATUS } from "@/common/constants/general.js"
import { USER_ROLE } from "@/common/constants/user.js"
import {
  AssetInventories,
  ContactPersons,
} from "@/common/infrastructure/database/types/db.js"
import {
  BadRequestError,
  NotFoundError,
  ValidationError,
} from "@smile-health/lib/error.js"
import { PaginatedResponse } from "@smile-health/lib/types/paginate.js"
import { collect } from "@smile-health/lib/utils.js"
import { Context } from "hono"
import { Insertable, Updateable } from "kysely"
import moment from "moment"
import { IntegrationRepository } from "../integration/integration.repository.js"
import { canSyncAsset } from "../integration/integration.schema.js"
import { WorkspaceRepository } from "../workspace/workspace.repository.js"
import { AssetInventoryExport } from "./asset-inventory.excel.js"
import { AssetInventoryRepository } from "./asset-inventory.repository.js"
import {
  AddAssetInventoryRequest,
  DeleteAssetInventoryRequest,
  EditAssetInventoryRequest,
  EditStatusAssetInventoryDTO,
  EditStatusAssetInventoryRequest,
  GetAssetInventoryQueryParams,
  PartialAuditAssetInventoryDTO,
  SyncAssetInventoryDTO,
} from "./asset-inventory.schema.js"
import { AssetInventoryService } from "./utils/asset-inventory.service.js"

export class AssetInventoryModule {
  constructor(
    private readonly repository: AssetInventoryRepository,
    private readonly integrationRepo: IntegrationRepository,
    private readonly workspaceRepo: WorkspaceRepository
  ) {}

  async getListReminderNotif(c: Context) {
    return await this.repository.getAssetReachesMaintenance(c, 1000, 0)
  }

  async create(c: Context, body: AddAssetInventoryRequest) {
    const userId = Number(c.var.accountID)
    const currentDate = new Date()
    const { program_ids, ...rest } = body
    const payload: Insertable<AssetInventories> = {
      asset_model_id: rest.asset_model_id,
      asset_type_id: rest.asset_type_id,
      borrowed_from_entity_id: rest.borrowed_from_entity_id,
      budget_source_id: rest.budget_source_id,
      budget_year: rest.budget_year,
      calibration_asset_vendor_id: rest.calibration_asset_vendor_id,
      calibration_last_date: rest.calibration_last_date,
      calibration_schedule_id: rest.calibration_schedule_id,
      electricity_id: rest.asset_electricity_id,
      entity_id: rest.entity_id,
      maintenance_asset_vendor_id: rest.maintenance_asset_vendor_id,
      maintenance_last_date: rest.maintenance_last_date,
      maintenance_schedule_id: rest.maintenance_schedule_id,
      manufacture_id: rest.manufacture_id,
      other_asset_budget_source_name: rest.other_budget_source_name,
      other_asset_manufacture_name: rest.other_manufacture_name,
      other_asset_model_name: rest.other_asset_model_name,
      other_asset_type_name: rest.other_asset_type_name,
      other_borrowed_from_entity_name: rest.other_borrowed_from_entity_name,
      ownership_qty: rest.ownership_qty,
      ownership_status: rest.ownership_status,
      production_year: rest.production_year,
      serial_number: rest.serial_number,
      status: STATUS.ACTIVE,
      warranty_asset_vendor_id: body.warranty_asset_vendor_id,
      warranty_end_date: body.warranty_end_date,
      warranty_start_date: body.warranty_start_date,
      working_status_id: body.asset_working_status_id,
      asset_model_temperature_capacity_id:
        await this.getModelTemperatureCapacity(
          c,
          body.asset_type_id,
          body.asset_model_id
        ),
      created_by: userId,
      updated_by: userId,
    }
    const assetInventory = await this.repository.create(c, payload)

    const assetInventoryId = Number(assetInventory.insertId)

    // Insert other capacities data
    if (
      rest.other_net_capacity !== undefined &&
      rest.other_gross_capacity !== undefined
    ) {
      await this.repository.createAssetInventoryOtherCapacities(c, {
        asset_inventory_id: assetInventoryId,
        gross: rest.other_gross_capacity,
        net: rest.other_net_capacity,
        max_temperature: rest.other_max_temperature,
        min_temperature: rest.other_min_temperature,
      })
    }

    await Promise.all([
      this.syncContactPersons(
        c,
        assetInventoryId,
        rest.contact_persons,
        userId,
        currentDate
      ),
      this.syncToThirdParty(c, assetInventoryId, rest, STATUS.ACTIVE, true),
      this.workspaceRepo.attachWithAssetInventoryID(
        c,
        assetInventoryId,
        program_ids ?? []
      ),
    ])

    return { id: assetInventoryId }
  }

  async update(c: Context, id: number, body: EditAssetInventoryRequest) {
    const userId = Number(c.var.accountID)
    const currentDate = new Date()

    const { program_ids, ...restBody } = body
    const parsedBody = await this.setUpdate(c, id, restBody)
    const payload: Updateable<AssetInventories> = {
      asset_model_id: parsedBody.asset_model_id,
      asset_type_id: parsedBody.asset_type_id,
      borrowed_from_entity_id: parsedBody.borrowed_from_entity_id,
      budget_source_id: parsedBody.budget_source_id,
      budget_year: parsedBody.budget_year,
      calibration_asset_vendor_id: parsedBody.calibration_asset_vendor_id,
      calibration_last_date: parsedBody.calibration_last_date,
      calibration_schedule_id: parsedBody.calibration_schedule_id,
      electricity_id: parsedBody.asset_electricity_id,
      entity_id: parsedBody.entity_id,
      maintenance_asset_vendor_id: parsedBody.maintenance_asset_vendor_id,
      maintenance_last_date: parsedBody.maintenance_last_date,
      maintenance_schedule_id: parsedBody.maintenance_schedule_id,
      manufacture_id: parsedBody.manufacture_id,
      other_asset_budget_source_name: parsedBody.other_budget_source_name,
      other_asset_manufacture_name: parsedBody.other_manufacture_name,
      other_asset_model_name: parsedBody.other_asset_model_name,
      other_asset_type_name: parsedBody.other_asset_type_name,
      other_borrowed_from_entity_name:
        parsedBody.other_borrowed_from_entity_name,
      ownership_qty: parsedBody.ownership_qty,
      ownership_status: parsedBody.ownership_status.toString(),
      production_year: parsedBody.production_year,
      serial_number: parsedBody.serial_number,
      status: STATUS.ACTIVE,
      warranty_asset_vendor_id: parsedBody.warranty_asset_vendor_id,
      warranty_end_date: parsedBody.warranty_end_date,
      warranty_start_date: parsedBody.warranty_start_date,
      working_status_id: parsedBody.asset_working_status_id,
      asset_model_temperature_capacity_id:
        await this.getModelTemperatureCapacity(
          c,
          body.asset_type_id,
          body.asset_model_id
        ),
      updated_by: userId,
      updated_at: currentDate,
    }

    // Handle other capacities update
    await Promise.all([
      this.repository.update(c, payload, { id: id }),
      this.syncContactPersons(
        c,
        id,
        parsedBody.contact_persons,
        userId,
        currentDate
      ),
      this.handleOtherCapacitiesUpdate(c, id, parsedBody),
      this.syncToThirdParty(c, id, restBody),
      this.workspaceRepo.attachWithAssetInventoryID(c, id, program_ids ?? []),
    ])

    // send notification if working status changed
    if (c.get("isWorkingStatusChanged")) {
      const assetInventoryService = new AssetInventoryService()
      assetInventoryService.sendStatusChangedNotification(c, id)
    }
  }

  private async syncContactPersons(
    c: Context,
    assetInventoryId: number,
    contactPersons: { name: string; phone: string }[],
    userId: number,
    currentDate: Date
  ) {
    // Delete old contact persons
    await this.repository.deleteContactPersons(
      c,
      assetInventoryId,
      "asset_inventory"
    )

    // Insert new contact persons
    for (const person of contactPersons) {
      const contactPersonPayload: Insertable<ContactPersons> = {
        name: person.name,
        phone: person.phone,
        source_id: assetInventoryId,
        source_type: "asset_inventory",
        created_by: userId,
        updated_by: userId,
        created_at: currentDate,
        updated_at: currentDate,
      }
      await this.repository.createContactPerson(c, contactPersonPayload)
    }
  }

  async updateStatus(
    c: Context,
    id: number,
    body: EditStatusAssetInventoryRequest
  ) {
    const userId = Number(c.var.accountID)
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

    const assetInventory = await this.repository.getAssetInventoryById(c, id)
    if (!assetInventory) throw new NotFoundError()

    await this.syncToThirdParty(
      c,
      id,
      {
        entity_id: assetInventory.entity_id,
        other_asset_type_name: assetInventory.other_asset_type_name,
        asset_type_id: assetInventory.asset_type_id,
        asset_working_status_id: assetInventory.working_status_id,
      },
      assetInventory.status
    )
  }

  async delete(c: Context, id: number, body: DeleteAssetInventoryRequest) {
    await this.repository.deleteAssetInventory(c, id, body.reason)
  }

  async getAssetInventoryRtmds(c: Context, assetInventoryId: number) {
    const rtmds = await this.repository.getAssetInventoryRtmds(
      c,
      assetInventoryId
    )
    return { data: rtmds }
  }

  async syncAssetInventoryRtmds(
    c: Context,
    assetInventoryId: number,
    rtmdAssignments: Array<{
      id: number
      sensor_qty?: number
      description?: string
    }>
  ) {
    try {
      for (const assignment of rtmdAssignments) {
        const hasSensorQty =
          assignment.sensor_qty !== undefined && assignment.sensor_qty !== null
        const hasDescription =
          assignment.description !== undefined &&
          assignment.description !== null &&
          assignment.description !== ""

        if (
          (hasSensorQty && hasDescription) ||
          (!hasSensorQty && !hasDescription)
        ) {
          throw new ValidationError(
            c.var.t("asset_inventory.rtmd.validation.sensor_qty_or_description")
          )
        }
      }

      await this.repository.syncAssetInventoryRtmds(
        c,
        assetInventoryId,
        rtmdAssignments
      )
    } catch (error: unknown) {
      const err = error as { code: string }
      if (err.code === "ER_DUP_ENTRY")
        throw new ValidationError(c.var.t("common.duplicate"))
      throw new BadRequestError()
    }
  }

  async detail(c: Context, id: number) {
    const [detail, programs, warehouseAssetTypeIds] = await Promise.all([
      this.repository.getAssetInventoryById(c, id),
      this.workspaceRepo.getByFromMappedWorkspace(c, "asset_inventory", id),
      this.repository.getWarehouseAssetTypeIds(c),
    ])

    return this.setDetailResponse(
      c,
      {
        ...detail,
        is_warehouse:
          detail && warehouseAssetTypeIds.includes(detail.asset_type_id)
            ? 1
            : 0,
      },
      programs
    )
  }

  async list(c: Context, params: GetAssetInventoryQueryParams) {
    const entityId = await this.getEntityByRole(c)

    const { list, total } = await this.repository.getListAssetInventory(
      c,
      params,
      entityId
    )

    const programs = await this.workspaceRepo.getByFromMappedWorkspace(
      c,
      "asset_inventory",
      collect(list, "id")
    )

    const warehouseAssetTypeIds =
      await this.repository.getWarehouseAssetTypeIds(c)

    const result = list.map((item) =>
      this.setListResponse(
        c,
        {
          ...item,
          is_warehouse: warehouseAssetTypeIds.includes(item.asset_type_id)
            ? 1
            : 0,
        },
        programs
      )
    )

    return new PaginatedResponse(params, result, total)
  }

  async export(c: Context, params: GetAssetInventoryQueryParams) {
    const excelTemplate = new AssetInventoryExport()
    const title = c.var.t("asset_inventory.export.name")
    const timezone = c.req.header("Timezone") ?? "UTC"

    excelTemplate.setTitle(title)
    excelTemplate.setTimezone(timezone)
    excelTemplate.setLanguage(c.var.language)
    await excelTemplate.loadFile()

    const entityId = await this.getEntityByRole(c)
    const list = await this.repository.getListAssetInventoryWithoutPaginate(
      c,
      params,
      entityId
    )

    if (list.length === 0) return await excelTemplate.generate()

    const [mapTemperatures, mapRtmds] = await Promise.all([
      this.repository.getMapTemperatureData(c, collect(list, "asset_model_id")),
      this.repository.getMapRtmdData(c, collect(list, "id")),
    ])

    await excelTemplate.setAssetInventoryData(
      list.map((item) => {
        return {
          entity_type: item.entity_type || "",
          subdistrict: item.sub_district_name || "",
          district_regency: item.regency_name || "",
          province: item.province_name || "",
          entity_id: item.entity_id || "",
          entity_name: item.entity_name || "",
          asset_id: item.id || "",
          serial_number: item.serial_number || "",
          model: item.asset_model_name || item.other_asset_model_name || "",
          manufacture: item.manufacture_name || "",
          asset_type: item.asset_type_name || item.other_asset_type_name || "",
          asset_status: item.asset_working_status_name
            ? c.var.t(item.asset_working_status_name)
            : "",
          amount_owned: item.ownership_qty || "",
          electricity: item.electricity_name
            ? c.var.t(item.electricity_name)
            : "",
          budget_year: item.budget_year || "",
          budget_source: item.budget_source_name || "",
          edit_time: item.updated_at
            ? moment(item.updated_at).tz(timezone).format("YYYY-MM-DD HH:mm")
            : "",
          number_of_ownership:
            item.ownership_status === 1
              ? c.var.t("asset_inventory.label.owned")
              : c.var.t("asset_inventory.label.borrowed"),
          latitude: item.entity_lat || "",
          longitude: item.entity_lng || "",
          warranty_start_date: item.warranty_start_date
            ? moment(item.warranty_start_date).tz(timezone).format("YYYY-MM-DD")
            : "",
          warranty_end_date: item.warranty_end_date
            ? moment(item.warranty_end_date).tz(timezone).format("YYYY-MM-DD")
            : "",
          warranty_vendor: item.warranty_asset_vendor_name || "",
          maintenance_schedule: item.maintenance_schedule_name
            ? c.var.t(item.maintenance_schedule_name)
            : "",
          last_maintenance: item.maintenance_last_date
            ? moment(item.maintenance_last_date)
                .tz(timezone)
                .format("YYYY-MM-DD")
            : "",
          maintenance_vendor: item.maintenance_asset_vendor_name || "",
          calibration_schedule: item.calibration_schedule_name
            ? c.var.t(item.calibration_schedule_name)
            : "",
          last_calibration: item.calibration_last_date
            ? moment(item.calibration_last_date)
                .tz(timezone)
                .format("YYYY-MM-DD")
            : "",
          calibration_vendor: item.calibration_asset_vendor_name || "",
        }
      })
    )

    const formatTemperature = (temperature: number) => {
      return temperature >= 0 ? `${temperature}°C` : `(${temperature}°C)`
    }
    const formatTemperatureRange = (data?: {
      min_temperature: number | null
      max_temperature: number | null
    }) => {
      if (!data || (!data.min_temperature && !data.max_temperature)) {
        return ""
      }

      return `${formatTemperature(data.min_temperature || 0)} - ${formatTemperature(data.max_temperature || 0)}`
    }

    await excelTemplate.setMasterData(
      list.map((item) => {
        const temperatures = mapTemperatures[item.asset_model_id ?? 0] ?? []

        return {
          entity_id: item.entity_id || "",
          entity_name: item.entity_name || "",
          province: item.province_name || "",
          district_regency: item.regency_name || "",
          subdistrict: item.sub_district_name || "",
          entity_type: item.entity_type || "",
          asset_id: item.id || "",
          serial_number: item.serial_number || "",
          model: item.asset_model_name || item.other_asset_model_name || "",
          manufacture: item.manufacture_name || "",
          asset_type: item.asset_type_name || item.other_asset_type_name || "",
          gross_capacity_1: temperatures[0]?.gross_capacity || "",
          nett_capacity_1: temperatures[0]?.net_capacity || "",
          gross_capacity_2: temperatures[1]?.gross_capacity || "",
          nett_capacity_2: temperatures[1]?.net_capacity || "",
          gross_capacity_3: temperatures[2]?.gross_capacity || "",
          nett_capacity_3: temperatures[2]?.net_capacity || "",
          pqs_code: item.pqs_code || "",
          pqs_type: item.pqs_type || "",
          min_max_temperature_1: formatTemperatureRange(temperatures[0]),
          min_max_temperature_2: formatTemperatureRange(temperatures[1]),
          min_max_temperature_3: formatTemperatureRange(temperatures[2]),
          asset_status: item.asset_working_status_name
            ? c.var.t(item.asset_working_status_name)
            : "",
          amount_owned: item.ownership_qty || "",
          electricity: item.electricity_name
            ? c.var.t(item.electricity_name)
            : "",
          budget_year: item.budget_year || "",
          budget_source: item.budget_source_name || "",
          edited_at: item.updated_at
            ? moment(item.updated_at).tz(timezone).format("YYYY-MM-DD HH:mm")
            : "",
          other_asset_type: item.other_asset_type_name || "",
          other_min_threshold: item.other_min_temperature || "",
          other_max_threshold: item.other_max_temperature || "",
          other_manufacture: item.other_asset_manufacture_name || "",
          other_asset_model: item.other_asset_model_name || "",
          production_date: item.production_year || "",
          other_budget_sources: item.other_asset_budget_source_name || "",
          other_nett_capacity: item.other_net_capacity || "",
          other_gross_capacity: item.other_gross_capacity || "",
          designation_cceigat: item.cceigat_description,
          warranty_start_date: item.warranty_start_date
            ? moment(item.warranty_start_date).tz(timezone).format("YYYY-MM-DD")
            : "",
          warranty_end_date: item.warranty_end_date
            ? moment(item.warranty_end_date).tz(timezone).format("YYYY-MM-DD")
            : "",
          warranty_vendor: item.warranty_asset_vendor_name || "",
          maintenance_schedule: item.maintenance_schedule_name
            ? c.var.t(item.maintenance_schedule_name)
            : "",
          last_maintenance: item.maintenance_last_date
            ? moment(item.maintenance_last_date)
                .tz(timezone)
                .format("YYYY-MM-DD")
            : "",
          maintenance_vendor: item.maintenance_asset_vendor_name || "",
          calibration_schedule: item.calibration_schedule_name
            ? c.var.t(item.calibration_schedule_name)
            : "",
          last_calibration: item.calibration_last_date
            ? moment(item.calibration_last_date)
                .tz(timezone)
                .format("YYYY-MM-DD")
            : "",
          calibration_vendor: item.calibration_asset_vendor_name || "",
          serial_number_logger: mapRtmds[item.id]?.serial_number || "",
          model_logger: mapRtmds[item.id]?.model_name || "",
          manufacture_logger: mapRtmds[item.id]?.manufacture_name || "",
          last_updated_temperature: mapRtmds[item.id]?.temperature || "",
          last_temperature_update: mapRtmds[item.id]?.created_at
            ? moment(mapRtmds[item.id]?.created_at)
                .tz(timezone)
                .format("YYYY-MM-DD HH:mm")
            : "",
        }
      })
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

  private setListResponse(c: Context, item, programs) {
    const response = {
      id: item.id,
      serial_number: item.serial_number,
      updated_at: item.updated_at,
      other_asset_model_name: item.other_asset_model_name,
      other_asset_type_name: item.other_asset_type_name,
      other_manufacture_name: item.other_asset_manufacture_name,
      other_budget_source_name: item.other_asset_budget_source_name,
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
        is_warehouse: item.is_warehouse,
      },
      manufacture: {
        id: item.manufacture_id,
        name: item.manufacture_name,
      },
      working_status: {
        id: item.working_status_id,
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
      programs: programs[Number(item.id)] ?? [],
    }
    return response
  }

  private async setDetailResponse(c: Context, item, programs) {
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
      other_manufacture_name: item.other_asset_manufacture_name,
      other_budget_source_name: item.other_asset_budget_source_name,
      other_borrowed_from_entity_name: item.other_borrowed_from_entity_name,
      created_at: item.created_at,
      updated_at: item.updated_at,
      asset_model: {
        id: item.asset_model_id,
        name: item.asset_model_name,
        net_capacity: item.net_capacity,
        gross_capacity: item.gross_capacity,
        capacities: item.capacities || [],
      },
      asset_type: {
        id: item.asset_type_id,
        name: item.asset_type_name,
        min_temperature: item.min_temperature,
        max_temperature: item.max_temperature,
        temperature_thresholds: item.temperature_thresholds || [],
        is_warehouse: item.is_warehouse,
      },
      pqs_code: item.pqs_code_id
        ? {
            id: item.pqs_code_id,
            code: item.pqs_code_code,
          }
        : null,
      manufacture: {
        id: item.manufacture_id,
        name: item.manufacture_name,
      },
      working_status: {
        id: item.working_status_id,
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
      contact_persons: await this.repository.getContactPersonsBySource(
        c,
        item.id,
        "asset_inventory"
      ),
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
      programs: programs[Number(item.id)] ?? [],
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
    const assetInventory = await this.repository.getAssetInventoryById(c, id)

    if (!body.asset_model_id && assetInventory?.asset_model_id) {
      body.asset_model_id = null
    }

    if (!body.asset_type_id && assetInventory?.asset_type_id) {
      body.asset_type_id = null
    }

    if (!body.manufacture_id && assetInventory?.manufacture_id) {
      body.manufacture_id = null
    }

    if (!body.budget_source_id && assetInventory?.budget_source_id) {
      body.budget_source_id = null
    }

    if (
      !body.borrowed_from_entity_id &&
      assetInventory?.borrowed_from_entity_id
    ) {
      body.borrowed_from_entity_id = null
    }

    if (
      !body.other_asset_model_name &&
      assetInventory?.other_asset_model_name
    ) {
      body.other_asset_model_name = null
    }

    if (!body.other_net_capacity && assetInventory.other_net_capacity) {
      body.other_net_capacity = null
    }

    if (!body.other_gross_capacity && assetInventory.other_gross_capacity) {
      body.other_gross_capacity = null
    }

    if (!body.other_asset_type_name && assetInventory?.other_asset_type_name) {
      body.other_asset_type_name = null
    }

    if (!body.other_min_temperature && assetInventory?.other_min_temperature) {
      body.other_min_temperature = null
    }

    if (!body.other_max_temperature && assetInventory?.other_max_temperature) {
      body.other_max_temperature = null
    }

    if (
      !body.other_manufacture_name &&
      assetInventory?.other_asset_manufacture_name
    ) {
      body.other_manufacture_name = null
    }

    if (
      !body.other_budget_source_name &&
      assetInventory?.other_asset_budget_source_name
    ) {
      body.other_budget_source_name = null
    }

    if (
      !body.other_borrowed_from_entity_name &&
      assetInventory?.other_borrowed_from_entity_name
    ) {
      body.other_borrowed_from_entity_name = null
    }

    if (
      body.asset_working_status_id &&
      body.asset_working_status_id !== assetInventory?.working_status_id
    ) {
      c.set("isWorkingStatusChanged", true)
    }

    return body
  }

  private async handleOtherCapacitiesUpdate(
    c: Context,
    assetInventoryId: number,
    body: EditAssetInventoryRequest
  ) {
    // Check if any capacity fields are being updated
    const capacityFields = {
      gross: body.other_gross_capacity,
      net: body.other_net_capacity,
      max_temperature: body.other_max_temperature,
      min_temperature: body.other_min_temperature,
    }

    // Check if any capacity field is provided (not null/undefined)
    const hasCapacityData = Object.values(capacityFields).some(
      (value) => value !== null && value !== undefined
    )

    if (hasCapacityData) {
      // Check if there's existing capacity data
      const existingCapacityData =
        await this.repository.getAssetInventoryOtherCapacitiesByInventoryId(
          c,
          assetInventoryId
        )

      if (existingCapacityData) {
        // Update existing capacity data
        await this.repository.updateAssetInventoryOtherCapacities(
          c,
          assetInventoryId,
          capacityFields
        )
      } else {
        // Create new capacity data
        await this.repository.createAssetInventoryOtherCapacities(c, {
          asset_inventory_id: assetInventoryId,
          ...capacityFields,
        })
      }
    } else {
      // If all capacity fields are null/undefined, delete existing data
      const existingCapacityData =
        await this.repository.getAssetInventoryOtherCapacitiesByInventoryId(
          c,
          assetInventoryId
        )

      if (existingCapacityData) {
        await this.repository.deleteAssetInventoryOtherCapacities(
          c,
          assetInventoryId
        )
      }
    }
  }

  private async getEntityByRole(c: Context) {
    const { deviceType, role: roleId } = c.var
    const userEntity = await this.repository.getEntityById(c, c.var.entityId!)

    let entityId: number | number[]

    if (
      roleId === USER_ROLE.MANAGER &&
      deviceType === DEVICE_TYPE.web &&
      userEntity.type === 1 &&
      userEntity.province_id
    ) {
      const entities = await this.repository.getEntityByProvince(
        c,
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
        userEntity.regency_id
      )

      entityId = entities.map((item) => item.id)
    }

    if (deviceType === DEVICE_TYPE.mobile) {
      entityId = userEntity.id
    }

    return entityId
  }

  private async syncToThirdParty(
    c: Context,
    id: number,
    data: SyncAssetInventoryDTO,
    status = STATUS.ACTIVE,
    create = false
  ) {
    const entity = await this.repository.getEntityById(c, data.entity_id)
    if (!entity.client_id) return

    let assetTypeLabel = data.other_asset_type_name ?? ""
    if (data.asset_type_id) {
      const assetType = await this.repository.getAssetTypeById(
        c,
        data.asset_type_id
      )
      assetTypeLabel = assetType?.name ?? ""
    }

    const client = await this.integrationRepo.getClientByKey(
      c,
      entity.client_id
    )
    if (!client || !canSyncAsset(client)) return

    const today = new Date().toISOString().slice(0, 10)

    const res = await client.syncAsset(c.var.token, {
      id,
      healthcareFacilityId: data.entity_id!,
      assetTypeName: assetTypeLabel,
      assetWorkingStatusName: String(data.asset_working_status_id),
      status: status,
      createdAt: today,
      updatedAt: today,
      create,
    })

    if (res.response.error) {
      await this.integrationRepo.createLog({
        client_id: client.getId(),
        source_id: id,
        source_type: "asset_inventory",
        flow: "out",
        tag: `sync_asset`,
        request: JSON.stringify(res.request),
        response: JSON.stringify(res.response),
      })
    }
  }

  private async getModelTemperatureCapacity(
    c: Context,
    assetTypeId: number | null | undefined,
    assetModelId: number | null | undefined
  ) {
    const resultId =
      assetTypeId && assetModelId
        ? await this.repository.getModelTemperatureCapacityByAssetTypeAndModelId(
            c,
            assetTypeId,
            assetModelId
          )
        : null

    return resultId
  }
}
