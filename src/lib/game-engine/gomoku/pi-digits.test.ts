import { describe, expect, it } from "vitest";
import { PI_DECIMAL_DIGITS, piDigitAt } from "./pi-digits";

/** 用 Machin 公式独立计算前 N 位 pi（仅用于测试交叉核对，不进运行时） */
function computePiDecimal(decimalPlaces: number): string {
  const scale = 10n ** BigInt(decimalPlaces + 20);
  const arctan = (x: bigint): bigint => {
    const x2 = x * x;
    let term = scale / x;
    let sum = term;
    let n = 1n;
    while (true) {
      term = term / x2;
      const part = term / (2n * n + 1n);
      if (part === 0n) break;
      sum += n % 2n === 1n ? -part : part;
      n++;
    }
    return sum;
  };
  const pi = 16n * arctan(5n) - 4n * arctan(239n);
  return pi.toString().slice(1, 1 + decimalPlaces);
}

describe("pi-digits", () => {
  it("长度恰为 2400", () => {
    expect(PI_DECIMAL_DIGITS).toHaveLength(2400);
  });

  it("前 60 位等于公认值", () => {
    expect(PI_DECIMAL_DIGITS.slice(0, 60)).toBe(
      "141592653589793238462643383279502884197169399375105820974944",
    );
  });

  it("用独立的 BigInt Machin 公式核对前 800 位", () => {
    const fresh = computePiDecimal(800);
    expect(PI_DECIMAL_DIGITS.slice(0, 800)).toBe(fresh);
  });

  it("完整 2400 位与独立 Machin 计算一致", () => {
    const fresh = computePiDecimal(2400);
    expect(PI_DECIMAL_DIGITS).toBe(fresh);
  });

  it("piDigitAt 1-indexed 取位", () => {
    expect(piDigitAt(1)).toBe(1);
    expect(piDigitAt(2)).toBe(4);
    expect(piDigitAt(3)).toBe(1);
    expect(piDigitAt(60)).toBe(4); // 第 60 位
  });

  it("piDigitAt 越界抛错", () => {
    expect(() => piDigitAt(2401)).toThrow(RangeError);
  });
});
