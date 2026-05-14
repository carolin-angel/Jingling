"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createBrowserSupabase } from "@/lib/supabase/client";
import type { MatchRow, MoveRow } from "@/lib/supabase/types";

export type ConnectionState = "connecting" | "connected" | "reconnecting" | "error";

export type MatchSync = {
  match: MatchRow | null;
  moves: MoveRow[];
  loading: boolean;
  error: string | null;
  /** 当前 Realtime 连接状态，UI 可据此显示"重连中"提示 */
  connection: ConnectionState;
  /**
   * 把本地刚下的一手即时合并到 moves（乐观更新），避免等 Realtime 回传带来的视觉延迟。
   * 如果 Realtime 后续也回传同 ply，会被去重忽略。
   */
  addLocalMove: (move: MoveRow) => void;
  /** 立即重新拉取 match + moves（用于断网恢复后追上漏掉的事件） */
  refetch: () => Promise<void>;
};

/**
 * 订阅 matches:id=eq.<id> 与 moves:match_id=eq.<id>，自动同步到本地状态。
 *
 * 这一版相比初版增强：
 *   - Realtime 连接断开自动重连（指数退避）
 *   - 每次 SUBSCRIBED 重连后自动 refetch 一次，避免漏数据
 *   - 浏览器标签从后台切回前台时 refetch 一次，避免 WebSocket 静默断开
 *   - 暴露 `addLocalMove` 给上层做乐观更新
 *   - 暴露 `connection` 给上层显示"重连中"提示
 */
export function useMatchSync(matchId: string): MatchSync {
  const [match, setMatch] = useState<MatchRow | null>(null);
  const [moves, setMoves] = useState<MoveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("connecting");

  // 用 ref 保存 refetch / subscribe 引用，避免 useEffect 依赖膨胀
  const supabaseRef = useRef(createBrowserSupabase());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const cancelledRef = useRef(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);

  const mergeMoves = useCallback((incoming: MoveRow[]) => {
    setMoves((prev) => {
      const map = new Map<number, MoveRow>();
      for (const m of prev) map.set(m.ply, m);
      for (const m of incoming) map.set(m.ply, m);
      return Array.from(map.values()).sort((a, b) => a.ply - b.ply);
    });
  }, []);

  const refetch = useCallback(async () => {
    const supabase = supabaseRef.current;
    const [{ data: matchData, error: matchErr }, { data: movesData, error: movesErr }] =
      await Promise.all([
        supabase.from("matches").select().eq("id", matchId).maybeSingle(),
        supabase.from("moves").select().eq("match_id", matchId).order("ply"),
      ]);
    if (cancelledRef.current) return;
    if (matchErr) {
      setError(matchErr.message);
    } else {
      setMatch(matchData ?? null);
    }
    if (movesErr) {
      setError((e) => e ?? movesErr.message);
    } else {
      mergeMoves(movesData ?? []);
    }
  }, [matchId, mergeMoves]);

  const addLocalMove = useCallback((move: MoveRow) => {
    setMoves((prev) => {
      if (prev.some((m) => m.ply === move.ply)) return prev;
      return [...prev, move].sort((a, b) => a.ply - b.ply);
    });
  }, []);

  // 订阅 + 自动重连
  useEffect(() => {
    cancelledRef.current = false;
    const supabase = supabaseRef.current;

    const subscribe = () => {
      // 清掉旧 channel
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      // 用时间戳避免 channel name 复用问题
      const channel = supabase
        .channel(`match:${matchId}:${Date.now()}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "matches",
            filter: `id=eq.${matchId}`,
          },
          (payload) => {
            setMatch(payload.new as MatchRow);
          },
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "moves",
            filter: `match_id=eq.${matchId}`,
          },
          (payload) => {
            const newMove = payload.new as MoveRow;
            setMoves((prev) => {
              if (prev.some((m) => m.ply === newMove.ply)) return prev;
              return [...prev, newMove].sort((a, b) => a.ply - b.ply);
            });
          },
        )
        .subscribe((status) => {
          if (cancelledRef.current) return;
          if (status === "SUBSCRIBED") {
            setConnection("connected");
            retryCountRef.current = 0;
            // 重连成功后立刻 refetch，补回断流期间漏掉的事件
            refetch().catch(() => undefined);
          } else if (
            status === "CHANNEL_ERROR" ||
            status === "TIMED_OUT" ||
            status === "CLOSED"
          ) {
            setConnection("reconnecting");
            // 指数退避重连：1s, 2s, 4s, 8s, 上限 15s
            const delay = Math.min(
              1000 * 2 ** retryCountRef.current,
              15000,
            );
            retryCountRef.current += 1;
            reconnectTimerRef.current = setTimeout(() => {
              if (!cancelledRef.current) subscribe();
            }, delay);
          }
        });

      channelRef.current = channel;
    };

    setLoading(true);
    setError(null);
    setConnection("connecting");

    refetch()
      .then(() => {
        if (!cancelledRef.current) setLoading(false);
      })
      .catch(() => {
        if (!cancelledRef.current) setLoading(false);
      });

    subscribe();

    // 标签从后台回到前台时立刻补一次，避免 WebSocket 静默断开
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refetch().catch(() => undefined);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelledRef.current = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [matchId, refetch]);

  return { match, moves, loading, error, connection, addLocalMove, refetch };
}
