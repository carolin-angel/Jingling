import type { Player } from "../types";
import { piDigitAt } from "./pi-digits";

/**
 * 项目自定义规则：每局开局时刻 HHMM（如 17:05 → 1705）查圆周率小数第 N 位：
 *   - 奇数 → 房主执黑（先手）
 *   - 偶数 → 后加入者执黑
 *   - HHMM=0 边界 → 取第 1 位
 *
 * 详见 project memory `gomoku-custom-rules`。
 */
export function decideBlack(hhmm: number, host: Player): Player {
  if (!Number.isInteger(hhmm) || hhmm < 0 || hhmm > 2359) {
    throw new RangeError(`decideBlack: HHMM 应在 0-2359 之间，传入 ${hhmm}`);
  }
  const position = hhmm === 0 ? 1 : hhmm;
  const digit = piDigitAt(position);
  const isOdd = digit % 2 === 1;
  const guest: Player = host === "a" ? "b" : "a";
  return isOdd ? host : guest;
}

/** 把当前 Date 转成 HHMM（用于本地对战；联机时由服务器写入 matches.start_time） */
export function dateToHHMM(d: Date): number {
  return d.getHours() * 100 + d.getMinutes();
}
