import type { Cell, GomokuMove, GomokuState, GomokuWinReason, Stone } from "./types";
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
 *   - 五连珠 → 胜（标准，无条件）
 *   - 活四（4 连珠且**两端均为棋盘内的空格**）→ 胜，**但**有一个先决条件：
 *     对手在当前棋盘上不能已有"下一步走完就五连"的威胁（冲四/跳四等）。
 *     如果有，则当前方活四暂不判胜（让对手能先用自己的威胁完成 5 连）。
 *   - 边界算被堵：4 连珠靠墙时不算活四。
 *
 * 修复背景（2026-05-14）：之前活四无条件判胜导致一个不公平场景——
 *   对手已成冲四（XXXX_，下一步就 5），己方此时再做出活四自动判胜，
 *   但实际上轮到对手时他/她会直接走冲四开口完成 5 连，应该是对手赢。
 */
export function detectWin(
  board: Cell[][],
  lastX: number,
  lastY: number,
): WinDetection {
  const color = board[lastY][lastX];
  if (!color) return null;
  const opponent: Stone = color === "black" ? "white" : "black";

  let activeFour: WinDetection = null;

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
    if (!activeFour && line.length === 4) {
      const fOpen = inBounds(fx, fy) && board[fy][fx] === null;
      const bOpen = inBounds(bx, by) && board[by][bx] === null;
      if (fOpen && bOpen) {
        activeFour = { reason: "open_four", line, direction };
      }
    }
  }

  // 活四只有在对手无"下一步即胜"的威胁时才自动判胜
  if (activeFour && !opponentCanMakeFiveNextMove(board, opponent)) {
    return activeFour;
  }

  return null;
}

/**
 * 对手是否能通过一步（任何空格落子）直接形成五连？
 *
 * 涵盖：冲四（XXXX_）、跳四（XX_XX、X_XXX 等），即"四子缺一即五"的所有形态。
 */
function opponentCanMakeFiveNextMove(
  board: Cell[][],
  opponent: Stone,
): boolean {
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[y][x] !== null) continue;
      // 模拟落子（单线程 JS 内同步使用，安全）
      board[y][x] = opponent;
      const wins = wouldMakeFive(board, x, y, opponent);
      board[y][x] = null;
      if (wins) return true;
    }
  }
  return false;
}

function wouldMakeFive(
  board: Cell[][],
  x: number,
  y: number,
  color: Stone,
): boolean {
  for (const [dx, dy] of DIRECTIONS) {
    let count = 1;
    let fx = x + dx;
    let fy = y + dy;
    while (inBounds(fx, fy) && board[fy][fx] === color) {
      count++;
      fx += dx;
      fy += dy;
    }
    let bx = x - dx;
    let by = y - dy;
    while (inBounds(bx, by) && board[by][bx] === color) {
      count++;
      bx -= dx;
      by -= dy;
    }
    if (count >= 5) return true;
  }
  return false;
}
