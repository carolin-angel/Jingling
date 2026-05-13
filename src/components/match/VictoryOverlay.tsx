"use client";

import { useEffect, useState } from "react";

type Props = {
  /** "win" → 胜利方视角；"lose" → 失败方视角 */
  variant: "win" | "lose" | "draw";
  /** 胜利原因（仅 win） */
  reason?: string;
  /** 胜者/对手昵称 */
  subject?: string;
  /** 几秒后自动关闭，0 表示不自动关闭 */
  autoCloseMs?: number;
  onClose?: () => void;
};

const REASON_LABEL: Record<string, string> = {
  five: "五连珠",
  open_four: "活四",
  board_full: "棋盘已满",
};

export function VictoryOverlay({
  variant,
  reason,
  subject,
  autoCloseMs = 4000,
  onClose,
}: Props) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (autoCloseMs <= 0) return;
    const t = setTimeout(() => {
      setVisible(false);
      onClose?.();
    }, autoCloseMs);
    return () => clearTimeout(t);
  }, [autoCloseMs, onClose]);

  if (!visible) return null;

  const title =
    variant === "win" ? "胜利！" : variant === "lose" ? "再接再厉" : "和棋";
  const subtitle =
    variant === "win"
      ? `${subject ?? ""} ${reason ? `· ${REASON_LABEL[reason] ?? reason}` : ""}`.trim()
      : variant === "lose"
        ? "下一局会更好，继续努力"
        : "势均力敌";

  const accent =
    variant === "win"
      ? "from-amber-300 via-orange-400 to-rose-500"
      : variant === "lose"
        ? "from-sky-300 via-indigo-400 to-violet-500"
        : "from-zinc-300 via-zinc-400 to-zinc-500";

  return (
    <div
      role="dialog"
      aria-live="assertive"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={() => {
        setVisible(false);
        onClose?.();
      }}
    >
      <div
        className={`relative rounded-3xl bg-gradient-to-br ${accent} p-10 text-center shadow-2xl animate-pop-in`}
      >
        <div className="text-6xl font-bold text-white drop-shadow-lg">
          {title}
        </div>
        <div className="mt-4 text-lg text-white/95">{subtitle}</div>
        <div className="mt-6 text-xs text-white/70">点击任意位置关闭</div>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes pop-in {
          0% { transform: scale(0.6); opacity: 0; }
          60% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(1); }
        }
        :global(.animate-fade-in) { animation: fade-in 240ms ease-out; }
        :global(.animate-pop-in) { animation: pop-in 420ms cubic-bezier(0.34, 1.56, 0.64, 1); }
      `}</style>
    </div>
  );
}
