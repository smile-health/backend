import { Context } from "hono"
import {
  MicroplanningStepsResponse,
  Step,
  StepStatus,
  SubStep,
  SubmitMicroplanningResponse,
} from "./microplanning.schema.js"
import { MicroplanningRepository } from "./microplanning.repository.js"
import { ValidationError } from "@smile-health/lib/error.js"

export class MicroplanningModule {
  constructor(private readonly repository: MicroplanningRepository) {}

  async getMicroplanningSteps(
    c: Context,
    subDistrictId: number,
    entityId: number,
    category?: "bias" | "non-bias"
  ): Promise<MicroplanningStepsResponse> {
    const currentYear = new Date().getFullYear()
    const nextYear = currentYear + 1

    const microplanning =
      await this.repository.getMicroplanningByEntityAndYearAnyStatus(
        c,
        entityId,
        nextYear
      )

    const isSubmitted = microplanning?.status === 1

    const steps: Step[] = []

    steps.push(await this.#getInputTargetDataStep(c, subDistrictId))

    if (category) {
      if (category === "non-bias") {
        steps.push(
          await this.#getTargetEstimationNonBiasStep(c, subDistrictId, entityId)
        )
        steps.push(
          await this.#getVaccineMaterialNeedsStep(c, subDistrictId, entityId)
        )
      } else {
        steps.push(
          await this.#getTargetEstimationBiasStep(c, subDistrictId, entityId)
        )
        steps.push(
          await this.#getVaccineMaterialNeedsBiasStep(
            c,
            subDistrictId,
            entityId
          )
        )
      }
    } else {
      const [nonBiasEstimation, biasEstimation] = await Promise.all([
        this.#getTargetEstimationNonBiasStep(c, subDistrictId, entityId),
        this.#getTargetEstimationBiasStep(c, subDistrictId, entityId),
      ])

      const estimationStep = this.#mergeEstimationSteps(
        nonBiasEstimation,
        biasEstimation
      )
      steps.push(estimationStep)

      const [nonBiasMaterial, biasMaterial] = await Promise.all([
        this.#getVaccineMaterialNeedsStep(c, subDistrictId, entityId),
        this.#getVaccineMaterialNeedsBiasStep(c, subDistrictId, entityId),
      ])

      const materialStep = this.#mergeMaterialSteps(
        nonBiasMaterial,
        biasMaterial
      )
      steps.push(materialStep)
    }

    return { is_submitted: isSubmitted, steps }
  }

  #mergeEstimationSteps(nonBias: Step, bias: Step): Step {
    const subSteps: SubStep[] = []

    if (nonBias.sub_steps) {
      subSteps.push(...nonBias.sub_steps)
    }
    if (bias.sub_steps) {
      subSteps.push(...bias.sub_steps)
    }

    const totalCompleted =
      (nonBias.status.completed || 0) + (bias.status.completed || 0)
    const totalCount = (nonBias.status.total || 0) + (bias.status.total || 0)

    return {
      step_number: 1,
      title: "Target Estimation Data Collection & Calculation",
      status: this.#calculateStatus(totalCompleted, totalCount),
      sub_steps: subSteps,
    }
  }

  #mergeMaterialSteps(nonBias: Step, bias: Step): Step {
    const subSteps: SubStep[] = []

    if (nonBias.sub_steps) {
      subSteps.push(...nonBias.sub_steps)
    }
    if (bias.sub_steps) {
      subSteps.push(...bias.sub_steps)
    }

    const totalCompleted =
      (nonBias.status.completed || 0) + (bias.status.completed || 0)
    const totalCount = (nonBias.status.total || 0) + (bias.status.total || 0)

    return {
      step_number: 2,
      title: "Vaccine & Immunization Logistics Needs Calculation",
      status: this.#calculateStatus(totalCompleted, totalCount),
      sub_steps: subSteps,
    }
  }

  async #getInputTargetDataStep(
    c: Context,
    subDistrictId: number
  ): Promise<Step> {
    const villagesWithTargets = await this.repository.getVillagesWithTargets(
      c,
      subDistrictId
    )
    const schoolsWithTargets = await this.repository.getSchoolsWithTargets(
      c,
      subDistrictId
    )

    const totalVillages = villagesWithTargets.length
    const totalSchools = schoolsWithTargets.length
    const total = totalVillages + totalSchools

    return {
      step_number: 0,
      title: "Input Target Data",
      status: {
        status: "completed",
        completed: total,
        total,
        percentage: 100,
      },
    }
  }

  async #getTargetEstimationNonBiasStep(
    c: Context,
    subDistrictId: number,
    entityId: number
  ): Promise<Step> {
    const currentYear = new Date().getFullYear()
    const nextYear = currentYear + 1

    const microplanning =
      await this.repository.getMicroplanningByEntityAndYearAnyStatus(
        c,
        entityId,
        nextYear
      )

    const villages = await this.repository.getVillagesBySubDistrict(
      c,
      subDistrictId
    )

    if (villages.length === 0) {
      return {
        step_number: 1,
        title: "Target Estimation Data Collection & Calculation",
        status: this.#calculateStatus(0, 0),
        sub_steps: [{ name: "Bayi, Baduta, WUS", completed: 0, total: 0 }],
      }
    }

    if (!microplanning) {
      return {
        step_number: 1,
        title: "Target Estimation Data Collection & Calculation",
        status: this.#calculateStatus(0, villages.length),
        sub_steps: [
          {
            name: "Bayi, Baduta, WUS",
            completed: 0,
            total: villages.length,
          },
        ],
      }
    }

    const villageIds = villages.map((v) => v.village_id)
    const estimationStatus = await this.repository.getVillageEstimationStatus(
      c,
      Number(microplanning.id),
      villageIds
    )

    const completedVillages = estimationStatus.length
    const totalVillages = villages.length

    return {
      step_number: 1,
      title: "Target Estimation Data Collection & Calculation",
      status: this.#calculateStatus(completedVillages, totalVillages),
      sub_steps: [
        {
          name: "Bayi, Baduta, WUS",
          completed: completedVillages,
          total: totalVillages,
        },
      ],
    }
  }

  async #getTargetEstimationBiasStep(
    c: Context,
    subDistrictId: number,
    entityId: number
  ): Promise<Step> {
    const microplanning =
      await this.repository.getMicroplanningByEntityAndYearAnyStatus(
        c,
        entityId,
        new Date().getFullYear() + 1
      )

    const schools = await this.repository.getSchoolsBySubDistrict(
      c,
      subDistrictId
    )

    if (schools.length === 0) {
      return {
        step_number: 1,
        title: "Target Estimation Data Collection & Calculation",
        status: this.#calculateStatus(0, 1),
        sub_steps: [{ name: "BIAS", completed: 0, total: 1 }],
      }
    }

    if (!microplanning) {
      return {
        step_number: 1,
        title: "Target Estimation Data Collection & Calculation",
        status: this.#calculateStatus(0, schools.length + 1),
        sub_steps: [
          {
            name: "BIAS",
            completed: 0,
            total: schools.length + 1,
          },
        ],
      }
    }

    const schoolIds = [...schools.map((s) => s.school_id), entityId]
    const estimationStatus = await this.repository.getSchoolEstimationStatus(
      c,
      Number(microplanning.id),
      schoolIds
    )

    const completedSchools = estimationStatus.length
    const totalSchools = schools.length + 1

    return {
      step_number: 1,
      title: "Target Estimation Data Collection & Calculation",
      status: this.#calculateStatus(completedSchools, totalSchools),
      sub_steps: [
        {
          name: "BIAS",
          completed: completedSchools,
          total: totalSchools,
        },
      ],
    }
  }

  async #getVaccineMaterialNeedsStep(
    c: Context,
    subDistrictId: number,
    entityId: number
  ): Promise<Step> {
    const currentYear = new Date().getFullYear()
    const nextYear = currentYear + 1

    const microplanning =
      await this.repository.getMicroplanningByEntityAndYearAnyStatus(
        c,
        entityId,
        nextYear
      )

    const villages = await this.repository.getVillagesBySubDistrict(
      c,
      subDistrictId
    )

    if (villages.length === 0) {
      return {
        step_number: 2,
        title: "Vaccine & Immunization Logistics Needs Calculation",
        status: this.#calculateStatus(0, 0),
        sub_steps: [{ name: "Bayi, Baduta, WUS", completed: 0, total: 0 }],
      }
    }

    if (!microplanning) {
      return {
        step_number: 2,
        title: "Vaccine & Immunization Logistics Needs Calculation",
        status: this.#calculateStatus(0, villages.length),
        sub_steps: [
          {
            name: "Bayi, Baduta, WUS",
            completed: 0,
            total: villages.length,
          },
        ],
      }
    }

    const villageIds = villages.map((v) => v.village_id)
    const materialNeedsStatus =
      await this.repository.getVillageMaterialNeedsStatus(
        c,
        Number(microplanning.id),
        villageIds
      )

    const completedVillages = materialNeedsStatus.length
    const totalVillages = villages.length

    return {
      step_number: 2,
      title: "Vaccine & Immunization Logistics Needs Calculation",
      status: this.#calculateStatus(completedVillages, totalVillages),
      sub_steps: [
        {
          name: "Bayi, Baduta, WUS",
          completed: completedVillages,
          total: totalVillages,
        },
      ],
    }
  }

  async #getVaccineMaterialNeedsBiasStep(
    c: Context,
    subDistrictId: number,
    entityId: number
  ): Promise<Step> {
    const microplanning =
      await this.repository.getMicroplanningByEntityAndYearAnyStatus(
        c,
        entityId,
        new Date().getFullYear() + 1
      )

    const schools = await this.repository.getSchoolsBySubDistrict(
      c,
      subDistrictId
    )

    if (schools.length === 0) {
      return {
        step_number: 2,
        title: "Vaccine & Immunization Logistics Needs Calculation",
        status: this.#calculateStatus(0, 1),
        sub_steps: [{ name: "BIAS", completed: 0, total: 1 }],
      }
    }

    if (!microplanning) {
      return {
        step_number: 2,
        title: "Vaccine & Immunization Logistics Needs Calculation",
        status: this.#calculateStatus(0, schools.length + 1),
        sub_steps: [
          {
            name: "BIAS",
            completed: 0,
            total: schools.length + 1,
          },
        ],
      }
    }

    const schoolIds = [...schools.map((s) => s.school_id), entityId]
    const materialNeedsStatus =
      await this.repository.getSchoolMaterialNeedsStatus(
        c,
        Number(microplanning.id),
        schoolIds
      )

    const completedSchools = materialNeedsStatus.length
    const totalSchools = schools.length + 1

    return {
      step_number: 2,
      title: "Vaccine & Immunization Logistics Needs Calculation",
      status: this.#calculateStatus(completedSchools, totalSchools),
      sub_steps: [
        {
          name: "BIAS",
          completed: completedSchools,
          total: totalSchools,
        },
      ],
    }
  }

  #calculateStatus(completed: number, total: number): StepStatus {
    if (total === 0) {
      return {
        status: "not_filled",
        completed: 0,
        total: 0,
        percentage: 0,
      }
    }

    if (completed === 0) {
      return {
        status: "not_filled",
        completed,
        total,
        percentage: 0,
      }
    }

    if (completed < total) {
      return {
        status: "not_completed",
        completed,
        total,
        percentage: Math.round((completed / total) * 100),
      }
    }

    return {
      status: "completed",
      completed,
      total,
      percentage: 100,
    }
  }

  async submitMicroplanning(
    c: Context,
    subDistrictId: number,
    entityId: number
  ): Promise<SubmitMicroplanningResponse> {
    const currentYear = new Date().getFullYear()
    const nextYear = currentYear + 1

    const microplanning = await this.repository.getMicroplanningByEntityAndYear(
      c,
      entityId,
      nextYear,
      0
    )

    if (!microplanning) {
      throw new ValidationError(
        c.var.t("validator.not_exist", {
          field: "Microplanning",
        })
      )
    }

    const stepsResponse = await this.getMicroplanningSteps(
      c,
      subDistrictId,
      entityId
    )

    const allStepsCompleted = stepsResponse.steps.every((step) => {
      return step.status.percentage === 100
    })

    if (!allStepsCompleted) {
      const incompleteSteps = stepsResponse.steps
        .filter((step) => step.status.percentage < 100)
        .map((step) => step.title)
        .join(", ")

      throw new ValidationError(
        `Cannot submit microplanning. The following steps are not completed: ${incompleteSteps}. All steps must be 100% completed before submission.`
      )
    }

    const microplanningId = Number(microplanning.id)

    await Promise.all([
      this.repository.updateMicroplanningStatus(c, microplanningId, 1),
      this.repository.updateTargetStatus(c, microplanningId, 1),
      this.repository.updateVillageEstimationStatus(c, microplanningId, 1),
      this.repository.updateSchoolEstimationStatus(c, microplanningId, 1),
      this.repository.updateMaterialNeedsStatus(c, microplanningId, 1),
    ])

    return {
      message: "Microplanning submitted successfully",
      microplanning_id: microplanningId,
    }
  }
}
