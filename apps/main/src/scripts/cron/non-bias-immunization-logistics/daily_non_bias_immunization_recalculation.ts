import { db } from "@/common/infrastructure/database/index.js"
import { NonBiasImmunizationCron } from "@/modules/non-bias-immunization-logistics/non-bias-immunization-logistics.cron.js"
import { NonBiasImmunizationLogisticsRepository } from "@/modules/non-bias-immunization-logistics/non-bias-immunization-logistics.repository.js"
import { MaterialRepository } from "@/modules/material/material.repository.js"
import { TargetEstimationRepository } from "@/modules/target-estimation/target-estimation.repository.js"
import { TargetEstimationNonBiasRepository } from "@/modules/target-estimation-non-bias/target-estimation-non-bias.repository.js"
import { TargetsRepository } from "@/modules/targets/targets.repository.js"
import { TransactionManager } from "@smile/lib/database.js"
import i18n from "@smile/lib/i18n.js"
import { CustomContext } from "@smile/lib/types/context.js"

export const dailyNonBiasImmunizationRecalculation = async () => {
  const nonBiasImmunizationCron = new NonBiasImmunizationCron(
    new TargetsRepository(),
    new TargetEstimationRepository(),
    new NonBiasImmunizationLogisticsRepository(),
    new MaterialRepository(),
    new TargetEstimationNonBiasRepository()
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

    await nonBiasImmunizationCron.handleRecalculateNonBiasImmunization(c)
  })

  process.exit(0)
}
