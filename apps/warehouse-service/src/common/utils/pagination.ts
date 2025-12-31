/**
 * Calculate pagination metadata
 * Consolidated from order-response, order-difference, and consumption-supply modules
 */
export function calculatePagination(
  total: number,
  page: number,
  itemsPerPage: number
) {
  const totalPages = Math.ceil(total / itemsPerPage)

  return {
    page,
    item_per_page: itemsPerPage,
    total_item: total,
    total_page: totalPages,
    list_pagination: [10, 25, 50, 100],
  }
}
