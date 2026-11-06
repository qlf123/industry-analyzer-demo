/* 标准图谱建议（localStorage graphSuggest.v1）：能力地图里老师把个人节点「提交到标准图谱」，
 * 图谱中心「标准图谱建议」由管理员 / 专业负责人审核：采纳（可改名）/ 退回（写原因）；采纳的进入待发布，发布后全校可见。
 * 记录：{id, ref:{kind, key}, type, kind, name, desc, parentKey, parentType, chain[], target, targetName, tree, count, dup,
 *        reason, by, at, status: 待审核 | 已采纳 | 已退回 | 已发布, review:{by, at, note, rename}, publishedAt}
 *   ref.kind：manual（人工节点）/ gapskill（技能缺口加入的 AI 技能）/ ai（AI 细分节点）；tree：{type, kind, name, desc, children[]} */
(function (root) {
  'use strict';
  var KEY = 'graphSuggest.v1';
  function list() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } }
  function save(l) { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch (e) {} }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function now() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function add(rec) {
    var l = list().filter(function (x) { return !(x.ref.key === rec.ref.key && (x.status === '已退回')); });   // 退回后重新提交，替换旧记录
    rec.id = 'SG' + Date.now().toString(36); rec.at = now(); rec.status = '待审核';
    l.unshift(rec); save(l); return rec;
  }
  function update(id, patch) { var l = list(); l.forEach(function (x) { if (x.id === id) Object.assign(x, patch); }); save(l); }
  function remove(id) { save(list().filter(function (x) { return x.id !== id; })); }
  // 某个个人节点的最近一条提交（不含已发布）
  function byRef(key) { return list().filter(function (x) { return x.ref.key === key && x.status !== '已发布'; })[0] || null; }
  function published() { return list().filter(function (x) { return x.status === '已发布'; }); }
  root.GSuggest = { KEY: KEY, list: list, save: save, add: add, update: update, remove: remove, byRef: byRef, published: published, now: now };
})(typeof window !== 'undefined' ? window : this);
