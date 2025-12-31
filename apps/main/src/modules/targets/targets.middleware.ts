import { BaseMiddleware } from "@smile/lib/base/middleware.js"
import { Context } from "hono"
import {
  AddTargetDataRequest,
  AddTargetDataRequestSchema,
  NIKParamSchema,
  UpdateTargetDataRequest,
  UpdateTargetDataRequestSchema,
  LocationDetailsResponse,
} from "./targets.schema.js"
import z from "zod"
import { TargetsRepository } from "./targets.repository.js"
import { LocationRepository } from "../location/location.repository.js"
import { doEncrypt } from "../transaction/utils/transaction.encryption.js"
import {
  validateRequiredFields,
  addValidationIssue,
} from "@/common/utils/validation.utils.js"
import { getIdentityAndAddressByNIK } from "@/common/utils/verify-nik.js"

export class TargetsMiddleware extends BaseMiddleware {
  constructor(
    private readonly targetsRepository: TargetsRepository,
    private readonly locationRepository: LocationRepository
  ) {
    super()
  }

  create = (c: Context) => {
    return AddTargetDataRequestSchema.superRefine(
      async (data: AddTargetDataRequest, ctx: z.RefinementCtx) => {
        await this.#createRequestValidation(c, ctx, data)
        await this.#validateNIKMatchesData(c, ctx, data)
        await this.#validateNIKStructure(c, ctx, data.nik)
        await this.#checkValidateLocation(c, ctx, data)
        await this.#checkDataIfExists(c, ctx, data)
      }
    )
  }

  update = (c: Context, nik: string) => {
    return UpdateTargetDataRequestSchema.superRefine(
      async (data: UpdateTargetDataRequest, ctx: z.RefinementCtx) => {
        await this.#updateRequestValidation(c, ctx, data)
        await this.#validateNIKMatchesData(c, ctx, data, nik)
      }
    )
  }

  validateNIKIdentity = (c: Context) => {
    return NIKParamSchema.superRefine(
      async (data: { nik: string }, ctx: z.RefinementCtx) => {
        await this.#validateNIKStructure(c, ctx, data.nik)
      }
    )
  }

  readonly #createRequestValidation = async (
    c: Context,
    ctx: z.RefinementCtx,
    data: AddTargetDataRequest
  ) => {
    const requiredFields = [
      "date_of_birth",
      "gender",
      "registered_postal_code",
      "registered_village_id",
      "residence_postal_code",
      "residence_village_id",
    ] as const

    validateRequiredFields(c, ctx, data, requiredFields, "targets")
  }

  readonly #checkDataIfExists = async (
    c: Context,
    ctx: z.RefinementCtx,
    data: AddTargetDataRequest
  ) => {
    if (data.nik && typeof data.nik === "string" && data.nik.trim() !== "") {
      const encryptedNIK = doEncrypt(data.nik)
      const dataExists = await this.targetsRepository.existsByNIK(
        c,
        encryptedNIK
      )

      if (dataExists) {
        addValidationIssue(
          c,
          ctx,
          "nik",
          "validator.exist",
          "NIK"
        )
        return
      }
    }
  }

  readonly #checkValidateLocation = async (
    c: Context,
    ctx: z.RefinementCtx,
    data: AddTargetDataRequest
  ) => {
    await this.#validateVillageField(
      c,
      ctx,
      data.registered_village_id,
      "registered_village_id"
    )
    await this.#validateVillageField(
      c,
      ctx,
      data.residence_village_id,
      "residence_village_id"
    )
  }

  readonly #validateVillageField = async (
    c: Context,
    ctx: z.RefinementCtx,
    villageId: number | undefined,
    fieldName: string
  ) => {
    if (villageId && typeof villageId === "string") {
      const village = await this.locationRepository.findByID(
        c,
        Number(villageId)
      )

      if (!village) {
        addValidationIssue(
          c,
          ctx,
          fieldName,
          "validator.not_exist",
          `targets.label.${fieldName}`
        )
        return
      }
    }
  }

  readonly #validateNIKStructure = async (
    c: Context,
    ctx: z.RefinementCtx,
    nik: string
  ) => {
    if (
      !nik ||
      (typeof nik === "string" && nik.trim() === "") ||
      nik === ":nik"
    ) {
      addValidationIssue(
        c,
        ctx,
        "nik",
        "validator.required",
        "targets.label.nik"
      )
      return
    }

    if (nik.length !== 16) {
      addValidationIssue(
        c,
        ctx,
        "nik",
        "validator.exact_length",
        "targets.label.nik",
        { length: "16" }
      )
      return
    }

    if (!/^\d+$/.test(nik)) {
      addValidationIssue(c, ctx, "nik", "validator.number", "targets.label.nik")
      return
    }

    const subdistrictId = parseInt(nik.substring(0, 6))

    const locationDetails = (await this.locationRepository.getDetails(
      c,
      subdistrictId
    )) as LocationDetailsResponse

    if (
      !locationDetails?.subdistrict ||
      !locationDetails?.regency ||
      !locationDetails?.province
    ) {
      addValidationIssue(
        c,
        ctx,
        "nik",
        "validator.invalid",
        "targets.label.location"
      )
      return
    }

    const detailedNik = await getIdentityAndAddressByNIK(
      c,
      nik,
      this.locationRepository
    )

    const parsedDate = new Date(detailedNik.date_of_birth)
    const isValidDate =
      parsedDate instanceof Date &&
      !isNaN(parsedDate.getTime()) &&
      parsedDate.getFullYear() === detailedNik.full_year &&
      parsedDate.getMonth() + 1 === detailedNik.month_of_birth &&
      parsedDate.getDate() === detailedNik.actual_day

    if (!isValidDate) {
      addValidationIssue(
        c,
        ctx,
        "nik",
        "validator.invalid",
        "targets.label.date_of_birth"
      )
      return
    }

    const today = new Date()
    if (parsedDate > today) {
      addValidationIssue(
        c,
        ctx,
        "nik",
        "validator.invalid",
        "targets.label.date_of_birth"
      )
    }
  }

  readonly #validateNIKMatchesData = async (
    c: Context,
    ctx: z.RefinementCtx,
    data: AddTargetDataRequest | UpdateTargetDataRequest,
    nik?: string
  ) => {
    const nikValue = nik ?? (data as AddTargetDataRequest).nik
    if (!nikValue || nikValue.length !== 16) {
      return
    }

    const detailedNik = await getIdentityAndAddressByNIK(
      c,
      nikValue,
      this.locationRepository
    )

    if ("gender" in data && data.gender && data.gender !== detailedNik.gender) {
      addValidationIssue(
        c,
        ctx,
        "gender",
        "validator.mismatch",
        "targets.label.gender"
      )
      return
    }

    if (
      "date_of_birth" in data &&
      data.date_of_birth &&
      data.date_of_birth !== detailedNik.date_of_birth
    ) {
      addValidationIssue(
        c,
        ctx,
        "date_of_birth",
        "validator.mismatch",
        "targets.label.date_of_birth"
      )
      return
    }

    if (data.registered_village_id) {
      const nikSubdistrictId = parseInt(nikValue.substring(0, 6))
      const regisSubDistrictId = parseInt(
        data.registered_village_id.toString().substring(0, 6)
      )
      if (nikSubdistrictId != regisSubDistrictId) {
        addValidationIssue(
          c,
          ctx,
          "registered_village_id",
          "validator.mismatch",
          "targets.label.registered_village_id"
        )
        return
      }
    }
  }

  readonly #updateRequestValidation = async (
    c: Context,
    ctx: z.RefinementCtx,
    data: UpdateTargetDataRequest
  ) => {
    const requiredFields = [
      "registered_postal_code",
      "registered_village_id",
      "residence_postal_code",
      "residence_village_id",
    ] as const

    validateRequiredFields(c, ctx, data, requiredFields, "targets")
  }
}
