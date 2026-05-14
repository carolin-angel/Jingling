-- ============================================================================
-- 0002_rematch_and_series.sql
--
-- 给 matches 表加 4 个字段支持"再来一局"和"系列赛"（BO3/BO5）：
--   - rematch_match_id：链到下一局（前一局结束后由参与者创建）
--   - series_format：'bo1' | 'bo3' | 'bo5'（开局时定）
--   - series_parent_id：系列赛中第一局的 id；第一局自己为 null
--   - series_round：第几局（1, 2, 3...）
--
-- 同时：
--   - 调整 matches_insert_host 策略以支持"双方已就位的 playing 局"插入
--   - 新增 BEFORE INSERT/UPDATE 触发器，在 status 转 playing 时自动写入服务器
--     时间 HHMM，避免客户端伪造
-- ============================================================================

alter table public.matches
  add column rematch_match_id uuid references public.matches on delete set null,
  add column series_format text not null default 'bo1'
    check (series_format in ('bo1', 'bo3', 'bo5')),
  add column series_parent_id uuid references public.matches on delete set null,
  add column series_round int not null default 1 check (series_round > 0);

create index matches_series_parent_idx on public.matches(series_parent_id);

-- Replace insert policy: allow status='waiting' (original) OR status='playing' with player_b set (rematch)
drop policy if exists "matches_insert_host" on public.matches;
create policy "matches_insert_host"
  on public.matches for insert
  with check (
    auth.uid() = player_a
    and (
      status = 'waiting'
      or (status = 'playing' and player_b is not null)
    )
  );

-- Server-side HHMM trigger
create or replace function public.set_start_hhmm()
returns trigger
language plpgsql
as $$
begin
  if NEW.status = 'playing' and NEW.start_hhmm is null then
    NEW.start_hhmm := extract(hour from now() at time zone 'UTC')::int * 100
                    + extract(minute from now() at time zone 'UTC')::int;
  end if;
  if NEW.status = 'playing' and NEW.started_at is null then
    NEW.started_at := now();
  end if;
  return NEW;
end;
$$;

drop trigger if exists matches_set_start_hhmm on public.matches;
create trigger matches_set_start_hhmm
  before insert or update on public.matches
  for each row execute function public.set_start_hhmm();
