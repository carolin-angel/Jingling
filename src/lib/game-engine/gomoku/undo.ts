import type { Player } from "../types";
import { otherPlayer } from "../types";
import type { GomokuState } from "./types";

function stoneOwner(state: GomokuState, stone: "black" | "white"): Player {
  return stone === "black" ? state.blackPlayer : otherPlayer(state.blackPlayer);
}

/**
 * 当前是否允许玩家 `by` 申请悔棋。
 *
 * 项目规则：
 *   - 每位玩家每局只能成功使用一次
 *   - 申请方必须是刚下完最后一手的玩家
 *   - 对局已结束则不能悔棋
 */
export function canRequestUndo(state: GomokuState, by: Player): boolean {
  if (state.result.kind !== "ongoing") return false;
  if (state.undoUsed[by]) return false;
  const last = state.history.at(-1);
  if (!last) return false;
  return stoneOwner(state, last.stone) === by;
}

/**
 * 应用悔棋：把最后一手撤回，并记录申请方已用过配额。
 * 调用方负责确认对方已同意（联机时通过 broadcast 协商）。
 */
export function applyUndo(state: GomokuState, by: Player): GomokuState {
  if (!canRequestUndo(state, by)) {
    throw new Error("当前不允许悔棋");
  }
  const last = state.history[state.history.length - 1];
  const newBoard = state.board.map((row) => row.slice());
  newBoard[last.y][last.x] = null;
  return {
    ...state,
    board: newBoard,
    turn: last.stone, // 申请方重新走
    ply: state.ply - 1,
    history: state.history.slice(0, -1),
    undoUsed: { ...state.undoUsed, [by]: true },
    result: { kind: "ongoing" },
  };
}
