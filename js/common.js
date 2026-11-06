/* 权限管理升级 V2.1 · 公共框架
 * 所有页面（含 panorama.html / kmap.html）的左侧菜单都由这里渲染，保证同一身份在各页面看到的菜单一致。
 * 依赖 js/mock-data.js（window.DEMO）与 js/permission.js（window.Perm）。
 * 职责：一套菜单配置渲染三套侧栏（管理端 / 教师端 / 学生端）；页面间跳转带上当前身份（?u=）与当前端（?p=）。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.UI = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ── 端名称 ── */
  function portalName(p) {
    if (p === 'admin') return '管理端';
    if (p === 'teacher') return '教师端';
    if (p === 'student') return '学生端';
    return p || '';
  }

  function roleById(ctx, id) { return (ctx.roles || []).find(function (r) { return r.id === id; }); }
  function orgById(ctx, id) { return (ctx.orgs || []).find(function (o) { return o.id === id; }); }
  function klassById(ctx, id) { return (ctx.klasses || []).find(function (k) { return k.id === id; }); }
  function majorById(ctx, id) { return (ctx.majors || []).find(function (m) { return m.id === id; }); }

  /* 一条分配的范围摘要（用于身份条「角色（范围）」） */
  function scopeSummary(ctx, a) {
    var ts = a.teachingScope || {};
    var ids = [];
    if ((a.scopeClassIds || []).length) ids = a.scopeClassIds;
    else if ((ts.classIds || []).length) ids = ts.classIds;
    else if ((ts.majorIds || []).length) ids = ts.majorIds;
    else if ((a.scopeOrgIds || []).length) ids = a.scopeOrgIds;
    return ids.map(function (id) {
      var o = klassById(ctx, id) || majorById(ctx, id) || orgById(ctx, id);
      return o ? o.name : id;
    }).join('、');
  }

  /* 身份所属端：单端→该端；多端→管理端（不再记忆上次使用的端）；无有效分配→null */
  function portalOf(ctx, identity) {
    var enterable = Perm.rolePortals(ctx, identity);
    if (!enterable.length) return null;
    if (enterable.length === 1) return enterable[0];
    return 'admin';
  }

  /* 当前端：页面 cfg.portal 在可进入集合里→该端；否则按身份默认端 */
  function currentPortalFor(ctx, identity) {
    var enterable = Perm.rolePortals(ctx, identity);
    if (_config && enterable.indexOf(_config.portal) >= 0) return _config.portal;
    return portalOf(ctx, identity);
  }

  function hasPerm(ctx, identity, code) {
    return Perm.check(ctx, identity, code, null, null).allowed;
  }
  function hasAnyPerm(ctx, identity, codes) {
    return codes.some(function (c) { return hasPerm(ctx, identity, c); });
  }

  /* ── 菜单配置：三套侧栏。item 约定 ──
   *   empty:true   → 空菜单（button，不可点，保持占位）
   *   external:true→ 公共页面（行业分析/能力图谱），对该端所有身份可见；页面以 portal:'auto' 启动，按 ?p= 决定显示哪一端的菜单
   *   perms:[..]   → 新页面，按「功能权限」显示/隐藏（任一命中即显示）
   *   landing:false → 不作为登录 / 切换身份后的落地页（firstPage 跳过）
   */
  var MENUS = {
    admin: {
      title: 'AIGC 智慧课堂<br>教学平台 · 管理端',
      groups: [
        // 数据概览、行业分析、能力测评为一级菜单（不分组）；能力地图只在教师端
        { label: '', items: [
          { key: 'dash', label: '数据概览', icon: '▤', href: 'dashboard.html' },
          { key: 'panorama', label: '行业分析', icon: '◎', href: 'panorama.html', external: true },
          { key: 'assess', label: '能力测评', icon: '◈', href: 'assess.html',
            perms: ['major:assess:view'], landing: false }
        ] },
        // 图谱中心：由原独立的图谱平台迁入（graph/ 目录），管理端可维护
        { label: '图谱中心', items: [
          { key: 'gc-kg', label: '知识图谱', icon: '◇', href: 'graph/knowledge-graph.html', external: true },
          { key: 'gc-ag', label: '能力图谱', icon: '◇', href: 'graph/ability-graph.html', external: true },
          { key: 'gc-ks', label: '知识体系', icon: '◇', href: 'graph/knowledge-system.html', external: true },
          { key: 'gc-mr', label: '映射审核', icon: '◇', href: 'graph/mapping-review.html', external: true },
          // 标准图谱建议：老师在能力地图里提交的个人节点，管理员 / 专业负责人审核、发布
          { key: 'gc-sr', label: '标准图谱建议', icon: '◇', href: 'graph/suggest-review.html', perms: ['graph:suggest:review'], landing: false },
          { key: 'gc-kb', label: '知识库', icon: '◇', href: 'graph/knowledge-base.html', external: true }
        ] },
        // 账号与角色：和参考系统一致
        { label: '账号与角色', items: [
          { key: 'account', label: '账号管理', icon: '▤', href: 'account-v1.html',
            perms: ['org:account:view', 'org:member:manage', 'account:account:create', 'org:account:edit'] },
          { key: 'role', label: '角色管理', icon: '▤', href: 'role.html', landing: false, perms: ['org:role:define'] },
          { key: 'menu', label: '菜单管理', icon: '▤', href: 'menu.html', landing: false, perms: ['org:role:define'] }
        ] },
        // 教务基础数据 / 课程计划管理：课程计划与教师端任务中心共用数据（teacher-kit.js）
        { label: '教务基础数据', items: [
          { key: 'edu-major', label: '专业管理', icon: '▤', href: 'edu-base.html?t=major', perms: ['edu:base:manage'], landing: false },
          { key: 'edu-grade', label: '年级管理', icon: '▤', href: 'edu-base.html?t=grade', perms: ['edu:base:manage'], landing: false },
          { key: 'edu-class', label: '班级管理', icon: '▤', href: 'edu-base.html?t=class', perms: ['edu:base:manage'], landing: false },
          { key: 'edu-student', label: '学生管理', icon: '▤', href: 'edu-base.html?t=student', perms: ['edu:base:manage'], landing: false },
          { key: 'edu-term', label: '学期与学年管理', icon: '▤', href: 'edu-base.html?t=term', perms: ['edu:base:manage'], landing: false },
          { key: 'edu-course', label: '课程管理', icon: '▤', href: 'edu-base.html?t=course', perms: ['edu:base:manage'], landing: false },
          // 实训资源：管理员维护（权限「实训资源维护」，可在角色管理里配给其他角色）
          { key: 'edu-lab', label: '实训资源管理', icon: '▤', href: 'edu-base.html?t=lab', perms: ['edu:lab:manage'], landing: false }
        ] },
        { label: '课程计划管理', items: [
          { key: 'plan', label: '课程计划', icon: '▤', href: 'course-plan.html', perms: ['edu:base:manage'], landing: false }
        ] },
        // 教学质量：课程计划执行后的结果（老师确认的课堂证据汇总）与课程改进建议的处理
        { label: '教学质量', items: [
          { key: 'tq-reach', label: '教学达成', icon: '▤', href: 'teach-quality.html?t=reach', perms: ['teach:quality:view'], landing: false },
          { key: 'tq-kps', label: '知识点掌握', icon: '▤', href: 'teach-quality.html?t=kps', perms: ['teach:quality:view'], landing: false },
          { key: 'tq-improve', label: '课程改进建议', icon: '▤', href: 'teach-quality.html?t=improve', perms: ['teach:quality:view'], landing: false }
        ] },
        // 系统配置：组织管理、院校基础信息、字典、基础信息配置
        { label: '系统配置', items: [
          { key: 'system', label: '组织管理', icon: '▤', href: 'system.html',
            perms: ['org:node:view'] },
          { key: 'college', label: '院校基础信息管理', icon: '▤', href: 'college.html', landing: false, perms: ['org:node:edit'] },
          { key: 'dict', label: '字典管理', icon: '▤', href: 'dict.html', landing: false, perms: ['org:node:edit'] },
          { key: 'sysconf', label: '基础信息配置', icon: '▤', href: 'sysconf.html', landing: false, perms: ['org:node:edit'] },
          { key: 'audit', label: '操作日志', icon: '▤', href: 'audit.html', perms: ['org:audit:view'], landing: false }
        ] }
      ]
    },
    teacher: {
      title: 'AIGC 智慧课堂<br>教学平台 · 教师端',
      // 顺序：工作台 → 能力地图 → 备课中心 → 任务中心 → 图谱中心 → 教师成长中心 → 教师档案；不分组的一级菜单用 key 区分
      groups: [
        { key: 'top', label: '', items: [
          { key: 'workbench', label: '工作台', icon: '▤', href: 'workbench.html' },
          { key: 'kmap', label: '能力地图', icon: '◇', href: 'kmap.html', external: true },
          // 备课中心暂不开放（teacher-resources.html 保留）；teacher-profile.html 为权限演示旧页，教师档案改用 teacher-file.html；我的班级不在菜单中显示
          { key: 'resources', label: '备课中心', icon: '▤', empty: true },
          { key: 'tasks', label: '任务中心', icon: '▤', href: 'teacher-tasks.html' }
        ] },
        // 图谱中心：教师端可新建，自己创建的可维护、他人创建的仅查看；不含映射审核
        { label: '图谱中心', items: [
          { key: 'gc-kg', label: '知识图谱', icon: '◇', href: 'graph/knowledge-graph.html', external: true },
          { key: 'gc-ag', label: '能力图谱', icon: '◇', href: 'graph/ability-graph.html', external: true },
          { key: 'gc-ks', label: '知识体系', icon: '◇', href: 'graph/knowledge-system.html', external: true },
          { key: 'gc-kb', label: '知识库', icon: '◇', href: 'graph/knowledge-base.html', external: true }
        ] },
        { key: 'bottom', label: '', items: [
          { key: 'growth', label: '教师成长中心', icon: '▤', href: 'teacher-growth.html' },
          { key: 'profile', label: '教师档案', icon: '▤', href: 'teacher-file.html' }
        ] }
      ]
    },
    student: {
      title: 'AIGC 智慧课堂<br>教学平台 · 学生端',
      groups: [
        { label: '', items: [
          { key: 'tasks', label: '我的任务', icon: '▤', href: 'student-tasks.html' },
          { key: 'growth', label: '学生成长中心', icon: '▤', href: 'student-growth.html' },
          { key: 'mine', label: '我的信息', icon: '▤', href: 'student.html' },
          { key: 'assess', label: '能力测评', icon: '◈', href: 'student-assess.html' }
        ] }
      ]
    }
  };

  /* ── 菜单管理的改动（localStorage menuConf.v1）：改名、图标、排序、禁用隐藏，以及新增的占位菜单 ──
   *   { <portal>: { items: { <key>: {label, icon, order, hidden} }, groups: { <分组名>: {label, order, hidden} }, added: [{key, label, icon, group, order, hidden}] } } */
  var MENU_CONF_KEY = 'menuConf.v1';
  function menuConf() { try { return JSON.parse(localStorage.getItem(MENU_CONF_KEY)) || {}; } catch (e) { return {}; } }
  function saveMenuConf(c) { try { localStorage.setItem(MENU_CONF_KEY, JSON.stringify(c)); } catch (e) {} }
  // 应用改动后的菜单；withHidden 为 true 时保留已禁用的（菜单管理页用），并带上 base（原始配置）
  function effectiveMenu(portal, withHidden) {
    var base = MENUS[portal], c = menuConf()[portal] || {}, io = c.items || {}, go = c.groups || {};
    var groups = base.groups.map(function (g, gi) {
      var gid = g.key || g.label, o = go[gid] || {};
      var items = g.items.map(function (it, ii) {
        var x = {}, k; for (k in it) x[k] = it[k];
        var ov = io[it.key] || {};
        if (ov.label) x.label = ov.label; if (ov.icon) x.icon = ov.icon;
        x.order = ov.order != null ? ov.order : ii + 1; x.hidden = !!ov.hidden; x.builtin = true; x.group = gid;
        return x;
      });
      (c.added || []).filter(function (a) { return a.group === gid; }).forEach(function (a) {
        items.push({ key: a.key, label: a.label, icon: a.icon || '▤', empty: true, order: a.order || items.length + 1, hidden: !!a.hidden, builtin: false, group: gid });
      });
      items.sort(function (x, y) { return x.order - y.order; });
      return { id: gid, label: g.label, name: o.label || g.label, order: o.order != null ? o.order : gi + 1, hidden: !!o.hidden,
        items: withHidden ? items : items.filter(function (it) { return !it.hidden; }) };
    });
    groups.sort(function (x, y) { return x.order - y.order; });
    var title = base.title, sc = sysConfActive();
    if (sc && portal !== 'admin' && sc[portal] && sc[portal].logoName) title = esc(sc[portal].logoName) + '<br>' + (portal === 'teacher' ? '教师端' : '学生端');
    return { title: title, groups: withHidden ? groups : groups.filter(function (g) { return !g.hidden; }) };
  }
  /* 基础信息配置（localStorage sysConf.v1）里启用的版本：教师端 / 学生端 Logo 名称显示在侧栏顶部 */
  function sysConfActive() {
    try { var c = JSON.parse(localStorage.getItem('sysConf.v1')); return c && c.versions ? c.versions[c.active] : null; } catch (e) { return null; }
  }

  /* ── 小工具 ── */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function $(sel, root) { return (root || document).querySelector(sel); }

  var memUi = null;
  /* 初始身份：地址栏 ?u=<账号> 传入（登录页跳转用），否则默认「超管」；仅内存，不持久化 */
  function queryParam(k) {
    try {
      if (typeof location !== 'undefined' && location.search) {
        var m = location.search.match(new RegExp('[?&]' + k + '=([^&]+)'));
        if (m) return decodeURIComponent(m[1]);
      }
    } catch (e) {}
    return '';
  }
  function initialAccountId() { return queryParam('u') || 'ACC-SUPER'; }
  /* 站内链接：带上当前身份（和端），跳到别的页面后身份与菜单不变 */
  /* 子目录页面（如 graph/）以 cfg.base 指回根目录，菜单、退出登录、跳转都加上这个前缀 */
  function abs(href) { return (_config && _config.base ? _config.base : '') + href; }
  function link(href, portal) {
    if (!href) return href;
    var hash = '', i = href.indexOf('#');
    if (i >= 0) { hash = href.slice(i); href = href.slice(0, i); }
    var q = 'u=' + encodeURIComponent(loadUi().accountId) + (portal ? '&p=' + encodeURIComponent(portal) : '');
    return href + (href.indexOf('?') >= 0 ? '&' : '?') + q + hash;
  }
  /* 演示状态只在当前页内存中保留（每次打开页面默认「超管」，不持久化到任何存储） */
  function loadUi() {
    if (memUi) return memUi;
    memUi = { accountId: initialAccountId(), orgId: '', why: false };
    return memUi;
  }
  function saveUi() {}

  function currentIdentity(ctx) {
    var identity = Perm.getIdentity(ctx, loadUi().accountId);
    identity.currentPortal = currentPortalFor(ctx, identity);
    return identity;
  }

  /* 组织树深度（用于「当前组织」下拉的缩进） */
  function orgDepth(ctx, orgId) {
    var byId = {};
    (ctx.orgs || []).forEach(function (o) { byId[o.id] = o; });
    var d = 0, cur = orgId;
    while (cur && byId[cur] && byId[cur].parentId) { d++; cur = byId[cur].parentId; }
    return d;
  }
  function indent(n) { return new Array(n + 1).join('　'); }

  /* ── 菜单项是否对当前身份可见 ── */
  function itemVisible(ctx, identity, item) {
    if (item.external || (item.empty && !item.perms)) return true;
    if (!item.perms) return true;
    return hasAnyPerm(ctx, identity, item.perms);
  }

  /* 该身份所属端的「第一个可见新页面」（切换身份后跳转目标）；可显式指定端 */
  function firstPage(ctx, identity, portal) {
    var p = portal || portalOf(ctx, identity);
    if (!p) return 'system.html'; // 无可用端（停用身份）兜底，正常不会走到
    var groups = effectiveMenu(p).groups;
    for (var g = 0; g < groups.length; g++) {
      var items = groups[g].items;
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        if (it.href && !it.external && it.landing !== false && itemVisible(ctx, identity, it)) return it.href;
      }
    }
    return p === 'student' ? 'student.html' : 'system.html';
  }

  /* 侧栏底部「当前登录人 + 退出登录」的样式：由这里注入，能力图谱、行业分析等自带侧栏样式的页面也能用 */
  // 一级菜单（分组）可展开 / 收起：#lnav 提高优先级，同时适用于普通页面和图谱中心（.gc-lnav）
  var FOLD_CSS = '#lnav .lgroup.lg-fold{padding:2px 10px}#lnav .lbrand+.lgroup{padding-top:10px}' +
    '#lnav .lgt.lfold{display:flex;align-items:center;gap:8px;width:100%;margin:0;padding:8px 10px;border:0;border-radius:8px;background:none;cursor:pointer;' +
      'font-family:inherit;font-size:13px;font-weight:600;letter-spacing:0;text-transform:none;color:var(--ink);text-align:left;transition:background .12s}' +
    '#lnav .lgt.lfold:hover{background:var(--rule-2)}' +
    '#lnav .lgt.lfold .lfn{flex:1;min-width:0}' +
    '#lnav .lgt.lfold .lfc{font-size:13px;line-height:1;color:var(--muted);transition:transform .15s}' +
    '#lnav .lg-fold.closed .lfc{transform:rotate(-90deg)}' +
    '#lnav .lg-fold.has-on>.lgt.lfold{color:var(--brand-ink)}' +
    '#lnav .lg-fold .lmenu{padding-left:26px}' +
    '#lnav .lg-fold.closed .litems{display:none}' +
    '@media (max-width:1000px){#lnav .lgt.lfold{display:none}#lnav .litems{display:contents!important}#lnav .lg-fold .lmenu{padding-left:10px}}';
  var FOLD_KEY = 'navFold.v1';
  function foldState() { try { return JSON.parse(localStorage.getItem(FOLD_KEY)) || {}; } catch (e) { return {}; } }
  function saveFold(s) { try { localStorage.setItem(FOLD_KEY, JSON.stringify(s)); } catch (e) {} }
  var LUSER_CSS = FOLD_CSS + '.luser{margin-top:auto;display:flex;align-items:center;gap:9px;padding:12px 14px 12px 18px;border-top:1px solid var(--rule-2)}' +
    '.luser+.lfoot{margin-top:0}' +
    '.luser .lav{width:28px;height:28px;flex:0 0 28px;border-radius:50%;display:grid;place-items:center;background:var(--brand-soft);color:var(--brand-ink);font-size:12.5px;font-weight:600}' +
    '.luser .lwho{flex:1;min-width:0;font-size:12.5px;line-height:1.35}' +
    '.luser .lwho b{display:block;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.luser .lwho span{font-size:11px;color:var(--muted)}' +
    '.lout{font:inherit;font-size:12px;color:var(--ink-2);background:none;border:1px solid var(--rule);border-radius:7px;padding:4px 9px;cursor:pointer;white-space:nowrap}' +
    '.lout:hover{color:var(--crit);border-color:var(--crit)}' +
    '@media (max-width:1000px){.luser{margin-top:0;border-top:none;padding:6px 16px 10px}}';
  function ensureLuserCss() {
    if (document.getElementById('luser-css')) return;
    var st = document.createElement('style'); st.id = 'luser-css'; st.textContent = LUSER_CSS;
    document.head.appendChild(st);
  }

  /* ── 渲染侧栏 ── */
  function renderSidebar(ctx, identity, portal, active) {
    var nav = $('#lnav');
    if (!nav) return;
    ensureLuserCss();
    var menu = effectiveMenu(portal), fold = foldState();
    var html = '<div class="lbrand"><div class="ldot" aria-hidden="true"></div><div class="lname">' + menu.title + '</div></div>';
    menu.groups.forEach(function (group) {
      // 分组里没有对当前身份可见的菜单项时，整组（含分组标题）不显示
      if (!group.items.some(function (it) { return itemVisible(ctx, identity, it); })) return;
      // 有分组名的作为一级菜单，可展开 / 收起：当前页所在的分组总是展开；其余按上次的选择，默认收起
      var fk = portal + '|' + group.label, hasOn = group.items.some(function (it) { return it.key === active; });
      var closed = group.label && !hasOn && fold[fk] !== 'open';
      html += '<div class="lgroup' + (group.label ? ' lg-fold' : '') + (closed ? ' closed' : '') + (hasOn ? ' has-on' : '') + '">';
      if (group.label) html += '<button type="button" class="lgt lfold" data-fold="' + esc(fk) + '" aria-expanded="' + !closed + '"><span class="lfn">' + esc(group.name || group.label) + '</span><span class="lfc" aria-hidden="true">▾</span></button><div class="litems">';
      group.items.forEach(function (it) {
        var vis = itemVisible(ctx, identity, it);
        if (!vis) return;
        var on = it.key === active;
        var cls = 'lmenu' + (on ? ' on' : '');
        var inner = '<i>' + esc(it.icon) + '</i>' + esc(it.label);
        if (it.href) {
          html += '<a class="' + cls + '" href="' + esc(link(abs(it.href), it.external ? portal : '')) + '"' + (on ? ' aria-current="page"' : '') + '>' + inner + '</a>';
        } else {
          html += '<button class="' + cls + '" type="button">' + inner + '</button>';
        }
      });
      html += (group.label ? '</div>' : '') + '</div>';
    });
    // 当前登录人 + 退出登录（回到登录页，地址里不再带身份）
    var name = identity.account ? identity.account.name : '';
    html += '<div class="luser"><span class="lav" aria-hidden="true">' + esc(name.slice(0, 1)) + '</span><span class="lwho"><b>' + esc(name) + '</b><span>' + esc(portalName(portal)) + '</span></span>' +
      '<button type="button" class="lout" data-logout>退出登录</button></div>';
    html += '<div class="lfoot" id="lfoot">权限管理升级 · V2.1</div>';
    nav.innerHTML = html;
    nav.onclick = function (e) {
      var b = e.target.closest('[data-fold]'); if (!b) return;
      var g = b.parentNode, open = g.classList.toggle('closed') === false, s = foldState();
      b.setAttribute('aria-expanded', String(open));
      s[b.getAttribute('data-fold')] = open ? 'open' : 'closed'; saveFold(s);
    };
    nav.querySelector('[data-logout]').addEventListener('click', function () {
      if (window.confirm('确定退出登录吗？')) location.href = abs('login.html');
    });
  }

  /* 多端身份切换时弹出「选择进入的端」，选完后跳到该端首页（带 ?u= 保持身份） */
  function promptPortal(ctx, identity, enterable, onPick, onCancel) {
    var accountName = identity.account ? identity.account.name : '';
    var active = Perm.allActiveAssignments(ctx, identity);
    var rows = enterable.map(function (p) {
      var roles = active.filter(function (a) {
        var r = roleById(ctx, a.roleId);
        return r && r.portal === p;
      }).map(function (a) {
        var r = roleById(ctx, a.roleId);
        return r ? r.name : a.roleId;
      }).join('、');
      return '<button type="button" class="pp-opt" data-portal="' + esc(p) + '">'
        + '<span class="pp-name">' + esc(portalName(p)) + '</span>'
        + '<span class="pp-roles">' + esc(roles) + '</span>'
        + '</button>';
    }).join('');
    var dlg = document.createElement('dialog');
    dlg.className = 'aidlg pp';
    dlg.innerHTML = '<form>'
      + '<div class="pp-head"><h2>选择要进入的端</h2>'
      + '<button type="button" class="x" data-pp-close aria-label="关闭">×</button></div>'
      + '<div class="pp-note">「' + esc(accountName) + '」可进入多个端，请选择本次进入哪个端。</div>'
      + '<div class="pp-list">' + rows + '</div>'
      + '</form>';
    document.body.appendChild(dlg);
    function finish(portal) {
      dlg.remove();
      if (portal) { if (onPick) onPick(portal); }
      else { if (onCancel) onCancel(); }
    }
    dlg.querySelector('[data-pp-close]').addEventListener('click', function () { finish(null); });
    dlg.addEventListener('click', function (e) {
      var b = e.target.closest('[data-portal]');
      if (b) finish(b.getAttribute('data-portal'));
    });
    dlg.addEventListener('cancel', function () { finish(null); });
    dlg.showModal();
  }

  var _config = null;
  function currentConfig() { return _config || { portal: 'admin', active: 'system' }; }

  function renderAll(ctx, cfg) {
    var identity = currentIdentity(ctx);
    var enterable = Perm.rolePortals(ctx, identity);
    if (!enterable.length) {
      var nav = $('#lnav');
      if (nav) nav.innerHTML = '';
      return;
    }
    renderSidebar(ctx, identity, cfg.portal, cfg.active);
  }

  /* ── 页面内容刷新钩子（身份/组织/为什么/重置变化后通知各页面重渲染） ── */
  var _onChange = [];
  function onChange(fn) { if (typeof fn === 'function') _onChange.push(fn); }
  function notify() {
    var c = DEMO.getState();
    var iden = currentIdentity(c);
    _onChange.forEach(function (fn) { try { fn(c, iden, loadUi()); } catch (e) { if (window.console) console.error(e); } });
  }
  function refresh() {
    renderAll(DEMO.getState(), currentConfig());
    notify();
  }
  function uiSnapshot() { var u = loadUi(); return { accountId: u.accountId, orgId: u.orgId || '', why: !!u.why }; }

  /* 页面入口：cfg = { portal: 'admin'|'teacher'|'student'|'auto', active: '菜单 key' }
   * auto：多端共用的页面（行业分析/能力图谱），显示 ?p= 指定的端；未指定或不可进入时按身份默认端 */
  function boot(cfg) {
    _config = cfg || { portal: 'admin', active: 'system' };
    var ctx = DEMO.getState();
    var identity = currentIdentity(ctx);
    var enterable = Perm.rolePortals(ctx, identity);
    if (_config.portal === 'auto') {
      var qp = queryParam('p');
      _config.portal = enterable.indexOf(qp) >= 0 ? qp : (portalOf(ctx, identity) || 'admin');
    }
    // 当前页面的端不在身份可进入的端集合里才跳回；在集合里就把当前端设为该页面的端
    if (enterable.length && enterable.indexOf(_config.portal) < 0) {
      location.replace(link(abs(firstPage(ctx, identity))));
      return;
    }
    renderAll(ctx, _config);
  }

  return {
    boot: boot,
    portal: function () { return currentConfig().portal; },
    portalOf: portalOf,
    firstPage: firstPage,
    link: link,
    promptPortal: promptPortal,
    hasPerm: hasPerm,
    hasAnyPerm: hasAnyPerm,
    MENUS: MENUS,
    effectiveMenu: effectiveMenu,
    menuConf: menuConf,
    saveMenuConf: saveMenuConf,
    itemVisible: itemVisible,
    onChange: onChange,
    ui: uiSnapshot,
    currentIdentity: currentIdentity
  };
}));
