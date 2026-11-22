-- 熱門人氣：瀏覽次數（只存學生編號＋次數，不記錄瀏覽者身份）
create table if not exists public.xc_pids (
  pid text primary key check (pid ~ '^p[0-9]{2}[MF][A-E][0-9]{3}$')
);
create table if not exists public.xc_views (
  pid text primary key references public.xc_pids(pid) on delete cascade,
  views bigint not null default 0 check (views >= 0),
  updated_at timestamptz not null default now()
);

alter table public.xc_pids enable row level security;
alter table public.xc_views enable row level security;

-- 公眾只可讀取人氣數字；不可直接寫入（沒有 insert/update/delete 政策）
drop policy if exists "xc_views public read" on public.xc_views;
create policy "xc_views public read" on public.xc_views for select to anon, authenticated using (true);
revoke insert, update, delete on public.xc_views from anon, authenticated;
revoke all on public.xc_pids from anon, authenticated;

-- 唯一寫入途徑：每次 +1，只接受名單內的學生編號
create or replace function public.xc_hit(p_pid text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare v bigint;
begin
  if p_pid is null or not exists (select 1 from public.xc_pids where pid = p_pid) then
    raise exception 'unknown pid';
  end if;
  insert into public.xc_views as x (pid, views, updated_at) values (p_pid, 1, now())
  on conflict (pid) do update set views = x.views + 1, updated_at = now()
  returning x.views into v;
  return v;
end
$$;
revoke all on function public.xc_hit(text) from public;
grant execute on function public.xc_hit(text) to anon, authenticated;
