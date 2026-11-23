-- 第 48 屆「完賽紀念卡」（非官方）：工作人員逐組與官方成績核對後開放
-- 須在 006_roster_public.sql 之後執行；可重複執行
-- xc_live_cert：核對後的完賽名次及時間快照（只限管理員讀寫）
-- xc_live_cert_lookup：公眾以「號碼布＋姓名」查自己的紀錄；兩者都要對得上才回傳，
--   不能單憑號碼布逐個查出姓名；不回傳號碼布以外的其他人資料

create table if not exists public.xc_live_cert (
  event text not null,
  cat text not null,
  bib int not null,
  place int not null,
  time_ms int,
  released_at timestamptz not null default now(),
  released_by uuid default auth.uid(),
  primary key (event, cat, bib)
);
alter table public.xc_live_cert enable row level security;

drop policy if exists "live cert admin read" on public.xc_live_cert;
drop policy if exists "live cert admin insert" on public.xc_live_cert;
drop policy if exists "live cert admin update" on public.xc_live_cert;
drop policy if exists "live cert admin delete" on public.xc_live_cert;
create policy "live cert admin read" on public.xc_live_cert for select to authenticated using ((select public.xc_is_admin()));
create policy "live cert admin insert" on public.xc_live_cert for insert to authenticated with check ((select public.xc_is_admin()));
create policy "live cert admin update" on public.xc_live_cert for update to authenticated using ((select public.xc_is_admin())) with check ((select public.xc_is_admin()));
create policy "live cert admin delete" on public.xc_live_cert for delete to authenticated using ((select public.xc_is_admin()));

-- 已開放的組別（公眾頁用來顯示「已開放」組別，不含個人資料）
create or replace function public.xc_live_cert_cats(p_event text)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(json_agg(json_build_object('cat', c.cat, 'n', c.n, 'at', c.at) order by c.cat), '[]'::json)
  from (select cat, count(*) as n, max(released_at) as at from public.xc_live_cert where event = p_event group by cat) c;
$$;
revoke all on function public.xc_live_cert_cats(text) from public;
grant execute on function public.xc_live_cert_cats(text) to anon, authenticated;

-- 號碼布＋姓名查詢：姓名比較時忽略大小寫、空格及標點
create or replace function public.xc_live_cert_lookup(p_event text, p_bib int, p_name text)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object('cat', r.cat, 'heat', r.heat, 'abbr', r.abbr, 'pid', r.pid, 'name', r.name,
                           'place', c.place, 'time_ms', c.time_ms, 'finishers', (select count(*) from public.xc_live_cert x where x.event = c.event and x.cat = c.cat),
                           'released_at', c.released_at)
  from public.xc_live_roster r
  join public.xc_live_cert c on c.event = r.event and c.bib = r.bib and c.cat = r.cat
  where r.event = p_event and r.bib = p_bib
    and coalesce(r.name, '') <> ''
    and length(coalesce(p_name, '')) between 2 and 60
    and regexp_replace(lower(r.name), '[[:space:][:punct:]・，、]', '', 'g') = regexp_replace(lower(p_name), '[[:space:][:punct:]・，、]', '', 'g')
  limit 1;
$$;
revoke all on function public.xc_live_cert_lookup(text, int, text) from public;
grant execute on function public.xc_live_cert_lookup(text, int, text) to anon, authenticated;
