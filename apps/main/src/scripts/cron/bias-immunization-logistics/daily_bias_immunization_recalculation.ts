import { db } from "@/common/infrastructure/database/index.js"
import { BiasImmunizationCron } from "@/modules/bias-immunization-logistics/bias-immunization-logistics.cron.js"
import { BiasImmunizationLogisticsRepository } from "@/modules/bias-immunization-logistics/bias-immunization-logistics.repository.js"
import { MaterialRepository } from "@/modules/material/material.repository.js"
import { TargetEstimationRepository } from "@/modules/target-estimation/target-estimation.repository.js"
import { TargetsRepository } from "@/modules/targets/targets.repository.js"
import { TransactionManager } from "@smile-health/lib/database.js"
import i18n from "@smile-health/lib/i18n.js"
import { CustomContext } from "@smile-health/lib/types/context.js"

export const dailyBiasImmunizationRecalculation = async () => {
  const biasImmunizationCron = new BiasImmunizationCron(
    new TargetsRepository(),
    new TargetEstimationRepository(),
    new BiasImmunizationLogisticsRepository(),
    new MaterialRepository()
  )

  await new TransactionManager(db).transaction(async (trx) => {
    const translator = i18n.cloneInstance()
    translator.changeLanguage("id")
    const c = new CustomContext({
      trx,
      t: translator.t,
      "feature-enabled": () => false,
      "feature-flags": () => false,
    })

    await biasImmunizationCron.handleRecalculateBiasImmunization(c)
  })

  process.exit(0)
}
