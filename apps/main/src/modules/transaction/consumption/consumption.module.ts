import { DEVICE_TYPE } from "@/common/constants/device.js"
import { PROTOCOL_TYPE } from "@/common/constants/general.js"
import {
  TRANSACTION_CHANGE_TYPE,
  TRANSACTION_TYPE,
} from "@/common/constants/transaction.js"
import { BatchRepository } from "@/modules/batch/batch.repository.js"
import { StockRepository } from "@/modules/stock/stock.repository.js"
import { Context } from "hono"
import { InsertResult, UpdateResult } from "kysely"
import { TransactionPublisher } from "../transaction.publisher.js"
import { PublishTrxDTO } from "../transaction.schema.js"
import { ConsumptionRepository } from "./consumption.repository.js"
import {
  ConsumptionMaterialRequestSchema,
  ConsumptionRequest,
} from "./consumption.schema.js"
import moment from "moment"

interface SequenceGroup {
  id: number
  title: string
  methods: Record<
    number,
    {
      id: number
      title: string
      is_multi_patient: number
      sequences: Array<{
        id: number
        title: string
        min: number
        max: number
      }>
    }
  >
}

type OperationResult = InsertResult | UpdateResult[] | void

const VACCINE_METHOD = {
  INTRAMUSCULAR: 1,
  INTRADERMAL: 2,
}

const VACCINE_TYPE = {
  PREP: 1,
  PEP: 2,
  BOOSTER: 3,
}

export class ConsumptionModule {
  constructor(
    private readonly repository: ConsumptionRepository,
    private readonly stockRepo: StockRepository,
    private readonly batchRepo: BatchRepository,
    private readonly publisher: TransactionPublisher
  ) {}

  readonly #setNegative = (value: number) => value * -1

  readonly injectionCount = (vaccine_method, vaccine_type, dose) => {
    if (vaccine_method === VACCINE_METHOD.INTRADERMAL)
      return vaccine_type === VACCINE_TYPE.BOOSTER ? 1 : 2
    else return dose
  }

  readonly #getChangeQty = (
    transactionType: number,
    changeQty: number,
    currentQty: number = 0
  ) => {
    const changeVal =
      transactionType === TRANSACTION_CHANGE_TYPE.REMOVE
        ? this.#setNegative(changeQty)
        : changeQty
    const newVal =
      transactionType === TRANSACTION_CHANGE_TYPE.RESTOCK
        ? changeQty
        : currentQty + changeVal

    return {
      changeQty: changeVal,
      newQty: newVal,
    }
  }

  async consumption(c: Context, body: ConsumptionRequest) {
    const { userId, programId } = c.var
    const deviceType = c.req.header("device-type")
    const publishMessages: PublishTrxDTO[] = []

    let insertId: bigint | undefined

    const {
      entity_id,
      activity_id,
      customer_id,
      actual_transaction_date,
      materials,
    } = body

    const transactionType = await this.repository.findWsTransactionTypeById(
      c,
      TRANSACTION_TYPE.CONSUMPTION
    )

    const entityActivity =
      await this.repository.findWsEntityActivityByEntityAndActivity(
        c,
        entity_id,
        activity_id,
        programId
      )

    for (const material of materials) {
      const stock = await this.repository.findWsStockByIds(
        c,
        [material.stock_id!],
        programId
      )

      const protocol = await this.repository.getProtocol(
        c,
        activity_id,
        material.material_id
      )

      const batch = await this.batchRepo.findOne(c, {
        id: stock[0]?.batch_id ?? 0,
      })

      const qty = this.#getChangeQty(
        Number(transactionType?.change_type),
        material.qty ?? material.close_vial ?? 0,
        stock[0]?.qty ?? 0
      )

      // Process all jumping transactions before main transaction

      const consumptionResults =
        (await this.doProcessJumpingTransaction(
          c,
          {
            activity_id: activity_id,
            entity_id: entity_id,
            entity_activity_id: entityActivity?.id || null,
            transaction_type_id: transactionType?.id || null,
            opening_qty: stock[0]?.qty ?? 0,
            device_type: deviceType,
            user_id: userId!,
            batch_code: batch?.code || "",
            customer_id,
          },
          publishMessages,
          material
        )) ?? {}

      let qtyOpenVial = { changeQty: 0, newQty: 0 }
      const payloadQty = {
        qty: qty.newQty,
      }
      if (!!material?.open_vial && material?.open_vial > 0) {
        qtyOpenVial = this.#getChangeQty(
          Number(transactionType?.change_type ?? 0),
          material.open_vial,
          stock[0]?.open_vial_qty ?? 0
        )

        payloadQty["open_vial_qty"] = qtyOpenVial.newQty
      }

      // Create main transaction with actual quantity
      const operations: Promise<OperationResult>[] = [
        this.repository.create(c, {
          activity_id: activity_id,
          entity_id: entity_id,
          stock_id: material.stock_id,
          transaction_reason_id: null,
          transaction_type_id: transactionType?.id ?? null,
          order_id: null,
          change_qty: qty.changeQty,
          change_qty_open_vial: qtyOpenVial.changeQty,
          opening_qty: stock[0]?.qty ?? 0,
          opening_qty_open_vial: stock[0]?.open_vial_qty ?? 0,
          created_at: new Date(),
          created_by: userId!,
          updated_at: new Date(),
          updated_by: userId!,
          deleted_at: null,
          deleted_by: null,
          actual_transaction_date: actual_transaction_date,
          commit_datetime: null,
          device_type: deviceType ? DEVICE_TYPE[deviceType] : null,
          entity_activity_id: entityActivity?.id,
          companion_entity_id: customer_id,
          batch_code: batch?.code ?? null,
          status: 1,
          transaction_companion: null,
          returnable: 1,
        }),

        this.stockRepo.update(c, payloadQty, {
          id: material.stock_id!,
        }),
      ]

      // Require patient data
      if (
        (material.identity_type || material.patients) &&
        protocol?.is_patient_needed
      ) {
        const patientsToProcess = material.patients?.length
          ? material.patients
          : [
              {
                identity_type: material.identity_type!,
                identity_number: material.identity_number!,
                name: undefined!,
                phone_number: material.phone_number!,
                vaccine_sequence: undefined,
                other_sequences: undefined,
                gender: undefined,
                birth_date: undefined,
                marital_status: undefined,
                religion_id: undefined,
                ethnic_id: undefined,
                residential_address: undefined,
                education_id: undefined,
                occupation_id: undefined,
                address: undefined,
                province_id: undefined,
                regency_id: undefined,
                subdistrict_id: undefined,
                village_id: undefined,
                pos_code: undefined,
                rt: undefined,
                rw: undefined,
                residential_province_id: undefined,
                residential_regency_id: undefined,
                residential_subdistrict_id: undefined,
                residential_village_id: undefined,
                reaction_id: undefined,
                other_reaction: undefined,
                is_diagnose_before: undefined,
                diagnosis_date: undefined,
                month_before: undefined,
                year_before: undefined,
                received_medicine: undefined,
                received_vaccine: undefined,
                notes: undefined,
              },
            ]

        for (const patientData of patientsToProcess) {
          if (patientData.identity_type && patientData.identity_number) {
            operations.push(
              (async () => {
                const patient = await this.repository.updateOrCreatePatient(c, {
                  identity_type: patientData.identity_type,
                  identity_number: patientData.identity_number,
                  name: patientData.name || null,
                  phone_number: patientData.phone_number,
                  gender: patientData.gender || null,
                  birth_date: patientData.birth_date?.toString() || null,
                  marital_status: patientData.marital_status || 0,
                  religion_id: patientData.religion_id || null,
                  ethnic_id: patientData.ethnic_id || null,
                  residential_address: patientData.residential_address || null,
                  education_id: patientData.education_id || null,
                  occupation_id: patientData.occupation_id || null,
                  address: patientData.address || null,
                  province_id: patientData.province_id || null,
                  regency_id: patientData.regency_id || null,
                  subdistrict_id: patientData.subdistrict_id || null,
                  village_id: patientData.village_id || null,
                  pos_code: patientData.pos_code || null,
                  rt: patientData.rt || null,
                  rw: patientData.rw || null,
                  residential_province_id:
                    patientData.residential_province_id || null,
                  residential_regency_id:
                    patientData.residential_regency_id || null,
                  residential_subdistrict_id:
                    patientData.residential_subdistrict_id || null,
                  residential_village_id:
                    patientData.residential_village_id || null,
                })

                const patientId = patient.insertId
                  ? Number(patient.insertId)
                  : await this.repository.getPatientIdByIdentity(
                      c,
                      patientData.identity_type,
                      patientData.identity_number
                    )

                const transactionResult = (await operations[0]) as InsertResult

                const sequenceData = patientData.vaccine_sequence
                  ? await this.repository.findSequenceById(
                      c,
                      Number(patientData.vaccine_sequence)
                    )
                  : null

                const nextVaccineDate = sequenceData
                  ? moment(actual_transaction_date)
                      .add(sequenceData.next_duration || 1, "days")
                      .toDate()
                  : null

                const actual_qty = material.qty ?? material.close_vial ?? 0

                const injection_count = this.injectionCount(
                  material.vaccine_method,
                  material.vaccine_type,
                  actual_qty
                )

                const consumtionResult =
                  await this.repository.createConsumption(c, {
                    transaction_id: Number(transactionResult.insertId),
                    patient_id: patientId,
                    protocol_id: protocol?.protocol_id || null,
                    vaccine_sequence_id: patientData.vaccine_sequence
                      ? Number(patientData.vaccine_sequence)
                      : null,
                    vaccine_method_id: material.vaccine_method
                      ? Number(material.vaccine_method)
                      : null,
                    vaccine_type_id: material.vaccine_type
                      ? Number(material.vaccine_type)
                      : null,
                    stop_notification: nextVaccineDate ? 0 : null,
                    actual_date: actual_transaction_date,
                    actual_qty: actual_qty,
                    created_by: userId!,
                    updated_by: userId!,
                    next_vaccine_date: nextVaccineDate,
                    injection_count,
                  })

                if (
                  consumtionResult &&
                  consumtionResult.insertId &&
                  consumptionResults[patientData.identity_number] &&
                  consumptionResults[patientData.identity_number].length
                ) {
                  // update jumped data ws_consumptions
                  await c.var.trx
                    .updateTable("ws_consumptions")
                    .set({
                      patient_id: patientId,
                      reference_consumption_id: Number(
                        consumtionResult.insertId
                      ),
                      protocol_id: protocol?.protocol_id,
                    })
                    .where(
                      "id",
                      "in",
                      consumptionResults[patientData.identity_number].map(
                        (it) => Number(it.insertId)
                      )
                    )
                    .execute()
                }

                // Create reaction if available
                if (
                  consumtionResult &&
                  consumtionResult.insertId &&
                  protocol?.is_kipi
                ) {
                  await this.repository.createConsumptionReaction(
                    c,
                    Number(consumtionResult.insertId),
                    {
                      reaction_id: patientData.reaction_id || 0,
                      other_reaction: patientData.other_reaction || "",
                      actual_date: actual_transaction_date,
                    }
                  )
                }

                if (
                  consumtionResult &&
                  consumtionResult.insertId &&
                  protocol?.is_medical_history
                ) {
                  await this.repository.createPatientMedicalHistory(
                    c,
                    patientId,
                    Number(protocol.protocol_id),
                    {
                      is_diagnose_before:
                        patientData.is_diagnose_before || null,
                      diagnosis_date: patientData.diagnosis_date || null,
                      month_before: patientData.month_before || null,
                      year_before: patientData.year_before || null,
                      received_medicine: patientData.received_medicine || null,
                      received_vaccine: patientData.received_vaccine || null,
                      notes: patientData.notes || "",
                    }
                  )
                }
              })()
            )
          }
        }
      }

      const [transaction] = await Promise.all(operations)
      if (transaction && "insertId" in transaction) {
        insertId = transaction.insertId
        publishMessages.push({
          id: Number(transaction.insertId),
          rabies: {
            vaccine_method: material.vaccine_method,
            patients: material.patients,
          },
        })
      }
    }

    await this.publisher.processCreate(c, publishMessages)
    return {
      success: "ok",
      message: "Consumption has been created",
      data: {
        insertId: Number(insertId),
        actual_transaction_date,
      },
    }
  }

  async doProcessJumpingTransaction(
    c,
    data: {
      activity_id: number
      entity_id: number
      entity_activity_id: number | null
      transaction_type_id: number | null
      opening_qty: number
      user_id: number
      device_type: string | undefined
      batch_code: string | ""
      customer_id: number
    },
    publishMessages,
    material: ConsumptionMaterialRequestSchema
  ) {
    if (!material.patients || !material.patients.length) return null
    const operationData = {}

    for (const patientData of material.patients) {
      if (patientData.other_sequences?.length) {
        const otherSequences = patientData.other_sequences.filter(
          (os) => os.actual_transaction_date
        )
        operationData[patientData.identity_number] = []
        for (let i = 0; i < otherSequences.length; i++) {
          const seq = otherSequences[i]

          const zeroTransaction = await this.repository.create(c, {
            activity_id: data.activity_id,
            entity_id: data.entity_id,
            stock_id: material.stock_id,
            transaction_reason_id: null,
            transaction_type_id: data.transaction_type_id ?? null,
            order_id: null,
            change_qty: 0,
            opening_qty: data.opening_qty ?? 0,
            created_at: new Date(),
            created_by: data.user_id,
            updated_at: new Date(),
            updated_by: data.user_id,
            deleted_at: null,
            deleted_by: null,
            actual_transaction_date: seq?.actual_transaction_date,
            commit_datetime: null,
            device_type: data.device_type
              ? DEVICE_TYPE[data.device_type]
              : null,
            entity_activity_id: data.entity_activity_id,
            companion_entity_id: data.customer_id,
            batch_code: data.batch_code ?? null,
            status: 1,
            transaction_companion: null,
            returnable: 1,
          })

          // Get actual qty for consumption from vaccine rules
          const prevSeq = Number(seq?.vaccine_sequence)
          const nextSeq =
            i === otherSequences.length - 1
              ? patientData.vaccine_sequence
              : otherSequences[i + 1]?.vaccine_sequence
          const { actualQty, method_id, type_id } =
            await this.repository.findActualQtyFromSequence(
              c,
              prevSeq,
              Number(nextSeq)
            )

          const sequenceData = await this.repository.findSequenceById(
            c,
            Number(seq?.vaccine_sequence)
          )
          const nextVaccineDate = sequenceData
            ? moment(seq?.actual_transaction_date)
                .add(sequenceData.next_duration || 1, "days")
                .toDate()
            : null

          const injection_count = this.injectionCount(method_id, type_id, actualQty)

          operationData[patientData.identity_number].push(
            await this.repository.createConsumption(c, {
              transaction_id: Number(zeroTransaction.insertId),
              patient_id: 0,
              protocol_id: PROTOCOL_TYPE.RABIES,
              vaccine_sequence_id: Number(seq?.vaccine_sequence),
              vaccine_method_id: method_id,
              vaccine_type_id: type_id,
              actual_date: seq?.actual_transaction_date || null,
              actual_qty: actualQty,
              stop_notification: nextVaccineDate ? 0 : null,
              created_by: data.user_id!,
              updated_by: data.user_id!,
              next_vaccine_date: nextVaccineDate,
              injection_count
            })
          )

          publishMessages.push({
            id: Number(zeroTransaction.insertId),
            rabies: {
              is_other_sequence: true,
            },
          })
        }
      }
    }

    return operationData
  }
}
