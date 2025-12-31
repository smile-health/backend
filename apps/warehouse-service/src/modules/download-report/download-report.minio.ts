import { createMinioClientFromEnv } from "@smile/lib/minio.js"
import env from "../../config/env.js"
import { CustomContext } from "@smile/lib/types/context.js"
import { DB } from "@/common/infrastructure/database/types/db.js"
import {
  getCurrentMonthYear,
  getNextMonthAndYear,
} from "./download-report.util.js"
import { DownloadReportRepository } from "./download-report.repository.js"
import { DownloadReportQuery } from "./download-report.query.js"
import { Context } from "hono"
import crypto from "crypto"
import { parseStringPromise } from "xml2js"
import { createReadStream, statSync } from "fs"

const DEFAULT_BUCKET = env.EXPORT_EXCEL_BUCKET_NAME || "smile-platform"
const MINIO_PART_SIZE = env.MINIO_PART_SIZE || 10 // 10MB

/**
 * Upload a file buffer to MinIO.
 */

// Utility: stream ke string
async function streamToString(stream: NodeJS.ReadableStream) {
  return new Promise<string>((resolve, reject) => {
    let data = ""
    stream.on("data", (chunk) => (data += chunk))
    stream.on("end", () => resolve(data))
    stream.on("error", reject)
  })
}

// Inisiasi multipart + generate presigned URLs
async function createMultipartPresignedUrls(
  client,
  bucket: string,
  objectName: string,
  partCount: number
) {
  const res = await client.makeRequestAsync({
    method: "POST",
    bucketName: bucket,
    objectName,
    query: "uploads",
  })

  const xml = await streamToString(res)
  const parsed = await parseStringPromise(xml)
  const uploadId = parsed.InitiateMultipartUploadResult.UploadId[0]

  const urls: { partNumber: number; url: string }[] = []
  for (let partNumber = 1; partNumber <= partCount; partNumber++) {
    const url = await client.presignedUrl(
      "PUT",
      bucket,
      objectName,
      24 * 60 * 60,
      {
        uploadId,
        partNumber,
      }
    )
    urls.push({ partNumber, url })
  }

  return { uploadId, urls }
}

// Selesaikan multipart upload
async function completeMultipartUpload(
  client,
  bucketName,
  objectName,
  uploadId,
  parts
) {
  // Pastikan part diurutkan
  parts.sort((a, b) => a.partNumber - b.partNumber)

  // Pastikan ETag tidak double-quote ganda
  const xmlPayload =
    "<CompleteMultipartUpload>" +
    parts
      .map(
        (p) =>
          `<Part><PartNumber>${p.partNumber}</PartNumber><ETag>"${p.eTag.replace(/"/g, "")}"</ETag></Part>`
      )
      .join("") +
    "</CompleteMultipartUpload>"

  const res = await client.makeRequestAsync(
    {
      method: "POST",
      bucketName,
      objectName,
      query: `uploadId=${uploadId}`,
    },
    xmlPayload,
    [200],
    ""
  )

  return await streamToString(res)
}

// verify upload integrity
async function verifyUploadByFile(client, bucket, objectName, filePath) {
  const fileHash = crypto.createHash("sha256")
  const remoteHash = crypto.createHash("sha256")

  const fileDigestPromise = new Promise<string>((resolve, reject) => {
    createReadStream(filePath)
      .on("data", (chunk) => fileHash.update(chunk))
      .on("end", () => resolve(fileHash.digest("hex")))
      .on("error", reject)
  })

  const remoteDigestPromise = new Promise<string>((resolve, reject) => {
    client.getObject(bucket, objectName).then((downloadStream) => {
      downloadStream
        .on("data", (chunk) => remoteHash.update(chunk))
        .on("end", () => resolve(remoteHash.digest("hex")))
        .on("error", reject)
    })
  })

  const [fileDigest, remoteDigest] = await Promise.all([
    fileDigestPromise,
    remoteDigestPromise,
  ])

  return fileDigest === remoteDigest
}

// Fungsi utama
export async function uploadFileToMinio(
  client,
  objectName: string,
  filePath: string, // 📂 path file lokal
  bucketName = DEFAULT_BUCKET,
  partSizeMB = MINIO_PART_SIZE
) {
  await ensureBucketExists(client, bucketName)
  const partSize = partSizeMB * 1024 * 1024

  // Cek ukuran file
  const stats = statSync(filePath)
  const totalSize = stats.size
  const partCount = Math.ceil(totalSize / partSize)

  // Pastikan bucket ada
  const exists = await client.bucketExists(bucketName).catch(() => false)
  if (!exists) await client.makeBucket(bucketName)

  // Buat presigned URL
  const { uploadId, urls } = await createMultipartPresignedUrls(
    client,
    bucketName,
    objectName,
    partCount
  )

  // Baca file stream per part
  const stream = createReadStream(filePath, { highWaterMark: partSize })
  let partNumber = 0
  const partsMeta: { partNumber: number; eTag: string }[] = []

  for await (const chunk of stream) {
    const urlObj = urls[partNumber]
    if (!urlObj) {
      throw new Error(`URL for part ${partNumber + 1} is undefined`)
    }
    const { url } = urlObj
    const res = await fetch(url, { method: "PUT", body: chunk })
    if (!res.ok)
      throw new Error(`Upload part ${partNumber + 1} gagal: ${res.statusText}`)

    const eTag = res.headers.get("ETag")?.replace(/"/g, "") || ""
    partsMeta.push({ partNumber: partNumber + 1, eTag })
    console.log(`✅ [MINIO] Uploaded part ${partNumber + 1}`)
    partNumber++
  }

  // Selesaikan upload
  await completeMultipartUpload(
    client,
    bucketName,
    objectName,
    uploadId,
    partsMeta
  )
  console.log(`🎉 [MINIO] File uploaded to MinIO: ${bucketName}/${objectName}`)

  // Info size
  const stat = await client.statObject(bucketName, objectName)
  const fileSizeMB = (stat.size / (1024 * 1024)).toFixed(2)
  console.log("📏 [MINIO] File size:", fileSizeMB, "MB")

  // ⚠️ Verify tanpa full buffer (lebih hemat RAM)
  const isValid = await verifyUploadByFile(
    client,
    bucketName,
    objectName,
    filePath
  )
  console.log(isValid ? "✅ [MINIO] File is Valid" : "❌ [MINIO] File corrupt")
}

/**
 * Download a file buffer from MinIO.
 */
export const downloadFileFromMinio = async (
  objectName: string,
  bucketName = DEFAULT_BUCKET
): Promise<Buffer> => {
  const client = getMinioClient()

  const stream = await client.getObject(bucketName, objectName)

  return await streamToBuffer(stream)
}

/**
 * Generate a presigned download URL from MinIO.
 */
export const getPresignedUrlFromMinio = async (
  objectName: string,
  expiresSeconds = 3600,
  bucketName = DEFAULT_BUCKET
): Promise<string> => {
  const client = getMinioClient()

  const url = await client.presignedGetObject(
    bucketName,
    objectName,
    expiresSeconds
  )
  return url
}

/**
 * Delete a file from MinIO.
 */
export const deleteFileFromMinio = async (
  client,
  objectName: string,
  bucketName = DEFAULT_BUCKET
): Promise<void> => {
  const exists = await client.bucketExists(bucketName)
  if (!exists) {
    throw new Error(`❌ [MINIO] Bucket "${bucketName}" does not exist`)
  }

  await client.removeObject(bucketName, objectName)

  console.log(`🗑️  [MINIO] Deleted from MinIO: ${bucketName}/${objectName}`)
}

// === Internal Helper ===

const getMinioClient = () => {
  const client = createMinioClientFromEnv()
  if (!client) {
    throw new Error("❌ [MINIO] Failed to create MinIO client")
  }
  return client
}

const ensureBucketExists = async (
  client,
  bucketName: string
): Promise<void> => {
  const exists = await client.bucketExists(bucketName)
  if (!exists) {
    console.log(`🪣 [MINIO] Creating bucket: ${bucketName}`)
    await client.makeBucket(bucketName)
  }
}

const streamToBuffer = async (
  stream: NodeJS.ReadableStream
): Promise<Buffer> => {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

export const UploadExportToMinio = async (
  c: CustomContext<DB>,
  programId: number,
  filePath: string,
  lang: string,
  code: string,
  category_id: number,
  inputMonth?: number,
  inputYear?: number
) => {
  const downloadReportRepo = new DownloadReportRepository(
    new DownloadReportQuery()
  )
  let { month, year } = getCurrentMonthYear()
  // code with next month or year
  if ([53, 54, 55].includes(Number(code))) {
    const dataNext = getNextMonthAndYear(month, year)
    month = dataNext.month
    year = dataNext.year
  }

  if (inputMonth && inputYear) {
    month = inputMonth
    year = inputYear
  }

  const lastExportId = await downloadReportRepo.getLastIdReportLogs(
    c as Context,
    Number(code),
    programId,
    lang,
    inputMonth,
    inputYear
  )

  const exportId = await downloadReportRepo.saveExportLog(c, {
    code: code,
    export_category_id: category_id,
    program_id: programId,
    month,
    year,
    lang,
  })

  // Upload
  if (filePath) {
    const client = getMinioClient()
    await uploadFileToMinio(
      client,
      `reports/${lang}_${exportId}_download-report.name.${code}.zip`,
      filePath
    )
    if (lastExportId) {
      await downloadReportRepo.softDeleteExportLog(c, lastExportId.id)
      await deleteExportFromMinio(client, lang, lastExportId.id, code)
    }
  } else {
    throw new Error("❌ [MINIO] Failed to generate Excel buffer for upload.")
  }
}

export const deleteExportFromMinio = async (
  client,
  lang: string,
  exportId: number,
  code: string
): Promise<void> => {
  const objectName = `reports/${lang}_${exportId}_download-report.name.${code}.zip`
  await deleteFileFromMinio(client, objectName)
}
