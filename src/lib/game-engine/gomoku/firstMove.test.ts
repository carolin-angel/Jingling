import { describe, expect, it } from "vitest";
import { dateToHHMM, decideBlack } from "./firstMove";
import { piDigitAt } from "./pi-digits";

describe("decideBlack", () => {
  it("HHMM=1705 (用户原例)：第 1705 位决定", () => {
    const digit = piDigitAt(1705);
    const expected = digit % 2 === 1 ? "a" : "b";
    expect(decideBlack(1705, "a")).toBe(expected);
  });

  it("奇数位 → 房主执黑", () => {
    // 第 1 位 = 1 (奇)
    expect(decideBlack(1, "a")).toBe("a");
    expect(decideBlack(1, "b")).toBe("b");
  });

  it("偶数位 → 后加入者执黑", () => {
    // 第 2 位 = 4 (偶)
    expect(decideBlack(2, "a")).toBe("b"); // host=a → guest=b 执黑
    expect(decideBlack(2, "b")).toBe("a");
  });

  it("HHMM=0 边界 → 取第 1 位 (=1, 奇)，房主执黑", () => {
    expect(decideBlack(0, "a")).toBe("a");
    expect(decideBlack(0, "b")).toBe("b");
  });

  it("超出 HHMM 范围抛错", () => {
    expect(() => decideBlack(-1, "a")).toThrow(RangeError);
    expect(() => decideBlack(2400, "a")).toThrow(RangeError);
    expect(() => decideBlack(1.5, "a")).toThrow(RangeError);
  });

  it("HHMM=2359 边界（最大合法值）能正常计算", () => {
    expect(() => decideBlack(2359, "a")).not.toThrow();
  });
});

describe("dateToHHMM", () => {
  it("17:05 → 1705", () => {
    const d = new Date();
    d.setHours(17, 5, 0, 0);
    expect(dateToHHMM(d)).toBe(1705);
  });

  it("00:00 → 0", () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    expect(dateToHHMM(d)).toBe(0);
  });

  it("23:59 → 2359", () => {
    const d = new Date();
    d.setHours(23, 59, 0, 0);
    expect(dateToHHMM(d)).toBe(2359);
  });
});
