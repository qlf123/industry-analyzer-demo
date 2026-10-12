/* 权限管理升级 V2.1 · 公共框架
 * 只用于新的权限演示页面（system / basedata / account / teacher-* / student）。
 * 依赖 js/mock-data.js（window.DEMO）与 js/permission.js（window.Perm）。
 * 职责：一套菜单配置渲染三套侧栏（管理端 / 教师端 / 学生端）+ 顶部演示身份条。
 * 不修改 panorama.html / kmap.html。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.UI = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var UI_KEY = 'permission-demo-ui'; // 演示身份条的跨页选择（与 mock 数据分开存）

  /* ── 端 → 角色 key 映射（决定演示身份属于哪个端） ── */
  var ADMIN_ROLES = { super: 1, orgAdmin: 1, majorLead: 1, counselor: 1, headTeacher: 1, academic: 1, studentAffairs: 1, supervisor: 1, info: 1 };
  var TEACHER_ROLES = { teacher: 1, enterprise: 1 };
  var STUDENT_ROLES = { student: 1 };

  function roleKeys(ctx, identity) {
    var set = {};
    (identity.assignments || []).forEach(function (a) {
      var role = (ctx.roles || []).filter(function (r) { return r.id === a.roleId; })[0];
      if (role) set[role.key] = 1;
    });
    return set;
  }

  function portalOf(ctx, identity) {
    var keys = roleKeys(ctx, identity);
    var k;
    for (k in STUDENT_ROLES) if (keys[k]) return 'student';
    for (k in ADMIN_ROLES) if (keys[k]) return 'admin';
    for (k in TEACHER_ROLES) if (keys[k]) return 'teacher';
    return 'admin';
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
          { key: 'basedata', label: '教务基础数据', icon: '▤', href: 'basedata.html',
            perms: ['student:info:view', 'student:score:view', 'teaching:content:view', 'teaching:content:audit', 'org:node:view'] },
          { key: 'courseplan', label: '课程计划管理', icon: '▤', empty: true },
          { key: 'account', label: '账号与角色', icon: '▤', href: 'account.html',
            perms: ['org:account:view', 'org:role:define'] },
          { key: 'schoolpub', label: '校本资源库', icon: '▤', href: 'teacher-resources.html',
            perms: ['resource:schoolpub:publish'] },
          { key: 'teacherprofile', label: '教师档案', icon: '▤', href: 'teacher-profile.html',
            perms: ['teaching:profile:view'] }
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
  function loadUi() {
    if (memUi) return memUi;
    var fallback = { accountId: 'ACC-SUPER', orgId: '', why: false };
    try {
      var raw = localStorage.getItem(UI_KEY);
      memUi = raw ? JSON.parse(raw) : fallback;
    } catch (e) { memUi = fallback; }
    if (!memUi.accountId) memUi.accountId = 'ACC-SUPER';
    return memUi;
  }
  function saveUi() {
    try { localStorage.setItem(UI_KEY, JSON.stringify(memUi)); } catch (e) {}
  }

  function currentIdentity(ctx) {
    return Perm.getIdentity(ctx, loadUi().accountId);
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

  /* 该身份所属端的「第一个可见新页面」（切换身份后跳转目标） */
  function firstPage(ctx, identity) {
    var portal = portalOf(ctx, identity);
    var groups = MENUS[portal].groups;
    for (var g = 0; g < groups.length; g++) {
      var items = groups[g].items;
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        if (it.href && !it.external && itemVisible(ctx, identity, it)) return it.href;
      }
    }
    return portal === 'student' ? 'student.html' : 'system.html';
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

  /* ── 渲染演示身份条 ── */
  function renderDemobar(ctx) {
    var bar = $('#demobar');
    if (!bar) return;
    var identity = currentIdentity(ctx);
    var ui = loadUi();
    var hasOrg = Perm.hasOrgScope(ctx, identity);

    var html = '<span class="dbl"><b>当前身份</b><select id="dIdentity" aria-label="当前身份">';
    (ctx.demoIdentities || []).forEach(function (d) {
      html += '<option value="' + esc(d.accountId) + '"' + (d.accountId === ui.accountId ? ' selected' : '') + '>' + esc(d.label) + '</option>';
    });
    html += '</select></span>';

    if (hasOrg) {
      var opts = Perm.currentOrgOptions(ctx, identity);
      html += '<span class="dbl"><b>当前组织</b><select id="dOrg" aria-label="当前组织">';
      html += '<option value=""' + (!ui.orgId ? ' selected' : '') + '>全部授权范围</option>';
      opts.forEach(function (o) {
        html += '<option value="' + esc(o.id) + '"' + (o.id === ui.orgId ? ' selected' : '') + '>' + esc(indent(orgDepth(ctx, o.id)) + o.name) + '</option>';
      });
      html += '</select></span>';
    }

    html += '<label class="dbtoggle"><input type="checkbox" id="dWhy"' + (ui.why ? ' checked' : '') + '>为什么能看到 / 看不到</label>';
    html += '<span class="sp"></span>';
    html += '<button class="btn ghost dbr" id="dReset" type="button">重置演示数据</button>';
    bar.innerHTML = html;

    $('#dIdentity').addEventListener('change', function () { onIdentityChange(this.value); });
    if (hasOrg) $('#dOrg').addEventListener('change', function () { onOrgChange(this.value); });
    $('#dWhy').addEventListener('change', function () { onWhyChange(this.checked); });
    $('#dReset').addEventListener('click', onReset);
  }

  function onIdentityChange(accountId) {
    memUi = loadUi();
    memUi.accountId = accountId;
    memUi.orgId = ''; // 切换身份时重置为「全部授权范围」
    saveUi();
    var ctx = DEMO.getState();
    var identity = Perm.getIdentity(ctx, accountId);
    var target = firstPage(ctx, identity);
    var here = (location.pathname.split('/').pop() || 'system.html');
    if (here !== target) location.href = target;
    else refresh();
  }

  function onOrgChange(orgId) {
    memUi = loadUi();
    memUi.orgId = orgId || '';
    saveUi();
    refresh();
  }

  function onWhyChange(checked) {
    memUi = loadUi();
    memUi.why = !!checked;
    saveUi();
    refresh();
  }

  function onReset() {
    DEMO.resetDemoData();
    refresh();
  }

  var _config = null;
  function currentConfig() { return _config || { portal: 'admin', active: 'system' }; }

  function renderAll(ctx, cfg) {
    var identity = currentIdentity(ctx);
    renderSidebar(ctx, identity, cfg.portal, cfg.active);
    renderDemobar(ctx);
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
    var portal = portalOf(ctx, identity);
    if (portal !== cfg.portal) {
      // 身份所属的端与当前页面不符（如：以教师身份直接打开管理端页）→ 跳回其可见首屏
      location.replace(firstPage(ctx, identity));
      return;
    }
    renderAll(ctx, cfg);
  }

  return {
    boot: boot,
    portalOf: portalOf,
    firstPage: firstPage,
    hasPerm: hasPerm,
    hasAnyPerm: hasAnyPerm,
    MENUS: MENUS,
    UI_KEY: UI_KEY,
    onChange: onChange,
    ui: uiSnapshot,
    currentIdentity: currentIdentity
  };
}));
