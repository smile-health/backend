import { db } from "@/scripts/db.platform.js"
import "@tensorflow/tfjs-node"
import * as use from "@tensorflow-models/universal-sentence-encoder"
import { createMinioClientFromEnv } from "@smile/lib/minio.js"
import * as fs from "fs/promises"
import * as path from "path"
import * as tf from "@tensorflow/tfjs-node"
import { getMigrationDB } from "@/scripts/db.migration.js"

interface Entity {
  id: number
  name: string | null
  code?: string | null
  province_name?: string | null
  province_id?: number | null
  regency_name?: string | null
  regency_id?: number | null
  sub_district_name?: string | null
  sub_district_id?: number | null
  village_name?: string | null
  village_id?: number | null
  source?: 'imun' | 'smile5'
}

interface EntityWithEmbedding extends Entity {
  embedding: number[]
}

// 🔥 KONFIGURASI FLEKSIBEL
const DEFAULT_CONFIG = {
  SIMILARITY_THRESHOLD: 0.96,
  LIMIT_ENTITIES: 30000,
  LOCALITY_FILTER: "regency" as "province" | "regency" | null,
  AUTO_MODE_THRESHOLD: 50000,
  BLOCK_SIZE: 2000,
  BATCH_SIZE: 50,
  WRITE_BUFFER_SIZE: 100,
  REPORTS_DIR: "./reports",
  EXCLUDED_ENTITY_TAG_IDS: [1, 2, 3, 4, 5, 7],
  MAX_GROUP_SIZE: 5000,
  STREAM_TO_DISK: true,
}

/**
 * 🆕 MEMORY MONITOR
 */
class MemoryMonitor {
  private startMemory: number
  private peakMemory: number = 0

  constructor() {
    this.startMemory = process.memoryUsage().heapUsed
  }

  report(label: string = "") {
    const used = process.memoryUsage()
    const heapUsedMB = (used.heapUsed / 1024 / 1024).toFixed(2)
    const heapTotalMB = (used.heapTotal / 1024 / 1024).toFixed(2)
    const rssMB = (used.rss / 1024 / 1024).toFixed(2)

    this.peakMemory = Math.max(this.peakMemory, used.heapUsed)

    console.log(`  💾 Memory ${label}:`)
    console.log(`     Heap Used: ${heapUsedMB} MB / ${heapTotalMB} MB`)
    console.log(`     RSS: ${rssMB} MB`)
    console.log(`     Peak: ${(this.peakMemory / 1024 / 1024).toFixed(2)} MB`)
  }
}

/**
 * Cosine Similarity
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < vecA.length; i++) {
    const valA = vecA[i]
    const valB = vecB[i]
    if (valA !== undefined && valB !== undefined) {
      dotProduct += valA * valB
      normA += valA * valA
      normB += valB * valB
    }
  }

  if (normA === 0 || normB === 0) return 0
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

/**
 * 🔥 Generate embeddings dengan AGGRESSIVE CLEANUP
 */
async function generateEmbeddingsBatch(
  model: any,
  entities: Entity[]
): Promise<EntityWithEmbedding[]> {
  const names = entities.map((e) => e.name || "")

  const embeddings = await model.embed(names)
  const embeddingArray = (await embeddings.array()) as number[][]

  embeddings.dispose()

  const result = entities.map((entity, i) => ({
    ...entity,
    embedding: embeddingArray[i] || [],
  }))

  embeddingArray.length = 0

  return result
}

/**
 * 🆕 STREAMING CSV WRITER (dengan Transaction Count) ⭐ UPDATED
 */
class StreamingCSVWriter {
  private stream1: any
  private stream2: any
  private totalWritten = 0
  private filePath1: string
  private filePath2: string

  constructor(baseFileName: string) {
    this.filePath1 = baseFileName.replace(".xlsx", "_sheet1.csv")
    this.filePath2 = baseFileName.replace(".xlsx", "_sheet2.csv")
  }

  async init() {
    this.stream1 = await fs.open(this.filePath1, "w")
    this.stream2 = await fs.open(this.filePath2, "w")

    // ⭐ UPDATED: Tambah kolom Transaction Count dan Entity Code
    const header1 =
      "Source ID [Source],Source Name,Source Code,Source Province,Source Regency,Source Sub District,Source Village,Source Transaction Count,Target ID [Target],Target Name,Target Code,Target Province,Target Regency,Target Sub District,Target Village,Target Transaction Count,Similarity Score\n"
    const header2 =
      "Source ID [Source],Source Province ID,Source Regency ID,Source Sub District ID,Source Village ID,Source Transaction Count,Target ID [Target],Target Province ID,Target Regency ID,Target Sub District ID,Target Village ID,Target Transaction Count,Similarity Score\n"

    await this.stream1.write(header1)
    await this.stream2.write(header2)

    console.log(
      `✓ StreamingCSVWriter initialized (with transaction count and entity code)`
    )
  }

  async add(sheet1Row: any, sheet2Row: any): Promise<void> {
    const escape = (val: any) => {
      const str = String(val || "")
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    // ⭐ UPDATED: Tambah source_transaction_count, target_transaction_count, dan entity code
    const line1 =
      [
        sheet1Row.source_id,
        escape(sheet1Row.source_name),
        escape(sheet1Row.source_code), // ⭐ NEW: Entity code after name
        escape(sheet1Row.source_province_name),
        escape(sheet1Row.source_regency_name),
        escape(sheet1Row.source_sub_district_name),
        escape(sheet1Row.source_village_name),
        sheet1Row.source_transaction_count, // ⭐ NEW
        sheet1Row.target_id,
        escape(sheet1Row.target_name),
        escape(sheet1Row.target_code), // ⭐ NEW: Entity code after name
        escape(sheet1Row.target_province_name),
        escape(sheet1Row.target_regency_name),
        escape(sheet1Row.target_sub_district_name),
        escape(sheet1Row.target_village_name),
        sheet1Row.target_transaction_count, // ⭐ NEW
        sheet1Row.similarity_score,
      ].join(",") + "\n"

    const line2 =
      [
        sheet2Row.source_id,
        sheet2Row.source_province_id,
        sheet2Row.source_regency_id,
        sheet2Row.source_sub_district_id,
        sheet2Row.source_village_id,
        sheet2Row.source_transaction_count, // ⭐ NEW
        sheet2Row.target_id,
        sheet2Row.target_province_id,
        sheet2Row.target_regency_id,
        sheet2Row.target_sub_district_id,
        sheet2Row.target_village_id,
        sheet2Row.target_transaction_count, // ⭐ NEW
        sheet2Row.similarity_score,
      ].join(",") + "\n"

    await this.stream1.write(line1)
    await this.stream2.write(line2)

    this.totalWritten++
  }

  async flush(): Promise<void> {
    // CSV writes directly, no buffer
  }

  getTotalWritten(): number {
    return this.totalWritten
  }

  async close(): Promise<void> {
    await this.stream1.close()
    await this.stream2.close()
    console.log(`✓ CSV files written: ${this.filePath1}, ${this.filePath2}`)
  }

  getFilePaths(): string[] {
    return [this.filePath1, this.filePath2]
  }
}

/**
 * 🔥 OPTIMIZED EXCEL WRITER (dengan Transaction Count) ⭐ UPDATED
 */
class OptimizedExcelWriter {
  private workbook: any
  private sheet1: any
  private sheet2: any
  private totalWritten = 0
  private batchBuffer1: any[] = []
  private batchBuffer2: any[] = []
  private bufferSize: number
  private ExcelJS: any

  constructor(bufferSize: number = 100) {
    this.bufferSize = bufferSize
  }

  async init() {
    this.ExcelJS = (await import("exceljs")).default
    this.workbook = new this.ExcelJS.Workbook()

    // ⭐ UPDATED: Tambah kolom Transaction Count dan Entity Code
    this.sheet1 = this.workbook.addWorksheet("Sheet 1 - Entity Details")
    this.sheet1.columns = [
      { header: "Source ID [Source]", key: "source_id", width: 12 },
      { header: "Source Name", key: "source_name", width: 35 },
      { header: "Source Code", key: "source_code", width: 15 }, // ⭐ NEW: Entity code after name
      { header: "Source Province", key: "source_province_name", width: 20 },
      { header: "Source Regency", key: "source_regency_name", width: 20 },
      {
        header: "Source Sub District",
        key: "source_sub_district_name",
        width: 20,
      },
      { header: "Source Village", key: "source_village_name", width: 20 },
      {
        header: "Source Transaction Count",
        key: "source_transaction_count",
        width: 22,
      }, // ⭐ NEW
      { header: "Target ID [Target]", key: "target_id", width: 12 },
      { header: "Target Name", key: "target_name", width: 35 },
      { header: "Target Code", key: "target_code", width: 15 }, // ⭐ NEW: Entity code after name
      { header: "Target Province", key: "target_province_name", width: 20 },
      { header: "Target Regency", key: "target_regency_name", width: 20 },
      {
        header: "Target Sub District",
        key: "target_sub_district_name",
        width: 20,
      },
      { header: "Target Village", key: "target_village_name", width: 20 },
      {
        header: "Target Transaction Count",
        key: "target_transaction_count",
        width: 22,
      }, // ⭐ NEW
      { header: "Similarity Score", key: "similarity_score", width: 16 },
    ]

    this.sheet2 = this.workbook.addWorksheet("Sheet 2 - Location IDs")
    this.sheet2.columns = [
      { header: "Source ID [Source]", key: "source_id", width: 12 },
      { header: "Source Province ID", key: "source_province_id", width: 18 },
      { header: "Source Regency ID", key: "source_regency_id", width: 18 },
      {
        header: "Source Sub District ID",
        key: "source_sub_district_id",
        width: 22,
      },
      { header: "Source Village ID", key: "source_village_id", width: 18 },
      {
        header: "Source Transaction Count",
        key: "source_transaction_count",
        width: 22,
      }, // ⭐ NEW
      { header: "Target ID [Target]", key: "target_id", width: 12 },
      { header: "Target Province ID", key: "target_province_id", width: 18 },
      { header: "Target Regency ID", key: "target_regency_id", width: 18 },
      {
        header: "Target Sub District ID",
        key: "target_sub_district_id",
        width: 22,
      },
      { header: "Target Village ID", key: "target_village_id", width: 18 },
      {
        header: "Target Transaction Count",
        key: "target_transaction_count",
        width: 22,
      }, // ⭐ NEW
      { header: "Similarity Score", key: "similarity_score", width: 16 },
    ]

    this.sheet1.getRow(1).font = { bold: true }
    this.sheet1.getRow(1).alignment = {
      horizontal: "center",
      vertical: "middle",
    }
    this.sheet2.getRow(1).font = { bold: true }
    this.sheet2.getRow(1).alignment = {
      horizontal: "center",
      vertical: "middle",
    }

    console.log(
      `✓ OptimizedExcelWriter initialized (buffer: ${this.bufferSize}, with transaction count and entity code)`
    )
  }

  async add(sheet1Row: any, sheet2Row: any): Promise<void> {
    this.batchBuffer1.push(sheet1Row)
    this.batchBuffer2.push(sheet2Row)

    if (this.batchBuffer1.length >= this.bufferSize) {
      await this.flush()
    }
  }

  async flush(): Promise<void> {
    if (this.batchBuffer1.length === 0) return

    const bufferLength = this.batchBuffer1.length

    for (const row of this.batchBuffer1) {
      const excelRow = this.sheet1.addRow(row)
      excelRow.commit()
    }

    for (const row of this.batchBuffer2) {
      const excelRow = this.sheet2.addRow(row)
      excelRow.commit()
    }

    this.totalWritten += bufferLength

    this.batchBuffer1.length = 0
    this.batchBuffer2.length = 0
    this.batchBuffer1 = []
    this.batchBuffer2 = []

    console.log(
      `  ✓ Flushed ${bufferLength} rows (Total: ${this.totalWritten})`
    )
  }

  getTotalWritten(): number {
    return this.totalWritten
  }

  async save(filePath: string): Promise<void> {
    console.log(`\n📝 Finalizing workbook...`)
    await this.flush()

    const sheet1RowCount = this.sheet1.rowCount - 1
    const sheet2RowCount = this.sheet2.rowCount - 1

    console.log(`  Sheet 1: ${sheet1RowCount} rows`)
    console.log(`  Sheet 2: ${sheet2RowCount} rows`)
    console.log(`  Expected: ${this.totalWritten} rows`)

    if (
      sheet1RowCount === this.totalWritten &&
      sheet2RowCount === this.totalWritten
    ) {
      console.log(`  ✅ Row count verification passed!`)
    } else {
      console.error(`  ⚠️  WARNING: Row count mismatch!`)
    }

    console.log(`\n💾 Writing to file: ${filePath}`)
    await this.workbook.xlsx.writeFile(filePath)
    console.log(`✓ File saved successfully!`)

    const stats = await fs.stat(filePath)
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2)
    console.log(`  File size: ${fileSizeMB} MB`)

    this.workbook = null
    this.sheet1 = null
    this.sheet2 = null
  }
}

/**
 * 🔥 Get entities from imun database and mark them as imun
 */
async function getImunEntities(
  limit: number | null,
  excludedEntityTagIds: number[],
  localityFilter: "province" | "regency" | null
): Promise<Entity[]> {
  console.log(`\n📍 Fetching entities from imun database...`)

  let query = getMigrationDB(1)
    .selectFrom("entities as e")
    .leftJoin("provinces as p", "p.id", "e.province_id")
    .leftJoin("regencies as r", "r.id", "e.regency_id")
    .leftJoin("sub_districts as s", "s.id", "e.sub_district_id")
    .select([
      "e.id",
      "e.name",
      "e.code",
      "p.name as province_name",
      "p.id as province_id",
      "r.name as regency_name",
      "r.id as regency_id",
      "s.name as sub_district_name",
      "s.id as sub_district_id",
    ])
    .where("e.deleted_at", "is", null)
    .innerJoin("entity_entity_tags as ett", "ett.entity_id", "e.id")
    .where("ett.entity_tag_id", "not in", excludedEntityTagIds)

  // Add locality filter if specified
  if (localityFilter) {
    if (localityFilter === "province") {
      query = query.where("e.province_id", "is not", null)
    } else if (localityFilter === "regency") {
      query = query.where("e.regency_id", "is not", null)
    }
  }

  query = query.orderBy("e.id")

  if (limit) {
    query = query.limit(limit)
  }

  const entities = await query.execute()
  console.log(`  ✓ Found ${entities.length} entities from imun database`)

  // Mark these entities as imun entities
  return entities.map(entity => ({ ...entity, source: 'imun' as 'imun' | 'smile5' }))
}

/**
 * 🔥 Get entities from smile5 database and mark them as smile5
 */
async function getSmile5Entities(
  limit: number | null,
  excludedEntityTagIds: number[],
  localityFilter: "province" | "regency" | null
): Promise<Entity[]> {
  console.log(`\n📍 Fetching entities from smile5 database...`)

  let query = db
    .selectFrom("entities as e")
    .leftJoin("locations as p", "p.id", "e.province_id")
    .leftJoin("locations as r", "r.id", "e.regency_id")
    .leftJoin("locations as s", "s.id", "e.sub_district_id")
    .leftJoin("locations as v", "v.id", "e.village_id")
    .select([
      "e.id",
      "e.name",
      "e.code",
      "p.name as province_name",
      "p.id as province_id",
      "r.name as regency_name",
      "r.id as regency_id",
      "s.name as sub_district_name",
      "s.id as sub_district_id",
      "v.name as village_name",
      "v.id as village_id",
    ])
    .where("e.deleted_at", "is", null)
    .where("e.entity_tag_id", "not in", excludedEntityTagIds)

  // Add locality filter if specified
  if (localityFilter) {
    if (localityFilter === "province") {
      query = query.where("e.province_id", "is not", null)
    } else if (localityFilter === "regency") {
      query = query.where("e.regency_id", "is not", null)
    }
  }

  query = query.orderBy("e.id")

  if (limit) {
    query = query.limit(limit)
  }

  const entities = await query.execute()
  console.log(`  ✓ Found ${entities.length} entities from smile5 database`)

  // Mark these entities as smile5 entities
  return entities.map(entity => ({ ...entity, source: 'smile5' as 'imun' | 'smile5' }))
}

/**
 * 🔥 Get transaction counts from imun database
 */
async function getImunTransactionCounts(
  entityIds: number[]
): Promise<Map<number, number>> {
  console.log(
    `  Fetching transaction counts for ${entityIds.length} imun entities...`
  )

  const countTransactionByIdEntity = await getMigrationDB(1)
    .selectFrom("transactions")
    .where("entity_id", "in", entityIds)
    .groupBy("entity_id")
    .select((eb) => ["entity_id", eb.fn.count("id").as("count")])
    .execute()

  // ⭐ NEW: Buat Map untuk lookup cepat
  const transactionCountMap = new Map<number, number>()
  countTransactionByIdEntity.forEach((row) => {
    transactionCountMap.set(row.entity_id, Number(row.count))
  })

  console.log(
    `  ✓ Imun transaction counts loaded (${transactionCountMap.size} entities with transactions)`
  )

  return transactionCountMap
}

/**
 * 🔥 Get transaction counts from smile5 database
 */
async function getSmile5TransactionCounts(
  entityIds: number[]
): Promise<Map<number, number>> {
  console.log(
    `  Fetching transaction counts for ${entityIds.length} smile5 entities...`
  )

  const countTransactionByIdEntity = await db
    .selectFrom("ws_transactions as t")
    .innerJoin("ws_entities as e", "e.id", "t.entity_id")
    .where("e.global_id", "in", entityIds)
    .groupBy("e.global_id")
    .select((eb) => [
      "e.global_id as entity_id",
      eb.fn.count("t.id").as("count"),
    ])
    .execute()

  // ⭐ NEW: Buat Map untuk lookup cepat
  const transactionCountMap = new Map<number, number>()
  countTransactionByIdEntity.forEach((row) => {
    transactionCountMap.set(row.entity_id, Number(row.count))
  })

  console.log(
    `  ✓ Smile5 transaction counts loaded (${transactionCountMap.size} entities with transactions)`
  )

  return transactionCountMap
}

/**
 * 🔥 COMPARE ENTITIES FROM COMBINED IMUN AND SMILE5 DATABASES
 */
async function runCombinedEntitiesComparison(
  model: any,
  writer: OptimizedExcelWriter | StreamingCSVWriter,
  limit: number | null,
  similarityThreshold: number,
  batchSize: number,
  excludedEntityTagIds: number[],
  localityFilter: "province" | "regency" | null
) {
  const memMonitor = new MemoryMonitor()

  console.log(`\n🌍 Running COMBINED ENTITIES COMPARISON`)
  console.log(`Combining entities from IMUN and SMILE5 databases and finding similarities`)

  const imunEntities = await getImunEntities(limit, excludedEntityTagIds, localityFilter)
  const smile5Entities = await getSmile5Entities(limit, excludedEntityTagIds, localityFilter)

  // Combine both entity sets
  const allEntities = [...imunEntities, ...smile5Entities]
  console.log(`\n${"=".repeat(70)}`)
  console.log(
    `Starting comparison across ${allEntities.length} total entities (${imunEntities.length} imun + ${smile5Entities.length} smile5)...`
  )
  console.log(`${"=".repeat(70)}\n`)

  // Get transaction counts for all entities from their respective databases
  const imunEntityIds = imunEntities.map((e) => e.id)
  const smile5EntityIds = smile5Entities.map((e) => e.id)

  const imunTransactionCountMap = await getImunTransactionCounts(imunEntityIds)
  const smile5TransactionCountMap = await getSmile5TransactionCounts(
    smile5EntityIds
  )

  // Generate embeddings for all entities
  console.log(`  Generating embeddings for all entities...`)
  const allEntitiesWithEmbeddings: EntityWithEmbedding[] = []

  for (let i = 0; i < allEntities.length; i += batchSize) {
    const batch = allEntities.slice(i, i + batchSize)
    const batchWithEmbeddings = await generateEmbeddingsBatch(model, batch)
    allEntitiesWithEmbeddings.push(...batchWithEmbeddings)

    // Clear batch reference
    batch.length = 0
  }

  console.log(`  ✓ Embeddings generated (${allEntitiesWithEmbeddings.length})`)

  // Calculate estimated total comparisons (n * (n-1) / 2)
  const estimatedTotalComparisons = (allEntitiesWithEmbeddings.length * (allEntitiesWithEmbeddings.length - 1)) / 2
  console.log(`  Estimated total comparisons: ${estimatedTotalComparisons.toLocaleString()}`)
  console.log(`  Comparing entities within combined set...`)

  let totalMatches = 0
  let totalComparisons = 0
  const totalEntities = allEntitiesWithEmbeddings.length
  const comparisonStartTime = Date.now()

  // Compare each entity with every other entity (excluding self-comparison)
  for (let i = 0; i < allEntitiesWithEmbeddings.length; i++) {
    const entityA = allEntitiesWithEmbeddings[i]
    if (!entityA) continue

    for (let j = i + 1; j < allEntitiesWithEmbeddings.length; j++) {
      const entityB = allEntitiesWithEmbeddings[j]
      if (!entityB) continue

      totalComparisons++

      const similarity = cosineSimilarity(
        entityA.embedding,
        entityB.embedding
      )

      if (similarity >= similarityThreshold) {
        // Determine transaction counts based on source
        const sourceTransactionCount = entityA.source === 'imun' 
          ? imunTransactionCountMap.get(entityA.id) || 0
          : smile5TransactionCountMap.get(entityA.id) || 0
        
        const targetTransactionCount = entityB.source === 'imun'
          ? imunTransactionCountMap.get(entityB.id) || 0
          : smile5TransactionCountMap.get(entityB.id) || 0

        await writer.add(
          {
            source_id: `${entityA.source}-${entityA.id}`,
            source_id_source: entityA.source,
            source_name: entityA.name || "",
            source_code: entityA.code || "",
            source_province_name: entityA.province_name || "",
            source_regency_name: entityA.regency_name || "",
            source_sub_district_name: entityA.sub_district_name || "",
            source_village_name: entityA.village_name || "",
            source_transaction_count: sourceTransactionCount,
            target_id: `${entityB.source}-${entityB.id}`,
            target_id_source: entityB.source,
            target_name: entityB.name || "",
            target_code: entityB.code || "",
            target_province_name: entityB.province_name || "",
            target_regency_name: entityB.regency_name || "",
            target_sub_district_name: entityB.sub_district_name || "",
            target_village_name: entityB.village_name || "",
            target_transaction_count: targetTransactionCount,
            similarity_score: similarity.toFixed(6),
          },
          {
            source_id: `${entityA.source}-${entityA.id}`,
            source_id_source: entityA.source,
            source_province_id: entityA.province_id ?? "",
            source_regency_id: entityA.regency_id ?? "",
            source_sub_district_id: entityA.sub_district_id ?? "",
            source_village_id: entityA.village_id ?? "",
            source_transaction_count: sourceTransactionCount,
            target_id: `${entityB.source}-${entityB.id}`,
            target_id_source: entityB.source,
            target_province_id: entityB.province_id ?? "",
            target_regency_id: entityB.regency_id ?? "",
            target_sub_district_id: entityB.sub_district_id ?? "",
            target_village_id: entityB.village_id ?? "",
            target_transaction_count: targetTransactionCount,
            similarity_score: similarity.toFixed(6),
          }
        )
        totalMatches++
      }
    }

    // Clear embedding after use
    if (entityA.embedding) {
      entityA.embedding.length = 0
      entityA.embedding = []
    }

    // Progress logging - show every 1000 entities or every 5% 
    if (i % 1000 === 0 || (i > 0 && i % Math.max(1, Math.floor(totalEntities / 20)) === 0)) {
      const progressPercent = ((i + 1) / totalEntities * 100).toFixed(2)
      const elapsedMs = Date.now() - comparisonStartTime
      const comparisonsPerSec = totalComparisons / (elapsedMs / 1000)
      const estimatedTimeRemaining = estimatedTotalComparisons > totalComparisons && comparisonsPerSec > 0
        ? ((estimatedTotalComparisons - totalComparisons) / comparisonsPerSec / 60).toFixed(2)
        : 'N/A'
      
      console.log(
        `  Progress: ${i + 1}/${totalEntities} (${progressPercent}%), ${totalMatches} matches found, ~${comparisonsPerSec.toFixed(2)} comparisons/sec, ~${estimatedTimeRemaining} min remaining`
      )
    }
  }

  // Clear all embeddings
  for (const entity of allEntitiesWithEmbeddings) {
    if (entity.embedding) {
      entity.embedding.length = 0
      entity.embedding = []
    }
  }

  console.log(`  ✓ Found ${totalMatches} matches`)
  console.log(
    `  Total comparisons: ${totalComparisons.toLocaleString()}, matches: ${totalMatches.toLocaleString()}`
  )

  // Flush writer
  await writer.flush()

  return { totalMatches, totalComparisons }
}

/**
 * 🔥 MAIN FUNCTION (COMBINED ENTITIES COMPARISON)
 */
export const populateNamingOfTheSameEntityImunVsSmile5 = async (
  limitEntities: number | null = null,
  localityFilter: "province" | "regency" | null = "regency",
  useStreamingCSV: boolean = false
) => {
  console.log(
    "\n🚀 Starting Combined Entity Similarity Detection (Imun + Smile5)..."
  )
  console.log(`   Limit Entities: ${limitEntities || "UNLIMITED"}`)
  console.log(
    `   Locality Filter: ${localityFilter ? localityFilter.toUpperCase() : "NONE"}`
  )
  console.log(
    `   Output Format: ${useStreamingCSV ? "CSV (Streaming)" : "Excel"}`
  )

  const LOCAL_CONFIG = {
    ...DEFAULT_CONFIG,
    LIMIT_ENTITIES: limitEntities,
    LOCALITY_FILTER: localityFilter,
    STREAM_TO_DISK: useStreamingCSV,
  }

  const startTime = new Date()
  const memMonitor = new MemoryMonitor()

  console.log(`\n${"=".repeat(70)}`)
  console.log("COMBINED ENTITY SIMILARITY DETECTION (IMUN + SMILE5)")
  console.log(`Started at: ${startTime.toLocaleString()}`)
  console.log(`${"=".repeat(70)}\n`)

  console.log("📋 CONFIGURATION:")
  console.log(`  Similarity Threshold: ${LOCAL_CONFIG.SIMILARITY_THRESHOLD}`)
  console.log(
    `  Limit Entities: ${LOCAL_CONFIG.LIMIT_ENTITIES?.toLocaleString() || "UNLIMITED"}`
  )
  console.log(
    `  Locality Filter: ${LOCAL_CONFIG.LOCALITY_FILTER?.toUpperCase() || "NONE"}`
  )
  console.log(`  Batch Size: ${LOCAL_CONFIG.BATCH_SIZE}`)
  console.log(`  Write Buffer: ${LOCAL_CONFIG.WRITE_BUFFER_SIZE}`)
  console.log(
    `  Stream to Disk: ${LOCAL_CONFIG.STREAM_TO_DISK ? "YES (CSV)" : "NO (Excel)"}`
  )

  try {
    await fs.mkdir(LOCAL_CONFIG.REPORTS_DIR, { recursive: true })

    // Count entities in both databases
    let imunCountQuery = getMigrationDB(1)
      .selectFrom("entities as e")
      .leftJoin("entity_entity_tags as ett", "ett.entity_id", "e.id")
      .leftJoin("provinces as p", "p.id", "e.province_id")
      .leftJoin("regencies as r", "r.id", "e.regency_id")
      .select(({ fn }) => [fn.count<number>("e.id").as("count")])
      .where("e.deleted_at", "is", null)
      .where("ett.entity_tag_id", "not in", LOCAL_CONFIG.EXCLUDED_ENTITY_TAG_IDS)

    // Add locality filter to count query if specified
    if (LOCAL_CONFIG.LOCALITY_FILTER) {
      if (LOCAL_CONFIG.LOCALITY_FILTER === "province") {
        imunCountQuery = imunCountQuery.where("e.province_id", "is not", null)
      } else if (LOCAL_CONFIG.LOCALITY_FILTER === "regency") {
        imunCountQuery = imunCountQuery.where("e.regency_id", "is not", null)
      }
    }

    if (limitEntities) {
      imunCountQuery = imunCountQuery.limit(limitEntities)
    }

    const imunCountResult = await imunCountQuery.executeTakeFirst()
    const imunTotalAvailable = Number(imunCountResult?.count) || 0

    let smile5CountQuery = db
      .selectFrom("entities as e")
      .leftJoin("locations as p", "p.id", "e.province_id")
      .leftJoin("locations as r", "r.id", "e.regency_id")
      .select(({ fn }) => [fn.count<number>("e.id").as("count")])
      .where("e.deleted_at", "is", null)
      .where("e.entity_tag_id", "not in", LOCAL_CONFIG.EXCLUDED_ENTITY_TAG_IDS)

    // Add locality filter to count query if specified
    if (LOCAL_CONFIG.LOCALITY_FILTER) {
      if (LOCAL_CONFIG.LOCALITY_FILTER === "province") {
        smile5CountQuery = smile5CountQuery.where("e.province_id", "is not", null)
      } else if (LOCAL_CONFIG.LOCALITY_FILTER === "regency") {
        smile5CountQuery = smile5CountQuery.where("e.regency_id", "is not", null)
      }
    }

    if (limitEntities) {
      smile5CountQuery = smile5CountQuery.limit(limitEntities)
    }

    const smile5CountResult = await smile5CountQuery.executeTakeFirst()
    const smile5TotalAvailable = Number(smile5CountResult?.count) || 0

    console.log(`\n📊 DATA SCOPE:`)
    console.log(
      `  Imun database - Total available: ${imunTotalAvailable.toLocaleString()}`
    )
    console.log(
      `  Smile5 database - Total available: ${smile5TotalAvailable.toLocaleString()}`
    )

    const imunToProcess = LOCAL_CONFIG.LIMIT_ENTITIES
      ? Math.min(LOCAL_CONFIG.LIMIT_ENTITIES, imunTotalAvailable)
      : imunTotalAvailable
    
    const smile5ToProcess = LOCAL_CONFIG.LIMIT_ENTITIES
      ? Math.min(LOCAL_CONFIG.LIMIT_ENTITIES, smile5TotalAvailable)
      : smile5TotalAvailable
      
    const totalToProcess = imunToProcess + smile5ToProcess

    console.log(
      `  Will process: ${imunToProcess.toLocaleString()} from imun + ${smile5ToProcess.toLocaleString()} from smile5 = ${totalToProcess.toLocaleString()} total entities`
    )

    if (imunTotalAvailable < 1 || smile5TotalAvailable < 1) {
      console.log("\n❌ Not enough entities in one or both databases to compare.")
      return
    }

    console.log(`\n🤖 MODE: CROSS-DATABASE COMPARISON`)

    // Load model
    console.log("\nLoading Universal Sentence Encoder model...")
    const model = await use.load()
    console.log("✓ Model loaded")

    memMonitor.report("after model load")

    // Setup writer
    const reportFileName = path.join(
      LOCAL_CONFIG.REPORTS_DIR,
      `entity_similarity_imun_vs_smile5_${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}`
    )

    let writer: OptimizedExcelWriter | StreamingCSVWriter

    if (LOCAL_CONFIG.STREAM_TO_DISK) {
      console.log(
        "\n📝 Using STREAMING CSV WRITER (memory efficient + transaction count)"
      )
      writer = new StreamingCSVWriter(reportFileName + ".xlsx")
      await writer.init()
    } else {
      console.log("\n📝 Using OPTIMIZED EXCEL WRITER (with transaction count)")
      writer = new OptimizedExcelWriter(LOCAL_CONFIG.WRITE_BUFFER_SIZE)
      await writer.init()
    }

    console.log(`\n${"=".repeat(70)}`)
    console.log("STARTING COMBINED ENTITIES PROCESSING...")
    console.log(`${"=".repeat(70)}\n`)

    const result = await runCombinedEntitiesComparison(
      model,
      writer,
      totalToProcess,
      LOCAL_CONFIG.SIMILARITY_THRESHOLD,
      LOCAL_CONFIG.BATCH_SIZE,
      LOCAL_CONFIG.EXCLUDED_ENTITY_TAG_IDS,
      LOCAL_CONFIG.LOCALITY_FILTER
    )

    console.log(`\n${"=".repeat(70)}`)
    console.log("COMBINED ENTITIES PROCESSING COMPLETE")
    console.log(`${"=".repeat(70)}\n`)

    console.log(`📊 RESULTS:`)
    console.log(
      `  Total Comparisons: ${result.totalComparisons.toLocaleString()}`
    )
    console.log(
      `  Total Matches Found: ${result.totalMatches.toLocaleString()}`
    )
    console.log(
      `  Match Rate: ${((result.totalMatches / result.totalComparisons) * 100).toFixed(4)}%`
    )

    memMonitor.report("after processing")

    let filesToUpload: string[] = []

    if (LOCAL_CONFIG.STREAM_TO_DISK) {
      // CSV files - close streams
      console.log("\n💾 Closing CSV files...")
      await (writer as StreamingCSVWriter).close()
      filesToUpload = (writer as StreamingCSVWriter).getFilePaths()

      console.log(`✓ CSV files created:`)
      for (const filePath of filesToUpload) {
        const stats = await fs.stat(filePath)
        const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2)
        console.log(`  - ${path.basename(filePath)} (${fileSizeMB} MB)`)
      }
    } else {
      // Excel file - save workbook
      const excelFilePath = reportFileName + ".xlsx"
      await (writer as OptimizedExcelWriter).save(excelFilePath)
      filesToUpload = [excelFilePath]
    }

    // ⚠️ CRITICAL: Clear writer reference
    writer = null as any

    // Upload to MinIO
    console.log("\n📤 Uploading to MinIO...")
    try {
      const minioClient = createMinioClientFromEnv()

      if (!minioClient) {
        console.log("⚠️  MinIO client not configured, skipping upload")
        console.log(`   Files saved locally: ${LOCAL_CONFIG.REPORTS_DIR}`)
      } else {
        const bucketName = process.env.MINIO_BUCKET_NAME || "reports"

        // Ensure bucket exists
        const bucketExists = await minioClient.bucketExists(bucketName)
        if (!bucketExists) {
          await minioClient.makeBucket(bucketName, "ap-southeast-3")
          console.log(`✓ Created bucket: ${bucketName}`)
        }

        // Upload each file
        for (const filePath of filesToUpload) {
          const fileName = path.basename(filePath)
          const contentType = filePath.endsWith(".csv")
            ? "text/csv"
            : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

          await minioClient.fPutObject(bucketName, fileName, filePath, {
            "Content-Type": contentType,
          })

          console.log(`  ✓ Uploaded: ${bucketName}/${fileName}`)

          // Delete local file after successful upload
          await fs.unlink(filePath)
          console.log(`  ✓ Deleted local file: ${fileName}`)
        }

        console.log(`\n✅ All files uploaded successfully to MinIO`)
      }
    } catch (uploadError) {
      console.error("\n❌ MinIO upload error:", uploadError)
      console.log(`   Files remain in: ${LOCAL_CONFIG.REPORTS_DIR}`)
      console.log(`   You can manually upload these files later`)
    }

    // Final summary
    const endTime = new Date()
    const durationMs = endTime.getTime() - startTime.getTime()
    const durationMin = (durationMs / 60000).toFixed(2)
    const durationHrs = (durationMs / 3600000).toFixed(2)

    console.log(`\n${"=".repeat(70)}`)
    console.log("✅ FINISHED SUCCESSFULLY")
    console.log(`${"=".repeat(70)}`)
    console.log(`  Started: ${startTime.toLocaleString()}`)
    console.log(`  Ended: ${endTime.toLocaleString()}`)
    console.log(`  Duration: ${durationHrs} hours (${durationMin} minutes)`)
    console.log(
      `  Total Comparisons: ${result.totalComparisons.toLocaleString()}`
    )
    console.log(`  Matches Found: ${result.totalMatches.toLocaleString()}`)
    console.log(
      `  Comparison Speed: ${(result.totalComparisons / (durationMs / 1000)).toFixed(2)} comparisons/sec`
    )
    console.log(`${"=".repeat(70)}\n`)

    memMonitor.report("final")
  } catch (error) {
    console.error("\n❌ ERROR OCCURRED:")
    console.error(error)

    if (error instanceof Error) {
      console.error("\nStack trace:")
      console.error(error.stack)
    }

    memMonitor.report("on error")

    throw error
  } finally {
    // Cleanup TensorFlow resources
    console.log("\n🧹 Cleaning up resources...")
    tf.disposeVariables()

    console.log("✓ Cleanup completed")
  }
}