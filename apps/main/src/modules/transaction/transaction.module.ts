import { DEVICE_TYPE } from "@/common/constants/device.js"
import {
  TRANSACTION_CHANGE_TYPE,
  TRANSACTION_TYPE,
} from "@/common/constants/transaction.js"
import { BadRequestError } from "@smile-health/lib/error.js"
import { TOPIC } from "@smile-health/lib/rabbitmq/topic.js"
import { PaginatedResponse } from "@smile-health/lib/types/paginate.js"
import {
  associate,
  flattenToNestedObject,
  getDefaultNumber,
} from "@smile-health/lib/utils.js"
import { Context } from "hono"
import { BaseModule } from "../base.module.js"
import { BatchRepository } from "../batch/batch.repository.js"
import ExportHistoryRepository from "../export-history/export-history.repository.js"
import { ManufactureRepository } from "../manufacture/manufacture.repository.js"
import { NotificationPublisher } from "../notification/notification.publisher.js"
import { NotificationRepository } from "../notification/notification.repository.js"
import { StockQualityRepository } from "../stock-quality/stock-quality.repository.js"
import { StockRepository } from "../stock/stock.repository.js"
import { DisposalService } from "./services/disposal.service.js"
import { TransactionPublisher } from "./transaction.publisher.js"
import { TransactionRepository } from "./transaction.repository.js"
import {
  BatchRequest,
  CancelaionDiscardRequest,
  ConsumptionRequest,
  DiscardDTO,
  GetTransactionListConsumptionQueries,
  ListPatientDetailConsumption,
  ListPatientsDTO,
  MaterialRequest,
  PublishTrxDTO,
  SubmitReturnOfHealthFacilitiesRequest,
  TransactionListCursorPaginatedRequestDTO,
  TransactionListDiscardRequestDTO,
  TransactionListPaginatedRequestDTO,
  TransactionReasonPaginatedRequestDTO,
  TransactionRequest,
  TransactionTypePaginatedRequestDTO,
  TrxReturnedQty,
  TrxSubmitReturnOfHealth,
} from "./transaction.schema.js"
import { doDecrypt } from "./utils/transaction.encryption.js"
import { ColdstoragePublisher } from "../coldstorage/coldstorage.publisher.js"

export class TransactionModule extends BaseModule {
  constructor(
    private readonly repository: TransactionRepository,
    private readonly stockRepo: StockRepository,
    private readonly batchRepo: BatchRepository,
    private readonly manufactureRepo: ManufactureRepository,
    private readonly stockQualityRepo: StockQualityRepository,
    protected readonly publisher: TransactionPublisher,
    private readonly disposalService: DisposalService,
    protected readonly exportHistoryRepo: ExportHistoryRepository,
    private readonly notificationRepo: NotificationRepository,
    private readonly notificationPublisher: NotificationPublisher,
    private readonly coldstoragePublisher: ColdstoragePublisher
  ) {
    super(exportHistoryRepo, publisher)
  }

  readonly #createBatch = async (
    c: Context,
    batch: BatchRequest,
    materialId: number,
    batchId: number | undefined
  ) => {
    if (batchId) {
      await this.batchRepo.update(
        c,
        {
          code: batch.code ?? null,
          expired_date: batch.expired_date ?? null,
          production_date: batch.production_date ?? null,
          status: 1,
          updated_at: new Date(),
          deleted_at: null,
        },
        {
          id: batchId,
        }
      )
      return batchId
    }
    const batchData = await this.batchRepo.create(c, {
      code: batch.code ?? null,
      material_id: materialId,
      manufacture_id: batch.manufacture_id ?? null,
      expired_date: batch.expired_date ?? null,
      production_date: batch.production_date ?? null,
      status: 1,
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null,
    })
    return Number(batchData.insertId)
  }

  readonly #createPurchase = async (
    c: Context,
    material: MaterialRequest,
    transactionId: number,
    stockQty: number
  ) => {
    const { userId } = c.var
    const price = material.price ?? 0
    if (material.budget_source_id) {
      // create purchase
      await this.repository.createPurchase(c, {
        source_id: transactionId,
        source_type: "transaction",
        budget_source_id: material.budget_source_id ?? null,
        price: price,
        total_price: price * material.qty,
        year: material.year!,
        created_at: new Date(),
        created_by: userId!,
        updated_at: new Date(),
        updated_by: userId!,
        deleted_at: null,
        deleted_by: null,
      })
      // update stock price
      await this.stockRepo.update(
        c,
        {
          budget_source_id: material.budget_source_id ?? null,
          price: price,
          total_price: price * stockQty,
          year: material.year!,
        },
        {
          id: material.stock_id!,
        }
      )
    }
  }

  readonly #createTransactioOtherReason = async (
    c: Context,
    material: MaterialRequest,
    transactionId: number
  ) => {
    if (material.is_other) {
      await this.repository.createTransactionOtherReason(c, {
        source_id: transactionId,
        source_type: "transaction",
        content: material.other_reason!,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      })
    }
  }

  readonly #setNegative = (value: number) => value * -1

  readonly #getChangeQty = (
    transactionType: number,
    changeQty: number,
    currentQty: number = 0
  ) => {
    const changeVal =
      transactionType === TRANSACTION_CHANGE_TYPE.REMOVE
        ? this.#setNegative(changeQty)
        : changeQty
    const newVal =
      transactionType === TRANSACTION_CHANGE_TYPE.RESTOCK
        ? changeQty
        : currentQty + changeVal
    return {
      changeQty: changeVal,
      newQty: newVal,
    }
  }

  readonly #updateReturnedQtyTrx = async (
    c: Context,
    item: TrxSubmitReturnOfHealth,
    listTrx: TrxReturnedQty[],
    returnedQty: number,
    returnedQtyOpenVial: number
  ) => {
    const { transaction_id } = item
    const data = listTrx.find((val) => val.id === transaction_id)
    if (data) {
      const maxReturn =
        Math.abs(data.change_qty) -
        (data.returned_qty + data.qty_in_vial + returnedQty + item.openVialQty)
      const isReturnable = maxReturn > 0 ? 1 : 0

      await this.repository.updateReturnedQtyTrx(
        c,
        transaction_id,
        returnedQty,
        returnedQtyOpenVial,
        item.openVialQty,
        isReturnable
      )
    }
  }

  readonly #updateTrxRabies = async (
    c: Context,
    trxID: number,
    transaction_return_id: number
  ) => {
    await this.repository.updateTrxConsumption(c, trxID, transaction_return_id)
  }

  readonly #upsertDisposalStock = async (
    c: Context,
    stockID: number,
    discardQty: number,
    trxReasonID: number | undefined
  ) => {
    const disposalStock = await this.repository.getDisposalStockByStockId(
      c,
      stockID,
      trxReasonID
    )
    if (disposalStock) {
      await this.repository.updateDisposalStock(c, stockID, trxReasonID, {
        disposal_discard_qty:
          (disposalStock?.disposal_discard_qty || 0) + discardQty,
      })
    } else {
      await this.repository.createDisposalStock(c, {
        stock_id: stockID,
        transaction_reason_id: trxReasonID,
        disposal_discard_qty: discardQty,
        disposal_received_qty: 0,
        disposal_qty: 0,
        disposal_shipped_qty: 0,
      })
    }
  }

  async addStock(c: Context, body: TransactionRequest) {
    try {
      const deviceType = c.req.header("device-type")
      const { entity_id, activity_id, entity_activity_id, materials } = body
      const { userId, programId } = c.var
      const transactionType = await this.repository.findWsTransactionTypeById(
        c,
        TRANSACTION_TYPE.ADD_STOCK
      )
      const publishMessages: PublishTrxDTO[] = []

      // process create transaction add stock
      for (const material of materials) {
        let batchId: number = 0
        // create stock and batch if not exist
        if (material.batch && material.is_managed_in_batch) {
          batchId = await this.#createBatch(
            c,
            material.batch,
            material.material_id,
            material.batch_id
          )
          material.stock_id = await this.stockRepo.createStock(c, {
            batch_id: batchId,
            created_at: new Date(),
            created_by: userId!,
            updated_at: new Date(),
            updated_by: userId!,
            material_id: material.material_id,
            activity_id: activity_id,
            entity_id: entity_id,
            stock_quality_id: material.stock_quality_id ?? null,
            parent_material_id: material.parent_material_id ?? null,
            batch_code: material.batch?.code ?? null,
            manufacture_id: material.batch?.manufacture_id ?? null,
          })
        } else if (!material.stock_id && !material.is_managed_in_batch) {
          material.stock_id = await this.stockRepo.createStock(c, {
            batch_id: null,
            qty: 0,
            created_at: new Date(),
            created_by: userId!,
            updated_at: new Date(),
            updated_by: userId!,
            material_id: material.material_id,
            activity_id: activity_id,
            entity_id: entity_id,
            stock_quality_id: material.stock_quality_id ?? null,
            parent_material_id: material.parent_material_id ?? null,
          })
        }
        const stock = await this.repository.findWsStockByIds(
          c,
          [material.stock_id!],
          programId
        )
        // get batch
        const batch = await this.batchRepo.findOne(c, {
          id: stock[0]?.batch_id ?? 0,
        })
        // get qty
        const qty = this.#getChangeQty(
          Number(transactionType?.change_type),
          material.qty!,
          stock[0]?.qty ?? 0
        )

        // Capture old stock value before update for notification
        const parentMaterialId =
          await this.notificationRepo.getParentMaterialId(
            c,
            entity_id,
            material.material_id,
            activity_id
          )
        const oldStockValue = parentMaterialId
          ? await this.notificationRepo.getCurrentStock(
              c,
              entity_id,
              parentMaterialId
              // activity_id
            )
          : 0
        material.oldStockValue = Number(oldStockValue)

        const [transactionData] = await Promise.all([
          this.repository.create(c, {
            activity_id: activity_id,
            entity_id: entity_id,
            stock_id: material.stock_id,
            transaction_reason_id: material.transaction_reason_id,
            transaction_type_id: transactionType?.id ?? null,
            order_id: null,

            change_qty: qty.changeQty,
            opening_qty: stock[0]?.qty ?? 0,

            created_at: new Date(),
            created_by: userId!,
            updated_at: new Date(),
            updated_by: userId!,
            deleted_at: null,
            deleted_by: null,

            actual_transaction_date: null,
            commit_datetime: null,
            device_type: deviceType ? DEVICE_TYPE[deviceType] : null,

            entity_activity_id: entity_activity_id,
            companion_entity_id: null,
            batch_code: batch?.code ?? null,
            status: 1,
            transaction_companion: null,
          }),
          this.stockRepo.update(
            c,
            {
              qty: qty.newQty,
              ...(material.stock_quality_id
                ? { stock_quality_id: material.stock_quality_id }
                : {}),
            },
            {
              id: material.stock_id!,
            }
          ),
        ])
        const transactionId = Number(transactionData.insertId)
        await this.#createPurchase(c, material, transactionId, qty.newQty)
        await this.#createTransactioOtherReason(c, material, transactionId)

        publishMessages.push({ id: transactionId })
      }

      await this.publisher.processCreate(c, publishMessages)

      const material_ids: number[] = []
      // Trigger stock back to normal notifications
      for (const material of materials) {
        material_ids.push(material.material_id!)
        await this.notificationPublisher.publishStockBackToNormalCheck(
          c,
          entity_id,
          material.material_id!,
          activity_id,
          Number(material.oldStockValue)
        )
      }

      // Trigger update of coldstorage
      await this.coldstoragePublisher.processCreate(c, {
        entity_id: entity_id,
        program_id: c.var.programId,
        material_ids: material_ids,
        is_immunization: c.var.config?.is_immunization ?? false,
        user_id: Number(userId),
      })

      return true
    } catch (error) {
      // Cek apakah error berasal dari duplicate entry MySQL
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "ER_DUP_ENTRY"
      ) {
        throw new BadRequestError(c.var.t("common.duplicate"))
      }
      throw error
    }
  }

  async removeStock(c: Context, body: TransactionRequest) {
    const deviceType = c.req.header("device-type")
    const { entity_id, activity_id, entity_activity_id, materials } = body
    const { userId, programId } = c.var
    const transactionType = await this.repository.findWsTransactionTypeById(
      c,
      TRANSACTION_TYPE.REMOVE_STOCK
    )
    const publishMessages: PublishTrxDTO[] = []

    const material_ids: number[] = []
    // process create transaction add stock
    for (const material of materials) {
      material_ids.push(material.material_id!)
      // get stock
      const stock = await this.repository.findWsStockByIds(
        c,
        [material.stock_id!],
        programId
      )
      // get batch
      const batch = await this.batchRepo.findOne(c, {
        id: stock[0]?.batch_id ?? 0,
      })
      // get qty
      const qty = this.#getChangeQty(
        Number(transactionType?.change_type),
        material.qty,
        stock[0]?.qty ?? 0
      )

      const [transactionId] = await Promise.all([
        this.repository.create(c, {
          activity_id: activity_id,
          entity_id: entity_id,
          stock_id: material.stock_id,
          transaction_reason_id: material.transaction_reason_id,
          transaction_type_id: transactionType?.id ?? null,
          order_id: null,

          change_qty: qty.changeQty,
          opening_qty: stock[0]?.qty ?? 0,

          created_at: new Date(),
          created_by: userId!,
          updated_at: new Date(),
          updated_by: userId!,
          deleted_at: null,
          deleted_by: null,

          actual_transaction_date: null,
          commit_datetime: null,
          device_type: deviceType ? DEVICE_TYPE[deviceType] : null,

          entity_activity_id: entity_activity_id,
          companion_entity_id: null,
          batch_code: batch?.code ?? null,
          status: 1,
          transaction_companion: null,
        }),
        this.stockRepo.update(
          c,
          {
            qty: qty.newQty,
            ...(material.stock_quality_id
              ? { stock_quality_id: material.stock_quality_id }
              : {}),
          },
          {
            id: material.stock_id!,
          }
        ),
      ])
      await this.#createTransactioOtherReason(
        c,
        material,
        Number(transactionId.insertId)
      )
      publishMessages.push({ id: Number(transactionId.insertId) })
    }
    await this.publisher.processCreate(c, publishMessages)

    // Trigger update of coldstorage
    await this.coldstoragePublisher.processCreate(c, {
      entity_id: entity_id,
      program_id: c.var.programId,
      material_ids: material_ids,
      is_immunization: c.var.config?.is_immunization ?? false,
      user_id: Number(userId),
    })
    return true
  }

  async discardStock(c: Context, body: TransactionRequest) {
    const deviceType = c.req.header("device-type")
    const { entity_id, activity_id, entity_activity_id, materials } = body
    const { userId, programId } = c.var
    const transactionType = await this.repository.findWsTransactionTypeById(
      c,
      TRANSACTION_TYPE.DISCARDS
    )
    const publishMessages: PublishTrxDTO[] = []

    const material_ids: number[] = []
    for (const material of materials) {
      material_ids.push(material.material_id!)
      const stock = await this.repository.findWsStockByIds(
        c,
        [material.stock_id!],
        programId
      )
      // get batch
      const batch = await this.batchRepo.findOne(c, {
        id: stock[0]?.batch_id ?? 0,
      })

      const qty = this.#getChangeQty(
        Number(transactionType?.change_type),
        material.qty!,
        stock[0]?.qty ?? 0
      )

      const openVialQty = this.#getChangeQty(
        Number(transactionType?.change_type),
        material.open_vial ?? 0,
        stock[0]?.open_vial_qty ?? 0
      )

      const [transactionId] = await Promise.all([
        this.repository.create(c, {
          activity_id: activity_id,
          entity_id: entity_id,
          stock_id: material.stock_id,
          transaction_reason_id: material.transaction_reason_id,
          transaction_type_id: transactionType?.id ?? null,
          order_id: null,

          change_qty: qty.changeQty,
          opening_qty: stock[0]?.qty ?? 0,

          ...(material.is_open_vial
            ? {
                opening_qty_open_vial: stock[0]?.open_vial_qty ?? 0,
                change_qty_open_vial: openVialQty.changeQty,
              }
            : {}),

          created_at: new Date(),
          created_by: userId!,
          updated_at: new Date(),
          updated_by: userId!,
          deleted_at: null,
          deleted_by: null,

          actual_transaction_date: null,
          commit_datetime: null,
          device_type: deviceType ? DEVICE_TYPE[deviceType] : null,

          entity_activity_id: entity_activity_id,
          companion_entity_id: null,
          batch_code: batch?.code ?? null,
          status: 1,
          transaction_companion: null,
        }),

        this.stockRepo.update(
          c,
          {
            qty: qty.newQty,
            ...(material.stock_quality_id
              ? { stock_quality_id: material.stock_quality_id }
              : {}),
            ...(material.is_open_vial
              ? {
                  open_vial_qty: openVialQty.newQty,
                }
              : {}),
          },
          {
            id: material.stock_id!,
          }
        ),
      ])
      await this.#createTransactioOtherReason(
        c,
        material,
        Number(transactionId.insertId)
      )

      publishMessages.push({ id: Number(transactionId.insertId) })
    }

    // Create disposal records for the entire batch
    const disposalMaterials = materials.map((material) => ({
      stockId: material.stock_id!,
      materialId: material.material_id,
      transactionReasonId: material.transaction_reason_id,
      quantity: material.qty!,
    }))

    await this.disposalService.createDisposalFromBatch(c, {
      materials: disposalMaterials,
      entityId: entity_id,
      activityId: activity_id,
    })

    // Trigger update of coldstorage
    await this.coldstoragePublisher.processCreate(c, {
      entity_id: entity_id,
      program_id: c.var.programId,
      material_ids: material_ids,
      is_immunization: c.var.config?.is_immunization ?? false,
      user_id: Number(userId),
    })

    await this.publisher.processCreate(c, publishMessages)
    return true
  }

  async consumption(c: Context, body: ConsumptionRequest) {
    const deviceType = c.req.header("device-type")
    const { userId, programId } = c.var
    const {
      entity_id,
      activity_id,
      customer_id,
      actual_transaction_date,
      materials,
    } = body

    const transactionType = await this.repository.findWsTransactionTypeById(
      c,
      TRANSACTION_TYPE.CONSUMPTION
    )

    const entityActivity =
      await this.repository.findWsEntityActivityByEntityAndActivity(
        c,
        entity_id,
        activity_id,
        programId
      )
    const publishMessages: PublishTrxDTO[] = []

    const material_ids: number[] = []
    for (const material of materials) {
      material_ids.push(material.material_id!)
      const stock = await this.repository.findWsStockByIds(
        c,
        [material.stock_id!],
        programId
      )

      const batch = await this.batchRepo.findOne(c, {
        id: stock[0]?.batch_id ?? 0,
      })

      const qty = this.#getChangeQty(
        Number(transactionType?.change_type),
        material.qty,
        stock[0]?.qty ?? 0
      )

      const [transaction] = await Promise.all([
        this.repository.create(c, {
          activity_id: activity_id,
          entity_id: entity_id,
          stock_id: material.stock_id,
          transaction_reason_id: null,
          transaction_type_id: transactionType?.id ?? null,
          order_id: null,
          change_qty: qty.changeQty,
          opening_qty: stock[0]?.qty ?? 0,
          created_at: new Date(),
          created_by: userId!,
          updated_at: new Date(),
          updated_by: userId!,
          deleted_at: null,
          deleted_by: null,
          actual_transaction_date: actual_transaction_date,
          commit_datetime: null,
          device_type: deviceType ? DEVICE_TYPE[deviceType] : null,
          entity_activity_id: entityActivity?.id,
          companion_entity_id: customer_id,
          batch_code: batch?.code ?? null,
          status: 1,
          transaction_companion: null,
        }),

        this.stockRepo.update(
          c,
          {
            qty: qty.newQty,
          },
          {
            id: material.stock_id!,
          }
        ),

        this.repository.updateOrCreateStockConsumption(c, {
          vendor_stock_id: stock[0]?.id ?? 0,
          batch_id: batch?.id,
          qty: material.qty,
          vendor_id: entity_id,
          customer_id: customer_id,
          material_id: material.material_id,
          activity_id: activity_id,
        }),
      ])

      publishMessages.push({ id: Number(transaction.insertId) })
    }

    await this.publisher.processCreate(c, publishMessages)

    // Trigger update of coldstorage
    await this.coldstoragePublisher.processCreate(c, {
      entity_id: entity_id,
      program_id: c.var.programId,
      material_ids: material_ids,
      is_immunization: c.var.config?.is_immunization ?? false,
      user_id: Number(userId),
    })

    return true
  }

  private setPaginationAndLanguage(
    c: Context,
    params: TransactionListPaginatedRequestDTO
  ) {
    params.isPaginate = true
    params.offset = (params.page - 1) * params.paginate
    params.programId = c.var.programId
    params.language = c.var.language
    params.timezone = c.req.header("Timezone")
  }

  async getTransactionType(
    c: Context,
    params: TransactionTypePaginatedRequestDTO
  ) {
    this.setPaginationAndLanguage(c, params)

    const { data, total } = await this.repository.getTransactionType(c, params)

    if (data.length === 0) {
      return new PaginatedResponse(params)
    }

    const transformedData = data.map((item) => ({
      ...item,
      title: c.var.t(`transaction.type.${item.id}`),
    }))

    return new PaginatedResponse(params, transformedData, total)
  }

  async getTransactionReason(
    c: Context,
    params: TransactionReasonPaginatedRequestDTO
  ) {
    this.setPaginationAndLanguage(c, params)

    const { data, total } = await this.repository.getTransactionReason(
      c,
      params
    )

    if (data.length === 0) {
      return new PaginatedResponse(params)
    }

    const transformedData = data.map((item) => ({
      id: item.id,
      title: c.var.t(`transaction.reason.${item.title}`),
      is_other: item.is_other,
      is_purchase: item.is_purchase,
      transaction_type_id: item.transaction_type_id,
      transaction_type: {
        id: item.transaction_type_id,
        title: c.var.t(`transaction.type.${item.transaction_type_id}`),
      },
    }))

    return new PaginatedResponse(params, transformedData, total)
  }

  async getTransactionList(
    c: Context,
    params: TransactionListPaginatedRequestDTO
  ) {
    this.setPaginationAndLanguage(c, params)

    const { data, total } = await this.repository.getTransactionList(c, params)

    if (data.length === 0) {
      return new PaginatedResponse(params)
    }

    const createGeneralObject = (id, name) => ({
      id: id ?? null,
      name: name ?? null,
    })

    const createEntityObject = (item) => ({
      id: item.entity_id,
      name: item.entity_name,
      province: createGeneralObject(item.province_id, item.province_name),
      regency: createGeneralObject(item.regency_id, item.regency_name),
    })

    const createMaterialObject = (item) => ({
      id: item.material_id,
      name: item.material_name,
      description: item.material_description,
      is_open_vial: item.material_is_open_vial,
      managed_in_batch: item.material_is_managed_in_batch,
      material_type: {
        id: item.material_type_id ?? null,
        name: item.material_type_name ?? null,
      },
    })

    const createParentMaterialObject = (item) => ({
      id: item.parent_material_id,
      name: item.parent_material_name,
    })

    const createActivityObject = (item) => ({
      id: item.activity_id,
      name: item.activity_name,
    })

    const createTransactionTypeObject = (item) => ({
      id: item.transaction_type_id,
      title: c.var.t(`transaction.type.${item.transaction_type_id}`),
      change_type: item.transaction_change_type,
    })

    const createTransactionReasonObject = (item) => ({
      id: item.transaction_reason_id,
      title: item.transaction_reason_title
        ? c.var.t(`transaction.reason.${item.transaction_reason_title}`)
        : item.transaction_reason_title,
      is_other: item.transaction_reason_is_other,
      is_purchase: item.transaction_reason_is_purchase,
    })

    const createOrderObject = (item) => ({
      id: item.order_id,
      status: item.order_status ?? null,
      status_label: item.order_status_label ?? null,
      type: item.order_type ?? null,
      vendor: createGeneralObject(item.vendor_id, item.vendor_name),
      customer: createGeneralObject(item.customer_id, item.customer_name),
    })

    const createUserObject = (id, username, firstname, lastname) => ({
      id,
      username,
      firstname,
      lastname,
    })

    const createTransactionPurchaseObject = (item) => ({
      id: item.purchase_id,
      year: item.purchase_year,
      price: item.purchase_price,
      budget_source: createGeneralObject(
        item.budget_source_id,
        item.budget_source_name
      ),
    })

    const createStockObject = (item) => ({
      id: item.stock_id,
      open_vial: item.stock_open_vial,
      close_vial: item.stock_close_vial,
      activity: {
        id: item.stock_activity_id ?? null,
        name: item.stock_activity_name ?? null,
      },
      batch: {
        id: item.batch_id ?? null,
        code: item.batch_code ?? null,
        expired_date: item.batch_expired_date ?? null,
        production_date: item.batch_production_date ?? null,
        status: item.batch_status ?? null,
        manufacture: {
          id: item.manufacture_id ?? null,
          name: item.manufacture_name ?? null,
          address: item.manufacture_address ?? null,
        },
      },
    })

    const transformedData = data.map((item) => {
      const dataVendor = createGeneralObject(item.entity_id, item.entity_name)
      const dataCustomer = {
        id: item.companion_entity_id,
        name: item.companion_entity_name,
        is_open_vial: item?.entity_is_open_vial ?? null,
      }
      return {
        id: item.transaction_id,
        companion_program: createGeneralObject(
          item.companion_program_id,
          item.companion_program_name
        ),
        companion_activity: createGeneralObject(
          item.companion_activity_id,
          item.companion_activity_name
        ),
        entity: createEntityObject(item),
        // jika tipe transaksi penerimaan, maka entity adalah vendor, companion_entity adalah customer
        vendor:
          item.transaction_type_id === TRANSACTION_TYPE.RECEIPTS
            ? dataCustomer
            : dataVendor,
        customer:
          item.transaction_type_id === TRANSACTION_TYPE.RECEIPTS
            ? dataVendor
            : dataCustomer,
        material: createMaterialObject(item),
        parent_material: createParentMaterialObject(item),
        activity: createActivityObject(item),
        transaction_type: createTransactionTypeObject(item),
        transaction_reason: createTransactionReasonObject(item),
        other_reason: item.other_reason,
        order: createOrderObject(item),
        opening_qty: item.opening_qty,
        change_qty: item.change_qty,
        opening_qty_open_vial: item.opening_qty_open_vial,
        change_qty_open_vial: item?.change_qty_open_vial ?? 0,
        closing_qty: item.closing_qty,
        closing_qty_open_vial: item.closing_qty_open_vial,
        device_type: item.device_type,
        actual_transaction_date: item.actual_transaction_date,
        created_at: new Date(item.created_at).toISOString(),
        updated_at: new Date(item.updated_at).toISOString(),
        user_created_by: createUserObject(
          item.created_by_id,
          item.created_by_username,
          item.created_by_firstname,
          item.created_by_lastname
        ),
        user_updated_by: createUserObject(
          item.updated_by_id,
          item.updated_by_username,
          item.updated_by_firstname,
          item.updated_by_lastname
        ),
        transaction_purchase: createTransactionPurchaseObject(item),
        stock: createStockObject(item),
        patient: item.patient_data,
      }
    })

    return new PaginatedResponse(params, transformedData, total)
  }

  async getTransactionListCursor(
    c: Context,
    params: TransactionListCursorPaginatedRequestDTO
  ) {
    this.setPaginationAndLanguage(c, params)

    const { data, total } = await this.repository.getTransactionListCursor(
      c,
      params
    )

    if (data.length === 0) {
      return new PaginatedResponse(params)
    }

    const createGeneralObject = (id, name) => ({
      id: id ?? null,
      name: name ?? null,
    })

    const createEntityObject = (item) => ({
      id: item.entity_id,
      name: item.entity_name,
      province: createGeneralObject(item.province_id, item.province_name),
      regency: createGeneralObject(item.regency_id, item.regency_name),
    })

    const createMaterialObject = (item) => ({
      id: item.material_id,
      name: item.material_name,
      description: item.material_description,
      is_open_vial: item.material_is_open_vial,
      managed_in_batch: item.material_is_managed_in_batch,
      material_type: {
        id: item.material_type_id ?? null,
        name: item.material_type_name ?? null,
      },
    })

    const createParentMaterialObject = (item) => ({
      id: item.parent_material_id,
      name: item.parent_material_name,
    })

    const createActivityObject = (item) => ({
      id: item.activity_id,
      name: item.activity_name,
    })

    const createTransactionTypeObject = (item) => ({
      id: item.transaction_type_id,
      title: c.var.t(`transaction.type.${item.transaction_type_id}`),
      change_type: item.transaction_change_type,
    })

    const createTransactionReasonObject = (item) => ({
      id: item.transaction_reason_id,
      title: item.transaction_reason_title
        ? c.var.t(`transaction.reason.${item.transaction_reason_title}`)
        : item.transaction_reason_title,
      is_other: item.transaction_reason_is_other,
      is_purchase: item.transaction_reason_is_purchase,
    })

    const createOrderObject = (item) => ({
      id: item.order_id,
      status: item.order_status ?? null,
      status_label: item.order_status_label ?? null,
      type: item.order_type ?? null,
      vendor: createGeneralObject(item.vendor_id, item.vendor_name),
      customer: createGeneralObject(item.customer_id, item.customer_name),
    })

    const createUserObject = (id, username, firstname, lastname) => ({
      id,
      username,
      firstname,
      lastname,
    })

    const createTransactionPurchaseObject = (item) => ({
      id: item.purchase_id,
      year: item.purchase_year,
      price: item.purchase_price,
      budget_source: createGeneralObject(
        item.budget_source_id,
        item.budget_source_name
      ),
    })

    const createStockObject = (item) => ({
      id: item.stock_id,
      open_vial: item.stock_open_vial,
      close_vial: item.stock_close_vial,
      activity: {
        id: item.stock_activity_id ?? null,
        name: item.stock_activity_name ?? null,
      },
      batch: {
        id: item.batch_id ?? null,
        code: item.batch_code ?? null,
        expired_date: item.batch_expired_date ?? null,
        production_date: item.batch_production_date ?? null,
        status: item.batch_status ?? null,
        manufacture: {
          id: item.manufacture_id ?? null,
          name: item.manufacture_name ?? null,
          address: item.manufacture_address ?? null,
        },
      },
    })

    const transformedData = data.map((item) => {
      let patients = []

      if (item.patient_data) {
        const patientData = item.patient_data

        patients = patientData.map((p) => ({
          identity_type: p.patient_identity_type,
          identity_number: doDecrypt(p.patient_identity_number),
          phone_number: p.patient_phone_number
            ? doDecrypt(p.patient_phone_number)
            : null,
          protocol: p.consumption_protocol,
          vaccine_type: p.rabies_vaccine_type_id
            ? {
                id: p.rabies_vaccine_type_id,
                title: p.rabies_vaccine_type_title,
              }
            : null,
          vaccine_method: p.rabies_vaccine_method_id
            ? {
                id: p.rabies_vaccine_method_id,
                title: p.rabies_vaccine_method_title,
              }
            : null,
          vaccine_sequence: p.rabies_vaccine_sequence_id
            ? {
                id: p.rabies_vaccine_sequence_id,
                title: p.rabies_vaccine_sequence_title,
              }
            : null,
        }))
      } else {
        patients = []
      }

      return {
        id: item.transaction_id,
        companion_program: createGeneralObject(
          item.companion_program_id,
          item.companion_program_name
        ),
        companion_activity: createGeneralObject(
          item.companion_activity_id,
          item.companion_activity_name
        ),
        entity: createEntityObject(item),
        vendor: createGeneralObject(item.entity_id, item.entity_name),
        customer: createGeneralObject(
          item.companion_entity_id,
          item.companion_entity_name
        ),
        material: createMaterialObject(item),
        parent_material: createParentMaterialObject(item),
        activity: createActivityObject(item),
        transaction_type: createTransactionTypeObject(item),
        transaction_reason: createTransactionReasonObject(item),
        other_reason: item.other_reason,
        order: createOrderObject(item),
        opening_qty: item.opening_qty,
        change_qty: item.change_qty,
        closing_qty: item.closing_qty,
        device_type: item.device_type,
        actual_transaction_date: item.actual_transaction_date,
        created_at: new Date(item.created_at).toISOString(),
        updated_at: new Date(item.updated_at).toISOString(),
        user_created_by: createUserObject(
          item.created_by_id,
          item.created_by_username,
          item.created_by_firstname,
          item.created_by_lastname
        ),
        user_updated_by: createUserObject(
          item.updated_by_id,
          item.updated_by_username,
          item.updated_by_firstname,
          item.updated_by_lastname
        ),
        transaction_purchase: createTransactionPurchaseObject(item),
        stock: createStockObject(item),
        patients,
      }
    })

    return new PaginatedResponse(params, transformedData, total)
  }

  async exportExcel(c: Context, params: TransactionListPaginatedRequestDTO) {
    this.setPaginationAndLanguage(c, params)
    params.isPaginate = false

    return await this.handleAsyncExport(c, TOPIC.TRANSACTION_EXPORTED, {
      filename: c.var.t("transaction.export.title"),
      params,
    })
  }

  async getTransactionListDiscard(
    c: Context,
    params: TransactionListDiscardRequestDTO
  ) {
    const { programId } = c.var

    const { data, total } = await this.repository.getTransactionListDiscard(
      c,
      params,
      programId
    )

    const manufactureSet = new Set<number>()
    const stockQualitySet = new Set<number>()

    data.forEach((item) => {
      manufactureSet.add(getDefaultNumber(item["stock.batch.manufacture_id"]))
      stockQualitySet.add(getDefaultNumber(item["stock.stock_quality_id"]))
    })

    const manufactureIds =
      manufactureSet.size > 0 ? Array.from(manufactureSet) : [0]
    const stockQualityIds =
      stockQualitySet.size > 0 ? Array.from(stockQualitySet) : [0]

    const [manufactureAssociate, stockQualities] = await Promise.all([
      this.manufactureRepo.getManufactureAssociate(c, manufactureIds),
      this.stockQualityRepo.findWsStockQualityIds(c, stockQualityIds),
    ])

    const stockQualityAssociate = associate(stockQualities, "id")

    const result = data.map((item) => {
      const manufactureId = getDefaultNumber(item["stock.batch.manufacture_id"])
      const stockQualityId = getDefaultNumber(item["stock.stock_quality_id"])
      const manufactureData = manufactureAssociate[manufactureId]
      const stockQualityData = stockQualityAssociate[stockQualityId]
      return {
        ...item,
        ["transaction_type.title"]: item["transaction_type.title"]
          ? c.var.t(item["transaction_type.title"])
          : null,
        ["transaction_reason.title"]: item["transaction_reason.title"]
          ? c.var.t(item["transaction_reason.title"])
          : null,
        ...(manufactureData && {
          "stock.batch.manufacture.id": manufactureData.id,
          "stock.batch.manufacture.name": manufactureData.name,
          "stock.batch.manufacture.description": manufactureData.description,
        }),
        ...(stockQualityData && {
          "stock.stock_quality.id": stockQualityData.id,
          "stock.stock_quality.label": stockQualityData.label,
        }),
      }
    })

    return result.length
      ? new PaginatedResponse(params, flattenToNestedObject(result), total)
      : new PaginatedResponse(params)
  }

  async cancelationDiscard(c: Context, params: CancelaionDiscardRequest) {
    const { programId, deviceType, userId } = c.var
    const { entity_id, activity_id, transactions } = params
    // get transaction type
    const transactionType = await this.repository.findWsTransactionTypeById(
      c,
      TRANSACTION_TYPE.CANCEL_DISCARD
    )
    const publishMessages: PublishTrxDTO[] = []

    const material_ids: number[] = []
    for (const transaction of transactions) {
      const { stock_id, transaction_reason_id, transaction_ids } = transaction
      // get data transaction
      const transactionIds =
        transaction_ids === null
          ? []
          : transaction_ids.filter((id) => id !== null)
      const discardTrx = await this.repository.findWsTransactionByIds(
        c,
        transactionIds,
        programId
      )
      // sum change_qty discard
      const discardTrxQty = discardTrx.reduce(
        (acc, trx) => Math.abs(acc) + Math.abs(trx.change_qty ?? 0),
        0
      )
      // get data stock
      const stock = await this.repository.findWsStockByIds(
        c,
        [stock_id!],
        programId
      )
      material_ids.push(stock[0]?.material_id!)
      // get qty
      const qty = this.#getChangeQty(
        Number(transactionType?.change_type),
        discardTrxQty,
        stock[0]?.qty ?? 0
      )
      const qtyOpenVial = this.#getChangeQty(
        Number(transactionType?.change_type),
        discardTrx.reduce(
          (acc, trx) =>
            acc +
            (trx.change_qty_open_vial ? Math.abs(trx.change_qty_open_vial) : 0),
          0
        ),
        stock[0]?.open_vial_qty ?? 0
      )
      // create trx cancel discard and update qty stock
      const [transactionId] = await Promise.all([
        this.repository.create(c, {
          activity_id: activity_id,
          entity_id: entity_id,
          stock_id: stock_id,
          transaction_reason_id: transaction_reason_id,
          transaction_type_id: TRANSACTION_TYPE.CANCEL_DISCARD,
          order_id: null,

          change_qty: qty.changeQty,
          opening_qty: stock[0]?.qty ?? 0,

          created_at: new Date(),
          created_by: userId!,
          updated_at: new Date(),
          updated_by: userId!,
          deleted_at: null,
          deleted_by: null,

          actual_transaction_date: null,
          commit_datetime: null,
          device_type: deviceType ? DEVICE_TYPE[deviceType] : null,

          entity_activity_id: discardTrx[0]?.entity_activity_id ?? null,
          companion_entity_id: null,
          batch_code: discardTrx[0]?.batch_code ?? null,
          status: 1,
          transaction_companion: null,
          change_qty_open_vial: discardTrx.reduce((acc, trx) => {
            return (
              acc +
              (trx.change_qty_open_vial
                ? Math.abs(trx.change_qty_open_vial)
                : 0)
            )
          }, 0),
          opening_qty_open_vial: stock[0]?.open_vial_qty ?? 0,
        }),
      ])
      await this.stockRepo.update(
        c,
        {
          qty: qty.newQty,
          open_vial_qty: qtyOpenVial.newQty,
        },
        {
          id: transaction.stock_id!,
        }
      )
      // update transaction discard
      await this.repository.update(
        c,
        {
          status: 0,
          transaction_companion: Number(transactionId?.insertId),
        },
        {
          id: transactionIds,
        }
      )
      // update stock disposal
      for (const trxId of transactionIds) {
        await this.disposalService.updateDisposalDiscardQty(
          c,
          trxId,
          transaction.stock_id!
        )
      }

      publishMessages.push({
        id: Number(transactionId.insertId),
        transaction_ids: transactionIds,
      })
    }

    await this.publisher.processCreate(c, publishMessages)

    // Trigger update of coldstorage
    await this.coldstoragePublisher.processCreate(c, {
      entity_id: entity_id,
      program_id: c.var.programId,
      material_ids: material_ids,
      is_immunization: c.var.config?.is_immunization ?? false,
      user_id: Number(userId),
    })

    return true
  }

  async returnOfHealthFacilities(
    c: Context,
    body: SubmitReturnOfHealthFacilitiesRequest
  ) {
    const deviceType = c.req.header("device-type")
    const { userId } = c.var
    const {
      entity_id,
      activity_id,
      customer_id,
      actual_transaction_date,
      transactions,
      entity_activity_id,
      listTrx,
    } = body

    const listStockID = [...new Set(transactions.map((item) => item.stock_id))]

    const [trxTypeReturn, trxTypeDiscard, listStock] = await Promise.all([
      this.repository.findWsTransactionTypeById(c, TRANSACTION_TYPE.RETURN),
      this.repository.findWsTransactionTypeById(c, TRANSACTION_TYPE.DISCARDS),
      this.repository.getListStockBatch(c, listStockID),
    ])

    // populate material_id at listStock
    const material_ids: number[] = [
      ...new Set(
        listStock
          .filter(
            (stock): stock is typeof stock & { material_id: number } =>
              stock.material_id !== null
          )
          .map((stock) => stock.material_id)
      ),
    ]

    const publishMessages: PublishTrxDTO[] = []
    const stockMap = new Map(listStock.map((stock) => [stock.stock_id, stock]))
    for (const item of transactions) {
      const stock = stockMap.get(item.stock_id)
      const trx = listTrx.find((val) => val.id === item.transaction_id)

      const qtyReturn = item.close_vial > 0 ? item.close_vial : item.qty
      const qty = this.#getChangeQty(
        Number(trxTypeReturn?.change_type ?? 0),
        qtyReturn,
        stock?.qty
      )

      let qtyOpenVial = { changeQty: 0, newQty: 0 }
      const payloadStockQty = {
        qty: qty.newQty,
      }
      if (item.open_vial > 0) {
        qtyOpenVial = this.#getChangeQty(
          Number(trxTypeReturn?.change_type ?? 0),
          item.open_vial,
          stock?.open_vial_qty ?? 0
        )

        payloadStockQty["open_vial_qty"] = qtyOpenVial.newQty
      }

      const transactionTypeID = trxTypeReturn?.id ?? null
      const [transaction] = await Promise.all([
        this.repository.create(c, {
          activity_id,
          entity_id,
          stock_id: item.stock_id,
          transaction_reason_id: null,
          transaction_type_id: transactionTypeID,
          order_id: null,
          change_qty: qty.changeQty,
          opening_qty: stock!.qty,
          created_at: new Date(),
          created_by: userId!,
          updated_at: new Date(),
          updated_by: userId!,
          deleted_at: null,
          deleted_by: null,
          actual_transaction_date,
          commit_datetime: null,
          device_type: deviceType ? DEVICE_TYPE[deviceType] : null,
          entity_activity_id,
          companion_entity_id: customer_id,
          batch_code: stock!.batch_code,
          status: 1,
          transaction_companion: null,
          returned_qty: qty.changeQty,
          returned_qty_open_vial: qtyOpenVial.changeQty,
          opening_qty_open_vial: stock?.open_vial_qty ?? 0,
          change_qty_open_vial: qtyOpenVial.changeQty,
          qty_in_vial:
            trx && item.open_vial > 0
              ? trx.consumption_unit_per_distribution_unit
              : 0,
        }),
        this.stockRepo.update(c, payloadStockQty, {
          id: item.stock_id,
        }),
        this.#updateReturnedQtyTrx(
          c,
          item,
          listTrx,
          qty.changeQty,
          qtyOpenVial.changeQty
        ),
      ])

      await this.#updateTrxRabies(
        c,
        item.transaction_id,
        Number(transaction?.insertId)
      )

      const returnTransactionId = Number(transaction.insertId)

      await this.repository.createTrxReturnHistories(
        c,
        item.transaction_id,
        returnTransactionId,
        qty.changeQty,
        qtyOpenVial.changeQty,
        item.openVialQty
      )

      const getLastReturn = await this.repository.getLastTransaction(
        c,
        returnTransactionId
      )

      const brokenQty =
        item.broken_close_vial > 0 ? item.broken_close_vial : item.broken_qty

      // prepare variables to hold discard results if any
      let brokenQtyDiscard = { changeQty: 0, newQty: 0 }
      let brokenQtyDiscardOpenVial:
        | { changeQty: number; newQty: number }
        | undefined

      let discard: DiscardDTO | undefined
      if (brokenQty > 0 || item.broken_open_vial > 0) {
        const _brokenQtyDiscard = this.#getChangeQty(
          Number(trxTypeDiscard?.change_type ?? 0),
          brokenQty,
          qty.newQty
        )
        brokenQtyDiscard = _brokenQtyDiscard

        let _brokenQtyDiscardOpenVial = { changeQty: 0, newQty: 0 }
        const payloadStockDiscardQty = {
          qty: brokenQtyDiscard.newQty,
        }
        if (item.broken_open_vial > 0) {
          _brokenQtyDiscardOpenVial = this.#getChangeQty(
            Number(trxTypeDiscard?.change_type ?? 0),
            item.broken_open_vial,
            qtyOpenVial.newQty
          )

          payloadStockDiscardQty["open_vial_qty"] =
            _brokenQtyDiscardOpenVial.newQty
        }
        brokenQtyDiscardOpenVial = _brokenQtyDiscardOpenVial

        const [discardTrx] = await Promise.all([
          this.repository.create(c, {
            activity_id,
            entity_id,
            stock_id: item.stock_id,
            transaction_reason_id: item.transaction_reason_id,
            transaction_type_id: trxTypeDiscard?.id ?? null,
            order_id: null,
            change_qty: brokenQtyDiscard.changeQty,
            opening_qty: qty.newQty,
            created_at: new Date(),
            created_by: userId!,
            updated_at: new Date(),
            updated_by: userId!,
            deleted_at: null,
            deleted_by: null,
            actual_transaction_date,
            commit_datetime: null,
            device_type: deviceType ? DEVICE_TYPE[deviceType] : null,
            entity_activity_id,
            companion_entity_id: customer_id,
            batch_code: stock!.batch_code,
            status: 1,
            transaction_companion: null,
            opening_qty_open_vial: getLastReturn?.closing_qty_open_vial ?? 0,
            change_qty_open_vial: brokenQtyDiscardOpenVial.changeQty,
            qty_in_vial:
              trx && item.broken_open_vial > 0
                ? trx.consumption_unit_per_distribution_unit
                : 0,
          }),
          this.#upsertDisposalStock(
            c,
            item.stock_id,
            brokenQty,
            item.transaction_reason_id
          ),
          this.stockRepo.update(c, payloadStockDiscardQty, {
            id: item.stock_id,
          }),
        ])

        discard = {
          id: Number(discardTrx.insertId),
          qty: brokenQtyDiscard.changeQty,
          reason_id: item.transaction_reason_id,
        }
      }

      publishMessages.push({
        id: Number(transaction.insertId),
        discard,
      })

      stockMap.set(item.stock_id, {
        ...stock!,
        qty:
          brokenQty > 0 ? (brokenQtyDiscard?.newQty ?? qty.newQty) : qty.newQty,
        open_vial_qty:
          brokenQty > 0
            ? (brokenQtyDiscardOpenVial?.newQty ?? qtyOpenVial.newQty)
            : qtyOpenVial.newQty,
      })
    }

    await this.publisher.processCreate(c, publishMessages)

    // Trigger update of coldstorage
    await this.coldstoragePublisher.processCreate(c, {
      entity_id: entity_id,
      program_id: c.var.programId,
      material_ids: material_ids,
      is_immunization: c.var.config?.is_immunization ?? false,
      user_id: Number(userId),
    })

    return true
  }

  async listConsumption(
    c: Context,
    params: GetTransactionListConsumptionQueries,
    isReturn = false
  ) {
    const { programId } = c.var
    const { list, total } = await this.repository.getListConsumption(
      c,
      params,
      programId,
      isReturn
    )

    const listTrxID = list.map((item) => item.transaction_id)
    let listPatients: ListPatientsDTO[] = []
    if (listTrxID.length > 0) {
      listPatients = await this.repository.getListPatient(c, listTrxID)
    }

    const response = list.map((item) => {
      const params = {
        id: item.transaction_id,
        entity_id: item.entity_id,
        protocol: null,
        stock: {
          id: item.stock_id,
          qty: item.change_qty,
          batch: {
            id: item.batch_id,
            code: item.batch_code,
            expired_date: item.batch_expired_date,
            production_date: item.batch_production_date,
            manufacture_id: item.manufacture_id,
            manufacture: {
              id: item.manufacture_id,
              name: item.manufacture_name,
              description: item.manufacture_description,
            },
          },
          activity: {
            id: item.activity_id_stock,
            name: item.activity_name_stock,
          },
          stock_quality_id: item.stock_quality_id,
        },
        material: {
          id: item.material_id,
          name: item.material_name,
          description: item.material_description,
          material_type: {
            id: item.material_type_id,
            name: item.material_type_name,
          },
          material_level_id: item.material_level_id,
          is_temperature_sensitive: item.material_is_temperature_sensitive,
          is_open_vial: item.material_is_open_vial,
          is_managed_in_batch: item.material_is_managed_in_batch,
          unit_of_consumption: item.material_unit_of_consumption,
          consumption_unit_per_distribution_unit:
            item.consumption_unit_per_distribution_unit,
        },
        activity: {
          id: item.activity_id_transaction,
          name: item.activity_name_transaction,
        },
        transaction_reason: {
          id: item.transaction_reason_id,
          title: item.transaction_reason_title,
          title_en: item.transaction_reason_title_en,
          is_other: item.transaction_reason_is_other,
          is_purchase: item.transaction_reason_is_purchase,
        },
        transaction_type: {
          id: item.transaction_type_id,
          title: item.transaction_type_title,
          title_en: item.transaction_type_title_en,
          change_type: item.transaction_change_type,
        },
        order_id: item.order_id,
        change_qty: item.change_qty,
        opening_qty: item.opening_qty,
        closing_qty: item.stock_qty,
        returned_qty: item.returned_qty,
        max_return:
          Math.abs(item.change_qty!) - (item.returned_qty! + item.qty_in_vial!),
        created_at: item.created_at,
        created_by: item.created_by,
        actual_transaction_date: item.actual_transaction_date,
        stock_id: item.stock_id,
        status: item.status,
        device_type: item.device_type,
        user_created_by: {
          id: item.created_by,
          username: item.created_by_username,
          firstname: item.created_by_firstname,
          lastname: item.created_by_lastname,
        },
        user_updated_by: {
          id: item.updated_by,
          username: item.updated_by_username,
          firstname: item.updated_by_firstname,
          lastname: item.updated_by_lastname,
        },
        patients: [] as ListPatientDetailConsumption[],
      }

      return params
    })

    listPatients.forEach((item) => {
      const patient = response.find(
        (val) =>
          val.id === item.transaction_id ||
          val.id === item.return_transaction_id
      )
      if (patient) {
        patient.protocol = item.protocol_id
          ? {
              id: item.protocol_id,
              name: item.protocol_name,
              is_kipi: item.is_kipi,
              is_medical_history: item.is_medical_history,
              is_vaccine_type: !!item.vaccine_type_id,
              is_vaccine_method: !!item.vaccine_method_id,
            }
          : null
        patient.patients.push({
          identity_type: item.identity_type,
          identity_number: doDecrypt(item.identity_number),
          phone_number: item.phone_number ? doDecrypt(item.phone_number) : null,
          gender: item.gender,
          birth_date: item.birth_date ? doDecrypt(item.birth_date) : null,
          is_diagnose_before: item.is_diagnose_before,
          protocol: item.protocol_name,
          vaccine_type: item.vaccine_type_id
            ? {
                id: item.vaccine_type_id,
                title: item.vaccine_type_name,
              }
            : null,
          vaccine_method: item.vaccine_method_id
            ? {
                id: item.vaccine_method_id,
                title: item.vaccine_method_name,
              }
            : null,
          vaccine_sequence: item.vaccine_sequence_id
            ? {
                id: item.vaccine_sequence_id,
                title: item.vaccine_sequence_name,
              }
            : null,
        })
      }
    })

    return new PaginatedResponse(params, response, total)
  }
}
