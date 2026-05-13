"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

/** 浏览器端 Supabase 客户端。在 Client Component 中调用。 */
export function createBrowserSupabase() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
