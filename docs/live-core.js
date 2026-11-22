/* 即時成績：名次及團體計分核心（公眾頁與工作人員頁共用）
   規則來源：2026/2027 學年學界體育比賽章程 5. 越野跑
   5.6  參加者較多時分組比賽，以時間定名次
   5.7  達標時間到即終止未完成者的比賽
   5.8  團體分＝名次相加（第一名 1 分……）；A、B 組每隊 5 人、C、D、E 組每隊 4 人到達終點才計分；最少分者勝
   5.9  同分：比較同分隊伍首名運動員的名次
   5.12f 只得一隊參加團體賽，該組不設團體獎
   計分以全體完成者的總名次計算（不剔除非計分隊員），與本站第 44 至 47 屆按官方成績重算的團體冠軍全部一致。 */
(function (root) {
  "use strict";
  const TEAM_N = { A: 5, B: 5, C: 4, D: 4, E: 4 };
  const CUTOFF = { MA: 1680, MB: 1650, MC: 720, MD: 510, ME: 270, FA: 1680, FB: 1260, FC: 870, FD: 540, FE: 270 }; // 章程 5.2 達標時間（秒）

  /* entries：[{id, heat, abbr, at_ms, seq, deleted}]；heats：{heatNo: {start_ms, status}}；multiHeat：該組是否分組出發 */
  function rankEntries(entries, heats, multiHeat) {
    const live = entries.filter((e) => !e.deleted);
    const t = (e) => { const h = heats[e.heat]; return h && h.start_ms != null ? e.at_ms - h.start_ms : null; };
    const list = live.map((e) => ({ ...e, t: t(e) }));
    if (multiHeat) {
      // 分組出發：以時間定名次；未有起跑時間者排後（按輸入次序）
      list.sort((a, b) => (a.t == null) - (b.t == null) || (a.t ?? 0) - (b.t ?? 0) || a.heat - b.heat || a.seq - b.seq);
    } else {
      list.sort((a, b) => a.seq - b.seq);
    }
    list.forEach((e, i) => { e.place = i + 1; });
    return list;
  }

  /* entered：{abbr: 報名人數}；done：全組（所有分組）已完成 */
  function teamStandings(cat, ranked, entered, done) {
    const n = TEAM_N[cat[1]];
    const teams = Object.entries(entered).filter(([, k]) => k >= n).map(([abbr, k]) => ({ abbr, entered: k, places: [] }));
    const byAbbr = new Map(teams.map((x) => [x.abbr, x]));
    for (const e of ranked) { const x = byAbbr.get(e.abbr); if (x) x.places.push(e.place); }
    const K = ranked.length;
    for (const x of teams) {
      x.places.sort((a, b) => a - b);
      x.scorers = x.places.slice(0, n);
      x.complete = x.places.length >= n;
      x.missing = Math.max(0, n - x.places.length);
      x.score = x.scorers.reduce((s, p) => s + p, 0);
      // 未完成隊伍的「暫計」：假設餘下計分隊員緊接目前最後一名之後衝線（可達到的最佳分數）
      let proj = x.score;
      for (let i = 1; i <= x.missing; i++) proj += K + i;
      x.projected = proj;
      x.first = x.places[0] ?? Infinity;
      x.out = done && !x.complete; // 全組完成仍不足人數：不計團體分
    }
    teams.sort((a, b) => a.out - b.out || a.projected - b.projected || a.first - b.first || b.complete - a.complete || a.abbr.localeCompare(b.abbr));
    let pos = 0;
    for (const x of teams) x.pos = x.out ? null : ++pos;
    return { n, teams, award: teams.length >= 2, finishers: K };
  }

  root.XCLive = { TEAM_N, CUTOFF, rankEntries, teamStandings };
})(typeof window !== "undefined" ? window : globalThis);
