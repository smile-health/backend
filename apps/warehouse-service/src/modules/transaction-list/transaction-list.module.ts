import { Context } from "hono"
import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { TransactionListPaginatedRequestDTO } from "./transaction-list.schema.js"
import { TransactionListRepository } from "./transaction-list.repository.js"

export class TransactionListModule {
  constructor(private readonly repository: TransactionListRepository) {}

  private setPaginationAndLanguage(c: Context, params: any) {
    // Set default pagination if not provided
    if (!params.page) params.page = 1
    if (!params.limit) params.limit = 10

    params.paginate = params.limit
    params.offset = (params.page - 1) * params.limit
    params.isPaginate = true
    params.programId = c.var.programId
    params.language = c.var.language
    params.timezone = c.req.header("Timezone")
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
      is_open_vial: item.entity_is_open_vial,
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
      title: c.var.t
        ? c.var.t(`transaction.type.${item.transaction_type_id}`)
        : `Type ${item.transaction_type_id}`,
      change_type: item.transaction_change_type,
    })

    const createTransactionReasonObject = (item) => ({
      id: item.transaction_reason_id,
      title: item.transaction_reason_title
        ? c.var.t
          ? c.var.t(`transaction.reason.${item.transaction_reason_title}`)
          : item.transaction_reason_title
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
          identity_number: p.patient_identity_number, // Note: removed decryption for warehouse service
          phone_number: p.patient_phone_number,
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
        change_qty_open_vial: item.change_qty_open_vial,
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
}
