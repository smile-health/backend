import { db } from "@/common/infrastructure/database/index.js"
import { TargetsCron } from "@/modules/targets/targets.cron.js"
import { TargetsRepository } from "@/modules/targets/targets.repository.js"
import { TransactionManager } from "@smile-health/lib/database.js"
import i18n from "@smile-health/lib/i18n.js"
import { CustomContext } from "@smile-health/lib/types/context.js"

export const dailyTargetSnapshot = async () => {
  const targetsCron = new TargetsCron(new TargetsRepository())

  await new TransactionManager(db).transaction(async (trx) => {
    const translator = i18n.cloneInstance()
    translator.changeLanguage("id")
    const c = new CustomContext({
      trx,
      t: translator.t,
      "feature-enabled": () => false,
      "feature-flags": () => false,
    })

    await targetsCron.handleDailyTargetSnapshot(c)
  })

  process.exit(0)
}
