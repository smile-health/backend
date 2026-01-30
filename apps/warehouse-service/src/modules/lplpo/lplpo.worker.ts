import { Consumer } from "@smile-health/lib/rabbitmq/consumer.js"
import { TOPIC } from "@smile-health/lib/rabbitmq/topic.js"
import { BaseWorker } from "../base.worker.js"
import ExportHistoryRepository from "../export-history/export-history.repository.js"
import { DB } from "@/common/infrastructure/database/types/db.js"
import { MultiSheetZipExporter } from "@smile-health/lib/excel/multi-sheet-zip.js"
import { CustomContext } from "@smile-health/lib/types/context.js"
import env from "../../config/env.js"
import { LplpoModule } from "./lplpo.module.js"
import { LplpoQueryParamsExportSchema } from "./lplpo.schema.js"
import { LplpoExcel } from "./lplpo.excel.js"
import moment from "moment"
import { z } from "zod"
import { createMinioClientFromEnv } from "@smile-health/lib/minio.js"
import i18n from "@smile-health/lib/i18n.js"
import { logger } from "@smile-health/lib/logger.js"

type LplpoQueryParams = z.infer<typeof LplpoQueryParamsExportSchema>

export class LplpoWorker extends BaseWorker {
  constructor(
    private readonly lplpoModule: LplpoModule,
    protected readonly exportHistoryRepo: ExportHistoryRepository
  ) {
    super(exportHistoryRepo)
  }

  public registerWorkers(consumer: Consumer<DB>) {
    // Single export - generates one Excel file (no ZIP)
    consumer.route(TOPIC.LPLPO_EXPORTED, async (c, msg) => {
      const parseMsg = JSON.parse(msg ?? "{}")
      const { params, options, language, timezone } = parseMsg.payload

      await this.processSingleExcelExport(
        c,
        options,
        language,
        timezone,
        params
      )
    })

    // Multi-file export - generates multiple Excel files in ZIP
    consumer.route(TOPIC.LPLPO_ALL_EXPORTED, async (c, msg) => {
      const parseMsg = JSON.parse(msg ?? "{}")
      const { params, options, language, timezone } = parseMsg.payload

      await this.processAsyncExport(c, options, async () => {
        return await this.prepareMultiExporter(c, language, timezone, params)
      })
    })
  }

  private async processSingleExcelExport(
    c: CustomContext<DB>,
    options: { export_id: number; original_filename: string; language: string },
    language: string,
    timezone: string,
    queryParams: LplpoQueryParams
  ) {
    if (!this.exportHistoryRepo) {
      throw new Error("export history repo not yet initialized")
    }

    // Set language
    const translator = i18n.cloneInstance()
    translator.changeLanguage(options.language)
    Object.assign(c.var, { t: translator.t })

    try {
      await this.exportHistoryRepo.upsert(
        c,
        {
          status: "in_progress",
        },
        options.export_id
      )

      const minioClient = createMinioClientFromEnv()
      if (!minioClient) {
        throw new Error("Failed to create MinIO client")
      }

      // Generate Excel file
      const { buffer, filename } = await this.prepareSingleExcelFile(
        c,
        language,
        timezone,
        queryParams
      )

      // Upload to MinIO
      const bucketName = env.EXPORT_EXCEL_BUCKET_NAME || "smile-platform"
      const objectName = `${options.original_filename}`
      // const objectName = filename

      // Ensure bucket exists
      const exists = await minioClient.bucketExists(bucketName)
      if (!exists) {
        await minioClient.makeBucket(
          bucketName,
          env.MINIO_REGION || "ap-southeast-3"
        )
      }

      // Upload file
      await minioClient.putObject(
        bucketName,
        objectName,
        Buffer.from(buffer as ArrayBuffer)
      )

      // Generate download URL
      const endpointUrl = `${env.MINIO_ENDPOINT}:${env.MINIO_PORT}`
      const fileUrl = `${endpointUrl}/${bucketName}/${objectName}`

      const expiresAt = new Date()
      expiresAt.setDate(
        expiresAt.getDate() + (Number(env.EXPORT_EXCEL_EXPIRES_DAYS) || 7)
      )

      await this.exportHistoryRepo.upsert(
        c,
        {
          status: "done",
          download_url: fileUrl,
          filename: filename,
          expires_at: expiresAt,
        },
        options.export_id
      )

      console.log("✅ Excel file uploaded to MinIO:", fileUrl)
    } catch (error) {
      await this.exportHistoryRepo.upsert(
        c,
        {
          status: "failed",
        },
        options.export_id
      )

      console.log(error)
      logger.error(`❌ Error exporting Excel file: ${error}`)
    }
  }

  private async prepareSingleExcelFile(
    c: CustomContext<DB>,
    language: string,
    timezone: string,
    queryParams: any
  ) {
    // Get all data from repository - use same logic as /lplpo/export endpoint
    let lplpoRepository = await this.lplpoModule.exportDataLplpo(
      c as any,
      queryParams
    )

    lplpoRepository = lplpoRepository.filter(
      (item) => item.parent_material_id != null && item.material_id != null
    )

    // Get missing materials from entity
    let getMaterialByEntityIds =
      await this.lplpoModule.getParentMaterialByEntity(
        c as any,
        queryParams.entity_id,
        "child",
        {
          provinceId: queryParams.province_id,
          regencyId: queryParams.regency_id,
          programId: queryParams?.programId,
        }
      )

    getMaterialByEntityIds = getMaterialByEntityIds.filter((item) => {
      return !lplpoRepository.some(
        (parentItem) =>
          parentItem.parent_material_id === item.parent_material_id &&
          parentItem.material_id === item.material_id
      )
    })

    getMaterialByEntityIds = getMaterialByEntityIds.map((item) => ({
      program_id: item.program_id,
      program_name: item.program_name,
      transactions_activity_id: item.transactions_activity_id,
      transactions_activity_name: item.transactions_activity_name,
      province_id: item.province_id,
      province_name: item.province_name,
      regency_id: item.regency_id,
      regency_name: item.regency_name,
      entity_id: item.entity_id,
      entities_name: item.entities_name,
      date: null,
      parent_material_id: item.parent_material_id,
      parent_material_name: item.parent_material_name,
      material_id: item.material_id,
      material_name: item.material_name,
      dmm_unit_of_consumption_name: item.dmm_unit_of_consumption_name,
      batches_code: null,
      expired_date: null,
      budget_source_name: "",
      opening_qty: 0,
      received_qty: 0,
      consumption_qty: 0,
      closing_qty: 0,
    }))

    lplpoRepository = [...lplpoRepository, ...getMaterialByEntityIds]
    const response = lplpoRepository.sort((a, b) => {
      return (
        b.opening_qty - a.opening_qty ||
        b.received_qty - a.received_qty ||
        b.consumption_qty - a.consumption_qty ||
        b.closing_qty - a.closing_qty
      )
    })

    // Use same grouping logic as controller
    const materialGroups = response.reduce((acc: any, item: any) => {
      // const materialKey = `${item.parent_material_id}_${item.material_id}`
      const materialKey = `${item.parent_material_id}_${item.material_id}_${item.batches_code}`

      if (!acc[materialKey]) {
        acc[materialKey] = {
          program_id: item.program_id,
          program_name: item.program_name,
          transactions_activity_id: item.transactions_activity_id,
          transactions_activity_name: item.transactions_activity_name,
          province_id: item.province_id,
          province_name: item.province_name,
          regency_id: item.regency_id,
          regency_name: item.regency_name,
          entity_id: item.entity_id,
          entities_name: item.entities_name,
          date: item.date,
          parent_material_id: item.parent_material_id,
          parent_material_name: item.parent_material_name,
          material_id: item.material_id,
          material_name: item.material_name,
          dmm_unit_of_consumption_name: item.dmm_unit_of_consumption_name,
          batches_code: item.batches_code,
          expired_date: item.expired_date,
          budget_source_name: item.budget_source_name,
          opening_qty: 0,
          received_qty: 0,
          consumption_qty: 0,
          closing_qty: 0,
          budget_source: {
            apbd_1: 0,
            apbd_2: 0,
            apbn: 0,
            dak: 0,
            other: 0,
          },
        }
      }

      acc[materialKey].opening_qty += Number(item.opening_qty) || 0
      acc[materialKey].received_qty += Number(item.received_qty) || 0
      acc[materialKey].consumption_qty += Number(item.consumption_qty) || 0
      acc[materialKey].closing_qty += Number(item.closing_qty) || 0

      if (item.budget_source_name) {
        if (
          item.budget_source_name === "APBD-I" ||
          item.budget_source_name === "APBD I"
        ) {
          acc[materialKey].budget_source.apbd_1 = 1
        } else if (
          item.budget_source_name === "APBD-II" ||
          item.budget_source_name === "APBD II"
        ) {
          acc[materialKey].budget_source.apbd_2 = 1
        } else if (item.budget_source_name === "APBN") {
          acc[materialKey].budget_source.apbn = 1
        } else if (item.budget_source_name === "DAK") {
          acc[materialKey].budget_source.dak = 1
        } else if (
          item.budget_source_name !== "" &&
          item.budget_source_name !== null &&
          item.budget_source_name !== undefined
        ) {
          acc[materialKey].budget_source.other = 1
        }
      }

      return acc
    }, {})

    const materialArray = Object.values(materialGroups)

    const parentGroups: any = materialArray.reduce(
      (acc: any, material: any) => {
        const parentKey = material.parent_material_id

        if (!acc[parentKey]) {
          acc[parentKey] = {
            program_id: material.program_id,
            program_name: material.program_name,
            transactions_activity_id: material.transactions_activity_id,
            transactions_activity_name: material.transactions_activity_name,
            province_id: material.province_id,
            province_name: material.province_name,
            regency_id: material.regency_id,
            regency_name: material.regency_name,
            entity_id: material.entity_id,
            entities_name: material.entities_name,
            date: material.date,
            parent_material_id: material.parent_material_id,
            parent_material_name: material.parent_material_name,
            material_id: material.material_id,
            material_name: material.material_name,
            dmm_unit_of_consumption_name: material.dmm_unit_of_consumption_name,
            batches_code: null,
            expired_date: null,
            budget_source_name: material.budget_source_name,
            opening_qty: 0,
            received_qty: 0,
            consumption_qty: 0,
            closing_qty: 0,
            materials: [],
            materialCounter: 0,
          }
        }

        acc[parentKey].opening_qty += Number(material.opening_qty) || 0
        acc[parentKey].received_qty += Number(material.received_qty) || 0
        acc[parentKey].consumption_qty += Number(material.consumption_qty) || 0
        acc[parentKey].closing_qty += Number(material.closing_qty) || 0

        // acc[parentKey].materialCounter++
        // acc[parentKey].materials.push({
        //   no: `${acc[parentKey].materials.length + 1}`,
        //   material_id: material.material_id,
        //   material_name: material.material_name,
        //   dmm_unit_of_consumption_name: material.dmm_unit_of_consumption_name,
        //   batches_code: material.batches_code,
        //   expired_date: material.expired_date,
        //   budget_source_name: material.budget_source_name,
        //   opening_qty: material.opening_qty,
        //   received_qty: material.received_qty,
        //   consumption_qty: material.consumption_qty,
        //   closing_qty: material.closing_qty,
        //   budget_source: material.budget_source,
        // })
        if (
          material.opening_qty !== 0 ||
          material.received_qty !== 0 ||
          material.consumption_qty !== 0 ||
          material.closing_qty !== 0
        ) {
          acc[parentKey].materialCounter++

          // Check if this material name already exists in this parent (don't count the current one being added)
          const materialNameExists = acc[parentKey].materials.some(
            (m) =>
              m.material_name === material.material_name &&
              m.material_name !== ""
          )
          console.log(
            "materialNameExists",
            material.material_name,
            materialNameExists
          )
          acc[parentKey].materials.push({
            no: `${acc[parentKey].materials.length + 1}`,
            material_id: material.material_id || "",
            // If same name exists, set to empty string, otherwise use the name
            material_name: materialNameExists
              ? ""
              : material.material_name || "",
            dmm_unit_of_consumption_name:
              material.dmm_unit_of_consumption_name || "",
            batches_code: material.batches_code || "",
            expired_date: material.expired_date || null,
            budget_source_name: material.budget_source_name || "",
            opening_qty: material.opening_qty,
            received_qty: material.received_qty,
            consumption_qty: material.consumption_qty,
            closing_qty: material.closing_qty,
            budget_source: material.budget_source,
          })
        }

        return acc
      },
      {}
    )

    const finalData = (Object.values(parentGroups) as any[])
      .sort((a, b) =>
        a.parent_material_name.localeCompare(b.parent_material_name)
      )
      .map((item: any, index: number) => {
        const parentNo = index + 1
        const materials = item.materials.map((mat: any, matIndex: number) => ({
          ...mat,
          no: `${parentNo}.${matIndex + 1}`,
        }))

        delete item.materialCounter

        return {
          no: parentNo,
          ...item,
          materials,
        }
      })

    // Create single Excel file with translator
    const excel = new LplpoExcel(c.var.t)

    const firstItem = finalData[0] || {}
    const dinas = firstItem.entities_name || "-"
    const satuanKerja = `Instalasi Farmasi ${dinas}`
    const kabupaten = firstItem.regency_name || "-"
    const propinsi = firstItem.province_name || "-"
    const kegiatan = queryParams?.activity_id
      ? firstItem.transactions_activity_name
      : "Semua"

    let bulan = "Agustus"
    let tahun = "2025"
    if (queryParams.start_date) {
      const date = moment(queryParams.start_date)
      bulan = date.format("MMMM")
      tahun = date.format("YYYY")
    }

    await excel.setHeader(
      "Detail",
      dinas,
      satuanKerja,
      kabupaten,
      propinsi,
      kegiatan,
      bulan,
      tahun
    )

    await excel.addMaterialRows("Detail", finalData)

    // Add Product Template sheet with parent materials only
    await excel.setHeader(
      "Product template",
      dinas,
      satuanKerja,
      kabupaten,
      propinsi,
      kegiatan,
      bulan,
      tahun
    )

    // Extract parent materials only (without children)
    const parentMaterialsOnly = finalData.map((item) => ({
      no: item.no,
      parent_material_name: item.parent_material_name,
      dmm_unit_of_consumption_name: item.dmm_unit_of_consumption_name,
      opening_qty: item.opening_qty,
      received_qty: item.received_qty,
      consumption_qty: item.consumption_qty,
      closing_qty: item.closing_qty,
      batches_code: item.batches_code,
      expired_date: item.expired_date,
      materials: item.materials,
    }))

    await excel.addProductTemplateRows("Product template", parentMaterialsOnly)

    const filename = `${firstItem.entities_name || "Export"}_${firstItem.program_name || "Program"}_LPLPO_${bulan}_${tahun}`
    const fileResult = await excel.generate(filename)

    // === SAMPLE: Save file locally for testing ===
    // Uncomment the code below to save Excel file to local directory for validation
    /*
    const fs = await import("fs")
    const path = await import("path")
    const tempDir = path.join(process.cwd(), "temp-exports")

    // Create temp directory if not exists
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }

    const localFilePath = path.join(tempDir, `${filename}.xlsx`)
    fs.writeFileSync(
      localFilePath,
      Buffer.from(fileResult.buffer as ArrayBuffer)
    )
    console.log("📥 Sample file saved locally:", localFilePath)
    console.log(
      "📊 File size:",
      (Buffer.from(fileResult.buffer as ArrayBuffer).length / 1024).toFixed(2),
      "KB"
    )
    */
    // === END SAMPLE ===

    // Return buffer and filename for MinIO upload
    return {
      buffer: fileResult.buffer,
      filename: `${filename}.xlsx`,
    }
  }

  private async prepareMultiExporter(
    c: CustomContext<DB>,
    language: string,
    timezone: string,
    queryParams: any
  ) {
    // Get all data from repository
    let lplpoRepository = await this.lplpoModule.exportDataLplpo(
      c as any,
      queryParams
    )
    let getMaterialByEntityIds
    if (queryParams?.province_id) {
      getMaterialByEntityIds = await this.lplpoModule.getParentMaterialByEntity(
        c as any,
        "",
        "child",
        {
          provinceId: queryParams.province_id,
          regencyId: queryParams.regency_id,
          programId: queryParams?.programId,
        }
      )
    } else {
      let groupByProvinceAndEntity = lplpoRepository.reduce(
        (acc: any, item: any) => {
          const key = `${item.entity_id}`

          if (!acc[key]) {
            acc[key] = {
              province_id: item.province_id,
              entity_id: item.entity_id,
              parent_material_id: item.parent_material_id,
              material_id: item.material_id,
              activity_id: item.transactions_activity_id,
              activity_name: item.transactions_activity_name,
            }
          }

          return acc
        },
        {}
      )

      let entityGroups = Object.values(groupByProvinceAndEntity)
      entityGroups = entityGroups.map(
        (item: any, index: number) => item.entity_id
      )
      console.log("=== Province & Entity Grouping ===")
      console.log(
        "Total unique province-entity combinations:",
        entityGroups.length
      )
      console.log("Province-Entity groups:", entityGroups)

      getMaterialByEntityIds = await this.lplpoModule.getParentMaterialByEntity(
        c as any,
        entityGroups.join(","),
        "child",
        {
          provinceId: queryParams.province_id,
          regencyId: queryParams.regency_id,
          programId: queryParams?.programId,
        }
      )
    }

    getMaterialByEntityIds = getMaterialByEntityIds.map((item) => ({
      program_id: item.program_id,
      program_name: item.program_name,
      transactions_activity_id: item.transactions_activity_id,
      transactions_activity_name: item.transactions_activity_name,
      province_id: item.province_id,
      province_name: item.province_name,
      regency_id: item.regency_id,
      regency_name: item.regency_name,
      entity_id: item.entity_id,
      entities_name: item.entities_name,
      date: null,
      parent_material_id: item.parent_material_id,
      parent_material_name: item.parent_material_name,
      material_id: item.material_id,
      material_name: item.material_name,
      dmm_unit_of_consumption_name: item.dmm_unit_of_consumption_name,
      batches_code: null,
      expired_date: null,
      budget_source_name: "",
      opening_qty: 0,
      received_qty: 0,
      consumption_qty: 0,
      closing_qty: 0,
    }))

    lplpoRepository = [...lplpoRepository, ...getMaterialByEntityIds]
    const response = lplpoRepository.sort((a, b) => {
      return (
        b.opening_qty - a.opening_qty ||
        b.received_qty - a.received_qty ||
        b.consumption_qty - a.consumption_qty ||
        b.closing_qty - a.closing_qty
      )
    })
    console.log("Total records to export:", response.length)
    // Step 1: Group by material_id first and sum quantities
    const materialGroups = response.reduce((acc: any, item: any) => {
      const materialKey = `${item.entity_id}_${item.parent_material_id}_${item.material_id}_${item.batches_code}`
      // const materialKey = `${item.parent_material_id}_${item.material_id}_${item.batches_code}`

      if (!acc[materialKey]) {
        acc[materialKey] = {
          program_id: item.program_id,
          program_name: item.program_name,
          transactions_activity_id: item.transactions_activity_id,
          transactions_activity_name: item.transactions_activity_name,
          province_id: item.province_id,
          province_name: item.province_name,
          regency_id: item.regency_id,
          regency_name: item.regency_name,
          entity_id: item.entity_id,
          entities_name: item.entities_name,
          date: item.date,
          parent_material_id: item.parent_material_id,
          parent_material_name: item.parent_material_name,
          material_id: item.material_id,
          material_name: item.material_name,
          dmm_unit_of_consumption_name: item.dmm_unit_of_consumption_name,
          batches_code: item.batches_code,
          expired_date: item.expired_date,
          budget_source_name: item.budget_source_name,
          opening_qty: 0,
          received_qty: 0,
          consumption_qty: 0,
          closing_qty: 0,
          budget_source: {
            apbd_1: 0,
            apbd_2: 0,
            apbn: 0,
            dak: 0,
            other: 0,
          },
        }
      }

      // Sum quantities for material level
      acc[materialKey].opening_qty += Number(item.opening_qty) || 0
      acc[materialKey].received_qty += Number(item.received_qty) || 0
      acc[materialKey].consumption_qty += Number(item.consumption_qty) || 0
      acc[materialKey].closing_qty += Number(item.closing_qty) || 0

      // Track budget sources
      if (item.budget_source_name) {
        if (
          item.budget_source_name === "APBD-I" ||
          item.budget_source_name === "APBD I"
        ) {
          acc[materialKey].budget_source.apbd_1 = 1
        } else if (
          item.budget_source_name === "APBD-II" ||
          item.budget_source_name === "APBD II"
        ) {
          acc[materialKey].budget_source.apbd_2 = 1
        } else if (item.budget_source_name === "APBN") {
          acc[materialKey].budget_source.apbn = 1
        } else if (item.budget_source_name === "DAK") {
          acc[materialKey].budget_source.dak = 1
        } else if (
          item.budget_source_name !== "" &&
          item.budget_source_name !== null &&
          item.budget_source_name !== undefined
        ) {
          acc[materialKey].budget_source.other = 1
        }
      }

      return acc
    }, {})

    const materialArray = Object.values(materialGroups)

    // Step 2: Group by parent_material_id and nest materials
    const parentGroups: any = materialArray.reduce(
      (acc: any, material: any) => {
        const parentKey = `${material.entity_id}_${material.parent_material_id}`

        if (!acc[parentKey]) {
          acc[parentKey] = {
            program_id: material.program_id,
            program_name: material.program_name,
            transactions_activity_id: material.transactions_activity_id,
            transactions_activity_name: material.transactions_activity_name,
            province_id: material.province_id,
            province_name: material.province_name,
            regency_id: material.regency_id,
            regency_name: material.regency_name,
            entity_id: material.entity_id,
            entities_name: material.entities_name,
            date: material.date,
            parent_material_id: material.parent_material_id,
            parent_material_name: material.parent_material_name,
            material_id: material.material_id,
            material_name: material.material_name,
            dmm_unit_of_consumption_name: material.dmm_unit_of_consumption_name,
            batches_code: null,
            expired_date: null,
            budget_source_name: material.budget_source_name,
            opening_qty: 0,
            received_qty: 0,
            consumption_qty: 0,
            closing_qty: 0,
            materials: [],
            materialCounter: 0,
          }
        }

        // Sum quantities from materials to parent
        acc[parentKey].opening_qty += Number(material.opening_qty) || 0
        acc[parentKey].received_qty += Number(material.received_qty) || 0
        acc[parentKey].consumption_qty += Number(material.consumption_qty) || 0
        acc[parentKey].closing_qty += Number(material.closing_qty) || 0

        if (
          material.opening_qty !== 0 ||
          material.received_qty !== 0 ||
          material.consumption_qty !== 0 ||
          material.closing_qty !== 0
        ) {
          // Add material to nested array
          acc[parentKey].materialCounter++

          // Check if this material name already exists in this parent (don't count the current one being added)
          const materialNameExists = acc[parentKey].materials.some(
            (m) =>
              m.material_name === material.material_name &&
              m.material_name !== ""
          )

          acc[parentKey].materials.push({
            no: `${acc[parentKey].materials.length + 1}`,
            material_id: material.material_id || "",
            // If same name exists, set to empty string, otherwise use the name
            material_name: materialNameExists
              ? ""
              : material.material_name || "",
            dmm_unit_of_consumption_name:
              material.dmm_unit_of_consumption_name || "",
            batches_code: material.batches_code || "",
            expired_date: material.expired_date || null,
            budget_source_name: material.budget_source_name || "",
            opening_qty: material.opening_qty,
            received_qty: material.received_qty,
            consumption_qty: material.consumption_qty,
            closing_qty: material.closing_qty,
            budget_source: material.budget_source,
          })
        }
        return acc
      },
      {}
    )

    // Step 3: Group by entity_id first, then apply numbering per entity
    const byEntity: any = {}

    for (const item of Object.values(parentGroups) as any[]) {
      if (!byEntity[item.entity_id]) {
        byEntity[item.entity_id] = []
      }
      byEntity[item.entity_id].push(item)
    }

    // Step 4: Sort and apply sequential numbering within each entity group
    for (const entityId of Object.keys(byEntity)) {
      const entityItems = byEntity[entityId]

      // Sort by parent_material_name within entity
      entityItems.sort((a: any, b: any) =>
        a.parent_material_name.localeCompare(b.parent_material_name)
      )

      // Apply numbering starting from 1 for each entity
      entityItems.forEach((item: any, index: number) => {
        const parentNo = index + 1

        // Apply numbering with parent prefix (keep original order)
        item.materials.forEach((mat: any, matIndex: number) => {
          mat.no = `${parentNo}.${matIndex + 1}`
        })

        // Set parent number and remove helper
        item.no = parentNo
        delete item.materialCounter
      })
    }

    // Create MultiSheetZipExporter
    const exporter = new MultiSheetZipExporter({
      language,
      timezone,
      batchSize: env.EXPORT_EXCEL_BATCH_SIZE,
      bucketName: env.EXPORT_EXCEL_BUCKET_NAME,
    })

    // Parse month and year from queryParams for filename
    let bulan = "Agustus"
    let tahun = "2025"
    if (queryParams.start_date) {
      const date = moment(queryParams.start_date)
      bulan = date.format("MMMM")
      tahun = date.format("YYYY")
    }
    console.log(
      "Preparing multi-file export for:",
      Object.keys(byEntity).length,
      "entities"
    )

    // Generate ONE Excel file per entity (containing all parent materials of that entity)
    for (const entityId of Object.keys(byEntity)) {
      let entityParents = byEntity[entityId]

      if (entityParents.length === 0) continue

      const excel = new LplpoExcel(c.var.t)

      // Get metadata from first parent (all have same entity info)
      const firstParent = entityParents[0]
      const dinas = firstParent.entities_name || "-"
      const satuanKerja = "Instalasi Farmasi " + dinas
      const kabupaten = firstParent.regency_name || "-"
      const propinsi = firstParent.province_name || "-"
      const kegiatan = firstParent.transactions_activity_name || "-"

      // Set header
      await excel.setHeader(
        "Detail",
        dinas,
        satuanKerja,
        kabupaten,
        propinsi,
        kegiatan,
        bulan,
        tahun
      )

      // Add ALL parent materials for this entity
      await excel.addMaterialRows("Detail", entityParents)

      // Add Product Template sheet with parent materials only
      await excel.setHeader(
        "Product template",
        dinas,
        satuanKerja,
        kabupaten,
        propinsi,
        kegiatan,
        bulan,
        tahun
      )

      // Extract parent materials only (without children)
      const parentMaterialsOnly = entityParents.map((item) => ({
        no: item.no,
        parent_material_name: item.parent_material_name,
        dmm_unit_of_consumption_name: item.dmm_unit_of_consumption_name,
        opening_qty: item.opening_qty,
        received_qty: item.received_qty,
        consumption_qty: item.consumption_qty,
        closing_qty: item.closing_qty,
        batches_code: item.batches_code,
        expired_date: item.expired_date,
        materials: item.materials,
      }))

      await excel.addProductTemplateRows(
        "Product template",
        parentMaterialsOnly
      )

      // Generate filename: [Entity]_[Program]_LPLPO_[Month]_[Year].xlsx
      const entityName = (firstParent.entities_name || "Entity")
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .substring(0, 30)
      const programName = (firstParent.program_name || "Program")
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .substring(0, 30)
      const filename = `${entityName}_${programName}_LPLPO_${bulan}_${tahun}`

      // Get buffer
      const fileResult = await excel.generate(filename)

      // Add directly to ZIP using exporter's internal zip property
      // @ts-ignore - accessing internal property
      exporter.zip.file(
        `${filename}.xlsx`,
        Buffer.from(fileResult.buffer as ArrayBuffer)
      )

      console.log(
        `✅ Generated Excel for entity ${entityId}: ${filename}.xlsx with ${entityParents.length} parent materials`
      )
    }

    return exporter
  }
}
