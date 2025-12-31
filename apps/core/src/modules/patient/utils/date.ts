export const normalizeToYMD = (input: string | Date): string => {
  const dt = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(dt.getTime())) return String(input)

  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, "0")
  const d = String(dt.getDate()).padStart(2, "0")

  return `${y}-${m}-${d}`
}
