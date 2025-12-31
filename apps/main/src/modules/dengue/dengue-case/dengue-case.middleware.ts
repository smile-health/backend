import { Context } from "hono"
import { z } from "zod"
import { LocationRepository } from "@/modules/location/location.repository.js"
import { getIdentityAndAddressByNIK } from "@/common/utils/verify-nik.js"
import {
  ColumnImportDengueCaseSchema,
  CreateDengueCaseRequestSchema,
  dengueId,
  GetDengueCaseRequestSchema,
  GetEquipmentsQuerySchema,
  GetLaboratoryQuerySchema,
  GetPatientsQuerySchema,
  GetReagentsQuerySchema,
  GetRecordsQuerySchema,
  ImportDengueCaseRequest,
  ImportDengueCaseRequestSchema,
  PatientDTO,
  patientId,
  ValidateNikSchema
} from "./dengue-case.schema.js"
import { ValidationError } from "@smile/lib/error.js"
import { DengueCaseRepository } from "./dengue-case.repository.js"
import { EntityRepository } from "@/modules/entity/entity.repository.js"
import BaseTemplate from "@smile/lib/excel/index.js"
import moment from "moment"

export class DengueCaseMiddleware {
  constructor(
    private readonly locationRepo: LocationRepository,
    private readonly dengueCaseRepo: DengueCaseRepository,
    private readonly entityRepo: EntityRepository,
  ) { }

  validateNIK = (c: Context) => {
    return ValidateNikSchema.superRefine(async (data, ctx) => {
      await this.#validateNIK(c, ctx, data.nik)
    })
  }

  validateEquipments = () => {
    return GetEquipmentsQuerySchema
  }

  validateLaboratory = () => {
    return GetLaboratoryQuerySchema
  }

  validateReagents = () => {
    return GetReagentsQuerySchema
  }

  validateRecords = () => {
    return GetRecordsQuerySchema
  }

  validatePatients = () => {
    return GetPatientsQuerySchema
  }

  list = () => {
    return GetDengueCaseRequestSchema
  }

  checkDataBeforeExport = async (c: Context, next: () => Promise<void>) => {
    const query = c.req.valid("query")

    const { data } = await this.dengueCaseRepo.findAll(c, query)

    if (!data || data.length === 0) {
      return c.json(
        {
          status: false,
          message: "No data found to export",
        },
        404
      )
    }

    await next()
  }

  import = (c: Context) => {
    const COL: ColumnImportDengueCaseSchema = this.#getColumnTranslations(c)
    const schema = ImportDengueCaseRequestSchema(COL)
    return schema
  }

  validateImport = async (
    c: Context,
    rows: ImportDengueCaseRequest[],
    template: BaseTemplate
  ) => {
    const COL: ColumnImportDengueCaseSchema = this.#getColumnTranslations(c)
    const startRow = template.getStartRow()

    rows.forEach((item, index) => {
      const rowIdx = startRow + index

      this.#isExist(c, rowIdx, item.InputDate!, COL.InputDate)
      if (item.InputDate) {
        this.#isValidDate(c, rowIdx, String(item.InputDate), COL.InputDate)
      }

      this.#isExist(c, rowIdx, item.NIK!, COL.NIK)
      this.#isValidNIK(c, rowIdx, item.NIK!, COL.NIK)

      this.#isExist(c, rowIdx, item.FullName!, COL.FullName)
      this.#isExist(c, rowIdx, item.PhoneNumber!, COL.PhoneNumber)
      this.#isExist(c, rowIdx, item.RegisteredVillageID!, COL.RegisteredVillageID)
      this.#isExist(c, rowIdx, item.RegisteredAddress!, COL.RegisteredAddress)

      if (!item.SameAddress) {
        this.#isExist(c, rowIdx, item.ResidentialAddress!, COL.ResidentialAddress)
        this.#isExist(c, rowIdx, item.ResidentialProvinceID!, COL.ResidentialCityID)
        this.#isExist(c, rowIdx, item.ResidentialDistrictID!, COL.ResidentialDistrictID)
        this.#isExist(c, rowIdx, item.ResidentialCityID!, COL.ResidentialCityID)
        this.#isExist(c, rowIdx, item.ResidentialVilageID!, COL.ResidentialVilageID)
      }

      this.#isExist(c, rowIdx, item.ClinicalDiagnosisID!, COL.ClinicalDiagnosisID)
      this.#isExist(c, rowIdx, item.SymptomsID!, COL.SymptomsID)
      this.#isExist(c, rowIdx, item.LastStatusID!, COL.LastStatusID)
      this.#isExist(c, rowIdx, item.VectorControlID!, COL.VectorControlID)
      this.#isExist(c, rowIdx, item.LaboratoryExamination!, COL.LaboratoryExamination)
      this.#isExist(c, rowIdx, item.EpidemiologyType!, COL.EpidemiologyType)

      if (item.EpidemiologyType) {
        this.#isExist(c, rowIdx, item.PEResultID!, COL.PEResultID)
      }

      if (item.LaboratoryExamination) {
        this.#isExist(c, rowIdx, item.ExaminationType!, COL.ExaminationType)

        if (item.ExaminationType == 1) {
          this.#isExist(c, rowIdx, item.LaboratoryName!, COL.LaboratoryName)
        } else if (item.ExaminationType == 2) {
          this.#isExist(c, rowIdx, item.LaboratoryID!, COL.LaboratoryId)
        }

        this.#isExist(c, rowIdx, item.SpecimenType!, COL.SpecimenType)
        this.#isExist(c, rowIdx, item.ExaminationMethodID!, COL.ExaminationMethodID)
        this.#isExist(c, rowIdx, item.ExaminationResult!, COL.ExaminationResult)
        this.#isExist(c, rowIdx, item.ReagentID!, COL.ReagentID)

        if (item.CollectionDate) {
          this.#isValidDate(
            c,
            rowIdx,
            String(item.CollectionDate),
            COL.CollectionDate
          )
        }

        if (item.ReleaseDate) {
          this.#isValidDate(c, rowIdx, String(item.ReleaseDate), COL.ReleaseDate)
        }
      }
    })

    if (c.var.errors) {
      throw new ValidationError()
    }

    return rows
  }

  validateDengueId = (c: Context) => {
    return dengueId.superRefine(async (data) => {
      const id = parseInt(data.id)

      if (isNaN(id) || id <= 0) {
        throw new ValidationError("Invalid ID")
      }

      const dengueCase = await this.dengueCaseRepo.findById(c, id)

      if (!dengueCase) {
        throw new ValidationError("ID does not exist")
      }
    })
  }

  validatePatientId = (c: Context) => {
    return patientId.superRefine(async (data) => {
      const id = parseInt(data.id, 10)

      if (isNaN(id) || id <= 0) {
        throw new ValidationError("Invalid ID")
      }

      const patient = await this.dengueCaseRepo.findPatientById(c, id)

      if (!patient) {
        throw new ValidationError("ID does not exist")
      }
    })
  }

  update = (c: Context) => {
    return CreateDengueCaseRequestSchema.superRefine(async (data, ctx) => {
      await this.#validateNIK(c, ctx, data.patient.nik)
      this.#validatePatientNameAndAddress(c, ctx, data.patient)
      if (data.laboratory_id) {
        await this.#validateEntity(c, ctx, data.laboratory_id)
      }
      this.#validateInputDate(c, ctx, data.input_date)
      await this.#validatePatientLocation(c, ctx, data.patient)
      this.#validateSpecimenDates(c, ctx, data.specimen)
      await this.#validateSymptomsId(c, ctx, data.symptoms_id)
      await this.#validateVectorControlId(c, ctx, data.vector_control_id)
      this.#validateEpidemiology(c, ctx, data)
      this.#validateLaboratoryExamination(c, ctx, data)
    })
  }

  create = (c: Context) => {
    return CreateDengueCaseRequestSchema.superRefine(async (data, ctx) => {
      await this.#validateNIK(c, ctx, data.patient.nik)
      this.#validatePatientNameAndAddress(c, ctx, data.patient)
      if (data.laboratory_id) {
        await this.#validateEntity(c, ctx, data.laboratory_id)
      }
      this.#validateInputDate(c, ctx, data.input_date)
      await this.#validatePatientLocation(c, ctx, data.patient)
      this.#validateSpecimenDates(c, ctx, data.specimen)
      await this.#validateSymptomsId(c, ctx, data.symptoms_id)
      await this.#validateVectorControlId(c, ctx, data.vector_control_id)
      this.#validateEpidemiology(c, ctx, data)
      this.#validateLaboratoryExamination(c, ctx, data)
    })
  }

  readonly #validateEpidemiology = (c: Context, ctx: z.RefinementCtx, data) => {
    // If epidemiology_type = 1, pe_result_id is required
    if (data.epidemiology_type === 1) {
      if (data.pe_result_id < 0) {
        throw new ValidationError("PE result ID is required")
      }
    }
  }

  readonly #validateLaboratoryExamination = (
    c: Context,
    ctx: z.RefinementCtx,
    data
  ) => {
    if (data.laboratory_examination !== 1) return

    this.#validateExaminationType(data)
    this.#validateSpecimenFields(data)
  }

  readonly #validateExaminationType = (data) => {
    if (!data.examination_type || data.examination_type <= 0) {
      throw new ValidationError("Examination type is required")
    }
  }

  readonly #validateSpecimenFields = (data) => {
    const specimen = data.specimen

    if (!specimen.specimen_type_id || specimen.specimen_type_id <= 0) {
      throw new ValidationError("Specimen type ID is required")
    }

    if (!specimen.specimen_code || specimen.specimen_code.trim() === "") {
      throw new ValidationError("Specimen code is required")
    }

    if (!specimen.collection_date) {
      throw new ValidationError("Collection date is required")
    }

    if (!specimen.release_date) {
      throw new ValidationError("Release date is required")
    }

    if (!specimen.examination_method_id || specimen.examination_method_id <= 0) {
      throw new ValidationError("Examination method ID is required")
    }

    if (!specimen.reagent_id || specimen.reagent_id.length === 0) {
      throw new ValidationError("Reagent ID is required")
    }

    if (!specimen.examination_result_id || specimen.examination_result_id <= 0) {
      throw new ValidationError("Examination result ID is required")
    }
  }

  readonly #validateNIK = async (
    c: Context,
    ctx: z.RefinementCtx,
    nik: string
  ) => {
    if (!nik || nik.length !== 16) {
      throw new ValidationError("Invalid NIK length")
    }

    if (!/^\d+$/.test(nik)) {
      throw new ValidationError("Invalid NIK format")
    }

    try {
      const nikData = await getIdentityAndAddressByNIK(
        c,
        nik,
        this.locationRepo
      )

      if (!nikData.province_id || !nikData.city_id || !nikData.district_id) {
        throw new ValidationError("Invalid NIK location")
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error
      }
      throw new ValidationError("Invalid NIK")
    }
  }

  readonly #validateEntity = async (
    c: Context,
    ctx: z.RefinementCtx,
    laboratory_id: number
  ) => {
    const entity = await this.entityRepo.findByIds(c, [laboratory_id])

    if (!entity) {
      throw new ValidationError("Entity ID does not exist")
    }
  }

  readonly #validateInputDate = (
    c: Context,
    ctx: z.RefinementCtx,
    inputDate: string
  ) => {
    const inputDateMoment = moment(inputDate)
    const now = moment()

    if (!inputDateMoment.isValid()) {
      throw new ValidationError("Invalid date")
    }

    if (inputDateMoment.isAfter(now)) {
      throw new ValidationError("Date cannot be future")
    }
  }

  readonly #validatePatientLocation = async (
    c: Context,
    ctx: z.RefinementCtx,
    patient: PatientDTO
  ) => {
    // Validate village
    const village = await this.locationRepo.findByID(
      c,
      patient.registered_village_id
    )

    if (!village) {
      throw new ValidationError("Village ID does not exist")
    }
  }

  readonly #validateSpecimenDates = (
    c: Context,
    ctx: z.RefinementCtx,
    specimen
  ) => {
    const collectionDate = moment(specimen.collection_date)
    const releaseDate = moment(specimen.release_date)

    if (!collectionDate.isValid()) {
      throw new ValidationError("Invalid date")
    }

    if (!releaseDate.isValid()) {
      throw new ValidationError("Invalid date")
    }

    // Release date must be after or equal to collection date
    if (collectionDate.isValid() && releaseDate.isValid()) {
      if (releaseDate.isBefore(collectionDate)) {
        throw new ValidationError(
          "Release date must be after or equal to collection date"
        )
      }
    }
  }

  readonly #validateSymptomsId = async (
    c: Context,
    ctx: z.RefinementCtx,
    symptomsId: number[]
  ) => {
    if (!symptomsId || symptomsId.length === 0) {
      throw new ValidationError("Symptoms ID must not be empty")
    }
  }

  readonly #validateVectorControlId = async (
    c: Context,
    ctx: z.RefinementCtx,
    vectorControlId: number[]
  ) => {
    if (!vectorControlId || vectorControlId.length === 0) {
      throw new ValidationError("Vector control ID must not be empty")
    }
  }

  readonly #isValidNIK = (
    c: Context,
    idx: number,
    nik: string | number,
    column: string
  ) => {
    const nikStr = String(nik)
    if (nikStr.length !== 16) {
      c.addError(idx, "Invalid NIK length", column)
    }
    if (!/^\d+$/.test(nikStr)) {
      c.addError(idx, "Invalid NIK format", column)
    }
  }

  readonly #validatePatientNameAndAddress = (
    c: Context,
    ctx: z.RefinementCtx,
    patient: PatientDTO
  ) => {
    // Validate name - only alphabets and spaces
    const nameRegex = /^[a-zA-Z\s]+$/
    if (!nameRegex.test(patient.name)) {
      throw new ValidationError("Name can only contain alphabets")
    }

    // Validate registered address - only alphabets, numbers, spaces, comma, period, and dash
    const addressRegex = /^[a-zA-Z0-9\s,.\-/]+$/
    if (!addressRegex.test(patient.registered_address)) {
      throw new ValidationError(
        "Registered address can only contain alphabets, numbers, spaces, comma, period, dash, and slash"
      )
    }

    // Validate residential address if provided
    if (patient.residence_address && patient.residence_address.trim() !== "") {
      if (!addressRegex.test(patient.residence_address)) {
        throw new ValidationError(
          "Residential address can only contain alphabets, numbers, spaces, comma, period, dash, and slash"
        )
      }
    }
  }

  readonly #isExist = (
    c: Context,
    idx: number,
    val: string | number,
    column: string
  ) => {
    if (!val && val !== 0) {
      c.addError(idx, "validator.not_empty", column)
    }
  }

  readonly #isValidDate = (
    c: Context,
    idx: number,
    date: string,
    column: string
  ) => {
    if (!moment(date, "YYYY-MM-DD", true).isValid()) {
      c.addError(idx, `Invalid Format Date`, column)
    }
  }

  readonly #getColumnTranslations = (
    c: Context
  ): ColumnImportDengueCaseSchema => {
    return {
      InputDate: "Input Date",
      NIK: "NIK",
      FullName: "Full Name",
      StatusID: "Status ID",
      PhoneNumber: "Phone Number",
      LastEducationID: "Last Education ID",
      OccupationID: "Occupation ID",
      ReligionID: "Religion ID",
      EthnicID: "Ethnic ID",
      RegisteredVillageID: "Registered Village ID",
      RegisteredPostalCode: "Registered Postal Code",
      RegisteredAddress: "Registered Address",
      SameAddress: "Same Address",
      ResidentialProvinceID: "Residential Province ID",
      ResidentialCityID: "Residential City ID",
      ResidentialDistrictID: "Residential District ID",
      ResidentialVilageID: "Residential Village ID",
      ResidentialPostalCode: "Residential Postal Code",
      ResidentialAddress: "Residential Address",
      ClinicalDiagnosisID: "Clinical Diagnosis ID",
      SymptomsID: "Symptoms ID",
      LastStatusID: "Last Status ID",
      EpidemiologyType: "Epidemiology Investigation",
      PEResultID: "PE Result ID",
      VectorControlID: "Vector Control ID",
      LaboratoryExamination: "Laboratory Examination",
      ExaminationType: "Examination Type",
      LaboratoryId: "Lab. ID",
      LaboratoryName: "Lab. Name",
      SpecimenType: "Specimen Type",
      SpecimenCode: "Specimen ID",
      CollectionDate: "Collection Date",
      ReleaseDate: "Result Release Date",
      ExaminationMethodID: "Examination Method ID",
      EquipmentID: "Equipment ID",
      ReagentID: "Consumable Material (Reagent) ID",
      ExaminationResult: "Examination Result",
    }
  }
}
