import crypto from "crypto";
import moment from "moment";
import momentTZ from "moment-timezone";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;
type NestedObject = {
  [key: string]: string | number | null | NestedObject | NestedObject[];
};

export function group<T extends Row, K extends keyof T>(
  rows: T[],
  field: K
): Record<T[K], T[]> {
  return rows.reduce(
    (acc, row) => {
      const key = row[field];
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(row);
      return acc;
    },
    {} as Record<T[K], T[]>
  );
}

export function associate<T extends Row, K extends keyof T>(
  rows: T[],
  field: K
): Record<T[K], T> {
  return rows.reduce(
    (acc, row) => {
      const key = row[field];
      acc[key] = row;
      return acc;
    },
    {} as Record<T[K], T>
  );
}

export function associateField<
  T extends Row,
  K extends keyof T,
  V extends keyof T,
>(rows: T[], field: K, valueField: V): Record<T[K], T[V]> {
  return rows.reduce(
    (acc, row) => {
      const key = row[field];
      acc[key] = row[valueField];
      return acc;
    },
    {} as Record<T[K], T[V]>
  );
}

export function collect<T extends Row, K extends keyof T>(
  rows: T[],
  ...fields: K[]
): Exclude<T[K], null>[] {
  return rows
    .flatMap((row) => fields.map((field) => row[field]))
    .filter((value): value is Exclude<T[K], null> => value !== null);
}

export function merge<T>(...arrays: T[][]): T[] {
  return Array.from(new Set(arrays.flat()));
}

export function pick<T extends Row, K extends keyof T>(
  row: T,
  columns: K[]
): Partial<Pick<T, K>> {
  const selectedColumns: Partial<T> = {};

  columns.forEach((column) => {
    if (column in row) {
      selectedColumns[column] = row[column];
    }
  });

  return selectedColumns as Partial<Pick<T, K>>;
}

export function omit<T extends object, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result;
}

export function differ<T>(array1: T[], array2: T[]): T[] {
  return array1.filter((item) => !array2.includes(item));
}

export function consist<T>(array1: T[], array2: T[]): T[] {
  return array1.filter((item) => array2.includes(item));
}

export function isStringNumbers(stringOfNumbers: string): boolean {
  // validation regex for = '1,2,3,4'
  const regexWorkspaceIDs = /^(?=.*\d)[0-9,\s]*$/;

  return regexWorkspaceIDs.test(stringOfNumbers);
}

export function transformStringNumbersToArrayNumbers(
  stringOfNumbers: string
): number[] {
  if (!isStringNumbers(stringOfNumbers)) {
    return [];
  }

  return stringOfNumbers
    .split(/[\s;,|]+/)
    .map((v) => parseInt(v.trim(), 10))
    .filter((v) => !isNaN(v));
}

export function transformStringNumbersToArrayStringNumbers(
  stringOfNumbers: string
): string[] {
  if (!isStringNumbers(stringOfNumbers)) {
    return [];
  }

  return stringOfNumbers
    .split(/[\s;,|]+/)
    .map((item) => item.trim())
    .filter((item) => item !== "");
}

export function hasWhiteSpace(str: string) {
  return str == str.trim();
}

export function getLabelByKey<T, V>(obj: T, value: V) {
  let key = "";
  key = Object.keys(obj!).find((idx) => obj[idx] === value)!;
  if (key) {
    key = key.replace("_", " ");
  }
  return key;
}

export function containsOnlyUnderscoresPeriod(str: string) {
  return /^[a-zA-Z0-9_.-]*$/.test(str);
}

export function isDateMoreThanNow(date: Date) {
  const now = moment().format("YYYY-MM-DD");
  const convertDate = moment(date).format("YYYY-MM-DD");

  if (convertDate > now) {
    return true;
  }
  return false;
}

/**
 * Format date with timezone and format as "YYYY-MM-DD HH:mm:ss"
 * @param date - Date to convert (assumes UTC if string without timezone info)
 * @param timezone - Target timezone (e.g., "Asia/Jakarta"). Defaults to UTC if not specified
 * @returns Formatted date string in 24-hour format or "-" if date is null/undefined
 */
export function formatDateWithTimezone(
  date: Date | string | null | undefined,
  timezone?: string
): string {
  if (!date) return "-";

  const targetTimezone = timezone || "UTC";
  const momentDate =
    typeof date === "string" ? momentTZ.utc(date) : momentTZ(date);

  return momentDate.tz(targetTimezone).format("YYYY-MM-DD HH:mm:ss");
}

export function convertToBoolean(
  input: string | number | null | undefined
): boolean {
  if (input === null || input === undefined || Number.isNaN(input)) {
    return false;
  }

  if (typeof input === "string") {
    return input.toLowerCase() === "true" || input === "1";
  }

  if (typeof input === "number") {
    return input !== 0;
  }

  return false;
}

export function getDefaultNumber(
  value: number | string | undefined | null
): number {
  if (value === undefined || value === null || isNaN(Number(value))) {
    return 0;
  }
  return Number(value);
}

export function flattenToNestedObject<T extends Row>(
  dataArray: T[]
): NestedObject[] {
  return dataArray.map((data) => {
    const result: NestedObject = {};

    for (const key in data) {
      const keys = key.split(".");
      let current: NestedObject | NestedObject[] = result;

      keys.forEach((k, index) => {
        if (index === keys.length - 1) {
          (current as NestedObject)[k] = data[key] as
            | string
            | number
            | NestedObject
            | NestedObject[]
            | null;
        } else {
          if (!(k in current)) {
            current[k] = isNaN(Number(keys[index + 1])) ? {} : [];
          }
          current = current[k] as NestedObject | NestedObject[];
        }
      });
    }

    return result;
  });
}

export function getUniqueIdsFromFields<T extends Row, K extends keyof T>(
  items: T[],
  ...fields: K[]
): number[] {
  return [
    ...new Set(
      fields.flatMap((field) =>
        items
          .map((item) => item[field] as unknown as number | null | undefined)
          .filter(Boolean)
      )
    ),
  ].filter((id): id is number => id !== null && id !== undefined);
}

export function formatPeriodName(
  month: number | null,
  year: number | null,
  language = "en"
): string | null {
  if (!month || !year) return null;
  const formatter = new Intl.DateTimeFormat(language, {
    month: "long",
    year: "numeric",
  });
  return formatter.format(new Date(year, month - 1));
}

export const round = (value: number, decimal: number = 2) => {
  if (!value) return 0;
  if (value === 0) return 0;
  if (isNaN(value)) return 0;
  return Number(value.toFixed(decimal));
};

export const cleanSheetName = (str: string) =>
  str
    .replace(/[\\/*[\]:?]/g, " ")
    .slice(0, 30)
    .trim();

export async function* mapAsyncIterable<T, R>(
  iterable: AsyncIterable<T>,
  fn: (item: T, index: number) => Promise<R> | R
): AsyncIterableIterator<R> {
  let index = 0;
  for await (const item of iterable) {
    yield await fn(item, index++);
  }
}

interface EventIDOptions {
  length?: number;
  includeUppercase?: boolean;
  includeLowercase?: boolean;
  includeNumbers?: boolean;
}

export const generateEventCode = async (options: EventIDOptions = {}) => {
  const {
    length = 10,
    includeUppercase = true,
    includeLowercase = true,
    includeNumbers = true,
  } = options;

  let characters = "";

  if (includeUppercase) characters += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (includeLowercase) characters += "abcdefghijklmnopqrstuvwxyz";
  if (includeNumbers) characters += "0123456789";

  if (characters.length === 0) {
    throw new Error("At least one character set must be included.");
  }

  let eventID = "";
  const values = new Uint32Array(length ?? 10);
  if (values && values?.length > 0) {
    crypto.getRandomValues(values);
    for (let i = 0; i < length; i++) {
      eventID += characters[values[i] % characters.length];
    }
  } else {
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      eventID += characters[randomIndex];
    }
  }

  return eventID;
};

export const sleep = async (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Parse comma-separated string of IDs into array of numbers.
 * Filters out non-finite numbers and returns undefined if empty.
 */
export function parseCommaSeparatedIds(
  value: string | undefined | null
): number[] | undefined {
  if (!value?.trim()) return undefined;
  const ids = value.split(",").map(Number).filter(Number.isFinite);
  return ids.length ? ids : undefined;
}

/**
 * Preprocess value to number for schema validation.
 * Returns undefined for null/empty, parsed int for strings, or the number itself.
 */
export function preprocessNumber(value: unknown): number | undefined {
  if (value === null || value === "") return undefined;
  if (typeof value === "string") return parseInt(value, 10);
  if (typeof value === "number") return value;
  return undefined;
}
