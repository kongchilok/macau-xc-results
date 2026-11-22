"""第 48 屆預測排名：以往績及進步幅度推算，並用第 46、47 屆回測。
用法：python scripts/predict.py docs/data/results.json docs/data/preview48.json

方法（各屆距離不同，不能直接比時間，所以用「相對冠軍」的實力指數）：
  r = 選手成績 ÷ 該場冠軍成績（1.000＝冠軍；1.050＝比冠軍慢 5%）
  1. 由歷史數據計出兩種轉變的典型變化（中位數）：
       same：明年留在同一組（組內第二年，通常進步）
       up  ：明年升上較高組別（年紀最小，通常退步）
  2. 預測 r = 最近一次 r ＋ 該轉變的典型變化 ＋ w ×（個人上一年變化 − 典型變化）
     w 由回測選出（個人趨勢的權重）
  3. 只推算最近一次出賽在 1–2 屆內的選手；沒有足夠往績者不列出
  4. 相鄰兩人預測指數相差少於 CLOSE 視為「實力接近」，CLOSE 亦由回測校準
"""
import json, statistics, sys
from collections import defaultdict

res_p, pv_p = sys.argv[1], sys.argv[2]
DATA = json.load(open(res_p, encoding="utf-8"))
PV = json.load(open(pv_p, encoding="utf-8"))
LET = "ABCDE"

# 每人每屆的實力指數
hist = defaultdict(list)  # pid -> [(edition, cat, r)]
for e in DATA["editions"]:
    for c, cat in e["categories"].items():
        ind = cat["individual"]
        if not ind: continue
        win = ind[0].get("precise") or ind[0]["seconds"]
        for r in ind:
            t = r.get("precise") or r["seconds"]
            hist[r["pid"]].append((e["edition"], c, t / win))
for v in hist.values():
    v.sort()


def kind(c0, c1):
    if c0 == c1: return "same"
    if c0[0] == c1[0] and LET.index(c1[1]) < LET.index(c0[1]): return "up"
    return None


def typical_deltas(max_edition):
    """只用 max_edition 或之前的數據計典型變化，避免回測時偷看答案。"""
    d = defaultdict(list)
    for recs in hist.values():
        recs = [x for x in recs if x[0] <= max_edition]
        for (e0, c0, r0), (e1, c1, r1) in zip(recs, recs[1:]):
            k = kind(c0, c1)
            if e1 - e0 == 1 and k: d[k].append(r1 - r0)
    return {k: statistics.median(v) for k, v in d.items() if len(v) >= 10}


def predict(target_ed, target_cat, pids, w):
    """預測 target_ed 屆 target_cat 組這批 pid 的實力指數；回傳 {pid: r}（無法推算者不在內）。"""
    td = typical_deltas(target_ed - 1)
    out = {}
    for pid in pids:
        recs = [x for x in hist.get(pid, []) if x[0] < target_ed]
        if not recs: continue
        e0, c0, r0 = recs[-1]
        gap = target_ed - e0
        k = kind(c0, target_cat)
        if gap > 2 or k is None or k not in td: continue
        rp = r0 + td[k]
        if len(recs) >= 2:
            ep, cp, rprev = recs[-2]
            kp = kind(cp, c0)
            if e0 - ep == 1 and kp in td:
                rp += w * ((r0 - rprev) - td[kp])
        out[pid] = max(rp, 0.95)
    return out


def spearman(a, b):
    n = len(a)
    if n < 3: return None
    ra = {x: i for i, x in enumerate(a)}; rb = {x: i for i, x in enumerate(b)}
    d2 = sum((ra[x] - rb[x]) ** 2 for x in a)
    return 1 - 6 * d2 / (n * (n * n - 1))


def backtest(w, close):
    """以第 46、47 屆實際參賽者回測。"""
    rhos, top3_hit, top3_tot, close_pairs, close_swaps, far_pairs, far_swaps = [], 0, 0, 0, 0, 0, 0
    eds = {e["edition"]: e for e in DATA["editions"]}
    for ed in (46, 47):
        for c, cat in eds[ed]["categories"].items():
            actual = [r["pid"] for r in cat["individual"]]
            pred = predict(ed, c, actual, w)
            if len(pred) < 3: continue
            act_order = [p for p in actual if p in pred]
            pred_order = sorted(pred, key=pred.get)
            rho = spearman(pred_order, act_order)
            if rho is not None: rhos.append(rho)
            top3_hit += len(set(pred_order[:3]) & set(act_order[:3])); top3_tot += 3
            pos = {p: i for i, p in enumerate(act_order)}
            for a, b in zip(pred_order, pred_order[1:]):
                swapped = pos[a] > pos[b]
                if pred[b] - pred[a] < close: close_pairs += 1; close_swaps += swapped
                else: far_pairs += 1; far_swaps += swapped
    return {
        "spearman": round(statistics.mean(rhos), 3), "top3_hit": f"{top3_hit}/{top3_tot}",
        "top3_rate": round(top3_hit / top3_tot, 3),
        "close_swap_rate": round(close_swaps / close_pairs, 3) if close_pairs else None,
        "far_swap_rate": round(far_swaps / far_pairs, 3) if far_pairs else None,
        "groups": len(rhos),
    }


# 1) 選個人趨勢權重 w（以平均 Spearman 為準）
best_w = max((0.0, 0.25, 0.5, 0.75), key=lambda w: backtest(w, 0.01)["spearman"])
# 2) 校準「實力接近」門檻：選一個令相鄰兩人名次互換率接近一半的門檻（即真的難分高下）
cands = [0.005, 0.0075, 0.01, 0.015, 0.02]
best_close = min(cands, key=lambda c: abs((backtest(best_w, c)["close_swap_rate"] or 0) - 0.5))
bt = backtest(best_w, best_close)
print("w =", best_w, "close =", best_close, "backtest:", bt)

# 3) 近況：一星期前「全澳學生環山跑」成績（私人檔，僅用作推算；名單本身屬公開獲獎名單）
import csv, pathlib, re as _re
AECM_P = pathlib.Path(__file__).resolve().parents[1] / "private/aecm55_2026.csv"
START_P = pathlib.Path(__file__).resolve().parents[1] / "private/startlist48.csv"
RACE = json.load(open(pathlib.Path(pv_p).with_name("race48.json"), encoding="utf-8"))
AMAP = {"PCMS": "PC", "EDLV": "DLV", "ELCTP": "LCTP", "MAC": "CAM", "MSY": "SY", "DBYW": "CDBYW"}
ZH_OF = {x["abbr"]: x["zh"] for x in RACE["schools"]}
W_AECM = 0.6  # 近況權重（沒有往屆環山跑可回測，按判斷設定，頁面會註明）

def secs(t):
    m = _re.match(r"(\d+):(\d+)(?:[.:](\d+))?$", t)
    return int(m.group(1)) * 60 + int(m.group(2)) + (int(m.group(3)) / 100 if m.group(3) else 0)

aecm = defaultdict(dict)  # cat -> {(name, abbr): (rank, sec, ratio)}
if AECM_P.exists():
    rows = list(csv.DictReader(open(AECM_P, encoding="utf-8")))
    win = {r["cat"]: secs(r["time"]) for r in rows if r["rank"] == "1"}
    for r in rows:
        t = secs(r["time"])
        aecm[r["cat"]][(r["name_zh"], AMAP.get(r["aecm_school"], r["aecm_school"]))] = (int(r["rank"]), r["time"], t / win[r["cat"]])
start = list(csv.DictReader(open(START_P, encoding="utf-8"))) if START_P.exists() else []

# 參賽者姓名 → 歷屆編號（已配對者）
name_of = {}
for e in DATA["editions"]:
    for cat in e["categories"].values():
        for r in cat["individual"]:
            name_of[r["pid"]] = r["name_zh"]

ED = PV["edition"]
offsets = {}
for c, v in PV["categories"].items():
    pids = [s["pid"] for s in v["starters"]]
    hist_pred = predict(ED, c, pids, best_w)
    pid_of = {}  # (name, abbr) -> pid
    for s in v["starters"]:
        abbr = next((x["abbr"] for x in RACE["schools"] if x["zh"] == s["school_zh"]), None)
        pid_of[(name_of.get(s["pid"], ""), abbr)] = s["pid"]
    entrants = {(r["name_zh"], r["abbr"]) for r in start if r["cat"] == c}
    near = {k: val for k, val in aecm.get(c, {}).items() if k in entrants}  # 只計今屆有報名者
    both = [(pid_of[k], val[2]) for k, val in near.items() if k in pid_of and pid_of[k] in hist_pred]
    off = statistics.median([hist_pred[p] - a for p, a in both]) if len(both) >= 2 else None
    offsets[c] = off
    items = {}
    for pid, h in hist_pred.items():
        items[("pid", pid)] = {"pid": pid, "idx": h, "src": "hist"}
    for k, (rank, tm, a) in near.items():
        a2 = a + (off if off is not None else 0)
        pid = pid_of.get(k)
        if pid and ("pid", pid) in items:
            it = items[("pid", pid)]; it["idx"] = W_AECM * a2 + (1 - W_AECM) * it["idx"]; it["src"] = "both"
        elif pid:
            items[("pid", pid)] = {"pid": pid, "idx": a2, "src": "aecm"}
        else:  # 新人：未有學界往績，但今日環山跑入三甲十名
            items[("new", k)] = {"pid": None, "name_zh": k[0], "school_zh": ZH_OF.get(k[1], k[1]), "idx": a2, "src": "aecm"}
        (items[("pid", pid)] if pid else items[("new", k)]).update({"aecm_rank": rank, "aecm_time": tm})
    order = sorted(items.values(), key=lambda x: x["idx"])
    group = 0
    for i, it in enumerate(order):
        if i == 0 or it["idx"] - order[i - 1]["idx"] >= best_close: group += 1
        it["g"] = group; it["idx"] = round(it["idx"], 4)
    size = defaultdict(int)
    for it in order: size[it["g"]] += 1
    for it in order: it["close"] = size[it["g"]] > 1
    v["prediction"] = order
PV["prediction_meta"] = {"w": best_w, "close": best_close, "backtest": bt, "aecm_weight": W_AECM,
                         "aecm": {"name": "第五十五屆全澳學生環山跑比賽", "org": "澳門中華學生聯合總會", "date": "2026-11-22",
                                  "distances": "男子A組 3400 米；其他 A、B、C 組 1700 米；D、E 組 900 米（平路）"},
                         "aecm_offsets": {c: (round(o, 4) if o is not None else None) for c, o in offsets.items()},
                         "method": "實力指數＝成績÷該場冠軍成績；按同組第二年／升組的典型變化及個人趨勢推算，再與一星期前環山跑近況加權合併"}
json.dump(PV, open(pv_p, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print({c: (len(v["prediction"]), sum(1 for x in v["prediction"] if x["src"] != "hist"), sum(1 for x in v["prediction"] if x["pid"] is None)) for c, v in PV["categories"].items()})
print("offsets", PV["prediction_meta"]["aecm_offsets"])
