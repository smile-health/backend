import { describe, expect, test } from "bun:test";
import type { TFunction } from "i18next";
import { z } from "zod";
import {
  conditionsMessage,
  formatErrors,
  formatExcelErrors,
  translateError,
  PARSE_OPTIONS,
} from "../zod";

// Fake translator: echoes the key and the interpolation values so the tests
// pin both which translation key is chosen and what is passed to it.
const t = ((key: string, opts?: Record<string, unknown>) =>
  opts ? `${key}${JSON.stringify(opts)}` : key) as unknown as TFunction;

// Translator that knows a few module/common labels, for translateField.
const tLabels = ((key: string, opts?: Record<string, unknown>) => {
  const labels: Record<string, string> = {
    "materials.label.name": "Nama Material",
    "common.code": "Kode",
  };
  if (labels[key]) return labels[key];
  return opts ? `${key}${JSON.stringify(opts)}` : key;
}) as unknown as TFunction;

const errorsOf = (schema: z.ZodTypeAny, value: unknown) => {
  const result = schema.safeParse(value, PARSE_OPTIONS);
  if (result.success) throw new Error("expected validation to fail");
  return result.error;
};

describe("zod error helpers", () => {
  describe("translateError via formatErrors", () => {
    test("missing required field -> not_empty, even with a custom message", () => {
      const schema = z.object({
        name: z.string({ message: "validator.required" }),
        code: z.string(),
      });
      expect(formatErrors(errorsOf(schema, {}), t)).toEqual({
        name: ['validator.not_empty{"field":"name"}'],
        code: ['validator.not_empty{"field":"code"}'],
      });
    });

    test("wrong type -> validator.<expected>", () => {
      const schema = z.object({
        name: z.string(),
        qty: z.number(),
        active: z.boolean(),
        tags: z.array(z.string()),
        meta: z.object({}),
      });
      const errors = formatErrors(
        errorsOf(schema, {
          name: 1,
          qty: "a",
          active: "yes",
          tags: "x",
          meta: 5,
        }),
        t,
      );
      expect(errors).toEqual({
        name: ['validator.string{"field":"name"}'],
        qty: ['validator.number{"field":"qty"}'],
        active: ['validator.boolean{"field":"active"}'],
        tags: ['validator.array{"field":"tags"}'],
        meta: ['validator.object{"field":"meta"}'],
      });
    });

    test("null on a non-nullable field is a type error, not not_empty", () => {
      const schema = z.object({ name: z.string() });
      expect(formatErrors(errorsOf(schema, { name: null }), t)).toEqual({
        name: ['validator.string{"field":"name"}'],
      });
    });

    test("too_small with minimum 1 -> not_empty", () => {
      const schema = z.object({
        name: z.string().min(1),
        items: z.array(z.number()).min(1),
      });
      expect(
        formatErrors(errorsOf(schema, { name: "", items: [] }), t),
      ).toEqual({
        name: ['validator.not_empty{"field":"name"}'],
        items: ['validator.not_empty{"field":"items"}'],
      });
    });

    test("too_small with minimum > 1 -> greater_than", () => {
      const schema = z.object({
        name: z.string().min(3),
        qty: z.number().min(5),
      });
      expect(formatErrors(errorsOf(schema, { name: "a", qty: 2 }), t)).toEqual({
        name: ['validator.greater_than{"field1":"name","field2":3}'],
        qty: ['validator.greater_than{"field1":"qty","field2":5}'],
      });
    });

    test("too_big -> not_greater_than", () => {
      const schema = z.object({
        name: z.string().max(3),
        qty: z.number().max(10),
        items: z.array(z.number()).max(2),
      });
      expect(
        formatErrors(
          errorsOf(schema, { name: "abcdef", qty: 11, items: [1, 2, 3] }),
          t,
        ),
      ).toEqual({
        name: ['validator.not_greater_than{"field1":"name","field2":3}'],
        qty: ['validator.not_greater_than{"field1":"qty","field2":10}'],
        items: ['validator.not_greater_than{"field1":"items","field2":2}'],
      });
    });

    test("invalid enum value -> not_exist with the received value", () => {
      const schema = z.object({ status: z.enum(["draft", "done"]) });
      expect(formatErrors(errorsOf(schema, { status: "foo" }), t)).toEqual({
        status: ['validator.not_exist{"field":"status foo"}'],
      });
    });

    test("invalid native enum value -> not_exist with the received value", () => {
      enum Kind {
        A = 1,
        B = 2,
      }
      const schema = z.object({ kind: z.nativeEnum(Kind) });
      expect(formatErrors(errorsOf(schema, { kind: 9 }), t)).toEqual({
        kind: ['validator.not_exist{"field":"kind 9"}'],
      });
    });

    test("custom validator.* message from refine is translated", () => {
      const schema = z.object({
        email: z.string().refine((v) => v.includes("@"), {
          message: "validator.email",
        }),
      });
      expect(formatErrors(errorsOf(schema, { email: "x" }), t)).toEqual({
        email: ['validator.email{"field":"email"}'],
      });
    });

    test("string format with validator.* message is translated", () => {
      const schema = z.object({
        email: z.string().email({ message: "validator.email" }),
      });
      expect(formatErrors(errorsOf(schema, { email: "x" }), t)).toEqual({
        email: ['validator.email{"field":"email"}'],
      });
    });

    test("custom free-text message is returned as is", () => {
      const schema = z.object({
        email: z
          .string()
          .refine(() => false, { message: "Email sudah dipakai" }),
      });
      expect(formatErrors(errorsOf(schema, { email: "x" }), t)).toEqual({
        email: ["Email sudah dipakai"],
      });
    });

    test("'^' suffix appends the items to the field", () => {
      const schema = z.object({
        ids: z.array(z.number()).refine(() => false, {
          message: "validator.not_exist^1, 2",
        }),
      });
      expect(formatErrors(errorsOf(schema, { ids: [1, 2] }), t)).toEqual({
        ids: ['validator.not_exist{"field":"ids 1, 2"}'],
      });
    });

    test("nested object and array paths build nested error objects", () => {
      const schema = z.object({
        detail: z.object({ name: z.string() }),
        items: z.array(z.object({ qty: z.number() })),
      });
      expect(
        formatErrors(
          errorsOf(schema, { detail: {}, items: [{ qty: 1 }, { qty: "a" }] }),
          t,
        ),
      ).toEqual({
        detail: { name: ['validator.not_empty{"field":"name"}'] },
        items: { 1: { qty: ['validator.number{"field":"qty"}'] } },
      });
    });

    test("module labels are used to translate the field name", () => {
      const schema = z.object({
        name: z.string(),
        code: z.string(),
        x: z.string(),
      });
      expect(formatErrors(errorsOf(schema, {}), tLabels, "materials")).toEqual({
        name: ['validator.not_empty{"field":"Nama Material"}'],
        code: ['validator.not_empty{"field":"Kode"}'],
        x: ['validator.not_empty{"field":"x"}'],
      });
    });

    test("conditionsMessage adds a custom issue only when the condition holds", () => {
      const schema = z
        .object({ a: z.number(), b: z.number() })
        .superRefine((v, ctx) => {
          conditionsMessage(ctx, "validator.not_valid", v.a > v.b, ["a"]);
          conditionsMessage(ctx, "validator.never", false, ["b"]);
        });
      expect(formatErrors(errorsOf(schema, { a: 2, b: 1 }), t)).toEqual({
        a: ['validator.not_valid{"field":"a"}'],
      });
    });

    test("translateError on a hand-built custom issue", () => {
      expect(
        translateError(
          { code: "custom", message: "validator.unique", path: ["x", "name"] },
          t,
        ),
      ).toBe('validator.unique{"field":"name"}');
    });
  });

  describe("formatExcelErrors", () => {
    test("row errors are keyed by start row + index, general errors otherwise", () => {
      const schema = z
        .array(z.object({ name: z.string(), qty: z.number().max(5) }))
        .refine(() => false, { message: "validator.duplicate" });
      const errors = formatExcelErrors(
        errorsOf(schema, [{ name: "a", qty: 1 }, { qty: 9 }]),
        3,
        t,
      );
      expect(errors).toEqual({
        4: [
          'validator.not_empty{"field":"name"}',
          'validator.not_greater_than{"field1":"qty","field2":5}',
        ],
      });

      const general = formatExcelErrors(
        errorsOf(schema, [{ name: "a", qty: 1 }]),
        3,
        t,
      );
      expect(general).toEqual({
        general: ["validator.duplicate{}"],
      });
    });
  });
  describe("zod 4 specifics", () => {
    test("missing field without reportInput falls back to the default message", () => {
      const schema = z.object({ name: z.string(), qty: z.number() });
      const result = schema.safeParse({ qty: "a" });
      if (result.success) throw new Error("expected validation to fail");
      expect(formatErrors(result.error, t)).toEqual({
        name: ['validator.not_empty{"field":"name"}'],
        qty: ['validator.number{"field":"qty"}'],
      });
    });

    test("codemod-style error function (ex required_error) still maps to not_empty", () => {
      const schema = z.object({
        name: z.string({
          error: (issue) =>
            issue.input === undefined
              ? "Name is required"
              : "Name must be text",
        }),
      });
      expect(formatErrors(errorsOf(schema, {}), t)).toEqual({
        name: ['validator.not_empty{"field":"name"}'],
      });
      expect(formatErrors(errorsOf(schema, { name: 5 }), t)).toEqual({
        name: ['validator.string{"field":"name"}'],
      });
    });

    test("z.enum built from a native enum reports the received value", () => {
      enum Kind {
        A = "a",
        B = "b",
      }
      const schema = z.object({ kind: z.enum(Kind) });
      expect(formatErrors(errorsOf(schema, { kind: "x" }), t)).toEqual({
        kind: ['validator.not_exist{"field":"kind x"}'],
      });
    });
  });
  describe("v3 default messages (z.config customError)", () => {
    const messages = (schema: z.ZodType, value: unknown) => {
      const result = schema.safeParse(value);
      if (result.success) throw new Error("expected validation to fail");
      return result.error.issues.map((issue) => issue.message);
    };

    test("type, size, enum and literal messages keep the zod 3 text", () => {
      expect(messages(z.string(), undefined)).toEqual(["Required"]);
      expect(messages(z.string(), [])).toEqual([
        "Expected string, received array",
      ]);
      expect(messages(z.number().int(), 1.5)).toEqual([
        "Expected integer, received float",
      ]);
      expect(messages(z.string().min(3), "a")).toEqual([
        "String must contain at least 3 character(s)",
      ]);
      expect(messages(z.array(z.any()).max(1), [1, 2])).toEqual([
        "Array must contain at most 1 element(s)",
      ]);
      expect(messages(z.number().positive(), 0)).toEqual([
        "Number must be greater than 0",
      ]);
      expect(messages(z.enum(["a", "b"]), "c")).toEqual([
        "Invalid enum value. Expected 'a' | 'b', received 'c'",
      ]);
      expect(messages(z.literal(1), 2)).toEqual([
        "Invalid literal value, expected 1",
      ]);
      expect(messages(z.date(), new Date("x"))).toEqual(["Invalid date"]);
      expect(messages(z.string().email(), "x")).toEqual(["Invalid email"]);
      expect(messages(z.object({}).strict(), { x: 1 })).toEqual([
        "Unrecognized key(s) in object: 'x'",
      ]);
    });

    test("schema-level messages are not overridden", () => {
      expect(messages(z.string().email("Invalid email address"), "x")).toEqual([
        "Invalid email address",
      ]);
    });

    test("float on an int field translates to validator.integer like v3", () => {
      const schema = z.object({ qty: z.number().int() });
      expect(formatErrors(errorsOf(schema, { qty: 1.5 }), t)).toEqual({
        qty: ['validator.integer{"field":"qty"}'],
      });
    });

    test("invalid record key is reported at the key path like v3", () => {
      const schema = z.object({
        items: z.record(z.coerce.number(), z.number()),
      });
      expect(formatErrors(errorsOf(schema, { items: { x: 1 } }), t)).toEqual({
        items: { x: ['validator.number{"field":"x"}'] },
      });
    });

    test("min/max after a type error is dropped like v3", () => {
      const schema = z.object({ name: z.string().min(3) });
      expect(formatErrors(errorsOf(schema, { name: [] }), t)).toEqual({
        name: ['validator.string{"field":"name"}'],
      });
    });
  });
});
