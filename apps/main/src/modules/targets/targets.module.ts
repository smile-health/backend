import { Context } from "hono"
import { TargetsRepository } from "./targets.repository.js"
import { LocationRepository } from "../location/location.repository.js"
import {
  GetIdentityAndAddressResponseDTO,
  GetSummaryRequestDTO,
  TargetSummaryResponseDTO,
  GetSummaryDetailRequestDTO,
  GetSummaryDetailDTO,
  CreateTargetDataSuccessResponseDTO,
  AddTargetDataRequest,
  TargetGroup,
  NikListRequestDTO,
  LocationDetailsResponse,
  SchoolEntitySchema,
  TargetDataDetailResponseSchemaDTO,
  TargetDetailSchema,
  UpdateTargetDataRequest,
  DeleteResponseSchemaDTO,
  CreateTargetIdealDTO,
} from "./targets.schema.js"
import { getIdentityAndAddressByNIK as getIdentityAndAddressByNIKUtil } from "@/common/utils/verify-nik.js"
import {
  BIAS_TARGET_LABELS_V2,
  OUT_OF_SCHOOL_TARGET_GROUPS,
  SCHOOL_TARGET_GROUPS,
  SCHOOL_TARGET_LABELS,
  TARGET_GROUP_NAME_TRANSFORM,
  TARGET_GROUP_ORDER,
  VILLAGE_LABEL,
  VILLAGE_TARGET_GROUPS,
  VILLAGE_TARGET_LABELS,
} from "@/common/constants/target.js"
import { EntityRepository } from "../entity/entity.repository.js"
import { TargetGroupRepository } from "../target-group/target-group.repository.js"
import {
  doDecrypt,
  doEncrypt,
} from "../transaction/utils/transaction.encryption.js"
import {
  buildAddressFromLocation,
  getLocationDetailsFromVillageId,
} from "@/common/utils/address.utils.js"
import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { ValidationError } from "@smile/lib/error.js"
import { maritalStatus } from "@/common/constants/marital-status.js"
import moment from "moment"

export class TargetsModule {
  constructor(
    private readonly targetsRepository: TargetsRepository,
    private readonly locationRepository: LocationRepository,
    private readonly targetGroupRepository: TargetGroupRepository,
    private readonly entityRepository: EntityRepository
  ) {}

  private getPrefix(id: number | null | undefined): "village" | "school" {
    return id && VILLAGE_TARGET_GROUPS.includes(id) ? "village" : "school"
  }

  private async getOrCreateMicroplanning(
    c: Context,
    entityId: number
  ): Promise<number> {
    const currentYear = new Date().getFullYear()
    const nextYear = currentYear + 1

    return await this.targetsRepository.findOrCreateMicroplanning(
      c,
      entityId,
      nextYear
    )
  }

  private getEntityIdFromContext(c: Context): number {
    const entityId = c.var.userEntity?.global_id
    if (!entityId) {
      throw new Error("Entity ID is required from authentication token")
    }
    return entityId
  }

  private determineAgeGroup(
    dateOfBirth: string,
    gender: number,
    groups: TargetGroup[]
  ): number | undefined {
    const age = this.calculateAge(dateOfBirth)
    if (!age) return undefined

    const groupMap = new Map(groups.map((g) => [g.id, g.id]))
    const rules = [
      { condition: () => age.months < 2, groupId: 1 },
      { condition: () => age.months >= 2 && age.months < 12, groupId: 2 },
      { condition: () => age.years >= 1 && age.years < 2, groupId: 3 },
      {
        condition: () => gender === 2 && age.years >= 15 && age.years < 40,
        groupId: 9,
      },
      { condition: () => age.years >= 12 && gender === 2, groupId: 8 },
      {
        condition: () => gender === 1 && age.years >= 11 && age.years < 12,
        groupId: 10,
      },
      {
        condition: () => age.years >= 11 && age.years < 12 && gender === 2,
        groupId: 7,
      },
      { condition: () => age.years > 7 && age.years <= 8, groupId: 5 },
      { condition: () => age.years > 6 && age.years <= 7, groupId: 4 },
    ]

    const matchedRule = rules.find((rule) => rule.condition())
    return matchedRule && groupMap.has(matchedRule.groupId)
      ? matchedRule.groupId
      : undefined
  }

  private calculateAge(
    dateOfBirth: string
  ): { years: number; months: number; days: number } | undefined {
    const parts = dateOfBirth.split("-").map(Number)
    if (parts.length !== 3) {
      return undefined
    }

    const [year, month, day] = parts as [number, number, number]
    const birthDate = new Date(year, month - 1, day)
    const today = new Date()

    if (birthDate.getTime() > today.getTime()) {
      return undefined
    }

    const days = Math.floor(
      (today.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24)
    )

    const birthYear = birthDate.getFullYear()
    const birthMonth = birthDate.getMonth()
    const birthDay = birthDate.getDate()
    const currentYear = today.getFullYear()
    const currentMonth = today.getMonth()
    const currentDay = today.getDate()

    let months = (currentYear - birthYear) * 12 + (currentMonth - birthMonth)
    if (currentDay < birthDay) {
      months--
    }

    let years = currentYear - birthYear
    if (
      currentMonth < birthMonth ||
      (currentMonth === birthMonth && currentDay < birthDay)
    ) {
      years--
    }

    return { years, months, days }
  }

  async create(
    c: Context,
    data: AddTargetDataRequest,
    userId?: number
  ): Promise<CreateTargetDataSuccessResponseDTO> {
    const encryptedNIK = doEncrypt(data.nik)
    const encryptedDoB = doEncrypt(data.date_of_birth)
    const encryptedRegisteredAdress = data.registered_address
      ? doEncrypt(data.registered_address)
      : undefined
    const encryptedResidenceAdress = data.residence_address
      ? doEncrypt(data.residence_address)
      : undefined
    const encryptedPhoneNumber = doEncrypt(data.phone_number)
    const encryptedName = doEncrypt(data.name)

    const groups = await this.targetGroupRepository.findAll(c)
    let targetGroupId = this.determineAgeGroup(
      data.date_of_birth,
      data.gender,
      groups
    )

    const isVillageTarget =
      targetGroupId && VILLAGE_TARGET_GROUPS.includes(targetGroupId)

    const registeredDetails = getLocationDetailsFromVillageId(
      data.registered_village_id
    )
    const residenceDetails = getLocationDetailsFromVillageId(
      data.residence_village_id
    )

    const entityId = this.getEntityIdFromContext(c)
    const microplanningId = await this.getOrCreateMicroplanning(c, entityId)

    const microplanning = await this.targetsRepository.getMicroplanningById(
      c,
      microplanningId
    )
    const targetStatus = microplanning?.status ?? 0

    const targetDataId = await this.targetsRepository.create(c, {
      nik: encryptedNIK,
      gender: data.gender,
      date_of_birth: encryptedDoB,
      registered_province_id: registeredDetails.provinceId,
      registered_regency_id: registeredDetails.regencyId,
      registered_subdistrict_id: registeredDetails.subdistrictId,
      registered_village_id: data.registered_village_id,
      registered_postal_code: data.registered_postal_code ?? null,
      registered_address: encryptedRegisteredAdress ?? null,
      residence_province_id: residenceDetails.provinceId,
      residence_regency_id: residenceDetails.regencyId,
      residence_subdistrict_id: residenceDetails.subdistrictId,
      residence_village_id: data.residence_village_id,
      residence_postal_code: data.residence_postal_code ?? null,
      residence_address: encryptedResidenceAdress ?? null,
      entity_id:
        isVillageTarget || !targetGroupId
          ? undefined
          : (data.entity_id ?? undefined),
      grade:
        isVillageTarget || !targetGroupId
          ? undefined
          : (data.grade ?? undefined),
      target_group_id: targetGroupId ?? null,
      microplanning_id: microplanningId,
      status: targetStatus,
      name: encryptedName,
      marital_status: data.marital_status ?? 0,
      education_id: data.education_id ?? null,
      occupation_id: data.occupation_id ?? null,
      religion_id: data.religion_id ?? null,
      ethnic_id: data.ethnic_id ?? null,
      phone_number: encryptedPhoneNumber,
      identity_type: 1,
      created_by: userId,
      updated_by: userId,
    })

    const materialTargets =
      await this.targetsRepository.getAllImmunizationMaterialTargets(c)

    const today = moment().format("YYYY-MM-DD")
    let targetIdealsData: CreateTargetIdealDTO[] = []

    for (const mt of materialTargets) {
      if (mt.start_ideal_days == null) continue

      const addDate = mt.category == "bias" ? "year" : "month"

      const idealDate = moment(data.date_of_birth)
        .add(mt.start_ideal_days, "days")
        .format("YYYY-MM-DD")

      const endIdealDate = moment(idealDate)
        .add(1, addDate)
        .format("YYYY-MM-DD")

      if ((today >= idealDate && today <= endIdealDate) || idealDate >= today) {
        const idealDateInDays = Math.abs(
          moment(data.date_of_birth).diff(moment(idealDate), "days")
        )

        const targetGroup = await this.targetsRepository.getTargetGroup(
          c,
          idealDateInDays,
          data.gender
        )

        targetIdealsData.push({
          target_id: Number(targetDataId.insertId),
          material_id: mt.material_id,
          material_target_id: Number(mt.id),
          start_ideal_days: mt.start_ideal_days,
          ideal_date: idealDate,
          end_ideal_date: endIdealDate,
          target_group_id: targetGroup?.id ?? 0,
          microplanning_id: microplanningId,
          created_by: userId ?? 0,
        })
      }
    }

    await this.targetsRepository.createTargetIdeals(c, targetIdealsData)

    return {
      id: Number(targetDataId.insertId),
    }
  }

  async getIdentityAndAddressByNIK(
    c: Context,
    nik: string
  ): Promise<GetIdentityAndAddressResponseDTO> {
    return getIdentityAndAddressByNIKUtil(c, nik, this.locationRepository)
  }

  async getSummaryTargets(
    c: Context,
    query: GetSummaryRequestDTO,
    subDistrictId: number
  ): Promise<TargetSummaryResponseDTO> {
    const entityId = this.getEntityIdFromContext(c)
    const currentYear = new Date().getFullYear()
    const nextYear = currentYear + 1

    const currentYearMicroplanningId =
      await this.targetsRepository.findOrCreateMicroplanning(
        c,
        entityId,
        currentYear
      )
    const nextYearMicroplanningId =
      await this.targetsRepository.findOrCreateMicroplanning(
        c,
        entityId,
        nextYear
      )

    const ids = this.getTargetGroupIdsByType(query.type)

    const [previousGrouped, currentGrouped, previousEqualAge, currentEqualAge] =
      await Promise.all([
        this.targetsRepository.findAllWithGroup(
          c,
          ids,
          subDistrictId,
          currentYearMicroplanningId
        ),
        this.targetsRepository.findAllWithGroup(
          c,
          ids,
          subDistrictId,
          nextYearMicroplanningId
        ),
        this.targetsRepository.findEqualAgeGroupCounts(
          c,
          subDistrictId,
          currentYearMicroplanningId
        ),
        this.targetsRepository.findEqualAgeGroupCounts(
          c,
          subDistrictId,
          nextYearMicroplanningId
        ),
      ])

    const formatData = (grouped: any[], setaraUsiaCounts: any[]) => {
      if (!query.type || query.type === "") {
        const baseResults = grouped.map((item) => ({
          id: item.id ?? null,
          name:
            item.id && item.id in TARGET_GROUP_NAME_TRANSFORM
              ? TARGET_GROUP_NAME_TRANSFORM[
                  item.id as keyof typeof TARGET_GROUP_NAME_TRANSFORM
                ]
              : (item.title ?? null),
          qty: Number(item.qty),
          prefix:
            item.id && VILLAGE_TARGET_GROUPS.includes(item.id)
              ? "village"
              : "school",
        }))

        const setaraUsiaResults: Array<{
          id: number
          name: string
          qty: number
          prefix: "village" | "school"
        }> = []
        const setaraUsiaMap = new Map<string, number>()

        for (const item of setaraUsiaCounts) {
          const key = `${item.target_group_id}_${item.gender ?? "all"}`
          setaraUsiaMap.set(key, Number(item.qty))
        }

        const targetGroupId11 = 10
        const targetGroupId11Decimal = 10.1
        const count4 =
          setaraUsiaMap.get("4_all") ??
          setaraUsiaMap.get("4_null") ??
          (setaraUsiaMap.get("4_1") ?? 0) + (setaraUsiaMap.get("4_2") ?? 0)
        const count5 =
          setaraUsiaMap.get("5_all") ??
          setaraUsiaMap.get("5_null") ??
          (setaraUsiaMap.get("5_1") ?? 0) + (setaraUsiaMap.get("5_2") ?? 0)
        const count7Female = setaraUsiaMap.get("7_2") ?? 0
        const count11Male = setaraUsiaMap.get(`${targetGroupId11}_1`) ?? 0

        setaraUsiaResults.push({
          id: 4.1,
          name: TARGET_GROUP_NAME_TRANSFORM[4.1],
          qty: count4,
          prefix: "village" as "village" | "school",
        })

        setaraUsiaResults.push({
          id: 5.1,
          name: TARGET_GROUP_NAME_TRANSFORM[5.1],
          qty: count5,
          prefix: "village" as "village" | "school",
        })

        setaraUsiaResults.push({
          id: 7.1,
          name: TARGET_GROUP_NAME_TRANSFORM[7.1],
          qty: count7Female,
          prefix: "village" as "village" | "school",
        })

        setaraUsiaResults.push({
          id: targetGroupId11Decimal,
          name: TARGET_GROUP_NAME_TRANSFORM[targetGroupId11Decimal],
          qty: count11Male,
          prefix: "village" as "village" | "school",
        })

        return [...baseResults, ...setaraUsiaResults].sort((a, b) => {
          const indexA = TARGET_GROUP_ORDER.indexOf(Math.floor(a.id))
          const indexB = TARGET_GROUP_ORDER.indexOf(Math.floor(b.id))
          if (indexA !== indexB) return indexA - indexB
          return a.id - b.id
        })
      }

      const type = query.type.toLowerCase()

      if (type === "nonbias") {
        return grouped
          .map((item) => {
            let name: string | null = item.title ?? null

            if (item.id && item.id in VILLAGE_TARGET_LABELS) {
              name =
                VILLAGE_TARGET_LABELS[
                  item.id as keyof typeof VILLAGE_TARGET_LABELS
                ]
            } else if (item.id && item.id in TARGET_GROUP_NAME_TRANSFORM) {
              name =
                TARGET_GROUP_NAME_TRANSFORM[
                  item.id as keyof typeof TARGET_GROUP_NAME_TRANSFORM
                ]
            }

            return {
              id: item.id ?? null,
              name,
              qty: Number(item.qty),
              prefix:
                item.id && VILLAGE_TARGET_GROUPS.includes(item.id)
                  ? "village"
                  : "school",
            }
          })
          .sort((a, b) => {
            const indexA = TARGET_GROUP_ORDER.indexOf(a.id)
            const indexB = TARGET_GROUP_ORDER.indexOf(b.id)
            return indexA - indexB
          })
      } else if (type === "bias") {
        const counts = new Map<number, number>()
        for (const item of grouped) {
          if (item.id) counts.set(item.id, Number(item.qty))
        }

        const targetGroupId11 = 10
        const grade5Female = counts.get(7) ?? 0
        const grade5Male = counts.get(targetGroupId11) ?? 0

        return [
          {
            id: 4,
            name: BIAS_TARGET_LABELS_V2[4],
            qty: counts.get(4) ?? 0,
            prefix: "school" as const,
          },
          {
            id: 5,
            name: BIAS_TARGET_LABELS_V2[5],
            qty: counts.get(5) ?? 0,
            prefix: "school" as const,
          },
          {
            id: 12,
            name: BIAS_TARGET_LABELS_V2[12],
            qty: grade5Female + grade5Male,
            prefix: "school" as const,
          },
          {
            id: 13,
            name: BIAS_TARGET_LABELS_V2[13],
            qty: grade5Female,
            prefix: "school" as const,
          },
        ].filter((item) => item.qty > 0 || [4, 5, 12, 13].includes(item.id))
      }

      return grouped
        .map((item) => ({
          id: item.id ?? null,
          name:
            item.id && item.id in TARGET_GROUP_NAME_TRANSFORM
              ? TARGET_GROUP_NAME_TRANSFORM[
                  item.id as keyof typeof TARGET_GROUP_NAME_TRANSFORM
                ]
              : (item.title ?? null),
          qty: Number(item.qty),
          prefix:
            item.id && VILLAGE_TARGET_GROUPS.includes(item.id)
              ? "village"
              : "school",
        }))
        .sort((a, b) => {
          const indexA = TARGET_GROUP_ORDER.indexOf(a.id)
          const indexB = TARGET_GROUP_ORDER.indexOf(b.id)
          return indexA - indexB
        })
    }

    const previousData = formatData(previousGrouped, previousEqualAge)
    const currentData = formatData(currentGrouped, currentEqualAge)

    return {
      data: currentData,
      previous_data: previousData,
      next_year: nextYear,
    }
  }

  async getSummaryDetailsWithTargetGroupId(
    c: Context,
    param: GetSummaryDetailRequestDTO,
    sub_district_id: string
  ): Promise<GetSummaryDetailDTO> {
    const entityId = this.getEntityIdFromContext(c)
    const microplanningId = await this.getOrCreateMicroplanning(c, entityId)
    const subDistrictIdNum = Number(sub_district_id)
    const targetGroupId = Number(param.target_group_id)

    const allTargetGroups = await this.targetsRepository.getAllTargetGroups(c)

    if (OUT_OF_SCHOOL_TARGET_GROUPS.includes(targetGroupId)) {
      const parentTargetGroupId = Math.floor(targetGroupId)
      const { result } = await this.locationRepository.findTargetsByLocation(
        c,
        subDistrictIdNum,
        parentTargetGroupId,
        microplanningId
      )

      const promotedMap = await this.getPromotedTargetsByReference(
        c,
        subDistrictIdNum,
        targetGroupId,
        microplanningId,
        allTargetGroups,
        "location"
      )

      const data = (await result).map((item) => ({
        ...item,
        total: Number(item.total) + (promotedMap.get(item.id) ?? 0),
      }))
      const total = data.reduce((acc, item) => acc + item.total, 0)

      return { total, data }
    }

    if (SCHOOL_TARGET_GROUPS.includes(targetGroupId)) {
      const { schoolTargets } =
        await this.entityRepository.findTargetsByEntities(
          c,
          subDistrictIdNum,
          targetGroupId,
          microplanningId
        )

      const promotedMap = await this.getPromotedTargetsByReference(
        c,
        subDistrictIdNum,
        targetGroupId,
        microplanningId,
        allTargetGroups,
        "entity"
      )

      const data = schoolTargets.map((item) => ({
        ...item,
        total: Number(item.total) + (promotedMap.get(item.id) ?? 0),
      }))
      const total = data.reduce((acc, item) => acc + item.total, 0)

      return { total, data }
    }

    const { result } = await this.locationRepository.findTargetsByLocation(
      c,
      subDistrictIdNum,
      targetGroupId,
      microplanningId
    )

    const promotedMap = await this.getPromotedTargetsByReference(
      c,
      subDistrictIdNum,
      targetGroupId,
      microplanningId,
      allTargetGroups,
      "location"
    )

    const data = (await result).map((item) => ({
      ...item,
      total: Number(item.total) + (promotedMap.get(item.id) ?? 0),
    }))
    const total = data.reduce((acc, item) => acc + item.total, 0)

    return { total, data }
  }

  private getAllPreviousTargetGroupIds(targetGroupId: number): number[] {
    const idx = TARGET_GROUP_ORDER.indexOf(Math.floor(targetGroupId))
    if (idx <= 0) return []
    return TARGET_GROUP_ORDER.slice(0, idx)
  }

  private isTargetInGroup(
    originalGroupId: number,
    currentGroupId: number,
    queryGroupId: number,
    gender: number
  ): boolean {
    const targetGroupId11 = 10
    if (queryGroupId === 7 && gender !== 2) return false
    if (queryGroupId === targetGroupId11 && gender !== 1) return false

    const origIdx = TARGET_GROUP_ORDER.indexOf(originalGroupId)
    const currIdx = TARGET_GROUP_ORDER.indexOf(currentGroupId)
    const queryIdx = TARGET_GROUP_ORDER.indexOf(queryGroupId)

    return queryIdx > origIdx && queryIdx <= currIdx
  }

  private async getPromotedTargetsByReference(
    c: Context,
    subDistrictId: number,
    queryGroupId: number,
    microplanningId: number,
    allGroups: Array<{ id: number; age_min: number; age_max: number }>,
    type: "location" | "entity"
  ): Promise<Map<number, number>> {
    const promotedByRef = new Map<number, number>()
    const prevGroupIds = this.getAllPreviousTargetGroupIds(queryGroupId)
    if (prevGroupIds.length === 0) return promotedByRef

    const today = new Date()
    const flooredQueryGroupId = Math.floor(queryGroupId)

    for (const prevGroupId of prevGroupIds) {
      const targets = await this.fetchTargetsByType(
        c,
        type,
        subDistrictId,
        prevGroupId,
        microplanningId
      )

      this.processPromotedTargets(
        targets,
        today,
        allGroups,
        prevGroupId,
        flooredQueryGroupId,
        type,
        promotedByRef
      )
    }

    return promotedByRef
  }

  private async fetchTargetsByType(
    c: Context,
    type: "location" | "entity",
    subDistrictId: number,
    prevGroupId: number,
    microplanningId: number
  ) {
    return type === "location"
      ? this.targetsRepository.getTargetsWithDateOfBirthByLocation(
          c,
          subDistrictId,
          prevGroupId,
          microplanningId
        )
      : this.targetsRepository.getTargetsWithDateOfBirthByEntity(
          c,
          subDistrictId,
          prevGroupId,
          microplanningId
        )
  }

  private processPromotedTargets(
    targets: Array<{
      target_id: number | null
      date_of_birth: string | null
      gender: number | null
      village_id?: number
      entity_id?: number
    }>,
    today: Date,
    allGroups: Array<{ id: number; age_min: number; age_max: number }>,
    prevGroupId: number,
    queryGroupId: number,
    type: "location" | "entity",
    promotedByRef: Map<number, number>
  ): void {
    for (const t of targets) {
      const refId = this.getPromotedRefId(
        t,
        today,
        allGroups,
        prevGroupId,
        queryGroupId,
        type
      )
      if (refId !== null) {
        promotedByRef.set(refId, (promotedByRef.get(refId) ?? 0) + 1)
      }
    }
  }

  private getPromotedRefId(
    t: {
      target_id: number | null
      date_of_birth: string | null
      gender: number | null
      village_id?: number
      entity_id?: number
    },
    today: Date,
    allGroups: Array<{ id: number; age_min: number; age_max: number }>,
    prevGroupId: number,
    queryGroupId: number,
    type: "location" | "entity"
  ): number | null {
    if (!t.target_id || !t.date_of_birth || !t.gender) return null

    const dob = doDecrypt(t.date_of_birth)
    const ageInDays = moment(today).diff(moment(dob), "days")
    if (ageInDays < 0) return null

    const matched = this.findMatchingTargetGroup(ageInDays, t.gender, allGroups)
    if (!matched) return null

    if (
      !this.isTargetInGroup(prevGroupId, matched.id, queryGroupId, t.gender)
    ) {
      return null
    }

    return type === "location"
      ? (t as { village_id: number }).village_id
      : (t as { entity_id: number }).entity_id
  }

  async getNikList(c: Context, query: NikListRequestDTO) {
    const entityId = this.getEntityIdFromContext(c)
    const microplanningId = await this.getOrCreateMicroplanning(c, entityId)

    if (query.keyword) {
      query.keyword = doEncrypt(query.keyword)
    }

    const categoryIdNum = query.category_id
      ? Number(query.category_id)
      : undefined
    const baseTargetGroupId = categoryIdNum
      ? Math.floor(categoryIdNum)
      : undefined

    const { list, total, name, category_id } =
      await this.targetsRepository.findAll(c, query, microplanningId)

    const promotedList = await this.getPromotedNikList(
      c,
      Number(query.id),
      baseTargetGroupId,
      microplanningId,
      query.prefix === "school" ? "entity" : "location"
    )

    const combinedList = [...list, ...promotedList]
    const decryptedList = combinedList.map((item) => ({
      ...item,
      nik: doDecrypt(item.nik),
    }))

    const mappedList = {
      name,
      category_name: category_id
        ? TARGET_GROUP_NAME_TRANSFORM[category_id]
        : null,
      list: decryptedList,
    }

    return new PaginatedResponse(query, mappedList, total + promotedList.length)
  }

  private async getPromotedNikList(
    c: Context,
    referenceId: number,
    queryGroupId: number | undefined,
    microplanningId: number,
    type: "location" | "entity"
  ): Promise<Array<{ nik: string; id: number }>> {
    if (!queryGroupId) return []

    const prevGroupIds = this.getAllPreviousTargetGroupIds(queryGroupId)
    if (prevGroupIds.length === 0) return []

    const allGroups = await this.targetsRepository.getAllTargetGroups(c)
    const today = new Date()
    const promoted: Array<{ nik: string; id: number }> = []

    for (const prevGroupId of prevGroupIds) {
      const targets = await this.targetsRepository.getTargetsByReferenceId(
        c,
        referenceId,
        prevGroupId,
        microplanningId,
        type
      )

      const promotedFromGroup = this.filterPromotedNikTargets(
        targets,
        today,
        allGroups,
        prevGroupId,
        queryGroupId
      )
      promoted.push(...promotedFromGroup)
    }

    return promoted
  }

  private filterPromotedNikTargets(
    targets: Array<{
      id: number
      nik: string
      date_of_birth: string | null
      gender: number | null
    }>,
    today: Date,
    allGroups: Array<{ id: number; age_min: number; age_max: number }>,
    prevGroupId: number,
    queryGroupId: number
  ): Array<{ nik: string; id: number }> {
    const result: Array<{ nik: string; id: number }> = []

    for (const t of targets) {
      if (!t.date_of_birth || !t.gender) continue

      const dob = doDecrypt(t.date_of_birth)
      const ageInDays = moment(today).diff(moment(dob), "days")
      if (ageInDays < 0) continue

      const matched = this.findMatchingTargetGroup(
        ageInDays,
        t.gender,
        allGroups
      )
      if (!matched) continue

      if (
        this.isTargetInGroup(prevGroupId, matched.id, queryGroupId, t.gender)
      ) {
        result.push({ nik: t.nik, id: t.id })
      }
    }

    return result
  }

  async deleteDataByNIK(
    c: Context,
    nik: string
  ): Promise<DeleteResponseSchemaDTO> {
    const entityId = this.getEntityIdFromContext(c)
    const microplanningId = await this.getOrCreateMicroplanning(c, entityId)

    let message: string = "Data Berhasil Dihapus"
    let status: boolean = true
    const encryptedNIK = doEncrypt(nik)

    const response = await this.targetsRepository.delete(
      c,
      encryptedNIK,
      microplanningId
    )
    if (!response) {
      message = "Data Gagal Dihapus"
      status = false
    }

    return {
      message,
      status,
    }
  }

  async getDetail(
    c: Context,
    nik: string
  ): Promise<TargetDataDetailResponseSchemaDTO> {
    const entityId = this.getEntityIdFromContext(c)
    const microplanningId = await this.getOrCreateMicroplanning(c, entityId)

    const encryptedNIK = doEncrypt(nik)
    const target = (await this.targetsRepository.findByNik(
      c,
      encryptedNIK,
      microplanningId
    )) as TargetDetailSchema

    if (!target) {
      throw new ValidationError(
        c.var.t("validator.not_exist", {
          field: c.var.t("targets.label.nik"),
        })
      )
    }

    target.nik = doDecrypt(target.nik)
    target.date_of_birth = doDecrypt(target.date_of_birth)
    target.phone_number = doDecrypt(target.phone_number)
    target.name = doDecrypt(target.name)
    target.residence_address = target.residence_address
      ? doDecrypt(target.residence_address)
      : target.residence_address
    target.registered_address = target.registered_address
      ? doDecrypt(target.registered_address)
      : target.registered_address

    const residence_village = (await this.locationRepository.getDetails(
      c,
      target.residence_village_id
    )) as LocationDetailsResponse

    const registered_village = (await this.locationRepository.getDetails(
      c,
      target.registered_village_id
    )) as LocationDetailsResponse

    const school_entity = (await this.entityRepository.findById(
      c,
      target.entity_id
    )) as SchoolEntitySchema | undefined

    return this.#detailTargetMapped(
      target,
      residence_village,
      registered_village,
      school_entity
    )
  }

  async updateTargetData(
    c: Context,
    nik: string,
    data: UpdateTargetDataRequest
  ): Promise<TargetDataDetailResponseSchemaDTO> {
    const entityId = this.getEntityIdFromContext(c)
    const microplanningId = await this.getOrCreateMicroplanning(c, entityId)

    const encryptedNIK = doEncrypt(nik)
    const encryptedName = doEncrypt(data.name)
    const encryptedRegisteredAddress = data.registered_address
      ? doEncrypt(data.registered_address)
      : undefined
    const encryptedResidenceAddress = data.residence_address
      ? doEncrypt(data.residence_address)
      : undefined
    const encryptedPhoneNumber = doEncrypt(data.phone_number)

    const detailedNik = getIdentityAndAddressByNIKUtil(
      c,
      nik,
      this.locationRepository
    )
    const groups = await this.targetGroupRepository.findAll(c)
    let targetGroupId = this.determineAgeGroup(
      (await detailedNik).date_of_birth,
      (await detailedNik).gender,
      groups
    )

    const isVillageTarget =
      targetGroupId && VILLAGE_TARGET_GROUPS.includes(targetGroupId)

    await this.targetsRepository.update(
      c,
      encryptedNIK,
      {
        registered_village_id: data.registered_village_id
          ? Number(data.registered_village_id)
          : undefined,
        registered_postal_code: data.registered_postal_code,
        registered_address: encryptedRegisteredAddress ?? null,
        residence_village_id: data.residence_village_id
          ? Number(data.residence_village_id)
          : undefined,
        residence_postal_code: data.residence_postal_code,
        residence_address: encryptedResidenceAddress ?? null,
        entity_id: isVillageTarget ? null : (data.entity_id ?? null),
        grade: isVillageTarget ? null : (data.grade ?? null),
        name: encryptedName,
        marital_status: data.marital_status ?? 0,
        education_id: data.education_id,
        occupation_id: data.occupation_id,
        religion_id: data.religion_id,
        ethnic_id: data.ethnic_id,
        phone_number: encryptedPhoneNumber,
      },
      microplanningId
    )

    // update microplan target consumptions
    this.updateMicroplanTargetConsumptions(c, encryptedNIK, microplanningId)

    return this.getDetail(c, nik)
  }

  #detailTargetMapped(
    target: TargetDetailSchema,
    residence_village: LocationDetailsResponse,
    registered_village: LocationDetailsResponse,
    school_entity: SchoolEntitySchema | undefined
  ) {
    const registeredAddressLocation = buildAddressFromLocation(
      registered_village,
      target.registered_postal_code
    )
    const residenceAddressLocation = buildAddressFromLocation(
      residence_village,
      target.residence_postal_code
    )

    const maritalStatusData = maritalStatus.find(
      (status) => status.id === target.marital_status
    )

    const mappedData = {
      id: target.id,
      nik: target.nik,
      personal_identity: {
        name: target.name,
        date_of_birth: target.date_of_birth,
        gender: target.gender,
      },
      registered_address: {
        ...registeredAddressLocation,
        address: target.registered_address,
      },
      residence_address: {
        ...residenceAddressLocation,
        address: target.residence_address,
      },
      demographic_info: {
        marital_status: {
          id: target.marital_status,
          title: maritalStatusData?.title ?? "",
        },
        education: {
          id: target.education_id,
          title: target.education_title || "",
        },
        occupation: {
          id: target.occupation_id,
          title: target.occupation_title || "",
        },
        religion: {
          id: target.religion_id,
          title: target.religion_title || "",
        },
        ethnic: {
          id: target.ethnic_id,
          title: target.ethnic_title || "",
        },
        phone_number: target.phone_number,
      },
    } as TargetDataDetailResponseSchemaDTO

    if (school_entity) {
      mappedData.school_address = {
        province_id: school_entity.province_id,
        province: school_entity.province,
        city_id: school_entity.city_id,
        city: school_entity.city,
        district_id: school_entity.district_id,
        district: school_entity.district,
        school_id: school_entity.school_id,
        school_name: school_entity.school_name,
        grade: target.grade ? "GRADE " + target.grade : null,
      }
    }
    return mappedData
  }

  private getTargetGroupIdsByType(type: string | null | undefined): number[] {
    const allIds = Object.keys(TARGET_GROUP_NAME_TRANSFORM).map(Number)

    if (!type || type === "") {
      return allIds
    }

    if (type?.toUpperCase() !== "BIAS") {
      return VILLAGE_TARGET_GROUPS
    }

    return allIds.filter((id) => !VILLAGE_TARGET_GROUPS.includes(id))
  }

  async getGroupedSummary(
    c: Context,
    query: { group_by: "bias" | "non-bias" },
    sub_district_id: string
  ) {
    const entityId = this.getEntityIdFromContext(c)
    const microplanningId = await this.getOrCreateMicroplanning(c, entityId)

    const rawData = await this.targetsRepository.findGroupedTargets(
      c,
      query.group_by,
      microplanningId,
      Number(sub_district_id)
    )

    if (query.group_by === "non-bias") {
      return this.formatVillageGrouping(rawData)
    }

    return this.formatSchoolGrouping(
      c,
      rawData,
      Number(sub_district_id),
      microplanningId
    )
  }

  private formatVillageGrouping(rawData: any[]) {
    const villages = new Map()

    for (const row of rawData) {
      if (!villages.has(row.id)) {
        villages.set(row.id, {
          name: `${VILLAGE_LABEL} ${row.name}`,
          targets: new Map(VILLAGE_TARGET_GROUPS.map((id) => [id, 0])),
        })
      }

      const village = villages.get(row.id)
      const targetGroupId = row.target_group_id

      if (targetGroupId && VILLAGE_TARGET_GROUPS.includes(targetGroupId)) {
        const count = village.targets.get(targetGroupId)
        village.targets.set(targetGroupId, count + 1)
      }
    }

    return {
      data: Array.from(villages.values()).map((village) => ({
        name: village.name,
        targets: VILLAGE_TARGET_GROUPS.map((id) => ({
          category:
            VILLAGE_TARGET_LABELS[id as keyof typeof VILLAGE_TARGET_LABELS],
          count: village.targets.get(id),
        })),
      })),
    }
  }

  private async formatSchoolGrouping(
    c: Context,
    rawData: any[],
    subDistrictId: number,
    microplanningId: number
  ) {
    const schoolGroups = this.aggregateTargetsByEntity(
      rawData,
      SCHOOL_TARGET_GROUPS
    )
    const targetBySchool = this.mapEntitiesToTargetList(schoolGroups)

    const outOfSchool = await this.getOutOfSchoolSummary(
      c,
      subDistrictId,
      microplanningId
    )

    return {
      data_out_of_school: [outOfSchool],
      data: targetBySchool,
    }
  }

  private aggregateTargetsByEntity(data: any[], groupIds: number[]) {
    const entities = new Map()

    for (const item of data) {
      if (!entities.has(item.id)) {
        entities.set(item.id, {
          name: item.name,
          counts: new Map(groupIds.map((id) => [id, 0])),
        })
      }

      const entity = entities.get(item.id)
      if (item.target_group_id && groupIds.includes(item.target_group_id)) {
        const current = entity.counts.get(item.target_group_id)
        entity.counts.set(item.target_group_id, current + 1)
      }
    }

    return entities
  }

  private mapEntitiesToTargetList(entities: Map<any, any>) {
    return Array.from(entities.values()).map((entity) => ({
      name: entity.name,
      targets: this.formatTargetCategories(entity.counts),
    }))
  }

  private formatTargetCategories(counts: Map<number, number>, prefix = "") {
    const targetGroupId11 = 10
    return [
      {
        category: prefix + SCHOOL_TARGET_LABELS[4],
        count: counts.get(4),
      },
      {
        category: prefix + SCHOOL_TARGET_LABELS[5],
        count: counts.get(5),
      },
      {
        category: prefix + SCHOOL_TARGET_LABELS[7],
        targets: [
          {
            category: "Td @10 ds (Male & Female)",
            count: (counts.get(7) ?? 0) + (counts.get(targetGroupId11) ?? 0),
          },
          {
            category: "HPV @1 DS (Female)",
            count: counts.get(7),
          },
        ],
      },
    ]
  }

  private async getOutOfSchoolSummary(
    c: Context,
    subDistrictId: number,
    microplanningId: number
  ) {
    const targets = await this.targetsRepository.findOutOfSchoolTargets(
      c,
      subDistrictId,
      SCHOOL_TARGET_GROUPS,
      microplanningId
    )

    const counts = new Map(SCHOOL_TARGET_GROUPS.map((id) => [id, 0]))
    for (const target of targets) {
      if (target.target_group_id) {
        const current = counts.get(target.target_group_id) ?? 0
        counts.set(target.target_group_id, current + 1)
      }
    }

    return {
      name: "Children Not in School",
      targets: this.formatTargetCategories(counts, "Setara "),
    }
  }

  async getTargetGroup(c: Context) {
    return await this.targetGroupRepository.findAll(c)
  }

  private async updateMicroplanTargetConsumptions(
    c: Context,
    nik: string,
    microplanningId: number
  ) {
    const targets = await this.targetsRepository.findByNik(
      c,
      nik,
      microplanningId
    )

    if (targets) {
      const gender = targets.gender
      const dateOfBirth = targets.date_of_birth
        ? doDecrypt(targets.date_of_birth)
        : null

      const microplanTarget =
        await this.targetsRepository.getMicroplanTargetConsumptions(
          c,
          targets?.id
        )

      microplanTarget.map(async (item) => {
        const idealDateInDays = Math.abs(
          moment(dateOfBirth).diff(moment(item.ideal_date), "days")
        )

        const targetGroup = await this.targetsRepository.getTargetGroup(
          c,
          idealDateInDays,
          gender
        )

        const targetIdealData = {
          target_group_id: targetGroup?.id ?? 0,
        }

        await this.targetsRepository.updateTargetIdeals(
          c,
          item.id,
          targetIdealData
        )
      })
    }
  }

  async getSummaryTargetsMicroplanByIdealDate(
    c: Context,
    query: GetSummaryRequestDTO,
    subDistrictId: number
  ) {
    const entityId = this.getEntityIdFromContext(c)
    const currentYear = new Date().getFullYear()
    const nextYear = currentYear + 1

    const [currentYearMicroplanningId, nextYearMicroplanningId] =
      await Promise.all([
        this.targetsRepository.findOrCreateMicroplanning(
          c,
          entityId,
          currentYear
        ),
        this.targetsRepository.findOrCreateMicroplanning(c, entityId, nextYear),
      ])

    const ids = this.getTargetGroupIdsByType(query.type)
    const integerIds = ids.filter((id) => Number.isInteger(id))
    const allTargetGroups = await this.targetsRepository.getAllTargetGroups(c)
    const isNonBias =
      query.type?.toUpperCase() === "NON-BIAS" ||
      query.type?.toUpperCase() === "NONBIAS"

    const [originalCounts, promotedCounts, equalAgeCounts] = await Promise.all([
      this.getOriginalTargetCounts(
        c,
        currentYearMicroplanningId,
        nextYearMicroplanningId,
        subDistrictId,
        integerIds
      ),
      this.getPromotedTargetCounts(
        c,
        currentYearMicroplanningId,
        nextYearMicroplanningId,
        subDistrictId,
        integerIds,
        allTargetGroups
      ),
      this.getEqualAgeGroupCounts(
        c,
        currentYearMicroplanningId,
        nextYearMicroplanningId,
        subDistrictId
      ),
    ])

    return {
      data: this.formatMicroplanSummaryWithDecimal(
        integerIds,
        originalCounts.nextYear,
        promotedCounts.nextYear,
        equalAgeCounts.nextYear,
        allTargetGroups,
        isNonBias
      ),
      previous_data: this.formatMicroplanSummaryWithDecimal(
        integerIds,
        originalCounts.currentYear,
        promotedCounts.currentYear,
        equalAgeCounts.currentYear,
        allTargetGroups,
        isNonBias
      ),
      next_year: nextYear,
    }
  }

  private async getEqualAgeGroupCounts(
    c: Context,
    currentYearMicroplanningId: number,
    nextYearMicroplanningId: number,
    subDistrictId: number
  ) {
    const [currentYear, nextYear] = await Promise.all([
      this.targetsRepository.findEqualAgeGroupCounts(
        c,
        subDistrictId,
        currentYearMicroplanningId
      ),
      this.targetsRepository.findEqualAgeGroupCounts(
        c,
        subDistrictId,
        nextYearMicroplanningId
      ),
    ])
    return { currentYear, nextYear }
  }

  private formatMicroplanSummaryWithDecimal(
    ids: number[],
    original: Awaited<
      ReturnType<typeof this.targetsRepository.getTargetsCountByGroup>
    >,
    recalculated: Map<number, number>,
    equalAgeCounts: Awaited<
      ReturnType<typeof this.targetsRepository.findEqualAgeGroupCounts>
    >,
    allTargetGroups: Awaited<
      ReturnType<typeof this.targetsRepository.getAllTargetGroups>
    >,
    isNonBias: boolean = false
  ) {
    const baseResults = ids.map((id) => {
      const originalData = original.find((item) => item.id === id)
      const targetGroup = allTargetGroups.find((tg) => tg.id === id)

      return {
        id,
        name:
          id in TARGET_GROUP_NAME_TRANSFORM
            ? TARGET_GROUP_NAME_TRANSFORM[
                id as keyof typeof TARGET_GROUP_NAME_TRANSFORM
              ]
            : (targetGroup?.title ?? null),
        qty: Number(originalData?.qty ?? 0) + (recalculated.get(id) ?? 0),
        prefix: this.getPrefix(id),
      }
    })

    const decimalResults = isNonBias
      ? []
      : this.calculateDecimalGroupCounts(equalAgeCounts)

    return [...baseResults, ...decimalResults].sort((a, b) => {
      const normalizeId = (id: number) => {
        const floorId = Math.floor(id)
        return floorId === 10 ? 11 : floorId
      }

      // Define consistent order regardless of environment
      const SORT_ORDER = [1, 2, 3, 4, 5, 7, 11, 9]
      const indexA = SORT_ORDER.indexOf(normalizeId(a.id))
      const indexB = SORT_ORDER.indexOf(normalizeId(b.id))

      // If not found in order, put at end
      const finalIndexA = indexA === -1 ? 999 : indexA
      const finalIndexB = indexB === -1 ? 999 : indexB

      if (finalIndexA !== finalIndexB) return finalIndexA - finalIndexB
      return a.id - b.id
    })
  }

  private calculateDecimalGroupCounts(
    equalAgeCounts: Awaited<
      ReturnType<typeof this.targetsRepository.findEqualAgeGroupCounts>
    >
  ) {
    const setaraUsiaMap = new Map<string, number>()
    for (const item of equalAgeCounts) {
      const key = `${item.target_group_id}_${item.gender ?? "all"}`
      setaraUsiaMap.set(key, Number(item.qty))
    }

    const targetGroupId11 = 10
    const targetGroupId11Decimal = 10.1
    const count4 =
      setaraUsiaMap.get("4_all") ??
      setaraUsiaMap.get("4_null") ??
      (setaraUsiaMap.get("4_1") ?? 0) + (setaraUsiaMap.get("4_2") ?? 0)
    const count5 =
      setaraUsiaMap.get("5_all") ??
      setaraUsiaMap.get("5_null") ??
      (setaraUsiaMap.get("5_1") ?? 0) + (setaraUsiaMap.get("5_2") ?? 0)
    const count7Female = setaraUsiaMap.get("7_2") ?? 0
    const count11Male = setaraUsiaMap.get(`${targetGroupId11}_1`) ?? 0

    return [
      {
        id: 4.1,
        name: TARGET_GROUP_NAME_TRANSFORM[4.1],
        qty: count4,
        prefix: "village" as const,
      },
      {
        id: 5.1,
        name: TARGET_GROUP_NAME_TRANSFORM[5.1],
        qty: count5,
        prefix: "village" as const,
      },
      {
        id: 7.1,
        name: TARGET_GROUP_NAME_TRANSFORM[7.1],
        qty: count7Female,
        prefix: "village" as const,
      },
      {
        id: targetGroupId11Decimal,
        name: TARGET_GROUP_NAME_TRANSFORM[targetGroupId11Decimal],
        qty: count11Male,
        prefix: "village" as const,
      },
    ]
  }

  private async getOriginalTargetCounts(
    c: Context,
    currentYearMicroplanningId: number,
    nextYearMicroplanningId: number,
    subDistrictId: number,
    ids: number[]
  ) {
    const [currentYear, nextYear] = await Promise.all([
      this.targetsRepository.getTargetsCountByGroup(
        c,
        currentYearMicroplanningId,
        subDistrictId,
        ids
      ),
      this.targetsRepository.getTargetsCountByGroup(
        c,
        nextYearMicroplanningId,
        subDistrictId,
        ids
      ),
    ])
    return { currentYear, nextYear }
  }

  private async getPromotedTargetCounts(
    c: Context,
    currentYearMicroplanningId: number,
    nextYearMicroplanningId: number,
    subDistrictId: number,
    ids: number[],
    allTargetGroups: Awaited<
      ReturnType<typeof this.targetsRepository.getAllTargetGroups>
    >
  ) {
    const [currentYear, nextYear] = await Promise.all([
      this.calculatePromotedCountsForMicroplanning(
        c,
        currentYearMicroplanningId,
        subDistrictId,
        ids,
        allTargetGroups
      ),
      this.calculatePromotedCountsForMicroplanning(
        c,
        nextYearMicroplanningId,
        subDistrictId,
        ids,
        allTargetGroups
      ),
    ])

    return { currentYear, nextYear }
  }

  private async calculatePromotedCountsForMicroplanning(
    c: Context,
    microplanningId: number,
    subDistrictId: number,
    ids: number[],
    allTargetGroups: Awaited<
      ReturnType<typeof this.targetsRepository.getAllTargetGroups>
    >
  ): Promise<Map<number, number>> {
    const counts = new Map<number, number>()
    ids.forEach((id) => counts.set(id, 0))

    const today = new Date()

    for (const targetGroupId of ids) {
      const count = await this.countPromotedForTargetGroup(
        c,
        microplanningId,
        subDistrictId,
        targetGroupId,
        allTargetGroups,
        today
      )
      counts.set(targetGroupId, count)
    }

    return counts
  }

  private async countPromotedForTargetGroup(
    c: Context,
    microplanningId: number,
    subDistrictId: number,
    targetGroupId: number,
    allTargetGroups: Awaited<
      ReturnType<typeof this.targetsRepository.getAllTargetGroups>
    >,
    today: Date
  ): Promise<number> {
    const prevGroupIds = this.getAllPreviousTargetGroupIds(targetGroupId)
    if (prevGroupIds.length === 0) return 0

    let count = 0
    for (const prevGroupId of prevGroupIds) {
      const targets = await this.fetchTargetsFromPrevGroup(
        c,
        subDistrictId,
        prevGroupId,
        microplanningId
      )
      count += this.countPromotedTargets(
        targets,
        today,
        allTargetGroups,
        prevGroupId,
        targetGroupId
      )
    }
    return count
  }

  private async fetchTargetsFromPrevGroup(
    c: Context,
    subDistrictId: number,
    prevGroupId: number,
    microplanningId: number
  ) {
    const [villageTargets, schoolTargets] = await Promise.all([
      this.targetsRepository.getTargetsWithDateOfBirthByLocation(
        c,
        subDistrictId,
        prevGroupId,
        microplanningId
      ),
      this.targetsRepository.getTargetsWithDateOfBirthByEntity(
        c,
        subDistrictId,
        prevGroupId,
        microplanningId
      ),
    ])
    return [...villageTargets, ...schoolTargets]
  }

  private countPromotedTargets(
    targets: Array<{ date_of_birth: string | null; gender: number | null }>,
    today: Date,
    allTargetGroups: Awaited<
      ReturnType<typeof this.targetsRepository.getAllTargetGroups>
    >,
    prevGroupId: number,
    targetGroupId: number
  ): number {
    return targets.filter((target) =>
      this.isTargetPromoted(
        target,
        today,
        allTargetGroups,
        prevGroupId,
        targetGroupId
      )
    ).length
  }

  private isTargetPromoted(
    target: { date_of_birth: string | null; gender: number | null },
    today: Date,
    allTargetGroups: Awaited<
      ReturnType<typeof this.targetsRepository.getAllTargetGroups>
    >,
    prevGroupId: number,
    targetGroupId: number
  ): boolean {
    if (!target.date_of_birth || !target.gender) return false

    const dob = doDecrypt(target.date_of_birth)
    const ageInDays = moment(today).diff(moment(dob), "days")
    if (ageInDays < 0) return false

    const matched = this.findMatchingTargetGroup(
      ageInDays,
      target.gender,
      allTargetGroups
    )
    if (!matched) return false

    return this.isTargetInGroup(
      prevGroupId,
      matched.id,
      targetGroupId,
      target.gender
    )
  }

  private findMatchingTargetGroup(
    ageInDays: number,
    gender: number,
    targetGroups: Array<{ id: number; age_min: number; age_max: number }>,
    filterIds?: number[]
  ) {
    return targetGroups.find(
      (tg) =>
        (filterIds ? filterIds.includes(tg.id) : true) &&
        ageInDays >= tg.age_min &&
        ageInDays <= tg.age_max &&
        this.isGenderMatch(tg.id, gender)
    )
  }

  private isGenderMatch(targetGroupId: number, gender: number): boolean {
    if (targetGroupId === 7 && gender !== 2) return false
    if (targetGroupId === 10 && gender !== 1) return false
    if (targetGroupId === 8 && gender !== 2) return false
    if (targetGroupId === 9 && gender !== 2) return false

    return true
  }
}
