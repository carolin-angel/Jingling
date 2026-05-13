"use client";

import { use } from "react";
import { MatchClient } from "./MatchClient";

export default function MatchPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = use(params);
  return <MatchClient matchId={matchId} />;
}
