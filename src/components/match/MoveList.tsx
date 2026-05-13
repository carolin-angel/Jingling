"use client";

import {
  gomoku,
  type GomokuHistoryEntry,
} from "@/lib/game-engine/gomoku";

type Props = {
  history: GomokuHistoryEntry[];
  /** 当前查看到的手数：0 = 起始空盘；N = 已应用前 N 手 */
  viewPly: number;
  onJump: (ply: number) => void;
};

export function MoveList({ history, viewPly, onJump }: Props) {
  const pairs = Math.ceil(history.length / 2);

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800">
      <div className="border-b border-zinc-200 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-800">
        走子记录（点击跳转）
      </div>
      <div className="max-h-80 overflow-auto">
        <table className="w-full text-sm">
          <tbody>
            <tr
              onClick={() => onJump(0)}
              className={`cursor-pointer ${
                viewPly === 0
                  ? "bg-amber-100 dark:bg-amber-900/40"
                  : "hover:bg-zinc-100 dark:hover:bg-zinc-900"
              }`}
            >
              <td className="w-12 px-3 py-1.5 text-xs text-zinc-400">起</td>
              <td
                colSpan={2}
                className="px-3 py-1.5 text-xs text-zinc-400"
              >
                空盘
              </td>
            </tr>
            {Array.from({ length: pairs }).map((_, i) => {
              const blackMove = history[i * 2];
              const whiteMove = history[i * 2 + 1];
              const blackPly = i * 2 + 1;
              const whitePly = i * 2 + 2;
              return (
                <tr
                  key={i}
                  className="border-t border-zinc-100 dark:border-zinc-900"
                >
                  <td className="w-12 px-3 py-1.5 text-xs text-zinc-400">
                    {i + 1}
                  </td>
                  <PlyCell
                    move={blackMove}
                    selected={viewPly === blackPly}
                    onClick={() => onJump(blackPly)}
                  />
                  <PlyCell
                    move={whiteMove}
                    selected={viewPly === whitePly}
                    onClick={
                      whiteMove ? () => onJump(whitePly) : undefined
                    }
                  />
                </tr>
              );
            })}
          </tbody>
        </table>
        {history.length === 0 && (
          <div className="px-3 py-6 text-center text-xs text-zinc-400">
            还没有走子
          </div>
        )}
      </div>
    </div>
  );
}

function PlyCell({
  move,
  selected,
  onClick,
}: {
  move?: GomokuHistoryEntry;
  selected: boolean;
  onClick?: () => void;
}) {
  if (!move) {
    return <td className="px-3 py-1.5 text-xs text-zinc-300">—</td>;
  }
  const notation = gomoku.serializeMove(move);
  const base = "px-3 py-1.5";
  const interactive = onClick
    ? "cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-900"
    : "";
  const sel = selected ? "bg-amber-100 font-medium dark:bg-amber-900/40" : "";
  return (
    <td className={`${base} ${interactive} ${sel}`} onClick={onClick}>
      <span
        className={`mr-2 inline-block h-3 w-3 rounded-full align-middle ${
          move.stone === "black"
            ? "bg-black"
            : "border border-zinc-400 bg-white"
        }`}
      />
      <span className="font-mono">{notation}</span>
    </td>
  );
}
