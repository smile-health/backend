import { PaginationQueriesSchema } from "@smile/lib/types/paginate.js"
import { DateSchema } from "@smile/lib/types/param.js"
import moment from "moment"
import { z } from "zod"

const preprocessNumber = (value: unknown) => {
  if (value === null || value === "") return undefined
  if (typeof value === "string") return parseInt(value, 10)
  if (typeof value === "number") return value
  return undefined
}

const preprocessNumberArray = (value: unknown) => {
  if (Array.isArray(value)) {
    return value
      .map((v) => {
        if (typeof v === "string") return parseInt(v, 10)
        if (typeof v === "number") return v
        return undefined
      })
      .filter((v) => v !== undefined)
  }
  return []
}

const preprocessYesNo = (value: unknown) => {
  if (value === null || value === undefined || value === "") return 0
  if (typeof value === "number") return value === 1 ? 1 : 0
  if (typeof value === "string") {
    const str = value.toLowerCase().trim()
    if (str === "yes" || str === "1") return 1
    if (str === "no" || str === "0") return 0
  }
  return 0
}

const convertExcelDate = (val) => {
  if (typeof val === 'number' && val > 1) {
    const utcDays = Math.floor(val - 25569);
    const utcValue = utcDays * 86400 * 1000;
    const date = new Date(utcValue);

    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  if (typeof val === 'string') {
    const date = moment(val, "DD-MM-YYYY", true);
    if (date.isValid()) {
      return date.format("YYYY-MM-DD");
    }
  }

  if (val instanceof Date) {
    return moment(val).format("YYYY-MM-DD");
  }

  return val;
}

const PositiveIntSchema = z.number().int().positive()
const NonNegativeIntSchema = z.number().int().nonnegative()
const PositiveIntArraySchema = z.array(PositiveIntSchema).min(1)

const PatientSchema = z.object({
  nik: z.string(),
  name: z.string(),
  gender: z.preprocess(preprocessNumber, PositiveIntSchema),
  date_of_birth: z.string(),
  phone: z.string(),
  occupation_id: z.preprocess(preprocessNumber, NonNegativeIntSchema).optional(),
  religion_id: z.preprocess(preprocessNumber, NonNegativeIntSchema).optional(),
  last_education_id: z.preprocess(preprocessNumber, NonNegativeIntSchema).optional(),
  ethnic_id: z.preprocess(preprocessNumber, NonNegativeIntSchema).optional(),
  marital_id: z.preprocess(preprocessNumber, NonNegativeIntSchema).optional(),
  registered_address: z.string(),
  registered_province_id: z.preprocess(preprocessNumber, PositiveIntSchema).optional(),
  registered_city_id: z.preprocess(preprocessNumber, PositiveIntSchema).optional(),
  registered_district_id: z.preprocess(preprocessNumber, PositiveIntSchema).optional(),
  registered_village_id: z.preprocess(preprocessNumber, PositiveIntSchema),
  registered_postal_code: z.string(),
  residence_address: z.string().optional(),
  residence_province_id: z.preprocess(preprocessNumber, PositiveIntSchema).optional(),
  residence_city_id: z.preprocess(preprocessNumber, PositiveIntSchema).optional(),
  residence_district_id: z.preprocess(preprocessNumber, PositiveIntSchema).optional(),
  residence_village_id: z.preprocess(preprocessNumber, PositiveIntSchema).optional(),
  residence_postal_code: z.string().optional(),
})

const SpecimenSchema = z.object({
  specimen_id: z.preprocess(preprocessNumber, PositiveIntSchema).optional().nullable(),
  patient_id: z.preprocess(preprocessNumber, PositiveIntSchema).optional(),
  patient_dengue_id: z.preprocess(preprocessNumber, PositiveIntSchema).optional(),
  specimen_type_id: z.preprocess(preprocessNumber, z.number().int()).optional(),
  specimen_code: z.string().optional(),
  collection_date: DateSchema.optional(),
  release_date: DateSchema.optional(),
  examination_method_id: z.preprocess(preprocessNumber, z.number().int()).optional(),
  equipment_id: z.preprocess(preprocessNumberArray, z.array(PositiveIntSchema)).optional(),
  reagent_id: z.preprocess(preprocessNumberArray, z.array(PositiveIntSchema)).optional(),
  examination_result_id: z.preprocess(preprocessNumber, z.number().int()).optional(),
})

export const CreateSpecimenSchema = z.object({
  id: z.preprocess(preprocessNumber, PositiveIntSchema).optional(),
  patient_id: z.preprocess(preprocessNumber, PositiveIntSchema).optional(),
  patient_dengue_id: z.preprocess(preprocessNumber, PositiveIntSchema).optional(),
  specimen_type_id: z.preprocess(preprocessNumber, PositiveIntSchema).optional(),
  specimen_code: z.string(),
  collection_date: DateSchema,
  release_date: DateSchema,
  examination_method_id: z.preprocess(preprocessNumber, PositiveIntSchema).optional(),
  equipment_id: z.string(),
  reagent_id: z.string(),
  examination_result_id: z.preprocess(preprocessNumber, PositiveIntSchema).optional(),
})

export const DengueCaseSchema = z.object({
  clinical_diagnosis_id: z.preprocess(preprocessNumber, PositiveIntSchema).optional(),
  symptoms_id: z.string().optional(),
  last_status_id: z.preprocess(preprocessNumber, PositiveIntSchema).optional(),
  epidemiology_type: z.preprocess(preprocessNumber, NonNegativeIntSchema),
  pe_result_id: z.preprocess(preprocessNumber, NonNegativeIntSchema).optional(),
  vector_control_id: z.string().optional(),
  laboratory_examination: z.preprocess(preprocessNumber, NonNegativeIntSchema).optional(),
  examination_type: z.preprocess(preprocessNumber, z.number().int()).optional(),
  laboratory_id: z.preprocess(preprocessNumber, z.number().int().optional()),
  laboratory_name: z.string().optional(),
  entity_id: z.preprocess(preprocessNumber, z.number().int().optional()),
  patient_id: z.preprocess(preprocessNumber, PositiveIntSchema).optional(),
  input_date: z.string(),
})

export const CreateDengueCaseRequestSchema = z.object({
  clinical_diagnosis_id: z.preprocess(preprocessNumber, PositiveIntSchema),
  symptoms_id: z.preprocess(preprocessNumberArray, PositiveIntArraySchema),
  last_status_id: z.preprocess(preprocessNumber, PositiveIntSchema),
  epidemiology_type: z.preprocess(preprocessNumber, NonNegativeIntSchema),
  pe_result_id: z.preprocess(preprocessNumber, NonNegativeIntSchema.optional()),
  vector_control_id: z.preprocess(preprocessNumberArray, PositiveIntArraySchema),
  laboratory_examination: z.preprocess(preprocessNumber, NonNegativeIntSchema).optional(),
  examination_type: z.preprocess(preprocessNumber, z.number().int()).optional(),
  laboratory_id: z.preprocess(preprocessNumber, z.number().int().optional()),
  laboratory_name: z.string().optional(),
  patient_id: z.preprocess(preprocessNumber, PositiveIntSchema).optional(),
  input_date: z.string(),
  patient: PatientSchema,
  specimen: SpecimenSchema,
})

export const ValidateNikSchema = z.object({
  nik: z.string(),
})

export const patientAddressSchema = z.object({
  province_id: z.preprocess(preprocessNumber, PositiveIntSchema).optional(),
  regency_id: z.preprocess(preprocessNumber, PositiveIntSchema).optional(),
  subdistrict_id: z.preprocess(preprocessNumber, PositiveIntSchema).optional(),
  village_id: z.preprocess(preprocessNumber, PositiveIntSchema).optional(),
  residential_province_id: z.preprocess(preprocessNumber, PositiveIntSchema).optional(),
  residential_regency_id: z.preprocess(preprocessNumber, PositiveIntSchema).optional(),
  residential_subdistrict_id: z.preprocess(preprocessNumber, PositiveIntSchema).optional(),
  residential_village_id: z.preprocess(preprocessNumber, PositiveIntSchema).optional(),
})

export const GetDengueCaseRequestSchema = PaginationQueriesSchema.extend({
  start_date: DateSchema.optional(),
  end_date: DateSchema.optional(),
  clinical_diagnosis: z.string().optional(),
})

export const GetEquipmentsQuerySchema = PaginationQueriesSchema

export const GetLaboratoryQuerySchema = PaginationQueriesSchema

export const GetReagentsQuerySchema = PaginationQueriesSchema

export const GetRecordsQuerySchema = PaginationQueriesSchema

export type ColumnImportDengueCaseSchema = {
  "InputDate": string
  "NIK": string
  "FullName": string
  "StatusID": string
  "PhoneNumber": string
  "LastEducationID": string
  "OccupationID": string
  "ReligionID": string
  "EthnicID": string
  "RegisteredVillageID": string
  "RegisteredPostalCode": string
  "RegisteredAddress": string
  "SameAddress": string
  "ResidentialProvinceID": string
  "ResidentialCityID": string
  "ResidentialDistrictID": string
  "ResidentialVilageID": string
  "ResidentialPostalCode": string
  "ResidentialAddress": string
  "ClinicalDiagnosisID": string
  "SymptomsID": string
  "LastStatusID": string
  "EpidemiologyType": string
  "PEResultID": string
  "VectorControlID": string
  "LaboratoryExamination": string
  "ExaminationType": string
  "LaboratoryId": string
  "LaboratoryName": string
  "SpecimenType": string
  "SpecimenCode": string
  "CollectionDate": string
  "ReleaseDate": string
  "ExaminationMethodID": string
  "EquipmentID": string
  "ReagentID": string
  "ExaminationResult": string
}

export type ImportDengueCaseRequest = {
  InputDate: string | undefined
  NIK: string | number | undefined
  FullName: string | undefined
  StatusID: string | number | undefined
  PhoneNumber: string | undefined
  LastEducationID: string | number | undefined
  OccupationID: string | number | undefined
  ReligionID: string | number | undefined
  EthnicID: string | number | undefined
  RegisteredVillageID: string | number | undefined
  RegisteredPostalCode: string | undefined
  RegisteredAddress: string | undefined
  SameAddress: string | number | undefined
  ResidentialProvinceID: string | number | undefined
  ResidentialCityID: string | number | undefined
  ResidentialDistrictID: string | number | undefined
  ResidentialVilageID: string | number | undefined  // Typo from Excel
  ResidentialPostalCode: string | undefined
  ResidentialAddress: string | undefined
  ClinicalDiagnosisID: string | undefined
  SymptomsID: string | undefined
  LastStatusID: string | undefined
  EpidemiologyType: string | number | undefined
  PEResultID: string | number | undefined
  VectorControlID: string | undefined
  LaboratoryExamination: string | number | undefined
  ExaminationType: string | number | undefined
  LaboratoryID: string | number | undefined
  LaboratoryName: string | undefined
  SpecimenType: string | undefined
  SpecimenCode: string | undefined
  CollectionDate: string | undefined
  ReleaseDate: string | undefined
  ExaminationMethodID: string | undefined
  EquipmentID: string | undefined
  ReagentID: string | undefined
  ExaminationResult: string | undefined
}

export const ImportDengueCaseRowSchema = (COL: ColumnImportDengueCaseSchema) =>
  z.object({
    [COL.InputDate]: z.union([z.string(), z.number()]).optional().transform(convertExcelDate),
    [COL.NIK]: z.string().or(z.number()).optional(),
    [COL.FullName]: z.string().optional(),
    [COL.StatusID]: z.string().or(z.number()).optional(),
    [COL.PhoneNumber]: z.string().or(z.number()).optional(),
    [COL.LastEducationID]: z.string().or(z.number()).optional(),
    [COL.OccupationID]: z.string().or(z.number()).optional(),
    [COL.ReligionID]: z.string().or(z.number()).optional(),
    [COL.EthnicID]: z.string().or(z.number()).optional(),
    [COL.RegisteredVillageID]: z.string().or(z.number()).optional(),
    [COL.RegisteredPostalCode]: z.string().or(z.number()).optional(),
    [COL.RegisteredAddress]: z.string().optional(),
    [COL.SameAddress]: z.preprocess(preprocessYesNo, z.number().int()).optional(),
    [COL.ResidentialProvinceID]: z.string().or(z.number()).optional(),
    [COL.ResidentialCityID]: z.string().or(z.number()).optional(),
    [COL.ResidentialDistrictID]: z.string().or(z.number()).optional(),
    [COL.ResidentialVilageID]: z.string().or(z.number()).optional(),
    [COL.ResidentialPostalCode]: z.string().or(z.number()).optional(),
    [COL.ResidentialAddress]: z.string().optional(),
    [COL.ClinicalDiagnosisID]: z.number().or(z.string()).optional(),
    [COL.SymptomsID]: z.string().optional(),
    [COL.LastStatusID]: z.number().or(z.string()).optional(),
    [COL.EpidemiologyType]: z.preprocess(preprocessYesNo, z.number().int()).optional(),
    [COL.PEResultID]: z.string().or(z.number()).optional(),
    [COL.VectorControlID]: z.string().or(z.number()).optional(),
    [COL.LaboratoryExamination]: z.preprocess(preprocessYesNo, z.number().int()).optional(),
    [COL.ExaminationType]: z.string().or(z.number()).optional(),
    [COL.LaboratoryId]: z.string().or(z.number()).optional(),
    [COL.LaboratoryName]: z.string().optional(),
    [COL.SpecimenType]: z.string().or(z.number()).optional(),
    [COL.SpecimenCode]: z.string().optional(),
    [COL.CollectionDate]: z.union([z.string(), z.number()]).optional().transform(convertExcelDate),
    [COL.ReleaseDate]: z.union([z.string(), z.number()]).optional().transform(convertExcelDate),
    [COL.ExaminationMethodID]: z.string().or(z.number()).optional(),
    [COL.EquipmentID]: z.string().optional(),
    [COL.ReagentID]: z.string().optional(),
    [COL.ExaminationResult]: z.string().or(z.number()).optional(),
  })
    .passthrough()
    .transform((row) => ({
      InputDate: row[COL.InputDate],
      NIK: row[COL.NIK],
      FullName: row[COL.FullName],
      StatusID: row[COL.StatusID],
      PhoneNumber: row[COL.PhoneNumber],
      LastEducationID: row[COL.LastEducationID],
      OccupationID: row[COL.OccupationID],
      ReligionID: row[COL.ReligionID],
      EthnicID: row[COL.EthnicID],
      RegisteredVillageID: row[COL.RegisteredVillageID],
      RegisteredPostalCode: row[COL.RegisteredPostalCode],
      RegisteredAddress: row[COL.RegisteredAddress],
      SameAddress: row[COL.SameAddress],
      ResidentialProvinceID: row[COL.ResidentialProvinceID],
      ResidentialCityID: row[COL.ResidentialCityID],
      ResidentialDistrictID: row[COL.ResidentialDistrictID],
      ResidentialVilageID: row[COL.ResidentialVilageID],
      ResidentialPostalCode: row[COL.ResidentialPostalCode],
      ResidentialAddress: row[COL.ResidentialAddress],
      ClinicalDiagnosisID: row[COL.ClinicalDiagnosisID],
      SymptomsID: row[COL.SymptomsID],
      LastStatusID: row[COL.LastStatusID],
      EpidemiologyType: row[COL.EpidemiologyType],
      PEResultID: row[COL.PEResultID],
      VectorControlID: row[COL.VectorControlID],
      LaboratoryExamination: row[COL.LaboratoryExamination],
      ExaminationType: row[COL.ExaminationType],
      LaboratoryID: row[COL.LaboratoryId],
      LaboratoryName: row[COL.LaboratoryName],
      SpecimenType: row[COL.SpecimenType],
      SpecimenCode: row[COL.SpecimenCode],
      CollectionDate: row[COL.CollectionDate],
      ReleaseDate: row[COL.ReleaseDate],
      ExaminationMethodID: row[COL.ExaminationMethodID],
      EquipmentID: row[COL.EquipmentID],
      ReagentID: row[COL.ReagentID],
      ExaminationResult: row[COL.ExaminationResult],
    }))

export const ImportDengueCaseRequestSchema = (COL: ColumnImportDengueCaseSchema) =>
  z.array(ImportDengueCaseRowSchema(COL)).min(1)

export const GetPatientsQuerySchema = PaginationQueriesSchema.extend({
  keyword: z.string().optional(),
  nik: z.string().min(16).max(16).optional(),
})

export const dengueId = z.object({ id: z.string() })

export const patientId = z.object({ id: z.string() })

export const recordId = z.object({ id: z.string() })

export type CreateDengueCaseRequest = z.infer<typeof CreateDengueCaseRequestSchema>
export type UpdateDengueCaseRequest = z.infer<typeof CreateDengueCaseRequestSchema>
export type GetDengueCaseRequest = z.infer<typeof GetDengueCaseRequestSchema>

export type CreateDengueCaseDTO = z.infer<typeof DengueCaseSchema>
export type PatientDTO = z.infer<typeof PatientSchema>
export type SpecimenDTO = z.infer<typeof SpecimenSchema>
export type PatientAddressDTO = z.infer<typeof patientAddressSchema>
