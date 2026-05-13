"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { GomokuBoard } from "@/components/board/GomokuBoard";
import { MoveList } from "@/components/match/MoveList";
import { VictoryOverlay } from "@/components/match/VictoryOverlay";
import { useGameAudio } from "@/lib/audio/useGameAudio";
import {
  applyUndo,
  canRequestUndo,
  dateToHHMM,
  gomoku,
  type GomokuState,
  snapshotAt,
} from "@/lib/game-engine/gomoku";
import type { Player } from "@/lib/game-engine/types";

type LocalGame = { state: GomokuState; hhmm: number };

function startLocalGame(): LocalGame {
  const hhmm = dateToHHMM(new Date());
  return { state: gomoku.initial({ hhmm, host: "a" }), hhmm };
}

const PLAYER_NAMES: Record<Player, string> = {
  a: "玩家1（房主）",
  b: "玩家2",
};

export default function GomokuPage() {
  const [game, setGame] = useState<LocalGame | null>(null);
  const [viewPly, setViewPly] = useState<number | null>(null); // null = 跟随实时
  const [overlayKey, setOverlayKey] = useState(0);
  const [overlayDismissed, setOverlayDismissed] = useState(false);
  const { muted, playPlace, playWin, playLose, toggleMute } = useGameAudio();
  const prevPlyRef = useRef(0);
  const prevResultRef = useRef<"ongoing" | "win" | "draw">("ongoing");

  useEffect(() => {
    setGame(startLocalGame());
  }, []);

  // 落子音效：history 长度增长即播
  useEffect(() => {
    const len = game?.state.history.length ?? 0;
    if (len > prevPlyRef.current) {
      playPlace();
    }
    prevPlyRef.current = len;
  }, [game?.state.history.length, playPlace]);

  // 胜负音效：仅在从 ongoing 跃迁到 win/draw 的瞬间播一次
  useEffect(() => {
    const kind = game?.state.result.kind ?? "ongoing";
    if (kind !== "ongoing" && prevResultRef.current === "ongoing") {
      if (kind === "win") {
        playWin();
        setTimeout(playLose, 600);
      }
    }
    prevResultRef.current = kind;
  }, [game?.state.result.kind, playWin, playLose]);

  const handlePlace = useCallback((x: number, y: number) => {
    setGame((g) => (g ? { ...g, state: gomoku.apply(g.state, { x, y }) } : g));
    setViewPly(null); // 落子后跳回实时
  }, []);

  const handleUndo = useCallback((by: Player) => {
    setGame((g) => (g ? { ...g, state: applyUndo(g.state, by) } : g));
    setViewPly(null);
  }, []);

  const handleRestart = useCallback(() => {
    setGame(startLocalGame());
    setOverlayDismissed(false);
    setOverlayKey((k) => k + 1);
    setViewPly(null);
    prevPlyRef.current = 0;
    prevResultRef.current = "ongoing";
  }, []);

  const handleJump = useCallback((ply: number) => {
    setViewPly(ply);
  }, []);

  // 当前查看局面
  const displayedState = useMemo<GomokuState | null>(() => {
    if (!game) return null;
    const totalPly = game.state.history.length;
    const target = viewPly ?? totalPly;
    if (target === totalPly) return game.state;
    return snapshotAt(
      { hhmm: game.hhmm, host: "a" },
      game.state.history,
      target,
    );
  }, [game, viewPly]);

  if (!game || !displayedState) {
    return (
      <main className="flex flex-1 items-center justify-center p-8">
        <div className="text-sm text-zinc-500">加载棋盘…</div>
      </main>
    );
  }

  const { state: liveState, hhmm } = game;
  const totalPly = liveState.history.length;
  const currentPly = viewPly ?? totalPly;
  const isLive = currentPly === totalPly;

  const blackName = PLAYER_NAMES[liveState.blackPlayer];
  const whiteName =
    liveState.blackPlayer === "a" ? PLAYER_NAMES.b : PLAYER_NAMES.a;
  const currentName =
    displayedState.turn === "black" ? blackName : whiteName;
  const hhmmStr = hhmm.toString().padStart(4, "0");
  const piPosition = hhmm === 0 ? 1 : hhmm;

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-8">
      <header className="mb-6 w-full max-w-6xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">五子棋 · 本地双人</h1>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleMute}
              className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
              aria-label={muted ? "取消静音" : "静音"}
            >
              {muted ? "🔇 已静音" : "🔊 音效开"}
            </button>
            <Link
              href="/"
              className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
            >
              ← 返回
            </Link>
          </div>
        </div>
        <p className="mt-2 text-sm text-zinc-500">
          开局时刻 HHMM=
          <span className="font-mono font-medium">{hhmmStr}</span> → 按圆周率第{" "}
          <span className="font-mono font-medium">{piPosition}</span>{" "}
          位（奇/偶）决定执黑 → 本局 <strong>{blackName}</strong> 执黑
        </p>
      </header>

      <div className="grid w-full max-w-6xl gap-6 lg:grid-cols-[1fr_280px_240px]">
        <div className="flex flex-col gap-3">
          <GomokuBoard
            state={displayedState}
            onPlace={isLive ? handlePlace : undefined}
            readonly={!isLive}
          />
          {!isLive && (
            <div className="flex items-center justify-between rounded-md bg-amber-100 px-4 py-2 text-sm dark:bg-amber-900/30">
              <span>
                复盘中：第 {currentPly}/{totalPly} 手
              </span>
              <button
                type="button"
                onClick={() => setViewPly(null)}
                className="rounded bg-amber-900 px-3 py-1 text-xs text-white hover:bg-amber-800"
              >
                回到当前局
              </button>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="text-xs text-zinc-500">
              {isLive ? "当前轮到" : "该手后轮到"}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span
                className={`inline-block h-4 w-4 rounded-full ${
                  displayedState.turn === "black"
                    ? "bg-black"
                    : "border border-zinc-400 bg-white"
                }`}
              />
              <span className="font-medium">{currentName}</span>
            </div>
            <div className="mt-2 text-xs text-zinc-500">
              已走 {totalPly} 手
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="text-xs text-zinc-500">悔棋（每人每局 1 次）</div>
            <div className="mt-2 flex flex-col gap-2">
              <UndoButton
                label={PLAYER_NAMES.a}
                used={liveState.undoUsed.a}
                disabled={!isLive || !canRequestUndo(liveState, "a")}
                onClick={() => handleUndo("a")}
              />
              <UndoButton
                label={PLAYER_NAMES.b}
                used={liveState.undoUsed.b}
                disabled={!isLive || !canRequestUndo(liveState, "b")}
                onClick={() => handleUndo("b")}
              />
            </div>
            <p className="mt-2 text-[11px] text-zinc-500">
              本地模式默认对方同意；联机模式需对方点同意才生效。
            </p>
          </div>

          <button
            type="button"
            onClick={handleRestart}
            className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            重新开始（按当前时间重算先手）
          </button>
        </aside>

        <MoveList
          history={liveState.history}
          viewPly={currentPly}
          onJump={handleJump}
        />
      </div>

      {liveState.result.kind === "win" && !overlayDismissed && (
        <VictoryOverlay
          key={overlayKey}
          variant="win"
          reason={liveState.result.reason}
          subject={PLAYER_NAMES[liveState.result.winner]}
          onClose={() => setOverlayDismissed(true)}
        />
      )}
      {liveState.result.kind === "draw" && !overlayDismissed && (
        <VictoryOverlay
          key={overlayKey}
          variant="draw"
          onClose={() => setOverlayDismissed(true)}
        />
      )}
    </main>
  );
}

function UndoButton({
  label,
  used,
  disabled,
  onClick,
}: {
  label: string;
  used: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-md border border-zinc-300 px-3 py-2 text-sm enabled:hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:enabled:hover:bg-zinc-900"
    >
      {label}
      {used && " · 已用"}
    </button>
  );
}
