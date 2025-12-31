import { ActivityRepository } from "@/modules/activity/activity.repository.js"
import { EntityActivityRepository } from "@/modules/entity-activity/entity-activity.repository.js"
import { ValidationError } from "@smile/lib/error.js"
import { associate, getDefaultNumber } from "@smile/lib/utils.js"
import { conditionsMessage } from "@smile/lib/zod.js"
import { Context } from "hono"
import { RefinementCtx, z } from "zod"
import { TransactionRepository } from "../transaction.repository.js"
import { TransactionErrorHandler } from "../utils/transaction.error.js"
import { TransactionValidator } from "../utils/transaction.validator.js"
import {
  conditionsMessageWithData,
  formatErrorsWithData,
} from "../utils/transaction.zod.js"
import { ConsumptionRabiesRepository } from "./consumption-rabies.repository.js"
import { ConsumptionRequestSchema } from "./consumption-rabies.schema.js"

export class ConsumptionRabiesMiddleware {
  constructor(
    private readonly repo: ConsumptionRabiesRepository,
    private readonly transactionRepo: TransactionRepository,
    private readonly activityRepo: ActivityRepository,
    private readonly entityActivityRepo: EntityActivityRepository
  ) {}

  logErrors = TransactionErrorHandler.logErrors

  consumption = async (c: Context) => {
    return z.preprocess(async (input, ctx: RefinementCtx) => {
      const parsed = await ConsumptionRequestSchema.safeParseAsync(input)

      if (parsed.success) {
        const programId = c.var.programId
        const userData = await this.transactionRepo.findWsUserById(
          c,
          c.var.userId!
        )

        const data = parsed.data
        const sets = {
          materialSet: new Set<number>(),
          stockSet: new Set<number>(),
        }

        const actualTransactionDate = new Date(data.actual_transaction_date)
        const now = new Date()
        conditionsMessage(
          ctx,
          c.var.t(
            "validator.actual_transaction_date_must_be_today_or_earlier",
            {
              field: c.var.t("transaction.label.actual_transaction_date"),
            }
          ),
          isNaN(actualTransactionDate.getTime()) || actualTransactionDate > now,
          ["actual_transaction_date"]
        )

        // Validate materials uniqueness
        for (const [idx, material] of data.materials.entries()) {
          conditionsMessage(
            ctx,
            c.var.t("validator.unique", {
              field: c.var.t("transaction.label.stock_id"),
            }),
            !!getDefaultNumber(material.stock_id) &&
              sets.stockSet.has(getDefaultNumber(material.stock_id)),
            [`materials.${idx}.stock_id`]
          )

          sets.materialSet.add(getDefaultNumber(material.material_id))
          sets.stockSet.add(getDefaultNumber(material.stock_id))
        }

        // Validate materials data
        const [materialsPermissonData, materialsData, stockData] =
          await Promise.all([
            this.transactionRepo.findWsMaterialPermissonByIds(
              c,
              Array.from(sets.materialSet)
            ),
            this.transactionRepo.findWsMaterialByIds(
              c,
              Array.from(sets.materialSet),
              programId
            ),
            this.transactionRepo.findWsStockByIds(
              c,
              Array.from(sets.stockSet),
              programId,
              false
            ),
          ])

        const materialAssociate = associate(materialsData, "id")
        const stockAssociate = associate(stockData, "id")

        for (const [idx, material] of data.materials.entries()) {
          TransactionValidator.checkMaterialInStock(
            idx,
            c,
            ctx,
            stockAssociate,
            material.stock_id,
            material.material_id
          )

          TransactionValidator.checkMaterialWithoutStockQuality(
            c,
            ctx,
            idx,
            userData,
            material,
            materialAssociate,
            materialsPermissonData
          )

          TransactionValidator.checkStockQty(
            c,
            ctx,
            idx,
            material,
            stockAssociate
          )
        }

        // Validate entity, activity, customer and entity activity
        const [
          entityData,
          activityData,
          customerData,
          entityActivityData,
          vendorCustomerActivityData,
        ] = await Promise.all([
          this.transactionRepo.findWsEntityById(c, data.entity_id, programId),
          this.activityRepo.findById(c, data.activity_id, programId),
          this.transactionRepo.findWsEntityById(c, data.customer_id, programId),
          this.entityActivityRepo.getListEntityActivity(
            c,
            data.entity_id,
            {
              is_ongoing: 1,
              page: 1,
              paginate: 100,
              offset: 0,
            },
            programId
          ),
          this.transactionRepo.findEntityActivityVendorCustomerEntityByIds(
            c,
            programId,
            data.entity_id,
            data.customer_id,
            data.entity_activity_id,
            data.activity_id
          ),
        ])

        const hasActivity = entityActivityData.some(
          (activity) => activity.id === data.activity_id
        )

        conditionsMessage(
          ctx,
          c.var.t("validator.not_exist", {
            field: c.var.t("transaction.label.entity_activity_id"),
          }),
          !data.entity_activity_id || !vendorCustomerActivityData,
          ["entity_activity_id"]
        )

        conditionsMessage(
          ctx,
          c.var.t("validator.not_exist", {
            field: c.var.t("transaction.label.entity_id"),
          }),
          !entityData,
          ["entity_id"]
        )
        conditionsMessage(
          ctx,
          c.var.t("validator.not_exist", {
            field: c.var.t("transaction.label.activity_id"),
          }),
          !activityData,
          ["activity_id"]
        )
        conditionsMessage(
          ctx,
          c.var.t("validator.not_exist", {
            field: c.var.t("transaction.label.entity_id"),
          }),
          !customerData,
          ["customer_id"]
        )
        conditionsMessage(
          ctx,
          c.var.t("validator.entity_activity_date_not_active", {
            field: c.var.t("transaction.label.activity_id"),
          }),
          !hasActivity,
          ["activity_id"]
        )

        // Validate vaccine sequences for rabies patients
        for (const [materialIdx, material] of data.materials.entries()) {
          // Skip if no patients (patients is optional)
          const stockIndex = stockData?.findIndex(
            (stock) => stock.id === material.stock_id
          )
          if (stockIndex === -1) continue

          // Limit Open Vial
          conditionsMessage(
            ctx,
            c.var.t(
              `${materialIdx}`,
              "validator.submit_return_invalid_open_vial"
            ),
            Number(material.open_vial) >=
              Number(stockData[stockIndex]?.open_vial_qty),
            [`materials.${materialIdx}.open_vial`]
          )

          // Limit Close Vial
          conditionsMessage(
            ctx,
            c.var.t(
              `${materialIdx}`,
              "validator.submit_return_close_vial_exceed_limit_open_vial"
            ),
            Number(material.close_vial) > Number(stockData[stockIndex]?.qty),
            [`materials.${materialIdx}.close_vial`]
          )

          // Entity Tag Validation for Open Vial Usage
          conditionsMessage(
            ctx,
            c.var.t(`${materialIdx}`, "validator.request_not_allowed"),
            Number(material.open_vial) > 0 &&
              Number(customerData?.is_open_vial) !== 1,
            [`materials.${materialIdx}.open_vial`]
          )

          if (!material.patients) continue

          // Validate required vaccine fields on material when patients exist
          conditionsMessage(
            ctx,
            c.var.t("validator.required", {
              field: c.var.t("transaction.label.vaccine_type"),
            }),
            !material.vaccine_type,
            [`materials.${materialIdx}.vaccine_type`]
          )
          conditionsMessage(
            ctx,
            c.var.t("validator.required", {
              field: c.var.t("transaction.label.vaccine_method"),
            }),
            !material.vaccine_method,
            [`materials.${materialIdx}.vaccine_method`]
          )

          if (!material.vaccine_type || !material.vaccine_method) continue

          for (const [patientIdx, patient] of material.patients.entries()) {
            conditionsMessage(
              ctx,
              c.var.t("validator.required", {
                field: c.var.t("transaction.label.vaccine_sequence"),
              }),
              !patient.vaccine_sequence,
              [`materials.${materialIdx}.patients.${patientIdx}`]
            )

            if (!patient.vaccine_sequence) continue

            const patientId = await this.repo
              .getPatientIdByIdentity(
                c,
                patient.identity_type,
                patient.identity_number
              )
              .catch(() => null)

            // Validate that actual_transaction_date doesn't exceed active_duration
            if (patientId) {
              // Get the patient's current vaccine sequence and last vaccine date
              const currentPatientVaccine = await c.var.trx
                .selectFrom("ws_patient_rabies")
                .select(["vaccine_sequence", "last_vaccine_at"])
                .where("patient_id", "=", patientId)
                .orderBy("last_vaccine_at", "desc")
                .executeTakeFirst()

              if (currentPatientVaccine?.vaccine_sequence) {
                // Get the active_duration from rabies_vaccine_rules for the patient's current sequence
                const vaccineRule = await c.var.trx
                  .selectFrom("rabies_vaccine_rules")
                  .select(["id", "active_duration"])
                  .where("id", "=", currentPatientVaccine.vaccine_sequence)
                  .executeTakeFirst()

                if (
                  currentPatientVaccine?.last_vaccine_at &&
                  data.actual_transaction_date &&
                  vaccineRule?.active_duration
                ) {
                  const lastVaccineDate = new Date(
                    currentPatientVaccine.last_vaccine_at
                  )
                  const actualDate = new Date(data.actual_transaction_date)

                  // Calculate days difference between last vaccine and current transaction
                  const daysDiff = Math.floor(
                    (actualDate.getTime() - lastVaccineDate.getTime()) /
                      (1000 * 60 * 60 * 24)
                  )

                  // Check if the difference exceeds active_duration
                  if (daysDiff > vaccineRule.active_duration) {
                    conditionsMessage(
                      ctx,
                      c.var.t("validator.active_duration_exceeded", {
                        days: vaccineRule.active_duration,
                        actual: daysDiff,
                      }),
                      true,
                      [`transactions`]
                    )
                    // Skip further validation for this patient
                    continue
                  }
                }
              }
            }

            // First check if this sequence already exists in ws_patient
            const existingSequence = patientId
              ? await c.var.trx
                  .selectFrom("ws_patient_rabies")
                  .select("vaccine_sequence")
                  .where("patient_id", "=", patientId)
                  .where("vaccine_sequence", "=", patient.vaccine_sequence)
                  .executeTakeFirst()
              : null

            if (existingSequence) {
              // Trigger validation if sequence matches current patient's sequence
              conditionsMessage(
                ctx,
                c.var.t("validator.invalid_vaccine_sequence"),
                true,
                [`transactions`]
              )
              continue
            }

            // Get all vaccine rules in the chain by following previous_sequence
            let currentSequence: number | null = patient.vaccine_sequence
            const vaccineRules: Array<{
              id: number
              previous_sequence: number | null
            }> = []
            let isValid = true
            let hasQuantityValidationError = false

            while (currentSequence !== null) {
              const rule = await c.var.trx
                .selectFrom("rabies_vaccine_rules")
                .select(["id", "previous_sequence"])
                .where("id", "=", currentSequence)
                .executeTakeFirst()

              if (!rule) {
                isValid = false
                break
              }

              vaccineRules.push(rule)
              currentSequence = rule.previous_sequence
            }

            // Get patient's current vaccine sequence for validation (if patient exists)
            const currentPatientSequence = patientId
              ? await c.var.trx
                  .selectFrom("ws_patient_rabies")
                  .select("vaccine_sequence")
                  .where("patient_id", "=", patientId)
                  .orderBy("vaccine_sequence", "desc")
                  .executeTakeFirst()
              : null

            // Check both previous_sequence and next_sequence for valid transitions
            const isValidPreviousSequence =
              vaccineRules.length > 0 &&
              (patientId
                ? vaccineRules[0]?.previous_sequence ===
                  currentPatientSequence?.vaccine_sequence
                : vaccineRules[0]?.previous_sequence === null)

            // Check if current sequence is in next_sequence of patient's last sequence
            let isValidNextSequence = false
            if (patientId && currentPatientSequence?.vaccine_sequence) {
              const lastSequenceRule = await c.var.trx
                .selectFrom("rabies_vaccine_rules")
                .select("next_sequence")
                .where("id", "=", currentPatientSequence.vaccine_sequence)
                .executeTakeFirst()

              if (lastSequenceRule?.next_sequence) {
                const nextSequences = lastSequenceRule.next_sequence
                  .split(",")
                  .map(Number)
                isValidNextSequence = nextSequences.includes(
                  patient.vaccine_sequence
                )
              }
            }

            isValid = isValidPreviousSequence || isValidNextSequence

            // Check prerequisite_qty for booster sequences (11 and 13)
            if (
              isValid &&
              (patient.vaccine_sequence === 11 ||
                patient.vaccine_sequence === 13)
            ) {
              const boosterRule = await c.var.trx
                .selectFrom("rabies_vaccine_rules")
                .select(["prerequisite_qty"])
                .where("id", "=", patient.vaccine_sequence)
                .executeTakeFirst()

              // Get the sum of change_qty for this patient
              const sumChangeQty = patientId
                ? await this.repo.getSumChangeQtyForPatient(c, patientId)
                : 0

              if (
                boosterRule?.prerequisite_qty &&
                sumChangeQty < boosterRule.prerequisite_qty
              ) {
                const vaccineMethod = await c.var.trx
                  .selectFrom("rabies_vaccine_methods")
                  .select(["id", "title"])
                  .where("id", "=", material.vaccine_method)
                  .executeTakeFirst()

                const sequenceData = await c.var.trx
                  .selectFrom("rabies_vaccine_rules")
                  .select(["id", "title"])
                  .where("id", "=", patient.vaccine_sequence)
                  .executeTakeFirst()

                // Get the patient's current vaccine sequence
                const currentPatientSequenceData = patientId
                  ? await c.var.trx
                      .selectFrom("ws_patient_rabies")
                      .select("vaccine_sequence")
                      .where("patient_id", "=", patientId)
                      .orderBy("vaccine_sequence", "desc")
                      .executeTakeFirst()
                  : null

                // Get the next_sequence from the current sequence
                let firstNextSequence: number | null = null
                let firstNextSequenceTitle = ""

                if (currentPatientSequenceData?.vaccine_sequence) {
                  const lastSequenceRule = await c.var.trx
                    .selectFrom("rabies_vaccine_rules")
                    .select("next_sequence")
                    .where(
                      "id",
                      "=",
                      currentPatientSequenceData.vaccine_sequence
                    )
                    .executeTakeFirst()

                  if (lastSequenceRule && lastSequenceRule.next_sequence) {
                    // Get the first sequence in the next_sequence list
                    const nextSequences = lastSequenceRule.next_sequence
                      .split(",")
                      .map(Number)

                    if (
                      nextSequences.length > 0 &&
                      nextSequences[0] !== undefined
                    ) {
                      firstNextSequence = nextSequences[0]

                      // Get the title of the first next sequence
                      const firstNextSequenceData = await c.var.trx
                        .selectFrom("rabies_vaccine_rules")
                        .select("title")
                        .where("id", "=", firstNextSequence)
                        .executeTakeFirst()

                      if (firstNextSequenceData) {
                        firstNextSequenceTitle = firstNextSequenceData.title
                      }
                    }
                  }
                }

                const canBypassQtyValidation =
                  sumChangeQty === 1 &&
                  firstNextSequence !== null &&
                  patient.other_sequences?.some(
                    (os) => os.vaccine_sequence === firstNextSequence
                  )

                if (!canBypassQtyValidation) {
                  conditionsMessageWithData(
                    ctx,
                    {
                      message: c.var.t(
                        "validator.invalid_vaccine_sequence_qty"
                      ),
                      data: [
                        {
                          vaccine_method: material.vaccine_method,
                          vaccine_method_title: vaccineMethod?.title || "",
                          vaccine_sequence:
                            firstNextSequence || sequenceData!.id,
                          vaccine_sequence_title:
                            firstNextSequenceTitle || sequenceData!.title || "",
                          actual_transaction_date: null,
                          prerequisite_qty: boosterRule.prerequisite_qty,
                          provided_qty: sumChangeQty,
                        },
                      ],
                    },
                    true,
                    [`materials.${materialIdx}.patients.${patientIdx}`]
                  )

                  // Set isValid to false to skip further validations
                  isValid = false
                  hasQuantityValidationError = true
                }
              }
            }

            if (!isValid && !hasQuantityValidationError) {
              const vaccineMethod = await c.var.trx
                .selectFrom("rabies_vaccine_methods")
                .select(["id", "title"])
                .where("id", "=", material.vaccine_method)
                .executeTakeFirst()

              // Get all sequences except current one and sort ascending
              const previousSequences = vaccineRules
                .filter((rule) => rule.id !== patient.vaccine_sequence)
                .sort((a, b) => a.id - b.id)

              const sequenceData = await Promise.all(
                previousSequences
                  .filter(
                    (rule) =>
                      rule.id !== currentPatientSequence?.vaccine_sequence
                  )
                  .map((rule) =>
                    c.var.trx
                      .selectFrom("rabies_vaccine_rules")
                      .select(["id", "title"])
                      .where("id", "=", rule.id)
                      .executeTakeFirst()
                  )
              )

              // Check if patient has other_sequences covering all required sequences from sequenceData
              const shouldBypassValidation =
                patient.other_sequences &&
                sequenceData.every(
                  (sd) =>
                    sd?.id &&
                    patient.other_sequences?.some(
                      (os) => os.vaccine_sequence === sd.id
                    )
                )

              if (!shouldBypassValidation && sequenceData.length > 0) {
                conditionsMessageWithData(
                  ctx,
                  {
                    message: c.var.t("validator.invalid_vaccine_sequence"),
                    data: sequenceData
                      .filter((x) => x)
                      .map((rule) => ({
                        vaccine_method: material.vaccine_method,
                        vaccine_method_title: vaccineMethod?.title || "",
                        vaccine_sequence: rule!.id,
                        vaccine_sequence_title: rule!.title || "",
                        actual_transaction_date: null,
                      })),
                  },
                  true,
                  [`materials.${materialIdx}.patients.${patientIdx}`]
                )
              }
            }
          }
        }
      }

      if (!parsed.success) {
        c.set(
          "errors",
          formatErrorsWithData(parsed.error, c.var.t, "consumption-rabies")
        )
        throw new ValidationError()
      }

      return input
    }, ConsumptionRequestSchema)
  }
}
