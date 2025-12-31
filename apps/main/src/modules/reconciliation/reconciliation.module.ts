import { ValidationError } from "@smile/lib/error.js"
import { TOPIC } from "@smile/lib/rabbitmq/topic.js"
import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { collect } from "@smile/lib/utils.js"
import { Context } from "hono"
import { BaseModule } from "../base.module.js"
import ExportHistoryRepository from "../export-history/export-history.repository.js"
import { ReconciliationRepository } from "./reconciliation.repository.js"
import {
  CreateReconciliationDTO,
  GetGenerateReconciliationDTO,
  GetListReconciliationQueries,
  ListReconciliationItemDTO,
  ListReconciliationItemReasonActionDTO,
} from "./reconciliation.schema.js"
import { Publisher } from "@smile/lib/rabbitmq/publisher.js"

export class ReconciliationModule extends BaseModule {
  constructor(
    private readonly repo: ReconciliationRepository,
    protected readonly exportHistoryRepo: ExportHistoryRepository,
    protected readonly publisher: Publisher,
  ) {
    super(exportHistoryRepo, publisher)
  }

  async #getListReconciliationItems(c: Context, reconciliationIds: number[]) {
    let list: ListReconciliationItemDTO[] = []
    if (reconciliationIds.length > 0)
      list = await this.repo.getListReconciliationItems(c, reconciliationIds)

    return list
  }

  async #getListReconciliationItemReasonAction(
    c: Context,
    reconciliationItemIds: number[]
  ) {
    let list: ListReconciliationItemReasonActionDTO[] = []
    if (reconciliationItemIds.length > 0)
      list = await this.repo.getListReconciliationItemReasonAction(
        c,
        reconciliationItemIds
      )

    return list
  }

  async create(c: Context, data: CreateReconciliationDTO) {
    return await this.repo.createReconciliation(c, data)
  }

  async getGenerate(c: Context, params: GetGenerateReconciliationDTO) {
    const result = await this.repo.getGenerateReconciliation(c, params)

    return result
  }

  async list(c: Context, param: GetListReconciliationQueries) {
    const { programId } = c.var
    const { list, total } = await this.repo.getListReconciliation(
      c,
      param,
      programId
    )

    const listReconciliationItem = await this.#getListReconciliationItems(
      c,
      collect(list, "reconciliation_id")
    )

    const response = list.map((item) => {
      return {
        id: item.reconciliation_id,
        material_id: item.material_id,
        entity_id: item.entity_id,
        activity_id: item.activity_id,
        start_date: item.start_date,
        end_date: item.end_date,
        created_by: item.created_by,
        updated_by: item.updated_by,
        created_at: item.created_at,
        updated_at: item.updated_at,
        entity: {
          id: item.entity_id,
          name: item.entity_name,
          entity: {
            id: item.entity_id,
            name: item.entity_name,
            province: {
              id: item.province_id,
              name: item.province_name,
            },
            regency: {
              id: item.regency_id,
              name: item.regency_name,
            },
          },
        },
        material_parent: {
          id: item.material_parent_id,
          name: item.material_parent_name,
          code: item.material_parent_code,
        },
        material: {
          id: item.material_id,
          name: item.material_name,
          code: item.material_code,
        },
        activity: {
          id: item.activity_id,
          name: item.activity_name,
        },
        user_created_by: {
          id: item.user_id_created,
          username: item.username_created,
          email: item.email_created,
          firstname: item.firstname_created,
          lastname: item.lastname_created,
        },
        user_updated_by: {
          id: item.user_id_updated,
          username: item.username_updated,
          email: item.email_updated,
          firstname: item.firstname_updated,
          lastname: item.lastname_updated,
        },
        items: listReconciliationItem
          .filter((el) => el.reconciliation_id === item.reconciliation_id)
          .map((el) => {
            return {
              ...el,
              reconciliation_category_label: c.var.t(
                `reconciliation.label.category.${el.reconciliation_category_label}`
              ),
            }
          }),
      }
    })

    return new PaginatedResponse(param, response, Number(total))
  }

  async detail(c: Context, id: number) {
    const { programId } = c.var
    const detail = await this.repo.getDetailReconciliation(c, id, programId)
    if (!detail) {
      throw new ValidationError(
        c.var.t("validator.not_exist", { field: "reconciliation" })
      )
    }

    const listReconciliationItem = await this.#getListReconciliationItems(c, [
      detail.reconciliation_id,
    ])

    const listReconciliationItemActionReason =
      await this.#getListReconciliationItemReasonAction(
        c,
        collect(listReconciliationItem, "id")
      )

    return {
      id: detail.reconciliation_id,
      material_id: detail.material_id,
      entity_id: detail.entity_id,
      activity_id: detail.activity_id,
      start_date: detail.start_date,
      end_date: detail.end_date,
      created_by: detail.created_by,
      updated_by: detail.updated_by,
      created_at: detail.created_at,
      updated_at: detail.updated_at,
      entity: {
        id: detail.entity_id,
        name: detail.entity_name,
        entity: {
          id: detail.entity_id,
          name: detail.entity_name,
          province: {
            id: detail.province_id,
            name: detail.province_name,
          },
          regency: {
            id: detail.regency_id,
            name: detail.regency_name,
          },
        },
      },
      material_parent: {
        id: detail.material_parent_id,
        name: detail.material_parent_name,
        code: detail.material_parent_code,
      },
      material: {
        id: detail.material_id,
        name: detail.material_name,
        code: detail.material_code,
      },
      activity: {
        id: detail.activity_id,
        name: detail.activity_name,
      },
      user_created_by: {
        id: detail.user_id_created,
        username: detail.username_created,
        email: detail.email_created,
        firstname: detail.firstname_created,
        lastname: detail.lastname_created,
      },
      user_updated_by: {
        id: detail.user_id_updated,
        username: detail.username_updated,
        email: detail.email_updated,
        firstname: detail.firstname_updated,
        lastname: detail.lastname_updated,
      },
      items: listReconciliationItem
        .filter((el) => el.reconciliation_id === detail.reconciliation_id)
        .map((item) => {
          const filteredReconciliationItemActionReason =
            listReconciliationItemActionReason.filter(
              (el) => el.reconciliation_item_id === item.id
            )

          return {
            ...item,
            reconciliation_category_label: c.var.t(
              `reconciliation.label.category.${item.reconciliation_category_label}`
            ),
            reasons: filteredReconciliationItemActionReason.map((el) => ({
              id: el.reconciliation_reason_id,
              title: c.var.t(
                `reconciliation.label.reason.${el.reconciliation_reason_title}`
              ),
            })),
            actions: filteredReconciliationItemActionReason.map((el) => ({
              id: el.reconciliation_action_id,
              title: c.var.t(
                `reconciliation.label.action.${el.reconciliation_action_title}`
              ),
            })),
          }
        }),
    }
  }

  async export(c: Context, params: GetListReconciliationQueries) {
    return await this.handleAsyncExport(c, TOPIC.RECONCILIATION_EXPORTED, {
      filename: c.var.t("reconciliation.label.title"),
      params,
    })
  }
}
