import { ENTITY_TYPE } from "@/common/constants/entity.js"
import {
  KFA_LEVEL_ID,
  KFA_LEVEL_LABEL,
  STATUS,
} from "@/common/constants/material.js"
import { ORDER_STATUS } from "@/common/constants/order.js"
import { ActivityRepository } from "@/modules/activity/activity.repository.js"
import { BudgetSourceRepository } from "@/modules/budget-source/budget-source.repository.js"
import { EntityRepository } from "@/modules/entity/entity.repository.js"
import ExportHistoryRepository from "@/modules/export-history/export-history.repository.js"
import { ManufactureRepository } from "@/modules/manufacture/manufacture.repository.js"
import { MaterialRepository } from "@/modules/material/material.repository.js"
import { OrderAuditRepository } from "@/modules/order-audit/order-audit.repository.js"
import { OrderCommentRepository } from "@/modules/order-comment/order-comment.repository.js"
import { OrderHistoryRepository } from "@/modules/order-history/order-history.repository.js"
import { OrderItemStockRepository } from "@/modules/order-item-stock/order-item-stock.repository.js"
import { OrderOtherReasonRepository } from "@/modules/order-other-reason/order-other-reason.repository.js"
import { OrderModule } from "@/modules/order/order.module.js"
import { OrderPublisher } from "@/modules/order/order.publisher.js"
import { OrderRepository } from "@/modules/order/order.repository.js"
import { CreateOrderRequest as ParsedCreateOrderRequest } from "@/modules/order/order.schema.js"
import { StockRepository } from "@/modules/stock/stock.repository.js"
import { AuthKeycloakService } from "@smile/lib/api/auth.service.js"
import { NotFoundError } from "@smile/lib/error.js"
import { collect } from "@smile/lib/utils.js"
import { Context } from "hono"
import { z } from "zod"
import { getLabel } from "./siha.helper.js"
import { SihaRepository } from "./siha.repository.js"
import {
  BudgetSourcesQueryParams,
  CreateOrderRequest,
  EntitiesQueryParams,
  Entity,
  GetOrdersQuerySchema,
  LoginRequestSchema,
  ManufacturesQueryParams,
  MaterialsQueryParams,
  Order,
  OrderItem,
  OrderStock,
} from "./siha.schemas.js"

export class SihaModule extends OrderModule {
  constructor(
    protected readonly repo: OrderRepository,
    protected readonly orderCommentRepo: OrderCommentRepository,
    protected readonly orderItemStockRepo: OrderItemStockRepository,
    protected readonly orderOtherReasonRepo: OrderOtherReasonRepository,
    protected readonly orderAuditRepo: OrderAuditRepository,
    protected readonly orderHistoryRepo: OrderHistoryRepository,
    protected readonly stockRepo: StockRepository,
    protected readonly publisher: OrderPublisher,
    protected readonly integrationRepo: SihaRepository,
    protected readonly exportHistoryRepo: ExportHistoryRepository,
    protected readonly entityRepo: EntityRepository,
    protected readonly materialRepo: MaterialRepository,
    protected readonly manufactureRepo: ManufactureRepository,
    protected readonly authRepo: AuthKeycloakService,
    protected readonly activityRepo: ActivityRepository,
    protected readonly budgetSourceRepo: BudgetSourceRepository
  ) {
    super(
      repo,
      orderCommentRepo,
      orderItemStockRepo,
      orderOtherReasonRepo,
      orderAuditRepo,
      orderHistoryRepo,
      stockRepo,
      entityRepo,
      publisher,
      exportHistoryRepo
    )
  }

  public createOrder = async (
    c: Context,
    req: CreateOrderRequest,
    parsedReq: ParsedCreateOrderRequest
  ) => {
    const isDraft = req.is_validate === 0
    const resp = await super.create(c, parsedReq, isDraft)

    await Promise.all([
      this.integrationRepo.updateOrderAudit(c, resp.createdOrderId, isDraft),
      this.integrationRepo.createMappings(c, {
        type: "order",
        client_id: c.var.client.id,
        internal_id: resp.createdOrderId,
        external_id: req.key_ssl,
      }),
    ])
    c.set("orderId", resp.createdOrderId)

    return this.getDetail(c, resp.createdOrderId)
  }

  async getDetail(c: Context, orderId: number) {
    const resp = await super.detail(c, orderId)
    if (!resp) throw new NotFoundError("Order not found")

    const metadata = resp.metadata ?? {}
    const materialKFACodes = resp.order_items.flatMap((item) => [
      item.material.code,
      item.material.parent_code,
    ])
    const kfaMappings =
      await this.integrationRepo.getInternalToExternalMappings(
        c,
        materialKFACodes
      )

    const mapKFACode = (code: string) => {
      return kfaMappings[code] ?? code
    }

    const mapEntity = (entity: typeof resp.customer) => {
      if (!entity) return null

      return {
        type_label: getLabel(ENTITY_TYPE, entity.type),
        id: entity.id,
        name: entity.name,
        address: entity.address,
        code: entity.code,
        type: entity.type,
        status: entity.status,
        created_at: entity.created_at?.toISOString(),
        updated_at: entity.updated_at?.toISOString(),
        deleted_at: entity.deleted_at?.toISOString() ?? null,
        province_id: entity.province_id,
        regency_id: entity.regency_id,
        village_id: entity.village_id,
        sub_district_id: entity.sub_district_id,
        lat: entity.lat,
        lng: entity.lng,
        postal_code: entity.postal_code,
        is_vendor: entity.is_vendor,
        bpom_key: null,
        is_puskesmas: entity.is_puskesmas,
        rutin_join_date: entity.created_at?.toISOString(),
        is_ayosehat: null,
        mapping_entity: {
          id: null,
          id_entitas_smile: entity.id,
          id_pusdatin: null,
          id_bpjs: null,
          id_satu_sehat: entity.id_satu_sehat,
        },
      }
    }

    const mapOrderStock = (itemId: number, stock: OrderStock) => ({
      activity_id: stock.activity_id,
      activity_name: stock.activity_name,
      allocated_qty: stock.allocated_qty,
      batch_id: stock.batch_id,
      id: stock.id,
      order_item_id: itemId,
      ordered_qty: null,
      qty: stock.received_qty,
      received_qty: stock.received_qty,
      status: stock.status,
      stock_id: stock.stock_id,
      batch: {
        code: stock.batch?.code || "",
        expired_date: stock.batch?.expired_date || null,
        id: stock.batch?.id || null,
        manufacture_id: stock.batch?.manufacture_id || null,
        manufacture_name: stock.batch?.manufacture_name || "",
        pieces_purchase_id: stock.batch?.pieces_purchase_id || null,
        pieces_purchase_name: stock.batch?.pieces_purchase_name || "",
        price: stock.batch?.price || null,
        production_date: stock.batch?.production_date || null,
        source_material_id: stock.batch?.source_material_id || null,
        source_material_name: stock.batch?.source_material_name || "",
        total_price: stock.batch?.total_price || null,
        year: stock.batch?.year || null,
      },
    })

    const buildOrderItem = (item: OrderItem) => {
      if (item.material.kfa_level_id === KFA_LEVEL_ID.TEMPLATE)
        return {
          ...mapOrderItem(item),
          children: item.children?.map((child) => mapOrderItem(child)),
        }

      return {
        code_kfa_product_template: mapKFACode(item.material.parent_code),
        name_kfa_product_template: item.material.parent_name,
        qty: item.qty,
        stock_customer: item.stock_customer,
        stock_vendor: item.stock_vendor,
        children: [mapOrderItem(item)],
      }
    }

    const mapOrderItem = (item: OrderItem) => ({
      id: item.id,
      order_id: item.order_id,
      code_kfa_product_template:
        item.material.kfa_level_id === KFA_LEVEL_ID.TEMPLATE
          ? mapKFACode(item.material.code)
          : mapKFACode(item.material.parent_code),
      qty: item.qty,
      recomended_stock: item.recommended_stock ?? null,
      reason_id: null,
      other_reason: item.other_reason ?? null,
      recommended_stock: item.recommended_stock ?? null,
      shipped: item.shipped_qty ?? null,
      allocated: item.allocated_qty ?? null,
      confirmed_qty: item.confirmed_qty ?? null,
      validated_qty: item.validated_qty ?? null,
      created_at: item.created_at?.toISOString(),
      updated_at: null,
      deleted_at: null,
      name_kfa_product_template:
        item.material.kfa_level_id === KFA_LEVEL_ID.TEMPLATE
          ? item.material.name
          : item.material.parent_name,
      code_sitb: null,
      code_siha: null,
      name_sitb: null,
      name_siha: null,
      material_category: item.material.type ?? null,
      batch_no: null,
      order_stocks: item.order_stocks.map((stock) =>
        mapOrderStock(item.id, stock)
      ),
      material: {
        id: item.material.id,
        name: item.material.name,
        unit_of_distribution: item.material.unit_of_distribution,
        code: mapKFACode(item.material.code),
        description: null,
        pieces_per_unit: item.material.consumption_unit_per_distribution_unit,
        unit: item.material.unit_of_consumption,
        temperature_sensitive: item.material.is_temperature_sensitive,
        temperature_min: 0,
        temperature_max: 0,
        managed_in_batch: item.material.is_managed_in_batch,
        status: 1,
        is_vaccine: item.material.type,
        is_stockcount: 0,
        is_addremove: 1,
        updated_at: null,
        is_openvial: 0,
        kfa_code: mapKFACode(item.material.code),
        need_sequence: null,
        parent_id: item.material.parent_id,
        kfa_level_id: item.material.kfa_level_id,
        mapping_master_material: {
          id: null,
          id_material_smile: item.material.id,
          code_kfa_ingredients: null,
          code_kfa_product_template:
            item.material.material_level_id === KFA_LEVEL_ID.TEMPLATE
              ? mapKFACode(item.material.code)
              : null,
          code_kfa_product_variant:
            item.material.material_level_id === KFA_LEVEL_ID.VARIANT
              ? mapKFACode(item.material.code)
              : null,
          code_kfa_packaging: null,
          code_sitb: null,
          code_siha: null,
          id_kfa: null,
          code_biofarma: null,
          code_bpom: null,
          name_material_smile: null,
          name_kfa_ingredients: item.material.name,
          name_kfa_product_template: item.material.name,
          name_kfa_product_variant: item.material.name,
          name_kfa_packaging: null,
          name_sitb: null,
          name_siha: null,
        },
      },
      material_id: item.material.id,
      not_yet_shipped: 0,
      order_item_kfa_id: item.id,
      order_stock_fulfill: item.order_stocks.map((stock) =>
        mapOrderStock(item.id, stock)
      ),
      price: null,
      expired_date: null,
      manufacture: null,
      brand: null,
      sumber_dana: null,
      tahun_anggaran: null,
      stock_vendor: {
        id: null,
        entity_master_material_activities: [],
        entity_id: item.stock_vendor?.entity_id,
        stock_update: null,
        min: 0,
        max: 0,
        on_hand_stock: item.stock_vendor?.total_qty ?? 0,
        available_stock: item.stock_vendor?.total_available_qty ?? 0,
        allocated_stock: item.stock_vendor?.total_allocated_qty ?? 0,
      },
      stock_customer: {
        id: null,
        entity_master_material_activities: [],
        entity_id: item.stock_customer?.entity_id,
        stock_update: null,
        min: 0,
        max: 0,
        on_hand_stock: item.stock_customer?.total_qty ?? 0,
        available_stock: item.stock_customer?.total_available_qty ?? 0,
        allocated_stock: item.stock_customer?.total_allocated_qty ?? 0,
      },
    })

    const parsedResp = {
      purpose: null,
      id: resp.id,
      key_ssl: metadata["key_ssl"] ?? null,
      device_type: resp.device_type ?? null,
      customer_id: resp.customer_id ?? null,
      vendor_id: resp.vendor_id ?? null,
      status: resp.status,
      type: resp.type,
      required_date: resp.required_date ?? null,
      estimated_date: resp.estimated_date ?? null,
      actual_shipment: resp.actual_shipment_date?.toISOString() ?? null,
      purchase_ref: resp.purchase_ref ?? null,
      sales_ref: resp.sales_ref ?? null,
      reason: null,
      cancel_reason: resp.order_cancel_reason ?? null,
      delivery_number: resp.delivery_number ?? null,
      confirmed_at: resp.confirmed_at?.toISOString() ?? null,
      shipped_at: resp.shipped_at?.toISOString() ?? null,
      fulfilled_at: resp.fulfilled_at?.toISOString() ?? null,
      cancelled_at: resp.cancelled_at?.toISOString() ?? null,
      allocated_at: resp.allocated_at?.toISOString() ?? null,
      created_at: resp.created_at?.toISOString(),
      updated_at: resp.updated_at?.toISOString(),
      is_allocated: resp.is_allocated ?? 0,
      taken_by_customer: resp.taken_by_customer ?? 0,
      other_reason: null,
      is_kpcpen: null,
      qty_kpcpen: null,
      master_order_id: null,
      easygo_no_do: null,
      biofarma_changed: null,
      service_type: resp.device_type ?? null,
      no_document: resp.doc_no ?? null,
      released_date: null,
      notes: resp.notes ?? null,
      activity_id: resp.activity?.id ?? null,
      is_manual: null,
      no_po: resp.po_no ?? null,
      created_by: resp.user_created_by?.id ?? null,
      validated_by: resp.user_validated_by?.id ?? null,
      validated_at: resp.validated_at?.toISOString() ?? null,
      track_device: null,
      activity: resp.activity
        ? {
            id: resp.activity.id,
            name: resp.activity.name,
            code: resp.activity.name.toLowerCase().split(" ")[0],
          }
        : null,
      integration_order: {
        id: resp.id,
        key_ssl: metadata["key_ssl"] ?? null,
        total_patients: metadata["total_patients"] ?? 0,
        system_source: metadata["client_key"] ?? null,
        is_validate: metadata["is_validate"] ?? 0,
      },
      order_tags: [],
      order_item_projection_capacities: [],
      order_comments: resp.order_comments ?? [],
      customer: mapEntity(resp.customer),
      vendor: mapEntity(resp.vendor),
      user_confirmed_by: resp.user_confirmed_by ?? null,
      user_shipped_by: resp.user_shipped_by ?? null,
      user_fulfilled_by: resp.user_fulfilled_by ?? null,
      user_cancelled_by: resp.user_cancelled_by ?? null,
      user_allocated_by: resp.user_allocated_by ?? null,
      user_created_by: resp.user_created_by ?? null,
      user_updated_by: resp.user_updated_by ?? null,
      user_deleted_by: resp.user_deleted_by ?? null,
      user_validated_by: resp.user_validated_by ?? null,
      status_label: getLabel(ORDER_STATUS, resp.status),
      order_items: resp.order_items.map((item: OrderItem) =>
        buildOrderItem(item)
      ),
      kfa_format: true,
      order_tracking: null,
      canvas_tracking: null,
    }

    return parsedResp
  }

  async getOrdersList(c: Context, query: z.infer<typeof GetOrdersQuerySchema>) {
    const { paginate, ...restQuery } = query
    const activityId = await this.integrationRepo.getInternalId(
      c,
      "activity",
      query.activity_id
    )

    const baseQuery = {
      ...restQuery,
      page: query.page ?? 1,
      paginate: paginate ?? 10,
      offset: 0,
      activity_id: activityId,
    }

    const resp = await super.list(c, baseQuery)
    const orders = resp.data as Order[]

    const mapEntity = (entity: Entity) => {
      if (!entity) return null
      return {
        type_label: getLabel(ENTITY_TYPE, entity?.type), // assumed static
        id: entity?.id,
        name: entity?.name ?? null,
        address: entity?.address ?? null,
        code: null,
        type: entity?.type,
        status: 1,
        created_at: null,
        updated_at: null,
        deleted_at: null,
        province_id: null,
        regency_id: null,
        village_id: null,
        sub_district_id: null,
        lat: null,
        lng: null,
        postal_code: null,
        is_vendor: 1,
        bpom_key: null,
        is_puskesmas: 1,
        rutin_join_date: null,
        is_ayosehat: 0,
        mapping_entity: {
          id: null,
          id_entitas_smile: entity?.id,
          id_pusdatin: null,
          id_bpjs: null,
          id_satu_sehat: entity?.id_satu_sehat,
        },
      }
    }

    return {
      total: resp.total_item,
      page: resp.page,
      perPage: String(resp.item_per_page),
      list: orders.map((order) => ({
        id: order.id,
        device_type: order.device_type,
        customer_id: Number(order.customer?.id) || null,
        vendor_id: Number(order.vendor?.id) || null,
        status: order.status,
        type: order.type,
        required_date: null,
        estimated_date: null,
        actual_shipment: null,
        purchase_ref: null,
        sales_ref: null,
        reason: null,
        cancel_reason: null,
        delivery_number: null,
        confirmed_at: order.confirmed_at,
        shipped_at: order.shipped_at,
        fulfilled_at: order.fulfilled_at,
        cancelled_at: order.cancelled_at,
        allocated_at: order.allocated_at,
        created_at: order.created_at,
        updated_at: order.updated_at,
        is_allocated: order.allocated_at ? 1 : 0,
        taken_by_customer: 0,
        other_reason: null,
        is_kpcpen: null,
        qty_kpcpen: null,
        master_order_id: null,
        easygo_no_do: null,
        biofarma_changed: null,
        service_type: null,
        no_document: null,
        released_date: null,
        notes: null,
        activity_id: Number(order.activity?.id) || null,
        is_manual: null,
        no_po: null,
        created_by: order.user_created_by?.id || null,
        validated_by: null,
        validated_at: null,
        customer: mapEntity(order.customer),
        vendor: mapEntity(order.vendor),
        activity: {
          id: Number(order.activity?.id) || null,
          name: order.activity?.name,
        },
        integration_order: order.metadata
          ? {
              id: order.id,
              key_ssl: order.metadata["key_ssl"] ?? null,
              total_patients: order.metadata["total_patients"] ?? 0,
              system_source: order.metadata["client_key"] ?? null,
              is_validate: order.metadata["is_validate"] ?? 0,
            }
          : null,
        user_created_by: order.user_created_by,
        user_confirmed_by: order.user_confirmed_by,
        user_allocated_by: order.user_allocated_by,
        user_shipped_by: order.user_shipped_by,
        user_fulfilled_by: order.user_fulfilled_by,
        user_cancelled_by: order.user_cancelled_by,
        user_updated_by: null,
        user_deleted_by: null,
        user_validated_by: null,
        order_items: [],
        total_order_item: order.total_order_item ?? 0,
        kfa_format: false,
      })),
    }
  }

  async getEntities(c: Context, params: EntitiesQueryParams) {
    const result = await this.entityRepo.getListEntity(c, {
      page: params.page ?? 1,
      paginate: params.paginate ?? 10,
      program_id: c.var.programId,
      offset: 0,
      province_ids: params.province_id ? [params.province_id] : undefined,
      regency_ids: params.regency_id ? [params.regency_id] : undefined,
      sub_district_ids: params.sub_disctrict_id
        ? [params.sub_disctrict_id]
        : undefined,
      type_ids: params.type ? [params.type] : undefined,
      is_vendor: params.is_vendor,
    })

    return {
      total: result.total,
      page: params.page,
      perPage: params.paginate,
      list: result.list.map((entity) => ({
        type_label: entity.type,
        id: entity.id,
        name: entity.name,
        address: "",
        code: entity.code,
        type: entity.type,
        status: entity.status,
        created_at: "",
        updated_at: "",
        province_id: entity.province_id,
        regency_id: entity.regency_id,
        village_id: entity.village_id,
        sub_district_id: entity.sub_district_id,
        lat: null,
        lng: null,
        postal_code: null,
        is_vendor: 1,
        bpom_key: null,
        is_puskesmas: 0,
        rutin_join_date: null,
        is_ayosehat: 0,
        entity_tags: [
          {
            id: entity.entity_tag_id,
            title: entity.tag,
          },
        ],
        province: entity.province_id && {
          id: entity.province_id,
          name: entity.province_name,
        },
        regency: entity.regency_id && {
          id: entity.regency_id,
          name: entity.regency_name,
        },
        sub_district: entity.sub_district_id && {
          id: entity.sub_district_id,
          name: entity.sub_district_name,
        },
        mapping_entity: {
          id: entity.id ?? null,
          id_entitas_smile: entity.id,
          id_pusdatin: null,
          id_bpjs: null,
          id_satu_sehat: entity.id_satu_sehat,
        },
      })),
    }
  }

  async getMaterials(c: Context, params: MaterialsQueryParams) {
    const result = await this.materialRepo.findAll(c, {
      page: params.page,
      paginate: params.paginate,
      activity_id: 0,
      material_level_id: 0,
      offset: 0,
      material_type_ids: 0,
    })
    const materialIDs = collect(result.data, "id")
    const [mapActivities] = await Promise.all([
      this.activityRepo.getByMaterialIdMapped(c, materialIDs),
    ])

    return {
      total: result.total,
      page: params.page,
      perPage: params.paginate,
      list: result.data.map((material) => ({
        id: material.id,
        name: material.name,
        code: material.code,
        description: material.description,
        pieces_per_unit: material.consumption_unit_per_distribution_unit,
        unit: material.unit_of_consumption,
        temperature_sensitive: material.is_temperature_sensitive,
        temperature_min: material.min_temperature,
        temperature_max: material.max_temperature,
        managed_in_batch: material.is_managed_in_batch,
        status: material.status,
        created_at: material.created_at?.toISOString(),
        created_by: material.created_by ?? null,
        deleted_at: material.deleted_at?.toISOString() ?? null,
        deleted_by: material.deleted_by ?? null,
        is_openvial: material.is_open_vial,
        is_so: material.is_stock_opname_mandatory,
        is_stockcount: 0,
        is_vaccine: material.material_type_id === 2 ? 1 : 0,
        kfa_code: material.hierarchy_code,
        kfa_level_id: material.material_level_id,
        kfa_level_label: KFA_LEVEL_LABEL[material.material_level_id],
        manufactures_label: null,
        material_activities: mapActivities[material.id] ?? [],
        material_activities_label:
          mapActivities[material.id]?.map((a) => a.name).join(",") || null,
        material_companion: [],
        material_companion_label: null,
        need_sequence: null,
        parent_id: material.parent_id,
        parent_kfa_code_label: material.parent_hierarchy_code,
        parent_label: material.parent_name,
        range_temperature_id: null,
        status_label: getLabel(STATUS, material.status),
        unit_of_distribution: material.unit_of_distribution ?? null,
        updated_at: material.updated_at?.toISOString(),
        updated_by: material.updated_by ?? null,
        user_created_by: null,
        user_updated_by: null,
        user_deleted_by: null,
        user_updated_by_label: null,
        bpom_code: null,
        material_tags: [],
        manufactures: [],
        mapping_master_material: {
          id: material.id,
          id_material_smile: material.id,
          code_kfa_ingredients: null,
          code_kfa_product_template:
            material.material_level_id === KFA_LEVEL_ID.VARIANT
              ? material.parent_hierarchy_code
              : material.hierarchy_code,
          code_kfa_product_variant:
            material.material_level_id === KFA_LEVEL_ID.VARIANT
              ? material.hierarchy_code
              : null,
          code_kfa_packaging: null,
          code_sitb: null,
          code_siha: null,
          id_kfa: null,
          code_biofarma: null,
          code_bpom: null,
          name_material_smile: null,
          name_kfa_ingredients: null,
          name_kfa_product_template:
            material.material_level_id === KFA_LEVEL_ID.VARIANT
              ? material.parent_name
              : material.name,
          name_kfa_product_variant:
            material.material_level_id === KFA_LEVEL_ID.VARIANT
              ? material.name
              : null,
          name_kfa_packaging: null,
          name_sitb: null,
          name_siha: null,
        },
      })),
    }
  }

  async getManufactures(c: Context, params: ManufacturesQueryParams) {
    const result = await this.manufactureRepo.findAll(c, {
      page: params.page,
      paginate: params.paginate,
      offset: params.offset,
    })

    return {
      total: result.total,
      page: 1,
      perPage: 10,
      list: result.data.map((manufacture) => ({
        id: manufacture.id,
        name: manufacture.name,
        reference_id: manufacture.name,
        description: manufacture.description,
        contact_name: manufacture.contact_name,
        phone_number: manufacture.phone_number,
        email: manufacture.email,
        address: manufacture.address,
        status: manufacture.status,
        type: manufacture.type,
        is_asset: 0,
        updated_at: manufacture.updated_at?.toISOString(),
        updated_by: 0,
        materials: [],
        user_created_by: null,
        user_updated_by: null,
        user_deleted_by: null,
      })),
    }
  }

  async getBudgetSources(c: Context, params: BudgetSourcesQueryParams) {
    const result = await this.budgetSourceRepo.findAll(c, {
      page: params.page,
      paginate: params.paginate,
      offset: params.offset,
      isPaginate: true,
    })

    return {
      total: result.total,
      page: params.page,
      perPage: params.paginate,
      list: result.budgetSources.map((budgetSource) => ({
        id: budgetSource.id,
        name: budgetSource.name,
        description: budgetSource.description,
        status: budgetSource.status,
        created_at: budgetSource.created_at?.toISOString(),
        updated_at: budgetSource.updated_at?.toISOString(),
      })),
    }
  }

  async login(c: Context, req: z.infer<typeof LoginRequestSchema>) {
    const loginResp = await this.authRepo.login(req.username, req.password)
    const userInfoResp = await this.authRepo.validateToken(
      loginResp.authDetails.access_token
    )

    const userInfo = userInfoResp.userInfo
    const now = new Date().toISOString()

    return {
      id: null,
      username: userInfo.preferred_username,
      email: userInfo.email,
      firstname: userInfo.given_name || "",
      lastname: userInfo.family_name || "",
      gender: null,
      date_of_birth: null,
      role: Object.values(userInfo.resource_access)[0].roles[0],
      token_login: loginResp.authDetails.access_token,
      village_id: null,
      entity_id: null,
      timezone_id: null,
      status: 1,
      view_only: 0,
      change_password: 0,
      entity: null,
      last_login: now,
      updated_at: now,
    }
  }
}
