import { z } from "zod"

export const LoginRequestSchema = z.object({
  username: z.string(),
  password: z.string(),
})

export const LoginResponseSchema = z.object({
  id: z.number(),
  username: z.string(),
  email: z.string(),
  firstname: z.string(),
  lastname: z.string(),
  gender: z.number(),
  date_of_birth: z.string().nullable(),
  role: z.number(),
  token_login: z.string(),
  village_id: z.number().nullable(),
  entity_id: z.number(),
  timezone_id: z.number().nullable(),
  status: z.number(),
  view_only: z.number(),
  change_password: z.number(),
  entity: z.object({
    id: z.number(),
    name: z.string(),
    address: z.string(),
    type: z.number(),
    province_id: z.number().nullable(),
    regency_id: z.number().nullable(),
    sub_district_id: z.number().nullable(),
    village_id: z.number().nullable(),
    province: z.string().nullable(),
    regency: z.string().nullable(),
    sub_district: z.string().nullable(),
    village: z.string().nullable(),
  }),
  last_login: z.string(),
  updated_at: z.string(),
})

export const PostOrderIntegrationSchema = z
  .object({
    type: z.coerce.number().int().describe("Type of order"),
    customer_id: z.coerce.number().int().describe("Customer ID"),
    vendor_id: z.coerce.number().int().describe("Vendor ID"),
    activity_code: z.string().describe("Activity code"),
    key_ssl: z.string().describe("Key SSL"),
    category: z.string().describe("Category"),
    is_validate: z.coerce.number().int().describe("Validation flag"),
    total_patients: z.coerce.number().int().describe("Total patients"),
    order_items: z
      .array(
        z.object({
          external_order_item_id: z.string().describe("Order item ID"),
          ordered_qty: z.coerce.number().int().describe("Ordered quantity"),
          kode_kfa: z.string().describe("Product template code"),
        })
      )
      .min(1, "Order items must contain at least 1 item"),
  })
  .describe("Post Order Integration Request")

// Schema for PUT /v2/order/{order_id}/confirm/integration
export const PutOrderConfirmIntegrationSchema = z.object({
  comment: z.string().nullish(),
  activity_code: z.string(),
  order_items: z.array(
    z.object({
      confirmed_qty: z.coerce.number(),
      kode_kfa: z.string(),
    })
  ),
})

export const BaseEntitySchema = z.object({
  type_label: z.string().nullish(),
  id: z.number(),
  name: z.string().nullish(),
  address: z.string().nullish(),
  code: z.string().nullish(),
  type: z.number(),
  status: z.number(),
  created_at: z.string().nullish(),
  updated_at: z.string().nullish(),
  deleted_at: z.string().nullish(),
  province_id: z.string().nullish(),
  regency_id: z.string().nullish(),
  village_id: z.string().nullish(),
  sub_district_id: z.string().nullish(),
  lat: z.string().nullish(),
  lng: z.string().nullish(),
  postal_code: z.string().nullish(),
  is_vendor: z.number(),
  bpom_key: z.string().nullish(),
  is_puskesmas: z.number(),
  rutin_join_date: z.string().nullish(),
  is_ayosehat: z.number().nullish(),
  mapping_entity: z
    .object({
      id: z.number().nullish(),
      id_entitas_smile: z.number(),
      id_pusdatin: z.number().nullish(),
      id_bpjs: z.number().nullish(),
      id_satu_sehat: z.number(),
    })
    .nullish(),
})

export const EntitySchema = BaseEntitySchema.nullish()

export const EntityListSchema = BaseEntitySchema.extend({
  type_label: z.string().nullish(),
  id: z.number(),
  name: z.string().nullish(),
  address: z.string().nullish(),
  code: z.string().nullish(),
  type: z.number(),
  status: z.number(),
  created_at: z.string().nullish(),
  updated_at: z.string().nullish(),
  deleted_at: z.string().nullish(),
  province_id: z.string().nullish(),
  regency_id: z.string().nullish(),
  village_id: z.string().nullish(),
  sub_district_id: z.string().nullish(),
  lat: z.string().nullish(),
  lng: z.string().nullish(),
  postal_code: z.string().nullish(),
  is_vendor: z.number(),
  bpom_key: z.string().nullish(),
  is_puskesmas: z.number(),
  rutin_join_date: z.string().nullish(),
  is_ayosehat: z.number().nullish(),
})

export const GetOrderDetailsSchema = z.object({
  id: z.number(),
  key_ssl: z.string().nullish(),
  confirmed_at: z.string().nullish(),
  shipped_at: z.string().nullish(),
  fulfilled_at: z.string().nullish(),
  cancelled_at: z.string().nullish(),
  allocated_at: z.string().nullish(),
  created_at: z.string().nullish(),
  updated_at: z.string().nullish(),
  catatan_pengiriman: z.string().nullish(),
  catatan_penerimaan: z.string().nullish(),
  activity: z
    .object({
      id: z.number(),
      name: z.string().nullish(),
      code: z.string().nullish(),
    })
    .nullish(),
  customer: EntitySchema,
  vendor: EntitySchema,
  order_items: z.array(
    z.object({
      id: z.number(),
      order_id: z.number(),
      code_kfa_product_template: z.string().nullish(),
      qty: z.number(),
      recomended_stock: z.any().nullish(),
      reason_id: z.any().nullish(),
      other_reason: z.string().nullish(),
      confirmed_qty: z.number(),
      created_at: z.string().nullish(),
      updated_at: z.string().nullish(),
      deleted_at: z.string().nullish(),
      name_kfa_product_template: z.string().nullish(),
      code_sitb: z.any().nullish(),
      code_siha: z.any().nullish(),
      name_sitb: z.any().nullish(),
      name_siha: z.any().nullish(),
      material_category: z.any().nullish(),
      children: z.array(z.any()),
      batch_no: z.string().nullish(),
      price: z.string().nullish(),
      expired_date: z.string().nullish(),
      manufacturer: z.string().nullish(),
      brand: z.string().nullish(),
      sumber_dana: z.string().nullish(),
      tahun_anggaran: z.string().nullish(),
      stock_vendor: z.object({
        min: z.number(),
        max: z.number(),
        on_hand_stock: z.number(),
        available_stock: z.number(),
        allocated_stock: z.number(),
      }),
      stock_customer: z.object({
        min: z.number(),
        max: z.number(),
        on_hand_stock: z.number(),
        available_stock: z.number(),
        allocated_stock: z.number(),
      }),
    })
  ),
})

// Schema for GET /v2/order/{order_id}/integration
// No request body, so no schema needed for request body

export const OrderIdParamSchema = z.object({
  key_ssl: z.string().describe("Key SSL"),
})

export const SmileOrderIdParamSchema = z.object({
  order_id: z.coerce.number().describe("Order Id Smile"),
})

export const PutOrderCancelIntegrationSchema = z.object({
  cancel_reason: z.coerce.number(),
  other_reason: z.string().nullish(),
})

export type CreateOrderRequest = z.infer<typeof PostOrderIntegrationSchema>
export type ConfirmOrderRequest = z.infer<
  typeof PutOrderConfirmIntegrationSchema
>
export type CancelOrderRequest = z.infer<typeof PutOrderCancelIntegrationSchema>
export type ValidateOrderRequest = {
  order_id: number
  letter_number: string
  comment: string
}

// New schema for GET /v2/orders query parameters
export const GetOrdersQuerySchema = z
  .object({
    activity_id: z.coerce.number().int().optional(),
    page: z.coerce.number().int().optional(),
    paginate: z.coerce.number().int().optional(),
    from_date: z.string().optional(),
    to_date: z.string().optional(),
    updated_from_date: z.string().optional(),
    updated_to_date: z.string().optional(),
    ordered_number: z.string().optional(),
    service_type: z.string().optional(),
    status: z.coerce.number().int().optional(),
    type: z.coerce.number().int().optional(),
    entity_tag_id: z.coerce.number().int().optional(),
    entity_id: z.coerce.number().int().optional(),
    entity_province_id: z.coerce.number().int().optional(),
    entity_city_id: z.coerce.number().int().optional(),
    entity_puskesmas_id: z.coerce.number().int().optional(),
  })
  .describe("Get Orders Query Parameters")

// Schema for order list item in response
export const OrderListItemSchema = z.object({
  id: z.number(),
  device_type: z.number(),
  customer_id: z.number(),
  vendor_id: z.number(),
  status: z.number(),
  type: z.number(),
  required_date: z.string().nullable(),
  estimated_date: z.string().nullable(),
  actual_shipment: z.string().nullable(),
  purchase_ref: z.string().nullable(),
  sales_ref: z.string().nullable(),
  reason: z.string().nullable(),
  cancel_reason: z.string().nullable(),
  delivery_number: z.string().nullable(),
  confirmed_at: z.string().nullable(),
  shipped_at: z.string().nullable(),
  fulfilled_at: z.string().nullable(),
  cancelled_at: z.string().nullable(),
  allocated_at: z.string().nullable(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
  is_allocated: z.number(),
  taken_by_customer: z.number(),
  other_reason: z.string().nullable(),
  is_kpcpen: z.any().nullable(),
  qty_kpcpen: z.any().nullable(),
  master_order_id: z.any().nullable(),
  easygo_no_do: z.any().nullable(),
  biofarma_changed: z.any().nullable(),
  service_type: z.any().nullable(),
  no_document: z.any().nullable(),
  released_date: z.any().nullable(),
  notes: z.any().nullable(),
  activity_id: z.number(),
  is_manual: z.any().nullable(),
  no_po: z.any().nullable(),
  created_by: z.number(),
  customer: z.object({
    type_label: z.string(),
    id: z.number(),
    name: z.string(),
    address: z.string(),
    code: z.string(),
    type: z.number(),
    status: z.number(),
    created_at: z.string(),
    updated_at: z.string(),
    deleted_at: z.any().nullable(),
    province_id: z.string(),
    regency_id: z.string(),
    village_id: z.any().nullable(),
    sub_district_id: z.string(),
    lat: z.any().nullable(),
    lng: z.string(),
    postal_code: z.any().nullable(),
    is_vendor: z.number(),
    bpom_key: z.any().nullable(),
    is_puskesmas: z.number(),
    rutin_join_date: z.string(),
    is_ayosehat: z.number(),
    mapping_entity: z.object({
      id: z.number(),
      id_entitas_smile: z.number(),
      id_pusdatin: z.any().nullable(),
      id_bpjs: z.any().nullable(),
      id_satu_sehat: z.number(),
    }),
  }),
  vendor: z.object({
    type_label: z.string(),
    id: z.number(),
    name: z.string(),
    address: z.string(),
    code: z.string(),
    type: z.number(),
    status: z.number(),
    created_at: z.string(),
    updated_at: z.string(),
    deleted_at: z.any().nullable(),
    province_id: z.string(),
    regency_id: z.string(),
    village_id: z.any().nullable(),
    sub_district_id: z.any().nullable(),
    lat: z.string(),
    lng: z.string(),
    postal_code: z.any().nullable(),
    is_vendor: z.number(),
    bpom_key: z.any().nullable(),
    is_puskesmas: z.number(),
    rutin_join_date: z.string(),
    is_ayosehat: z.number(),
    mapping_entity: z.object({
      id: z.number(),
      id_entitas_smile: z.number(),
      id_pusdatin: z.any().nullable(),
      id_bpjs: z.any().nullable(),
      id_satu_sehat: z.number(),
    }),
  }),
  activity: z.object({
    id: z.number(),
    name: z.string(),
  }),
  user_confirmed_by: z.object({
    id: z.number(),
    username: z.string(),
    email: z.string(),
    firstname: z.string(),
    lastname: z.any().nullable(),
  }),
  user_shipped_by: z.object({
    id: z.number(),
    username: z.string(),
    email: z.string(),
    firstname: z.string(),
    lastname: z.any().nullable(),
  }),
  user_fulfilled_by: z.object({
    id: z.number(),
    username: z.string(),
    email: z.string(),
    firstname: z.string(),
    lastname: z.any().nullable(),
  }),
  user_cancelled_by: z.any().nullable(),
  user_allocated_by: z.object({
    id: z.number(),
    username: z.string(),
    email: z.string(),
    firstname: z.string(),
    lastname: z.any().nullable(),
  }),
  user_created_by: z.object({
    id: z.number(),
    username: z.string(),
    email: z.string(),
    firstname: z.string(),
    lastname: z.any().nullable(),
  }),
  user_updated_by: z.object({
    id: z.number(),
    username: z.string(),
    email: z.string(),
    firstname: z.string(),
    lastname: z.any().nullable(),
  }),
  user_deleted_by: z.any().nullable(),
  order_items: z.array(
    z.object({
      id: z.number(),
      qty: z.number(),
      master_material_id: z.number(),
      recommended_stock: z.any().nullable(),
      master_material: z.object({
        id: z.number(),
        name: z.string(),
        unit_of_distribution: z.string(),
        code: z.string(),
        description: z.string(),
        pieces_per_unit: z.number(),
        unit: z.string(),
        temperature_sensitive: z.number(),
        temperature_min: z.number(),
        temperature_max: z.number(),
        managed_in_batch: z.number(),
        status: z.number(),
        is_vaccine: z.number(),
        is_stockcount: z.number(),
        is_addremove: z.number(),
        updated_at: z.string(),
        is_openvial: z.number(),
        kfa_code: z.string(),
        need_sequence: z.any().nullable(),
        parent_id: z.number(),
        kfa_level_id: z.number(),
        mapping_materials: z.array(
          z.object({
            id: z.number(),
            id_material_smile: z.number(),
            code_kfa_ingredients: z.string(),
            code_kfa_product_template: z.string(),
            code_kfa_product_variant: z.string(),
            code_kfa_packaging: z.any().nullable(),
            code_sitb: z.any().nullable(),
            code_siha: z.any().nullable(),
            id_kfa: z.any().nullable(),
            code_biofarma: z.any().nullable(),
            code_bpom: z.any().nullable(),
            name_material_smile: z.any().nullable(),
            name_kfa_ingredients: z.string(),
            name_kfa_product_template: z.string(),
            name_kfa_product_variant: z.string(),
            name_kfa_packaging: z.any().nullable(),
            name_sitb: z.any().nullable(),
            name_siha: z.any().nullable(),
          })
        ),
      }),
      material_id: z.number(),
    })
  ),
})

export const EntitiesResponseSchema = z.object({
  total: z.number(),
  page: z.string(),
  perPage: z.string(),
  list: z.array(EntityListSchema),
})

export const MaterialTagSchema = z.object({
  id: z.number(),
  title: z.string(),
  is_ordered_sales: z.number(),
  is_ordered_purchase: z.number(),
})

export const ManufactureSchema = z.object({
  id: z.number(),
  name: z.string(),
})

export const MaterialSchema = z.object({
  id: z.number(),
  name: z.string(),
  code: z.string(),
  description: z.string(),
  pieces_per_unit: z.number(),
  unit: z.string(),
  temperature_sensitive: z.number(),
  temperature_min: z.number(),
  temperature_max: z.number(),
  managed_in_batch: z.number(),
  status: z.number(),
  is_vaccine: z.number(),
  is_stockcount: z.number(),
  bpom_code: z.string().nullish(),
  is_addremove: z.number(),
  updated_at: z.string(),
  material_tags: z.array(MaterialTagSchema),
  manufactures: z.array(ManufactureSchema),
  material_companion: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
    })
  ),
  user_created_by: z
    .object({
      id: z.number(),
      username: z.string(),
      email: z.string(),
      firstname: z.string(),
      lastname: z.string().nullish(),
    })
    .nullish(),
  user_updated_by: z
    .object({
      id: z.number(),
      username: z.string(),
      email: z.string(),
      firstname: z.string(),
      lastname: z.string().nullish(),
    })
    .nullish(),
  user_deleted_by: z.any().nullish(),
})

export const MaterialsResponseSchema = z.object({
  total: z.number(),
  page: z.string(),
  perPage: z.string(),
  list: z.array(MaterialSchema),
})

export const ManufactureSchemaResponse = z.object({
  id: z.number(),
  name: z.string(),
  reference_id: z.string(),
  description: z.string().nullish(),
  contact_name: z.string().nullish(),
  phone_number: z.string().nullish(),
  email: z.string().nullish(),
  address: z.string().nullish(),
  status: z.number(),
  type: z.number(),
  is_asset: z.number(),
  updated_at: z.string(),
  updated_by: z.number(),
  materials: z.array(z.any()),
  user_created_by: z
    .object({
      id: z.number(),
      username: z.string(),
      email: z.string(),
      firstname: z.string(),
      lastname: z.string().nullish(),
    })
    .nullish(),
  user_updated_by: z
    .object({
      id: z.number(),
      username: z.string(),
      email: z.string(),
      firstname: z.string(),
      lastname: z.string().nullish(),
    })
    .nullish(),
  user_deleted_by: z.any().nullish(),
})

export const ManufacturesResponseSchema = z.object({
  total: z.number(),
  page: z.number(),
  perPage: z.number(),
  list: z.array(ManufactureSchemaResponse),
})

// Query params schemas
export const EntitiesQueryParamsSchema = z.object({
  type: z.string().optional(),
  province_id: z.string().optional(),
  regency_id: z.string().optional(),
  sub_disctrict_id: z.string().optional(),
  village_id: z.string().optional(),
  is_vendor: z.coerce.number().optional(),
  page: z.coerce.number().optional(),
  paginate: z.coerce.number().optional(),
  updated_at_from: z.string().optional(),
  updated_at_to: z.string().optional(),
  entity_tag: z.coerce.number().optional(),
  keyword: z.string().optional(),
})

export const PaginationQueryParamsSchema = z
  .object({
    page: z.coerce.number().default(1),
    paginate: z.coerce.number().default(10),
  })
  .transform(({ page, paginate }) => ({
    page,
    paginate,
    offset: (page - 1) * paginate,
  }))

export const MaterialsQueryParamsSchema = PaginationQueryParamsSchema
export const ManufacturesQueryParamsSchema = PaginationQueryParamsSchema
export const BudgetSourceQueryParamsSchema = PaginationQueryParamsSchema

export type EntitiesQueryParams = z.infer<typeof EntitiesQueryParamsSchema>
export type MaterialsQueryParams = z.infer<typeof MaterialsQueryParamsSchema>
export type ManufacturesQueryParams = z.infer<
  typeof ManufacturesQueryParamsSchema
>
export type BudgetSourcesQueryParams = z.infer<typeof BudgetSourceQueryParamsSchema>

export interface Order {
  id: number
  device_type: number
  status: number
  type: number
  vendor: Entity
  customer: Entity
  activity: {
    id: string
    name: string
  }
  delivery_type: {
    id: number | null
    name: string | null
  }
  metadata: Record<string, unknown>
  confirmed_at: string | null
  shipped_at: string | null
  fulfilled_at: string | null
  cancelled_at: string | null
  allocated_at: string | null
  created_at: string
  updated_at: string
  user_created_by: User
  user_confirmed_by: User | null
  user_allocated_by: User | null
  user_shipped_by: User | null
  user_fulfilled_by: User | null
  user_cancelled_by: User | null
  total_order_item: number
}

export interface Entity {
  id: number
  name: string
  type: number
  address: string
  tag: string
  id_satu_sehat: number
  updated_at: string
  location: string
}

export interface User {
  id: number
  firstname: string
  lastname: string
  email: string
  username: string
}

export type OrderItem = {
  id: number
  order_id: number
  recommended_stock: number | null
  qty: number
  ordered_qty: number
  confirmed_qty: number
  validated_qty: number
  other_reason: string | null
  created_at: Date
  reason: {
    id: number
    name: string
  } | null
  material: {
    id: number
    name: string
    code: string
    type: string
    kfa_level_id: number | null
    kfa_level_name: string | null
    unit_of_consumption: string
    unit_of_distribution: string
    consumption_unit_per_distribution_unit: number
    is_managed_in_batch: number
    is_temperature_sensitive: number
    material_level_id: number
    parent_id: number | null
    parent_name: string | null
    parent_code: string | null
  }
  order_stocks: OrderStock[] // adjust if needed
  stock_customer: StockInfo
  stock_vendor: StockInfo
  children?: OrderItem[]
  allocated_qty: number
  shipped_qty: number
  fulfilled_qty: number
}

type StockInfo = {
  program_id: number
  entity_id: number
  total_qty: number
  total_in_transit_qty: number
  total_allocated_qty: number
  total_available_qty: number
  total_unreceived_qty: number
  material_id: number
  min: number | null
  max: number | null
}

export type OrderStock = {
  id: number
  stock_id: number
  activity_id: number
  activity_name: string
  price: number
  total_price: number
  status: number
  fulfill_status: number | null
  allocated_qty: number
  shipped_qty: number
  received_qty: number
  batch_id: number
  batch: {
    id: number
    code: string
    expired_date: string
    production_date: string
    manufacture_id: number
    manufacture_name: string
    pieces_purchase_id: number
    pieces_purchase_name: string
    source_material_id: number
    source_material_name: string
    price: number
    total_price: number
    year: number
  }
}
