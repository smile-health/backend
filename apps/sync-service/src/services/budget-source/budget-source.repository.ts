import { DB } from "@/common/infrastructure/database/types/db.js"
import { CustomContext } from "@smile/lib/types/context.js"
import { WsBudgetSources } from "./budget-source.schema.js"

export class BudgetSourceRepository {
  async insertBudgetSourceMapping(
    c: CustomContext<DB>,
    budgetSource: WsBudgetSources,
    responseJsonId: number
  ) {
    return c.var.trx
      .insertInto("mapping_budget_sources")
      .values({
        program_id: budgetSource.program_id,
        platform_global_id: budgetSource.global_id,
        platform_budget_source_id: budgetSource.id,
        existing_budget_source_id: responseJsonId,
      })
      .execute()
  }

  async findBudgetSourceByIdPlatform(
    c: CustomContext<DB>,
    platformId: number,
    programId: number
  ) {
    return c.var.trx
      .selectFrom("mapping_budget_sources")
      .where("platform_budget_source_id", "=", platformId)
      .where("program_id", "=", programId)
      .select(["id", "existing_budget_source_id"])
      .executeTakeFirst()
  }
}
