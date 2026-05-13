import type { Player, Result } from "../types";

export const BOARD_SIZE = 15;

export type Stone = "black" | "white";
export type Cell = Stone | null;

export type GomokuMove = {
  x: number; // 列 0..14
  y: number; // 行 0..14
};

export type GomokuHistoryEntry = GomokuMove & { stone: Stone };

export type GomokuInitOptions = {
  /** 服务器时间，格式 HHMM (0-2359)；用于按圆周率小数位决定先手 */
  hhmm: number;
  /** 房主对应的逻辑玩家位 (a/b)；后加入者就是另一位 */
  host: Player;
};

export type GomokuState = {
  board: Cell[][]; // [y][x]
  /** 本局黑棋方对应的逻辑玩家位（来自圆周率规则） */
  blackPlayer: Player;
  /** 当前轮到的颜色 */
  turn: Stone;
  ply: number;
  history: GomokuHistoryEntry[];
  /** 每位逻辑玩家本局是否已用过悔棋 */
  undoUsed: Record<Player, boolean>;
  result: Result;
};

export type GomokuWinReason = "five" | "open_four";
