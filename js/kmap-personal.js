/* 能力地图 / 全景图谱共用：标准图谱 + 老师的个人补充 + 已发布的老师贡献
 * 标准图谱：KMAP_DATA（build_kmap.py 生成的 graph/kmap-data.js）
 * 个人补充（与能力地图同一份，存本机浏览器）：
 *   kmapManual.v1     人工新增 / 「…」里 AI 帮我生成的节点 {id, type: sub|pos|abl|skl|lf, parent, name, desc, kind?, ai?}
 *   kmapSkillGaps.v1  技能缺口检测加入的 AI 技能 added[能力项] = [{id, name, desc, children:[{id, kind, name}]}]
 *   kmapAiSaved.v2    AI 细分节点（已保存的）[{parent, kind, items:[{key, name, desc, manual?}]}]
 *   kmapJoined.v2     市场趋势加入的能力项（及新分支子行业 / 岗位）、它生成的技能
 * 已发布的老师贡献：GSuggest.published()（js/graph-suggest.js），节点编号与能力地图并入时一致
 * 用法：KP.build() → { nodes: {key: node}, kids: {key: [childKey]}, parents: {key: [parentKey]} }
 *   node = {key, type: ind|sub|pos|abl|skl|lf|ai, kind, name, desc, personal: null|{kind}, std: null|发布记录, ks?}
 */
(function (root) {
  'use strict';
  var TYPE_CN = { ind: '行业', sub: '子行业', pos: '岗位', abl: '能力项', skl: '技能' };
  function read(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }

  function build() {
    var D = root.KMAP_DATA; if (!D) return null;
    var nodes = {}, kids = {}, parents = {};
    function add(n) { if (!nodes[n.key]) { nodes[n.key] = n; kids[n.key] = []; parents[n.key] = []; } return nodes[n.key]; }
    function link(p, c) { if (!nodes[p] || !nodes[c]) return; if (kids[p].indexOf(c) < 0) kids[p].push(c); if (parents[c].indexOf(p) < 0) parents[c].push(p); }
    function node(key, type, name, o) { var n = { key: key, type: type, kind: null, name: name, desc: '', personal: null, std: null }; for (var k in o || {}) n[k] = o[k]; return add(n); }

    // 标准图谱
    var I = D.industry; node(I.id, 'ind', I.name);
    D.subIndustries.filter(function (s) { return s.built; }).forEach(function (s) { node(s.id, 'sub', s.name); link(I.id, s.id); });
    D.positions.forEach(function (p) { node(p.id, 'pos', p.name); link(p.sub, p.id); });
    D.abilities.forEach(function (a) { node(a.id, 'abl', a.name, { core: a.core }); });
    D.positions.forEach(function (p) { (p.abilities || []).forEach(function (r) { link(p.id, r.ability); }); });
    var snode = {}; D.skillNodes.forEach(function (n) { snode[n.id] = n; });
    D.skills.forEach(function (k) { node(k.id, 'skl', k.name, { ks: k.ks || null }); (k.children || []).forEach(function (c) { var s = snode[c]; if (!s) return; node(c, 'lf', s.name, { kind: s.kind, attrs: s.attrs || null }); link(k.id, c); }); });
    D.abilities.forEach(function (a) { (a.skills || []).forEach(function (sid) { link(a.id, sid); }); });

    // 已发布的老师贡献：先记下它们替换掉的个人节点
    var pub = root.GSuggest ? root.GSuggest.published() : [], replaced = {};
    pub.forEach(function (r) { if (r.ref && r.ref.key) replaced[r.ref.key] = 1; });
    function skip(key) { return !!replaced[key]; }

    // 市场趋势加入
    read('kmapJoined.v2', []).filter(Boolean).forEach(function (rec) {
      if (!rec.id || !rec.pid || skip(rec.id)) return;
      if (rec.kind === 'branch') {
        node(rec.subId, 'sub', rec.subName, { personal: { kind: 'joined' } }); link(I.id, rec.subId);
        node(rec.posId, 'pos', rec.posName, { personal: { kind: 'joined' } }); link(rec.subId, rec.posId);
      }
      node(rec.id, 'abl', rec.name, { desc: rec.desc || '', personal: { kind: 'joined' } }); link(rec.pid, rec.id);
      (rec.skills || []).forEach(function (sk) {
        if (!sk || !sk.name) return;
        node(sk.id, 'skl', sk.name, { desc: sk.desc || '', personal: { kind: 'joinedskill' } }); link(rec.id, sk.id);
        (sk.children || []).forEach(function (c) { if (c && c.name) { node(c.id, 'lf', c.name, { kind: c.kind, personal: { kind: 'aileaf' } }); link(sk.id, c.id); } });
      });
    });
    // 技能缺口检测加入的 AI 技能
    var gap = read('kmapSkillGaps.v1', { added: {} });
    Object.keys(gap.added || {}).forEach(function (aid) {
      (gap.added[aid] || []).forEach(function (sk) {
        if (!sk || !sk.name || skip(sk.id)) return;
        node(sk.id, 'skl', sk.name, { desc: sk.desc || '', personal: { kind: 'gapskill' } }); link(aid, sk.id);
        (sk.children || []).forEach(function (c) { if (c && c.name) { node(c.id, 'lf', c.name, { kind: c.kind, personal: { kind: 'aileaf' } }); link(sk.id, c.id); } });
      });
    });
    // 人工新增（按上级先后补齐）
    var man = (read('kmapManual.v1', { nodes: [] }).nodes || []).slice(), gone = {};
    for (var pass = 0; pass < 6 && man.length; pass++) {
      man = man.filter(function (m) {
        if (skip(m.id) || gone[m.parent]) { gone[m.id] = 1; return false; }
        if (!nodes[m.parent]) return true;
        node(m.id, m.type, m.name, { kind: m.kind || null, desc: m.desc || '', personal: { kind: 'manual', ai: !!m.ai } }); link(m.parent, m.id);
        return false;
      });
    }
    // AI 细分节点（上级可能是末级节点或另一个细分节点）
    var lvs = read('kmapAiSaved.v2', []).slice().sort(function (a, b) { return a.parent.split('/').length - b.parent.split('/').length; });
    lvs.forEach(function (lv) {
      (lv.items || []).forEach(function (it) {
        if (!nodes[lv.parent] || skip(it.key) || gone[lv.parent]) { gone[it.key] = 1; return; }
        node(it.key, 'ai', it.name, { kind: lv.kind, desc: it.desc || '', personal: { kind: 'ai', manual: !!it.manual } }); link(lv.parent, it.key);
      });
    });
    // 老师贡献（已发布）：编号规则与能力地图并入时一致
    pub.forEach(function (rec) {
      var ctr = { n: 0 };
      (function inject(t, pk) {
        if (!nodes[pk]) return;
        var name = (ctr.n === 0 && rec.review && rec.review.rename) || t.name, id = 'STD-' + rec.id + '-' + (ctr.n++);
        var key = t.type === 'ai' ? pk + '/s' + id.toLowerCase() : id;
        node(key, t.type, name, { kind: t.kind || null, desc: t.desc || '', std: rec }); link(pk, key);
        (t.children || []).forEach(function (c) { inject(c, key); });
      })(rec.tree, rec.parentKey);
    });
    return { nodes: nodes, kids: kids, parents: parents, industry: I };
  }

  function typeCn(n) { return n.kind || TYPE_CN[n.type] || ''; }
  // 归属链（沿第一个上级往上）：["行业：旅游行业", "子行业：…", …, "知识点：本节点"]
  function chain(M, key) { var out = [], k = key, guard = 0; while (k && guard++ < 20) { var n = M.nodes[k]; out.unshift(typeCn(n) + '：' + n.name); k = (M.parents[k] || [])[0]; } return out; }
  function isPersonal(M, key) { var n = M.nodes[key]; return !!(n && n.personal); }
  // 能单独提交：自己是个人节点，上级是标准节点（含已发布的老师贡献）
  function submittable(M, key) { var p = (M.parents[key] || [])[0]; return isPersonal(M, key) && !!p && !isPersonal(M, p); }
  function tree(M, key) { var n = M.nodes[key]; return { type: n.type, kind: n.kind || null, name: n.name, desc: n.desc || '', children: (M.kids[key] || []).map(function (c) { return tree(M, c); }) }; }
  function count(t) { return 1 + t.children.reduce(function (a, c) { return a + count(c); }, 0); }
  function target(M, key) {
    var n = M.nodes[key];
    if (['sub', 'pos', 'abl', 'skl'].indexOf(n.type) >= 0) return { target: '能力图谱', targetName: M.industry.name };
    var k = key, guard = 0; while (k && M.nodes[k].type !== 'skl' && guard++ < 20) k = (M.parents[k] || [])[0];
    var s = k && M.nodes[k];
    return { target: '知识体系', targetName: s && s.ks && s.ks[0] ? s.ks[0].name : '（所属技能未归入知识体系）' };
  }
  // 组装一条提交记录（与能力地图提交的字段一致）
  function suggestion(M, key, reason, by) {
    var n = M.nodes[key], p = (M.parents[key] || [])[0], t = tree(M, key), pn = M.nodes[p];
    var dup = (M.kids[p] || []).some(function (c) { return c !== key && !M.nodes[c].personal && M.nodes[c].name === n.name; });
    var ref = { kind: n.personal.kind, key: key };
    var tg = target(M, key);
    return { ref: ref, type: n.type, kind: n.kind || null, name: n.name, desc: n.desc || '', parentKey: p, parentType: pn.type, parentName: pn.name,
      chain: chain(M, key), tree: t, count: count(t), dup: dup, reason: reason, by: by, target: tg.target, targetName: tg.targetName };
  }
  // 我的补充：可单独提交的个人节点（连同下级）
  function mine(M) { return Object.keys(M.nodes).filter(function (k) { return submittable(M, k); }).map(function (k) { var t = tree(M, k); return { key: k, node: M.nodes[k], count: count(t), chain: chain(M, k), status: root.GSuggest ? root.GSuggest.byRef(k) : null }; }); }

  root.KP = { build: build, chain: chain, typeCn: typeCn, isPersonal: isPersonal, submittable: submittable, tree: tree, count: count, target: target, suggestion: suggestion, mine: mine };
})(typeof window !== 'undefined' ? window : this);
