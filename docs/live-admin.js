/* 終點輸入（工作人員用）：分段計時
   - 登入：Supabase Auth 個人帳戶；資料庫只容許 xc_live_admins 名單內的電郵讀寫
   - 同一號碼每記一次＝完成一圈，記滿該組圈數即完賽（規則見 live-core.js）
   - 號碼只需輸入尾數：在本組名單內尾數唯一即自動配對
   - 第一圈輸入號碼後，運動員會出現在「跑道上」清單，之後按一下該行即記一圈（清單按預計到達排序，可鎖定）
   - 每次輸入即時寫入本機佇列，再上傳；網絡中斷時保留，恢復後自動補傳（以 id 防重複）；多部裝置共用同一份紀錄
   - 時間以按鍵當刻計（已按伺服器時差校正），不受上傳延誤影響
   - 練習模式（live-admin.html?practice=1）：不需登入、不連資料庫，以第 47 屆成績模擬多圈比賽 */
(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const store = { get(k, fb) { try { const v = localStorage.getItem(k); return v == null ? fb : JSON.parse(v); } catch (e) { return fb; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 無痕模式 */ } } };
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => { const r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 3 | 8)).toString(16); }));
  const LIVE_CATS = ["MA", "MB", "FB", "MC", "FC", "FA"];
  const catLabel = (c) => `${c[0] === "M" ? "男" : "女"}${c[1]}`;
  const PRACTICE = new URLSearchParams(location.search).has("practice");

  let sb = null, RACE = null, RES = null, SCHOOL = new Map(), NAME = new Map(), ROSTER = new Map();
  let offset = 0, rev = 0, bibBuf = "";
  const entries = new Map(), heats = new Map();
  let queue = PRACTICE ? [] : store.get("xc-live-queue", []);
  let undoLog = PRACTICE ? [] : store.get("xc-live-undo", []); // 本裝置的操作紀錄：[{id, before}]，供「撤銷上一下」
  const st = Object.assign({ event: "48", cat: "MA", heat: 1, tab: "course", lock: false }, PRACTICE ? {} : store.get("xc-live-state", {}));
  if (PRACTICE) st.event = "practice";
  let lockOrder = [];
  const save = () => { if (!PRACTICE) store.set("xc-live-state", st); };
  const now = () => Date.now() + offset;

  /* ---------- 載入公開資料（學校名稱、往績姓名、賽程） ---------- */
  async function loadStatic() {
    const [site, race, res] = await Promise.all(["data/site.json", "data/race48.json", "data/results.json"].map((u) => fetch(u, { cache: "no-cache" }).then((r) => r.json())));
    RACE = race; RES = res;
    for (const [zh, s] of Object.entries(res.schools)) if (s.abbr) SCHOOL.set(s.abbr, zh);
    for (const s of race.schools) SCHOOL.set(s.abbr, s.zh);
    for (const e of res.editions) for (const c of Object.values(e.categories)) for (const r of c.individual) if (!r.hidden) NAME.set(r.pid, r.name_zh || r.name_pt);
    if (!PRACTICE) sb = supabase.createClient(site.views.url, site.views.key, { auth: { persistSession: true, autoRefreshToken: true } });
  }
  const cats = () => RACE.schedule.slice().sort((a, b) => a.start.localeCompare(b.start)).map((x) => x.cat).filter((c) => LIVE_CATS.includes(c));
  const heatN = (cat) => PRACTICE ? 1 : (RACE.schedule.find((x) => x.cat === cat) || {}).heats || 1;
  const lapsN = (cat = st.cat) => XCLive.lapsOf(RACE, cat);
  const gapSec = (cat = st.cat) => (XCLive.MIN_GAP[cat] || 60) / (PRACTICE ? practice.speed : 1);
  const schoolsIn = (cat) => RACE.schools.filter((s) => s.n && s.n[cat]).sort((a, b) => b.n[cat] - a.n[cat] || a.abbr.localeCompare(b.abbr));
  const abbrOfZh = (zh) => ((RES.schools[zh] || {}).abbr) || zh;

  /* ---------- 登入 ---------- */
  async function login() {
    const msg = $("#loginMsg"); msg.textContent = "登入中……";
    const { error } = await sb.auth.signInWithPassword({ email: $("#email").value.trim(), password: $("#pw").value });
    if (error) { msg.textContent = "登入失敗：電郵或密碼不正確。"; return; }
    await afterLogin();
  }
  async function afterLogin() {
    const { data: ok, error } = await sb.rpc("xc_is_admin");
    if (error || !ok) { $("#loginMsg").textContent = "此帳戶未獲授權輸入成績，請聯絡網站管理員。"; await sb.auth.signOut(); return; }
    showApp();
    $("#event").value = st.event;
    await syncClock();
    await loadRoster();
    await pull(true);
    renderAll();
    setInterval(pull, 2000);
    setInterval(push, 1000);
    startTimers();
    setInterval(syncClock, 60000);
    keepAwake();
  }
  function showApp() { $("#login").hidden = true; $("#app").hidden = false; $("#logout").hidden = PRACTICE; }
  function startTimers() { setInterval(tickClock, 100); setInterval(tickEta, 1000); }

  /* ---------- 時差校正：取往返時間最短的一次 ---------- */
  async function syncClock() {
    let best = null;
    for (let i = 0; i < 5; i++) {
      const t0 = Date.now();
      const { data, error } = await sb.rpc("xc_now");
      const t1 = Date.now();
      if (error) continue;
      const rtt = t1 - t0;
      if (!best || rtt < best.rtt) best = { rtt, off: Number(data) - (t0 + t1) / 2 };
    }
    if (best) offset = best.off;
  }

  async function loadRoster() {
    ROSTER.clear();
    let { data, error } = await sb.from("xc_live_roster").select("bib,cat,heat,abbr,pid,name").eq("event", st.event).limit(5000);
    if (error) ({ data, error } = await sb.from("xc_live_roster").select("bib,cat,heat,abbr,pid").eq("event", st.event).limit(5000)); // 未執行 005 時
    if (!error) for (const r of data) ROSTER.set(String(r.bib), r);
    setSync();
  }

  /* ---------- 與伺服器同步 ---------- */
  let online = true;
  async function pull(full) {
    if (PRACTICE) return;
    if (full) { rev = 0; entries.clear(); heats.clear(); }
    try {
      const [e, h] = await Promise.all([
        sb.from("xc_live_entries").select("*").eq("event", st.event).gt("rev", rev).order("rev").limit(2000),
        sb.from("xc_live_heats").select("cat,heat,start_ms,status,rev").eq("event", st.event).gt("rev", rev).order("rev"),
      ]);
      if (e.error || h.error) throw e.error || h.error;
      let changed = false;
      const pendingIds = new Set(queue.filter((q) => q.t === "entry").map((q) => q.row.id));
      for (const r of e.data) { if (!pendingIds.has(r.id)) entries.set(r.id, r); rev = Math.max(rev, r.rev); changed = true; }
      for (const r of h.data) { const k = `${r.cat}|${r.heat}`; if (!queue.some((q) => q.t === "heat" && `${q.row.cat}|${q.row.heat}` === k)) heats.set(k, r); rev = Math.max(rev, r.rev); changed = true; }
      online = true;
      if (changed) renderAll(); else setSync();
    } catch (err) { online = false; setSync(); }
  }
  let pushing = false;
  async function push() {
    if (PRACTICE) { queue = []; return; }
    if (pushing || !queue.length) return;
    pushing = true;
    try {
      while (queue.length) {
        const q = queue[0];
        const table = q.t === "entry" ? "xc_live_entries" : "xc_live_heats";
        const { error } = await sb.from(table).upsert(q.row, { onConflict: q.t === "entry" ? "id" : "event,cat,heat" });
        if (error) throw error;
        queue.shift(); store.set("xc-live-queue", queue);
      }
      online = true;
    } catch (err) { online = false; console.warn(err); }
    pushing = false; setSync();
  }
  function enqueue(t, row) {
    // 同一筆資料只保留最新一次修改
    queue = queue.filter((q) => !(q.t === t && (t === "entry" ? q.row.id === row.id : q.row.cat === row.cat && q.row.heat === row.heat && q.row.event === row.event)));
    queue.push({ t, row }); if (!PRACTICE) store.set("xc-live-queue", queue);
    if (t === "entry") entries.set(row.id, { ...row, _pending: !PRACTICE }); else heats.set(`${row.cat}|${row.heat}`, { ...row, _pending: !PRACTICE });
    renderAll(); push();
  }
  // 記錄一項可撤銷的終點操作（新增或修改一行紀錄）
  function act(row, label) {
    const prev = entries.get(row.id);
    undoLog.push({ id: row.id, before: prev ? strip(prev) : null, label, cat: row.cat, heat: row.heat });
    undoLog = undoLog.slice(-50); if (!PRACTICE) store.set("xc-live-undo", undoLog);
    enqueue("entry", row);
  }
  function setSync() {
    const el = $("#sync");
    const n = queue.length;
    el.textContent = PRACTICE ? "練習模式 · 不會上傳" : !online ? `離線 · 待上傳 ${n}` : n ? `上傳中 ${n}` : `已同步 · 名單 ${ROSTER.size}`;
    el.className = "sync " + (PRACTICE ? "busy" : !online ? "bad" : n ? "busy" : "ok");
  }

  /* ---------- 組別／分組 ---------- */
  const heatRow = (cat = st.cat, heat = st.heat) => heats.get(`${cat}|${heat}`) || { event: st.event, cat, heat, start_ms: null, status: "ready" };
  function renderBar() {
    $("#cats").innerHTML = cats().map((c) => { const hs = Array.from({ length: heatN(c) }, (_, i) => heatRow(c, i + 1).status); const s = hs.every((x) => x === "done") ? "done" : hs.some((x) => x === "running") ? "running" : "ready";
      return `<button role="tab" class="${c === st.cat ? "on" : ""}" data-cat="${c}"><i class="dot ${s}"></i>${catLabel(c)}<small>${lapsN(c)}圈</small></button>`; }).join("");
    const n = heatN(st.cat);
    $("#heats").innerHTML = n > 1 ? Array.from({ length: n }, (_, i) => `<button class="${st.heat === i + 1 ? "on" : ""}" data-heat="${i + 1}">第 ${i + 1} 組</button>`).join("") : "";
    $("#cats").querySelectorAll("[data-cat]").forEach((b) => b.onclick = () => { st.cat = b.dataset.cat; st.heat = 1; lockOrder = []; save(); clearBib(); renderAll(); });
    $("#heats").querySelectorAll("[data-heat]").forEach((b) => b.onclick = () => { st.heat = Number(b.dataset.heat); lockOrder = []; save(); renderAll(); });
  }
  const mmss = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
  function tickClock() {
    const h = heatRow();
    const el = $("#clock"), cut = $("#cut");
    if (h.status === "running" && h.start_ms != null) {
      const ms = now() - h.start_ms;
      el.textContent = `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}.${Math.floor((ms % 1000) / 100)}`;
      const left = XCLive.CUTOFF[st.cat] * 1000 / (PRACTICE ? practice.speed : 1) - ms;
      cut.textContent = left > 0 ? `距達標時間 ${mmss(left)}` : "已到達標時間：停止記錄";
      cut.className = left <= 0 ? "over" : left < 60000 ? "warn" : "";
    } else { el.textContent = h.status === "done" ? "已完成" : "0:00.0"; cut.textContent = h.status === "done" ? "如需補錄，按「重新開放」" : `${catLabel(st.cat)} 共 ${lapsN()} 圈 · 按「開賽計時」開始`; cut.className = ""; }
    if (PRACTICE) practiceTick();
  }
  function renderClockBtns() {
    const h = heatRow();
    $("#startBtn").hidden = h.status !== "ready";
    $("#doneBtn").hidden = h.status === "ready";
    $("#doneBtn").textContent = h.status === "done" ? "重新開放" : "本組完成";
    $("#adjBtn").hidden = h.status === "ready";
  }
  function startHeat() {
    const t = now();
    enqueue("heat", { event: st.event, cat: st.cat, heat: st.heat, start_ms: t, status: "running" });
    if (PRACTICE) practiceStart(t);
    buzz();
  }
  function toggleDone() {
    const h = heatRow();
    if (h.status === "done") { enqueue("heat", { event: st.event, cat: st.cat, heat: st.heat, start_ms: h.start_ms, status: "running" }); return; }
    const { runners, slots } = ranked();
    const on = runners.filter((r) => !r.fin).length;
    if (!confirm(`確定${catLabel(st.cat)}${heatN(st.cat) > 1 ? `第 ${st.heat} 組` : ""}已完成？${on ? `\n尚有 ${on} 人未完賽，將列為未完成。` : ""}${slots.length ? `\n尚有 ${slots.length} 個空位未填號碼。` : ""}`)) return;
    enqueue("heat", { event: st.event, cat: st.cat, heat: st.heat, start_ms: h.start_ms, status: "done" });
  }
  function adjustStart() {
    const h = heatRow();
    sheet(`<h2>修正起跑時間</h2>
      <p class="muted">輸入調整秒數：正數＝實際起跑比記錄<b>遲</b>（用時減少）；負數＝比記錄<b>早</b>。</p>
      <input id="adjSec" type="number" inputmode="decimal" step="0.1" placeholder="例如 -1.5">
      <div class="row-btns"><button value="cancel" class="ghost">取消</button><button value="ok" class="primary" id="adjOk">套用</button></div>
      <hr><button value="reset" class="danger" id="adjReset">取消開賽（重設為未開始）</button>`, (v) => {
      if (v === "ok") { const d = parseFloat($("#adjSec").value); if (!isNaN(d)) enqueue("heat", { event: st.event, cat: st.cat, heat: st.heat, start_ms: h.start_ms + d * 1000, status: h.status }); }
      if (v === "reset" && confirm("取消開賽？已記錄的時間會變成未有起跑時間。")) enqueue("heat", { event: st.event, cat: st.cat, heat: st.heat, start_ms: null, status: "ready" });
    });
  }

  /* ---------- 號碼：只輸入尾數 ---------- */
  const inCat = () => [...ROSTER.values()].filter((r) => r.cat === st.cat && (heatN(st.cat) === 1 || !r.heat || r.heat === st.heat));
  // 回傳 {hit: 名單一行} 或 {many: [...]} 或 {other: 他組一行} 或 {none: true}
  function resolve(buf) {
    if (!buf) return {};
    const list = inCat().filter((r) => String(r.bib).endsWith(buf));
    const exact = list.find((r) => String(r.bib) === buf);
    if (exact) return { hit: exact };
    if (list.length === 1) return { hit: list[0] };
    if (list.length > 1) return { many: list.sort((a, b) => a.bib - b.bib) };
    const full = ROSTER.get(buf);
    return full ? { other: full } : { none: true };
  }
  function bibHint() {
    const bibs = inCat().map((r) => String(r.bib)).sort();
    if (!bibs.length) return ROSTER.size ? "本組未有號碼布名單" : "未載入號碼布名單：請輸入完整號碼";
    const len = bibs[0].length;
    let p = 0;
    if (bibs.every((b) => b.length === len)) while (p < len - 1 && bibs.every((b) => b[p] === bibs[0][p])) p++;
    return p ? `本組號碼 ${bibs[0]}–${bibs[bibs.length - 1]}：只需輸入尾 ${len - p} 位` : `本組號碼 ${bibs[0]}–${bibs[bibs.length - 1]}：可只輸入尾數`;
  }
  const personOf = (r) => (r && ((r.pid && NAME.get(r.pid)) || r.name)) || "";
  function clearBib() { bibBuf = ""; showBib(); }
  function showBib() {
    $("#bib").textContent = bibBuf;
    const who = $("#who");
    if (!bibBuf) { who.textContent = bibHint(); who.className = "who"; return; }
    const m = resolve(bibBuf);
    if (m.many) { who.textContent = `符合 ${m.many.length} 個號碼，請再輸入`; who.className = "who bad"; return; }
    if (m.other) { who.innerHTML = `${m.other.bib} · ${esc(SCHOOL.get(m.other.abbr) || m.other.abbr)} <b class="warn">屬${catLabel(m.other.cat)}</b>`; who.className = "who bad"; return; }
    if (m.none) { who.textContent = ROSTER.size ? "名單內沒有此號碼" : "未載入號碼布名單"; who.className = "who bad"; return; }
    const r = m.hit, run = runnerOf(r.bib), nm = personOf(r);
    const lap = run ? (run.fin ? "已完賽" : `第 ${run.laps + 1} 圈`) : "第 1 圈";
    who.innerHTML = `<b class="hitbib">${r.bib}</b> ${esc(SCHOOL.get(r.abbr) || r.abbr)}${nm ? ` · ${esc(nm)}` : ""} <b class="lapchip">${lap}</b>`;
    who.className = run && run.fin ? "who bad" : "who ok";
  }
  function key(k) {
    if (k === "del") bibBuf = bibBuf.slice(0, -1);
    else if (k === "ok") return confirmBib();
    else if (bibBuf.length < 5) bibBuf += k;
    showBib();
  }
  function confirmBib() {
    if (!bibBuf) return;
    const tapped = now();
    const m = resolve(bibBuf);
    if (m.many) return pickBib(m.many, tapped);
    if (m.other && !confirm(`號碼 ${m.other.bib} 屬${catLabel(m.other.cat)}，確定記錄在${catLabel(st.cat)}？`)) return;
    if (m.none && !confirm(`號碼 ${bibBuf} 不在名單內，仍要記錄？（學校顯示為待確認）`)) return;
    const r = m.hit || m.other || { bib: Number(bibBuf), abbr: "?", pid: null, name: null };
    recordPass(r, tapped);
    bibBuf = ""; $("#bib").textContent = ""; // 不論記錄與否都清空，避免下一個號碼接在後面
  }
  function pickBib(list, tapped) {
    sheet(`<h2>符合「${esc(bibBuf)}」的號碼</h2><div class="sch-grid">${list.slice(0, 24).map((r) => `<button value="${r.bib}"><b>${r.bib}</b><small>${esc(SCHOOL.get(r.abbr) || r.abbr)}</small></button>`).join("")}</div>
      <div class="row-btns"><button value="cancel" class="ghost">取消</button></div>`, (v) => {
      const r = list.find((x) => String(x.bib) === v);
      if (r) recordPass(r, tapped);
      bibBuf = ""; $("#bib").textContent = "";
    });
  }

  /* ---------- 記一圈 ---------- */
  function firstSlot() { return curEntries().filter((e) => !e.deleted && XCLive.isSlot(e)).sort((a, b) => a.seq - b.seq)[0]; }
  function runnerOf(bib) { return ranked().runners.find((x) => x.key === `b${bib}`); }
  // r：名單一行（bib, abbr, pid, name）；回傳 true＝已記錄
  function recordPass(r, tapped, opt = {}) {
    const h = heatRow();
    const run = runnerOf(r.bib);
    if (run && run.fin && !opt.finish) { flash(`${r.bib} 已完賽（${run.laps} 圈），不再記圈`, true); buzz(); return false; }
    let force = false;
    if (run) {
      const gap = (tapped - run.last.at_ms) / 1000;
      if (gap < gapSec()) {
        if (!confirm(`${r.bib} 在 ${Math.round(gap)} 秒前剛記錄第 ${run.laps} 圈，疑似重複。\n仍要再記一圈？`)) { flash("已略過（疑似重複）", true); return false; }
        force = true;
      }
    }
    if (h.status === "ready" && !confirm("本組尚未按「開賽計時」，仍要記錄？（將沒有用時）")) return false;
    const slot = firstSlot();
    const base = slot || { id: uuid(), event: st.event, cat: st.cat, heat: st.heat, at_ms: tapped, seq: nextSeq(), deleted: false };
    const lap = (run ? run.laps : 0) + 1;
    const fin = !!opt.finish || lap >= lapsN();
    act(strip({ ...base, bib: Number(r.bib), abbr: r.abbr || "?", pid: r.pid || null, name: r.name || null, force: force || !!base.force, fin: !!opt.finish }),
      `${r.bib} ${fin ? "完賽" : `第 ${lap} 圈`}`);
    flash(`${r.bib} ${fin ? "完賽 ✓" : `第 ${lap} 圈`}${slot ? "（填入空位）" : ""}`);
    buzz();
    return true;
  }
  function markFinish() {
    act({ id: uuid(), event: st.event, cat: st.cat, heat: st.heat, bib: null, abbr: "?", pid: null, name: null, at_ms: now(), seq: nextSeq(), deleted: false, fin: false, force: false }, "空位");
    flash("已記時間，請補號碼"); buzz();
  }
  function bySchool() {
    const list = schoolsIn(st.cat);
    sheet(`<h2>按學校記錄完賽</h2><p class="muted">看不清號碼時使用（以一名完賽者計）；會填入最早的空位，否則以現在時間新增。之後可在「全部紀錄」補上號碼。</p>
      <div class="sch-grid">${list.map((s) => `<button value="${esc(s.abbr)}"><b>${esc(s.abbr)}</b><small>${esc(s.zh)}</small></button>`).join("")}<button value="?"><b>?</b><small>不明</small></button></div>
      <div class="row-btns"><button value="cancel" class="ghost">取消</button></div>`, (v) => {
      if (!v || v === "cancel") return;
      const slot = firstSlot();
      const base = slot || { id: uuid(), event: st.event, cat: st.cat, heat: st.heat, at_ms: now(), seq: nextSeq(), deleted: false, bib: null, pid: null, name: null, fin: false, force: false };
      act(strip({ ...base, abbr: v === "?" ? "?" : v }), `按學校 ${v}`);
      buzz();
    });
  }
  function undo() {
    const u = undoLog.pop(); if (!PRACTICE) store.set("xc-live-undo", undoLog);
    if (!u) return;
    const cur = entries.get(u.id);
    if (u.before) enqueue("entry", u.before);
    else if (cur) enqueue("entry", strip({ ...cur, deleted: true }));
    flash(`已撤銷：${u.label}`);
    buzz();
  }
  const strip = (e) => { const { _pending, rev: _r, created_by: _c, created_at: _ca, place: _p, t: _t, ...rest } = e; return rest; };

  /* ---------- 清單 ---------- */
  const curEntries = () => [...entries.values()].filter((e) => e.cat === st.cat && e.heat === st.heat);
  const nextSeq = () => Math.max(0, ...curEntries().map((e) => e.seq)) + 1;
  function ranked() {
    const hs = {}; for (let i = 1; i <= heatN(st.cat); i++) hs[i] = heatRow(st.cat, i);
    return { ...XCLive.buildRunners(curEntries(), hs, { laps: lapsN(), minGap: gapSec(), done: heatRow().status === "done" }), hs };
  }
  function fmtT(t) { if (t == null) return "--"; const s = t / 1000; return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`; }
  const schOf = (x) => (x.abbr === "?" ? "待確認" : (SCHOOL.get(x.abbr) || x.abbr));
  function renderList() {
    const R = ranked();
    const on = R.runners.filter((r) => !r.fin), fin = R.runners.filter((r) => r.fin);
    const all = curEntries();
    $("#listTabs").innerHTML = [["course", `跑道上 ${on.length}`], ["fin", `已完賽 ${fin.length}`], ["all", `全部紀錄 ${all.filter((e) => !e.deleted).length}`]]
      .map(([k, l]) => `<button class="${st.tab === k ? "on" : ""}" data-tab="${k}">${l}</button>`).join("");
    $("#listTabs").querySelectorAll("[data-tab]").forEach((b) => b.onclick = () => { st.tab = b.dataset.tab; save(); renderList(); });
    $("#lockBtn").hidden = st.tab !== "course";
    $("#lockBtn").textContent = st.lock ? "🔒 已鎖定排序" : "鎖定排序";
    $("#lockBtn").classList.toggle("on", st.lock);
    $("#slotNote").hidden = !R.slots.length;
    $("#slotNote").textContent = `有 ${R.slots.length} 個空位待補號碼：下一個輸入或按下的運動員會填入最早的空位。`;
    const L = lapsN();
    const box = $("#list");
    const keep = box.dataset.tab === st.tab ? box.scrollTop : 0; // 重繪時保留捲動位置（按完一行不會跳回頂）
    box.dataset.tab = st.tab;
    if (st.tab === "course") {
      let list = on.map((r) => ({ r, eta: XCLive.eta(r, R.hs) }));
      list.sort((a, b) => a.eta - b.eta || a.r.last.seq - b.r.last.seq);
      if (st.lock) {
        const pos = new Map(lockOrder.map((k, i) => [k, i]));
        list.sort((a, b) => (pos.has(a.r.key) ? pos.get(a.r.key) : -1) - (pos.has(b.r.key) ? pos.get(b.r.key) : -1));
      }
      lockOrder = list.map((x) => x.r.key);
      box.className = "runners";
      box.innerHTML = list.length ? list.map(({ r, eta }) => `<li class="${r.last._pending ? "pending" : ""}" data-key="${esc(r.key)}" data-eta="${eta}">
          <button class="tap" data-bib="${r.bib ?? ""}" aria-label="${r.bib ?? "?"} 記一圈"><b class="bb">${r.bib ?? "?"}</b>
            <span class="nm">${esc(schOf(r))}${personOf(r) ? `<small>${esc(personOf(r))}</small>` : ""}</span>
            <span class="lp"><b>${r.laps}</b>/${L}<small class="eta"></small></span></button>
          <button class="more" data-key="${esc(r.key)}" aria-label="詳情">⋯</button></li>`).join("")
        : `<li class="empty">第一圈請用上方數字鍵輸入號碼；之後運動員會出現在這裏，按一下即記一圈。</li>`;
      box.querySelectorAll(".tap").forEach((b) => b.onclick = () => {
        const bib = b.dataset.bib; if (!bib) return;
        const r = ROSTER.get(bib) || on.find((x) => String(x.bib) === bib);
        recordPass({ bib: Number(bib), abbr: r.abbr, pid: r.pid, name: r.name }, now());
      });
      box.querySelectorAll(".more").forEach((b) => b.onclick = () => runnerSheet(b.dataset.key));
      tickEta();
    } else if (st.tab === "fin") {
      box.className = "fins";
      box.innerHTML = fin.length ? fin.map((r) => `<li data-key="${esc(r.key)}"><span class="pl">${r.place}</span><span class="tt">${fmtT(r.t)}</span>
          <span class="bb">${r.bib ?? "—"}</span><span class="nm">${esc(schOf(r))}${personOf(r) ? `<small>${esc(personOf(r))}</small>` : ""}</span></li>`).join("")
        : `<li class="empty">尚未有人完賽。</li>`;
      box.querySelectorAll("li[data-key]").forEach((el) => el.onclick = () => runnerSheet(el.dataset.key));
    } else {
      const label = new Map();
      for (const r of R.runners) r.passes.forEach((p, i) => label.set(p.id, r.fin && p.id === r.finEntry.id ? (r.anon ? "完賽（無號碼）" : "完賽") : `第 ${i + 1} 圈`));
      const why = { dup: "重複，不計", after: "完賽後，不計" };
      box.className = "records";
      const rows = all.slice().sort((a, b) => b.seq - a.seq);
      box.innerHTML = rows.length ? rows.map((e) => {
        const h = R.hs[e.heat];
        const t = h && h.start_ms != null ? e.at_ms - h.start_ms : null;
        const tag = e.deleted ? "已刪除" : XCLive.isSlot(e) ? "待補號碼" : R.ignored.has(e.id) ? why[R.ignored.get(e.id)] : label.get(e.id) || "";
        return `<li class="${e.deleted ? "del" : ""} ${XCLive.isSlot(e) ? "slot" : ""} ${R.ignored.has(e.id) ? "ign" : ""} ${e._pending ? "pending" : ""}" data-id="${e.id}">
          <span class="tt">${fmtT(t)}</span><span class="bb">${e.bib ?? "—"}</span>
          <span class="nm">${esc(schOf(e))}<small>${esc(tag)}</small></span></li>`;
      }).join("") : `<li class="empty">尚未有紀錄。</li>`;
      box.querySelectorAll("li[data-id]").forEach((el) => el.onclick = () => editEntry(el.dataset.id));
    }
    box.scrollTop = keep;
    $("#undoBtn").disabled = !undoLog.length;
    $("#undoBtn").textContent = undoLog.length ? `↶ 撤銷：${undoLog[undoLog.length - 1].label}` : "↶ 撤銷上一下";
  }
  // 每秒更新「預計到達」倒數（不重排，避免清單跳動）
  function tickEta() {
    const t = now();
    document.querySelectorAll("#list.runners li[data-eta]").forEach((li) => {
      const d = Number(li.dataset.eta) - t, el = li.querySelector(".eta");
      if (!el) return;
      el.textContent = d >= 0 ? `約 ${mmss(d)} 後` : `遲 ${mmss(-d)}`;
      li.classList.toggle("due", d < 15000);
    });
  }
  function runnerSheet(key) {
    const R = ranked();
    const r = R.runners.find((x) => x.key === key); if (!r) return;
    const L = lapsN();
    sheet(`<h2>${r.bib ?? "無號碼"} · ${esc(schOf(r))}</h2>${personOf(r) ? `<p class="muted">${esc(personOf(r))}</p>` : ""}
      <ol class="splits">${r.passes.map((p, i) => `<li><span>${r.fin && p.id === r.finEntry.id ? "完賽" : `第 ${i + 1} 圈`}</span><b>${fmtT(r.splits[i])}</b><small>累計 ${fmtT(p.t)}</small></li>`).join("")}</ol>
      <p class="muted">${r.fin ? `已完賽${r.place ? `，第 ${r.place} 名` : ""}` : `已完成 ${r.laps}／${L} 圈`}</p>
      ${r.fin || r.bib == null ? "" : `<button value="lap" class="primary wide">記一圈</button><button value="finish" class="ghost wide">現在衝線：記為完賽（曾漏記一圈時用）</button>`}
      ${!r.fin || r.bib == null ? "" : r.finEntry.fin ? `<button value="unfin" class="ghost wide">取消「記為完賽」</button>` : ""}
      <div class="row-btns"><button value="dellast" class="danger">刪除最近一次</button><button value="cancel" class="ghost">關閉</button></div>`, (v) => {
      const info = ROSTER.get(String(r.bib)) || r;
      if (v === "lap") recordPass(info, now());
      if (v === "finish") recordPass(info, now(), { finish: true });
      if (v === "unfin") act(strip({ ...entries.get(r.finEntry.id), fin: false }), `${r.bib} 取消完賽`);
      if (v === "dellast" && confirm(`刪除 ${r.bib ?? ""} 最近一次紀錄（${r.fin ? "完賽" : `第 ${r.laps} 圈`}）？`)) act(strip({ ...entries.get(r.last.id), deleted: true }), `刪除 ${r.bib ?? ""} 一次紀錄`);
    });
  }
  function editEntry(id) {
    const e = entries.get(id); if (!e) return;
    const list = curEntries().filter((x) => !x.deleted).sort((a, b) => a.seq - b.seq);
    const i = list.findIndex((x) => x.id === id);
    sheet(`<h2>修改紀錄</h2>
      <label>號碼布（可只輸入尾數）<input id="edBib" type="number" inputmode="numeric" value="${e.bib ?? ""}"></label>
      <div class="row-btns">
        <button value="bib" class="primary">更新號碼</button>
        <button value="school" class="ghost">改按學校</button>
      </div>
      <div class="row-btns">
        <button value="up" class="ghost" ${i <= 0 ? "disabled" : ""}>與較早一行對調</button>
        <button value="down" class="ghost" ${i < 0 || i >= list.length - 1 ? "disabled" : ""}>與較遲一行對調</button>
      </div>
      <button value="insert" class="ghost wide">在此之前插入空位</button>
      <div class="row-btns">
        ${e.deleted ? `<button value="restore" class="ghost">復原</button>` : `<button value="delete" class="danger">刪除</button>`}
        <button value="cancel" class="ghost">關閉</button>
      </div>`, (v) => {
      if (v === "bib") {
        const b = $("#edBib").value.trim();
        const m = resolve(b);
        const r = m.hit || m.other;
        if (b && m.many) { alert(`「${b}」符合多個號碼，請輸入更多位數。`); return; }
        if (b && !r && !confirm(`號碼 ${b} 不在名單內，仍要使用？`)) return;
        act(strip({ ...e, bib: b ? Number(r ? r.bib : b) : null, abbr: r ? r.abbr : b ? "?" : e.abbr, pid: r ? r.pid : null, name: r ? r.name || null : null }), `改號碼 ${b}`);
      }
      if (v === "school") { // 先清空號碼，再沿用按學校流程填入此空位
        act(strip({ ...e, bib: null, abbr: "?", pid: null, name: null }), "改按學校");
        bySchool();
      }
      if (v === "up" || v === "down") {
        const j = v === "up" ? i - 1 : i + 1, o = list[j];
        enqueue("entry", strip({ ...e, seq: o.seq })); enqueue("entry", strip({ ...entries.get(o.id), seq: e.seq }));
      }
      if (v === "insert") {
        const prev = list[i - 1];
        const seq = prev ? (prev.seq + e.seq) / 2 : e.seq - 1;
        const at = prev ? Math.round((prev.at_ms + e.at_ms) / 2) : e.at_ms - 500;
        act({ id: uuid(), event: st.event, cat: st.cat, heat: st.heat, bib: null, abbr: "?", pid: null, name: null, at_ms: at, seq, deleted: false, fin: false, force: false }, "插入空位");
      }
      if (v === "delete" && confirm("刪除此紀錄？")) act(strip({ ...e, deleted: true }), `刪除 ${e.bib ?? ""} 一次紀錄`);
      if (v === "restore") act(strip({ ...e, deleted: false }), `復原 ${e.bib ?? ""}`);
    });
  }

  /* ---------- 練習模式：以第 47 屆成績模擬多圈比賽 ---------- */
  const practice = { speed: 2, sims: {}, };
  const P_BASE = { MA: 1000, MB: 1100, FB: 1200, MC: 1300, FC: 1400, FA: 1500 };
  function practiceSetup() {
    const ed = RES.editions.find((e) => e.edition === 47);
    for (const cat of LIVE_CATS) {
      ed.categories[cat].individual.forEach((r, j) => {
        const bib = P_BASE[cat] + j + 1;
        ROSTER.set(String(bib), { bib, cat, heat: null, abbr: abbrOfZh(r.school_zh), pid: r.hidden ? null : r.pid, name: r.hidden ? null : r.name_zh || r.name_pt, seconds: r.seconds });
      });
    }
    $("#event").hidden = true;
    $("#practiceBar").hidden = false;
    $("#pSpeed").value = String(practice.speed);
    $("#pSpeed").onchange = () => { practice.speed = Number($("#pSpeed").value); };
  }
  function practiceStart(t0) {
    const L = lapsN();
    practice.sims[st.cat] = inCat().map((r, j) => ({ bib: r.bib, at: XCLive.simSplits(r.seconds, L, j + 1).map((ms) => t0 + ms / practice.speed) }));
    $("#pSpeed").disabled = true;
  }
  function practiceTick() {
    const sim = practice.sims[st.cat], strip_ = $("#passing"), score = $("#pScore");
    if (!sim) { strip_.innerHTML = `<span class="muted">按「開賽計時」後，經過終點的號碼會在這裏出現（時間已按倍速壓縮）。</span>`; score.textContent = ""; return; }
    const t = now();
    const passing = [];
    let due = 0, miss = 0, extra = 0;
    const R = ranked();
    const got = new Map(R.runners.map((r) => [r.bib, r.laps]));
    for (const s of sim) {
      for (const a of s.at) if (a <= t && a > t - 6000) passing.push({ bib: s.bib, a });
      const exp = s.at.filter((a) => a <= t - 4000).length, expNow = s.at.filter((a) => a <= t).length;
      const rec = got.get(s.bib) || 0;
      due += exp; miss += Math.max(0, exp - rec); extra += Math.max(0, rec - expNow);
    }
    passing.sort((a, b) => a.a - b.a);
    const html = passing.length ? passing.map((p) => `<b>${p.bib}</b>`).join("") : `<span class="muted">暫時沒有人經過</span>`;
    if (strip_.dataset.h !== html) { strip_.innerHTML = html; strip_.dataset.h = html; }
    score.textContent = `應記 ${due} · 漏記 ${miss} · 多記 ${extra}`;
    score.className = miss || extra ? "warn" : "ok";
  }

  /* ---------- 對話框 ---------- */
  function sheet(html, onClose) {
    const d = $("#sheet"); $("#sheetBody").innerHTML = html;
    d.onclose = () => { const v = d.returnValue; d.returnValue = ""; onClose && onClose(v); };
    d.showModal();
  }
  let flashT = null;
  function flash(msg, bad) { const who = $("#who"); who.textContent = msg; who.className = bad ? "who bad" : "who ok"; clearTimeout(flashT); flashT = setTimeout(showBib, 1100); }
  function buzz() { try { navigator.vibrate && navigator.vibrate(25); } catch (e) { /* 不支援 */ } }
  async function keepAwake() { try { if (navigator.wakeLock) { let lock = await navigator.wakeLock.request("screen"); document.addEventListener("visibilitychange", async () => { if (document.visibilityState === "visible") lock = await navigator.wakeLock.request("screen"); }); } } catch (e) { /* 不支援 */ } }

  function renderAll() { renderBar(); renderClockBtns(); renderList(); tickClock(); setSync(); if (!bibBuf) showBib(); }

  /* ---------- 事件 ---------- */
  $("#pad").addEventListener("click", (e) => { const b = e.target.closest("[data-k]"); if (b) key(b.dataset.k); });
  document.addEventListener("keydown", (e) => {
    if ($("#app").hidden || $("#sheet").open || e.target.tagName === "INPUT") return;
    if (/^\d$/.test(e.key)) key(e.key); else if (e.key === "Backspace") key("del"); else if (e.key === "Enter") key("ok");
  });
  $("#markBtn").onclick = markFinish;
  $("#schoolBtn").onclick = bySchool;
  $("#undoBtn").onclick = undo;
  $("#lockBtn").onclick = () => { st.lock = !st.lock; save(); renderList(); };
  $("#startBtn").onclick = startHeat;
  $("#doneBtn").onclick = toggleDone;
  $("#adjBtn").onclick = adjustStart;
  $("#loginBtn").onclick = login;
  $("#pw").addEventListener("keydown", (e) => { if (e.key === "Enter") login(); });
  $("#logout").onclick = async () => { if (queue.length && !confirm(`尚有 ${queue.length} 項未上傳，登出後會保留在此裝置，下次登入繼續上傳。確定登出？`)) return; await sb.auth.signOut(); location.reload(); };
  $("#event").onchange = async () => { st.event = $("#event").value; save(); undoLog = []; store.set("xc-live-undo", undoLog); await loadRoster(); await pull(true); renderAll(); };
  window.addEventListener("beforeunload", (e) => { if (queue.length) { e.preventDefault(); e.returnValue = ""; } });

  loadStatic().then(async () => {
    if (PRACTICE) { practiceSetup(); showApp(); renderAll(); startTimers(); return; }
    const { data } = await sb.auth.getSession();
    if (data.session) await afterLogin();
  }).catch((e) => { console.error(e); $("#loginMsg").textContent = "資料載入失敗，請檢查網絡後重新整理。"; });
})();
