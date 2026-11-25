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
    if (p === 'platform') return '平台管理端';
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
        // 一级菜单顺序：数据概览 → 教务管理 → 课程计划管理 → 专业建设测评 → 图谱中心 → 行业分析 → 账号与角色 → 系统配置
        // （先放教务日常，再放专业建设与图谱，最后是平台管理）；「教学达成分析」是数据概览内的二级详情页，不在侧栏单独成菜单
        { key: 'top', label: '', items: [
          { key: 'dash', label: '数据概览', icon: '▤', href: 'dashboard.html' }
        ] },
        // 教务管理 / 课程计划管理：课程计划与教师端任务中心共用数据（teacher-kit.js）
        { key: '教务基础数据', label: '教务管理', items: [
          { key: 'edu-major', label: '专业管理', icon: '▤', href: 'edu-base.html?t=major', perms: ['edu:base:manage'], landing: false },
          { key: 'edu-grade', label: '年级管理', icon: '▤', href: 'edu-base.html?t=grade', perms: ['edu:base:manage'], landing: false },
          { key: 'edu-class', label: '班级管理', icon: '▤', href: 'edu-base.html?t=class', perms: ['edu:base:manage'], landing: false },
          { key: 'edu-student', label: '学生管理', icon: '▤', href: 'edu-base.html?t=student', perms: ['edu:base:manage'], landing: false },
          { key: 'edu-term', label: '学年学期管理', icon: '▤', href: 'edu-base.html?t=term', perms: ['edu:base:manage'], landing: false },
          { key: 'edu-period', label: '节次时间管理', icon: '▤', href: 'edu-base.html?t=period', perms: ['edu:base:manage'], landing: false },
          { key: 'edu-course', label: '课程管理', icon: '▤', href: 'edu-base.html?t=course', perms: ['edu:base:manage'], landing: false },
          // 实训资源：管理员维护（权限「实训资源维护」，可在角色管理里配给其他角色）
          { key: 'edu-lab', label: '实训资源管理', icon: '▤', href: 'edu-base.html?t=lab', perms: ['edu:lab:manage'], landing: false }
        ] },
        { label: '课程计划管理', items: [
          { key: 'plan', label: '课程计划', icon: '▤', href: 'course-plan.html', perms: ['edu:base:manage'], landing: false }
        ] },
        { key: 'top-assess', label: '', items: [
          { key: 'assess', label: '专业建设测评', icon: '◈', href: 'assess.html', feature: 'majorAssess',
            perms: ['major:assess:view'], landing: false }
        ] },
        // 图谱中心：由原独立的图谱平台迁入（graph/ 目录），管理端可维护；按建图谱的先后排：知识库 → 能力图谱 → 知识体系 → 映射审核 → 知识图谱 → 图谱建议审核
        { label: '图谱中心', items: [
          { key: 'gc-kb', label: '知识库', icon: '◇', href: 'graph/knowledge-base.html', external: true, feature: 'graph' },
          { key: 'gc-ag', label: '能力图谱', icon: '◇', href: 'graph/ability-graph.html', external: true, feature: 'graph' },
          { key: 'gc-ks', label: '知识体系', icon: '◇', href: 'graph/knowledge-system.html', external: true, feature: 'graph' },
          { key: 'gc-mr', label: '映射审核', icon: '◇', href: 'graph/mapping-review.html', external: true, feature: 'graph' },
          { key: 'gc-kg', label: '知识图谱', icon: '◇', href: 'graph/knowledge-graph.html', external: true, feature: 'graph' },
          // 图谱建议审核：老师在能力地图里提交的个人节点，管理员 / 专业负责人审核、发布
          { key: 'gc-sr', label: '图谱建议审核', icon: '◇', href: 'graph/suggest-review.html', perms: ['graph:suggest:review'], landing: false, feature: 'graph' }
        ] },
        { key: 'top-pano', label: '', items: [
          { key: 'panorama', label: '行业分析', icon: '◎', href: 'panorama.html', external: true, feature: 'industry' }
        ] },
        // 账号与角色：和参考系统一致
        { label: '账号与角色', items: [
          { key: 'account', label: '账号管理', icon: '▤', href: 'account-v1.html',
            perms: ['org:account:view', 'org:member:manage', 'account:account:create', 'org:account:edit'] },
          { key: 'role', label: '角色管理', icon: '▤', href: 'role.html', landing: false, perms: ['org:role:define'] },
          { key: 'menu', label: '菜单管理', icon: '▤', href: 'menu.html', landing: false, perms: ['org:role:define'] }
        ] },
        // 系统配置：院校信息、组织管理、字典、操作日志
        { label: '系统配置', items: [
          { key: 'college', label: '院校信息', icon: '▤', href: 'college.html', landing: false, perms: ['org:node:edit'] },
          { key: 'system', label: '组织管理', icon: '▤', href: 'system.html',
            perms: ['org:node:view'] },
          { key: 'dict', label: '字典管理', icon: '▤', href: 'dict.html', landing: false, perms: ['org:node:edit'] },
          { key: 'audit', label: '操作日志', icon: '▤', href: 'audit.html', perms: ['org:audit:view'], landing: false }
        ] }
      ]
    },
    teacher: {
      title: 'AIGC 智慧课堂<br>教学平台 · 教师端',
      // 顺序：工作台 → 能力地图 → 智慧课堂（课堂首页 / 我的课程 / 我的课表 / 作业评价 / 备课资源）→ 图谱中心 → 教师成长中心 → 教师档案
      // 登录落地页是「课堂首页」（工作台 landing:false，仍放在最上面一键可达）
      groups: [
        { key: 'top', label: '', items: [
          { key: 'workbench', label: '工作台', icon: '▤', href: 'workbench.html', landing: false },
          { key: 'kmap', label: '能力地图', icon: '◇', href: 'kmap.html', external: true, feature: 'graph' },
          // 备课中心隐藏（teacher-resources.html 保留，菜单管理页可重新启用）；teacher-profile.html 为权限演示旧页，教师档案改用 teacher-file.html；我的班级不在菜单中显示
          { key: 'resources', label: '备课中心', icon: '▤', empty: true, hidden: true },
        ] },
        // 智慧课堂：跨课程的入口拆成二级菜单；按一门课做事在「我的课程」里进入课程空间
        { label: '智慧课堂', items: [
          { key: 'tasks', label: '课堂首页', icon: '▤', href: 'teacher-tasks.html' },
          { key: 'cr-courses', label: '我的课程', icon: '▤', href: 'teacher-tasks.html?t=courses' },
          { key: 'cr-tt', label: '我的课表', icon: '▤', href: 'teacher-tasks.html?t=tt' },
          { key: 'cr-eval', label: '作业评价', icon: '▤', href: 'teacher-tasks.html?t=eval' },
          { key: 'cr-res', label: '资料库', icon: '▤', href: 'teacher-tasks.html?t=res' }
        ] },
        // 图谱中心：教师端可新建，自己创建的可维护、他人创建的仅查看；不含映射审核；顺序同管理端
        { label: '图谱中心', items: [
          { key: 'gc-kb', label: '知识库', icon: '◇', href: 'graph/knowledge-base.html', external: true, feature: 'graph' },
          { key: 'gc-ag', label: '能力图谱', icon: '◇', href: 'graph/ability-graph.html', external: true, feature: 'graph' },
          { key: 'gc-ks', label: '知识体系', icon: '◇', href: 'graph/knowledge-system.html', external: true, feature: 'graph' },
          { key: 'gc-kg', label: '知识图谱', icon: '◇', href: 'graph/knowledge-graph.html', external: true, feature: 'graph' }
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
          { key: 'assess', label: '能力测评', icon: '◈', href: 'student-assess.html' },
          { key: 'growth', label: '学生成长中心', icon: '▤', href: 'student-growth.html' },
          { key: 'mine', label: '我的信息', icon: '▤', href: 'student.html' }
        ] }
      ]
    },
    // 平台管理端：平台内部使用，只做院校创建、院校管理员开通与数据查看
    platform: {
      title: 'AIGC 智慧课堂<br>教学平台 · 平台管理端',
      groups: [
        { key: 'top', label: '', items: [
          { key: 'pv-overview', label: '平台概览', icon: '▤', href: 'platform/overview.html', perms: ['platform:data:view'] }
        ] },
        { label: '院校与账号', items: [
          { key: 'pv-schools', label: '院校管理', icon: '▤', href: 'platform/schools.html', perms: ['platform:school:view'] },
          { key: 'pv-features', label: '功能与配额', icon: '▤', href: 'platform/features.html', perms: ['platform:tenant:grant'], hidden: true },
          { key: 'pv-accounts', label: '院校账号', icon: '▤', href: 'platform/accounts.html', perms: ['platform:account:manage'] }
        ] },
        { label: '平台配置', items: [
          { key: 'pv-menu', label: '菜单管理', icon: '▤', href: 'platform/menu.html', perms: ['platform:menu:manage'] },
          { key: 'pv-dict', label: '字典管理', icon: '▤', href: 'platform/dict.html', perms: ['platform:dict:edit'] },
          { key: 'pv-graph-tpl', label: '图谱模板库', icon: '◇', href: 'platform/graph-templates.html', perms: ['platform:graph-template:manage'] },
          { key: 'pv-staff', label: '平台账号', icon: '▤', href: 'platform/staff.html', perms: ['platform:staff:manage'] },
          { key: 'pv-brand', label: '门户信息管理', icon: '◈', href: 'platform/brand.html' },
          { key: 'pv-audit', label: '平台审计日志', icon: '▤', href: 'platform/audit.html', perms: ['platform:audit:view'] }
        ] }
      ]
    }
  };

  /* ── 菜单语义图标（单色线性 SVG，随主题 currentColor 变色）。
   *   按菜单 key 匹配；端间 key 冲突（tasks/growth）用 portal 前缀区分。
   *   没匹配到的（菜单管理新增的自定义项等）回退到原 icon 字符。 ── */
  function svgI(inner) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>';
  }
  var ICONS = {
    // 管理端 · 顶栏
    dash: svgI('<path d="M5 20v-7"/><path d="M11 20V5"/><path d="M17 20v-10"/><path d="M3.5 20h17"/>'),
    panorama: svgI('<circle cx="12" cy="12" r="8"/><path d="M12 12V4"/><path d="M12 12l5.5 5.7"/>'),
    assess: svgI('<path d="M4.5 17a8 8 0 1 1 15 0"/><path d="M12 15l3.5-5"/><circle cx="12" cy="15" r="1.2" fill="currentColor" stroke="none"/>'),
    // 图谱中心
    'gc-kg': svgI('<circle cx="5.5" cy="6" r="2.3"/><circle cx="18.5" cy="6" r="2.3"/><circle cx="12" cy="18" r="2.3"/><path d="M6.9 7.6l3.9 8.6"/><path d="M17.1 7.6l-3.9 8.6"/><path d="M7.8 6h8.4"/>'),
    'gc-ag': svgI('<path d="M12 2.8l7.5 4.3v9.8L12 21.2l-7.5-4.3V7.1z"/><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/>'),
    'gc-ks': svgI('<path d="M12 6.5C10 5 7.5 4.5 4.5 4.5v13c3 0 5.5.5 7.5 2 2-1.5 4.5-2 7.5-2v-13c-3 0-5.5.5-7.5 2z"/><path d="M12 6.5v13"/>'),
    'gc-mr': svgI('<rect x="3" y="4" width="8" height="8" rx="1.5"/><rect x="13" y="12" width="8" height="8" rx="1.5"/><path d="M11 8.5h4v3.5"/>'),
    'gc-sr': svgI('<path d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8L3.5 9.7l5.9-.9z"/>'),
    'gc-kb': svgI('<ellipse cx="12" cy="5.5" rx="7" ry="2.5"/><path d="M5 5.5v13c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-13"/><path d="M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5"/>'),
    // 管理端 · 账号与角色
    account: svgI('<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19.5c.7-3.2 2.9-4.8 5.5-4.8s4.8 1.6 5.5 4.8"/><circle cx="17" cy="9" r="2.3"/><path d="M16.2 14.9c2.4.4 3.9 1.8 4.4 4.3"/>'),
    role: svgI('<path d="M12 3l7.5 2.6v5.9c0 4.7-3.1 7.5-7.5 9-4.4-1.5-7.5-4.3-7.5-9V5.6z"/><path d="M9.2 11.5l2 2 3.8-4"/>'),
    menu: svgI('<path d="M4 7h8.9"/><path d="M17.5 7H20"/><circle cx="15.2" cy="7" r="2.3"/><path d="M4 17h2.9"/><path d="M11.5 17H20"/><circle cx="9.2" cy="17" r="2.3"/>'),
    // 管理端 · 教务管理
    'edu-major': svgI('<path d="M2.5 9.5L12 5l9.5 4.5L12 14z"/><path d="M6.5 12v4c0 1.3 2.4 2.5 5.5 2.5s5.5-1.2 5.5-2.5v-4"/><path d="M21.5 9.5v4.5"/>'),
    'edu-grade': svgI('<path d="M5 21V4"/><path d="M5 5c4-1.8 8 1.8 14 0v8c-6 1.8-10-1.8-14 0"/>'),
    'edu-class': svgI('<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>'),
    'edu-student': svgI('<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.6 3.4-5.2 7-5.2s6.2 1.6 7 5.2"/>'),
    'edu-period': svgI('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
    'edu-term': svgI('<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17"/><path d="M8 3v4"/><path d="M16 3v4"/>'),
    'edu-course': svgI('<rect x="4.5" y="3.5" width="15" height="17" rx="2"/><path d="M8.5 3.5v17"/><path d="M12 9h4.5"/><path d="M12 13h4.5"/>'),
    'edu-lab': svgI('<path d="M21 8.2L12 3.8 3 8.2v7.6l9 4.4 9-4.4z"/><path d="M3 8.2l9 4.4 9-4.4"/><path d="M12 12.6v8"/>'),
    plan: svgI('<rect x="5" y="4.5" width="14" height="16.5" rx="2"/><rect x="9" y="2.7" width="6" height="3.6" rx="1"/><path d="M9 11h6"/><path d="M9 14.5h6"/><path d="M9 18h4"/>'),
    // 管理端 · 教学达成分析
    'tq-reach': svgI('<path d="M3.5 17.5l5.5-5.5 3.5 3.5 7.5-8"/><path d="M15.5 7.5H20V12"/>'),
    'tq-kps': svgI('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.3"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/>'),
    'tq-improve': svgI('<path d="M9.5 18h5"/><path d="M10.5 21h3"/><path d="M12 3a6.2 6.2 0 0 1 3.8 11.1c-.7.6-1.1 1.4-1.2 2.4H9.4c-.1-1-.5-1.8-1.2-2.4A6.2 6.2 0 0 1 12 3z"/>'),
    // 管理端 · 系统配置
    system: svgI('<rect x="9" y="3" width="6" height="5" rx="1"/><rect x="3" y="16" width="6" height="5" rx="1"/><rect x="15" y="16" width="6" height="5" rx="1"/><path d="M12 8v3.5"/><path d="M6 13.5h12"/><path d="M6 13.5V16"/><path d="M18 13.5V16"/>'),
    college: svgI('<path d="M4 11l8-7.5L20 11"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5.5h4V20"/>'),
    dict: svgI('<rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M9.5 3.5v17"/><path d="M13 8.5h3.5"/><path d="M13 12.5h3.5"/>'),
    sysconf: svgI('<path d="M4 7h8.6"/><path d="M17.4 7H20"/><circle cx="15.1" cy="7" r="2.3"/><path d="M4 17h2.6"/><path d="M11.4 17H20"/><circle cx="8.9" cy="17" r="2.3"/>'),
    audit: svgI('<path d="M14 3H7a1.5 1.5 0 0 0-1.5 1.5v15A1.5 1.5 0 0 0 7 21h10a1.5 1.5 0 0 0 1.5-1.5V7.5z"/><path d="M14 3v4.5h4.5"/><path d="M9 12h6"/><path d="M9 15.5h4"/>'),
    // 教师端
    workbench: svgI('<path d="M4 11l8-7.5L20 11"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5.5h4V20"/>'),
    kmap: svgI('<path d="M3.5 6.2L9 4.5l6 1.5 5.5-1.7v13L15 19l-6-1.5-5.5 1.7z"/><path d="M9 4.5v13"/><path d="M15 6v13"/>'),
    resources: svgI('<path d="M4 20l1.2-4.5L16.5 4.2a2 2 0 0 1 2.8 2.8L8 18.3z"/><path d="M13.8 6.9l2.8 2.8"/>'),
    'teacher.tasks': svgI('<path d="M4 11l8-7.5L20 11"/><path d="M6 9.5V20h12V9.5"/><path d="M10 15h4"/>'),
    'cr-courses': svgI('<path d="M4 5.5h6.5a2 2 0 0 1 2 2V20a1.8 1.8 0 0 0-1.8-1.8H4z"/><path d="M20 5.5h-6.5a2 2 0 0 0-2 2V20a1.8 1.8 0 0 1 1.8-1.8H20z"/>'),
    'cr-tt': svgI('<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17"/><path d="M8 3v4"/><path d="M16 3v4"/><path d="M8 14h3"/><path d="M13 14h3"/><path d="M8 17h3"/>'),
    'cr-eval': svgI('<path d="M4 20l1.2-4.5L16.5 4.2a2 2 0 0 1 2.8 2.8L8 18.3z"/><path d="M13.8 6.9l2.8 2.8"/>'),
    'cr-res': svgI('<path d="M3.5 7.5l8.5-4 8.5 4-8.5 4z"/><path d="M3.5 12l8.5 4 8.5-4"/><path d="M3.5 16.5l8.5 4 8.5-4"/>'),
    'teacher.tasks.old': svgI('<rect x="5" y="4.5" width="14" height="16.5" rx="2"/><rect x="9" y="2.7" width="6" height="3.6" rx="1"/><path d="M9 13.5l2.2 2.2 4-4.5"/>'),
    'teacher.growth': svgI('<circle cx="12" cy="8.7" r="4.6"/><path d="M9 12.5L7.3 21l4.7-2.8L16.7 21 15 12.5"/>'),
    profile: svgI('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10.8" r="2"/><path d="M5.8 16c.5-1.6 1.5-2.4 2.7-2.4s2.2.8 2.7 2.4"/><path d="M14.5 9.5h4"/><path d="M14.5 13h3"/>'),
    // 学生端
    'student.tasks': svgI('<rect x="5" y="4.5" width="14" height="16.5" rx="2"/><rect x="9" y="2.7" width="6" height="3.6" rx="1"/><path d="M9 11h6"/><path d="M9 14.5h6"/>'),
    'student.growth': svgI('<path d="M12 21.5V13"/><path d="M12 13C12 9 9 6.8 4.5 6.8c0 4.5 3 6.2 7.5 6.2z"/><path d="M12 13c0-4 3-6.2 7.5-6.2 0 4.5-3 6.2-7.5 6.2z"/>'),
    mine: svgI('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="9.8" r="2.8"/><path d="M6.2 18.6c1.2-2.5 3.3-3.8 5.8-3.8s4.6 1.3 5.8 3.8"/>'),
    // 平台管理端
    'pv-overview': svgI('<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="4.5" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="11" width="7" height="9.5" rx="1.5"/>'),
    'pv-schools': svgI('<path d="M4 20V9l8-5 8 5v11"/><path d="M4 20h16"/><path d="M9 20v-5h6v5"/><path d="M9 10.5h.01"/><path d="M15 10.5h.01"/>'),
    'pv-accounts': svgI('<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19.5c.7-3.2 2.9-4.8 5.5-4.8s4.8 1.6 5.5 4.8"/><circle cx="17" cy="9" r="2.3"/><path d="M16.2 14.9c2.4.4 3.9 1.8 4.4 4.3"/>'),
    'pv-features': svgI('<path d="M4 7h7"/><path d="M15 7h5"/><circle cx="13" cy="7" r="2.2"/><path d="M4 17h5"/><path d="M13 17h7"/><circle cx="11" cy="17" r="2.2"/>'),
    'pv-dict': svgI('<rect x="4.5" y="3.5" width="15" height="17" rx="2"/><path d="M9 3.5v17"/><path d="M12.5 8.5h4"/><path d="M12.5 12.5h4"/>'),
    'pv-menu': svgI('<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h10"/><circle cx="18.5" cy="18" r="1.4"/>'),
    'pv-graph-tpl': svgI('<circle cx="6" cy="6" r="2.4"/><circle cx="18" cy="7" r="2.4"/><circle cx="12" cy="17.5" r="2.4"/><path d="M8.1 7.2l7.5-.2"/><path d="M7 8.2l3.8 7.2"/><path d="M17 9.2l-3.9 6.3"/>'),
    'pv-audit': svgI('<path d="M14 3H7a1.5 1.5 0 0 0-1.5 1.5v15A1.5 1.5 0 0 0 7 21h10a1.5 1.5 0 0 0 1.5-1.5V7.5z"/><path d="M14 3v4.5h4.5"/><path d="M8.5 12.5l2 2 4-4"/>')
  };
  /* 一级菜单（分组标题）图标：按分组名匹配，与子项图标同一套风格 */
  var GICONS = {
    '图谱中心': svgI('<circle cx="12" cy="12" r="8.5"/><path d="M15 9l-2 4.4-4.4 2 2-4.4z"/>'),
    '账号与角色': svgI('<circle cx="8" cy="15" r="3.2"/><path d="M10.3 12.7L20 3"/><path d="M16.5 6.5L19 9"/><path d="M13.8 9.2l2 2"/>'),
    '教务管理': svgI('<rect x="3.5" y="4" width="17" height="4.5" rx="1"/><path d="M5.3 8.5V19a1.5 1.5 0 0 0 1.5 1.5h10.4a1.5 1.5 0 0 0 1.5-1.5V8.5"/><path d="M10 13h4"/>'),
    '课程计划管理': svgI('<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17"/><path d="M8 3v4"/><path d="M16 3v4"/><path d="M8.8 14.5l2.2 2.2 4.2-4.7"/>'),
    '智慧课堂': svgI('<rect x="3" y="4.5" width="18" height="12" rx="1.8"/><path d="M8 20.5h8"/><path d="M12 16.5v4"/><path d="M8.5 12l2.2-2.8 2 1.8 2.8-3.5"/>'),
    '系统配置': svgI('<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v2.8"/><path d="M12 18.7v2.8"/><path d="M2.5 12h2.8"/><path d="M18.7 12h2.8"/><path d="M5.3 5.3l2 2"/><path d="M16.7 16.7l2 2"/><path d="M18.7 5.3l-2 2"/><path d="M7.3 16.7l-2 2"/>'),
    '院校与账号': svgI('<path d="M3 20.5h18"/><path d="M5 20.5V8l7-4.5L19 8v12.5"/><path d="M9.5 20.5v-5h5v5"/><path d="M9.5 11h.01"/><path d="M14.5 11h.01"/>'),
    '平台配置': svgI('<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v2.8"/><path d="M12 18.7v2.8"/><path d="M2.5 12h2.8"/><path d="M18.7 12h2.8"/><path d="M5.3 5.3l2 2"/><path d="M16.7 16.7l2 2"/><path d="M18.7 5.3l-2 2"/><path d="M7.3 16.7l-2 2"/>')
  };

  /* ── 菜单配置（localStorage）：平台默认 menuConf.default.v1 + 院校本校 menuConf.v1 ──
   *   平台默认是院校的基线；院校可在此基础上改名、排序、隐藏、新增本校占位菜单。
   *   平台禁用的菜单院校不可恢复。
   *   { <portal>: { items: { <key>: {label, icon, order, hidden} }, groups: { <分组名>: {label, order, hidden} }, added: [{key, label, icon, group, order, hidden}] } } */
  var MENU_CONF_KEY = 'menuConf.v1';
  var MENU_CONF_DEFAULT_KEY = 'menuConf.default.v1';
  function readConf(key) { try { return JSON.parse(localStorage.getItem(key)) || {}; } catch (e) { return {}; } }
  function menuConf(scope) { return readConf(scope === 'default' ? MENU_CONF_DEFAULT_KEY : MENU_CONF_KEY); }
  function saveMenuConf(c, scope) {
    try { localStorage.setItem(scope === 'default' ? MENU_CONF_DEFAULT_KEY : MENU_CONF_KEY, JSON.stringify(c)); } catch (e) {}
  }
  // 应用改动后的菜单：base → 平台默认 → 院校本校；withHidden 为 true 时保留已禁用的（菜单管理页用）
  function effectiveMenu(portal, withHidden, scope) {
    var base = MENUS[portal];
    var def = menuConf('default')[portal] || {};
    var sch = scope === 'default' ? {} : (menuConf()[portal] || {});
    var dIo = def.items || {}, sIo = sch.items || {}, dGo = def.groups || {}, sGo = sch.groups || {};
    var groups = base.groups.map(function (g, gi) {
      var gid = g.key || g.label, dg = dGo[gid] || {}, sg = sGo[gid] || {};
      var items = g.items.map(function (it, ii) {
        var x = {}, k; for (k in it) x[k] = it[k];
        var di = dIo[it.key] || {}, si = sIo[it.key] || {};
        if (si.label || di.label) x.label = si.label || di.label;
        if (si.icon || di.icon) { x.icon = si.icon || di.icon; x.iconOverride = true; }
        x.order = si.order != null ? si.order : (di.order != null ? di.order : ii + 1);
        // 平台默认可覆盖内置的隐藏状态；院校只能在平台结果上继续隐藏
        x.platformHidden = di.hidden != null ? di.hidden === true : it.hidden === true;
        x.schoolHidden = si.hidden === true;
        x.hidden = x.platformHidden || x.schoolHidden;
        x.builtin = true; x.group = gid;
        return x;
      });
      // 新增占位菜单：平台默认 + 院校本校，同 key 时院校覆盖名称/排序，禁用取并集
      var added = {}, defKeys = {};
      (def.added || []).forEach(function (a) { added[a.key] = a; defKeys[a.key] = 1; });
      (sch.added || []).forEach(function (a) {
        var prev = added[a.key];
        added[a.key] = prev ? Object.assign({}, prev, a, { hidden: !!(prev.hidden || a.hidden) }) : a;
      });
      Object.keys(added).forEach(function (k) {
        var a = added[k];
        if (a.group !== gid) return;
        items.push({ key: a.key, label: a.label, icon: a.icon || '▤', empty: true, order: a.order || items.length + 1, hidden: !!a.hidden, builtin: false, defaultAdded: !!defKeys[k], group: gid });
      });
      items.sort(function (x, y) { return x.order - y.order; });
      return {
        id: gid, label: g.label, name: sg.label || dg.label || g.label,
        order: sg.order != null ? sg.order : (dg.order != null ? dg.order : gi + 1),
        hidden: !!(dg.hidden === true || sg.hidden === true),
        platformHidden: dg.hidden === true,
        schoolHidden: sg.hidden === true,
        items: withHidden ? items : items.filter(function (it) { return !it.hidden; })
      };
    });
    groups.sort(function (x, y) { return x.order - y.order; });
    var title = base.title, sc = sysConfActive();
    if (sc && portal !== 'admin' && sc[portal] && sc[portal].logoName) title = esc(sc[portal].logoName) + '<br>' + (portal === 'teacher' ? '教师端' : '学生端');
    return { title: title, groups: withHidden ? groups : groups.filter(function (g) { return !g.hidden; }) };
  }
  /* 平台品牌配置（localStorage sysConf.v1）里启用的版本：教师端 / 学生端 Logo 名称显示在侧栏顶部 */
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

  /* ── 院校功能开关：平台端在 platform.v1 里为演示院校配置，关闭后隐藏对应菜单 ── */
  var PLATFORM_KEY = 'platform.v1';
  function schoolFeature(key) {
    try {
      var s = JSON.parse(localStorage.getItem(PLATFORM_KEY));
      var demo = ((s && s.schools) || []).find(function (x) { return x.demo; });
      if (!demo || !demo.features) return true;
      return demo.features[key] !== false;
    } catch (e) { return true; }
  }

  /* ── 菜单项是否对当前身份可见 ── */
  function itemVisible(ctx, identity, item) {
    if (item.feature && !schoolFeature(item.feature)) return false;
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
    // 二级菜单的图标对齐一级菜单的文字起点（一级：图标 15px + 间距 8px）
    '#lnav .lg-fold .lmenu{padding-left:33px;gap:8px}' +
    // 没有下级的一级菜单（数据概览、工作台等）和有下级的一级菜单同样式：字号、字重、颜色、间距一致
    '#lnav .lgroup.lg-top{padding:2px 10px}' +
    '#lnav .lg-top .lmenu{font-weight:600;color:var(--ink);gap:8px}' +
    '#lnav .lg-top .lmenu.on{color:var(--brand-ink)}' +
    '#lnav .lg-fold.closed .litems{display:none}' +
    '@media (max-width:1000px){#lnav .lgt.lfold{display:none}#lnav .litems{display:contents!important}#lnav .lg-fold .lmenu{padding-left:10px}}';
  var FOLD_KEY = 'navFold.v1';
  function foldState() { try { return JSON.parse(localStorage.getItem(FOLD_KEY)) || {}; } catch (e) { return {}; } }
  function saveFold(s) { try { localStorage.setItem(FOLD_KEY, JSON.stringify(s)); } catch (e) {} }
  var LUSER_CSS = FOLD_CSS +
    // 菜单语义图标（SVG）：铺满 .lmenu i / .lgt i 的图标盒，颜色随 currentColor 走主题
    '.lmenu i svg,.lgt.lfold i svg{width:100%;height:100%;display:block}' +
    '#lnav .lgt.lfold i{width:15px;height:15px;flex:0 0 15px;display:block;opacity:.75}' +
    '.luser{margin-top:auto;display:flex;align-items:center;gap:9px;padding:12px 14px 12px 18px;border-top:1px solid var(--rule-2)}' +
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
      html += '<div class="lgroup' + (group.label ? ' lg-fold' : ' lg-top') + (closed ? ' closed' : '') + (hasOn ? ' has-on' : '') + '">';
      if (group.label) html += '<button type="button" class="lgt lfold" data-fold="' + esc(fk) + '" aria-expanded="' + !closed + '"><i>' + (GICONS[group.name] || GICONS[group.label] || '') + '</i><span class="lfn">' + esc(group.name || group.label) + '</span><span class="lfc" aria-hidden="true">▾</span></button><div class="litems">';
      group.items.forEach(function (it) {
        var vis = itemVisible(ctx, identity, it);
        if (!vis) return;
        var on = it.key === active;
        var cls = 'lmenu' + (on ? ' on' : '');
        var ic = !it.iconOverride && (ICONS[portal + '.' + it.key] || ICONS[it.key]);
        var inner = '<i>' + (ic || esc(it.icon)) + '</i>' + esc(it.label);
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
      '<button type="button" class="lout" data-logout>退出登录</button></div>' +
      '<div class="lfoot" id="lfoot"></div>';
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
    // 当前页面对应的功能模块被平台关闭时，跳回该端首页（防止直接输 URL 绕过）
    if (_config.active) {
      var pageItem = null;
      effectiveMenu(_config.portal).groups.forEach(function (g) {
        g.items.forEach(function (it) { if (it.key === _config.active) pageItem = it; });
      });
      if (pageItem && pageItem.feature && !schoolFeature(pageItem.feature)) {
        location.replace(link(abs(firstPage(ctx, identity, _config.portal))));
        return;
      }
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
