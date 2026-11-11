import { TFunction } from "i18next";
import { z, ZodError } from "zod";

type ZodIssue = z.core.$ZodIssue;

// zod 4 tidak lagi menaruh `received` di issue. Nilai input baru ikut kalau
// parse dipanggil dengan `{ reportInput: true }` (lihat PARSE_OPTIONS).
// Tanpa itu, fallback ke pesan default "..., received undefined".
export const PARSE_OPTIONS = { reportInput: true } as const;

const hasInput = (issue: ZodIssue): issue is ZodIssue & { input: unknown } =>
  Object.prototype.hasOwnProperty.call(issue, "input");

export const isMissing = (issue: ZodIssue): boolean => {
  if (hasInput(issue)) return issue.input === undefined;
  return (
    issue.message === "Required" || /received undefined$/.test(issue.message)
  );
};

// Nama tipe di zod 4 yang di v3 bernama lain; kunci terjemahan tetap pakai nama v3.
const V3_EXPECTED: Record<string, string> = {
  record: "object",
  tuple: "array",
  int: "number",
};

// Tipe input versi v3 (ZodParsedType), dipakai di teks "Expected X, received Y".
const v3ParsedType = (input: unknown): string => {
  if (input === null) return "null";
  if (Array.isArray(input)) return "array";
  if (input instanceof Date) return "date";
  if (input instanceof Map) return "map";
  if (input instanceof Set) return "set";
  if (input instanceof Promise) return "promise";
  if (typeof input === "number") return Number.isNaN(input) ? "nan" : "number";
  return typeof input;
};

// z.number().int() dengan angka pecahan: v4 melapor invalid_type expected "int",
// v3 melapor expected "integer" received "float".
const isFloatForInt = (issue: ZodIssue): boolean =>
  issue.code === "invalid_type" &&
  issue.expected === "int" &&
  ((hasInput(issue) && typeof issue.input === "number") ||
    issue.message === "Expected integer, received float");

export const expectedType = (issue: ZodIssue): string => {
  if (issue.code !== "invalid_type") return "";
  if (isFloatForInt(issue)) return "integer";
  const name = String(issue.expected);
  return V3_EXPECTED[name] ?? name;
};

// Pesan default zod 3 untuk issue yang teksnya berubah di zod 4. Dipasang lewat
// z.config({ customError }), yang hanya dipakai kalau schema tidak punya pesan
// sendiri, jadi pesan custom tidak ikut berubah.
const V3_FORMAT_MESSAGES: Record<string, string> = {
  email: "Invalid email",
  url: "Invalid url",
  uuid: "Invalid uuid",
  guid: "Invalid uuid",
  date: "Invalid date",
  datetime: "Invalid datetime",
  time: "Invalid time",
  regex: "Invalid",
};

type RawIssue = z.core.$ZodRawIssue;

const v3Value = (value: unknown): string =>
  typeof value === "string" ? `'${value}'` : String(value);

const v3SizeMessage = (
  issue: RawIssue & { code: "too_small" | "too_big" },
): string | undefined => {
  const small = issue.code === "too_small";
  const bound = small
    ? (issue as { minimum: number | bigint }).minimum
    : (issue as { maximum: number | bigint }).maximum;
  const exact = (issue as { exact?: boolean }).exact;
  const inclusive = (issue as { inclusive?: boolean }).inclusive;
  switch (issue.origin) {
    case "string":
    case "array": {
      const noun = issue.origin === "string" ? "String" : "Array";
      const unit = issue.origin === "string" ? "character(s)" : "element(s)";
      if (exact) return `${noun} must contain exactly ${bound} ${unit}`;
      const word = small
        ? inclusive
          ? "at least"
          : "over"
        : inclusive
          ? "at most"
          : "under";
      return `${noun} must contain ${word} ${bound} ${unit}`;
    }
    case "number":
    case "bigint": {
      const noun = issue.origin === "number" ? "Number" : "BigInt";
      if (exact) return `${noun} must be exactly ${bound}`;
      const word = small
        ? inclusive
          ? "greater than or equal to"
          : "greater than"
        : inclusive
          ? "less than or equal to"
          : "less than";
      return `${noun} must be ${word} ${bound}`;
    }
    default:
      return undefined;
  }
};

export const v3DefaultMessage = (issue: RawIssue): string | undefined => {
  switch (issue.code) {
    case "invalid_type": {
      if (issue.input === undefined) return "Required";
      if (issue.input instanceof Date) return "Invalid date";
      if (issue.expected === "int" && typeof issue.input === "number") {
        return "Expected integer, received float";
      }
      const expected = V3_EXPECTED[issue.expected] ?? issue.expected;
      return `Expected ${expected}, received ${v3ParsedType(issue.input)}`;
    }
    case "too_small":
    case "too_big":
      return v3SizeMessage(issue);
    case "invalid_value": {
      const type = (issue.inst as { _zod?: { def?: { type?: string } } })?._zod
        ?.def?.type;
      if (type === "literal" && issue.values.length === 1) {
        return `Invalid literal value, expected ${JSON.stringify(issue.values[0])}`;
      }
      if (type === "enum") {
        const options = issue.values.map(v3Value).join(" | ");
        return `Invalid enum value. Expected ${options}, received '${String(issue.input)}'`;
      }
      return undefined;
    }
    case "unrecognized_keys": {
      const keys = issue.keys.map((key) => `'${key}'`).join(", ");
      return `Unrecognized key(s) in object: ${keys}`;
    }
    case "invalid_format":
      return V3_FORMAT_MESSAGES[issue.format];
    default:
      return undefined;
  }
};

z.config({ customError: v3DefaultMessage });

// v3 punya kode invalid_date untuk objek Date yang tidak valid; v4 melaporkannya
// sebagai invalid_type. translateError memperlakukannya seperti v3 (cabang default).
export const isInvalidDate = (issue: ZodIssue): boolean =>
  issue.code === "invalid_type" &&
  ((hasInput(issue) && issue.input instanceof Date) ||
    issue.message === "Invalid date");

// Issue yang di v3 menghentikan parsing (status "aborted"). Selain ini, v3
// tetap menjalankan check berikutnya (status "dirty"). .int() termasuk check
// biasa di v3, sedangkan v4 melaporkannya sebagai invalid_type.
const isFatal = (issue: ZodIssue): boolean =>
  (issue.code === "invalid_type" && !isFloatForInt(issue)) ||
  issue.code === "invalid_value" ||
  issue.code === "invalid_union";

// v3: kalau semua opsi union gagal tapi ada opsi yang hanya gagal di check,
// issue opsi itu yang dilaporkan, bukan invalid_union.
const expandUnion = (issue: ZodIssue): ZodIssue[] => {
  // v3 melaporkan error key record / elemen map-set langsung di path-nya;
  // v4 membungkusnya dalam invalid_key / invalid_element.
  if (
    (issue.code === "invalid_key" || issue.code === "invalid_element") &&
    "issues" in issue
  ) {
    const inner = (issue as { issues: ZodIssue[] }).issues;
    return inner.flatMap((child) =>
      expandUnion({
        ...child,
        path: [...issue.path, ...child.path],
      } as ZodIssue),
    );
  }
  if (issue.code !== "invalid_union" || !("errors" in issue)) return [issue];
  const branches = (issue as { errors: ZodIssue[][] }).errors;
  const dirty = branches.find(
    (branch) => branch.length > 0 && !branch.some(isFatal),
  );
  if (!dirty) return [issue];
  return dirty.map((inner) => ({
    ...inner,
    path: [...issue.path, ...inner.path],
  })) as ZodIssue[];
};

// zod 3 berhenti di error tipe; zod 4 masih menjalankan cek panjang (min/max)
// pada input yang tipenya salah. Buang issue lanjutan di path yang sudah punya
// error tipe supaya pesan validasi sama dengan v3.
export const v3Issues = <T extends ZodIssue>(issues: readonly T[]): T[] => {
  const expanded = issues.flatMap((issue) => expandUnion(issue)) as T[];
  const pathKey = (issue: ZodIssue) => issue.path.map(String).join("\u0000");
  const typeFailed = new Set(
    expanded
      .filter((issue) => issue.code === "invalid_type" && !isFloatForInt(issue))
      .map(pathKey),
  );
  // .nonempty().min(1) menghasilkan dua issue identik di v4, satu di v3.
  const seen = new Set<string>();
  return expanded.filter((issue) => {
    const path = pathKey(issue);
    const isTypeError = issue.code === "invalid_type" && !isFloatForInt(issue);
    if (!isTypeError && typeFailed.has(path)) return false;
    const key = `${path}|${issue.code}|${issue.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const receivedValue = (issue: ZodIssue): string | undefined => {
  if (!hasInput(issue)) return undefined;
  return String(issue.input);
};

export const formatErrors = (
  error: ZodError,
  t: TFunction,
  module?: string,
) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const errorObject: Record<string, any> = {};

  for (const issue of v3Issues(error.issues)) {
    let currentErrorObject = errorObject;
    const path = issue.path;

    path.forEach((rawKey, index) => {
      const key = String(rawKey);
      if (index === path.length - 1) {
        if (!currentErrorObject[key]) {
          currentErrorObject[key] = [];
        }

        currentErrorObject[key].push(translateError(issue, t, module));
      } else {
        currentErrorObject[key] = currentErrorObject[key] || {};
        currentErrorObject = currentErrorObject[key];
      }
    });
  }

  return errorObject;
};

export const formatExcelErrors = (
  error: ZodError,
  startRow: number,
  t: TFunction,
) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const errorObject: Record<string, any> = {};

  for (const err of v3Issues(error.issues)) {
    if (err.path.length >= 2) {
      const row = `${startRow + Number(err.path[0])}`;
      const path = err.path.filter((p) => typeof p === "string");
      (err as { path: PropertyKey[] }).path = [String(path[path.length - 1])];

      if (!errorObject[row]) {
        errorObject[row] = [];
      }

      errorObject[row].push(translateError(err, t));
    } else {
      if (!errorObject["general"]) {
        errorObject["general"] = [];
      }
      errorObject["general"].push(translateError(err, t));
    }
  }

  return errorObject;
};

export const translateError = (
  error: ZodIssue,
  t: TFunction,
  module?: string,
): string => {
  const errMessage = error.message.split("^");
  const msg = errMessage[0] ?? "validator.string";
  const items = errMessage[1];

  const path = error.path.filter((p) => typeof p === "string");
  let field = path[path.length - 1];

  if (module) {
    field = translateField(t, module, field as string);
  }

  if (items) {
    field = `${field} ${items}`;
  }

  // v3: kode invalid_date jatuh ke cabang default.
  if (isInvalidDate(error)) {
    return msg.startsWith("validator.") ? t(msg, { field: field }) : msg;
  }

  switch (error.code) {
    case "invalid_type":
      return isMissing(error)
        ? t(`validator.not_empty`, { field: field })
        : t(`validator.${expectedType(error)}`, {
            field: field,
          });

    case "too_small":
      return Number(error.minimum) === 1
        ? t(`validator.not_empty`, { field: field })
        : t(`validator.greater_than`, {
            field1: field,
            field2: error.minimum,
          });

    case "too_big":
      return t(`validator.not_greater_than`, {
        field1: field,
        field2: error.maximum,
      });

    // v3: invalid_enum_value. v4: invalid_value (z.enum, z.nativeEnum, z.literal).
    case "invalid_value":
      if (isMissing(error)) {
        return t(`validator.not_empty`, { field: field });
      }
      return t(`validator.not_exist`, {
        field: `${field} ${receivedValue(error)}`,
      });

    default:
      if (msg.startsWith("validator.")) {
        return t(msg, { field: field });
      } else if (msg === "Invalid input") {
        return t(`validator.string`, { field: field });
      }
  }

  return msg;
};

const translateField = (t: TFunction, module: string, field: string) => {
  // translate form label by its module.label
  let translationKey = `${module}.label.${field}`;
  let translatedError = t(translationKey);

  if (translatedError !== translationKey) {
    return translatedError;
  }

  // if not found in module translation, check from common
  translationKey = `common.${field}`;
  translatedError = t(translationKey);

  if (translatedError !== translationKey) {
    return translatedError;
  }

  // fallback: return its form key
  return field;
};

export const conditionsMessage = (
  c: z.RefinementCtx,
  message: string,
  conds: boolean,
  path?: (string | number)[],
) => {
  if (conds) {
    c.addIssue({
      message,
      code: "custom",
      ...(path ? { path } : {}),
    });
  }
};
