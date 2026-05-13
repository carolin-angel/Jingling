"use client";

import { createBrowserSupabase } from "./client";

export type Session = {
  userId: string;
  nickname: string;
  isAnonymous: boolean;
};

/**
 * 确保有 Supabase Session 并对应 profile 存在。
 *
 * - 没有 session → 调 signInAnonymously 创建匿名用户
 * - profile 不存在 → 插入 (id, nickname, is_anonymous)
 * - 昵称变了 → 更新
 */
export async function ensureSession(nickname: string): Promise<Session> {
  const trimmed = nickname.trim();
  if (!trimmed) throw new Error("昵称不能为空");

  const supabase = createBrowserSupabase();

  const {
    data: { user: existing },
  } = await supabase.auth.getUser();

  let user = existing;
  if (!user) {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw new Error(`匿名登录失败：${error.message}`);
    user = data.user;
    if (!user) throw new Error("匿名登录未返回用户");
  }

  const isAnonymous = user.is_anonymous ?? true;

  const { data: profile, error: selErr } = await supabase
    .from("profiles")
    .select()
    .eq("id", user.id)
    .maybeSingle();

  if (selErr) throw new Error(`读取个人资料失败：${selErr.message}`);

  if (!profile) {
    const { error } = await supabase.from("profiles").insert({
      id: user.id,
      nickname: trimmed,
      is_anonymous: isAnonymous,
    });
    if (error) throw new Error(`创建个人资料失败：${error.message}`);
  } else if (profile.nickname !== trimmed) {
    const { error } = await supabase
      .from("profiles")
      .update({ nickname: trimmed })
      .eq("id", user.id);
    if (error) throw new Error(`更新昵称失败：${error.message}`);
  }

  return { userId: user.id, nickname: trimmed, isAnonymous };
}

/** 仅查询当前 session（不创建），返回 null 表示未登录 */
export async function getCurrentSession(): Promise<Session | null> {
  const supabase = createBrowserSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select()
    .eq("id", user.id)
    .maybeSingle();

  return {
    userId: user.id,
    nickname: profile?.nickname ?? "玩家",
    isAnonymous: user.is_anonymous ?? true,
  };
}
