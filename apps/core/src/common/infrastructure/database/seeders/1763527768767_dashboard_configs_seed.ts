import { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function seed(db: Kysely<Database>): Promise<void> {
  const tableName = "dashboard_configs"
  const assetInventoryConfig = {
    rtmd_type_id: 91,
    asset_type_ids: [11, 88, 89, 90, 93],
    tabs: [
      {
        title: "dashboard.asset_inventory.label.ministry_of_health",
        entity_tag_ids: [3],
      },
      {
        title: "dashboard.asset_inventory.label.central_vaccine_warehouse",
        entity_tag_ids: [19],
      },
      {
        title: "dashboard.asset_inventory.label.provincial_health_office",
        entity_tag_ids: [5],
      },
      {
        title: "dashboard.asset_inventory.label.city_district_health_office",
        entity_tag_ids: [7],
      },
      {
        title: "dashboard.asset_inventory.label.community_health_center",
        entity_tag_ids: [9],
      },
      {
        title: "dashboard.asset_inventory.label.hospital",
        entity_tag_ids: [11],
      },
      {
        title: "dashboard.asset_inventory.label.laboratory",
        entity_tag_ids: [29],
      },
      {
        title: "dashboard.asset_inventory.label.other",
        entity_tag_ids: [
          1, 2, 4, 10, 12, 13, 14, 15, 17, 18, 20, 21, 23, 24, 25, 26, 27, 28,
          30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46,
        ],
      },
    ],
    card_colors: [
      "#DFEFC2",
      "#C1DBDC",
      "#CCEFF1",
      "#A8E9D1",
      "#BDC5EA",
      "#9BDBE7",
      "#EDEAE3",
      "#FFD9E4",
      "#C6E1C5",
      "#F7E7B3",
      "#C6DEF1",
      "#E5E4F2",
      "#EDD8DC",
      "#F5E6D3",
      "#FCE4E2",
      "#EFEFEF",
      "#F1D5BD",
      "#DEDAA5",
      "#ECF7FB",
      "#FFB687",
    ],
  }

  const dashboards = [
    {
      id: 1,
      key: "asset_inventory",
      config: JSON.stringify(assetInventoryConfig),
    },
  ]

  for (const dashboard of dashboards) {
    await db
      .insertInto(tableName)
      .values(dashboard)
      .onDuplicateKeyUpdate({
        config: dashboard.config,
      })
      .execute()
  }
}
