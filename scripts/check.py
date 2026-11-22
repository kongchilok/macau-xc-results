"""內部完整性檢查：人數、名次斷號、時間倒置、欄位缺漏、團體冠軍重算。
用法：python scripts/check.py docs/data/results.json
"""
import json, math, sys
from collections import defaultdict

TEAM_N = {"A": 5, "B": 5, "C": 4, "D": 4, "E": 4}

data = json.load(open(sys.argv[1], encoding="utf-8"))
problems = 0
for ed in data["editions"]:
    line = []
    for code, c in ed["categories"].items():
        ind = c["individual"]
        line.append(f"{code}:{len(ind)}")
        ranks = [r["rank"] for r in ind]
        issues = []
        if not ind:
            issues.append("無個人成績")
        if ranks and ranks != list(range(1, len(ranks) + 1)):
            dup = len(ranks) - len(set(ranks))
            issues.append(f"名次不連續（重複 {dup}，最大 {max(ranks)}，共 {len(ranks)}）")
        secs = [math.ceil(r["seconds"] - 1e-6) for r in ind if r["seconds"] is not None]  # 以官方顯示成績（整秒）比較；同秒內精確次序以官方名次為準
        if any(b < a for a, b in zip(secs, secs[1:])):
            issues.append("時間倒置")
        miss = [r["rank"] for r in ind if (not r["name_zh"] and not r["name_pt"]) or not r["school_zh"] or r["seconds"] is None]
        if miss:
            issues.append(f"欄位缺漏名次 {miss[:8]}")
        # 團體冠軍重算（只在完整名單年份有意義）
        if ed["scope"] == "full" and c["team_champion"]:
            n = TEAM_N[code[1]]
            by = defaultdict(list)
            for r in ind:
                by[r["school_zh"]].append(r["rank"])
            scores = {s: (sum(sorted(v)[:n]), min(v)) for s, v in by.items() if len(v) >= n}
            if scores:
                best = min(scores, key=lambda s: scores[s])
                if best != c["team_champion"]["school_zh"]:
                    issues.append(f"團體冠軍重算＝{best}，官方＝{c['team_champion']['school_zh']}")
        if issues:
            problems += 1
            print(f"  ⚠ {ed['year']} {code}: " + "；".join(issues))
    print(f"{ed['year']} 第{ed['edition']}屆 [{ed['scope']}] " + " ".join(line))
print(f"\n問題組別數：{problems}")
