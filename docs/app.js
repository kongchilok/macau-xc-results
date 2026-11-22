/* 澳門學界越野跑成績：單頁應用（首頁／排行榜／個人檔案／紀錄與趨勢） */
(() => {
  "use strict";

  const I18N = {
    zh: {
      brand: "澳門學界越野跑", searchPh: "搜尋運動員、葡文拼音或學校", navHome: "首頁", navRank: "歷屆成績", navAthletes: "運動員", navRecords: "紀錄與趨勢",
      disclaimer: "本網站為非官方整理，資料來自教育及青年發展局「學界比賽」網頁公布的成績，如有出入，以官方公布為準。",
      source: "官方資料來源", removal: "申請移除個人資料",
      male: "男子", female: "女子", group: "組", secondary: "中學", primary: "小學",
      edition: (n) => `第${n}屆`, latestChamps: "最新一屆各組冠軍", medalTitle: "學校團體冠軍榜",
      medalNote: (a, b) => `只計算團體冠軍，統計期間為 ${a} 至 ${b}`, fastest: "近十年最快成績", fastestNote: "各屆賽道距離或有不同，成績未按距離調整。",
      streak: "團體冠軍連續衛冕", streakNote: "由最新一屆起向前計算連續奪得團體冠軍的屆數", kings: "個人冠軍次數最多",
      kingsNote: "近十年個人賽奪冠次數", times: "次", years: "連冠", quick: "最新一屆成績", quickAll: "全部成績",
      individual: "個人賽", team: "團體賽", top10: "該屆官方只公布每組前十名。", runners: (n) => `${n} 人完成賽事`,
      teamChamps: "各組團體冠軍", noTeam: "參賽隊伍不足，未設團體獎", medalAll: "團體冠軍總數（近十年）",
      secShort: "中學", priShort: "小學", total: "合計",
      noResult: "沒有符合的運動員或學校", races: "參賽次數", best: "最佳名次", wins: "冠軍次數",
      history: "歷屆成績", rankTrend: "名次變化", schoolLbl: "學校", wipTitle: "紀錄與趨勢", wipText: "本頁尚在開發：待補齊各屆章程所列的比賽距離後，將提供各組歷屆紀錄及冠軍成績趨勢。",
      season: "學年", lowerFaster: "縱軸已倒置：位置愈高代表成績愈快；成績未按距離調整", tableView: "以表格顯示",
      distBanner: (k, d, r) => `${d ? `第 48 屆本組距離：秩序冊為 ${d.toLocaleString()} 米，章程${r ? "為 " + r.toLocaleString() + " 米" : "未有列明"}${r && r !== d ? "（兩者不一致，以秩序冊為準）" : ""}。` : ""}${k ? `已知 ${k} 屆的比賽距離，其餘從缺。` : "過往各屆距離未有資料，"}以下紀錄及趨勢未按距離調整。`,
      distSched: "秩序冊", distRules: "章程", distDiffer: "兩者不一致，以比賽當日秩序冊為準", distSame: "兩者一致",
      recordTitle: (c) => `${c} · 近十年最快成績`, trendTitle: "冠軍及第十名成績走勢", champTime: "冠軍", tenthTime: "第十名",
      top10Title: "近十年最快十名", finTitle: "完成人數", finNote: "第 38 至 43 屆官方只公布每組前十名，故未有完整人數。", teamHist: "歷屆團體冠軍", streakNow: (n) => `現已連續 ${n} 屆奪冠`,
      rangeSub: (a, b) => `${a} 至 ${b}`, asOf: (n) => `截至第${n}屆`, skip: "跳至主要內容", searchLabel: "搜尋運動員或學校", navLabel: "主選單",
      langAria: "Switch to English", loadFail: "資料載入失敗", loadFailText: "請檢查網絡連線後再試。", retry: "重新載入",
      pvTitle: (n) => `第${n}屆賽前預覽`, pvBanner: (n) => `第${n}屆學界越野跑比賽`, pvWhen: (d, t, v) => `${d} ${t} · ${v}`,
      pvDays: (n) => n > 1 ? `距離比賽尚有 ${n} 日` : n === 1 ? "明日舉行" : n === 0 ? "今日舉行" : "比賽已結束，成績有待公布", pvGo: "賽前預覽",
      pvCall: "檢錄", pvStart: "起跑", pvDist: "距離", pvRunners: "參賽人數", pvHeats: (n) => n > 1 ? `分 ${n} 組起跑` : "全組同時起跑",
      pvKnown: (k, n) => `共 ${n} 人參賽，其中 ${k} 人有往績`, pvNew: (n) => `另有 ${n} 人未有公開往績（首次參賽或未能確認身份），不予列出。`,
      pvSame: "上屆同組參賽", pvUp: "今屆升組", pvOlder: "較早屆別往績", pvLast: "上屆", pvBest: "最佳",
      pvDefend: "衛冕者", pvTop3: "上屆前三名", pvUpTag: (c) => `由${c}升組`, pvHeat: (h) => `第 ${h} 組`,
      pvNote: "按往績排列，並非賽果預測；只列出曾於官方成績出現的參賽者。",
      pvNone: "本組參賽者均未有公開往績。", dateFmt: (d) => `${d.getMonth() + 1}月${d.getDate()}日（星期${"日一二三四五六"[d.getDay()]}）`,
      prevSchool: "上屆代表學校：",
      st_active: "在讀・今屆參賽", st_unsure: "未能確認", st_grad: "已畢業", st_gradEst: "推斷已畢業", st_idle: "推斷在讀",
      stEntered: (n) => `已報名第${n}屆`, stAYear: (n) => `A組第${n}年`, stLast: "最後參賽", stOver4: "A 組參賽已逾 4 年，請核對",
      stUnsureWhy: "今屆名單有同名參賽者，未能確認是否同一人",
      stHow: "在讀及畢業狀態按第 48 屆參賽名單推斷：A 組最多參賽 4 年，今屆 A 組名單未見其姓名者視為已畢業；其他組別按年齡組別推算。",
      hiddenName: "（應要求隱藏）", hiddenText: "此運動員的資料已應要求隱藏。",
      pvyTitle: "私隱及資料使用", pvyApply: "填寫申請表", pvyPending: "申請渠道正在設立。如需移除或更正資料，請先聯絡所屬學校的體育老師代為轉達。",
      pvySrcH: "資料來源", pvySrc: "本網站的歷屆成績均整理自教育及青年發展局「學界比賽」網頁公開發布的越野跑成績，屬非官方整理，如有出入，以官方公布為準。第 48 屆預測另參考澳門中華學生聯合總會公開的「全澳學生環山跑比賽」獲獎名單（前十名）。比賽當日天氣取自澳門國際機場氣象站的航空天氣報告。",
      pvyShowH: "顯示的資料", pvyShow: "只顯示官方已公開的資料，包括姓名（中文及葡文拼音）、學校、組別、名次及成績。第 48 屆賽前預覽只列出曾於官方成績或公開獲獎名單出現的參賽者及其今屆學校；運動員頁面的瀏覽次數只用於人氣排名，不會記錄瀏覽者身份。",
      pvyNoH: "不顯示的資料", pvyNo: "不顯示號碼布號碼、出生日期、聯絡方式或任何未經官方公布的個人資料；未有公開往績的參賽者只計算人數，不列姓名。本網站亦已設定不被搜尋引擎收錄。",
      pvyStatusH: "在讀及畢業標示",
      pvyRemoveH: "申請移除或更正", pvyRemove: (d) => `運動員本人、家長或學校老師均可申請隱藏姓名或更正錯誤資料，本網站會於收到申請後 ${d} 日內處理。`,
      pvyStep1: "請提供運動員姓名、學校、參賽年份及組別，以便查找相關紀錄。", pvyStep2: "選擇「隱藏姓名」或「更正資料」，並留下聯絡方式以便回覆（毋須提交身份證明文件）。",
      pvyStep3: "處理完成後，該運動員所有成績的姓名均顯示為「應要求隱藏」，名次及成績保留，其他運動員的排名不受影響。",
      pvyNote: "註：隱藏只適用於本網站，官方網頁公布的成績不受影響。",
      privacyLink: "私隱及移除申請",
      pdPast: "往績", pdPred: "預測", pdHead: (k, n) => `共 ${n} 人參賽，其中 ${k} 人可作推算`, pdTop: "預測首名", pdClose: "實力相若",
      pdNone: "本組未有足夠往績作推算。", pdAecm: (r, tm) => `環山跑第${r}名（${tm}）`, pdNewbie: "首次參加學界賽", pdNoForm: "未有近期成績", pdNoHist: "未有學界往績",
      pdNoteAecm: (n, w, d) => `已納入一星期前「${n}」的近期成績（佔 ${w}%）：${d}。該賽事的距離及路面與學界越野跑不同，只作參考；於該賽事躋身前十名而首次參加學界賽的運動員，亦一併推算。`,
      pdNoteHK: "注意：傳統強校濠江中學大部分組別未有參加該賽事，其運動員只按往績推算，未有近期成績可供參考，實力不容忽視。", pdNoteTitle: "以下為推算預測，並非賽果。",
      pdNote1: (c) => `按各人歷屆「成績與該場冠軍的比例」計算實力指數，並計及同組第二年平均進步約 2.5%、升組首年平均退步約 3.9% 的趨勢；預測差距少於 ${c}% 的運動員標示為「實力相若」，名次互換的機會約為一半。`,
      pdNote2: (r, h) => `以第 46、47 屆回測：預測與實際名次的相關係數為 ${r}，前三名命中 ${h}。`,
      pdNote3: (n) => `另有 ${n} 人因往績不足或欠缺近期成績（首次參賽、往績過舊或轉換組別）而未列入推算，賽果仍可能出現意外。`,
      popTab: "人氣", popLive: "實時", popDemo: "示範模式", popViews: " 次瀏覽", popNext: (n, l) => `尚差 ${n} 次瀏覽升至 Lv.${l}`, popMax: "已達最高等級",
      popDemoNote: "示範模式：目前只計算本裝置的瀏覽次數。正式啟用資料庫後，將累計全站瀏覽次數並實時更新。",
      popRule: "每次進入運動員頁面累計 1 次瀏覽（同一裝置 60 秒內重複進入不另計算），排名每 15 秒自動更新。瀏覽次數愈多，等級愈高，依次為銅級、銀級、金級、白金級及鑽石級。",
      popEmpty: "暫未有瀏覽紀錄。進入任何運動員頁面即開始累計人氣。", popFail: "暫時未能讀取人氣數據，請稍後再試。", popUpdated: (s) => `更新於 ${s}`,
      tier_bronze: "銅級", tier_silver: "銀級", tier_gold: "金級", tier_plat: "白金級", tier_diamond: "鑽石級",
      pvTitleZh: "第四十八屆學界越野跑比賽", pvTitlePt: "48° Campeonato Escolar de Corta-Mato",
      hcTitle: "比賽日", hcRunners: "運動員", hcSchools: "學校", hcCats: "組別", hcChamps: "各組冠軍預測", hcChampsSub: "按往績及近期成績推算，點選可查看該組預測",
      hcPredNote: "推算結果並非賽果，僅供參考。", hcPopular: "人氣運動員", hcHorse: "新晉焦點", hcHorseSub: "一星期前環山跑前三名、未有學界往績的運動員",
      hcSched: "比賽時間表", hcSchedSub: "按起跑時間排列", hcLast: "上屆賽事回顧", hcLastSub: (n) => `第${n}屆學界越野跑比賽頒獎典禮`, hcPhotoNote: "相片：上屆賽事",
      pdAecmShort: (r) => `環山跑第${r}名`, pvRunnersUnit: " 人",
      back: "返回", notFound: "找不到此頁面", placeShort: (n) => `第${n}名`, searchSchool: "學校",
      more: "查看全部", seeRecords: "本組紀錄與趨勢", seeRank: "查看該屆成績", seeSchool: "查看學校資料",
      athTitle: "運動員名錄", athTabPeople: "運動員", athTabSchools: "學校", athAll: "全部", athActive: "今屆參賽", athChamp: "曾獲冠軍", athPodium: "曾入前三名",
      athCount: (n) => `共 ${n} 名運動員`, athMore: (n) => `顯示更多（尚有 ${n} 名）`, athAllSchools: "所有學校", athSortNote: "按冠軍次數、獎牌數目及最佳名次排列。",
      athWins: (n) => `冠軍 ${n} 次`, athMedals: (n) => `獎牌 ${n} 面`, athBest: (n) => `最佳第${n}名`, athNone: "沒有符合篩選條件的運動員。",
      schCount: (n) => `共 ${n} 間學校`, schTitles: "團體冠軍", schAthletes: "參賽運動員", schIndWins: "個人冠軍", schMedals: "個人獎牌",
      schTeamList: "團體冠軍紀錄", schMedalList: "個人獎牌得主（前三名）", schCurrent: (n) => `第${n}屆參賽運動員`, schRoster: "歷屆參賽運動員", schNoTitle: "近十年未有團體冠軍。", schNoMedal: "近十年未有個人獎牌。", schSortNote: "按團體冠軍數目及參賽人數排列。",
      schFormer: "舊校名：", schViewRank: "查看團體賽成績",
      wxTitle: "比賽當日天氣", wxTemp: "氣溫", wxRh: "相對濕度", wxWind: "風速", wxRainY: "有雨", wxRainN: "無雨", wxImpact: "估計影響",
      wxSlow: (a, b) => b === 0 ? "幾乎無影響" : `約慢 ${a}% 至 ${b}%`, wx_good: "有利", wx_mild: "略受影響", wx_hard: "受影響", wx_severe: "明顯受影響",
      wxPlanned: "日期按《學校運作指南》的計劃舉行日期推定", wxPlannedFoot: "＊日期按《學校運作指南》的計劃舉行日期推定，未能以賽後報道核實。", wxDE: "D、E 組延期補賽", wxABC: "D、E 組因天雨延期",
      wxNote: "天氣資料取自澳門國際機場氣象站每半小時發布的航空天氣報告（METAR）。氣象站位於氹仔，與松山相距約 5 公里，數值只供比較各屆比賽條件之用。估計影響按長跑常用的「氣溫＋露點」配速調整經驗表推算，氣溫及濕度愈高，成績一般愈慢。",
      wxRecTitle: "歷屆比賽天氣", wxRecSub: "比較各屆成績時，可參考當日氣溫及濕度", wxDate: "比賽日期", wxShort: (t, h) => `約 ${t}°C · 濕度 ${h}%`,
      wxDayFmt: (s) => { const [y, m, d] = s.split("-").map(Number); return `${y}年${m}月${d}日`; },
    },
    en: {
      brand: "Macau Schools XC", searchPh: "Search name, romanised name or school", navHome: "Home", navRank: "Results", navAthletes: "Athletes", navRecords: "Records",
      disclaimer: "Unofficial site. Results are compiled from the School Sports Competitions pages of the Education and Youth Development Bureau (DSEDJ); official publications prevail.",
      source: "Official source", removal: "Request removal",
      male: "Boys", female: "Girls", group: "", secondary: "Secondary", primary: "Primary",
      edition: (n) => `${n}th edition`, latestChamps: "Latest individual champions", medalTitle: "School team titles",
      medalNote: (a, b) => `Team titles only, ${a} to ${b}`, fastest: "Fastest times, last 10 years", fastestNote: "Course distance may differ between years; times are not distance-adjusted.",
      streak: "Active team streaks", streakNote: "Consecutive team titles up to the latest edition", kings: "Most individual titles",
      kingsNote: "Individual wins in the last 10 years", times: "×", years: "in a row", quick: "Latest results", quickAll: "All results",
      individual: "Individual", team: "Teams", top10: "Only the top 10 per category were published this year.", runners: (n) => `${n} finishers`,
      teamChamps: "Team champions", noTeam: "Not awarded (too few teams)", medalAll: "Team titles (last 10 years)",
      secShort: "Sec", priShort: "Pri", total: "Total",
      noResult: "No matching student or school", races: "Races", best: "Best place", wins: "Wins",
      history: "Results by year", rankTrend: "Placing trend", schoolLbl: "School", wipTitle: "Records & trends", wipText: "Coming soon: category records and winning-time trends will be added once course distances for each year are confirmed.",
      season: "Season", lowerFaster: "Axis inverted: higher is faster; not distance-adjusted", tableView: "Table view",
      distBanner: (k, d, r) => `${d ? `Edition 48 distance for this category: ${d.toLocaleString()} m in the race schedule, ${r ? r.toLocaleString() + " m" : "not listed"} in the rules${r && r !== d ? " (they differ; the race schedule applies)" : ""}. ` : ""}${k ? `Known for ${k} past editions. ` : "Past distances are not available, so "}records and trends are not distance-adjusted.`,
      distSched: "Race schedule", distRules: "Rules", distDiffer: "They differ; the race-day schedule applies", distSame: "Both agree",
      recordTitle: (c) => `${c} · fastest in 10 years`, trendTitle: "Winning and 10th-place times", champTime: "Winner", tenthTime: "10th place",
      top10Title: "Ten fastest, last 10 years", finTitle: "Finishers", finNote: "Only the top 10 per category were published for editions 38 to 43, so totals are unavailable.", teamHist: "Team champions by year", streakNow: (n) => `${n} in a row`,
      rangeSub: (a, b) => `${a} to ${b}`, asOf: (n) => `Up to edition ${n}`, skip: "Skip to main content", searchLabel: "Search students or schools", navLabel: "Main menu",
      langAria: "切換至中文", loadFail: "Data failed to load", loadFailText: "Check your connection and try again.", retry: "Reload",
      pvTitle: (n) => `Edition ${n} preview`, pvBanner: (n) => `Edition ${n} Schools Cross-Country`, pvWhen: (d, t, v) => `${d} ${t} · ${v}`,
      pvDays: (n) => n > 1 ? `${n} days to go` : n === 1 ? "Tomorrow" : n === 0 ? "Race day" : "Race finished, results pending", pvGo: "Preview",
      pvCall: "Call", pvStart: "Start", pvDist: "Distance", pvRunners: "Runners", pvHeats: (n) => n > 1 ? `${n} heats` : "Single start",
      pvKnown: (k, n) => `${n} runners, ${k} with past results`, pvNew: (n) => `${n} more have no published results yet (first race or name not confirmed) and are not listed.`,
      pvSame: "Same category last year", pvUp: "Moving up", pvOlder: "Earlier results", pvLast: "Last year", pvBest: "Best",
      pvDefend: "Defending", pvTop3: "Top 3 last year", pvUpTag: (c) => `Up from ${c}`, pvHeat: (h) => `Heat ${h}`,
      pvNote: "Ordered by past results, not a prediction. Only runners who appear in published results are listed.",
      pvNone: "No runner in this category has published results yet.", dateFmt: (d) => d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }),
      prevSchool: "Previously: ",
      st_active: "Active, racing this year", st_unsure: "Unconfirmed", st_grad: "Graduated", st_gradEst: "Graduated (est.)", st_idle: "Still in school (est.)",
      stEntered: (n) => `Entered edition ${n}`, stAYear: (n) => `A-group year ${n}`, stLast: "Last race", stOver4: "More than 4 years in A, please check",
      stUnsureWhy: "A runner with the same name is entered this year; not confirmed as the same person",
      stHow: "Status is inferred from the edition 48 entry list: A group allows up to 4 years, and anyone not on this year's A list is treated as graduated; other groups are estimated from age bands.",
      hiddenName: "(Hidden on request)", hiddenText: "This student's details have been hidden on request.",
      pvyTitle: "Privacy and data use", pvyApply: "Open the request form", pvyPending: "The request channel is being set up. Meanwhile, please ask the school's PE teacher to pass on removal or correction requests.",
      pvySrcH: "Source", pvySrc: "Past results are compiled from cross-country results published on the DSEDJ School Sports Competitions pages. This is an unofficial site; official publications prevail. The edition 48 projection also uses the publicly posted top-10 award lists of the Macau Students Round-the-Hill Race (AECM).",
      pvyShowH: "What is shown", pvyShow: "Details already published in official results: name (Chinese and romanised), school, category, placing and time. The edition 48 preview lists only entrants who appear in published results, with their current school.",
      pvyNoH: "What is not shown", pvyNo: "No bib numbers, birth dates, contact details or other unpublished personal data. Entrants without published results are only counted, not named. The site is also set not to be indexed by search engines.",
      pvyStatusH: "Active / graduated labels",
      pvyRemoveH: "Request removal or correction", pvyRemove: (d) => `Students, parents or teachers can ask to hide a name or correct an error. Requests are handled within ${d} days.`,
      pvyStep1: "Give the student's name, school, year and category so the record can be found.", pvyStep2: "Choose \"hide name\" or \"correct details\" and leave a contact for the reply (no ID documents needed).",
      pvyStep3: "Once done, the name shows as \"Hidden on request\" in every result; placings and times stay, so other students' rankings are unchanged.",
      pvyNote: "Note: hiding only affects this site; the official results pages are not changed.",
      privacyLink: "Privacy & removal",
      pdPast: "Past results", pdPred: "Prediction", pdHead: (k, n) => `Predicted order (${k} of ${n} runners)`, pdTop: "Predicted lead", pdClose: "Too close to call",
      pdNone: "Not enough past results in this category to predict.", pdAecm: (r, tm) => `Round-the-hill #${r} ${tm}`, pdNewbie: "New to schools XC", pdNoForm: "No recent form", pdNoHist: "No schools XC history",
      pdNoteAecm: (n, w, d) => `Includes last week's "${n}" as recent form (${w}% weight): ${d}. The distance and surface differ from the schools cross-country, so treat it as a guide; top-10 finishers new to schools cross-country are projected too.`,
      pdNoteHK: "Note: Hou Kong, a traditionally strong school, skipped most categories of that race, so its runners are projected from history only. Do not underestimate them.", pdNoteTitle: "A projection, not a result. ",
      pdNote1: (c) => `Based on each runner's time relative to the winner in past races, adjusted for the typical change in a second year in the same category (about 2.5% faster) or a first year after moving up (about 3.9% slower). Runners within ${c}% of each other are marked too close to call; their order flips about half the time.`,
      pdNote2: (r, h) => `Back-tested on editions 46 and 47: rank correlation ${r}, top-3 hits ${h}.`,
      pdNote3: (n) => `Watch for dark horses: ${n} runners have too little history (newcomers, old results or category changes) and are not projected. Anyone can spring a surprise.`,
      popTab: "Popular", popLive: "Live", popDemo: "Demo mode", popViews: " views", popNext: (n, l) => `${n} more views to Lv.${l}`, popMax: "Max level reached",
      popDemoNote: "Demo mode: only views on this device are counted. Once the database is enabled, everyone's views add up and update live.",
      popRule: "Each visit to a runner's page adds 1 view (repeat visits from the same device within 60 seconds are not counted). Updates every 15 seconds. More views, higher level: bronze, silver, gold, platinum, diamond.",
      popEmpty: "No views yet. Open any runner's page to start.", popFail: "Popularity data is unavailable right now.", popUpdated: (s) => `Updated ${s}`,
      tier_bronze: "Bronze", tier_silver: "Silver", tier_gold: "Gold", tier_plat: "Platinum", tier_diamond: "Diamond",
      pvTitleZh: "第四十八屆學界越野跑比賽", pvTitlePt: "48° Campeonato Escolar de Corta-Mato",
      hcTitle: "Race day", hcRunners: "Runners", hcSchools: "Schools", hcCats: "Categories", hcChamps: "Predicted winners", hcChampsSub: "From past results and recent form; tap for the full projection",
      hcPredNote: "A projection, not a result. Watch for dark horses.", hcPopular: "Most viewed", hcHorse: "Ones to watch", hcHorseSub: "Top 3 in last week's round-the-hill race, new to schools XC",
      hcSched: "Race schedule", hcSchedSub: "By start time", hcLast: "Last year", hcLastSub: (n) => `Edition ${n} prize-giving`, hcPhotoNote: "Photo: last year's race",
      pdAecmShort: (r) => `RTH #${r}`, pvRunnersUnit: " runners",
      back: "Back", notFound: "Page not found", placeShort: (n) => `#${n}`, searchSchool: "School",
      more: "See all", seeRecords: "Records for this category", seeRank: "See results", seeSchool: "School profile",
      athTitle: "Athletes", athTabPeople: "Athletes", athTabSchools: "Schools", athAll: "All", athActive: "Racing this year", athChamp: "Champions", athPodium: "Podium finishers",
      athCount: (n) => `${n} athletes`, athMore: (n) => `Show more (${n} left)`, athAllSchools: "All schools", athSortNote: "Sorted by wins, medals and best placing.",
      athWins: (n) => `${n} win${n > 1 ? "s" : ""}`, athMedals: (n) => `${n} medal${n > 1 ? "s" : ""}`, athBest: (n) => `Best #${n}`, athNone: "No athletes match these filters.",
      schCount: (n) => `${n} schools`, schTitles: "Team titles", schAthletes: "Athletes", schIndWins: "Individual wins", schMedals: "Medals",
      schTeamList: "Team titles", schMedalList: "Individual medallists (top 3)", schCurrent: (n) => `Entered for edition ${n}`, schRoster: "All athletes", schNoTitle: "No team titles in the last 10 years.", schNoMedal: "No individual medals in the last 10 years.", schSortNote: "Sorted by team titles and number of athletes.",
      schFormer: "Former name: ", schViewRank: "See team results",
      wxTitle: "Race-day weather", wxTemp: "Temperature", wxRh: "Humidity", wxWind: "Wind", wxRainY: "Rain", wxRainN: "Dry", wxImpact: "Estimated effect",
      wxSlow: (a, b) => b === 0 ? "Negligible" : `About ${a}% to ${b}% slower`, wx_good: "Favourable", wx_mild: "Slightly affected", wx_hard: "Affected", wx_severe: "Strongly affected",
      wxPlanned: "Date taken from the planned schedule in the School Operations Guide", wxPlannedFoot: "* Planned date from the School Operations Guide, not confirmed by a post-race report. ", wxDE: "Rescheduled D and E races", wxABC: "D and E races postponed for rain",
      wxNote: "Weather comes from the half-hourly aviation reports (METAR) of the Macau International Airport station in Taipa, about 5 km from Guia Hill, and is meant only for comparing conditions between years. The estimated effect uses the common temperature-plus-dew-point pace adjustment table for distance running: hotter, more humid days are slower.",
      wxRecTitle: "Race-day weather by year", wxRecSub: "Useful when comparing times between years", wxDate: "Race date", wxShort: (t, h) => `About ${t}°C · ${h}% humidity`,
      wxDayFmt: (s) => new Date(s + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
    },
  };

  let lang = "zh";
  try { lang = localStorage.getItem("xc-lang") || "zh"; } catch (e) { /* 無痕模式 */ }
  const t = (k, ...a) => { const v = I18N[lang][k]; return typeof v === "function" ? v(...a) : v; };

  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const view = $("#view");
  /* Phosphor Icons (MIT) chart-bar / trend-up bold；運動員圖示為自繪 */
  const NAVICON = {
    rank: '<svg viewBox="0 0 256 256" aria-hidden="true" fill="currentColor"><path d="M224,196h-4V40a12,12,0,0,0-12-12H152a12,12,0,0,0-12,12V76H96A12,12,0,0,0,84,88v36H48a12,12,0,0,0-12,12v60H32a12,12,0,0,0,0,24H224a12,12,0,0,0,0-24ZM164,52h32V196H164Zm-56,48h32v96H108ZM60,148H84v48H60Z"/></svg>',
    records: '<svg viewBox="0 0 256 256" aria-hidden="true" fill="currentColor"><path d="M244,56v64a12,12,0,0,1-24,0V85l-75.51,75.52a12,12,0,0,1-17,0L96,129,32.49,192.490a12,12,0,0,1-17-17l72-72a12,12,0,0,1,17,0L136,135l67-67H168a12,12,0,0,1,0-24h64A12,12,0,0,1,244,56Z"/></svg>',
    athletes: '<svg viewBox="0 0 256 256" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"><circle cx="100" cy="84" r="38"/><path d="M30 208c8-38 37-62 70-62s62 24 70 62"/><path d="M162 50a38 38 0 0 1 0 68"/><path d="M190 150c20 12 32 32 36 58"/></svg>',
  };

  let DB = null;
  const CATS = ["MA", "MB", "MC", "MD", "ME", "FA", "FB", "FC", "FD", "FE"];
  const catLabel = (c) => lang === "zh" ? `${c[0] === "M" ? "男" : "女"}${c[1]}` : `${c[0] === "M" ? "B" : "G"}${c[1]}`;
  const catLong = (c) => lang === "zh" ? `${t(c[0] === "M" ? "male" : "female")}${c[1]}組` : `${t(c[0] === "M" ? "male" : "female")} ${c[1]}`;
  const levelOf = (c) => "ABC".includes(c[1]) ? "secondary" : "primary";
  const yearShort = (y) => y.slice(2, 4) + "/" + y.slice(5, 7);

  function school(zh) {
    if (lang === "zh" || !DB) return zh;
    const s = DB.schools[zh];
    return (s && (s.pt || s.abbr)) || zh;
  }
  /* 校徽：有真校徽圖片（data/crests.json）就用圖片，否則以學校代碼＋專屬色生成盾形徽章 */
  function hueOf(a) { let h = 7; for (const ch of a) h = (h * 31 + ch.charCodeAt(0)) % 360; return h; }
  function crest(zh, size = "sm") {
    const s = (DB && DB.schools[zh]) || {};
    const a = s.abbr || (zh || "?").slice(0, 2);
    const img = DB && DB.crests && DB.crests[a];
    const title = esc(school(zh));
    if (img) return `<span class="crest ${size} img" title="${title}" aria-hidden="true"><img src="${esc(img)}" alt="" decoding="async"></span>`;
    const k = a.length <= 2 ? .42 : a.length === 3 ? .34 : a.length === 4 ? .27 : .22;
    return `<span class="crest ${size}" style="--h:${hueOf(a)};--k:${k}" title="${title}" aria-hidden="true"><i>${esc(a)}</i></span>`;
  }
  function schoolLine(zh, size = "xs") { return `<span class="sl">${crest(zh, size)}<span>${esc(school(zh))}</span></span>`; }
  const abbrOf = (zh) => ((DB && DB.schools[zh]) || {}).abbr || zh;
  const schoolHref = (zh) => `#/s/${encodeURIComponent(abbrOf(zh))}`;
  /* 可點擊的校名：連去學校資料頁（不可放在另一個連結之內） */
  function schoolLink(zh, size = "xs") { return `<a class="sl sl-link" href="${schoolHref(zh)}">${crest(zh, size)}<span>${esc(school(zh))}</span></a>`; }
  const to = (a, b) => a === b ? `${a}` : `${a}${lang === "zh" ? " 至 " : " to "}${b}`;

  /* ---------- 比賽當日天氣（docs/data/weather.json） ---------- */
  function wxFor(edNo, cat) {
    const list = ((DB && DB.weather && DB.weather.races) || []).filter((w) => w.edition === edNo);
    if (list.length < 2) return list[0] || null;
    return list.find((w) => w.cats && cat && w.cats.includes(cat[1])) || list[0];
  }
  function wxSlow(w) { return t("wxSlow", w.slow_pct[0], w.slow_pct[1]); }
  function wxNotes(w) {
    const n = [];
    if (w.cats === "ABC") n.push(t("wxABC"));
    if (w.cats === "DE") n.push(t("wxDE"));
    if (w.basis === "planned") n.push(t("wxPlanned"));
    return n;
  }
  /* 排行榜用：一張天氣資訊卡 */
  function wxCard(w, cat) {
    if (!w) return "";
    const notes = wxNotes(w);
    const tr = w.temp_min === w.temp_max ? `${w.temp_min}` : `${w.temp_min}-${w.temp_max}`;
    return `<details class="wx">
      <summary><span class="wx-sum"><b>${t("wxTitle")}</b><span>${tr}°C · ${lang === "zh" ? "濕度" : "RH"} ${w.rh_avg}%${w.rain_reports > 0 ? " · " + t("wxRainY") : ""}</span></span><span class="wx-badge lv-${w.level}">${t("wx_" + w.level)}</span></summary>
      <div class="wx-head"><span>${esc(t("wxDayFmt", w.date))}</span></div>
      <div class="wx-grid">
        <div><span>${t("wxTemp")}</span><b>${tr}<small>°C</small></b></div>
        <div><span>${t("wxRh")}</span><b>${w.rh_avg}<small>%</small></b></div>
        <div><span>${t("wxWind")}</span><b>${w.wind_avg ?? "-"}<small> km/h</small></b></div>
        <div><span>${lang === "zh" ? "天氣" : "Rain"}</span><b>${w.rain_reports > 0 ? t("wxRainY") : t("wxRainN")}</b></div>
      </div>
      <div class="wx-impact">${t("wxImpact")}：${esc(wxSlow(w))}</div>
      ${notes.length ? `<p class="wx-note">${esc(notes.join("；"))}</p>` : ""}
      <a class="wx-link" href="#/records?c=${cat}&go=wx">${t("wxRecTitle")} ›</a>
    </details>`;
  }

  function personName(r, withSub = true) {
    if (r.hidden) return `<span class="hidden-name">${t("hiddenName")}</span>`;
    const main = lang === "zh" ? (r.name_zh || r.name_pt) : (r.name_pt || r.name_zh);
    const sub = lang === "zh" ? (r.name_zh ? r.name_pt : "") : (r.name_pt ? r.name_zh : "");
    return withSub && sub ? `${esc(main)}<small>${esc(sub)}</small>` : esc(main);
  }
  function fmt(sec) {
    if (sec == null) return "-";
    const s = Math.round(sec);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }

  /* ---------- 衍生資料 ---------- */
  let PEOPLE = new Map(), MEDALS = [], LATEST = null;
  function derive() {
    DB.editions.sort((a, b) => b.edition - a.edition);
    LATEST = DB.editions[0];
    for (const ed of DB.editions) {
      for (const c of CATS) {
        for (const r of ed.categories[c].individual) {
          let p = PEOPLE.get(r.pid);
          if (!p) { p = { pid: r.pid, name_zh: r.name_zh, name_pt: r.name_pt, hidden: !!r.hidden, recs: [], schools: new Set(), gender: c[0] }; PEOPLE.set(r.pid, p); }
          p.recs.push({ ...r, year: ed.year, edition: ed.edition, cat: c, scope: ed.scope });
          p.schools.add(r.school_zh);
          if (!p.name_zh && r.name_zh) p.name_zh = r.name_zh;
        }
      }
    }
    for (const p of PEOPLE.values()) {
      p.recs.sort((a, b) => a.edition - b.edition);
      p.key = [p.name_zh, (p.name_pt || "").toLowerCase().replace(/[^a-z]/g, ""), ...[...p.schools]].join(" ");
    }
    // 同一間學校的新舊校名（同代碼）合併計算，顯示最新校名
    const abbrOf = (zh) => (DB.schools[zh] || {}).abbr || zh;
    const latestName = new Map();
    for (const ed of [...DB.editions].sort((a, b) => a.edition - b.edition)) for (const c of CATS) {
      for (const r of ed.categories[c].individual) latestName.set(abbrOf(r.school_zh), r.school_zh);
      const tc = ed.categories[c].team_champion; if (tc) latestName.set(abbrOf(tc.school_zh), tc.school_zh);
    }
    for (const s of (DB.race && DB.race.schools) || []) latestName.set(s.abbr, s.zh);
    const m = new Map();
    for (const ed of DB.editions) for (const c of CATS) {
      const tc = ed.categories[c].team_champion;
      if (!tc) continue;
      const k = abbrOf(tc.school_zh);
      const row = m.get(k) || { school: latestName.get(k) || tc.school_zh, secondary: 0, primary: 0, total: 0 };
      row[levelOf(c)]++; row.total++; m.set(k, row);
    }
    MEDALS = [...m.values()].sort((a, b) => b.total - a.total || b.secondary - a.secondary || a.school.localeCompare(b.school));
  }


  /* ---------- 在讀／畢業推斷 ----------
     依據第 48 屆（今屆）參賽名單：
     1. 在今屆名單 → 在讀・今屆參賽（A 組顯示第幾年；超過 4 年標示）
     2. 今屆名單有同名者但未能確定 → 未確定
     3. 最後一場在 A 組而今屆 A 組名單沒有其名字，或已跑滿 4 年 A 組 → 已畢業
     4. 最後一場在 B 至 E 組：組別約每兩年升一級、A 組最多 4 年，
        若相隔年數已超過讀完餘下組別所需年期 → 已畢業（推斷），否則 → 在讀（推斷）・今屆未報名 */
  const REMAIN = { A: 3, B: 5, C: 7, D: 9, E: 11 }; // 最後出賽後最多還可留在學界的年數
  function deriveStatus() {
    const pv = DB.preview, race = DB.race;
    if (!pv || !race) return;
    const entered = new Map();
    for (const [cat, v] of Object.entries(pv.categories)) for (const s of v.starters) entered.set(s.pid, { cat, school: s.school_zh });
    const unsure = new Set(pv.ambiguous_pids || []);
    for (const p of PEOPLE.values()) {
      const last = p.recs.at(-1);
      const aYears = p.recs.filter((r) => r.cat[1] === "A").length;
      const gap = race.edition - last.edition;
      if (entered.has(p.pid)) {
        const e = entered.get(p.pid);
        p.status = { code: "active", cat: e.cat, school: e.school, aYear: e.cat[1] === "A" ? aYears + 1 : null };
      } else if (unsure.has(p.pid)) {
        p.status = { code: "unsure" };
      } else if (last.cat[1] === "A" || aYears >= 4) {
        p.status = { code: "grad", last, aYears };
      } else if (gap > REMAIN[last.cat[1]]) {
        p.status = { code: "gradEst", last };
      } else {
        p.status = { code: "idle", last };
      }
    }
  }
  function statusChip(p, long = false) {
    const st = p.status; if (!st) return "";
    const label = t("st_" + st.code);
    let detail = "";
    if (long) {
      if (st.code === "active") detail = `${t("stEntered", DB.race.edition)} ${catLong(st.cat)}${st.aYear ? ` · ${t("stAYear", st.aYear)}` : ""}`;
      else if (st.code === "grad" || st.code === "gradEst" || st.code === "idle") detail = `${t("stLast")} ${yearShort(st.last.year)} ${catLong(st.last.cat)}`;
      else if (st.code === "unsure") detail = t("stUnsureWhy");
    }
    const warn = st.code === "active" && st.aYear > 4 ? `<span class="st-warn">${t("stOver4")}</span>` : "";
    return `<span class="st st-${st.code}">${esc(label)}</span>${detail ? `<span class="st-detail">${esc(detail)}</span>` : ""}${warn}`;
  }

  /* ---------- 搜尋 ---------- */
  const q = $("#q"), results = $("#results");
  function search(term) {
    term = term.trim().toLowerCase();
    if (!term) { results.hidden = true; return; }
    const termPt = term.replace(/[^a-z]/g, "");
    const hits = [];
    const schoolHits = Object.entries(DB.schools).filter(([zh, s]) => zh.includes(term) || (s.pt || "").toLowerCase().includes(term) || (s.abbr || "").toLowerCase() === term).slice(0, 3);
    for (const p of PEOPLE.values()) {
      if (p.hidden) continue;
      if (p.key.toLowerCase().includes(term) || (termPt.length >= 3 && p.key.includes(termPt))) hits.push(p);
      if (hits.length > 60) break;
    }
    hits.sort((a, b) => b.recs.at(-1).edition - a.recs.at(-1).edition || b.recs.length - a.recs.length);
    let html = schoolHits.map(([zh]) => `<a class="result" role="option" href="${schoolHref(zh)}">${crest(zh, "md")}<div><div>${esc(school(zh))}</div><div class="sub">${t("searchSchool")}</div></div></a>`).join("");
    html += hits.slice(0, 20).map((p) => {
      const last = p.recs.at(-1);
      return `<a class="result" role="option" href="#/p/${p.pid}">${crest(last.school_zh, "md")}<div><div>${personName(p)}</div><div class="sub">${esc(school(last.school_zh))}</div></div><span class="tag">${statusChip(p)}<br>${catLabel(last.cat)} · ${yearShort(last.year)}</span></a>`;
    }).join("");
    results.innerHTML = html || `<div class="empty">${t("noResult")}</div>`;
    results.hidden = false;
  }
  q.addEventListener("input", () => search(q.value));
  q.addEventListener("focus", () => q.value && search(q.value));
  document.addEventListener("click", (e) => { if (!e.target.closest(".search")) results.hidden = true; });
  results.addEventListener("click", (e) => { if (e.target.closest("a")) { results.hidden = true; q.value = ""; q.blur(); } });

  /* 首頁功能入口：讓使用者一眼看到可以查甚麼 */
  function entryTiles() {
    const zh = lang === "zh";
    const tiles = [
      { href: "#/rank", nav: "rank", t: zh ? "歷屆成績" : "Results by year", d: zh ? "第 38 至 47 屆各組個人及團體名次" : "Individual and team placings, editions 38 to 47" },
      { href: "#/athletes", nav: "athletes", t: zh ? "運動員名錄" : "Athlete directory", d: zh ? "按性別、組別、學校篩選，查看個人歷屆成績" : "Filter by gender, category or school" },
      { href: "#/athletes?tab=schools", nav: "athletes", t: zh ? "學校資料" : "Schools", d: zh ? "各校團體冠軍、獎牌得主及參賽運動員" : "Team titles, medallists and athletes" },
      { href: "#/records", nav: "records", t: zh ? "紀錄與趨勢" : "Records & trends", d: zh ? "最快成績、成績走勢及歷屆比賽天氣" : "Fastest times, trends and race-day weather" },
    ];
    return `<div class="section-title"><h2>${zh ? "功能導覽" : "Explore"}</h2></div>
      <div class="entry">${tiles.map((x) => `<a href="${x.href}"><span class="dot">${NAVICON[x.nav]}</span><b>${x.t}</b><small>${x.d}</small></a>`).join("")}</div>`;
  }

  /* ---------- 首頁 ---------- */
  function renderHome() {
    const ed = LATEST;
    const champs = CATS.map((c) => ({ c, r: ed.categories[c].individual[0] })).filter((x) => x.r);
    const champRows = champs.map(({ c, r }) => `<a class="mini-row ${c[0] === "M" ? "m" : "f"}" href="#/p/${r.pid}"><span class="cat">${catLabel(c)}</span><span class="who">${crest(r.school_zh, "xs")}${esc(lang === "zh" ? (r.name_zh || r.name_pt) : r.name_pt)}<small>${esc(school(r.school_zh))}</small></span><span class="t">${fmt(r.seconds)}</span></a>`).join("");

    const years = DB.editions.map((e) => e.year);
    const maxM = MEDALS[0]?.total || 1;
    const medalRows = MEDALS.slice(0, 6).map((m, i) => `<a class="bar" href="${schoolHref(m.school)}"><span class="pos">${i + 1}</span><div class="track"><div class="fill" style="width:${(m.total / maxM) * 100}%"></div><div class="name">${crest(m.school, "xs")}${esc(school(m.school))}</div></div><span class="n">${m.total}</span></a>`).join("");

    const fastest = CATS.map((c) => {
      let best = null;
      for (const e of DB.editions) { const r = e.categories[c].individual[0]; if (r && r.seconds && (!best || r.seconds < best.r.seconds)) best = { r, y: e.year }; }
      return { c, ...best };
    });
    const fastRows = fastest.map(({ c, r, y }) => r ? `<a class="mini-row ${c[0] === "M" ? "m" : "f"}" href="#/p/${r.pid}"><span class="cat">${catLabel(c)}</span><span class="who">${esc(lang === "zh" ? (r.name_zh || r.name_pt) : r.name_pt)}<small>${yearShort(y)}</small></span><span class="t">${fmt(r.seconds)}</span></a>` : "").join("");

    const streaks = CATS.map((c) => {
      const first = DB.editions[0].categories[c].team_champion;
      if (!first) return null;
      let n = 0;
      for (const e of DB.editions) { const tc = e.categories[c].team_champion; if (tc && tc.school_zh === first.school_zh) n++; else break; }
      return n >= 2 ? { c, school: first.school_zh, n } : null;
    }).filter(Boolean).sort((a, b) => b.n - a.n);
    const streakRows = streaks.slice(0, 8).map((s) => `<a class="mini-row ${s.c[0] === "M" ? "m" : "f"}" href="${schoolHref(s.school)}"><span class="cat">${catLabel(s.c)}</span><span class="who">${crest(s.school, "xs")}${esc(school(s.school))}</span><span class="t">${s.n}<small>${t("years")}</small></span></a>`).join("");

    const kings = [...PEOPLE.values()].map((p) => ({ p, w: p.recs.filter((r) => r.rank === 1).length })).filter((x) => x.w > 0).sort((a, b) => b.w - a.w || b.p.recs.length - a.p.recs.length).slice(0, 7);
    const kingRows = kings.map(({ p, w }) => `<a class="mini-row ${p.gender === "M" ? "m" : "f"}" href="#/p/${p.pid}"><span class="cat">${catLabel(p.recs.at(-1).cat)}</span><span class="who">${crest(p.recs.at(-1).school_zh, "xs")}${esc(lang === "zh" ? (p.name_zh || p.name_pt) : p.name_pt)}<small>${esc(school(p.recs.at(-1).school_zh))}</small></span><span class="t">${w}<small>${t("times")}</small></span></a>`).join("");

    const cards = [
      { cls: "c-green", sub: `${t("edition", ed.edition)} · ${ed.year}`, title: t("latestChamps"), body: `<div class="mini">${champRows}</div>`, more: `#/rank?e=${ed.edition}&c=MA` },
      { cls: "c-gold", sub: t("medalNote", years.at(-1), years[0]), title: t("medalTitle"), body: `<div class="bars">${medalRows}</div>`, more: "#/athletes?tab=schools" },
      { cls: "c-steel", sub: t("rangeSub", years.at(-1), years[0]), title: t("fastest"), body: `<div class="mini">${fastRows}</div>`, note: t("fastestNote"), more: "#/records" },
      { cls: "c-green", sub: t("asOf", ed.edition), title: t("streak"), body: `<div class="mini">${streakRows}</div>`, note: t("streakNote"), more: `#/rank?t=team&e=${ed.edition}` },
      { cls: "c-gold", sub: t("kingsNote"), title: t("kings"), body: `<div class="mini">${kingRows}</div>`, more: "#/athletes?k=champ" },
    ];

    const quick = CATS.map((c) => `<a class="${c[0] === "M" ? "m" : "f"}" href="#/rank?e=${ed.edition}&c=${c}">${c[1]}<small>${t(c[0] === "M" ? "male" : "female")}</small></a>`).join("");

    view.innerHTML = `
      ${raceBanner()}
      <div class="carousel" id="carousel">${cards.map((k) => `<article class="card ${k.cls}"><h3>${esc(k.title)}</h3>${k.more ? `<a class="card-more" href="${k.more}">${t("more")} ›</a>` : ""}<div class="sub">${esc(k.sub)}</div>${k.body}${k.note ? `<div class="note">${esc(k.note)}</div>` : ""}</article>`).join("")}</div>
      <div class="dots" id="dots">${cards.map((_, i) => `<i class="${i ? "" : "on"}"></i>`).join("")}</div>
      <div class="section-title"><h2>${t("quick")} · ${t("edition", ed.edition)}</h2><a href="#/rank">${t("quickAll")} ›</a></div>
      <div class="quick">${quick}</div>
      ${entryTiles()}`;

    const car = $("#carousel"), dots = [...$("#dots").children];
    car.addEventListener("scroll", () => {
      const i = Math.round(car.scrollLeft / (car.firstElementChild.offsetWidth + 12));
      dots.forEach((d, j) => d.classList.toggle("on", j === i));
    }, { passive: true });
  }


  /* ---------- 熱門人氣：瀏覽次數、等級 ----------
     後端：docs/data/site.json 的 views = { url, key }（Supabase）。未設定時為「示範模式」，只計本裝置。
     規則：每次進入選手頁面 +1；同一裝置 60 秒內重複進入同一選手不重複計（防止重新整理灌數）。 */
  const ICON = {
    fire: '<svg viewBox="0 0 256 256" aria-hidden="true" fill="currentColor"><path d="M143.38,17.85a8,8,0,0,0-12.63,3.41l-22,60.41L84.59,58.26a8,8,0,0,0-11.93.89C51,87.53,40,116.08,40,144a88,88,0,0,0,176,0C216,84.55,165.21,36,143.38,17.85Zm40.51,135.49a57.6,57.6,0,0,1-46.56,46.55A7.65,7.65,0,0,1,136,200a8,8,0,0,1-1.32-15.89c16.57-2.79,30.630-16.85,33.44-33.45a8,8,0,0,1,15.780,2.68Z"/></svg>',
    eye: '<svg viewBox="0 0 256 256" aria-hidden="true" fill="currentColor"><path d="M247.31,124.76c-.35-.79-8.82-19.58-27.65-38.41C194.570,61.26,162.880,48,128,48S61.43,61.26,36.34,86.35C17.51,105.18,9,124,8.69,124.76a8,8,0,0,0,0,6.5c.35.79,8.82,19.57,27.65,38.4C61.43,194.74,93.12,208,128,208s66.57-13.26,91.66-38.34c18.83-18.83,27.3-37.61,27.65-38.4A8,8,0,0,0,247.31,124.76ZM128,168a40,40,0,1,1,40-40A40,40,0,0,1,128,168Z"/></svg>',
    crown: '<svg viewBox="0 0 256 256" aria-hidden="true" fill="currentColor"><path d="M248,80a28,28,0,1,0-51.12,15.77l-26.79,33L146,73.4a28,28,0,1,0-36.06,0L85.910,128.74l-26.79-33a28,28,0,1,0-26.6,12L47,194.63A16,16,0,0,0,62.78,208H193.22A16,16,0,0,0,209,194.63l14.47-86.850A28,28,0,0,0,248,80ZM128,40a12,12,0,1,1-12,12A12,12,0,0,1,128,40ZM24,80A12,12,0,1,1,36,92,12,12,0,0,1,24,80ZM220,92a12,12,0,1,1,12-12A12,12,0,0,1,220,92Z"/></svg>',
  };
  const LV = [0, 5, 15, 30, 50, 80, 120, 180, 260, 360, 500, 700, 1000, 1500];
  const TIERS = ["bronze", "bronze", "bronze", "silver", "silver", "silver", "gold", "gold", "gold", "plat", "plat", "plat", "diamond", "diamond"];
  function lvOf(v) {
    let i = 0; while (i + 1 < LV.length && v >= LV[i + 1]) i++;
    const next = LV[i + 1];
    return { lv: i + 1, cur: LV[i], next, pct: next ? (v - LV[i]) / (next - LV[i]) : 1, tier: TIERS[i] };
  }
  const Views = (() => {
    const cfg = () => (DB && DB.site && DB.site.views && DB.site.views.url) ? DB.site.views : null;
    const store = (k, fb) => { try { return JSON.parse(localStorage.getItem(k)) || fb; } catch (e) { return fb; } };
    const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 無痕模式 */ } };
    // 新式 publishable key（sb_publishable_…）只放 apikey 標頭；舊式 anon JWT 亦放 Authorization
    const H = (c) => Object.assign({ apikey: c.key, "Content-Type": "application/json" }, c.key.startsWith("sb_") ? {} : { Authorization: "Bearer " + c.key });
    async function get(pid) {
      const c = cfg();
      if (!c) return store("xc-views-demo", {})[pid] || 0;
      const r = await fetch(`${c.url}/rest/v1/xc_views?pid=eq.${encodeURIComponent(pid)}&select=views`, { headers: H(c), cache: "no-store" });
      const j = await r.json(); return (j[0] && j[0].views) || 0;
    }
    async function hit(pid) {
      const recent = store("xc-views-recent", {}); const now = Date.now();
      if (recent[pid] && now - recent[pid] < 60000) { const v = await get(pid); return { before: v, after: v, counted: false }; }
      recent[pid] = now; save("xc-views-recent", recent);
      const c = cfg();
      if (!c) { const d = store("xc-views-demo", {}); const before = d[pid] || 0; d[pid] = before + 1; save("xc-views-demo", d); return { before, after: before + 1, counted: true }; }
      const r = await fetch(`${c.url}/rest/v1/rpc/xc_hit`, { method: "POST", headers: H(c), body: JSON.stringify({ p_pid: pid }) });
      if (!r.ok) throw new Error("views " + r.status);
      const after = Number(await r.json()); return { before: after - 1, after, counted: true };
    }
    async function top(n = 50) {
      const c = cfg();
      if (!c) return Object.entries(store("xc-views-demo", {})).map(([pid, views]) => ({ pid, views })).sort((a, b) => b.views - a.views).slice(0, n);
      const r = await fetch(`${c.url}/rest/v1/xc_views?select=pid,views&order=views.desc,pid.asc&limit=${n}`, { headers: H(c), cache: "no-store" });
      return r.json();
    }
    return { get, hit, top, live: () => !!cfg() };
  })();

  function lvBadge(v, size = "") {
    const L = lvOf(v);
    return `<span class="lv-badge lv-${L.tier} ${size}" aria-label="Lv.${L.lv}"><i>${L.lv}</i></span>`;
  }
  function popCard(v) {
    const L = lvOf(v);
    return `<div class="pop-line lv-${L.tier}" id="popCard">
      <span class="pop-views">${ICON.eye}<span id="popViews">${v}</span>${t("popViews")}</span>
      <span class="xp" aria-hidden="true"><i class="xp-fill" style="transform:scaleX(${L.pct})"></i></span>
      <span class="pop-next">${L.next ? t("popNext", L.next - v, L.lv + 1) : t("popMax")}</span>
      <span class="plus1" aria-hidden="true">+1</span>
    </div>`;
  }
  function lvCorner(v) {
    const L = lvOf(v);
    return `<span class="lv-corner lv-${L.tier}" id="lvCorner" title="Lv.${L.lv} ${t("tier_" + L.tier)}"><small>LV</small><b>${L.lv}</b></span>`;
  }
  function levelUpFx(lv, tier) {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const el = document.createElement("div");
    el.className = `lvup lv-${tier}${reduce ? " still" : ""}`; el.setAttribute("role", "status");
    el.innerHTML = `<div class="lvup-burst"></div>${reduce ? "" : Array.from({ length: 14 }, (_, i) => `<i style="--a:${i * 360 / 14}deg;--d:${60 + (i % 3) * 22}px"></i>`).join("")}
      <div class="lvup-text"><small>LEVEL UP</small><b>Lv.${lv}</b><span>${t("tier_" + tier)}</span></div>`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), reduce ? 1600 : 1900);
  }
  function countUp(el, from, to) {
    if (!el) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || to - from > 50) { el.textContent = to; return; }
    const t0 = performance.now(), dur = 500;
    const step = (now) => { const k = Math.min(1, (now - t0) / dur); el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 4))); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  async function trackProfileView(pid) {
    const card = $("#popCard"); if (!card) return;
    try {
      const { before, after, counted } = await Views.hit(pid);
      if (!document.body.contains(card)) return;
      const L0 = lvOf(before), L1 = lvOf(after);
      card.outerHTML = popCard(before);
      const corner = $("#lvCorner"); if (corner) corner.outerHTML = lvCorner(before);
      requestAnimationFrame(() => {
        const c = $("#popCard"); if (!c) return;
        c.querySelector(".xp-fill").style.transform = `scaleX(${L1.pct})`;
        countUp($("#popViews"), before, after);
        if (counted) c.classList.add("counted");
        setTimeout(() => {
          const c2 = $("#popCard"); if (c2) c2.querySelector(".pop-next").textContent = L1.next ? t("popNext", L1.next - after, L1.lv + 1) : t("popMax");
          if (L1.lv > L0.lv) {
            const k = $("#lvCorner"); if (k) { k.outerHTML = lvCorner(after); $("#lvCorner").classList.add("leveled"); }
            if (c2) c2.className = `pop-line lv-${L1.tier} counted`;
            levelUpFx(L1.lv, L1.tier);
          }
        }, 500);
      });
    } catch (e) {
      console.warn("views unavailable", e);
    }
  }

  let popTimer = null;
  async function fillPopularity() {
    const box = $("#popBoard"); if (!box) return;
    let rows;
    try { rows = (await Views.top(50)).filter((r) => PEOPLE.has(r.pid) && !PEOPLE.get(r.pid).hidden && r.views > 0); }
    catch (e) { box.innerHTML = `<p class="muted-note">${t("popFail")}</p>`; return; }
    if (!document.body.contains(box)) return;
    const prev = new Map([...box.querySelectorAll("[data-pid]")].map((el) => [el.dataset.pid, Number(el.dataset.v)]));
    if (!rows.length) { box.innerHTML = `<p class="muted-note">${t("popEmpty")}</p>`; }
    else {
      const card = (r, i) => {
        const p = PEOPLE.get(r.pid), last = p.recs.at(-1), L = lvOf(r.views);
        const bumped = prev.has(r.pid) && prev.get(r.pid) < r.views ? " bumped" : "";
        return { p, last, L, bumped };
      };
      const podium = rows.slice(0, 3).map((r, i) => { const { p, last, L, bumped } = card(r, i);
        return `<a class="podium p${i + 1} lv-${L.tier}${bumped}" data-pid="${r.pid}" data-v="${r.views}" href="#/p/${r.pid}">
          ${i === 0 ? `<span class="crown">${ICON.crown}</span>` : ""}
          <span class="pd-rank">${i + 1}</span>${crest(last.school_zh, "md")}
          <div class="pd-name">${esc(lang === "zh" ? (p.name_zh || p.name_pt) : (p.name_pt || p.name_zh))}</div>
          <div class="pd-lv">${lvBadge(r.views)}<span>${ICON.fire}${r.views}</span></div></a>`; }).join("");
      const rest = rows.slice(3).map((r, i) => { const { p, last, L, bumped } = card(r, i + 3);
        return `<a class="row cr pop-row${bumped}" data-pid="${r.pid}" data-v="${r.views}" href="#/p/${r.pid}">
          <span class="rank">${i + 4}</span>${crest(last.school_zh, "sm")}
          <span style="min-width:0"><div class="nm">${personName(p)}</div><div class="sch">${esc(school(last.school_zh))}</div></span>
          <span class="pop-val">${lvBadge(r.views)}<b>${ICON.fire}${r.views}</b></span></a>`; }).join("");
      box.innerHTML = `<div class="podiums">${podium}</div>${rest ? `<div class="board">${rest}</div>` : ""}`;
    }
    const st = $("#popUpdated"); if (st) st.textContent = t("popUpdated", new Date().toLocaleTimeString(lang === "zh" ? "zh-HK" : "en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
  }

  /* ---------- 排行榜 ---------- */
  function renderRank(params) {
    const tab = params.get("t") || "ind";
    const edNo = Number(params.get("e")) || LATEST.edition;
    const ed = DB.editions.find((e) => e.edition === edNo) || LATEST;
    const cat = CATS.includes(params.get("c")) ? params.get("c") : "MA";
    const go = (o) => { const p = new URLSearchParams({ t: tab, e: ed.edition, c: cat, ...o }); location.replace("#/rank?" + p); };

    const yearChips = DB.editions.map((e) => `<button class="chip ${e.edition === ed.edition ? "on" : ""}" data-e="${e.edition}"><span class="num">${yearShort(e.year)}</span></button>`).join("");
    let body = "";
    if (tab === "pop") {
      body = `<div class="pop-head"><span class="live ${Views.live() ? "on" : "demo"}">${Views.live() ? t("popLive") : t("popDemo")}</span><span id="popUpdated" class="pop-upd"></span></div>
        ${Views.live() ? "" : `<p class="banner">${t("popDemoNote")}</p>`}
        <div id="popBoard"><div class="skeleton"><i class="sk-row"></i><i class="sk-row"></i></div></div>
        <p class="muted-note">${t("popRule")}</p>`;
    } else if (tab === "ind") {
      const g = cat[0];
      const catBtns = (letters) => letters.split("").map((l) => `<button class="${cat === g + l ? "on" : ""}" data-c="${g + l}">${l}</button>`).join("");
      const rows = ed.categories[cat].individual;
      const lead = rows[0]?.seconds;
      body = `
        <div class="filters">
          <div class="toggle"><button class="m ${g === "M" ? "on" : ""}" data-g="M">${t("male")}</button><button class="f ${g === "F" ? "on" : ""}" data-g="F">${t("female")}</button></div>
          <div class="cats"><span class="grp">${t("secondary")}</span>${catBtns("ABC")}<span class="grp">${t("primary")}</span>${catBtns("DE")}</div>
        </div>
        <div class="board-head"><h2>${esc(catLong(cat))}</h2><span class="meta">${t("edition", ed.edition)} · ${t("runners", rows.length)}</span></div>
        ${ed.scope === "top10" ? `<p class="banner">${t("top10")}</p>` : ""}
        ${wxCard(wxFor(ed.edition, cat), cat)}
        <div class="board">${rows.map((r) => `
          <a class="row cr" href="#/p/${r.pid}">
            <span class="rank ${r.rank <= 3 ? "r" + r.rank : ""}">${r.rank}</span>
            ${crest(r.school_zh, "sm")}
            <span style="min-width:0"><div class="nm">${personName(r)}</div><div class="sch">${esc(school(r.school_zh))}</div></span>
            <span class="tm">${fmt(r.seconds)}${r.rank > 1 && lead ? `<span class="gap">+${fmt(r.seconds - lead)}</span>` : ""}</span>
          </a>`).join("")}</div>
        <div class="link-row"><a href="#/records?c=${cat}">${t("seeRecords")} ›</a><a href="#/athletes?g=${g}&lv=${cat[1]}">${lang === "zh" ? "本組運動員名錄" : "Athletes in this category"} ›</a></div>`;
    } else {
      const focus = params.get("s");
      const teams = CATS.map((c) => {
        const tc = ed.categories[c].team_champion;
        return `<div class="team"><a class="cat ${c[0] === "M" ? "m" : "f"}" href="#/rank?e=${ed.edition}&c=${c}" aria-label="${esc(catLong(c))}">${catLabel(c)}</a>${tc ? schoolLink(tc.school_zh, "sm") : `<span class="none">${t("noTeam")}</span>`}</div>`;
      }).join("");
      const medal = MEDALS.map((m, i) => `<a class="medal ${focus && abbrOf(focus) === abbrOf(m.school) ? "mine" : ""}" href="${schoolHref(m.school)}"><span class="rank ${i < 3 ? "r" + (i + 1) : ""}">${i + 1}</span>${schoolLine(m.school, "sm")}<span class="cnt"><span>${m.secondary}</span><span>${m.primary}</span><span class="total">${m.total}</span></span></a>`).join("");
      body = `
        <div class="board-head"><h2>${t("teamChamps")}</h2><span class="meta">${t("edition", ed.edition)} · ${ed.year}</span></div>
        <div class="team-grid">${teams}</div>
        ${wxCard(wxFor(ed.edition, "MA"), "MA")}
        <div class="board-head"><h2>${t("medalAll")}</h2></div>
        <div class="board"><div class="medal-head"><span>#</span><span>${t("schoolLbl")}</span><span class="cnt"><span>${t("secShort")}</span><span>${t("priShort")}</span><span>${t("total")}</span></span></div>${medal}</div>`;
    }

    view.innerHTML = `
      <div class="seg seg3"><button data-t="ind" class="${tab === "ind" ? "on" : ""}">${t("individual")}</button><button data-t="team" class="${tab === "team" ? "on" : ""}">${t("team")}</button><button data-t="pop" class="${tab === "pop" ? "on" : ""}">${ICON.fire}${t("popTab")}</button></div>
      ${tab === "pop" ? "" : `<div class="chips" id="years">${yearChips}</div>`}
      ${body}`;

    view.querySelectorAll("[data-t]").forEach((b) => b.onclick = () => go({ t: b.dataset.t }));
    view.querySelectorAll("[data-e]").forEach((b) => b.onclick = () => go({ e: b.dataset.e }));
    view.querySelectorAll("[data-c]").forEach((b) => b.onclick = () => go({ c: b.dataset.c }));
    view.querySelectorAll("[data-g]").forEach((b) => b.onclick = () => go({ c: b.dataset.g + cat[1] }));
    // 只橫向置中已選屆別，不可令整頁上下捲動
    const on = $("#years .on"); if (on) { const box = on.parentElement; box.scrollLeft = on.offsetLeft - (box.clientWidth - on.offsetWidth) / 2; }
    const mine = $(".medal.mine"); if (mine) mine.scrollIntoView({ block: "center" });
    if (tab === "pop") { fillPopularity(); popTimer = setInterval(fillPopularity, 15000); }
  }

  /* ---------- 個人檔案 ---------- */
  function renderPerson(pid) {
    const p = PEOPLE.get(pid);
    if (!p) return renderNotFound();
    if (p.hidden) { view.innerHTML = `<div class="wip"><h2>${t("hiddenName")}</h2><p>${t("hiddenText")}</p><a class="btn" href="#/">${t("back")}</a></div>`; return; }
    const wins = p.recs.filter((r) => r.rank === 1).length;
    const best = Math.min(...p.recs.map((r) => r.rank));
    const chain = [...p.schools];
    // 校名可點擊進入學校資料頁；同校改名只顯示一次
    const schools = chain.filter((zh, i) => i === 0 || abbrOf(zh) !== abbrOf(chain[i - 1])).map((zh) => `<a href="${schoolHref(zh)}">${esc(school(zh))}</a>`).join(" → ");
    // 校徽鏈：只在真正轉校（代碼不同）時才顯示多個校徽；同校改名只顯示一個
    const crestSchools = chain.filter((zh, i) => i === 0 || (DB.schools[zh] || {}).abbr !== (DB.schools[chain[i - 1]] || {}).abbr);
    const crestChain = crestSchools.map((zh, i) => `${i ? '<span class="cc-arrow" aria-hidden="true">›</span>' : ""}${crest(zh, i === crestSchools.length - 1 ? "lg" : "md")}`).join("");
    const recsDesc = [...p.recs].reverse();
    const pos = (n) => n === 1 ? "g" : n === 2 ? "s" : n === 3 ? "b" : "";

    // 名次走勢（名次越小越高）
    let spark = "";
    if (p.recs.length > 1) {
      const W = 340, H = 130, padX = 24, top = 26, bottom = 30, maxR = Math.max(...p.recs.map((r) => r.rank), 3);
      const x = (i) => padX + (i * (W - padX * 2)) / (p.recs.length - 1);
      const y = (r) => top + ((r - 1) * (H - top - bottom)) / (maxR - 1 || 1);
      const pts = p.recs.map((r, i) => `${x(i).toFixed(1)},${y(r.rank).toFixed(1)}`).join(" ");
      const fill = (n) => n === 1 ? "var(--gold)" : n === 2 ? "var(--silver)" : n === 3 ? "var(--bronze)" : "var(--surface-2)";
      spark = `<div class="section-title"><h2>${t("rankTrend")}</h2></div>
        <div class="board" style="padding:6px 4px"><svg class="spark" viewBox="0 0 ${W} ${H}" role="img" aria-label="${t("rankTrend")}">
          <polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
          ${p.recs.map((r, i) => `<circle cx="${x(i)}" cy="${y(r.rank)}" r="5" fill="${fill(r.rank)}" stroke="var(--accent)" stroke-width="1.5"/>
            <text x="${x(i)}" y="${y(r.rank) - 10}" text-anchor="middle" font-size="13" fill="var(--text)">${r.rank}</text>
            <text x="${x(i)}" y="${H - 8}" text-anchor="middle" font-size="12" fill="var(--muted)">${yearShort(r.year)}</text>`).join("")}
        </svg></div>`;
    }

    view.innerHTML = `
      <section class="hero">
        <h1>${esc(lang === "zh" ? (p.name_zh || p.name_pt) : (p.name_pt || p.name_zh))}</h1>
        <div class="pt">${esc(lang === "zh" ? p.name_pt : p.name_zh)}</div>
        <div class="schools">${schools}</div>
        <div class="st-line">${statusChip(p, true)}</div>
        ${popCard(0)}
        <div class="crest-chain${crestSchools.length > 1 ? " multi" : ""}">${crestChain}${lvCorner(0)}</div>
        <div class="stats">
          <div class="stat"><b>${p.recs.length}</b><span>${t("races")}</span></div>
          <div class="stat"><b style="color:${best <= 3 ? `var(--${["gold", "silver", "bronze"][best - 1]})` : "inherit"}">${best}</b><span>${t("best")}</span></div>
          <div class="stat"><b style="color:var(--gold)">${wins}</b><span>${t("wins")}</span></div>
        </div>
      </section>
      ${spark}
      <p class="muted-note">${t("stHow")}</p>
      <div class="section-title"><h2>${t("history")}</h2></div>
      <div class="timeline">${recsDesc.map((r) => `
        <a class="tl" href="#/rank?e=${r.edition}&c=${r.cat}&hl=${r.pid}">
          <span class="yr">${yearShort(r.year)}<small>${t("edition", r.edition)}</small></span>
          <span class="info"><b>${esc(catLong(r.cat))}</b><br>${schoolLine(r.school_zh)}${(() => { const w = wxFor(r.edition, r.cat); return w ? `<span class="tl-wx">${esc(t("wxShort", Math.round(w.temp_avg), w.rh_avg))}${w.rain_reports > 0 ? " · " + t("wxRainY") : ""}</span>` : ""; })()}</span>
          <span class="res"><div class="pos ${pos(r.rank)}">${t("placeShort", r.rank)}</div><div class="tm">${fmt(r.seconds)}</div></span>
        </a>`).join("")}</div>`;
    trackProfileView(pid);
  }


  /* ---------- 第 48 屆賽前預覽 ---------- */
  function daysTo(dateStr) {
    const now = new Date(); const d = new Date(dateStr + "T00:00:00");
    return Math.round((d - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
  }
  function raceBanner() {
    const race = DB.race, pv = DB.preview;
    if (!race || !pv) return "";
    const days = daysTo(race.date);
    if (days < -30) return ""; // 賽後一個月不再顯示
    const first = race.schedule.slice().sort((a, b) => a.start.localeCompare(b.start))[0];
    const venue = lang === "zh" ? race.venue_zh : race.venue_pt;
    return `<a class="race-banner" href="#/preview">
      <div class="rb-main"><div class="rb-title">${esc(t("pvBanner", race.edition))}</div>
      <div class="rb-when">${esc(t("pvWhen", t("dateFmt", new Date(race.date + "T00:00:00")), first.start, venue))}</div></div>
      <div class="rb-side"><span class="rb-days">${esc(t("pvDays", days))}</span><span class="rb-go">${t("pvGo")} ›</span></div>
    </a>`;
  }


  /* 預測排名：只列出能以往績推算的選手；相鄰差距小於門檻者合併成「實力接近」組 */
  function predictionBoard(info) {
    const list = info.prediction || [];
    const meta = DB.preview.prediction_meta || {};
    if (!list.length) return `<p class="muted-note">${t("pdNone")}</p>`;
    const schoolOf = new Map(info.starters.map((s) => [s.pid, s.school_zh]));
    const lead = list[0].idx;
    let html = "", openGroup = null, shown = 0;
    list.forEach((x, i) => {
      const p = x.pid ? PEOPLE.get(x.pid) : null;
      if (x.pid && !p) return;
      shown++;
      const sch = x.pid ? schoolOf.get(x.pid) : x.school_zh;
      if (x.close && openGroup !== x.g) { if (openGroup !== null) html += "</div>"; html += `<div class="close-group"><div class="cg-label">${t("pdClose")}</div>`; openGroup = x.g; }
      else if (!x.close && openGroup !== null) { html += "</div>"; openGroup = null; }
      const gap = ((x.idx / lead - 1) * 100);
      const tags = [];
      if (x.aecm_rank) tags.push(`<span class="tag ${x.aecm_rank <= 3 ? "gold" : ""}">${t("pdAecm", x.aecm_rank, x.aecm_time)}</span>`);
      if (!x.pid) tags.push(`<span class="tag new">${t("pdNewbie")}</span>`);
      if (!x.aecm_rank && sch === "濠江中學") tags.push(`<span class="tag warn">${t("pdNoForm")}</span>`);
      const last = p ? p.recs.at(-1) : null;
      const name = p ? personName(p) : esc(x.name_zh);
      const tagName = x.pid ? "a" : "div";
      html += `<${tagName} class="row cr pd-row" ${x.pid ? `href="#/p/${x.pid}"` : ""}>
        <span class="rank ${i < 3 ? "r" + (i + 1) : ""}">${i + 1}</span>
        ${crest(sch, "sm")}
        <span style="min-width:0"><div class="nm">${name}</div><div class="sch">${esc(school(sch))}</div>${tags.length ? `<div class="tags">${tags.join("")}</div>` : ""}</span>
        <span class="pv-res"><b>${i === 0 ? t("pdTop") : "+" + gap.toFixed(1) + "%"}</b><span class="pd-last">${last ? `${t("pvLast")} ${catLabel(last.cat)} ${t("placeShort", last.rank)}` : t("pdNoHist")}</span></span>
      </${tagName}>`;
    });
    if (openGroup !== null) html += "</div>";
    const bt = meta.backtest || {}, ae = meta.aecm;
    return `<div class="board">${html}</div>
      <div class="pd-note">
        <p><b>${t("pdNoteTitle")}</b>${t("pdNote1", meta.close ? (meta.close * 100).toFixed(0) : 2)}</p>
        ${ae ? `<p>${t("pdNoteAecm", ae.name, Math.round((meta.aecm_weight || .6) * 100), ae.distances)}</p>` : ""}
        <p>${t("pdNote2", bt.spearman, bt.top3_hit)}</p>
        <p class="pd-warn">${t("pdNoteHK")}</p>
        <p class="pd-warn">${t("pdNote3", Math.max(info.total - shown, 0))}</p>
      </div>`;
  }


  /* 預覽頁頂部滑動區：真實相片做底的資訊卡 */
  function previewHero(race, pv) {
    const days = daysTo(race.date);
    const first = race.schedule.slice().sort((a, b) => a.start.localeCompare(b.start));
    const venue = lang === "zh" ? race.venue_zh : race.venue_pt;
    const nm = (x) => {
      if (!x.pid) return { name: x.name_zh, school: x.school_zh };
      const p = PEOPLE.get(x.pid); const st = pv.categories ? null : null;
      return { name: p ? (lang === "zh" ? (p.name_zh || p.name_pt) : (p.name_pt || p.name_zh)) : "", school: null };
    };
    const champs = CATS.map((c) => {
      const top = (pv.categories[c].prediction || [])[0]; if (!top) return "";
      const sch = top.pid ? (pv.categories[c].starters.find((s) => s.pid === top.pid) || {}).school_zh : top.school_zh;
      const n = nm(top).name;
      return `<a class="mini-row ${c[0] === "M" ? "m" : "f"}" href="#/preview?c=${c}&v=pred"><span class="cat">${catLabel(c)}</span><span class="who">${crest(sch, "xs")}${esc(n)}<small>${esc(school(sch))}</small></span><span class="t">${top.close ? `<small class="cl">${t("pdClose")}</small>` : ""}</span></a>`;
    }).join("");
    const horses = CATS.flatMap((c) => (pv.categories[c].prediction || []).filter((x) => !x.pid && x.aecm_rank && x.aecm_rank <= 3).map((x) => ({ ...x, c })))
      .sort((a, b) => a.aecm_rank - b.aecm_rank).slice(0, 8)
      .map((x) => `<div class="mini-row ${x.c[0] === "M" ? "m" : "f"}"><span class="cat">${catLabel(x.c)}</span><span class="who">${crest(x.school_zh, "xs")}${esc(x.name_zh)}<small>${esc(school(x.school_zh))}</small></span><span class="t">${t("pdAecmShort", x.aecm_rank)}</span></div>`).join("");
    const sched = first.map((x) => `<div class="mini-row ${x.cat[0] === "M" ? "m" : "f"}"><span class="cat">${catLabel(x.cat)}</span><span class="who">${x.distance.toLocaleString()}${lang === "zh" ? " 米" : " m"}<small>${x.runners}${t("pvRunnersUnit")}</small></span><span class="t">${x.start}</span></div>`).join("");
    const cards = [
      { photo: "arch", cls: "c-green hero-card", title: t("hcTitle"), sub: `${t("dateFmt", new Date(race.date + "T00:00:00"))} ${first[0].start} · ${venue}`,
        body: `<div class="hc-count"><b>${days > 0 ? days : days === 0 ? "0" : "-"}</b><span>${esc(t("pvDays", days))}</span></div>
               <div class="hc-stats"><div><b>${Object.values(race.totals).reduce((a, b) => a + b, 0)}</b><span>${t("hcRunners")}</span></div><div><b>${race.schools.length}</b><span>${t("hcSchools")}</span></div><div><b>10</b><span>${t("hcCats")}</span></div></div>` },
      { photo: "champ", cls: "c-gold", title: t("hcChamps"), sub: t("hcChampsSub"), body: `<div class="mini">${champs}</div>`, note: t("hcPredNote") },
      { photo: "runner", cls: "c-steel", title: t("hcPopular"), sub: Views.live() ? t("popLive") : t("popDemo"), body: `<div class="mini" id="heroPop"><div class="empty">${t("popEmpty")}</div></div>` },
      { photo: "girls", cls: "c-green", title: t("hcHorse"), sub: t("hcHorseSub"), body: `<div class="mini">${horses || `<div class="empty">-</div>`}</div>` },
      { photo: "start", cls: "c-steel", title: t("hcSched"), sub: t("hcSchedSub"), body: `<div class="mini">${sched}</div>` },
      { photo: "podium", cls: "c-gold", title: t("hcLast"), sub: t("hcLastSub", race.edition - 1), body: "", note: t("hcPhotoNote") },
    ];
    return `<div class="carousel pv-carousel" id="pvCarousel">${cards.map((k) => `<article class="card photo ${k.cls}" style="--photo:url(img/race/${k.photo}.jpg)"><h3>${esc(k.title)}</h3><div class="sub">${esc(k.sub)}</div>${k.body}${k.note ? `<div class="note">${esc(k.note)}</div>` : ""}</article>`).join("")}</div>
      <div class="dots" id="pvDots">${cards.map((_, i) => `<i class="${i ? "" : "on"}"></i>`).join("")}</div>`;
  }
  async function fillHeroPopular() {
    const box = $("#heroPop"); if (!box) return;
    try {
      const rows = (await Views.top(20)).filter((r) => PEOPLE.has(r.pid) && !PEOPLE.get(r.pid).hidden && r.views > 0).slice(0, 6);
      if (!rows.length || !document.body.contains(box)) return;
      box.innerHTML = rows.map((r, i) => { const p = PEOPLE.get(r.pid), last = p.recs.at(-1);
        return `<a class="mini-row ${p.gender === "M" ? "m" : "f"}" href="#/p/${r.pid}"><span class="cat">${i + 1}</span><span class="who">${crest(last.school_zh, "xs")}${esc(lang === "zh" ? (p.name_zh || p.name_pt) : (p.name_pt || p.name_zh))}<small>${esc(school(last.school_zh))}</small></span><span class="t">${lvBadge(r.views)}</span></a>`; }).join("");
    } catch (e) { /* 人氣暫時讀不到時保留預設文字 */ }
  }

  function renderPreview(params) {
    const race = DB.race, pv = DB.preview;
    if (!race || !pv) return renderNotFound();
    const cat = CATS.includes(params.get("c")) ? params.get("c") : "MA";
    const g = cat[0];
    const mode = params.get("v") === "pred" && pv.categories[cat].prediction ? "pred" : "past";
    const go = (c, v = mode) => { location.replace("#/preview?c=" + c + (v === "pred" ? "&v=pred" : "")); };
    const sch = race.schedule.find((x) => x.cat === cat);
    const dist = sch.distance, distRules = sch.distance_rules;
    const m = (v) => v.toLocaleString() + (lang === "zh" ? " 米" : " m");
    const info = pv.categories[cat];
    const lastEd = LATEST.edition;
    const rows = info.starters.map((s) => {
      const p = PEOPLE.get(s.pid);
      const last = p.recs.at(-1);
      const best = p.recs.reduce((b, r) => (r.rank < b.rank ? r : b), p.recs[0]);
      let group = "older";
      if (last.edition === lastEd && last.cat === cat) group = "same";
      else if (last.edition === lastEd) group = "up";
      return { s, p, last, best, group };
    });
    const order = { same: 0, up: 1, older: 2 };
    rows.sort((a, b) => order[a.group] - order[b.group] || b.last.edition - a.last.edition || "ABCDE".indexOf(a.last.cat[1]) - "ABCDE".indexOf(b.last.cat[1]) || a.last.rank - b.last.rank);
    const head = { same: t("pvSame"), up: t("pvUp"), older: t("pvOlder") };
    let html = "", cur = "";
    for (const x of rows) {
      if (x.group !== cur) { cur = x.group; html += `<div class="pv-group">${esc(head[cur])}</div>`; }
      const tags = [];
      if (x.group === "same" && x.last.rank === 1) tags.push(`<span class="tag gold">${t("pvDefend")}</span>`);
      else if (x.group === "same" && x.last.rank <= 3) tags.push(`<span class="tag">${t("pvTop3")}</span>`);
      if (x.group === "up") tags.push(`<span class="tag">${esc(t("pvUpTag", catLabel(x.last.cat)))}</span>`);
      const lastTxt = `${x.group === "older" ? yearShort(x.last.year) : t("pvLast")} ${catLabel(x.last.cat)} ${t("placeShort", x.last.rank)}`;
      html += `<a class="row cr pv-row" href="#/p/${x.p.pid}">
        <span class="rank ${x.group === "same" && x.last.rank <= 3 ? "r" + x.last.rank : ""}">${x.group === "same" ? x.last.rank : "·"}</span>
        ${crest(x.s.school_zh, "sm")}
        <span style="min-width:0"><div class="nm">${personName(x.p)}</div>
          <div class="sch">${esc(school(x.s.school_zh))}${x.s.heat ? ` · ${t("pvHeat", x.s.heat)}` : ""}</div>
          ${x.last.school_zh !== x.s.school_zh && (DB.schools[x.last.school_zh] || {}).abbr !== (DB.schools[x.s.school_zh] || {}).abbr ? `<div class="prev-school"><span>${t("prevSchool")}</span>${schoolLine(x.last.school_zh)}</div>` : ""}
          ${tags.length ? `<div class="tags">${tags.join("")}</div>` : ""}</span>
        <span class="pv-res"><b>${esc(lastTxt)}</b><span>${fmt(x.last.seconds)}</span></span>
      </a>`;
    }
    const catBtns = (letters) => letters.split("").map((l) => `<button class="${cat === g + l ? "on" : ""}" data-c="${g + l}">${l}</button>`).join("");
    view.innerHTML = `
      <h1 class="page-title pv-title">${esc(t("pvTitleZh"))}<small lang="pt">${esc(t("pvTitlePt"))}</small></h1>
      ${previewHero(race, pv)}
      <div class="filters">
        <div class="toggle"><button class="m ${g === "M" ? "on" : ""}" data-g="M">${t("male")}</button><button class="f ${g === "F" ? "on" : ""}" data-g="F">${t("female")}</button></div>
        <div class="cats"><span class="grp">${t("secondary")}</span>${catBtns("ABC")}<span class="grp">${t("primary")}</span>${catBtns("DE")}</div>
      </div>
      <section class="pv-info">
        <div class="pv-cat">${esc(catLong(cat))}</div>
        <dl>
          <div><dt>${t("pvCall")}</dt><dd>${sch.call}</dd></div>
          <div><dt>${t("pvStart")}</dt><dd>${sch.start}</dd></div>
          <div><dt>${t("pvDist")}</dt><dd>${m(dist)}</dd></div>
          <div><dt>${t("pvRunners")}</dt><dd>${sch.runners}</dd></div>
        </dl>
        <div class="pv-sub">${esc(lang === "zh" ? sch.laps_zh : sch.laps_en)} · ${esc(t("pvHeats", sch.heats))}</div>
        <div class="dist-pair">${distRules && distRules !== dist
          ? `<span><b>${t("distSched")}</b>${m(dist)}</span><span><b>${t("distRules")}</b>${m(distRules)}</span><em>${t("distDiffer")}</em>`
          : `<span><b>${t("distSched")}</b>${m(dist)}</span><span><b>${t("distRules")}</b>${distRules ? m(distRules) : "-"}</span><em>${t("distSame")}</em>`}</div>
      </section>
      <div class="board-head pv-head"><h2>${esc(mode === "pred" ? t("pdHead", (info.prediction || []).length, info.total) : t("pvKnown", info.starters.length, info.total))}</h2>
        <div class="mini-seg" role="tablist"><button role="tab" data-v="past" class="${mode === "past" ? "on" : ""}" aria-selected="${mode === "past"}">${t("pdPast")}</button><button role="tab" data-v="pred" class="${mode === "pred" ? "on" : ""}" aria-selected="${mode === "pred"}">${t("pdPred")}</button></div></div>
      ${mode === "pred" ? predictionBoard(info) : `${rows.length ? `<div class="board">${html}</div>` : `<p class="muted-note">${t("pvNone")}</p>`}
      ${info.unmatched ? `<p class="muted-note">${esc(t("pvNew", info.unmatched))}</p>` : ""}
      <p class="muted-note">${t("pvNote")}</p>`}`;
    view.querySelectorAll("[data-v]").forEach((b) => b.onclick = () => go(cat, b.dataset.v));
    const car = $("#pvCarousel"), dots = [...($("#pvDots") || { children: [] }).children];
    if (car) car.addEventListener("scroll", () => { const i = Math.round(car.scrollLeft / (car.firstElementChild.offsetWidth + 12)); dots.forEach((d, j) => d.classList.toggle("on", j === i)); }, { passive: true });
    fillHeroPopular();
    view.querySelectorAll("[data-c]").forEach((b) => b.onclick = () => go(b.dataset.c));
    view.querySelectorAll("[data-g]").forEach((b) => b.onclick = () => go(b.dataset.g + cat[1]));
  }


  /* ---------- 運動員名錄／學校名錄 ---------- */
  let ATH = null, SCHOOLS = null;
  function buildDirectory() {
    if (ATH) return;
    ATH = [...PEOPLE.values()].filter((p) => !p.hidden).map((p) => {
      const last = p.recs.at(-1);
      return { p, last, wins: p.recs.filter((r) => r.rank === 1).length, medals: p.recs.filter((r) => r.rank <= 3).length,
        best: Math.min(...p.recs.map((r) => r.rank)), abbrs: new Set(p.recs.map((r) => abbrOf(r.school_zh))) };
    }).sort((a, b) => b.wins - a.wins || b.medals - a.medals || a.best - b.best || b.last.edition - a.last.edition || b.p.recs.length - a.p.recs.length);
    const m = new Map();
    const row = (a) => { if (!m.has(a)) m.set(a, { abbr: a, names: new Set(), latest: null, latestEd: 0, titles: [], people: new Set(), wins: 0, medals: 0 }); return m.get(a); };
    for (const ed of DB.editions) for (const c of CATS) {
      const cat = ed.categories[c];
      for (const r of cat.individual) {
        const x = row(abbrOf(r.school_zh)); x.names.add(r.school_zh);
        if (ed.edition > x.latestEd) { x.latestEd = ed.edition; x.latest = r.school_zh; }
        if (!r.hidden) x.people.add(r.pid);
        if (r.rank === 1) x.wins++;
        if (r.rank <= 3) x.medals++;
      }
      if (cat.team_champion) { const x = row(abbrOf(cat.team_champion.school_zh)); x.names.add(cat.team_champion.school_zh); x.titles.push({ edition: ed.edition, year: ed.year, cat: c }); if (!x.latest) x.latest = cat.team_champion.school_zh; }
    }
    for (const s of (DB.race && DB.race.schools) || []) if (m.has(s.abbr)) m.get(s.abbr).latest = s.zh;
    SCHOOLS = [...m.values()].sort((a, b) => b.titles.length - a.titles.length || b.people.size - a.people.size || a.abbr.localeCompare(b.abbr));
  }

  function athRow(x) {
    const tags = [];
    if (x.wins) tags.push(`<span class="tag gold">${t("athWins", x.wins)}</span>`);
    if (x.medals > x.wins) tags.push(`<span class="tag">${t("athMedals", x.medals)}</span>`);
    if (!x.medals) tags.push(`<span class="tag">${t("athBest", x.best)}</span>`);
    return `<a class="row r3 ath-row" href="#/p/${x.p.pid}">
      ${crest(x.last.school_zh, "sm")}
      <span style="min-width:0"><div class="nm">${personName(x.p)}</div><div class="sch">${esc(school(x.last.school_zh))} · ${catLabel(x.last.cat)} ${yearShort(x.last.year)}</div><div class="tags">${tags.join("")}${x.p.status && x.p.status.code === "active" ? statusChip(x.p) : ""}</div></span>
      <span class="go">›</span></a>`;
  }

  function renderAthletes(params) {
    buildDirectory();
    const tab = params.get("tab") === "schools" ? "schools" : "people";
    const g = ["M", "F"].includes(params.get("g")) ? params.get("g") : "";
    const k = ["active", "champ", "podium"].includes(params.get("k")) ? params.get("k") : "";
    const lv = "ABCDE".includes(params.get("lv") || "-") ? params.get("lv") : "";
    const sc = params.get("s") || "";
    const set = (o) => { const p = new URLSearchParams({ tab, g, k, lv, s: sc, ...o }); for (const [a, b] of [...p]) if (!b || (a === "tab" && b === "people")) p.delete(a); location.replace("#/athletes" + (p.toString() ? "?" + p : "")); };
    const seg = `<div class="seg"><button data-tab="people" class="${tab === "people" ? "on" : ""}">${t("athTabPeople")}</button><button data-tab="schools" class="${tab === "schools" ? "on" : ""}">${t("athTabSchools")}</button></div>`;
    let body = "";
    if (tab === "schools") {
      body = `<div class="board-head"><h2>${t("schCount", SCHOOLS.length)}</h2></div>
        <div class="board">${SCHOOLS.map((x) => `<a class="row r3" href="#/s/${encodeURIComponent(x.abbr)}">${crest(x.latest, "sm")}
          <span style="min-width:0"><div class="nm">${esc(school(x.latest))}</div><div class="sch">${t("schAthletes")} ${x.people.size} · ${t("schIndWins")} ${x.wins}</div></span>
          <span class="sch-titles"><b>${x.titles.length}</b><small>${t("schTitles")}</small></span></a>`).join("")}</div>
        <p class="muted-note">${t("schSortNote")}</p>`;
    } else {
      let list = ATH;
      if (g) list = list.filter((x) => x.p.gender === g);
      if (lv) list = list.filter((x) => x.last.cat[1] === lv);
      if (sc) list = list.filter((x) => x.abbrs.has(sc));
      if (k === "active") list = list.filter((x) => x.p.status && x.p.status.code === "active");
      if (k === "champ") list = list.filter((x) => x.wins > 0);
      if (k === "podium") list = list.filter((x) => x.medals > 0);
      const chips = [["", t("athAll")], ["active", t("athActive")], ["champ", t("athChamp")], ["podium", t("athPodium")]].map(([v, l]) => `<button class="chip ${k === v ? "on" : ""}" data-k="${v}">${l}</button>`).join("");
      const opts = SCHOOLS.map((x) => `<option value="${esc(x.abbr)}" ${sc === x.abbr ? "selected" : ""}>${esc(school(x.latest))}</option>`).join("");
      const lvBtns = ["", ..."ABCDE"].map((l) => `<button class="${lv === l ? "on" : ""}" data-lv="${l}">${l || t("athAll")}</button>`).join("");
      body = `
        <div class="filters">
          <div class="toggle"><button class="a ${g === "" ? "on" : ""}" data-g="">${t("athAll")}</button><button class="m ${g === "M" ? "on" : ""}" data-g="M">${t("male")}</button><button class="f ${g === "F" ? "on" : ""}" data-g="F">${t("female")}</button></div>
          <div class="cats lv-cats">${lvBtns}</div>
        </div>
        <label class="sel"><span class="sr">${t("schoolLbl")}</span><select id="athSchool"><option value="">${t("athAllSchools")}</option>${opts}</select></label>
        <div class="chips">${chips}</div>
        <div class="board-head"><h2>${t("athCount", list.length)}</h2><span class="meta">${lang === "zh" ? "以最後一次參賽的組別計算" : "By latest category"}</span></div>
        ${list.length ? `<div class="board" id="athList">${list.slice(0, 40).map(athRow).join("")}</div>
        ${list.length > 40 ? `<button type="button" class="more-btn" id="athMore">${t("athMore", list.length - 40)}</button>` : ""}` : `<p class="muted-note">${t("athNone")}</p>`}
        <p class="muted-note">${t("athSortNote")}</p>`;
      view._athList = list;
    }
    view.innerHTML = `<h1 class="page-title">${t("athTitle")}</h1>${seg}${body}`;
    view.querySelectorAll("[data-tab]").forEach((b) => b.onclick = () => set({ tab: b.dataset.tab }));
    view.querySelectorAll("[data-g]").forEach((b) => b.onclick = () => set({ g: b.dataset.g }));
    view.querySelectorAll("[data-k]").forEach((b) => b.onclick = () => set({ k: b.dataset.k }));
    view.querySelectorAll("[data-lv]").forEach((b) => b.onclick = () => set({ lv: b.dataset.lv }));
    const sel = $("#athSchool"); if (sel) sel.onchange = () => set({ s: sel.value });
    const more = $("#athMore");
    if (more) {
      let shown = 40;
      more.onclick = () => {
        const list = view._athList; const next = list.slice(shown, shown + 40); shown += next.length;
        $("#athList").insertAdjacentHTML("beforeend", next.map(athRow).join(""));
        if (shown >= list.length) more.remove(); else more.textContent = t("athMore", list.length - shown);
      };
    }
  }

  /* ---------- 學校資料頁 ---------- */
  function renderSchool(abbr) {
    buildDirectory();
    const x = SCHOOLS.find((s) => s.abbr === abbr);
    if (!x) return renderNotFound();
    const zh = x.latest, info = DB.schools[zh] || {};
    const former = [...x.names].filter((n) => n !== zh);
    const people = ATH.filter((a) => a.abbrs.has(abbr));
    const medals = [];
    for (const a of people) for (const r of a.p.recs) if (r.rank <= 3 && abbrOf(r.school_zh) === abbr) medals.push({ a, r });
    medals.sort((m, n) => n.r.edition - m.r.edition || CATS.indexOf(m.r.cat) - CATS.indexOf(n.r.cat) || m.r.rank - n.r.rank);
    const current = people.filter((a) => a.p.status && a.p.status.code === "active" && abbrOf(a.p.status.school) === abbr)
      .sort((m, n) => CATS.indexOf(m.p.status.cat) - CATS.indexOf(n.p.status.cat) || m.best - n.best);
    const byYear = new Map(); for (const tt of x.titles) { if (!byYear.has(tt.edition)) byYear.set(tt.edition, { ...tt, cats: [] }); byYear.get(tt.edition).cats.push(tt.cat); }
    const titleRows = [...byYear.values()].sort((a, b) => b.edition - a.edition).map((y) => `
      <a class="medal" href="#/rank?t=team&e=${y.edition}&s=${encodeURIComponent(zh)}"><span class="yr-cell">${yearShort(y.year)}</span>
        <span class="title-cats">${y.cats.map((c) => `<span class="cat-chip ${c[0] === "M" ? "m" : "f"}">${catLabel(c)}</span>`).join("")}</span><span class="go">›</span></a>`).join("");
    const medalRows = medals.map(({ a, r }) => `<a class="row r3" href="#/p/${a.p.pid}">
      <span class="rank r${r.rank}">${r.rank}</span>
      <span style="min-width:0"><div class="nm">${personName(a.p)}</div><div class="sch">${catLong(r.cat)} · ${t("edition", r.edition)} ${yearShort(r.year)}</div></span>
      <span class="tm">${fmt(r.seconds)}</span></a>`).join("");
    const roster = [...people].sort((m, n) => n.last.edition - m.last.edition || n.wins - m.wins || n.medals - m.medals || m.best - n.best);
    view.innerHTML = `
      <section class="hero school-hero">
        <div class="school-crest">${crest(zh, "lg")}</div>
        <h1>${esc(school(zh))}</h1>
        <div class="pt">${esc(lang === "zh" ? (info.pt || "") : zh)}</div>
        ${former.length ? `<div class="schools">${t("schFormer")}${former.map((n) => esc(school(n))).join("、")}</div>` : ""}
        <div class="stats stats4">
          <div class="stat"><b style="color:var(--gold)">${x.titles.length}</b><span>${t("schTitles")}</span></div>
          <div class="stat"><b>${x.wins}</b><span>${t("schIndWins")}</span></div>
          <div class="stat"><b>${x.medals}</b><span>${t("schMedals")}</span></div>
          <div class="stat"><b>${x.people.size}</b><span>${t("schAthletes")}</span></div>
        </div>
      </section>
      ${current.length ? `<div class="section-title"><h2>${t("schCurrent", DB.race.edition)}</h2><a href="#/preview">${t("pvGo")} ›</a></div>
        <div class="board">${current.map((a) => `<a class="row r3" href="#/p/${a.p.pid}"><span class="rank cat-rank ${a.p.status.cat[0] === "M" ? "m" : "f"}">${catLabel(a.p.status.cat)}</span>
          <span style="min-width:0"><div class="nm">${personName(a.p)}</div><div class="sch">${t("pvLast")} ${catLabel(a.last.cat)} ${t("placeShort", a.last.rank)} · ${yearShort(a.last.year)}</div></span><span class="go">›</span></a>`).join("")}</div>` : ""}
      <div class="section-title"><h2>${t("schTeamList")}</h2><a href="#/rank?t=team&s=${encodeURIComponent(zh)}">${t("schViewRank")} ›</a></div>
      ${titleRows ? `<div class="board">${titleRows}</div>` : `<p class="muted-note">${t("schNoTitle")}</p>`}
      <div class="section-title"><h2>${t("schMedalList")}</h2></div>
      ${medalRows ? `<div class="board">${medalRows}</div>` : `<p class="muted-note">${t("schNoMedal")}</p>`}
      <div class="section-title"><h2>${t("schRoster")}</h2><a href="#/athletes?s=${encodeURIComponent(abbr)}">${t("more")} ›</a></div>
      <div class="board">${roster.slice(0, 15).map(athRow).join("")}</div>`;
  }

  /* ---------- 私隱及資料使用／申請移除 ---------- */
  function renderPrivacy() {
    const site = DB.site || {};
    const url = site.removal_url;
    const cta = url
      ? `<a class="btn-primary" href="${esc(url)}" target="_blank" rel="noopener">${t("pvyApply")}</a>`
      : `<p class="banner">${t("pvyPending")}</p>`;
    view.innerHTML = `
      <h1 class="page-title">${t("pvyTitle")}</h1>
      <section class="prose">
        <h2>${t("pvySrcH")}</h2><p>${t("pvySrc")} <a href="${esc(DB.source)}" target="_blank" rel="noopener">${t("source")}</a></p>
        <h2>${t("pvyShowH")}</h2><p>${t("pvyShow")}</p>
        <h2>${t("pvyNoH")}</h2><p>${t("pvyNo")}</p>
        <h2>${t("pvyStatusH")}</h2><p>${t("stHow")}</p>
        <h2 id="remove">${t("pvyRemoveH")}</h2>
        <p>${t("pvyRemove", site.removal_days || 7)}</p>
        <ol class="steps"><li>${t("pvyStep1")}</li><li>${t("pvyStep2")}</li><li>${t("pvyStep3")}</li></ol>
        ${cta}
        <p class="muted-note">${t("pvyNote")}</p>
      </section>`;
  }

  /* ---------- 紀錄與趨勢 ---------- */
  const SERIES = { champ: "#c98500", tenth: "#9085e9", bars: "#199e70" }; // 已用 dataviz 驗證器在深色底驗證

  function niceStep(range) {
    const steps = [10, 15, 20, 30, 60, 90, 120, 180, 300];
    return steps.find((s) => range / s <= 5) || 600;
  }

  function lineChart({ id, xs, series, label }) {
    const W = 340, H = 210, L = 42, R = 46, T = 14, B = 28;
    const vals = series.flatMap((s) => s.values.filter((v) => v != null));
    const lo0 = Math.min(...vals), hi0 = Math.max(...vals);
    const step = niceStep(hi0 - lo0 || 30);
    const lo = Math.floor(lo0 / step) * step, hi = Math.ceil(hi0 / step) * step || lo + step;
    const x = (i) => L + (i * (W - L - R)) / Math.max(xs.length - 1, 1);
    const y = (v) => T + ((v - lo) * (H - T - B)) / (hi - lo || 1);
    const ticks = []; for (let v = lo; v <= hi + 0.01; v += step) ticks.push(v);
    const grid = ticks.map((v) => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" class="ax">${fmt(v)}</text>`).join("");
    const xl = xs.map((s, i) => `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" class="ax">${esc(s)}</text>`).join("");
    const lines = series.map((s) => {
      const pts = s.values.map((v, i) => v == null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`).filter(Boolean).join(" ");
      const lastI = s.values.map((v, i) => v == null ? -1 : i).filter((i) => i >= 0).at(-1);
      const dots = s.values.map((v, i) => v == null ? "" : `<circle cx="${x(i)}" cy="${y(v)}" r="4" fill="${s.color}" stroke="var(--surface)" stroke-width="2"/>`).join("");
      const end = lastI != null ? `<text x="${x(lastI) + 8}" y="${y(s.values[lastI]) + 4}" class="endlbl">${fmt(s.values[lastI])}</text>` : "";
      return `<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>${dots}${end}`;
    }).join("");
    const legend = series.map((s) => `<span class="lg"><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join("");
    const table = `<table class="tv"><thead><tr><th>${t("season")}</th>${series.map((s) => `<th>${esc(s.name)}</th>`).join("")}</tr></thead><tbody>${xs.map((s, i) => `<tr><td>${esc(s)}</td>${series.map((se) => `<td>${fmt(se.values[i])}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    return `<figure class="chart" id="${id}">
      <div class="legend">${legend}</div>
      <div class="plot"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}" tabindex="0">${grid}${xl}<line class="xh" x1="0" x2="0" y1="${T}" y2="${H - B}" visibility="hidden"/>${lines}<rect class="hit" x="${L - 10}" y="${T}" width="${W - L - R + 20}" height="${H - T - B}" fill="transparent"/></svg><div class="tip" hidden></div></div>
      <figcaption>${t("lowerFaster")}</figcaption>
      <details class="tvw"><summary>${t("tableView")}</summary>${table}</details>
    </figure>`;
  }

  function wireLineChart(id, xs, series) {
    const fig = document.getElementById(id); if (!fig) return;
    const svg = fig.querySelector("svg"), tip = fig.querySelector(".tip"), xh = fig.querySelector(".xh");
    const W = 340, L = 42, R = 46;
    let cur = -1;
    const show = (i) => {
      cur = Math.max(0, Math.min(xs.length - 1, i));
      const xx = L + (cur * (W - L - R)) / Math.max(xs.length - 1, 1);
      xh.setAttribute("x1", xx); xh.setAttribute("x2", xx); xh.setAttribute("visibility", "visible");
      tip.replaceChildren();
      const h = document.createElement("div"); h.className = "th"; h.textContent = xs[cur]; tip.appendChild(h);
      for (const s of series) {
        const row = document.createElement("div"); row.className = "tr";
        const k = document.createElement("i"); k.style.background = s.color;
        const v = document.createElement("b"); v.textContent = fmt(s.values[cur]);
        const n = document.createElement("span"); n.textContent = s.name;
        row.append(k, v, n); tip.appendChild(row);
      }
      tip.hidden = false;
      const rect = svg.getBoundingClientRect(), px = (xx / W) * rect.width;
      tip.style.left = Math.min(Math.max(px - 60, 0), rect.width - 130) + "px";
    };
    const hide = () => { xh.setAttribute("visibility", "hidden"); tip.hidden = true; };
    svg.addEventListener("pointermove", (e) => {
      const rect = svg.getBoundingClientRect(); const vx = ((e.clientX - rect.left) / rect.width) * W;
      show(Math.round(((vx - L) / (W - L - R)) * (xs.length - 1)));
    });
    svg.addEventListener("pointerleave", hide);
    svg.addEventListener("focus", () => show(cur < 0 ? xs.length - 1 : cur));
    svg.addEventListener("blur", hide);
    svg.addEventListener("keydown", (e) => { if (e.key === "ArrowLeft") { show(cur - 1); e.preventDefault(); } if (e.key === "ArrowRight") { show(cur + 1); e.preventDefault(); } });
  }

  function barChart({ id, xs, values, label }) {
    const W = 340, H = 170, L = 12, R = 12, T = 22, B = 26, bw = 24;
    const max = Math.max(...values, 1);
    const slot = (W - L - R) / xs.length;
    const bars = values.map((v, i) => {
      const h = ((H - T - B) * v) / max, bx = L + slot * i + (slot - bw) / 2, by = H - B - h;
      // 頂端 4px 圓角、底部方角
      const d = `M${bx},${H - B} V${by + 4} Q${bx},${by} ${bx + 4},${by} H${bx + bw - 4} Q${bx + bw},${by} ${bx + bw},${by + 4} V${H - B} Z`;
      return `<g class="bar" tabindex="0" aria-label="${esc(xs[i])}: ${v}"><rect x="${L + slot * i}" y="${T}" width="${slot}" height="${H - T - B}" fill="transparent"/><path d="${d}" fill="${SERIES.bars}"/><text x="${bx + bw / 2}" y="${by - 6}" text-anchor="middle" class="val">${v}</text><text x="${bx + bw / 2}" y="${H - 8}" text-anchor="middle" class="ax">${esc(xs[i])}</text></g>`;
    }).join("");
    return `<figure class="chart" id="${id}"><div class="plot"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}"><line x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}" class="grid"/>${bars}</svg></div></figure>`;
  }

  function renderRecords(params) {
    const cat = CATS.includes(params.get("c")) ? params.get("c") : "MA";
    const g = cat[0];
    const go = (c) => { location.replace("#/records?c=" + c); };
    const eds = [...DB.editions].sort((a, b) => a.edition - b.edition); // 舊→新
    const xs = eds.map((e) => yearShort(e.year));
    const champ = eds.map((e) => e.categories[cat].individual[0]?.seconds ?? null);
    const tenth = eds.map((e) => e.categories[cat].individual[9]?.seconds ?? null);
    const all = eds.flatMap((e) => e.categories[cat].individual.map((r) => ({ ...r, year: e.year, edition: e.edition })));
    const top = all.filter((r) => r.seconds != null).sort((a, b) => a.seconds - b.seconds || a.edition - b.edition).slice(0, 10);
    const rec = top[0];
    const dist = DB.distances;
    const known = dist ? Object.values(dist.years).filter((v) => v != null).length : 0;
    const fullEds = eds.filter((e) => e.scope === "full");
    const teamRows = [...eds].reverse().map((e) => ({ e, tc: e.categories[cat].team_champion }));
    // 連冠計算（由新到舊）
    let streak = 0; for (const { tc } of teamRows) { if (tc && tc.school_zh === teamRows[0].tc?.school_zh) streak++; else break; }
    const catBtns = (letters) => letters.split("").map((l) => `<button class="${cat === g + l ? "on" : ""}" data-c="${g + l}">${l}</button>`).join("");

    view.innerHTML = `
      <div class="filters" style="margin-top:6px">
        <div class="toggle"><button class="m ${g === "M" ? "on" : ""}" data-g="M">${t("male")}</button><button class="f ${g === "F" ? "on" : ""}" data-g="F">${t("female")}</button></div>
        <div class="cats"><span class="grp">${t("secondary")}</span>${catBtns("ABC")}<span class="grp">${t("primary")}</span>${catBtns("DE")}</div>
      </div>
      <p class="banner">${t("distBanner", known, dist?.current?.[cat], dist?.rules?.[cat])}</p>
      ${rec ? `<section class="record">
        <div class="label">${t("recordTitle", catLong(cat))}</div>
        <div class="rec-time">${fmt(rec.seconds)}</div>
        <a class="rec-who" href="#/p/${rec.pid}">${personName(rec)}</a>
        <div class="rec-meta">${schoolLink(rec.school_zh, "sm")} · <a href="#/rank?e=${rec.edition}&c=${cat}&hl=${rec.pid}">${t("edition", rec.edition)} ${esc(rec.year)}</a></div>
      </section>` : ""}
      <div class="section-title"><h2>${t("trendTitle")}</h2></div>
      ${lineChart({ id: "trend", xs, series: [{ name: t("champTime"), color: SERIES.champ, values: champ }, { name: t("tenthTime"), color: SERIES.tenth, values: tenth }], label: t("trendTitle") })}
      <div class="section-title"><h2>${t("top10Title")}</h2></div>
      <div class="board">${top.map((r, i) => `
        <a class="row cr" href="#/p/${r.pid}">
          <span class="rank ${i < 3 ? "r" + (i + 1) : ""}">${i + 1}</span>
          ${crest(r.school_zh, "sm")}
          <span style="min-width:0"><div class="nm">${personName(r)}</div><div class="sch">${esc(school(r.school_zh))} · ${yearShort(r.year)}</div>${PEOPLE.get(r.pid)?.status?.code === "active" ? `<div class="tags">${statusChip(PEOPLE.get(r.pid))}</div>` : ""}</span>
          <span class="tm">${fmt(r.seconds)}</span>
        </a>`).join("")}</div>
      <div class="section-title"><h2>${t("finTitle")}</h2></div>
      ${barChart({ id: "fin", xs: fullEds.map((e) => yearShort(e.year)), values: fullEds.map((e) => e.categories[cat].individual.length), label: t("finTitle") })}
      <p class="muted-note">${t("finNote")}</p>
      <div class="section-title"><h2>${t("teamHist")}</h2>${streak >= 2 ? `<span class="pill">${t("streakNow", streak)}</span>` : ""}</div>
      <div class="board">${teamRows.map(({ e, tc }) => tc ? `
        <a class="medal" href="${schoolHref(tc.school_zh)}"><span class="yr-cell">${yearShort(e.year)}</span><span>${schoolLine(tc.school_zh, "sm")}</span><span class="go">›</span></a>` : `
        <div class="medal"><span class="yr-cell">${yearShort(e.year)}</span><span class="none" style="color:var(--muted);font-size:13px">${t("noTeam")}</span><span></span></div>`).join("")}</div>
      ${wxTable(eds, cat)}`;

    view.querySelectorAll("[data-c]").forEach((b) => b.onclick = () => go(b.dataset.c));
    view.querySelectorAll("[data-g]").forEach((b) => b.onclick = () => go(b.dataset.g + cat[1]));
    wireLineChart("trend", xs, [{ name: t("champTime"), color: SERIES.champ, values: champ }, { name: t("tenthTime"), color: SERIES.tenth, values: tenth }]);
    if (params.get("go") === "wx") { const el = $("#wx"); if (el) el.scrollIntoView({ block: "start" }); }
  }

  /* 歷屆比賽天氣：每屆一行，連同本組冠軍成績，方便比較各年條件；點選進入該屆成績 */
  function wxTable(eds, cat) {
    if (!DB.weather) return "";
    const rows = [...eds].reverse().map((e) => {
      const w = wxFor(e.edition, cat); if (!w) return "";
      const champ = e.categories[cat].individual[0];
      const notes = wxNotes(w).filter((n) => n !== t("wxPlanned"));
      return `<a class="wxrow" href="#/rank?e=${e.edition}&c=${cat}">
        <span class="yr">${yearShort(e.year)}<small>${t("edition", e.edition)}</small></span>
        <span class="wx-mid"><b>${to(w.temp_min, w.temp_max)}°C · ${lang === "zh" ? "濕度" : "RH"} ${w.rh_avg}%${w.rain_reports > 0 ? " · " + t("wxRainY") : ""}</b>
          <small>${esc(t("wxDayFmt", w.date))}${w.basis === "planned" ? "＊" : ""}${notes.length ? " · " + esc(notes.join("；")) : ""}</small>
          <span class="wx-badge lv-${w.level}">${t("wx_" + w.level)} · ${esc(wxSlow(w))}</span></span>
        <span class="wx-champ">${champ ? fmt(champ.seconds) : "-"}<small>${t("champTime")}</small></span>
      </a>`;
    }).join("");
    return `<div class="section-title" id="wx"><h2>${t("wxRecTitle")}</h2></div>
      <p class="muted-note" style="margin-top:-4px">${t("wxRecSub")}</p>
      <div class="board">${rows}</div>
      <p class="muted-note">${t("wxPlannedFoot")}${t("wxNote")}</p>`;
  }
  function renderNotFound() { view.innerHTML = `<div class="wip"><h2>${t("notFound")}</h2><a class="btn" href="#/">${t("back")}</a></div>`; }

  /* ---------- 路由 ---------- */
  window.addEventListener("error", (e) => { console.error(e.error || e.message); });
  let routed = false, navDepth = 0, lastPath = null;
  window.addEventListener("hashchange", () => { navDepth++; });
  function backButton() {
    // Phosphor Icons (MIT) caret-left bold
    return `<button type="button" class="back" id="backBtn"><svg viewBox="0 0 256 256" aria-hidden="true" fill="currentColor"><path d="M168.49,199.51a12,12,0,0,1-17,17l-80-80a12,12,0,0,1,0-17l80-80a12,12,0,0,1,17,17L97,128Z"/></svg>${t("back")}</button>`;
  }
  function wireBack() {
    const b = $("#backBtn"); if (!b) return;
    // 由站內點入 → 回上一頁；直接開啟連結 → 回首頁
    b.onclick = () => { if (navDepth > 0) history.back(); else location.hash = "#/"; };
  }
  function route() {
    if (popTimer) { clearInterval(popTimer); popTimer = null; }
    const h = location.hash.replace(/^#/, "") || "/";
    const [path, qs] = h.split("?");
    const params = new URLSearchParams(qs || "");
    let nav = "home";
    if (path === "/" || path === "") renderHome();
    else if (path === "/rank") { nav = "rank"; renderRank(params); highlight(params.get("hl")); }
    else if (path.startsWith("/p/")) { nav = ""; renderPerson(path.slice(3)); }
    else if (path === "/athletes") { nav = "athletes"; renderAthletes(params); }
    else if (path.startsWith("/s/")) { nav = "athletes"; renderSchool(decodeURIComponent(path.slice(3))); }
    else if (path === "/records") { nav = "records"; renderRecords(params); }
    else if (path === "/preview") { nav = ""; renderPreview(params); }
    else if (path === "/privacy") { nav = ""; renderPrivacy(); }
    else renderNotFound();
    if ((path.startsWith("/p/") || path.startsWith("/s/") || path === "/preview" || path === "/privacy") && !view.querySelector(".wip")) {
      view.insertAdjacentHTML("afterbegin", backButton());
      wireBack();
    }
    document.querySelectorAll(".dock a").forEach((a) => {
      const on = a.dataset.nav === nav;
      a.classList.toggle("on", on);
      if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    if (routed) view.focus({ preventScroll: true });
    routed = true;
    // 同一頁面內切換篩選（男女、組別、屆別、往績／預測）保留捲動位置；進入另一頁才回到頁頂
    const samePage = path === lastPath;
    lastPath = path;
    if (!samePage && !params.get("hl") && !(path === "/rank" && params.get("s")) && !params.get("go")) window.scrollTo(0, 0);
  }
  // 再按目前頁面的底部按鈕：回到頁頂（一般 App 做法）
  document.querySelectorAll(".dock a").forEach((a) => a.addEventListener("click", () => {
    if (a.classList.contains("on")) window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }));
  function highlight(pid) {
    if (!pid) return;
    const a = view.querySelector(`.row[href="#/p/${pid}"]`);
    if (a) { a.classList.add("mine"); a.scrollIntoView({ block: "center" }); }
  }

  function applyLang() {
    document.documentElement.lang = lang === "zh" ? "zh-Hant" : "en";
    document.querySelectorAll("[data-i18n]").forEach((el) => el.textContent = t(el.dataset.i18n));
    document.querySelectorAll("[data-i18n-ph]").forEach((el) => el.placeholder = t(el.dataset.i18nPh));
    $("#langBtn").textContent = lang === "zh" ? "EN" : "中";
    $("#langBtn").setAttribute("aria-label", t("langAria"));
    document.querySelectorAll("[data-i18n-aria]").forEach((el) => el.setAttribute("aria-label", t(el.dataset.i18nAria)));
    document.title = lang === "zh" ? "澳門學界越野跑成績" : "Macau Schools Cross-Country Results";
  }
  $("#langBtn").onclick = () => {
    lang = lang === "zh" ? "en" : "zh";
    try { localStorage.setItem("xc-lang", lang); } catch (e) { /* 忽略 */ }
    applyLang(); ATH = null; SCHOOLS = null; route(); if (q.value) search(q.value);
  };

  applyLang();
  // 每次都向伺服器確認資料是否更新（ETag），避免新舊檔案混用
  const get = (u) => fetch(u, { cache: "no-cache" });
  const opt = (u) => get(u).then((r) => r.ok ? r.json() : null).catch(() => null);
  Promise.all([get("data/results.json").then((r) => r.json()), opt("data/distances.json"), opt("data/race48.json"), opt("data/preview48.json"), opt("data/crests.json"), opt("data/site.json"), opt("data/weather.json")]).then(([d, dist, race, pv, crests, site, weather]) => {
    DB = d; DB.site = site || {}; DB.weather = weather;
    DB = d; DB.distances = dist; DB.race = race; DB.preview = pv && pv.data_version === d.data_version ? pv : null; DB.crests = (crests && crests.images) || {}; derive(); deriveStatus();
    $("#srcLink").href = d.source;
    window.addEventListener("hashchange", route);
    route();
  }).catch((err) => {
    console.error(err); // 讓真正原因可見（測試會捕捉 console 錯誤）
    view.innerHTML = `<div class="wip" role="alert"><h2>${t("loadFail")}</h2><p>${t("loadFailText")}</p><button type="button" id="retry">${t("retry")}</button></div>`;
    $("#retry").onclick = () => location.reload();
  });
})();
