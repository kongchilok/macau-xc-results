-- 公開出戰名單（賽前預覽「學校名單」及即時成績團體排名下拉名單）
-- 須在 005_live_laps.sql 之後執行；可重複執行
-- 只回傳 組別、分組、學校代碼、已公開往績者的學生編號、秩序冊姓名（應要求隱藏者為空），以及號碼布雜湊 k（與 xc_live_feed 相同，用來對應即時紀錄）
-- 不回傳號碼布；按 組別、分組、學校、姓名 排序，不按號碼布排序

create or replace function public.xc_live_roster_public(p_event text)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(json_agg(json_build_object('k', left(md5(r.event || ':' || r.bib::text), 12), 'cat', r.cat, 'heat', r.heat,
                                             'abbr', r.abbr, 'pid', r.pid, 'name', r.name)
                           order by r.cat, r.heat nulls first, r.abbr, r.name), '[]'::json)
  from public.xc_live_roster r
  where r.event = p_event;
$$;
revoke all on function public.xc_live_roster_public(text) from public;
grant execute on function public.xc_live_roster_public(text) to anon, authenticated;
