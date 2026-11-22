"""取得歷屆比賽當日天氣 → docs/data/weather.json

資料：澳門國際機場（ICAO VMMC／WMO 45011）每半小時發布的航空例行天氣報告（METAR），
經 Ogimet 公開氣象報告庫取得；含氣溫、露點（相對濕度由兩者計算）、風速及天氣現象（雨、驟雨、雷暴等）。
觀測站位於氹仔，距松山約 5 公里，數值僅供比較各屆條件。

用法：python -P -X utf8 scripts/weather.py docs/data/weather.json
"""
import json, math, re, sys, time, urllib.request, pathlib, datetime as dt

STATION = "45011099999"
# 比賽日期：actual＝有賽後報道或秩序冊核實；planned＝學校運作指南的計劃日期，未找到賽後報道核實
RACES = [
    {"edition": 38, "date": "2016-11-13", "start": "08:00", "end": "12:30", "basis": "planned"},
    {"edition": 39, "date": "2017-11-12", "start": "08:00", "end": "12:30", "basis": "planned"},
    {"edition": 40, "date": "2018-11-11", "start": "08:00", "end": "12:30", "basis": "planned"},
    {"edition": 41, "date": "2019-11-10", "start": "08:30", "end": "12:30", "basis": "actual"},
    {"edition": 42, "date": "2020-11-15", "start": "08:00", "end": "12:30", "basis": "planned"},
    {"edition": 43, "date": "2022-04-24", "start": "08:00", "end": "12:30", "basis": "actual"},
    {"edition": 44, "date": "2022-11-13", "start": "08:00", "end": "12:30", "basis": "planned"},
    {"edition": 45, "date": "2023-11-26", "start": "08:00", "end": "12:30", "basis": "planned"},
    {"edition": 46, "date": "2024-11-24", "start": "08:00", "end": "11:30", "basis": "actual", "cats": "ABC",
     "note_zh": "D、E 組因天雨延期", "note_en": "D and E races postponed because of rain"},
    {"edition": 46, "date": "2025-01-18", "start": "10:00", "end": "11:45", "basis": "actual", "cats": "DE",
     "note_zh": "D、E 組延期補賽", "note_en": "Rescheduled D and E races"},
    {"edition": 47, "date": "2025-11-30", "start": "08:30", "end": "12:30", "basis": "actual"},
]
SOURCES = {
    "planned": "教育及青年發展局《學校運作指南》學界體育比賽總表（計劃舉行日期）",
    38: "《2016/2017 學校年度學校運作指南》第六章", 39: "《2017/2018 學校年度學校運作指南》第六章",
    40: "《2018/2019 學校年度學校運作指南》第六章（賽後報道提及當日天氣炎熱）", 41: "第四十一屆秩序冊",
    42: "《2020/2021 學校年度學校運作指南》第六章", 43: "參賽學校賽後報道（原定 2022 年 2 月下旬，因疫情押後）",
    44: "《2022/2023 學校年度學校運作指南》第六章", 45: "《2023/2024 學校年度學校運作指南》第六章",
    46: "政府新聞局新聞稿（2024-11-24）及 D、E 組補賽秩序冊", 47: "《澳門體育週報》賽後報道及 2025/2026 學年比賽總表",
}


def metars(t0, t1):
    url = f"https://www.ogimet.com/cgi-bin/getmetar?icao=VMMC&begin={t0:%Y%m%d%H%M}&end={t1:%Y%m%d%H%M}"
    for i in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (xc-results weather script)"})
            txt = urllib.request.urlopen(req, timeout=60).read().decode("utf-8", "ignore")
            if "METAR VMMC" in txt: return [l.split(",", 6)[6] for l in txt.splitlines() if "METAR VMMC" in l and " NIL" not in l]
        except Exception:
            pass
        time.sleep(15 * (i + 1))
    raise RuntimeError("Ogimet 無回應：" + url)


def rh(t, d):
    """Magnus 公式：由氣溫及露點計算相對濕度"""
    a, b = 17.625, 243.04
    return 100 * math.exp(a * d / (b + d)) / math.exp(a * t / (b + t))


def tnum(x): return -int(x[1:]) if x.startswith("M") else int(x)


def main(out):
    res = []
    for r in RACES:
        d = dt.date.fromisoformat(r["date"])
        # 本地時間（UTC+8）→ UTC
        s_h, s_m = map(int, r["start"].split(":")); e_h, e_m = map(int, r["end"].split(":"))
        t0 = dt.datetime(d.year, d.month, d.day, s_h, s_m) - dt.timedelta(hours=8)
        t1 = dt.datetime(d.year, d.month, d.day, e_h, e_m) - dt.timedelta(hours=8)
        T, D, H, W, wet = [], [], [], [], 0
        for m in metars(t0, t1):
            tm = re.search(r" (M?\d\d)/(M?\d\d) ", m)
            if not tm: continue
            t, dp = tnum(tm.group(1)), tnum(tm.group(2))
            T.append(t); D.append(dp); H.append(rh(t, dp))
            wd = re.search(r" (\d{3}|VRB)(\d{2})(G\d{2})?KT ", m)
            if wd: W.append(int(wd.group(2)) * 1.852)
            body = m.split(" NOSIG")[0].split(" BECMG")[0].split(" TEMPO")[0]
            if re.search(r" (\+|-)?(TS|SH|VC)?(RA|DZ|SHRA|TSRA)\b", body): wet += 1
        time.sleep(8)
        t_avg = sum(T) / len(T); d_avg = sum(D) / len(D)
        # 跑步天氣指數：氣溫＋露點（華氏），即長跑常用的配速調整經驗表（Hadley）：
        # ≤100 無影響；101–110 0–0.5%；111–120 0.5–1%；121–130 1–2%；131–140 2–3%；141–150 3–4.5%；151–160 4.5–6%；161–170 6–8%；171–180 8–10%
        idx = (t_avg * 9 / 5 + 32) + (d_avg * 9 / 5 + 32)
        table = [(100, 0, 0), (110, 0, .5), (120, .5, 1), (130, 1, 2), (140, 2, 3), (150, 3, 4.5), (160, 4.5, 6), (170, 6, 8), (180, 8, 10)]
        lo, hi = next(((a, b) for lim, a, b in table if idx <= lim), (10, 12))
        level = "good" if idx <= 120 else "mild" if idx <= 140 else "hard" if idx <= 160 else "severe"
        item = {
            "edition": r["edition"], "date": r["date"], "window": f"{r['start']}–{r['end']}", "basis": r["basis"],
            "temp_min": round(min(T), 1), "temp_max": round(max(T), 1), "temp_avg": round(t_avg, 1),
            "rh_avg": round(sum(H) / len(H)), "rh_max": round(max(H)), "dew_avg": round(d_avg, 1),
            "wind_avg": round(sum(W) / len(W)) if W else None,
            "rain_reports": wet, "obs": len(T), "run_index": round(idx), "slow_pct": [lo, hi], "level": level,
            "date_source": SOURCES.get(r["edition"]),
        }
        for k in ("cats", "note_zh", "note_en"):
            if k in r: item[k] = r[k]
        res.append(item)
        print(item["edition"], item["date"], item["temp_min"], item["temp_max"], item["rh_avg"], item["rain_reports"], item["run_index"], item["slow_pct"], item["level"])
    doc = {
        "_note": "歷屆比賽時段天氣。觀測站：澳門國際機場（WMO 45011，位於氹仔，距松山約 5 公里），數值只作比較各屆條件之用。basis＝actual 表示日期已由秩序冊或賽後報道核實；planned 表示採用《學校運作指南》的計劃日期。run_index＝氣溫＋露點（華氏），愈高愈不利長跑。",
        "station_zh": "澳門國際機場氣象站", "station_en": "Macau International Airport weather station",
        "source": "澳門國際機場 METAR（經 Ogimet 取得）", "source_en": "Macau International Airport METAR reports (via Ogimet)",
        "source_url": "https://www.ogimet.com/",
        "generated": dt.date.today().isoformat(),
        "races": res,
    }
    pathlib.Path(out).write_text(json.dumps(doc, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main(sys.argv[1])
