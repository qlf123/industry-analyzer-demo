/* 教学达成计算（教学达成分析页、数据概览共用）
 * 数据：老师在任务中心确认的学习证据（TK store evidence），每条 {student, sid, grade, tid, planId, at}
 * 口径：
 *   - 只算给定课程计划范围内的证据；
 *   - 同一「学生 × 技能」取最近一次证据，「需改进」为未达成，优秀 / 合格为达成；
 *   - 技能经已确认的「能力—技能映射」（直接支撑、部分支撑）汇总到能力，能力不单独打分；
 *   - 支撑技能只算范围内已开课程（有课程计划的课程）里的技能；学生自评不计入。
 * 用法：TR.compute(S, plans, range?) → { pairs, ok, no, students, skills, abilities:[...], byPlan:{planId: {...}} }
 */
(function (root) {
  'use strict';
  function compute(S, plans, range) {
    var K = root.TK.kn(), pid = {}, last = {};
    plans.forEach(function (p) { pid[p.id] = p; });
    var inR = function (s) { if (!range) return true; var d = new Date(String(s).replace(' ', 'T')); return d >= range.a && d < range.b; };
    (S.evidence || []).forEach(function (e) {
      if (!pid[e.planId] || !inR(e.at)) return;
      var k = e.planId + '|' + e.student + '|' + e.sid;
      if (!last[k] || e.at >= last[k].at) last[k] = e;
    });
    var ev = Object.keys(last).map(function (k) { return last[k]; });
    var bySkill = {}, byPlan = {};
    ev.forEach(function (e) {
      (bySkill[e.sid] = bySkill[e.sid] || []).push(e);
      var b = byPlan[e.planId] = byPlan[e.planId] || { plan: pid[e.planId], pairs: 0, no: 0, students: {}, lessons: {}, weak: {} };
      b.pairs++; b.students[e.student] = 1; b.lessons[e.tid] = 1;
      if (e.grade === '需改进') { b.no++; b.weak[e.sid] = (b.weak[e.sid] || 0) + 1; }
    });
    var opened = plans.map(function (p) { return p.courseId; });
    var inOpened = function (sid) { var x = K.skill[sid], t = x && K.task[x.taskId]; return !!t && opened.indexOf(t.courseId) >= 0; };
    var STD = stdCompute(S, plans, ev, pid);
    var sup = {};
    Object.keys(K.map).forEach(function (sid) { if (inOpened(sid)) K.map[sid].forEach(function (m) { (sup[m.abl] = sup[m.abl] || []).push({ sid: sid, type: m.type }); }); });
    var G = (root.ASSESS_DATA || {}).graph || { abilities: [] }, ABL = {};
    G.abilities.forEach(function (a) { ABL[a.id] = a; });
    var abilities = Object.keys(sup).map(function (id) {
      var sk = sup[id], withEv = sk.filter(function (x) { return bySkill[x.sid]; });
      var pr = withEv.reduce(function (a, x) { return a.concat(bySkill[x.sid]); }, []), no = pr.filter(function (e) { return e.grade === '需改进'; }).length;
      return { id: id, a: ABL[id] || K.abl[id], name: (ABL[id] || K.abl[id] || {}).name || id, sk: sk, withEv: withEv, pairs: pr.length, ok: pr.length - no, no: no, sOk: (STD.byAbl[id] || {}).ok || 0, sDen: (STD.byAbl[id] || {}).den || 0 };
    }).filter(function (r) { return r.withEv.length; }).sort(function (a, b) { return b.no - a.no || b.pairs - a.pairs; });
    var no = ev.filter(function (e) { return e.grade === '需改进'; }).length;
    var excellent = ev.filter(function (e) { return e.grade === '优秀'; }).length;
    var pass = ev.filter(function (e) { return e.grade === '合格'; }).length;
    // 按任课教师汇总：证据口径（评价对数 / 达成 / 优秀率）+ 标准口径（该教师课程的 std 并集）
    var byTeacher = {};
    ev.forEach(function (e) {
      var tn = (pid[e.planId] && pid[e.planId].teacher) || '—';
      var b = byTeacher[tn] = byTeacher[tn] || { pairs: 0, ok: 0, no: 0, excellent: 0, pass: 0 };
      b.pairs++; if (e.grade === '需改进') b.no++; else { b.ok++; if (e.grade === '优秀') b.excellent++; else b.pass++; }
    });
    Object.keys(byTeacher).forEach(function (tn) {
      var stdOk = 0, stdDen = 0, courses = 0;
      plans.forEach(function (p) { if ((p.teacher || '—') === tn) { courses++; var sb = STD.byPlan[p.id]; if (sb) { stdOk += sb.ok; stdDen += sb.den; } } });
      var b = byTeacher[tn];
      b.courses = courses; b.stdOk = stdOk; b.stdDen = stdDen;
      b.rate = rate(b.ok, b.pairs); b.excellentRate = rate(b.excellent, b.pairs); b.stdRate = rate(stdOk, stdDen);
    });
    // 技能考核覆盖度：已评价标准技能数 / 标准技能总数（未关联体系的课程不计入标准集）
    var stdSkillSet = {};
    Object.keys(STD.planStd || {}).forEach(function (pid2) { Object.keys(STD.planStd[pid2].set).forEach(function (sid) { stdSkillSet[sid] = 1; }); });
    var stdSkills = Object.keys(stdSkillSet).length;
    var stdCovered = Object.keys(bySkill).filter(function (sid) { return stdSkillSet[sid]; }).length;
    return { K: K, pairs: ev.length, ok: ev.length - no, no: no, excellent: excellent, pass: pass, bySkill: bySkill, byPlan: byPlan, std: STD.tot, stdByPlan: STD.byPlan, stdStu: STD.byStu, stdSplit: STD.split, byTeacher: byTeacher, stdSkills: stdSkills, stdCovered: stdCovered,
      students: Object.keys(ev.reduce(function (a, e) { a[e.student] = 1; return a; }, {})).length,
      skills: Object.keys(bySkill).length, abilities: abilities };
  }
  function rate(ok, n) { return n ? Math.round(ok * 100 / n) : null; }
  /* 教学达成率口径（2026-11-25 用户拍板：技能、知识点统一为「已达成人次 / 已提交且已评价人次」，标准与拓展都计入）：
   *   - 分母 = 范围内全部已评价的「学生 × 技能」对数（证据由老师评价产生，评价前提是学生已提交，
   *     未提交 / 超时未交的学生天然没有证据、不计入分母）；分子 = 其中「优秀 / 合格」的对数；「需改进」= 未达成；
   *   - 不再限定课程标准技能集合：老师拓展教的技能一并计入分子分母；未关联知识体系的课程计划同样计入；
   *   - stdRows / planStd.set 仍保留课程标准技能集合（用于技能考核覆盖度 stdSkills / stdCovered，不参与达成率分母；
   *     同时用于达成率的「标准 / 拓展」拆分 split：证据技能 ∈ 该计划标准集 → 标准，否则 → 拓展，两桶之和 = 整体）。
   * stdRows：课程标准技能集合 = 当前知识体系任务树技能 ∪ 已发布任务快照技能（换体系后历史评价不丢）。 */
  function stdRows(S, p, K) {
    var out = [], seen = {};
    if (root.TK.planTasks) root.TK.planTasks(S, p).forEach(function (t) { (t.skills || []).forEach(function (x) { if (x && x.id && !seen[x.id]) { seen[x.id] = 1; out.push(x.id); } }); });
    S.courses.forEach(function (c) { if (c.planId !== p.id) return; root.TK.pubsOf(c).forEach(function (pub) { if (pub && pub.task) (pub.task.skillIds || []).forEach(function (sid) { if (K.skill[sid] && !seen[sid]) { seen[sid] = 1; out.push(sid); } }); }); });   // 一课次多次发布：历史任务的技能并入标准集合
    return out;
  }
  function stdCompute(S, plans, ev, pid) {
    var K = root.TK.kn(), planStd = {}, byPlan = {}, byStu = {}, byAbl = {}, splitStd = {};
    var split = { std: { ok: 0, den: 0 }, ext: { ok: 0, den: 0 } };   // 达成率拆分：标准 = 证据技能 ∈ 该计划知识体系标准技能集（与 teachScope「教学拓展」口径一致）；拓展 = 集外（未关联知识体系课程的证据全部计入拓展）；两桶之和 = 整体。
    /* 注意：拆分刻意不用 stdRows（知识体系 ∪ 已发布快照）——若发布快照算标准，老师发布的任何内容都不可能成为拓展，
       「拓展达成率」与「教学拓展」卡 / 列表必然对不上（2026-11-25 统一口径）。发布快照仍进 planStd.set，仅用于覆盖度。 */
    plans.forEach(function (p) {
      if (!pid[p.id]) return;
      var set = {};
      if (root.TK.planKind && root.TK.planKind(S, p) === 'linked') stdRows(S, p, K).forEach(function (sid) { set[sid] = 1; });   // 仅覆盖度用
      planStd[p.id] = { set: set, stus: 0 };
      splitStd[p.id] = {};   // 拆分用标准集 = 知识体系标准技能（与 teachScope 的 stdSk 同源）
      Object.keys(root.TK.stdSkillMap(S, p)).forEach(function (sid) { splitStd[p.id][sid] = 1; });
      byPlan[p.id] = { ok: 0, no: 0, den: 0, rate: null };
    });
    var sidAbl = {};
    Object.keys(K.map || {}).forEach(function (sid) { (K.map[sid] || []).forEach(function (m) { (sidAbl[sid] = sidAbl[sid] || {})[m.abl] = 1; }); });
    ev.forEach(function (e) {
      var ps = planStd[e.planId]; if (!ps) return;
      var ok = e.grade !== '需改进';
      var b = byPlan[e.planId]; b.den++; b[ok ? 'ok' : 'no']++;   // 分母 = 已评价对数（已提交且已评价，标准与拓展都算）
      var sp = split[(splitStd[e.planId] || {})[e.sid] ? 'std' : 'ext']; sp.den++; if (ok) sp.ok++;
      var st = byStu[e.student] = byStu[e.student] || { ok: 0, den: 0 };
      if (ok) st.ok++; st.den++;
      Object.keys(sidAbl[e.sid] || {}).forEach(function (aid) { var a = byAbl[aid] = byAbl[aid] || { ok: 0, den: 0 }; a.den++; if (ok) a.ok++; });
    });
    var tot = { ok: 0, den: 0 };
    Object.keys(byPlan).forEach(function (id) { var b = byPlan[id]; b.rate = rate(b.ok, b.den); tot.ok += b.ok; tot.den += b.den; });
    Object.keys(byStu).forEach(function (n2) { byStu[n2].rate = rate(byStu[n2].ok, byStu[n2].den); });
    Object.keys(byAbl).forEach(function (id) { byAbl[id].rate = rate(byAbl[id].ok, byAbl[id].den); });
    tot.rate = rate(tot.ok, tot.den);
    split.std.rate = rate(split.std.ok, split.std.den); split.ext.rate = rate(split.ext.ok, split.ext.den);
    return { tot: tot, byPlan: byPlan, byStu: byStu, byAbl: byAbl, planStd: planStd, split: split };
  }
  /* 知识点掌握（两维独立，2026-11-19）：知识点不按技能分组，按知识点维度平铺统计——
     每个学生取范围内最近一次老师确认的评价（含退回），看发布时勾选的考查知识点是否体现；
     asOf / from：只算这个时间段内的评价（用于趋势和周期统计）。返回 {plans, groups, rows, noEv}；不计入证据、不汇总到能力 */
  function kpsAgg(S, plans, asOf, from) {
    var TK = root.TK, byKp = {}, order = [], stuLast = {}, tdate = function (x) { return new Date(String(x).replace(' ', 'T')); };
    var stdKpSet = {};   // 标准知识点集 = 各计划关联知识体系全集（courseKps）；集外考查知识点 = 拓展（未关联体系课程全部计入拓展，与 teachScope 口径一致）；两桶之和 = 整体
    plans.forEach(function (p) { TK.courseKps(S, p).forEach(function (k) { stdKpSet[k.id] = 1; }); });
    plans.forEach(function (p) {
      S.courses.filter(function (c) { return c.planId === p.id; }).forEach(function (c) {
        var pubs = TK.pubsOf(c).filter(function (pp) { return pp && pp.task && pp.task.on; });   // 一课次多次发布：按全部发布任务统计知识点
        pubs.forEach(function (pp) {
          var t = pp.task, kpIds = (t.kpIds && t.kpIds.length) ? t.kpIds : null;
          TK.taskKps(t).forEach(function (k) {
            if (kpIds && kpIds.indexOf(k.id) < 0) return;
            var g = byKp[k.id];
            if (!g) { g = byKp[k.id] = { k: k, courses: {}, cnt: { ok: 0, miss: 0, who: [] } }; order.push(g); }
            g.courses[c.id] = 1;
          });
        });
        var taskOf = function (sb) { var hit = pubs.filter(function (pp) { return pp.id === sb.taskId; })[0]; return hit ? hit.task : (pubs.length ? pubs[pubs.length - 1].task : null); };
        (c.submissions || []).forEach(function (sb) {
          if (!sb.teacher) return;
          var t = taskOf(sb); if (!t) return;
          if (asOf && !(tdate(sb.teacher.at) < asOf)) return;
          if (from && !(tdate(sb.teacher.at) >= from)) return;
          if (!stuLast[sb.student] || sb.teacher.at >= stuLast[sb.student].at) stuLast[sb.student] = { at: sb.teacher.at, marks: TK.kpMarksOf(sb, t, null) };
        });
      });
    });
    var byStu = {};   // 按学生聚合：分母 = 该生最近一次评价中考查的知识点数（ok/miss 才计入），分子 = 其中 ok 数——与 kpRate 同口径，仅分组维度不同
    Object.keys(stuLast).forEach(function (st) {
      var s2 = byStu[st] = { ok: 0, den: 0 };
      order.forEach(function (g) {
        var v = stuLast[st].marks[g.k.id];
        if (v === 'miss') { g.cnt.miss++; g.cnt.who.push(st); s2.den++; }
        else if (v === 'ok') { g.cnt.ok++; s2.ok++; s2.den++; }   // 最近一次评价未考查的（发布时未勾选）不计入
      });
      s2.rate = rate(s2.ok, s2.den);
    });
    var rows = order.map(function (g) { return { k: g.k, c: g.cnt, courses: g.courses }; });
    rows.sort(function (a, b) { return b.c.miss - a.c.miss || a.c.ok - b.c.ok; });
    var split = { std: { ok: 0, den: 0 }, ext: { ok: 0, den: 0 } };   // 标准 / 拓展拆分（按知识点归属；计数口径与 rows 相同 = 最近一次评价中考查且标注的对）
    order.forEach(function (g) { var b = split[stdKpSet[g.k.id] ? 'std' : 'ext']; b.ok += g.cnt.ok; b.den += g.cnt.ok + g.cnt.miss; });
    split.std.rate = rate(split.std.ok, split.std.den); split.ext.rate = rate(split.ext.ok, split.ext.den);
    /* groups 保留为空数组（旧消费方兼容）：两维独立后不再按技能/任务分组展示 */
    return { plans: plans, groups: [], rows: rows, noEv: order.filter(function (g) { return !(g.cnt.ok + g.cnt.miss); }), stu: byStu, split: split };
  }
  function kpRate(A) { var t = 0, o = 0; A.rows.forEach(function (r) { t += r.c.ok + r.c.miss; o += r.c.ok; }); return { t: t, o: o, r: rate(o, t) }; }
  /* 学生参与度 + AI 一致性（提交级，两维同源 submissions）：
   *   - 应提交 = 各已发布任务覆盖班级的学生数合计；提交率 = 已提交类 / 应提交；退回率 = 已退回 / 已提交类；超时未交率 = 超时未交 / 应提交；
   *   - AI 初评覆盖率 = 已提交类里有 ai.result 的比例；一致率 = 同时有 ai 初评与老师终评的提交里两者整体等级一致的比例；
   *     误判（漏判）率 = AI 判「需改进」但老师判「优秀」的比例（AI 偏严）。 */
  function submitStats(S, plans, range) {
    var pid = {}; plans.forEach(function (p) { pid[p.id] = 1; });
    var inR = function (s) { if (!range || !s) return true; var d = new Date(String(s).replace(' ', 'T')); return d >= range.a && d < range.b; };
    var total = 0, submitted = 0, returned = 0, overdue = 0, aiCovered = 0, aiTotal = 0, aiAgree = 0, aiFalseNeg = 0;
    S.courses.filter(function (c) { return pid[c.planId]; }).forEach(function (c) {
      root.TK.pubsOf(c).forEach(function (pub) {
        if (!pub || !pub.task || !pub.task.on) return;
        var p = plans.filter(function (x) { return x.id === c.planId; })[0] || {};
        var n = root.TK.planClassIds(S, p).reduce(function (a, id) { var cl = (S.classes || []).filter(function (x) { return x.id === id; })[0]; return a + ((cl && cl.students) || []).length; }, 0);
        total += n;
        (c.submissions || []).forEach(function (s) {
          if (s.taskId && s.taskId !== pub.id) return;
          if (!inR(s.at, range) && !inR(s.teacher && s.teacher.at, range)) return;   // 提交或评价至少其一落在范围内才计入
          if (s.status === '超时未交') { overdue++; return; }
          if (s.status === '未提交') return;
          submitted++; if (s.status === '已退回') returned++;
          if (s.ai && s.ai.result) aiCovered++;
          if (s.ai && s.ai.result && s.teacher && s.teacher.grade) {
            aiTotal++;
            if (s.ai.result === s.teacher.grade) aiAgree++;
            if (s.ai.result === '需改进' && s.teacher.grade === '优秀') aiFalseNeg++;
          }
        });
      });
    });
    return { total: total, submitted: submitted, submitRate: rate(submitted, total), returned: returned, returnRate: rate(returned, submitted), overdue: overdue, overdueRate: rate(overdue, total),
      aiCovered: aiCovered, aiCoverRate: rate(aiCovered, submitted), aiTotal: aiTotal, aiAgree: aiAgree, aiAgreeRate: rate(aiAgree, aiTotal), aiFalseNeg: aiFalseNeg };
  }
  /* 课程反馈满意度：已发布课次的反馈均分（满分 5）+ 反馈参与率（有反馈课次 / 已发布课次） */
  function feedbackStats(S, plans, range) {
    var pid = {}; plans.forEach(function (p) { pid[p.id] = 1; });
    var inR = function (s) { if (!range || !s) return true; var d = new Date(String(s).replace(' ', 'T')); return d >= range.a && d < range.b; };
    var published = S.courses.filter(function (c) { return pid[c.planId] && root.TK.pubsOf(c).length; });
    var scores = [], withFb = 0;
    published.forEach(function (c) {
      var fbs = (c.feedbacks || []).filter(function (f) { return inR(f.at, range); });
      if (!fbs.length) return;
      withFb++;
      fbs.forEach(function (f) {
        var v = f.scores ? (function () { var ks = Object.keys(f.scores); return ks.length ? ks.reduce(function (a, k) { return a + f.scores[k]; }, 0) / ks.length : (f.overall || 0); })() : (f.overall || 0);
        scores.push(v);
      });
    });
    return { avg: scores.length ? Math.round(scores.reduce(function (a, b) { return a + b; }, 0) / scores.length * 10) / 10 : null, withFb: withFb, published: published.length, partRate: rate(withFb, published.length), n: scores.length };
  }
  /* 教学覆盖与拓展（2026-11-24）：
   *   标准要求 = 课程关联知识体系（planTasks）的技能 / 知识点全集（stdSkillMap / courseKps）；
   *   老师已教 = 各课次已发布任务的技能 / 知识点（taskKps）；
   *   覆盖率 = 已教 ∩ 标准 / 标准；拓展 = 已教 − 标准（老师超出标准多教的内容）。 */
  function teachScope(S, plans) {
    var stdSk = {}, stdKp = {}, taughtSk = {}, taughtKp = {}, skWhere = {}, kpWhere = {};   // skWhere/kpWhere：id → [{planId, course, teacher}] 拓展归属（详情页列表用）
    plans.forEach(function (p) {
      Object.keys(root.TK.stdSkillMap(S, p)).forEach(function (id) { stdSk[id] = 1; });
      root.TK.courseKps(S, p).forEach(function (k) { stdKp[k.id] = 1; });
      S.courses.filter(function (c) { return c.planId === p.id; }).forEach(function (c) {
        root.TK.pubsOf(c).forEach(function (pub) {
          if (!pub || !pub.task) return;
          (pub.task.skillIds || []).forEach(function (sid) {
            if (!root.TK.kn().skill[sid]) return;
            taughtSk[sid] = 1;
            (skWhere[sid] = skWhere[sid] || []).push({ planId: p.id, course: p.course || c.name || '—', teacher: p.teacher || '—' });
          });
          root.TK.taskKps(pub.task).forEach(function (k) {
            taughtKp[k.id] = 1;
            (kpWhere[k.id] = kpWhere[k.id] || []).push({ planId: p.id, course: p.course || c.name || '—', teacher: p.teacher || '—' });
          });
        });
      });
    });
    var sIds = Object.keys(stdSk), kIds = Object.keys(stdKp);
    var tSIds = Object.keys(taughtSk), tKIds = Object.keys(taughtKp);
    var skCovered = sIds.filter(function (id) { return taughtSk[id]; }).length;
    var kpCovered = kIds.filter(function (id) { return taughtKp[id]; }).length;
    return {
      stdSk: sIds.length, stdKp: kIds.length, taughtSk: tSIds.length, taughtKp: tKIds.length,
      skCovered: skCovered, kpCovered: kpCovered,
      skCoverRate: rate(skCovered, sIds.length), kpCoverRate: rate(kpCovered, kIds.length),
      extSk: tSIds.filter(function (id) { return !stdSk[id]; }).length, extKp: tKIds.filter(function (id) { return !stdKp[id]; }).length,
      extSkIds: tSIds.filter(function (id) { return !stdSk[id]; }), extKpIds: tKIds.filter(function (id) { return !stdKp[id]; }),
      skWhere: skWhere, kpWhere: kpWhere,
      missSkIds: sIds.filter(function (id) { return !taughtSk[id]; }), missKpIds: kIds.filter(function (id) { return !taughtKp[id]; })
    };
  }
  root.TR = { compute: compute, rate: rate, kpsAgg: kpsAgg, kpRate: kpRate, submitStats: submitStats, feedbackStats: feedbackStats, teachScope: teachScope };
})(typeof window !== 'undefined' ? window : this);
