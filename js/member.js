/* 权限管理升级 Demo · 成员批量操作纯数据函数
 * 口径：账号「所属组织」= 全部分配 scopeOrgIds 并集 + 账号 orgId；主组织 = orgId。
 * 只依赖 ctx 数据结构（不依赖 permission.js）；直接 mutate ctx，返回变更快照供调用方写审计。
 * UMD：浏览器挂 window.Member；Node 可 require（供单元测试）。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Member = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var _seq = 0;
  function nextAssignId() { _seq++; return 'A-N' + Date.now().toString(36) + '-' + _seq; }

  /* 账号「所属组织」数组（scopeOrgIds 并集 + orgId，orgId 在前，去重） */
  function memberOrgIds(ctx, account) {
    var ids = [];
    if (!account) return ids;
    if (account.orgId && ids.indexOf(account.orgId) < 0) ids.push(account.orgId);
    (ctx.assignments || []).forEach(function (a) {
      if (a.accountId !== account.id) return;
      (a.scopeOrgIds || []).forEach(function (oid) { if (oid && ids.indexOf(oid) < 0) ids.push(oid); });
    });
    return ids;
  }

  /* 账号关联角色 id（去重） */
  function accountRoleIds(ctx, account) {
    var ids = [];
    (ctx.assignments || []).forEach(function (a) {
      if (a.accountId !== account.id) return;
      if (ids.indexOf(a.roleId) < 0) ids.push(a.roleId);
    });
    return ids;
  }

  /* 加入组织：每条分配 scopeOrgIds 补入 orgIds；partOrgIds 补入非主组织 */
  function addOrgs(ctx, account, orgIds) {
    var before = memberOrgIds(ctx, account);
    var changed = false;
    var list = orgIds || [];
    (ctx.assignments || []).forEach(function (a) {
      if (a.accountId !== account.id) return;
      list.forEach(function (oid) {
        if (!oid) return;
        if ((a.scopeOrgIds || []).indexOf(oid) < 0) { a.scopeOrgIds.push(oid); changed = true; }
      });
    });
    list.forEach(function (oid) {
      if (!oid || oid === account.orgId) return;
      account.partOrgIds = account.partOrgIds || [];
      if (account.partOrgIds.indexOf(oid) < 0) { account.partOrgIds.push(oid); changed = true; }
    });
    return { changed: changed, before: before, after: memberOrgIds(ctx, account) };
  }

  /* 移出组织：每条分配 scopeOrgIds 去掉 orgId；partOrgIds 去掉 orgId */
  function removeOrg(ctx, account, orgId) {
    var before = memberOrgIds(ctx, account);
    var changed = false;
    (ctx.assignments || []).forEach(function (a) {
      if (a.accountId !== account.id) return;
      var i = (a.scopeOrgIds || []).indexOf(orgId);
      if (i >= 0) { a.scopeOrgIds.splice(i, 1); changed = true; }
    });
    if (account.partOrgIds) {
      var j = account.partOrgIds.indexOf(orgId);
      if (j >= 0) { account.partOrgIds.splice(j, 1); changed = true; }
    }
    return { changed: changed, before: before, after: memberOrgIds(ctx, account) };
  }

  /* 添加角色：每个 roleId 生成一条分配，scopeOrgIds = 全部所属组织（可显式传 orgs，供新建账号）；跳过已存在 roleId */
  function addRoles(ctx, account, roleIds, orgs) {
    var before = accountRoleIds(ctx, account);
    var base = orgs || memberOrgIds(ctx, account);
    var added = [];
    (roleIds || []).forEach(function (rid) {
      if (!rid) return;
      if (before.indexOf(rid) >= 0) return;
      ctx.assignments = ctx.assignments || [];
      ctx.assignments.push({
        id: nextAssignId(), accountId: account.id, roleId: rid,
        scopeOrgIds: base.slice(),
        scopeGrades: {}, scopeClassIds: [],
        teachingScope: { majorIds: [], classIds: [], courseIds: [] }, extraPermIds: []
      });
      added.push(rid);
    });
    return { changed: added.length > 0, added: added, before: before, after: accountRoleIds(ctx, account) };
  }

  /* 移除角色：删除 accountId+roleId 匹配的分配 */
  function removeRoles(ctx, account, roleIds) {
    var before = accountRoleIds(ctx, account);
    var removed = [];
    ctx.assignments = (ctx.assignments || []).filter(function (a) {
      if (a.accountId !== account.id) return true;
      if ((roleIds || []).indexOf(a.roleId) >= 0) { removed.push(a.roleId); return false; }
      return true;
    });
    return { changed: removed.length > 0, removed: removed, before: before, after: accountRoleIds(ctx, account) };
  }

  /* 移出组织校验：主组织 / 唯一组织 不可移出 */
  function canRemoveOrg(ctx, account, orgId) {
    var ids = memberOrgIds(ctx, account);
    if (account.orgId === orgId) {
      return ids.length > 1
        ? { ok: false, reason: '主组织不能移出，请先修改主组织' }
        : { ok: false, reason: '唯一组织，如需离职请停用账号' };
    }
    if (ids.length <= 1) return { ok: false, reason: '唯一组织，如需离职请停用账号' };
    return { ok: true, reason: null };
  }

  return {
    memberOrgIds: memberOrgIds,
    accountRoleIds: accountRoleIds,
    addOrgs: addOrgs,
    removeOrg: removeOrg,
    addRoles: addRoles,
    removeRoles: removeRoles,
    canRemoveOrg: canRemoveOrg
  };
}));
