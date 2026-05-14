import { describe, expect, it } from "vitest";
import { detectWin, inBounds, isLegalMove } from "./rules";
import { BOARD_SIZE, type Cell, type GomokuState, type Stone } from "./types";

function emptyBoard(): Cell[][] {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array<Cell>(BOARD_SIZE).fill(null),
  );
}

function makeBoard(stones: Array<[number, number, Stone]>): Cell[][] {
  const b = emptyBoard();
  for (const [x, y, s] of stones) b[y][x] = s;
  return b;
}

function makeState(overrides: Partial<GomokuState> = {}): GomokuState {
  return {
    board: emptyBoard(),
    blackPlayer: "a",
    turn: "black",
    ply: 0,
    history: [],
    undoUsed: { a: false, b: false },
    result: { kind: "ongoing" },
    ...overrides,
  };
}

describe("inBounds", () => {
  it("0..14 合法，否则越界", () => {
    expect(inBounds(0, 0)).toBe(true);
    expect(inBounds(14, 14)).toBe(true);
    expect(inBounds(-1, 0)).toBe(false);
    expect(inBounds(15, 0)).toBe(false);
    expect(inBounds(0, 15)).toBe(false);
  });
});

describe("isLegalMove", () => {
  it("空格可下，已占不可下", () => {
    const state = makeState({
      board: makeBoard([[7, 7, "black"]]),
    });
    expect(isLegalMove(state, { x: 7, y: 8 })).toBe(true);
    expect(isLegalMove(state, { x: 7, y: 7 })).toBe(false);
  });

  it("对局结束后任何位置都不可下", () => {
    const state = makeState({
      result: { kind: "win", winner: "a", reason: "five" },
    });
    expect(isLegalMove(state, { x: 0, y: 0 })).toBe(false);
  });

  it("棋盘外不可下", () => {
    const state = makeState();
    expect(isLegalMove(state, { x: -1, y: 0 })).toBe(false);
    expect(isLegalMove(state, { x: 15, y: 0 })).toBe(false);
  });
});

describe("detectWin — 五连珠", () => {
  it("水平五连胜", () => {
    const board = makeBoard([
      [3, 7, "black"],
      [4, 7, "black"],
      [5, 7, "black"],
      [6, 7, "black"],
      [7, 7, "black"],
    ]);
    expect(detectWin(board, 5, 7)?.reason).toBe("five");
  });

  it("垂直五连胜", () => {
    const board = makeBoard([
      [7, 3, "white"],
      [7, 4, "white"],
      [7, 5, "white"],
      [7, 6, "white"],
      [7, 7, "white"],
    ]);
    expect(detectWin(board, 7, 5)?.reason).toBe("five");
  });

  it("斜下五连胜", () => {
    const board = makeBoard([
      [3, 3, "black"],
      [4, 4, "black"],
      [5, 5, "black"],
      [6, 6, "black"],
      [7, 7, "black"],
    ]);
    expect(detectWin(board, 5, 5)?.reason).toBe("five");
  });

  it("斜上五连胜", () => {
    const board = makeBoard([
      [3, 7, "white"],
      [4, 6, "white"],
      [5, 5, "white"],
      [6, 4, "white"],
      [7, 3, "white"],
    ]);
    expect(detectWin(board, 5, 5)?.reason).toBe("five");
  });

  it("六连(长连)也算胜", () => {
    const board = makeBoard([
      [2, 7, "black"],
      [3, 7, "black"],
      [4, 7, "black"],
      [5, 7, "black"],
      [6, 7, "black"],
      [7, 7, "black"],
    ]);
    expect(detectWin(board, 4, 7)?.reason).toBe("five");
  });
});

describe("detectWin — 活四（项目自定义胜利条件）", () => {
  it("水平活四，两端空格 → 胜", () => {
    // _ X X X X _，中间在 (5,7)..(8,7)，两端 (4,7) 和 (9,7) 都是空
    const board = makeBoard([
      [5, 7, "black"],
      [6, 7, "black"],
      [7, 7, "black"],
      [8, 7, "black"],
    ]);
    const res = detectWin(board, 6, 7);
    expect(res?.reason).toBe("open_four");
  });

  it("垂直活四 → 胜", () => {
    const board = makeBoard([
      [7, 5, "white"],
      [7, 6, "white"],
      [7, 7, "white"],
      [7, 8, "white"],
    ]);
    expect(detectWin(board, 7, 6)?.reason).toBe("open_four");
  });

  it("斜下活四 → 胜", () => {
    const board = makeBoard([
      [3, 3, "black"],
      [4, 4, "black"],
      [5, 5, "black"],
      [6, 6, "black"],
    ]);
    expect(detectWin(board, 4, 4)?.reason).toBe("open_four");
  });

  it("斜上活四 → 胜", () => {
    const board = makeBoard([
      [3, 6, "white"],
      [4, 5, "white"],
      [5, 4, "white"],
      [6, 3, "white"],
    ]);
    expect(detectWin(board, 4, 5)?.reason).toBe("open_four");
  });
});

describe("detectWin — 活四需考虑对手即将获胜的威胁（2026-05-14 修复）", () => {
  it("己方活四 + 对方冲四（一端空一端堵）→ 不应判己方胜", () => {
    // 对方白棋冲四：(0,0)..(3,0) 一端是边界(被堵)，另一端 (4,0) 是空
    // 下一步白棋走 (4,0) 即五连
    // 己方黑棋此时做出活四：(5,7),(6,7),(7,7),(8,7) 两端 (4,7) 与 (9,7) 都空
    // 但白棋有冲四威胁 → 黑棋活四不应自动判胜
    const board = makeBoard([
      [0, 0, "white"],
      [1, 0, "white"],
      [2, 0, "white"],
      [3, 0, "white"],
      [5, 7, "black"],
      [6, 7, "black"],
      [7, 7, "black"],
      [8, 7, "black"],
    ]);
    // 黑刚落的最后一手假设是 (6,7)（活四的内点）
    expect(detectWin(board, 6, 7)).toBeNull();
  });

  it("己方活四 + 对方跳四（XX_XX）→ 不应判己方胜", () => {
    // 对方白棋跳四：(0,0),(1,0),(3,0),(4,0)，中间 (2,0) 空，填进去就 5 连
    const board = makeBoard([
      [0, 0, "white"],
      [1, 0, "white"],
      [3, 0, "white"],
      [4, 0, "white"],
      [5, 7, "black"],
      [6, 7, "black"],
      [7, 7, "black"],
      [8, 7, "black"],
    ]);
    expect(detectWin(board, 6, 7)).toBeNull();
  });

  it("己方活四 + 对方仅有三连珠（不构成立即威胁）→ 判己方胜", () => {
    // 对方白棋三连：(0,0),(1,0),(2,0) — 下一步白棋走 (3,0) 也只是四子，不是五连
    const board = makeBoard([
      [0, 0, "white"],
      [1, 0, "white"],
      [2, 0, "white"],
      [5, 7, "black"],
      [6, 7, "black"],
      [7, 7, "black"],
      [8, 7, "black"],
    ]);
    expect(detectWin(board, 6, 7)?.reason).toBe("open_four");
  });

  it("己方活四 + 对方四子被两头堵（无威胁）→ 判己方胜", () => {
    // 对方白棋 4 连两端均被己方黑棋堵：黑 (0,0)、白 (1,0)..(4,0)、黑 (5,0)
    // 白棋无法靠这条线得 5 连
    const board = makeBoard([
      [0, 0, "black"],
      [5, 0, "black"],
      [1, 0, "white"],
      [2, 0, "white"],
      [3, 0, "white"],
      [4, 0, "white"],
      [5, 7, "black"],
      [6, 7, "black"],
      [7, 7, "black"],
      [8, 7, "black"],
    ]);
    expect(detectWin(board, 6, 7)?.reason).toBe("open_four");
  });

  it("己方五连胜 与 对方威胁同时存在 → 仍判己方五连胜（五连优先）", () => {
    // 即便对方有冲四，己方走出五连一定胜
    const board = makeBoard([
      [0, 0, "white"],
      [1, 0, "white"],
      [2, 0, "white"],
      [3, 0, "white"],
      [5, 7, "black"],
      [6, 7, "black"],
      [7, 7, "black"],
      [8, 7, "black"],
      [9, 7, "black"],
    ]);
    expect(detectWin(board, 9, 7)?.reason).toBe("five");
  });
});

describe("detectWin — 活四的反例（不应判胜）", () => {
  it("一端被对方棋子堵 → 不胜", () => {
    // O X X X X _ — 左端是白（对方），右端是空
    const board = makeBoard([
      [4, 7, "white"],
      [5, 7, "black"],
      [6, 7, "black"],
      [7, 7, "black"],
      [8, 7, "black"],
    ]);
    expect(detectWin(board, 6, 7)).toBeNull();
  });

  it("两端均被对方棋子堵 → 不胜", () => {
    const board = makeBoard([
      [4, 7, "white"],
      [5, 7, "black"],
      [6, 7, "black"],
      [7, 7, "black"],
      [8, 7, "black"],
      [9, 7, "white"],
    ]);
    expect(detectWin(board, 6, 7)).toBeNull();
  });

  it("4 连珠紧贴左边界（左端越界）→ 不胜（边界算被堵）", () => {
    // 起于 x=0 的四子：(0..3, 7)，左端 (-1,7) 越界
    const board = makeBoard([
      [0, 7, "black"],
      [1, 7, "black"],
      [2, 7, "black"],
      [3, 7, "black"],
    ]);
    expect(detectWin(board, 1, 7)).toBeNull();
  });

  it("4 连珠紧贴右边界 → 不胜", () => {
    const board = makeBoard([
      [11, 7, "black"],
      [12, 7, "black"],
      [13, 7, "black"],
      [14, 7, "black"],
    ]);
    expect(detectWin(board, 13, 7)).toBeNull();
  });

  it("4 连珠在角落（两端都越界/被堵）→ 不胜", () => {
    // 4 子斜着从 (0,0) 到 (3,3)
    const board = makeBoard([
      [0, 0, "black"],
      [1, 1, "black"],
      [2, 2, "black"],
      [3, 3, "black"],
    ]);
    expect(detectWin(board, 1, 1)).toBeNull();
  });

  it("3 连珠两端开 → 不胜（必须 4 子）", () => {
    const board = makeBoard([
      [5, 7, "black"],
      [6, 7, "black"],
      [7, 7, "black"],
    ]);
    expect(detectWin(board, 6, 7)).toBeNull();
  });
});
