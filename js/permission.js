/* 权限管理升级 Demo · 权限判定模块（纯函数，不碰 DOM / localStorage）
 * 三级判定：功能权限 → 范围 → 脱敏（规则见 docs/permission-demo-spec.md 7.10 / 7.4）。
 * 每条判定都返回「判定过程说明」，供页面的「为什么能看到 / 看不到」开关使用。
 * 权限点、角色、脱敏规则均为配置数据（权限点/角色在 js/mock-data.js，脱敏表在本文件 MASK）。
 * UMD：浏览器挂 window.Perm；Node 可 require（供单元测试）。
 *
 * 说明：下面少数 code 常量（CODES）必须与 mock-data.js 的权限点 code 保持一致。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Perm = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var CODES = {
    nodeView: 'org:node:view',
    nodeEdit: 'org:node:edit',
    accountView: 'org:account:view',
    accountEdit: 'org:account:edit',
    accountAssign: 'org:account:assign',
    teachScopeGrant: 'org:teachingScope:grant',
    auditView: 'org:audit:view',
    studentInfoView: 'student:info:view',
    studentScoreView: 'student:score:view',
    idcardPlain: 'student:idcard:plain',
    profileView: 'teaching:profile:view',
    contentAudit: 'teaching:content:audit',
    resourceShare: 'resource:share',
    schoolpubPublish: 'resource:schoolpub:publish',
    schoolpubView: 'resource:schoolpub:view'
  };

  /* ── 脱敏档位（角色 key → 各字段脱敏模式） ──
   * 模式：plain 全量 / phone 138****1234 / mask 138******** / id 前6后4 / addr 住址脱敏 /
   *       sum 成绩汇总 / hidden 不可见 / idcardGranted 学工身份证（授权则 plain，否则 id）
   */
  var MASK = {
    all:            { phone: 'plain', idCard: 'plain', address: 'plain', score: 'plain' },
    teacher:        { phone: 'phone', idCard: 'id',    address: 'addr',  score: 'plain' },
    headCouns:      { phone: 'plain', idCard: 'id',    address: 'plain', score: 'plain' },
    stuAff:         { phone: 'plain', idCard: 'idcardGranted', address: 'plain', score: 'plain' },
    supervisor:     { phone: 'phone', idCard: 'id',    address: 'addr',  score: 'sum' },
    info:           { phone: 'mask', idCard: 'id',    address: 'hidden', score: 'hidden' },
    academic:       { phone: 'mask', idCard: 'hidden', address: 'hidden', score: 'plain' },
    orgAdmin:       { phone: 'plain', idCard: 'id',    address: 'hidden', score: 'plain' },
    majorLeadEnter: { phone: 'phone', idCard: 'hidden', address: 'hidden', score: 'plain' },
    other:          { phone: 'hidden', idCard: 'hidden', address: 'hidden', score: 'hidden' }
  };

  var ROLE_TO_MASK = {
    super: 'all', teacher: 'teacher', headTeacher: 'headCouns', counselor: 'headCouns',
    studentAffairs: 'stuAff', supervisor: 'supervisor', info: 'info', academic: 'academic',
    orgAdmin: 'orgAdmin', majorLead: 'majorLeadEnter', enterprise: 'majorLeadEnter', student: 'other'
  };

  var MASK_NAME = {
    all: '全量（平台超级管理员）', teacher: '教师', headCouns: '班主任/辅导员', stuAff: '学工',
    supervisor: '督导', info: '信息中心', academic: '教务', orgAdmin: '组织管理员',
    majorLeadEnter: '专业负责人/企业导师', other: '其他'
  };

  /* 带「组织节点范围」的角色（用于「当前组织」视图过滤：教师/班主任/学生/企业导师没有当前组织） */
  var ORG_SCOPED_KEYS = {
    super: 1, orgAdmin: 1, counselor: 1, academic: 1, studentAffairs: 1, supervisor: 1, info: 1, majorLead: 1
  };

  /* ── 索引缓存（按 ctx 建一次） ── */
  var CACHE = new WeakMap();
  function idx(ctx) {
    if (CACHE.has(ctx)) return CACHE.get(ctx);
    var I = { byId: {}, children: {}, subtree: {} };
    ['orgs','majors','grades','klasses','students','permissions','roles','accounts','assignments','resources','contents'].forEach(function (col) {
      I[col] = {};
      (ctx[col] || []).forEach(function (o) { I[col][o.id] = o; });
    });
    (ctx.orgs || []).forEach(function (o) {
      if (!I.children[o.parentId]) I.children[o.parentId] = [];
      I.children[o.parentId].push(o.id);
    });
    CACHE.set(ctx, I);
    return I;
  }

  function descendants(ctx, orgId) {
    var I = idx(ctx);
    if (I.subtree[orgId]) return I.subtree[orgId];
    var set = new Set([orgId]);
    (I.children[orgId] || []).forEach(function (c) {
      descendants(ctx, c).forEach(function (d) { set.add(d); });
    });
    I.subtree[orgId] = set;
    return set;
  }

  function findById(arr, id) { return arr.find(function (o) { return o.id === id; }); }

  /* ── 引用解析 ── */
  function majorOf(ctx, majorId) { return idx(ctx).majors[majorId]; }
  function klassOf(ctx, klassId) { return idx(ctx).klasses[klassId]; }
  function gradeOf(ctx, gradeId) { return idx(ctx).grades[gradeId]; }
  function roleOf(ctx, roleId) { return idx(ctx).roles[roleId]; }
  function accountOf(ctx, accountId) { return idx(ctx).accounts[accountId]; }
  function studentOf(ctx, studentId) { return idx(ctx).students[studentId]; }

  function klassOfStudent(ctx, student) { return klassOf(ctx, student.klassId); }
  function gradeOfStudent(ctx, student) { return gradeOf(klassOfStudent(ctx, student).gradeId); }

  /* 账号「主组织」id（必填，单个；兼容旧 orgIds 时取第一个） */
  function accountMainOrgId(account) {
    if (!account) return null;
    if (account.orgId) return account.orgId;
    return (account.orgIds && account.orgIds.length) ? account.orgIds[0] : null;
  }

  /* 账号「兼职组织」id 数组（可为空；兼容旧 orgIds 时取第一个之后的） */
  function accountPartOrgIds(account) {
    if (!account) return [];
    if (account.partOrgIds) return account.partOrgIds;
    return (account.orgIds && account.orgIds.length) ? account.orgIds.slice(1) : [];
  }

  /* 账号「所属组织」数组（主组织 + 兼职组织；兼容旧 orgIds 时主取第一个） */
  function accountOrgIds(ctx, account) {
    if (!account) return [];
    if (account.orgId) {
      var ids = [account.orgId];
      (account.partOrgIds || []).forEach(function (o) { if (ids.indexOf(o) < 0) ids.push(o); });
      return ids;
    }
    if (account.orgIds && account.orgIds.length) return account.orgIds.slice();
    return [];
  }

  /* 账号是否归属某组织（只向下：账号的主组织或任一兼职组织落在「目标组织及其下级」内才命中） */
  function accountInOrg(ctx, account, orgId) {
    return accountOrgIds(ctx, account).some(function (o) {
      return descendants(ctx, orgId).has(o);
    });
  }

  /* 账号「主组织」是否落在目标组织及其下级内（账号维护类操作只看主组织） */
  function accountMainInOrg(ctx, account, orgId) {
    var main = accountMainOrgId(account);
    return main != null && descendants(ctx, orgId).has(main);
  }

  /* 目标对象「所属组织」数组（账号/教师档案为多选，其余仍单一） */
  function targetOrgIds(ctx, target, dataType) {
    if (target == null) return [];
    if (dataType === 'account') return accountOrgIds(ctx, target);
    if (dataType === 'teacherProfile') return accountOrgIds(ctx, accountOf(ctx, target.accountId));
    return [targetOrgId(ctx, target, dataType)];
  }

  /* scopeOrgId 的组织及下级是否覆盖目标（任一所属组织命中即可）；
   * 账号维护类操作（org:account:edit）只按「主组织」判断，其余（查看 / 教师档案 / 共享等）按「主 + 兼职」判断。 */
  function anyOrgIn(ctx, scopeOrgId, target, dataType, permCode) {
    if (dataType === 'account') {
      if (permCode === CODES.accountEdit) return accountMainInOrg(ctx, target, scopeOrgId);
      return accountInOrg(ctx, target, scopeOrgId);
    }
    if (dataType === 'teacherProfile') return accountInOrg(ctx, accountOf(ctx, target.accountId), scopeOrgId);
    var desc = descendants(ctx, scopeOrgId);
    return targetOrgIds(ctx, target, dataType).some(function (t) { return t != null && desc.has(t); });
  }

  /* 目标对象「所属组织」（单一主组织，兼容旧调用） */
  function targetOrgId(ctx, target, dataType) {
    switch (dataType) {
      case 'org': return target.id;
      case 'account': return accountMainOrgId(target);
      case 'major': return target.orgId;
      case 'teacherProfile': return accountMainOrgId(accountOf(ctx, target.accountId));
      case 'klass': return majorOf(ctx, target.majorId).orgId;
      case 'student': case 'score': case 'internship': return majorOf(ctx, klassOfStudent(ctx, target).majorId).orgId;
      case 'resource': case 'content': case 'audit': return target.orgId;
      default: return target.orgId;
    }
  }

  function targetGradeId(ctx, target, dataType) {
    if (dataType === 'klass') return target.gradeId;
    if (dataType === 'student' || dataType === 'score' || dataType === 'internship') return klassOfStudent(ctx, target).gradeId;
    return null;
  }

  /* ── 身份 ── */
  function getIdentity(ctx, accountId) {
    var account = accountOf(ctx, accountId);
    var assignments = (ctx.assignments || []).filter(function (a) { return a.accountId === accountId; });
    return { account: account, assignments: assignments };
  }

  /* 全部有效分配：账号未停用时的全部分配（不按端过滤，供「可进入的端」与判定说明使用） */
  function allActiveAssignments(ctx, identity) {
    if (identity.account.status === '停用') return [];
    return identity.assignments || [];
  }

  /* 身份「可进入的端」= 全部有效分配的所属端集合（去重，按 admin→teacher→student 排序） */
  function rolePortals(ctx, identity) {
    var set = {};
    allActiveAssignments(ctx, identity).forEach(function (a) {
      var role = roleOf(ctx, a.roleId);
      if (role && role.portal) set[role.portal] = 1;
    });
    var order = ['admin', 'teacher', 'student'];
    var out = order.filter(function (p) { return set[p]; });
    Object.keys(set).forEach(function (p) { if (out.indexOf(p) < 0) out.push(p); });
    return out;
  }

  /* 默认端：只有一个端→该端；多个端→管理端（无记录时）；无端→null */
  function defaultPortal(ctx, identity) {
    var portals = rolePortals(ctx, identity);
    if (!portals.length) return null;
    if (portals.length === 1) return portals[0];
    return portals.indexOf('admin') >= 0 ? 'admin' : portals[0];
  }

  /* 当前端下的有效分配：同端合并；跨端角色在此端不生效。currentPortal 缺省时按默认端。 */
  function activeAssignments(ctx, identity) {
    var portal = (identity.currentPortal != null) ? identity.currentPortal : defaultPortal(ctx, identity);
    if (portal == null) return [];
    return allActiveAssignments(ctx, identity).filter(function (a) {
      var role = roleOf(ctx, a.roleId);
      return role && role.portal === portal;
    });
  }

  function isSuper(ctx, identity) {
    return activeAssignments(ctx, identity).some(function (a) { return roleOf(ctx, a.roleId).key === 'super'; });
  }

  /* 分配的有效权限点 = 角色权限 ∪ 额外权限点 */
  function assignmentPerms(ctx, assignment) {
    var role = roleOf(ctx, assignment.roleId);
    var set = new Set(role.permissionIds || []);
    (assignment.extraPermIds || []).forEach(function (p) { set.add(p); });
    return set;
  }

  function hasPermInAssignment(ctx, assignment, code) { return assignmentPerms(ctx, assignment).has(code); }

  /* ── 范围判断 ── */
  function teachingScopeContainsClass(ctx, assignment, klassId) {
    var ts = assignment.teachingScope || {};
    if ((ts.classIds || []).indexOf(klassId) >= 0) return true;
    var majorId = klassOf(ctx, klassId).majorId;
    return (ts.majorIds || []).indexOf(majorId) >= 0;
  }

  function scopeMatches(ctx, assignment, target, dataType, permCode) {
    var role = roleOf(ctx, assignment.roleId);
    var key = role.key;

    if (key === 'super') return true;

    if (key === 'student') {
      if (dataType === 'student' || dataType === 'score' || dataType === 'internship') {
        var stAcct = accountOf(ctx, assignment.accountId);
        if (stAcct.studentId) return target.id === stAcct.studentId;
        // 未绑定具体学生时：按「专业 + 班级」范围（本班 / 本专业可见）
        return teachingScopeContainsClass(ctx, assignment, target.klassId);
      }
      return false;
    }

    // 班主任（及按班级授予的辅导员）：指定班级
    if ((assignment.scopeClassIds || []).length) {
      if (dataType === 'klass') return assignment.scopeClassIds.indexOf(target.id) >= 0;
      if (dataType === 'student' || dataType === 'score' || dataType === 'internship') {
        return assignment.scopeClassIds.indexOf(target.klassId) >= 0;
      }
      return false;
    }

    // 企业导师：本基地（实习学生）
    if (key === 'enterprise') {
      var baseId = accountOf(ctx, assignment.accountId).baseId;
      if (dataType === 'student' || dataType === 'score' || dataType === 'internship') {
        return target.internshipBaseId != null && target.internshipBaseId === baseId;
      }
      if (dataType === 'resource') return true; // 本基地资源（演示从宽）
      return false;
    }

    // 教师：本人 + 教学范围
    if (key === 'teacher') {
      if (dataType === 'resource') return target.ownerId === assignment.accountId;
      if (dataType === 'teacherProfile') return target.accountId === assignment.accountId;
      if (dataType === 'student' || dataType === 'score' || dataType === 'internship') {
        return teachingScopeContainsClass(ctx, assignment, target.klassId);
      }
      return false;
    }

    // 专业负责人：本专业（演示未启用，但保留逻辑）
    if (key === 'majorLead') {
      var account = accountOf(ctx, assignment.accountId);
      var leadMajorId = null;
      (ctx.majors || []).forEach(function (m) {
        // 简化：专业负责人默认覆盖其所属组织下的专业
        if (accountInOrg(ctx, account, m.orgId)) leadMajorId = m.id;
      });
      if (dataType === 'student' || dataType === 'score' || dataType === 'internship') {
        return leadMajorId && klassOfStudent(ctx, target).majorId === leadMajorId;
      }
      if (dataType === 'klass') return leadMajorId && target.majorId === leadMajorId;
      if (dataType === 'teacherProfile') return target.accountId === assignment.accountId;
      return false;
    }

    // 默认：组织节点及下级（带年级属性的再叠加年级筛选）
    var gradeScoped = (dataType === 'klass' || dataType === 'student' || dataType === 'score' || dataType === 'internship');

    for (var i = 0; i < (assignment.scopeOrgIds || []).length; i++) {
      var oid = assignment.scopeOrgIds[i];
      if (!anyOrgIn(ctx, oid, target, dataType, permCode)) continue;
      if (gradeScoped) {
        var grades = (assignment.scopeGrades || {})[oid];
        if (!grades || grades.length === 0) return true; // 未选年级 = 全部
        if (grades.indexOf(targetGradeId(ctx, target, dataType)) >= 0) return true;
      } else {
        return true;
      }
    }
    return false;
  }

  /* ── 三级判定核心 ── */
  function check(ctx, identity, permCode, target, dataType) {
    var account = identity.account;
    var active = activeAssignments(ctx, identity);

    if (account.status === '停用') {
      return { allowed: false, denyReason: '账号已停用，所有分配失效', trace: traceBody(ctx, identity, active, permCode, target, dataType, null, '账号已停用') };
    }

    var matches = active.filter(function (a) { return hasPermInAssignment(ctx, a, permCode); });
    if (!matches.length) {
      return { allowed: false, denyReason: '无该功能权限点（' + permCode + '）', trace: traceBody(ctx, identity, active, permCode, target, dataType, null, '无该功能权限点') };
    }

    if (target == null) {
      var first = matches[0];
      return { allowed: true, denyReason: null, winningAssignmentId: first.id, trace: traceBody(ctx, identity, active, permCode, target, dataType, first, null) };
    }

    for (var i = 0; i < matches.length; i++) {
      if (scopeMatches(ctx, matches[i], target, dataType, permCode)) {
        return { allowed: true, denyReason: null, winningAssignmentId: matches[i].id, trace: traceBody(ctx, identity, active, permCode, target, dataType, matches[i], null) };
      }
    }
    return { allowed: false, denyReason: '范围不通过', trace: traceBody(ctx, identity, active, permCode, target, dataType, null, '范围不通过') };
  }

  function traceBody(ctx, identity, active, permCode, target, dataType, winning, denyReason) {
    var account = identity.account;
    var currentPortal = (identity.currentPortal != null) ? identity.currentPortal : defaultPortal(ctx, identity);
    var all = allActiveAssignments(ctx, identity);
    return {
      accountId: account.id,
      accountName: account.name,
      accountStatus: account.status,
      currentPortal: currentPortal,
      permCode: permCode,
      allowed: !!winning,
      denyReason: denyReason,
      winningAssignmentId: winning ? winning.id : null,
      maskGroup: winning ? maskGroupFor(ctx, account, winning, target, dataType) : null,
      assignments: all.map(function (a) {
        var role = roleOf(ctx, a.roleId);
        var inPortal = role && role.portal === currentPortal;
        var hasPerm = inPortal && hasPermInAssignment(ctx, a, permCode);
        var scopePass = null;
        if (hasPerm && target != null) scopePass = scopeMatches(ctx, a, target, dataType, permCode);
        return { id: a.id, roleId: a.roleId, roleName: role ? role.name : a.roleId, portal: role ? role.portal : null, inPortal: inPortal, hasPerm: hasPerm, scopePass: scopePass };
      })
    };
  }

  /* ── 脱敏 ── */
  function isSelfStudentView(ctx, identity, target, dataType) {
    return identity.account.kind === '学生' && identity.account.studentId && target && target.id === identity.account.studentId
      && (dataType === 'student' || dataType === 'score' || dataType === 'internship');
  }

  function maskGroupFor(ctx, account, winningAssignment, target, dataType) {
    if (isSelfStudentView(ctx, { account: account, assignments: [] }, target, dataType)) return 'all';
    var role = roleOf(ctx, winningAssignment.roleId);
    return ROLE_TO_MASK[role.key] || 'other';
  }

  function maskValue(raw, mode) {
    if (mode === 'plain') return raw;
    if (mode === 'hidden') return null;
    if (mode === 'phone') return String(raw).slice(0, 3) + '****' + String(raw).slice(-4);
    if (mode === 'mask') return String(raw).slice(0, 3) + '********';
    if (mode === 'id') return String(raw).slice(0, 6) + '********' + String(raw).slice(-4);
    if (mode === 'addr') return String(raw).slice(0, 6) + '***';
    if (mode === 'sum') return null; // 由 maskField 针对 score 特殊处理
    return raw;
  }

  function rawField(ctx, target, field) {
    if (field === 'score') return target.scores;
    return target[field];
  }

  function maskField(ctx, identity, field, target, dataType) {
    if (identity.account.status === '停用') return { value: null, mode: 'hidden', tier: '其他' };
    if (isSelfStudentView(ctx, identity, target, dataType)) {
      return { value: rawField(ctx, target, field), mode: 'plain', tier: '本人全量' };
    }
    var permCode = (field === 'score') ? CODES.studentScoreView : CODES.studentInfoView;
    var res = check(ctx, identity, permCode, target, dataType);
    if (!res.allowed) return { value: null, mode: 'hidden', tier: '其他' };

    var group = res.trace.maskGroup;
    var role = roleOf(ctx, res.winningAssignmentId ? findById(ctx.assignments, res.winningAssignmentId).roleId : null);
    var mode = MASK[group][field];

    if (field === 'score') {
      if (mode === 'hidden') return { value: null, mode: 'hidden', tier: MASK_NAME[group] };
      if (mode === 'sum') {
        var scores = target.scores || [];
        var avg = scores.length ? Math.round(scores.reduce(function (s, c) { return s + c.score; }, 0) / scores.length) : 0;
        return { value: { average: avg, count: scores.length }, mode: 'sum', tier: MASK_NAME[group] };
      }
      return { value: rawField(ctx, target, field), mode: 'plain', tier: MASK_NAME[group] };
    }

    if (mode === 'idcardGranted') {
      var a = findById(ctx.assignments, res.winningAssignmentId);
      mode = hasPermInAssignment(ctx, a, CODES.idcardPlain) ? 'plain' : 'id';
    }
    return { value: maskValue(rawField(ctx, target, field), mode), mode: mode, tier: MASK_NAME[group] };
  }

  function maskStudent(ctx, identity, target, dataType) {
    return {
      phone: maskField(ctx, identity, 'phone', target, dataType),
      idCard: maskField(ctx, identity, 'idCard', target, dataType),
      address: maskField(ctx, identity, 'address', target, dataType),
      score: maskField(ctx, identity, 'score', target, dataType)
    };
  }

  /* ── 列表过滤（含「当前组织」过滤视图） ── */
  function listFilter(ctx, identity, permCode, dataType, items, opts) {
    opts = opts || {};
    return (items || []).filter(function (item) {
      if (!check(ctx, identity, permCode, item, dataType).allowed) return false;
      if (opts.orgId) {
        if (!anyOrgIn(ctx, opts.orgId, item, dataType)) return false;
      }
      return true;
    });
  }

  /* ── 当前组织（视图过滤，不是权限） ── */
  function hasOrgScope(ctx, identity) {
    return activeAssignments(ctx, identity).some(function (a) {
      return ORG_SCOPED_KEYS[roleOf(ctx, a.roleId).key] && (a.scopeOrgIds || []).length > 0;
    });
  }

  function currentOrgOptions(ctx, identity) {
    if (identity.account.status === '停用') return [];
    var set = new Set();
    activeAssignments(ctx, identity).forEach(function (a) {
      var key = roleOf(ctx, a.roleId).key;
      if (!ORG_SCOPED_KEYS[key]) return;
      (a.scopeOrgIds || []).forEach(function (oid) {
        descendants(ctx, oid).forEach(function (d) { set.add(d); });
      });
    });
    return (ctx.orgs || []).filter(function (o) { return set.has(o.id); });
  }

  /* 带当前组织的列表过滤：区分「可见 / 有权限被当前组织过滤 / 无权限」三类 */
  function listFilterWithOrg(ctx, identity, permCode, dataType, items, currentOrgId) {
    var out = { visible: [], filteredOut: [], denied: [] };
    (items || []).forEach(function (item) {
      var res = check(ctx, identity, permCode, item, dataType);
      if (!res.allowed) { out.denied.push(item); return; }
      if (currentOrgId != null && currentOrgId !== '' && !anyOrgIn(ctx, currentOrgId, item, dataType)) {
        out.filteredOut.push(item);
        return;
      }
      out.visible.push(item);
    });
    return out;
  }

  /* 单条数据的判定状态（供「为什么能看到 / 看不到」区分三种情况） */
  function listItemStatus(ctx, identity, permCode, item, dataType, currentOrgId) {
    if (identity.account.status === '停用') return 'disabled';
    if (!check(ctx, identity, permCode, item, dataType).allowed) return 'denied';
    if (currentOrgId != null && currentOrgId !== '' && !anyOrgIn(ctx, currentOrgId, item, dataType)) return 'filteredOut';
    return 'visible';
  }

  function checkWithOrg(ctx, identity, permCode, target, dataType, currentOrgId) {
    var res = check(ctx, identity, permCode, target, dataType);
    res.orgFiltered = false;
    if (res.allowed && target != null && currentOrgId != null && currentOrgId !== '' && !anyOrgIn(ctx, currentOrgId, target, dataType)) {
      res.orgFiltered = true;
    }
    return res;
  }

  /* ── 组织节点：可见 / 可选 / 可编辑 ── */
  function visibleOrgNodes(ctx, identity, opts) {
    opts = opts || {};
    var all = (ctx.orgs || []).filter(function (o) { return opts.forAssign ? o.status !== 'disabled' : true; });
    if (isSuper(ctx, identity)) return all;
    var set = new Set();
    activeAssignments(ctx, identity).forEach(function (a) {
      (a.scopeOrgIds || []).forEach(function (oid) {
        descendants(ctx, oid).forEach(function (d) {
          if (opts.forAssign && findById(ctx.orgs, d) && findById(ctx.orgs, d).status === 'disabled') return;
          set.add(d);
        });
      });
    });
    return all.filter(function (o) { return set.has(o.id); });
  }

  function orgCanEdit(ctx, identity, orgNode) {
    if (isSuper(ctx, identity)) return orgNode.parentId != null; // 超管可编辑除根外全部
    var editable = false;
    activeAssignments(ctx, identity).forEach(function (a) {
      var role = roleOf(ctx, a.roleId);
      if (role.key !== 'orgAdmin') return;
      (a.scopeOrgIds || []).forEach(function (oid) {
        if (oid !== orgNode.id && descendants(ctx, oid).has(orgNode.id)) editable = true; // 本节点的下级（不含本节点）
      });
    });
    return editable;
  }

  function orgDeleteBlockers(ctx, orgId) {
    var blockers = [];
    var I = idx(ctx);
    (I.children[orgId] || []).forEach(function (cid) { blockers.push({ type: '下级节点', id: cid, name: I.orgs[cid].name }); });
    (ctx.majors || []).forEach(function (m) { if (m.orgId === orgId) blockers.push({ type: '专业', id: m.id, name: m.name }); });
    (ctx.accounts || []).forEach(function (ac) {
      if (accountMainOrgId(ac) === orgId || accountPartOrgIds(ac).indexOf(orgId) >= 0) blockers.push({ type: '账号', id: ac.id, name: ac.name });
    });
    (ctx.resources || []).forEach(function (r) { if (r.orgId === orgId) blockers.push({ type: '资源', id: r.id, name: r.title }); });
    // 被角色分配的数据范围引用（7.1）
    (ctx.assignments || []).forEach(function (a) {
      if ((a.scopeOrgIds || []).indexOf(orgId) >= 0) {
        var ac = I.accounts[a.accountId];
        var role = I.roles[a.roleId];
        blockers.push({ type: '角色范围引用', id: a.id, name: (ac ? ac.name : a.accountId) + '（' + (role ? role.name : a.roleId) + '）' });
      }
    });
    return blockers;
  }

  function checkDeleteOrg(ctx, identity, orgId) {
    var orgNode = findById(ctx.orgs, orgId);
    if (!orgNode) return { allowed: false, denyReason: '节点不存在', blockers: [] };
    if (orgNode.parentId == null) return { allowed: false, denyReason: '根节点不可删除', blockers: [] };
    if (!orgCanEdit(ctx, identity, orgNode)) return { allowed: false, denyReason: '无权操作该节点', blockers: [] };
    var blockers = orgDeleteBlockers(ctx, orgId);
    if (blockers.length) return { allowed: false, denyReason: '节点下存在关联对象，需先处理', blockers: blockers };
    return { allowed: true, denyReason: null, blockers: [] };
  }

  function assignmentDisabledNodes(ctx, assignment) {
    return (assignment.scopeOrgIds || []).filter(function (oid) {
      var o = findById(ctx.orgs, oid);
      return o && o.status === 'disabled';
    }).map(function (oid) { return { orgId: oid, name: findById(ctx.orgs, oid).name }; });
  }

  /* 某组织节点下，当前身份可见的年级（无年级限制时返回全部） */
  function visibleGrades(ctx, identity, orgId) {
    if (isSuper(ctx, identity)) return (ctx.grades || []).map(function (g) { return g.id; });
    var all = (ctx.grades || []).map(function (g) { return g.id; });
    var restricted = null;
    var covered = false;
    activeAssignments(ctx, identity).forEach(function (a) {
      (a.scopeOrgIds || []).forEach(function (oid) {
        if (!descendants(ctx, oid).has(orgId)) return;
        covered = true;
        var grades = (a.scopeGrades || {})[oid];
        if (!grades || grades.length === 0) { restricted = null; return; }
        if (restricted === null) restricted = new Set();
        grades.forEach(function (g) { restricted.add(g); });
      });
    });
    if (!covered) return [];
    return restricted === null ? all : all.filter(function (g) { return restricted.has(g); });
  }

  /* ── 授权约束（7.4） ── */
  function grantableOrgIds(ctx, granter) {
    if (isSuper(ctx, granter)) return new Set((ctx.orgs || []).map(function (o) { return o.id; }));
    var set = new Set();
    activeAssignments(ctx, granter).forEach(function (a) {
      if (!hasPermInAssignment(ctx, a, CODES.accountAssign)) return;
      (a.scopeOrgIds || []).forEach(function (oid) { descendants(ctx, oid).forEach(function (d) { set.add(d); }); });
    });
    return set;
  }

  function canDelegate(ctx, granter, granteeAccountId, assignment) {
    if (granter.account.id === granteeAccountId) return { ok: false, reason: '不能给自己分配角色' };
    if (granter.account.status === '停用') return { ok: false, reason: '授权人账号已停用' };

    var teach = assignment.teachingScope && ((assignment.teachingScope.classIds || []).length || (assignment.teachingScope.majorIds || []).length || (assignment.teachingScope.courseIds || []).length);

    if (teach) {
      if (!isSuper(ctx, granter) && !activeAssignments(ctx, granter).some(function (a) { return hasPermInAssignment(ctx, a, CODES.teachScopeGrant); })) {
        return { ok: false, reason: '无教学范围授予权限' };
      }
      if (!isSuper(ctx, granter)) {
        var classes = assignment.teachingScope.classIds || [];
        for (var i = 0; i < classes.length; i++) {
          var klass = klassOf(ctx, classes[i]);
          var org = majorOf(ctx, klass.majorId).orgId;
          var ok = activeAssignments(ctx, granter).some(function (a) {
            return hasPermInAssignment(ctx, a, CODES.teachScopeGrant) && descendants(ctx, a.scopeOrgIds[0]).has(org);
          });
          if (!ok) return { ok: false, reason: '无权授予班级 ' + klass.name + ' 的教学范围' };
        }
      }
      return { ok: true, reason: null };
    }

    // 数据范围（角色分配）
    if (!isSuper(ctx, granter) && !activeAssignments(ctx, granter).some(function (a) { return hasPermInAssignment(ctx, a, CODES.accountAssign); })) {
      return { ok: false, reason: '无分配角色的权限' };
    }
    if (!isSuper(ctx, granter)) {
      var own = grantableOrgIds(ctx, granter);
      var scopeIds = assignment.scopeOrgIds || [];
      for (var j = 0; j < scopeIds.length; j++) {
        if (!own.has(scopeIds[j])) {
          var o = findById(ctx.orgs, scopeIds[j]);
          return { ok: false, reason: '节点 ' + (o ? o.name : scopeIds[j]) + ' 超出自身授权范围' };
        }
      }
      var classIds = assignment.scopeClassIds || [];
      var ownClasses = new Set();
      activeAssignments(ctx, granter).forEach(function (a) {
        (a.scopeOrgIds || []).forEach(function (oid) {
          (ctx.klasses || []).forEach(function (k) {
            if (descendants(ctx, oid).has(majorOf(ctx, k.majorId).orgId)) ownClasses.add(k.id);
          });
        });
      });
      for (var k = 0; k < classIds.length; k++) {
        if (!ownClasses.has(classIds[k])) return { ok: false, reason: '班级超出自身授权范围' };
      }
    }
    return { ok: true, reason: null };
  }

  /* ── 资源共享 / 校本资源库 ── */
  function canShareResource(ctx, identity, resource) {
    return resource.ownerId === identity.account.id
      && resource.type !== '学情分析'
      && activeAssignments(ctx, identity).some(function (a) { return hasPermInAssignment(ctx, a, CODES.resourceShare); });
  }

  function canAccessResource(ctx, identity, resource, action) {
    if (identity.account.status === '停用') return false;
    // 本人
    if (resource.ownerId === identity.account.id) {
      return action === 'view' || action === 'copy' || action === 'revoke' || action === 'recommend' || action === 'edit';
    }
    // 发布到校本资源库 → 全校可查看复制
    if (resource.published && activeAssignments(ctx, identity).some(function (a) { return hasPermInAssignment(ctx, a, CODES.schoolpubView); })) {
      return action === 'view' || action === 'copy';
    }
    // 被共享 → 命中共享目标
    var targets = resource.shareTargets || [];
    var hit = targets.some(function (t) {
      if (t.type === 'teacher') return t.targetId === identity.account.id;
      if (t.type === 'org') {
        return accountInOrg(ctx, accountOf(ctx, identity.account.id), t.targetId);
      }
      return false;
    });
    if (hit) return action === 'view' || action === 'copy';
    return false;
  }

  function canPublishResource(ctx, identity, resource) {
    if (!resource.recommended) return false;
    if (!activeAssignments(ctx, identity).some(function (a) { return hasPermInAssignment(ctx, a, CODES.schoolpubPublish); })) return false;
    return isSuper(ctx, identity) || activeAssignments(ctx, identity).some(function (a) {
      return hasPermInAssignment(ctx, a, CODES.schoolpubPublish) && descendants(ctx, a.scopeOrgIds[0]).has(resource.orgId);
    });
  }

  /* ── 已毕业只读 / 提交 ── */
  function studentReadonly(ctx, student) { return student.status === '已毕业'; }

  function canSubmitHomework(ctx, identity) {
    if (identity.account.kind !== '学生') return false;
    var stu = studentOf(ctx, identity.account.studentId);
    return stu && stu.status === '在读';
  }

  /* ── AI 配额（多角色取最高） ── */
  function effectiveAiQuota(ctx, identity) {
    var quotas = activeAssignments(ctx, identity).map(function (a) { return roleOf(ctx, a.roleId).aiQuota || 0; });
    return quotas.length ? Math.max.apply(null, quotas) : 0;
  }

  /* ── 审计记录（纯构造；id/ts 由存储层补） ── */
  function buildAudit(actorId, action, object, before, after, result) {
    return { actorId: actorId, action: action, object: object, before: before == null ? null : before, after: after == null ? null : after, result: result };
  }

  /* ── 判定过程说明（「为什么」开关，D-19；currentOrgId 可选，用于标注「被当前组织过滤」） ── */
  function explain(ctx, identity, permCode, target, dataType, currentOrgId) {
    var res = check(ctx, identity, permCode, target, dataType);
    var trace = res.trace;
    trace.orgFiltered = false;
    trace.hiddenReason = null;
    if (!res.allowed) {
      trace.hiddenReason = res.denyReason; // 含「账号已停用」「无该功能权限点」「范围不通过」
    } else if (target != null && currentOrgId != null && currentOrgId !== '' && !anyOrgIn(ctx, currentOrgId, target, dataType)) {
      trace.orgFiltered = true;
      trace.hiddenReason = '有权限，被当前组织过滤';
    }
    return trace;
  }

  return {
    CODES: CODES,
    MASK: MASK,
    ROLE_TO_MASK: ROLE_TO_MASK,
    getIdentity: getIdentity,
    activeAssignments: activeAssignments,
    allActiveAssignments: allActiveAssignments,
    rolePortals: rolePortals,
    defaultPortal: defaultPortal,
    isSuper: isSuper,
    hasPermInAssignment: hasPermInAssignment,
    check: check,
    scopeMatches: scopeMatches,
    listFilter: listFilter,
    hasOrgScope: hasOrgScope,
    currentOrgOptions: currentOrgOptions,
    listFilterWithOrg: listFilterWithOrg,
    listItemStatus: listItemStatus,
    checkWithOrg: checkWithOrg,
    maskField: maskField,
    maskStudent: maskStudent,
    maskValue: maskValue,
    visibleOrgNodes: visibleOrgNodes,
    visibleGrades: visibleGrades,
    orgCanEdit: orgCanEdit,
    orgDeleteBlockers: orgDeleteBlockers,
    checkDeleteOrg: checkDeleteOrg,
    assignmentDisabledNodes: assignmentDisabledNodes,
    canDelegate: canDelegate,
    canShareResource: canShareResource,
    canAccessResource: canAccessResource,
    canPublishResource: canPublishResource,
    studentReadonly: studentReadonly,
    canSubmitHomework: canSubmitHomework,
    effectiveAiQuota: effectiveAiQuota,
    buildAudit: buildAudit,
    explain: explain,
    descendants: descendants,
    targetOrgId: targetOrgId,
    targetOrgIds: targetOrgIds,
    accountOrgIds: accountOrgIds,
    accountMainOrgId: accountMainOrgId,
    accountPartOrgIds: accountPartOrgIds,
    accountInOrg: accountInOrg,
    accountMainInOrg: accountMainInOrg,
    isSelfStudentView: isSelfStudentView
  };
}));
