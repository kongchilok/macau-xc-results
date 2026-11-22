"""在 results.json 上加：統一校名表、跨年同一人配對（pid）；輸出存疑清單供人手覆核。
用法：python scripts/enrich.py docs/data/results.json review_persons.csv
配對原則（保守）：
  1. 同性別、同中文名（無中文名者用拼音）
  2. 拼音正規化後一致（或其中一方缺）
  3. 每屆最多一筆；組別約每兩年升一級（E→A），升級幅度須合乎年份差（見 age_ok）
  不符合者拆開，並列入存疑清單。
"""
import csv, json, pathlib, re, sys
from collections import Counter, defaultdict

LETTERS = "ABCDE"  # A 最年長
path, review_path = sys.argv[1], sys.argv[2]
data = json.load(open(path, encoding="utf-8"))

# ---------- 統一校名 ----------
pt_count, abbr = defaultdict(Counter), {}
for ed in data["editions"]:
    for c in ed["categories"].values():
        for r in c["individual"]:
            pt = r["school_pt"]
            if re.fullmatch(r"[A-Z0-9]{1,6}", pt or ""):
                abbr[r["school_zh"]] = pt
            elif pt:
                pt_count[r["school_zh"]][pt] += 1
        if c["team_champion"]:
            t = c["team_champion"]
            if t["school_pt"] and not re.fullmatch(r"[A-Z0-9]{1,6}", t["school_pt"]):
                pt_count[t["school_zh"]][t["school_pt"]] += 1
schools = {}
for zh in set(pt_count) | set(abbr):
    cands = pt_count.get(zh, Counter())
    # 取最常見的葡文校名；同票取較短（去掉「em chinês…」之類的長註）
    best = sorted(cands.items(), key=lambda kv: (-kv[1], len(kv[0])))[0][0] if cands else ""
    schools[zh] = {"pt": best, "abbr": abbr.get(zh, "")}
# 第 48 屆秩序冊：官方縮寫及現行葡文校名（最新、最權威）
_race = pathlib.Path(path).with_name("race48.json")
if _race.exists():
    for s in json.loads(_race.read_text(encoding="utf-8"))["schools"]:
        cur = schools.setdefault(s["zh"], {"pt": "", "abbr": ""})
        cur["abbr"] = cur["abbr"] or s["abbr"]
        cur["pt"] = s["pt"]
# 未有官方縮寫的舊校名：同校改名者沿用現行代碼，其餘按葡文校名取縮寫
EXTRA_ABBR = {
    "浸信中學": "CS",            # 即澳門浸信中學
    "雷鳴道主教紀念中學": "DLV",  # 即雷鳴道主教紀念學校
    "勞工子弟學校": "LH",         # 即勞校中學（使用者確認同一間學校）
    "化地瑪聖母女子學校": "NSF",  # Escola Nossa Senhora de Fátima
    "嘉諾撒聖心中學": "SCJC",     # 中文部
    "新華學校": "XH",            # Escola Xin Hua
    "澳門工聯職業技術中學": "ETP",
    "青洲小學": "IV",            # 即澳門中華總商會附設青洲中學（使用者確認同一間學校）
}
for zh, a in EXTRA_ABBR.items():
    if zh in schools and not schools[zh]["abbr"]:
        schools[zh]["abbr"] = a
data["schools"] = dict(sorted(schools.items()))

# ---------- 跨年配對 ----------
def norm_pt(s):
    return re.sub(r"[^A-Z]", "", (s or "").upper())

groups = defaultdict(list)
order = {ed["year"]: i for i, ed in enumerate(data["editions"])}
edition_of = {ed["year"]: ed["edition"] for ed in data["editions"]}
for ed in data["editions"]:
    for code, c in ed["categories"].items():
        for r in c["individual"]:
            key = (code[0], r["name_zh"] or norm_pt(r["name_pt"]))
            groups[key].append((ed["year"], code, r))

review, pid_seq = [], 0

def new_pid():
    global pid_seq
    pid_seq += 1
    return f"p{pid_seq:05d}"

def age_ok(i0, i1, gap):
    """組別約每兩年升一級（E→A）。gap 年後升級幅度應在 ceil(gap/2)-1 至 floor(gap/2)+1 之間；已在最高組（A）者不能再升。"""
    move = i0 - i1  # 正數＝往 A 方向
    lo = max(0, -(-gap // 2) - 1)
    hi = min(i0, gap // 2 + 1)
    return lo <= move <= hi


def pt_similar(a, b):
    """拼音一致、其中一方多了英文名（前綴相同）、或長名只差一個字母。"""
    if a == b or a.startswith(b) or b.startswith(a):
        return True
    if abs(len(a) - len(b)) > 1 or min(len(a), len(b)) < 8:
        return False
    # 編輯距離 ≤ 1
    i = 0
    while i < min(len(a), len(b)) and a[i] == b[i]:
        i += 1
    return a[i + 1:] == b[i + 1:] or a[i + 1:] == b[i:] or a[i:] == b[i + 1:]


def consistent(chain, cand):
    y0, c0, r0 = chain[-1]
    y1, c1, r1 = cand
    gap = order[y1] - order[y0]
    if gap <= 0:
        return False
    a, b = norm_pt(r0["name_pt"]), norm_pt(r1["name_pt"])
    if a and b and not pt_similar(a, b):
        return False
    return age_ok(LETTERS.index(c0[1]), LETTERS.index(c1[1]), gap)

def same_school(a, b):
    """同中文校名，或同官方縮寫（例：澳門坊眾學校＝澳坊中學＝EMM）。"""
    return a == b or (bool(abbr_of.get(a)) and abbr_of.get(a) == abbr_of.get(b))


# 縮寫表：歷屆資料中的縮寫＋第 48 屆秩序冊（如有）
abbr_of = {zh: s["abbr"] for zh, s in schools.items() if s["abbr"]}
race_p = pathlib.Path(path).with_name("race48.json")
if race_p.exists():
    for s in json.loads(race_p.read_text(encoding="utf-8"))["schools"]:
        abbr_of.setdefault(s["zh"], s["abbr"])

for key, recs in groups.items():
    recs.sort(key=lambda x: order[x[0]])
    chains = []
    by_year = defaultdict(list)
    for rec in recs:
        by_year[rec[0]].append(rec)
    for year in sorted(by_year, key=order.get):
        pending, taken = by_year[year], set()
        # 第一輪：同校而且合乎年齡的唯一一條鏈
        rest = []
        for rec in pending:
            fits = [i for i, ch in enumerate(chains) if i not in taken and consistent(ch, rec) and same_school(ch[-1][2]["school_zh"], rec[2]["school_zh"])]
            if len(fits) == 1:
                chains[fits[0]].append(rec); taken.add(fits[0])
            else:
                rest.append(rec)
        # 第二輪：不同校（如升中、轉校），只在唯一一條可行鏈時才接上
        for rec in rest:
            fits = [i for i, ch in enumerate(chains) if i not in taken and consistent(ch, rec)]
            if len(fits) == 1:
                chains[fits[0]].append(rec); taken.add(fits[0])
            else:
                if len(fits) > 1:
                    review.append((key, rec, "多於一個可能的人"))
                chains.append([rec]); taken.add(len(chains) - 1)
    if len(chains) > 1:
        for ch in chains:
            for y, code, r in ch:
                review.append((key, (y, code, r), f"同名拆成 {len(chains)} 人"))
    for ch in chains:
        # 固定編號：以此人第一次出賽的「屆數＋組別＋名次」組成，重建資料時不會改變
        y0, c0, r0 = ch[0]
        pid = f"p{edition_of[y0]}{c0}{r0['rank']:03d}"
        pid_seq += 1
        for _, _, r in ch:
            r["pid"] = pid

data["person_count"] = pid_seq
# 應要求隱藏：姓名換成空白並加 hidden 標記（名次、成績、學校保留）
_red = pathlib.Path(__file__).with_name("redactions.json")
hidden = {i["pid"] for i in json.loads(_red.read_text(encoding="utf-8"))["items"]} if _red.exists() else set()
for ed in data["editions"]:
    for c in ed["categories"].values():
        for r in c["individual"]:
            if r["pid"] in hidden:
                r["name_zh"], r["name_pt"], r["hidden"] = "", "", True
data["hidden_count"] = len(hidden)
# 資料版本：所有編號＋姓名的雜湊。衍生檔（如 preview48.json）帶同一版本號，前端遇到不一致就不混用
import hashlib
_sig = "|".join(f"{e['edition']}{c}{r['rank']}{r['pid']}{r['name_zh']}{r['name_pt']}" for e in data["editions"] for c, cat in e["categories"].items() for r in cat["individual"])
data["data_version"] = hashlib.sha1(_sig.encode("utf-8")).hexdigest()[:12]
json.dump(data, open(path, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))

with open(review_path, "w", encoding="utf-8-sig", newline="") as f:
    w = csv.writer(f)
    w.writerow(["原因", "姓名", "拼音", "學年", "組別", "名次", "學校", "pid"])
    seen = set()
    for key, (y, code, r), why in review:
        k = (y, code, r["rank"])
        if k in seen:
            continue
        seen.add(k)
        w.writerow([why, r["name_zh"], r["name_pt"], y, code, r["rank"], r["school_zh"], r.get("pid", "")])
print(f"學校 {len(schools)} 間；人物 {pid_seq} 人；存疑 {len(seen)} 筆")
