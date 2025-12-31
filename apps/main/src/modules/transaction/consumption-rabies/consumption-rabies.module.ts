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
import { ConsumptionRabiesRepository } from "./consumption-rabies.repository.js"
import { ConsumptionRequest } from "./consumption-rabies.schema.js"

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

export class ConsumptionRabiesModule {
  constructor(
    private readonly repository: ConsumptionRabiesRepository,
    private readonly stockRepo: StockRepository,
    private readonly batchRepo: BatchRepository,
    private readonly publisher: TransactionPublisher
  ) {}

  readonly #setNegative = (value: number) => value * -1

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

  async getRabiesSequences(c: Context) {
    const sequences = await this.repository.getRabiesVaccineSequences(c)

    const grouped = sequences.reduce<Record<number, SequenceGroup>>(
      (acc, row) => {
        const typeKey = row.type_id
        const methodKey = row.method_id

        if (!acc[typeKey]) {
          acc[typeKey] = {
            id: row.type_id,
            title: row.type_title,
            methods: {},
          }
        }

        if (!acc[typeKey].methods[methodKey]) {
          acc[typeKey].methods[methodKey] = {
            id: row.method_id,
            title: row.method_title,
            is_multi_patient: row.is_multi_patient,
            sequences: [],
          }
        }

        acc[typeKey].methods[methodKey].sequences.push({
          id: row.rule_id,
          title: row.rule_title,
          min: row.min,
          max: row.max,
        })

        return acc
      },
      {}
    )

    return Object.values(grouped).map((type) => ({
      ...type,
      methods: Object.values(type.methods),
    }))
  }

  async consumption(c: Context, body: ConsumptionRequest) {
    const { userId, programId } = c.var
    const deviceType = c.req.header("device-type")
    const publishMessages: PublishTrxDTO[] = []

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

      const batch = await this.batchRepo.findOne(c, {
        id: stock[0]?.batch_id ?? 0,
      })

      const qty = this.#getChangeQty(
        Number(transactionType?.change_type),
        material.qty ?? material.close_vial ?? 0,
        stock[0]?.qty ?? 0
      )

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
      if (material.identity_type || material.patients) {
        const patientsToProcess = material.patients?.length
          ? material.patients
          : [
              {
                identity_type: material.identity_type!,
                identity_number: material.identity_number!,
                phone_number: material.phone_number!,
                vaccine_sequence: undefined,
                other_sequences: undefined,
              },
            ]

        for (const patientData of patientsToProcess) {
          if (patientData.identity_type && patientData.identity_number) {
            operations.push(
              (async () => {
                const patient = await this.repository.updateOrCreatePatient(c, {
                  identity_type: patientData.identity_type,
                  identity_number: patientData.identity_number,
                  phone_number: patientData.phone_number,
                })

                const patientId = patient.insertId
                  ? Number(patient.insertId)
                  : await this.repository.getPatientIdByIdentity(
                      c,
                      patientData.identity_type,
                      patientData.identity_number
                    )

                const transactionResult = (await operations[0]) as InsertResult
                const consumption = await this.repository.createConsumption(c, {
                  transaction_id: Number(transactionResult.insertId),
                  patient_id: patientId,
                  protocol_id: PROTOCOL_TYPE.RABIES,
                })

                // Handle sequence data if present
                if (
                  material.vaccine_type &&
                  material.vaccine_method &&
                  patientData.vaccine_sequence
                ) {
                  await this.repository.updateOrCreatePatientRabies(c, {
                    patient_id: patientId,
                    vaccine_type: material.vaccine_type,
                    vaccine_method: material.vaccine_method,
                    vaccine_sequence: patientData.vaccine_sequence,
                    last_vaccine_at: actual_transaction_date,
                  })

                  await this.repository.createConsumptionRabies(c, {
                    consumption_id: Number(consumption.insertId),
                    vaccine_type: material.vaccine_type,
                    vaccine_method: material.vaccine_method,
                    vaccine_sequence: patientData.vaccine_sequence,
                  })

                  // Other sequences
                  if (patientData.other_sequences?.length) {
                    for (const seq of patientData.other_sequences) {
                      const zeroTransaction = await this.repository.create(c, {
                        activity_id: activity_id,
                        entity_id: entity_id,
                        stock_id: material.stock_id,
                        transaction_reason_id: null,
                        transaction_type_id: transactionType?.id ?? null,
                        order_id: null,
                        change_qty: 0,
                        opening_qty: stock[0]?.qty ?? 0,
                        created_at: new Date(),
                        created_by: userId!,
                        updated_at: new Date(),
                        updated_by: userId!,
                        deleted_at: null,
                        deleted_by: null,
                        actual_transaction_date: seq.actual_transaction_date,
                        commit_datetime: null,
                        device_type: deviceType
                          ? DEVICE_TYPE[deviceType]
                          : null,
                        entity_activity_id: entityActivity?.id,
                        companion_entity_id: customer_id,
                        batch_code: batch?.code ?? null,
                        status: 1,
                        transaction_companion: null,
                        returnable: 1,
                      })

                      const seqConsumption =
                        await this.repository.createConsumption(c, {
                          transaction_id: Number(zeroTransaction.insertId),
                          patient_id: Number(patientId),
                          protocol_id: PROTOCOL_TYPE.RABIES,
                        })

                      await this.repository.createConsumptionRabies(c, {
                        consumption_id: Number(seqConsumption.insertId),
                        vaccine_type: material.vaccine_type,
                        vaccine_method: material.vaccine_method,
                        vaccine_sequence: seq.vaccine_sequence,
                      })

                      publishMessages.push({
                        id: Number(zeroTransaction.insertId),
                        rabies: {
                          is_other_sequence: true,
                        },
                      })
                    }
                  }
                }
              })()
            )
          }
        }
      }

      const [transaction] = await Promise.all(operations)
      if (transaction && "insertId" in transaction) {
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
    return true
  }
}
