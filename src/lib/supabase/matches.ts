"use client";

import { createBrowserSupabase } from "./client";
import type { GameType, MatchRow, SeriesFormat } from "./types";

export async function createMatch(opts: {
  gameType: GameType;
  userId: string;
  nickname: string;
  seriesFormat?: SeriesFormat;
}): Promise<MatchRow> {
  const supabase = createBrowserSupabase();
  const { data, error } = await supabase
    .from("matches")
    .insert({
      game_type: opts.gameType,
      player_a: opts.userId,
      player_a_nickname: opts.nickname,
      status: "waiting",
      series_format: opts.seriesFormat ?? "bo1",
    })
    .select()
    .single();
  if (error) throw new Error(`创建房间失败：${error.message}`);
  return data;
}

/**
 * 从一场已结束的对局发起"再来一局"。
 *
 * 实现细节：
 *   1. 检查 prev 是否已被链接 rematch_match_id；若是，直接返回该 id
 *   2. 否则插入一条新 match：双方就位、status='playing'、HHMM 由 DB 触发器写
 *   3. 用 `.is("rematch_match_id", null)` 做条件 UPDATE 链接前后两局；若失败说明
 *      竞态时另一方先链接了，则删除我们刚插入的孤儿 match，再 refetch 拿到对方建的 id
 *
 * 系列赛模式下也用此函数：series_format 和 series_parent_id 继承自 prev，
 * series_round 递增。
 */
export async function createRematch(prevMatchId: string): Promise<string> {
  const supabase = createBrowserSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("未登录");

  const { data: prev, error: prevErr } = await supabase
    .from("matches")
    .select()
    .eq("id", prevMatchId)
    .single();
  if (prevErr || !prev) throw new Error(`找不到上一局：${prevErr?.message ?? ""}`);

  if (prev.rematch_match_id) return prev.rematch_match_id;

  if (user.id !== prev.player_a && user.id !== prev.player_b) {
    throw new Error("只有对局参与者可以发起再来一局");
  }

  const isAClicker = user.id === prev.player_a;
  const newPlayerA = isAClicker ? prev.player_a! : prev.player_b!;
  const newPlayerB = isAClicker ? prev.player_b! : prev.player_a!;
  const newANick = isAClicker
    ? prev.player_a_nickname
    : prev.player_b_nickname ?? "玩家";
  const newBNick = isAClicker
    ? prev.player_b_nickname ?? "玩家"
    : prev.player_a_nickname;

  const { data: newMatch, error: insErr } = await supabase
    .from("matches")
    .insert({
      game_type: prev.game_type,
      status: "playing",
      player_a: newPlayerA,
      player_b: newPlayerB,
      player_a_nickname: newANick,
      player_b_nickname: newBNick,
      series_format: prev.series_format,
      series_parent_id: prev.series_parent_id ?? prev.id,
      series_round: prev.series_round + 1,
    })
    .select()
    .single();
  if (insErr || !newMatch) {
    throw new Error(`创建新对局失败：${insErr?.message ?? ""}`);
  }

  const { data: linked, error: linkErr } = await supabase
    .from("matches")
    .update({ rematch_match_id: newMatch.id })
    .eq("id", prev.id)
    .is("rematch_match_id", null)
    .select();

  if (linkErr) {
    // 链接失败但 new match 已创建 → 删除孤儿
    await supabase.from("matches").delete().eq("id", newMatch.id);
    throw new Error(`链接对局失败：${linkErr.message}`);
  }

  if (!linked || linked.length === 0) {
    // 竞态：对方已先链接，孤儿 new match 没用，删掉，返回对方建的 id
    await supabase.from("matches").delete().eq("id", newMatch.id);
    const { data: fresh } = await supabase
      .from("matches")
      .select("rematch_match_id")
      .eq("id", prev.id)
      .single();
    if (fresh?.rematch_match_id) return fresh.rematch_match_id;
    throw new Error("链接对局失败：状态不一致");
  }

  return newMatch.id;
}

/** 拉取一个系列赛中的全部对局（按 series_round 排序） */
export async function fetchSeriesGames(
  rootMatchId: string,
): Promise<MatchRow[]> {
  const supabase = createBrowserSupabase();
  const { data, error } = await supabase
    .from("matches")
    .select()
    .or(`id.eq.${rootMatchId},series_parent_id.eq.${rootMatchId}`)
    .order("series_round");
  if (error) throw new Error(`加载系列赛失败：${error.message}`);
  return data ?? [];
}

/** 调 join_match RPC：把当前用户置为 player_b 并进入 playing 状态 */
export async function joinMatch(opts: {
  matchId: string;
  nickname: string;
}): Promise<MatchRow> {
  const supabase = createBrowserSupabase();
  const { data, error } = await supabase.rpc("join_match", {
    p_match_id: opts.matchId,
    p_nickname: opts.nickname,
  });
  if (error) throw new Error(`加入房间失败：${error.message}`);
  if (!data) throw new Error("加入房间失败：未返回数据");
  // Supabase 把 RPC 返回值反序列成 MatchRow，但类型上可能是数组形式（视生成器而定）
  return Array.isArray(data) ? (data[0] as MatchRow) : (data as MatchRow);
}

export async function submitMove(opts: {
  matchId: string;
  ply: number;
  notation: string;
  data: { x: number; y: number; stone: "black" | "white" };
}): Promise<void> {
  const supabase = createBrowserSupabase();
  const { error } = await supabase.from("moves").insert({
    match_id: opts.matchId,
    ply: opts.ply,
    notation: opts.notation,
    data: opts.data,
  });
  if (error) throw new Error(`落子写入失败：${error.message}`);
}

export async function finishMatch(opts: {
  matchId: string;
  winner: "a" | "b" | "draw";
  reason: string;
}): Promise<void> {
  const supabase = createBrowserSupabase();
  const { error } = await supabase
    .from("matches")
    .update({
      status: "finished",
      winner: opts.winner,
      result_reason: opts.reason,
      finished_at: new Date().toISOString(),
    })
    .eq("id", opts.matchId);
  if (error) throw new Error(`收尾对局失败：${error.message}`);
}

/**
 * 把一场等待中的房间标记为已废弃（aborted）。
 * 只有 waiting 状态可关闭；进行中的对局不应该直接 abort，应该走投降/求和（暂未实现）。
 */
export async function abortMatch(matchId: string): Promise<void> {
  const supabase = createBrowserSupabase();
  const { error } = await supabase
    .from("matches")
    .update({
      status: "aborted",
      finished_at: new Date().toISOString(),
    })
    .eq("id", matchId)
    .eq("status", "waiting"); // 保险：DB 层也只在 waiting 时允许
  if (error) throw new Error(`关闭房间失败：${error.message}`);
}
