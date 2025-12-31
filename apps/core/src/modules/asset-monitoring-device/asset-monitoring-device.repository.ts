import {
  ASSET_CLASSIFICATION,
  ASSET_MONITORING_DEVICE,
  CONTACT_PERSON_SOURCE_TYPE,
} from "@/common/constants/assets.js"
import { FLAG, STATUS } from "@/common/constants/general.js"
import { ValidationError } from "@smile/lib/error.js"
import { collect } from "@smile/lib/utils.js"
import { Context } from "hono"
import { sql } from "kysely"
import {
  AddAssetMonitoringDeviceRequest,
  RtmdListResponse as AssetMonitoringDeviceListResponse,
  RtmdResponse as AssetMonitoringDeviceResponse,
  DeviceExportItem,
  EditAssetMonitoringDeviceRequest,
  GetAssetMonitoringDevicesQueryParams,
} from "./asset-monitoring-device.schema.js"
// import { Selectable } from "kysely"

export class AssetMonitoringDeviceRepository {
  async create(
    c: Context,
    data: AddAssetMonitoringDeviceRequest & {
      created_by: number
      updated_by: number
    }
  ): Promise<number> {
    const trx = c.var.trx

    const result = await trx
      .insertInto("asset_rtmds")
      .values({
        asset_type_id: data.asset_type_id,
        asset_model_id: data.asset_model_id,
        manufacture_id: data.manufacture_id,
        asset_vendor_id: data.asset_vendor_id,
        asset_communication_provider_id: data.asset_communication_provider_id,
        serial_number: data.serial_number,
        production_year: data.production_year,
        asset_rtmd_status_id: data.asset_rtmd_status_id,
        entity_id: data.entity_id,
        budget_year: data.budget_year,
        budget_source_id: data.budget_source_id,
        status: data.status || STATUS.ACTIVE,
        created_by: data.created_by,
        updated_by: data.updated_by,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .executeTakeFirst()

    const deviceId = Number(result.insertId)

    if (data.contact_persons && data.contact_persons.length > 0) {
      for (const contactPerson of data.contact_persons) {
        await trx
          .insertInto("contact_persons")
          .values({
            name: contactPerson.name,
            phone: contactPerson.phone,
            source_id: deviceId,
            source_type: CONTACT_PERSON_SOURCE_TYPE.RTMD,
            created_by: data.created_by,
            updated_by: data.updated_by,
            created_at: new Date(),
            updated_at: new Date(),
          })
          .execute()
      }
    }

    return deviceId
  }

  async findById(
    c: Context,
    id: number,
    entityId?: number | number[]
  ): Promise<AssetMonitoringDeviceResponse | null> {
    let query = c.var.trx
      .selectFrom("asset_rtmds")
      .selectAll()
      .leftJoin(
        "asset_rtmd_statuses as ars",
        "ars.id",
        "asset_rtmds.asset_rtmd_status_id"
      )
      .leftJoin("asset_types as at", "at.id", "asset_rtmds.asset_type_id")
      .leftJoin("asset_models as am", "am.id", "asset_rtmds.asset_model_id")
      .leftJoin("manufactures as m", "m.id", "asset_rtmds.manufacture_id")
      .leftJoin("asset_vendors as av", "av.id", "asset_rtmds.asset_vendor_id")
      .leftJoin(
        "asset_vendors as communication_provider",
        "communication_provider.id",
        "asset_rtmds.asset_communication_provider_id"
      )
      .leftJoin("budget_sources as bs", "bs.id", "asset_rtmds.budget_source_id")
      .leftJoin("entities as e", "e.id", "asset_rtmds.entity_id")
      .leftJoin("entity_types", "entity_types.id", "e.type")
      .leftJoin("users as creator", "creator.id", "asset_rtmds.created_by")
      .leftJoin("users as updater", "updater.id", "asset_rtmds.updated_by")
      .leftJoin(
        "locations as province_locations",
        "province_locations.id",
        "e.province_id"
      )
      .leftJoin(
        "locations as regency_locations",
        "regency_locations.id",
        "e.regency_id"
      )
      .select([
        "asset_rtmds.id",
        "asset_rtmds.serial_number",
        "asset_rtmds.production_year",
        "asset_rtmds.budget_year",
        "asset_rtmds.status",
        "asset_rtmds.created_at",
        "asset_rtmds.updated_at",
        "asset_rtmds.created_by",
        "asset_rtmds.updated_by",
        "asset_rtmds.asset_rtmd_status_id",
        "ars.name as asset_rtmd_status_name",
        sql<{
          id: number
          name: string
        }>`JSON_OBJECT('id', ars.id, 'name', ars.name)`.as("asset_status"),
        sql<{
          id: number
          name: string
        }>`JSON_OBJECT('id', at.id, 'name', at.name)`.as("asset_type"),
        sql<{
          id: number
          name: string
        }>`JSON_OBJECT('id', am.id, 'name', am.name)`.as("asset_model"),
        sql<{
          id: number
          name: string
        }>`JSON_OBJECT('id', m.id, 'name', m.name)`.as("manufacturer"),
        sql<{
          id: number
          name: string
        }>`JSON_OBJECT('id', av.id, 'name', av.name)`.as("asset_vendor"),
        sql<{
          id: number
          name: string
        }>`JSON_OBJECT('id', communication_provider.id, 'name', communication_provider.name)`.as(
          "communication_provider"
        ),
        sql<{
          id: number
          name: string
        }>`JSON_OBJECT('id', bs.id, 'name', bs.name)`.as("budget_source"),
        sql<{
          id: number
          name: string
          entity_type_name?: string
          address?: string
          province_id?: string
          regency_id?: string
          province_name?: string
          regency_name?: string
        }>`JSON_OBJECT('id', e.id, 'name', e.name, 'entity_type_name', entity_types.name, 'address', e.address, 'province_id', e.province_id, 'regency_id', e.regency_id, 'province_name', province_locations.name, 'regency_name', regency_locations.name)`.as(
          "entity"
        ),
        sql<{
          id: number
          name: string
        }>`JSON_OBJECT('id', creator.id, 'name', COALESCE(CONCAT_WS(' ', creator.firstname, IFNULL(creator.lastname, '')), ''))`.as(
          "created_by"
        ),
        sql<{
          id: number
          name: string
        }>`JSON_OBJECT('id', updater.id, 'name', COALESCE(CONCAT_WS(' ', updater.firstname, IFNULL(updater.lastname, '')), ''))`.as(
          "updated_by"
        ),
      ])
      .where("asset_rtmds.id", "=", id)
      .where("asset_rtmds.deleted_at", "is", null)

    if (typeof entityId === "object" && entityId && entityId.length > 0) {
      query = query.where("e.id", "in", entityId)
    }

    if (typeof entityId === "number" && entityId) {
      query = query.where("e.id", "=", entityId)
    }

    const device = await query.executeTakeFirst()

    if (!device) {
      return null
    }

    const contactPersons = await c.var.trx
      .selectFrom("contact_persons")
      .selectAll()
      .where("source_id", "=", id)
      .where("source_type", "=", CONTACT_PERSON_SOURCE_TYPE.RTMD)
      .where("deleted_at", "is", null)
      .execute()

    return {
      id: device.id,
      serial_number: device.serial_number,
      production_year: device.production_year,
      budget_year: device.budget_year,
      created_at: device.created_at?.toISOString() || "",
      updated_at: device.updated_at?.toISOString() || "",
      rtmd_status: {
        id: device.asset_rtmd_status_id || 1,
        name: c.var.t(
          device.asset_rtmd_status_name || null,
          device.asset_rtmd_status_name || null
        ),
      },
      device_status: {
        id: device.status ?? STATUS.INACTIVE,
        name: c.var.t(
          device.status === STATUS.ACTIVE ? "common.active" : "common.inactive",
          device.status === STATUS.ACTIVE ? "Active" : "Inactive"
        ),
      },
      asset_type: device.asset_type,
      asset_model: device.asset_model,
      manufacturer: device.manufacturer,
      asset_vendor: device.asset_vendor,
      communication_provider: device.communication_provider,
      budget_source: device.budget_source,
      entity: device.entity,
      created_by: device.created_by as { id: number; name: string } | null,
      updated_by: device.updated_by as { id: number; name: string } | null,
      contact_persons: contactPersons.map((cp) => ({
        id: cp.id,
        name: cp.name,
        phone: cp.phone,
      })) as any,
    }
  }

  async list(
    c: Context,
    params: GetAssetMonitoringDevicesQueryParams,
    entityId?: number | number[]
  ) {
    try {
      const page = Number(params.page) || 1
      const itemPerPage = Number(params.paginate) || 10
      const offset = (page - 1) * itemPerPage

      const parseStringArray = (value: any): number[] => {
        if (!value) return []
        if (Array.isArray(value)) {
          return value
            .map((v) => (typeof v === "number" ? v : parseInt(v)))
            .filter((n) => !isNaN(n))
        }
        if (typeof value === "string") {
          let cleaned = value.replace(/^["']|["']$/g, "").trim()
          try {
            cleaned = decodeURIComponent(cleaned)
          } catch {
            // If URI decoding fails, continue with original value
          }
          if (!cleaned) return []
          return cleaned
            .split(",")
            .map((s) => parseInt(s.trim()))
            .filter((n) => !isNaN(n))
        }
        if (typeof value === "number") {
          return [value]
        }
        return []
      }

      let query = c.var.trx
        .selectFrom("asset_rtmds")
        .leftJoin(
          "asset_rtmd_statuses as ars",
          "ars.id",
          "asset_rtmds.asset_rtmd_status_id"
        )
        .leftJoin("asset_types as at", "at.id", "asset_rtmds.asset_type_id")
        .leftJoin("asset_models as am", "am.id", "asset_rtmds.asset_model_id")
        .leftJoin("manufactures as m", "m.id", "asset_rtmds.manufacture_id")
        .leftJoin("asset_vendors as av", "av.id", "asset_rtmds.asset_vendor_id")
        .leftJoin(
          "budget_sources as bs",
          "bs.id",
          "asset_rtmds.budget_source_id"
        )
        .leftJoin("entities as e", "e.id", "asset_rtmds.entity_id")
        .leftJoin("entity_types", "entity_types.id", "e.type")
        .leftJoin("users as creator", "creator.id", "asset_rtmds.created_by")
        .leftJoin("users as updater", "updater.id", "asset_rtmds.updated_by")
        .leftJoin(
          "locations as province_locations",
          "province_locations.id",
          "e.province_id"
        )
        .leftJoin(
          "locations as regency_locations",
          "regency_locations.id",
          "e.regency_id"
        )
        .select([
          "asset_rtmds.id",
          "asset_rtmds.serial_number",
          sql<string>`COALESCE(CAST(asset_rtmds.production_year AS CHAR), '')`.as(
            "production_year"
          ),
          "asset_rtmds.budget_year",
          "asset_rtmds.status",
          "asset_rtmds.asset_rtmd_status_id",
          "asset_rtmds.created_at",
          "asset_rtmds.updated_at",
          "asset_rtmds.created_by as created_by_id",
          "asset_rtmds.updated_by as updated_by_id",
          sql<string>`COALESCE(ars.name, NULL)`.as("logger_status"),
          sql<number>`CASE WHEN RAND() > 0.1 THEN 2 + RAND() * 10 ELSE NULL END`.as(
            "current_temp"
          ),
          sql<boolean>`CASE WHEN RAND() > 0.9 THEN 1 ELSE 0 END`.as(
            "is_offline"
          ),
          sql<string>`DATE_SUB(NOW(), INTERVAL FLOOR(RAND() * 60) MINUTE)`.as(
            "last_reading_at"
          ),
          sql<number>`60 + FLOOR(RAND() * 40)`.as("battery_percent"),
          sql<number>`60 + FLOOR(RAND() * 40)`.as("signal_strength"),
          sql<boolean>`CASE WHEN RAND() > 0.2 THEN 1 ELSE 0 END`.as(
            "is_power_available"
          ),
          sql<{
            id: number
            name: string
          }>`JSON_OBJECT('id', at.id, 'name', at.name)`.as("asset_type"),
          sql<{
            id: number
            name: string
          }>`JSON_OBJECT('id', am.id, 'name', am.name)`.as("asset_model"),
          sql<{
            id: number
            name: string
          }>`JSON_OBJECT('id', m.id, 'name', m.name)`.as("manufacturer"),
          sql<{
            id: number
            name: string
          }>`JSON_OBJECT('id', av.id, 'name', av.name)`.as("asset_vendor"),
          sql<{
            id: number
            name: string
          }>`JSON_OBJECT('id', bs.id, 'name', bs.name)`.as("budget_source"),
          sql<{
            id: number
            name: string
            entity_type_name?: string
            province_id?: string
            regency_id?: string
            province_name?: string
            regency_name?: string
          }>`JSON_OBJECT('id', e.id, 'name', e.name, 'entity_type_name', entity_types.name, 'province_id', e.province_id, 'regency_id', e.regency_id, 'province_name', province_locations.name, 'regency_name', regency_locations.name)`.as(
            "entity"
          ),
          sql<string>`COALESCE(CONCAT_WS(' ', creator.firstname, IFNULL(creator.lastname, '')), '')`.as(
            "created_by_name"
          ),
          sql<string>`COALESCE(CONCAT_WS(' ', updater.firstname, IFNULL(updater.lastname, '')), '')`.as(
            "updated_by_name"
          ),
        ])
        .where("asset_rtmds.deleted_at", "is", null)

      if (typeof entityId === "object" && entityId && entityId.length > 0) {
        query = query.where("e.id", "in", entityId)
      }

      if (typeof entityId === "number" && entityId) {
        query = query.where("e.id", "=", entityId)
      }

      if (params.manufacture_ids) {
        const manufactureIds = parseStringArray(params.manufacture_ids)
        if (manufactureIds.length > 0) {
          query = query.where(
            "asset_rtmds.manufacture_id",
            "in",
            manufactureIds
          )
        }
      }

      if (params.asset_model_ids) {
        const assetModelIds = parseStringArray(params.asset_model_ids)
        if (assetModelIds.length > 0) {
          query = query.where("asset_rtmds.asset_model_id", "in", assetModelIds)
        }
      }

      if (params.rtmd_status_id) {
        query = query.where(
          "asset_rtmds.asset_rtmd_status_id",
          "=",
          parseInt(params.rtmd_status_id)
        )
      }

      if (params.device_status_id) {
        query = query.where(
          "asset_rtmds.status",
          "=",
          parseInt(params.device_status_id)
        )
      }

      const queryParams = params as any
      if (queryParams.entity_id) {
        query = query.where(
          "asset_rtmds.entity_id",
          "=",
          parseInt(queryParams.entity_id)
        )
      }

      query = query.$if(params.is_device_related !== undefined, (eb) =>
        eb.where(
          "asset_rtmds.id",
          params.is_device_related === FLAG.TRUE ? "in" : "not in",
          c.var.trx.selectFrom("asset_inventory_rtmds").select("asset_rtmd_id")
        )
      )

      if (queryParams.budget_source_id) {
        query = query.where(
          "asset_rtmds.budget_source_id",
          "=",
          parseInt(queryParams.budget_source_id)
        )
      }

      if (queryParams.production_year) {
        query = query.where(
          "asset_rtmds.production_year",
          "=",
          parseInt(queryParams.production_year)
        )
      }

      if (queryParams.budget_year) {
        query = query.where(
          "asset_rtmds.budget_year",
          "=",
          parseInt(queryParams.budget_year)
        )
      }

      if (params.province_id) {
        query = query.where("e.province_id", "=", params.province_id)
      }

      if (params.city_id) {
        query = query.where("e.regency_id", "=", params.city_id)
      }

      if (params.health_center_id) {
        query = query.where(
          "asset_rtmds.entity_id",
          "=",
          parseInt(params.health_center_id)
        )
      }

      if (params.entity_tag_ids) {
        const entityTagIds = parseStringArray(params.entity_tag_ids)
        if (entityTagIds.length > 0) {
          query = query.where("e.entity_tag_id", "in", entityTagIds)
        }
      }

      if (params.keyword) {
        const keyword = `%${params.keyword}%`
        query = query.where((eb) =>
          eb.or([
            eb("asset_rtmds.serial_number", "like", keyword),
            eb.exists(
              eb
                .selectFrom("asset_models")
                .select("id")
                .where("asset_models.name", "like", keyword)
                .whereRef("asset_models.id", "=", "asset_rtmds.asset_model_id")
            ),
            eb.exists(
              eb
                .selectFrom("manufactures")
                .select("id")
                .where("manufactures.name", "like", keyword)
                .whereRef("manufactures.id", "=", "asset_rtmds.manufacture_id")
            ),
            eb.exists(
              eb
                .selectFrom("entities")
                .select("id")
                .where("entities.name", "like", keyword)
                .whereRef("entities.id", "=", "asset_rtmds.entity_id")
            ),
          ])
        )
      }

      if (params.sort_by && params.sort_type) {
        let sortField = ""

        switch (params.sort_by) {
          case "rtmd_status_name":
            sortField = "ars.name"
            break
          case "status":
            sortField = "asset_rtmds.asset_rtmd_status_id"
            break
          default:
            sortField = `asset_rtmds.${params.sort_by}`
            break
        }

        query = query.orderBy(
          sql.raw(sortField),
          params.sort_type as "asc" | "desc"
        )
      } else {
        query = query.orderBy("asset_rtmds.updated_at", "desc")
      }

      let totalQuery = c.var.trx
        .selectFrom("asset_rtmds")
        .leftJoin(
          "asset_rtmd_statuses as ars",
          "ars.id",
          "asset_rtmds.asset_rtmd_status_id"
        )
        .leftJoin("asset_types as at", "at.id", "asset_rtmds.asset_type_id")
        .leftJoin("asset_models as am", "am.id", "asset_rtmds.asset_model_id")
        .leftJoin("manufactures as m", "m.id", "asset_rtmds.manufacture_id")
        .leftJoin("asset_vendors as av", "av.id", "asset_rtmds.asset_vendor_id")
        .leftJoin(
          "budget_sources as bs",
          "bs.id",
          "asset_rtmds.budget_source_id"
        )
        .leftJoin("entities as e", "e.id", "asset_rtmds.entity_id")
        .leftJoin("entity_types", "entity_types.id", "e.type")
        .leftJoin("users as creator", "creator.id", "asset_rtmds.created_by")
        .leftJoin("users as updater", "updater.id", "asset_rtmds.updated_by")
        .leftJoin(
          "locations as province_locations",
          "province_locations.id",
          "e.province_id"
        )
        .leftJoin(
          "locations as regency_locations",
          "regency_locations.id",
          "e.regency_id"
        )
        .where("asset_rtmds.deleted_at", "is", null)

      if (typeof entityId === "object" && entityId && entityId.length > 0) {
        totalQuery = totalQuery.where("e.id", "in", entityId)
      }

      if (typeof entityId === "number" && entityId) {
        totalQuery = totalQuery.where("e.id", "=", entityId)
      }

      if (params.manufacture_ids) {
        const manufactureIds = parseStringArray(params.manufacture_ids)
        if (manufactureIds.length > 0) {
          totalQuery = totalQuery.where(
            "asset_rtmds.manufacture_id",
            "in",
            manufactureIds
          )
        }
      }

      if (params.asset_model_ids) {
        const assetModelIds = parseStringArray(params.asset_model_ids)
        if (assetModelIds.length > 0) {
          totalQuery = totalQuery.where(
            "asset_rtmds.asset_model_id",
            "in",
            assetModelIds
          )
        }
      }

      if (params.rtmd_status_id) {
        totalQuery = totalQuery.where(
          "asset_rtmds.asset_rtmd_status_id",
          "=",
          parseInt(params.rtmd_status_id)
        )
      }

      if (params.device_status_id) {
        totalQuery = totalQuery.where(
          "asset_rtmds.status",
          "=",
          parseInt(params.device_status_id)
        )
      }

      if (queryParams.entity_id) {
        totalQuery = totalQuery.where(
          "asset_rtmds.entity_id",
          "=",
          parseInt(queryParams.entity_id)
        )
      }

      totalQuery = totalQuery.$if(
        params.is_device_related !== undefined,
        (eb) =>
          eb.where(
            "asset_rtmds.id",
            params.is_device_related === FLAG.TRUE ? "in" : "not in",
            c.var.trx
              .selectFrom("asset_inventory_rtmds")
              .select("asset_rtmd_id")
          )
      )

      if (queryParams.budget_source_id) {
        totalQuery = totalQuery.where(
          "asset_rtmds.budget_source_id",
          "=",
          parseInt(queryParams.budget_source_id)
        )
      }

      if (queryParams.production_year) {
        totalQuery = totalQuery.where(
          "asset_rtmds.production_year",
          "=",
          parseInt(queryParams.production_year)
        )
      }

      if (queryParams.budget_year) {
        totalQuery = totalQuery.where(
          "asset_rtmds.budget_year",
          "=",
          parseInt(queryParams.budget_year)
        )
      }

      if (params.province_id) {
        totalQuery = totalQuery.where("e.province_id", "=", params.province_id)
      }

      if (params.city_id) {
        totalQuery = totalQuery.where("e.regency_id", "=", params.city_id)
      }

      if (params.health_center_id) {
        totalQuery = totalQuery.where(
          "asset_rtmds.entity_id",
          "=",
          parseInt(params.health_center_id)
        )
      }

      if (params.entity_tag_ids) {
        const entityTagIds = parseStringArray(params.entity_tag_ids)
        if (entityTagIds.length > 0) {
          totalQuery = totalQuery.where("e.entity_tag_id", "in", entityTagIds)
        }
      }

      if (params.keyword) {
        const keyword = `%${params.keyword}%`
        totalQuery = totalQuery.where((eb) =>
          eb.or([
            eb("asset_rtmds.serial_number", "like", keyword),
            eb.exists(
              eb
                .selectFrom("asset_models")
                .select("id")
                .where("asset_models.name", "like", keyword)
                .whereRef("asset_models.id", "=", "asset_rtmds.asset_model_id")
            ),
            eb.exists(
              eb
                .selectFrom("manufactures")
                .select("id")
                .where("manufactures.name", "like", keyword)
                .whereRef("manufactures.id", "=", "asset_rtmds.manufacture_id")
            ),
            eb.exists(
              eb
                .selectFrom("entities")
                .select("id")
                .where("entities.name", "like", keyword)
                .whereRef("entities.id", "=", "asset_rtmds.entity_id")
            ),
          ])
        )
      }

      const [data, totalCountResult] = await Promise.all([
        query.limit(itemPerPage).offset(offset).execute(),
        totalQuery
          .select((eb) => eb.fn.count("asset_rtmds.id").as("count"))
          .executeTakeFirst(),
      ])

      const total = Number(totalCountResult?.count) || 0

      const transformedData: AssetMonitoringDeviceListResponse[] = data.map(
        (item) => ({
          id: item.id,
          serial_number: item.serial_number,
          production_year: item.production_year,
          budget_year: item.budget_year,
          created_at: item.created_at.toISOString(),
          updated_at: item.updated_at.toISOString(),
          rtmd_status: {
            id: item.asset_rtmd_status_id || 1,
            name: c.var.t(item.logger_status, item.logger_status),
          },
          device_status: {
            id: item.status ?? STATUS.INACTIVE,
            name: c.var.t(
              item.status === STATUS.ACTIVE
                ? "common.active"
                : "common.inactive",
              item.status === STATUS.ACTIVE ? "Active" : "Inactive"
            ),
          },
          asset_type: item.asset_type,
          asset_model: item.asset_model,
          manufacturer: item.manufacturer,
          asset_vendor: item.asset_vendor,
          budget_source: item.budget_source,
          entity: item.entity,
          created_by: item.created_by_name
            ? { id: Number(item.created_by_id), name: item.created_by_name }
            : null,
          updated_by: item.updated_by_name
            ? { id: Number(item.updated_by_id), name: item.updated_by_name }
            : null,
        })
      )

      return {
        data: transformedData,
        total,
      }
    } catch (error) {
      throw new ValidationError("Failed to fetch Asset Monitoring Device list")
    }
  }

  async update(
    c: Context,
    id: number,
    data: EditAssetMonitoringDeviceRequest & { updated_by: number }
  ): Promise<boolean> {
    const trx = c.var.trx

    try {
      const updateData: Record<string, unknown> = {
        updated_at: new Date(),
        updated_by: data.updated_by,
      }

      if (data.serial_number !== undefined)
        updateData.serial_number = data.serial_number
      if (data.asset_type_id !== undefined)
        updateData.asset_type_id = data.asset_type_id
      if (data.asset_model_id !== undefined)
        updateData.asset_model_id = data.asset_model_id
      if (data.manufacture_id !== undefined)
        updateData.manufacture_id = data.manufacture_id
      if (data.asset_vendor_id !== undefined)
        updateData.asset_vendor_id = data.asset_vendor_id
      if (data.asset_communication_provider_id !== undefined)
        updateData.asset_communication_provider_id =
          data.asset_communication_provider_id
      if (data.production_year !== undefined)
        updateData.production_year = data.production_year
      if (data.asset_rtmd_status_id !== undefined)
        updateData.asset_rtmd_status_id = data.asset_rtmd_status_id
      if (data.entity_id !== undefined) updateData.entity_id = data.entity_id
      if (data.budget_year !== undefined)
        updateData.budget_year = data.budget_year
      if (data.budget_source_id !== undefined)
        updateData.budget_source_id = data.budget_source_id

      const result = await trx
        .updateTable("asset_rtmds")
        .set(updateData)
        .where("id", "=", id)
        .where("deleted_at", "is", null)
        .executeTakeFirst()

      if (data.contact_persons) {
        await trx
          .deleteFrom("contact_persons")
          .where("source_id", "=", id)
          .where("source_type", "=", CONTACT_PERSON_SOURCE_TYPE.RTMD)
          .execute()

        for (const contactPerson of data.contact_persons) {
          await trx
            .insertInto("contact_persons")
            .values({
              name: contactPerson.name,
              phone: contactPerson.phone,
              source_id: id,
              source_type: CONTACT_PERSON_SOURCE_TYPE.RTMD,
              updated_by: data.updated_by,
              updated_at: new Date(),
            })
            .execute()
        }
      }

      return Number(result.numUpdatedRows) > 0
    } catch (error) {
      throw new ValidationError("Failed to update Asset Monitoring Device")
    }
  }

  async delete(c: Context, id: number): Promise<boolean> {
    const trx = c.var.trx
    const currentDate = new Date()
    const userId = Number(c.var.accountID)

    try {
      const result = await trx
        .updateTable("asset_rtmds")
        .set({
          deleted_at: currentDate,
          updated_at: currentDate,
          deleted_by: userId,
        })
        .where("id", "=", id)
        .where("deleted_at", "is", null)
        .executeTakeFirst()

      if (!result || result.numUpdatedRows === 0) {
        return false
      }

      await trx
        .updateTable("contact_persons")
        .set({
          deleted_at: currentDate,
          updated_at: currentDate,
          deleted_by: userId,
        })
        .where("source_id", "=", id)
        .where("source_type", "=", CONTACT_PERSON_SOURCE_TYPE.RTMD)
        .where("deleted_at", "is", null)
        .execute()

      return true
    } catch (error) {
      throw new ValidationError("Failed to delete Asset Monitoring Device")
    }
  }

  async bulkDelete(
    c: Context,
    ids: number[]
  ): Promise<{ deleted: number; failed: number }> {
    const trx = c.var.trx
    const currentDate = new Date()
    const userId = Number(c.var.accountID)

    try {
      const deviceResult = await trx
        .updateTable("asset_rtmds")
        .set({
          deleted_at: currentDate,
          updated_at: currentDate,
          deleted_by: userId,
        })
        .where("id", "in", ids)
        .where("deleted_at", "is", null)
        .executeTakeFirst()

      await trx
        .updateTable("contact_persons")
        .set({
          deleted_at: currentDate,
          updated_at: currentDate,
          deleted_by: userId,
        })
        .where("source_id", "in", ids)
        .where("source_type", "=", CONTACT_PERSON_SOURCE_TYPE.RTMD)
        .where("deleted_at", "is", null)
        .execute()

      const deletedCount = Number(deviceResult.numUpdatedRows)
      const failedCount = ids.length - deletedCount

      return {
        deleted: deletedCount,
        failed: failedCount,
      }
    } catch (error) {
      throw new ValidationError(
        "Failed to bulk delete Asset Monitoring Devices"
      )
    }
  }

  async existsById(c: Context, id: number): Promise<boolean> {
    const result = await c.var.trx
      .selectFrom("asset_rtmds")
      .select(["id"])
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .executeTakeFirst()

    return !!result
  }

  async isDeviceRelated(c: Context, id: number): Promise<boolean> {
    const result = await c.var.trx
      .selectFrom("asset_inventory_rtmds")
      .select("asset_rtmd_id")
      .where("asset_rtmd_id", "=", id)
      .executeTakeFirst()

    return !!result
  }

  async validateAssetType(c: Context, assetTypeId: number): Promise<boolean> {
    const result = await c.var.trx
      .selectFrom("asset_types")
      .select(["id"])
      .where("id", "=", assetTypeId)
      .where("deleted_at", "is", null)
      .executeTakeFirst()

    return !!result
  }

  async validateAssetModel(c: Context, assetModelId: number): Promise<boolean> {
    const result = await c.var.trx
      .selectFrom("asset_models")
      .select(["id"])
      .where("id", "=", assetModelId)
      .where("deleted_at", "is", null)
      .executeTakeFirst()

    return !!result
  }

  async validateManufacture(
    c: Context,
    manufactureId: number
  ): Promise<boolean> {
    const result = await c.var.trx
      .selectFrom("manufactures")
      .select(["id"])
      .where("id", "=", manufactureId)
      .where("deleted_at", "is", null)
      .executeTakeFirst()

    return !!result
  }

  async validateAssetVendor(
    c: Context,
    assetVendorId: number
  ): Promise<boolean> {
    const result = await c.var.trx
      .selectFrom("asset_vendors")
      .innerJoin(
        "asset_vendor_types",
        "asset_vendor_types.id",
        "asset_vendors.asset_vendor_type_id"
      )
      .select(["asset_vendors.id"])
      .where("asset_vendors.id", "=", assetVendorId)
      .where("asset_vendors.deleted_at", "is", null)
      .where(
        "asset_vendor_types.name",
        "!=",
        ASSET_MONITORING_DEVICE.COMMUNICATION_PROVIDER_TYPE_NAME
      )
      .executeTakeFirst()

    return !!result
  }

  async validateCommunicationProvider(
    c: Context,
    communicationProviderId: number
  ): Promise<boolean> {
    const result = await c.var.trx
      .selectFrom("asset_vendors")
      .innerJoin(
        "asset_vendor_types",
        "asset_vendor_types.id",
        "asset_vendors.asset_vendor_type_id"
      )
      .select(["asset_vendors.id"])
      .where("asset_vendors.id", "=", communicationProviderId)
      .where("asset_vendors.deleted_at", "is", null)
      .where(
        "asset_vendor_types.name",
        "=",
        ASSET_MONITORING_DEVICE.COMMUNICATION_PROVIDER_TYPE_NAME
      )
      .executeTakeFirst()

    return !!result
  }

  async validateAssetRtmdStatus(
    c: Context,
    assetRtmdStatusId: number
  ): Promise<boolean> {
    const result = await c.var.trx
      .selectFrom("asset_rtmd_statuses")
      .select(["id"])
      .where("id", "=", assetRtmdStatusId)
      .executeTakeFirst()

    return !!result
  }

  async validateEntity(c: Context, entityId: number): Promise<boolean> {
    const result = await c.var.trx
      .selectFrom("entities")
      .select(["id"])
      .where("id", "=", entityId)
      .where("deleted_at", "is", null)
      .executeTakeFirst()

    return !!result
  }

  async validateBudgetSource(
    c: Context,
    budgetSourceId: number
  ): Promise<boolean> {
    const result = await c.var.trx
      .selectFrom("budget_sources")
      .select(["id"])
      .where("id", "=", budgetSourceId)
      .where("deleted_at", "is", null)
      .executeTakeFirst()

    return !!result
  }

  async validateAssetRelationship(
    c: Context,
    assetTypeId: number,
    manufactureId: number,
    assetModelId: number
  ): Promise<boolean> {
    // Check if there's a valid model that matches the asset_type_id and manufacture_id combination
    const result = await c.var.trx
      .selectFrom("asset_models")
      .select(["id"])
      .where("asset_type_id", "=", assetTypeId)
      .where("manufacture_id", "=", manufactureId)
      .where("id", "=", assetModelId)
      .where("deleted_at", "is", null)
      .executeTakeFirst()

    return !!result
  }

  async validateSerialNumber(
    c: Context,
    serialNumber: string,
    excludeId?: number
  ): Promise<boolean> {
    let query = c.var.trx
      .selectFrom("asset_rtmds")
      .select(["id"])
      .where("serial_number", "=", serialNumber)
      .where("deleted_at", "is", null)

    if (excludeId) {
      query = query.where("id", "!=", excludeId)
    }

    const result = await query.executeTakeFirst()
    return !result
  }

  async *getManufactureStreamData(c: Context): AsyncIterableIterator<any> {
    const manufactures = await c.var.trx
      .selectFrom("manufactures")
      .select(["id as value", "name as label"])
      .where("manufactures.deleted_at", "is", null)
      .orderBy("manufactures.name")
      .execute()

    for (const manufacture of manufactures) {
      yield manufacture
    }
  }

  async *getAssetModelStreamData(c: Context): AsyncIterableIterator<any> {
    const assetModels = await c.var.trx
      .selectFrom("asset_models")
      .select(["id as value", "name as label"])
      .where("asset_models.deleted_at", "is", null)
      .orderBy("asset_models.name")
      .execute()

    for (const assetModel of assetModels) {
      yield assetModel
    }
  }

  async *getAssetVendorStreamData(c: Context): AsyncIterableIterator<any> {
    const assetVendors = await c.var.trx
      .selectFrom("asset_vendors")
      .innerJoin(
        "asset_vendor_types",
        "asset_vendor_types.id",
        "asset_vendors.asset_vendor_type_id"
      )
      .select(["asset_vendors.id as value", "asset_vendors.name as label"])
      .where("asset_vendors.deleted_at", "is", null)
      .where(
        "asset_vendor_types.name",
        "!=",
        ASSET_MONITORING_DEVICE.COMMUNICATION_PROVIDER_TYPE_NAME
      )
      .orderBy("asset_vendors.name")
      .execute()

    for (const assetVendor of assetVendors) {
      yield assetVendor
    }
  }

  async *getCommunicationProviderStreamData(
    c: Context
  ): AsyncIterableIterator<any> {
    const communicationProviders = await c.var.trx
      .selectFrom("asset_vendors")
      .innerJoin(
        "asset_vendor_types",
        "asset_vendor_types.id",
        "asset_vendors.asset_vendor_type_id"
      )
      .select(["asset_vendors.id as value", "asset_vendors.name as label"])
      .where("asset_vendors.deleted_at", "is", null)
      .where(
        "asset_vendor_types.name",
        "=",
        ASSET_MONITORING_DEVICE.COMMUNICATION_PROVIDER_TYPE_NAME
      )
      .orderBy("asset_vendors.name")
      .execute()

    for (const communicationProvider of communicationProviders) {
      yield communicationProvider
    }
  }

  async *getRtmdStatusStreamData(c: Context): AsyncIterableIterator<any> {
    const rtmdStatuses = await c.var.trx
      .selectFrom("asset_rtmd_statuses")
      .select(["id as value", "name as label"])
      .where("asset_rtmd_statuses.deleted_at", "is", null)
      .orderBy("asset_rtmd_statuses.name")
      .execute()

    for (const rtmdStatus of rtmdStatuses) {
      yield rtmdStatus
    }
  }

  async updateStatus(c: Context, id: number, status: number): Promise<boolean> {
    const trx = c.var.trx

    try {
      const updateData: Record<string, unknown> = {
        status: status,
        updated_at: new Date(),
      }

      const result = await trx
        .updateTable("asset_rtmds")
        .set(updateData)
        .where("id", "=", id)
        .where("deleted_at", "is", null)
        .executeTakeFirst()

      return (result.numUpdatedRows ?? 0) > 0
    } catch {
      throw new ValidationError(
        "Failed to update Asset Monitoring Device status"
      )
    }
  }

  async getStatusList(
    c: Context,
    params?: { page?: number; paginate?: number }
  ) {
    const page = Number(params?.page) || 1
    const itemPerPage = Number(params?.paginate) || 10
    const offset = (page - 1) * itemPerPage

    const [statuses, count] = await Promise.all([
      c.var.trx
        .selectFrom("asset_rtmd_statuses")
        .selectAll()
        .where("asset_rtmd_statuses.deleted_at", "is", null)
        .orderBy("asset_rtmd_statuses.name")
        .limit(itemPerPage)
        .offset(offset)
        .execute(),
      c.var.trx
        .selectFrom("asset_rtmd_statuses")
        .select(c.var.trx.fn.count("asset_rtmd_statuses.id").as("total"))
        .where("asset_rtmd_statuses.deleted_at", "is", null)
        .executeTakeFirst(),
    ])

    const data = statuses.map((status) => ({
      id: status.id,
      name: status.name,
    }))

    const total = Number(count?.total) || 0

    return {
      data,
      total,
    }
  }

  async *getEntityStreamData(c: Context): AsyncIterableIterator<any> {
    const entities = await c.var.trx
      .selectFrom("entities")
      .select(["id as value", "name as label"])
      .where("entities.deleted_at", "is", null)
      .orderBy("entities.name")
      .execute()

    for (const entity of entities) {
      yield entity
    }
  }

  async *getBudgetSourceStreamData(c: Context): AsyncIterableIterator<any> {
    const budgetSources = await c.var.trx
      .selectFrom("budget_sources")
      .select(["id as value", "name as label"])
      .where("budget_sources.deleted_at", "is", null)
      .orderBy("budget_sources.name")
      .execute()

    for (const budgetSource of budgetSources) {
      yield budgetSource
    }
  }

  async *getWorkspaceStreamData(c: Context): AsyncIterableIterator<any> {
    const workspaces = await c.var.trx
      .selectFrom("workspaces")
      .select(["id as value", "name as label"])
      .where("workspaces.deleted_at", "is", null)
      .orderBy("workspaces.name")
      .execute()

    for (const workspace of workspaces) {
      yield workspace
    }
  }

  async findAssetModelByName(c: Context, name: string): Promise<any> {
    return await c.var.trx
      .selectFrom("asset_models")
      .selectAll()
      .where("asset_models.name", "=", name)
      .where("asset_models.deleted_at", "is", null)
      .executeTakeFirst()
  }

  async findManufactureByName(c: Context, name: string): Promise<any> {
    return await c.var.trx
      .selectFrom("manufactures")
      .selectAll()
      .where("manufactures.name", "=", name)
      .where("manufactures.deleted_at", "is", null)
      .executeTakeFirst()
  }

  async findAssetVendorByName(c: Context, name: string): Promise<any> {
    return await c.var.trx
      .selectFrom("asset_vendors")
      .selectAll()
      .where("asset_vendors.name", "=", name)
      .where("asset_vendors.deleted_at", "is", null)
      .executeTakeFirst()
  }

  async findRtmdStatusByName(c: Context, name: string): Promise<any> {
    return await c.var.trx
      .selectFrom("asset_rtmd_statuses")
      .selectAll()
      .where("asset_rtmd_statuses.name", "=", name)
      .where("asset_rtmd_statuses.deleted_at", "is", null)
      .executeTakeFirst()
  }

  async findEntityByName(c: Context, name: string): Promise<any> {
    return await c.var.trx
      .selectFrom("entities")
      .selectAll()
      .where("entities.name", "=", name)
      .where("entities.deleted_at", "is", null)
      .executeTakeFirst()
  }

  async findBudgetSourceByName(c: Context, name: string): Promise<any> {
    return await c.var.trx
      .selectFrom("budget_sources")
      .selectAll()
      .where("budget_sources.name", "=", name)
      .where("budget_sources.deleted_at", "is", null)
      .executeTakeFirst()
  }

  async getAssetMonitoringDeviceInventoryOperations(
    c: Context,
    assetRtmdId: number
  ) {
    const inventoryAssociationsQuery = c.var.trx
      .selectFrom("asset_inventory_rtmds as air")
      .innerJoin("asset_inventories as ai", (join) =>
        join.onRef("air.asset_inventory_id", "=", "ai.id")
      )
      .innerJoin("asset_rtmds as ar", (join) =>
        join.onRef("air.asset_rtmd_id", "=", "ar.id")
      )
      .leftJoin("asset_models as am", (join) =>
        join.onRef("ar.asset_model_id", "=", "am.id")
      )
      .leftJoin("asset_types as at", (join) =>
        join.onRef("ai.asset_type_id", "=", "at.id")
      )
      .leftJoin("manufactures as m", (join) =>
        join.onRef("ar.manufacture_id", "=", "m.id")
      )
      .select([
        "ai.id",
        "air.sensor_qty",
        "air.description",
        "ai.serial_number",
        "am.id as asset_model_id",
        "am.name as asset_model_name",
        "at.id as asset_type_id",
        "at.name as asset_type_name",
        "m.id as manufacture_id",
        "m.name as manufacture_name",
      ])
      .where("air.asset_rtmd_id", "=", assetRtmdId)
      .where("ai.deleted_at", "is", null)

    const warehouseAssetTypeIdsQuery = c.var.trx
      .selectFrom("asset_types_classifications as atc")
      .select(["atc.asset_type_id"])
      .where(
        "atc.asset_classifications_id",
        "=",
        ASSET_CLASSIFICATION.WAREHOUSE
      )
      .where("atc.deleted_at", "is", null)
      .distinct()

    const [inventoryAssociations, warehouseAssetTypes] = await Promise.all([
      inventoryAssociationsQuery.execute(),
      warehouseAssetTypeIdsQuery.execute(),
    ])
    const warehouseAssetTypeIds = collect(warehouseAssetTypes, "asset_type_id")

    const results = await Promise.all(
      inventoryAssociations.map(async (inventory) => {
        const latestLog = await c.var.trx
          .selectFrom("asset_rtmd_histories")
          .select(["temperature", "updated_at"])
          .where("asset_rtmd_id", "=", assetRtmdId)
          .orderBy("updated_at", "desc")
          .limit(1)
          .executeTakeFirst()

        return {
          id: inventory.id,
          serial_number: inventory.serial_number,
          sensor_qty: inventory.sensor_qty,
          description: inventory.description,
          asset_model: {
            id: inventory.asset_model_id,
            name: inventory.asset_model_name,
          },
          asset_type: {
            id: inventory.asset_type_id,
            name: inventory.asset_type_name,
            is_warehouse:
              inventory.asset_type_id &&
              warehouseAssetTypeIds.includes(inventory.asset_type_id)
                ? 1
                : 0,
          },
          manufacture: {
            id: inventory.manufacture_id,
            name: inventory.manufacture_name,
          },
          latest_log: latestLog
            ? {
                temperature: latestLog.temperature,
                updated_at: latestLog.updated_at,
              }
            : null,
        }
      })
    )

    return results
  }

  async listWithoutPagination(
    c: Context,
    params: GetAssetMonitoringDevicesQueryParams,
    entityId?: number | number[]
  ): Promise<{ data: DeviceExportItem[] }> {
    let query = c.var.trx
      .selectFrom("asset_rtmds")
      .leftJoin("asset_types", "asset_types.id", "asset_rtmds.asset_type_id")
      .leftJoin("asset_models", "asset_models.id", "asset_rtmds.asset_model_id")
      .leftJoin("manufactures", "manufactures.id", "asset_rtmds.manufacture_id")
      .leftJoin(
        "asset_vendors as asset_vendor",
        "asset_vendor.id",
        "asset_rtmds.asset_vendor_id"
      )
      .leftJoin(
        "asset_vendors as communication_provider",
        "communication_provider.id",
        "asset_rtmds.asset_communication_provider_id"
      )
      .leftJoin(
        "asset_rtmd_statuses",
        "asset_rtmd_statuses.id",
        "asset_rtmds.asset_rtmd_status_id"
      )
      .leftJoin(
        "budget_sources",
        "budget_sources.id",
        "asset_rtmds.budget_source_id"
      )
      .leftJoin("entities", "entities.id", "asset_rtmds.entity_id")
      .leftJoin("entity_types", "entity_types.id", "entities.type")
      .leftJoin("users as creator", "creator.id", "asset_rtmds.created_by")
      .leftJoin("users as updater", "updater.id", "asset_rtmds.updated_by")
      .leftJoin(
        "locations as province_locations",
        "province_locations.id",
        "entities.province_id"
      )
      .leftJoin(
        "locations as regency_locations",
        "regency_locations.id",
        "entities.regency_id"
      )
      .leftJoin(
        "locations as subdistrict_locations",
        "subdistrict_locations.id",
        "entities.sub_district_id"
      )
      .select([
        "asset_rtmds.id",
        "asset_rtmds.serial_number",
        "asset_rtmds.production_year",
        "asset_rtmds.budget_year",
        "asset_rtmds.status",
        "asset_rtmds.created_at",
        "asset_rtmds.updated_at",
        "asset_types.name as asset_type_name",
        "asset_models.name as asset_model_name",
        "manufactures.name as manufacture_name",
        "asset_vendor.name as asset_vendor_name",
        "communication_provider.name as communication_provider_name",
        "asset_rtmd_statuses.name as asset_rtmd_status_name",
        "budget_sources.name as budget_source_name",
        "entities.id as entity_id",
        "entities.name as entity_name",
        "entity_types.name as entity_type_name",
        "entities.lng as longitude",
        "entities.lat as latitude",
        "entities.province_id",
        "entities.regency_id",
        "province_locations.name as province_name",
        "regency_locations.name as regency_name",
        "subdistrict_locations.name as subdistrict_name",
        sql<string>`COALESCE(CONCAT_WS(' ', creator.firstname, IFNULL(creator.lastname, '')), '')`.as(
          "created_by_name"
        ),
        sql<string>`COALESCE(CONCAT_WS(' ', updater.firstname, IFNULL(updater.lastname, '')), '')`.as(
          "updated_by_name"
        ),
      ])
      .where("asset_rtmds.deleted_at", "is", null)

    // Apply entity filtering based on entityId parameter
    if (typeof entityId === "object" && entityId && entityId.length > 0) {
      query = query.where("entities.id", "in", entityId)
    } else if (typeof entityId === "number" && entityId) {
      query = query.where("entities.id", "=", entityId)
    }
    // If entityId is undefined (Super Admin), no entity filtering applied

    if (params.manufacture_ids) {
      const parseStringArray = (value: any): number[] => {
        if (!value) return []
        if (Array.isArray(value)) {
          return value
            .map((v) => (typeof v === "number" ? v : parseInt(v)))
            .filter((n) => !isNaN(n))
        }
        if (typeof value === "string") {
          let cleaned = value.replace(/^["']|["']$/g, "").trim()
          try {
            cleaned = decodeURIComponent(cleaned)
          } catch {
            // If URI decoding fails, continue with original value
          }
          if (!cleaned) return []
          return cleaned
            .split(",")
            .map((s) => parseInt(s.trim()))
            .filter((n) => !isNaN(n))
        }
        if (typeof value === "number") {
          return [value]
        }
        return []
      }

      const manufactureIds = parseStringArray(params.manufacture_ids)
      if (manufactureIds.length > 0) {
        query = query.where("asset_rtmds.manufacture_id", "in", manufactureIds)
      }
    }

    if (params.asset_model_ids) {
      const parseStringArray = (value: any): number[] => {
        if (!value) return []
        if (Array.isArray(value)) {
          return value
            .map((v) => (typeof v === "number" ? v : parseInt(v)))
            .filter((n) => !isNaN(n))
        }
        if (typeof value === "string") {
          let cleaned = value.replace(/^["']|["']$/g, "").trim()
          try {
            cleaned = decodeURIComponent(cleaned)
          } catch {
            // If URI decoding fails, continue with original value
          }
          if (!cleaned) return []
          return cleaned
            .split(",")
            .map((s) => parseInt(s.trim()))
            .filter((n) => !isNaN(n))
        }
        if (typeof value === "number") {
          return [value]
        }
        return []
      }

      const assetModelIds = parseStringArray(params.asset_model_ids)
      if (assetModelIds.length > 0) {
        query = query.where("asset_rtmds.asset_model_id", "in", assetModelIds)
      }
    }

    if (params.province_id) {
      query = query.where("entities.province_id", "=", params.province_id)
    }

    if (params.city_id) {
      query = query.where("entities.regency_id", "=", params.city_id)
    }

    if (params.health_center_id) {
      query = query.where(
        "asset_rtmds.entity_id",
        "=",
        parseInt(params.health_center_id)
      )
    }

    if (params.entity_tag_ids) {
      const parseStringArray = (value: any): number[] => {
        if (!value) return []
        if (Array.isArray(value)) {
          return value
            .map((v) => (typeof v === "number" ? v : parseInt(v)))
            .filter((n) => !isNaN(n))
        }
        if (typeof value === "string") {
          let cleaned = value.replace(/^["']|["']$/g, "").trim()
          try {
            cleaned = decodeURIComponent(cleaned)
          } catch {
            // If URI decoding fails, continue with original value
          }
          if (!cleaned) return []
          return cleaned
            .split(",")
            .map((s) => parseInt(s.trim()))
            .filter((n) => !isNaN(n))
        }
        if (typeof value === "number") {
          return [value]
        }
        return []
      }

      const entityTagIds = parseStringArray(params.entity_tag_ids)
      if (entityTagIds.length > 0) {
        query = query.where("entities.entity_tag_id", "in", entityTagIds)
      }
    }

    if (params.rtmd_status_id) {
      query = query.where(
        "asset_rtmds.asset_rtmd_status_id",
        "=",
        parseInt(params.rtmd_status_id)
      )
    }

    if (params.keyword) {
      query = query.where(
        "asset_rtmds.serial_number",
        "like",
        `%${params.keyword}%`
      )
    }

    const data = await query.orderBy("asset_rtmds.updated_at", "desc").execute()

    const formattedData = data.map((item: any) => ({
      id: item.id,
      serial_number: item.serial_number,
      production_year: item.production_year,
      budget_year: item.budget_year,
      longitude: item.longitude || null,
      latitude: item.latitude || null,
      created_at: item.created_at,
      updated_at: item.updated_at,
      asset_type: item.asset_type_name ? { name: item.asset_type_name } : null,
      asset_model: item.asset_model_name
        ? { name: item.asset_model_name }
        : null,
      manufacture: item.manufacture_name
        ? { name: item.manufacture_name }
        : null,
      asset_vendor: item.asset_vendor_name
        ? { name: item.asset_vendor_name }
        : null,
      communication_provider: item.communication_provider_name
        ? { name: item.communication_provider_name }
        : null,
      asset_rtmd_status: item.asset_rtmd_status_name
        ? { name: item.asset_rtmd_status_name }
        : null,
      asset_status: {
        id: item.status ?? STATUS.INACTIVE,
        name: c.var.t(
          item.status === STATUS.ACTIVE ? "common.active" : "common.inactive",
          item.status === STATUS.ACTIVE ? "Active" : "Inactive"
        ),
      },
      budget_source: item.budget_source_name
        ? { name: item.budget_source_name }
        : null,
      entity: {
        id: item.entity_id,
        name: item.entity_name,
        entity_type_name: item.entity_type_name || "-",
        province_name: item.province_name || "-",
        city_name: item.regency_name || "-",
        sub_district_name: item.subdistrict_name || "-",
        longitude: item.longitude || null,
        latitude: item.latitude || null,
      },
      created_by: item.created_by_name ? { name: item.created_by_name } : null,
      updated_by: item.updated_by_name ? { name: item.updated_by_name } : null,
      contact_persons: [],
    }))

    return { data: formattedData }
  }

  async getEntityByProvince(c: Context, provinceId: number) {
    return await c.var.trx
      .selectFrom("entities")
      .select(["id"])
      .where("province_id", "=", provinceId)
      .where("deleted_at", "is", null)
      .execute()
  }

  async getEntityByRegency(c: Context, regencyId: number) {
    return await c.var.trx
      .selectFrom("entities")
      .select(["id"])
      .where("regency_id", "=", regencyId)
      .where("deleted_at", "is", null)
      .execute()
  }

  async getEntityById(c: Context, entityId: number) {
    return await c.var.trx
      .selectFrom("entities")
      .selectAll()
      .where("id", "=", entityId)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }
}
