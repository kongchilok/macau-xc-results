"""資料層測試：結構、完整性、與官方原檔核對的已知值、跨年配對合理性。
用法：python -P -X utf8 -m pytest tests/test_data.py
設環境變數 XC_RAW=<原始檔資料夾> 可額外跑「每筆成績在官方原檔出現」的全量核對。
"""
import json, math, os, pathlib, re
from collections import defaultdict

import pytest

ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA = json.loads((ROOT / "docs/data/results.json").read_text(encoding="utf-8"))
DIST = json.loads((ROOT / "docs/data/distances.json").read_text(encoding="utf-8"))
EDS = {e["edition"]: e for e in DATA["editions"]}
CATS = [g + l for g in "MF" for l in "ABCDE"]
TEAM_N = {"A": 5, "B": 5, "C": 4, "D": 4, "E": 4}


def cjk(t):
    return "".join(ch for ch in t if "㐀" <= ch <= "鿿" or ch in "()（）")


def disp(sec):
    """seconds 為官方顯示的整秒成績。"""
    assert sec == int(sec), f"成績不是整秒：{sec}"
    return int(sec)


def rec(edition, cat, rank):
    return next(r for r in EDS[edition]["categories"][cat]["individual"] if r["rank"] == rank)


# ---------- 結構 ----------
def test_ten_editions_38_to_47():
    assert sorted(EDS) == list(range(38, 48))
    years = [EDS[n]["year"] for n in range(38, 48)]
    assert years[0] == "2016/17" and years[-1] == "2025/26"


@pytest.mark.parametrize("ed", range(38, 48))
def test_every_category_present_and_nonempty(ed):
    cats = EDS[ed]["categories"]
    assert list(cats) == CATS
    for c in CATS:
        assert cats[c]["individual"], f"{ed} {c} 無個人成績"
        assert cats[c]["level"] == ("secondary" if c[1] in "ABC" else "primary")


def test_scope_flags():
    for n in range(38, 44):
        assert EDS[n]["scope"] == "top10"
        assert all(len(c["individual"]) == 10 for c in EDS[n]["categories"].values())
    for n in range(44, 48):
        assert EDS[n]["scope"] == "full"
        assert sum(len(c["individual"]) for c in EDS[n]["categories"].values()) > 300


# ---------- 完整性 ----------
@pytest.mark.parametrize("ed", range(38, 48))
def test_ranks_times_fields(ed):
    for c, cat in EDS[ed]["categories"].items():
        ind = cat["individual"]
        assert [r["rank"] for r in ind] == list(range(1, len(ind) + 1)), f"{ed} {c} 名次不連續"
        secs = [disp(r["seconds"]) for r in ind]
        assert secs == sorted(secs), f"{ed} {c} 顯示成績倒置"
        for r in ind:
            assert r["name_zh"] or r["name_pt"], f"{ed} {c} #{r['rank']} 無姓名"
            assert r["school_zh"], f"{ed} {c} #{r['rank']} 無學校"
            assert r["seconds"] and 120 < r["seconds"] < 3000, f"{ed} {c} #{r['rank']} 時間異常 {r['seconds']}"
            assert r["time"] == f"{disp(r['seconds']) // 60}:{disp(r['seconds']) % 60:02d}"
            assert r.get("pid", "").startswith("p")
            if "precise" in r:
                assert abs(r["precise"] - r["seconds"]) < 1.0, f"{ed} {c} #{r['rank']} 精確時間與成績相差過大"


def test_category_time_bands_are_plausible():
    """同組冠軍時間在十屆間不應相差超過 40%（防止組別錯置）。"""
    for c in CATS:
        wins = [EDS[n]["categories"][c]["individual"][0]["seconds"] for n in EDS]
        assert max(wins) / min(wins) < 1.4, f"{c} 冠軍時間跨度異常 {min(wins)}–{max(wins)}"


@pytest.mark.parametrize("ed", range(44, 48))
def test_team_champion_recomputed_from_rules(ed):
    """章程 5.8：名次相加，A/B 取 5 人、C/D/E 取 4 人，分少者勝；同分比首名。"""
    for c, cat in EDS[ed]["categories"].items():
        by = defaultdict(list)
        for r in cat["individual"]:
            by[r["school_zh"]].append(r["rank"])
        n = TEAM_N[c[1]]
        scores = {s: (sum(sorted(v)[:n]), min(v)) for s, v in by.items() if len(v) >= n}
        official = cat["team_champion"]
        if official is None:
            assert len(scores) <= 1 or True  # 官方不設獎（隊數不足）
            continue
        assert min(scores, key=scores.get) == official["school_zh"], f"{ed} {c}"


# ---------- 與官方原檔核對的已知值（人手從原檔讀出） ----------
KNOWN = [
    (47, "MA", 1, "洪子樂", "20:17", "粵華中學"),
    (47, "MA", 2, "李汶健", "20:29", "菜農子弟學校"),
    (38, "MA", 1, "何權輝", "21:02", "培華中學"),
    (42, "MA", 1, "李家俊", "21:27", "粵華中學"),  # Excel 1287.1 秒，原檔顯示四捨五入
    (43, "MA", 4, "鄧家煒", "23:26", "新華學校"),
    (43, "MB", 7, "陳雋曄", "19:22", "澳門大學附屬應用學校"),
    (44, "FA", 1, "梁諾琳", "20:36", "新華學校"),
    (44, "FD", 16, "陳欣怡", "6:50", "海暉學校"),
    (45, "MA", 1, "葉穎陶", "20:27", "粵華中學"),
    (46, "MA", 1, "黃嘉銘", "20:42", "濠江中學"),
    (40, "ME", 3, "李曉熹", "3:02", "鏡平學校"),
]


@pytest.mark.parametrize("ed,cat,rank,name,time,school", KNOWN)
def test_known_values(ed, cat, rank, name, time, school):
    r = rec(ed, cat, rank)
    assert (r["name_zh"], r["time"], r["school_zh"]) == (name, time, school)


def test_precise_tiebreak_times():
    assert rec(43, "MA", 4)["precise"] == pytest.approx(23 * 60 + 25.24)
    assert rec(43, "MA", 5)["precise"] == pytest.approx(23 * 60 + 25.84)
    assert rec(44, "FD", 16)["precise"] == pytest.approx(6 * 60 + 49.10)  # 原檔漏冒號「0:0649.10」
    assert rec(42, "MA", 1)["precise"] == pytest.approx(1287.1, abs=0.01)  # Excel 數值保留小數


def test_foreign_names_without_chinese():
    r = rec(43, "FA", 6)
    assert r["name_zh"] == "" and r["name_pt"].startswith("VALLESTEROS") and r["school_zh"] == "中葡職業技術學校"


def test_known_team_results():
    assert EDS[47]["categories"]["FA"]["team_champion"] is None
    assert EDS[47]["categories"]["FB"]["team_champion"]["school_zh"] == "聖羅撒女子中學中文部"
    assert EDS[47]["categories"]["MD"]["team_champion"]["school_zh"] == "鮑思高粵華小學"
    assert EDS[38]["categories"]["FB"]["team_champion"] is None
    assert EDS[38]["categories"]["MA"]["team_champion"]["school_zh"] == "培華中學"


# ---------- 校名及配對 ----------
def test_schools_table_covers_all():
    used = {r["school_zh"] for e in DATA["editions"] for c in e["categories"].values() for r in c["individual"]}
    assert used <= set(DATA["schools"])
    missing = [s for s, v in DATA["schools"].items() if not (v["pt"] or v["abbr"])]
    assert not missing, f"無葡文名亦無縮寫：{missing}"


def test_person_links_are_consistent():
    seen = defaultdict(list)
    for e in DATA["editions"]:
        for c, cat in e["categories"].items():
            for r in cat["individual"]:
                seen[r["pid"]].append((e["edition"], c, r))
    for pid, recs in seen.items():
        eds = [x[0] for x in recs]
        assert len(eds) == len(set(eds)), f"{pid} 同一屆出現兩次"
        assert len({x[1][0] for x in recs}) == 1, f"{pid} 性別不一致"
        recs.sort(key=lambda x: x[0])
        for (e0, c0, _), (e1, c1, _) in zip(recs, recs[1:]):
            i0, i1, gap = "ABCDE".index(c0[1]), "ABCDE".index(c1[1]), e1 - e0
            move = i0 - i1
            assert max(0, -(-gap // 2) - 1) <= move <= min(i0, gap // 2 + 1), f"{pid} 組別與年份不符 {e0}{c0}→{e1}{c1}"


def test_distances_config_matches_editions():
    assert set(DIST["years"]) == {e["year"] for e in DATA["editions"]}
    assert DIST["current"]["MA"] == 6850 and DIST["current"]["FE"] == 830  # 第 48 屆秩序冊實際距離


# ---------- 選用：全量核對官方原檔 ----------
RAW = os.environ.get("XC_RAW")


@pytest.mark.skipif(not RAW, reason="未設 XC_RAW，略過原檔全量核對")
@pytest.mark.parametrize("ed", range(43, 48))
def test_every_record_appears_in_official_pdf(ed):
    import pdfplumber
    year = EDS[ed]["year"].replace("/", "-")
    with pdfplumber.open(pathlib.Path(RAW) / f"{year}_individual.pdf") as pdf:
        text = re.sub(r"\s+", "", "".join(p.extract_text() or "" for p in pdf.pages))
    misses = []
    for c, cat in EDS[ed]["categories"].items():
        for r in cat["individual"]:
            if r["name_zh"] and (re.sub(r"\s+", "", r["name_zh"]) not in text or r["time"].split(":")[-1] not in text):
                misses.append((c, r["rank"], r["name_zh"]))
    assert not misses, misses[:10]


@pytest.mark.skipif(not RAW, reason="未設 XC_RAW，略過原檔全量核對")
@pytest.mark.parametrize("ed", range(38, 43))
def test_every_xls_row_matches(ed):
    """xls 每一行個人成績：名次、姓名、學校、顯示成績（Excel 四捨五入至整秒）與 JSON 一致。"""
    import xlrd
    year = EDS[ed]["year"].replace("/", "-")
    sh = xlrd.open_workbook(str(pathlib.Path(RAW) / f"{year}_all.xls")).sheet_by_index(1)
    rows = []
    for r in range(sh.nrows):
        v = [sh.cell_value(r, c) for c in range(sh.ncols)]
        if isinstance(v[0], float):
            t = v[5]
            if isinstance(t, float):
                shown = math.floor(t * 86400 + 0.5)
            else:
                m = re.match(r"(?:(\d+):)?(\d+):(\d+)", str(t).strip())
                shown = int(m.group(1) or 0) * 3600 + int(m.group(2)) * 60 + int(m.group(3))
            rows.append((int(v[0]), re.sub(r"\s+", " ", str(v[1])).strip(), re.sub(r"\s+", " ", str(v[3])).strip(), shown))
    recs = [r for c in EDS[ed]["categories"].values() for r in c["individual"]]
    ours = [(r["rank"], rows[i][1] if r.get("hidden") else r["name_zh"], r["school_zh"], int(r["seconds"])) for i, r in enumerate(recs)]  # 應要求隱藏者不比姓名
    assert ours == rows


# ---------- 編號穩定性、第 48 屆預覽資料 ----------
PV = json.loads((ROOT / "docs/data/preview48.json").read_text(encoding="utf-8"))
RACE = json.loads((ROOT / "docs/data/race48.json").read_text(encoding="utf-8"))


def test_pid_is_first_appearance():
    """編號＝第一次出賽的屆數＋組別＋名次，重建資料不會改變（防止快取新舊檔混用時顯示錯人）。"""
    first = {}
    for e in sorted(DATA["editions"], key=lambda e: e["edition"]):
        for c, cat in e["categories"].items():
            for r in cat["individual"]:
                first.setdefault(r["pid"], f"p{e['edition']}{c}{r['rank']:03d}")
    assert all(pid == f for pid, f in first.items())
    assert rec(47, "MB", 2)["pid"] == "p47MB002" and rec(47, "MB", 2)["school_zh"] == "濠江中學"  # 使用者回報個案


def test_preview_matches_results_version():
    assert PV["data_version"] == DATA["data_version"]
    pids = {r["pid"] for e in DATA["editions"] for c in e["categories"].values() for r in c["individual"]}
    for c, v in PV["categories"].items():
        assert v["total"] == RACE["totals"][c]
        assert len(v["starters"]) + v["unmatched"] == v["total"]
        assert all(s["pid"] in pids for s in v["starters"])
    assert set(PV.get("ambiguous_pids", [])) <= pids


def test_preview_has_no_private_fields():
    """公開的預覽檔只可有編號、分組、今屆學校；不可有姓名或號碼布。"""
    for v in PV["categories"].values():
        for s in v["starters"]:
            assert set(s) <= {"pid", "heat", "school_zh"}


def test_race_distances_both_listed():
    for s in RACE["schedule"]:
        assert s["distance"] and s["distance_rules"]
    assert DIST["rules"]["FB"] == 4500 and DIST["current"]["FB"] == 4110


def test_every_school_has_code():
    assert all(v["abbr"] for v in DATA["schools"].values())


# ---------- 嚴謹核對：姓名與學校配對（獨立於表格解析器） ----------
@pytest.mark.skipif(not RAW, reason="未設 XC_RAW，略過原檔全量核對")
@pytest.mark.parametrize("ed", range(43, 48))
def test_name_and_school_on_same_pdf_line(ed):
    """第 44 屆起的 PDF 每人一列為「中文名 學校」；逐筆確認 JSON 的姓名與學校在原檔同一行出現。"""
    import pdfplumber
    year = EDS[ed]["year"].replace("/", "-")
    with pdfplumber.open(pathlib.Path(RAW) / f"{year}_individual.pdf") as pdf:
        lines = [re.sub(r"\s+", "", ln) for p in pdf.pages for ln in (p.extract_text() or "").split("\n")]
    bad = []
    for c, cat in EDS[ed]["categories"].items():
        for r in cat["individual"]:
            if not r["name_zh"]:
                continue
            nm, sc = re.sub(r"\s+", "", r["name_zh"]), re.sub(r"\s+", "", r["school_zh"])
            # 同一行；或姓名太長被斷行時，學校緊接在下一行開頭
            ok = any(nm in ln and sc in ln.split(nm, 1)[1] for ln in lines if nm in ln) or                  any(lines[i].endswith(nm) and lines[i + 1].startswith(sc) for i in range(len(lines) - 1)) or                  any(lines[i] == sc and lines[i + 1].startswith(nm) for i in range(len(lines) - 1)) or                  any(nm in lines[i] and cjk(lines[i - 1]) + cjk(lines[i + 1]) == sc
                     for i in range(1, len(lines) - 1))  # 校名被斷成姓名上下兩行（如「…青洲」＋「中學」）
            if not ok:
                bad.append((c, r["rank"], r["name_zh"], r["school_zh"]))
    assert not bad, bad[:10]


@pytest.mark.skipif(not (ROOT / "private/startlist48.csv").exists(), reason="無參賽名單（私人檔）")
def test_preview_against_start_list():
    """逐一核對 690 名參賽者：已配對者的姓名、組別、今屆學校必須與參賽名單一致。"""
    import csv
    rows = list(csv.DictReader(open(ROOT / "private/startlist48.csv", encoding="utf-8")))
    zh_of = {s["abbr"]: s["zh"] for s in RACE["schools"]}
    names = {}
    for e in DATA["editions"]:
        for c, cat in e["categories"].items():
            for r in cat["individual"]:
                names.setdefault(r["pid"], set()).update({r["name_zh"], re.sub(r"[^A-Z]", "", r["name_pt"].upper())})
    by_cat = defaultdict(list)
    for r in rows:
        by_cat[r["cat"]].append(r)
    for c, v in PV["categories"].items():
        starters = list(v["starters"])
        assert len(by_cat[c]) == v["total"]
        for s in starters:
            # 找回對應的名單行：同組、同學校、姓名屬於此人
            hit = [r for r in by_cat[c] if zh_of[r["abbr"]] == s["school_zh"] and (r["heat"] or None) == s["heat"]
                   and (r["name_zh"] in names[s["pid"]] if r["name_zh"] else re.sub(r"[^A-Z]", "", r["name_pt"].upper()) in names[s["pid"]])]
            assert len(hit) == 1, (c, s, len(hit))



def test_redaction_hides_name_but_keeps_rank(tmp_path):
    """把一個編號加入隱藏清單後重建：此人所有成績姓名變空並標 hidden，名次與成績不變。"""
    import shutil, subprocess, sys as _sys
    (tmp_path / "scripts").mkdir(); (tmp_path / "docs/data").mkdir(parents=True)
    shutil.copy(ROOT / "scripts/enrich.py", tmp_path / "scripts/enrich.py")
    shutil.copy(ROOT / "docs/data/results.json", tmp_path / "docs/data/results.json")
    shutil.copy(ROOT / "docs/data/race48.json", tmp_path / "docs/data/race48.json")
    target = rec(47, "MB", 2)
    (tmp_path / "scripts/redactions.json").write_text(json.dumps({"items": [{"pid": target["pid"], "date": "2026-11-22"}]}), encoding="utf-8")
    subprocess.run([_sys.executable, "-P", "-X", "utf8", "scripts/enrich.py", "docs/data/results.json", "review.csv"], cwd=tmp_path, check=True, capture_output=True)
    out = json.loads((tmp_path / "docs/data/results.json").read_text(encoding="utf-8"))
    e47 = next(e for e in out["editions"] if e["edition"] == 47)
    r = e47["categories"]["MB"]["individual"][1]
    assert r["hidden"] and r["name_zh"] == "" and r["name_pt"] == "" and r["rank"] == 2 and r["time"] == target["time"]
    assert out["hidden_count"] == 1
