import { doDecrypt } from "./transaction.encryption.js"

export const normalizeToYMD = (input: string | Date): string => {
  const dt = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(dt.getTime())) return String(input)
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, "0")
  const d = String(dt.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export const parseDecryptedDate = (
  enc: string | null | undefined
): Date | null => {
  const dec = doDecrypt(enc || "")
  if (!dec || dec === "-") return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(dec)) {
    const parts = dec.split("-")
    if (parts.length === 3) {
      const y = Number(parts[0])
      const m = Number(parts[1])
      const d = Number(parts[2])
      const dt = new Date(y, m - 1, d)
      return Number.isNaN(dt.getTime()) ? null : dt
    }
    return null
  }
  const dt = new Date(dec)
  return Number.isNaN(dt.getTime()) ? null : dt
}

export const formatDateYMD = (dt: Date | null): string => {
  if (!dt) return ""
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, "0")
  const d = String(dt.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export const diffYears = (birth: Date | null, asOf: Date | null): number => {
  if (!birth || !asOf) return 0
  let years = asOf.getFullYear() - birth.getFullYear()
  const m = asOf.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && asOf.getDate() < birth.getDate())) years--
  return years < 0 ? 0 : years
}
