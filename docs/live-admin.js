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

  let PRED = {}, sb = null, RACE = null, RES = null, SCHOOL = new Map(), NAME = new Map(), ROSTER = new Map();
  let offset = 0, rev = 0, bibBuf = "";
  const entries = new Map(), heats = new Map();
  let queue = PRACTICE ? [] : store.get("xc-live-queue", []);
  let undoLog = PRACTICE ? [] : store.get("xc-live-undo", []); // 本裝置的操作紀錄：[{id, before}]，供「撤銷上一下」
  const st = Object.assign({ event: "48", cat: "MA", heat: 1, tab: "course", lock: false, padOff: false }, PRACTICE ? {} : store.get("xc-live-state", {}));
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
    sb = supabase.createClient(site.views.url, site.views.key, { auth: { persistSession: true, autoRefreshToken: true } });
    try { PRED = (await fetch("data/preview48.json", { cache: "no-cache" }).then((r) => r.json())).categories || {}; } catch (e) { PRED = {}; }
  }
  const cats = () => RACE.schedule.slice().sort((a, b) => a.start.localeCompare(b.start)).map((x) => x.cat).filter((c) => LIVE_CATS.includes(c));
  const heatN = (cat) => PRACTICE && !practice.real ? 1 : (RACE.schedule.find((x) => x.cat === cat) || {}).heats || 1;
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
  function showApp() { $("#login").hidden = true; $("#app").hidden = false; $("#logout").hidden = PRACTICE; document.body.classList.add("app-on"); }
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
  // 組別及分組：同一時間只有一組比賽，以一個下拉選單選擇（按賽程次序；男C、女C 分組逐一列出）
  const grpName = (cat, heat) => `${catLabel(cat)}${heatN(cat) > 1 ? ` 第 ${heat} 組` : ""}`;
  function renderBar() {
    if (!cats().includes(st.cat)) st.cat = cats()[0];
    if (!(st.heat >= 1 && st.heat <= heatN(st.cat))) st.heat = 1;
    const opts = [];
    for (const c of cats()) for (let h = 1; h <= heatN(c); h++) {
      const s = heatRow(c, h).status;
      const mark = s === "running" ? "▶ " : s === "done" ? "✓ " : "";
      opts.push(`<option value="${c}|${h}" ${c === st.cat && h === st.heat ? "selected" : ""}>${mark}${grpName(c, h)}（${lapsN(c)} 圈）${s === "running" ? " · 進行中" : s === "done" ? " · 已完成" : ""}</option>`);
    }
    const sel = $("#grp");
    if (sel.dataset.h !== opts.join("")) { sel.innerHTML = opts.join(""); sel.dataset.h = opts.join(""); }
    sel.value = `${st.cat}|${st.heat}`;
    $("#grpLabel").textContent = `${grpName(st.cat, st.heat)} · ${lapsN()} 圈`;
  }
  function chooseGroup(v) {
    const [c, h] = String(v || "").split("|");
    if (!cats().includes(c)) { renderBar(); return; }
    st.cat = c; st.heat = Number(h) || 1; lockOrder = []; save(); clearBib(); renderAll();
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
    } else { el.textContent = h.status === "done" ? "已完成" : "0:00.0"; cut.textContent = h.status === "done" ? "如需補錄，按「重新開放」" : "按「開賽計時」開始"; cut.className = ""; }
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

  /* ---------- 號碼：本組號碼有共同前綴時只需輸入尾數 ----------
     第 48 屆號碼布按學校編配（1 至 690，女子先、男子後），同組號碼沒有共同前綴，因此要輸入完整號碼（最多 3 位）；
     如日後號碼按組別編配（例如男A 全部 10xx），系統會自動容許只輸入尾數 */
  const inCat = () => [...ROSTER.values()].filter((r) => r.cat === st.cat && (heatN(st.cat) === 1 || !r.heat || r.heat === st.heat));
  function catPrefix() {
    const bibs = inCat().map((r) => String(r.bib));
    if (bibs.length < 2 || !bibs.every((b) => b.length === bibs[0].length)) return "";
    let p = 0;
    while (p < bibs[0].length - 1 && bibs.every((b) => b[p] === bibs[0][p])) p++;
    return bibs[0].slice(0, p);
  }
  const where = (r) => `${catLabel(r.cat)}${heatN(r.cat) > 1 && r.heat ? ` 第 ${r.heat} 組` : ""}`;
  // 回傳 {hit: 名單一行} 或 {many: [...]} 或 {partial: n} 或 {other: 他組一行} 或 {none: true}
  function resolve(buf) {
    if (!buf) return {};
    const list = inCat();
    const exact = list.find((r) => String(r.bib) === buf);
    if (exact) return { hit: exact };
    if (catPrefix()) {
      const tail = list.filter((r) => String(r.bib).endsWith(buf));
      if (tail.length === 1) return { hit: tail[0] };
      if (tail.length > 1) return { many: tail.sort((x, y) => x.bib - y.bib) };
    }
    const full = ROSTER.get(buf);
    const partial = list.filter((r) => String(r.bib).startsWith(buf)).length;
    if (partial) return { partial, other: full };
    return full ? { other: full } : { none: true };
  }
  function bibHint() {
    const list = inCat();
    if (!list.length) return ROSTER.size ? "本組未有號碼布名單" : "未載入號碼布名單：請輸入完整號碼";
    const pre = catPrefix(), bibs = list.map((r) => String(r.bib)).sort();
    const grp = `${catLabel(st.cat)}${heatN(st.cat) > 1 ? ` 第 ${st.heat} 組` : ""}`;
    return pre ? `${grp} 號碼 ${bibs[0]}–${bibs[bibs.length - 1]}：只需輸入尾 ${bibs[0].length - pre.length} 位` : `${grp} 共 ${list.length} 人：輸入號碼布號碼`;
  }
  const personOf = (r) => (r && ((r.pid && NAME.get(r.pid)) || r.name)) || "";
  function clearBib() { bibBuf = ""; showBib(); }
  function showBib() {
    $("#bib").textContent = bibBuf;
    const who = $("#who");
    if (!bibBuf) { who.textContent = bibHint(); who.className = "who"; return; }
    const m = resolve(bibBuf);
    if (m.many) { who.textContent = `符合 ${m.many.length} 個號碼，請再輸入`; who.className = "who bad"; return; }
    if (m.partial) { who.textContent = `輸入中……（本組有 ${m.partial} 個號碼以 ${bibBuf} 開頭）`; who.className = "who"; return; }
    if (m.other) { who.innerHTML = `${m.other.bib} · ${esc(SCHOOL.get(m.other.abbr) || m.other.abbr)} <b class="warn">屬${where(m.other)}</b>`; who.className = "who bad"; return; }
    if (m.none) { who.textContent = ROSTER.size ? "名單內沒有此號碼" : "未載入號碼布名單"; who.className = "who bad"; return; }
    const r = m.hit, run = runnerOf(r.bib), nm = personOf(r);
    const lap = run ? (run.fin ? "已完賽" : `第 ${run.laps + 1} 圈`) : "第 1 圈";
    who.innerHTML = `<b class="hitbib">${r.bib}</b> ${esc(SCHOOL.get(r.abbr) || r.abbr)}${nm ? ` · ${esc(nm)}` : ""} <b class="lapchip">${lap}</b>`;
    who.className = run && run.fin ? "who bad" : "who ok";
  }
  function key(k) {
    if (k === "del") bibBuf = "";   // 重新輸入：清除整個號碼
    else if (k === "ok") return confirmBib();
    else if (bibBuf.length < 5) bibBuf += k;
    showBib();
  }
  function confirmBib() {
    if (!bibBuf) return;
    const tapped = now();
    const m = resolve(bibBuf);
    if (m.many) return pickBib(m.many, tapped);
    if (m.other && !confirm(`號碼 ${m.other.bib} 屬${where(m.other)}，確定記錄在${where({ cat: st.cat, heat: st.heat })}？`)) return;
    if (m.partial && !m.other && !confirm(`號碼 ${bibBuf} 不在名單內，仍要記錄？（學校顯示為待確認）`)) return;
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
  let lastReason = "";
  // opt.voice：語音輸入，不彈確認框；不記錄時以 lastReason 說明原因
  function recordPass(r, tapped, opt = {}) {
    const h = heatRow();
    const run = runnerOf(r.bib);
    lastReason = "";
    if (run && run.fin && !opt.finish) { lastReason = "已完賽，未記錄"; flash(`${r.bib} 已完賽（${run.laps} 圈），不再記圈`, true); buzz(); return false; }
    let force = false;
    if (run) {
      const gap = (tapped - run.last.at_ms) / 1000;
      if (gap < gapSec()) {
        if (opt.voice) { lastReason = `${Math.round(gap)} 秒前剛記錄，疑似重複，已略過`; flash(`${r.bib} 疑似重複，已略過`, true); return false; }
        if (!confirm(`${r.bib} 在 ${Math.round(gap)} 秒前剛記錄第 ${run.laps} 圈，疑似重複。\n仍要再記一圈？`)) { flash("已略過（疑似重複）", true); return false; }
        force = true;
      }
    }
    if (h.status === "ready" && (opt.voice || !confirm("本組尚未按「開賽計時」，仍要記錄？（將沒有用時）"))) { lastReason = "本組尚未開賽，未記錄"; return false; }
    const slot = firstSlot();
    const base = slot || { id: uuid(), event: st.event, cat: st.cat, heat: st.heat, at_ms: tapped, seq: nextSeq(), deleted: false };
    const lap = (run ? run.laps : 0) + 1;
    const fin = !!opt.finish || lap >= lapsN();
    act(strip({ ...base, bib: Number(r.bib), abbr: r.abbr || "?", pid: r.pid || null, name: r.name || null, force: force || !!base.force, fin: !!opt.finish }),
      `${r.bib} ${fin ? "完賽" : `第 ${lap} 圈`}`);
    flash(`${r.bib} ${fin ? "完賽 ✓" : `第 ${lap} 圈`}${slot ? "（填入空位）" : ""}`);
    lastReason = fin ? "完賽" : `第 ${lap} 圈`;
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
    $("#listTabs").innerHTML = [["grid", "號碼格"], ["course", `跑道上 ${on.length}`], ["fin", `已完賽 ${fin.length}`], ["all", `紀錄 ${all.filter((e) => !e.deleted).length}`]]
      .map(([k, l]) => `<button class="${st.tab === k ? "on" : ""}" data-tab="${k}">${l}</button>`).join("");
    $("#listTabs").querySelectorAll("[data-tab]").forEach((b) => b.onclick = () => { st.tab = b.dataset.tab; save(); renderList(); });
    $("#lockBtn").hidden = st.tab !== "course";
    $("#bubbles").classList.toggle("off", st.tab === "grid"); // 號碼格已包含全部號碼，不再顯示泡泡
    document.body.classList.toggle("grid-mode", st.tab === "grid"); // 號碼格取代數字鍵，騰出位置
    document.body.classList.toggle("pad-off", !!st.padOff);          // 收起數字鍵，看清整個排名
    $("#padBtn").hidden = st.tab === "grid";
    $("#padBtn").textContent = st.padOff ? "⌨ 顯示" : "⌨ 收起";
    $("#padBtn").classList.toggle("on", !!st.padOff);
    $("#lockBtn").textContent = st.lock ? "🔒 已鎖定排序" : "鎖定排序";
    $("#lockBtn").classList.toggle("on", st.lock);
    renderBubbles(R);
    $("#slotNote").hidden = !R.slots.length;
    $("#slotNote").textContent = `有 ${R.slots.length} 個空位待補號碼：下一個輸入或按下的運動員會填入最早的空位。`;
    const L = lapsN();
    const box = $("#list");
    const keep = box.dataset.tab === st.tab ? box.scrollTop : 0; // 重繪時保留捲動位置（按完一行不會跳回頂）
    box.dataset.tab = st.tab;
    if (st.tab === "grid") {
      // 號碼格：本組（分組）全部號碼，按預測排名排列（其餘按號碼）；按一下記一圈
      const order = new Map(predictedBibs().map((r, i) => [String(r.bib), i]));
      const byKey = new Map(R.runners.map((x) => [x.key, x]));
      const list = inCat().sort((a, b) => (order.has(String(a.bib)) ? order.get(String(a.bib)) : 1e4) - (order.has(String(b.bib)) ? order.get(String(b.bib)) : 1e4) || a.bib - b.bib);
      box.className = "grid";
      box.innerHTML = list.length ? list.map((r) => { const x = byKey.get(`b${r.bib}`), n = x ? x.laps : 0;
        return `<li class="${x && x.fin ? "fin" : n ? "run" : ""}"><button data-gb="${r.bib}"><b>${r.bib}</b><span>${esc(personOf(r) || r.abbr)}</span><i>${x && x.fin ? "完賽" : `${n}／${L}`}</i></button></li>`; }).join("")
        : `<li class="empty">${ROSTER.size ? "本組未有號碼布名單。" : "未載入號碼布名單。"}</li>`;
      box.querySelectorAll("[data-gb]").forEach((b) => b.onclick = () => { const r = ROSTER.get(b.dataset.gb); if (r) recordPass(r, now()); });
    } else if (st.tab === "course") {
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
    $("#undoBtn").textContent = undoLog.length ? `↶ 撤銷 ${undoLog[undoLog.length - 1].label}` : "↶ 撤銷";
  }
  /* 第一圈快速記錄：本組（分組）預測排名最前、尚未記第一圈的 5 人以泡泡顯示，按一下即記第一圈
     預測來自賽前預覽（preview48.json）：有往績者以學生編號對應名單，其餘以姓名及學校對應 */
  function predictedBibs() {
    const pred = (PRED[st.cat] || {}).prediction || [];
    const list = inCat();
    const byPid = new Map(list.filter((r) => r.pid).map((r) => [r.pid, r]));
    const out = [];
    for (const x of pred) {
      const r = x.pid ? byPid.get(x.pid) : list.find((y) => y.name && y.name === x.name_zh && SCHOOL.get(y.abbr) === x.school_zh);
      if (r && !out.includes(r)) out.push(r);
    }
    return out;
  }
  function renderBubbles(R) {
    const box = $("#bubbles"), h = heatRow();
    const seen = new Set(R.runners.map((r) => r.key));
    const top = h.status === "done" ? [] : predictedBibs().filter((r) => !seen.has(`b${r.bib}`)).slice(0, 5);
    box.hidden = !top.length;
    const html = top.map((r) => `<button data-pb="${r.bib}"><b>${r.bib}</b><span>${esc(personOf(r) || SCHOOL.get(r.abbr) || r.abbr)}</span></button>`).join("");
    if (box.dataset.h !== html) {
      box.innerHTML = `<small>預測前列 · 按一下記第 1 圈</small>${html}`; box.dataset.h = html;
      box.querySelectorAll("[data-pb]").forEach((b) => b.onclick = () => { const r = ROSTER.get(b.dataset.pb); if (r) recordPass(r, now()); });
    }
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

  /* ---------- 練習模式：不寫入資料庫 ----------
     已在此瀏覽器登入並獲授權：使用今屆真實號碼布及姓名（演練資料 event "test"），按分組練習；
     各人的模擬時間取自第 47 屆同組成績分布（按預測排名先後分配）
     未登入：以第 47 屆成績及示範號碼示範 */
  const practice = { speed: 2, sims: {}, real: false };
  const P_BASE = { MA: 1000, MB: 1100, FB: 1200, MC: 1300, FC: 1400, FA: 1500 };
  async function practiceSetup() {
    const ed = RES.editions.find((e) => e.edition === 47);
    let real = null;
    try {
      const { data } = await sb.auth.getSession();
      if (data.session) {
        const ok = await sb.rpc("xc_is_admin");
        if (ok.data) { const r = await sb.from("xc_live_roster").select("bib,cat,heat,abbr,pid,name").eq("event", "test").lte("bib", 999).limit(5000); if (!r.error && r.data.length) real = r.data; }
      }
    } catch (e) { real = null; }
    if (real) {
      practice.real = true;
      let pv = {};
      try { pv = (await fetch("data/preview48.json", { cache: "no-cache" }).then((x) => x.json())).categories || {}; } catch (e) { /* 沒有預測時按號碼次序 */ }
      for (const cat of LIVE_CATS) {
        const times = ed.categories[cat].individual.map((r) => r.seconds).sort((a, b) => a - b);
        const order = new Map(((pv[cat] || {}).prediction || []).filter((x) => x.pid).map((x, i) => [x.pid, i]));
        const mine = real.filter((r) => r.cat === cat).sort((a, b) => (order.has(a.pid) ? order.get(a.pid) : 999) - (order.has(b.pid) ? order.get(b.pid) : 999) || ((a.bib * 7919) % 101) - ((b.bib * 7919) % 101));
        mine.forEach((r, i) => { const t0 = times[Math.round(i * (times.length - 1) / Math.max(1, mine.length - 1))]; ROSTER.set(String(r.bib), { ...r, seconds: t0 + ((r.bib * 37) % 9) - 4 }); });
      }
      $("#pSrc").textContent = "今屆真實名單";
    } else {
      for (const cat of LIVE_CATS) {
        ed.categories[cat].individual.forEach((r, j) => {
          const bib = P_BASE[cat] + j + 1;
          ROSTER.set(String(bib), { bib, cat, heat: null, abbr: abbrOfZh(r.school_zh), pid: r.hidden ? null : r.pid, name: r.hidden ? null : r.name_zh || r.name_pt, seconds: r.seconds });
        });
      }
      $("#pSrc").textContent = "第 47 屆示範名單（登入後可用今屆名單）";
    }
    $("#event").hidden = true;
    $("#practiceBar").hidden = false;
    $("#pSpeed").value = String(practice.speed);
    $("#pSpeed").onchange = () => { practice.speed = Number($("#pSpeed").value); };
  }
  function practiceStart(t0) {
    const L = lapsN();
    practice.sims[`${st.cat}|${st.heat}`] = inCat().map((r, j) => ({ bib: r.bib, at: XCLive.simSplits(r.seconds, L, j + 1).map((ms) => t0 + ms / practice.speed) }));
    $("#pSpeed").disabled = true;
  }
  function practiceTick() {
    const sim = practice.sims[`${st.cat}|${st.heat}`], strip_ = $("#passing"), score = $("#pScore");
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
    const html = passing.length ? passing.map((p) => `<b>${p.bib}</b>`).join("") : `<span class="muted">暫時沒有人經過 · ${$("#pSrc").textContent}</span>`;
    if (strip_.dataset.h !== html) { strip_.innerHTML = html; strip_.dataset.h = html; }
    score.textContent = `應記 ${due} · 漏記 ${miss} · 多記 ${extra}`;
    score.className = miss || extra ? "warn" : "ok";
  }

  /* ---------- 語音輸入（試驗）----------
     瀏覽器內置語音識別（Android Chrome 經 Google、iPhone Safari 經 Apple 聽寫）；先用粵語 yue-Hant-HK，不支援時改用 zh-HK
     只在目前組別／分組名單內配對；講「撤銷」或「取消」＝撤銷上一下
     時間以識別完成時計（較實際經過約遲 0.5 至 2 秒） */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const voice = { on: false, rec: null, lang: "yue-Hant-HK", log: [], fellBack: false };
  const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  function voiceInit() {
    const b = $("#micBtn");
    b.hidden = false;
    if (!SR) { b.classList.add("na"); b.title = "此瀏覽器不支援語音輸入"; b.onclick = () => voiceLog(IOS ? "此瀏覽器不支援語音識別：iPhone 請改用 Safari" : "此瀏覽器不支援語音識別：請改用 Chrome", "bad"); return; }
    b.onclick = () => (voice.on ? voiceStop() : voiceStart());
  }
  function voiceStart() {
    let rec;
    try { rec = new SR(); } catch (e) { voiceLog("未能啟動語音識別", "bad"); return; }
    rec.lang = voice.lang; rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 3;
    rec.onresult = (ev) => {
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) voiceHandle([...r].map((a) => a.transcript), now());
        else { const w = $("#who"); w.textContent = `聽到：${r[0].transcript}`; w.className = "who"; }
      }
    };
    rec.onerror = (e) => {
      const code = e.error;
      if (code === "no-speech" || code === "aborted") return;
      // 已成功收聽，其後自動重新開始被拒（iPhone 只容許由按鍵啟動）
      if (voice.restarting && (code === "not-allowed" || code === "service-not-allowed")) { voiceLog("收聽已暫停（裝置不容許自動重新開始）：請再按一次麥克風", "warn"); voiceStop(); return; }
      // 粵語代碼不獲接受（iPhone 可能報 service-not-allowed 或 not-allowed）：改用 zh-HK，請使用者再按一次（iPhone 須由按鍵啟動）
      if ((code === "language-not-supported" || code === "service-not-allowed" || code === "not-allowed") && voice.lang !== "zh-HK" && !voice.fellBack) {
        voice.fellBack = true; voice.lang = "zh-HK";
        voiceLog(`未能以 yue-Hant-HK 啟動（${code}），已改用 zh-HK：請再按一次麥克風`, "warn"); voiceStop(); return;
      }
      const tip = IOS ? "iPhone：設定 → 一般 → 鍵盤 → 開啟「啟用聽寫」並加入粵語／中文（香港）；Safari 網址列「大小」→ 網站設定 → 麥克風 → 允許" : "請在瀏覽器網站設定容許麥克風";
      if (code === "not-allowed") voiceLog(`未獲准使用麥克風（${code}）。${tip}`, "bad");
      else if (code === "service-not-allowed") voiceLog(`語音識別服務不可用（${code}）。${tip}`, "bad");
      else if (code === "audio-capture") voiceLog(`找不到麥克風（${code}）`, "bad");
      else if (code === "network") voiceLog(`語音識別需要網絡連線（${code}）`, "bad");
      else { voiceLog(`語音識別錯誤：${code}`, "bad"); return; }
      voiceStop();
    };
    rec.onstart = () => { voice.restarting = false; };
    rec.onend = () => {
      if (!(voice.on && voice.rec === rec)) return;
      voice.restarting = true;
      try { rec.start(); } catch (x) { voiceLog("收聽已暫停：請再按一次麥克風", "warn"); voiceStop(); }
    };
    voice.rec = rec; voice.on = true; voice.restarting = false;
    try { rec.start(); } catch (e) { voiceLog("未能啟動語音識別", "bad"); voice.on = false; }
    renderVoice();
  }
  function voiceStop() { voice.on = false; const r = voice.rec; voice.rec = null; try { r && r.stop(); } catch (e) { /* 已停止 */ } renderVoice(); showBib(); }
  function voiceLog(msg, cls = "ok", cand) { voice.log.unshift({ msg, cls, cand, at: Date.now() }); voice.log = voice.log.slice(0, 20); renderVoice(); }
  function voiceHandle(alts, t) {
    const said = alts[0] || "";
    if (alts.some((a) => /撤銷|取消/.test(a))) { undo(); voiceLog(`「${esc(said)}」→ 撤銷上一下`); return; }
    const valid = new Set(inCat().map((r) => String(r.bib)));
    let best = null;
    for (const a of alts) {
      const groups = XCLive.spokenGroups(a);
      if (!groups.length) continue;
      const segs = groups.map((g) => ({ g, ...XCLive.segmentBibs(g, valid) }));
      const c = { a, segs, ok: segs.every((x) => x.ok) };
      if (c.ok) { best = c; break; }
      if (!best) best = c;
    }
    if (!best) { voiceLog(`「${esc(said)}」→ 聽不到號碼`, "bad"); return; }
    for (const sg of best.segs) {
      if (sg.ok) {
        for (const bib of sg.ok) {
          const r = ROSTER.get(bib), ok = recordPass(r, t, { voice: true });
          voiceLog(`「${esc(best.a)}」→ ${bib} ${esc(personOf(r) || "")} ${lastReason}${sg.guess ? "（拆分屬推斷）" : ""}`, ok ? (sg.guess ? "warn" : "ok") : "bad");
        }
      } else if (sg.cand.length) voiceLog(`「${esc(best.a)}」→ 無法確定號碼，請選擇：`, "warn", sg.cand);
      else { const o = ROSTER.get(sg.g); voiceLog(`「${esc(best.a)}」→ ${sg.g} ${o ? `屬${where(o)}，未記錄` : "名單內沒有此號碼"}`, "bad"); }
    }
  }
  function renderVoice() {
    const b = $("#micBtn"), box = $("#vlog");
    b.classList.toggle("on", voice.on);
    b.setAttribute("aria-pressed", voice.on);
    box.hidden = !voice.on && !voice.log.length;
    box.innerHTML = `<div class="vh"><b>${voice.on ? "收聽中" : "語音已停止"}</b><small>${voice.lang} · 時間以識別完成時計</small></div>` +
      voice.log.slice(0, 4).map((x) => `<div class="vl ${x.cls}">${x.msg}${x.cand ? x.cand.map((c) => `<button data-vc="${c}">${c}</button>`).join("") : ""}</div>`).join("");
    box.querySelectorAll("[data-vc]").forEach((el) => el.onclick = () => { const r = ROSTER.get(el.dataset.vc); if (r) { const ok = recordPass(r, now(), { voice: true }); voiceLog(`已選 ${el.dataset.vc} → ${lastReason}`, ok ? "ok" : "bad"); } });
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
  $("#grp").onchange = (e) => chooseGroup(e.target.value);
  voiceInit();
  $("#lockBtn").onclick = () => { st.lock = !st.lock; save(); renderList(); };
  $("#padBtn").onclick = () => { st.padOff = !st.padOff; save(); renderList(); };
  $("#startBtn").onclick = startHeat;
  $("#doneBtn").onclick = toggleDone;
  $("#adjBtn").onclick = adjustStart;
  $("#loginBtn").onclick = login;
  $("#pw").addEventListener("keydown", (e) => { if (e.key === "Enter") login(); });
  $("#logout").onclick = async () => { if (queue.length && !confirm(`尚有 ${queue.length} 項未上傳，登出後會保留在此裝置，下次登入繼續上傳。確定登出？`)) return; await sb.auth.signOut(); location.reload(); };
  $("#event").onchange = async () => { st.event = $("#event").value; save(); undoLog = []; store.set("xc-live-undo", undoLog); await loadRoster(); await pull(true); renderAll(); };
  window.addEventListener("beforeunload", (e) => { if (queue.length) { e.preventDefault(); e.returnValue = ""; } });

  loadStatic().then(async () => {
    if (PRACTICE) { await practiceSetup(); showApp(); renderAll(); startTimers(); return; }
    const { data } = await sb.auth.getSession();
    if (data.session) await afterLogin();
  }).catch((e) => { console.error(e); $("#loginMsg").textContent = "資料載入失敗，請檢查網絡後重新整理。"; });
})();
