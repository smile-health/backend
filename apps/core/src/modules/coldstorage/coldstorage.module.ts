import { Context } from "hono"
import {
  AddColdStorageRequest,
  BulkAddColdStorageRequest,
  GetColdstorageListQuery,
  GetDetailColdstorageParam,
} from "./coldstorage.shcema"
import { ColdstorageRepository } from "./coldstorage.repository"
import { NotFoundError } from "@smile/lib/error"
import { EntityRepository } from "../entity/entity.repository"
import { ColdstorageExport } from "./coldstorage.excel"
import { PaginatedResponse } from "@smile/lib/types/paginate"
import moment from "moment"
import { ColdstorageNotification } from "./utils/coldstorage.notification"

interface TemperatureData {
  coldstorage_id: number
  entity_id: number
  temperature_threshold_id: number
  volume_asset: number
  total_volume: number
  percentage_capacity: number
  projection_volume_asset: number
  projection_total_volume: number
  projection_percentage_capacity: number
}

export class ColdstorageModule {
  constructor(
    private readonly repository: ColdstorageRepository,
    private readonly entityRepo: EntityRepository,
    private readonly coldstorageNotification: ColdstorageNotification
  ) {}

  async bulkCreate(c: Context, body: BulkAddColdStorageRequest) {
    if (body.material_ids && body.material_ids.length > 0) {
      body.material_ids.forEach(async (value) => {
        await this.create(c, {
          entity_id: body.entity_id,
          material_id: value,
          program_id: body.program_id,
          user_id: body.user_id,
          is_send_notification: false,
        })
      })
    }

    const coldstorage = await this.repository.findOne(c, {
      entity_id: body.entity_id,
    })

    if (
      coldstorage &&
      coldstorage.percentage_capacity &&
      coldstorage.percentage_capacity > 80
    ) {
      await this.coldstorageNotification.handleSendNotificationColdstoragePercentageCapacityMoreThan80(
        c,
        coldstorage.entity_id
      )
    }
  }

  async create(c: Context, body: AddColdStorageRequest) {
    const userId = body.user_id ? body.user_id : c.get("user")?.id

    try {
      // 1. Fetch initial data in parallel WITH LOCKS
      const [rangeMaterialData, assetInventoryIsCCE] = await Promise.all([
        this.repository.getRangeTemperature(c),
        this.repository.getAllAssets(c, body.entity_id), // 🔒 WITH LOCK
      ])

      // 2. Calculate asset volumes
      const volume_asset = assetInventoryIsCCE.reduce(
        (sum, asset) => sum + (asset.net_capacity ?? 0),
        0
      )

      // 3. Get or create coldstorage WITH ROW LOCK 🔒
      const existingColdstorage = await this.repository.findOneWithLock(c, {
        entity_id: body.entity_id,
      })

      const coldstorage = await this.getOrCreateColdstorage(
        c,
        existingColdstorage,
        body.entity_id,
        volume_asset,
        userId
      )

      // 4. Calculate coldstorage material WITH ROW LOCK 🔒
      const coldstorageMaterial =
        await this.repository.getColdstorageMaterialByMaterialIdAndColdstorageIdWithLock(
          c,
          body.material_id,
          coldstorage.id
        )

      // ✅ FIX: Calculate and update material dengan LOCKED source data
      await this.calculateColdstorageMaterial(
        c,
        body.entity_id,
        coldstorage.id,
        body.material_id,
        body.program_id,
        !!coldstorageMaterial,
        coldstorageMaterial?.id,
        userId
      )

      // 5. Process temperature data
      const temperatureDataMap = this.buildTemperatureDataMap(
        rangeMaterialData,
        body.entity_id,
        coldstorage.id
      )

      this.aggregateAssetsByTemperature(
        assetInventoryIsCCE,
        rangeMaterialData,
        temperatureDataMap
      )

      // ✅ FIX: RE-FETCH materials setelah calculateColdstorageMaterial
      // Ini memastikan kita dapat package_volume yang SUDAH di-update
      const allColdstorageMaterials =
        await this.repository.getColdstorageMaterialByEntityIdWithLock(
          c,
          body.entity_id
        )

      // 6. Calculate total volumes dengan data yang FRESH & UPDATED
      const { total_volume, projection_total_volume } =
        this.calculateTotalVolumes(allColdstorageMaterials, temperatureDataMap)

      // 7. Calculate percentages for temperature data
      const dataPerTemperatures =
        this.calculateTemperaturePercentages(temperatureDataMap)

      // 8. Update remain_package_fulfill for all materials (batch update)
      await this.updateRemainPackageFulfill(
        c,
        allColdstorageMaterials,
        coldstorage,
        userId
      )

      // 9. Upsert coldstorage per temperature (with locking)
      await this.upsertColdstoragePerTemperature(
        c,
        dataPerTemperatures,
        body.entity_id,
        coldstorage.id,
        userId
      )

      // 10. Update main coldstorage record
      await this.updateMainColdstorage(
        c,
        coldstorage.id,
        volume_asset,
        total_volume,
        projection_total_volume,
        userId
      )

      // 11. Send Notification if coldstorage percentage_capacity > 80%
      if (
        coldstorage.percentage_capacity &&
        coldstorage.percentage_capacity > 80 &&
        body.is_send_notification === true
      ) {
        console.log(
          "Send Notification: Coldstorage capacity exceeded 80%",
          coldstorage
        )
        await this.coldstorageNotification.handleSendNotificationColdstoragePercentageCapacityMoreThan80(
          c,
          coldstorage.entity_id
        )
      }

      return coldstorage.id
    } catch (error: any) {
      // Handle lock timeout errors
      if (error.code === "ER_LOCK_WAIT_TIMEOUT") {
        throw new Error(
          "Unable to process cold storage update due to concurrent operations. Please try again."
        )
      }

      // Handle deadlock errors
      if (error.code === "ER_LOCK_DEADLOCK") {
        throw new Error(
          "Database deadlock detected. Please retry your request."
        )
      }

      // Re-throw other errors
      throw error
    }
  }

  private async getOrCreateColdstorage(
    c: Context,
    existing: any,
    entityId: number,
    volumeAsset: number,
    userId: number
  ) {
    if (existing) return existing

    const coldstorageData = {
      entity_id: entityId,
      volume_asset: volumeAsset,
      total_volume: 0,
      percentage_capacity: 0,
      projection_volume_asset: volumeAsset,
      projection_total_volume: 0,
      projection_percentage_capacity: 0,
      created_by: userId,
      updated_by: userId,
      created_at: new Date(),
      updated_at: new Date(),
    }

    const result = await this.repository.create(c, coldstorageData)

    // Get with lock after creation to ensure consistency
    return this.repository.findOneWithLock(c, { id: Number(result.insertId) })
  }

  private buildTemperatureDataMap(
    rangeMaterialData: any[],
    entityId: number,
    coldstorageId: number
  ): Map<number, TemperatureData> {
    const map = new Map<number, TemperatureData>()

    for (const item of rangeMaterialData) {
      map.set(item.temperature_threshold_id, {
        coldstorage_id: coldstorageId,
        entity_id: entityId,
        temperature_threshold_id: item.temperature_threshold_id,
        volume_asset: 0,
        total_volume: 0,
        percentage_capacity: 0,
        projection_volume_asset: 0,
        projection_total_volume: 0,
        projection_percentage_capacity: 0,
      })
    }

    return map
  }

  private aggregateAssetsByTemperature(
    assets: any[],
    rangeMaterialData: any[],
    temperatureDataMap: Map<number, TemperatureData>
  ) {
    // Build range lookup map
    const rangeMap = new Map<string, number>()
    for (const item of rangeMaterialData) {
      const key = `${item.min_temperature}_${item.max_temperature}`
      rangeMap.set(key, item.temperature_threshold_id)
    }

    // Aggregate assets
    for (const asset of assets) {
      const key = `${asset.min_temperature}_${asset.max_temperature}`
      const thresholdId = rangeMap.get(key)

      if (thresholdId) {
        const data = temperatureDataMap.get(thresholdId)
        if (data) {
          const capacity = asset.net_capacity ?? 0
          data.volume_asset += capacity
          data.projection_volume_asset += capacity
        }
      }
    }
  }

  private calculateTotalVolumes(
    materials: any[],
    temperatureDataMap: Map<number, TemperatureData>
  ) {
    let total_volume = 0
    let projection_total_volume = 0

    for (const item of materials) {
      const packageVolume = item.package_volume ?? 0
      const projectionPackageVolume = item.projection_package_volume ?? 0

      if (item.temperature_threshold_id) {
        const tempData = temperatureDataMap.get(item.temperature_threshold_id)
        if (tempData) {
          total_volume += packageVolume
          projection_total_volume += projectionPackageVolume
          tempData.total_volume += packageVolume
          tempData.projection_total_volume += projectionPackageVolume
        }
      }
    }

    return {
      total_volume: Number(total_volume.toFixed(2)),
      projection_total_volume: Number(projection_total_volume.toFixed(2)),
    }
  }

  private calculateTemperaturePercentages(
    temperatureDataMap: Map<number, TemperatureData>
  ): TemperatureData[] {
    return Array.from(temperatureDataMap.values()).map((item) => ({
      ...item,
      percentage_capacity: item.volume_asset
        ? Number(((item.total_volume / item.volume_asset) * 100).toFixed(2))
        : 0,
      projection_percentage_capacity: item.projection_volume_asset
        ? Number(
            (
              (item.projection_total_volume / item.projection_volume_asset) *
              100
            ).toFixed(2)
          )
        : 0,
    }))
  }

  private async updateRemainPackageFulfill(
    c: Context,
    materials: any[],
    coldstorage: any,
    userId: number
  ) {
    const availableVolume =
      (coldstorage.volume_asset ?? 0) - (coldstorage.total_volume ?? 0)

    // Batch update untuk performa lebih baik
    // Batch update untuk performa lebih baik
    const updates = materials.map((item) => ({
      id: item.id,
      data: {
        remain_package_fulfill: this.calculateRemainPackage(
          item,
          availableVolume
        ),
        updated_at: new Date(),
        updated_by: userId,
      },
    }))

    await this.repository.batchUpdateColdstorageMaterials(c, updates)
  }

  private calculateRemainPackage(item: any, availableVolume: number): number {
    if (availableVolume <= 0) return 0

    let result = 0

    if (item.volume_per_liter && item.volume_per_liter > 0) {
      result = Math.floor(availableVolume / item.volume_per_liter)
    } else if (
      item.package_stock &&
      item.package_volume &&
      item.package_stock > 0
    ) {
      const volumePerPackage = item.package_volume / item.package_stock
      if (volumePerPackage > 0) {
        result = Math.floor(availableVolume / volumePerPackage)
      }
    }

    // Validate result
    if (!isFinite(result) || result > Number.MAX_SAFE_INTEGER) {
      return 0
    }

    return Math.max(0, result)
  }

  private async upsertColdstoragePerTemperature(
    c: Context,
    dataPerTemperatures: TemperatureData[],
    entityId: number,
    coldstorageId: number,
    userId: number
  ) {
    // Fetch all existing records WITH ROW LOCK 🔒
    const existingRecordsPromises = dataPerTemperatures.map((dataTemp) =>
      this.repository.getColdstoragePerTemperatureDataWithLock(
        c,
        entityId,
        coldstorageId,
        dataTemp.temperature_threshold_id
      )
    )

    const existingRecords = await Promise.all(existingRecordsPromises)

    // Prepare batch upsert
    const records = dataPerTemperatures.map((dataTemp, index) => {
      const existing = existingRecords[index]
      const payload = {
        ...dataTemp,
        updated_at: new Date(),
        updated_by: userId,
      }

      return {
        existing,
        data: existing
          ? payload
          : {
              ...payload,
              created_at: new Date(),
              created_by: userId,
            },
      }
    })

    await this.repository.batchUpsertColdstoragePerTemperature(c, records)
  }

  private async updateMainColdstorage(
    c: Context,
    coldstorageId: number,
    volumeAsset: number,
    totalVolume: number,
    projectionTotalVolume: number,
    userId: number
  ) {
    const percentageCapacity = volumeAsset
      ? Number(((totalVolume / volumeAsset) * 100).toFixed(2))
      : 0
    const projectionPercentageCapacity = volumeAsset
      ? Number(((projectionTotalVolume / volumeAsset) * 100).toFixed(2))
      : 0

    await this.repository.update(
      c,
      {
        volume_asset: volumeAsset,
        total_volume: totalVolume,
        percentage_capacity: percentageCapacity,
        projection_volume_asset: volumeAsset,
        projection_total_volume: projectionTotalVolume,
        projection_percentage_capacity: projectionPercentageCapacity,
        updated_at: new Date(),
        updated_by: userId,
      },
      { id: coldstorageId }
    )
  }

  async calculateColdstorageMaterial(
    c: Context,
    entityId: number,
    coldstorageId: number,
    materialId: number,
    programId: number,
    isUpdate: boolean = false,
    idColdstorageMaterial?: number,
    userId?: number
  ) {
    // ✅ FIX: Fetch data in parallel WITH LOCKS
    const [entityMaterialStock, entityMaterialActivity] = await Promise.all([
      this.repository.entityMaterialStockWithLock(
        c,
        entityId,
        materialId,
        programId
      ), // 🔒
      this.repository.getEntityMaterialActivityWithLock(
        c,
        materialId,
        entityId,
        programId
      ), // 🔒
    ])
    // Calculate stock metrics
    const stockMetrics = await this.calculateStockMetrics(
      c,
      entityMaterialStock,
      materialId
    )

    // Calculate projections
    const projectionMetrics = await this.calculateProjectionMetrics(
      c,
      materialId,
      programId,
      entityMaterialActivity,
      entityMaterialStock,
      stockMetrics.dosage_stock
    )

    const result = {
      coldstorage_id: coldstorageId,
      entity_id: entityId,
      material_id: materialId,
      ...stockMetrics,
      ...projectionMetrics,
      remain_package_fulfill: 0,
    }

    const timestamp = new Date()
    const commonFields = { updated_at: timestamp, updated_by: userId }

    if (isUpdate && idColdstorageMaterial) {
      await this.repository.updateColdstorageMaterial(
        c,
        idColdstorageMaterial,
        { ...result, ...commonFields }
      )
    } else {
      await this.repository.createColdstorageMaterial(c, {
        ...result,
        ...commonFields,
        created_at: timestamp,
        created_by: userId,
      })
    }

    return result
  }

  private async calculateStockMetrics(
    c: Context,
    entityMaterialStock: any[],
    materialId: number
  ) {
    let dosage_stock = 0
    let vial_stock = 0
    let package_stock = 0
    let package_volume = 0
    let volume_box = 0

    for (const stock of entityMaterialStock) {
      dosage_stock += stock.qty

      const masterMaterialVolume =
        await this.repository.getMasterMaterialVolume(
          c,
          stock.global_material_id ?? 0,
          stock.manufacture_id ?? 0
        )

      if (!masterMaterialVolume) continue

      const {
        consumption_unit_per_distribution_unit: box_vial,
        unit_per_box: box_volume,
        box_height,
        box_length,
        box_width,
      } = masterMaterialVolume

      if (box_vial && box_vial > 0) {
        vial_stock += Number((stock.qty / box_vial).toFixed(2))
      }

      if (box_volume && box_volume > 0) {
        package_stock = vial_stock / box_volume
      }

      if (box_vial && box_volume && box_vial > 0 && box_volume > 0) {
        const calculateVialStock = stock.qty / box_vial
        const volumeCalc =
          ((box_length * box_width * box_height) / 1000) *
          (calculateVialStock / box_volume)
        package_volume += Number(volumeCalc.toFixed(2))
      }

      volume_box += (box_length * box_width * box_height) / 1000
    }

    return {
      dosage_stock: Number(dosage_stock.toFixed(2)),
      vial_stock: Number(vial_stock.toFixed(2)),
      package_stock: Math.ceil(package_stock),
      package_volume: Number(package_volume.toFixed(2)),
      volume_per_liter: Number(volume_box.toFixed(2)),
    }
  }

  private async calculateProjectionMetrics(
    c: Context,
    materialId: number,
    programId: number,
    entityMaterialActivity: any[] | null,
    entityMaterialStock: any[],
    dosageStock: number
  ) {
    let max_dosage = 0
    if (entityMaterialActivity && entityMaterialActivity.length > 0) {
      max_dosage = entityMaterialActivity.reduce(
        (sum, activity) => sum + (activity.max ?? 0),
        0
      )
    }

    const stockOnHand = entityMaterialStock[0]?.stock_on_hand ?? 0
    const recommend_order_base_on_max = Math.max(0, max_dosage - stockOnHand)
    const projection_stock = recommend_order_base_on_max + dosageStock

    const volumeMaterialProjection =
      await this.repository.getMateriaVolumeLatest(c, materialId, programId)

    let projection_vial_stock = 0
    let projection_package_stock = 0
    let projection_package_volume = 0

    if (volumeMaterialProjection) {
      const {
        consumption_unit_per_distribution_unit,
        unit_per_box,
        box_length,
        box_width,
        box_height,
      } = volumeMaterialProjection

      if (
        consumption_unit_per_distribution_unit &&
        consumption_unit_per_distribution_unit > 0
      ) {
        projection_vial_stock =
          projection_stock / consumption_unit_per_distribution_unit
      }

      if (unit_per_box && unit_per_box > 0) {
        projection_package_stock = projection_vial_stock / unit_per_box
      }

      if (box_length && box_width && box_height) {
        projection_package_volume =
          (projection_package_stock * box_length * box_width * box_height) /
          1000
      }
    }

    return {
      max_dosage: Number(max_dosage.toFixed(2)),
      recommend_order_base_on_max: Number(
        recommend_order_base_on_max.toFixed(2)
      ),
      projection_stock: Number(projection_stock.toFixed(2)),
      projection_vial_stock: Number(projection_vial_stock.toFixed(2)),
      projection_package_stock: Number(projection_package_stock.toFixed(2)),
      projection_package_volume: Number(projection_package_volume.toFixed(2)),
    }
  }

  async detail(c: Context, id: number, filter: GetDetailColdstorageParam) {
    const { program_id } = filter

    // 1. Fetch main coldstorage
    const coldstorage = await this.repository.findOne(c, {
      id,
    })
    if (!coldstorage) throw new NotFoundError("Coldstorage not found.")

    const entityId = coldstorage.entity_id

    // 2. Fetch all data in parallel
    const [
      entity,
      materialsRaw,
      coldstoragePerTempRaw,
      allAssetsRaw,
      programs,
    ] = await Promise.all([
      this.entityRepo.findOne(c, { id: entityId }),
      this.repository.getColdstorageMaterials(
        c,
        coldstorage.id,
        program_id ? Number(program_id) : undefined
      ),
      this.repository.getColdstoragePerTemperature(c, coldstorage.id),
      this.repository.getAllAssets(c, entityId),
      this.repository.getProgramMaterialByColdstorageId(c, coldstorage.id),
    ])

    // 3. Format coldstorage_materials with nested master_material
    const coldstorage_materials = await this.formatColdstorageMaterials(
      c,
      materialsRaw
    )

    // 4. Calculate totals BEFORE formatting per temperature
    // This is CRITICAL: totals must be based on filtered materials
    const materialTotals = this.calculateMaterialTotals(coldstorage_materials)

    // 5. Format coldstorage_per_temperature with recalculated values
    const coldstorage_per_temperature = this.formatColdstoragePerTemperature(
      coldstoragePerTempRaw,
      coldstorage_materials,
      allAssetsRaw
    )

    // 6. Calculate main coldstorage totals
    // If program filter: use material totals
    // If no filter: use database values (already aggregated)
    const mainTotals = program_id
      ? this.calculateMainTotalsFromMaterials(
          materialTotals,
          coldstorage_per_temperature
        )
      : this.getMainTotalsFromDatabase(coldstorage)

    // 7. Return complete structure
    return {
      id: coldstorage.id,
      entity_id: coldstorage.entity_id,
      volume_asset: coldstorage.volume_asset,
      total_volume: mainTotals.total_volume,
      percentage_capacity: mainTotals.percentage_capacity,
      projection_total_volume: mainTotals.projection_total_volume,
      projection_percentage_capacity: mainTotals.projection_percentage_capacity,
      projection_volume_asset: coldstorage.projection_volume_asset,
      created_at: coldstorage.created_at,
      updated_at: coldstorage.updated_at,
      deleted_at: coldstorage.deleted_at,
      entity: entity,
      coldstorage_per_temperature,
      related_programs: programs,
    }
  }

  /**
   * Calculate material-level totals (package_volume sums)
   */
  private calculateMaterialTotals(materials: any[]) {
    return {
      total_volume: materials.reduce(
        (sum, m) => sum + (m.package_volume || 0),
        0
      ),
      projection_package_volume: materials.reduce(
        (sum, m) => sum + (m.projection_package_volume || 0),
        0
      ),
    }
  }

  /**
   * Calculate main totals when program filter is applied
   * Use material totals + capacity from per_temperature sections
   */
  private calculateMainTotalsFromMaterials(
    materialTotals: any,
    perTemperature: any[]
  ) {
    const total_capacity = perTemperature.reduce(
      (sum, t) => sum + (t.volume_asset || 0),
      0
    )

    const projection_capacity = perTemperature.reduce(
      (sum, t) => sum + (t.projection_volume_asset || 0),
      0
    )

    const percentage_capacity =
      total_capacity > 0
        ? (materialTotals.total_volume / total_capacity) * 100
        : 0

    const projection_percentage_capacity =
      projection_capacity > 0
        ? (materialTotals.projection_package_volume / projection_capacity) * 100
        : 0

    return {
      total_volume: Number(materialTotals.total_volume.toFixed(2)),
      projection_total_volume: Number(
        materialTotals.projection_package_volume.toFixed(2)
      ),
      percentage_capacity: Number(percentage_capacity.toFixed(2)),
      projection_percentage_capacity: Number(
        projection_percentage_capacity.toFixed(2)
      ),
    }
  }

  /**
   * Get main totals from database when no program filter
   * These values are already correctly calculated and stored
   */
  private getMainTotalsFromDatabase(coldstorage: any) {
    return {
      total_volume: coldstorage.total_volume || 0,
      projection_total_volume: coldstorage.projection_total_volume || 0,
      percentage_capacity: coldstorage.percentage_capacity || 0,
      projection_percentage_capacity:
        coldstorage.projection_percentage_capacity || 0,
    }
  }

  private async formatColdstorageMaterials(c: Context, materialsRaw: any[]) {
    // Guard clause: return empty array if no materials
    if (!materialsRaw || materialsRaw.length === 0) {
      return []
    }

    const materialIds = materialsRaw.map((material) => material.material_id)

    // Only fetch manufacture volumes if we have material IDs
    const manufactureMasterVolume =
      materialIds.length > 0
        ? await this.repository.getAllMasterMaterialVolume(c, materialIds)
        : []

    return materialsRaw.map((raw) => ({
      id: raw.cm_id,
      coldstorage_id: raw.coldstorage_id,
      entity_id: raw.entity_id,
      material_id: raw.material_id,
      dosage_stock: raw.dosage_stock,
      vial_stock: raw.vial_stock,
      package_stock: raw.package_stock,
      package_volume: raw.package_volume,
      projection_package_volume: raw.projection_package_volume || 0,
      remain_package_fulfill: raw.remain_package_fulfill,
      volume_per_liter: raw.volume_per_liter,
      created_at: raw.cm_created_at,
      updated_at: raw.cm_updated_at,
      max_dosage: raw.max_dosage,
      recommend_order_base_on_max: raw.recommend_order_base_on_max,
      projection_stock: raw.projection_stock,
      material: {
        id: raw.material_id,
        name: raw.material_name,
        code: raw.material_code,
        pieces_per_unit: raw.consumption_unit_per_distribution_unit,
        is_temperature_sensitive: raw.is_temperature_sensitive,
        is_vaccine: raw.material_type_id === 2 ? 1 : 0,
        temperature_threshold_id: raw.temperature_threshold_id,
        material_global_id: raw.material_global_id,
        range_temperature: raw.temperature_threshold_id
          ? {
              min_temp: raw.min_temperature,
              max_temp: raw.max_temperature,
            }
          : null,
        manufacture_material_volumes: manufactureMasterVolume.filter(
          (mv) => mv.material_id === raw.material_global_id
        ),
      },
    }))
  }

  /**
   * Format coldstorage per temperature with RECALCULATED totals
   *
   * CRITICAL: Recalculate total_volume and projection_total_volume
   * based on FILTERED materials (respects program filter)
   */
  private formatColdstoragePerTemperature(
    coldstoragePerTempRaw: any[],
    formattedMaterials: any[],
    allAssetsRaw: any[]
  ) {
    return coldstoragePerTempRaw.map((tempRaw) => {
      // Filter assets by temperature_threshold_id
      const assetsForTemp = allAssetsRaw.filter(
        (asset) =>
          asset.temperature_threshold_id === tempRaw.temperature_threshold_id
      )

      // Filter materials by temperature
      const materialsForTemp = formattedMaterials.filter(
        (m) =>
          m.material.temperature_threshold_id ===
          tempRaw.temperature_threshold_id
      )

      // RECALCULATE totals based on FILTERED materials
      const recalculatedTotals = this.recalculateTemperatureTotals(
        materialsForTemp,
        tempRaw.volume_asset,
        tempRaw.projection_volume_asset
      )

      return {
        id: tempRaw.id,
        coldstorage_id: tempRaw.coldstorage_id,
        entity_id: tempRaw.entity_id,
        temperature_threshold_id: tempRaw.temperature_threshold_id,
        volume_asset: tempRaw.volume_asset,

        // Use recalculated values instead of database values
        total_volume: recalculatedTotals.total_volume,
        percentage_capacity: recalculatedTotals.percentage_capacity,
        projection_volume_asset: tempRaw.projection_volume_asset,
        projection_total_volume: recalculatedTotals.projection_total_volume,
        projection_percentage_capacity:
          recalculatedTotals.projection_percentage_capacity,

        created_at: tempRaw.created_at,
        updated_at: tempRaw.updated_at,
        range_temperature: {
          min_temp: tempRaw.min_temperature,
          max_temp: tempRaw.max_temperature,
        },
        assets: this.formatAssetsForTemperature(assetsForTemp),
        coldstorage_materials: materialsForTemp,
      }
    })
  }

  /**
   * Recalculate temperature-specific totals from filtered materials
   *
   * This ensures that when program filter is applied:
   * - total_volume reflects only that program's materials
   * - percentage_capacity is accurate for the filtered view
   */
  private recalculateTemperatureTotals(
    materials: any[],
    volume_asset: number,
    projection_volume_asset: number
  ) {
    // Sum package volumes from materials
    const total_volume = materials.reduce(
      (sum, m) => sum + (m.package_volume || 0),
      0
    )

    const projection_total_volume = materials.reduce(
      (sum, m) => sum + (m.projection_package_volume || 0),
      0
    )

    // Calculate percentages
    const percentage_capacity =
      volume_asset > 0 ? (total_volume / volume_asset) * 100 : 0

    const projection_percentage_capacity =
      projection_volume_asset > 0
        ? (projection_total_volume / projection_volume_asset) * 100
        : 0

    return {
      total_volume: Number(total_volume.toFixed(2)),
      projection_total_volume: Number(projection_total_volume.toFixed(2)),
      percentage_capacity: Number(percentage_capacity.toFixed(2)),
      projection_percentage_capacity: Number(
        projection_percentage_capacity.toFixed(2)
      ),
    }
  }

  private formatAssetsForTemperature(assetsRaw: any[]) {
    return assetsRaw.map((raw) => ({
      id: raw.id,
      name_model_asset: raw.name,
      serial_number: raw.serial_number,
      status: raw.status,
      other_capacity_nett: raw.other_capacity_nett,
      other_capacity_gross: raw.other_capacity_gross,
      asset_type: {
        id: raw.asset_type_id,
        name: raw.asset_type_name,
        min_temp: raw.asset_min_temp,
        max_temp: raw.asset_max_temp,
        is_coldstorage: 1,
      },
      manufacture: {
        id: raw.manufacture_id,
        name: raw.manufacture_name,
      },
      asset_model: {
        id: raw.asset_model_id,
        name: raw.asset_model_name,
      },
      capacity_gross: raw.gross_capacity,
      capacity_nett: raw.net_capacity,
    }))
  }

  async export(c: Context, id: number, filter: GetDetailColdstorageParam) {
    try {
      // 1. Get detail data
      const detailData = await this.detail(c, id, filter)
      console.log("2. Detail data fetched")

      // 2. Prepare export data
      const { entityRows, assetRows, summaryData, materialData } =
        this.prepareExportData(c, detailData)

      // 3. Initialize Excel from TEMPLATE
      const sheetName = "Coldstorage Detail"
      const excelTemplate = new ColdstorageExport()

      excelTemplate.setLanguage(c.var.language || "en")
      excelTemplate.setTimezone(c.req.header("Timezone") || "UTC")
      excelTemplate.setTitle(c.var.t("coldstorage.coldstorage_detail.label"))

      // Load template file
      await excelTemplate.loadFile("Coldstorage.xlsx")

      // 4. Fill data into template

      // ✅ SECTION 0: Header (A1:K1 merged cell)
      await excelTemplate.updateMergedCellValue(
        sheetName,
        "A1",
        "K1",
        c.var.t("coldstorage.coldstorage_detail.label")
      )

      // SECTION 1: Entity Name (B3)
      await excelTemplate.updateCellValue(sheetName, "A3", "Nama Entitas")
      await excelTemplate.updateCellValue(
        sheetName,
        "B3",
        entityRows && entityRows.length > 0 && entityRows[0]
          ? entityRows[0][0]
          : "-"
      )

      // SECTION 2: Asset List (B4)
      await excelTemplate.updateCellValue(
        sheetName,
        "A4",
        c.var.t(
          "coldstorage.list_asset_coldchain_by_serial_number_and_total_litre.label"
        )
      )
      await excelTemplate.updateCellValue(
        sheetName,
        "B4",
        assetRows && assetRows.length > 0 && assetRows[0]
          ? assetRows[0][0]
          : "-"
      )
      await excelTemplate.setCellWrapText(sheetName, "B4")

      // SECTION 3: Temperature Summary Table
      const summaryStartRow = 6

      // Add headers (Row 6)
      await excelTemplate.addRows(
        sheetName,
        summaryData.headers,
        summaryStartRow,
        "A"
      )

      // Add data rows (Row 7-11)
      await excelTemplate.addRows(
        sheetName,
        summaryData.rows,
        summaryStartRow + 1,
        "A"
      )

      // SECTION 4: Material Details Table
      const materialStartRow = 13

      // Add headers (Row 13)
      await excelTemplate.addRows(
        sheetName,
        materialData.headers,
        materialStartRow,
        "A"
      )

      // Add data rows (Row 14+)
      if (materialData.rows.length > 0) {
        await excelTemplate.addRows(
          sheetName,
          materialData.rows,
          materialStartRow + 1,
          "A"
        )
      }

      // 5. Set column widths
      const columns = [
        { key: "a", header: "", width: 30 },
        { key: "b", header: "", width: 40 },
        { key: "c", header: "", width: 35 },
        { key: "d", header: "", width: 18 },
        { key: "e", header: "", width: 18 },
        { key: "f", header: "", width: 18 },
        { key: "g", header: "", width: 20 },
        { key: "h", header: "", width: 30 },
        { key: "i", header: "", width: 25 },
        { key: "j", header: "", width: 35 },
        { key: "k", header: "", width: 25 },
        { key: "l", header: "", width: 25 },
        { key: "m", header: "", width: 25 },
        { key: "n", header: "", width: 30 },
      ]
      // excelTemplate.setColumns(columns, "A1", sheetName)
      console.log("10. Column widths set")

      // 6. Generate and return file
      console.log("11. Generating file...")
      const result = await excelTemplate.generate()
      console.log("12. File generated successfully")

      return result
    } catch (error) {
      console.error("ERROR in export method:", error)
      console.error("Error stack:", error)
      throw error
    }
  }

  /**
   * Prepare all export data in array format
   */
  private prepareExportData(c: Context, data: any) {
    const entityRows = [[data.entity?.name || "-"]]

    const assetCapacityMap = new Map<string, number>()

    data.coldstorage_per_temperature.forEach((temp: any) => {
      temp.assets?.forEach((asset: any) => {
        const serialNumber = asset.serial_number
        const currentCapacity = assetCapacityMap.get(serialNumber) || 0

        assetCapacityMap.set(
          serialNumber,
          currentCapacity + (asset.capacity_nett || 0)
        )
      })
    })

    // Convert map to formatted string array, satu line per asset
    const assetLines: string[] = []
    assetCapacityMap.forEach((totalCapacity, serialNumber) => {
      assetLines.push(`${serialNumber} - ${totalCapacity} Liter`)
    })

    // Join all assets dengan newline untuk ditampilkan dalam 1 cell
    const assetRows = [[assetLines.join("\n")]]

    // 3. TEMPERATURE SUMMARY TABLE
    const summaryHeaders = [
      [c.var.t("coldstorage.range_temperature.label")], // A6
    ]

    const summaryRows: any[][] = [
      [c.var.t("coldstorage.total_real_volume.label")], // A7
      [c.var.t("coldstorage.net_total_real_assets.label")], // A8
      [c.var.t("coldstorage.real_used_capacity.label")], // A9
      [
        c.var.t(
          "coldstorage.total_volume_projection_according_to_buffer_stock.label"
        ),
      ], // A10
      [c.var.t("coldstorage.used_capacity_projections.label")], // A11
    ]

    // Add temperature columns (B6, C6, D6, ...)
    data.coldstorage_per_temperature.forEach((temp: any) => {
      const tempLabel = `(${temp.range_temperature.min_temp}°C) - (${temp.range_temperature.max_temp}°C)`
      summaryHeaders[0]!.push(tempLabel)

      summaryRows[0]!.push(`${temp?.total_volume ?? 0} L`)
      summaryRows[1]!.push(`${temp?.volume_asset ?? 0} L`)
      summaryRows[2]!.push(`${(temp.percentage_capacity || 0).toFixed(2)} %`)
      summaryRows[3]!.push(`${temp.projection_total_volume || 0} L`)
      summaryRows[4]!.push(
        `${(temp.projection_percentage_capacity || 0).toFixed(2)} %`
      )
    })

    // 4. MATERIAL DETAILS TABLE
    const materialHeaders = [
      [
        c.var.t("coldstorage.range_temperature.label"),
        "No",
        c.var.t("coldstorage.material_name.label"),
        c.var.t("coldstorage.stock_dose.label"),
        c.var.t("coldstorage.stock_vial.label"),
        c.var.t("coldstorage.stock_box.label"),
        c.var.t("coldstorage.stock_volume.label"),
        c.var.t("coldstorage.can_be_filled_in_either.label"),
        c.var.t("coldstorage.stock_maximum_dose.label"),
        c.var.t("coldstorage.recommendations_on_order_dose.label"),
        c.var.t("coldstorage.stock_projection_dose.label"),
        c.var.t("coldstorage.stock_projection_vial.label"),
        c.var.t("coldstorage.stock_projection_box.label"),
        c.var.t("coldstorage.stock_projection_volume.label"),
      ],
    ]

    const materialRows: any[][] = []

    data.coldstorage_per_temperature.forEach((temp: any) => {
      const tempLabel = `(${temp.range_temperature.min_temp}°C) - (${temp.range_temperature.max_temp}°C)`

      temp.coldstorage_materials.forEach((material: any, index: number) => {
        materialRows.push([
          index === 0 ? tempLabel : "",
          index + 1,
          material.material?.name || "-",
          material.dosage_stock || 0,
          Math.round(material.vial_stock || 0),
          Math.round(material.package_stock || 0),
          (material.package_volume || 0).toFixed(2),
          Math.round(material.remain_package_fulfill || 0),
          material.max_dosage || 0,
          material.recommend_order_base_on_max || 0,
          material.projection_stock || 0,
          Math.round(material.projection_vial_stock || 0),
          Math.round(material.projection_package_stock || 0),
          (material.projection_package_volume || 0).toFixed(2),
        ])
      })
    })

    return {
      entityRows,
      assetRows,
      summaryData: {
        headers: summaryHeaders,
        rows: summaryRows,
      },
      materialData: {
        headers: materialHeaders,
        rows: materialRows,
      },
    }
  }

  async list(c: Context, params: GetColdstorageListQuery) {
    const { parentList, total } = await this.repository.getListColdstorage(
      c,
      params
    )

    if (parentList.length === 0) {
      return new PaginatedResponse(params)
    }

    return new PaginatedResponse(params, parentList, Number(total))
  }

  async exportList(c: Context, params: GetColdstorageListQuery) {
    const stream = await this.repository.getListColdstorageWithoutPagination(
      c,
      params
    )

    const rows: (string | number | Date | null | undefined)[][] = []
    const timezone = c.req.header("Timezone") || "UTC"

    for await (const record of stream) {
      const row = [
        record.name,
        record.entity_id,
        record.province_name,
        record.regency_name ?? "-",
        record.serial_numbers,
        record.volume_asset,
        record.total_volume,
        record.percentage_capacity,
        record.updated_at
          ? moment(record.updated_at).tz(timezone).format("YYYY-MM-DD HH:mm:ss")
          : "-",
      ]

      rows.push(row)
    }

    const columns = [
      {
        key: "entity_name",
        header: c.var.t("coldstorage.entity_name.label"),
        width: 40,
      },
      {
        key: "entity_id",
        header: c.var.t("coldstorage.entity_id.label"),
        width: 15,
      },
      {
        key: "province_name",
        header: c.var.t("coldstorage.province_name.label"),
        width: 30,
      },
      {
        key: "regency_name",
        header: c.var.t("coldstorage.regency_name.label"),
        width: 30,
      },
      {
        key: "serial_numbers",
        header: c.var.t("coldstorage.serial_numbers.label"),
        width: 50,
      },
      {
        key: "volume_asset",
        header: c.var.t("coldstorage.volume_asset.label"),
        width: 25,
      },
      {
        key: "total_volume",
        header: c.var.t("coldstorage.total_volume.label"),
        width: 25,
      },
      {
        key: "percentage_capacity",
        header: c.var.t("coldstorage.percentage_capacity.label"),
        width: 25,
      },
      {
        key: "updated_at",
        header: c.var.t("coldstorage.updated_at.label"),
        width: 30,
      },
    ]

    const sheet = c.var.t("coldstorage.coldstorage_list.name")
    const excelTemplate = new ColdstorageExport()
    const language = c.var.language || "en"
    await excelTemplate.initSheet(sheet)

    excelTemplate.setLanguage(language)
    excelTemplate.setTitle(c.var.t("coldstorage.coldstorage_list.name"))
    excelTemplate.setTimezone(c.req.header("Timezone"))
    excelTemplate.setColumns(columns)
    await excelTemplate.addRows(sheet, rows)

    return excelTemplate.generate()
  }
}
