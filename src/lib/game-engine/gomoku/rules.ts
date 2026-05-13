import type { Cell, GomokuMove, GomokuState, GomokuWinReason } from "./types";
import { BOARD_SIZE } from "./types";

const DIRECTIONS: Array<readonly [number, number]> = [
  [1, 0], // 水平
  [0, 1], // 垂直
  [1, 1], // 斜下
  [1, -1], // 斜上
];

export function inBounds(x: number, y: number): boolean {
  return x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE;
}

export function isLegalMove(state: GomokuState, move: GomokuMove): boolean {
  if (state.result.kind !== "ongoing") return false;
  if (!inBounds(move.x, move.y)) return false;
  return state.board[move.y][move.x] === null;
}

export type WinDetection = {
  reason: GomokuWinReason;
  /** 连珠坐标列表（按方向顺序） */
  line: Array<[number, number]>;
  /** 方向向量 */
  direction: readonly [number, number];
} | null;

/**
 * 检测刚下的这一手是否触发胜利。
 *
 * 项目自定义规则（详见 project memory `gomoku-custom-rules`）：
 *   - 五连珠 → 胜（标准）
 *   - 活四（4 连珠且**两端均为棋盘内的空格**）→ 胜
 *   - 边界算被堵：4 连珠靠墙时不算活四
 *
 * 算法：对 4 个方向各做一次延伸计数，记录连珠区间和两端状态。
 */
export function detectWin(
  board: Cell[][],
  lastX: number,
  lastY: number,
): WinDetection {
  const color = board[lastY][lastX];
  if (!color) return null;

  for (const direction of DIRECTIONS) {
    const [dx, dy] = direction;
    const line: Array<[number, number]> = [[lastX, lastY]];

    // 向 (dx, dy) 方向延伸
    let fx = lastX + dx;
    let fy = lastY + dy;
    while (inBounds(fx, fy) && board[fy][fx] === color) {
      line.push([fx, fy]);
      fx += dx;
      fy += dy;
    }
    // 向 (-dx, -dy) 方向延伸
    let bx = lastX - dx;
    let by = lastY - dy;
    while (inBounds(bx, by) && board[by][bx] === color) {
      line.unshift([bx, by]);
      bx -= dx;
      by -= dy;
    }

    if (line.length >= 5) {
      return { reason: "five", line, direction };
    }
    if (line.length === 4) {
      const fOpen = inBounds(fx, fy) && board[fy][fx] === null;
      const bOpen = inBounds(bx, by) && board[by][bx] === null;
      if (fOpen && bOpen) {
        return { reason: "open_four", line, direction };
      }
    }
  }

  return null;
}
