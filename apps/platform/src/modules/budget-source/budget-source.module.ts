import { DB } from "@/common/infrastructure/database/types/db.js"
import env from "@/config/env.js"
import { NotFoundError } from "@smile/lib/error.js"
import BaseTemplate from "@smile/lib/excel/index.js"
import { PROCESSOR } from "@smile/lib/excel/types.js"
import { Context as CtxLib } from "@smile/lib/types/context.js"
import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { collect, merge } from "@smile/lib/utils.js"
import { Context } from "hono"
import moment from "moment"
import { UserRepository } from "../user/user.repository.js"
import { BudgetSourceRepository } from "./budget-source.repository.js"
import {
  BudgetSourceResponse,
  BudgetSourceSyncRequest,
  GetBudgetSourceQueries,
  TExportBudgetSource,
} from "./budget-source.schema.js"

export class BudgetSourceModule {
  constructor(
    private readonly repository: BudgetSourceRepository,
    private readonly userRepo: UserRepository
  ) {}

  async syncData(c: CtxLib<DB>, body: BudgetSourceSyncRequest) {
    if (body.workspace_ids?.includes(env.WORKSPACE_ID)) {
      const [budgetSource] = await Promise.all([
        this.repository.findOneDynamic(c, "global_id", "=", body.id, true),
      ])

      body.global_id = body.id
      body.id = budgetSource ? budgetSource.id : 0
      delete body.workspace_ids

      await this.repository.upsert(c, body)
    }
  }

  async list(c: Context, queries: GetBudgetSourceQueries) {
    queries.isPaginate = true
    queries.offset = (queries.page - 1) * queries.paginate

    const { budgetSources, total } = await this.repository.findAll(c, queries)

    if (budgetSources.length == 0) {
      return new PaginatedResponse(queries)
    }

    const data = await this.#mapList(c, budgetSources)

    return new PaginatedResponse(queries, data, Number(total))
  }

  async detail(c: Context, id: number) {
    const budgetSouce = await this.repository.findOneDynamic(
      c,
      "id",
      "=",
      id,
      true
    )

    if (!budgetSouce) {
      throw new NotFoundError(
        `${c.var.t("validator.not_exist", { field: "budget source" })}`
      )
    }

    return budgetSouce
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

    excelTemplate.setTitle(title)
    excelTemplate.setTimezone(c.req.header("Timezone"))
    await excelTemplate.initSheet(title)
    excelTemplate.setColumns([
      {
        key: "name",
        header: this.#getTranslation(
          language,
          "Budget Source Name",
          "Nama Sumber Anggaran"
        ),
        width: 50,
      },
      {
        key: "description",
        header: this.#getTranslation(language, "Description", "Deksripsi"),
        width: 100,
      },
      {
        key: "created_at",
        header: this.#getTranslation(
          language,
          "Created Date",
          "Tanggal Dibuat"
        ),
        width: 30,
      },
      {
        key: "updated_at",
        header: this.#getTranslation(
          language,
          "Updated Date",
          "Tanggal Diubah"
        ),
        width: 30,
      },
      {
        key: "created_by",
        header: this.#getTranslation(language, "Created By", "Dibuat Oleh"),
        width: 30,
      },
      {
        key: "updated_by",
        header: this.#getTranslation(language, "Updated By", "Diupdate Oleh"),
        width: 30,
      },
    ])

    const data = await this.repository.findAll(c, queries)
    const items = await this.#mapList(c, data.budgetSources)

    const setRows: TExportBudgetSource[] = []
    for await (const budgetSource of items) {
      const row: TExportBudgetSource = {
        name: budgetSource.name,
        description: budgetSource.description,
        created_at: moment(budgetSource.created_at).format(
          "YYYY-MM-DD HH:mm:ss"
        ),
        updated_at: budgetSource.updated_at
          ? moment(budgetSource.updated_at).format("YYYY-MM-DD HH:mm:ss")
          : "-",
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

    const [userBy] = await Promise.all([
      createdByIds.length > 0
        ? this.userRepo.getByIDsMapped(c, merge(createdByIds, updatedByIds))
        : [],
    ])

    return data.map(
      (el) =>
        ({
          ...el,
          user_created_by: userBy[el.created_by ?? 0]?.[0] ?? {},
          user_updated_by: userBy[el.updated_by ?? 0]?.[0] ?? {},
        }) as BudgetSourceResponse
    )
  }

  #getTranslation(language: string, en: string, id: string): string {
    const translation: string = language === "en" ? en : id
    return translation
  }
}
