"""介面自動測試（Playwright＋本機 Chrome，手機尺寸 375×812）。
用法：python -P -X utf8 -m pytest tests/test_ui.py
"""
import json, pathlib, socket, subprocess, sys, time

import pytest
from playwright.sync_api import sync_playwright, expect

ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA = json.loads((ROOT / "docs/data/results.json").read_text(encoding="utf-8"))
EDS = {e["edition"]: e for e in DATA["editions"]}


def free_port():
    s = socket.socket(); s.bind(("127.0.0.1", 0)); p = s.getsockname()[1]; s.close(); return p


@pytest.fixture(scope="session")
def base_url():
    port = free_port()
    proc = subprocess.Popen([sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1", "--directory", str(ROOT / "docs")],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(50):
        try:
            socket.create_connection(("127.0.0.1", port), timeout=0.2).close(); break
        except OSError:
            time.sleep(0.1)
    yield f"http://127.0.0.1:{port}"
    proc.terminate()


@pytest.fixture(scope="session")
def browser():
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome", headless=True)
        yield b
        b.close()


@pytest.fixture()
def page(browser, base_url):
    ctx = browser.new_context(viewport={"width": 375, "height": 812}, device_scale_factor=2, is_mobile=True, has_touch=True, locale="zh-HK")
    # 測試不依賴外部網絡：Google 字體以空樣式表代替
    ctx.route("https://fonts.googleapis.com/**", lambda r: r.fulfill(status=200, content_type="text/css", body=""))
    ctx.route("https://fonts.gstatic.com/**", lambda r: r.fulfill(status=204, body=""))
    # 測試絕不寫入真實人氣資料庫：攔截 Supabase 請求，以記憶體模擬 xc_hit／xc_views
    views = {}
    def fake_supabase(route):
        req = route.request
        if "/rpc/xc_hit" in req.url:
            pid = json.loads(req.post_data or "{}").get("p_pid")
            views[pid] = views.get(pid, 0) + 1
            return route.fulfill(status=200, content_type="application/json", body=str(views[pid]))
        if "/rest/v1/xc_views" in req.url:
            if "pid=eq." in req.url:
                pid = req.url.split("pid=eq.")[1].split("&")[0]
                body = json.dumps([{"pid": pid, "views": views[pid]}] if pid in views else [])
            else:
                body = json.dumps(sorted(({"pid": k, "views": v} for k, v in views.items()), key=lambda r: -r["views"]))
            return route.fulfill(status=200, content_type="application/json", body=body)
        return route.fulfill(status=404, body="")
    ctx.route("https://*.supabase.co/**", fake_supabase)
    pg = ctx.new_page()
    pg.errors = []
    pg.on("pageerror", lambda e: pg.errors.append(str(e)))
    pg.on("console", lambda m: m.type == "error" and pg.errors.append(m.text))
    pg.base = base_url
    yield pg
    assert not pg.errors, pg.errors
    ctx.close()


def go(page, hash_):
    page.goto(f"{page.base}/{hash_}")
    # 等資料載入完成（載入骨架消失）才開始檢查，避免只等到骨架
    page.wait_for_function("document.querySelector('#view > *') && !document.querySelector('#view .skeleton:not(#popBoard .skeleton)')")


def no_hscroll(page):
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), "出現橫向捲動"


# ---------- 私隱設定 ----------
def test_noindex_and_robots(page):
    go(page, "#/")
    assert page.locator('meta[name="robots"]').get_attribute("content") == "noindex, nofollow"
    assert "Disallow: /" in page.request.get(f"{page.base}/robots.txt").text()
    expect(page.locator(".disclaimer")).to_contain_text("非官方")
    assert page.locator(".disclaimer a").nth(1).get_attribute("href") == "#/privacy"


# ---------- 首頁 ----------
def test_home(page):
    go(page, "#/")
    expect(page.locator(".card")).to_have_count(5)
    expect(page.locator(".dots i")).to_have_count(5)
    expect(page.locator(".quick a")).to_have_count(10)
    expect(page.locator(".dock a")).to_have_count(4)
    expect(page.locator('.dock a[data-nav="home"]')).to_have_class("on")
    champ = EDS[47]["categories"]["MA"]["individual"][0]
    expect(page.locator(".card").first).to_contain_text(champ["name_zh"])
    expect(page.locator(".card").first).to_contain_text(champ["time"])
    no_hscroll(page)


def test_carousel_dots_follow_scroll(page):
    go(page, "#/")
    page.locator(".carousel").evaluate("el => el.scrollTo({left: el.firstElementChild.offsetWidth * 2 + 24})")
    page.wait_for_timeout(300)
    expect(page.locator(".dots i").nth(2)).to_have_class("on")


# ---------- 搜尋 ----------
def test_search_person_and_profile(page):
    go(page, "#/")
    page.fill("#q", "洪子樂")
    first = page.locator(".result").first
    expect(first).to_contain_text("洪子樂")
    first.click()
    expect(page.locator(".hero h1")).to_have_text("洪子樂")
    assert page.input_value("#q") == ""
    pid = page.url.split("/p/")[1]
    n = sum(1 for e in DATA["editions"] for c in e["categories"].values() for r in c["individual"] if r["pid"] == pid)
    expect(page.locator(".tl")).to_have_count(n)
    expect(page.locator(".stat b").first).to_have_text(str(n))
    no_hscroll(page)


def test_search_by_romanisation_and_school(page):
    go(page, "#/")
    page.fill("#q", "hong chi lok")
    expect(page.locator(".result").first).to_contain_text("洪子樂")
    page.fill("#q", "粵華")
    expect(page.locator(".result").first).to_contain_text("粵華")
    page.fill("#q", "zzzzzz")
    expect(page.locator(".empty")).to_be_visible()


# ---------- 排行榜 ----------
def test_rank_full_year_row_count(page):
    go(page, "#/rank?t=ind&e=47&c=MD")
    rows = EDS[47]["categories"]["MD"]["individual"]
    expect(page.locator(".board .row")).to_have_count(len(rows))
    expect(page.locator(".banner")).to_have_count(0)
    expect(page.locator(".board .row").first).to_contain_text(rows[0]["name_zh"])
    no_hscroll(page)


def test_rank_top10_banner(page):
    go(page, "#/rank?t=ind&e=40&c=FA")
    expect(page.locator(".banner")).to_be_visible()
    expect(page.locator(".board .row")).to_have_count(10)


def test_rank_filters_update(page):
    go(page, "#/rank")
    page.click('[data-g="F"]')
    expect(page.locator(".board-head h2")).to_have_text("女子A組")
    page.click('[data-c="FE"]')
    expect(page.locator(".board-head h2")).to_have_text("女子E組")
    page.click('[data-e="45"]')
    expect(page.locator(".board-head .meta")).to_contain_text("第45屆")
    first = EDS[45]["categories"]["FE"]["individual"][0]
    expect(page.locator(".board .row").first).to_contain_text(first["time"])


def test_rank_school_tab(page):
    go(page, "#/rank?t=team&e=47")
    expect(page.locator(".team")).to_have_count(10)
    expect(page.locator(".team").nth(5)).to_contain_text("未設團體獎")
    total = sum(1 for e in DATA["editions"] for c in e["categories"].values() if c["team_champion"])
    shown = page.locator(".medal .total").all_inner_texts()
    assert sum(int(x) for x in shown) == total


def test_highlight_from_profile(page):
    go(page, "#/rank?e=47&c=MA&hl=" + EDS[47]["categories"]["MA"]["individual"][4]["pid"])
    expect(page.locator(".row.mine")).to_have_count(1)


# ---------- 紀錄與趨勢 ----------
def test_records_page(page):
    go(page, "#/records?c=MA")
    expect(page.locator('.dock a[data-nav="records"]')).to_have_class("on")
    all_ma = [r for e in DATA["editions"] for r in e["categories"]["MA"]["individual"]]
    best = min(all_ma, key=lambda r: r["seconds"])
    expect(page.locator(".rec-time")).to_have_text(best["time"])
    expect(page.locator("#trend polyline")).to_have_count(2)
    expect(page.locator("#trend circle")).to_have_count(20)
    expect(page.locator(".board").first.locator(".row")).to_have_count(10)
    expect(page.locator("#fin .bar")).to_have_count(4)
    expect(page.locator(".board").nth(1).locator(".medal")).to_have_count(10)
    page.click("#trend summary")
    expect(page.locator("#trend tbody tr")).to_have_count(10)
    no_hscroll(page)


def test_records_chart_keyboard_tooltip(page):
    go(page, "#/records?c=FB")
    page.focus("#trend svg")
    expect(page.locator("#trend .tip")).to_be_visible()
    page.keyboard.press("ArrowLeft")
    expect(page.locator("#trend .tip .th")).to_have_text("24/25")


def test_records_category_switch(page):
    go(page, "#/records?c=MA")
    page.click('[data-c="MC"]')
    expect(page.locator(".record .label")).to_contain_text("男子C組")


# ---------- 語言 ----------
def test_language_toggle_persists(page):
    go(page, "#/rank")
    page.click("#langBtn")
    expect(page.locator(".seg button").first).to_have_text("Individual")
    expect(page.locator("#q")).to_have_attribute("placeholder", "Search name, romanised name or school")
    page.reload(); page.wait_for_selector("#view > *")
    expect(page.locator(".dock .lbl").first).to_have_text("Home")
    page.click("#langBtn")
    expect(page.locator(".dock .lbl").first).to_have_text("首頁")


# ---------- 錯誤路徑 ----------
def test_not_found_routes(page):
    go(page, "#/nothing")
    expect(page.locator(".wip h2")).to_be_visible()
    go(page, "#/p/p99999")
    expect(page.locator(".wip h2")).to_be_visible()


# ---------- 所有頁面無橫向捲動、底部按鈕不遮內容 ----------
@pytest.mark.parametrize("h", ["#/", "#/rank?t=team&e=44", "#/records?c=FE", "#/athletes", "#/athletes?tab=schools", "#/s/YW", "#/p/" + EDS[47]["categories"]["FA"]["individual"][0]["pid"]])
def test_layout_fits_phone(page, h):
    go(page, h)
    no_hscroll(page)
    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    page.wait_for_timeout(200)
    footer_bottom = page.locator(".disclaimer").evaluate("el => el.getBoundingClientRect().bottom")
    dock_top = page.locator(".dock").evaluate("el => el.getBoundingClientRect().top")
    assert footer_bottom <= dock_top + 1, "頁尾被底部按鈕遮住"


# ---------- 設計規範（美觀審查後加入的回歸測試） ----------
@pytest.mark.parametrize("h", ["#/", "#/rank?e=47&c=MA", "#/records?c=MA", "#/athletes", "#/s/YW"])
def test_touch_targets_at_least_40px(page, h):
    """主要可按控制（按鈕、膠囊、組別鈕、底部導覽）高度不少於 40px。"""
    go(page, h)
    small = page.evaluate("""() => [...document.querySelectorAll('button, .chip, .dock a, .quick a, .row, .tl, .lang, .seg button')]
        .map(e => ({t: (e.textContent || '').trim().slice(0, 12), h: e.getBoundingClientRect().height}))
        .filter(x => x.h && x.h < 40)""")
    assert not small, small


def test_no_dash_characters_in_visible_text(page):
    for h in ["#/", "#/rank?t=team&e=44", "#/records?c=FA", "#/athletes", "#/s/KP", "#/rank?e=46&c=FD"]:
        go(page, h)
        txt = page.evaluate("document.body.innerText")
        assert "—" not in txt and "–" not in txt, h


def test_dock_marks_current_page(page):
    go(page, "#/rank")
    assert page.locator('.dock a[aria-current="page"]').get_attribute("data-nav") == "rank"


# ---------- 第 48 屆預覽、校徽、在讀／畢業 ----------
def test_home_race_banner(page):
    go(page, "#/")
    expect(page.locator(".race-banner")).to_be_visible()
    expect(page.locator(".race-banner")).to_contain_text("第48屆")


def test_preview_page(page):
    pv = json.loads((ROOT / "docs/data/preview48.json").read_text(encoding="utf-8"))
    go(page, "#/preview?c=FB")
    expect(page.locator(".pv-row")).to_have_count(len(pv["categories"]["FB"]["starters"]))
    expect(page.locator(".dist-pair")).to_contain_text("4,110")
    expect(page.locator(".dist-pair")).to_contain_text("4,500")
    expect(page.locator(".pv-row .crest").first).to_be_visible()
    no_hscroll(page)


def test_crests_in_leaderboard(page):
    go(page, "#/rank?e=47&c=MB")
    expect(page.locator(".row .crest")).to_have_count(len(EDS[47]["categories"]["MB"]["individual"]))
    assert page.locator(".row").nth(1).locator(".crest").get_attribute("title") == "濠江中學"


def test_status_on_profiles(page):
    # 第 47 屆男A冠軍若不在今屆名單 → 已畢業；在今屆名單 → 在讀・今屆參賽
    pv = json.loads((ROOT / "docs/data/preview48.json").read_text(encoding="utf-8"))
    entered = {s["pid"] for v in pv["categories"].values() for s in v["starters"]}
    for r in EDS[47]["categories"]["MA"]["individual"][:5]:
        go(page, f"#/p/{r['pid']}")
        expect(page.locator(".st-line .st")).to_have_text("在讀・今屆參賽" if r["pid"] in entered else "已畢業")


# ---------- 嚴謹核對：網頁實際顯示與資料逐行一致 ----------
def test_all_leaderboards_render_exactly(page):
    """全部 10 屆 × 10 組排行榜：畫面上每行的名次、姓名、學校、校徽、成績與資料完全一致。"""
    bad = []
    for ed in range(38, 48):
        for c in ["MA", "MB", "MC", "MD", "ME", "FA", "FB", "FC", "FD", "FE"]:
            go(page, f"#/rank?t=ind&e={ed}&c={c}")
            got = page.evaluate("""() => [...document.querySelectorAll('.board .row')].map(r => [
                r.querySelector('.rank').textContent.trim(),
                r.querySelector('.nm').childNodes[0].textContent.trim(),
                r.querySelector('.sch').textContent.trim(),
                r.querySelector('.crest').getAttribute('title'),
                r.querySelector('.tm').childNodes[0].textContent.trim()])""")
            exp = [[str(r["rank"]), r["name_zh"] or r["name_pt"], r["school_zh"], r["school_zh"], r["time"]] for r in EDS[ed]["categories"][c]["individual"]]
            if got != exp:
                bad.append((ed, c, next((g, e) for g, e in zip(got + [None] * 99, exp) if g != e)))
    assert not bad, bad[:5]


def test_all_preview_rows_render_exactly(page):
    """10 組預覽：每行的姓名、今屆學校、校徽與預覽資料一致，點入個人檔案後姓名相同。"""
    pv = json.loads((ROOT / "docs/data/preview48.json").read_text(encoding="utf-8"))
    name_of = {}
    for e in DATA["editions"]:
        for cat in e["categories"].values():
            for r in cat["individual"]:
                name_of[r["pid"]] = r["name_zh"] or r["name_pt"]
    for c, v in pv["categories"].items():
        go(page, f"#/preview?c={c}")
        got = page.evaluate("""() => [...document.querySelectorAll('.pv-row')].map(r => [r.getAttribute('href').slice(4),
            r.querySelector('.nm').childNodes[0].textContent.trim(), r.querySelector('.sch').textContent.split(' · ')[0].trim(),
            r.querySelector('.crest').getAttribute('title')])""")
        exp = {s["pid"]: s["school_zh"] for s in v["starters"]}
        assert len(got) == len(exp), c
        for pid, nm, sch, cr in got:
            assert nm == name_of[pid] and sch == exp[pid] and cr == exp[pid], (c, pid, nm, sch, cr)


def test_privacy_page_and_back_button(page):
    go(page, "#/")
    page.click('.disclaimer a[href="#/privacy"]')
    expect(page.locator(".page-title")).to_have_text("私隱及資料使用")
    expect(page.locator("#remove")).to_be_visible()
    page.click("#backBtn")
    expect(page.locator(".race-banner")).to_be_visible()


def test_back_button_direct_link_goes_home(page):
    go(page, "#/p/" + EDS[47]["categories"]["MA"]["individual"][0]["pid"])
    expect(page.locator("#backBtn")).to_be_visible()
    page.click("#backBtn")
    expect(page.locator(".carousel")).to_be_visible()


def test_real_crests_used_where_available(page):
    crests = json.loads((ROOT / "docs/data/crests.json").read_text(encoding="utf-8"))["images"]
    assert len(crests) >= 17
    go(page, "#/rank?e=47&c=MA")
    rows = page.evaluate("""() => [...document.querySelectorAll('.board .row')].map(r => [r.querySelector('.sch').textContent.trim(), !!r.querySelector('.crest img')])""")
    schools = json.loads((ROOT / "docs/data/results.json").read_text(encoding="utf-8"))["schools"]
    for sch, has_img in rows:
        assert has_img == (schools[sch]["abbr"] in crests), sch
    for f in crests.values():
        assert page.request.get(f"{page.base}/{f}").ok, f


def test_removal_form_link(page):
    site = json.loads((ROOT / "docs/data/site.json").read_text(encoding="utf-8"))
    go(page, "#/privacy")
    a = page.locator(".btn-primary")
    expect(a).to_be_visible()
    assert a.get_attribute("href") == site["removal_url"] and "docs.google.com/forms" in site["removal_url"]
    assert a.get_attribute("rel") == "noopener" and a.get_attribute("target") == "_blank"


def test_prediction_view(page):
    pv = json.loads((ROOT / "docs/data/preview48.json").read_text(encoding="utf-8"))
    go(page, "#/preview?c=MA")
    page.click('[data-v="pred"]')
    expect(page.locator(".pd-row")).to_have_count(len(pv["categories"]["MA"]["prediction"]))
    expect(page.locator(".pd-note")).to_contain_text("推算預測")
    expect(page.locator(".pd-note")).to_contain_text("濠江")
    expect(page.locator(".pd-row").first).to_contain_text("預測首名")
    no_hscroll(page)


def test_popularity_tab_demo(page):
    go(page, "#/p/" + EDS[47]["categories"]["MA"]["individual"][0]["pid"])
    expect(page.locator("#lvCorner")).to_be_visible()
    expect(page.locator("#popViews")).to_have_text("1")
    go(page, "#/rank?t=pop")
    expect(page.locator(".live.on")).to_be_visible()  # 已接資料庫：顯示「實時」
    expect(page.locator(".podium")).to_have_count(1)


def test_preview_title_and_hero(page):
    go(page, "#/preview?c=MA")
    expect(page.locator(".pv-title")).to_contain_text("第四十八屆學界越野跑比賽")
    expect(page.locator(".pv-title small")).to_have_text("48° Campeonato Escolar de Corta-Mato")
    expect(page.locator("#pvCarousel .card")).to_have_count(6)
    for img in ["arch", "champ", "runner", "girls", "start", "podium"]:
        assert page.request.get(f"{page.base}/img/race/{img}.jpg").ok, img
    expect(page.locator("#pvCarousel .card").nth(1).locator(".mini-row")).to_have_count(10)
    no_hscroll(page)


# ---------- 第六輪：運動員／學校名錄、互相連結、比賽天氣 ----------
WX = json.loads((ROOT / "docs/data/weather.json").read_text(encoding="utf-8"))


def test_dock_has_four_tabs(page):
    go(page, "#/")
    expect(page.locator(".dock a")).to_have_count(4)
    assert page.locator(".dock .lbl").all_inner_texts() == ["首頁", "歷屆成績", "運動員", "紀錄與趨勢"]
    expect(page.locator(".entry a")).to_have_count(4)
    expect(page.locator(".card-more")).to_have_count(5)


def test_athlete_directory_filters(page):
    go(page, "#/athletes?k=champ&g=F")
    expect(page.locator('.dock a[aria-current="page"]')).to_have_attribute("data-nav", "athletes")
    champs = {r["pid"] for e in DATA["editions"] for c, v in e["categories"].items() if c[0] == "F" for r in v["individual"] if r["rank"] == 1 and not r.get("hidden")}
    expect(page.locator(".board-head h2")).to_have_text(f"共 {len(champs)} 名運動員")
    hrefs = page.locator("#athList a").evaluate_all("els => els.map(e => e.getAttribute('href').slice(4))")
    assert set(hrefs) <= champs and len(hrefs) == min(40, len(champs))
    page.select_option("#athSchool", "KP")
    page.wait_for_function("location.hash.includes('s=KP')")
    for t in page.locator("#athList .sch").all_inner_texts():
        assert t  # 每行有校名
    no_hscroll(page)


def test_school_page_counts(page):
    go(page, "#/s/YW")
    names = {zh for zh, s in DATA["schools"].items() if s.get("abbr") == "YW"}
    titles = sum(1 for e in DATA["editions"] for v in e["categories"].values() if v["team_champion"] and v["team_champion"]["school_zh"] in names)
    expect(page.locator(".stats4 .stat b").first).to_have_text(str(titles))
    expect(page.locator(".back")).to_be_visible()
    no_hscroll(page)


def test_links_between_pages(page):
    go(page, "#/rank?t=team&e=47")
    page.locator(".team a.sl-link").first.click()
    page.wait_for_function("location.hash.startsWith('#/s/')")
    expect(page.locator(".school-hero h1")).to_be_visible()
    go(page, "#/rank?e=47&c=MA")
    page.click(".link-row a >> nth=0")
    page.wait_for_function("location.hash.startsWith('#/records?c=MA')")
    go(page, "#/")
    page.locator(".card .bars a").first.click()
    page.wait_for_function("location.hash.startsWith('#/s/')")


def test_weather_on_rank_and_records(page):
    go(page, "#/rank?e=46&c=FD")
    w = next(x for x in WX["races"] if x["edition"] == 46 and x.get("cats") == "DE")
    expect(page.locator(".wx summary")).to_contain_text(f"濕度 {w['rh_avg']}%")
    go(page, "#/rank?e=46&c=MA")
    w = next(x for x in WX["races"] if x["edition"] == 46 and x.get("cats") == "ABC")
    expect(page.locator(".wx summary")).to_contain_text("有雨")
    page.click(".wx summary")
    expect(page.locator(".wx .wx-note")).to_contain_text("天雨延期")
    go(page, "#/records?c=MA&go=wx")
    expect(page.locator(".wxrow")).to_have_count(len(DATA["editions"]))
    no_hscroll(page)


def test_weather_data_sane():
    eds = {e["edition"] for e in DATA["editions"]}
    assert eds <= {w["edition"] for w in WX["races"]}
    for w in WX["races"]:
        assert 5 <= w["temp_min"] <= w["temp_max"] <= 35, w
        assert 20 <= w["rh_avg"] <= 100 and w["obs"] >= 4, w
        assert w["basis"] in ("actual", "planned")
