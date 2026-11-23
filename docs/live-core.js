/* 即時成績：分段計時、名次及團體計分核心（公眾頁與工作人員頁共用）
   規則來源：2026/2027 學年學界體育比賽章程 5. 越野跑
   5.6  參加者較多時分組比賽，以時間定名次
   5.7  達標時間到即終止未完成者的比賽
   5.8  團體分＝名次相加（第一名 1 分……）；A、B 組每隊 5 人、C、D、E 組每隊 4 人到達終點才計分；最少分者勝
   5.9  同分：比較同分隊伍首名運動員的名次
   5.12f 只得一隊參加團體賽，該組不設團體獎
   計分以全體完成者的總名次計算（不剔除非計分隊員），與本站第 44 至 47 屆按官方成績重算的團體冠軍全部一致。

   分段計時：終點每記一次同一號碼＝完成一圈；記滿該組圈數（或其中一次標明「完賽」）即完賽。
   - 同一人兩次經過相隔少於 MIN_GAP（該組近年最快一圈的一半）視為重複（例如兩部裝置同時記錄），只保留較早一次；
     工作人員明確確認的紀錄（force）不受此限
   - 完賽後再記錄的一律忽略
   - 只記時間、未填號碼的空位不計入名次；看不到號碼、按學校記錄的視為一名不具名的完賽者
   - 途中名次：已完賽者在前（按衝線次序或時間），其後按完成圈數多者先、同圈數按最近一次經過較早者先
   - 全組完成後，未完成者不設名次（達標時間到即終止比賽）；分組出發時，該分組完成即適用
   - 分組出發（例如男C 分 C1、C2、C3）：各組時間合併定名次（章程 5.6），另計分組內名次 heatPlace；
     未完成全部分組前，團體分只屬暫計 */
(function (root) {
  "use strict";
  const TEAM_N = { A: 5, B: 5, C: 4, D: 4, E: 4 };
  const CUTOFF = { MA: 1680, MB: 1650, MC: 720, MD: 510, ME: 270, FA: 1680, FB: 1260, FC: 870, FD: 540, FE: 270 }; // 章程 5.2 達標時間（秒）
  // 防重複間隔（秒）：第 44 至 47 屆各組最快冠軍時間 ÷ 圈數 ÷ 2（男A 1192 秒／5 圈……）
  const MIN_GAP = { MA: 119, MB: 122, FB: 146, MC: 116, FC: 135, FA: 151, MD: 60, FD: 60, ME: 60, FE: 60 };

  const keyOf = (e) => e.k || (e.bib != null ? `b${e.bib}` : null);
  const isSlot = (e) => !keyOf(e) && e.abbr === "?";
  const lapsOf = (race, cat) => (((race && race.schedule) || []).find((x) => x.cat === cat) || {}).laps || 1;

  /* entries：[{id, k|bib, heat, abbr, pid, name, at_ms, seq, deleted, fin, force}]
     heats：{heatNo: {start_ms, status}}
     回傳 runners（每位運動員一項，已排名次）、ignored（被視為重複或完賽後的紀錄 id → 原因）、slots（未填號碼的空位） */
  function buildRunners(entries, heats, opt) {
    const laps = Math.max(1, (opt && opt.laps) || 1);
    const gap = ((opt && opt.minGap) ?? 0) * 1000;
    const multi = !!(opt && opt.multiHeat), done = !!(opt && opt.done);
    const elapsed = (e) => { const h = heats[e.heat]; return h && h.start_ms != null ? e.at_ms - h.start_ms : null; };
    const groups = new Map(), slots = [], ignored = new Map(), runners = [];
    for (const e of entries) {
      if (e.deleted) continue;
      if (isSlot(e)) { slots.push(e); continue; }
      const k = keyOf(e) || `x${e.id}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(e);
    }
    for (const [key, list] of groups) {
      list.sort((a, b) => a.at_ms - b.at_ms || a.seq - b.seq);
      const anon = !keyOf(list[0]);
      const passes = [];
      let fin = null;
      for (const e of list) {
        if (fin) { ignored.set(e.id, "after"); continue; }
        const prev = passes[passes.length - 1];
        if (prev && !e.force && e.at_ms - prev.at_ms < gap) { ignored.set(e.id, "dup"); continue; }
        passes.push({ ...e, t: elapsed(e) });
        if (anon || e.fin || passes.length >= laps) fin = passes[passes.length - 1];
      }
      const last = passes[passes.length - 1];
      const info = [...passes].reverse().find((p) => p.abbr && p.abbr !== "?") || last;
      runners.push({
        key, anon, heat: last.heat, abbr: info.abbr, pid: info.pid || null, name: info.name || null, bib: last.bib ?? null,
        passes, laps: passes.length, total: laps, fin: !!fin, finEntry: fin, last,
        splits: passes.map((p, i) => (i === 0 ? p.t : p.at_ms - passes[i - 1].at_ms)),
      });
    }
    const ord = (p) => (multi ? (p.t ?? Infinity) : p.seq);
    runners.sort((a, b) => (b.fin - a.fin)
      || (a.fin ? ord(a.finEntry) - ord(b.finEntry) : b.laps - a.laps || ord(a.last) - ord(b.last))
      || a.heat - b.heat || a.last.seq - b.last.seq);
    let place = 0;
    const heatPos = {};
    for (const r of runners) {
      const hd = heats[r.heat] && heats[r.heat].status === "done";
      r.dnf = (done || (multi && hd)) && !r.fin;
      r.place = r.dnf ? null : ++place;
      r.heatPlace = r.dnf ? null : (heatPos[r.heat] = (heatPos[r.heat] || 0) + 1);
      r.t = r.fin ? r.finEntry.t : r.last.t;
    }
    return { runners, ignored, slots };
  }

  /* 預計下次經過時間：上次經過＋上一圈用時（第一圈以起跑至首次經過的時間估算） */
  function eta(r, heats) {
    const p = r.passes, last = p[p.length - 1];
    if (p.length >= 2) return last.at_ms + (last.at_ms - p[p.length - 2].at_ms);
    const h = heats[last.heat];
    return h && h.start_ms != null ? last.at_ms + (last.at_ms - h.start_ms) : last.at_ms;
  }

  /* 舊介面（每人只記一次）：等同一圈賽 */
  function rankEntries(entries, heats, multiHeat) {
    return buildRunners(entries, heats, { laps: 1, multiHeat }).runners.map((r) => ({ ...r.finEntry, ...r, t: r.t }));
  }

  /* entered：{abbr: 報名人數}；ranked：buildRunners 的 runners；done：全組（所有分組）已完成
     pending：分組出發而未完成全部分組（之後的分組可能有更快的隊員，分數未定）
     途中按目前跑位推算：每校取名次最前的 n 人（不論是否已完賽）相加，未齊人者假設餘下隊員緊接目前最後一名之後 */
  function teamStandings(cat, ranked, entered, done, pending) {
    const n = TEAM_N[cat[1]];
    const teams = Object.entries(entered).filter(([, k]) => k >= n).map(([abbr, k]) => ({ abbr, entered: k, places: [], fins: 0 }));
    const byAbbr = new Map(teams.map((x) => [x.abbr, x]));
    const placed = ranked.filter((e) => e.place != null);
    for (const e of placed) { const x = byAbbr.get(e.abbr); if (x) { x.places.push(e.place); if (e.fin !== false) x.fins++; } }
    const K = placed.length;
    for (const x of teams) {
      x.places.sort((a, b) => a - b);
      x.scorers = x.places.slice(0, n);
      x.complete = x.fins >= n && !pending; // 已有 n 人完賽（分組出發則須全部分組完成）：分數已定
      x.missing = Math.max(0, n - x.places.length);
      x.score = x.scorers.reduce((s, p) => s + p, 0);
      let proj = x.score;
      for (let i = 1; i <= x.missing; i++) proj += K + i;
      x.projected = proj;
      x.first = x.places[0] ?? Infinity;
      x.out = done && !x.complete;        // 全組完成仍不足人數：不計團體分
    }
    teams.sort((a, b) => a.out - b.out || a.projected - b.projected || a.first - b.first || b.complete - a.complete || a.abbr.localeCompare(b.abbr));
    let pos = 0;
    for (const x of teams) x.pos = x.out ? null : ++pos;
    return { n, teams, award: teams.length >= 2, finishers: ranked.filter((e) => e.fin !== false && e.place != null).length, onCourse: ranked.filter((e) => e.fin === false && e.place != null).length };
  }

  /* 奪冠形勢：只以已到達終點者的名次計算（其後到達者只會排在後面，名次已定）
     每校：f＝已完賽計分人數，sumF＝其名次和；best＝餘下計分隊員緊接目前最後一名之後到達的最佳總分
     state：locked（已鎖定團體冠軍）、out（已無法奪得團體冠軍）、open（仍有機會）
     need：未齊人的學校要超越目前最佳的已齊人學校，餘下 r 名計分隊員名次總和的上限 max
     分組出發而未完成全部分組（pending）：其後分組的時間可插入前列，名次未定，故只計 need，不判斷鎖定／出局 */
  function titleRace(cat, ranked, entered, pending) {
    const n = TEAM_N[cat[1]];
    const fins = ranked.filter((e) => e.fin !== false && e.place != null);
    const F = fins.length;
    const T = [];
    for (const [abbr, k] of Object.entries(entered)) {
      if (k < n) continue;
      const fp = fins.filter((e) => e.abbr === abbr).map((e) => e.place).sort((a, b) => a - b);
      const dnf = ranked.filter((e) => e.abbr === abbr && e.dnf).length;
      const f = Math.min(fp.length, n), complete = fp.length >= n;
      const sumF = fp.slice(0, n).reduce((s, p) => s + p, 0);
      let best = sumF;
      for (let i = 1; i <= n - f; i++) best += F + i;
      T.push({ abbr, f, r: n - f, sumF, complete, best, first: fp[0] ?? F + 1, cannot: !complete && fp.length + (k - fp.length - dnf) < n });
    }
    const beats = (a, b) => a.s < b.s || (a.s === b.s && a.first < b.first);
    const top = T.filter((x) => x.complete).sort((a, b) => a.best - b.best || a.first - b.first)[0];
    const res = {};
    for (const x of T) {
      let state = "open", need = null;
      if (x.cannot && !pending) state = "out";
      else if (top && x !== top && !pending && !beats({ s: x.best, first: x.first }, { s: top.best, first: top.first })) state = "out";
      if (state === "open" && top && x !== top && !x.complete) {
        const tieWin = x.f > 0 && x.first < top.first; // 同分時首名名次較前者勝
        need = { r: x.r, max: top.best - x.sumF - (tieWin ? 0 : 1), vs: top.abbr, vsScore: top.best };
      }
      if (x === top && !pending && T.every((y) => y === x || (y.cannot) || !beats({ s: y.best, first: y.first }, { s: x.best, first: x.first }))) state = "locked";
      res[x.abbr] = { state, need, complete: x.complete, f: x.f, r: x.r };
    }
    return res;
  }

  /* 演練／示範用：按全程時間合成各圈經過時間（毫秒）。每人配速略有不同（有人先快後慢），最後一圈＝官方成績 */
  function simSplits(seconds, laps, seed) {
    const rnd = (n) => { const x = Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453; return x - Math.floor(x); };
    const style = rnd(0) - 0.5;
    const out = [];
    for (let i = 1; i <= laps; i++) {
      const f = i / laps;
      const g = i === laps ? 1 : f + style * 0.08 * f * (1 - f) + (rnd(i) - 0.5) * 0.012 / laps;
      out.push(Math.round(seconds * 1000 * g));
    }
    return out;
  }

  root.XCLive = { TEAM_N, CUTOFF, MIN_GAP, keyOf, isSlot, lapsOf, buildRunners, eta, rankEntries, teamStandings, titleRace, simSplits };
})(typeof window !== "undefined" ? window : globalThis);
