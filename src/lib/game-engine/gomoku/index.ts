import type { Game, Player, Result } from "../types";
import { otherPlayer } from "../types";
import { decideBlack } from "./firstMove";
import { detectWin, isLegalMove } from "./rules";
import type {
  Cell,
  GomokuInitOptions,
  GomokuMove,
  GomokuState,
  Stone,
} from "./types";
import { BOARD_SIZE } from "./types";

export const gomoku: Game<GomokuState, GomokuMove, GomokuInitOptions> = {
  initial(options) {
    const blackPlayer = decideBlack(options.hhmm, options.host);
    const board: Cell[][] = Array.from({ length: BOARD_SIZE }, () =>
      Array<Cell>(BOARD_SIZE).fill(null),
    );
    return {
      board,
      blackPlayer,
      turn: "black",
      ply: 0,
      history: [],
      undoUsed: { a: false, b: false },
      result: { kind: "ongoing" },
    };
  },

  isLegal: isLegalMove,

  apply(state, move) {
    if (!isLegalMove(state, move)) {
      throw new Error(`非法落子 (${move.x}, ${move.y})`);
    }
    const stone = state.turn;
    const newBoard = state.board.map((row) => row.slice());
    newBoard[move.y][move.x] = stone;

    const win = detectWin(newBoard, move.x, move.y);
    const winner = win ? stoneToPlayer(stone, state.blackPlayer) : null;
    const isFull = state.ply + 1 === BOARD_SIZE * BOARD_SIZE;

    const result: Result = win
      ? { kind: "win", winner: winner as Player, reason: win.reason }
      : isFull
        ? { kind: "draw", reason: "board_full" }
        : { kind: "ongoing" };

    return {
      ...state,
      board: newBoard,
      turn: stone === "black" ? "white" : "black",
      ply: state.ply + 1,
      history: [...state.history, { ...move, stone }],
      result,
    };
  },

  currentPlayer(state) {
    return stoneToPlayer(state.turn, state.blackPlayer);
  },

  result(state) {
    return state.result;
  },

  /** 五子棋着法记法：列用 A-O，行用 1-15。例：(7,7) → "H8" */
  serializeMove(move) {
    return `${COLUMN_LETTERS[move.x]}${move.y + 1}`;
  },
};

const COLUMN_LETTERS = "ABCDEFGHIJKLMNO" as const;

function stoneToPlayer(stone: Stone, blackPlayer: Player): Player {
  return stone === "black" ? blackPlayer : otherPlayer(blackPlayer);
}

export { isLegalMove, detectWin } from "./rules";
export { decideBlack, dateToHHMM } from "./firstMove";
export { canRequestUndo, applyUndo } from "./undo";
export * from "./types";

/**
 * 从初始状态出发，重放走子序列前 `ply` 手得到当时的局面。
 * 用于复盘：传入完整 history 与目标 ply，就能拿到那一手之后的快照。
 */
export function snapshotAt(
  options: import("./types").GomokuInitOptions,
  history: import("./types").GomokuHistoryEntry[],
  ply: number,
): import("./types").GomokuState {
  let s = gomoku.initial(options);
  const limit = Math.min(ply, history.length);
  for (let i = 0; i < limit; i++) {
    s = gomoku.apply(s, { x: history[i].x, y: history[i].y });
  }
  return s;
}
