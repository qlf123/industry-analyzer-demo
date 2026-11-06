/* 图谱中心 · 业务流程衔接
 * 把各页面串起来：新建的能力图谱 / 知识体系 → 映射任务可选 → 任务完成生成候选映射 → 映射审核结果保存 → 全景图谱显示已确认映射。
 * 数据都放在本标签页的 sessionStorage（与原平台各页面一致），关闭标签页即恢复初始状态。
 */
window.GCF = (function () {
  'use strict';
  var K_GRAPHS = 'ability_graphs_v3', K_KS = 'ks_systems_v2', K_CANDS = 'gc_map_cands', K_REVIEW = 'gc_map_review';

  function read(k, d) { try { var v = JSON.parse(sessionStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function write(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  /* 已构建完成、带有图谱树的能力图谱 / 知识体系（页面里新建的） */
  function graphs() { return read(K_GRAPHS, []).filter(function (g) { return g.buildStatus === 'built' && g.tree; }); }
  function systems() { return read(K_KS, []).filter(function (s) { return s.buildStatus === 'built' && s.tree; }); }
  function graphLabel(g) { return g.name + ' 能力图谱'; }
  function systemLabel(s) { return s.name; }

  /* 能力图谱里的能力项 */
  function abilitiesOf(g) {
    var out = [];
    (function walk(n) {
      if (!n || typeof n !== 'object') return;
      (n.abilities || []).forEach(function (a) { out.push(a); });
      ['subIndustries', 'positions', 'children'].forEach(function (k) { (n[k] || []).forEach(walk); });
    }(g.tree));
    return out;
  }
  /* 知识体系里可映射的节点（技能 / 知识点 / 流程 / 标准 / 案例）及所在课程 */
  var KS_TYPE = { skill: '技能规范', knowledge: '知识点', process: '操作流程', standard: '标准', criterion: '标准', case: '案例' };
  var RELATION = {
    '技能规范': ['direct_support', '直接支撑'], '知识点': ['foundation_support', '基础支撑'], '操作流程': ['partial_support', '部分支撑'],
    '标准': ['assessment_basis', '提供达标判据'], '案例': ['scenario_support', '情境案例']
  };
  function sourcesOf(s) {
    var out = [];
    (function walk(n, course) {
      if (!n) return;
      if (n.type === 'course') course = n.name;
      if (KS_TYPE[n.type]) out.push({ name: n.name, type: KS_TYPE[n.type], course: course || s.relObject || s.name });
      (n.children || []).forEach(function (c) { walk(c, course); });
    }(s.tree, ''));
    return out;
  }

  /* 没有图谱树的预置图谱 / 体系：按名称给出几条可审核的候选 */
  var PRESET_SOURCES = [
    { name: '服务流程与接待规范', type: '技能规范' }, { name: '客户沟通与投诉处理', type: '技能规范' },
    { name: '行业法规与安全常识', type: '知识点' }, { name: '典型服务场景处置', type: '案例' }
  ];
  var PRESET_ABILITIES = [{ name: '对客服务与沟通', requiredLevel: 'L2' }, { name: '现场问题处置', requiredLevel: 'L2' }];

  /* 任务完成：能力项 × 知识体系节点生成候选映射（待审核） */
  function genCands(task) {
    var g = graphs().find(function (x) { return graphLabel(x) === task.graph; });
    var abls = g ? abilitiesOf(g) : PRESET_ABILITIES;
    if (!abls.length) abls = PRESET_ABILITIES;
    var list = [], seq = 0;
    (task.majors || []).forEach(function (m) {
      var ksName = typeof m === 'string' ? m : m.name;
      var s = systems().find(function (x) { return systemLabel(x) === ksName; });
      var srcs = s ? sourcesOf(s) : PRESET_SOURCES.map(function (p) { return { name: p.name, type: p.type, course: ksName }; });
      srcs.forEach(function (src, i) {
        var a = abls[i % abls.length], rel = RELATION[src.type] || ['related', '相关但不构成覆盖'];
        var conf = Math.round((0.96 - (i % 5) * 0.05) * 100) / 100;
        seq++;
        list.push({
          id: 'MAP-' + task.id + '-' + seq, taskId: task.id,
          sourceType: src.type, sourceId: (src.type === '知识点' ? 'KNP-' : src.type === '案例' ? 'CAS-' : 'SKS-') + task.id.replace(/\D/g, '') + seq,
          sourceName: src.name, sourceText: '',
          targetId: 'ABL-' + task.id.replace(/\D/g, '') + (i % abls.length + 1), targetName: a.name,
          course: src.course, relation: rel[0], relationLabel: rel[1], level: a.requiredLevel || 'L2', confidence: conf,
          evidence: '「' + src.name + '」与能力项「' + a.name + '」的' + (a.requiredLevel || 'L2') + ' 要求对应（映射任务「' + task.name + '」生成）。',
          ks: ksName, ag: task.graph, status: 'pending'
        });
      });
    });
    return list;
  }
  function addCands(list) {
    var ids = list.map(function (r) { return r.id; });
    write(K_CANDS, read(K_CANDS, []).filter(function (r) { return ids.indexOf(r.id) < 0; }).concat(list));
  }
  function cands() { return read(K_CANDS, []); }

  /* 映射审核结果：{ 记录id: {status, comment, rejectReason, reviewer, reviewedAt} } */
  function reviews() { return read(K_REVIEW, {}); }
  function saveReviews(records) {
    var m = {};
    records.forEach(function (r) {
      if (r.status !== 'pending') m[r.id] = { status: r.status, comment: r.comment || '', rejectReason: r.rejectReason || '', reviewer: r.reviewer || '', reviewedAt: r.reviewedAt || '',
        sourceType: r.sourceType, sourceName: r.sourceName, targetName: r.targetName, relationLabel: r.relationLabel, ks: r.ks, ag: r.ag };
    });
    write(K_REVIEW, m);
  }
  /* 全部已确认的映射（审核台预置 + 任务生成），供全景图谱显示 */
  function approved() {
    var rv = reviews();
    return Object.keys(rv).filter(function (id) { return rv[id].status === 'approved'; }).map(function (id) { return rv[id]; });
  }

  return {
    graphs: graphs, systems: systems, graphLabel: graphLabel, systemLabel: systemLabel,
    genCands: genCands, addCands: addCands, cands: cands,
    reviews: reviews, saveReviews: saveReviews, approved: approved
  };
}());
