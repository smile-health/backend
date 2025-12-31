import { DB } from "@/common/infrastructure/database/types/db.js"
import { Context } from "@smile/lib/types/context.js"
import {
  GetProtocolQueries,
  VaccineResult,
  TypeItem,
  MethodItem,
  ProtocolMaterialActivityBody,
  GetVaccineSequenceQueries,
} from "./protocol.schema.js"
import { RawBuilder, sql } from "kysely"
import { doEncrypt } from "../transaction/utils/transaction.encryption.js"
import moment from "moment"

export class ProtocolRepository {
  async getListProtocol(
    c: Context<DB>,
    programId: number,
    param: GetProtocolQueries
  ) {
    const { page, paginate, keyword, status } = param
    const offset = (page - 1) * paginate

    let query = c.var.trx
      .selectFrom("protocols as p")
      .innerJoin("protocol_programs as pp", (eb) =>
        eb
          .onRef("pp.protocol_id", "=", "p.id")
          .on("pp.program_id", "=", programId)
      )

    if (keyword) query = query.where("p.name", "like", `%${keyword}%`)

    if (status !== undefined)
      query = query.where("p.status", "=", Number(status))

    return query
      .selectAll("p")
      .orderBy("p.id")
      .limit(paginate)
      .offset(offset)
      .execute()
  }

  async getTotalCountProtocol(
    c: Context<DB>,
    programId: number,
    param: GetProtocolQueries
  ) {
    const { keyword } = param
    let query = c.var.trx
      .selectFrom("protocols as p")
      .innerJoin("protocol_programs as pp", (eb) =>
        eb
          .onRef("pp.protocol_id", "=", "p.id")
          .on("pp.program_id", "=", programId)
      )

    if (keyword) query = query.where("p.name", "like", `%${keyword}%`)

    const total = await query
      .select((eb) => eb.fn.countAll().as("total"))
      .executeTakeFirst()
    return Number(total?.total) || 0
  }

  // ==========================================================
  // Transform vaccine sequences data
  // ==========================================================
  private transformVaccineData(rows): VaccineResult | [] {
    if (!rows.length) return []

    const first = rows[0]
    const hasType = !!first.type_id
    const hasMethod = !!first.method_id

    const result: VaccineResult = {
      protocol: first.protocol_name || "",
      is_kipi: first.is_kipi,
      is_medical_history: first.is_medical_history,
      is_identity_type: first.is_identity_type,
      is_vaccine_type: hasType,
      is_vaccine_method: hasMethod,
      data: [],
    }

    const makeSequence = (r) => ({
      id: r.id,
      title: r.title,
      min: r.min,
      max: r.max,
      ideal_age: r.ideal_age,
      max_age: r.max_age,
      active_duration: r.active_duration,
    })

    const typeMap = new Map<number, TypeItem>()
    for (const r of rows) {
      if (!typeMap.has(r.type_id)) {
        typeMap.set(r.type_id, {
          id: r.type_id,
          title: r.type_title,
          methods: [],
          _methodMap: new Map<number, MethodItem>(),
        })
        result.data.push(typeMap.get(r.type_id)!)
      }

      const type = typeMap.get(r.type_id)!
      const mMap = type._methodMap!
      if (!mMap.has(r.method_id)) {
        mMap.set(r.method_id, {
          id: r.method_id,
          title: r.method_title,
          is_multi_patient: r.is_multi_patient,
          sequences: [],
        })
        type.methods.push(mMap.get(r.method_id)!)
      }

      mMap.get(r.method_id)!.sequences.push(makeSequence(r))
    }

    result.data.forEach((t) => delete t._methodMap)
    return result
  }

  async getVaccineSequences(
    c: Context<DB>,
    protocolId: number,
    param: GetVaccineSequenceQueries
  ) {
    const { keyword, nik } = param
    let query = c.var.trx
      .selectFrom("ws_vaccine_sequences")
      .innerJoin(
        "protocols",
        "ws_vaccine_sequences.protocol_id",
        "protocols.id"
      )
      .leftJoin(
        "vaccine_methods",
        "ws_vaccine_sequences.method_id",
        "vaccine_methods.id"
      )
      .leftJoin(
        "vaccine_types",
        "ws_vaccine_sequences.type_id",
        "vaccine_types.id"
      )
      .select([
        "ws_vaccine_sequences.id as id",
        "ws_vaccine_sequences.title as title",
        "protocols.name as protocol_name",
        "ws_vaccine_sequences.type_id as type_id",
        "vaccine_types.title as type_title",
        "ws_vaccine_sequences.method_id as method_id",
        "vaccine_methods.title as method_title",
        "vaccine_methods.is_multi_patient as is_multi_patient",
        "ws_vaccine_sequences.min as min",
        "ws_vaccine_sequences.max as max",
        "ws_vaccine_sequences.ideal_age as ideal_age",
        "ws_vaccine_sequences.max_age as max_age",
        "ws_vaccine_sequences.active_duration as active_duration",
        "protocols.is_kipi as is_kipi",
        "protocols.is_medical_history as is_medical_history",
        "protocols.is_identity_type as is_identity_type",
      ])
      .where("protocol_id", "=", protocolId)

    if (keyword)
      query = query.where("ws_vaccine_sequences.title", "like", `%${keyword}%`)

    if (nik) {
      const sequenceIds = await this.getSequenceIdsByNik(c, nik, protocolId)
      if (sequenceIds.length > 0)
        query = query.where("ws_vaccine_sequences.id", "in", sequenceIds)
    }

    const rows = await query
      .orderBy("ws_vaccine_sequences.sort", "asc")
      .execute()
    return this.transformVaccineData(rows)
  }

  async getSequenceIdsByNik(c: Context<DB>, nik: string, protocolId: number) {
    const nikEncrypted = doEncrypt(nik)
    const patient = await c.var.trx
      .selectFrom("ws_patients")
      .select(["id"])
      .where("nik", "=", nikEncrypted)
      .executeTakeFirst()

    if (!patient) return []

    const consumption = await c.var.trx
      .selectFrom("ws_consumptions as wc")
      .innerJoin(
        "ws_vaccine_sequences as wvs",
        "wvs.id",
        "wc.vaccine_sequence_id"
      )
      .select([
        "wc.actual_qty as actual_qty",
        "wc.actual_date as actual_date",
        "wc.vaccine_sequence_id as vaccine_sequence_id",
        "wvs.active_duration as active_duration",
      ])
      .where("wc.patient_id", "=", patient.id)
      .where("wc.vaccine_sequence_id", "is not", null)
      .where("wc.protocol_id", "=", protocolId)
      .where("wc.deleted_at", "is", null)
      .orderBy("wc.actual_date", "desc")
      .executeTakeFirst()

    if (!consumption) return []

    const lastVaccineDate = new Date(
      moment(consumption.actual_date).format("YYYY-MM-DD HH:mm:ss")
    )

    const currentDate = new Date()
    const daysDiff = Math.floor(
      (currentDate.getTime() - lastVaccineDate.getTime()) /
        (1000 * 60 * 60 * 24)
    )

    // Check if the difference exceeds active_duration
    if (
      consumption?.active_duration &&
      daysDiff > Number(consumption?.active_duration || 0)
    )
      return []

    const sequenceIds: number[] = []
    let currentPrev = consumption.vaccine_sequence_id
    let qty = consumption.actual_qty
    let currentBefore: number | null = null
    let tempIdx = 1

    const oldSequence = await c.var.trx
      .selectFrom("ws_consumptions")
      .select(["vaccine_sequence_id"])
      .where("patient_id", "=", patient.id)
      .where("vaccine_sequence_id", "!=", currentPrev)
      .where("protocol_id", "=", protocolId)
      .where("deleted_at", "is", null)
      .orderBy("actual_date", "desc")
      .executeTakeFirst()

    if(oldSequence) currentBefore = oldSequence.vaccine_sequence_id

    while (true) {
      let query = c.var.trx
        .selectFrom("ws_vaccine_rules")
        .select("next_sequence")
        .innerJoin(
          "ws_vaccine_sequences",
          "ws_vaccine_sequences.id",
          "ws_vaccine_rules.next_sequence"
        )
        .where("previous_sequence", "=", currentPrev)
        .$if(currentBefore != null && currentBefore != undefined, (qb) =>
          qb.where((eb) =>
            eb.or([
              eb("before_sequence", "=", currentBefore!),
              eb("before_sequence", "is", null),
            ])
          )
        )
        .orderBy("ws_vaccine_sequences.sort", "asc")

      if (tempIdx == 1)
        query = query.where((eb) =>
          eb.or([
            eb("prerequisite_qty", "=", qty),
            eb("prerequisite_qty", "is", null),
          ])
        )

      const sequence = await query.executeTakeFirst()

      if (!sequence) break

      const next = Number(sequence.next_sequence)
      sequenceIds.push(next)
      currentBefore = currentPrev
      currentPrev = next
      tempIdx += 1
    }

    return sequenceIds
  }

  async setProtocolToMaterialActivities(
    c: Context<DB>,
    body: ProtocolMaterialActivityBody,
    userId?: number
  ) {
    const { protocol_id, material_activities } = body
    if (!material_activities?.length) return

    const pairs = sql.join(
      material_activities.map((m) => sql`(${m.material_id}, ${m.activity_id})`)
    )

    await c.var.trx
      .updateTable("ws_material_activities")
      .set({ protocol_id, updated_at: sql`NOW()`, updated_by: userId || null })
      .where(sql`(material_id, activity_id)`, "in", sql`(${pairs})`)
      .execute()

    return this.getDataMaterialActivitiesLastUpdated(c, protocol_id, pairs)
  }

  async getDataMaterialActivitiesLastUpdated(
    c: Context<DB>,
    protocolId: number,
    materialActivities?: RawBuilder<unknown>
  ) {
    return c.var.trx
      .selectFrom("ws_material_activities as wma")
      .innerJoin("ws_materials as wm", "wma.material_id", "wm.id")
      .innerJoin("ws_activities as wa", "wma.activity_id", "wa.id")
      .innerJoin("protocols as wp", "wma.protocol_id", "wp.id")
      .select([
        "wma.id as id",
        "wma.protocol_id as protocol_id",
        "wp.name as protocol_name",
        "wma.material_id as material_id",
        "wm.name as material_name",
        "wma.activity_id as activity_id",
        "wa.name as activity_name",
        "wma.updated_at as updated_at",
      ])
      .where("wma.protocol_id", "=", protocolId)
      .where(
        sql`(wma.material_id, wma.activity_id)`,
        "in",
        sql`(${materialActivities})`
      )
      .execute()
  }

  async getMaterialActivitiesByProtocolId(
    c: Context<DB>,
    programId: number,
    protocolId: number,
    params: GetProtocolQueries
  ) {
    const { page, paginate, keyword } = params
    const offset = (page - 1) * paginate
    let query = c.var.trx
      .selectFrom("ws_material_activities as wma")
      .innerJoin("ws_materials as wm", "wma.material_id", "wm.id")
      .innerJoin("ws_activities as wa", "wma.activity_id", "wa.id")
      .innerJoin("protocols as wp", "wma.protocol_id", "wp.id")
      .leftJoin("ws_users as cu", "wma.updated_by", "cu.id")
      .select([
        "wma.id as id",
        "wma.protocol_id as protocol_id",
        "wp.name as protocol_name",
        "wma.material_id as material_id",
        "wm.name as material_name",
        "wma.activity_id as activity_id",
        "wa.name as activity_name",
        "wma.updated_at as updated_at",
        "wma.created_at as created_at",
        "cu.firstname as updated_by_firstname",
        "cu.lastname as updated_by_lastname",
      ])
      .where("wma.protocol_id", "=", protocolId)
      .where("wa.program_id", "=", programId)

    if (keyword) query = query.where("wm.name", "like", `%${keyword}%`)

    query = query
      .limit(paginate)
      .offset(offset)
      .orderBy("wma.updated_at", "desc")

    const [data, count] = await Promise.all([
      query.execute(),
      query
        .clearSelect()
        .clearOrderBy()
        .select((eb) => eb.fn.countAll().as("total"))
        .executeTakeFirstOrThrow(),
    ])

    return {
      data,
      total: count ? Number(count.total) : 0,
    }
  }

  async getMaterialActivityById(c: Context<DB>, id: number) {
    return await c.var.trx
      .selectFrom("ws_material_activities as wma")
      .innerJoin("ws_materials as wm", "wma.material_id", "wm.id")
      .innerJoin("ws_activities as wa", "wma.activity_id", "wa.id")
      .select([
        "wma.id as id",
        "wma.protocol_id as protocol_id",
        "wma.material_id as material_id",
        "wm.name as material_name",
        "wma.activity_id as activity_id",
        "wa.name as activity_name",
        "wma.updated_at as updated_at",
        "wma.created_at as created_at",
      ])
      .where("wma.id", "=", id)
      .executeTakeFirst()
  }

  async deleteProtocolFromMaterialActivity(
    c: Context<DB>,
    id: number,
    userId: number
  ) {
    await c.var.trx
      .updateTable("ws_material_activities")
      .set({ protocol_id: null, updated_at: sql`NOW()`, updated_by: userId })
      .where("id", "=", id)
      .execute()

    return await this.getMaterialActivityById(c, id)
  }

  async getProtocolById(c: Context<DB>, id: number) {
    return await c.var.trx
      .selectFrom("protocols")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst()
  }

  async updateStatusProtocol(c: Context<DB>, id: number, status: number) {
    await c.var.trx
      .updateTable("protocols")
      .set({ status, updated_at: sql`NOW()` })
      .where("id", "=", id)
      .execute()

    return await this.getProtocolById(c, id)
  }
}
