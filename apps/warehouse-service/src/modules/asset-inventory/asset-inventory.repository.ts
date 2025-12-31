/* eslint-disable @typescript-eslint/no-unused-vars */
import { execQuery } from "@/common/infrastructure/database/clickhouse/index.js"
import { db } from "@/common/infrastructure/database/index.js"
import { Context } from "hono"
import { AssetInventoryQuery } from "./asset-inventory.query.js"
import {
  AssetInventoryQueryParams,
  AssetInventoryTableDTO,
  AssetOwnershipOverviewDTO,
  DashboardConfig,
} from "./asset-inventory.schema.js"

export class AssetInventoryRepository {
  constructor(private readonly assetInventoryQuery: AssetInventoryQuery) {}

  /**
   * Get asset ownership overview data
   */
  async fetchAssetOwnershipOverview(
    c: Context,
    queryParams: AssetInventoryQueryParams
  ): Promise<AssetOwnershipOverviewDTO[]> {
    const query = this.assetInventoryQuery.buildAssetOwnershipOverviewQuery(
      queryParams,
      "entity_tag_id"
    )

    const result = await execQuery<AssetOwnershipOverviewDTO[]>(
      query,
      queryParams
    )
    return result
  }

  async fetchAssetOwnershipTable(
    c: Context,
    queryParams: AssetInventoryQueryParams
  ): Promise<AssetOwnershipOverviewDTO[]> {
    const query = this.assetInventoryQuery.buildAssetOwnershipOverviewQuery(
      queryParams,
      this.#determineGroupBy(queryParams)
    )

    const result = await execQuery<AssetOwnershipOverviewDTO[]>(
      query,
      queryParams
    )
    return result
  }

  async fetchParentEntities(queryParams: AssetInventoryQueryParams) {
    if (
      queryParams.entity_ids ||
      !queryParams.province_ids ||
      (queryParams.province_ids &&
        !queryParams.regency_ids &&
        queryParams.entity_tag_ids)
    ) {
      return {
        data: [],
        total: 0,
      }
    }

    const parentQuery =
      this.assetInventoryQuery.buildParentEntitiesQuery(queryParams)
    const countParentQuery =
      this.assetInventoryQuery.buildCountParentEntitiesQuery(queryParams)

    const [parents, parentCount] = await Promise.all([
      execQuery<AssetInventoryTableDTO[]>(parentQuery, queryParams),
      execQuery<{ total: number }[]>(countParentQuery, queryParams),
    ])

    const totalParent = parentCount[0]?.total ?? 0

    return {
      data: parents,
      total: totalParent,
    }
  }

  async fetchChildEntities(queryParams: AssetInventoryQueryParams) {
    const childQuery = this.assetInventoryQuery.buildChildEntitiesQuery(
      queryParams,
      this.#determineGroupBy(queryParams)
    )
    const countChildQuery =
      this.assetInventoryQuery.buildCountChildEntitiesQuery(queryParams)

    const [children, childrenCount] = await Promise.all([
      execQuery<AssetInventoryTableDTO[]>(childQuery, queryParams),
      execQuery<{ total: number }[]>(countChildQuery, queryParams),
    ])
    const totalChild = childrenCount[0]?.total ?? 0

    return {
      data: children,
      total: totalChild,
    }
  }

  async fetchAssetOwnershipEntities(
    c: Context,
    queryParams: AssetInventoryQueryParams
  ) {
    // For download excel
    if (queryParams.paginate < 0) {
      const [parents, children] = await Promise.all([
        this.fetchParentEntities(queryParams),
        this.fetchChildEntities(queryParams),
      ])

      return {
        parents: parents.data,
        children: children.data,
        total: parents.total + children.total,
      }
    }

    const { data: parents, total: totalParent } =
      await this.fetchParentEntities(queryParams)

    const childPage = Math.max(
      queryParams.page - Math.floor(totalParent / queryParams.paginate),
      1
    )

    const children = await this.fetchChildEntities({
      ...queryParams,
      paginate:
        childPage === 1
          ? queryParams.paginate - parents.length
          : queryParams.paginate,
      offset:
        childPage === 1
          ? 0
          : (childPage - 1) * queryParams.paginate -
            (totalParent % queryParams.paginate),
    })

    return {
      parents,
      children: children.data,
      total: children.total + totalParent,
    }
  }

  async getAssetInventoryDashboardConfig(): Promise<DashboardConfig> {
    const configRecord = await db
      .selectFrom("dashboard_configs")
      .select(["config"])
      .where("key", "=", "asset_inventory")
      .executeTakeFirst()

    if (!configRecord) {
      throw new Error("Asset inventory dashboard config not found in database")
    }
    return configRecord.config as unknown as DashboardConfig
  }

  #determineGroupBy(queryParams: AssetInventoryQueryParams): string {
    // for filter using entity tag, puskesmas or region
    if (
      queryParams.entity_ids ||
      queryParams.entity_tag_ids ||
      queryParams.regency_ids
    ) {
      return "entity_id"
    }

    // for filter using province
    if (queryParams.province_ids) {
      return "regency_id"
    }

    return "province_id"
  }
}
