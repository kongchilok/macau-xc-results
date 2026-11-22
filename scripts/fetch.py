"""下載 sources.json 列出的官方成績檔到指定資料夾（原始檔不入 repo）。
用法：python -I scripts/fetch.py <輸出資料夾>
"""
import json, sys, pathlib, urllib.request, time

out = pathlib.Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
src = json.loads((pathlib.Path(__file__).parent / "sources.json").read_text(encoding="utf-8"))
for y in src["years"]:
    for kind, fid in y["files"].items():
        ext = "xls" if y["format"] == "xls" else "pdf"
        dest = out / f"{y['year'].replace('/', '-')}_{kind}.{ext}"
        if dest.exists() and dest.stat().st_size > 1000:
            continue
        req = urllib.request.Request(src["base"] + str(fid), headers={"User-Agent": "Mozilla/5.0"})
        for attempt in range(2):
            try:
                data = urllib.request.urlopen(req, timeout=60).read()
                break
            except Exception as e:
                if attempt: raise
                time.sleep(3)
        dest.write_bytes(data)
        print(dest.name, len(data))
