"""把使用者提供的校徽圖（檔名＝學校代碼）統一處理：白底轉透明、裁掉留白、補成正方形、縮至最長 192px。
用法：python scripts/process_crests.py <來源資料夾> docs/img/crest
只處理 .png／.jpg／.jpeg／.webp；1×1 等無效圖、未下載完的 .crdownload 會略過。
"""
import sys, pathlib
from collections import deque
from PIL import Image

src, dst = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
dst.mkdir(parents=True, exist_ok=True)
MAX = 144  # 最大顯示 72px，2 倍解像度已足夠

def to_transparent(im, thr=228):
    im = im.convert("RGBA"); w, h = im.size; p = im.load()
    seen = bytearray(w * h)
    q = deque([(x, 0) for x in range(w)] + [(x, h - 1) for x in range(w)] + [(0, y) for y in range(h)] + [(w - 1, y) for y in range(h)])
    while q:
        x, y = q.popleft()
        if not (0 <= x < w and 0 <= y < h) or seen[y * w + x]: continue
        seen[y * w + x] = 1
        r, g, b, a = p[x, y]
        if a < 20 or min(r, g, b) >= thr:
            p[x, y] = (255, 255, 255, 0)
            q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    return im

# 檔名可以是學校代碼（例 HK.png）或中文校名（例 廣大中學.png）
import json
_res = pathlib.Path(__file__).resolve().parents[1] / "docs/data/results.json"
CODE_OF = {zh: s["abbr"] for zh, s in json.loads(_res.read_text(encoding="utf-8"))["schools"].items()} if _res.exists() else {}

done = []
for f in sorted(src.iterdir()):
    if f.suffix.lower() not in (".png", ".jpg", ".jpeg", ".webp"): continue
    im = Image.open(f)
    if min(im.size) < 16: print("略過（圖太小）", f.name); continue
    t = to_transparent(im)
    bbox = t.getbbox()
    if not bbox: print("略過（全白）", f.name); continue
    t = t.crop(bbox)
    side = max(t.size) + 4
    sq = Image.new("RGBA", (side, side), (255, 255, 255, 0))
    sq.paste(t, ((side - t.size[0]) // 2, (side - t.size[1]) // 2), t)
    if side > MAX: sq = sq.resize((MAX, MAX), Image.LANCZOS)
    code = CODE_OF.get(f.stem)
    if not code:  # 簡稱（例「嶺南」）：只有一間學校的校名包含它時才採用
        hits = {c for zh, c in CODE_OF.items() if f.stem in zh}
        code = hits.pop() if len(hits) == 1 else f.stem.upper()
    if not code.isascii(): print("略過（認不出學校）", f.name); continue
    out = dst / f"{code}.png"
    sq = sq.quantize(colors=256, method=Image.Quantize.FASTOCTREE)  # 調色盤 PNG，檔案細很多
    sq.save(out, optimize=True); done.append((code, sq.size))
print("完成", len(done), done)
