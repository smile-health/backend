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
import { ConsumptionRepository } from "./consumption.repository.js"
import { ConsumptionRequestSchema } from "./consumption.schema.js"
import moment from "moment"

export class ConsumptionMiddleware {
  constructor(
    private readonly repo: ConsumptionRepository,
    private readonly transactionRepo: TransactionRepository,
    private readonly activityRepo: ActivityRepository,
    private readonly entityActivityRepo: EntityActivityRepository
  ) {}

  logErrors = TransactionErrorHandler.logErrors

  async validateOtherSequences(
    c: Context,
    ctx: RefinementCtx,
    currentSequenceId: number | null,
    patient: any,
    materialIdx: number,
    patientIdx: number,
    prequisiteQty?: number
  ) {
    if (!patient.other_sequences || patient.other_sequences.length <= 0) return
    const otherSequences = patient.other_sequences
      .filter((it) => it.actual_transaction_date)
      .map((it) => it.vaccine_sequence)

    if (otherSequences.length <= 0) {
      conditionsMessage(
        ctx,
        c.var.t("validator.date_other_sequences_cannot_empty"),
        true,
        [`materials.${materialIdx}.patients.${patientIdx}.other_sequences`]
      )
      return
    }

    otherSequences.push(patient.vaccine_sequence)

    const dataSequences: Array<{
      prev: number | null
      next: any
      before: number | null
      prequisiteQty: number | null | undefined
    }> = []

    dataSequences.push({
      prev: currentSequenceId,
      next: otherSequences[0],
      before: null,
      prequisiteQty,
    })

    let beforeSequenceId = currentSequenceId

    for (let i = 0; i < otherSequences.length - 1; i++) {
      dataSequences.push({
        prev: otherSequences[i],
        next: otherSequences[i + 1],
        before: beforeSequenceId,
        prequisiteQty: null,
      })

      beforeSequenceId = otherSequences[i]
    }

    for (const [idx, sequence] of dataSequences.entries()) {
      let query = c.var.trx
        .selectFrom("ws_vaccine_rules")
        .select(["id"])
        .where("deleted_at", "is", null)
        .where((eb) =>
          eb.or([
            eb("other_sequences", "is", null),
            eb("other_sequences", "=", ""),
          ])
        )

      if (sequence.prev)
        query = query.where("previous_sequence", "=", sequence.prev)
      else query = query.where("previous_sequence", "is", null)

      if (sequence.next)
        query = query.where("next_sequence", "=", sequence.next)
      else query = query.where("next_sequence", "is", null)

      if (sequence.prequisiteQty)
        query = query.where((eb) =>
          eb.or([
            eb("prerequisite_qty", "=", Number(sequence.prequisiteQty)),
            eb("prerequisite_qty", "is", null),
          ])
        )

      if (sequence.before)
        query = query.where((eb) =>
          eb.or([
            eb("before_sequence", "=", sequence.before),
            eb("before_sequence", "is", null),
          ])
        )

      const rule = await query.executeTakeFirst()

      if (!rule) {
        conditionsMessage(
          ctx,
          c.var.t("validator.invalid_other_sequences"),
          true,
          [`materials.${materialIdx}.patients.${patientIdx}.other_sequences`]
        )

        return
      }
    }
  }

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
          if (material.open_vial !== undefined && material.open_vial > 0) {
            conditionsMessage(
              ctx,
              c.var.t(`${materialIdx}`, "validator.invalid_unused_open_vial"),
              material.close_vial !== undefined &&
                material.close_vial > 0 &&
                material.open_vial !== stockData[stockIndex]?.open_vial_qty,
              [`materials.${materialIdx}.open_vial`]
            )

            conditionsMessage(
              ctx,
              c.var.t(
                `${materialIdx}`,
                "validator.submit_return_invalid_open_vial"
              ),
              Number(material.open_vial) >
                Number(stockData[stockIndex]?.open_vial_qty),
              [`materials.${materialIdx}.open_vial`]
            )
          }

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

          const protocol = await this.repo.getProtocol(
            c,
            data.activity_id,
            material.material_id
          )

          if (!protocol?.is_patient_needed) continue

          if (
            protocol.is_patient_needed &&
            (!material.patients || !material.patients.length)
          ) {
            conditionsMessage(
              ctx,
              c.var.t("validator.required", {
                field: c.var.t("transaction.label.patient"),
              }),
              true,
              [`material.${materialIdx}`]
            )
            continue
          }

          for (const [patientIdx, patient] of (
            material.patients || []
          ).entries()) {
            conditionsMessage(
              ctx,
              c.var.t("validator.vaccine_no_need_sequence"),
              !protocol.protocol_id && !!patient.vaccine_sequence,
              [`materials.${materialIdx}.patients.${patientIdx}`]
            )

            if (!protocol.protocol_id) continue

            if (!patient.vaccine_sequence) {
              conditionsMessage(
                ctx,
                c.var.t("validator.required", {
                  field: c.var.t("transaction.label.vaccine_sequence"),
                }),
                true,
                [`materials.${materialIdx}.patients.${patientIdx}`]
              )
              continue
            }

            const patientId = await this.repo
              .getPatientIdByIdentity(
                c,
                patient.identity_type,
                patient.identity_number
              )
              .catch(() => null)

            let currentSequenceId
            let oldSequenceId
            let prequisiteQty

            let queryRules = c.var.trx
              .selectFrom("ws_vaccine_rules")
              .selectAll()
              .where("next_sequence", "=", patient.vaccine_sequence)

            const dataNextSequence = await this.repo.findSequenceById(
              c,
              patient.vaccine_sequence
            )

            let isExpired = false

            if (patientId) {
              const checkSequenceExist = await this.checkIfSequenceExist(
                c,
                patientId,
                patient,
                data.actual_transaction_date
              )

              if (checkSequenceExist) {
                conditionsMessage(
                  ctx,
                  c.var.t("validator.patient_vaccine_sequence_exist"),
                  true,
                  [`transactions`]
                )
                continue
              }

              // Get the patient's current vaccine sequence and last vaccine date
              const currentPatientVaccine = await c.var.trx
                .selectFrom("ws_consumptions")
                .select(["vaccine_sequence_id", "actual_qty", "actual_date"])
                .where("patient_id", "=", patientId)
                .where("protocol_id", "=", protocol?.protocol_id)
                .where("deleted_at", "is", null)
                .orderBy("actual_date", "desc")
                .executeTakeFirst()

              if (currentPatientVaccine?.vaccine_sequence_id) {
                // Calculate days difference between last vaccine and current transaction
                const previousSequence = await this.repo.findSequenceById(
                  c,
                  currentPatientVaccine.vaccine_sequence_id
                )
                const lastVaccineDate = new Date(
                  moment(currentPatientVaccine.actual_date).format(
                    "YYYY-MM-DD HH:mm:ss"
                  )
                )

                const actualDate = new Date(data.actual_transaction_date)
                const daysDiff = Math.floor(
                  (actualDate.getTime() - lastVaccineDate.getTime()) /
                    (1000 * 60 * 60 * 24)
                )

                // Check if the difference exceeds active_duration

                const activeDuration = Number(
                  previousSequence?.active_duration ?? 0
                )
                isExpired = activeDuration > 0 && daysDiff > activeDuration

                if (isExpired && !dataNextSequence?.is_start_sequence) {
                  conditionsMessage(
                    ctx,
                    c.var.t("validator.active_duration_exceeded", {
                      days: previousSequence?.active_duration,
                      actual: daysDiff,
                    }),
                    true,
                    [`transactions`]
                  )
                  // Skip further validation for this patient
                  continue
                } else if (isExpired && dataNextSequence?.is_start_sequence) {
                  continue
                }

                const currentSequence =
                  currentPatientVaccine?.vaccine_sequence_id || null
                queryRules = queryRules.where(
                  "previous_sequence",
                  "=",
                  currentSequence
                )

                currentSequenceId = currentSequence

                // get old sequence before previos sequence
                const oldPatientSequence = await c.var.trx
                  .selectFrom("ws_consumptions")
                  .select(["vaccine_sequence_id"])
                  .where("patient_id", "=", patientId)
                  .where("protocol_id", "=", protocol.protocol_id)
                  .where(
                    "vaccine_sequence_id",
                    "!=",
                    currentPatientVaccine.vaccine_sequence_id
                  )
                  .where("vaccine_sequence_id", "is not", null)
                  .where("deleted_at", "is", null)
                  .orderBy("actual_date", "desc")
                  .executeTakeFirst()

                oldSequenceId = oldPatientSequence?.vaccine_sequence_id

                // Get rules based on prerequisite_qty
                if (currentPatientVaccine.actual_qty) {
                  prequisiteQty = currentPatientVaccine.actual_qty
                  queryRules = queryRules.where((eb) =>
                    eb.or([
                      eb(
                        "prerequisite_qty",
                        "=",
                        currentPatientVaccine.actual_qty
                      ),
                      eb("prerequisite_qty", "is", null),
                    ])
                  )
                }

                if (oldPatientSequence)
                  queryRules = queryRules
                    .where((eb) =>
                      eb.or([
                        eb(
                          "before_sequence",
                          "=",
                          oldPatientSequence.vaccine_sequence_id
                        ),
                        eb("before_sequence", "is", null),
                      ])
                    )
                    .orderBy("before_sequence", "desc")
              } else {
                queryRules = queryRules.where("previous_sequence", "is", null)
              }
            } else {
              queryRules = queryRules.where("previous_sequence", "is", null)
            }

            const vaccineRule = await queryRules.executeTakeFirst()

            await this.validateOtherSequences(
              c,
              ctx,
              currentSequenceId,
              patient,
              materialIdx,
              patientIdx,
              prequisiteQty
            )

            if (vaccineRule) {
              if (
                vaccineRule.other_sequences &&
                (!patient.other_sequences ||
                  patient.other_sequences.length <= 0)
              ) {
                const otherSequencesIds =
                  typeof vaccineRule.other_sequences === "object"
                    ? vaccineRule.other_sequences
                    : JSON.parse(vaccineRule.other_sequences)
                const otherSequences = await this.repo.getOtherSequences(
                  c,
                  otherSequencesIds
                )

                conditionsMessageWithData(
                  ctx,
                  {
                    message: c.var.t(
                      "validator.invalid_vaccine_sequence_jump",
                      {
                        field1: otherSequences[0]?.title,
                        field2: dataNextSequence?.title,
                      }
                    ),
                    data: otherSequences
                      .filter((x) => x)
                      .map((seq) => ({
                        protocol_id: protocol.protocol_id,
                        is_kipi: protocol.is_kipi,
                        vaccine_sequence: seq.id,
                        vaccine_sequence_title: seq.title || "",
                        vaccine_type: seq.type_id,
                        vaccine_type_title: seq.type_title || "",
                        vaccine_method: seq.method_id,
                        vaccine_method_title: seq.method_title || "",
                        date: null,
                      })),
                  },
                  true,
                  [`materials.${materialIdx}.patients.${patientIdx}`]
                )
              }

              continue
            }

            if (currentSequenceId) {
              const ruleCompleted = await c.var.trx
                .selectFrom("ws_vaccine_rules")
                .selectAll()
                .where("previous_sequence", "=", currentSequenceId)
                .executeTakeFirst()

              if (!ruleCompleted) {
                conditionsMessage(
                  ctx,
                  c.var.t("validator.vaccine_sequence_completed", {
                    field1: patient.identity_number,
                  }),
                  true,
                  [`transactions`]
                )

                continue
              }
            }

            if (
              !patient.other_sequences ||
              patient.other_sequences.length <= 0
            ) {
              const dataSequences = await this.repo.getSequenceIds(
                c,
                currentSequenceId,
                oldSequenceId,
                patient.vaccine_sequence,
                prequisiteQty
              )

              if (dataSequences.previous_sequences.length > 0) {
                const otherSequences = await this.repo.getOtherSequences(
                  c,
                  dataSequences.previous_sequences
                )

                conditionsMessageWithData(
                  ctx,
                  {
                    message: c.var.t(
                      "validator.invalid_vaccine_sequence_jump",
                      {
                        field1: otherSequences[0]?.title,
                        field2: dataNextSequence?.title,
                      }
                    ),
                    data: otherSequences
                      .filter((x) => x)
                      .map((seq) => ({
                        protocol_id: protocol.protocol_id,
                        is_kipi: protocol.is_kipi,
                        vaccine_sequence: seq.id,
                        vaccine_sequence_title: seq.title || "",
                        vaccine_type: seq.type_id,
                        vaccine_type_title: seq.type_title || "",
                        vaccine_method: seq.method_id,
                        vaccine_method_title: seq.method_title || "",
                        date: null,
                      })),
                  },
                  true,
                  [`materials.${materialIdx}.patients.${patientIdx}`]
                )
              } else if (dataSequences.next_sequences.length > 0) {
                const otherSequences = await this.repo.getOtherSequences(
                  c,
                  dataSequences.next_sequences.slice(0, 1)
                )

                conditionsMessage(
                  ctx,
                  c.var.t("validator.invalid_vaccine_sequence", {
                    field1: otherSequences[0]?.title,
                  }),
                  true,
                  [`transactions`]
                )
              } else {
                conditionsMessage(
                  ctx,
                  c.var.t("validator.wrong_vaccine_sequence"),
                  true,
                  [`transactions`]
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

  async checkIfSequenceExist(c, patientId, patient, actual_transaction_date) {
    // First check if this sequence already exists in ws_patient
    const existingSequence = patientId
      ? await c.var.trx
          .selectFrom("ws_consumptions as wc")
          .innerJoin(
            "ws_vaccine_sequences as wvs",
            "wvs.id",
            "wc.vaccine_sequence_id"
          )
          .select([
            "wc.vaccine_sequence_id as vaccine_sequence_id",
            "wc.actual_date as actual_date",
            "wvs.active_duration as active_duration",
          ])
          .where("wc.patient_id", "=", patientId)
          .where("wc.vaccine_sequence_id", "=", patient.vaccine_sequence)
          .where("wc.deleted_at", "is", null)
          .executeTakeFirst()
      : null

    if (!existingSequence) return false

    const lastVaccineDate = new Date(
      moment(existingSequence.actual_date).format("YYYY-MM-DD HH:mm:ss")
    )

    const actualDate = new Date(actual_transaction_date)
    const daysDiff = Math.floor(
      (actualDate.getTime() - lastVaccineDate.getTime()) / (1000 * 60 * 60 * 24)
    )

    // Check if the difference exceeds active_duration

    const activeDuration = Number(existingSequence?.active_duration ?? 0)
    const isExpired = activeDuration && daysDiff > activeDuration

    return existingSequence && !isExpired
  }
}
