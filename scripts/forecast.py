"""第 48 屆比賽當日天氣預測 → docs/data/forecast48.json

資料：澳門地球物理氣象局（SMG）七天天氣預報 XML（中文 c_7daysforecast.xml、英文 e_7daysforecast.xml）。
只在比賽日落入七天預報範圍內才輸出預測；否則輸出 available: false。
跑步影響估計沿用 weather.py（歷屆比賽天氣）的「氣溫＋露點」經驗表：以預報最高／最低氣溫及濕度的平均值估算，
屬粗略估計，網站會註明。

用法：python -P -X utf8 scripts/forecast.py docs/data/race48.json docs/data/forecast48.json
比賽前每日重跑一次（預報每日更新），再 push。
"""
import json, math, re, sys, urllib.request, datetime as dt, xml.etree.ElementTree as ET

URL = {"zh": "https://xml.dsmg.gov.mo/c_7daysforecast.xml", "en": "https://xml.dsmg.gov.mo/e_7daysforecast.xml"}


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "xc-results-forecast"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return ET.fromstring(r.read())


def values(node, tag):
    return {t.find("Type").text: (lambda v: int(v) if v.is_integer() else v)(float(t.find("Value").text)) for t in node.findall(tag)}


def dew(t, rh):  # Magnus 公式
    a, b = 17.62, 243.12
    g = math.log(rh / 100) + a * t / (b + t)
    return b * g / (a - g)


def main(race_p, out_p):
    race = json.load(open(race_p, encoding="utf-8"))
    day = race["date"]
    docs = {k: fetch(u) for k, u in URL.items()}
    pub = docs["zh"].find(".//SysPubdate").text
    found = {k: next((w for w in d.iter("WeatherForecast") if w.find("ValidFor").text == day), None) for k, d in docs.items()}
    out = {"_note": "第 48 屆比賽當日天氣預測，取自澳門地球物理氣象局七天天氣預報；跑步影響以預報最高／最低氣溫及濕度的平均值粗略估算。",
           "source": "澳門地球物理氣象局七天天氣預報", "source_en": "Macao Meteorological and Geophysical Bureau 7-day forecast",
           "source_url": "https://www.dsmg.gov.mo/zh-hant", "date": day, "published": pub, "generated": dt.date.today().isoformat()}
    if found["zh"] is None:
        out["available"] = False
    else:
        w = found["zh"]
        T, H = values(w, "Temperature"), values(w, "Humidity")
        t_max, t_min, h_max, h_min = T["1"], T["2"], H["1"], H["2"]
        t_avg, h_avg = (t_max + t_min) / 2, (h_max + h_min) / 2
        d_avg = dew(t_avg, h_avg)
        idx = (t_avg * 9 / 5 + 32) + (d_avg * 9 / 5 + 32)
        table = [(100, 0, 0), (110, 0, .5), (120, .5, 1), (130, 1, 2), (140, 2, 3), (150, 3, 4.5), (160, 4.5, 6), (170, 6, 8), (180, 8, 10)]
        lo, hi = next(((a, b) for lim, a, b in table if idx <= lim), (10, 12))
        level = "good" if idx <= 120 else "mild" if idx <= 140 else "hard" if idx <= 160 else "severe"
        zh, en = w.find("WeatherDescription").text.strip(), found["en"].find("WeatherDescription").text.strip() if found["en"] is not None else ""
        wind_zh = (re.search(r"吹[^。]*風", zh) or [None])[0]
        wind_en = (re.search(r"Force[^.]*winds?", en) or [None])[0]
        rain = bool(re.search(r"雨|雷暴", zh))
        out.update({"available": True, "status": w.find("WeatherStatus").text, "temp_min": t_min, "temp_max": t_max,
                    "rh_min": h_min, "rh_max": h_max, "desc_zh": zh, "desc_en": re.sub(r"\s+", " ", en),
                    "wind_zh": wind_zh, "wind_en": wind_en, "rain": rain,
                    "run_index": round(idx), "slow_pct": [lo, hi], "level": level})
    json.dump(out, open(out_p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(json.dumps(out, ensure_ascii=False))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
