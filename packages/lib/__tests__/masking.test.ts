import { describe, expect, test } from "bun:test";
import { mask } from "../masking";

describe("mask", () => {
  test("masks 16-char string => first 4, last 4 shown", () => {
    const input = "3215ABCDEFGH0001"; // 16 chars
    expect(mask(input)).toBe("3215********0001");
  });

  test("masks 9-char string => floor(9/4)=2 => first 2, last 2 shown", () => {
    const input = "XYabcde56"; // 9 chars
    expect(mask(input)).toBe("XY*****56");
  });

  test("masks 3-char string => min visible = 1", () => {
    expect(mask("123")).toBe("1*3");
  });

  test("returns original for length <= 2", () => {
    expect(mask("")).toBe("");
    expect(mask("a")).toBe("a");
    expect(mask("ab")).toBe("ab");
  });

  test("does not overlap when 2n > len", () => {
    // len=5 => n=floor(5/4)=1 => 1 start, 1 end, 3 middle
    expect(mask("abcde")).toBe("a***e");

    // len=4 => n=floor(4/4)=1 => a**d
    expect(mask("abcd")).toBe("a**d");
  });
});
