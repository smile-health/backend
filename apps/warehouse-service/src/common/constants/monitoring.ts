export const MONTH_LABEL: Record<number, string> = {
  1: "Januari",
  2: "Februari",
  3: "Maret",
  4: "April",
  5: "Mei",
  6: "Juni",
  7: "Juli",
  8: "Agustus",
  9: "September",
  10: "Oktober",
  11: "November",
  12: "Desember",
}

export const DIM_PROVINCE = {
  TABLE: "dim_provinces dp",
  COLUMN: {
    ID: "dp.id",
    NAME: "dp.name",
  },
} as const

export const LOGISTIC_DIM_PROVINCE = {
  TABLE: "logistic_dim_provinces dp",
  COLUMN: {
    ID: "dp.id",
    NAME: "dp.name",
  },
} as const

export const DIM_REGENCY = {
  TABLE: "dim_regencies dr",
  COLUMN: {
    ID: "dr.id",
    NAME: "dr.name",
  },
} as const

export const LOGISTIC_DIM_REGENCY = {
  TABLE: "logistic_dim_regencies dr",
  COLUMN: {
    ID: "dr.id",
    NAME: "dr.name",
    YEAR: "toYear(dt.transactions_created_at) as year",
    MONTH: "toMonth(dt.transactions_created_at) as month",
    MATERIAL_ID: "dt.transactions_master_material_id",
    MATERIAL_NAME: "dt.dmm_name",
    MATERIAL_UNIT: "dt.dmm_unit_of_consumption_name",
    BATCH_CODE: "dt.batches_code",
    BATCH_ID: "dt.batches_id",
    EXPIRED_DATE: "dt.expired_date",
    VENDOR_ID: "dt.transactions_vendor_id",
    VENDOR_NAME: "dt.vendor_name",
    CUSTOMER_ID: "dt.transactions_customer_id",
    CUSTOMER_NAME: "dt.customer_name",
    TRANSACTION_CREATED_AT: "dt.transactions_created_at",
    TRANSACTION_TYPE: "dt.transactions_transaction_type_id",
    TRANSACTION_TYPE_NAME: "dt.transaction_type_title",
    TRANSACTIONS_ACTIVITY_ID: "dt.transactions_activity_id",
    TRANSACTIONS_ACTIVITY_NAME: "dt.transactions_activity_name",
    ENTITY_ID: "dt.entities_id",
    ENTITY_IS_VENDOR: "dt.entities_is_vendor",
    ENTITY_STATUS: "dt.entities_status",
    ENTITY_TYPE: "dt.entities_type",
    ENTITY_NAME: "dt.entities_name",
    ENTITY_CODE: "dt.entities_code",
    ENTITY_PROVINCE_ID: "dt.entities_province_id",
    ENTITY_REGENCY_ID: "dt.entities_regency_id",
    ENTITY_PROVINCE_NAME: "dt.entities_province_name",
    ENTITY_REGENCY_NAME: "dt.entities_regency_name",
    ENTITY_ENTITY_TAG_ID: "dt.entities_entity_tag_id",
    ENTITY_TAG_ID: "dt.entity_tags_id",
    ENTITY_TAG_TITLE: "dt.entity_tags_title",
    STOCK_ACTIVITY_ID: "dt.stock_activity_id",
    STOCK_ACTIVITY_NAME: "dt.stock_activity_name",
    MATERIAL_TYPE_ID: "dt.material_type_id",
    MATERIAL_TYPE_NAME: "dt.material_type_name",
    ORDERS_ORDER_TYPE_ID: "dt.orders_order_type_id",
    ORDERS_ORDER_STATUS_ID: "dt.orders_order_status_id",
    MASTER_DELETED_AT: "dt.master_deleted_at",
    TRANSACTIONS_DELETED_AT: "dt.transactions_deleted_at",
    INGESTED_AT: "dt.ingested_at",
    VERSION: "dt.version",
    // counts and values
    PENGELUARAN: "countIf(...)",
    PENGELUARAN_QTY: "abs(sumIf(...))",
    PENERIMAAN: "countIf(...)",
    PENERIMAAN_QTY: "abs(sumIf(...))",
    CANCEL_DISCARD:
      "countIf(dt.transactions_transaction_type_id == 11) as count",
    CANCEL_DISCARD_QTY:
      "abs(sumIf(ifNull(dt.transactions_change_qty,0), dt.transactions_transaction_type_id == 11))",
    PEMBUANGAN: "countIf(dt.transactions_transaction_type_id == 4) as count",
    PEMBUANGAN_QTY:
      "abs(sumIf(ifNull(dt.transactions_change_qty,0), dt.transactions_transaction_type_id == 4)) as value",
  },
} as const

export const DIM_ENTITY = {
  TABLE: "dim_entities de",
  COLUMN: {
    ID: "de.id",
    NAME: "de.name",
    STATUS: "de.status",
    IS_VENDOR: "de.is_vendor",
    TYPE: "de.type",
  },
} as const

export const DIM_MANUFACTUR = {
  TABLE: "dim_manufacture dman",
  COLUMN: {
    ID: "dman.id",
    NAME: "dman.name",
  },
} as const

export const LOGISTIC_DIM_MANUFACTUR = {
  TABLE: "logistic_dim_manufacture dman",
  COLUMN: {
    ID: "dman.id",
    NAME: "dman.name",
  },
} as const

export const DIM_ENTITY_TAG = {
  TABLE: "dim_entity_tags det",
  COLUMN: {
    ID: "det.id",
    TITLE: "det.title",
  },
} as const

export const LOGISTIC_DIM_ENTITY_TAG = {
  TABLE: "logistic_dim_entity_tags det",
  COLUMN: {
    ID: "det.id",
    TITLE: "det.title",
  },
} as const

export const LOGISTIC_DIM_ENTITY_ENTITY_TAG = {
  TABLE: "logistic_dim_entity_entity_tags deet",
  COLUMN: {
    ENTITY_ID: "deet.entity_id",
    ENTITY_TAG_ID: "deet.entity_tag_id",
  },
} as const

export const LOGISTIC_DIM_ORDER = {
  TABLE: "logistic_dim_orders do",
  COLUMN: {
    ID: "do.id",
    DELETED_AT: "do.deleted_at",
  },
} as const

export const DATAMART_TRANSACTION = {
  TABLE: "datamart_transactions_v5 dt",
  COLUMN: {
    YEAR: "toYear(dt.transactions_created_at) as year",
    MONTH: "toMonth(dt.transactions_created_at) as month",
    MATERIAL_ID: "dt.transactions_master_material_id",
    MATERIAL_NAME: "dt.dmm_name",
    MATERIAL_UNIT: "dt.dmm_unit_of_consumption_name",
    BATCH_CODE: "dt.batches_code",
    BATCH_ID: "dt.batches_id",
    EXPIRED_DATE: "dt.expired_date",
    VENDOR_ID: "dt.transactions_vendor_id",
    VENDOR_NAME: "dt.vendor_name",
    CUSTOMER_ID: "dt.transactions_customer_id",
    CUSTOMER_NAME: "dt.customer_name",
    TRANSACTION_CREATED_AT: "dt.transactions_created_at",
    TRANSACTION_TYPE: "dt.transactions_transaction_type_id",
    TRANSACTION_TYPE_NAME: "dt.transaction_type_title",
    TRANSACTIONS_ACTIVITY_ID: "dt.transactions_activity_id",
    TRANSACTIONS_ACTIVITY_NAME: "dt.transactions_activity_name",
    ENTITY_ID: "dt.entities_id",
    ENTITY_IS_VENDOR: "dt.entities_is_vendor",
    ENTITY_STATUS: "dt.entities_status",
    ENTITY_TYPE: "dt.entities_type",
    ENTITY_NAME: "dt.entities_name",
    ENTITY_CODE: "dt.entities_code",
    ENTITY_PROVINCE_ID: "dt.entities_province_id",
    ENTITY_REGENCY_ID: "dt.entities_regency_id",
    ENTITY_PROVINCE_NAME: "dt.entities_province_name",
    ENTITY_REGENCY_NAME: "dt.entities_regency_name",
    ENTITY_ENTITY_TAG_ID: "dt.entities_entity_tag_id",
    ENTITY_TAG_ID: "dt.entity_tags_id",
    ENTITY_TAG_TITLE: "dt.entity_tags_title",
    STOCK_ACTIVITY_ID: "dt.stock_activity_id",
    STOCK_ACTIVITY_NAME: "dt.stock_activity_name",
    MATERIAL_TYPE_ID: "dt.material_type_id",
    MATERIAL_TYPE_NAME: "dt.material_type_name",
    ORDERS_ORDER_TYPE_ID: "dt.orders_order_type_id",
    ORDERS_ORDER_STATUS_ID: "dt.orders_order_status_id",
    MASTER_DELETED_AT: "dt.master_deleted_at",
    TRANSACTIONS_DELETED_AT: "dt.transactions_deleted_at",
    INGESTED_AT: "dt.ingested_at",
    VERSION: "dt.version",
    KONSUMSI:
      "count(transactions_id) FILTER (WHERE transactions_transaction_type_id IN (10,5) AND transactions_order_id IS NULL) AS count",
    KONSUMSI_QTY:
      "sum(transactions_change_qty * -1) FILTER (WHERE transactions_transaction_type_id IN (10,5) AND transactions_order_id IS NULL) AS value",
    ADD: "count(transactions_id) FILTER (WHERE transactions_transaction_type_id = 7) AS count",
    ADD_QTY:
      "sum(ABS(transactions_change_qty)) FILTER (WHERE transactions_transaction_type_id = 7) AS value",
    REMOVE:
      "count(transactions_id) FILTER (WHERE transactions_transaction_type_id = 8) AS count",
    REMOVE_QTY:
      "sum(ABS(transactions_change_qty)) FILTER (WHERE transactions_transaction_type_id = 8) AS value",
    PENERIMAAN:
      "count(transactions_id) FILTER (WHERE transactions_transaction_type_id = 3 AND transactions_order_id IS NOT NULL AND orders_order_type_id IN (1,2,4) AND orders_order_status_id = 5) AS count",
    PENERIMAAN_QTY:
      "sum(transactions_change_qty) FILTER (WHERE transactions_transaction_type_id = 3 AND transactions_order_id IS NOT NULL AND orders_order_type_id IN (1,2,4) AND orders_order_status_id = 5) AS value",
    CANCEL_DISCARD:
      "count(transactions_id) FILTER (WHERE transactions_transaction_type_id IN (4,9)) AS count",
    CANCEL_DISCARD_QTY:
      "sum(transactions_change_qty * -1) FILTER (WHERE transactions_transaction_type_id IN (4,9)) AS value",
    PENERIMAAN_PENGEMBALIAN:
      "count(transactions_id) FILTER (WHERE transactions_transaction_type_id = 3 AND transactions_order_id IS NOT NULL AND orders_order_type_id = 3 AND orders_order_status_id = 5) AS count",
    PENERIMAAN_PENGEMBALIAN_QTY:
      "sum(transactions_change_qty) FILTER (WHERE transactions_transaction_type_id = 3 AND transactions_order_id IS NOT NULL AND orders_order_type_id = 3 AND orders_order_status_id = 5) AS value",
    PENGEMBALIAN:
      "count(transactions_id) FILTER (WHERE transactions_transaction_type_id = 2 AND transactions_order_id IS NOT NULL AND orders_order_type_id = 3 AND orders_order_status_id IN (4,5)) AS count",
    PENGEMBALIAN_QTY:
      "sum(transactions_change_qty * -1) FILTER (WHERE transactions_transaction_type_id = 2 AND transactions_order_id IS NOT NULL AND orders_order_type_id = 3 AND orders_order_status_id IN (4,5)) AS value",
    PENGELUARAN:
      "count(transactions_id) FILTER (WHERE transactions_transaction_type_id = 2 AND transactions_order_id IS NOT NULL AND orders_order_type_id IN (1,2,4) AND orders_order_status_id IN (4,5)) AS count",
    PENGELUARAN_QTY:
      "sum(transactions_change_qty * -1) FILTER (WHERE transactions_transaction_type_id = 2 AND transactions_order_id IS NOT NULL AND orders_order_type_id IN (1,2,4) AND orders_order_status_id IN (4,5)) AS value",
    // PEMBUANGAN: "countIf(dt.transactions_transaction_type_id == 4) as count",
    // PEMBUANGAN_QTY:
    //   "abs(abs(sumIf(ifNull(dt.transactions_change_qty, 0), dt.transactions_transaction_type_id == 4)) - abs(sumIf(ifNull(dt.transactions_change_qty, 0), dt.transactions_transaction_type_id == 11))) as value",
    // PENGEMBALIAN_FASKES:
    //   "countIf(dt.transactions_transaction_type_id == 5) as count",
    // PENGEMBALIAN_FASKES_QTY:
    //   "abs(sumIf(ifNull(dt.transactions_change_qty, 0), dt.transactions_transaction_type_id == 5)) as value",
  },
} as const

export const LOGISTIC_DATAMART_TRANSACTION = {
  TABLE: "logistic_datamart_transactions dt",
  COLUMN: {
    YEAR: "toYear(dt.transactions_created_at) as year",
    MONTH: "toMonth(dt.transactions_created_at) as month",
    MATERIAL_ID: "dt.transactions_master_material_id",
    MATERIAL_NAME: "dt.dmm_name",
    BATCH_CODE: "dt.batches_code",
    BATCH_ID: "dt.batches_id",
    EXPIRED_DATE: "dt.expired_date",
    VENDOR_ID: "dt.transactions_vendor_id",
    VENDOR_NAME: "dt.vendor_name",
    CUSTOMER_ID: "dt.transactions_customer_id",
    CUSTOMER_NAME: "dt.customer_name",
    TRANSACTION_CREATED_AT: "dt.transactions_created_at",
    TRANSACTION_TYPE: "dt.transactions_transaction_type_id",
    TRANSACTION_TYPE_NAME: "dt.transaction_type_title",
    PENGELUARAN: "countIf(...)",
    PENGELUARAN_QTY: "abs(sumIf(...))",
    PENERIMAAN: "countIf(...)",
    PENERIMAAN_QTY: "abs(sumIf(...))",
    CANCEL_DISCARD:
      "countIf(dt.transactions_transaction_type_id == 11) as count",
    CANCEL_DISCARD_QTY:
      "abs(sumIf(ifNull(dt.transactions_change_qty,0), dt.transactions_transaction_type_id == 11))",
    PEMBUANGAN: "countIf(dt.transactions_transaction_type_id == 4) as count",
    PEMBUANGAN_QTY:
      "abs(sumIf(ifNull(dt.transactions_change_qty,0), dt.transactions_transaction_type_id == 4)) as value",
    ENTITY_TAG_ID: "",
    ENTITY_TAG_TITLE: "",
    MATERIAL_UNIT: "",
  },
} as const

export const DIM_MASTER_MATERIAL = {
  TABLE: "dim_master_materials dmm",
  COLUMN: {
    ID: "dmm.id",
    NAME: "dmm.name",
    UNIT: "dmm.unit",
    TYPE: "dmm.material_type_id",
    IS_VACCINE: "dmm.is_vaccine",
    PARENT_ID: "dmm.parent_id",
  },
}

export const DIM_MASTER_MATERIAL_HAS_ACTIVITIES = {
  TABLE: "dim_master_material_has_activities dmmha",
  COLUMN: {
    ID: "dmmha.id",
  },
}

export const DIM_MAPPING_MASTER_MATERIAL = {
  TABLE: "dim_mapping_master_materials dmmm",
  COLUMN: {
    ID: "dmmm.id",
    ID_MATERIAL_SMILE: "dmmm.id_material_smile",
    CODE_KFA_PRODUCT_TEMPLATE: "dmmm.code_kfa_product_template",
    CODE_KFA_PRODUCT_VARIANT: "dmmm.code_kfa_product_variant",
    NAME_KFA_PRODUCT_TEMPLATE: "dmmm.name_kfa_product_template",
    NAME_KFA_PRODUCT_VARIANT: "dmmm.name_kfa_product_variant",
  },
}

export const DIM_ENTITY_HAS_MASTER_MATERIAL = {
  TABLE: "dim_entity_has_master_materials dehmm",
  COLUMN: {
    ID: "dehmm.id",
  },
}

export const DIM_ENTITY_MASTER_MATERIAL_ACTIVITIES = {
  TABLE: "dim_entity_master_material_activities demma",
  COLUMN: {
    ID: "demma.id",
    NAME: "demma.min",
    UNIT: "demma.max",
  },
}

export const DIM_MASTER_ACTIVITY = {
  TABLE: "dim_master_activities dma",
  COLUMN: {
    ID: "dma.id",
    NAME: "dma.name",
  },
}

export const DIM_ENTITY_ACTIVITY_DATE = {
  TABLE: "dim_entity_activity_date dead",
  COLUMN: {
    ID: "dead.id",
    ENTITY_ID: "dead.entity_id",
    ACTIVITY_ID: "dead.activity_id",
    JOIN_DATE: "dead.join_date",
    END_DATE: "dead.end_date",
  },
}

export const DIM_ENTITY_ENTITY_TAG = {
  TABLE: "dim_entity_entity_tags deet",
  COLUMN: {
    ID: "deet.id",
    ENTITY_ID: "deet.entity_id",
    ENTITY_TAG_ID: "deet.entity_tag_id",
  },
}

export const DIM_ORDER = {
  TABLE: "dim_orders do",
  COLUMN: {
    ID: "do.id",
    STATUS: "do.status",
    TYPE: "do.type",
    DELETED_AT: "do.deleted_at",
  },
}

export const DIM_BATCH = {
  TABLE: "dim_batches db",
  COLUMN: {
    ID: "db.batches_id",
    CODE: "db.code",
  },
}

export const DASHBOARD_STOCK_INFORMATION_TYPE = {
  STOCK_ON_HAND: 1,
  STOCK_IN_TRANSIT: 0,
}

export const DASHBOARD_STOCK_TYPE = {
  CHART: 1,
  PROVINCE: 2,
  REGENCY: 3,
  ENTITY: 4,
  ENTITY_STOCK: 5,
  ENTITY_MATERIAL: 6,
}

export const DASHBOARD_TRANSACTION_TYPE = {
  CHART: 1,
  MATERIAL: 2,
  TRANSACTION_REASON: 3,
  PROVINCE: 4,
  REGENCY: 5,
  ENTITY: 6,
  ENTITY_COMPLETE: 7,
  CHART_OLD: 8,
}
