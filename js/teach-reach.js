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
  /* 标准达成率口径（与教师端学情一致）：
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
  /* 知识点掌握（与教师端学情同口径）：每个学生取某技能最近一次老师确认的评价（含退回），只看发布时勾选的考查知识点；
     asOf / from：只算这个时间段内的评价（用于趋势和周期统计）。返回 {plans, groups, rows, noEv}；不计入证据、不汇总到能力 */
  function kpsAgg(S, plans, asOf, from) {
    var TK = root.TK, bySid = {}, order = [], tdate = function (x) { return new Date(String(x).replace(' ', 'T')); };
    plans.forEach(function (p) {
      S.courses.filter(function (c) { return c.planId === p.id && c.publish && c.publish.task && c.publish.task.on; }).forEach(function (c) {
        var t = c.publish.task, kpIds = (t.kpIds && t.kpIds.length) ? t.kpIds : null;
        (((t || {}).criteria) || []).forEach(function (x) {
          var sid = x.sid; if (!sid) return;
          var g = bySid[sid];
          if (!g) { g = bySid[sid] = { sid: sid, name: TK.skillName(sid), courses: {}, kps: [], allow: null, last: {} }; order.push(g); }
          g.courses[c.id] = 1;
          TK.taskKps(t, sid).forEach(function (k) { if (!g.kps.some(function (y) { return y.id === k.id; })) g.kps.push(k); });   // 发布时的知识点快照并集
          if (kpIds) { g.allow = g.allow || []; kpIds.forEach(function (id) { if (g.allow.indexOf(id) < 0) g.allow.push(id); }); }
          (c.submissions || []).forEach(function (sb) {
            var it = sb.teacher && (sb.teacher.items || []).filter(function (y) { return y.sid === sid; })[0];
            if (it && (!asOf || tdate(sb.teacher.at) < asOf) && (!from || tdate(sb.teacher.at) >= from) && (!g.last[sb.student] || sb.teacher.at >= g.last[sb.student].at)) g.last[sb.student] = { at: sb.teacher.at, marks: TK.itemKps(it, sb.student, kpIds, t) };
          });
        });
      });
    });
    order.forEach(function (g) {
      if (g.allow) g.kps = g.kps.filter(function (k) { return g.allow.indexOf(k.id) >= 0; });
      g.stus = Object.keys(g.last).length; g.cnt = {}; g.ok = 0; g.miss = 0;
      g.kps.forEach(function (k) {
        var c = { ok: 0, miss: 0, who: [] };
        Object.keys(g.last).forEach(function (st) {
          if (g.last[st].marks[k.id] === 'miss') { c.miss++; c.who.push(st); }
          else if (g.last[st].marks[k.id] === 'ok') c.ok++;   // 最近一次评价未考查的（发布时未勾选）不计入
        });
        g.cnt[k.id] = c; g.ok += c.ok; g.miss += c.miss;
      });
    });
    var groups = order.filter(function (g) { return g.kps.length && g.stus; });
    var rows = [];
    groups.forEach(function (g) { g.kps.forEach(function (k) { rows.push({ g: g, k: k, c: g.cnt[k.id] }); }); });
    rows.sort(function (a, b) { return b.c.miss - a.c.miss || a.c.ok - b.c.ok; });
    return { plans: plans, groups: groups, rows: rows, noEv: order.filter(function (g) { return g.kps.length && !g.stus; }) };
  }
  function kpRate(A) { var t = 0, o = 0; A.rows.forEach(function (r) { t += r.c.ok + r.c.miss; o += r.c.ok; }); return { t: t, o: o, r: rate(o, t) }; }
  root.TR = { compute: compute, rate: rate, kpsAgg: kpsAgg, kpRate: kpRate };
})(typeof window !== 'undefined' ? window : this);
