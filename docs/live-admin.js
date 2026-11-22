/* 終點輸入（工作人員用）
   - 登入：Supabase Auth 個人帳戶；資料庫只容許 xc_live_admins 名單內的電郵讀寫
   - 每次輸入即時寫入本機佇列，再上傳；網絡中斷時保留，恢復後自動補傳（以 id 防重複）
   - 時間以按鍵當刻計（已按伺服器時差校正），不受上傳延誤影響
   - 名次規則與公眾頁共用 live-core.js */
(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const store = { get(k, fb) { try { const v = localStorage.getItem(k); return v == null ? fb : JSON.parse(v); } catch (e) { return fb; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 無痕模式 */ } } };
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => { const r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 3 | 8)).toString(16); }));
  const LIVE_CATS = ["MA", "MB", "FB", "MC", "FC", "FA"];
  const catLabel = (c) => `${c[0] === "M" ? "男" : "女"}${c[1]}`;

  let sb = null, RACE = null, SCHOOL = new Map(), NAME = new Map(), ROSTER = new Map();
  let offset = 0, rev = 0, bibBuf = "";
  const entries = new Map(), heats = new Map();
  let queue = store.get("xc-live-queue", []);
  const st = Object.assign({ event: "48", cat: "MA", heat: 1 }, store.get("xc-live-state", {}));
  const save = () => store.set("xc-live-state", st);
  const now = () => Date.now() + offset;

  /* ---------- 載入公開資料（學校名稱、往績姓名、賽程） ---------- */
  async function loadStatic() {
    const [site, race, res] = await Promise.all(["data/site.json", "data/race48.json", "data/results.json"].map((u) => fetch(u, { cache: "no-cache" }).then((r) => r.json())));
    RACE = race;
    for (const [zh, s] of Object.entries(res.schools)) if (s.abbr) SCHOOL.set(s.abbr, zh);
    for (const s of race.schools) SCHOOL.set(s.abbr, s.zh);
    for (const e of res.editions) for (const c of Object.values(e.categories)) for (const r of c.individual) if (!r.hidden) NAME.set(r.pid, r.name_zh || r.name_pt);
    sb = supabase.createClient(site.views.url, site.views.key, { auth: { persistSession: true, autoRefreshToken: true } });
  }
  const cats = () => RACE.schedule.slice().sort((a, b) => a.start.localeCompare(b.start)).map((x) => x.cat).filter((c) => LIVE_CATS.includes(c));
  const heatN = (cat) => (RACE.schedule.find((x) => x.cat === cat) || {}).heats || 1;
  const schoolsIn = (cat) => RACE.schools.filter((s) => s.n && s.n[cat]).sort((a, b) => b.n[cat] - a.n[cat] || a.abbr.localeCompare(b.abbr));

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
    $("#login").hidden = true; $("#app").hidden = false; $("#logout").hidden = false;
    $("#event").value = st.event;
    await syncClock();
    await loadRoster();
    await pull(true);
    renderAll();
    setInterval(pull, 2000);
    setInterval(push, 1000);
    setInterval(tickClock, 100);
    setInterval(syncClock, 60000);
    keepAwake();
  }

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
    const { data, error } = await sb.from("xc_live_roster").select("bib,cat,heat,abbr,pid").eq("event", st.event).limit(5000);
    if (!error) for (const r of data) ROSTER.set(String(r.bib), r);
    setSync();
  }

  /* ---------- 與伺服器同步 ---------- */
  let online = true;
  async function pull(full) {
    if (full) { rev = 0; entries.clear(); heats.clear(); }
    try {
      const [e, h] = await Promise.all([
        sb.from("xc_live_entries").select("id,cat,heat,bib,abbr,pid,at_ms,seq,deleted,rev,created_by").eq("event", st.event).gt("rev", rev).order("rev").limit(2000),
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
    queue.push({ t, row }); store.set("xc-live-queue", queue);
    if (t === "entry") entries.set(row.id, { ...row, _pending: true }); else heats.set(`${row.cat}|${row.heat}`, { ...row, _pending: true });
    renderAll(); push();
  }
  function setSync() {
    const el = $("#sync");
    const n = queue.length;
    el.textContent = !online ? `離線 · 待上傳 ${n}` : n ? `上傳中 ${n}` : `已同步 · 名單 ${ROSTER.size}`;
    el.className = "sync " + (!online ? "bad" : n ? "busy" : "ok");
  }

  /* ---------- 組別／分組 ---------- */
  const heatRow = (cat = st.cat, heat = st.heat) => heats.get(`${cat}|${heat}`) || { event: st.event, cat, heat, start_ms: null, status: "ready" };
  function renderBar() {
    $("#cats").innerHTML = cats().map((c) => { const hs = Array.from({ length: heatN(c) }, (_, i) => heatRow(c, i + 1).status); const s = hs.every((x) => x === "done") ? "done" : hs.some((x) => x === "running") ? "running" : "ready";
      return `<button role="tab" class="${c === st.cat ? "on" : ""}" data-cat="${c}"><i class="dot ${s}"></i>${catLabel(c)}</button>`; }).join("");
    const n = heatN(st.cat);
    $("#heats").innerHTML = n > 1 ? Array.from({ length: n }, (_, i) => `<button class="${st.heat === i + 1 ? "on" : ""}" data-heat="${i + 1}">第 ${i + 1} 組</button>`).join("") : "";
    $("#cats").querySelectorAll("[data-cat]").forEach((b) => b.onclick = () => { st.cat = b.dataset.cat; st.heat = 1; save(); clearBib(); renderAll(); });
    $("#heats").querySelectorAll("[data-heat]").forEach((b) => b.onclick = () => { st.heat = Number(b.dataset.heat); save(); renderAll(); });
  }
  function tickClock() {
    const h = heatRow();
    const el = $("#clock"), cut = $("#cut");
    if (h.status === "running" && h.start_ms != null) {
      const ms = now() - h.start_ms;
      el.textContent = `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}.${Math.floor((ms % 1000) / 100)}`;
      const left = XCLive.CUTOFF[st.cat] * 1000 - ms;
      cut.textContent = left > 0 ? `距達標時間 ${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, "0")}` : "已到達標時間：停止記錄";
      cut.className = left <= 0 ? "over" : left < 60000 ? "warn" : "";
    } else { el.textContent = h.status === "done" ? "已完成" : "0:00.0"; cut.textContent = h.status === "done" ? "如需補錄，按「重新開放」" : "按「開賽計時」開始"; cut.className = ""; }
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
    buzz();
  }
  function toggleDone() {
    const h = heatRow();
    if (h.status === "done") { enqueue("heat", { event: st.event, cat: st.cat, heat: st.heat, start_ms: h.start_ms, status: "running" }); return; }
    const slots = curEntries().filter((e) => !e.deleted && e.abbr === "?").length;
    if (!confirm(`確定${catLabel(st.cat)}${heatN(st.cat) > 1 ? `第 ${st.heat} 組` : ""}已完成？${slots ? `\n尚有 ${slots} 個空位未填號碼。` : ""}`)) return;
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

  /* ---------- 輸入 ---------- */
  const curEntries = () => [...entries.values()].filter((e) => e.cat === st.cat && e.heat === st.heat);
  const nextSeq = () => Math.max(0, ...curEntries().map((e) => e.seq)) + 1;
  function clearBib() { bibBuf = ""; showBib(); }
  function showBib() {
    $("#bib").textContent = bibBuf;
    const who = $("#who");
    if (!bibBuf) { who.textContent = "輸入號碼布"; who.className = "who"; return; }
    const r = ROSTER.get(bibBuf);
    if (!r) { who.textContent = ROSTER.size ? "名單內沒有此號碼" : "未載入號碼布名單"; who.className = "who bad"; return; }
    const nm = r.pid && NAME.get(r.pid);
    who.innerHTML = `${esc(SCHOOL.get(r.abbr) || r.abbr)}${nm ? ` · ${esc(nm)}` : ""}${r.cat !== st.cat ? ` <b class="warn">屬${catLabel(r.cat)}</b>` : ""}`;
    who.className = r.cat !== st.cat ? "who bad" : "who ok";
  }
  function key(k) {
    if (k === "del") bibBuf = bibBuf.slice(0, -1);
    else if (k === "ok") return confirmBib();
    else if (bibBuf.length < 5) bibBuf += k;
    showBib();
  }
  function firstSlot() { return curEntries().filter((e) => !e.deleted && e.abbr === "?" && e.bib == null).sort((a, b) => a.seq - b.seq)[0]; }
  function confirmBib() {
    if (!bibBuf) return;
    const h = heatRow();
    const tapped = now();
    const r = ROSTER.get(bibBuf);
    if (!r && !confirm(`號碼 ${bibBuf} 不在名單內，仍要記錄？（學校顯示為待確認）`)) return;
    if (r && r.cat !== st.cat && !confirm(`號碼 ${bibBuf} 屬${catLabel(r.cat)}，確定記錄在${catLabel(st.cat)}？`)) return;
    const dup = curEntries().find((e) => !e.deleted && String(e.bib) === bibBuf);
    if (dup && !confirm(`號碼 ${bibBuf} 已經記錄過，仍要再記錄一次？`)) return;
    if (h.status === "ready" && !confirm("本組尚未按「開賽計時」，仍要記錄？（將沒有用時）")) return;
    const slot = firstSlot();
    const base = slot || { id: uuid(), event: st.event, cat: st.cat, heat: st.heat, at_ms: tapped, seq: nextSeq(), deleted: false };
    enqueue("entry", strip({ ...base, bib: Number(bibBuf), abbr: r ? r.abbr : "?", pid: r ? r.pid : null }));
    flash(slot ? "已填入空位" : "已記錄");
    clearBib(); buzz();
  }
  function markFinish() {
    enqueue("entry", { id: uuid(), event: st.event, cat: st.cat, heat: st.heat, bib: null, abbr: "?", pid: null, at_ms: now(), seq: nextSeq(), deleted: false });
    flash("已記時間，請補號碼"); buzz();
  }
  function bySchool() {
    const list = schoolsIn(st.cat);
    sheet(`<h2>按學校記錄</h2><p class="muted">看不清號碼時使用；會填入最早的空位，否則以現在時間新增。</p>
      <div class="sch-grid">${list.map((s) => `<button value="${esc(s.abbr)}"><b>${esc(s.abbr)}</b><small>${esc(s.zh)}</small></button>`).join("")}<button value="?"><b>?</b><small>不明</small></button></div>
      <div class="row-btns"><button value="cancel" class="ghost">取消</button></div>`, (v) => {
      if (!v || v === "cancel") return;
      const slot = firstSlot();
      const base = slot || { id: uuid(), event: st.event, cat: st.cat, heat: st.heat, at_ms: now(), seq: nextSeq(), deleted: false, bib: null, pid: null };
      enqueue("entry", strip({ ...base, abbr: v }));
      buzz();
    });
  }
  const strip = (e) => { const { _pending, rev: _r, created_by: _c, place: _p, t: _t, ...rest } = e; return rest; };

  /* ---------- 紀錄清單 ---------- */
  function ranked() {
    const hs = {}; for (let i = 1; i <= heatN(st.cat); i++) hs[i] = heatRow(st.cat, i);
    const own = curEntries();
    const list = XCLive.rankEntries(own, hs, false); // 同一分組內按輸入次序
    return { list, deleted: own.filter((e) => e.deleted).sort((a, b) => a.seq - b.seq) };
  }
  function fmtT(e) { if (e.t == null) return "--"; const s = e.t / 1000; return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`; }
  function renderList() {
    const { list, deleted } = ranked();
    $("#listTitle").textContent = `${catLabel(st.cat)}${heatN(st.cat) > 1 ? ` 第 ${st.heat} 組` : ""} 終點紀錄`;
    $("#count").textContent = `${list.length} 人`;
    const li = (e, del) => {
      const nm = e.pid && NAME.get(e.pid);
      const sch = e.abbr === "?" ? "待確認" : (SCHOOL.get(e.abbr) || e.abbr);
      return `<li class="${del ? "del" : ""} ${e.abbr === "?" ? "slot" : ""} ${e._pending ? "pending" : ""}" data-id="${e.id}">
        <span class="pl">${del ? "×" : e.place}</span><span class="tt">${fmtT(e)}</span>
        <span class="bb">${e.bib ?? "—"}</span><span class="nm">${esc(sch)}${nm ? `<small>${esc(nm)}</small>` : ""}</span></li>`;
    };
    $("#list").innerHTML = [...list].reverse().map((e) => li(e)).join("") + deleted.map((e) => li(e, true)).join("");
    $("#list").querySelectorAll("li").forEach((el) => el.onclick = () => editEntry(el.dataset.id));
  }
  function editEntry(id) {
    const e = entries.get(id); if (!e) return;
    const { list } = ranked();
    const i = list.findIndex((x) => x.id === id);
    sheet(`<h2>修改紀錄${i >= 0 ? `：第 ${i + 1} 名` : ""}</h2>
      <label>號碼布<input id="edBib" type="number" inputmode="numeric" value="${e.bib ?? ""}"></label>
      <div class="row-btns">
        <button value="bib" class="primary">更新號碼</button>
        <button value="school" class="ghost">改按學校</button>
      </div>
      <div class="row-btns">
        <button value="up" class="ghost" ${i <= 0 ? "disabled" : ""}>上移一位</button>
        <button value="down" class="ghost" ${i < 0 || i >= list.length - 1 ? "disabled" : ""}>下移一位</button>
      </div>
      <button value="insert" class="ghost wide">在此之前插入空位</button>
      <div class="row-btns">
        ${e.deleted ? `<button value="restore" class="ghost">復原</button>` : `<button value="delete" class="danger">刪除</button>`}
        <button value="cancel" class="ghost">關閉</button>
      </div>`, (v) => {
      if (v === "bib") {
        const b = $("#edBib").value.trim();
        const r = ROSTER.get(b);
        if (b && !r && !confirm(`號碼 ${b} 不在名單內，仍要使用？`)) return;
        enqueue("entry", strip({ ...e, bib: b ? Number(b) : null, abbr: r ? r.abbr : b ? "?" : e.abbr, pid: r ? r.pid : null }));
      }
      if (v === "school") { // 先清空號碼，再沿用按學校流程填入此空位
        enqueue("entry", strip({ ...e, bib: null, abbr: "?", pid: null }));
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
        enqueue("entry", { id: uuid(), event: st.event, cat: st.cat, heat: st.heat, bib: null, abbr: "?", pid: null, at_ms: at, seq, deleted: false });
      }
      if (v === "delete" && confirm("刪除此紀錄？之後的名次會向前移。")) enqueue("entry", strip({ ...e, deleted: true }));
      if (v === "restore") enqueue("entry", strip({ ...e, deleted: false }));
    });
  }

  /* ---------- 對話框 ---------- */
  function sheet(html, onClose) {
    const d = $("#sheet"); $("#sheetBody").innerHTML = html;
    d.onclose = () => { const v = d.returnValue; d.returnValue = ""; onClose && onClose(v); };
    d.showModal();
  }
  let flashT = null;
  function flash(msg) { const who = $("#who"); who.textContent = msg; who.className = "who ok"; clearTimeout(flashT); flashT = setTimeout(showBib, 900); }
  function buzz() { try { navigator.vibrate && navigator.vibrate(25); } catch (e) { /* 不支援 */ } }
  async function keepAwake() { try { if (navigator.wakeLock) { let lock = await navigator.wakeLock.request("screen"); document.addEventListener("visibilitychange", async () => { if (document.visibilityState === "visible") lock = await navigator.wakeLock.request("screen"); }); } } catch (e) { /* 不支援 */ } }

  function renderAll() { renderBar(); renderClockBtns(); renderList(); tickClock(); setSync(); }

  /* ---------- 事件 ---------- */
  $("#pad").addEventListener("click", (e) => { const b = e.target.closest("[data-k]"); if (b) key(b.dataset.k); });
  document.addEventListener("keydown", (e) => {
    if ($("#app").hidden || $("#sheet").open || e.target.tagName === "INPUT") return;
    if (/^\d$/.test(e.key)) key(e.key); else if (e.key === "Backspace") key("del"); else if (e.key === "Enter") key("ok");
  });
  $("#markBtn").onclick = markFinish;
  $("#schoolBtn").onclick = bySchool;
  $("#startBtn").onclick = startHeat;
  $("#doneBtn").onclick = toggleDone;
  $("#adjBtn").onclick = adjustStart;
  $("#loginBtn").onclick = login;
  $("#pw").addEventListener("keydown", (e) => { if (e.key === "Enter") login(); });
  $("#logout").onclick = async () => { if (queue.length && !confirm(`尚有 ${queue.length} 項未上傳，登出後會保留在此裝置，下次登入繼續上傳。確定登出？`)) return; await sb.auth.signOut(); location.reload(); };
  $("#event").onchange = async () => { st.event = $("#event").value; save(); await loadRoster(); await pull(true); renderAll(); };
  window.addEventListener("beforeunload", (e) => { if (queue.length) { e.preventDefault(); e.returnValue = ""; } });

  loadStatic().then(async () => {
    const { data } = await sb.auth.getSession();
    if (data.session) await afterLogin();
  }).catch((e) => { console.error(e); $("#loginMsg").textContent = "資料載入失敗，請檢查網絡後重新整理。"; });
})();
