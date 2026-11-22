"""由使用者提供的校徽總覽圖（3 行 × 6 個）剪出各校校徽，白色背景轉透明。
用法：python scripts/crop_crests.py images.jpg docs/img/crest
"""
import sys, pathlib
from collections import deque
from PIL import Image

GRID = [  # 由左至右、由上至下；None＝暫未確認是哪間學校，不輸出
    ["ETP", None, "CK", "SP", "KY", "EOZGY"],  # LH 已由「校徽補」提供清晰版，不在此覆蓋
    [None, "PV", "EAUM", "CDBYW", "IS", "MR"],  # 第 1 個菱形「LFS 學」＝化地瑪聖母女子學校（NSF，使用者另圖確認，非嶺南），已由「校徽補」提供
    ["CS", "PC", "EM", "YW", "SJB", None],  # 最後一個＝SRLC，已由「校徽補」提供清晰版
]
src, out = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
im = Image.open(src).convert("RGB")
W, H = im.size
px = im.load()

def ink(x, y):
    r, g, b = px[x, y]
    return min(r, g, b) < 225

# 以「有墨水的欄／列」自動找出三行六欄的界線（跳過頂部標題）
top = int(H * 0.2)
cols = [any(ink(x, y) for y in range(top, H)) for x in range(W)]
rows = [any(ink(x, y) for x in range(W)) for y in range(top, H)]

def runs(flags, offset=0, gap=8):
    segs, start, last = [], None, None
    for i, f in enumerate(flags):
        if f:
            if start is None: start = i
            last = i
        elif start is not None and i - last > gap:
            segs.append((start + offset, last + offset)); start = None
    if start is not None: segs.append((start + offset, last + offset))
    return segs

xs = [s for s in runs(cols) if s[1] - s[0] > 20]
ys = [s for s in runs(rows, top) if s[1] - s[0] > 20]
assert len(xs) == 6 and len(ys) == 3, (xs, ys)

def to_transparent(tile):
    """由四邊向內，把連著邊框的近白色像素設為透明（保留校徽內部的白色）。"""
    tile = tile.convert("RGBA"); w, h = tile.size; p = tile.load()
    seen = [[False] * h for _ in range(w)]
    q = deque([(x, 0) for x in range(w)] + [(x, h - 1) for x in range(w)] + [(0, y) for y in range(h)] + [(w - 1, y) for y in range(h)])
    while q:
        x, y = q.popleft()
        if not (0 <= x < w and 0 <= y < h) or seen[x][y]: continue
        seen[x][y] = True
        r, g, b, a = p[x, y]
        if min(r, g, b) >= 232:
            p[x, y] = (255, 255, 255, 0)
            q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    return tile

for ri, (y0, y1) in enumerate(ys):
    for ci, (x0, x1) in enumerate(xs):
        code = GRID[ri][ci]
        if not code: continue
        # 在格內收緊到墨水範圍
        pts = [(x, y) for x in range(x0, x1 + 1) for y in range(y0, y1 + 1) if ink(x, y)]
        bx0, by0 = min(p[0] for p in pts), min(p[1] for p in pts)
        bx1, by1 = max(p[0] for p in pts), max(p[1] for p in pts)
        side = max(bx1 - bx0, by1 - by0) + 6
        cx, cy = (bx0 + bx1) // 2, (by0 + by1) // 2
        box = (max(cx - side // 2, 0), max(cy - side // 2, 0), min(cx + side // 2, W), min(cy + side // 2, H))
        tile = to_transparent(im.crop(box))
        tile.save(out / f"{code}.png")
        print(code, box, tile.size)
