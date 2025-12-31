import { Context } from "hono"
import { DengueCaseRepository } from "./dengue-case.repository.js"
import { getIdentityAndAddressByNIK } from "@/common/utils/verify-nik.js"
import { LocationRepository } from "@/modules/location/location.repository.js"
import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { DengueCaseTemplate } from "./dengue-case.excel.js"
import moment from "moment"
import { doDecrypt } from "@/modules/transaction/utils/transaction.encryption.js"
import {
  CreateDengueCaseRequest,
  UpdateDengueCaseRequest,
  DengueCaseSchema,
  GetDengueCaseRequest,
  ImportDengueCaseRequest
} from "./dengue-case.schema.js"
import {
  EQUIPMENT,
  LOCATION_LEVEL,
  MARITAL_STATUS,
  NS1_ID,
  PE_RESULT,
  REAGENT
} from "@/common/constants/dengue.js"

export class DengueCaseModule {
  constructor(
    private readonly dengueCaseRepo: DengueCaseRepository,
    private readonly locationRepo: LocationRepository,
  ) { }

  async getDetailIdentity(c: Context, identityNumber: string) {
    const detailIdentity = await getIdentityAndAddressByNIK(c, identityNumber, this.locationRepo)

    if (!detailIdentity) {
      return null
    }

    const patient = await this.dengueCaseRepo.findByIdentityNumber(c, identityNumber)

    let addressDetail = null
    let residentialDetail = null

    if (patient) {
      if (patient.village_id) {
        addressDetail = await this.dengueCaseRepo.findLocationByCode(c, patient)
      }

      if (
        patient.residential_province_id != null ||
        patient.residential_regency_id != null ||
        patient.residential_subdistrict_id != null ||
        patient.residential_village_id != null
      ) {
        residentialDetail = await this.dengueCaseRepo.findResidentialLocationByCode(c, patient)
      }
    }

    const identityName = patient?.name ? doDecrypt(patient.name) : null
    const address = patient?.address ? doDecrypt(patient.address) : null
    const residenceAddress = patient?.residential_address ? doDecrypt(patient.residential_address) : null
    const phoneNumber = patient?.phone_number ? doDecrypt(patient.phone_number) : null

    let sameAddress = false
    if (address != null && residenceAddress != null) {
      sameAddress = address === residenceAddress
    }

    return {
      data: {
        id: patient?.id || null,
        nik: identityNumber,
        same_address: sameAddress,
        personal_identity: {
          date_of_birth: detailIdentity?.date_of_birth,
          gender: detailIdentity?.gender,
          name: identityName,
          phone: phoneNumber || null,
          marital_id: patient?.marital_status || null,
          marital_name: patient?.marital_status ? MARITAL_STATUS[patient?.marital_status] : null,
          last_education_id: patient?.education_id || null,
          last_education_name: patient?.education_name || null,
          occupation_id: patient?.occupation_id || null,
          occupation_name: patient?.occupation_name || null,
          religion_id: patient?.religion_id || null,
          religion_name: patient?.religion_name || null,
          ethnic_id: patient?.ethnic_id || null,
          ethnic_name: patient?.ethnic_name || null,
        },
        registered_address: {
          address: address,
          province_id: detailIdentity?.province_id,
          province: detailIdentity?.province,
          city_id: detailIdentity?.city_id,
          city: detailIdentity?.city,
          district_id: detailIdentity?.district_id,
          district: detailIdentity?.district,
          village_id: patient?.village_id || null,
          village: addressDetail?.village_name || null,
          pos_code: patient?.pos_code || null
        },
        residence_address: {
          address: residenceAddress,
          province_id: patient?.residential_province_id || null,
          province: residentialDetail?.province_name || null,
          city_id: patient?.residential_regency_id || null,
          city: residentialDetail?.regency_name || null,
          district_id: patient?.residential_subdistrict_id || null,
          district: residentialDetail?.subdistrict_name || null,
          village_id: patient?.residential_village_id || null,
          village: residentialDetail?.village_name || null,
          pos_code: patient?.residential_pos_code || null
        }
      }
    }
  }

  async listEquipment(c: Context, params) {
    const { data, total } = await this.dengueCaseRepo.listEquipment(c, params)
    return new PaginatedResponse(params, data, total)
  }

  async listClinicalDiagnosis(c: Context) {
    return await this.dengueCaseRepo.listClinicalDiagnosis(c)
  }

  async listLastStatus(c: Context) {
    return await this.dengueCaseRepo.listLastStatus(c)
  }

  async listVectorControl(c: Context) {
    return await this.dengueCaseRepo.listVectorControl(c)
  }

  async listSymptoms(c: Context) {
    return await this.dengueCaseRepo.listSymptoms(c)
  }

  async listSpecimenType(c: Context) {
    return await this.dengueCaseRepo.listSpecimenType(c)
  }

  async listExaminationMethod(c: Context) {
    return await this.dengueCaseRepo.listExaminationMethod(c)
  }

  async listExaminationResult(c: Context) {
    return await this.dengueCaseRepo.listExaminationResult(c)
  }

  async listLaboratory(c: Context, params) {
    const { data, total } = await this.dengueCaseRepo.listLaboratory(c, params)
    return new PaginatedResponse(params, data, total)
  }

  async listReagent(c: Context, params) {
    const { data, total } = await this.dengueCaseRepo.listReagent(c, params)
    return new PaginatedResponse(params, data, total)
  }

  async template(c: Context) {
    const language = c.var.language
    const template = new DengueCaseTemplate()
    const title = language === "en" ? "Template Case Report Dengue" : "Template Laporan Kasus Dengue"
    const filename = `case_report_${language.toLowerCase()}.xlsx`

    template.setTitle(title)
    template.setTimezone(c.req.header("Timezone"))

    await template.loadFile(filename)

    // sheet 3 - Marital Status
    const maritalStatusList = await this.dengueCaseRepo.listMaritalStatus(c)
    const sheetName3 = "LIST STATUS"
    const rows3 = maritalStatusList.map(item => [item.id, item.name])
    await template.addRows(sheetName3, rows3)

    // sheet 4 - Education
    const educationList = await this.dengueCaseRepo.listEducation(c)
    const sheetName4 = "LIST LAST EDUCATION"
    const rows4 = educationList.map(item => [item.id, item.name])
    await template.addRows(sheetName4, rows4)

    // sheet 5 - Occupation
    const occupationList = await this.dengueCaseRepo.listOccupation(c)
    const sheetName5 = "LIST OCCUPATION"
    const rows5 = occupationList.map(item => [item.id, item.name])
    await template.addRows(sheetName5, rows5)

    // sheet 6 - Religion
    const religionList = await this.dengueCaseRepo.listReligion(c)
    const sheetName6 = "LIST RELIGION"
    const rows6 = religionList.map(item => [item.id, item.name])
    await template.addRows(sheetName6, rows6)

    // sheet 7 - Ethnicity
    const ethnicityList = await this.dengueCaseRepo.listEthnicity(c)
    const sheetName7 = "LIST ETHNIC"
    const rows7 = ethnicityList.map(item => [item.id, item.name])
    await template.addRows(sheetName7, rows7)

    // sheet 8 - Province
    const provinceList = await this.dengueCaseRepo.getLocation(c, LOCATION_LEVEL.PROVINCE)
    const sheetName8 = "LIST PROVINCE"
    const rows8 = provinceList.map(item => [item.id, item.name])
    await template.addRows(sheetName8, rows8)

    // sheet 9 - Regency/City
    const regencyList = await this.dengueCaseRepo.getLocation(c, LOCATION_LEVEL.REGENCY)
    const sheetName9 = "LIST CITY"
    const rows9 = regencyList.map(item => [item.id, item.name])
    await template.addRows(sheetName9, rows9)

    // sheet 10 - Subdistrict
    const subdistrictList = await this.dengueCaseRepo.getLocation(c, LOCATION_LEVEL.SUBDISTRICT)
    const sheetName10 = "LIST DISTRICT"
    const rows10 = subdistrictList.map(item => [item.id, item.name])
    await template.addRows(sheetName10, rows10)

    // sheet 11 - Village
    const villageList = await this.dengueCaseRepo.getLocation(c, LOCATION_LEVEL.VILLAGE)
    const sheetName11 = "LIST VILLAGE"
    const rows11 = villageList.map(item => [item.id, item.name])
    await template.addRows(sheetName11, rows11)

    // sheet 12 - Clinical Diagnosis
    const clinicalDiagnosisList = await this.dengueCaseRepo.listClinicalDiagnosis(c)
    const sheetName12 = "LIST CLINICAL DIAGNOSIS"
    const rows12 = clinicalDiagnosisList.map(item => [item.id, item.name])
    await template.addRows(sheetName12, rows12)

    // sheet 13 - Symptoms
    const symptomsList = await this.dengueCaseRepo.listSymptoms(c)
    const sheetName13 = "LIST SYMPTOMS"
    const rows13 = symptomsList.map(item => [item.id, item.name])
    await template.addRows(sheetName13, rows13)

    // sheet 14 - Last Status
    const lastStatusList = await this.dengueCaseRepo.listLastStatus(c)
    const sheetName14 = "LIST LAST STATUS"
    const rows14 = lastStatusList.map(item => [item.id, item.name])
    await template.addRows(sheetName14, rows14)

    // sheet 15 - Vector Control
    const vectorControlList = await this.dengueCaseRepo.listVectorControl(c)
    const sheetName15 = "LIST VECTOR CONTROL"
    const rows15 = vectorControlList.map(item => [item.id, item.name])
    await template.addRows(sheetName15, rows15)

    // sheet 16 - Laboratory
    const laboratoryList = await this.dengueCaseRepo.listLaboratoryAll(c)
    const sheetName16 = "LIST LABORATORY"
    const rows16 = laboratoryList.map(item => [item.id, item.name])
    await template.addRows(sheetName16, rows16)

    // sheet 17 - Examination Method
    const examinationMethodList = await this.dengueCaseRepo.listExaminationMethod(c)
    const sheetName17 = "LIST EXAMINATION METHOD"
    const rows17 = examinationMethodList.map(item => [item.id, item.name])
    await template.addRows(sheetName17, rows17)

    // sheet 18 - Equipment
    const equipmentList = await this.dengueCaseRepo.listEquipmentAll(c)
    const sheetName18 = "LIST EQUIPMENT"
    const rows18 = equipmentList.map(item => [item.id, item.name])
    await template.addRows(sheetName18, rows18)

    // sheet 19 - Reagent
    const reagentList = await this.dengueCaseRepo.listReagentAll(c)
    const sheetName19 = "LIST REAGENT"
    const rows19 = reagentList.map(item => [item.id, item.name])
    await template.addRows(sheetName19, rows19)

    // sheet 20 - Examination Result
    const examinationResultList = await this.dengueCaseRepo.listExaminationResult(c)
    const sheetName20 = "LIST EXAMINATION RESULT"
    const rows20 = examinationResultList.map(item => [item.id, item.name])
    await template.addRows(sheetName20, rows20)

    // sheet 21 - Specimen Type
    const specimenTypeList = await this.dengueCaseRepo.listSpecimenType(c)
    const sheetName21 = "LIST SPECIMEN TYPE"
    const rows21 = specimenTypeList.map(item => [item.id, item.name])
    await template.addRows(sheetName21, rows21)

    return await template.generate()
  }

  async exportCaseReport(c: Context, params: GetDengueCaseRequest) {
    const timezone = c.req.header("Timezone") || "UTC"
    const currentTime = moment().tz(timezone)
    const title = `CaseReport_${currentTime.format("YYYYMMDD_HHmm")}`

    const { data } = await this.dengueCaseRepo.findAll(c, params)

    const rows = await Promise.all(
      data.map(item => this.buildExportRow(c, item))
    )

    const columns = this.getExportColumns();

    const sheetName = "Case Report"
    const template = new DengueCaseTemplate()
    await template.initSheet(sheetName)

    template.setTitle(title)
    template.setTimezone(timezone)
    template.setColumns(columns)
    await template.addRows(sheetName, rows)

    return await template.generate()
  }

  async import(c: Context, rows: ImportDengueCaseRequest[]) {
    // Validation
    this.validateImportData(rows);

    const processedRows: number[] = [];
    const duplicateRows: number[] = [];

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 10; // Excel row number
      const result = await this.processImportRow(c, rows[i], rowNumber);

      if (result.isDuplicate) {
        duplicateRows.push(rowNumber);
      } else if (result.success) {
        processedRows.push(rowNumber);
      }
    }

    return {
      total_rows: rows.length,
      processed: processedRows.length,
      duplicates: duplicateRows.length,
      duplicate_rows: duplicateRows
    }
  }

  async list(c: Context, params: GetDengueCaseRequest) {
    const { data, total } = await this.dengueCaseRepo.list(c, params)

    const dataFormated = await Promise.all(
      data.map(async (item) => {
        const identityNumber = item.identity_number ? doDecrypt(item.identity_number) : null
        const identityName = item.name ? doDecrypt(item.name) : null
        const birthDate = item.birth_date ? doDecrypt(item.birth_date) : null
        const age = birthDate ? moment(item.input_date).diff(moment(birthDate), "years") : null

        return {
          id: item.id,
          identity_number: identityNumber,
          name: identityName,
          age: age,
          clinical_diagnosis: item.clinical_diagnosis_name,
          created_at: moment(item.created_at).format("YYYY-MM-DD HH:mm"),
          updated_at: moment(item.updated_at).format("YYYY-MM-DD HH:mm"),
          updated_by: item.updated_by ? item.firstname + " " + item.lastname : 'Admin',
        }
      })
    )

    return new PaginatedResponse(params, dataFormated, total)
  }

  async getDetailCaseReport(c: Context, id: number) {
    const item = await this.dengueCaseRepo.findDetailById(c, id)

    if (!item) {
      return null
    }

    let isSpecimen = 0
    if (item.laboratory_examination == 1 && item.specimen_id !== null) {
      const specimen = await this.dengueCaseRepo.findSentinelBySpecimen(c, item.specimen_id)
      isSpecimen = specimen ? 1 : 0
    }

    const identityNumber = item.identity_number ? doDecrypt(item.identity_number) : null
    const identityName = item.name ? doDecrypt(item.name) : null
    const address = item.address ? doDecrypt(item.address) : null
    const residenceAddress = item.residential_address ? doDecrypt(item.residential_address) : null
    const birthDate = item.birth_date ? doDecrypt(item.birth_date) : null
    const age = birthDate ? moment(item.input_date).diff(moment(birthDate), "years") : null
    const location = await this.locationRepo.getDetails(c, Number(item.village_id))
    const residenceLocation = await this.locationRepo.getDetails(c, Number(item.residential_village_id))
    const sameAddress = item.address === item.residential_address
    const phoneNumber = item.phone_number ? doDecrypt(item.phone_number) : null

    const equipmentNames = await this.getEquipmentNames(c, String(item.equipment_id), EQUIPMENT);
    const reagentNames = await this.getEquipmentNames(c, String(item.reagent_id), REAGENT);
    const vectorControlNames = await this.getVectorControlNames(c, String(item.vector_control_id));
    const symptomsNames = await this.getSymptomsNames(c, String(item.symptoms_id));

    return {
      data: {
        patient_data: {
          input_date: moment(item.input_date).format("YYYY-MM-DD"),
          identity_number: identityNumber,
          name: identityName,
          gender: item.gender == 1 ? "Male" : "Female",
          date_of_birth: birthDate,
          age: age,
          phone: phoneNumber,
          marital_id: item.marital_status,
          marital_name: item.marital_status ? MARITAL_STATUS[item.marital_status] : null,
          last_education_id: item.education_id,
          last_education_name: item.education_name,
          occupation_id: item.occupation_id,
          occupation_name: item.occupation_name,
          religion_id: item.religion_id,
          religion_name: item.religion_name,
          ethnic_id: item.ethnic_id,
          ethnic_name: item.ethnic_name,
          province_id: location?.province?.id,
          province_name: location?.province?.name,
          regency_id: location?.regency?.id,
          regency_name: location?.regency?.name,
          subdistrict_id: location?.subdistrict?.id,
          subdistrict_name: location?.subdistrict?.name,
          village_id: location?.village?.id,
          village_name: location?.village?.name,
          postal_code: item.pos_code,
          address: address,
          residential_province_id: residenceLocation?.province?.id,
          residential_province_name: residenceLocation?.province?.name,
          residential_regency_id: residenceLocation?.regency?.id,
          residential_regency_name: residenceLocation?.regency?.name,
          residential_subdistrict_id: residenceLocation?.subdistrict?.id,
          residential_subdistrict_name: residenceLocation?.subdistrict?.name,
          residential_village_id: residenceLocation?.village?.id,
          residential_village_name: residenceLocation?.village?.name,
          residential_postal_code: item.residential_pos_code,
          residential_address: residenceAddress,
          same_address: sameAddress,
        },

        case_report: {
          clinical_diagnosis_id: item.clinical_diagnosis_id,
          clinical_diagnosis_name: item.clinical_diagnosis_name,
          symptoms_id: this.parseCommaSeparatedIds(item.symptoms_id),
          symptoms_name: symptomsNames,
          last_status_id: item.last_status_id,
          last_status_name: item.last_status_name,
          epidemiology_investigation: item.epidemiology_type,
          pe_result_id: item.pe_result_id,
          pe_result_name: item.pe_result_id !== null ? PE_RESULT[item.pe_result_id] : null,
          vector_control_id: this.parseCommaSeparatedIds(item.vector_control_id),
          vector_control_name: vectorControlNames,
        },

        laboratory_examination: {
          laboratory_id: item.laboratory_id || null,
          laboratory_name: item.laboratory_id ? item.laboratory_id_name : item.laboratory_name,
          examination_type: item.examination_type,
          laboratory_examination: item.laboratory_examination,
          specimen_id: item.specimen_id,
          specimen_type_id: item.specimen_type_id,
          specimen_type_name: item.specimen_type_name,
          specimen_code: item.specimen_code,
          collection_date: item.collection_date ? moment(item.collection_date).format("YYYY-MM-DD") : null,
          release_date: item.release_date ? moment(item.release_date).format("YYYY-MM-DD") : null,
          examination_method_id: item.examination_method_id,
          examination_method_name: item.examination_method_name,
          equipment_id: this.parseCommaSeparatedIds(item.equipment_id),
          equipment_name: equipmentNames,
          reagent_id: this.parseCommaSeparatedIds(item.reagent_id),
          reagent_name: reagentNames,
          examination_result_id: item.examination_result_id,
          examination_result: item.examination_result_name,
        },

        isSpecimen: isSpecimen
      }
    }
  }

  async insertCaseRepot(c: Context, body: CreateDengueCaseRequest) {
    const patientId = await this.dengueCaseRepo.upsertPatient(c, body.patient)

    const entityId = c.var.user?.entity_id


    const dataDengue = DengueCaseSchema.parse({
      ...body,
      patient_id: patientId,
      symptoms_id: body.symptoms_id.join(','),
      vector_control_id: body.vector_control_id.join(','),
      input_date: moment(body.input_date).format("YYYY-MM-DD"),
      entity_id: entityId,
    })

    const dengueReportId = await this.dengueCaseRepo.createDengueCase(c, dataDengue)

    if (dengueReportId && body.laboratory_examination == 1) {
      const dataSpecimen = {
        ...body.specimen,
        patient_id: patientId,
        patient_dengue_id: dengueReportId,
        equipment_id: body.specimen.equipment_id.join(','),
        reagent_id: body.specimen.reagent_id.join(','),

      }

      await this.dengueCaseRepo.createSpecimen(c, dataSpecimen)
    }

    return {
      patient_id: patientId,
      dengue_case_id: dengueReportId,
    }
  }

  async updateCaseReport(c: Context, id: number, body: UpdateDengueCaseRequest) {
    const patientId = await this.dengueCaseRepo.upsertPatient(c, body.patient)

    const dataDengue = DengueCaseSchema.parse({
      ...body,
      patient_id: patientId,
      symptoms_id: body.symptoms_id.join(','),
      vector_control_id: body.vector_control_id.join(','),
      input_date: moment(body.input_date).format("YYYY-MM-DD"),
    })

    await this.dengueCaseRepo.updateDengueCase(c, id, dataDengue)

    
    if (body.laboratory_examination == 0 && body.specimen?.specimen_id) {
      // Delete specimen
      await this.dengueCaseRepo.deleteSpecimen(c, body.specimen.specimen_id)
    } else if (body.laboratory_examination == 1 && body.specimen?.specimen_id) {
      // Update existing specimen
      const dataSpecimen = {
        specimen_code: body.specimen.specimen_code,
        collection_date: body.specimen.collection_date,
        release_date: body.specimen.release_date,
        specimen_type_id: body.specimen.specimen_type_id,
        examination_method_id: body.specimen.examination_method_id,
        examination_result_id: body.specimen.examination_result_id,
        equipment_id: body.specimen.equipment_id.join(','),
        reagent_id: body.specimen.reagent_id.join(','),
      }

      await this.dengueCaseRepo.updateSpecimen(c, body.specimen.specimen_id, dataSpecimen)
    } else if (body.laboratory_examination == 1) {
      // Create new specimen
      const dataSpecimen = {
        patient_id: patientId,
        patient_dengue_id: id,
        specimen_type_id: body.specimen.specimen_type_id,
        specimen_code: body.specimen.specimen_code,
        collection_date: body.specimen.collection_date,
        release_date: body.specimen.release_date,
        examination_method_id: body.specimen.examination_method_id,
        equipment_id: body.specimen.equipment_id.join(','),
        reagent_id: body.specimen.reagent_id.join(','),
        examination_result_id: body.specimen.examination_result_id,
      }

      await this.dengueCaseRepo.createSpecimen(c, dataSpecimen)
    }

    return {
      patient_id: patientId,
      dengue_case_id: id,
    }
  }

  async getDetailReport(c: Context, id: number, params) {
    const { data, total } = await this.dengueCaseRepo.getRecords(c, id, params)

    const dataFormated = data.map(item => {
      return {
        id: item.id,
        clinical_diagnosis: item.clinical_diagnosis_name,
        updated_at: moment(item.updated_at).format("YYYY-MM-DD HH:mm"),
        updated_by: item.updated_by ? item.firstname + " " + item.lastname : 'Admin',
      }
    })

    return new PaginatedResponse(params, dataFormated, total)
  }

  async getDetailPatient(c: Context, id: number) {
    const item = await this.dengueCaseRepo.getDetailPatient(c, id)

    if (!item) {
      return null
    }

    const identityNumber = item.nik ? doDecrypt(item.nik) : null
    const identityName = item.name ? doDecrypt(item.name) : null
    const birthDate = item.birth_date ? doDecrypt(item.birth_date) : null
    const location = await this.locationRepo.getDetails(c, Number(item.village_id))
    const residenceLocation = await this.locationRepo.getDetails(c, Number(item.residential_village_id))
    const address = item.address ? doDecrypt(item.address) : null
    const residenceAddress = item.residential_address ? doDecrypt(item.residential_address) : null
    const phoneNumber = item.phone_number ? doDecrypt(item.phone_number) : null

    const equipmentNames = await this.getEquipmentNames(c, String(item.equipment_id), EQUIPMENT);
    const reagentNames = await this.getEquipmentNames(c, String(item.reagent_id), REAGENT);
    const vectorControlNames = await this.getVectorControlNames(c, String(item.vector_control_id));
    const symptomsNames = await this.getSymptomsNames(c, String(item.symptoms_id));

    return {
      data: {
        patient_data: {
          input_date: moment(item.input_date).format("YYYY-MM-DD"),
          nik: identityNumber,
          name: identityName,
          gender: item.gender == 1 ? "Male" : "Female",
          date_of_birth: birthDate,
          phone: phoneNumber,
          marital_id: item.marital_status,
          marital_name: item.marital_status ? MARITAL_STATUS[item.marital_status] : null,
          last_education_id: item.education_id,
          last_education_name: item.education_name,
          occupation_id: item.occupation_id,
          occupation_name: item.occupation_name,
          religion_id: item.religion_id,
          religion_name: item.religion_name,
          ethnic_id: item.ethnic_id,
          ethnic_name: item.ethnic_name,
          province_name: location?.province?.name,
          regency_name: location?.regency?.name,
          subdistrict_name: location?.subdistrict?.name,
          village_name: location?.village?.name,
          postal_code: item.pos_code,
          address: address,
        },

        residential_data: {
          province_name: residenceLocation?.province?.name,
          regency_name: residenceLocation?.regency?.name,
          subdistrict_name: residenceLocation?.subdistrict?.name,
          village_name: residenceLocation?.village?.name,
          residential_address: residenceAddress,
          postal_code: item.pos_code,
        },

        case_report: {
          clinical_diagnosis_name: item.clinical_diagnosis_name,
          symptoms_name: symptomsNames,
          last_status_name: item.last_status_name,
          epidemiology_investigation: item.epidemiology_type,
          pe_result_name: item.pe_result_id !== null && item.pe_result_id !== undefined ? PE_RESULT[item.pe_result_id] : null,
          vector_control_name: vectorControlNames,
        },

        laboratory_examination: {
          laboratory_id: item.laboratory_id,
          laboratory_name: item.laboratory_id ? item.laboratory_id_name : item.laboratory_name,
          examination_type: item.examination_type,
          laboratory_examination: item.laboratory_examination,
          specimen_type_name: item.specimen_type_name,
          specimen_code: item.specimen_code,
          collection_date: item.collection_date ? moment(item.collection_date).format("YYYY-MM-DD") : null,
          release_date: item.release_date ? moment(item.release_date).format("YYYY-MM-DD") : null,
          examination_method_name: item.examination_method_name,
          equipment_name: equipmentNames,
          reagent_name: reagentNames,
          examination_result: item.examination_result_name,
        },

        sentinel_surveillance: {
          nik: identityNumber,
          duration: item.duration,
          case_report_completed: item.case_report_completed,
          lab_result_name: item.lab_result_name,
          specimen_code: item.specimen_code,
          specimen_collection: item.collection_date != null ? 1 : 0,
          ns1_result: NS1_ID.includes(item.examination_result_id) ? 1 : 0,
        }
      }
    }
  }

  async getPatients(c: Context, params) {
    const { data, total } = await this.dengueCaseRepo.getPatients(c, params)

    const dataFormated = await Promise.all(
      data.map(async (item) => {
        const identityNumber = item.nik ? doDecrypt(item.nik) : null
        const identityName = item.name ? doDecrypt(item.name) : null
        const birthDate = item.birth_date ? doDecrypt(item.birth_date) : null
        const age = birthDate ? moment(item.input_date).diff(moment(birthDate), "years") : null

        return {
          id: item.id,
          nik: identityNumber,
          name: identityName,
          age: age,
        }
      }),
    )

    return new PaginatedResponse(params, dataFormated, total)
  }

  private async formatFullAddress(
    c: Context,
    address: string | null,
    villageId: number | null,
    posCode: number | null
  ): Promise<string> {
    if (!address || !villageId) return "";

    const location = await this.locationRepo.getDetails(c, villageId);
    const decryptedAddress = doDecrypt(address);

    return `${decryptedAddress}, ${location?.village?.name}, ${location?.subdistrict?.name}, ${location?.regency?.name}, ${location?.province?.name} ${posCode || ""}`;
  }

  private parseCommaSeparatedIds(value: string | null): number[] {
    if (!value) return [];
    return value.split(',').map(Number);
  }

  private async getEquipmentNames(
    c: Context,
    equipmentIds: string | null,
    type: number
  ): Promise<string> {
    if (!equipmentIds || equipmentIds === "null") return "";

    const ids = this.parseCommaSeparatedIds(equipmentIds);
    if (ids.length === 0) return "";

    const items = await this.dengueCaseRepo.findEquipment(c, ids, type);
    return items.map(item => item.name).join(', ');
  }

  private async getVectorControlNames(
    c: Context,
    ids: string | null
  ): Promise<string> {
    if (!ids || ids === "null") return "";

    const vectorIds = this.parseCommaSeparatedIds(ids);
    if (vectorIds.length === 0) return "";

    const items = await this.dengueCaseRepo.findVectorControl(c, vectorIds);
    return items.map(item => item.name).join(', ');
  }

  private async getSymptomsNames(
    c: Context,
    ids: string | null
  ): Promise<string> {
    if (!ids || ids === "null") return "";

    const symptomIds = this.parseCommaSeparatedIds(ids);
    if (symptomIds.length === 0) return "";

    const items = await this.dengueCaseRepo.findSymptoms(c, symptomIds);
    return items.map(item => item.name).join(', ');
  }

  private async buildExportRow(
    c: Context,
    item,
  ) {
    const identityNumber = item.identity_number ? doDecrypt(item.identity_number) : "";
    const identityName = item.name ? doDecrypt(item.name) : "";
    const birthDate = item.birth_date ? doDecrypt(item.birth_date) : null;
    const age = birthDate ? moment(item.input_date).diff(moment(birthDate), "years") : null;
    const epidemiologyType = item.epidemiology_type == 1 ? "Yes" : "No";
    const peResult = PE_RESULT[item.pe_result_id];
    const laboratoryExamination = item.laboratory_examination == 1 ? "Yes" : "No";
    const phoneNumber = item.phone_number ? doDecrypt(item.phone_number) : ""

    // Make residential address
    let address = "";
    if (item.residential_address && item.residential_village_id) {
      address = await this.formatFullAddress(c, item.residential_address, item.residential_village_id, item.residential_pos_code);
    } else if (item.address && item.village_id) {
      address = await this.formatFullAddress(c, item.address, item.village_id, item.pos_code);
    }

    const equipmentNames = await this.getEquipmentNames(c, String(item.equipment_id), EQUIPMENT);
    const reagentNames = await this.getEquipmentNames(c, String(item.reagent_id), REAGENT);
    const vectorControlNames = await this.getVectorControlNames(c, String(item.vector_control_id));
    const symptomsNames = await this.getSymptomsNames(c, String(item.symptoms_id));

    return [
      identityNumber,
      identityName,
      birthDate ? moment(birthDate).format("DD MMM YYYY") : "",
      age ? `${age} Years Old` : "",
      address,
      phoneNumber,
      MARITAL_STATUS[item.marital_status] || "",
      item.education_name || "",
      item.occupation_name || "",
      item.religion_name || "",
      item.ethnic_name || "",
      moment(item.input_date).format("DD MMM YYYY"),
      item.clinical_diagnosis_name || "",
      symptomsNames || "",
      item.last_status_name || "",
      epidemiologyType || "",
      peResult || "",
      vectorControlNames || "",
      laboratoryExamination || "",
      item.laboratory_id ? item.laboratory_id_name : item.laboratory_name,
      item.specimen_type_name || "",
      item.specimen_code || "",
      item.collection_date ? moment(item.collection_date).format("DD MMM YYYY") : "",
      item.release_date ? moment(item.release_date).format("DD MMM YYYY") : "",
      item.examination_method_name || "",
      equipmentNames,
      reagentNames,
      item.examination_result_name || "",
    ];
  }

  private getExportColumns() {
    return [
      { key: "NIK", header: "NIK", width: 20 },
      { key: "Full Name", header: "Full Name", width: 25 },
      { key: "Birth Date", header: "Birth Date", width: 25 },
      { key: "Age", header: "Age", width: 20 },
      { key: "Address", header: "Address", width: 30 },
      { key: "Phone Number", header: "Phone Number", width: 25 },
      { key: "Marital Status", header: "Marital Status", width: 15 },
      { key: "Education", header: "Education", width: 30 },
      { key: "Occupation", header: "Occupation", width: 25 },
      { key: "Religion", header: "Religion", width: 25 },
      { key: "Ethnic", header: "Ethnic", width: 20 },
      { key: "Input Date", header: "Input Date", width: 20 },
      { key: "Clinical Diagnosis", header: "Clinical Diagnosis", width: 20 },
      { key: "Symptoms", header: "Symptoms", width: 20 },
      { key: "Last Status", header: "Last Status", width: 15 },
      { key: "Epidemiology Investigation (PE)", header: "Epidemiology Investigation (PE)", width: 18 },
      { key: "PE Result", header: "PE Result", width: 18 },
      { key: "Vector Control", header: "Vector Control", width: 20 },
      { key: "Laboratory Examination", header: "Laboratory Examination", width: 18 },
      { key: "Laboratory Name", header: "Laboratory Name", width: 25 },
      { key: "Specimen Type", header: "Specimen Type", width: 15 },
      { key: "Specimen ID", header: "Specimen ID", width: 15 },
      { key: "Collection Date", header: "Collection Date", width: 15 },
      { key: "Result Release Date", header: "Result Release Date", width: 15 },
      { key: "Examination Method", header: "Examination Method", width: 20 },
      { key: "Equipment", header: "Equipment", width: 15 },
      { key: "Consumable Material", header: "Consumable Material", width: 15 },
      { key: "Examination Result", header: "Examination Result", width: 20 },
    ];
  }

  private async mapPatientData(c: Context, row: ImportDengueCaseRequest) {
    const patientData: Record<string, unknown> = {
      nik: String(row.NIK),
      name: String(row.FullName),
      registered_village_id: Number(row.RegisteredVillageID),
      // Set default values for required fields
      gender: 1,
      date_of_birth: "",
      phone: "",
      registered_address: "",
      registered_postal_code: "",
    };

    if (row.RegisteredAddress) {
      patientData.registered_address = String(row.RegisteredAddress);
    }

    if (row.RegisteredPostalCode) {
      patientData.registered_postal_code = String(row.RegisteredPostalCode);
    }

    if (row.PhoneNumber) {
      let phone = String(row.PhoneNumber);

      if (!phone.startsWith('+')) {
        phone = '+' + phone;
      }

      patientData.phone = phone;
    }

    if (row.OccupationID) {
      patientData.occupation_id = Number(row.OccupationID);
    }

    if (row.ReligionID) {
      patientData.religion_id = Number(row.ReligionID);
    }

    if (row.LastEducationID) {
      patientData.last_education_id = Number(row.LastEducationID);
    }

    if (row.EthnicID) {
      patientData.ethnic_id = Number(row.EthnicID);
    }

    if (row.StatusID) {
      patientData.marital_id = Number(row.StatusID);
    } else {
      patientData.marital_id = 0;
    }

    // Get identity details if village_id exists
    if (row.RegisteredVillageID) {
      const detailIdentity = await getIdentityAndAddressByNIK(
        c,
        String(row.NIK),
        this.locationRepo
      );

      if (detailIdentity) {
        Object.assign(patientData, {
          gender: detailIdentity.gender,
          date_of_birth: detailIdentity.date_of_birth,
          registered_province_id: detailIdentity.province_id,
          registered_city_id: detailIdentity.city_id,
          registered_district_id: detailIdentity.district_id,
          registered_village_id: row.RegisteredVillageID,
        });
      }
    }

    this.setResidentialAddress(patientData, row);

    return patientData;
  }

  private setResidentialAddress(patientData: Record<string, unknown>, row: ImportDengueCaseRequest): void {
    if (row.SameAddress === 1) {
      patientData.residence_address = row.RegisteredAddress ? String(row.RegisteredAddress) : undefined;
      patientData.residence_province_id = Number(patientData.registered_province_id);
      patientData.residence_city_id = Number(patientData.registered_city_id);
      patientData.residence_district_id = Number(patientData.registered_district_id);
      patientData.residence_village_id = Number(row.RegisteredVillageID);
      patientData.residence_postal_code = String(row.RegisteredPostalCode);
    } else {
      if (row.ResidentialAddress) patientData.residence_address = String(row.ResidentialAddress);
      if (row.ResidentialProvinceID) patientData.residence_province_id = Number(row.ResidentialProvinceID);
      if (row.ResidentialCityID) patientData.residence_city_id = Number(row.ResidentialCityID);
      if (row.ResidentialDistrictID) patientData.residence_district_id = Number(row.ResidentialDistrictID);
      if (row.ResidentialVilageID) patientData.residence_village_id = Number(row.ResidentialVilageID);
      if (row.ResidentialPostalCode) patientData.residence_postal_code = String(row.ResidentialPostalCode);
    }
  }

  private validateImportData(rows): void {
    if (!rows) {
      throw new Error("Rows is null or undefined. The Excel file parsing failed. Please check if column names in row 9 match exactly with the template.");
    }

    if (!Array.isArray(rows)) {
      throw new Error(`Rows is not an array. Received type: ${typeof rows}`);
    }

    if (rows.length === 0) {
      throw new Error("No data rows found. Please ensure your Excel file has data starting from row 10. Check that row 9 has the correct column headers.");
    }
  }

  private buildSpecimenDataFromRow(row: ImportDengueCaseRequest) {
    const specimenData: Record<string, unknown> = {};

    if (row.SpecimenType) specimenData.specimen_type_id = Number(row.SpecimenType);
    if (row.SpecimenCode) specimenData.specimen_code = String(row.SpecimenCode);
    if (row.CollectionDate) specimenData.collection_date = String(row.CollectionDate);
    if (row.ReleaseDate) specimenData.release_date = String(row.ReleaseDate);
    if (row.ExaminationMethodID) specimenData.examination_method_id = Number(row.ExaminationMethodID);

    specimenData.equipment_id = row.EquipmentID
      ? String(row.EquipmentID).split(',').map(e => parseInt(e.trim(), 10)).filter(n => !isNaN(n))
      : [];

    specimenData.reagent_id = row.ReagentID
      ? String(row.ReagentID).split(',').map(r => parseInt(r.trim(), 10)).filter(n => !isNaN(n))
      : [];

    if (row.ExaminationResult) specimenData.examination_result_id = Number(row.ExaminationResult);

    return specimenData;
  }

  private buildDengueCaseDataFromRow(
    row: ImportDengueCaseRequest,
    patientData: Record<string, unknown>,
    specimenData: Record<string, unknown>
  ) {
    const inputDate = moment(row.InputDate).format("YYYY-MM-DD");

    const dengueCaseData: Record<string, unknown> = {
      clinical_diagnosis_id: row.ClinicalDiagnosisID ? Number(row.ClinicalDiagnosisID) : undefined,
      input_date: String(inputDate),
      patient: patientData,
      specimen: specimenData,
    };

    dengueCaseData.symptoms_id = row.SymptomsID
      ? String(row.SymptomsID).split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n))
      : [];

    if (row.LastStatusID) dengueCaseData.last_status_id = Number(row.LastStatusID);
    if (row.EpidemiologyType != null) dengueCaseData.epidemiology_type = row.EpidemiologyType;
    if (row.PEResultID !== undefined && row.PEResultID !== null) dengueCaseData.pe_result_id = Number(row.PEResultID);

    dengueCaseData.vector_control_id = row.VectorControlID
      ? String(row.VectorControlID).split(',').map(v => parseInt(v.trim(), 10)).filter(n => !isNaN(n))
      : [];

    if (row.LaboratoryExamination != null) dengueCaseData.laboratory_examination = row.LaboratoryExamination;
    if (row.ExaminationType) dengueCaseData.examination_type = Number(row.ExaminationType);
    if (row.LaboratoryID) dengueCaseData.laboratory_id = Number(row.LaboratoryID);
    if (row.LaboratoryName) dengueCaseData.laboratory_name = String(row.LaboratoryName);

    return dengueCaseData;
  }

  private async processImportRow(
    c: Context,
    row: ImportDengueCaseRequest,
    rowNumber: number
  ): Promise<{ success: boolean; isDuplicate: boolean }> {
    const inputDate = moment(row.InputDate).format("YYYY-MM-DD");

    // Check for duplicates
    const existing = await this.dengueCaseRepo.findByNikAndInputDate(
      c,
      String(row.NIK),
      inputDate
    );

    if (existing) {
      return { success: false, isDuplicate: true };
    }

    const patientData = await this.mapPatientData(c, row);
    const specimenData = this.buildSpecimenDataFromRow(row);
    const dengueCaseData = this.buildDengueCaseDataFromRow(row, patientData, specimenData);

    try {
      await this.insertCaseRepot(c, dengueCaseData as CreateDengueCaseRequest);
      return { success: true, isDuplicate: false };
    } catch (error) {
      console.error(`Error processing row ${rowNumber}:`, error);
      return { success: false, isDuplicate: false };
    }
  }

}
