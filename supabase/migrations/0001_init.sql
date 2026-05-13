-- ============================================================================
-- Jingling 初始 schema
-- 在 Supabase Dashboard → SQL Editor 里粘贴此文件全部内容并 Run。
-- ============================================================================

-- ----------------------------------------------------------------------------
-- profiles：与 auth.users 1:1 关联，存昵称等用户资料
-- ----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  nickname text not null,
  is_anonymous boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_all"
  on public.profiles for select
  using (true);

create policy "profiles_insert_self"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_self"
  on public.profiles for update
  using (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- matches：一局对战
-- ----------------------------------------------------------------------------
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  game_type text not null check (game_type in ('gomoku','xiangqi')),
  status text not null default 'waiting'
    check (status in ('waiting','playing','finished','aborted')),

  player_a uuid references auth.users on delete set null,
  player_b uuid references auth.users on delete set null,
  player_a_nickname text not null,
  player_b_nickname text,

  -- 五子棋专属：服务器在 status -> playing 时写入的 HHMM (0-2359)
  -- 双方据此查圆周率小数位决定执黑方
  start_hhmm int check (start_hhmm is null or (start_hhmm >= 0 and start_hhmm <= 2359)),

  winner text check (winner is null or winner in ('a','b','draw')),
  result_reason text,

  share_token text not null unique
    default replace(gen_random_uuid()::text, '-', ''),

  undo_used_a boolean not null default false,
  undo_used_b boolean not null default false,

  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create index matches_status_idx on public.matches(status);
create index matches_player_a_idx on public.matches(player_a);
create index matches_player_b_idx on public.matches(player_b);

alter table public.matches enable row level security;

-- 参与者可读自己的局；公开 share_token 可读；waiting 状态的局可读（用于加入流程）
create policy "matches_select_visible"
  on public.matches for select
  using (
    auth.uid() = player_a
    or auth.uid() = player_b
    or status = 'waiting'
    or status = 'finished'  -- 已结束的局公开可读（复盘/分享）
  );

-- 建房：必须是房主、状态为 waiting
create policy "matches_insert_host"
  on public.matches for insert
  with check (
    auth.uid() = player_a
    and status = 'waiting'
  );

-- 更新：仅参与者
create policy "matches_update_participants"
  on public.matches for update
  using (
    auth.uid() = player_a
    or auth.uid() = player_b
  );

-- ----------------------------------------------------------------------------
-- moves：走子序列
-- ----------------------------------------------------------------------------
create table public.moves (
  match_id uuid not null references public.matches on delete cascade,
  ply int not null,
  notation text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  primary key (match_id, ply)
);

create index moves_match_idx on public.moves(match_id);

alter table public.moves enable row level security;

create policy "moves_select_all"
  on public.moves for select
  using (true);

create policy "moves_insert_participants"
  on public.moves for insert
  with check (
    exists (
      select 1 from public.matches m
      where m.id = match_id
        and (auth.uid() = m.player_a or auth.uid() = m.player_b)
        and m.status = 'playing'
    )
  );

-- ----------------------------------------------------------------------------
-- join_match RPC：原子化加入房间 + 服务器计算 HHMM
-- ----------------------------------------------------------------------------
create or replace function public.join_match(p_match_id uuid, p_nickname text)
returns public.matches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches;
  v_hhmm int;
begin
  if auth.uid() is null then
    raise exception '需要登录后才能加入' using errcode = '28000';
  end if;

  -- 服务器 UTC 时间换算 HHMM（0-2359）
  v_hhmm := extract(hour from now() at time zone 'UTC')::int * 100
          + extract(minute from now() at time zone 'UTC')::int;

  update public.matches
  set
    player_b = auth.uid(),
    player_b_nickname = p_nickname,
    status = 'playing',
    started_at = now(),
    start_hhmm = v_hhmm
  where id = p_match_id
    and status = 'waiting'
    and player_b is null
    and player_a is distinct from auth.uid()  -- 不能加入自己的房间
  returning * into v_match;

  if v_match.id is null then
    raise exception '该房间不可加入（已开始、已满或不存在）' using errcode = 'P0001';
  end if;

  return v_match;
end;
$$;

grant execute on function public.join_match(uuid, text) to authenticated, anon;

-- ----------------------------------------------------------------------------
-- 把 matches, moves 加入 Realtime publication，前端订阅表变更
-- ----------------------------------------------------------------------------
alter publication supabase_realtime add table public.matches;
alter publication supabase_realtime add table public.moves;

-- ----------------------------------------------------------------------------
-- 触发器：profiles.updated_at 自动维护
-- ----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();
