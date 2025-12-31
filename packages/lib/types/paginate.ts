import { z } from "zod";

export const LIST_PAGINATION = [10, 25, 50, 100];

export interface IPaginationParams {
  page: number;
  paginate: number;
}

export const PaginationQueriesSchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? Number(val) : 1))
    .refine((v) => !isNaN(v!) && v > 0, { message: "invalid page param" }),
  paginate: z
    .string()
    .optional()
    .transform((val) => (val ? Number(val) : 50))
    .refine((v) => !isNaN(v!) && v > 0 && LIST_PAGINATION.includes(v), {
      message: "invalid paginate param",
    }),
  offset: z.number().default(0),
  keyword: z
    .string()
    .max(255, { message: "MAX_LIMIT_CHARACTER_IS_255" })
    .optional(),
  last_sort_value: z.string().optional(),
  status: z.enum(["0", "1"], { message: "INVALID REQUEST STATUS" }).optional(),
});

export interface IPaginatedResponse<T> {
  page: number;
  item_per_page: number;
  total_item: number;
  total_page: number;
  list_pagination: number[];
  data: T[];
}

export class PaginatedResponse<T> implements IPaginatedResponse<T> {
  last_sort_value?: string[];
  page: number;
  item_per_page: number;
  total_item: number;
  total_page: number;
  list_pagination: number[];
  data: T[];

  constructor(
    req: IPaginationParams,
    data: T[] = [],
    total: number = 0,
    last_sort_value?: string[]
  ) {
    this.last_sort_value = last_sort_value;
    this.page = req.page;
    this.item_per_page = req.paginate;
    this.total_item = total;
    this.total_page = Math.ceil(total / req.paginate);
    this.list_pagination = LIST_PAGINATION;
    this.data = data;
  }
}
