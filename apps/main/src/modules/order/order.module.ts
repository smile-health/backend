import { DEVICE_TYPE } from "@/common/constants/device.js"
import {
  KFA_LEVEL_CODE_TO_ID,
  KFA_LEVEL_ID,
} from "@/common/constants/material.js"
import {
  IS_ALLOCATED,
  ORDER_REASON,
  ORDER_STATUS,
  ORDER_TYPE,
} from "@/common/constants/order.js"
import { TRANSACTION_TYPE } from "@/common/constants/transaction.js"
import { ValidationError } from "@smile-health/lib/error.js"
import { TOPIC } from "@smile-health/lib/rabbitmq/topic.js"
import { PaginatedResponse } from "@smile-health/lib/types/paginate.js"
import {
  associate,
  collect,
  getUniqueIdsFromFields,
  group,
  merge,
  pick,
} from "@smile-health/lib/utils.js"
import { Context } from "hono"
import _ from "lodash"
import moment from "moment"
import momentTZ from "moment-timezone"
import { BaseModule } from "../base.module.js"
import { EntityRepository } from "../entity/entity.repository.js"
import ExportHistoryRepository from "../export-history/export-history.repository.js"
import { OrderAuditRepository } from "../order-audit/order-audit.repository.js"
import { CreateOrderAuditDTO } from "../order-audit/order-audit.schema.js"
import { OrderCommentRepository } from "../order-comment/order-comment.repository.js"
import { CreateOrderCommentDTO } from "../order-comment/order-comment.schema.js"
import { OrderHistoryRepository } from "../order-history/order-history.repository.js"
import { CreateOrderHistoryDTO } from "../order-history/order-history.schema.js"
import { OrderItemStockRepository } from "../order-item-stock/order-item-stock.repository.js"
import { CreateOrderItemStockDTO } from "../order-item-stock/order-item-stock.schema.js"
import { OrderOtherReasonRepository } from "../order-other-reason/order-other-reason.repository.js"
import { StockRepository } from "../stock/stock.repository.js"
import {
  OrderNotaBatchTemplate,
  OrderNotaConfirmationTemplate,
  OrderRequestLetterTemplate,
  OrderSBBKTemplate,
  OrderVARTemplate,
} from "./order.excel.js"
import { OrderPublisher } from "./order.publisher.js"
import { OrderRepository } from "./order.repository.js"
import {
  CreateOrderDTO,
  CreateOrderRequest,
  GetOrderQueries,
  GetStatusCountQueries,
  ListUserOrderDTO,
  RowType,
} from "./order.schema.js"

export class OrderModule extends BaseModule {
  constructor(
    protected readonly repo: OrderRepository,
    protected readonly orderCommentRepo: OrderCommentRepository,
    protected readonly orderItemStockRepo: OrderItemStockRepository,
    protected readonly orderOtherReasonRepo: OrderOtherReasonRepository,
    protected readonly orderAuditRepo: OrderAuditRepository,
    protected readonly orderHistoryRepo: OrderHistoryRepository,
    protected readonly stockRepo: StockRepository,
    protected readonly entityRepo: EntityRepository,
    protected readonly publisher: OrderPublisher,
    protected readonly exportHistoryRepo: ExportHistoryRepository
  ) {
    super(exportHistoryRepo, publisher)
  }

  #generateResponseUserDetail(id: number | null, listUser: ListUserOrderDTO[]) {
    const userDetail = listUser.find((item) => id && item.id === id)
    return userDetail || null
  }

  async list(c: Context, params: GetOrderQueries) {
    const { entityId, roleId, programId, userEntity, deviceType } = c.var
    const { list, total } = await this.repo.getListOrder(
      c,
      params,
      entityId,
      roleId,
      programId,
      userEntity,
      deviceType
    )

    if (list.length === 0) {
      return new PaginatedResponse(params, [], total)
    }

    const listCreatedByIds = collect(list, "user_created_by")

    const listQueryUserIds = listCreatedByIds

    let listUser: ListUserOrderDTO[] = []
    if (!_.isEmpty(listQueryUserIds)) {
      listUser = await this.repo.getListUser(c, listQueryUserIds)
    }

    const mapEntities = await this.entityRepo.getBasicDetailMapped(
      c,
      getUniqueIdsFromFields(list, "customer_id", "vendor_id")
    )

    const response = list.map((item) => {
      const userCreatedBy = this.#generateResponseUserDetail(
        Number(item.user_created_by),
        listUser
      )

      return {
        id: Number(item.order_id),
        device_type: item.device_type,
        status: item.status_id,
        type: item.type_id,
        vendor: mapEntities[item.vendor_id],
        customer: mapEntities[item.customer_id],
        activity: {
          id: item.activity_id,
          name: item.activity_name,
        },
        delivery_type: {
          id: item.delivery_type_id,
          name: item.delivery_type_name,
        },
        metadata: item.metadata,
        created_at: item.order_created_at
          ? new Date(item.order_created_at).toISOString()
          : null,
        updated_at: item.order_updated_at
          ? new Date(item.order_updated_at).toISOString()
          : null,
        user_created_by: userCreatedBy,
        total_order_item: item.total_order_items,
      }
    })

    return new PaginatedResponse(params, response, total)
  }

  async count(c: Context, params: GetStatusCountQueries) {
    const { entityId, programId, roleId } = c.var
    const [statusOrderCount, listOrderStatus] = await Promise.all([
      this.repo.getStatusOrderCount(c, params, entityId, programId, roleId!),
      this.repo.getListOrderStatus(c, params),
    ])

    let total = 0
    const listCount = listOrderStatus.map((row) => {
      const order = statusOrderCount.find((item) => item.status_id === row.id)

      const orderCount = order ? Number(order.count) : 0
      total += orderCount

      return {
        order_status_id: row.id,
        total: order ? order.count : 0,
      }
    })

    // order_type = 0 means for total all of data
    listCount.push({
      order_status_id: 0,
      total,
    })

    return { data: listCount }
  }

  async listDeliveryType(c: Context) {
    const listDeliveryType = await this.repo.getDeliveryType(c)
    const formatted = listDeliveryType.map((item) => ({
      ...item,
      name: c.var.t(
        `order_delivery_type.label.${item.name.toLowerCase().replace(/\s+/g, "_")}`
      ),
    }))
    return { data: formatted }
  }

  async create(c: Context, body: CreateOrderRequest, isDraft = false) {
    const { order_items, order_comment, required_date, ...createBody } = body
    const userId = Number(c.var.userId)
    const deviceType = c.var.deviceType ?? DEVICE_TYPE.web
    const orderStatus = isDraft ? ORDER_STATUS.DRAFT : ORDER_STATUS.PENDING

    // Create Order
    const orderData: CreateOrderDTO = {
      ...createBody,
      is_allocated: IS_ALLOCATED.TRUE,
      order_type_id: ORDER_TYPE.REQUEST,
      device_type: deviceType,
      order_status_id: orderStatus,
      total_order_items: order_items.length,
      created_by: userId,
      updated_by: userId,
    }

    const createdOrder = await this.repo.create(c, orderData)
    const createdOrderId = Number(createdOrder.insertId)

    // Create Order Comment
    if (order_comment) {
      const orderCommentData: CreateOrderCommentDTO = {
        order_id: createdOrderId,
        user_id: userId,
        order_status_id: ORDER_STATUS.PENDING,
        comment: order_comment,
      }

      await this.orderCommentRepo.create(c, orderCommentData)
    }

    // Create Order Audit
    const orderAuditData: CreateOrderAuditDTO = {
      order_id: createdOrderId,
      required_date: required_date,
    }

    await this.orderAuditRepo.create(c, orderAuditData)

    // Create Order History
    const orderHistoryData: CreateOrderHistoryDTO = {
      order_id: createdOrderId,
      order_status_id: orderStatus,
      created_by: userId,
      updated_by: userId,
    }

    await this.orderHistoryRepo.create(c, orderHistoryData)

    const orderItemsData: CreateOrderItemStockDTO[] = order_items.map(
      (orderItem) => ({
        ...orderItem,
        order_id: createdOrderId,
        qty: orderItem.ordered_qty,
        created_by: userId,
        updated_by: userId,
      })
    )

    for (const orderItem of orderItemsData) {
      const { other_reason, children, ...orderItemData } = orderItem

      const createdOrderItem = await this.orderItemStockRepo.create(
        c,
        orderItemData
      )

      if (
        other_reason &&
        orderItemData.order_reason_id === ORDER_REASON.OTHERS
      ) {
        const orderOtherReason = {
          source_id: Number(createdOrderItem.insertId),
          source_type: "order_item",
          content: other_reason,
          created_at: new Date(),
          updated_at: new Date(),
        }

        await this.repo.createOtherReason(c, orderOtherReason)
      }

      if (children && children.length > 0) {
        for (const child of children) {
          const childData = {
            order_id: createdOrderId,
            parent_material_id: orderItemData.material_id,
            qty: child.ordered_qty,
            updated_by: userId,
            ...child,
          }
          await this.orderItemStockRepo.create(c, childData)
        }
      }
    }

    await this.publisher.processCreate(c, createdOrderId, {
      ...body,
      is_allocated: IS_ALLOCATED.TRUE,
    })

    return { createdOrderId }
  }

  async detail(c: Context, id: number) {
    const programId = c.get("programId")
    const orderDetail = await this.repo.getOrderDetailById(c, id, programId)
    if (orderDetail) {
      const [orderStockItems, orderComments, orderHistories] =
        await Promise.all([
          this.repo.getOrderDetailItemStockByOrderId(
            c,
            orderDetail.id,
            c.get("programId")
          ),
          this.repo.getOrderDetailCommentByOrderId(
            c,
            orderDetail.id,
            c.get("programId")
          ),
          this.repo.getOrderHistoriesByOrderId(c, orderDetail.id),
        ])
      const groupByMaterial = group(orderStockItems, "material_level_id")

      const orderItemStockHierarchy = groupByMaterial[KFA_LEVEL_CODE_TO_ID[92]]
      const orderItemStockNonHierarchy =
        groupByMaterial[KFA_LEVEL_CODE_TO_ID[93]]

      const orderHistoriesStatusIds = orderHistories.map(
        (orderHistory) => orderHistory.order_status_id
      )

      const hierarchy = await this.setItemStockData(
        c,
        orderDetail,
        orderStockItems,
        orderItemStockHierarchy,
        KFA_LEVEL_CODE_TO_ID[92],
        orderHistoriesStatusIds
      )
      const nonHierarchy = await this.setItemStockData(
        c,
        orderDetail,
        orderStockItems,
        orderItemStockNonHierarchy,
        KFA_LEVEL_CODE_TO_ID[93],
        orderHistoriesStatusIds
      )

      const orderItemStockList = this.enrichOrderItemsWithAllocation(
        this.setOrderItems(hierarchy, nonHierarchy),
        orderHistoriesStatusIds
      )

      const orderCommentList = orderComments.map((orderComment) => ({
        id: orderComment.id,
        comment: orderComment.comment,
        created_at: orderComment.created_at,
        order_status: orderComment.order_status_id,
        user: !orderComment.user_id
          ? null
          : {
              id: orderComment.user_id,
              firstname: orderComment.firstname,
              lastname: orderComment.lastname,
            },
      }))

      const mapUsers = await this.repo.getListUser(c, [
        Number(orderDetail?.drafted_by),
        Number(orderDetail?.validated_by),
        Number(orderDetail?.confirmed_by),
        Number(orderDetail?.shipped_by),
        Number(orderDetail?.fulfilled_by),
        Number(orderDetail?.cancelled_by),
        Number(orderDetail?.allocated_by),
        Number(orderDetail?.created_by),
        Number(orderDetail?.updated_by),
        Number(orderDetail?.deleted_by),
      ])

      const mapEntities = await this.repo.getListWsEntities(c, [
        Number(orderDetail?.customer_id),
        Number(orderDetail?.vendor_id),
      ])

      const mapActivities = await this.repo.getListWsActivities(c, [
        Number(orderDetail?.activity_id),
      ])

      const newMapusers = associate(mapUsers, "id")
      const newMapEntities = associate(mapEntities, "id")
      const newMapActivities = associate(mapActivities, "id")

      return {
        ...pick(orderDetail, [
          "id",
          "device_type",
          "customer_id",
          "vendor_id",
          "status",
          "type",
          "required_date",
          "estimated_date",
          "actual_shipment_date",
          "purchase_ref",
          "sales_ref",
          "delivery_number",
          "drafted_at",
          "validated_at",
          "confirmed_at",
          "shipped_at",
          "fulfilled_at",
          "cancelled_at",
          "allocated_at",
          "created_at",
          "updated_at",
          "deleted_at",
          "taken_by_customer",
          "delivery_type",
          "doc_no",
          "notes",
          "po_no",
          "total_order_items",
          "is_allocated",
          "other_reason_cancel",
          "metadata",
        ]),
        order_cancel_reason: await this.setOrderCancelReason(
          c,
          orderDetail.order_cancel_reason_id
        ),
        activity: newMapActivities[orderDetail?.activity_id ?? 0] ?? null,
        order_comments: orderCommentList,
        customer: newMapEntities[orderDetail?.customer_id ?? 0] ?? null,
        vendor: newMapEntities[orderDetail?.vendor_id ?? 0] ?? null,
        order_items: orderItemStockList,
        user_drafted_by: newMapusers[orderDetail?.drafted_by ?? 0] ?? null,
        user_validated_by: newMapusers[orderDetail?.validated_by ?? 0] ?? null,
        user_confirmed_by: newMapusers[orderDetail?.confirmed_by ?? 0] ?? null,
        user_shipped_by: newMapusers[orderDetail?.shipped_by ?? 0] ?? null,
        user_fulfilled_by: newMapusers[orderDetail?.fulfilled_by ?? 0] ?? null,
        user_cancelled_by: newMapusers[orderDetail?.cancelled_by ?? 0] ?? null,
        user_allocated_by: newMapusers[orderDetail?.allocated_by ?? 0] ?? null,
        user_created_by: newMapusers[orderDetail?.created_by ?? 0] ?? null,
        user_updated_by: newMapusers[orderDetail?.updated_by ?? 0] ?? null,
        user_deleted_by: newMapusers[orderDetail?.deleted_by ?? 0] ?? null,
      }
    }
  }

  async export(c: Context, params: GetOrderQueries) {
    return await this.handleAsyncExport(c, TOPIC.ORDER_EXPORTED, {
      filename: "Orders",
      params,
    })
  }

  async exportVAR(c: Context, id: number) {
    const { user, programId } = c.var
    const orderDetail = await this.repo.getOrderDetails(c, id, programId)
    if (!orderDetail) {
      throw new ValidationError("Order Detail not found")
    }

    const list = await this.repo.getReport(
      c,
      id,
      TRANSACTION_TYPE.ISSUES,
      [KFA_LEVEL_ID.VARIANT],
      orderDetail.customer_id,
      programId
    )

    // Create Excel File
    const excelTemplate = new OrderVARTemplate()

    await excelTemplate.loadFile(c)
    excelTemplate.setTitle(
      `${c.var.t("order.label.var_title_file")} ${orderDetail.customer_name ?? ""}`
    )
    excelTemplate.setTimezone(c.req.header("Timezone"))

    // HEADER
    await excelTemplate.addRows(
      c.var.t("order.label.report"),
      [[id], [user?.program_name], [orderDetail.activity_name]],
      6,
      "B"
    )

    await excelTemplate.addRows(
      c.var.t("order.label.report"),
      [
        [orderDetail.vendor_name ?? "-"],
        [orderDetail.vendor_regency_name ?? "-"],
        [orderDetail.vendor_province_name ?? "-"],
      ],
      10,
      "B"
    )

    await excelTemplate.addRows(
      c.var.t("order.label.report"),
      [
        [orderDetail.customer_name ?? "-"],
        [orderDetail.customer_regency_name ?? "-"],
        [orderDetail.customer_province_name ?? "-"],
      ],
      10,
      "H"
    )

    const budgetSourceId = [
      ...new Set(collect(list, "budget_source_id")),
    ].filter((id) => id !== null)
    const budgetSources = await this.repo.getBudgetSources(
      c,
      budgetSourceId.length > 0 ? budgetSourceId : [0],
      programId
    )

    // Create Excel File
    // BODY
    let count = 1
    const rows: RowType[][] = []
    list.forEach((item) => {
      let distribution = 0
      if (
        item.allocated_qty &&
        item.consumption_unit_per_distribution_unit &&
        item.consumption_unit_per_distribution_unit > 0
      ) {
        distribution =
          item.allocated_qty / item.consumption_unit_per_distribution_unit
      }

      const row = [
        count,
        item.material_name,
        item.unit_of_distribution,
        distribution,
        this.formatPrice(item.price),
        this.formatPrice(item.total_price),
        item.code_batch,
        item.expired_date_batch
          ? moment(item.expired_date_batch).format("DD/MM/YYYY")
          : "",
        budgetSources.find((x) => x.id === item.budget_source_id)?.name ?? "",
        item.year,
      ]

      if (item.stock_id) {
        rows.push(row)
        count++
      }
    })

    await excelTemplate.addRows(c.var.t("order.label.report"), rows, 15, "A", {
      border: true,
    })

    // FOOTER
    const timezone = c.req.header("Timezone") || "UTC"
    await excelTemplate.addRows(
      c.var.t("order.label.report"),
      [
        [
          "",
          c.var.t("order.label.submitted_by"),
          "",
          "",
          "",
          c.var.t("order.label.received_by"),
        ],
        [""],
        [""],
        [""],
        ["", "________________", "", "", "", "_______________"],
        [""],
        [
          "",
          "",
          c.var.t("order.label.date"),
          orderDetail.created_at_order
            ? momentTZ(orderDetail.created_at_order)
                .tz(timezone)
                .format("YYYY-MM-DD HH:mm:ss")
            : "",
          "",
          "",
          c.var.t("order.label.date"),
        ],
      ],
      17 + rows.length,
      "A"
    )

    return excelTemplate.generate()
  }

  async exportSBBK(c: Context, id: number) {
    const { programId, user } = c.var
    const orderDetail = await this.repo.getOrderDetails(c, id, programId)
    if (!orderDetail) {
      throw new ValidationError("Order Detail not found")
    }

    const list = await this.repo.getReport(
      c,
      id,
      TRANSACTION_TYPE.ISSUES,
      [KFA_LEVEL_ID.VARIANT],
      orderDetail.vendor_id,
      programId
    )

    const budgetSourceId = [
      ...new Set(collect(list, "budget_source_id")),
    ].filter((id) => id !== null)
    const budgetSources = await this.repo.getBudgetSources(
      c,
      budgetSourceId.length > 0 ? budgetSourceId : [0],
      programId
    )

    // Create Excel File
    const excelTemplate = new OrderSBBKTemplate()

    await excelTemplate.loadFile(c)
    excelTemplate.setTitle(
      `${c.var.t("order.label.sbbk_title_file")} ${orderDetail.customer_name ?? ""}`
    )
    excelTemplate.setTimezone(c.req.header("Timezone"))

    // HEADER
    await excelTemplate.addRows(
      c.var.t("order.label.report"),
      [[id], [user?.program_name], [orderDetail.activity_name]],
      6,
      "B"
    )

    await excelTemplate.addRows(
      c.var.t("order.label.report"),
      [
        [orderDetail.vendor_name ?? "-"],
        [orderDetail.vendor_regency_name ?? "-"],
        [orderDetail.vendor_province_name ?? "-"],
      ],
      10,
      "B"
    )

    await excelTemplate.addRows(
      c.var.t("order.label.report"),
      [
        [orderDetail.customer_name ?? "-"],
        [orderDetail.customer_regency_name ?? "-"],
        [orderDetail.customer_province_name ?? "-"],
      ],
      10,
      "H"
    )

    // BODY
    let count = 1
    const rows: RowType[][] = []
    list.forEach((item) => {
      let distribution = 0
      if (
        item.allocated_qty &&
        item.consumption_unit_per_distribution_unit &&
        item.consumption_unit_per_distribution_unit > 0
      ) {
        distribution =
          item.allocated_qty / item.consumption_unit_per_distribution_unit
      }

      const row = [
        count,
        item.material_name,
        item.unit_of_consumption ?? "-",
        distribution,
        this.formatPrice(item.price),
        this.formatPrice(item.total_price),
      ]

      // For Program Logistic
      if (c.var.config?.material?.is_hierarchy_enabled) {
        row.push(
          item.code_batch,
          item.expired_date_batch
            ? moment(item.expired_date_batch).format("DD/MM/YYYY")
            : "",
          budgetSources.find((x) => x.id === item.budget_source_id)?.name ?? "",
          item.year
        )
      } else {
        row.push(
          item.allocated_qty,
          item.expired_date_batch
            ? moment(item.expired_date_batch).format("DD/MM/YYYY")
            : "",
          item.code_batch,
          budgetSources.find((x) => x.id === item.budget_source_id)?.name ?? ""
        )
      }

      if (item.stock_id) {
        rows.push(row)
        count++
      }
    })
    await excelTemplate.addRows(c.var.t("order.label.report"), rows, 15, "A", {
      border: true,
    })

    // FOOTER
    const timezone = c.req.header("Timezone") || "UTC"
    await excelTemplate.addRows(
      c.var.t("order.label.report"),
      [
        [
          "",
          c.var.t("order.label.submitted_by"),
          "",
          "",
          "",
          c.var.t("order.label.received_by"),
        ],
        [""],
        [""],
        [""],
        ["", "________________", "", "", "", "_______________"],
        [""],
        [
          "",
          "",
          c.var.t("order.label.date"),
          orderDetail.created_at_order
            ? momentTZ(orderDetail.created_at_order)
                .tz(timezone)
                .format("YYYY-MM-DD HH:mm:ss")
            : "",
          "",
          "",
          c.var.t("order.label.date"),
        ],
      ],
      17 + rows.length,
      "A"
    )

    return excelTemplate.generate()
  }

  async exportNotaBatch(c: Context, id: number) {
    const { programId, user } = c.var
    const orderDetail = await this.repo.getOrderDetails(c, id, programId)
    if (!orderDetail) {
      throw new ValidationError("Order Detail not found")
    }

    const list = await this.repo.getReport(
      c,
      id,
      TRANSACTION_TYPE.ISSUES,
      [KFA_LEVEL_ID.VARIANT],
      orderDetail.vendor_id,
      programId
    )

    // Create Excel File
    const excelTemplate = new OrderNotaBatchTemplate()

    await excelTemplate.loadFile(c)
    excelTemplate.setTitle(
      `${c.var.t("order.label.nota_batch_title")} ${orderDetail.vendor_name ?? ""}`
    )
    excelTemplate.setTimezone(c.req.header("Timezone"))

    // HEADER
    await excelTemplate.addRows(
      c.var.t("order.label.nota_batch"),
      [[id], [user?.program_name], [orderDetail.activity_name]],
      6,
      "B"
    )

    await excelTemplate.addRows(
      c.var.t("order.label.nota_batch"),
      [
        [orderDetail.vendor_name ?? "-"],
        [orderDetail.vendor_regency_name ?? "-"],
        [orderDetail.vendor_province_name ?? "-"],
      ],
      10,
      "B"
    )

    await excelTemplate.addRows(
      c.var.t("order.label.nota_batch"),
      [
        [orderDetail.customer_name ?? "-"],
        [orderDetail.customer_regency_name ?? "-"],
        [orderDetail.customer_province_name ?? "-"],
      ],
      10,
      "H"
    )

    // BODY
    let count = 1
    const rows: (string | number | Date | null)[][] = []
    list.forEach((item) => {
      const row = [
        count,
        item.material_name,
        item.unit_of_distribution,
        item.price
          ? this.formatPrice(item.price)
          : this.formatPrice(item.stock_price),
        "",
        item.total_available_qty,
        item.ordered_qty,
        item.confirmed_qty,
        item.allocated_qty,
        item.code_batch,
        item.expired_date_batch
          ? moment(item.expired_date_batch).format("DD/MM/YYYY")
          : "",
      ]
      if (item.stock_id) {
        rows.push(row)
        count++
      }
    })
    await excelTemplate.addRows(
      c.var.t("order.label.nota_batch"),
      rows,
      15,
      "A",
      {
        border: true,
      }
    )

    // FOOTER
    const timezone = c.req.header("Timezone") || "UTC"
    await excelTemplate.addRows(
      c.var.t("order.label.nota_batch"),
      [
        [
          "",
          c.var.t("order.label.nota_created_by"),
          "",
          "",
          "",
          c.var.t("order.label.nota_knowing_by"),
        ],
        [""],
        [""],
        [""],
        ["", "________________", "", "", "", "_______________"],
        [""],
        [
          "",
          "",
          c.var.t("order.label.date"),
          orderDetail.created_at_order
            ? momentTZ(orderDetail.created_at_order)
                .tz(timezone)
                .format("YYYY-MM-DD HH:mm:ss")
            : "",
          "",
          "",
          c.var.t("order.label.date"),
        ],
      ],
      17 + rows.length,
      "A"
    )

    return excelTemplate.generate()
  }

  async exportNotaConfirmation(c: Context, id: number) {
    const { user } = c.var
    const orderDetail = await this.repo.getOrderDetails(c, id, c.var.programId)
    if (!orderDetail) {
      throw new ValidationError("Order Detail not found")
    }

    const list = await this.repo.getReport(
      c,
      id,
      TRANSACTION_TYPE.ISSUES,
      [KFA_LEVEL_ID.VARIANT, KFA_LEVEL_ID.TEMPLATE],
      orderDetail.vendor_id,
      c.var.programId
    )
    const finalList = list.filter((item) =>
      item.parent_material_id
        ? list.some((i) => i.material_id === item.parent_material_id)
        : !list.some((i) => i.parent_material_id === item.material_id)
    )

    // Create Excel File
    const excelTemplate = new OrderNotaConfirmationTemplate()

    await excelTemplate.loadFile(c)
    excelTemplate.setTitle(
      `${c.var.t("order.label.nota_confirmation")} ${orderDetail.vendor_name ?? ""}`
    )
    excelTemplate.setTimezone(c.req.header("Timezone"))

    // HEADER
    await excelTemplate.addRows(
      c.var.t("order.label.nota_confirmation"),
      [[id], [user?.program_name], [orderDetail.activity_name]],
      6,
      "B"
    )

    await excelTemplate.addRows(
      c.var.t("order.label.nota_confirmation"),
      [
        [orderDetail.vendor_name ?? "-"],
        [orderDetail.vendor_regency_name ?? "-"],
        [orderDetail.vendor_province_name ?? "-"],
      ],
      10,
      "B"
    )

    await excelTemplate.addRows(
      c.var.t("order.label.nota_confirmation"),
      [
        [orderDetail.customer_name ?? "-"],
        [orderDetail.customer_regency_name ?? "-"],
        [orderDetail.customer_province_name ?? "-"],
      ],
      10,
      "H"
    )

    let count = 1
    const rows: (string | number | Date | null)[][] = []
    finalList.forEach((item) => {
      const row = [
        count,
        item.material_name,
        item.unit_of_distribution,
        item.price
          ? this.formatPrice(item.price)
          : this.formatPrice(item.stock_price),
        "",
        item.total_available_qty,
        item.ordered_qty,
        item.confirmed_qty,
      ]

      if (
        orderDetail.order_status_id === ORDER_STATUS.CONFIRMED ||
        orderDetail.order_status_id === ORDER_STATUS.PENDING
      ) {
        rows.push(row)
        count++
      } else {
        if (item.stock_id) {
          if (item.qty !== null && item.confirmed_qty !== null) {
            rows.push(row)
            count++
          }
        }
      }
    })

    // BODY
    await excelTemplate.addRows(
      c.var.t("order.label.nota_confirmation"),
      rows,
      15,
      "A",
      {
        border: true,
      }
    )

    // FOOTER
    const timezone = c.req.header("Timezone") || "UTC"
    await excelTemplate.addRows(
      c.var.t("order.label.nota_confirmation"),
      [
        [
          "",
          c.var.t("order.label.nota_created_by"),
          "",
          "",
          "",
          c.var.t("order.label.nota_knowing_by"),
        ],
        [""],
        [""],
        [""],
        ["", "________________", "", "", "", "_______________"],
        [""],
        [
          "",
          "",
          c.var.t("order.label.date"),
          orderDetail.created_at_order
            ? momentTZ(orderDetail.created_at_order)
                .tz(timezone)
                .format("YYYY-MM-DD HH:mm:ss")
            : "",
          "",
          "",
          c.var.t("order.label.date"),
        ],
      ],
      17 + rows.length,
      "A"
    )

    return excelTemplate.generate()
  }

  async exportRequestLetter(c: Context, id: number) {
    const { programId, user } = c.var
    const orderDetail = await this.repo.getOrderDetails(c, id, programId)
    if (!orderDetail) {
      throw new ValidationError("Order Detail not found")
    }

    const list = await this.repo.getReport(
      c,
      id,
      TRANSACTION_TYPE.ISSUES,
      orderDetail.order_type_id === ORDER_TYPE.CENTRAL_DISTRIBUTION ||
        orderDetail.order_type_id === ORDER_TYPE.RETURN ||
        orderDetail.order_type_id === ORDER_TYPE.DISTRIBUTION
        ? [KFA_LEVEL_ID.VARIANT]
        : [KFA_LEVEL_ID.VARIANT, KFA_LEVEL_ID.TEMPLATE],
      orderDetail.customer_id,
      programId
    )
    const finalList = list.filter((item) =>
      item.parent_material_id
        ? list.some((i) => i.material_id === item.parent_material_id)
        : !list.some((i) => i.parent_material_id === item.material_id)
    )

    // Create Excel File
    const excelTemplate = new OrderRequestLetterTemplate()

    await excelTemplate.loadFile(c)
    excelTemplate.setTitle(
      `${c.var.t("order.label.requirement_letter_title")} ${orderDetail.customer_name ?? ""}`
    )
    excelTemplate.setTimezone(c.req.header("Timezone"))

    // HEADER
    await excelTemplate.addRows(
      c.var.t("order.label.requirement_letter"),
      [[id], [user?.program_name], [orderDetail.activity_name]],
      6,
      "B"
    )

    await excelTemplate.addRows(
      c.var.t("order.label.requirement_letter"),
      [
        [orderDetail.vendor_name ?? "-"],
        [orderDetail.vendor_regency_name ?? "-"],
        [orderDetail.vendor_province_name ?? "-"],
      ],
      10,
      "B"
    )

    await excelTemplate.addRows(
      c.var.t("order.label.requirement_letter"),
      [
        [orderDetail.customer_name ?? "-"],
        [orderDetail.customer_regency_name ?? "-"],
        [orderDetail.customer_province_name ?? "-"],
      ],
      10,
      "H"
    )

    await excelTemplate.addRows(
      c.var.t("order.label.requirement_letter"),
      [
        [
          c.var.t("order.label.requirement_letter_subtitle", {
            field1: orderDetail.activity_name ?? "",
          }),
        ],
      ],
      14,
      "A"
    )

    let count = 1
    const rows: (string | number | null)[][] = []
    finalList.forEach((item) => {
      const row: (string | number | null)[] = [
        count,
        item.material_name,
        item.unit_of_distribution,
        "",
        item.total_available_qty,
        item.min ?? 0,
        item.max ?? 0,
        item.recommended_stock,
        item.ordered_qty,
      ]

      if (
        orderDetail.order_status_id === ORDER_STATUS.CONFIRMED ||
        orderDetail.order_status_id === ORDER_STATUS.PENDING
      ) {
        rows.push(row)
        count++
      } else {
        if (item.stock_id) {
          if (item.qty !== null && item.confirmed_qty !== null) {
            rows.push(row)
            count++
          }
        }
      }
    })

    // BODY
    await excelTemplate.addRows(
      c.var.t("order.label.requirement_letter"),
      rows,
      17,
      "A",
      {
        border: true,
      }
    )

    // FOOTER
    const timezone = c.req.header("Timezone") || "UTC"
    await excelTemplate.addRows(
      c.var.t("order.label.requirement_letter"),
      [
        [
          "",
          c.var.t("order.label.nota_created_by"),
          "",
          "",
          "",
          c.var.t("order.label.nota_knowing_by"),
        ],
        [""],
        [""],
        [""],
        ["", "________________", "", "", "", "_______________"],
        [
          "",
          "",
          c.var.t("order.label.date"),
          orderDetail.created_at_order
            ? momentTZ(orderDetail.created_at_order)
                .tz(timezone)
                .format("YYYY-MM-DD HH:mm:ss")
            : "",
          "",
          "",
          c.var.t("order.label.date"),
        ],
      ],
      19 + rows.length,
      "A"
    )

    return excelTemplate.generate()
  }

  protected async buildOrderDetails(c: Context, id: number) {
    const orderDetail = await this.repo.getOrderDetails(c, id, c.var.programId)
    if (!orderDetail) {
      throw new ValidationError("Order Detail not found")
    }

    const { templates, variants } = await this.repo.getOrderItems(c, id)

    const templateStocks = await this.stockRepo.findAll(c, {
      entity_id: orderDetail.customer_id,
      material_id: templates.map((template) => template.material_id),
      material_level_id: KFA_LEVEL_ID.TEMPLATE,
      page: 1,
      paginate: templates.length,
      activity_id: orderDetail.activity_id,
      offset: 0,
    })
    const variantStocks = await this.stockRepo.findAll(c, {
      entity_id: orderDetail.customer_id,
      material_id: variants.map((variant) => variant.material_id),
      material_level_id: KFA_LEVEL_ID.VARIANT,
      page: 1,
      paginate: variants.length,
      activity_id: orderDetail.activity_id,
      offset: 0,
    })

    const list = merge(
      templates.map((template) => {
        const stock = templateStocks.data.find(
          (stock) => Number(stock.material_id) === template.material_id
        )

        return {
          ...template,
          total_available_qty: stock?.total_available_qty,
        }
      }),
      variants.map((variant) => {
        const stock = variantStocks.data.find(
          (stock) => Number(stock.material_id) === variant.material_id
        )

        return {
          ...variant,
          total_available_qty: stock?.total_available_qty,
        }
      })
    )

    return { orderDetail, list }
  }

  protected async setItemStockData(
    c: Context,
    orderDetail,
    orderStockItems,
    orderItemStockByType,
    materialLevelId: number,
    orderHistoriesStatusIds: number[]
  ) {
    const groupedOrderItems = orderItemStockByType
      ? orderItemStockByType.reduce((acc, curr) => {
          if (!acc[curr.material_id] || curr.id < acc[curr.material_id].id) {
            acc[curr.material_id] = curr
          }
          return acc
        }, {})
      : []

    const orderItems: any = Object.values(groupedOrderItems)

    if (orderItems.length === 0) return orderItems

    const materialIdList = orderItems.map((orderItem) => orderItem.material_id)

    const [
      stockCustomers,
      stockVendors,
      customerEntityMaterialActivities,
      vendorEntityMaterialActivities,
      wsPurchases,
      stockActivityVendor,
    ] = await Promise.all([
      this.repo.getStockCustomerVendorByWsMaterialIds(
        c,
        orderDetail.customer_id,
        c.get("programId"),
        materialIdList,
        materialLevelId
      ),
      this.repo.getStockCustomerVendorByWsMaterialIds(
        c,
        orderDetail.vendor_id,
        c.get("programId"),
        materialIdList,
        materialLevelId
      ),
      this.repo.getEntityMaterialActivitiesByStocksData(
        c,
        orderDetail.customer_id,
        orderDetail.activity_id,
        materialIdList
      ),
      this.repo.getEntityMaterialActivitiesByStocksData(
        c,
        orderDetail.vendor_id,
        orderDetail.activity_id,
        materialIdList
      ),
      this.repo.getWsPurchaseByOrderId(
        c,
        orderDetail.id,
        TRANSACTION_TYPE.ISSUES
      ),
      this.repo.getStockCustomerVendorByWsMaterialIds(
        c,
        orderDetail.vendor_id,
        c.get("programId"),
        materialIdList,
        materialLevelId,
        orderDetail.activity_id
      ),
    ])

    const newStockCustomers = this.setMinMax(
      customerEntityMaterialActivities,
      stockCustomers
    )
    const newStockVendors = this.setMinMax(
      vendorEntityMaterialActivities,
      stockVendors
    )

    const updatedStockCustomers = newStockCustomers

    const valUpdatedStockCustomers = (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      updatedStockCustomers: any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      materialIdList: any
    ) => {
      return updatedStockCustomers.length < materialIdList.length
        ? materialIdList.filter(
            (materialId) =>
              !updatedStockCustomers
                .map((updatedStockCustomer) => updatedStockCustomer.material_id)
                .includes(materialId)
          )
        : []
    }

    const customerMaterialIdList: number[] =
      updatedStockCustomers.length === 0
        ? materialIdList
        : valUpdatedStockCustomers(updatedStockCustomers, materialIdList)

    if (customerMaterialIdList.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const emptyStockCustomers: any[] = customerMaterialIdList.map(
        (customerMaterialId) => {
          return {
            program_id: c.get("programId"),
            entity_id: orderDetail.customer_id,
            total_qty: 0,
            total_in_transit_qty: 0,
            total_allocated_qty: 0,
            total_open_vial_qty: 0,
            total_exterminated_qty: 0,
            total_available_qty: 0,
            total_unreceived_qty: 0,
            material_id: customerMaterialId,
            price: 0,
            min: 0,
            max: 0,
            updated_at: null,
          }
        }
      )
      updatedStockCustomers.push(...emptyStockCustomers)
    }

    const orderItemList = orderItems
      .map((orderItem) => ({
        id: orderItem.id,
        order_id: orderItem.order_id,
        recommended_stock: orderItem.recommended_stock,
        qty: orderItem.qty,
        validated_qty: orderItem.validated_qty ?? 0,
        ordered_qty: orderItem.ordered_qty ?? 0,
        confirmed_qty: orderItem.confirmed_qty ?? 0,
        other_reason: orderItem.other_reason,
        created_at: orderItem.created_at,
        reason: !orderItem.reason_id
          ? null
          : {
              id: orderItem.reason_id,
              name: c.var.t(`order_reason.label.${orderItem.reason_name}`),
            },
        material: !orderItem.material_id
          ? null
          : {
              id: orderItem.material_id,
              name: orderItem.material_name,
              code: orderItem.material_code,
              type: orderItem.material_type,
              kfa_level_id: orderItem.kfa_level_id,
              kfa_level_name: orderItem.kfa_level_name,
              unit_of_consumption: orderItem.unit_of_consumption,
              unit_of_distribution: orderItem.unit_of_distribution,
              consumption_unit_per_distribution_unit:
                orderItem.consumption_unit_per_distribution_unit,
              is_managed_in_batch: orderItem.is_managed_in_batch,
              is_temperature_sensitive: orderItem.is_temperature_sensitive,
              material_level_id: orderItem.material_level_id,
              parent_id: orderItem.parent_id,
              parent_name: orderItem.parent_material_name,
              parent_code: orderItem.parent_material_code,
            },
      }))
      .sort((a, b) => {
        if (!a.material?.name) return 1
        if (!b.material?.name) return -1
        return a.material.name.localeCompare(b.material.name)
      })

    const orderItemStockList = orderItemList.map((orderItem) => {
      const relatedStocks = orderStockItems.filter(
        (stock) =>
          stock.stock_id &&
          stock.stock_id !== 0 &&
          stock.order_id === orderItem.order_id &&
          stock.material_id === orderItem.material.id
      )

      const stocksWithOrderStockId =
        !relatedStocks || relatedStocks.length === 0
          ? []
          : relatedStocks.map((stock) => {
              const purchase = wsPurchases?.find(
                (p) => p.stock_id === stock.stock_id
              )
              const vendor = stockVendors?.find(
                (v) => v.stock_id === stock.stock_id
              )

              return {
                id: stock.id,
                stock_id: stock.stock_id,
                activity_id: stock.activity_id,
                activity_name: stock.activity_name,
                price: purchase?.price ?? vendor?.price ?? 0,
                total_price:
                  stock.allocated_qty > 0
                    ? purchase
                      ? purchase.total_price
                      : vendor?.price * stock.allocated_qty
                    : 0,
                status:
                  stock.order_stock_status_id &&
                  stock.order_stock_status_id !== 0
                    ? stock.order_stock_status_id
                    : null,
                fulfill_status:
                  stock.fulfill_stock_status_id &&
                  stock.fulfill_stock_status_id !== 0
                    ? stock.fulfill_stock_status_id
                    : null,
                allocated_qty: stock.allocated_qty ?? 0,
                shipped_qty:
                  orderHistoriesStatusIds.includes(ORDER_STATUS.SHIPPED) &&
                  !orderHistoriesStatusIds.includes(ORDER_STATUS.CANCELED)
                    ? stock.allocated_qty
                    : 0,
                received_qty: stock.received_qty ?? 0,
                batch_id: stock.batch_id,
                batch:
                  !stock.batch_id || stock.batch_id === 0
                    ? null
                    : {
                        id: stock.batch_id,
                        code: stock.code,
                        expired_date: stock.expired_date,
                        production_date: stock.production_date,
                        manufacture_id: stock.manufacture_id,
                        manufacture_name: stock.manufacture_name,
                        pieces_purchase_id: stock.unit_of_distribution_id,
                        pieces_purchase_name: stock.unit_of_distribution_name,
                        price: stock.price,
                        total_price: stock.price * stock.qty,
                        source_material_id: stock.budget_source_id,
                        source_material_name: stock.budget_source_name,
                        year: stock.year,
                      },
              }
            })

      const relatedStockCustomer = this.SumStocksByMaterialId(
        updatedStockCustomers,
        orderItem.material.id
      )

      const stockCustomer =
        !relatedStockCustomer ||
        (relatedStockCustomer && relatedStockCustomer.length === 0)
          ? null
          : relatedStockCustomer[0]

      const relatedStockVendor = this.SumStocksByMaterialId(
        newStockVendors,
        orderItem.material.id
      )

      const relatedStockVendorByActivity = this.SumStocksByMaterialIdByActivity(
        newStockVendors,
        orderItem.material.id
      )

      const stockVendor =
        !relatedStockVendor ||
        (relatedStockVendor && relatedStockVendor.length === 0)
          ? null
          : relatedStockVendor[0]

      let stockVendorWithActivityQty = stockVendor

      if (stockVendor) {
        const stockVendorByActivity = (relatedStockVendorByActivity ?? []).find(
          (item) => item.activity_id === orderDetail.activity_id
        )

        stockVendorWithActivityQty = {
          ...stockVendor,
          total_available_qty_activity:
            stockVendorByActivity &&
            stockVendorByActivity.total_available_qty !== undefined
              ? stockVendorByActivity.total_available_qty
              : null,
        }
      }

      return {
        ...orderItem,
        order_stocks: stocksWithOrderStockId,
        stock_customer: stockCustomer,
        stock_vendor: stockVendorWithActivityQty,
      }
    })

    return orderItemStockList
  }

  protected SumStocksByMaterialId(stocks, materialId: number) {
    if (stocks.length === 0) return []

    return stocks
      .filter((entry) => entry.material_id === materialId)
      .reduce((acc, current) => {
        const existing = acc.find(
          (item) =>
            item.material_id === current.material_id &&
            item.entity_id === current.entity_id
        )

        if (existing) {
          existing.total_qty += current.total_qty
          existing.total_in_transit_qty += current.total_in_transit_qty
          existing.total_allocated_qty += current.total_allocated_qty
          existing.total_available_qty += current.total_available_qty
          existing.total_unreceived_qty += current.total_unreceived_qty
        } else {
          const { price, stock_id, ...rest } = current
          acc.push({
            ...rest,
          })
        }

        return acc
      }, [])
  }

  protected SumStocksByMaterialIdByActivity(stocks, materialId: number) {
    if (stocks.length === 0) return []

    return stocks
      .filter((entry) => entry.material_id === materialId)
      .reduce((acc, current) => {
        const existing = acc.find(
          (item) =>
            item.material_id === current.material_id &&
            item.entity_id === current.entity_id &&
            item.activity_id === current.activity_id
        )

        if (existing) {
          existing.total_qty += current.total_qty
          existing.total_in_transit_qty += current.total_in_transit_qty
          existing.total_allocated_qty += current.total_allocated_qty
          existing.total_available_qty += current.total_available_qty
          existing.total_unreceived_qty += current.total_unreceived_qty
        } else {
          const { price, stock_id, ...rest } = current
          acc.push({
            ...rest,
          })
        }

        return acc
      }, [])
  }

  protected setOrderItems(hierarchy, nonHierarchy) {
    if (hierarchy && hierarchy.length === 0) {
      return nonHierarchy
    }

    for (const h of hierarchy) {
      const children = []
      for (const nh of nonHierarchy) {
        if (nh.material.parent_id === h.material.id) {
          children.push(nh)
        }
      }
      h["children"] = children
    }
    return hierarchy
  }

  protected setMinMax(entityMaterialActivities, stocks) {
    const dataMapEntityMaterial = entityMaterialActivities.reduce(
      (acc, item) => {
        acc[item.material_id] = {
          min: item.min,
          max: item.max,
        }
        return acc
      },
      {}
    )

    const newStocks = stocks.map((item) => ({
      ...item,
      ...(dataMapEntityMaterial[item!.material_id!] || {}),
    }))

    return newStocks
  }

  protected async setOrderCancelReason(
    c: Context,
    orderCancelReasonId: number | null
  ) {
    let mapOrderCancelReasons: any = null

    if (orderCancelReasonId) {
      mapOrderCancelReasons = await this.repo.getOrderCancelReasonById(
        c,
        Number(orderCancelReasonId)
      )
    }

    const newMapOrderCancelReasons = mapOrderCancelReasons
      ? {
          ...mapOrderCancelReasons,
          name: c.var.t(
            `order_cancel_reason.label.${mapOrderCancelReasons.name}`
          ),
        }
      : null
    return newMapOrderCancelReasons
  }

  protected enrichOrderItemsWithAllocation(
    orderItems,
    orderHistoriesStatusIds
  ) {
    return orderItems.map((orderItem) => {
      const orderItemAllocatedQty = (orderItem.order_stocks || []).reduce(
        (sum, stock) => sum + (stock.allocated_qty ?? 0),
        0
      )

      const processedChildren = (orderItem.children || []).map((child) => {
        const childAllocatedQty = (child.order_stocks || []).reduce(
          (sum, stock) => sum + (stock.allocated_qty ?? 0),
          0
        )

        return {
          ...child,
          allocated_qty: childAllocatedQty,
          shipped_qty:
            orderHistoriesStatusIds.includes(ORDER_STATUS.SHIPPED) &&
            !orderHistoriesStatusIds.includes(ORDER_STATUS.CANCELED)
              ? childAllocatedQty
              : 0,
          fulfilled_qty: orderHistoriesStatusIds.includes(
            ORDER_STATUS.FULFILLED
          )
            ? childAllocatedQty
            : 0,
        }
      })

      const childrenAllocatedQty = processedChildren.reduce(
        (sum, child) => sum + (child.allocated_qty ?? 0),
        0
      )

      const totalAllocatedQty = orderItemAllocatedQty + childrenAllocatedQty

      const enrichedItem = {
        ...orderItem,
        allocated_qty: totalAllocatedQty,
        shipped_qty:
          orderHistoriesStatusIds.includes(ORDER_STATUS.SHIPPED) &&
          !orderHistoriesStatusIds.includes(ORDER_STATUS.CANCELED)
            ? totalAllocatedQty
            : 0,
        fulfilled_qty: orderHistoriesStatusIds.includes(ORDER_STATUS.FULFILLED)
          ? totalAllocatedQty
          : 0,
      }

      if (processedChildren.length > 0) {
        enrichedItem.children = processedChildren
      }

      return enrichedItem
    })
  }

  public getIntegrationLogs = async (
    c: Context,
    orderId: number,
    page: number,
    paginate: number
  ) => {
    const { data, total } = await this.repo.getIntegrationLogsByOrderId(
      c,
      orderId,
      page,
      paginate
    )
    return new PaginatedResponse({ page, paginate }, data, total)
  }

  public retryIntegrationLogs = async (c: Context, id: number) => {
    const programId = c.var.programId
    const result = await this.repo.getIntegrationLogFlowOut(c, id, programId)
    if (!result) {
      throw new ValidationError("Data not found")
    }

    this.publisher.processRetryIntegrationLog(c, result)

    return "Success"
  }

  private formatPrice(price: number): number {
    return price % 1 === 0 ? price : parseFloat(price.toFixed(2))
  }
}
