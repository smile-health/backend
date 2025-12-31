import { DB } from "@/common/infrastructure/database/types/db.js"
import { Context as CustomContext } from "@smile/lib/types/context.js"
import { Context } from "hono"
import { sql } from "kysely"
import { maritalStatus } from "../../../common/constants/marital-status.js"
import { BaseRepository } from "../../base.repository.js"
import {
  PatientResponseDTO,
  PatientVaccineSequenceResponseDTO,
  ReminderRow,
} from "./patient.schema.js"

export class PatientRepository extends BaseRepository<"ws_patients"> {
  constructor() {
    super("ws_patients")
  }

  async findByNik(
    c: Context,
    nik: string
  ): Promise<PatientResponseDTO | undefined> {
    const patient = await c.var.trx
      .selectFrom("ws_patients")
      .leftJoin("educations", (join) =>
        join
          .onRef("ws_patients.education_id", "=", "educations.id")
          .on("educations.deleted_at", "is", null)
      )
      .leftJoin("occupations", (join) =>
        join
          .onRef("ws_patients.occupation_id", "=", "occupations.id")
          .on("occupations.deleted_at", "is", null)
      )
      .leftJoin("religions", (join) =>
        join
          .onRef("ws_patients.religion_id", "=", "religions.id")
          .on("religions.deleted_at", "is", null)
      )
      .leftJoin("ethnics", (join) =>
        join
          .onRef("ws_patients.ethnic_id", "=", "ethnics.id")
          .on("ethnics.deleted_at", "is", null)
      )
      .leftJoin(
        "locations as province",
        "ws_patients.province_id",
        "province.id"
      )
      .leftJoin("locations as regency", "ws_patients.regency_id", "regency.id")
      .leftJoin(
        "locations as subdistrict",
        "ws_patients.subdistrict_id",
        "subdistrict.id"
      )
      .leftJoin("locations as village", "ws_patients.village_id", "village.id")
      .leftJoin(
        "locations as res_province",
        "ws_patients.residential_province_id",
        "res_province.id"
      )
      .leftJoin(
        "locations as res_regency",
        "ws_patients.residential_regency_id",
        "res_regency.id"
      )
      .leftJoin(
        "locations as res_subdistrict",
        "ws_patients.residential_subdistrict_id",
        "res_subdistrict.id"
      )
      .leftJoin(
        "locations as res_village",
        "ws_patients.residential_village_id",
        "res_village.id"
      )
      .where("ws_patients.nik", "=", nik)
      .where("ws_patients.deleted_at", "is", null)
      .select([
        "ws_patients.id",
        "ws_patients.nik",
        "ws_patients.name",
        "ws_patients.gender",
        "ws_patients.birth_date",
        "ws_patients.birth_date",
        "ws_patients.marital_status",
        "ws_patients.identity_type",
        "ws_patients.phone_number",
        "ws_patients.address",
        "ws_patients.residential_address",
        "ws_patients.pos_code",
        "ws_patients.rt",
        "ws_patients.rw",
        "ws_patients.education_id",
        "ws_patients.occupation_id",
        "ws_patients.religion_id",
        "ws_patients.ethnic_id",
        "ws_patients.entity_id",
        "ws_patients.created_at",
        "ws_patients.updated_at",
        "ws_patients.deleted_at",
        "educations.title as education_title",
        "occupations.title as occupation_title",
        "religions.title as religion_title",
        "ethnics.title as ethnic_title",
        "province.id as province_id",
        "province.name as province_name",
        "regency.id as regency_id",
        "regency.name as regency_name",
        "subdistrict.id as subdistrict_id",
        "subdistrict.name as subdistrict_name",
        "village.id as village_id",
        "village.name as village_name",
        "res_province.id as residential_province_id",
        "res_province.name as residential_province_name",
        "res_regency.id as residential_regency_id",
        "res_regency.name as residential_regency_name",
        "res_subdistrict.id as residential_subdistrict_id",
        "res_subdistrict.name as residential_subdistrict_name",
        "res_village.id as residential_village_id",
        "res_village.name as residential_village_name",
      ])
      .executeTakeFirst()

    if (!patient) return undefined

    return {
      id: patient.id,
      nik: patient.nik,
      name: patient.name,
      gender: patient.gender,
      birth_date: patient.birth_date,
      identity_type: patient.identity_type,
      phone_number: patient.phone_number,
      address: patient.address,
      residential_address: patient.residential_address,
      pos_code: patient.pos_code,
      rt: patient.rt,
      rw: patient.rw,
      marital_status: {
        id: patient.marital_status,
        title:
          maritalStatus.find((m) => m.id === patient.marital_status)?.title ??
          null,
      },
      education: {
        id: patient.education_id,
        title: patient.education_title,
      },
      occupation: {
        id: patient.occupation_id,
        title: patient.occupation_title,
      },
      religion: {
        id: patient.religion_id,
        title: patient.religion_title,
      },
      ethnic: {
        id: patient.ethnic_id,
        title: patient.ethnic_title,
      },
      location: {
        province: {
          id: patient.province_id,
          name: patient.province_name,
        },
        regency: {
          id: patient.regency_id,
          name: patient.regency_name,
        },
        subdistrict: {
          id: patient.subdistrict_id,
          name: patient.subdistrict_name,
        },
        village: {
          id: patient.village_id,
          name: patient.village_name,
        },
        residential_province: {
          id: patient.residential_province_id,
          name: patient.residential_province_name,
        },
        residential_regency: {
          id: patient.residential_regency_id,
          name: patient.residential_regency_name,
        },
        residential_subdistrict: {
          id: patient.residential_subdistrict_id,
          name: patient.residential_subdistrict_name,
        },
        residential_village: {
          id: patient.residential_village_id,
          name: patient.residential_village_name,
        },
      },
      entity_id: patient.entity_id,
      created_at: patient.created_at.toISOString(),
      updated_at: patient.updated_at.toISOString(),
    }
  }

  async findNextSequence(
    c: Context,
    patientId: number | null,
    sequenceId: number | null,
    protocolId: number | null,
    actualQty: number | null
  ) {
    const oldSequence = await c.var.trx
      .selectFrom("ws_consumptions")
      .select(["vaccine_sequence_id"])
      .where("patient_id", "=", patientId)
      .where("vaccine_sequence_id", "!=", sequenceId)
      .where("protocol_id", "=", protocolId)
      .where("deleted_at", "is", null)
      .orderBy("actual_date", "desc")
      .executeTakeFirst()

    let query = c.var.trx
      .selectFrom("ws_vaccine_rules as wvr")
      .innerJoin("ws_vaccine_sequences as wvs", "wvs.id", "wvr.next_sequence")
      .leftJoin("vaccine_methods as vm", "vm.id", "wvs.method_id")
      .leftJoin("vaccine_types as vt", "vt.id", "wvs.type_id")
      .select([
        "wvs.id as id",
        "wvs.title as title",
        "wvs.method_id as method_id",
        "vm.title as method_title",
        "vt.id as type_id",
        "vt.title as type_title",
        "wvs.min as min",
        "wvs.max as max",
      ])
      .where("wvr.previous_sequence", "=", sequenceId)
      .where("wvr.deleted_at", "is", null)
      .where("wvr.other_sequences", "is", null)
      .where((eb) =>
        eb.or([
          eb("wvr.prerequisite_qty", "=", actualQty),
          eb("wvr.prerequisite_qty", "is", null),
        ])
      )
      .orderBy("wvs.sort", "asc")

    if (oldSequence)
      query = query.where((eb) =>
        eb.or([
          eb("wvr.before_sequence", "=", oldSequence.vaccine_sequence_id),
          eb("wvr.before_sequence", "is", null),
        ])
      )

    return await query.executeTakeFirst()
  }

  async findVaccineSequenceByNik(
    c: Context,
    nik: string,
    protocol_id: string
  ): Promise<PatientVaccineSequenceResponseDTO | undefined> {
    const patient = await c.var.trx
      .selectFrom("ws_patients")
      .leftJoin(
        "ws_consumptions",
        "ws_consumptions.patient_id",
        "ws_patients.id"
      )
      .leftJoin(
        "vaccine_types",
        "vaccine_types.id",
        "ws_consumptions.vaccine_type_id"
      )
      .leftJoin(
        "vaccine_methods",
        "vaccine_methods.id",
        "ws_consumptions.vaccine_method_id"
      )
      .leftJoin(
        "ws_vaccine_sequences as previous_sequence",
        "previous_sequence.id",
        "ws_consumptions.vaccine_sequence_id"
      )
      .leftJoin("ws_transactions", (join) =>
        join
          .onRef("ws_transactions.id", "=", "ws_consumptions.transaction_id")
          .on("ws_transactions.deleted_at", "is", null)
      )
      .leftJoin("ws_entities", (join) =>
        join
          .onRef("ws_entities.id", "=", "ws_transactions.entity_id")
          .on("ws_entities.deleted_at", "is", null)
      )
      .where("ws_patients.nik", "=", nik)
      .where("ws_consumptions.protocol_id", "=", Number(protocol_id))
      .where("ws_patients.deleted_at", "is", null)
      .where("ws_consumptions.deleted_at", "is", null)
      .where("vaccine_types.deleted_at", "is", null)
      .where("vaccine_methods.deleted_at", "is", null)
      .select([
        "ws_patients.id as patient_id",
        "ws_patients.nik",
        "ws_patients.name",
        "vaccine_types.id as vaccine_type_id",
        "vaccine_types.title as vaccine_type_name",
        "vaccine_methods.id as vaccine_method_id",
        "vaccine_methods.title as vaccine_method_name",
        "previous_sequence.id as previous_sequence_id",
        "previous_sequence.title as previous_sequence_name",
        "ws_transactions.change_qty",
        "ws_entities.id as entity_id",
        "ws_entities.name as entity_name",
        "ws_consumptions.actual_date as last_vaccine_date",
        "ws_consumptions.actual_qty",
        "previous_sequence.min as min",
        "previous_sequence.max as max",
      ])
      .orderBy("ws_consumptions.actual_date", "desc")
      .orderBy("previous_sequence.sort", "desc")
      .executeTakeFirst()

    if (!patient) return undefined

    const nextSequence = await this.findNextSequence(
      c,
      patient.patient_id,
      patient.previous_sequence_id,
      Number(protocol_id),
      patient.actual_qty
    )

    return {
      nik: patient.nik,
      name: patient.name ?? null,
      vaccine_type: patient.vaccine_type_id
        ? {
            id: patient.vaccine_type_id,
            name: patient.vaccine_type_name ?? null,
          }
        : null,
      vaccine_method: patient.vaccine_method_id
        ? {
            id: patient.vaccine_method_id,
            name: patient.vaccine_method_name ?? null,
          }
        : null,
      previous_sequence: patient.previous_sequence_id
        ? {
            id: patient.previous_sequence_id,
            name: patient.previous_sequence_name ?? null,
            qty: patient.actual_qty ? Math.abs(patient.actual_qty) : null,
            min: patient.min,
            max: patient.max,
          }
        : null,
      next_sequence: nextSequence?.id
        ? {
            id: nextSequence.id,
            name: nextSequence.title ?? null,
            min: nextSequence.min,
            max: nextSequence.max,
          }
        : null,
      next_vaccine_method: nextSequence?.method_id
        ? {
            id: nextSequence.method_id,
            name: nextSequence.method_title ?? null,
          }
        : null,
      next_vaccine_type: nextSequence?.type_id
        ? {
            id: nextSequence.type_id,
            name: nextSequence.type_title ?? null,
          }
        : null,
      entity: patient.entity_id
        ? {
            id: patient.entity_id,
            name: patient.entity_name ?? null,
          }
        : null,
      last_vaccine_date: patient.last_vaccine_date?.toISOString() ?? null,
    }
  }

  async getPatientsForReminder(
    c: CustomContext<DB>,
    limit: number,
    offset: number,
    entityIds?: number[]
  ): Promise<ReminderRow[]> {
    const entityFilter =
      entityIds && entityIds.length
        ? sql`AND wt.entity_id IN (${sql.join(entityIds, sql`, `)})`
        : sql``

    const result = await sql<ReminderRow>`
    WITH
      latest_consumptions AS (
        SELECT
          c.id AS consumption_id,
          c.transaction_id,
          c.patient_id,
          c.protocol_id,
          c.vaccine_method_id,
          c.vaccine_sequence_id,
          c.actual_qty,
          c.actual_date,
          c.next_vaccine_date,
          c.stop_notification,
          ROW_NUMBER() OVER(
            PARTITION BY
              c.patient_id,
              c.protocol_id
            ORDER BY
              c.id DESC
          ) AS rn
        FROM
          ws_consumptions c
        WHERE
          c.deleted_at IS NULL
      ),
      next_sequences AS (
        SELECT
          lc.consumption_id,
          lc.transaction_id,
          lc.patient_id,
          lc.protocol_id,
          lc.vaccine_method_id,
          lc.vaccine_sequence_id,
          lc.actual_date,
          lc.next_vaccine_date,
          lc.stop_notification,
          wvs.id AS next_vaccine_sequence_id,
          wvs.title AS current_sequence,
          wvs.is_start_sequence AS next_is_start_sequence,
          wvs.start_notification AS next_start_notification,
          wvs.end_notification AS next_end_notification,
          ROW_NUMBER() OVER(
            PARTITION BY
              lc.consumption_id
            ORDER BY
              wvs.sort ASC
          ) AS seq_rn
        FROM
          latest_consumptions lc
          JOIN ws_vaccine_rules wvr ON wvr.previous_sequence = lc.vaccine_sequence_id
          AND wvr.deleted_at IS NULL
          AND wvr.other_sequences IS NULL
          AND (
            wvr.prerequisite_qty = lc.actual_qty
            OR wvr.prerequisite_qty IS NULL
          )
          AND (
            wvr.before_sequence = (
              SELECT
                c2.vaccine_sequence_id
              FROM
                ws_consumptions c2
              WHERE
                c2.deleted_at IS NULL
                AND c2.patient_id = lc.patient_id
                AND c2.protocol_id = lc.protocol_id
                AND c2.vaccine_sequence_id <> lc.vaccine_sequence_id
              ORDER BY
                c2.actual_date DESC,
                c2.id DESC
              LIMIT 1
            )
            OR wvr.before_sequence IS NULL
          )
          JOIN ws_vaccine_sequences wvs ON wvs.id = wvr.next_sequence
          AND wvs.deleted_at IS NULL
        WHERE
          lc.rn = 1
      )
    SELECT
      wt.entity_id,
      we.name AS entity_name,
      ns.consumption_id,
      ns.protocol_id,
      p.nik AS identity_number,
      p.phone_number,
      vm.title AS vaccine_method,
      ns.current_sequence,
      prev_vs.title AS previous_sequence,
      ns.actual_date AS previous_vaccine_date,
      ns.next_vaccine_date,
      ns.stop_notification
    FROM
      ws_patients p
      JOIN next_sequences ns ON p.id = ns.patient_id
      AND ns.seq_rn = 1
      LEFT JOIN ws_transactions wt ON wt.id = ns.transaction_id
      AND wt.deleted_at IS NULL
      LEFT JOIN ws_entities we ON we.id = wt.entity_id
      AND we.deleted_at IS NULL
      LEFT JOIN vaccine_methods vm ON ns.vaccine_method_id = vm.id
      AND vm.deleted_at IS NULL
      LEFT JOIN ws_vaccine_sequences prev_vs ON prev_vs.id = ns.vaccine_sequence_id
      AND prev_vs.deleted_at IS NULL
    WHERE
      p.deleted_at IS NULL
      AND ns.stop_notification IS NOT TRUE
      AND COALESCE(ns.next_is_start_sequence, 0) <> 1
      AND CURDATE() BETWEEN DATE_ADD(
        ns.next_vaccine_date, INTERVAL ns.next_start_notification DAY
      )
      AND DATE_ADD(
        ns.next_vaccine_date, INTERVAL ns.next_end_notification DAY
      )
      AND CURDATE() != ns.next_vaccine_date
      ${entityFilter}
    ORDER BY
      ns.next_vaccine_date ASC,
      ns.consumption_id ASC
    LIMIT ${limit} OFFSET ${offset}
    `.execute(c.var.trx)

    return result.rows
  }
}
