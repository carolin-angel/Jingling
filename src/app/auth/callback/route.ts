import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * OAuth / Magic Link 回调路由。
 *
 * 流程：
 *   1. 用户点 GitHub 授权 或 邮箱里的魔法链接
 *   2. Supabase Auth 把 `code`（PKCE）作为查询参数重定向到这里
 *   3. 我们调 `exchangeCodeForSession(code)` 完成 token 交换 + 设置 cookie
 *   4. 重定向用户到首页或之前所在的页面
 *
 * Magic Link 升级匿名号的情况下：旧 user.id 保留，is_anonymous 变 false，
 * 现有对局历史全部继承。
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const errorParam = searchParams.get("error_description") ?? searchParams.get("error");

  if (errorParam) {
    return NextResponse.redirect(
      `${origin}/auth?error=${encodeURIComponent(errorParam)}`,
    );
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/auth?error=missing_code`);
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/auth?error=${encodeURIComponent(error.message)}`,
    );
  }

  return NextResponse.redirect(`${origin}${next}`);
}
