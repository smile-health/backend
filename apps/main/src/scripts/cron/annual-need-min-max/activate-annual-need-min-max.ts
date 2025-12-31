import { db } from "@/common/infrastructure/database/index.js"
import { AnnualNeedRepository } from "@/modules/annual-needs/annual-needs.repository.js"
import { TransactionManager } from "@smile/lib/database.js"
import i18n from "@smile/lib/i18n.js"
import { CustomContext } from "@smile/lib/types/context.js"
import { Context } from "hono"

export const doActivateAnnualNeedMinMax = async () => {
  // Run transaction
  await new TransactionManager(db).transaction(async (trx) => {
    const translator = i18n.cloneInstance()
    translator.changeLanguage("id")

    // Context for cron
    const c = new CustomContext({
      trx,
      t: translator.t.bind(translator), // fix binding
      "feature-enabled": () => false,
      "feature-flags": () => false,
    }) as unknown as Context

    const annualNeedRepo = new AnnualNeedRepository()

    // Running main cron
    await annualNeedRepo.runMinMaxCron(c)
  })

  process.exit(0)
}
