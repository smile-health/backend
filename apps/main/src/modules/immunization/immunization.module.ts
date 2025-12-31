import { Context } from "hono"
import { getIdentityAndAddressByNIK } from "@/common/utils/verify-nik.js"
import { ImmunizationRepository } from "./immunization.repository.js"
import { LocationRepository } from "../location/location.repository.js"
import {
  doDecrypt,
  doEncrypt,
} from "../transaction/utils/transaction.encryption.js"
import {
  CreateChildRegistrationSchema,
  CreateImmunizationDataSchema,
  CreateImmunizationDTO,
  CreateWeighingHistoryDTO,
  CreateImmunizationDataDTO,
  UpdateWeighingHistoryDTO,
  GetImmunizationQuery,
  UpdateImmunizationStatusDTO,
} from "./immunization.schema.js"
import moment from "moment"
import {
  HEX_CODE_IMMUNIZATION,
  HEX_CODE_WEIGHING,
  identityTypes,
  ImmunizationStatusType,
  statusLabels,
  statusTypes,
  vaccineStatus,
} from "@/common/constants/immunization.js"
import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { ValidationError } from "@smile/lib/error.js"
import { TargetsRepository } from "../targets/targets.repository.js"

export class ImmunizationModule {
  constructor(
    private readonly repo: ImmunizationRepository,
    private readonly locationRepo: LocationRepository,
    private readonly targetsRepository: TargetsRepository
  ) {}

  async #createImmunizationDetailsInBackground(
    c: Context,
    immunizationId: number,
    birthDate: string,
    gender: number
  ) {
    const birthMoment = moment(birthDate)

    ;(async () => {
      try {
        const existingIds = await this.repo.getExistingMaterialTargetIds(
          c,
          immunizationId
        )
        const materialTargets = await this.repo.getMaterialTargetsByType(
          c,
          "immunization"
        )
        const newTargets = materialTargets.filter(
          (target) => !existingIds.includes(target.id)
        )

        if (newTargets.length > 0) {
          const details = await Promise.all(
            newTargets.map(async (target) => {
              const idealScheduleDate = birthMoment
                .clone()
                .add(target.start_ideal_days ?? 0, "days")
                .format("YYYY-MM-DD HH:mm:ss")

              const idealDateInDays = Math.abs(
                moment(birthMoment).diff(moment(idealScheduleDate), "days")
              )

              const targetGroup = await this.targetsRepository.getTargetGroup(
                c,
                idealDateInDays,
                gender
              )

              return {
                patient_immunization_id: immunizationId,
                material_target_id: target.id,
                batch_id: null,
                ideal_schedule_date: idealScheduleDate,
                status: 0,
                last_status: 0,
                target_group_id: targetGroup?.id ?? 0,
              }
            })
          )

          await this.repo.bulkInsertPatientImmunizationDetails(c, details)
        }
      } catch (error) {
        console.error(
          "Error creating immunization details in background:",
          error
        )
      }
    })()
  }

  #buildImmunizationData(
    patientId: number,
    parentName?: string,
    isNewNik = false,
    parentPatientId?: number
  ): CreateImmunizationDataDTO {
    const data: CreateImmunizationDataDTO = {
      patient_id: patientId,
      parent_name: parentName ? doEncrypt(parentName) : undefined,
    }

    if (isNewNik && parentPatientId) {
      data.identity_type = identityTypes.MOTHER_NIK
      data.parent_patient_id = parentPatientId
    }

    return data
  }

  #formatBirthDateForNik(dateOfBirth: string, gender?: number): string {
    const birthDate = moment(dateOfBirth)
    let day = parseInt(birthDate.format("DD"), 10)
    const month = birthDate.format("MM")
    const year = birthDate.format("YY")

    if (gender == 2) {
      day = day + 40
    }

    return `${day.toString().padStart(2, "0")}${month}${year}`
  }

  async #generateTemporaryNik(
    c: Context,
    formattedBirthDate: string
  ): Promise<string> {
    let sequence = 1
    let nik = `999999${formattedBirthDate}${sequence.toString().padStart(4, "0")}`

    while (await this.repo.findByIdentityNumber(c, nik)) {
      sequence++
      nik = `999999${formattedBirthDate}${sequence.toString().padStart(4, "0")}`
    }

    return nik
  }

  #findEarliestAndLatestDates(data: any[]) {
    let earliestDate = data[0]
    let latestDate = data[0]

    data.forEach((item) => {
      if (item.id < earliestDate.id) earliestDate = item
      if (item.id > latestDate.id) latestDate = item
    })

    return { earliestDate, latestDate }
  }

  #formatWeighingHistoryItem(
    item: any,
    birthDate: string | null,
    earliestDate: any,
    latestDate: any,
    dataLength: number
  ) {
    const inputDate = moment(item.input_date)
    const age =
      birthDate && item.input_date
        ? this.#calculateAgeString(birthDate, item.input_date)
        : null
    const { label, hexCode } = this.#getWeighingLabel(
      item.id,
      earliestDate.id,
      latestDate.id,
      dataLength
    )

    return {
      id: item.id,
      date: inputDate.format("YYYY-MM-DD"),
      label,
      weight: `${item.weight} kg`,
      height: `${item.height} cm`,
      age,
      status: item.status,
      status_label: label,
      hex_code_text: hexCode.text,
      hex_code_background: hexCode.background,
      z_scores: {
        weight: this.#formatZScore("BB/U", item.z_score_weight),
        height: this.#formatZScore("TB/U", item.z_score_height),
        bmi: this.#formatZScore("IMT/U", item.z_score_bmi),
      },
    }
  }

  #getWeighingLabel(
    itemId: number,
    earliestId: number,
    latestId: number,
    dataLength: number
  ) {
    if (dataLength === 1) {
      return { label: "Birth weight", hexCode: HEX_CODE_WEIGHING.new_birth }
    }

    if (itemId === earliestId) {
      return { label: "Birth weight", hexCode: HEX_CODE_WEIGHING.new_birth }
    }

    if (itemId === latestId) {
      return { label: "New weight", hexCode: HEX_CODE_WEIGHING.new_weight }
    }

    return { label: null, hexCode: { text: "#000000", background: "#FFFFFF" } }
  }

  #formatZScore(prefix: string, value: any): string {
    const score = value !== null ? Number(value) : null
    if (score === null) return `${prefix}: -/-`
    const sign = score >= 0 ? "+" : ""
    return `${prefix}: ${sign}${score.toFixed(2)}`
  }

  #calculateAgeString(birthDate: string, inputDate: Date | null): string {
    if (!inputDate) return "N/A"

    const birth = moment(birthDate)
    const input = moment(inputDate)
    const years = input.diff(birth, "years")
    birth.add(years, "years")
    const months = input.diff(birth, "months")
    birth.add(months, "months")
    const days = input.diff(birth, "days")

    return `${years} Years ${months} Month ${days} Days`
  }

  async #formatListItem(c: Context, item: any) {
    const details = await this.repo.getPatientImmunizationDetails(c, item.id)
    const { idealSchedule, reschedule, unnotes } =
      this.#calculateScheduleCounts(details)

    let nik: string | null = null
    if (item.identity_type == identityTypes.NIK) {
      nik = item.nik ? doDecrypt(item.nik) : null
    } else if (item.identity_type == identityTypes.MOTHER_NIK) {
      nik = item.parent_nik ? doDecrypt(item.parent_nik) : null
    } else {
      nik = item.nik ? doDecrypt(item.nik) : doDecrypt(item.parent_nik)
    }

    return {
      id: item.id,
      nik: nik,
      name: item.name ? doDecrypt(item.name) : null,
      birth_date: item.birth_date ? doDecrypt(item.birth_date) : null,
      ideal_schedule: idealSchedule,
      reschedule: reschedule,
      unnotes: unnotes,
    }
  }

  #calculateScheduleCounts(details: any[]) {
    const now = moment()
    let idealSchedule = 0
    let reschedule = 0
    let unnotes = 0

    details.forEach((detail) => {
      if (detail.is_given === 0) return

      const idealDate = moment(detail.ideal_schedule_date)
      const injectionDate = detail.injection_date
        ? moment(detail.injection_date)
        : null
      const restrictedDate =
        detail.restricted_ideal_day !== null
          ? idealDate.clone().add(detail.restricted_ideal_day, "days")
          : null

      if (detail.status === 0) {
        unnotes++
        return
      }

      if (
        this.#shouldSkipDetailForSchedule(
          detail,
          now,
          restrictedDate,
          injectionDate
        )
      ) {
        return
      }

      const result = this.#categorizeScheduleType(
        detail,
        now,
        idealDate,
        injectionDate
      )
      if (result === "ideal") {
        idealSchedule++
      } else if (result === "reschedule") {
        reschedule++
      }
    })

    return { idealSchedule, reschedule, unnotes }
  }

  #shouldSkipDetailForSchedule(
    detail: any,
    now: moment.Moment,
    restrictedDate: moment.Moment | null,
    injectionDate: moment.Moment | null
  ): boolean {
    return (
      (detail.status === 1 && detail.is_given === 0) ||
      (detail.status === 2 && detail.is_given === 0) ||
      this.#isNotGivenByRestriction(
        now,
        restrictedDate,
        injectionDate,
        detail.status
      )
    )
  }

  #categorizeScheduleType(
    detail: any,
    now: moment.Moment,
    idealDate: moment.Moment,
    injectionDate: moment.Moment | null
  ): "ideal" | "reschedule" | null {
    const idealDatePlus = this.#getIdealDatePlusWindow(detail, idealDate)
    const isMRDose2 = this.#isMRDose2(detail)

    if (!injectionDate && now.isSameOrAfter(idealDate, "day")) {
      return this.#isWithinIdealWindow(now, idealDatePlus, isMRDose2)
        ? "ideal"
        : "reschedule"
    }

    if (injectionDate) {
      if (
        this.#isWithinIdealWindow(
          injectionDate,
          idealDatePlus,
          isMRDose2,
          idealDate
        )
      ) {
        return "ideal"
      }
      if (injectionDate.isSameOrAfter(idealDatePlus, "day")) {
        return "reschedule"
      }
    }

    return null
  }

  #getIdealDatePlusWindow(
    detail: any,
    idealDate: moment.Moment
  ): moment.Moment {
    const idealDatePlusOneMonth = idealDate.clone().add(1, "month")
    const idealDatePlusOneYear = idealDate.clone().add(1, "year")
    return detail.category?.toLowerCase() === "bias"
      ? idealDatePlusOneYear
      : idealDatePlusOneMonth
  }

  #isMRDose2(detail: any): boolean {
    return (
      detail.material_name?.toUpperCase() === "MR" && detail.dose_number === 2
    )
  }

  #isWithinIdealWindow(
    date: moment.Moment,
    idealDatePlus: moment.Moment,
    isMRDose2: boolean,
    idealDate?: moment.Moment
  ): boolean {
    if (isMRDose2) return true
    if (idealDate) {
      return (
        date.isSameOrAfter(idealDate, "day") &&
        date.isBefore(idealDatePlus, "day")
      )
    }
    return date.isBefore(idealDatePlus, "day")
  }

  #calculateAge(birthDate: string | null) {
    if (!birthDate) return { years: 0, months: 0, days: 0 }

    const birth = moment(birthDate)
    const now = moment()
    const years = now.diff(birth, "years")
    birth.add(years, "years")
    const months = now.diff(birth, "months")
    birth.add(months, "months")
    const days = now.diff(birth, "days")

    return { years, months, days }
  }

  #calculateDetailSummary(details: any[]) {
    const now = moment()
    let idealSchedule = 0
    let catchUpSchedule = 0
    let notRecordYet = 0
    let notGiven = 0

    details.forEach((detail) => {
      const idealDate = moment(detail.ideal_schedule_date)
      const injectionDate = detail.injection_date
        ? moment(detail.injection_date)
        : null
      const restrictedDate =
        detail.restricted_ideal_day !== null
          ? idealDate.clone().add(detail.restricted_ideal_day, "days")
          : null

      if (detail.status === 0) {
        notRecordYet++
        return
      }

      if (
        this.#shouldSkipDetailForSchedule(
          detail,
          now,
          restrictedDate,
          injectionDate
        )
      ) {
        notGiven++
        return
      }

      const result = this.#categorizeScheduleType(
        detail,
        now,
        idealDate,
        injectionDate
      )
      if (result === "ideal") {
        idealSchedule++
      } else if (result === "reschedule") {
        catchUpSchedule++
      }
    })

    return {
      ideal_schedule: idealSchedule,
      catch_up_schedule: catchUpSchedule,
      not_record_yet: notRecordYet,
      not_given: notGiven,
    }
  }

  async #calculateDraftSummary(c: Context, id: number, details: any[]) {
    const draftImmunization = details.filter((d) => d.status === 1).length
    const weighingHistory = await this.repo.getWeighingHistoryList(c, id)
    const draftWeighing = weighingHistory.filter(
      (item) => item.status === 0
    ).length

    return draftImmunization === 0 && draftWeighing === 0
      ? null
      : { immunization_draft: draftImmunization, weight_draft: draftWeighing }
  }

  #groupByMaterialName(statusData: any[]) {
    const materialGroups = new Map<string, typeof statusData>()
    statusData.forEach((item) => {
      const materialName = item.material_name ?? ""
      if (!materialGroups.has(materialName)) {
        materialGroups.set(materialName, [])
      }
      materialGroups.get(materialName)!.push(item)
    })
    return materialGroups
  }

  #processMaterialGroups(materialGroups: Map<string, any[]>) {
    const materialTargetIdToDoseNumber = new Map<number, number>()
    const firstNotRecordedByGroup = new Map<string, number>()

    materialGroups.forEach((items, materialName) => {
      const hasParentChild = items.some((item) => item.parent_id !== null)

      if (hasParentChild && items.length > 1) {
        const sortedItems = [...items].sort((a, b) => {
          const dateA = a.ideal_schedule_date
            ? new Date(a.ideal_schedule_date).getTime()
            : 0
          const dateB = b.ideal_schedule_date
            ? new Date(b.ideal_schedule_date).getTime()
            : 0
          return dateA - dateB
        })

        sortedItems.forEach((item, index) => {
          if (item.material_target_id !== null) {
            materialTargetIdToDoseNumber.set(item.material_target_id, index + 1)
          }
        })

        const hasDraft = sortedItems.some((item) => item.status === 1)
        if (!hasDraft) {
          const firstNotRecorded = sortedItems.find((item) => item.status === 0)
          if (
            firstNotRecorded &&
            firstNotRecorded.material_target_id !== null
          ) {
            firstNotRecordedByGroup.set(
              materialName,
              firstNotRecorded.material_target_id
            )
          }
        }
      }
    })

    return { materialTargetIdToDoseNumber, firstNotRecordedByGroup }
  }

  #groupBatchesByMaterial(
    batchesData: Array<{
      material_id: number
      batch_id: number
      batch_code: string
      expired_date: Date | null
    }>
  ): Map<number, Array<{ id: number; title: string }>> {
    const batchMap = new Map<number, Array<{ id: number; title: string }>>()

    batchesData.forEach((batch) => {
      if (!batchMap.has(batch.material_id)) {
        batchMap.set(batch.material_id, [])
      }

      const title = batch.expired_date
        ? `${batch.batch_code} - ${moment(batch.expired_date).format("DD-MMM-YYYY")}`
        : batch.batch_code

      batchMap.get(batch.material_id)!.push({
        id: batch.batch_id,
        title: title,
      })
    })

    return batchMap
  }

  #formatImmunizationStatusItem(
    item: any,
    materialTargetIdToDoseNumber: Map<number, number>,
    firstNotRecordedByGroup: Map<string, number>,
    isManagedInBatch: number,
    batches: Array<{ id: number; title: string }>
  ) {
    const now = moment()
    const idealDate = moment(item.ideal_schedule_date)
    const injectionDate = item.injection_date
      ? moment(item.injection_date)
      : null
    const restrictedDate =
      item.restricted_ideal_day !== null
        ? idealDate.clone().add(item.restricted_ideal_day, "days")
        : null

    const doseNumber =
      item.material_target_id !== null
        ? materialTargetIdToDoseNumber.get(item.material_target_id)
        : undefined

    let { statusType, vaccineNote, vaccineNoteInt } =
      this.#determineVaccineStatus(
        item,
        now,
        idealDate,
        injectionDate,
        restrictedDate,
        doseNumber
      )

    if (item.is_given == 0) {
      vaccineNote = vaccineStatus["not_given"]
      vaccineNoteInt = 3
    }

    const materialName = this.#getMaterialNameWithDose(
      item,
      materialTargetIdToDoseNumber
    )
    const hexCode = this.#getStatusHexCode(
      statusType,
      item,
      firstNotRecordedByGroup
    )

    let is_editable = true
    return {
      material_id: item.material_id,
      material_name: materialName,
      material_target_id: item.material_target_id,
      ideal_schedule_date: idealDate.format("DD MMM YYYY"),
      injection_date: injectionDate
        ? injectionDate.format("DD MMM YYYY")
        : null,
      batch_id: item.id,
      batch_number: item.code,
      status: item.status,
      status_label: vaccineNote,
      vaccine_note_int: vaccineNoteInt,
      is_draft: item.status === 1,
      hex_code_text: hexCode.text,
      hex_code_background: hexCode.background,
      is_editable,
      is_managed_in_batch: Boolean(isManagedInBatch),
      batches: batches,
    }
  }

  #getVaccineNoteInt(item: any, injectionDate: moment.Moment | null): number {
    if (injectionDate && item.code) return 2
    if (injectionDate) return 1
    if (item.is_given == 0 || !item.is_given) return 3
    return 0
  }

  #getVaccineNoteFromInjection(
    item: any,
    injectionDate: moment.Moment | null
  ): string | null {
    if (injectionDate && item.code) return vaccineStatus["note_with_batch"]
    if (injectionDate) return vaccineStatus["note_only_date"]
    return null
  }

  #isNotGivenByRestriction(
    now: moment.Moment,
    restrictedDate: moment.Moment | null,
    injectionDate: moment.Moment | null,
    itemStatus: number
  ): boolean {
    return Boolean(
      restrictedDate &&
        now.isAfter(restrictedDate, "day") &&
        !injectionDate &&
        itemStatus !== 2
    )
  }

  #determineVaccineStatus(
    item: any,
    now: moment.Moment,
    idealDate: moment.Moment,
    injectionDate: moment.Moment | null,
    restrictedDate: moment.Moment | null,
    doseNumber?: number
  ) {
    if (item.status === 0) {
      return this.#createStatusResult(
        statusTypes.NOT_RECORDED,
        statusLabels["not_recorded"],
        0
      )
    }

    if (this.#isNotGivenStatus(item, now, restrictedDate, injectionDate)) {
      return this.#createStatusResult(
        statusTypes.NOT_GIVEN,
        vaccineStatus["not_given"],
        3
      )
    }

    const idealDatePlus = this.#getIdealDatePlusWindow(item, idealDate)
    const isMRDose2 =
      item.material_name?.toUpperCase() === "MR" && doseNumber === 2

    const statusFromSchedule = this.#determineStatusFromSchedule(
      now,
      idealDate,
      idealDatePlus,
      injectionDate,
      isMRDose2,
      item
    )
    if (statusFromSchedule) return statusFromSchedule

    return this.#determineStatusFromItemStatus(item, injectionDate)
  }

  #createStatusResult(
    statusType: ImmunizationStatusType,
    vaccineNote: string | null,
    vaccineNoteInt: number
  ) {
    return { statusType, vaccineNote, vaccineNoteInt }
  }

  #isNotGivenStatus(
    item: any,
    now: moment.Moment,
    restrictedDate: moment.Moment | null,
    injectionDate: moment.Moment | null
  ): boolean {
    return (
      (item.status === 1 && item.is_given === 0) ||
      this.#isNotGivenByRestriction(
        now,
        restrictedDate,
        injectionDate,
        item.status
      )
    )
  }

  #determineStatusFromSchedule(
    now: moment.Moment,
    idealDate: moment.Moment,
    idealDatePlus: moment.Moment,
    injectionDate: moment.Moment | null,
    isMRDose2: boolean,
    item: any
  ) {
    if (!injectionDate && now.isSameOrAfter(idealDate, "day")) {
      return this.#getScheduleStatusForNoInjection(
        now,
        idealDatePlus,
        isMRDose2
      )
    }

    if (injectionDate) {
      return this.#getScheduleStatusForInjection(
        injectionDate,
        idealDate,
        idealDatePlus,
        isMRDose2,
        item
      )
    }

    return null
  }

  #getScheduleStatusForNoInjection(
    now: moment.Moment,
    idealDatePlus: moment.Moment,
    isMRDose2: boolean
  ) {
    if (now.isBefore(idealDatePlus, "day") || isMRDose2) {
      return this.#createStatusResult(
        statusTypes.IDEAL_SCHEDULE,
        statusLabels["ideal_schedule"],
        0
      )
    }
    return this.#createStatusResult(
      statusTypes.CATCH_UP_SCHEDULE,
      statusLabels["catch_up_schedule"],
      0
    )
  }

  #getScheduleStatusForInjection(
    injectionDate: moment.Moment,
    idealDate: moment.Moment,
    idealDatePlus: moment.Moment,
    isMRDose2: boolean,
    item: any
  ) {
    const vaccineNoteInt = item.code ? 2 : 1

    if (
      (injectionDate.isSameOrAfter(idealDate, "day") &&
        injectionDate.isBefore(idealDatePlus, "day")) ||
      isMRDose2
    ) {
      return this.#createStatusResult(
        statusTypes.IDEAL_SCHEDULE,
        statusLabels["ideal_schedule"],
        vaccineNoteInt
      )
    }

    if (injectionDate.isSameOrAfter(idealDatePlus, "day")) {
      return this.#createStatusResult(
        statusTypes.CATCH_UP_SCHEDULE,
        statusLabels["catch_up_schedule"],
        vaccineNoteInt
      )
    }

    return null
  }

  #determineStatusFromItemStatus(
    item: any,
    injectionDate: moment.Moment | null
  ) {
    if (item.status === 2 || item.status === 1) {
      return this.#createStatusResult(
        item.status === 2 ? statusTypes.SAVED : statusTypes.DRAFT,
        this.#getVaccineNoteFromInjection(item, injectionDate),
        this.#getVaccineNoteInt(item, injectionDate)
      )
    }

    return this.#createStatusResult(null, null, 0)
  }

  #getMaterialNameWithDose(
    item: any,
    materialTargetIdToDoseNumber: Map<number, number>
  ): string {
    if (item.material_target_id !== null) {
      const doseNumber = materialTargetIdToDoseNumber.get(
        item.material_target_id
      )
      if (doseNumber !== undefined) {
        return `${item.material_name} Dose ${doseNumber}`
      }
    }
    return item.material_name
  }

  #getStatusHexCode(
    statusType: ImmunizationStatusType,
    item: any,
    firstNotRecordedByGroup: Map<string, number>
  ) {
    if (statusType === statusTypes.IDEAL_SCHEDULE) {
      return HEX_CODE_IMMUNIZATION.ideal_schedule
    } else if (statusType === statusTypes.CATCH_UP_SCHEDULE) {
      return HEX_CODE_IMMUNIZATION.catch_up_schedule
    } else if (statusType === statusTypes.NOT_GIVEN) {
      return HEX_CODE_IMMUNIZATION.not_given
    } else if (statusType === statusTypes.NOT_RECORDED) {
      const firstNotRecordedId = firstNotRecordedByGroup.get(
        item.material_name ?? ""
      )
      return item.material_target_id !== null &&
        item.material_target_id === firstNotRecordedId
        ? HEX_CODE_IMMUNIZATION.not_recorded1
        : HEX_CODE_IMMUNIZATION.not_recorded2
    }
    return { text: "#000000", background: "#FFFFFF" }
  }

  async #validateImmunizationUpdate(
    c: Context,
    patientId: number,
    vaccineId: number
  ) {
    const immunizationDetail = await this.repo.findImmunizationDetail(
      c,
      patientId,
      vaccineId
    )
    if (!immunizationDetail) {
      throw new ValidationError("Immunization data not found")
    }

    const materialTarget = await this.repo.getMaterialTargetWithParent(
      c,
      immunizationDetail.material_target_id
    )
    if (!materialTarget) {
      throw new ValidationError("Material target not found")
    }

    if (materialTarget.parent_id !== null) {
      const parentStatus = await this.repo.getParentImmunizationStatus(
        c,
        patientId,
        materialTarget.parent_id
      )
      if (!parentStatus || parentStatus.last_status !== 2) {
        throw new ValidationError(
          "Cannot update this vaccine. Parent vaccine must be saved first"
        )
      }
    }
  }

  #buildUpdateStatusData(
    payload: UpdateImmunizationStatusDTO,
    currentLastStatus?: number | null
  ) {
    const data: {
      injection_date?: Date | null
      batch_id?: number | null
      status?: number
      is_given?: number
      last_status?: number
      last_batch_id?: number | null
      last_injection_date?: Date | null
      last_is_given?: number
    } = {}

    if (payload.vaccine_status === "not_given") {
      data.is_given = 0
      data.injection_date = null
      data.batch_id = null

      if (currentLastStatus !== 2) {
        data.status = 1
        data.last_status = 1
        data.last_batch_id = null
        data.last_injection_date = null
        data.last_is_given = 0
      } else {
        data.status = 1
      }
    } else if (
      payload.vaccine_status ||
      payload.injection_date ||
      payload.batch_id
    ) {
      if (payload.injection_date) {
        data.injection_date = new Date(payload.injection_date)
      }
      if (payload.batch_id) {
        data.batch_id = payload.batch_id
      }
      data.is_given = 1

      if (currentLastStatus !== 2) {
        data.status = 1
        data.last_status = 1
        data.last_batch_id = data.batch_id
        data.last_injection_date = data.injection_date
        data.last_is_given = 1
      } else {
        data.status = 1
      }
    }

    return data
  }

  async getDetailIdentity(c: Context, identityNumber: string) {
    const detailIdentity = await getIdentityAndAddressByNIK(
      c,
      identityNumber,
      this.locationRepo
    )

    if (!detailIdentity) {
      return null
    }

    const patient = await this.repo.findByIdentityNumber(c, identityNumber)

    const identityName = patient?.name ? doDecrypt(patient.name) : null

    const target = await this.repo.findByNik(c, doEncrypt(identityNumber))

    const id = patient?.id ?? target?.id

    return {
      data: {
        id: id ?? null,
        nik: identityNumber,
        personal_identity: {
          name: identityName,
          date_of_birth: detailIdentity?.date_of_birth,
          gender: detailIdentity?.gender,
          parent_name: null,
        },
        location: {
          province: detailIdentity?.province ?? "",
          province_id: detailIdentity?.province_id,
          city: detailIdentity?.city ?? "",
          city_id: detailIdentity?.city_id,
          district: detailIdentity?.district ?? "",
          district_id: detailIdentity?.district_id,
        },
      },
    }
  }

  async create(c: Context, data: CreateImmunizationDTO) {
    const dataPatient = CreateChildRegistrationSchema.parse({
      ...data,
      identity_type: 1,
    })

    const patientId = await this.repo.upsertPatient(c, dataPatient)

    if (patientId) {
      const dataImmunization = CreateImmunizationDataSchema.parse({
        patient_id: patientId,
        parent_name: data.parent_name ? doEncrypt(data.parent_name) : null,
      })

      const immunizationId = await this.repo.upsertImmunization(
        c,
        dataImmunization
      )

      if (data.date_of_birth) {
        this.#createImmunizationDetailsInBackground(
          c,
          immunizationId,
          data.date_of_birth,
          data.gender ?? 0
        )
      }
    }

    return dataPatient
  }

  async #createNewMotherChildPatients(
    c: Context,
    data: CreateImmunizationDTO,
    generatedNik: string | undefined
  ) {
    const motherPatient = CreateChildRegistrationSchema.parse({
      nik: data.nik,
      name: data.parent_name,
    })
    const motherPatientId = await this.repo.upsertPatient(c, motherPatient)

    const childName = data.name ? data.name : `Bayi Ny.${data.parent_name}`
    const childPatient = CreateChildRegistrationSchema.parse({
      ...data,
      nik: generatedNik,
      name: childName,
    })
    const childPatientId = await this.repo.upsertPatient(c, childPatient)

    if (childPatientId) {
      const dataImmunization: CreateImmunizationDataDTO = {
        patient_id: childPatientId,
        parent_name: data.parent_name ? doEncrypt(data.parent_name) : undefined,
        identity_type: identityTypes.MOTHER_NIK,
        parent_patient_id: motherPatientId,
      }

      const immunizationId = await this.repo.upsertImmunization(
        c,
        dataImmunization
      )

      if (data.date_of_birth) {
        this.#createImmunizationDetailsInBackground(
          c,
          immunizationId,
          data.date_of_birth,
          data.gender ?? 0
        )
      }
    }

    return { ...childPatient, nik: generatedNik }
  }

  async #createExistingPatientImmunization(
    c: Context,
    data: CreateImmunizationDTO,
    generatedNik: string | undefined,
    isNewNik: boolean,
    existingPatientId: number
  ) {
    const dataPatient = CreateChildRegistrationSchema.parse({
      ...data,
      nik: generatedNik,
      identity_type: identityTypes.NIK,
    })

    const patientId = await this.repo.upsertPatient(c, dataPatient)

    if (patientId) {
      const dataImmunization = this.#buildImmunizationData(
        patientId,
        data.parent_name,
        isNewNik,
        existingPatientId
      )

      const immunizationId = await this.repo.upsertImmunization(
        c,
        dataImmunization
      )

      if (data.date_of_birth) {
        this.#createImmunizationDetailsInBackground(
          c,
          immunizationId,
          data.date_of_birth,
          data.gender ?? 0
        )
      }
    }

    return dataPatient
  }

  async createTemporaryNIK(c: Context, data: CreateImmunizationDTO) {
    const formattedBirthDate = this.#formatBirthDateForNik(
      data.date_of_birth as string,
      data.gender
    )
    const patientData = data.nik
      ? await this.repo.findByIdentityNumber(c, data.nik)
      : null

    const nikBirthDate = data.nik?.slice(6, 12) ?? null
    const isNewNik = nikBirthDate !== formattedBirthDate
    const generatedNik = isNewNik
      ? await this.#generateTemporaryNik(c, formattedBirthDate)
      : data.nik

    if (!patientData) {
      return this.#createNewMotherChildPatients(c, data, generatedNik)
    }

    return this.#createExistingPatientImmunization(
      c,
      data,
      generatedNik,
      isNewNik,
      patientData.id
    )
  }

  async updateTemporaryNIK(
    c: Context,
    patientId: number,
    data: CreateImmunizationDTO
  ) {
    const formattedBirthDate = this.#formatBirthDateForNik(
      data.date_of_birth as string,
      data.gender
    )
    const nikBirthDate = data.nik?.slice(6, 12) ?? null
    const isNikMatchBirthDate = nikBirthDate === formattedBirthDate
    const finalNik = isNikMatchBirthDate
      ? data.nik
      : await this.#generateTemporaryNik(c, formattedBirthDate)

    const immunization = await this.repo.getImmunizationById(c, patientId)
    if (!immunization) {
      throw new Error("Immunization record not found")
    }

    if (isNikMatchBirthDate) {
      if (!immunization.patient_id) {
        throw new Error("Patient ID not found")
      }

      const dataPatient = CreateChildRegistrationSchema.parse({
        ...data,
        nik: finalNik,
      })

      await this.repo.updatePatientById(c, immunization.patient_id, dataPatient)

      await this.repo.updatePatientIdentityType(
        c,
        patientId,
        String(identityTypes.NIK)
      )
    } else {
      if (!immunization.parent_patient_id) {
        throw new Error("Parent patient ID not found")
      }
      await this.repo.updatePatientNik(
        c,
        immunization.parent_patient_id,
        data.nik as string
      )
    }

    return {
      status: true,
      message: "Success update temporary NIK",
    }
  }

  async createWeighingHistory(c: Context, data: CreateWeighingHistoryDTO) {
    const result = await this.repo.createWeighingHistory(c, data)

    return {
      status: true,
      message: "Success create weighing history",
      data: {
        id: Number(result.insertId),
        patient_immunization_id: data.patient_immunization_id,
        input_date: data.input_date,
        gender: data.gender,
        weight: data.weight,
        height: data.height,
        z_score_weight: data.z_score_weight,
        z_score_height: data.z_score_height,
        z_score_bmi: data.z_score_bmi,
      },
    }
  }

  async updateWeighingHistory(
    c: Context,
    id: number,
    data: UpdateWeighingHistoryDTO
  ) {
    await this.repo.updateWeighingHistory(
      c,
      id,
      data.patient_immunization_id,
      data
    )

    return {
      status: true,
      message: "Success update weighing history",
    }
  }

  async getWeighingHistoryList(c: Context, patientImmunizationId: number) {
    const data = await this.repo.getWeighingHistoryList(
      c,
      patientImmunizationId
    )
    if (!data || data.length === 0) return { data: [] }

    const birthDate = data[0]?.birth_date ? doDecrypt(data[0].birth_date) : null
    const { earliestDate, latestDate } = this.#findEarliestAndLatestDates(data)
    const formattedData = data.map((item) =>
      this.#formatWeighingHistoryItem(
        item,
        birthDate,
        earliestDate,
        latestDate,
        data.length
      )
    )

    return { data: formattedData }
  }

  async list(c: Context, params: GetImmunizationQuery, subDistrictId: number) {
    const { data, total } = await this.repo.list(c, params, subDistrictId)
    const dataFormated = await Promise.all(
      data.map((item) => this.#formatListItem(c, item))
    )
    return new PaginatedResponse(params, dataFormated, total)
  }

  #resolveNikByIdentityType(data: {
    identity_type: number | string | null
    nik: string | null
    parent_nik: string | null
  }): string | null {
    const identityType = Number(data.identity_type)

    if (identityType === identityTypes.NIK) {
      return data.nik ? doDecrypt(data.nik) : null
    }

    if (identityType === identityTypes.MOTHER_NIK) {
      return data.parent_nik ? doDecrypt(data.parent_nik) : null
    }

    if (data.nik) return doDecrypt(data.nik)
    if (data.parent_nik) return doDecrypt(data.parent_nik)
    return null
  }

  async detail(c: Context, id: number) {
    const data = await this.repo.getDetail(c, id)
    if (!data) return null

    const birthDate = data.birth_date ? doDecrypt(data.birth_date) : null
    const ageDetails = this.#calculateAge(birthDate)
    const details = await this.repo.getPatientImmunizationDetails(c, id)
    const summary = this.#calculateDetailSummary(details)
    const draftSummary = await this.#calculateDraftSummary(c, id, details)
    const nik = this.#resolveNikByIdentityType(data)

    return {
      data: {
        id: data.id,
        personal_identity: {
          patient_id: data.patient_id,
          nik: nik,
          name: data.name ? doDecrypt(data.name) : null,
          date_of_birth: birthDate,
          gender: data.gender == 1 ? "Male" : "Female",
          parent_name: data.parent_name ? doDecrypt(data.parent_name) : null,
          age: `${ageDetails.years} Years ${ageDetails.months} Month ${ageDetails.days} Day`,
          detail_age: ageDetails,
        },
        summary,
        draft_summary: draftSummary,
      },
    }
  }

  async getImmunizationStatus(c: Context, id: number) {
    const statusData = await this.repo.getImmunizationStatus(c, id)

    const uniqueMaterialIds = [
      ...new Set(
        statusData
          .map((item) => item.material_id)
          .filter((id): id is number => id !== null && id !== undefined)
      ),
    ]

    const batchesData = await this.repo.getBatchesByMaterialIds(
      c,
      uniqueMaterialIds
    )

    const batchesByMaterial = this.#groupBatchesByMaterial(batchesData)

    const materialGroups = this.#groupByMaterialName(statusData)
    const { materialTargetIdToDoseNumber, firstNotRecordedByGroup } =
      this.#processMaterialGroups(materialGroups)

    const formattedData = statusData.map((item) =>
      this.#formatImmunizationStatusItem(
        item,
        materialTargetIdToDoseNumber,
        firstNotRecordedByGroup,
        item.is_managed_in_batch ?? 0,
        batchesByMaterial.get(item.material_id ?? 0) || []
      )
    )

    return { data: formattedData }
  }

  async updateImmunizationStatus(
    c: Context,
    patientId: number,
    vaccineId: number,
    payload: UpdateImmunizationStatusDTO
  ) {
    const immunizationDetail = await this.repo.findImmunizationDetail(
      c,
      patientId,
      vaccineId
    )
    await this.#validateImmunizationUpdate(c, patientId, vaccineId)
    const data = this.#buildUpdateStatusData(
      payload,
      immunizationDetail?.last_status
    )
    if (!immunizationDetail?.material_target_id) {
      throw new ValidationError("Material target ID not found")
    }
    await this.#validateImmunizationUpdate(c, patientId, vaccineId)
    await this.repo.updateImmunizationStatus(
      c,
      patientId,
      immunizationDetail.material_target_id,
      data
    )
    return { message: "Immunization status updated successfully" }
  }

  async discardDraft(c: Context, patientImmunizationId: number) {
    try {
      await this.repo.discardWeighingDraft(c, patientImmunizationId)
    } catch (error) {
      console.log("No weighing draft to discard")
    }

    await this.repo.discardImmunizationDraft(c, patientImmunizationId)
    return { status: true, message: "Draft successfully discarded" }
  }

  async updateWeighingHistoryStatus(c: Context, id: number) {
    await this.repo.updateWeighingHistoryStatus(c, id)

    await this.repo.updateImmunizationDetailsStatus(c, id)

    return {
      status: true,
      message: "Success update weighing history status",
    }
  }
}
