import { AssetModelModule } from "@/modules/asset-model/asset-model.module.js"
import { AssetMonitoringDeviceModule } from "@/modules/asset-monitoring-device/asset-monitoring-device.module.js"
import { AssetMonitoringTemperatureModule } from "@/modules/asset-monitoring-temperature/asset-monitoring-temperature.module.js"
import { AssetTypeModule } from "@/modules/asset-type/asset-type.module.js"
import { z } from "@hono/zod-openapi"
import { Context } from "hono"
import {
  iotGetAssetModelRoute,
  iotGetAssetsRoute,
  iotGetAssetTypeRoute,
  iotPostAssetsRoute,
} from "./iot.routes.js"

export class IotModule {
  constructor(
    protected readonly loggerModule: AssetMonitoringDeviceModule,
    protected readonly pushLoggerModule: AssetMonitoringTemperatureModule,
    protected readonly assetTypeModule: AssetTypeModule,
    protected readonly assetModelModule: AssetModelModule
  ) {}

  async createAsset(
    c: Context,
    body: z.infer<
      (typeof iotPostAssetsRoute.request.body.content)["application/json"]["schema"]
    >
  ) {
    await this.loggerModule.create(c, {
      status: 1,
      entity_id: body.entity_id,
      serial_number: body.serial_number,
      manufacture_id: body.manufacture_id,
      asset_type_id: body.type_id,
      asset_model_id: body.model_id,
      asset_vendor_id: null,
      asset_communication_provider_id: null,
      production_year: body.prod_year,
      asset_rtmd_status_id: body.status,
      budget_year: null,
      budget_source_id: null,
      contact_persons: [],
    })
    return { message: "Logger created successfully" }
  }

  async getAssetTypes(
    c: Context,
    query: z.infer<typeof iotGetAssetTypeRoute.request.query>
  ) {
    const result = await this.assetTypeModule.list(c, {
      page: query.page ? Number(query.page) : 1,
      paginate: query.paginate ? Number(query.paginate) : 1000,
      keyword: query.keyword,
      offset: 0,
      sort_by: "name",
      sort_type: "asc",
    })
    return {
      total: result.total_item,
      page: result.page,
      perPage: result.item_per_page,
      list: result.data.map((item) => ({
        id: item.id ?? null,
        name: item.name ?? null,
        created_at: item.created_at?.toISOString() ?? null,
        updated_at: item.updated_at?.toISOString() ?? null,
      })),
    }
  }

  async getAssetModels(
    c: Context,
    query: z.infer<typeof iotGetAssetModelRoute.request.query>
  ) {
    const result = await this.assetModelModule.list(c, {
      page: query.page ? Number(query.page) : 1,
      paginate: query.paginate ? Number(query.paginate) : 10,
      keyword: query.keyword,
      offset: 0,
      sort_by: "name",
      sort_type: "asc",
      manufacture_ids: [c.var.user.manufacture_id ?? 0]
    })
    return {
      total: result.total_item,
      page: result.page,
      perPage: result.item_per_page,
      list: result.data.map((item) => ({
        id: item.id ?? null,
        name: item.name ?? null,
        capacity: item.net_capacity ?? null,
        created_at: item.created_at?.toISOString() ?? null,
        updated_at: item.updated_at?.toISOString() ?? null,
      })),
    }
  }

  async getAssets(
    c: Context,
    query: z.infer<typeof iotGetAssetsRoute.request.query>
  ) {
    const result = await this.loggerModule.list(c, {
      page: query.page ? Number(query.page) : 1,
      paginate: query.paginate ? Number(query.paginate) : 10,
      manufacture_ids: query.manufacture_id
        ? query.manufacture_id.split(",").map(Number)
        : [],
      offset: 0,
    })
    return {
      total: result.total_item,
      perPage: result.item_per_page,
      list: result.data.map((item) => ({
        id: item.id ?? null,
        lat: 0,
        lng: 0,
        type_id: item.asset_type?.id ?? null,
        min_temp: 0,
        max_temp: 0,
        created_at: item.created_at,
        updated_at: item.updated_at,
        status: 1,
        serial_number: item.serial_number ?? null,
        prod_year: item.production_year ?? null,
        manufacture_id: item.manufacturer?.id ?? null,
        temp: 0,
        parent_id: null,
        working_status: item.device_status?.name ?? null,
        budget_year: item.budget_year ?? null,
        budget_src: item.budget_source?.name ?? null,
        entity: item.entity
          ? {
              id: item.entity.id ?? null,
              name: item.entity.name ?? null,
              address: null,
              code: null,
              village_id: null,
              region_id: item.entity.regency_id ?? null,
              province_id: item.entity.province_id ?? null,
              regency_id: item.entity.regency_id ?? null,
              sub_district_id: null,
              created_by: null,
              updated_by: null,
              deleted_by: null,
              type: null,
              created_at: null,
              updated_at: null,
              deleted_at: null,
              province: item.entity.province_id
                ? {
                    id: item.entity.province_id ?? null,
                    name: item.entity.province_name ?? null,
                    created_at: null,
                    updated_at: null,
                    deleted_at: null,
                  }
                : null,
              regency: item.entity.regency_id
                ? {
                    id: item.entity.regency_id ?? null,
                    name: item.entity.regency_name ?? null,
                    province_id: item.entity.province_id ?? null,
                    created_at: null,
                    updated_at: null,
                    deleted_at: null,
                    provinceId: item.entity.province_id ?? null,
                  }
                : null,
            }
          : null,
        asset_type: item.asset_type
          ? {
              id: item.asset_type.id ?? null,
              name: item.asset_type.name ?? null,
              created_at: null,
              updated_at: null,
              deleted_at: null,
              updated_by: null,
              created_by: null,
            }
          : null,
        asset_model: item.asset_model
          ? {
              id: item.asset_model.id ?? null,
              name: item.asset_model.name ?? null,
              capacity: null,
              updated_at: null,
            }
          : null,
        manufacture: item.manufacturer
          ? {
              id: item.manufacturer.id ?? null,
              name: item.manufacturer.name ?? null,
              reference_id: null,
              description: null,
              contact_name: null,
              phone_number: null,
              email: null,
              address: null,
              village_id: null,
              created_by: null,
              updated_by: null,
              deleted_by: null,
              created_at: null,
              updated_at: null,
              deleted_at: null,
            }
          : null,
        childs: [],
        maintainers: null,
        created_by: item.created_by
          ? {
              id: item.created_by.id ?? null,
              name: item.created_by.name ?? null,
            }
          : null,
        updated_by: item.updated_by
          ? {
              id: item.updated_by.id ?? null,
              name: item.updated_by.name ?? null,
            }
          : null,
        latest_log: null,
      })),
    }
  }
}
