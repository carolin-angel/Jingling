"use client";

import { use } from "react";
import { MatchClient } from "./MatchClient";

export default function MatchPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = use(params);
  // key=matchId 强制让 MatchClient 在路由切到不同对局时完全重新挂载，
  // 避免 rematchPending/navigatedRef 等组件本地状态从上一局泄漏到下一局
  // （表现为链式再来一局后第二局结束按钮卡在"准备中…"）
  return <MatchClient key={matchId} matchId={matchId} />;
}
