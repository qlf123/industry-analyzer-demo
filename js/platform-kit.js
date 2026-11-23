/* 平台管理端 · 院校注册表与统计
 * 数据存 localStorage platform.v1：院校清单 + 平台侧审计 + 院校管理员账号。
 * 说明：本原型不做院校级数据隔离（生产由技术层处理）。
 *   现有演示院校（demo:true）的统计实时从 DEMO / TK 读取；新建院校为空白骨架，统计为 0。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(root);
  else root.PF = factory(root);
}(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';

  var KEY = 'platform.v1';
  var VERSION = 5;
  var INITIAL_PASSWORD = '123456';

  /* 院校功能模块：key 与 common.js 菜单项的 feature 标记一一对应 */
  var FEATURE_DEFS = [
    { key: 'industry', name: '行业分析', desc: '行业分析页面（管理端）' },
    { key: 'graph', name: '图谱中心', desc: '知识库、能力图谱、知识体系、映射审核、知识图谱、图谱建议审核' },
    { key: 'majorAssess', name: '专业建设测评', desc: '管理端专业建设测评' },
    { key: 'quality', name: '教学质量', desc: '管理端教学达成' }
  ];

  function defaultFeatures() {
    var f = {};
    FEATURE_DEFS.forEach(function (x) { f[x.key] = true; });
    return f;
  }
  function normalizeFeatures(f) {
    var out = defaultFeatures();
    Object.keys(out).forEach(function (k) { if (f && f[k] === false) out[k] = false; });
    return out;
  }

  /* ── 图谱模板：平台维护公共 / 行业模板，院校后续按模板引用（本期仅平台侧） ──
   * 节点与关系类型沿用院校端图谱中心的视觉语言，数据完全独立，不读写院校端图谱。 */
  var TEMPLATE_INDUSTRIES = ['旅游业', '电商行业', '酒店管理', '物流行业'];
  var TEMPLATE_SCOPES = ['公共', '行业'];
  var TEMPLATE_STATUSES = ['草稿', '启用', '停用'];
  var TEMPLATE_NODE_TYPES = [
    { type: '岗位', group: '能力图谱', color: '#0e9f9f' },
    { type: '能力项', group: '能力图谱', color: '#5cdbd3' },
    { type: '课程', group: '知识体系', color: '#722ed1' },
    { type: '任务', group: '知识体系', color: '#fa8c16' },
    { type: '技能', group: '知识体系', color: '#1890ff' },
    { type: '知识点', group: '知识体系', color: '#52c41a' },
    { type: '赛项', group: '标准库', color: '#c72c2a' },
    { type: '证书', group: '标准库', color: '#d48806' },
    { type: '考核要求', group: '标准库', color: '#ff9c6e' }
  ];
  var TEMPLATE_EDGE_KINDS = [
    { kind: 'contain', name: '包含' },
    { kind: 'map', name: '能力映射' },
    { kind: 'std', name: '标准对应' }
  ];

  function pad(n, w) { return String(n).padStart(w, '0'); }
  function fmt(d) {
    d = d instanceof Date ? d : new Date(d);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1, 2) + '-' + pad(d.getDate(), 2) +
      ' ' + pad(d.getHours(), 2) + ':' + pad(d.getMinutes(), 2);
  }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }

  function daysAgo(n) {
    var d = new Date();
    d.setDate(d.getDate() - n);
    return fmt(d);
  }
  function dateOf(s) {
    var p = String(s || '').slice(0, 10).split('-');
    return p.length === 3 ? new Date(+p[0], +p[1] - 1, +p[2]) : null;
  }

  /* ── 演示院校：用于开通趋势、地区分布、活跃排行 ── */
  function demoSeeds() {
    return [
      {
        seedKey: 'DEMO-JN', id: 'SCH-002', name: '江南旅游职业学院', short: '江南旅院',
        code: 'JNLY-2026', region: '江苏 南京', contact: '周敏', phone: '13800000102',
        status: '启用', createdAt: daysAgo(160), createdBy: '平台超管',
        admin: { name: '王敏', phone: '13800000102', accountId: 'ACC-S2-ADMIN' },
        lastActiveAt: daysAgo(1), demo: false,
        features: { industry: true, graph: true, majorAssess: true, quality: false },
        aiQuota: 320,
        snapshot: { accounts: 86, teachers: 42, admins: 3, students: 1260, orgs: 12, majors: 4, klasses: 18, plans: 36, lessons: 120, resources: 64, active7: 38 }
      },
      {
        seedKey: 'DEMO-NB', id: 'SCH-003', name: '海港酒店管理职业学院', short: '海港旅院',
        code: 'HGHY-2026', region: '浙江 宁波', contact: '陈涛', phone: '13800000103',
        status: '启用', createdAt: daysAgo(118), createdBy: '平台超管',
        admin: { name: '陈涛', phone: '13800000103', accountId: 'ACC-S3-ADMIN' },
        lastActiveAt: daysAgo(3), demo: false,
        features: { industry: true, graph: true, majorAssess: false, quality: true },
        aiQuota: 260,
        snapshot: { accounts: 64, teachers: 31, admins: 2, students: 860, orgs: 9, majors: 3, klasses: 14, plans: 28, lessons: 96, resources: 51, active7: 27 }
      },
      {
        seedKey: 'DEMO-CD', id: 'SCH-004', name: '西南文旅技师学院', short: '西南文旅',
        code: 'XNWL-2026', region: '四川 成都', contact: '李静', phone: '13800000104',
        status: '启用', createdAt: daysAgo(76), createdBy: '平台超管',
        admin: { name: '', phone: '', accountId: '' },
        lastActiveAt: daysAgo(5), demo: false,
        features: { industry: false, graph: true, majorAssess: false, quality: true },
        aiQuota: 0,
        snapshot: { accounts: 52, teachers: 25, admins: 0, students: 720, orgs: 8, majors: 3, klasses: 12, plans: 22, lessons: 78, resources: 40, active7: 19 }
      },
      {
        seedKey: 'DEMO-QD', id: 'SCH-005', name: '北方文旅职业学院', short: '北方旅院',
        code: 'BFWL-2026', region: '山东 青岛', contact: '赵磊', phone: '13800000105',
        status: '停用', createdAt: daysAgo(40), createdBy: '平台超管',
        admin: { name: '赵磊', phone: '13800000105', accountId: 'ACC-S5-ADMIN' },
        lastActiveAt: daysAgo(35), demo: false,
        features: { industry: true, graph: true, majorAssess: true, quality: true },
        aiQuota: 180,
        snapshot: { accounts: 40, teachers: 18, admins: 2, students: 540, orgs: 7, majors: 3, klasses: 10, plans: 18, lessons: 60, resources: 32, active7: 0 }
      }
    ];
  }

  /* ── 演示图谱模板：默认三条，供模板库与平台概览展示 ── */
  function seedTemplates() {
    return [
      {
        id: 'GT-001',
        name: '旅游业 · 岗位能力图谱',
        industry: '旅游业',
        scope: '行业',
        desc: '面向旅游管理、导游专业的岗位能力与课程知识点模板',
        status: '启用',
        nodes: [
          { id: 'n1', name: '导游', type: '岗位', x: 150, y: 140 },
          { id: 'n2', name: '景点讲解', type: '能力项', x: 390, y: 90 },
          { id: 'n3', name: '带团组织协调', type: '能力项', x: 390, y: 200 },
          { id: 'n4', name: '导游业务', type: '课程', x: 150, y: 400 },
          { id: 'n5', name: '景点讲解服务', type: '任务', x: 390, y: 400 },
          { id: 'n6', name: '讲解词撰写', type: '技能', x: 640, y: 340 },
          { id: 'n7', name: '讲解基本要求', type: '知识点', x: 900, y: 300 },
          { id: 'n8', name: '讲解技巧运用', type: '技能', x: 640, y: 460 },
          { id: 'n9', name: '讲解策略', type: '知识点', x: 900, y: 460 }
        ],
        edges: [
          { id: 'e1', source: 'n1', target: 'n2', kind: 'contain' },
          { id: 'e2', source: 'n1', target: 'n3', kind: 'contain' },
          { id: 'e3', source: 'n4', target: 'n5', kind: 'contain' },
          { id: 'e4', source: 'n5', target: 'n6', kind: 'contain' },
          { id: 'e5', source: 'n5', target: 'n8', kind: 'contain' },
          { id: 'e6', source: 'n6', target: 'n7', kind: 'contain' },
          { id: 'e7', source: 'n8', target: 'n9', kind: 'contain' },
          { id: 'e8', source: 'n2', target: 'n6', kind: 'map' }
        ],
        createdAt: daysAgo(12),
        updatedAt: daysAgo(1),
        updatedBy: '平台超管'
      },
      {
        id: 'GT-002',
        name: '酒店管理 · 前厅服务能力模板',
        industry: '酒店管理',
        scope: '行业',
        desc: '前厅接待岗位的核心能力与课程支撑关系',
        status: '草稿',
        nodes: [
          { id: 'n1', name: '前厅接待员', type: '岗位', x: 150, y: 140 },
          { id: 'n2', name: '入住与退房办理', type: '能力项', x: 390, y: 90 },
          { id: 'n3', name: '宾客投诉处理', type: '能力项', x: 390, y: 200 },
          { id: 'n4', name: '前厅服务与管理', type: '课程', x: 150, y: 400 },
          { id: 'n5', name: '入住接待', type: '任务', x: 390, y: 400 },
          { id: 'n6', name: '入住登记办理', type: '技能', x: 640, y: 340 },
          { id: 'n7', name: '证件查验规范', type: '知识点', x: 900, y: 300 },
          { id: 'n8', name: '投诉受理与处理', type: '技能', x: 640, y: 460 },
          { id: 'n9', name: '投诉处理流程', type: '知识点', x: 900, y: 460 }
        ],
        edges: [
          { id: 'e1', source: 'n1', target: 'n2', kind: 'contain' },
          { id: 'e2', source: 'n1', target: 'n3', kind: 'contain' },
          { id: 'e3', source: 'n4', target: 'n5', kind: 'contain' },
          { id: 'e4', source: 'n5', target: 'n6', kind: 'contain' },
          { id: 'e5', source: 'n6', target: 'n7', kind: 'contain' },
          { id: 'e6', source: 'n3', target: 'n8', kind: 'map' },
          { id: 'e7', source: 'n8', target: 'n9', kind: 'contain' }
        ],
        createdAt: daysAgo(6),
        updatedAt: daysAgo(2),
        updatedBy: '平台超管'
      },
      {
        id: 'GT-003',
        name: '公共 · 服务礼仪基础',
        industry: '旅游业',
        scope: '公共',
        desc: '各专业通用的服务礼仪与规范基础模板',
        status: '启用',
        nodes: [
          { id: 'n1', name: '服务礼仪', type: '课程', x: 150, y: 140 },
          { id: 'n2', name: '接待礼仪', type: '任务', x: 390, y: 140 },
          { id: 'n3', name: '迎送礼仪', type: '技能', x: 640, y: 140 },
          { id: 'n4', name: '礼仪基本规范', type: '知识点', x: 900, y: 140 },
          { id: 'n5', name: '服务意识', type: '能力项', x: 390, y: 380 },
          { id: 'n6', name: '主动服务', type: '技能', x: 640, y: 380 },
          { id: 'n7', name: '服务规范', type: '知识点', x: 900, y: 380 }
        ],
        edges: [
          { id: 'e1', source: 'n1', target: 'n2', kind: 'contain' },
          { id: 'e2', source: 'n2', target: 'n3', kind: 'contain' },
          { id: 'e3', source: 'n3', target: 'n4', kind: 'contain' },
          { id: 'e4', source: 'n5', target: 'n6', kind: 'contain' },
          { id: 'e5', source: 'n6', target: 'n7', kind: 'contain' }
        ],
        createdAt: daysAgo(20),
        updatedAt: daysAgo(5),
        updatedBy: '平台超管'
      }
    ];
  }

  /* ── 院校账号（一个院校可多个；school.admin 作为首个账号的兼容别名） ── */
  function defaultAccountId(schoolId) {
    return 'ACC-' + String(schoolId || '').replace('SCH-', 'S') + '-ADMIN';
  }
  function acctFromAdmin(a, school) {
    a = a || {};
    return {
      accountId: a.accountId || defaultAccountId(school && school.id),
      name: String(a.name || '').trim(),
      phone: String(a.phone || '').trim(),
      initPassword: a.initPassword || INITIAL_PASSWORD,
      status: '启用',
      platformProvisioned: true,
      createdAt: (school && school.createdAt) || '',
      createdBy: (school && school.createdBy) || ''
    };
  }
  function ensureAccounts(school) {
    if (!Array.isArray(school.accounts)) {
      school.accounts = (school.admin && school.admin.name) ? [acctFromAdmin(school.admin, school)] : [];
    }
    school.admin = school.accounts[0] || null; // 兼容旧展示逻辑
    return school.accounts;
  }
  function accountsOf(school) {
    if (!school) return [];
    return ensureAccounts(school);
  }

  function addDemoSchools(s) {
    demoSeeds().forEach(function (d) {
      if (s.schools.some(function (x) { return x.seedKey === d.seedKey; })) return;
      if (s.schools.some(function (x) { return x.id === d.id; })) d.id = nextId(s.schools);
      s.schools.push(d);
    });
    var main = s.schools.find(function (x) { return x.id === 'SCH-001'; });
    if (main && !main.snapshot) main.snapshot = { active7: 36 };
    if (!Array.isArray(s.audits)) s.audits = [];
    if (!s.audits.length) {
      s.audits.push(
        { id: 'PA-SEED-1', at: daysAgo(0), actor: '平台超管', action: '更新功能与配额', object: '江南旅游职业学院', detail: '已开通：行业分析、图谱中心、专业建设测评；AI 配额 320' },
        { id: 'PA-SEED-2', at: daysAgo(1), actor: '平台超管', action: '开通院校管理员', object: '海港酒店管理职业学院', detail: '管理员 陈涛' },
        { id: 'PA-SEED-3', at: daysAgo(3), actor: '平台超管', action: '创建院校', object: '北方文旅职业学院', detail: '编码 BFWL-2026' }
      );
    }
  }

  function emptyStats() {
    return { accounts: 0, teachers: 0, admins: 0, students: 0, orgs: 0, majors: 0, klasses: 0, plans: 0, lessons: 0, resources: 0 };
  }

  /* ── 默认注册表：把现有演示院校登记为 SCH-001 ── */
  function seed() {
    var name = '某职业技术学院', short = '', code = '', region = '', contact = '', phone = '';
    try {
      var c = JSON.parse(localStorage.getItem('college.v1'));
      if (c) {
        name = c.name || name;
        short = c.short || '';
        code = c.code || '';
        region = [c.province, c.city].filter(Boolean).join(' ');
        contact = c.contact || '';
        phone = c.phone || '';
      }
    } catch (e) {}
    var admin = { name: '超管', phone: '13800000001', accountId: 'ACC-SUPER' };
    try {
      var st = root && root.DEMO && root.DEMO.getState();
      if (st) {
        var rootOrg = (st.orgs || []).find(function (o) { return o.id === 'ORG-ROOT'; });
        if (!code && rootOrg) name = rootOrg.name || name;
        var acc = (st.accounts || []).find(function (a) { return a.id === 'ACC-SUPER'; });
        if (acc) admin = { name: acc.name, phone: acc.phone, accountId: acc.id };
      }
    } catch (e) {}
    var s = {
      v: VERSION,
      schools: [{
        id: 'SCH-001',
        name: name,
        short: short,
        code: code || 'DEMO-001',
        region: region,
        contact: contact,
        phone: phone,
        status: '启用',
        createdAt: '2024-09-01',
        createdBy: '系统',
        admin: admin,
        lastActiveAt: fmt(new Date()),
        demo: true,
        features: defaultFeatures(),
        aiQuota: 500,
        snapshot: { active7: 36 }
      }],
      audits: [],
      graphTemplates: seedTemplates()
    };
    addDemoSchools(s);
    return s;
  }

  function save(s) {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
    return s;
  }

  function state() {
    var s = null;
    try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
    if (s && s.v >= 1 && s.v !== VERSION && Array.isArray(s.schools)) {
      // v1 → v2：给存量院校补功能开关与 AI 配额，不重置已创建的院校
      if (s.v === 1) {
        s.schools.forEach(function (x) {
          x.features = normalizeFeatures(x.features);
          if (x.aiQuota == null) x.aiQuota = x.demo ? 500 : 100;
        });
      }
      // v2 → v3：补充演示院校与活跃快照，用于平台概览趋势和排行
      addDemoSchools(s);
      // v3 → v4：单管理员 admin 迁移为 accounts 数组（支持一校多账号）
      s.schools.forEach(ensureAccounts);
      // v4 → v5：补平台图谱模板库（不重置存量院校）
      if (!Array.isArray(s.graphTemplates)) s.graphTemplates = seedTemplates();
      s.v = VERSION;
      save(s);
    }
    if (!s || s.v !== VERSION || !Array.isArray(s.schools)) s = save(seed());
    s.schools.forEach(ensureAccounts);
    if (!Array.isArray(s.audits)) s.audits = [];
    if (!Array.isArray(s.graphTemplates)) s.graphTemplates = seedTemplates();
    return s;
  }

  function list() { return state().schools; }
  function byId(id) { return list().find(function (s) { return s.id === id; }) || null; }

  function nextId(schools) {
    var max = 0;
    schools.forEach(function (s) {
      var m = /^SCH-(\d+)$/.exec(s.id);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    return 'SCH-' + pad(max + 1, 3);
  }

  function audit(s, actor, action, object, detail) {
    s.audits.unshift({ id: 'PA-' + Date.now().toString(36), at: fmt(new Date()), actor: actor || '', action: action, object: object || '', detail: detail || '' });
    if (s.audits.length > 200) s.audits.length = 200;
  }

  /* ── 院校维护 ── */
  function create(data, actor) {
    var s = state();
    var id = nextId(s.schools);
    var admin = data.admin || {};
    var now = fmt(new Date());
    var firstAcct = {
      accountId: String(admin.accountId || '').trim() || defaultAccountId(id),
      name: String(admin.name || '').trim(),
      phone: String(admin.phone || '').trim(),
      initPassword: String(admin.initPassword || '').trim() || INITIAL_PASSWORD,
      status: '启用',
      platformProvisioned: true,
      createdAt: now,
      createdBy: actor || ''
    };
    var hasAdmin = !!(admin.name || admin.accountId || admin.phone || admin.initPassword);
    var school = {
      id: id,
      name: String(data.name || '').trim(),
      short: String(data.short || '').trim(),
      code: String(data.code || '').trim(),
      region: String(data.region || '').trim(),
      address: String(data.address || '').trim(),
      contact: String(data.contact || '').trim(),
      phone: String(data.phone || '').trim(),
      type: Array.isArray(data.type) ? data.type.slice() : [],
      nature: String(data.nature || '').trim(),
      email: String(data.email || '').trim(),
      intro: String(data.intro || '').trim(),
      status: '启用',
      createdAt: now,
      createdBy: actor || '',
      accounts: hasAdmin ? [firstAcct] : [],
      admin: hasAdmin ? firstAcct : null, // 兼容旧展示
      lastActiveAt: '',
      demo: false,
      features: defaultFeatures(),
      aiQuota: 100
    };
    s.schools.push(school);
    audit(s, actor, '创建院校', school.name, '编码 ' + school.code + (school.admin && school.admin.name ? '；管理员 ' + school.admin.name : '；未开通管理员'));
    save(s);
    syncAdminAccount(school);
    return school;
  }

  function update(id, patch, actor) {
    var s = state();
    var school = s.schools.find(function (x) { return x.id === id; });
    if (!school) return null;
    ['name', 'short', 'code', 'region', 'address', 'contact', 'phone', 'nature', 'email', 'intro'].forEach(function (k) {
      if (patch[k] != null) school[k] = String(patch[k]).trim();
    });
    if (patch.type != null) school.type = Array.isArray(patch.type) ? patch.type.slice() : [];
    if (patch.admin) {
      ensureAccounts(school);
      if (!school.accounts.length) school.accounts.push(acctFromAdmin({}, school));
      var a0 = school.accounts[0];
      if (patch.admin.name != null) a0.name = String(patch.admin.name).trim();
      if (patch.admin.phone != null) a0.phone = String(patch.admin.phone).trim();
      if (!a0.accountId) a0.accountId = defaultAccountId(id);
      school.admin = a0;
    }
    audit(s, actor, '编辑院校', school.name, '');
    save(s);
    return school;
  }

  function setStatus(id, status, actor) {
    var s = state();
    var school = s.schools.find(function (x) { return x.id === id; });
    if (!school) return null;
    school.status = status;
    audit(s, actor, status === '启用' ? '启用院校' : '停用院校', school.name, '');
    save(s);
    return school;
  }

  /* ── 院校账号同步进账号池（平台预置、受保护，院校不可停用/删除） ── */
  function syncAdminAccount(school) {
    if (!school || !root.DEMO) return;
    var accts = accountsOf(school).filter(function (a) { return a && a.accountId; });
    if (!accts.length) return;
    var st = root.DEMO.getState();
    accts.forEach(function (acct) {
      var accId = acct.accountId;
      var existing = (st.accounts || []).find(function (a) { return a.id === accId; });
      var demoStatus = acct.status === '停用' ? '停用' : '正常';
      if (existing) {
        existing.name = String(acct.name || existing.name || '').trim();
        existing.phone = String(acct.phone || existing.phone || '').trim();
        existing.kind = '院校超级管理员';
        existing.platformProvisioned = true;
        existing.status = demoStatus;
      } else {
        (st.accounts || []).push({
          id: accId,
          name: String(acct.name || '').trim(),
          orgId: 'ORG-ROOT',
          kind: '院校超级管理员',
          platformProvisioned: true,
          status: demoStatus,
          studentId: null,
          phone: String(acct.phone || '').trim(),
          lastLoginAt: null,
          createdAt: fmt(new Date()),
          createdBy: '平台超管',
          updatedAt: fmt(new Date()),
          updatedBy: '平台超管'
        });
      }
      var assigns = st.assignments || [];
      var hasSuper = assigns.some(function (x) { return x.accountId === accId && x.roleId === 'R-SUPER'; });
      if (!hasSuper) {
        assigns.push({
          id: 'A-' + accId.replace(/[^0-9]/g, '') + '-S',
          accountId: accId,
          roleId: 'R-SUPER',
          scopeOrgIds: ['ORG-ROOT'],
          scopeGrades: {},
          scopeClassIds: [],
          teachingScope: { majorIds: [], classIds: [], courseIds: [] },
          extraPermIds: []
        });
      }
    });
    root.DEMO.saveState(st);
  }

  /* ── 院校账号维护（一校多账号） ── */
  function addAccount(schoolId, data, actor) {
    var s = state();
    var school = s.schools.find(function (x) { return x.id === schoolId; });
    if (!school) return null;
    ensureAccounts(school);
    var acct = {
      accountId: String(data.accountId || '').trim() || ('ACC-' + schoolId.replace('SCH-', 'S') + '-' + (school.accounts.length + 1)),
      name: String(data.name || '').trim(),
      phone: String(data.phone || '').trim(),
      initPassword: String(data.initPassword || '').trim() || INITIAL_PASSWORD,
      status: '启用',
      platformProvisioned: true,
      createdAt: fmt(new Date()),
      createdBy: actor || ''
    };
    if (!acct.name) return null;
    school.accounts.push(acct);
    if (!school.admin) school.admin = acct;
    audit(s, actor, '新建院校账号', school.name, '账号 ' + acct.name + '（' + acct.accountId + '）');
    save(s);
    syncAdminAccount(school);
    return acct;
  }

  function updateAccount(schoolId, accountId, patch, actor) {
    var s = state();
    var school = s.schools.find(function (x) { return x.id === schoolId; });
    if (!school) return null;
    var acct = accountsOf(school).find(function (a) { return a.accountId === accountId; });
    if (!acct) return null;
    if (patch.name != null) acct.name = String(patch.name).trim();
    if (patch.phone != null) acct.phone = String(patch.phone).trim();
    if (patch.initPassword != null && String(patch.initPassword).trim()) acct.initPassword = String(patch.initPassword).trim();
    audit(s, actor, '编辑院校账号', school.name, '账号 ' + acct.name + '（' + acct.accountId + '）');
    save(s);
    syncAdminAccount(school);
    return acct;
  }

  function setAccountStatus(schoolId, accountId, status, actor) {
    var s = state();
    var school = s.schools.find(function (x) { return x.id === schoolId; });
    if (!school) return null;
    var acct = accountsOf(school).find(function (a) { return a.accountId === accountId; });
    if (!acct) return null;
    acct.status = status === '停用' ? '停用' : '启用';
    audit(s, actor, acct.status === '停用' ? '停用院校账号' : '启用院校账号', school.name, '账号 ' + acct.name + '（' + acct.accountId + '）');
    save(s);
    syncAdminAccount(school);
    return acct;
  }

  function resetAccountPassword(schoolId, accountId, actor) {
    var s = state();
    var school = s.schools.find(function (x) { return x.id === schoolId; });
    if (!school) return null;
    var acct = accountsOf(school).find(function (a) { return a.accountId === accountId; });
    if (!acct) return null;
    acct.initPassword = INITIAL_PASSWORD;
    audit(s, actor, '重置院校账号密码', school.name, '账号 ' + acct.name + '（' + acct.accountId + '）');
    save(s);
    return acct;
  }

  function allAccounts() {
    var out = [];
    list().forEach(function (s) {
      accountsOf(s).forEach(function (a) { out.push({ school: s, account: a }); });
    });
    return out;
  }

  /* 兼容旧接口：按院校维护首个账号 */
  function setAdmin(id, admin, actor) {
    var s = state();
    var school = s.schools.find(function (x) { return x.id === id; });
    if (!school) return null;
    ensureAccounts(school);
    if (!school.accounts.length) school.accounts.push(acctFromAdmin({}, school));
    var a0 = school.accounts[0];
    a0.name = String(admin.name || '').trim();
    a0.phone = String(admin.phone || '').trim();
    if (!a0.accountId) a0.accountId = defaultAccountId(id);
    school.admin = a0;
    school.lastActiveAt = school.lastActiveAt || '';
    audit(s, actor, '开通院校管理员', school.name, '管理员 ' + a0.name);
    save(s);
    syncAdminAccount(school);
    return school;
  }

  function resetPassword(id, actor) {
    var s = state();
    var school = s.schools.find(function (x) { return x.id === id; });
    if (!school) return null;
    var a0 = accountsOf(school)[0];
    if (a0) a0.initPassword = INITIAL_PASSWORD;
    audit(s, actor, '重置管理员密码', school.name, '已重置为初始密码');
    save(s);
    return school;
  }

  /* ── 院校功能与配额 ── */
  function featuresOf(school) {
    return normalizeFeatures(school && school.features);
  }
  function quotaOf(school) {
    return school && school.aiQuota != null ? Number(school.aiQuota) : 0;
  }
  function updateFeatures(id, patch, actor) {
    var s = state();
    var school = s.schools.find(function (x) { return x.id === id; });
    if (!school) return null;
    school.features = normalizeFeatures(Object.assign({}, school.features, patch.features || {}));
    if (patch.aiQuota != null) school.aiQuota = Math.max(0, Math.round(Number(patch.aiQuota) || 0));
    var on = FEATURE_DEFS.filter(function (x) { return school.features[x.key]; }).map(function (x) { return x.name; }).join('、');
    audit(s, actor, '更新功能与配额', school.name, '已开通：' + (on || '无') + '；AI 配额 ' + school.aiQuota);
    save(s);
    return school;
  }

  /* 平台审计：供字典等平台侧操作补记 */
  function log(actor, action, object, detail) {
    var s = state();
    audit(s, actor, action, object, detail);
    save(s);
  }

  /* ── 图谱模板库 ── */
  function templates() { return state().graphTemplates; }

  function templateById(id) {
    return templates().find(function (t) { return t.id === id; }) || null;
  }

  function nextTemplateId(list) {
    var max = 0;
    list.forEach(function (t) {
      var m = /^GT-(\d+)$/.exec(t.id);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    return 'GT-' + pad(max + 1, 3);
  }

  function normTemplateStatus(s) {
    return TEMPLATE_STATUSES.indexOf(s) >= 0 ? s : '草稿';
  }

  /* 新建或编辑模板；data.nodes / data.edges 传入时整体覆盖（编辑器保存用） */
  function saveGraphTemplate(data, actor) {
    data = data || {};
    if (data.name != null && !String(data.name).trim()) return null;
    if (!data.id && !String(data.name || '').trim()) return null;
    var s = state();
    var tpl = data.id ? s.graphTemplates.find(function (t) { return t.id === data.id; }) : null;
    var isNew = !tpl;
    var now = fmt(new Date());
    if (!tpl) {
      tpl = {
        id: nextTemplateId(s.graphTemplates), name: '', industry: '', scope: '公共', desc: '',
        status: '草稿', nodes: [], edges: [], createdAt: now, updatedAt: now, updatedBy: ''
      };
      s.graphTemplates.push(tpl);
    }
    ['name', 'industry', 'scope', 'desc'].forEach(function (k) {
      if (data[k] != null) tpl[k] = String(data[k]).trim();
    });
    if (TEMPLATE_SCOPES.indexOf(tpl.scope) < 0) tpl.scope = '公共';
    if (data.status != null) tpl.status = normTemplateStatus(data.status);
    if (Array.isArray(data.nodes)) tpl.nodes = clone(data.nodes);
    if (Array.isArray(data.edges)) tpl.edges = clone(data.edges);
    tpl.updatedAt = now;
    tpl.updatedBy = actor || tpl.updatedBy || '';
    audit(s, actor, isNew ? '新建图谱模板' : '编辑图谱模板', tpl.name,
      (tpl.industry || '未填行业') + ' · ' + tpl.scope + ' · 节点 ' + (tpl.nodes || []).length + ' / 关系 ' + (tpl.edges || []).length);
    save(s);
    return tpl;
  }

  function setTemplateStatus(id, status, actor) {
    var s = state();
    var tpl = s.graphTemplates.find(function (t) { return t.id === id; });
    if (!tpl) return null;
    tpl.status = normTemplateStatus(status);
    tpl.updatedAt = fmt(new Date());
    tpl.updatedBy = actor || tpl.updatedBy || '';
    audit(s, actor, tpl.status === '启用' ? '启用图谱模板' : '停用图谱模板', tpl.name, '');
    save(s);
    return tpl;
  }

  function templateStats() {
    var all = templates();
    var industries = [];
    all.forEach(function (t) { if (t.industry && industries.indexOf(t.industry) < 0) industries.push(t.industry); });
    var active = list().filter(function (x) { return x.status === '启用'; });
    var graphOn = active.filter(function (x) { return featuresOf(x).graph; }).length;
    return {
      total: all.length,
      enabled: all.filter(function (t) { return t.status === '启用'; }).length,
      draft: all.filter(function (t) { return t.status === '草稿'; }).length,
      industries: industries,
      graphOn: graphOn,
      activeSchools: active.length
    };
  }

  /* ── 统计 ── */
  function stats(school) {
    var out = emptyStats();
    if (!school) return out;
    if (!school.demo) {
      if (school.snapshot) Object.keys(out).forEach(function (k) { out[k] = Math.max(0, Number(school.snapshot[k]) || 0); });
      return out;
    }
    var c = null;
    try { c = root && root.DEMO && root.DEMO.getState(); } catch (e) {}
    if (c) {
      var accs = (c.accounts || []).filter(function (a) { return a.kind !== '平台管理员'; });
      out.accounts = accs.length;
      out.teachers = accs.filter(function (a) { return a.kind === '教师'; }).length;
      out.admins = accs.filter(function (a) { return a.kind === '管理员' || a.kind === '超管'; }).length;
      out.students = (c.students || []).filter(function (s) { return s.status === '在读'; }).length;
      out.orgs = (c.orgs || []).length;
      out.majors = (c.majors || []).length;
      out.klasses = (c.klasses || []).length;
    }
    if (root && root.TK) {
      try {
        var t = root.TK.load();
        out.plans = (t.plans || []).length;
        out.lessons = (t.courses || []).length;
        out.resources = (t.resources || []).length;
      } catch (e) {}
    }
    return out;
  }

  function lastActive(school) {
    if (!school) return '';
    if (school.lastActiveAt) return school.lastActiveAt;
    if (!school.demo) return '';
    try {
      var c = root && root.DEMO && root.DEMO.getState();
      var times = (c.accounts || []).map(function (a) { return a.lastLoginAt; }).filter(Boolean).sort();
      return times.length ? times[times.length - 1] : '';
    } catch (e) { return ''; }
  }

  function summary() {
    var all = list();
    var t = emptyStats();
    var enabled = 0, active7 = 0, now = Date.now();
    all.forEach(function (s) {
      var x = stats(s);
      Object.keys(t).forEach(function (k) { t[k] += x[k]; });
      if (s.status === '启用') enabled++;
      var la = lastActive(s);
      if (la && now - new Date(la.replace(' ', 'T')).getTime() <= 7 * 864e5) active7++;
    });
    t.schools = all.length;
    t.enabled = enabled;
    t.active7 = active7;
    return t;
  }

  function audits() { return state().audits; }

  /* ── 平台概览：趋势、分布、排行、待办 ── */
  function activityOf(school) {
    if (!school) return 0;
    if (school.snapshot && school.snapshot.active7 != null) return Math.max(0, Number(school.snapshot.active7) || 0);
    if (!school.demo) return 0;
    try {
      var c = root && root.DEMO && root.DEMO.getState();
      var now = Date.now();
      return (c.accounts || []).filter(function (a) {
        return a.lastLoginAt && now - new Date(String(a.lastLoginAt).replace(' ', 'T')).getTime() <= 7 * 864e5;
      }).length;
    } catch (e) { return 0; }
  }

  function openTrend(months) {
    months = months || 6;
    var now = new Date();
    var start = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
    var schools = list();
    var running = schools.filter(function (s) { var d = dateOf(s.createdAt); return d && d < start; }).length;
    var out = [];
    for (var i = 0; i < months; i++) {
      var from = new Date(start.getFullYear(), start.getMonth() + i, 1);
      var to = new Date(from.getFullYear(), from.getMonth() + 1, 1);
      var count = schools.filter(function (s) { var d = dateOf(s.createdAt); return d && d >= from && d < to; }).length;
      running += count;
      out.push({ label: (from.getMonth() + 1) + '月', count: count, value: running });
    }
    return out;
  }

  // 省级行政区简称表（用于把"省 市"归属到省）
  var PROVINCES = ['北京', '天津', '上海', '重庆', '河北', '山西', '辽宁', '吉林', '黑龙江',
    '江苏', '浙江', '安徽', '福建', '江西', '山东', '河南', '湖北', '湖南', '广东', '海南',
    '四川', '贵州', '云南', '陕西', '甘肃', '青海', '台湾', '内蒙古', '广西', '西藏',
    '宁夏', '新疆', '香港', '澳门'];

  function provinceOf(region) {
    var r = String(region || '').trim();
    if (!r) return '未填写';
    // 先按分隔符取第一段（兼容"江苏 南京""江苏/南京"），再按省级简称前缀匹配
    var head = r.split(/[\s,，、/]+/)[0] || r;
    for (var i = 0; i < PROVINCES.length; i++) {
      if (head.indexOf(PROVINCES[i]) === 0) return PROVINCES[i];
    }
    return head;
  }

  function regionDist() {
    var map = {};
    list().forEach(function (s) { var p = provinceOf(s.region); map[p] = (map[p] || 0) + 1; });
    return Object.keys(map).map(function (name) { return { name: name, count: map[name] }; })
      .sort(function (a, b) { return b.count - a.count || a.name.localeCompare(b.name); });
  }

  function featureDist() {
    var active = list().filter(function (s) { return s.status === '启用'; });
    return FEATURE_DEFS.map(function (f) {
      return {
        key: f.key, name: f.name,
        on: active.filter(function (s) { return featuresOf(s)[f.key]; }).length,
        total: active.length
      };
    });
  }

  function accessStatus() {
    var out = { connected: 0, empty: 0, disabled: 0, total: 0 };
    var all = list();
    out.total = all.length;
    all.forEach(function (s) {
      if (s.status === '停用') { out.disabled++; return; }
      var x = stats(s);
      if (x.accounts + x.teachers + x.students > 0) out.connected++; else out.empty++;
    });
    return out;
  }

  function ranking(n) {
    return list().map(function (s) { return { school: s, active: activityOf(s), last: lastActive(s) }; })
      .sort(function (a, b) { return b.active - a.active; })
      .slice(0, n || 5);
  }

  function pending() {
    var all = list();
    var active = all.filter(function (s) { return s.status === '启用'; });
    return [
      { label: '未开通管理员', count: all.filter(function (s) { return accountsOf(s).length === 0; }).length, href: 'accounts.html' },
      { label: '停用院校', count: all.filter(function (s) { return s.status === '停用'; }).length, href: 'schools.html' },
      { label: '未接入业务数据', count: active.filter(function (s) { var x = stats(s); return x.accounts + x.teachers + x.students === 0; }).length, href: 'schools.html' },
      { label: '功能全部关闭', count: active.filter(function (s) { return FEATURE_DEFS.every(function (f) { return !featuresOf(s)[f.key]; }); }).length, href: 'features.html' },
      { label: 'AI 配额为 0', count: active.filter(function (s) { return quotaOf(s) === 0; }).length, href: 'features.html' }
    ];
  }

  function recentAudits(n) { return audits().slice(0, n || 5); }

  return {
    KEY: KEY,
    INITIAL_PASSWORD: INITIAL_PASSWORD,
    FEATURE_DEFS: FEATURE_DEFS,
    TEMPLATE_INDUSTRIES: TEMPLATE_INDUSTRIES,
    TEMPLATE_SCOPES: TEMPLATE_SCOPES,
    TEMPLATE_STATUSES: TEMPLATE_STATUSES,
    TEMPLATE_NODE_TYPES: TEMPLATE_NODE_TYPES,
    TEMPLATE_EDGE_KINDS: TEMPLATE_EDGE_KINDS,
    state: state,
    list: list,
    byId: byId,
    create: create,
    update: update,
    setStatus: setStatus,
    setAdmin: setAdmin,
    resetPassword: resetPassword,
    accountsOf: accountsOf,
    allAccounts: allAccounts,
    addAccount: addAccount,
    updateAccount: updateAccount,
    setAccountStatus: setAccountStatus,
    resetAccountPassword: resetAccountPassword,
    featuresOf: featuresOf,
    quotaOf: quotaOf,
    updateFeatures: updateFeatures,
    log: log,
    templates: templates,
    templateById: templateById,
    saveGraphTemplate: saveGraphTemplate,
    setTemplateStatus: setTemplateStatus,
    templateStats: templateStats,
    stats: stats,
    lastActive: lastActive,
    summary: summary,
    audits: audits,
    activityOf: activityOf,
    openTrend: openTrend,
    regionDist: regionDist,
    featureDist: featureDist,
    accessStatus: accessStatus,
    ranking: ranking,
    pending: pending,
    recentAudits: recentAudits,
    fmt: fmt
  };
}));
