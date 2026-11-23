-- 即時成績：分段計時（每圈記錄）＋公眾頁顯示姓名
-- 須在 004_live.sql 之後執行；可重複執行
-- 改動：
--   * 號碼布對照及終點紀錄加 name（秩序冊已公開的姓名；應要求隱藏者留空）
--   * 終點紀錄加 fin（工作人員標明此次經過即完賽，例如漏記一圈時）及 force（確認不是重複紀錄）
--   * 公眾 feed 加回傳 k（號碼布的雜湊，用來把同一人的各圈歸在一起，但不公開號碼布）、name、fin、force

alter table public.xc_live_roster add column if not exists name text check (name is null or length(name) <= 60);
alter table public.xc_live_entries add column if not exists name text check (name is null or length(name) <= 60);
alter table public.xc_live_entries add column if not exists fin boolean not null default false;
alter table public.xc_live_entries add column if not exists force boolean not null default false;

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
                                                          'k', case when e.bib is null then null else left(md5(e.event || ':' || e.bib::text), 12) end,
                                                          'name', e.name, 'fin', e.fin, 'force', e.force,
                                                          'at_ms', e.at_ms, 'seq', e.seq, 'deleted', e.deleted, 'rev', e.rev) order by e.rev)
                         from public.xc_live_entries e where e.event = p_event and e.rev > coalesce(p_since, 0)), '[]'::json)
  );
$$;
revoke all on function public.xc_live_feed(text, bigint) from public;
grant execute on function public.xc_live_feed(text, bigint) to anon, authenticated;
