/* 運動員榮譽卡：以 Canvas 繪製 1080×1350（4:5）PNG
   版面依使用者提供的示範圖（陳曉晴_榮譽卡）：頂部標誌、主角區（姓名／拼音／校徽／狀態）、四格數據、
   榮譽紀錄（最多 5 行）、最佳成績、網址＋資料來源＋QR 碼。
   三種版本：冠軍（金框＋皇冠）、獎牌（銀／銅框）、參賽紀念（綠框，標題改「歷屆成績」）。 */
(function (root) {
  "use strict";
  const W = 1080, H = 1350, M = 58;
  const C = { bg: "#0c0e12", surface: "#161a20", surface2: "#1f242c", line: "#262b34", text: "#f1f3f6", muted: "#8f97a6",
    accent: "#19e68c", ink: "#03140c", gold: "#f6c544", silver: "#c8d0db", bronze: "#d58b4f", male: "#4fb3ff", female: "#ff6fae" };
  const CJK = '"PingFang TC", "Noto Sans TC", "Microsoft JhengHei", "Heiti TC", sans-serif';
  const NUM = '"Barlow Condensed", "Roboto Condensed", "Arial Narrow", sans-serif';
  const QR_SRC = "https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js";

  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }
  function fit(ctx, text, max, size, min, weight, family) {
    let s = size;
    do { ctx.font = `${weight} ${s}px ${family}`; if (ctx.measureText(text).width <= max) return s; s -= 2; } while (s >= min);
    return s;
  }
  function seeded(seed) { let h = 2166136261; for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296; }

  function contours(ctx, seed) {
    const rnd = seeded(seed);
    ctx.save(); ctx.strokeStyle = "rgba(255,255,255,0.045)"; ctx.lineWidth = 2;
    for (let k = 0; k < 4; k++) {
      const cx = rnd() * W, cy = rnd() * H, a = rnd() * 6;
      for (let r = 60; r < 560; r += 46) {
        ctx.beginPath();
        for (let i = 0; i <= 72; i++) {
          const th = (i / 72) * Math.PI * 2;
          const rad = r * (1 + 0.16 * Math.sin(3 * th + a) + 0.08 * Math.sin(5 * th + a * 2));
          const x = cx + rad * Math.cos(th), y = cy + rad * 0.82 * Math.sin(th);
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  function crown(ctx, x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = C.gold; ctx.strokeStyle = "#8a6400"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-26, 14); ctx.lineTo(-30, -14); ctx.lineTo(-14, 0); ctx.lineTo(0, -20); ctx.lineTo(14, 0); ctx.lineTo(30, -14); ctx.lineTo(26, 14); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillRect(-26, 16, 52, 7);
    for (const [cx, cy] of [[-30, -16], [0, -22], [30, -16]]) { ctx.beginPath(); ctx.arc(cx, cy, 4.5, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
  function loadImg(src) { return new Promise((res) => { if (!src) return res(null); const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; }); }
  function loadQR() {
    if (root.qrcode) return Promise.resolve(root.qrcode);
    return new Promise((res) => { const s = document.createElement("script"); s.src = QR_SRC; s.onload = () => res(root.qrcode || null); s.onerror = () => res(null); document.head.appendChild(s); setTimeout(() => res(root.qrcode || null), 6000); });
  }
  function shield(ctx, x, y, size, abbr, hue) {
    ctx.save(); ctx.translate(x, y);
    const w = size * 0.86, h = size;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w, 0); ctx.lineTo(w, h * 0.55); ctx.quadraticCurveTo(w, h * 0.85, w / 2, h); ctx.quadraticCurveTo(0, h * 0.85, 0, h * 0.55); ctx.closePath();
    ctx.fillStyle = `hsl(${hue} 55% 36%)`; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = `hsl(${hue} 60% 62%)`; ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    fit(ctx, abbr, w - 14, 40, 16, 800, NUM); ctx.fillText(abbr, w / 2, h * 0.45);
    ctx.restore();
  }

  async function render(d) {
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d");
    try { await Promise.all([document.fonts.load(`800 60px ${NUM}`), document.fonts.load(`700 60px ${NUM}`)]); } catch (e) { /* 字體載入失敗時用後備字體 */ }
    const [crestImg, qrLib] = await Promise.all([loadImg(d.crestImg), d.qrUrl ? loadQR() : null]);
    const tier = d.tier === "gold" ? C.gold : d.tier === "silver" ? C.silver : d.tier === "bronze" ? C.bronze : C.accent;

    // 背景
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    contours(ctx, d.seed || d.name);

    // 頂部標誌
    rr(ctx, M, 38, 62, 62, 12); ctx.fillStyle = C.accent; ctx.fill();
    ctx.fillStyle = C.ink; ctx.font = `800 36px ${NUM}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("XC", M + 31, 70);
    ctx.textAlign = "left"; ctx.fillStyle = C.text; ctx.font = `800 44px ${CJK}`; ctx.fillText("澳門學界越野跑", M + 80, 70);
    ctx.textAlign = "right"; ctx.fillStyle = C.muted; ctx.font = `500 30px ${CJK}`; ctx.fillText("非官方整理", W - M, 70);
    ctx.fillStyle = C.accent; ctx.fillRect(M, 120, W - 2 * M, 3);

    // 主角區
    const hy = 175, hh = 222;
    rr(ctx, M, hy, W - 2 * M, hh, 20); ctx.fillStyle = C.surface; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = tier; ctx.stroke();
    if (d.tier === "gold") { crown(ctx, M + 12, hy - 14, 1); crown(ctx, W - M - 12, hy - 14, 1); }
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = C.text;
    fit(ctx, d.name, 440, 88, 48, 800, CJK); ctx.fillText(d.name, M + 44, hy + 118);
    if (d.namePt) { ctx.fillStyle = C.muted; fit(ctx, d.namePt, 440, 42, 26, 600, NUM); ctx.fillText(d.namePt, M + 46, hy + 178); }
    // 學校白卡
    const sx = 562, sy = hy + 30, sw = W - M - 28 - sx, sh = hh - 60;
    rr(ctx, sx, sy, sw, sh, 18); ctx.fillStyle = "#ffffff"; ctx.fill();
    const cs = 112;
    if (crestImg) { const r = Math.min(cs / crestImg.width, cs / crestImg.height); const w = crestImg.width * r, h = crestImg.height * r; ctx.drawImage(crestImg, sx + 18 + (cs - w) / 2, sy + (sh - h) / 2, w, h); }
    else shield(ctx, sx + 26, sy + (sh - cs) / 2, cs, d.crestAbbr || "?", d.crestHue || 150);
    const tx = sx + 18 + cs + 16, tw = sx + sw - 16 - tx;
    ctx.fillStyle = "#14181e"; ctx.textAlign = "left";
    const sch = d.school || "";
    let fs = fit(ctx, sch, tw, 40, 26, 800, CJK);
    if (ctx.measureText(sch).width > tw) { // 校名太長：分兩行
      const half = Math.ceil(sch.length / 2); fs = fit(ctx, sch.slice(0, half), tw, 32, 20, 800, CJK);
      ctx.fillText(sch.slice(0, half), tx, sy + 52); ctx.fillText(sch.slice(half), tx, sy + 52 + fs + 4);
    } else ctx.fillText(sch, tx, sy + 64);
    if (d.status) {
      ctx.font = `700 26px ${CJK}`; const pw = Math.min(ctx.measureText(d.status).width + 32, tw);
      rr(ctx, tx, sy + sh - 62, pw, 44, 10); ctx.fillStyle = d.statusMuted ? "#e3e7ec" : C.accent; ctx.fill();
      ctx.fillStyle = d.statusMuted ? "#3b424d" : C.ink; ctx.textBaseline = "middle"; fit(ctx, d.status, pw - 24, 26, 18, 700, CJK); ctx.fillText(d.status, tx + 16, sy + sh - 40); ctx.textBaseline = "alphabetic";
    }

    // 四格數據
    const by = 418, bh = 182;
    rr(ctx, M, by, W - 2 * M, bh, 18); ctx.fillStyle = C.surface; ctx.fill();
    const cw = (W - 2 * M) / 4;
    const cells = [["參賽", String(d.stats.races), C.text, NUM], ["冠軍", String(d.stats.wins), d.stats.wins ? C.gold : C.text, NUM], ["獎牌", String(d.stats.medals), C.text, NUM], ["最佳", `第${d.stats.best}名`, C.text, CJK]];
    cells.forEach(([lab, val, col, fam], i) => {
      const cx = M + cw * i + cw / 2;
      if (i) { ctx.fillStyle = C.line; ctx.fillRect(M + cw * i, by + 30, 2, bh - 60); }
      ctx.textAlign = "center"; ctx.fillStyle = C.muted; ctx.font = `500 40px ${CJK}`; ctx.fillText(lab, cx, by + 70);
      ctx.fillStyle = col; fit(ctx, val, cw - 30, fam === NUM ? 92 : 76, 40, 800, fam); ctx.fillText(val, cx, by + 152);
    });

    // 榮譽紀錄
    const ty = 680;
    ctx.fillStyle = C.accent; ctx.fillRect(M, ty - 30, 4, 30); ctx.fillRect(M, ty - 30, 22, 4);
    ctx.textAlign = "left"; ctx.font = `800 48px ${CJK}`; ctx.fillText(d.title, M + 40, ty);
    const rows = d.rows.slice(0, 5);
    const rowH = rows.length >= 5 ? 84 : Math.min(112, 420 / Math.max(rows.length, 1)), ry = ty + 26; // 少於 5 行時加大行距，避免中間留空
    rows.forEach((r, i) => {
      const y = ry + i * rowH + rowH / 2;
      const medal = r.place <= 3 ? [C.gold, C.silver, C.bronze][r.place - 1] : null;
      ctx.beginPath(); ctx.arc(M + 50, y, 36, 0, Math.PI * 2);
      ctx.fillStyle = medal || C.surface2; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = medal ? "rgba(0,0,0,.25)" : C.line; ctx.stroke();
      ctx.fillStyle = medal ? "#2a1e00" : C.text; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      if (medal) { ctx.font = `800 34px ${CJK}`; ctx.fillText(["金", "銀", "銅"][r.place - 1], M + 50, y + 1); }
      else { fit(ctx, String(r.place), 56, 36, 22, 800, NUM); ctx.fillText(String(r.place), M + 50, y + 2); }
      ctx.textAlign = "left"; ctx.fillStyle = C.text; ctx.font = `700 46px ${NUM}`;
      const yr = r.year; ctx.fillText(yr, M + 112, y + 2);
      const yw = ctx.measureText(yr).width;
      ctx.font = `700 42px ${CJK}`; ctx.fillText(`・第${r.edition}屆`, M + 112 + yw + 4, y + 2);
      // 組別膠囊
      const pill = r.cat; ctx.font = `700 32px ${CJK}`; const pw = ctx.measureText(pill).width + 30;
      rr(ctx, 640, y - 25, pw, 50, 10); ctx.fillStyle = r.gender === "M" ? C.male : C.female; ctx.fill();
      ctx.fillStyle = r.gender === "M" ? "#04121f" : "#23040f"; ctx.fillText(pill, 655, y + 1);
      ctx.textAlign = "right"; ctx.fillStyle = C.text; ctx.font = `800 64px ${NUM}`; ctx.fillText(r.time, W - M - 18, y + 4);
      ctx.textBaseline = "alphabetic";
    });

    // 最佳成績
    const py = H - 160;
    if (d.pb) {
      ctx.textAlign = "left"; ctx.fillStyle = C.accent; ctx.font = `700 44px ${CJK}`;
      const a = `${d.pb.label}最佳 `; ctx.fillText(a, M + 20, py);
      let x = M + 20 + ctx.measureText(a).width;
      ctx.font = `800 48px ${NUM}`; ctx.fillText(d.pb.time, x, py); x += ctx.measureText(d.pb.time).width + 10;
      ctx.fillStyle = C.muted; ctx.font = `600 42px ${NUM}`; ctx.fillText(`(${d.pb.year})`, x, py);
    }

    // 頁尾
    const qs = 148, qx = W - M - qs, qy = H - 40 - qs;
    const qr = qrLib && d.qrUrl ? (() => { try { const q = qrLib(0, "M"); q.addData(d.qrUrl); q.make(); return q; } catch (e) { return null; } })() : null;
    ctx.fillStyle = C.accent; ctx.fillRect(M, H - 128, (qr ? qx - 24 : W - M) - M, 3);
    ctx.textAlign = "left"; ctx.fillStyle = C.muted; ctx.font = `500 30px ${NUM}`; ctx.fillText(d.url, M, H - 80);
    ctx.font = `500 27px ${CJK}`; ctx.fillText("資料來源：教育及青年發展局公布成績", M, H - 40);
    if (qr) {
      rr(ctx, qx, qy, qs, qs, 14); ctx.fillStyle = "#fff"; ctx.fill();
      const n = qr.getModuleCount(), pad = 10, cell = (qs - pad * 2) / n;
      ctx.fillStyle = "#000";
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) ctx.fillRect(qx + pad + c * cell, qy + pad + r * cell, Math.ceil(cell), Math.ceil(cell));
    }
    return cv;
  }

  root.XCCard = { render, W, H };
})(window);
