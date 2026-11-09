/* 全景图谱 · 能力地图同源数据 + 我的补充
 * - buildData()：用能力地图同一份图谱（KMAP_DATA）生成全景图谱节点 / 关系，叠加老师在能力地图里的个人补充（标「我的补充」）
 *   和已发布的老师贡献（标「贡献 · 某老师」）。岗位 → 能力项（包含）、能力项 → 技能（能力映射）、课程 → 任务 → 技能 → 知识点等（包含）、
 *   末级节点 → AI 细分（包含，类型「细化知识点」）。
 * - 「我的补充」面板：列出可提交的个人节点（连同下级），提交到标准图谱 / 撤回 / 重新提交；审核在「标准图谱建议」。
 */
(function (root) {
  'use strict';
  var MAJOR = '导游';
  var M = null, view = null;
  var PT = { pos: '岗位', abl: '能力项', skl: '技能', ai: '细化知识点' };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function me() { try { return root.GC ? GC.me() : ''; } catch (e) { return ''; } }

  function buildData() {
    M = KP.build(); if (!M) return null;
    var nodes = [], links = [], idOf = {};
    function add(key, type, name, extra) {
      if (idOf[key] != null) return nodes[idOf[key]];
      var n = { id: nodes.length, key: key, name: name, type: type, src: extra.src, majors: [MAJOR], major: MAJOR, industry: '旅游' };
      for (var k in extra) n[k] = extra[k];
      nodes.push(n); idOf[key] = n.id; return n;
    }
    function link(a, b, kind) { if (a != null && b != null && !links.some(function (l) { return l.source === a && l.target === b; })) links.push({ source: a, target: b, kind: kind || 'contain' }); }
    Object.keys(M.nodes).forEach(function (k) {
      var n = M.nodes[k]; if (n.type === 'ind' || n.type === 'sub') return;
      add(k, n.type === 'lf' ? n.kind : PT[n.type], n.name, { src: n.type === 'pos' || n.type === 'abl' ? 'ag' : n.type === 'ai' ? 'self' : 'ks',
        mine: !!n.personal, contrib: n.std ? n.std.by : '', desc: n.desc || '', attrs: n.attrs || null });
    });
    Object.keys(M.kids).forEach(function (p) {
      var pn = M.nodes[p];
      M.kids[p].forEach(function (c) {
        var cn = M.nodes[c];
        if (pn.type === 'ind' || pn.type === 'sub') return;
        link(idOf[p], idOf[c], pn.type === 'abl' && cn.type === 'skl' ? 'map' : 'contain');
      });
    });
    // 知识体系侧：课程 → 任务 → 技能
    Object.keys(M.nodes).forEach(function (k) {
      var n = M.nodes[k]; if (n.type !== 'skl' || !n.ks) return;
      var c = n.ks.filter(function (x) { return x.type === '课程'; })[0], t = n.ks.filter(function (x) { return x.type === '任务'; })[0];
      if (!c || !t) return;
      var cn = add(c.id, '课程', c.name, { src: 'ks' }), tn = add(t.id, '任务', t.name, { src: 'ks' });
      link(cn.id, tn.id); link(tn.id, idOf[k]);
    });
    // 资源：不是节点，挂在节点上的记录（实时生效、不进全景版本）。按真实存在的节点动态挂载，
    // 挂不到的（技能没有上级任务等）自动跳过，保证「找资源 / 资源角标 / 显示资源」都有内容。
    var res = [];
    function parentsOf(id) { return links.filter(function (l) { return l.target === id; }).map(function (l) { return l.source; }); }
    function taskOf(n) { return parentsOf(n.id).map(function (i) { return nodes[i]; }).filter(function (p) { return p.type === '任务'; })[0] || null; }
    function ablOf(n) { return links.filter(function (l) { return l.kind === 'map' && l.target === n.id; }).map(function (l) { return nodes[l.source]; })[0] || null; }
    function mount(r, n, loc) { if (!n) return; r.mounts.push({ node: n.id, loc: loc || '' }); (n.res = n.res || []).push({ r: r, loc: loc || '' }); }
    function mkRes(name, kind, by) { var r = { id: res.length, name: name, kind: kind, by: by, mounts: [] }; res.push(r); return r; }
    nodes.filter(function (n) { return n.type === '技能'; }).slice(0, 6).forEach(function (s, i) {
      var t = taskOf(s), a = ablOf(s);
      mount(mkRes(s.name + ' 单元课件.pptx', '课件', '生成时自动挂载'), t, i % 2 ? '' : '第 1–12 页');
      mount(mkRes(s.name + ' 教案.docx', '教案', '手动'), a, '');
      if (i < 3) mount(mkRes(s.name + ' 实训视频.mp4', '教学视频', '手动'), s, '00:00–0' + (8 + i) + ':20');
    });
    nodes.filter(function (n) { return n.type === '知识点'; }).slice(0, 5).forEach(function (k, i) {
      mount(mkRes(k.name + ' 资料汇编.pdf', '知识库资料', 'AI 建议后确认'), k, i % 2 ? '第 2 段' : '第 1–4 段');
      if (i < 2) mount(mkRes(k.name + ' 配套题组', '题目', '手动'), k, '');
    });
    // 没挂上任何节点的资源不保留（避免「挂在 0 个节点」的死资源）
    for (var ri = res.length - 1; ri >= 0; ri--) if (!res[ri].mounts.length) res.splice(ri, 1);
    res.forEach(function (r, i) { r.id = i; });
    return { nodes: nodes, links: links, res: res };
  }

  /* ── 我的补充 ── */
  var CSS = '.pm-btn b{font-weight:600;margin-left:4px}' +
    '.pm-panel{position:fixed;top:0;right:0;bottom:0;width:min(460px,96vw);background:#fff;z-index:90;box-shadow:-8px 0 30px rgba(20,30,60,.15);display:flex;flex-direction:column;font-size:13px;color:#31425e}' +
    '.pm-panel .h{display:flex;align-items:center;gap:8px;padding:16px 18px;border-bottom:1px solid #e7ebf2}.pm-panel .h b{font-size:15px}.pm-panel .h .sp{flex:1}' +
    '.pm-panel .x{border:0;background:none;font-size:16px;cursor:pointer;color:#8b99ac}' +
    '.pm-panel .tip{padding:10px 18px;color:#6b7a90;font-size:12px;line-height:1.7;background:#f8fafc;border-bottom:1px solid #eef1f6}' +
    '.pm-panel .bd{flex:1;overflow:auto;padding:6px 0}' +
    '.pm-it{padding:12px 18px;border-bottom:1px solid #f0f2f6}.pm-it .n{font-weight:600;cursor:pointer}.pm-it .n:hover{color:#5149e9}' +
    '.pm-it .m{font-size:12px;color:#8b99ac;margin-top:3px}.pm-it .a{margin-top:6px;display:flex;gap:12px;align-items:center}' +
    '.pm-lk{border:0;background:none;color:#5149e9;cursor:pointer;font:inherit;font-size:12.5px;padding:0}.pm-lk:hover{text-decoration:underline}' +
    '.pm-st{font-size:11px;border-radius:5px;padding:1px 7px;background:#eef2ff;color:#4338ca}.pm-st.ok{background:#ecfdf5;color:#047857}.pm-st.rej{background:#fef2f2;color:#b91c1c}.pm-st.no{background:#f1f5f9;color:#64748b}' +
    '.pm-empty{padding:40px 18px;text-align:center;color:#8b99ac;font-size:12.5px;line-height:1.8}' +
    '.pm-mask{position:fixed;inset:0;background:rgba(20,30,60,.35);z-index:95;display:grid;place-items:center}' +
    '.pm-dlg{background:#fff;border-radius:12px;width:min(480px,94vw);padding:18px 20px;font-size:13px;color:#31425e;box-shadow:0 20px 50px rgba(20,30,60,.25)}' +
    '.pm-dlg h3{margin:0 0 10px;font-size:15px}.pm-dlg .info{background:#f8fafc;border-radius:8px;padding:10px 12px;line-height:1.8;font-size:12.5px;margin-bottom:10px}' +
    '.pm-dlg textarea{width:100%;box-sizing:border-box;border:1px solid #dfe5ef;border-radius:8px;padding:8px 10px;font:inherit;font-size:13px;min-height:80px}' +
    '.pm-dlg .acts{display:flex;justify-content:flex-end;gap:10px;margin-top:12px}.pm-dlg .acts button{height:32px;border-radius:8px;padding:0 14px;font:inherit;cursor:pointer;border:1px solid #dfe5ef;background:#fff}' +
    '.pm-dlg .acts .p{background:#5149e9;border-color:#5149e9;color:#fff}' +
    '.pm-sec{margin-top:10px;border:1px solid #e7ebf2;border-radius:8px;padding:10px 12px;font-size:12.5px;line-height:1.7}.pm-sec b{display:block;margin-bottom:2px}.pm-sec .m{color:#8b99ac}';
  function ensureCss() { if (document.getElementById('pm-css')) return; var s = document.createElement('style'); s.id = 'pm-css'; s.textContent = CSS; document.head.appendChild(s); }
  function stTag(r) {
    if (!r) return '<span class="pm-st no">未提交</span>';
    if (r.status === '待审核') return '<span class="pm-st">已提交 · 待审核</span>';
    if (r.status === '已采纳') return '<span class="pm-st ok">已采纳 · 待发布</span>';
    if (r.status === '已退回') return '<span class="pm-st rej" title="' + esc(r.review && r.review.note || '') + '">已退回</span>';
    return '';
  }
  function place(ch) { return ch.slice(0, -1).map(function (x) { return x.replace(/^[^：]+：/, ''); }).join(' › '); }
  function actions(key, r) {
    if (r && r.status === '待审核') return '<button class="pm-lk" data-pm-withdraw="' + esc(key) + '">撤回提交</button>';
    if (r && r.status === '已采纳') return '';
    return '<button class="pm-lk" data-pm-submit="' + esc(key) + '">' + (r ? '重新提交' : '提交到标准图谱') + '</button>';
  }
  function count() { return M ? KP.mine(M).length : 0; }
  function refreshBtn() { var b = document.getElementById('mineBtn'); if (b) b.innerHTML = '我的补充<b>' + count() + '</b>'; }
  function openPanel() {
    ensureCss(); closePanel();
    var list = KP.mine(M), el = document.createElement('div'); el.className = 'pm-panel'; el.id = 'pmPanel';
    el.innerHTML = '<div class="h"><b>我的补充</b><span style="color:#8b99ac">' + list.length + ' 项</span><span class="sp"></span><button class="x" data-pm-close aria-label="关闭">✕</button></div>' +
      '<div class="tip">我在能力地图里补充的节点（人工新增、AI 细分、技能缺口加入的技能等），只有自己能看到。效果好的可以提交到标准图谱，管理员或专业负责人审核、发布后，全校老师都能用到，并标注贡献人。</div><div class="bd">' +
      (list.map(function (x) {
        var r = x.status;
        return '<div class="pm-it"><div class="n" data-pm-focus="' + esc(x.key) + '">' + esc(x.node.name) + '</div>' +
          '<div class="m">' + esc(KP.typeCn(x.node)) + (x.count > 1 ? ' · 连同下级共 ' + x.count + ' 个节点' : '') + ' · ' + esc(place(x.chain)) + '</div>' +
          (r && r.status === '已退回' ? '<div class="m" style="color:#b91c1c">退回原因：' + esc(r.review && r.review.note || '') + '</div>' : '') +
          '<div class="a">' + stTag(r) + actions(x.key, r) + '<button class="pm-lk" data-pm-focus="' + esc(x.key) + '">在图中定位</button></div></div>';
      }).join('') || '<div class="pm-empty">还没有补充的节点。<br>在「能力地图」里可以给技能、知识点等增加节点，或由 AI 细分下级；补充的内容会同步显示在这里。</div>') + '</div>';
    document.body.appendChild(el);
  }
  function closePanel() { var p = document.getElementById('pmPanel'); if (p) p.remove(); }
  function submit(key) {
    ensureCss();
    var n = M.nodes[key], t = KP.tree(M, key), tg = KP.target(M, key), ch = KP.chain(M, key);
    var mask = document.createElement('div'); mask.className = 'pm-mask';
    mask.innerHTML = '<div class="pm-dlg"><h3>提交到标准图谱</h3><div class="info"><b>' + esc(n.name) + '</b>' + (KP.count(t) > 1 ? '（连同下级共 ' + KP.count(t) + ' 个节点）' : '') +
      '<br>提交到：' + esc(tg.target + ' · ' + tg.targetName) + '<br>位置：' + esc(place(ch)) + '</div>' +
      '<label style="display:block;font-size:12px;color:#6b7a90;margin-bottom:4px">提交理由</label><textarea maxlength="200" placeholder="说明这个节点为什么值得进入标准图谱，例如：在哪些课上用过、效果如何"></textarea>' +
      '<div class="acts"><button data-c>取消</button><button class="p" data-o>提交审核</button></div></div>';
    document.body.appendChild(mask);
    var ta = mask.querySelector('textarea'); ta.focus();
    mask.querySelector('[data-c]').onclick = function () { mask.remove(); };
    mask.querySelector('[data-o]').onclick = function () {
      var reason = ta.value.trim(); if (!reason) { ta.style.borderColor = '#e2302f'; ta.focus(); return; }
      GSuggest.add(KP.suggestion(M, key, reason, me() || '教师'));
      mask.remove(); changed(key, '已提交，等待管理员或专业负责人审核');
    };
  }
  function withdraw(key) { var r = GSuggest.byRef(key); if (r && r.status === '待审核') { GSuggest.remove(r.id); changed(key, '已撤回提交'); } }
  function changed(key, msg) {
    refreshBtn();
    if (document.getElementById('pmPanel')) openPanel();
    if (view && view.current && view.current() && view.current().key === key) view.showDetail(view.current());
    if (view && view.hint) view.hint(msg);
  }
  // 节点详情里的「我的补充」/「老师贡献」说明
  function detailHTML(n) {
    if (!M || !n.key) return '';
    var mn = M.nodes[n.key]; if (!mn) return '';
    if (mn.std) return '<div class="pm-sec"><b>老师贡献 · 已并入标准图谱</b><span class="m">由 ' + esc(mn.std.by) + ' 提交，' + esc(mn.std.review && mn.std.review.by || '') + ' 审核，' + esc(mn.std.publishedAt || '') + ' 发布</span></div>';
    if (!mn.personal) return '';
    ensureCss();
    var r = GSuggest.byRef(n.key), can = KP.submittable(M, n.key);
    return '<div class="pm-sec"><b>我的补充 · 仅自己可见</b><span class="m">在能力地图里补充，可在能力地图中编辑、删除</span>' +
      (can ? '<div style="margin-top:6px;display:flex;gap:12px;align-items:center">' + stTag(r) + actions(n.key, r) + '</div>' + (r && r.status === '已退回' ? '<div class="m" style="color:#b91c1c">退回原因：' + esc(r.review && r.review.note || '') + '</div>' : '')
        : '<div class="m">请在上级节点提交（会连同下级一起提交）</div>') + '</div>';
  }
  function init(v) {
    view = v; ensureCss();
    var bar = document.getElementById('resBtn');
    if (bar && !document.getElementById('mineBtn')) bar.insertAdjacentHTML('afterend', '<button id="mineBtn" type="button" class="graph-toolbar-btn pm-btn" title="我在能力地图里补充的节点，可提交到标准图谱"></button>');
    refreshBtn();
    document.addEventListener('click', function (e) {
      var t;
      if (e.target.closest('#mineBtn')) { openPanel(); return; }
      if (e.target.closest('[data-pm-close]')) { closePanel(); return; }
      if ((t = e.target.closest('[data-pm-submit]'))) { submit(t.getAttribute('data-pm-submit')); return; }
      if ((t = e.target.closest('[data-pm-withdraw]'))) { withdraw(t.getAttribute('data-pm-withdraw')); return; }
      if ((t = e.target.closest('[data-pm-focus]'))) { var k = t.getAttribute('data-pm-focus'); closePanel(); if (view.focusKey) view.focusKey(k); }
    });
    // 从能力地图「去全景图谱提交」进入：?mine=节点编号 → 打开我的补充并定位
    var m = location.search.match(/[?&]mine=([^&]+)/);
    if (m) { var key = decodeURIComponent(m[1]); setTimeout(function () { if (view.focusKey) view.focusKey(key); openPanel(); }, 50); }
  }
  root.PanoMine = { buildData: buildData, init: init, detailHTML: detailHTML, model: function () { return M; } };
})(window);
