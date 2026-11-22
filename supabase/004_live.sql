-- 即時成績（終點輸入）：第 48 屆起
-- 設計：
--   * 工作人員以 Supabase Auth 個人帳戶登入；只有 xc_live_admins 名單內的電郵可讀寫
--   * 公眾不能直接讀取任何表；只能經 xc_live_feed() 取得「不含號碼布」的增量資料
--   * 號碼布對照表只存 號碼布→組別／學校代碼／已公開往績的學生編號，不存姓名
--   * 每次新增或修改都取得新的 rev，用戶端只下載 rev 較新的資料（省流量）
--   * 不硬刪除：刪除以 deleted 標記，方便追查及復原

create table if not exists public.xc_live_admins (
  email text primary key check (email = lower(email))
);
alter table public.xc_live_admins enable row level security;
revoke all on public.xc_live_admins from anon, authenticated;

create or replace function public.xc_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.xc_live_admins
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function public.xc_is_admin() from public;
grant execute on function public.xc_is_admin() to authenticated;

create sequence if not exists public.xc_live_rev;

create or replace function public.xc_live_bump()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.rev := nextval('public.xc_live_rev');
  return new;
end
$$;

-- 各組各分組的起跑時間及狀態
create table if not exists public.xc_live_heats (
  event text not null check (event ~ '^[a-z0-9]{1,12}$'),
  cat text not null check (cat ~ '^[MF][A-E]$'),
  heat int not null default 1 check (heat between 1 and 9),
  start_ms bigint,                       -- 起跑時刻（epoch 毫秒，已按伺服器時差校正）
  status text not null default 'ready' check (status in ('ready', 'running', 'done')),
  updated_by text default lower(auth.jwt() ->> 'email'),
  rev bigint not null default nextval('public.xc_live_rev'),
  primary key (event, cat, heat)
);

-- 號碼布對照（不含姓名）
create table if not exists public.xc_live_roster (
  event text not null check (event ~ '^[a-z0-9]{1,12}$'),
  bib int not null check (bib between 1 and 99999),
  cat text not null check (cat ~ '^[MF][A-E]$'),
  heat int check (heat between 1 and 9),
  abbr text not null check (length(abbr) between 1 and 8),
  pid text check (pid ~ '^p[0-9]{2}[MF][A-E][0-9]{3}$'),
  primary key (event, bib)
);

-- 終點紀錄：每位運動員衝線一行
create table if not exists public.xc_live_entries (
  id uuid primary key,                   -- 由輸入裝置產生，離線補傳時不會重複
  event text not null check (event ~ '^[a-z0-9]{1,12}$'),
  cat text not null check (cat ~ '^[MF][A-E]$'),
  heat int not null default 1 check (heat between 1 and 9),
  bib int check (bib between 1 and 99999),
  abbr text not null check (length(abbr) between 1 and 8),
  pid text check (pid ~ '^p[0-9]{2}[MF][A-E][0-9]{3}$'),
  at_ms bigint not null,                 -- 按下確認的時刻（epoch 毫秒，已校正時差）
  seq double precision not null,         -- 終點次序（可插入兩者之間）
  deleted boolean not null default false,
  created_by text default lower(auth.jwt() ->> 'email'),
  created_at timestamptz not null default now(),
  rev bigint not null default nextval('public.xc_live_rev')
);
create index if not exists xc_live_entries_rev on public.xc_live_entries (event, rev);
create index if not exists xc_live_heats_rev on public.xc_live_heats (event, rev);

drop trigger if exists xc_live_entries_bump on public.xc_live_entries;
create trigger xc_live_entries_bump before update on public.xc_live_entries
  for each row execute function public.xc_live_bump();
drop trigger if exists xc_live_heats_bump on public.xc_live_heats;
create trigger xc_live_heats_bump before update on public.xc_live_heats
  for each row execute function public.xc_live_bump();

alter table public.xc_live_heats enable row level security;
alter table public.xc_live_roster enable row level security;
alter table public.xc_live_entries enable row level security;
revoke all on public.xc_live_heats, public.xc_live_roster, public.xc_live_entries from anon;
revoke delete on public.xc_live_heats, public.xc_live_roster, public.xc_live_entries from authenticated;
grant select, insert, update on public.xc_live_heats, public.xc_live_entries to authenticated;
grant select on public.xc_live_roster to authenticated;
grant usage on sequence public.xc_live_rev to authenticated;

drop policy if exists "live heats admin read" on public.xc_live_heats;
drop policy if exists "live heats admin insert" on public.xc_live_heats;
drop policy if exists "live heats admin update" on public.xc_live_heats;
create policy "live heats admin read" on public.xc_live_heats for select to authenticated using ((select public.xc_is_admin()));
create policy "live heats admin insert" on public.xc_live_heats for insert to authenticated with check ((select public.xc_is_admin()));
create policy "live heats admin update" on public.xc_live_heats for update to authenticated using ((select public.xc_is_admin())) with check ((select public.xc_is_admin()));

drop policy if exists "live entries admin read" on public.xc_live_entries;
drop policy if exists "live entries admin insert" on public.xc_live_entries;
drop policy if exists "live entries admin update" on public.xc_live_entries;
create policy "live entries admin read" on public.xc_live_entries for select to authenticated using ((select public.xc_is_admin()));
create policy "live entries admin insert" on public.xc_live_entries for insert to authenticated with check ((select public.xc_is_admin()));
create policy "live entries admin update" on public.xc_live_entries for update to authenticated using ((select public.xc_is_admin())) with check ((select public.xc_is_admin()));

drop policy if exists "live roster admin read" on public.xc_live_roster;
create policy "live roster admin read" on public.xc_live_roster for select to authenticated using ((select public.xc_is_admin()));

-- 伺服器時間（輸入裝置用來校正時差）
create or replace function public.xc_now()
returns bigint
language sql
stable
set search_path = ''
as $$ select (extract(epoch from clock_timestamp()) * 1000)::bigint $$;
revoke all on function public.xc_now() from public;
grant execute on function public.xc_now() to anon, authenticated;

-- 公眾讀取：只回傳 rev 大於 p_since 的資料，不含號碼布
create or replace function public.xc_live_feed(p_event text, p_since bigint default 0)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'now', (extract(epoch from clock_timestamp()) * 1000)::bigint,
    'heats', coalesce((select json_agg(json_build_object('cat', h.cat, 'heat', h.heat, 'start_ms', h.start_ms, 'status', h.status, 'rev', h.rev))
                       from public.xc_live_heats h where h.event = p_event and h.rev > coalesce(p_since, 0)), '[]'::json),
    'entries', coalesce((select json_agg(json_build_object('id', e.id, 'cat', e.cat, 'heat', e.heat, 'abbr', e.abbr, 'pid', e.pid,
                                                          'at_ms', e.at_ms, 'seq', e.seq, 'deleted', e.deleted, 'rev', e.rev) order by e.rev)
                         from public.xc_live_entries e where e.event = p_event and e.rev > coalesce(p_since, 0)), '[]'::json)
  );
$$;
revoke all on function public.xc_live_feed(text, bigint) from public;
grant execute on function public.xc_live_feed(text, bigint) to anon, authenticated;

-- Supabase 預設會把新函數開放給 anon：收回不需要公開的函數
revoke execute on function public.xc_is_admin() from anon;
revoke execute on function public.xc_live_bump() from anon, authenticated;
