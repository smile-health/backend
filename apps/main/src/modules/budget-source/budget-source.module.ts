import { NotFoundError } from "@smile-health/lib/error.js"
import BaseTemplate from "@smile-health/lib/excel/index.js"
import { PROCESSOR } from "@smile-health/lib/excel/types.js"
import { PaginatedResponse } from "@smile-health/lib/types/paginate.js"
import { collect, formatDateWithTimezone, merge } from "@smile-health/lib/utils.js"
import { Context } from "hono"
import { UserRepository } from "../user/user.repository.js"
import { BudgetSourceRepository } from "./budget-source.repository.js"
import {
  BudgetSourceResponse,
  GetBudgetSourceQueries,
  TExportBudgetSource,
  UpdateStatusRequest,
} from "./budget-source.schema.js"

export class BudgetSourceModule {
  constructor(
    private readonly repository: BudgetSourceRepository,
    private readonly userRepo: UserRepository
  ) {}

  async list(c: Context, queries: GetBudgetSourceQueries) {
    const { sort_by, sort_type } = queries
    queries.isPaginate = true
    queries.offset = (queries.page - 1) * queries.paginate

    const { budgetSources, total } = await this.repository.findAll(
      c,
      queries,
      sort_by,
      sort_type
    )

    if (budgetSources.length == 0) {
      return new PaginatedResponse(queries)
    }

    const data = await this.#mapList(c, budgetSources)

    return new PaginatedResponse(queries, data, Number(total))
  }

  async detail(c: Context, id: number) {
    const budgetSouce = await this.repository.findOne(c, {
      id: id,
    })

    if (!budgetSouce) {
      throw new NotFoundError(
        `${c.var.t("validator.not_exist", { field: "budget source" })}`
      )
    }

    return budgetSouce
  }

  async updateStatus(c: Context, id: number, req: UpdateStatusRequest) {
    const budgetSource = await this.repository.findOne(c, { id })
    if (!budgetSource) {
      throw new NotFoundError(
        c.var.t("validator.not_exist", {
          field: c.var.t("budget_source.title"),
        })
      )
    }

    await this.repository.updateStatus(c, id, req.status)
  }

  async exportExcel(c: Context, queries: GetBudgetSourceQueries) {
    queries.isPaginate = false
    const language = c.var.language
    const title = this.#getTranslation(
      language,
      "Budget Source",
      "Sumber Anggaran"
    )
    const excelTemplate = new BaseTemplate(PROCESSOR.SHEETJS)
    const timezone = c.req.header("Timezone")

    excelTemplate.setTitle(title)
    excelTemplate.setTimezone(timezone)
    await excelTemplate.initSheet(title)
    excelTemplate.setColumns([
      {
        header: this.#getTranslation(
          language,
          "Budget Source Name",
          "Nama Sumber Anggaran"
        ),
        width: 40,
      },
      {
        header: this.#getTranslation(language, "Description", "Deksripsi"),
        width: 40,
      },
      {
        header: this.#getTranslation(
          language,
          "Restriction Status",
          "Status Pembatasan"
        ),
        width: 40,
      },
      {
        header: this.#getTranslation(
          language,
          "Created Date",
          "Tanggal Dibuat"
        ),
        width: 20,
      },
      {
        header: this.#getTranslation(
          language,
          "Updated Date",
          "Tanggal Diubah"
        ),
        width: 20,
      },
      {
        header: this.#getTranslation(language, "Created By", "Dibuat Oleh"),
        width: 20,
      },
      {
        header: this.#getTranslation(language, "Updated By", "Diupdate Oleh"),
        width: 20,
      },
    ])

    const data = await this.repository.findAll(c, queries)
    const items = await this.#mapList(c, data.budgetSources)

    const setRows: TExportBudgetSource[] = []
    for await (const budgetSource of items) {
      const row: TExportBudgetSource = {
        name: budgetSource.name,
        description: budgetSource.description,
        is_restricted: budgetSource.is_restricted
          ? this.#getTranslation(language, "Restricted", "Terbatas")
          : this.#getTranslation(language, "Unrestricted", "Tidak Terbatas"),
        created_at: formatDateWithTimezone(budgetSource.created_at, timezone),
        updated_at: formatDateWithTimezone(budgetSource.updated_at, timezone),
        created_by: budgetSource.user_created_by?.firstname ?? "-",
        updated_by: budgetSource.user_updated_by?.firstname ?? "-",
      }
      setRows.push(row)
    }
    await excelTemplate.addRows(title, setRows)

    return await excelTemplate.generate()
  }

  async #mapList(c: Context, data: BudgetSourceResponse[]) {
    const createdByIds = collect(data, "created_by")
    const updatedByIds = collect(data, "updated_by")
    const auditIds = merge(createdByIds, updatedByIds)

    const [userBy] = await Promise.all(
      auditIds.length > 0 ? [this.userRepo.getByIDsMapped(c, auditIds)] : []
    )

    const getAuditBy = (id: number) => {
      const audit = id ?? 0
      if (audit === 0 || !userBy) return {}
      return userBy![audit ?? 0]?.[0] ?? {}
    }

    return data.map(
      (el) =>
        ({
          ...el,
          user_created_by: getAuditBy(el.created_by),
          user_updated_by: getAuditBy(el.updated_by),
        }) as BudgetSourceResponse
    )
  }

  #getTranslation(language: string, en: string, id: string): string {
    const translation: string = language === "en" ? en : id
    return translation
  }
}
