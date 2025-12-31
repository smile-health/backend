import { Kysely } from "kysely"
import { Database } from "../types/index.js"
import { addTimestampColumns, addAuditColumns } from "../helper.js"

export async function up(db: Kysely<Database>): Promise<void> {
  // CREATING TABLE PROCESS
  await db.schema
    .createTable("notification_recaps")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("notification_type_id", "bigint", (col) =>
      col.notNull().references("notification_types.id").onDelete("cascade")
    )
    .addColumn("sorter", "float4", (col) => col.notNull().unique())
    .addColumn("section", "varchar(255)", (col) => col.notNull())
    .$call(addTimestampColumns)
    .$call(addAuditColumns)
    .execute()

  // SEEDING TABLE PROCESS
  const NOTIFICATION_TYPE_ID = {
    ZERO_STOCK: 3,
    LESS_STOCK: 4,
    ED_1: 5,
    ED_3: 6,
    ED_10: 7,
    ED_14: 8,
    ED_30: 9,
    ORDER_SHIP: 12,
    ASSET_MAX: 16,
    ASSET_MIN: 17,
    ASSET_STATUS_CHANGE: 18,
    ED_0: 22,
    ED_11: 23,
    INACTIVE_ENTITY: 26,
    STOCK_BACK_TO_NORMAL: 31,
    ASSET_MAINTENANCE: 14,
    ASSET_CALIBRATION: 15,
    ASSET_WARRANTY: 40,
  }

  const notificationRecaps = [
    {
      id: 1,
      notification_type_id: NOTIFICATION_TYPE_ID.ZERO_STOCK,
      sorter: 1.0,
      section: "notification.type.zero_stock",

      created_by: 29882,

      updated_by: 29882,
      deleted_at: null,
      deleted_by: null,
    },
    {
      id: 2,
      notification_type_id: NOTIFICATION_TYPE_ID.LESS_STOCK,
      sorter: 2.0,
      section: "notification.type.stock_below_minimum",

      created_by: 29882,

      updated_by: 29882,
      deleted_at: null,
      deleted_by: null,
    },
    {
      id: 3,
      notification_type_id: NOTIFICATION_TYPE_ID.ED_1,
      sorter: 3.0,
      section: "notification.type.material_near_expiry",

      created_by: 29882,

      updated_by: 29882,
      deleted_at: null,
      deleted_by: null,
    },
    {
      id: 4,
      notification_type_id: NOTIFICATION_TYPE_ID.ED_10,
      sorter: 3.01,
      section: "notification.type.material_near_expiry",

      created_by: 29882,

      updated_by: 29882,
      deleted_at: null,
      deleted_by: null,
    },
    {
      id: 5,
      notification_type_id: NOTIFICATION_TYPE_ID.ED_14,
      sorter: 3.02,
      section: "notification.type.material_near_expiry",

      created_by: 29882,

      updated_by: 29882,
      deleted_at: null,
      deleted_by: null,
    },
    {
      id: 6,
      notification_type_id: NOTIFICATION_TYPE_ID.ED_3,
      sorter: 3.03,
      section: "notification.type.material_near_expiry",

      created_by: 29882,

      updated_by: 29882,
      deleted_at: null,
      deleted_by: null,
    },
    {
      id: 7,
      notification_type_id: NOTIFICATION_TYPE_ID.ED_30,
      sorter: 3.04,
      section: "notification.type.material_near_expiry",

      created_by: 29882,

      updated_by: 29882,
      deleted_at: null,
      deleted_by: null,
    },
    {
      id: 8,
      notification_type_id: NOTIFICATION_TYPE_ID.ED_0,
      sorter: 3.05,
      section: "notification.type.material_near_expiry",

      created_by: 29882,

      updated_by: 29882,
      deleted_at: null,
      deleted_by: null,
    },
    {
      id: 9,
      notification_type_id: NOTIFICATION_TYPE_ID.ED_11,
      sorter: 3.06,
      section: "notification.type.material_near_expiry",

      created_by: 29882,

      updated_by: 29882,
      deleted_at: null,
      deleted_by: null,
    },
    {
      id: 10,
      notification_type_id: NOTIFICATION_TYPE_ID.ORDER_SHIP,
      sorter: 4.0,
      section: "notification.type.order_ship",

      created_by: 29882,

      updated_by: 29882,
      deleted_at: null,
      deleted_by: null,
    },
    {
      id: 11,
      notification_type_id: NOTIFICATION_TYPE_ID.INACTIVE_ENTITY,
      sorter: 5.0,
      section: "notification.type.inactive_entity",

      created_by: 29882,

      updated_by: 29882,
      deleted_at: null,
      deleted_by: null,
    },
    {
      id: 12,
      notification_type_id: NOTIFICATION_TYPE_ID.STOCK_BACK_TO_NORMAL,
      sorter: 6.0,
      section: "notification.type.stock_back_to_normal",

      created_by: 29882,

      updated_by: 29882,
      deleted_at: null,
      deleted_by: null,
    },
    {
      id: 13,
      notification_type_id: NOTIFICATION_TYPE_ID.ASSET_MAX,
      sorter: 7.0,
      section: "notification.type.temperature_excursion_above_max_threshold",

      created_by: 29882,

      updated_by: 29882,
      deleted_at: null,
      deleted_by: null,
    },
    {
      id: 14,
      notification_type_id: NOTIFICATION_TYPE_ID.ASSET_MIN,
      sorter: 8.0,
      section: "notification.type.temperature_excursion_below_min_threshold",

      created_by: 29882,

      updated_by: 29882,
      deleted_at: null,
      deleted_by: null,
    },
    {
      id: 15,
      notification_type_id: NOTIFICATION_TYPE_ID.ASSET_STATUS_CHANGE,
      sorter: 9.0,
      section: "notification.type.asset_status_changed",

      created_by: 29882,

      updated_by: 29882,
      deleted_at: null,
      deleted_by: null,
    },
    {
      id: 16,
      notification_type_id: NOTIFICATION_TYPE_ID.ASSET_MAINTENANCE,
      sorter: 10.0,
      section: "notification.type.asset_maintenance",
      created_by: 29882,
      updated_by: 29882,
      deleted_at: null,
      deleted_by: null,
    },
    {
      id: 17,
      notification_type_id: NOTIFICATION_TYPE_ID.ASSET_CALIBRATION,
      sorter: 11.0,
      section: "notification.type.asset_calibration",
      created_by: 29882,
      updated_by: 29882,
      deleted_at: null,
      deleted_by: null,
    },
    {
      id: 18,
      notification_type_id: NOTIFICATION_TYPE_ID.ASSET_WARRANTY,
      sorter: 12.0,
      section: "notification.type.asset_warranty",
      created_by: 29882,
      updated_by: 29882,
      deleted_at: null,
      deleted_by: null,
    },
  ]

  await db
    .insertInto("notification_recaps")
    .values(notificationRecaps)
    .onDuplicateKeyUpdate(() => ({
      updated_at: new Date(),
    }))
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("notification_recaps").execute()
}
