"use client";

import { useState } from "react";
import {
  BOARD_SIZE,
  type GomokuState,
  isLegalMove,
} from "@/lib/game-engine/gomoku";

type Props = {
  state: GomokuState;
  onPlace?: (x: number, y: number) => void;
  /** 复盘/对局已结束时的只读渲染 */
  readonly?: boolean;
  /** 高亮显示的某一手（默认最后一手） */
  highlightPly?: number;
};

const CELL = 36;
const PAD = 24;
const BOARD_PX = PAD * 2 + CELL * (BOARD_SIZE - 1);

export function GomokuBoard({
  state,
  onPlace,
  readonly = false,
  highlightPly,
}: Props) {
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const last =
    highlightPly !== undefined
      ? state.history[highlightPly - 1]
      : state.history.at(-1);
  const canInteract = !readonly && state.result.kind === "ongoing";

  return (
    <svg
      role="img"
      aria-label="五子棋棋盘"
      viewBox={`0 0 ${BOARD_PX} ${BOARD_PX}`}
      className="aspect-square w-full max-w-[560px] rounded-lg shadow-md"
      style={{ background: "#e6c79a" }}
      onMouseLeave={() => setHover(null)}
    >
      <defs>
        {/* 黑云子：冷调蓝黑底 + 高光 */}
        <radialGradient id="gomoku-black-yunzi" cx="35%" cy="28%" r="72%">
          <stop offset="0%" stopColor="#4a4a55" />
          <stop offset="35%" stopColor="#1c1c24" />
          <stop offset="100%" stopColor="#06060a" />
        </radialGradient>
        {/* 白云子：象牙暖白 + 微微透感 */}
        <radialGradient id="gomoku-white-yunzi" cx="35%" cy="28%" r="72%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="55%" stopColor="#f3ecd6" />
          <stop offset="100%" stopColor="#d8c8a0" />
        </radialGradient>
      </defs>

      {/* 网格 */}
      <g stroke="#5c3a1a" strokeWidth={1}>
        {Array.from({ length: BOARD_SIZE }).map((_, i) => (
          <line
            key={`h-${i}`}
            x1={PAD}
            y1={PAD + i * CELL}
            x2={PAD + (BOARD_SIZE - 1) * CELL}
            y2={PAD + i * CELL}
          />
        ))}
        {Array.from({ length: BOARD_SIZE }).map((_, i) => (
          <line
            key={`v-${i}`}
            x1={PAD + i * CELL}
            y1={PAD}
            x2={PAD + i * CELL}
            y2={PAD + (BOARD_SIZE - 1) * CELL}
          />
        ))}
      </g>

      {/* 星位 */}
      <g fill="#5c3a1a">
        {[
          [3, 3],
          [3, 11],
          [11, 3],
          [11, 11],
          [7, 7],
        ].map(([x, y]) => (
          <circle
            key={`star-${x}-${y}`}
            cx={PAD + x * CELL}
            cy={PAD + y * CELL}
            r={3.5}
          />
        ))}
      </g>

      {/* 棋子 */}
      <g>
        {state.board.flatMap((row, y) =>
          row.map((cell, x) =>
            cell ? (
              <Stone
                key={`s-${x}-${y}-${cell}`}
                cx={PAD + x * CELL}
                cy={PAD + y * CELL}
                color={cell}
                highlighted={last?.x === x && last?.y === y}
                animateIn={
                  !readonly && last?.x === x && last?.y === y
                }
              />
            ) : null,
          ),
        )}
      </g>

      {/* 悬停预览（半透明的云子色） */}
      {canInteract &&
        hover &&
        state.board[hover.y][hover.x] === null && (
          <circle
            cx={PAD + hover.x * CELL}
            cy={PAD + hover.y * CELL}
            r={CELL * 0.42}
            fill={
              state.turn === "black"
                ? "url(#gomoku-black-yunzi)"
                : "url(#gomoku-white-yunzi)"
            }
            stroke={state.turn === "black" ? "#0a0a10" : "#b5a380"}
            strokeWidth={0.4}
            opacity={0.4}
            pointerEvents="none"
          />
        )}

      {/* 命中区 */}
      {canInteract && onPlace && (
        <g>
          {Array.from({ length: BOARD_SIZE }).flatMap((_, y) =>
            Array.from({ length: BOARD_SIZE }).map((_, x) => {
              const legal = isLegalMove(state, { x, y });
              return (
                <rect
                  key={`hit-${x}-${y}`}
                  x={PAD + x * CELL - CELL / 2}
                  y={PAD + y * CELL - CELL / 2}
                  width={CELL}
                  height={CELL}
                  fill="transparent"
                  className={legal ? "cursor-pointer" : "cursor-not-allowed"}
                  onMouseEnter={() => legal && setHover({ x, y })}
                  onClick={() => legal && onPlace(x, y)}
                />
              );
            }),
          )}
        </g>
      )}

      <style>{`
        @keyframes gomoku-drop {
          0% { transform: scale(0.2); opacity: 0; }
          70% { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .gomoku-stone-new {
          animation: gomoku-drop 220ms cubic-bezier(0.34, 1.56, 0.64, 1);
        }
      `}</style>
    </svg>
  );
}

function Stone({
  cx,
  cy,
  color,
  highlighted,
  animateIn,
}: {
  cx: number;
  cy: number;
  color: "black" | "white";
  highlighted: boolean;
  animateIn: boolean;
}) {
  const radius = CELL * 0.42;
  const fill =
    color === "black"
      ? "url(#gomoku-black-yunzi)"
      : "url(#gomoku-white-yunzi)";
  // 描边非纯黑/纯白，与云子内部色相协调
  const stroke = color === "black" ? "#0a0a10" : "#b5a380";
  const highlightFill = color === "black" ? "#f5e6b6" : "#8a3838";
  return (
    <g
      style={animateIn ? { transformOrigin: `${cx}px ${cy}px` } : undefined}
      className={animateIn ? "gomoku-stone-new" : undefined}
    >
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill={fill}
        stroke={stroke}
        strokeWidth={0.6}
      />
      {highlighted && (
        <circle cx={cx} cy={cy} r={3.5} fill={highlightFill} opacity={0.85} />
      )}
    </g>
  );
}
