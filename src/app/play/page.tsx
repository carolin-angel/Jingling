"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { NicknameDialog } from "@/components/auth/NicknameDialog";
import { ensureSession } from "@/lib/supabase/auth";
import { createMatch } from "@/lib/supabase/matches";
import type { GameType, SeriesFormat } from "@/lib/supabase/types";

export default function PlayLobbyPage() {
  const router = useRouter();
  const [dialogFor, setDialogFor] = useState<GameType | null>(null);
  const [format, setFormat] = useState<SeriesFormat>("bo1");
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (nickname: string) => {
    if (!dialogFor) return;
    try {
      const session = await ensureSession(nickname);
      const match = await createMatch({
        gameType: dialogFor,
        userId: session.userId,
        nickname: session.nickname,
        seriesFormat: format,
      });
      router.push(`/play/${match.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      throw err; // 让 dialog 也能 catch 然后退出 loading 状态
    }
  };

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-16">
      <header className="mb-10 max-w-2xl text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          联机对战
        </h1>
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          输入昵称即可开房，把链接发给朋友就能对战。无需注册。
        </p>
      </header>

      <FormatSelector value={format} onChange={setFormat} />

      <section className="mt-6 grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
        <GameCard
          title="五子棋"
          subtitle="Gomoku · 在线对战"
          description="开房 → 复制链接发好友 → 双方落子实时同步。"
          onClick={() => setDialogFor("gomoku")}
        />
        <GameCard
          title="中国象棋"
          subtitle="Xiangqi · 在线对战"
          description="即将上线"
          disabled
        />
      </section>

      <Link
        href="/"
        className="mt-10 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
      >
        ← 返回首页
      </Link>

      {error && (
        <div className="fixed bottom-6 right-6 max-w-sm rounded-md bg-rose-600 px-4 py-3 text-sm text-white shadow-lg">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-3 text-white/80 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      <NicknameDialog
        open={dialogFor !== null}
        title={`创建${dialogFor === "gomoku" ? "五子棋" : "象棋"}房间`}
        description={`赛制：${FORMAT_LABEL[format]}。昵称会显示在对手棋盘上。`}
        submitLabel="创建"
        onSubmit={handleCreate}
        onClose={() => setDialogFor(null)}
      />
    </main>
  );
}

const FORMAT_LABEL: Record<SeriesFormat, string> = {
  bo1: "快速一局",
  bo3: "三局两胜（BO3）",
  bo5: "五局三胜（BO5）",
};

const FORMAT_DESC: Record<SeriesFormat, string> = {
  bo1: "下一局就结束。结束后可以选择再来一局",
  bo3: "先赢 2 局者胜出系列赛。最多打 3 局，每局自动连下",
  bo5: "先赢 3 局者胜出系列赛。最多打 5 局，每局自动连下",
};

function FormatSelector({
  value,
  onChange,
}: {
  value: SeriesFormat;
  onChange: (v: SeriesFormat) => void;
}) {
  const options: SeriesFormat[] = ["bo1", "bo3", "bo5"];
  return (
    <div className="w-full max-w-3xl">
      <div className="text-xs uppercase tracking-wide text-zinc-400">赛制</div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`rounded-xl border p-3 text-left transition-colors ${
              value === opt
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                : "border-zinc-200 bg-white hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
            }`}
          >
            <div className="text-sm font-medium">{FORMAT_LABEL[opt]}</div>
            <div
              className={`mt-1 text-xs ${
                value === opt
                  ? "text-zinc-200 dark:text-zinc-700"
                  : "text-zinc-500"
              }`}
            >
              {FORMAT_DESC[opt]}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function GameCard({
  title,
  subtitle,
  description,
  onClick,
  disabled = false,
}: {
  title: string;
  subtitle: string;
  description: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group rounded-2xl border border-zinc-200 bg-white p-6 text-left transition-colors hover:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
    >
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-semibold">{title}</h2>
        <span className="text-xs text-zinc-500">{subtitle}</span>
      </div>
      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
        {description}
      </p>
      {!disabled && (
        <p className="mt-5 text-sm font-medium text-zinc-900 group-hover:underline dark:text-zinc-100">
          创建房间 →
        </p>
      )}
    </button>
  );
}
