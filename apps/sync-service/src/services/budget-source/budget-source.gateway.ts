import { SERVER_URL } from "@/common/constant/url.js"
import { DB } from "@/common/infrastructure/database/types/db.js"
import { logError } from "@/common/logger.repository.js"
import { getMapProgramIds, insertMapping } from "@/common/mapping.repository.js"
import { getSmile } from "@/openapi/budget-source.js"
import { CustomContext } from "@smile/lib/types/context.js"
import { AxiosError } from "axios"
import { BudgetSourceRepository } from "./budget-source.repository.js"
import {
  BudgetSourceDTO,
  WsBudgetSourceMessageSchema,
} from "./budget-source.schema.js"

export class BudgetSourceGateway {
  constructor(private readonly repository: BudgetSourceRepository) {}

  readonly #callCreateBudgetSource = async (
    headers,
    programId: number,
    budgetSource: BudgetSourceDTO
  ) => {
    const response = await getSmile().postSourceAsset(
      {
        name: budgetSource.name,
        description: budgetSource.description ?? "",
      },
      {
        baseURL: SERVER_URL[programId],
        headers,
      }
    )

    return response
  }

  readonly #callUpdateBudgetSource = async (
    headers,
    programId: number,
    budgetSource: BudgetSourceDTO,
    id: number
  ) => {
    const response = await getSmile().putSourceAssetId(
      id,
      {
        name: budgetSource.name,
        description: budgetSource.description ?? "",
      },
      {
        baseURL: SERVER_URL[programId],
        headers,
      }
    )

    return response
  }

  private async doUpsertBudgetSource(
    c: CustomContext<DB>,
    headers: Record<string, string>,
    programId: number,
    budgetSource: BudgetSourceDTO
  ): Promise<number> {
    const row = await c.var.trx
      .selectFrom("mapping_budget_sources")
      .selectAll("mapping_budget_sources")
      .innerJoin(
        "mapping_programs",
        "mapping_programs.platform_program_id",
        "mapping_budget_sources.program_id"
      )
      .where("platform_global_id", "=", budgetSource.id)
      .where("mapping_programs.existing_program_id", "=", programId)
      .executeTakeFirst()

    if (row) {
      await this.#callUpdateBudgetSource(
        headers,
        programId,
        budgetSource,
        row.existing_budget_source_id
      )
      return row.existing_budget_source_id
    } else {
      const response = await this.#callCreateBudgetSource(
        headers,
        programId,
        budgetSource
      )
      return response.data.id
    }
  }

  public async upsert(
    c: CustomContext<DB>,
    message: WsBudgetSourceMessageSchema
  ) {
    try {
      const { headers, payload } = message

      const mappingPrograms = await getMapProgramIds(
        c,
        payload.programs.map((p) => p.program_id)
      )

      for (const [progId, plProgramIds] of Object.entries(mappingPrograms)) {
        const existingBudgetSourceId = await this.doUpsertBudgetSource(
          c,
          headers,
          Number(progId),
          payload
        )

        // insert mapping for all programs in this program group
        await insertMapping(
          c,
          "mapping_budget_sources",
          payload.programs
            .filter((p) => plProgramIds.includes(p.program_id))
            .map((p) => ({
              program_id: p.program_id,
              platform_budget_source_id: p.budget_source_id,
              existing_budget_source_id: existingBudgetSourceId,
              platform_global_id: payload.id,
            }))
        )
      }

      console.log("Success Sync to 3.0")
    } catch (error) {
      await logError(c, error)
      if (error instanceof AxiosError) {
        console.log(error.response?.data)
      } else {
        console.log(error)
        throw new Error("An unknown error occurred")
      }
    }
  }
}
