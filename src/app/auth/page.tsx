"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  getCurrentSession,
  signInWithGitHub,
  signInWithMagicLink,
  signOut,
  type Session,
} from "@/lib/supabase/auth";

type Phase = "idle" | "sending" | "sent" | "redirecting";

export default function AuthPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [email, setEmail] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState(false);

  useEffect(() => {
    getCurrentSession().then(setSession);
  }, []);

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("请输入邮箱");
      return;
    }
    setError(null);
    setPhase("sending");
    try {
      const { upgrade } = await signInWithMagicLink(email.trim());
      setUpgrade(upgrade);
      setPhase("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
      setPhase("idle");
    }
  };

  const handleGitHub = async () => {
    setError(null);
    setPhase("redirecting");
    try {
      await signInWithGitHub();
      // 这里不会执行到，因为浏览器已跳转到 GitHub
    } catch (err) {
      setError(err instanceof Error ? err.message : "GitHub 登录失败");
      setPhase("idle");
    }
  };

  const handleSignOut = async () => {
    setError(null);
    try {
      await signOut();
      router.refresh();
      setSession(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "退出失败");
    }
  };

  // 已登录的正式账号，显示状态
  if (session && !session.isAnonymous) {
    return (
      <main className="flex flex-1 flex-col items-center px-6 py-16">
        <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="text-xs uppercase tracking-wide text-zinc-400">
            已登录
          </div>
          <h1 className="mt-2 text-2xl font-bold">{session.nickname}</h1>
          {session.email && (
            <p className="mt-1 text-sm text-zinc-500">{session.email}</p>
          )}
          <div className="mt-6 flex flex-col gap-2">
            <Link
              href="/my"
              className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
            >
              我的对局
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              退出登录
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-16">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="text-2xl font-bold">登录 Jingling</h1>
        <p className="mt-2 text-sm text-zinc-500">
          {session?.isAnonymous
            ? "你正在以匿名身份玩。登录后历史对局会永久保留并可跨设备访问。"
            : "登录后历史对局会永久保留并可跨设备访问。"}
        </p>

        {phase === "sent" ? (
          <div className="mt-6 rounded-lg bg-emerald-50 p-4 text-sm dark:bg-emerald-950/40">
            <div className="font-medium text-emerald-900 dark:text-emerald-200">
              {upgrade ? "确认邮件已发送" : "魔法链接已发送"}
            </div>
            <p className="mt-1 text-emerald-800 dark:text-emerald-300">
              请到 <strong>{email}</strong> 邮箱查收（包括垃圾邮件文件夹），
              点击邮件里的链接即可
              {upgrade ? "完成账号升级" : "登录"}。
            </p>
            <button
              type="button"
              onClick={() => setPhase("idle")}
              className="mt-3 text-xs text-emerald-700 hover:underline dark:text-emerald-400"
            >
              换个邮箱
            </button>
          </div>
        ) : (
          <>
            <form onSubmit={handleMagicLink} className="mt-6 space-y-3">
              <label className="block">
                <span className="text-xs text-zinc-500">邮箱</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950"
                />
              </label>
              <button
                type="submit"
                disabled={phase === "sending"}
                className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
              >
                {phase === "sending" ? "发送中…" : "发送魔法链接"}
              </button>
            </form>

            <div className="my-6 flex items-center gap-3 text-xs text-zinc-400">
              <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
              <span>或</span>
              <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
            </div>

            <button
              type="button"
              onClick={handleGitHub}
              disabled={phase === "redirecting"}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
            >
              <GitHubIcon /> 用 GitHub 登录
            </button>
          </>
        )}

        {error && (
          <p className="mt-4 text-sm text-rose-600 dark:text-rose-400">
            {error}
          </p>
        )}

        <div className="mt-6 text-center text-xs text-zinc-400">
          <Link href="/" className="hover:underline">
            ← 返回首页
          </Link>
        </div>
      </div>
    </main>
  );
}

function GitHubIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.387.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.4 3-.405 1.02.005 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}
