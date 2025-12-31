import { collect } from "@smile/lib/utils.js"
import { Kysely, Transaction } from "kysely"
import { getMapPatientIds, getMapSequenceIds } from "../../../helper.js"
import { MigrationDB } from "../../../types.js"
import { DB } from "../../../types.platform.js"

export const migrateConsumptions = async (
  trx: Transaction<DB>,
  migrationDB: Kysely<MigrationDB>,
  programId: number,
  trxIds: number[],
  mapGlobalIds = {}
) => {
  // get consumption patients from old table
  const consumptionPatients = await migrationDB
    .selectFrom("transaction_patients as tp")
    .innerJoin("patients as p", "p.id", "tp.patient_id")
    .selectAll("tp")
    .where("tp.transaction_id", "in", trxIds)
    .where("tp.transaction_type_id", "=", 2)
    .execute()

  if (consumptionPatients.length === 0) {
    return
  }

  const mapPatientIds = getMapPatientIds(
    programId,
    collect(consumptionPatients, "patient_id")
  )

  // insert consumption patients to new table
  const consumptionResult = await trx
    .insertInto("ws_consumptions")
    .values(
      consumptionPatients.map((consumptionPatient) => {
        const mapVaccineSequence = getMapSequenceIds(
          consumptionPatient.vaccine_method,
          consumptionPatient.vaccine_sequence
        )
        return {
          transaction_id: mapGlobalIds[consumptionPatient.transaction_id],
          patient_id: mapPatientIds[consumptionPatient.patient_id],
          protocol_id: consumptionPatient.vaccine_method ? 1 : 2,
          vaccine_sequence_id: mapVaccineSequence.sequence_id,
          vaccine_type_id: mapVaccineSequence.type_id,
          vaccine_method_id: consumptionPatient.vaccine_method,
          actual_date: consumptionPatient.transaction_date,
          actual_qty: 1
        }
      })
    )
    .execute()

  // insert consumption reactions to new table
  const consumptionFirstId = Number((consumptionResult as any)[0]?.insertId ?? 0)
  const consumptionReactions: any[] = []
  for (const [idx, consumption] of consumptionPatients.entries()) {
    if (!consumption.reaction_id && !consumption.other_reaction) continue
    const consumptionId = consumptionFirstId + idx
    consumptionReactions.push({
      consumption_id: consumptionId,
      reaction_id: consumption.reaction_id,
      other_reaction: consumption.other_reaction,
      actual_date: consumption.transaction_date
    })
  }
}
