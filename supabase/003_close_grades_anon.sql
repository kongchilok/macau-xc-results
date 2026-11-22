-- 2026-11-22：關閉 grades 表的匿名全開規則（使用者同意）。
-- 原因：同一項目的 publishable key 會放在公開網站前端；原政策「Allow anon full access for demo」令任何人可讀寫刪 grades。
-- 表及資料保留；如另一工具需要存取，請改用需登入驗證的政策。
drop policy if exists "Allow anon full access for demo" on public.grades;
alter table public.grades enable row level security;
revoke all on public.grades from anon;
