"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { getCurrentSession, type Session } from "@/lib/supabase/auth";

/**
 * 顶部导航：左侧 logo + 中间链接、右侧根据登录状态切换"登录 / 已登录"显示。
 */
export function NavBar() {
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  // 每次路径变化都重新读 session（应对登录/退出后的状态切换）
  useEffect(() => {
    getCurrentSession().then(setSession);
  }, [pathname]);

  const onAuthPage = pathname?.startsWith("/auth");

  return (
    <nav className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
      <div className="flex items-center gap-6">
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight hover:opacity-80"
        >
          Jingling
        </Link>
        <Link
          href="/play"
          className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          联机对战
        </Link>
        {session && !session.isAnonymous && (
          <Link
            href="/my"
            className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            我的对局
          </Link>
        )}
      </div>

      <div className="text-sm">
        {session === undefined ? null : !session || session.isAnonymous ? (
          !onAuthPage && (
            <Link
              href="/auth"
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
            >
              登录
            </Link>
          )
        ) : (
          <Link
            href="/auth"
            className="text-xs text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            title={session.email ?? undefined}
          >
            {session.nickname} ▾
          </Link>
        )}
      </div>
    </nav>
  );
}
