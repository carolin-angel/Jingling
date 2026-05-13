"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { NicknameDialog } from "@/components/auth/NicknameDialog";
import { GomokuBoard } from "@/components/board/GomokuBoard";
import { MoveList } from "@/components/match/MoveList";
import { VictoryOverlay } from "@/components/match/VictoryOverlay";
import { useGameAudio } from "@/lib/audio/useGameAudio";
import {
  gomoku,
  snapshotAt,
  type GomokuHistoryEntry,
  type GomokuState,
} from "@/lib/game-engine/gomoku";
import type { Player } from "@/lib/game-engine/types";
import { otherPlayer } from "@/lib/game-engine/types";
import { useMatchSync } from "@/lib/realtime/useMatchSync";
import {
  ensureSession,
  getCurrentSession,
  type Session,
} from "@/lib/supabase/auth";
import {
  finishMatch,
  joinMatch,
  submitMove,
} from "@/lib/supabase/matches";

export function MatchClient({ matchId }: { matchId: string }) {
  const { match, moves, loading, error } = useMatchSync(matchId);
  const [session, setSession] = useState<Session | null | undefined>(
    undefined,
  );
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [viewPly, setViewPly] = useState<number | null>(null);
  const [overlayDismissed, setOverlayDismissed] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const { muted, playPlace, playWin, playLose, toggleMute } = useGameAudio();
  const prevPlyRef = useRef(0);
  const prevResultRef = useRef<"ongoing" | "win" | "draw">("ongoing");

  useEffect(() => {
    getCurrentSession().then(setSession);
  }, []);

  // 把 moves 行映射到引擎 history 项
  const history: GomokuHistoryEntry[] = useMemo(
    () =>
      moves.map((m) => ({
        x: m.data.x,
        y: m.data.y,
        stone: m.data.stone,
      })),
    [moves],
  );

  const liveState: GomokuState | null = useMemo(() => {
    if (!match || match.start_hhmm === null) return null;
    if (match.game_type !== "gomoku") return null;
    return snapshotAt(
      { hhmm: match.start_hhmm, host: "a" },
      history,
      history.length,
    );
  }, [match, history]);

  const displayState: GomokuState | null = useMemo(() => {
    if (!match || match.start_hhmm === null || !liveState) return null;
    const totalPly = history.length;
    const target = viewPly ?? totalPly;
    if (target === totalPly) return liveState;
    return snapshotAt(
      { hhmm: match.start_hhmm, host: "a" },
      history,
      target,
    );
  }, [match, history, liveState, viewPly]);

  const myPosition: Player | null = useMemo(() => {
    if (!session || !match) return null;
    if (session.userId === match.player_a) return "a";
    if (session.userId === match.player_b) return "b";
    return null;
  }, [session, match]);

  const isLive = viewPly === null || viewPly === history.length;

  const canPlay = useMemo(() => {
    if (!liveState || !match || !myPosition) return false;
    if (match.status !== "playing") return false;
    if (!isLive) return false;
    if (liveState.result.kind !== "ongoing") return false;
    const whoseTurn =
      liveState.turn === "black"
        ? liveState.blackPlayer
        : otherPlayer(liveState.blackPlayer);
    return whoseTurn === myPosition;
  }, [liveState, match, myPosition, isLive]);

  // 落子音效
  useEffect(() => {
    if (history.length > prevPlyRef.current) {
      playPlace();
    }
    prevPlyRef.current = history.length;
  }, [history.length, playPlace]);

  // 胜负音效
  useEffect(() => {
    const kind = liveState?.result.kind ?? "ongoing";
    if (kind !== "ongoing" && prevResultRef.current === "ongoing") {
      if (kind === "win") {
        playWin();
        setTimeout(playLose, 600);
      }
    }
    prevResultRef.current = kind;
  }, [liveState?.result.kind, playWin, playLose]);

  // 胜负到位后写回 matches（仅由当前下完最后一手的玩家来 finalize）
  useEffect(() => {
    if (!liveState || !match || !myPosition) return;
    if (match.status === "finished") return;
    if (liveState.result.kind === "ongoing") return;

    // 谁下了最后一手？由那位写库（避免双端重复写）
    const lastMove = history.at(-1);
    if (!lastMove) return;
    const lastPlayer =
      lastMove.stone === "black"
        ? liveState.blackPlayer
        : otherPlayer(liveState.blackPlayer);
    if (lastPlayer !== myPosition) return;

    const winner =
      liveState.result.kind === "win" ? liveState.result.winner : "draw";
    const reason =
      liveState.result.kind === "win"
        ? liveState.result.reason
        : liveState.result.reason;
    finishMatch({ matchId: match.id, winner, reason }).catch((err) => {
      setActionError(
        err instanceof Error ? err.message : "结算对局失败",
      );
    });
  }, [liveState, match, myPosition, history]);

  const handlePlace = useCallback(
    async (x: number, y: number) => {
      if (!match || !liveState || !canPlay) return;
      const stone = liveState.turn;
      const notation = gomoku.serializeMove({ x, y });
      try {
        await submitMove({
          matchId: match.id,
          ply: history.length + 1,
          notation,
          data: { x, y, stone },
        });
      } catch (err) {
        setActionError(
          err instanceof Error ? err.message : "落子失败",
        );
      }
    },
    [match, liveState, canPlay, history.length],
  );

  const handleJoin = useCallback(
    async (nickname: string) => {
      try {
        await ensureSession(nickname);
        const updated = await joinMatch({ matchId, nickname });
        const fresh = await getCurrentSession();
        setSession(fresh);
        setJoinDialogOpen(false);
      } catch (err) {
        setActionError(
          err instanceof Error ? err.message : "加入失败",
        );
        throw err;
      }
    },
    [matchId],
  );

  const handleCopyShare = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      setActionError("复制失败：浏览器不支持");
    }
  }, []);

  // 渲染状态机
  if (loading || session === undefined) {
    return <CenterMessage text="加载房间中…" />;
  }
  if (error) {
    return <CenterMessage text={`房间加载失败：${error}`} variant="error" />;
  }
  if (!match) {
    return (
      <CenterMessage
        text="找不到这个房间（可能不存在、对局进行中且你不是参与者，或链接错误）"
        variant="error"
      />
    );
  }

  const isHost = session && match.player_a === session.userId;
  const isGuest = session && match.player_b === session.userId;
  const isParticipant = isHost || isGuest;

  // ============================
  // 状态：waiting
  // ============================
  if (match.status === "waiting") {
    if (isHost) {
      return (
        <WaitingHost
          match={match}
          shareCopied={shareCopied}
          onCopy={handleCopyShare}
        />
      );
    }
    return (
      <JoinScreen
        hostNickname={match.player_a_nickname}
        onJoin={() => setJoinDialogOpen(true)}
        dialogOpen={joinDialogOpen}
        onDialogClose={() => setJoinDialogOpen(false)}
        onDialogSubmit={handleJoin}
        defaultNickname={session?.nickname}
      />
    );
  }

  // ============================
  // 状态：playing / finished —— 但当前用户不是参与者
  // ============================
  if (!isParticipant) {
    return (
      <CenterMessage
        text={
          match.status === "finished"
            ? "这是别人对局的复盘页面。功能开发中。"
            : "对局已开始，仅参与者可进入。"
        }
        variant="info"
      />
    );
  }

  // ============================
  // 状态：playing / finished —— 参与者视图（核心）
  // ============================
  if (!displayState || !liveState) {
    return <CenterMessage text="加载棋盘…" />;
  }

  const totalPly = history.length;
  const currentPly = viewPly ?? totalPly;
  const blackPosition = liveState.blackPlayer;
  const whitePosition = otherPlayer(blackPosition);
  const blackName =
    blackPosition === "a"
      ? match.player_a_nickname
      : match.player_b_nickname ?? "玩家2";
  const whiteName =
    whitePosition === "a"
      ? match.player_a_nickname
      : match.player_b_nickname ?? "玩家2";
  const myStone = myPosition === blackPosition ? "黑" : "白";
  const myName = myPosition === "a" ? match.player_a_nickname : match.player_b_nickname;
  const oppName = myPosition === "a" ? match.player_b_nickname : match.player_a_nickname;
  const hhmmStr = (match.start_hhmm ?? 0).toString().padStart(4, "0");
  const piPosition = match.start_hhmm === 0 ? 1 : match.start_hhmm ?? 1;

  const result = liveState.result;
  const overlayVariant: "win" | "lose" | "draw" | null =
    result.kind === "win"
      ? result.winner === myPosition
        ? "win"
        : "lose"
      : result.kind === "draw"
        ? "draw"
        : null;
  const winnerName =
    result.kind === "win"
      ? result.winner === "a"
        ? match.player_a_nickname
        : match.player_b_nickname ?? "玩家2"
      : undefined;

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-8">
      <header className="mb-6 w-full max-w-6xl">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">五子棋 · 联机</h1>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleMute}
              className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
            >
              {muted ? "🔇 已静音" : "🔊 音效开"}
            </button>
            <Link
              href="/play"
              className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
            >
              ← 大厅
            </Link>
          </div>
        </div>
        <p className="mt-2 text-sm text-zinc-500">
          开局 HHMM=<span className="font-mono">{hhmmStr}</span>（服务器时间） →
          圆周率第 <span className="font-mono">{piPosition}</span> 位 →{" "}
          <strong>{blackName}</strong> 执黑 ·{" "}
          <strong>{whiteName}</strong> 执白
        </p>
        <p className="mt-1 text-xs text-zinc-400">
          你 <strong>{myName}</strong> 执 <strong>{myStone}</strong> ·
          对手 <strong>{oppName}</strong>
        </p>
      </header>

      <div className="grid w-full max-w-6xl gap-6 lg:grid-cols-[1fr_280px_240px]">
        <div className="flex flex-col gap-3">
          <GomokuBoard
            state={displayState}
            onPlace={canPlay ? handlePlace : undefined}
            readonly={!canPlay}
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
          {match.status === "playing" && !canPlay && (
            <div className="text-center text-sm text-zinc-500">
              等待对手落子…
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="text-xs text-zinc-500">
              {match.status === "finished" ? "对局已结束" : "当前轮到"}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span
                className={`inline-block h-4 w-4 rounded-full ${
                  displayState.turn === "black"
                    ? "bg-black"
                    : "border border-zinc-400 bg-white"
                }`}
              />
              <span className="font-medium">
                {displayState.turn === "black" ? blackName : whiteName}
              </span>
            </div>
            <div className="mt-2 text-xs text-zinc-500">
              已走 {totalPly} 手
            </div>
          </div>
        </aside>

        <MoveList
          history={history}
          viewPly={currentPly}
          onJump={setViewPly}
        />
      </div>

      {overlayVariant && !overlayDismissed && (
        <VictoryOverlay
          variant={overlayVariant}
          reason={result.kind === "win" ? result.reason : result.kind === "draw" ? result.reason : undefined}
          subject={winnerName}
          onClose={() => setOverlayDismissed(true)}
        />
      )}

      {actionError && (
        <div className="fixed bottom-6 right-6 max-w-sm rounded-md bg-rose-600 px-4 py-3 text-sm text-white shadow-lg">
          {actionError}
          <button
            onClick={() => setActionError(null)}
            className="ml-3 text-white/80 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}
    </main>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function CenterMessage({
  text,
  variant = "info",
}: {
  text: string;
  variant?: "info" | "error";
}) {
  const cls =
    variant === "error" ? "text-rose-600" : "text-zinc-500";
  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <div className={`text-sm ${cls}`}>{text}</div>
    </main>
  );
}

function WaitingHost({
  match,
  shareCopied,
  onCopy,
}: {
  match: { id: string; player_a_nickname: string; game_type: string };
  shareCopied: boolean;
  onCopy: () => void;
}) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="text-xs uppercase tracking-wide text-zinc-400">
          {match.game_type === "gomoku" ? "五子棋" : "象棋"} · 房间已创建
        </div>
        <h1 className="mt-2 text-2xl font-bold">等待对手加入…</h1>
        <p className="mt-3 text-sm text-zinc-500">
          你（<strong>{match.player_a_nickname}</strong>）已就位。
          把下面这个链接发给朋友，对方打开后输昵称即可对战。
        </p>
        <div className="mt-5 rounded-md bg-zinc-100 px-3 py-2 text-xs font-mono text-zinc-700 break-all dark:bg-zinc-900 dark:text-zinc-300">
          {typeof window !== "undefined" ? window.location.href : ""}
        </div>
        <button
          type="button"
          onClick={onCopy}
          className="mt-3 w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {shareCopied ? "已复制 ✓" : "复制链接"}
        </button>
        <div className="mt-6 text-xs text-zinc-400">
          页面会自动检测到对手加入，无需刷新
        </div>
      </div>
    </main>
  );
}

function JoinScreen({
  hostNickname,
  onJoin,
  dialogOpen,
  onDialogClose,
  onDialogSubmit,
  defaultNickname,
}: {
  hostNickname: string;
  onJoin: () => void;
  dialogOpen: boolean;
  onDialogClose: () => void;
  onDialogSubmit: (nickname: string) => Promise<void>;
  defaultNickname?: string;
}) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="text-xs uppercase tracking-wide text-zinc-400">
          受邀加入
        </div>
        <h1 className="mt-2 text-2xl font-bold">
          {hostNickname} 邀请你对局
        </h1>
        <p className="mt-3 text-sm text-zinc-500">
          点下方按钮，输入你的昵称即可开始。
        </p>
        <button
          type="button"
          onClick={onJoin}
          className="mt-5 w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
        >
          加入对局
        </button>
      </div>

      <NicknameDialog
        open={dialogOpen}
        title="加入房间"
        description={`即将与 ${hostNickname} 对局。`}
        defaultValue={defaultNickname ?? ""}
        submitLabel="加入"
        onSubmit={onDialogSubmit}
        onClose={onDialogClose}
      />
    </main>
  );
}
