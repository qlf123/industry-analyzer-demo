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
    var sup = {};
    Object.keys(K.map).forEach(function (sid) { if (inOpened(sid)) K.map[sid].forEach(function (m) { (sup[m.abl] = sup[m.abl] || []).push({ sid: sid, type: m.type }); }); });
    var G = (root.ASSESS_DATA || {}).graph || { abilities: [] }, ABL = {};
    G.abilities.forEach(function (a) { ABL[a.id] = a; });
    var abilities = Object.keys(sup).map(function (id) {
      var sk = sup[id], withEv = sk.filter(function (x) { return bySkill[x.sid]; });
      var pr = withEv.reduce(function (a, x) { return a.concat(bySkill[x.sid]); }, []), no = pr.filter(function (e) { return e.grade === '需改进'; }).length;
      return { id: id, a: ABL[id] || K.abl[id], name: (ABL[id] || K.abl[id] || {}).name || id, sk: sk, withEv: withEv, pairs: pr.length, ok: pr.length - no, no: no };
    }).filter(function (r) { return r.withEv.length; }).sort(function (a, b) { return b.no - a.no || b.pairs - a.pairs; });
    var no = ev.filter(function (e) { return e.grade === '需改进'; }).length;
    return { K: K, pairs: ev.length, ok: ev.length - no, no: no, bySkill: bySkill, byPlan: byPlan,
      students: Object.keys(ev.reduce(function (a, e) { a[e.student] = 1; return a; }, {})).length,
      skills: Object.keys(bySkill).length, abilities: abilities };
  }
  function rate(ok, n) { return n ? Math.round(ok * 100 / n) : null; }
  root.TR = { compute: compute, rate: rate };
})(typeof window !== 'undefined' ? window : this);
