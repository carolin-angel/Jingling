import { describe, expect, it } from "vitest";
import { applyUndo, canRequestUndo } from "./undo";
import { gomoku } from "./index";

function startGame() {
  // hhmm=1 → 第 1 位 = 1 (奇) → host=a 执黑
  return gomoku.initial({ hhmm: 1, host: "a" });
}

describe("undo - canRequestUndo", () => {
  it("开局没有走子，不能悔棋", () => {
    const s = startGame();
    expect(canRequestUndo(s, "a")).toBe(false);
    expect(canRequestUndo(s, "b")).toBe(false);
  });

  it("黑方刚下完，黑方可悔棋", () => {
    const s = gomoku.apply(startGame(), { x: 7, y: 7 });
    // a 执黑，刚走完，现在轮 b
    expect(canRequestUndo(s, "a")).toBe(true);
    expect(canRequestUndo(s, "b")).toBe(false); // 不是 b 的最后一手
  });

  it("已用过配额则不能再悔", () => {
    const s1 = gomoku.apply(startGame(), { x: 7, y: 7 });
    const s2 = applyUndo(s1, "a");
    // 重新走一手
    const s3 = gomoku.apply(s2, { x: 8, y: 8 });
    expect(canRequestUndo(s3, "a")).toBe(false);
  });

  it("对局结束后不能悔棋", () => {
    let s = startGame();
    // 用"缺口填补"达成五连胜，避免中途触发活四
    // 黑：(3,7),(4,7),(6,7),(7,7) → 然后 (5,7) 补中间形成 5 连
    // 白：散落在 2x2 角落避免形成任何 4 连
    s = gomoku.apply(s, { x: 3, y: 7 }); // 黑
    s = gomoku.apply(s, { x: 0, y: 0 }); // 白
    s = gomoku.apply(s, { x: 4, y: 7 }); // 黑
    s = gomoku.apply(s, { x: 1, y: 0 }); // 白
    s = gomoku.apply(s, { x: 6, y: 7 }); // 黑（跳着下）
    s = gomoku.apply(s, { x: 0, y: 1 }); // 白
    s = gomoku.apply(s, { x: 7, y: 7 }); // 黑
    s = gomoku.apply(s, { x: 1, y: 1 }); // 白
    s = gomoku.apply(s, { x: 5, y: 7 }); // 黑补缺 → 五连胜
    expect(s.result.kind).toBe("win");
    expect(canRequestUndo(s, "a")).toBe(false);
  });
});

describe("undo - applyUndo", () => {
  it("成功悔棋：棋盘恢复，轮到申请方", () => {
    const s1 = gomoku.apply(startGame(), { x: 7, y: 7 });
    expect(s1.board[7][7]).toBe("black");
    expect(s1.turn).toBe("white");

    const s2 = applyUndo(s1, "a");
    expect(s2.board[7][7]).toBeNull();
    expect(s2.turn).toBe("black"); // a 重新走
    expect(s2.ply).toBe(0);
    expect(s2.history).toHaveLength(0);
    expect(s2.undoUsed.a).toBe(true);
    expect(s2.undoUsed.b).toBe(false);
  });

  it("双方各保留独立配额", () => {
    // 黑下，黑悔棋
    let s = gomoku.apply(startGame(), { x: 7, y: 7 });
    s = applyUndo(s, "a");
    expect(s.undoUsed).toEqual({ a: true, b: false });

    // 黑再下，白下，白悔棋
    s = gomoku.apply(s, { x: 7, y: 7 });
    s = gomoku.apply(s, { x: 8, y: 8 });
    s = applyUndo(s, "b");
    expect(s.undoUsed).toEqual({ a: true, b: true });
    expect(s.board[8][8]).toBeNull();
  });

  it("非法悔棋抛错", () => {
    const s = startGame();
    expect(() => applyUndo(s, "a")).toThrow();
  });
});
