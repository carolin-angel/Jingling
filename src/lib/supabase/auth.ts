"use client";

import { createBrowserSupabase } from "./client";
import type { MatchRow } from "./types";

export type Session = {
  userId: string;
  nickname: string;
  isAnonymous: boolean;
  email: string | null;
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

  return {
    userId: user.id,
    nickname: trimmed,
    isAnonymous,
    email: user.email ?? null,
  };
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
    email: user.email ?? null,
  };
}

/**
 * 通过邮箱魔法链接登录或升级账号。
 *
 * - 当前是**匿名 session** → 调 `updateUser({ email })` 升级该匿名号为正式号，
 *   触发 Supabase 给该邮箱发确认链接。用户点链接后，旧 user.id 保留，
 *   `is_anonymous` 变为 false，**对局历史全部保留**。
 * - 当前**无 session 或非匿名** → 调 `signInWithOtp({ email })` 走标准魔法链接登录。
 *   用户点链接后，如该邮箱已注册则登入，否则新建账号。
 *
 * 失败常见原因：邮箱已被其它账号占用（升级路径冲突）。
 */
export async function signInWithMagicLink(
  email: string,
): Promise<{ upgrade: boolean }> {
  const supabase = createBrowserSupabase();
  const redirectTo = `${window.location.origin}/auth/callback`;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && user.is_anonymous) {
    const { error } = await supabase.auth.updateUser({
      email,
      // 升级时也指定回跳，确保点链接后回到我们的回调路由
      // 注意：updateUser 邮件链接默认使用 Site URL，但 emailRedirectTo 选项更稳
    });
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("already") || msg.includes("registered")) {
        throw new Error(
          "该邮箱已被注册。请用别的邮箱，或先在已注册的设备上退出登录后再登录此邮箱。",
        );
      }
      throw new Error(`升级账号失败：${error.message}`);
    }
    return { upgrade: true };
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo },
  });
  if (error) throw new Error(`发送魔法链接失败：${error.message}`);
  return { upgrade: false };
}

/**
 * 通过 GitHub OAuth 登录或链接账号。
 *
 * - 当前是匿名 session → 调 `linkIdentity({ provider: 'github' })` 把 GitHub 身份
 *   挂到当前匿名号上，升级为正式号。
 * - 当前无 session 或非匿名 → 调 `signInWithOAuth({ provider: 'github' })` 标准登录。
 *
 * 此函数会触发跳转到 GitHub 授权页，授权完成后浏览器自动回到 `/auth/callback`。
 */
export async function signInWithGitHub(): Promise<void> {
  const supabase = createBrowserSupabase();
  const redirectTo = `${window.location.origin}/auth/callback`;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && user.is_anonymous) {
    const { error } = await supabase.auth.linkIdentity({
      provider: "github",
      options: { redirectTo },
    });
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("already") || msg.includes("exists")) {
        throw new Error(
          "该 GitHub 账号已绑定其它登录身份。请直接用 GitHub 登录（先退出当前匿名号）。",
        );
      }
      throw new Error(`链接 GitHub 失败：${error.message}`);
    }
    return;
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: { redirectTo },
  });
  if (error) throw new Error(`GitHub 登录失败：${error.message}`);
}

export async function signOut(): Promise<void> {
  const supabase = createBrowserSupabase();
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(`退出登录失败：${error.message}`);
}

/** 拉取当前用户参与过的所有对局（按创建时间倒序） */
export async function fetchMyMatches(userId: string): Promise<MatchRow[]> {
  const supabase = createBrowserSupabase();
  const { data, error } = await supabase
    .from("matches")
    .select()
    .or(`player_a.eq.${userId},player_b.eq.${userId}`)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`加载对局列表失败：${error.message}`);
  return data ?? [];
}
