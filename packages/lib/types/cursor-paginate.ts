import { z } from "zod";

export const LIST_PAGINATION = [10, 25, 50, 100];

export interface ICursorPaginationParams {
  paginate: number;
  cursor?: string;
}

export const CursorPaginationQueriesSchema = z.object({
  paginate: z
    .string()
    .optional()
    .transform((val) => (val ? Number(val) : 50))
    .refine((v) => !isNaN(v!) && v > 0 && LIST_PAGINATION.includes(v), {
      message: "invalid paginate param",
    }),
  cursor: z
    .string()
    .optional()
    .describe("Base64 encoded cursor for pagination"),
  keyword: z
    .string()
    .max(255, { message: "MAX_LIMIT_CHARACTER_IS_255" })
    .optional(),
  status: z.enum(["0", "1"], { message: "INVALID REQUEST STATUS" }).optional(),
});

export interface ICursorPaginatedResponse<T> {
  paginate: number;
  has_next_page: boolean;
  has_previous_page: boolean;
  next_cursor?: string;
  previous_cursor?: string;
  total_count?: number;
  data: T[];
}

export class CursorPaginatedResponse<T> implements ICursorPaginatedResponse<T> {
  paginate: number;
  has_next_page: boolean;
  has_previous_page: boolean;
  next_cursor?: string;
  previous_cursor?: string;
  total_count?: number;
  data: T[];

  constructor(
    req: ICursorPaginationParams,
    data: T[] = [],
    hasNextPage: boolean = false,
    hasPreviousPage: boolean = false,
    nextCursor?: string,
    previousCursor?: string,
    totalCount?: number
  ) {
    this.paginate = req.paginate;
    this.has_next_page = hasNextPage;
    this.has_previous_page = hasPreviousPage;
    this.next_cursor = nextCursor;
    this.previous_cursor = previousCursor;
    this.total_count = totalCount;
    this.data = data;
  }
}

// Utility functions for cursor encoding/decoding
export class CursorUtils {
  /**
   * Encode cursor data to base64 string
   */
  static encodeCursor(data: Record<string, any>): string {
    return Buffer.from(JSON.stringify(data)).toString('base64');
  }

  /**
   * Decode base64 cursor string to data object
   */
  static decodeCursor(cursor: string): Record<string, any> {
    try {
      return JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
    } catch (error) {
      throw new Error('Invalid cursor format');
    }
  }

  /**
   * Create cursor from transaction data
   */
  static createTransactionCursor(transactionId: number, createdAt: Date): string {
    return this.encodeCursor({
      id: transactionId,
      created_at: createdAt.toISOString()
    });
  }

  /**
   * Parse transaction cursor
   */
  static parseTransactionCursor(cursor: string): { id: number; created_at: string } {
    const decoded = this.decodeCursor(cursor);
    return {
      id: decoded.id,
      created_at: decoded.created_at
    };
  }
}