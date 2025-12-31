export const createCountMap = <T extends { target_group_id?: number | null; count: number | string | bigint }>(
  counts: T[]
): Map<number, number> => {
  const countMap = new Map<number, number>()
  counts.forEach((row) => {
    if (row.target_group_id !== null && row.target_group_id !== undefined) {
      countMap.set(row.target_group_id, Number(row.count))
    }
  })
  return countMap
}

export const createCountRecord = <T extends { target_group_id?: number | null; count: number | string | bigint }>(
  counts: T[]
): Record<number, number> => {
  const record: Record<number, number> = {}
  counts.forEach((item) => {
    if (item.target_group_id !== null && item.target_group_id !== undefined) {
      record[item.target_group_id] = Number(item.count)
    }
  })
  return record
}
