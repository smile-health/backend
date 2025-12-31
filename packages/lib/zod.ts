import { TFunction } from "i18next";
import { z, ZodError, ZodIssue } from "zod";

export const formatErrors = (
  error: ZodError,
  t: TFunction,
  module?: string
) => {
  const errorObject = {};

  for (const issue of error.issues) {
    let currentErrorObject = errorObject;
    const path = issue.path;

    path.forEach((key, index) => {
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
  t: TFunction
) => {
  const errorObject = {};

  for (const err of error.issues) {
    if (err.path.length >= 2) {
      const row = `${startRow + Number(err.path[0])}`;
      const path = err.path.filter((p) => typeof p === "string");
      err.path = [String(path[path.length - 1])];

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
  module?: string
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

  switch (error.code) {
    case "invalid_type":
      return error.received === "undefined"
        ? t(`validator.not_empty`, { field: field })
        : t(`validator.${error.expected}`, {
            field: field,
          });

    case "too_small":
      return error.minimum === 1
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

    case "invalid_enum_value":
      return t(`validator.not_exist`, {
        field: `${field} ${error.received}`,
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
  path?: (string | number)[]
) => {
  if (conds) {
    c.addIssue({
      message,
      code: z.ZodIssueCode.custom,
      ...(path ? { path } : {}),
    });
  }
};
