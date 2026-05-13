"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/client";
import type { MatchRow, MoveRow } from "@/lib/supabase/types";

export type MatchSync = {
  match: MatchRow | null;
  moves: MoveRow[];
  loading: boolean;
  error: string | null;
};

/**
 * 订阅 matches:id=eq.<id> 与 moves:match_id=eq.<id>，自动同步到本地状态。
 * Postgres Changes 自带"按主键去重"，故不需要手动幂等。
 */
export function useMatchSync(matchId: string): MatchSync {
  const [match, setMatch] = useState<MatchRow | null>(null);
  const [moves, setMoves] = useState<MoveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    let cancelled = false;

    setLoading(true);
    setError(null);

    (async () => {
      const [{ data: matchData, error: matchErr }, { data: movesData, error: movesErr }] =
        await Promise.all([
          supabase.from("matches").select().eq("id", matchId).maybeSingle(),
          supabase.from("moves").select().eq("match_id", matchId).order("ply"),
        ]);

      if (cancelled) return;
      if (matchErr) {
        setError(matchErr.message);
      } else {
        setMatch(matchData ?? null);
      }
      if (movesErr) {
        setError((e) => e ?? movesErr.message);
      } else {
        setMoves(movesData ?? []);
      }
      setLoading(false);
    })();

    const channel = supabase
      .channel(`match:${matchId}`)
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
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [matchId]);

  return { match, moves, loading, error };
}
