import { describe, expect, test } from "bun:test";
import {
  associate,
  associateField,
  collect,
  consist,
  containsOnlyUnderscoresPeriod,
  convertToBoolean,
  differ,
  flattenToNestedObject,
  getDefaultNumber,
  getLabelByKey,
  group,
  hasWhiteSpace,
  isDateMoreThanNow,
  isStringNumbers,
  merge,
  parseCommaSeparatedIds,
  pick,
  preprocessNumber,
  transformStringNumbersToArrayNumbers,
  transformStringNumbersToArrayStringNumbers,
} from "../utils";

describe("Utils", () => {
  describe("group", () => {
    test("should group items by field", () => {
      const data = [
        { id: 1, name: "John" },
        { id: 1, name: "Jane" },
        { id: 2, name: "Bob" },
      ];
      const result = group(data, "id");
      expect(result[1]).toHaveLength(2);
      expect(result[2]).toHaveLength(1);
    });

    test("should handle empty array", () => {
      const result = group([], "id");
      expect(result).toEqual({});
    });

    test("should handle null values", () => {
      const data = [
        { id: null, name: "John" },
        { id: null, name: "Jane" },
      ];
      const result = group(data, "id");
      expect(result[null]).toHaveLength(2);
    });
  });

  describe("associate", () => {
    test("should create key-row mapping", () => {
      const data = [
        { id: 1, name: "John" },
        { id: 2, name: "Jane" },
      ];
      const result = associate(data, "id");
      expect(result[1]).toEqual({ id: 1, name: "John" });
      expect(result[2]).toEqual({ id: 2, name: "Jane" });
    });

    test("should handle empty array", () => {
      const result = associate([], "id");
      expect(result).toEqual({});
    });

    test("should handle null values", () => {
      const data = [
        { id: null, name: "John" },
        { id: 1, name: null },
      ];
      const result = associate(data, "id");
      expect(result[null]).toEqual({ id: null, name: "John" });
      expect(result[1]).toEqual({ id: 1, name: null });
    });
  });

  describe("associateField", () => {
    test("should create key-value pairs", () => {
      const data = [
        { id: 1, name: "John" },
        { id: 2, name: "Jane" },
      ];
      const result = associateField(data, "id", "name");
      expect(result[1]).toBe("John");
      expect(result[2]).toBe("Jane");
    });

    test("should handle empty array", () => {
      const result = associateField([], "id", "name");
      expect(result).toEqual({});
    });

    test("should handle null values", () => {
      const data = [
        { id: null, name: "John" },
        { id: 1, name: null },
      ];
      const result = associateField(data, "id", "name");
      expect(result[null]).toBe("John");
      expect(result[1]).toBe(null);
    });
  });

  describe("collect", () => {
    test("should collect values from multiple fields", () => {
      const data = [
        { id: 1, name: "John", age: 30 },
        { id: 2, name: "Jane", age: 25 },
      ];
      const result = collect(data, "id", "age");
      expect(result).toEqual([1, 30, 2, 25]);
    });

    test("should handle empty array", () => {
      const result = collect([], "id", "age");
      expect(result).toEqual([]);
    });

    test("should filter out null values", () => {
      const data = [
        { id: 1, name: "John", age: null },
        { id: 2, name: null, age: 25 },
      ];
      const result = collect(data, "id", "age");
      expect(result).toEqual([1, 2, 25]);
    });
  });

  describe("merge", () => {
    test("should merge arrays and remove duplicates", () => {
      const result = merge([1, 2], [2, 3], [3, 4]);
      expect(result).toEqual([1, 2, 3, 4]);
    });

    test("should handle empty arrays", () => {
      const result = merge([], [1, 2], []);
      expect(result).toEqual([1, 2]);
    });

    test("should handle null values", () => {
      const result = merge([1, null], [null, 2]);
      expect(result).toEqual([1, null, 2]);
    });
  });

  describe("pick", () => {
    test("should pick specified fields from object", () => {
      const data = { id: 1, name: "John", age: 30 };
      const result = pick(data, ["id", "name"]);
      expect(result).toEqual({ id: 1, name: "John" });
    });

    test("should handle non-existent fields", () => {
      const data = { id: 1, name: "John" };
      const result = pick(data, ["id", "age"]);
      expect(result).toEqual({ id: 1 });
    });

    test("should handle empty fields array", () => {
      const data = { id: 1, name: "John" };
      const result = pick(data, []);
      expect(result).toEqual({});
    });
  });

  describe("differ", () => {
    test("should return elements in array1 not in array2", () => {
      const result = differ([1, 2, 3], [2, 3, 4]);
      expect(result).toEqual([1]);
    });

    test("should handle empty arrays", () => {
      expect(differ([], [1, 2])).toEqual([]);
      expect(differ([1, 2], [])).toEqual([1, 2]);
    });

    test("should handle null values", () => {
      const result = differ([1, null], [null, 2]);
      expect(result).toEqual([1]);
    });
  });

  describe("consist", () => {
    test("should return common elements between arrays", () => {
      const result = consist([1, 2, 3], [2, 3, 4]);
      expect(result).toEqual([2, 3]);
    });

    test("should handle empty arrays", () => {
      expect(consist([], [1, 2])).toEqual([]);
      expect(consist([1, 2], [])).toEqual([]);
    });

    test("should handle null values", () => {
      const result = consist([1, null], [null, 2]);
      expect(result).toEqual([null]);
    });
  });

  describe("isStringNumbers", () => {
    test("should validate string of numbers", () => {
      expect(isStringNumbers("1,2,3")).toBe(true);
      expect(isStringNumbers("1,2,3,a")).toBe(false);
      expect(isStringNumbers("")).toBe(false); // requires at least one digit
      expect(isStringNumbers("1, 2, 3")).toBe(true);
      expect(isStringNumbers("1,2,3 ")).toBe(true);
    });
  });

  describe("transformStringNumbersToArrayNumbers", () => {
    test("should transform string of numbers to number array", () => {
      expect(transformStringNumbersToArrayNumbers("1,2,3")).toEqual([1, 2, 3]);
      expect(transformStringNumbersToArrayNumbers("invalid")).toEqual([]);
      expect(transformStringNumbersToArrayNumbers("")).toEqual([]);
      expect(transformStringNumbersToArrayNumbers("1, 2, 3")).toEqual([
        1, 2, 3,
      ]);
    });
  });

  describe("transformStringNumbersToArrayStringNumbers", () => {
    test("should transform string of numbers to string array", () => {
      expect(transformStringNumbersToArrayStringNumbers("1,2,3")).toEqual([
        "1",
        "2",
        "3",
      ]);
      expect(transformStringNumbersToArrayStringNumbers("invalid")).toEqual([]);
      expect(transformStringNumbersToArrayStringNumbers("")).toEqual([]);
      expect(transformStringNumbersToArrayStringNumbers("1, 2, 3")).toEqual([
        "1",
        "2",
        "3",
      ]);
    });
  });

  describe("hasWhiteSpace", () => {
    // Note: function returns true if string has NO leading/trailing whitespace
    test("should check if string equals trimmed version", () => {
      expect(hasWhiteSpace("hello world")).toBe(true); // no leading/trailing
      expect(hasWhiteSpace("hello")).toBe(true);
      expect(hasWhiteSpace("")).toBe(true);
      expect(hasWhiteSpace(" hello")).toBe(false); // leading space
      expect(hasWhiteSpace("hello ")).toBe(false); // trailing space
    });
  });

  describe("getLabelByKey", () => {
    test("should get label by value", () => {
      const obj = { first_name: "John", last_name: "Doe" };
      expect(getLabelByKey(obj, "John")).toBe("first name");
      expect(getLabelByKey(obj, "Doe")).toBe("last name");
      expect(getLabelByKey(obj, "NonExistent")).toBeUndefined();
    });
  });

  describe("containsOnlyUnderscoresPeriod", () => {
    test("should validate string containing only alphanumeric, underscores and periods", () => {
      expect(containsOnlyUnderscoresPeriod("hello.world_123")).toBe(true);
      expect(containsOnlyUnderscoresPeriod("hello@world")).toBe(false);
      expect(containsOnlyUnderscoresPeriod("")).toBe(true);
      expect(containsOnlyUnderscoresPeriod("hello.world_123!")).toBe(false);
    });
  });

  describe("isDateMoreThanNow", () => {
    test("should check if date is more than now", () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      expect(isDateMoreThanNow(tomorrow)).toBe(true);

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(isDateMoreThanNow(yesterday)).toBe(false);

      const today = new Date();
      expect(isDateMoreThanNow(today)).toBe(false);
    });
  });

  describe("convertToBoolean", () => {
    test("should convert various inputs to boolean", () => {
      expect(convertToBoolean("true")).toBe(true);
      expect(convertToBoolean("1")).toBe(true);
      expect(convertToBoolean(1)).toBe(true);
      expect(convertToBoolean("false")).toBe(false);
      expect(convertToBoolean("0")).toBe(false);
      expect(convertToBoolean(0)).toBe(false);
      expect(convertToBoolean(null)).toBe(false);
      expect(convertToBoolean(undefined)).toBe(false);
      expect(convertToBoolean("")).toBe(false);
    });
  });

  describe("getDefaultNumber", () => {
    test("should convert input to number with default", () => {
      expect(getDefaultNumber("123")).toBe(123);
      expect(getDefaultNumber("invalid")).toBe(0);
      expect(getDefaultNumber(null)).toBe(0);
      expect(getDefaultNumber(undefined)).toBe(0);
      expect(getDefaultNumber("")).toBe(0);
      expect(getDefaultNumber(0)).toBe(0);
    });
  });

  describe("flattenToNestedObject", () => {
    test("should flatten array to nested object", () => {
      const data = [
        { "user.name": "John", "user.age": 30 },
        { "user.name": "Jane", "user.age": 25 },
      ];
      const result = flattenToNestedObject(data);
      expect(result).toEqual([
        { user: { name: "John", age: 30 } },
        { user: { name: "Jane", age: 25 } },
      ]);
    });

    test("should handle empty array", () => {
      expect(flattenToNestedObject([])).toEqual([]);
    });

    test("should handle nested arrays", () => {
      const data = [{ "user.roles.0": "admin", "user.roles.1": "user" }];
      const result = flattenToNestedObject(data);
      expect(result).toEqual([{ user: { roles: ["admin", "user"] } }]);
    });
  });

  describe("parseCommaSeparatedIds", () => {
    test("should parse comma-separated IDs", () => {
      expect(parseCommaSeparatedIds("1,2,3")).toEqual([1, 2, 3]);
      expect(parseCommaSeparatedIds("1, 2, 3")).toEqual([1, 2, 3]);
    });

    test("should return undefined for empty/null", () => {
      expect(parseCommaSeparatedIds("")).toBeUndefined();
      expect(parseCommaSeparatedIds("   ")).toBeUndefined();
      expect(parseCommaSeparatedIds(null)).toBeUndefined();
      expect(parseCommaSeparatedIds(undefined)).toBeUndefined();
    });

    test("should filter non-finite numbers", () => {
      expect(parseCommaSeparatedIds("1,abc,3")).toEqual([1, 3]);
      expect(parseCommaSeparatedIds("abc")).toBeUndefined();
    });
  });

  describe("preprocessNumber", () => {
    test("should parse string to number", () => {
      expect(preprocessNumber("123")).toBe(123);
      expect(preprocessNumber("0")).toBe(0);
    });

    test("should return number as-is", () => {
      expect(preprocessNumber(123)).toBe(123);
      expect(preprocessNumber(0)).toBe(0);
    });

    test("should return undefined for null/empty", () => {
      expect(preprocessNumber(null)).toBeUndefined();
      expect(preprocessNumber("")).toBeUndefined();
    });

    test("should return undefined for invalid types", () => {
      expect(preprocessNumber({})).toBeUndefined();
      expect(preprocessNumber([])).toBeUndefined();
    });
  });
});
