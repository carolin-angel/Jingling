"use client";

import { createBrowserSupabase } from "./client";
import type { GameType, MatchRow } from "./types";

export async function createMatch(opts: {
  gameType: GameType;
  userId: string;
  nickname: string;
}): Promise<MatchRow> {
  const supabase = createBrowserSupabase();
  const { data, error } = await supabase
    .from("matches")
    .insert({
      game_type: opts.gameType,
      player_a: opts.userId,
      player_a_nickname: opts.nickname,
      status: "waiting",
    })
    .select()
    .single();
  if (error) throw new Error(`创建房间失败：${error.message}`);
  return data;
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
