/**
 * Supabase Free tier 项目连续 7 天无 API 调用会自动暂停。
 * 这个路由由 Vercel Cron 每天调用一次，触发一次极简的数据库查询，
 * 重置 Supabase 的"无活动"计时器。
 *
 * 直接走 REST API（不引入 supabase-js），保持冷启动开销最小。
 */

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return Response.json(
      { ok: false, error: "Missing Supabase env vars" },
      { status: 500 },
    );
  }

  try {
    const res = await fetch(
      `${url}/rest/v1/matches?select=id&limit=1`,
      {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
        cache: "no-store",
      },
    );

    return Response.json({
      ok: res.ok,
      status: res.status,
      pingedAt: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }
}
