"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  fetchMyMatches,
  getCurrentSession,
  type Session,
} from "@/lib/supabase/auth";
import type { MatchRow } from "@/lib/supabase/types";

const GAME_LABEL: Record<string, string> = {
  gomoku: "五子棋",
  xiangqi: "象棋",
};

const STATUS_LABEL: Record<string, string> = {
  waiting: "等待加入",
  playing: "进行中",
  finished: "已结束",
  aborted: "已废弃",
};

export default function MyMatchesPage() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [matches, setMatches] = useState<MatchRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const s = await getCurrentSession();
      setSession(s);
      if (!s || s.isAnonymous) return;
      try {
        const m = await fetchMyMatches(s.userId);
        setMatches(m);
      } catch (err) {
        setError(err instanceof Error ? err.message : "加载失败");
      }
    })();
  }, []);

  if (session === undefined) {
    return <CenterMessage text="加载中…" />;
  }

  if (!session || session.isAnonymous) {
    return (
      <main className="flex flex-1 flex-col items-center px-6 py-16">
        <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h1 className="text-2xl font-bold">需要登录</h1>
          <p className="mt-2 text-sm text-zinc-500">
            登录后才能查看你参与过的所有对局。
          </p>
          <Link
            href="/auth"
            className="mt-6 inline-block w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
          >
            去登录
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-8">
      <div className="w-full max-w-4xl">
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">我的对局</h1>
          <Link
            href="/"
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
          >
            ← 返回首页
          </Link>
        </header>

        <p className="mb-4 text-sm text-zinc-500">
          身份：{session.nickname}
          {session.email && (
            <span className="text-zinc-400"> · {session.email}</span>
          )}
        </p>

        {error && (
          <div className="mb-4 rounded-md bg-rose-100 px-4 py-3 text-sm text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
            {error}
          </div>
        )}

        {matches === null && !error && (
          <div className="text-sm text-zinc-500">加载对局…</div>
        )}

        {matches && matches.length === 0 && (
          <div className="rounded-2xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
            还没有对局。去
            <Link href="/play" className="ml-1 text-zinc-900 underline dark:text-zinc-100">
              联机大厅
            </Link>
            创建一个房间吧。
          </div>
        )}

        {matches && matches.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-xs text-zinc-500 dark:bg-zinc-900">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">游戏</th>
                  <th className="px-4 py-2 text-left font-medium">对手</th>
                  <th className="px-4 py-2 text-left font-medium">状态</th>
                  <th className="px-4 py-2 text-left font-medium">结果</th>
                  <th className="px-4 py-2 text-left font-medium">时间</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {matches.map((m) => {
                  const myRole: "a" | "b" =
                    m.player_a === session.userId ? "a" : "b";
                  const oppName =
                    myRole === "a"
                      ? m.player_b_nickname ?? "（待加入）"
                      : m.player_a_nickname;
                  const outcome =
                    m.status === "finished" && m.winner
                      ? m.winner === "draw"
                        ? "和棋"
                        : m.winner === myRole
                          ? "胜"
                          : "负"
                      : "—";
                  return (
                    <tr
                      key={m.id}
                      className="border-t border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                    >
                      <td className="px-4 py-2">
                        {GAME_LABEL[m.game_type] ?? m.game_type}
                      </td>
                      <td className="px-4 py-2">{oppName}</td>
                      <td className="px-4 py-2 text-zinc-500">
                        {STATUS_LABEL[m.status] ?? m.status}
                      </td>
                      <td
                        className={`px-4 py-2 font-medium ${
                          outcome === "胜"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : outcome === "负"
                              ? "text-rose-600 dark:text-rose-400"
                              : ""
                        }`}
                      >
                        {outcome}
                      </td>
                      <td className="px-4 py-2 text-xs text-zinc-400">
                        {formatDate(m.created_at)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Link
                          href={`/play/${m.id}`}
                          className="text-xs text-zinc-900 hover:underline dark:text-zinc-100"
                        >
                          进入 →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}

function CenterMessage({ text }: { text: string }) {
  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <div className="text-sm text-zinc-500">{text}</div>
    </main>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
