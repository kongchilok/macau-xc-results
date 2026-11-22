"""第 48 屆賽前預覽：把參賽名單配對到歷屆成績。
用法：python scripts/preview.py docs/data/results.json docs/data/race48.json private/startlist48.csv docs/data/preview48.json private/preview48_review.csv

私隱原則：
- 參賽名單只存在 private/（不入 repo、不發布）
- 公開的 preview48.json 只含「已有公開往績」者的 pid、今屆組別／分組、今屆學校；不含號碼布、不含無往績者姓名
- 無往績或配對不肯定者只計人數；配對細節寫入 private/ 的覆核清單
"""
import csv, json, pathlib, re, sys
from collections import defaultdict

results_p, race_p, start_p, out_p, review_p = sys.argv[1:6]
DATA = json.load(open(results_p, encoding="utf-8"))
RACE = json.load(open(race_p, encoding="utf-8"))
START = list(csv.DictReader(open(start_p, encoding="utf-8")))
ED = RACE["edition"]
LET = "ABCDE"


def norm_pt(s):
    return re.sub(r"[^A-Z]", "", (s or "").upper())


def pt_similar(a, b):
    if not a or not b:
        return True
    if a == b or a.startswith(b) or b.startswith(a):
        return True
    if abs(len(a) - len(b)) > 1 or min(len(a), len(b)) < 8:
        return False
    i = 0
    while i < min(len(a), len(b)) and a[i] == b[i]:
        i += 1
    return a[i + 1:] == b[i + 1:] or a[i + 1:] == b[i:] or a[i:] == b[i + 1:]


# 歷屆人物
people = defaultdict(list)
for e in DATA["editions"]:
    for c, cat in e["categories"].items():
        for r in cat["individual"]:
            people[r["pid"]].append({**r, "edition": e["edition"], "cat": c})
for v in people.values():
    v.sort(key=lambda x: x["edition"])
by_zh = defaultdict(set)
by_pt = defaultdict(set)
for pid, recs in people.items():
    for r in recs:
        if r["name_zh"]:
            by_zh[(r["cat"][0], r["name_zh"])].add(pid)
        if r["name_pt"]:
            by_pt[(r["cat"][0], norm_pt(r["name_pt"]))].add(pid)

# 學校等同：同中文名，或同縮寫（歷屆縮寫＋今屆名單）
abbr_of = {s["zh"]: s["abbr"] for s in RACE["schools"]}
for zh, s in DATA.get("schools", {}).items():
    if s.get("abbr"):
        abbr_of.setdefault(zh, s["abbr"])
zh_of_abbr = {s["abbr"]: s["zh"] for s in RACE["schools"]}


def same_school(a_zh, b_zh):
    return a_zh == b_zh or (abbr_of.get(a_zh) and abbr_of.get(a_zh) == abbr_of.get(b_zh))


def consistent(pid, cat):
    last = people[pid][-1]
    if last["cat"][0] != cat[0]:
        return False
    gap = ED - last["edition"]
    i0, i1 = LET.index(last["cat"][1]), LET.index(cat[1])
    move = i0 - i1
    lo = max(0, -(-gap // 2) - 1)   # 組別約每兩年升一級
    hi = min(i0, gap // 2 + 1)
    return gap >= 1 and lo <= move <= hi


out = {"edition": ED, "year": RACE["year"], "date": RACE["date"], "data_version": DATA.get("data_version"), "categories": {}}
review = []
stats = defaultdict(int)
for c in RACE["totals"]:
    out["categories"][c] = {"total": RACE["totals"][c], "starters": [], "unmatched": 0}

_ov = pathlib.Path(__file__).with_name("overrides.json")
OV = json.loads(_ov.read_text(encoding="utf-8")) if _ov.exists() else {}
FORCE = {k: v["pid"] for k, v in OV.get("preview48", {}).items()}
CONFIRMED = set(OV.get("confirmed_transfers", []))

for s in START:
    cat, zh, pt = s["cat"], s["name_zh"].strip(), s["name_pt"].strip()
    school_zh = zh_of_abbr[s["abbr"]]
    forced = FORCE.get(f"{cat}|{zh}|{s['abbr']}")
    cands = set()
    if zh:
        cands |= by_zh.get((cat[0], zh), set())
    elif pt:
        cands |= by_pt.get((cat[0], norm_pt(pt)), set())
    cands = {p for p in cands if consistent(p, cat) and pt_similar(norm_pt(pt), norm_pt(people[p][-1]["name_pt"]))}
    if len(cands) > 1:  # 同名多人：以學校收窄
        narrowed = {p for p in cands if same_school(people[p][-1]["school_zh"], school_zh)}
        if len(narrowed) == 1:
            cands = narrowed
    if forced:
        cands = {forced}
    if len(cands) == 1:
        pid = cands.pop()
        last = people[pid][-1]
        flag = "" if same_school(last["school_zh"], school_zh) or LET.index(last["cat"][1]) >= 3 > LET.index(cat[1]) else "轉校"
        out["categories"][cat]["starters"].append({"pid": pid, "heat": s["heat"] or None, "school_zh": school_zh})
        stats["matched"] += 1
        if forced: flag = "人手判定"
        elif flag and pid in CONFIRMED: flag = "轉校，已確認"
        review.append(["配對" + (f"（{flag}）" if flag in ("人手判定", "轉校，已確認") else (f"（{flag}，請核對）" if flag else "")), cat, s["heat"], zh, pt, school_zh, pid, f"{last['edition']} {last['cat']} #{last['rank']} {last['school_zh']}"])
    else:
        out["categories"][cat]["unmatched"] += 1
        stats["ambiguous" if len(cands) > 1 else "new"] += 1
        if len(cands) > 1:
            review.append(["同名多人未配對", cat, s["heat"], zh, pt, school_zh, ";".join(sorted(cands)), ""])
            out.setdefault("ambiguous_pids", []).extend(sorted(cands))  # 這些人「可能」今屆參賽（同名未確定），網站只標示為未確定

json.dump(out, open(out_p, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
with open(review_p, "w", encoding="utf-8-sig", newline="") as f:
    w = csv.writer(f)
    w.writerow(["狀態", "組別", "分組", "中文名", "拼音", "今屆學校", "pid", "最近往績"])
    w.writerows(sorted(review, key=lambda r: (r[0] == "配對", r[1], r[3])))
print(dict(stats), "核對項", sum(1 for r in review if r[0] != "配對"))
