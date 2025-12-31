import { Context } from "hono"
import { sql } from "kysely"
import { AssetInventoryRepository } from "../asset-inventory/asset-inventory.repository.js"
import {
  GetAssetMonitoringTemperatureQuery,
  TemperatureHistoryItem,
  TemperatureHistoryResultItem,
  UpdateOperationalStatusDTO,
} from "./asset-monitoring-temperature.schema.js"
import { ASSET_CLASSIFICATION } from "@/common/constants/assets.js"
import { FLAG } from "@/common/constants/general.js"

export class AssetMonitoringTemperatureRepository extends AssetInventoryRepository {
  async findAssetBySerialNumber(c: Context, serialNumber: string) {
    return await c.var.trx
      .selectFrom("asset_rtmds")
      .selectAll()
      .where("serial_number", "=", serialNumber)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }

  async findAssetByAssetId(c: Context, assetId: number) {
    return await c.var.trx
      .selectFrom("asset_inventories")
      .selectAll()
      .where("id", "=", assetId)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }

  async getAssetModelTemperatureCapacityById(c: Context, id: number) {
    return await c.var.trx
      .selectFrom("asset_models_temperatures_capacities")
      .leftJoin(
        "asset_types_temperatures as att",
        "att.id",
        "asset_models_temperatures_capacities.asset_type_temperature_id"
      )
      .leftJoin(
        "temperature_thresholds as tt",
        "tt.id",
        "att.temperature_threshold_id"
      )
      .leftJoin("asset_types as at", "at.id", "att.asset_type_id")
      .leftJoin(
        "asset_models as am",
        "am.id",
        "asset_models_temperatures_capacities.asset_model_id"
      )
      .select([
        "asset_models_temperatures_capacities.id",
        "asset_models_temperatures_capacities.asset_model_id",
        "asset_models_temperatures_capacities.asset_type_temperature_id",
        "asset_models_temperatures_capacities.gross_capacity",
        "asset_models_temperatures_capacities.net_capacity",
        "tt.min_temperature",
        "tt.max_temperature",
        "at.name as asset_type_name",
        "am.name as asset_model_name",
        sql`COALESCE(tt.max_temperature, 0)`.as("max_threshold"),
        sql`COALESCE(tt.min_temperature, 0)`.as("min_threshold"),
      ])
      .where("asset_models_temperatures_capacities.id", "=", id)
      .where("asset_models_temperatures_capacities.deleted_at", "is", null)
      .executeTakeFirst()
  }

  async getAssetModelTemperatureCapacities(
    c: Context,
    params: {
      asset_id?: string
      asset_model_id?: string
      serial_number?: string
      page?: number
      paginate?: number
    }
  ) {
    let query = c.var.trx
      .selectFrom("asset_models_temperatures_capacities")
      .leftJoin(
        "asset_types_temperatures as att",
        "att.id",
        "asset_models_temperatures_capacities.asset_type_temperature_id"
      )
      .leftJoin(
        "temperature_thresholds as tt",
        "tt.id",
        "att.temperature_threshold_id"
      )
      .leftJoin("asset_types as at", "at.id", "att.asset_type_id")
      .leftJoin(
        "asset_models as am",
        "am.id",
        "asset_models_temperatures_capacities.asset_model_id"
      )
      .leftJoin(
        "asset_inventories as ai",
        "ai.asset_model_temperature_capacity_id",
        "asset_models_temperatures_capacities.id"
      )
      .leftJoin("entities as e", "e.id", "ai.entity_id")
      .leftJoin("asset_working_statuses as waws", (join) =>
        join.onRef("ai.working_status_id", "=", "waws.id")
      )
      .leftJoin("asset_electricities as wac", (join) =>
        join.onRef("ai.electricity_id", "=", "wac.id")
      )
      .select([
        "asset_models_temperatures_capacities.id",
        "asset_models_temperatures_capacities.asset_model_id",
        "asset_models_temperatures_capacities.asset_type_temperature_id",
        "asset_models_temperatures_capacities.gross_capacity",
        "asset_models_temperatures_capacities.net_capacity",
        "tt.min_temperature",
        "tt.max_temperature",
        "at.name as asset_type_name",
        "am.name as asset_model_name",
        "ai.serial_number",
        "e.name as entity_name",
        "waws.name as asset_working_status_name",
        "wac.name as electricity_name",
        sql`COALESCE(tt.max_temperature, 0)`.as("max_threshold"),
        sql`COALESCE(tt.min_temperature, 0)`.as("min_threshold"),
        "asset_models_temperatures_capacities.created_at",
        "asset_models_temperatures_capacities.updated_at",
      ])
      .where("asset_models_temperatures_capacities.deleted_at", "is", null)
      .where("att.deleted_at", "is", null)
      .where("tt.deleted_at", "is", null)

    if (params.asset_id) {
      query = query.where("ai.id", "=", parseInt(params.asset_id))
    }

    if (params.asset_model_id) {
      query = query.where("am.id", "=", parseInt(params.asset_model_id))
    }

    if (params.serial_number) {
      query = query.where(
        "ai.serial_number",
        "like",
        `%${params.serial_number}%`
      )
    }

    const page = params.page || 1
    const limit = params.paginate || 10
    const offset = (page - 1) * limit

    // Create a separate query for counting
    let totalQuery = c.var.trx
      .selectFrom("asset_models_temperatures_capacities")
      .leftJoin(
        "asset_types_temperatures as att",
        "att.id",
        "asset_models_temperatures_capacities.asset_type_temperature_id"
      )
      .leftJoin(
        "temperature_thresholds as tt",
        "tt.id",
        "att.temperature_threshold_id"
      )
      .leftJoin("asset_types as at", "at.id", "att.asset_type_id")
      .leftJoin(
        "asset_models as am",
        "am.id",
        "asset_models_temperatures_capacities.asset_model_id"
      )
      .leftJoin(
        "asset_inventories as ai",
        "ai.asset_model_temperature_capacity_id",
        "asset_models_temperatures_capacities.id"
      )
      .leftJoin("entities as e", "e.id", "ai.entity_id")
      .select(sql`COUNT(*)`.as("total"))
      .where("asset_models_temperatures_capacities.deleted_at", "is", null)
      .where("att.deleted_at", "is", null)
      .where("tt.deleted_at", "is", null)

    // Apply the same filters to the count query
    if (params.asset_id) {
      totalQuery = totalQuery.where("ai.id", "=", parseInt(params.asset_id))
    }

    if (params.asset_model_id) {
      totalQuery = totalQuery.where(
        "am.id",
        "=",
        parseInt(params.asset_model_id)
      )
    }

    if (params.serial_number) {
      totalQuery = totalQuery.where(
        "ai.serial_number",
        "like",
        `%${params.serial_number}%`
      )
    }

    const totalResult = (await totalQuery.executeTakeFirst()) as {
      total: number
    }
    const total = totalResult?.total || 0

    const results = await query
      .limit(limit)
      .offset(offset)
      .orderBy("asset_models_temperatures_capacities.created_at", "desc")
      .execute()

    const totalPages = Math.ceil(total / limit)

    return {
      data: results,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    }
  }

  async updateAssetInventoryTemperatureCapacity(
    c: Context,
    assetInventoryId: number,
    temperatureThresholdId: number,
    userId: number
  ) {
    const existingHistory = await c.var.trx
      .selectFrom("asset_inventory_temperature_capacity_histories")
      .selectAll()
      .where("asset_inventory_id", "=", assetInventoryId)
      .orderBy("created_at", "desc")
      .executeTakeFirst()

    if (existingHistory) {
      await c.var.trx
        .updateTable("asset_inventories")
        .set({
          asset_model_temperature_capacity_id: temperatureThresholdId,
          updated_at: new Date(),
          updated_by: userId,
        })
        .where("id", "=", assetInventoryId)
        .execute()

      await c.var.trx
        .insertInto("asset_inventory_temperature_capacity_histories")
        .values({
          asset_inventory_id: assetInventoryId,
          asset_model_temperature_capacity_id: temperatureThresholdId,
          created_at: new Date(),
        })
        .execute()
    } else {
      await c.var.trx
        .updateTable("asset_inventories")
        .set({
          asset_model_temperature_capacity_id: temperatureThresholdId,
          updated_at: new Date(),
          updated_by: userId,
        })
        .where("id", "=", assetInventoryId)
        .execute()

      await c.var.trx
        .insertInto("asset_inventory_temperature_capacity_histories")
        .values({
          asset_inventory_id: assetInventoryId,
          asset_model_temperature_capacity_id: temperatureThresholdId,
          created_at: new Date(),
        })
        .execute()
    }
  }

  async createTemperatureHistory(
    c: Context,
    historyData: TemperatureHistoryItem
  ): Promise<TemperatureHistoryResultItem> {
    try {
      const asset = await this.findAssetBySerialNumber(c, historyData.device_id)

      if (!asset) {
        return {
          device_id: historyData.device_id,
          lat: historyData.lat,
          lon: historyData.lon,
          curr_temp: historyData.curr_temp,
          actual_time: historyData.actual_date,
          status_device: historyData.status_device,
          battery: historyData.battery,
          signal: historyData.signal,
          power: historyData.power,
          humidity: historyData.humidity,
          message: "Asset not found",
          result: "error" as const,
        }
      }

      // Get related data from asset_inventories through asset_inventory_rtmds
      const relatedData = await c.var.trx
        .selectFrom("asset_inventory_rtmds as air")
        .innerJoin("asset_inventories as ai", (join) =>
          join.onRef("air.asset_inventory_id", "=", "ai.id")
        )
        .innerJoin("asset_rtmds as ar", (join) =>
          join.onRef("air.asset_rtmd_id", "=", "ar.id")
        )
        .select([
          "ai.asset_model_temperature_capacity_id",
          "ai.working_status_id",
          "ar.asset_rtmd_status_id",
        ])
        .where("air.asset_rtmd_id", "=", asset.id)
        .where("ai.deleted_at", "is", null)
        .where("ar.deleted_at", "is", null)
        .executeTakeFirst()

      const temperature = Number(historyData.curr_temp)
      const insertData = {
        asset_rtmd_id: asset.id,
        latitude: historyData.lat,
        longitude: historyData.lon,
        temperature: isNaN(temperature) ? null : temperature,
        battery: historyData.battery,
        signal: historyData.signal,
        humidity: historyData.humidity,
        actual_time: historyData.actual_date
          ? new Date(historyData.actual_date)
          : new Date(),
        asset_model_temperature_capacity_id:
          relatedData?.asset_model_temperature_capacity_id || null,
        inventory_working_status_id: relatedData?.working_status_id || null,
        rtmd_status_id: relatedData?.asset_rtmd_status_id || null,
        device_status:
          historyData.status_device !== undefined
            ? historyData.status_device
              ? 1
              : 0
            : null,
        is_power_connected:
          historyData.power !== undefined ? (historyData.power ? 1 : 0) : null,
      }

      const insertResult = await c.var.trx
        .insertInto("asset_rtmd_histories")
        .values(insertData)
        .executeTakeFirst()

      return {
        device_id: historyData.device_id,
        lat: historyData.lat,
        lon: historyData.lon,
        curr_temp: historyData.curr_temp,
        actual_time: historyData.actual_date,
        status_device: historyData.status_device,
        battery: historyData.battery,
        signal: historyData.signal,
        power: historyData.power,
        humidity: historyData.humidity,
        message: "Temperature history saved successfully",
        result: "success" as const,
      }
    } catch (error) {
      return {
        device_id: historyData.device_id,
        lat: historyData.lat,
        lon: historyData.lon,
        curr_temp: historyData.curr_temp,
        actual_time: historyData.actual_date,
        status_device: historyData.status_device,
        battery: historyData.battery,
        signal: historyData.signal,
        power: historyData.power,
        humidity: historyData.humidity,
        message: `Failed to save temperature history: ${error instanceof Error ? error.message : "Unknown error"}`,
        result: "error" as const,
      }
    }
  }

  async getTemperatureHistory(
    c: Context,
    params: {
      device_id?: string
      asset_id?: string
      from_date?: string
      to_date?: string
      page?: number
      paginate?: number
    }
  ) {
    let query = c.var.trx
      .selectFrom("asset_rtmd_histories")
      .leftJoin(
        "asset_rtmds as ar",
        "ar.id",
        "asset_rtmd_histories.asset_rtmd_id"
      )
      .leftJoin("asset_inventories as ai", "ai.id", "ar.entity_id")
      .leftJoin("entities as e", "e.id", "ai.entity_id")
      .select([
        "asset_rtmd_histories.id",
        "asset_rtmd_histories.asset_rtmd_id",
        "asset_rtmd_histories.latitude",
        "asset_rtmd_histories.longitude",
        "asset_rtmd_histories.temperature",
        "asset_rtmd_histories.battery",
        "asset_rtmd_histories.signal",
        "asset_rtmd_histories.humidity",
        "asset_rtmd_histories.actual_time",
        "ar.serial_number as device_serial",
        "ai.id as asset_id",
        "e.name as entity_name",
      ])
      .where("asset_rtmd_histories.deleted_at", "is", null)

    if (params.device_id) {
      query = query.where("ar.serial_number", "=", params.device_id)
    }

    if (params.asset_id) {
      query = query.where("ai.id", "=", parseInt(params.asset_id))
    }

    if (params.from_date || params.to_date) {
      if (params.from_date && params.to_date) {
        query = query
          .where(
            "asset_rtmd_histories.actual_time",
            ">=",
            sql<Date>`${params.from_date}`
          )
          .where(
            "asset_rtmd_histories.actual_time",
            "<",
            sql<Date>`${new Date(new Date(params.to_date).getTime() + 24 * 60 * 60 * 1000).toISOString()}`
          )
      } else if (params.from_date) {
        query = query.where(
          "asset_rtmd_histories.actual_time",
          ">=",
          sql<Date>`${params.from_date}`
        )
      } else if (params.to_date) {
        query = query.where(
          "asset_rtmd_histories.actual_time",
          "<=",
          sql<Date>`${params.to_date}`
        )
      }
    }

    const page = params.page || 1
    const limit = params.paginate || 10
    const offset = (page - 1) * limit

    // Create a separate query for counting
    let totalQuery = c.var.trx
      .selectFrom("asset_rtmd_histories")
      .leftJoin(
        "asset_rtmds as ar",
        "ar.id",
        "asset_rtmd_histories.asset_rtmd_id"
      )
      .leftJoin("asset_inventories as ai", "ai.id", "ar.entity_id")
      .leftJoin("entities as e", "e.id", "ai.entity_id")
      .select(sql`COUNT(*)`.as("total"))
      .where("asset_rtmd_histories.deleted_at", "is", null)

    // Apply the same filters to the count query
    if (params.device_id) {
      totalQuery = totalQuery.where("ar.serial_number", "=", params.device_id)
    }

    if (params.asset_id) {
      totalQuery = totalQuery.where("ai.id", "=", parseInt(params.asset_id))
    }

    if (params.from_date || params.to_date) {
      if (params.from_date && params.to_date) {
        totalQuery = totalQuery
          .where(
            "asset_rtmd_histories.actual_time",
            ">=",
            sql<Date>`${params.from_date}`
          )
          .where(
            "asset_rtmd_histories.actual_time",
            "<",
            sql<Date>`${new Date(new Date(params.to_date).getTime() + 24 * 60 * 60 * 1000).toISOString()}`
          )
      } else if (params.from_date) {
        totalQuery = totalQuery.where(
          "asset_rtmd_histories.actual_time",
          ">=",
          sql<Date>`${params.from_date}`
        )
      } else if (params.to_date) {
        totalQuery = totalQuery.where(
          "asset_rtmd_histories.actual_time",
          "<=",
          sql<Date>`${params.to_date}`
        )
      }
    }

    const totalResult = (await totalQuery.executeTakeFirst()) as {
      total: number
    }
    const total = totalResult?.total || 0

    const results = await query
      .limit(limit)
      .offset(offset)
      .orderBy("asset_rtmd_histories.actual_time", "desc")
      .execute()

    const totalPages = Math.ceil(total / limit)

    return {
      data: results,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    }
  }

  async getTemperatureHistoryByRtmdId(
    c: Context,
    params: {
      rtmd_id?: string
      from_date?: string
      to_date?: string
      page?: number
      paginate?: number
    }
  ) {
    let query = c.var.trx
      .selectFrom("asset_rtmd_histories")
      .innerJoin(
        "asset_rtmds as ar",
        "ar.id",
        "asset_rtmd_histories.asset_rtmd_id"
      )
      .innerJoin(
        (eb) =>
          eb
            .selectFrom("asset_inventory_rtmds")
            .select([
              "asset_rtmd_id",
              sql<number>`MIN(asset_inventory_id)`.as("asset_inventory_id"),
            ])
            .where("deleted_at", "is", null)
            .groupBy("asset_rtmd_id")
            .as("air"),
        (join) => join.onRef("ar.id", "=", "air.asset_rtmd_id")
      )
      .innerJoin("asset_inventories as ai", "ai.id", "air.asset_inventory_id")
      .innerJoin("asset_types as t", "ai.asset_type_id", "t.id")
      .leftJoin("asset_types_classifications as atc", (join) =>
        join.onRef("atc.asset_type_id", "=", "t.id")
      )
      .leftJoin(
        "asset_working_statuses as aws",
        "aws.id",
        "asset_rtmd_histories.inventory_working_status_id"
      )
      .leftJoin(
        "asset_rtmd_statuses as ars",
        "ars.id",
        "asset_rtmd_histories.rtmd_status_id"
      )
      .leftJoin(
        "asset_models_temperatures_capacities as amtc",
        "amtc.id",
        "asset_rtmd_histories.asset_model_temperature_capacity_id"
      )
      .leftJoin("asset_types_temperatures as att", (join) =>
        join.onRef("att.asset_type_id", "=", "t.id").on((eb) =>
          eb(
            eb
              .case()
              .when(
                "atc.asset_classifications_id",
                "=",
                ASSET_CLASSIFICATION.WAREHOUSE
              )
              .then(eb("att.id", "=", eb.ref("att.id")))
              .else(eb("att.id", "=", eb.ref("amtc.asset_type_temperature_id")))
              .end(),
            "=",
            true
          )
        )
      )
      .leftJoin(
        "temperature_thresholds as tt",
        "tt.id",
        "att.temperature_threshold_id"
      )
      // Remove problematic JOIN that causes duplicates
      // .leftJoin("asset_inventory_other_capacities as aioc", (join) =>
      //   join.onRef("ai.id", "=", "aioc.asset_inventory_id")
      // )
      .select([
        "asset_rtmd_histories.id",
        "asset_rtmd_histories.asset_rtmd_id",
        "asset_rtmd_histories.latitude",
        "asset_rtmd_histories.longitude",
        "asset_rtmd_histories.temperature",
        "asset_rtmd_histories.humidity",
        "asset_rtmd_histories.battery",
        "asset_rtmd_histories.signal",
        "asset_rtmd_histories.device_status",
        "asset_rtmd_histories.is_power_connected",
        "asset_rtmd_histories.actual_time",
        "asset_rtmd_histories.created_at",
        "asset_rtmd_histories.updated_at",
        "asset_rtmd_histories.asset_model_temperature_capacity_id",
        "asset_rtmd_histories.inventory_working_status_id",
        "asset_rtmd_histories.rtmd_status_id",
        "ar.serial_number as device_serial",
        // Working status info
        "aws.id as working_status_info_id",
        "aws.name as working_status_info_name",
        // RTMD status info
        "ars.id as rtmd_status_info_id",
        "ars.name as rtmd_status_info_name",
        // Temperature capacity info
        "amtc.id as temp_capacity_id",
        "amtc.gross_capacity",
        "amtc.net_capacity",
        sql<number>`MIN(tt.min_temperature)`.as("min_temperature"),
        sql<number>`MIN(tt.max_temperature)`.as("max_temperature"),
        sql`COALESCE(MIN(tt.max_temperature), 0)`.as("max_threshold"),
        sql`COALESCE(MIN(tt.min_temperature), 0)`.as("min_threshold"),
        sql<number>`MIN(atc.asset_classifications_id)`.as("asset_classifications_id"),
      ])
      .groupBy([
        "asset_rtmd_histories.id",
        "asset_rtmd_histories.asset_rtmd_id",
        "asset_rtmd_histories.latitude",
        "asset_rtmd_histories.longitude",
        "asset_rtmd_histories.temperature",
        "asset_rtmd_histories.humidity",
        "asset_rtmd_histories.battery",
        "asset_rtmd_histories.signal",
        "asset_rtmd_histories.device_status",
        "asset_rtmd_histories.is_power_connected",
        "asset_rtmd_histories.actual_time",
        "asset_rtmd_histories.created_at",
        "asset_rtmd_histories.updated_at",
        "asset_rtmd_histories.asset_model_temperature_capacity_id",
        "asset_rtmd_histories.inventory_working_status_id",
        "asset_rtmd_histories.rtmd_status_id",
        "ar.serial_number",
        "aws.id",
        "aws.name",
        "ars.id",
        "ars.name",
        "amtc.id",
        "amtc.gross_capacity",
        "amtc.net_capacity",
      ])

      .where("asset_rtmd_histories.deleted_at", "is", null)
      .where("ar.deleted_at", "is", null)
      .where("aws.deleted_at", "is", null)
      .where("ars.deleted_at", "is", null)
      .where("amtc.deleted_at", "is", null)
      .where("att.deleted_at", "is", null)
      .where("tt.deleted_at", "is", null)
    // Remove aioc WHERE clause since JOIN is removed
    // .where("aioc.deleted_at", "is", null)

    // Filter by RTMD ID
    if (params.rtmd_id) {
      query = query.where(
        "asset_rtmd_histories.asset_rtmd_id",
        "=",
        parseInt(params.rtmd_id)
      )
    }

    // Filter by date period
    if (params.from_date || params.to_date) {
      if (params.from_date && params.to_date) {
        query = query
          .where(
            "asset_rtmd_histories.actual_time",
            ">=",
            sql<Date>`${params.from_date}`
          )
          .where(
            "asset_rtmd_histories.actual_time",
            "<",
            sql<Date>`${new Date(new Date(params.to_date).getTime() + 24 * 60 * 60 * 1000).toISOString()}`
          )
      } else if (params.from_date) {
        query = query.where(
          "asset_rtmd_histories.actual_time",
          ">=",
          sql<Date>`${params.from_date}`
        )
      } else if (params.to_date) {
        query = query.where(
          "asset_rtmd_histories.actual_time",
          "<=",
          sql<Date>`${params.to_date}`
        )
      }
    }

    const page = params.page || 1
    const limit = params.paginate || 10
    const offset = (page - 1) * limit

    // Create a separate query for counting
    let totalQuery = c.var.trx
      .selectFrom("asset_rtmd_histories")
      .select(sql`COUNT(*)`.as("total"))
      .where("asset_rtmd_histories.deleted_at", "is", null)

    // Apply the same filters to the count query
    if (params.rtmd_id) {
      totalQuery = totalQuery.where(
        "asset_rtmd_histories.asset_rtmd_id",
        "=",
        parseInt(params.rtmd_id)
      )
    }

    if (params.from_date || params.to_date) {
      if (params.from_date && params.to_date) {
        totalQuery = totalQuery
          .where(
            "asset_rtmd_histories.actual_time",
            ">=",
            sql<Date>`${params.from_date}`
          )
          .where(
            "asset_rtmd_histories.actual_time",
            "<",
            sql<Date>`${new Date(new Date(params.to_date).getTime() + 24 * 60 * 60 * 1000).toISOString()}`
          )
      } else if (params.from_date) {
        totalQuery = totalQuery.where(
          "asset_rtmd_histories.actual_time",
          ">=",
          sql<Date>`${params.from_date}`
        )
      } else if (params.to_date) {
        totalQuery = totalQuery.where(
          "asset_rtmd_histories.actual_time",
          "<=",
          sql<Date>`${params.to_date}`
        )
      }
    }

    const totalResult = (await totalQuery.executeTakeFirst()) as {
      total: number
    }
    const total = totalResult?.total || 0

    const results = await query
      .limit(limit)
      .offset(offset)
      .orderBy("asset_rtmd_histories.actual_time", "desc")
      .execute()

    console.log(results)

    // Format the response data
    const formattedResults = results.map((item) => {
      const formatted = {
        id: item.id,
        asset_rtmd_id: item.asset_rtmd_id,
        latitude: item.latitude,
        longitude: item.longitude,
        temperature: item.temperature,
        humidity: item.humidity,
        battery: item.battery,
        signal: item.signal,
        device_status: item.device_status,
        is_power_connected: item.is_power_connected,
        actual_time: item.actual_time,
        created_at: item.created_at,
        updated_at: item.updated_at,
        device_serial: item.device_serial,
        // Status objects
        working_status: item.working_status_info_id
          ? {
            id: item.working_status_info_id,
            name: item.working_status_info_name,
          }
          : null,
        rtmd_status: item.rtmd_status_info_id
          ? {
            id: item.rtmd_status_info_id,
            name: item.rtmd_status_info_name,
          }
          : null,
        // Temperature capacity object
        temperature_capacity: item.temp_capacity_id
          ? {
            id: item.temp_capacity_id,
            gross_capacity: item.gross_capacity,
            net_capacity: item.net_capacity,
          }
          : null,
        // Temperature threshold object
        temperature_threshold: item.temp_capacity_id
          ? {
            min_temperature: item.min_temperature,
            max_temperature: item.max_temperature,
            min_threshold: item.min_threshold,
            max_threshold: item.max_threshold,
          }
          : item.asset_classifications_id === 5
            ? {
              min_threshold: item.min_threshold,
              max_threshold: item.max_threshold,
              min_temperature: item.min_temperature,
              max_temperature: item.max_temperature,
            }
            : null,
        // Remove other temperature capacity object since JOIN is removed
        other_temperature_capacity: null,
        // Remove other temperature threshold object since JOIN is removed
        other_temperature_threshold: null,
      }

      return formatted
    })

    const totalPages = Math.ceil(total / limit)

    return {
      data: formattedResults,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    }
  }

  async getTemperatureHistoryForExport(
    c: Context,
    params: {
      rtmd_id?: string
      from_date?: string
      to_date?: string
    }
  ) {
    let query = c.var.trx
      .selectFrom("asset_rtmd_histories")
      .innerJoin(
        "asset_rtmds as ar",
        "ar.id",
        "asset_rtmd_histories.asset_rtmd_id"
      )
      .leftJoin(
        "asset_inventory_rtmds as air",
        "air.asset_rtmd_id",
        "asset_rtmd_histories.asset_rtmd_id"
      )
      .leftJoin("asset_inventories as ai", "ai.id", "air.asset_inventory_id")
      .leftJoin("asset_types as t", "ai.asset_type_id", "t.id")
      .leftJoin("asset_types_classifications as atc", (join) =>
        join.onRef("t.id", "=", "atc.asset_type_id")
      )
      .leftJoin("asset_models as am", "am.id", "ai.asset_model_id")
      .leftJoin("manufactures as m", "m.id", "ai.manufacture_id")
      .leftJoin("entities as e", "e.id", "ai.entity_id")
      .leftJoin(
        "asset_working_statuses as aws",
        "aws.id",
        "asset_rtmd_histories.inventory_working_status_id"
      )
      .leftJoin("asset_calibration_schedules as wacs", (join) =>
        join.onRef("ai.calibration_schedule_id", "=", "wacs.id")
      )
      .leftJoin("asset_maintenance_schedules as wams", (join) =>
        join.onRef("ai.maintenance_schedule_id", "=", "wams.id")
      )
      .select([
        "air.description",
        "asset_rtmd_histories.temperature",
        "asset_rtmd_histories.actual_time",
        "ar.serial_number",
        "asset_rtmd_histories.humidity",
        "asset_rtmd_histories.battery",
        "asset_rtmd_histories.signal",
        "asset_rtmd_histories.device_status",
        "asset_rtmd_histories.is_power_connected",
        "asset_rtmd_histories.actual_time",
        "asset_rtmd_histories.latitude",
        "asset_rtmd_histories.longitude",
        "asset_rtmd_histories.inventory_working_status_id",
        "atc.asset_classifications_id",
        sql<string>`MAX(am.name)`.as("asset_model_name"),
        sql<string>`MAX(m.name)`.as("manufacture_name"),
        sql<number>`MAX(asset_rtmd_histories.inventory_working_status_id)`.as(
          "working_status_id"
        ),
        "aws.name as working_status_name",
        sql<number>`SUM(CASE WHEN air.deleted_at IS NULL THEN air.sensor_qty ELSE 0 END)`.as(
          "sensor_qty"
        ),
        // Asset inventory fields for warranty, maintenance, and calibration
        sql<string>`MAX(ai.warranty_start_date)`.as("warranty_start_date"),
        sql<string>`MAX(ai.warranty_end_date)`.as("warranty_end_date"),
        sql<string>`MAX(ai.calibration_last_date)`.as("calibration_last_date"),
        sql<string>`MAX(ai.maintenance_last_date)`.as("maintenance_last_date"),
        sql<string>`MAX(wacs.name)`.as("calibration_schedule_name"),
        sql<string>`MAX(wams.name)`.as("maintenance_schedule_name"),
        sql<number>`MAX(ai.id)`.as("asset_id"),
        // Entity fields
        sql<string>`MAX(e.name)`.as("entity_name"),
        sql<string>`MAX(e.type)`.as("entity_type"),
      ])
      .where("asset_rtmd_histories.deleted_at", "is", null)
      .where("ar.deleted_at", "is", null)
      .where("air.deleted_at", "is", null)
      .where("ai.deleted_at", "is", null)
      .where("wacs.deleted_at", "is", null)
      .where("wams.deleted_at", "is", null)
      .where("e.deleted_at", "is", null)
      .groupBy([
        "asset_rtmd_histories.id",
        "asset_rtmd_histories.temperature",
        "asset_rtmd_histories.actual_time",
        "ar.serial_number",
        "asset_rtmd_histories.humidity",
        "asset_rtmd_histories.battery",
        "asset_rtmd_histories.signal",
        "asset_rtmd_histories.device_status",
        "asset_rtmd_histories.is_power_connected",
        "asset_rtmd_histories.actual_time",
        "asset_rtmd_histories.latitude",
        "asset_rtmd_histories.longitude",
        "asset_rtmd_histories.inventory_working_status_id",
        "aws.name",
      ])

    // Filter by RTMD ID
    if (params.rtmd_id) {
      query = query.where(
        "asset_rtmd_histories.asset_rtmd_id",
        "=",
        parseInt(params.rtmd_id)
      )
    }

    // Filter by date period
    if (params.from_date || params.to_date) {
      if (params.from_date && params.to_date) {
        query = query
          .where(
            "asset_rtmd_histories.actual_time",
            ">=",
            sql<Date>`${params.from_date}`
          )
          .where(
            "asset_rtmd_histories.actual_time",
            "<",
            sql<Date>`${new Date(new Date(params.to_date).getTime() + 24 * 60 * 60 * 1000).toISOString()}`
          )
      } else if (params.from_date) {
        query = query.where(
          "asset_rtmd_histories.actual_time",
          ">=",
          sql<Date>`${params.from_date}`
        )
      } else if (params.to_date) {
        query = query.where(
          "asset_rtmd_histories.actual_time",
          "<=",
          sql<Date>`${params.to_date}`
        )
      }
    }

    const results = await query
      .orderBy("asset_rtmd_histories.actual_time", "desc")
      .execute()

    return results
  }

  async updateTemperatureRange(
    c: Context,
    assetInventoryId: number,
    temperatureThresholdId: number,
    updatedBy: number
  ): Promise<boolean> {
    const trx = c.var.trx

    const assetInventory = await trx
      .selectFrom("asset_inventories")
      .selectAll()
      .where("id", "=", assetInventoryId)
      .where("deleted_at", "is", null)
      .executeTakeFirst()

    if (!assetInventory) {
      throw new Error("Asset inventory not found")
    }

    const capacityExists = await trx
      .selectFrom("asset_models_temperatures_capacities")
      .selectAll()
      .where("id", "=", temperatureThresholdId)
      .where("deleted_at", "is", null)
      .executeTakeFirst()

    if (!capacityExists) {
      throw new Error(
        `Asset model temperature capacity with ID ${temperatureThresholdId} does not exist or has been deleted.`
      )
    }

    const newCapacityId = temperatureThresholdId

    if (assetInventory.asset_model_temperature_capacity_id) {
      const existingHistory = await trx
        .selectFrom("asset_inventory_temperature_capacity_histories")
        .select("id")
        .where("asset_inventory_id", "=", assetInventoryId)
        .where(
          "asset_model_temperature_capacity_id",
          "=",
          assetInventory.asset_model_temperature_capacity_id
        )
        .executeTakeFirst()

      if (!existingHistory) {
        await trx
          .insertInto("asset_inventory_temperature_capacity_histories")
          .values({
            asset_inventory_id: assetInventoryId,
            asset_model_temperature_capacity_id:
              assetInventory.asset_model_temperature_capacity_id,
          })
          .execute()
      }
    }

    await trx
      .updateTable("asset_inventories")
      .set({
        asset_model_temperature_capacity_id: newCapacityId,
        updated_at: new Date(),
        updated_by: updatedBy,
      })
      .where("id", "=", assetInventoryId)
      .execute()

    return true
  }

  async getListAssetMonitoringTemperature(
    c: Context,
    params: GetAssetMonitoringTemperatureQuery,
    entityId: number | number[]
  ) {
    const {
      page,
      paginate,
      keyword,
      asset_type_ids,
      manufacture_ids,
      working_status_id,
      province_id,
      regency_id,
      health_center_id,
      entity_tag_ids,
      asset_model_ids,
      sort_by,
      sort_type,
      is_device_related,
      is_warehouse,
      temperature_filter,
      rtmd_manufacture_ids,
    } = params
    const { client } = c.var
    const offset = (page - 1) * paginate

    let sort

    if (sort_by && sort_type) {
      if (sort_by === "name") {
        sort = [
          ["asset_model_name", sort_type],
          ["other_asset_model_name", sort_type],
          ["manufacture_name", sort_type],
          ["other_manufacture_name", sort_type],
          ["serial_number", sort_type],
        ]
      } else {
        let sortField = sort_by
        if (sort_by === "serial_number") sortField = "serial_number"
        if (sort_by === "asset_type_name") sortField = "asset_type_name"
        if (sort_by === "working_status_name")
          sortField = "asset_working_status_name"

        sort = [[sortField, sort_type]]
      }
    } else {
      sort = [["updated_at", "desc"]]
    }

    let queries = c.var.trx
      .with("lh_latest", (db) =>
        db
          .selectFrom("asset_rtmd_histories as arh")
          .innerJoin(
            "asset_inventory_rtmds as air",
            "air.asset_rtmd_id",
            "arh.asset_rtmd_id"
          )
          .select([
            "air.asset_inventory_id",
            "arh.temperature",
            "arh.created_at",
            sql<number>`ROW_NUMBER() OVER (
            PARTITION BY arh.asset_rtmd_id
            ORDER BY arh.created_at DESC
          )`.as("rn"),
          ])
      )
      .selectFrom("asset_inventories as wai")
      .innerJoin("entities as we", (join) =>
        join.onRef("wai.entity_id", "=", "we.id")
      )
      .innerJoin("entity_types as et", (join) =>
        join.onRef("we.type", "=", "et.id")
      )
      .$if(!!client, (qb) =>
        qb.innerJoin("integration_associations as ea", (join) =>
          join
            .onRef("ea.internal_id", "=", "we.id")
            .on("ea.type", "=", "entity")
            .on("ea.client_id", "=", client!.getId())
        )
      )
      .innerJoin("users as wuu", (join) =>
        join.onRef("wai.updated_by", "=", "wuu.id")
      )
      .leftJoin("locations as lp", (join) =>
        join.onRef("we.province_id", "=", "lp.id")
      )
      .leftJoin("locations as lr", (join) =>
        join.onRef("we.regency_id", "=", "lr.id")
      )
      .leftJoin("locations as lsd", (join) =>
        join.onRef("we.sub_district_id", "=", "lsd.id")
      )
      .leftJoin("asset_models as wam", (join) =>
        join.onRef("wai.asset_model_id", "=", "wam.id")
      )
      .leftJoin("asset_types as wat", (join) =>
        join.onRef("wai.asset_type_id", "=", "wat.id")
      )
      .leftJoin("asset_types_classifications as atc", (join) =>
        join
          .onRef("wat.id", "=", "atc.asset_type_id")
          .on("atc.deleted_at", "is", null)
      )
      .leftJoin("manufactures as wm", (join) =>
        join.onRef("wai.manufacture_id", "=", "wm.id")
      )
      .leftJoin("asset_working_statuses as waws", (join) =>
        join.onRef("wai.working_status_id", "=", "waws.id")
      )
      .leftJoin("asset_inventory_other_capacities as aioc", (join) =>
        join.onRef("wai.id", "=", "aioc.asset_inventory_id")
      )
      .leftJoin("asset_calibration_schedules as wacs", (join) =>
        join.onRef("wai.calibration_schedule_id", "=", "wacs.id")
      )
      .leftJoin("asset_maintenance_schedules as wams", (join) =>
        join.onRef("wai.maintenance_schedule_id", "=", "wams.id")
      )
      .leftJoin("asset_models_temperatures_capacities as amtc", (join) =>
        join.onRef("amtc.id", "=", "wai.asset_model_temperature_capacity_id")
      )
      .leftJoin("asset_types_temperatures as att", (join) =>
        join
          .onRef("att.asset_type_id", "=", "wat.id")
          .onRef("att.id", "=", "amtc.asset_type_temperature_id")
      )
      .leftJoin("temperature_thresholds as tt", (join) =>
        join.onRef("tt.id", "=", "att.temperature_threshold_id")
      )
      .leftJoin("asset_inventory_rtmds as wair", (join) =>
        join
          .onRef("wai.id", "=", "wair.asset_inventory_id")
          .on("wair.deleted_at", "is", null)
      )
      .leftJoin("asset_rtmds as war", (join) =>
        join
          .onRef("wair.asset_rtmd_id", "=", "war.id")
          .on("war.deleted_at", "is", null)
      )

    queries = queries
      .where("wai.deleted_at", "is", null)
      .$if(is_device_related !== undefined, (eb) =>
        eb.where(
          "wai.id",
          is_device_related === 1 ? "in" : "not in",
          c.var.trx
            .selectFrom("asset_inventory_rtmds")
            .select("asset_inventory_id")
            .where("deleted_at", "is", null)
        )
      )
      .$if(is_warehouse !== undefined, (eb) =>
        eb.where(
          "wai.asset_type_id",
          is_warehouse === FLAG.TRUE ? "in" : "not in",
          c.var.trx
            .selectFrom("asset_types_classifications")
            .select("asset_type_id")
            .where(
              "asset_classifications_id",
              "=",
              ASSET_CLASSIFICATION.WAREHOUSE
            )
        )
      )

    if (typeof entityId === "object" && entityId.length > 0) {
      queries = queries.where("wai.entity_id", "in", entityId)
    }

    if (typeof entityId === "number") {
      queries = queries.where("wai.entity_id", "=", entityId)
    }

    if (keyword) {
      queries = queries.where((eb) =>
        eb.or([
          eb("wam.name", "like", `%${keyword}%`),
          eb("wai.other_asset_model_name", "like", `%${keyword}%`),
          eb("wm.name", "like", `%${keyword}%`),
          eb("wai.other_asset_manufacture_name", "like", `%${keyword}%`),
          eb("wai.serial_number", "like", `%${keyword}%`),
        ])
      )
    }

    if (asset_type_ids) {
      queries = queries.where("wai.asset_type_id", "in", asset_type_ids)
    }

    if (manufacture_ids) {
      queries = queries.where("wai.manufacture_id", "in", manufacture_ids)
    }

    if (rtmd_manufacture_ids) {
      queries = queries.where("war.manufacture_id", "in", rtmd_manufacture_ids)
    }

    if (working_status_id) {
      queries = queries.where("wai.working_status_id", "=", working_status_id)
    }

    if (province_id) {
      queries = queries.where("we.province_id", "=", province_id)
    }

    if (regency_id) {
      queries = queries.where("we.regency_id", "=", regency_id)
    }

    if (health_center_id) {
      queries = queries.where("we.id", "=", health_center_id)
    }

    if (entity_tag_ids && entity_tag_ids.length > 0) {
      queries = queries.where("we.entity_tag_id", "in", entity_tag_ids)
    }

    if (asset_model_ids) {
      queries = queries.where("wai.asset_model_id", "in", asset_model_ids)
    }

    if (temperature_filter) {
      queries = queries.leftJoin("lh_latest", (join) =>
        join
          .onRef("lh_latest.asset_inventory_id", "=", "wai.id")
          .on("lh_latest.rn", "=", sql.lit(1))
      )
      if (temperature_filter === "below") {
        queries = queries.where(
          sql<boolean>`(tt.min_temperature > lh_latest.temperature
          OR aioc.min_temperature > lh_latest.temperature)`
        )
      } else if (temperature_filter === "above") {
        queries = queries.where(
          sql<boolean>`(tt.max_temperature < lh_latest.temperature
          OR aioc.max_temperature < lh_latest.temperature)`
        )
      } else {
        queries = queries.where(
          sql<boolean>`((tt.min_temperature <= lh_latest.temperature
          AND tt.max_temperature >= lh_latest.temperature)
          OR (aioc.min_temperature <= lh_latest.temperature
          AND aioc.max_temperature >= lh_latest.temperature))`
        )
      }
    }

    const baseQuery = queries
      .select([
        "wai.id",
        "wai.asset_model_id",
        "wam.name as asset_model_name",
        "wai.asset_type_id",
        "wat.name as asset_type_name",
        "wam.net_capacity",
        "wam.gross_capacity",
        "wai.asset_model_temperature_capacity_id",
        "wai.working_status_id",
        "waws.name as asset_working_status_name",
        "wai.entity_id",
        "we.name as entity_name",
        "we.is_puskesmas as entity_is_puskesmas",
        "we.province_id",
        "lp.name as province_name",
        "we.regency_id",
        "lr.name as regency_name",
        "we.sub_district_id",
        "lsd.name as sub_district_name",
        "et.name as entity_type",
        "wai.ownership_qty",
        "wai.ownership_status",
        "wai.manufacture_id",
        "wm.name as manufacture_name",
        "wai.serial_number",
        "wai.status as status_id",
        (eb) =>
          eb
            .case()
            .when(eb.ref("wai.status"), "=", eb.val(1))
            .then(eb.val("active"))
            .else(eb.val("inactive"))
            .end()
            .as("status"),
        "wuu.id as user_updated_id",
        "wuu.username as user_updated_username",
        "wuu.firstname as user_updated_firstname",
        "wuu.lastname as user_updated_lastname",
        sql<string>`TRIM(CONCAT_WS(' ',COALESCE(CAST(${sql.ref("wuu.firstname")} AS CHAR), ''),COALESCE(CAST(${sql.ref("wuu.lastname")} AS CHAR), '')))`.as(
          "user_updated_fullname"
        ),
        "wai.created_at",
        "wai.updated_at",
        "wai.other_asset_model_name",
        "wai.other_asset_type_name",
        "wai.other_asset_manufacture_name",
        "wai.other_asset_budget_source_name",
        "wai.other_borrowed_from_entity_name",
        sql<number>`MIN(aioc.id)`.as("other_inventories_id"),
        sql<number>`MIN(aioc.gross)`.as("other_gross_capacity"),
        sql<number>`MIN(aioc.net)`.as("other_net_capacity"),
        sql<number>`MIN(aioc.max_temperature)`.as("other_max_temperature"),
        sql<number>`MIN(aioc.min_temperature)`.as("other_min_temperature"),
        sql<number>`MIN(att.id)`.as("asset_type_temperature_id"),
        "wai.production_year",
        "wai.warranty_start_date",
        "wai.warranty_end_date",
        "wai.calibration_last_date",
        "wacs.name as calibration_schedule_name",
        "wai.maintenance_last_date",
        "wams.name as maintenance_schedule_name",
        sql<number>`MIN(atc.asset_classifications_id)`.as(
          "asset_classifications_id"
        ),
      ])
      .groupBy([
        "wai.id",
        "wai.asset_model_id",
        "wam.name",
        "wai.asset_type_id",
        "wat.name",
        "wam.net_capacity",
        "wam.gross_capacity",
        "wai.asset_model_temperature_capacity_id",
        "wai.working_status_id",
        "waws.name",
        "wai.entity_id",
        "we.name",
        "we.is_puskesmas",
        "we.province_id",
        "lp.name",
        "we.regency_id",
        "lr.name",
        "we.sub_district_id",
        "lsd.name",
        "et.name",
        "wai.ownership_qty",
        "wai.ownership_status",
        "wai.manufacture_id",
        "wm.name",
        "wai.serial_number",
        "wai.status",
        "wuu.id",
        "wuu.username",
        "wuu.firstname",
        "wuu.lastname",
        "wai.created_at",
        "wai.updated_at",
        "wai.other_asset_model_name",
        "wai.other_asset_type_name",
        "wai.other_asset_manufacture_name",
        "wai.other_asset_budget_source_name",
        "wai.other_borrowed_from_entity_name",
        "wai.production_year",
        "wai.warranty_start_date",
        "wai.warranty_end_date",
        "wai.calibration_last_date",
        "wacs.name",
        "wai.maintenance_last_date",
        "wams.name",
      ])

    const orderedQuery = sort.reduce(
      (q, [col, dir]) => q.orderBy(col as string, dir),
      baseQuery
    )

    const [list, totalList] = await Promise.all([
      orderedQuery.limit(paginate).offset(offset).execute(),
      queries
        .select((eb) => eb.fn.count(sql`DISTINCT wai.id`).as("total"))
        .executeTakeFirst(),
    ])

    return {
      list: list,
      total: Number(totalList?.total) || 0,
    }
  }

  async getAssetMonitoringTemperatureById(c: Context, id: number) {
    const assetInventory = await c.var.trx
      .selectFrom("asset_inventories as wai")
      .innerJoin("entities as we", (join) =>
        join.onRef("wai.entity_id", "=", "we.id")
      )
      .innerJoin("entity_tags as et", (join) =>
        join.onRef("we.entity_tag_id", "=", "et.id")
      )
      .innerJoin("users as wuc", (join) =>
        join.onRef("wai.created_by", "=", "wuc.id")
      )
      .innerJoin("users as wuu", (join) =>
        join.onRef("wai.updated_by", "=", "wuu.id")
      )
      .leftJoin("locations as lp", (join) =>
        join.onRef("we.province_id", "=", "lp.id")
      )
      .leftJoin("locations as lr", (join) =>
        join.onRef("we.regency_id", "=", "lr.id")
      )
      .leftJoin("locations as lsd", (join) =>
        join.onRef("we.sub_district_id", "=", "lsd.id")
      )
      .leftJoin("locations as lv", (join) =>
        join.onRef("we.village_id", "=", "lv.id")
      )
      .leftJoin("asset_models as wam", (join) =>
        join.onRef("wai.asset_model_id", "=", "wam.id")
      )
      .leftJoin("asset_types as wat", (join) =>
        join.onRef("wai.asset_type_id", "=", "wat.id")
      )
      .leftJoin("asset_types_classifications as atc", (join) =>
        join.onRef("wat.id", "=", "atc.asset_type_id")
      )
      .leftJoin("manufactures as wm", (join) =>
        join.onRef("wai.manufacture_id", "=", "wm.id")
      )
      .leftJoin("asset_working_statuses as waws", (join) =>
        join.onRef("wai.working_status_id", "=", "waws.id")
      )
      .leftJoin("budget_sources as wbs", (join) =>
        join.onRef("wai.budget_source_id", "=", "wbs.id")
      )
      .leftJoin("asset_calibration_schedules as wacs", (join) =>
        join.onRef("wai.calibration_schedule_id", "=", "wacs.id")
      )
      .leftJoin("asset_maintenance_schedules as wams", (join) =>
        join.onRef("wai.maintenance_schedule_id", "=", "wams.id")
      )
      .leftJoin("asset_inventory_other_capacities as aioc", (join) =>
        join.onRef("wai.id", "=", "aioc.asset_inventory_id")
      )
      .select([
        "wai.id",
        "wai.asset_model_id",
        "wam.name as asset_model_name",
        "wai.asset_type_id",
        "wat.name as asset_type_name",
        "wai.working_status_id",
        "waws.name as asset_working_status_name",
        "wai.entity_id",
        "we.name as entity_name",
        "we.is_puskesmas as entity_is_puskesmas",
        "we.province_id",
        "lp.name as province_name",
        "we.regency_id",
        "lr.name as regency_name",
        "wai.ownership_qty",
        "wai.ownership_status",
        "wai.manufacture_id",
        "wm.name as manufacture_name",
        "wai.serial_number",
        "wai.status",
        "wbs.id as budget_source_id",
        "wbs.name as budget_source_name",
        "wai.budget_year",
        "wai.other_asset_model_name",
        "wai.other_asset_type_name",
        "wai.other_asset_manufacture_name",
        "wai.other_asset_budget_source_name",
        "wai.other_borrowed_from_entity_name",
        "wai.asset_model_temperature_capacity_id",
        "wai.created_at",
        "wai.updated_at",
        "wuc.id as user_created_id",
        "wuc.username as user_created_username",
        "wuc.firstname as user_created_firstname",
        "wuc.lastname as user_created_lastname",
        sql<string>`TRIM(CONCAT_WS(' ',COALESCE(CAST(${sql.ref("wuc.firstname")} AS CHAR), ''),COALESCE(CAST(${sql.ref("wuc.lastname")} AS CHAR), '')))`.as(
          "user_created_fullname"
        ),
        "wuu.id as user_updated_id",
        "wuu.username as user_updated_username",
        "wuu.firstname as user_updated_firstname",
        "wuu.lastname as user_updated_lastname",
        sql<string>`TRIM(CONCAT_WS(' ',COALESCE(CAST(${sql.ref("wuu.firstname")} AS CHAR), ''),COALESCE(CAST(${sql.ref("wuu.lastname")} AS CHAR), '')))`.as(
          "user_updated_fullname"
        ),
        "aioc.gross as other_gross_capacity",
        "aioc.net as other_net_capacity",
        "aioc.max_temperature as other_max_temperature",
        "aioc.min_temperature as other_min_temperature",
        "wai.production_year",
        "wai.warranty_start_date",
        "wai.warranty_end_date",
        "wai.calibration_last_date",
        "wacs.name as calibration_schedule_name",
        "wai.maintenance_last_date",
        "wams.name as maintenance_schedule_name",
        "atc.asset_classifications_id",
      ])
      .where("wai.id", "=", id)
      .where("wai.deleted_at", "is", null)
      .executeTakeFirst()

    if (!assetInventory) return null

    // Get contact persons data
    const contactPersons = await c.var.trx
      .selectFrom("contact_persons")
      .select(["id", "name", "phone"])
      .where("source_id", "=", assetInventory.id)
      .where("source_type", "=", "asset_inventory")
      .where("deleted_at", "is", null)
      .execute()

    // Get temperature capacities data
    const temperatureCapacities =
      assetInventory.asset_classifications_id !== ASSET_CLASSIFICATION.WAREHOUSE
        ? await c.var.trx
          .selectFrom("asset_models_temperatures_capacities as amtc")
          .innerJoin("asset_types_temperatures as att", (join) =>
            join.onRef("amtc.asset_type_temperature_id", "=", "att.id")
          )
          .innerJoin("temperature_thresholds as tt", (join) =>
            join.onRef("att.temperature_threshold_id", "=", "tt.id")
          )
          .select([
            "amtc.id",
            "amtc.gross_capacity",
            "amtc.net_capacity",
            "tt.min_temperature",
            "tt.max_temperature",
          ])
          .where("amtc.asset_model_id", "=", assetInventory.asset_model_id)
          .where("amtc.deleted_at", "is", null)
          .orderBy("tt.min_temperature", "desc")
          .execute()
        : await c.var.trx
          .selectFrom("asset_inventories as ai")
          .innerJoin("asset_types as at", (join) =>
            join
              .onRef("ai.asset_type_id", "=", "at.id")
              .on("at.deleted_at", "is", null)
          )
          .innerJoin("asset_types_classifications as atc", (join) =>
            join
              .onRef("at.id", "=", "atc.asset_type_id")
              .on("atc.deleted_at", "is", null)
              .on(
                "atc.asset_classifications_id",
                "=",
                sql.lit(ASSET_CLASSIFICATION.WAREHOUSE)
              )
          )
          .innerJoin("asset_types_temperatures as att", (join) =>
            join.onRef("at.id", "=", "att.asset_type_id")
          )
          .innerJoin("temperature_thresholds as tt", (join) =>
            join
              .onRef("att.temperature_threshold_id", "=", "tt.id")
              .on("tt.deleted_at", "is", null)
              .on("tt.is_predefined", "=", 2)
          )
          .select([
            "tt.min_temperature",
            "tt.max_temperature",
            sql<number>`0`.as("gross_capacity"),
            sql<number>`0`.as("net_capacity"),
          ])
          .where("ai.id", "=", assetInventory.id)
          .orderBy("tt.min_temperature", "desc")
          .execute()

    // If temperature capacities exist, use them for both capacities and temperature_thresholds
    if (temperatureCapacities.length > 0) {
      // Get the currently active temperature capacity ID from asset inventory
      const activeCapacityId =
        assetInventory.asset_model_temperature_capacity_id

      console.log("activeCapacityId", activeCapacityId)

      return {
        ...assetInventory,
        contact_persons: contactPersons,
        capacities: temperatureCapacities.map((tc) => ({
          gross_capacity: tc.gross_capacity,
          net_capacity: tc.net_capacity,
        })),
        temperature_thresholds: temperatureCapacities.map((tc) => ({
          id: tc.id,
          min_temperature: tc.min_temperature,
          max_temperature: tc.max_temperature,
          is_active:
            tc.id === activeCapacityId
              ? 1
              : assetInventory.asset_classifications_id ===
                ASSET_CLASSIFICATION.WAREHOUSE
                ? 1
                : 0,
        })),
      }
    }

    // If no temperature capacities, get non-temperature capacities
    const nonTemperatureCapacities = await c.var.trx
      .selectFrom("asset_models_non_temperatures_capacities")
      .select(["gross_capacity", "net_capacity"])
      .where("asset_model_id", "=", assetInventory.asset_model_id)
      .where("deleted_at", "is", null)
      .orderBy("gross_capacity", "asc")
      .execute()

    return {
      ...assetInventory,
      contact_persons: contactPersons,
      capacities: nonTemperatureCapacities.map((ntc) => ({
        gross_capacity: ntc.gross_capacity,
        net_capacity: ntc.net_capacity,
      })),
      temperature_thresholds: [], // Empty array when no temperature data
    }
  }

  async getEntityById(c: Context, id: number) {
    return await c.var.trx
      .selectFrom("entities as e")
      .leftJoin("integration_associations as ia", (join) =>
        join.onRef("e.id", "=", "ia.internal_id").on("ia.type", "=", "entity")
      )
      .select([
        "e.id",
        "e.province_id",
        "e.regency_id",
        "e.sub_district_id",
        "e.type",
        "e.is_puskesmas",
        "ia.client_id",
      ])
      .where("e.id", "=", id)
      .where("e.deleted_at", "is", null)
      .executeTakeFirstOrThrow()
  }

  async getEntityByProvince(c: Context, provinceId: string) {
    return await c.var.trx
      .selectFrom("entities")
      .select(["id"])
      .where((eb) =>
        eb.or([
          eb.and([
            eb("province_id", "=", provinceId),
            eb("regency_id", "is", null),
            eb("sub_district_id", "is", null),
            eb("village_id", "is", null),
            eb("type", "=", 1),
            eb("is_puskesmas", "=", 0),
          ]),
          eb.and([
            eb("province_id", "=", provinceId),
            eb("sub_district_id", "is", null),
            eb("village_id", "is", null),
            eb("type", "=", 2),
            eb("is_puskesmas", "=", 0),
          ]),
          eb.and([
            eb("province_id", "=", provinceId),
            eb("village_id", "is", null),
            eb("type", "=", 3),
            eb("is_puskesmas", "=", 1),
          ]),
        ])
      )
      .where("deleted_at", "is", null)
      .execute()
  }

  async getEntityByRegency(c: Context, regencyId: string) {
    return await c.var.trx
      .selectFrom("entities")
      .select(["id"])
      .where((eb) =>
        eb.or([
          eb.and([
            eb("regency_id", "=", regencyId),
            eb("sub_district_id", "is", null),
            eb("village_id", "is", null),
            eb("type", "=", 2),
            eb("is_puskesmas", "=", 0),
          ]),
          eb.and([
            eb("regency_id", "=", regencyId),
            eb("village_id", "is", null),
            eb("type", "=", 3),
            eb("is_puskesmas", "=", 1),
          ]),
        ])
      )
      .where("deleted_at", "is", null)
      .execute()
  }

  async getAssetInventoryRtmds(c: Context, assetInventoryId: number) {
    // First get the RTMD associations with basic info
    const rtmdAssociations = await c.var.trx
      .selectFrom("asset_inventory_rtmds as air")
      .innerJoin("asset_rtmds as ar", (join) =>
        join.onRef("air.asset_rtmd_id", "=", "ar.id")
      )
      .leftJoin("asset_models as am", (join) =>
        join.onRef("ar.asset_model_id", "=", "am.id")
      )
      .leftJoin("asset_types as at", (join) =>
        join.onRef("ar.asset_type_id", "=", "at.id")
      )
      .leftJoin("manufactures as m", (join) =>
        join.onRef("ar.manufacture_id", "=", "m.id")
      )
      .select([
        "ar.id",
        "air.sensor_qty",
        "air.description",
        "ar.serial_number",
        "am.id as asset_model_id",
        "am.name as asset_model_name",
        "at.id as asset_type_id",
        "at.name as asset_type_name",
        "m.id as manufacture_id",
        "m.name as manufacture_name",
      ])
      .where("air.asset_inventory_id", "=", assetInventoryId)
      .where("ar.deleted_at", "is", null)
      .execute()

    // For each RTMD, get the latest log from asset_rtmd_histories
    const results = await Promise.all(
      rtmdAssociations.map(async (rtmd) => {
        const latestLog = await c.var.trx
          .selectFrom("asset_rtmd_histories")
          .select([
            "temperature",
            "humidity",
            "battery",
            "signal",
            "device_status",
            "is_power_connected",
            "actual_time",
            "updated_at",
          ])
          .where("asset_rtmd_id", "=", rtmd.id)
          .orderBy("updated_at", "desc")
          .limit(1)
          .executeTakeFirst()

        return {
          id: rtmd.id,
          serial_number: rtmd.serial_number,
          sensor_qty: rtmd.sensor_qty,
          description: rtmd.description,
          asset_model: {
            id: rtmd.asset_model_id,
            name: rtmd.asset_model_name,
          },
          asset_type: {
            id: rtmd.asset_type_id,
            name: rtmd.asset_type_name,
          },
          manufacture: {
            id: rtmd.manufacture_id,
            name: rtmd.manufacture_name,
          },
          latest_log: latestLog
            ? {
              temperature: latestLog.temperature,
              humidity: latestLog.humidity,
              battery: latestLog.battery,
              signal: latestLog.signal,
              device_status: latestLog.device_status,
              is_power_connected: latestLog.is_power_connected,
              actual_time: latestLog.actual_time,
              updated_at: latestLog.updated_at,
            }
            : null,
        }
      })
    )

    return results
  }

  async getAssetMonitoringTemperatureForExport(c: Context, params: any) {
    const {
      province_id,
      regency_id,
      health_center_id,
      working_status_id,
      is_device_related,
      is_warehouse,
      asset_type_ids,
      manufacture_ids,
      asset_model_ids,
      sort_by,
      sort_type,
    } = params

    let sort
    if (sort_by && sort_type) {
      if (sort_by === "name") {
        sort = [
          ["wam.name", sort_type],
          ["wm.name", sort_type],
          ["wai.serial_number", sort_type],
        ]
      } else {
        // Add table prefix to avoid ambiguous column names
        let sortField = sort_by
        if (sort_by === "serial_number") sortField = "wai.serial_number"
        if (sort_by === "asset_type_name") sortField = "wat.name"
        if (sort_by === "working_status_name") sortField = "waws.name"
        if (sort_by === "updated_at") sortField = "wai.updated_at"
        if (sort_by === "created_at") sortField = "wai.created_at"

        sort = [[sortField, sort_type]]
      }
    } else {
      sort = [["wai.updated_at", "desc"]]
    }

    let queries = c.var.trx
      .selectFrom("asset_inventories as wai")
      .innerJoin("entities as we", (join) =>
        join.onRef("wai.entity_id", "=", "we.id")
      )
      .innerJoin("entity_types as et", (join) =>
        join.onRef("we.type", "=", "et.id")
      )
      .leftJoin("users as wuc", (join) =>
        join.onRef("wai.created_by", "=", "wuc.id")
      )
      .leftJoin("users as wuu", (join) =>
        join.onRef("wai.updated_by", "=", "wuu.id")
      )
      .leftJoin("locations as lp", (join) =>
        join.onRef("we.province_id", "=", "lp.id")
      )
      .leftJoin("locations as lr", (join) =>
        join.onRef("we.regency_id", "=", "lr.id")
      )
      .leftJoin("locations as lsd", (join) =>
        join.onRef("we.sub_district_id", "=", "lsd.id")
      )
      .leftJoin("asset_models as wam", (join) =>
        join.onRef("wai.asset_model_id", "=", "wam.id")
      )
      .leftJoin("asset_types as wat", (join) =>
        join.onRef("wai.asset_type_id", "=", "wat.id")
      )
      .leftJoin("pqs_codes as pc", (join) =>
        join.onRef("wam.pqs_code_id", "=", "pc.id")
      )
      .leftJoin("pqs_types as pt", (join) =>
        join.onRef("pc.pqs_type_id", "=", "pt.id")
      )
      .leftJoin("cceigat_descriptions as cd", (join) =>
        join.onRef("pc.cceigat_description_id", "=", "cd.id")
      )
      .leftJoin("manufactures as wm", (join) =>
        join.onRef("wai.manufacture_id", "=", "wm.id")
      )
      .leftJoin("asset_working_statuses as waws", (join) =>
        join.onRef("wai.working_status_id", "=", "waws.id")
      )
      .leftJoin("asset_electricities as wac", (join) =>
        join.onRef("wai.electricity_id", "=", "wac.id")
      )
      .leftJoin("budget_sources as wbs", (join) =>
        join.onRef("wai.budget_source_id", "=", "wbs.id")
      )
      .leftJoin("asset_inventory_rtmds as air", (join) =>
        join.onRef("air.asset_inventory_id", "=", "wai.id")
      )
      .leftJoin("asset_rtmds as arr", (join) =>
        join.onRef("air.asset_rtmd_id", "=", "arr.id")
      )
      .leftJoin("asset_rtmd_histories as arh", (join) =>
        join
          .onRef("arh.asset_rtmd_id", "=", "arr.id")
          .on(
            "arh.id",
            "=",
            sql`(select max(id) from asset_rtmd_histories where asset_rtmd_id = arr.id and deleted_at is null)`
          )
      )
      .leftJoin("asset_models_temperatures_capacities as amtc", (join) =>
        join.onRef("wai.asset_model_id", "=", "amtc.asset_model_id")
      )
      .leftJoin("asset_types_temperatures as att", (join) =>
        join.onRef("amtc.asset_type_temperature_id", "=", "att.id")
      )
      .leftJoin("temperature_thresholds as tt", (join) =>
        join.onRef("att.temperature_threshold_id", "=", "tt.id")
      )
      .leftJoin("asset_calibration_schedules as wacs", (join) =>
        join.onRef("wai.calibration_schedule_id", "=", "wacs.id")
      )
      .leftJoin("asset_maintenance_schedules as wams", (join) =>
        join.onRef("wai.maintenance_schedule_id", "=", "wams.id")
      )
      .leftJoin("asset_inventory_other_capacities as aioc", (join) =>
        join.onRef("wai.id", "=", "aioc.asset_inventory_id")
      )
      .select([
        // Entity Information
        "wai.id",
        "wai.asset_model_id",
        "wam.name as asset_model_name",
        "wai.asset_type_id",
        "wat.name as asset_type_name",
        "wai.working_status_id",
        "waws.name as asset_working_status_name",
        "wac.name as electricity_name",
        "pc.code as pqs_code",
        "pt.name as pqs_type",
        "cd.name as cceigat_description",
        "wai.entity_id",
        "we.name as entity_name",
        "et.name as entity_type", // Added: Entity Type
        "we.is_puskesmas as entity_is_puskesmas",
        "we.province_id",
        "lp.name as province_name",
        "we.regency_id",
        "lr.name as regency_name",
        "we.sub_district_id",
        "lsd.name as sub_district_name", // Added: District (Sub District Name)
        "wai.ownership_qty",
        "wai.ownership_status",
        "wai.manufacture_id",
        "wm.name as manufacture_name",
        "wai.serial_number",
        "wai.status",
        "wbs.id as budget_source_id",
        "wbs.name as budget_source_name",
        "wai.budget_year",
        "wai.other_asset_model_name",
        "wai.other_asset_type_name",
        "wai.other_asset_manufacture_name",
        "wai.other_asset_budget_source_name",
        "wai.other_borrowed_from_entity_name",
        "wai.asset_model_temperature_capacity_id",
        "wai.created_at",
        "wai.updated_at",
        "wuc.id as user_created_id",
        "wuc.username as user_created_username",
        "wuc.firstname as user_created_firstname",
        "wuc.lastname as user_created_lastname",
        sql<string>`TRIM(CONCAT_WS(' ',COALESCE(CAST(${sql.ref("wuc.firstname")} AS CHAR), ''),COALESCE(CAST(${sql.ref("wuc.lastname")} AS CHAR), '')))`.as(
          "user_created_fullname"
        ),
        "wuu.id as user_updated_id",
        "wuu.username as user_updated_username",
        "wuu.firstname as user_updated_firstname",
        "wuu.lastname as user_updated_lastname",
        sql<string>`TRIM(CONCAT_WS(' ',COALESCE(CAST(${sql.ref("wuu.firstname")} AS CHAR), ''),COALESCE(CAST(${sql.ref("wuu.lastname")} AS CHAR), '')))`.as(
          "user_updated_fullname"
        ),
        // Temperature and Logger Information
        "arr.serial_number as logger_serial_number",
        "air.sensor_qty",
        "arh.temperature as last_temperature",
        "arh.created_at as last_temperature_update",
        // Temperature thresholds
        "tt.min_temperature as standard_min_temperature",
        "tt.max_temperature as standard_max_temperature",
        "amtc.gross_capacity as standard_gross_capacity",
        "amtc.net_capacity as standard_net_capacity",
        // Other capacities
        "aioc.gross as other_gross_capacity",
        "aioc.net as other_net_capacity",
        "aioc.max_temperature as other_max_temperature",
        "aioc.min_temperature as other_min_temperature",
        "wai.production_year",
        // Warranty and Maintenance fields
        "wai.warranty_start_date",
        "wai.warranty_end_date",
        "wai.calibration_last_date",
        "wacs.name as calibration_schedule_name",
        "wai.maintenance_last_date",
        "wams.name as maintenance_schedule_name",
      ])
      .where("wai.deleted_at", "is", null)
      .where("we.deleted_at", "is", null)

    // Apply filters
    if (province_id) {
      queries = queries.where("lp.id", "=", province_id)
    }
    if (regency_id) {
      queries = queries.where("lr.id", "=", regency_id)
    }
    if (health_center_id) {
      queries = queries.where("ls.id", "=", health_center_id)
    }
    if (working_status_id) {
      queries = queries.where("wai.working_status_id", "=", working_status_id)
    }
    if (is_device_related !== undefined) {
      queries = queries.where(
        "wai.id",
        is_device_related === 1 ? "in" : "not in",
        c.var.trx
          .selectFrom("asset_inventory_rtmds")
          .select("asset_inventory_id")
          .where("deleted_at", "is", null)
      )
    }
    if (is_warehouse !== undefined) {
      queries = queries.where(
        "wai.asset_type_id",
        is_warehouse === 1 ? "in" : "not in",
        c.var.trx
          .selectFrom("asset_types_classifications")
          .select("asset_type_id")
          .where(
            "asset_classifications_id",
            "=",
            ASSET_CLASSIFICATION.WAREHOUSE
          )
      )
    }
    if (asset_type_ids && asset_type_ids.length > 0) {
      queries = queries.where("wai.asset_type_id", "in", asset_type_ids)
    }
    if (manufacture_ids && manufacture_ids.length > 0) {
      queries = queries.where("wai.manufacture_id", "in", manufacture_ids)
    }
    if (asset_model_ids && asset_model_ids.length > 0) {
      queries = queries.where("wai.asset_model_id", "in", asset_model_ids)
    }

    // Apply sorting
    for (const [field, direction] of sort) {
      queries = queries.orderBy(field, direction as "asc" | "desc")
    }

    // Apply DISTINCT and GROUP BY to prevent duplicates when assets have multiple RTMD devices
    // This ensures consistency with the main list method and prevents duplicate records
    // when assets have multiple RTMD devices connected
    const results = await queries.distinct().groupBy(["wai.id"]).execute()
    return results
  }

  async findOperationalStatusId(c: Context, id: number) {
    return await c.var.trx
      .selectFrom("asset_working_statuses")
      .selectAll(0)
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }

  async updateInventoryOperationalStatusId(
    c: Context,
    id: number,
    data: UpdateOperationalStatusDTO
  ) {
    await c.var.trx
      .updateTable("asset_inventories")
      .set({
        ...data,
      })
      .where("id", "=", id)
      .executeTakeFirst()
  }

  async getTemperatureCapacitiesByAssetModelId(
    c: Context,
    assetModelId: number
  ) {
    const capacities = await c.var.trx
      .selectFrom("asset_models_temperatures_capacities as amtc")
      .innerJoin("asset_types_temperatures as att", (join) =>
        join.onRef("amtc.asset_type_temperature_id", "=", "att.id")
      )
      .innerJoin("temperature_thresholds as tt", (join) =>
        join.onRef("att.temperature_threshold_id", "=", "tt.id")
      )
      .innerJoin("asset_types as at", (join) =>
        join.onRef("att.asset_type_id", "=", "at.id")
      )
      .select([
        "amtc.id",
        "amtc.gross_capacity",
        "amtc.net_capacity",
        "tt.min_temperature",
        "tt.max_temperature",
        "at.name as asset_type_name",
      ])
      .where("amtc.asset_model_id", "=", assetModelId)
      .where("amtc.deleted_at", "is", null)
      .where("att.deleted_at", "is", null)
      .where("tt.deleted_at", "is", null)
      .where("at.deleted_at", "is", null)
      .orderBy("at.name", "asc")
      .execute()

    return capacities.map((tc) => ({
      id: tc.id,
      gross_capacity: tc.gross_capacity,
      net_capacity: tc.net_capacity,
      min_temperature: tc.min_temperature,
      max_temperature: tc.max_temperature,
      asset_type_name: tc.asset_type_name,
    }))
  }

  async getTemperatureThresholdsByAssetModelId(
    c: Context,
    otherInventoriesId: number,
    otherMinTemp: number | null | undefined,
    otherMaxTemp: number | null | undefined,
    assetModelId: number,
    assetTypeTemperatureId: number,
    activeCapacityId?: number,
    assetTypeClassification?: number,
    assetInventoryId?: number
  ) {
    if (otherMinTemp && otherMaxTemp) {
      return [
        {
          id: otherInventoriesId,
          min_temperature: otherMinTemp,
          max_temperature: otherMaxTemp,
          is_active: 1,
        },
      ]
    }

    const thresholds =
      assetTypeClassification !== ASSET_CLASSIFICATION.WAREHOUSE
        ? await c.var.trx
          .selectFrom("asset_models_temperatures_capacities as amtc")
          .innerJoin("asset_types_temperatures as att", (join) =>
            join.onRef("amtc.asset_type_temperature_id", "=", "att.id")
          )
          .innerJoin("temperature_thresholds as tt", (join) =>
            join.onRef("att.temperature_threshold_id", "=", "tt.id")
          )
          .select([
            "amtc.id",
            "amtc.gross_capacity",
            "amtc.net_capacity",
            "tt.min_temperature",
            "tt.max_temperature",
          ])
          .where("amtc.asset_model_id", "=", assetModelId)
          .where(
            "amtc.asset_type_temperature_id",
            "=",
            assetTypeTemperatureId
          )
          .where("amtc.deleted_at", "is", null)
          .where("att.deleted_at", "is", null)
          .where("tt.deleted_at", "is", null)
          .orderBy("tt.min_temperature", "desc")
          .execute()
        : await c.var.trx
          .selectFrom("asset_inventories as ai")
          .innerJoin("asset_types as at", (join) =>
            join
              .onRef("ai.asset_type_id", "=", "at.id")
              .on("at.deleted_at", "is", null)
          )
          .innerJoin("asset_types_classifications as atc", (join) =>
            join
              .onRef("at.id", "=", "atc.asset_type_id")
              .on("atc.deleted_at", "is", null)
              .on(
                "atc.asset_classifications_id",
                "=",
                sql.lit(ASSET_CLASSIFICATION.WAREHOUSE)
              )
          )
          .innerJoin("asset_types_temperatures as att", (join) =>
            join.onRef("at.id", "=", "att.asset_type_id")
          )
          .innerJoin("temperature_thresholds as tt", (join) =>
            join
              .onRef("att.temperature_threshold_id", "=", "tt.id")
              .on("tt.deleted_at", "is", null)
              .on("tt.is_predefined", "=", 2)
          )
          .select([
            "att.id",
            "tt.min_temperature",
            "tt.max_temperature",
            sql<number>`0`.as("gross_capacity"),
            sql<number>`0`.as("net_capacity"),
          ])
          .where("ai.id", "=", assetInventoryId!)
          .orderBy("tt.min_temperature", "desc")
          .execute()

    return thresholds.map((tc) => ({
      id: tc.id,
      min_temperature: tc.min_temperature,
      max_temperature: tc.max_temperature,
      is_active: tc.id === activeCapacityId || thresholds.length === 1 ? 1 : 0,
    }))
  }

  async getOnsetOfAbnormalTemperature(
    c: Context,
    rtmdId: number,
    minTemp: number,
    maxTemp: number
  ) {
    const { trx } = c.var

    // Subquery untuk waktu terakhir normal
    const subLastNormal = trx
      .selectFrom("asset_rtmd_histories as arh")
      .select(sql<Date>`MAX(actual_time)`.as("max_time"))
      .where("asset_rtmd_id", "=", rtmdId)
      .where((eb) => eb.between("temperature", minTemp, maxTemp))

    // Subquery untuk menghitung jumlah data normal
    const subCountNormal = trx
      .selectFrom("asset_rtmd_histories")
      .select(sql<number>`COUNT(*)`.as("count_normal"))
      .where("asset_rtmd_id", "=", rtmdId)
      .where((eb) => eb.between("temperature", minTemp, maxTemp))

    // Query utama
    const result = await trx
      .selectFrom("asset_rtmd_histories")
      .selectAll()
      .where("asset_rtmd_id", "=", rtmdId)
      .where((eb) =>
        eb.or([
          eb(
            "actual_time",
            ">",
            // gunakan subquery sebagai `ref` ke hasil SELECT
            subLastNormal
          ),
          // buat raw literal yang menghasilkan boolean
          sql<boolean>`(${subCountNormal}) = 0`,
        ])
      )
      .orderBy("actual_time", "asc")
      .limit(1)
      .executeTakeFirst()

    return result
  }

  async getAssetInfoByRtmdId(c: Context, rtmdId: number) {
    const assetInfo = await c.var.trx
      .selectFrom("asset_inventory_rtmds as air")
      .innerJoin("asset_inventories as ai", "air.asset_inventory_id", "ai.id")
      .innerJoin("entities as e", "ai.entity_id", "e.id")
      .innerJoin("asset_models as am", "ai.asset_model_id", "am.id")
      .leftJoin("manufactures as m", "ai.manufacture_id", "m.id")
      .leftJoin("asset_calibration_schedules as wacs", (join) =>
        join.onRef("ai.calibration_schedule_id", "=", "wacs.id")
      )
      .leftJoin("asset_maintenance_schedules as wams", (join) =>
        join.onRef("ai.maintenance_schedule_id", "=", "wams.id")
      )
      .leftJoin("asset_inventory_other_capacities as aioc", (join) =>
        join.onRef("ai.id", "=", "aioc.asset_inventory_id")
      )
      .select([
        "ai.id",
        "ai.asset_type_id",
        "ai.asset_model_id",
        "ai.asset_model_temperature_capacity_id",
        "ai.serial_number",
        "am.name as asset_model_name",
        "m.name as manufacture_name",
        "e.id as entity_id",
        "e.name as entity_name",
        "wacs.name as calibration_schedule_name",
        "wams.name as maintenance_schedule_name",
        "wacs.id as calibration_schedule_id",
        "wams.id as maintenance_schedule_id",
        "ai.warranty_start_date",
        "ai.warranty_end_date",
        "ai.calibration_last_date",
        "ai.maintenance_last_date",
        "aioc.id as other_capacity_id",
        "aioc.min_temperature as other_min_temperature",
        "aioc.max_temperature as other_max_temperature",
      ])
      .where("air.asset_rtmd_id", "=", rtmdId)
      .where("ai.deleted_at", "is", null)
      .executeTakeFirst()

    if (!assetInfo) return null

    return {
      asset_id: assetInfo.id,
      asset_name: assetInfo.asset_name,
      asset_type_id: assetInfo.asset_type_id,
      asset_model_id: assetInfo.asset_model_id,
      asset_model_temperature_capacity_id:
        assetInfo.asset_model_temperature_capacity_id,
      entity_id: assetInfo.entity_id,
      entity_name: assetInfo.entity_name,
      serial_number: assetInfo.serial_number,
      asset_model_name: assetInfo.asset_model_name,
      manufacture_name: assetInfo.manufacture_name,
      other_capacity_id: assetInfo.other_capacity_id,
      other_min_temperature: assetInfo.other_min_temperature,
      other_max_temperature: assetInfo.other_max_temperature,
    }
  }

  async getRtmdIdByDeviceId(c: Context, deviceId: string) {
    return await c.var.trx
      .selectFrom("asset_inventory_rtmds as air")
      .innerJoin("asset_rtmds as ar", "air.asset_rtmd_id", "ar.id")
      .innerJoin("asset_inventories as ai", "air.asset_inventory_id", "ai.id")
      .select([
        "ar.id as rtmd_id",
        "ai.id as asset_inventory_id",
        "ai.asset_model_temperature_capacity_id",
      ])
      .where("ar.serial_number", "=", deviceId)
      .where("ai.deleted_at", "is", null)
      .executeTakeFirst()
  }
}
