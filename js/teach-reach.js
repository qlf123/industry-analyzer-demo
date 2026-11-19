/* 教学达成计算（教学质量页、数据概览共用）
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
    return { K: K, pairs: ev.length, ok: ev.length - no, no: no, bySkill: bySkill, byPlan: byPlan, std: STD.tot, stdByPlan: STD.byPlan, stdStu: STD.byStu,
      students: Object.keys(ev.reduce(function (a, e) { a[e.student] = 1; return a; }, {})).length,
      skills: Object.keys(bySkill).length, abilities: abilities };
  }
  function rate(ok, n) { return n ? Math.round(ok * 100 / n) : null; }
  /* 标准达成率口径（管理端考核口径，未教的技能计入分母）：
   *   - 标准技能集合 = 当前知识体系任务树技能 ∪ 已发布任务快照技能（换体系后历史评价不丢）；
   *   - 分母 = 课程标准技能数 × 班级人数，全员同分母、跨班可比；老师的进度差异不进入达成率；
   *   - 只算已关联知识体系的课程计划，未关联课程不计入（避免把没有标准的课稀释进分母）。
   * 返回 { ok, den, rate, byPlan:{planId:{ok,no,den,rate}}, byStu:{name:{ok,den}} }；能力维度通过 abilities[].sOk/sDen 读取 */
  function stdRows(S, p, K) {
    var out = [], seen = {};
    if (root.TK.planTasks) root.TK.planTasks(S, p).forEach(function (t) { (t.skills || []).forEach(function (x) { if (x && x.id && !seen[x.id]) { seen[x.id] = 1; out.push(x.id); } }); });
    S.courses.forEach(function (c) { if (c.planId === p.id && c.publish && c.publish.task) (c.publish.task.skillIds || []).forEach(function (sid) { if (K.skill[sid] && !seen[sid]) { seen[sid] = 1; out.push(sid); } }); });
    return out;
  }
  function stdCompute(S, plans, ev, pid) {
    var K = root.TK.kn(), planStd = {}, byPlan = {}, byStu = {}, byAbl = {};
    plans.forEach(function (p) {
      if (!pid[p.id] || !root.TK.planKind || root.TK.planKind(S, p) !== 'linked') return;
      var sids = stdRows(S, p, K);
      var cl = (S.classes || []).filter(function (c) { return c.id === p.classId; })[0] || { students: [] };
      var n = (cl.students || []).length;
      planStd[p.id] = { set: {}, stus: n };
      sids.forEach(function (sid) { planStd[p.id].set[sid] = 1; });
      byPlan[p.id] = { ok: 0, no: 0, den: sids.length * n, rate: null };
    });
    var sidAbl = {};
    Object.keys(K.map || {}).forEach(function (sid) { (K.map[sid] || []).forEach(function (m) { (sidAbl[sid] = sidAbl[sid] || {})[m.abl] = 1; }); });
    Object.keys(planStd).forEach(function (pid2) {
      var ps = planStd[pid2];
      Object.keys(ps.set).forEach(function (sid) {
        Object.keys(sidAbl[sid] || {}).forEach(function (aid) { var a = byAbl[aid] = byAbl[aid] || { ok: 0, den: 0 }; a.den += ps.stus; });
      });
    });
    ev.forEach(function (e) {
      var ps = planStd[e.planId]; if (!ps || !ps.set[e.sid]) return;
      var ok = e.grade !== '需改进';
      (byPlan[e.planId] = byPlan[e.planId] || { ok: 0, no: 0, den: 0, rate: null })[ok ? 'ok' : 'no']++;
      var st = byStu[e.student] = byStu[e.student] || { ok: 0, den: 0 };
      if (ok) st.ok++; st.den++;
      Object.keys(sidAbl[e.sid] || {}).forEach(function (aid) { var a = byAbl[aid] = byAbl[aid] || { ok: 0, den: 0 }; if (ok) a.ok++; });
    });
    var tot = { ok: 0, den: 0 };
    Object.keys(byPlan).forEach(function (id) { var b = byPlan[id]; b.rate = rate(b.ok, b.den); tot.ok += b.ok; tot.den += b.den; });
    Object.keys(byStu).forEach(function (n2) { byStu[n2].rate = rate(byStu[n2].ok, byStu[n2].den); });
    Object.keys(byAbl).forEach(function (id) { byAbl[id].rate = rate(byAbl[id].ok, byAbl[id].den); });
    tot.rate = rate(tot.ok, tot.den);
    return { tot: tot, byPlan: byPlan, byStu: byStu, byAbl: byAbl, planStd: planStd };
  }
  /* 知识点掌握（两维独立，2026-11-19）：知识点不按技能分组，按知识点维度平铺统计——
     每个学生取范围内最近一次老师确认的评价（含退回），看发布时勾选的考查知识点是否体现；
     asOf / from：只算这个时间段内的评价（用于趋势和周期统计）。返回 {plans, groups, rows, noEv}；不计入证据、不汇总到能力 */
  function kpsAgg(S, plans, asOf, from) {
    var TK = root.TK, byKp = {}, order = [], stuLast = {}, tdate = function (x) { return new Date(String(x).replace(' ', 'T')); };
    plans.forEach(function (p) {
      S.courses.filter(function (c) { return c.planId === p.id && c.publish && c.publish.task && c.publish.task.on; }).forEach(function (c) {
        var t = c.publish.task, kpIds = (t.kpIds && t.kpIds.length) ? t.kpIds : null;
        TK.taskKps(t).forEach(function (k) {
          if (kpIds && kpIds.indexOf(k.id) < 0) return;
          var g = byKp[k.id];
          if (!g) { g = byKp[k.id] = { k: k, courses: {}, cnt: { ok: 0, miss: 0, who: [] } }; order.push(g); }
          g.courses[c.id] = 1;
        });
        (c.submissions || []).forEach(function (sb) {
          if (!sb.teacher) return;
          if (asOf && !(tdate(sb.teacher.at) < asOf)) return;
          if (from && !(tdate(sb.teacher.at) >= from)) return;
          if (!stuLast[sb.student] || sb.teacher.at >= stuLast[sb.student].at) stuLast[sb.student] = { at: sb.teacher.at, marks: TK.kpMarksOf(sb, t, null) };
        });
      });
    });
    Object.keys(stuLast).forEach(function (st) {
      order.forEach(function (g) {
        var v = stuLast[st].marks[g.k.id];
        if (v === 'miss') { g.cnt.miss++; g.cnt.who.push(st); }
        else if (v === 'ok') g.cnt.ok++;   // 最近一次评价未考查的（发布时未勾选）不计入
      });
    });
    var rows = order.map(function (g) { return { k: g.k, c: g.cnt, courses: g.courses }; });
    rows.sort(function (a, b) { return b.c.miss - a.c.miss || a.c.ok - b.c.ok; });
    /* groups 保留为空数组（旧消费方兼容）：两维独立后不再按技能/任务分组展示 */
    return { plans: plans, groups: [], rows: rows, noEv: order.filter(function (g) { return !(g.cnt.ok + g.cnt.miss); }) };
  }
  function kpRate(A) { var t = 0, o = 0; A.rows.forEach(function (r) { t += r.c.ok + r.c.miss; o += r.c.ok; }); return { t: t, o: o, r: rate(o, t) }; }
  root.TR = { compute: compute, rate: rate, kpsAgg: kpsAgg, kpRate: kpRate };
})(typeof window !== 'undefined' ? window : this);
