/* 权限管理升级 V2.1 · 公共框架
 * 只用于新的权限演示页面（system / basedata / account / teacher-* / student）。
 * 依赖 js/mock-data.js（window.DEMO）与 js/permission.js（window.Perm）。
 * 职责：一套菜单配置渲染三套侧栏（管理端 / 教师端 / 学生端）。
 * 不修改 panorama.html / kmap.html。
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
   *   external:true→ 现有页面（行业分析/行业图谱，对所有管理端身份可见）
   *   perms:[..]   → 新页面，按「功能权限」显示/隐藏（任一命中即显示）
   */
  var MENUS = {
    admin: {
      title: 'AIGC 智慧课堂<br>教学平台 · 管理端',
      groups: [
        { label: '概览', items: [
          { key: 'dash', label: '数据概览', icon: '▤', empty: true },
          { key: 'panorama', label: '行业分析', icon: '◎', href: 'panorama.html', external: true },
          { key: 'kmap', label: '行业图谱', icon: '◇', href: 'kmap.html', external: true }
        ] },
        { label: '教务', items: [
          { key: 'account', label: '账号管理', icon: '▤', href: 'account-v1.html',
            perms: ['org:account:view'] }
        ] },
        { label: '系统', items: [
          { key: 'system', label: '组织管理', icon: '▤', href: 'system.html',
            perms: ['org:node:view'] }
        ] }
      ]
    },
    teacher: {
      title: 'AIGC 智慧课堂<br>教学平台 · 教师端',
      groups: [
        { label: '', items: [
          { key: 'workbench', label: '工作台', icon: '▤', empty: true },
          { key: 'resources', label: '备课中心', icon: '▤', href: 'teacher-resources.html',
            perms: ['resource:share', 'resource:schoolpub:view', 'resource:schoolpub:publish'] },
          { key: 'myclasses', label: '我的班级', icon: '▤', href: 'my-classes.html',
            perms: ['student:score:view', 'intern:task:view'] },
          { key: 'tasks', label: '任务中心', icon: '▤', empty: true },
          { key: 'growth', label: '教师成长中心', icon: '▤', empty: true },
          { key: 'profile', label: '教师档案', icon: '▤', href: 'teacher-profile.html',
            perms: ['teaching:profile:view'] }
        ] }
      ]
    },
    student: {
      title: 'AIGC 智慧课堂<br>教学平台 · 学生端',
      groups: [
        { label: '', items: [
          { key: 'mine', label: '我的信息', icon: '▤', href: 'student.html' }
        ] }
      ]
    }
  };

  /* ── 小工具 ── */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function $(sel, root) { return (root || document).querySelector(sel); }

  var memUi = null;
  /* 初始身份：地址栏 ?u=<账号> 传入（登录页跳转用），否则默认「超管」；仅内存，不持久化 */
  function initialAccountId() {
    try {
      if (typeof location !== 'undefined' && location.search) {
        var m = location.search.match(/[?&]u=([^&]+)/);
        if (m) return decodeURIComponent(m[1]);
      }
    } catch (e) {}
    return 'ACC-SUPER';
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
    if (item.empty || item.external) return true;
    if (!item.perms) return true;
    return hasAnyPerm(ctx, identity, item.perms);
  }

  /* 该身份所属端的「第一个可见新页面」（切换身份后跳转目标）；可显式指定端 */
  function firstPage(ctx, identity, portal) {
    var p = portal || portalOf(ctx, identity);
    if (!p) return 'system.html'; // 无可用端（停用身份）兜底，正常不会走到
    var groups = MENUS[p].groups;
    for (var g = 0; g < groups.length; g++) {
      var items = groups[g].items;
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        if (it.href && !it.external && itemVisible(ctx, identity, it)) return it.href;
      }
    }
    return p === 'student' ? 'student.html' : 'system.html';
  }

  /* ── 渲染侧栏 ── */
  function renderSidebar(ctx, identity, portal, active) {
    var nav = $('#lnav');
    if (!nav) return;
    var menu = MENUS[portal];
    var html = '<div class="lbrand"><div class="ldot" aria-hidden="true"></div><div class="lname">' + menu.title + '</div></div>';
    menu.groups.forEach(function (group) {
      html += '<div class="lgroup">';
      if (group.label) html += '<div class="lgt">' + esc(group.label) + '</div>';
      group.items.forEach(function (it) {
        var vis = itemVisible(ctx, identity, it);
        if (!vis) return;
        var on = it.key === active;
        var cls = 'lmenu' + (on ? ' on' : '');
        var inner = '<i>' + esc(it.icon) + '</i>' + esc(it.label);
        if (it.href) {
          html += '<a class="' + cls + '" href="' + esc(it.href) + '"' + (on ? ' aria-current="page"' : '') + '>' + inner + '</a>';
        } else {
          html += '<button class="' + cls + '" type="button">' + inner + '</button>';
        }
      });
      html += '</div>';
    });
    html += '<div class="lfoot">权限管理升级 · V2.1</div>';
    nav.innerHTML = html;
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

  /* 页面入口：cfg = { portal: 'admin'|'teacher'|'student', active: '菜单 key' } */
  function boot(cfg) {
    _config = cfg || { portal: 'admin', active: 'system' };
    var ctx = DEMO.getState();
    var identity = currentIdentity(ctx);
    var enterable = Perm.rolePortals(ctx, identity);
    // 当前页面的端不在身份可进入的端集合里才跳回；在集合里就把当前端设为该页面的端
    if (enterable.length && enterable.indexOf(_config.portal) < 0) {
      location.replace(firstPage(ctx, identity));
      return;
    }
    renderAll(ctx, _config);
  }

  return {
    boot: boot,
    portalOf: portalOf,
    firstPage: firstPage,
    promptPortal: promptPortal,
    hasPerm: hasPerm,
    hasAnyPerm: hasAnyPerm,
    MENUS: MENUS,
    onChange: onChange,
    ui: uiSnapshot,
    currentIdentity: currentIdentity
  };
}));
