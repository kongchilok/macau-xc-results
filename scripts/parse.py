"""解析教青局學界越野跑官方成績檔（xls／PDF），輸出統一 JSON。
用法：python scripts/parse.py <原始檔資料夾> <輸出 results.json>
"""
import json, math, re, sys, pathlib, datetime

import xlrd
import pdfplumber

SRC = json.loads((pathlib.Path(__file__).parent / "sources.json").read_text(encoding="utf-8"))
CAT_RE = re.compile(r"(男|女)子\s*([A-E])\s*組")
CJK_RE = re.compile(r"[㐀-鿿]")
LEVEL = {"A": "secondary", "B": "secondary", "C": "secondary", "D": "primary", "E": "primary"}


def cat_code(m):
    return ("M" if m.group(1) == "男" else "F") + m.group(2)


def to_seconds(v):
    """把各種時間格式轉成秒數（float）。"""
    if v is None or v == "":
        return None
    if isinstance(v, float) and v < 1:  # Excel 日分數
        return round(v * 86400, 2)
    s = str(v).strip().strip("()")
    # 官方原檔偶有漏冒號，例如 2022/23 女子D組「0:0649.10」→「0:06:49.10」
    s = re.sub(r"^(\d+):(\d{2})(\d{2}(?:\.\d+)?)$", r"\1:\2:\3", s)
    m = re.fullmatch(r"(?:(\d+):)?(\d+):(\d+(?:\.\d+)?)", s)
    if not m:
        return None
    h = int(m.group(1) or 0)
    a, b = int(m.group(2)), float(m.group(3))
    # 「0:21:02」或「00:21:35」為 時:分:秒；「20:17」為 分:秒
    if m.group(1) is not None:
        return round(h * 3600 + a * 60 + b, 2)
    return round(a * 60 + b, 2)


def fmt_time(sec):
    """seconds 已是官方顯示的整秒成績。"""
    if sec is None:
        return None
    m, s = divmod(int(round(sec)), 60)
    return f"{m}:{s:02d}"


def parse_time_cell(cell):
    """回傳 (官方顯示成績的整秒數, 精確秒數或 None)。
    - Excel 數值（格式 h:mm:ss）：官方檔案顯示四捨五入至整秒，小數另存為精確時間
    - 文字：第一個時間即官方顯示成績；同格第二個時間（如「(03:01.24)」）為精確時間
    """
    if isinstance(cell, float):
        raw = to_seconds(cell)
        if raw is None:
            return None, None
        shown = math.floor(raw + 0.5)
        return float(shown), (raw if abs(raw - shown) > 1e-6 else None)
    times = re.findall(r"\(?\d+(?::\d+){1,2}(?:\.\d+)?\)?", str(cell or ""))
    sec = to_seconds(times[0]) if times else None
    precise = to_seconds(times[1]) if len(times) > 1 else None
    return sec, precise


def split_zh_latin(text):
    """把「中文\\nLATIN」或同格混排拆成 (中文, 拉丁)。"""
    if not text:
        return "", ""
    parts = [p.strip() for p in str(text).split("\n") if p.strip()]
    zh = [p for p in parts if CJK_RE.search(p)]
    la = [p for p in parts if not CJK_RE.search(p)]
    return "".join(zh), " ".join(la)


def clean(s):
    return re.sub(r"\s+", " ", str(s or "")).strip()


# ---------- xls（2014/15–2020/21）----------
def parse_xls(path):
    book = xlrd.open_workbook(str(path))
    cats = {}
    team = book.sheet_by_index(0)
    for r in range(team.nrows):
        row = [team.cell_value(r, c) for c in range(team.ncols)]
        m = CAT_RE.search(clean(row[0]))
        if not m:
            continue
        zh, pt = clean(row[2]), clean(row[3]) if len(row) > 3 else ""
        champ = None if ("不足" in zh or not zh) else {"school_zh": zh, "school_pt": pt}
        cats.setdefault(cat_code(m), {})["team_champion"] = champ
    ind = book.sheet_by_index(1)
    cur = None
    for r in range(ind.nrows):
        row = [ind.cell_value(r, c) for c in range(ind.ncols)]
        first = clean(row[0])
        m = CAT_RE.search(first)
        if m:
            cur = cat_code(m)
            continue
        if cur and isinstance(row[0], float):
            sec, precise = parse_time_cell(row[5])
            rec = {
                "rank": int(row[0]),
                "name_zh": clean(row[1]), "name_pt": clean(row[2]),
                "school_zh": clean(row[3]), "school_pt": clean(row[4]),
                "seconds": sec, "time": fmt_time(sec),
            }
            if precise:
                rec["precise"] = precise
            cats.setdefault(cur, {}).setdefault("individual", []).append(rec)
    return cats


# ---------- PDF 個人賽（2021/22 起）----------
def headings_above(page, top):
    """回傳頁面上位於 top 之上最近的組別標題。"""
    best = None
    for line in page.extract_text_lines():
        m = CAT_RE.search(line["text"])
        if m and line["top"] < top and (best is None or line["top"] > best[0]):
            best = (line["top"], cat_code(m))
    return best[1] if best else None


def parse_pdf_individual(path, cats):
    cur = None
    with pdfplumber.open(str(path)) as pdf:
        for page in pdf.pages:
            for table in page.find_tables():
                h = headings_above(page, table.bbox[1])
                if h:
                    cur = h
                for row in table.extract():
                    cells = [c for c in row]
                    joined = clean(" ".join(clean(c) for c in cells if c))
                    m = CAT_RE.search(joined)
                    if m and not re.match(r"^\d", clean(cells[0])):
                        cur = cat_code(m)
                        continue
                    rank_s = clean(cells[0])
                    if not re.fullmatch(r"\d+", rank_s) or cur is None:
                        continue
                    rest = [c for c in cells[1:]]
                    if len(rest) >= 5:
                        # 2021/22：中文名、拼音、中文校名、葡文校名、成績 各佔一格（外籍生可能無中文名）
                        name_zh, name_pt = split_zh_latin("\n".join(x for x in rest[0:2] if x))
                        school_zh, school_pt = split_zh_latin("\n".join(x for x in rest[2:4] if x))
                        time_cell = rest[4]
                    else:
                        name_zh, name_pt = split_zh_latin(rest[0])
                        school_zh, school_pt = split_zh_latin(rest[1])
                        time_cell = rest[2]
                        if len(rest) > 3 and rest[3]:
                            time_cell = f"{time_cell}\n{rest[3]}"
                    sec, precise = parse_time_cell(time_cell)
                    rec = {
                        "rank": int(rank_s),
                        "name_zh": clean(name_zh), "name_pt": clean(name_pt),
                        "school_zh": clean(school_zh), "school_pt": clean(school_pt),
                        "seconds": sec, "time": fmt_time(sec),
                    }
                    if precise:
                        rec["precise"] = precise
                    if sec is None:
                        rec["status"] = clean(time_cell) or "—"
                    cats.setdefault(cur, {}).setdefault("individual", []).append(rec)


# ---------- PDF 團體賽 ----------
def parse_pdf_team(path, cats):
    with pdfplumber.open(str(path)) as pdf:
        text = "\n".join(p.extract_text() or "" for p in pdf.pages)
    for line in text.split("\n"):
        m = CAT_RE.search(line)
        if not m:
            continue
        rest = re.sub(r"^.*?Cat\.\s*[A-E]\s*(Masc|Fem)\.?\s*", "", line).strip()
        mz = re.match(r"([㐀-鿿（）()\-\s]+?)\s+([A-Za-z].*)$", rest)
        if not rest or rest.startswith("O pr") or not mz:
            champ = None
        else:
            champ = {"school_zh": clean(mz.group(1)), "school_pt": clean(mz.group(2))}
        cats.setdefault(cat_code(m), {})["team_champion"] = champ


def main(raw_dir, out_path):
    raw = pathlib.Path(raw_dir)
    editions = []
    for y in SRC["years"]:
        stem = y["year"].replace("/", "-")
        if y["format"] == "xls":
            cats = parse_xls(raw / f"{stem}_all.xls")
        else:
            cats = {}
            parse_pdf_individual(raw / f"{stem}_individual.pdf", cats)
            parse_pdf_team(raw / f"{stem}_team.pdf", cats)
        ordered = {}
        for g in "MF":
            for l in "ABCDE":
                c = cats.get(g + l, {})
                ind = sorted(c.get("individual", []), key=lambda r: r["rank"])
                ordered[g + l] = {
                    "level": LEVEL[l],
                    "individual": ind,
                    "team_champion": c.get("team_champion"),
                }
        editions.append({
            "year": y["year"], "edition": y["edition"],
            "scope": "top10" if all(len(v["individual"]) <= 10 for v in ordered.values()) else "full",
            "source_ids": y["files"],
            "categories": ordered,
        })
    out = {
        "generated": datetime.date.today().isoformat(),
        "source": "https://portal.dsedj.gov.mo/webdsejspace/site/ce/index.jsp?con=result",
        "editions": editions,
    }
    pathlib.Path(out_path).write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
