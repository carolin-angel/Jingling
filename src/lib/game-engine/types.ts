/**
 * Generic game engine contract shared by Gomoku and Xiangqi.
 *
 * `State` 是不可变的局面快照，`Move` 是一手着法。所有 `apply` 返回新状态，便于
 * 客户端重放与时光回溯（复盘）。
 */

export type Player = "a" | "b";

export type Result =
  | { kind: "ongoing" }
  | { kind: "win"; winner: Player; reason: string }
  | { kind: "draw"; reason: string };

export interface Game<State, Move, InitOptions = unknown> {
  initial(options: InitOptions): State;
  isLegal(state: State, move: Move): boolean;
  apply(state: State, move: Move): State;
  currentPlayer(state: State): Player;
  result(state: State): Result;
  serializeMove(move: Move): string;
}

export function otherPlayer(p: Player): Player {
  return p === "a" ? "b" : "a";
}
