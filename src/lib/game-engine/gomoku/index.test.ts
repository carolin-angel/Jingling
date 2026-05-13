import { describe, expect, it } from "vitest";
import { gomoku } from "./index";

describe("gomoku Game 接口", () => {
  it("初始状态：HHMM=1 → 房主执黑，轮到黑方", () => {
    const s = gomoku.initial({ hhmm: 1, host: "a" });
    expect(s.blackPlayer).toBe("a");
    expect(s.turn).toBe("black");
    expect(s.ply).toBe(0);
    expect(s.result.kind).toBe("ongoing");
    expect(gomoku.currentPlayer(s)).toBe("a");
  });

  it("HHMM=2 (偶) → 后加入者执黑", () => {
    const s = gomoku.initial({ hhmm: 2, host: "a" });
    expect(s.blackPlayer).toBe("b");
    expect(gomoku.currentPlayer(s)).toBe("b");
  });

  it("apply 后轮次切换", () => {
    let s = gomoku.initial({ hhmm: 1, host: "a" });
    s = gomoku.apply(s, { x: 7, y: 7 });
    expect(s.turn).toBe("white");
    expect(s.ply).toBe(1);
    expect(gomoku.currentPlayer(s)).toBe("b");
  });

  it("非法落子抛错", () => {
    let s = gomoku.initial({ hhmm: 1, host: "a" });
    s = gomoku.apply(s, { x: 7, y: 7 });
    expect(() => gomoku.apply(s, { x: 7, y: 7 })).toThrow();
  });

  it("黑方五连胜，结果包含 winner=a (黑方)", () => {
    let s = gomoku.initial({ hhmm: 1, host: "a" });
    // 用"缺口填补"达成五连胜：黑跳着下 (3,4,6,7)，最后 (5) 补中间
    // 白散落在 2x2 角落，避免任何 4 连
    const moves = [
      ["b", 3, 7],
      ["w", 0, 0],
      ["b", 4, 7],
      ["w", 1, 0],
      ["b", 6, 7],
      ["w", 0, 1],
      ["b", 7, 7],
      ["w", 1, 1],
      ["b", 5, 7], // 黑补缺 → 五连胜
    ] as const;
    for (const [, x, y] of moves) {
      s = gomoku.apply(s, { x, y });
    }
    expect(s.result.kind).toBe("win");
    if (s.result.kind === "win") {
      expect(s.result.winner).toBe("a");
      expect(s.result.reason).toBe("five");
    }
  });

  it("活四即胜（项目自定义）", () => {
    let s = gomoku.initial({ hhmm: 1, host: "a" });
    // 黑：(5,7),(6,7),(7,7),(8,7) → 活四
    // 白：远处
    const black = [
      [5, 7],
      [6, 7],
      [7, 7],
      [8, 7],
    ] as const;
    const white = [
      [0, 0],
      [0, 1],
      [0, 2],
    ] as const;
    for (let i = 0; i < black.length; i++) {
      s = gomoku.apply(s, { x: black[i][0], y: black[i][1] });
      if (i < white.length) {
        s = gomoku.apply(s, { x: white[i][0], y: white[i][1] });
      }
    }
    expect(s.result.kind).toBe("win");
    if (s.result.kind === "win") {
      expect(s.result.winner).toBe("a");
      expect(s.result.reason).toBe("open_four");
    }
  });

  it("serializeMove 中心点 (7,7) → H8", () => {
    expect(gomoku.serializeMove({ x: 7, y: 7 })).toBe("H8");
    expect(gomoku.serializeMove({ x: 0, y: 0 })).toBe("A1");
    expect(gomoku.serializeMove({ x: 14, y: 14 })).toBe("O15");
  });
});
