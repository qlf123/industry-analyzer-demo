/* 权限模块单元测试：覆盖 docs/permission-demo-spec.md 第 8 节 D-01 ~ D-23（函数层面）。
 * 运行：node --test test/permission.test.js   （或 node --test）
 * 页面级用例（如「看不到按钮」）在此以「判定不通过」表达。
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const DEMO = require('../js/mock-data.js');
const Perm = require('../js/permission.js');

function ctx() { return DEMO.clone(DEMO.INITIAL); }
function id(c, accountId) { return Perm.getIdentity(c, accountId); }
function firstStudent(c, klassId) { return c.students.find(function (s) { return s.klassId === klassId; }); }
function studentsOf(c, klassId) { return c.students.filter(function (s) { return s.klassId === klassId; }); }
function resource(c, rid) { return c.resources.find(function (r) { return r.id === rid; }); }

/* ── 数据引用一致性（自测数据质量） ── */
test('mock 数据引用一致', function () {
  const c = ctx();
  const orgIds = new Set(c.orgs.map(function (o) { return o.id; }));
  const baseIds = new Set(c.bases.map(function (b) { return b.id; }));
  const majorIds = new Set(c.majors.map(function (m) { return m.id; }));
  const klassIds = new Set(c.klasses.map(function (k) { return k.id; }));
  const gradeIds = new Set(c.grades.map(function (g) { return g.id; }));
  const studentIds = new Set(c.students.map(function (s) { return s.id; }));
  const roleIds = new Set(c.roles.map(function (r) { return r.id; }));
  const accountIds = new Set(c.accounts.map(function (a) { return a.id; }));

  c.orgs.forEach(function (o) { if (o.parentId) assert.ok(orgIds.has(o.parentId), '组织父节点存在 ' + o.id); });
  c.majors.forEach(function (m) { assert.ok(orgIds.has(m.orgId), '专业组织存在 ' + m.id); });
  c.klasses.forEach(function (k) {
    assert.ok(majorIds.has(k.majorId), '班级专业存在 ' + k.id);
    assert.ok(gradeIds.has(k.gradeId), '班级年级存在 ' + k.id);
  });
  c.students.forEach(function (s) {
    assert.ok(klassIds.has(s.klassId), '学生班级存在 ' + s.id);
    if (s.internshipBaseId) assert.ok(baseIds.has(s.internshipBaseId), '学生实习基地存在 ' + s.id);
  });
  c.accounts.forEach(function (a) {
    assert.ok(orgIds.has(a.orgId), '账号组织存在 ' + a.id);
    if (a.studentId) assert.ok(studentIds.has(a.studentId), '账号学生存在 ' + a.id);
    if (a.baseId) assert.ok(baseIds.has(a.baseId), '账号基地存在 ' + a.id);
  });
  c.bases.forEach(function (b) { assert.ok(orgIds.has(b.orgId), '基地所属组织存在 ' + b.id); });
  c.assignments.forEach(function (a) {
    assert.ok(accountIds.has(a.accountId), '分配账号存在 ' + a.id);
    assert.ok(roleIds.has(a.roleId), '分配角色存在 ' + a.id);
    a.scopeOrgIds.forEach(function (o) { assert.ok(orgIds.has(o), '分配组织存在 ' + a.id + ':' + o); });
    a.scopeClassIds.forEach(function (k) { assert.ok(klassIds.has(k), '分配班级存在 ' + a.id + ':' + k); });
    (a.teachingScope.classIds || []).forEach(function (k) { assert.ok(klassIds.has(k), '教学范围班级存在 ' + a.id + ':' + k); });
    Object.keys(a.scopeGrades || {}).forEach(function (o) { assert.ok(orgIds.has(o), '年级筛选组织存在 ' + a.id); });
  });
  c.demoIdentities.forEach(function (d) { assert.ok(accountIds.has(d.accountId), '演示身份账号存在 ' + d.id); });
  c.resources.forEach(function (r) { assert.ok(accountIds.has(r.ownerId), '资源作者存在 ' + r.id); assert.ok(orgIds.has(r.orgId), '资源组织存在 ' + r.id); });
  c.teacherProfiles.forEach(function (p) { assert.ok(accountIds.has(p.accountId), '教师档案账号存在 ' + p.id); });
  c.contents.forEach(function (ct) { assert.ok(orgIds.has(ct.orgId), '内容组织存在 ' + ct.id); });
  // 学号/手机号/身份证唯一
  const uniq = function (arr, f) { return new Set(arr.map(f)).size === arr.length; };
  assert.ok(uniq(c.students, function (s) { return s.sno; }), '学号唯一');
  assert.ok(uniq(c.students, function (s) { return s.phone; }), '手机号唯一');
  assert.ok(uniq(c.students, function (s) { return s.idCard; }), '身份证唯一');
});

/* ── D-01 刘院管：只看到旅游学院及下级账号 ── */
test('D-01 组织管理员@旅游学院 账号列表只含本范围', function () {
  const c = ctx();
  const liu = id(c, 'ACC-LIU');
  const visible = Perm.listFilter(c, liu, 'org:account:view', 'account', c.accounts).map(function (a) { return a.id; });
  const tourTree = Perm.descendants(c, 'ORG-TOURISM');
  assert.ok(visible.includes('ACC-HE'), '本范围账号可见');
  assert.ok(visible.includes('ACC-XU'), '本范围账号可见');
  assert.ok(!visible.includes('ACC-LI'), '酒店学院账号不可见');
  assert.ok(!visible.includes('ACC-WANG'), '公共基础部账号不可见');
  assert.ok(!visible.includes('ACC-SUPER'), '根账号不可见');
  visible.forEach(function (aid) {
    assert.ok(tourTree.has(c.accounts.find(function (a) { return a.id === aid; }).orgId), '账号组织均在旅游学院下级');
  });
});

/* ── D-02 陈双管：旅游学院 + 酒店学院都可见 ── */
test('D-02 双节点组织管理员 两学院账号都可见', function () {
  const c = ctx();
  const chen = id(c, 'ACC-CHEN');
  const visible = Perm.listFilter(c, chen, 'org:account:view', 'account', c.accounts).map(function (a) { return a.id; });
  assert.ok(visible.includes('ACC-LI'), '酒店学院账号可见');
  assert.ok(visible.includes('ACC-MA'), '酒店学院账号可见');
  assert.ok(visible.includes('ACC-HE'), '旅游学院账号可见');
  assert.ok(!visible.includes('ACC-WANG'), '公共基础部账号不可见');
});

/* ── D-03 李老师：组织管理员@酒店学院 + 教师@旅游管理2026级1班 ── */
test('D-03 李老师 旅游学院内容无审核按钮/账号不可见/本教学班成绩可见', function () {
  const c = ctx();
  const li = id(c, 'ACC-LI');
  const contTour = c.contents.find(function (x) { return x.orgId === 'ORG-TOUR-DEPT'; });
  assert.equal(Perm.check(c, li, 'teaching:content:audit', contTour, 'content').allowed, false, '旅游学院内容不可审核');
  assert.equal(Perm.check(c, li, 'org:account:view', id(c, 'ACC-HE').account, 'account').allowed, false, '旅游学院账号不可见');
  const stu = firstStudent(c, 'K-T26-1');
  assert.equal(Perm.check(c, li, 'student:score:view', stu, 'score').allowed, true, '教学范围内班级成绩可见');
});

/* ── D-04 王老师：只能看教学范围两个班成绩 ── */
test('D-04 教师 学生成绩只含教学范围两个班', function () {
  const c = ctx();
  const wang = id(c, 'ACC-WANG');
  const visible = Perm.listFilter(c, wang, 'student:score:view', 'student', c.students);
  const klassIds = new Set(visible.map(function (s) { return s.klassId; }));
  assert.deepEqual([...klassIds].sort(), ['K-H26-1', 'K-T26-1'], '仅两个教学班');
});

/* ── D-05 刘院管：授权约束 ── */
test('D-05 不能给自己分配角色 / 授出范围不能超出自身', function () {
  const c = ctx();
  const liu = id(c, 'ACC-LIU');
  const selfAssign = { scopeOrgIds: ['ORG-TOUR-DEPT'], scopeGrades: {}, scopeClassIds: [], teachingScope: { classIds: [], majorIds: [], courseIds: [] }, roleId: 'R-ORG-ADMIN', extraPermIds: [] };
  const r1 = Perm.canDelegate(c, liu, 'ACC-LIU', selfAssign);
  assert.equal(r1.ok, false, '不能给自己');
  assert.ok(/自己/.test(r1.reason), '原因含「自己」');
  const otherAssign = { scopeOrgIds: ['ORG-HOTEL'], scopeGrades: {}, scopeClassIds: [], teachingScope: { classIds: [], majorIds: [], courseIds: [] }, roleId: 'R-ORG-ADMIN', extraPermIds: [] };
  const r2 = Perm.canDelegate(c, liu, 'ACC-HE', otherAssign);
  assert.equal(r2.ok, false, '酒店学院超出范围');
  assert.ok(/超出/.test(r2.reason), '原因含「超出」');
});

/* ── D-06 郑督导：无内容审核按钮 ── */
test('D-06 督导无内容审核发布权限', function () {
  const c = ctx();
  const zheng = id(c, 'ACC-ZHENG');
  const cont = c.contents[0];
  assert.equal(Perm.check(c, zheng, 'teaching:content:audit', cont, 'content').allowed, false, '督导不可审核');
});

/* ── D-07 钱信息：无角色管理入口，可做账号维护 ── */
test('D-07 信息中心 无角色定义 / 可账号编辑', function () {
  const c = ctx();
  const qian = id(c, 'ACC-QIAN');
  assert.equal(Perm.check(c, qian, 'org:role:define', null, null).allowed, false, '无角色管理入口');
  assert.equal(Perm.check(c, qian, 'org:account:edit', id(c, 'ACC-HE').account, 'account').allowed, true, '可账号编辑');
});

/* ── D-08 周教务：成绩明文 / 身份证不可见 / 手机号脱敏 ── */
test('D-08 教务 学生成绩明文、身份证不可见、手机号脱敏', function () {
  const c = ctx();
  const zhou = id(c, 'ACC-ZHOU');
  const stu = firstStudent(c, 'K-T26-1');
  const score = Perm.maskField(c, zhou, 'score', stu, 'student');
  assert.equal(score.mode, 'plain', '成绩明文');
  assert.deepEqual(score.value, stu.scores, '成绩原值');
  const idCard = Perm.maskField(c, zhou, 'idCard', stu, 'student');
  assert.equal(idCard.mode, 'hidden', '身份证不可见');
  const phone = Perm.maskField(c, zhou, 'phone', stu, 'student');
  assert.equal(phone.mode, 'mask', '手机号脱敏');
  assert.equal(phone.value, stu.phone.slice(0, 3) + '********', '脱敏格式');
});

/* ── D-09 赵辅导员：只旅游学院 2026 级 ── */
test('D-09 辅导员（组织+年级）只看到本范围本年级学生', function () {
  const c = ctx();
  const zhao = id(c, 'ACC-ZHAO');
  const visible = Perm.listFilter(c, zhao, 'student:info:view', 'student', c.students);
  const tourTree = Perm.descendants(c, 'ORG-TOURISM');
  assert.ok(visible.length > 0);
  visible.forEach(function (s) {
    const klass = c.klasses.find(function (k) { return k.id === s.klassId; });
    assert.ok(klass.gradeId === 'G-2026', '年级均为 2026');
    assert.ok(tourTree.has(c.majors.find(function (m) { return m.id === klass.majorId; }).orgId), '组织均在旅游学院下级');
  });
  assert.ok(!visible.some(function (s) { return s.klassId === 'K-T25-1'; }), '2025 级不可见');
});

/* ── D-10 孙班主任：只本班；手机/住址全量、身份证脱敏 ── */
test('D-10 班主任 只本班，手机/住址全量、身份证脱敏', function () {
  const c = ctx();
  const sun = id(c, 'ACC-SUN');
  const visible = Perm.listFilter(c, sun, 'student:info:view', 'student', c.students);
  assert.deepEqual([...new Set(visible.map(function (s) { return s.klassId; }))], ['K-S25-1'], '仅本班');
  const stu = firstStudent(c, 'K-S25-1');
  assert.equal(Perm.maskField(c, sun, 'phone', stu, 'student').mode, 'plain', '手机全量');
  assert.equal(Perm.maskField(c, sun, 'address', stu, 'student').mode, 'plain', '住址全量');
  assert.equal(Perm.maskField(c, sun, 'idCard', stu, 'student').mode, 'id', '身份证脱敏');
});

/* ── D-11 吴学工：身份证明文授权前后 + 写审计 ── */
test('D-11 学工身份证：授权前脱敏、授权后全量，均写审计', function () {
  const c = ctx();
  const wu = id(c, 'ACC-WU');
  const stu = firstStudent(c, 'K-T26-1');
  const before = Perm.maskField(c, wu, 'idCard', stu, 'student');
  assert.equal(before.mode, 'id', '授权前脱敏');
  assert.equal(before.value, stu.idCard.slice(0, 6) + '********' + stu.idCard.slice(-4), '脱敏格式');

  const c2 = ctx();
  c2.assignments.find(function (a) { return a.accountId === 'ACC-WU'; }).extraPermIds = ['student:idcard:plain'];
  const wu2 = id(c2, 'ACC-WU');
  const after = Perm.maskField(c2, wu2, 'idCard', stu, 'student');
  assert.equal(after.mode, 'plain', '授权后全量');

  const rec = Perm.buildAudit('ACC-SUPER', '授予身份证明文', 'ACC-WU', { perm: 'student:idcard:plain' }, null, '成功');
  assert.equal(rec.result, '成功');
  assert.equal(rec.actorId, 'ACC-SUPER');
  const state = ctx();
  const rec2 = DEMO.addAudit(state, 'ACC-SUPER', '授予身份证明文', 'ACC-WU', null, null, '成功');
  assert.equal(state.audits.length, 1, '审计落库');
  assert.ok(rec2.id, '审计有 id');
});

/* ── D-12 刘院管：删除挂有专业的节点被拒并列出阻塞 ── */
test('D-12 删除挂有专业的节点被拒绝并列出阻塞对象', function () {
  const c = ctx();
  const liu = id(c, 'ACC-LIU');
  assert.equal(Perm.orgCanEdit(c, liu, c.orgs.find(function (o) { return o.id === 'ORG-GUIDE-ROOM'; })), true, '导游教研室在其可操作范围');
  const r = Perm.checkDeleteOrg(c, liu, 'ORG-GUIDE-ROOM');
  assert.equal(r.allowed, false, '删除被拒绝');
  assert.ok(r.blockers.some(function (b) { return b.type === '专业' && b.name === '导游'; }), '阻塞对象含导游专业');
});

/* ── D-13 超管：停用节点后不可选，已有授权显示已停用且保持有效 ── */
test('D-13 停用节点不可再选，已有授权显示已停用但保持有效', function () {
  const c = ctx();
  c.assignments.push({ id: 'A-TEST', accountId: 'ACC-HE', roleId: 'R-ORG-ADMIN', scopeOrgIds: ['ORG-GUIDE-ROOM'], scopeGrades: {}, scopeClassIds: [], teachingScope: { classIds: [], majorIds: [], courseIds: [] }, extraPermIds: [] });
  c.orgs.find(function (o) { return o.id === 'ORG-GUIDE-ROOM'; }).status = 'disabled';
  const selectable = Perm.visibleOrgNodes(c, id(c, 'ACC-SUPER'), { forAssign: true }).map(function (o) { return o.id; });
  assert.ok(!selectable.includes('ORG-GUIDE-ROOM'), '停用节点不可再选');
  const prior = c.assignments.find(function (a) { return a.id === 'A-TEST'; });
  const dis = Perm.assignmentDisabledNodes(c, prior);
  assert.ok(dis.some(function (d) { return d.orgId === 'ORG-GUIDE-ROOM'; }), '已有授权显示节点已停用');
  const stu = firstStudent(c, 'K-G26-1');
  assert.equal(Perm.check(c, id(c, 'ACC-HE'), 'student:info:view', stu, 'student').allowed, true, '已有授权保持有效');
});

/* ── 组织节点被角色范围引用时不可删除（7.1 补充） ── */
test('组织节点被角色范围引用时不可删除并列出阻塞', function () {
  const c = ctx();
  c.assignments.push({ id: 'A-SCOPE-REF', accountId: 'ACC-HE', roleId: 'R-ORG-ADMIN', scopeOrgIds: ['ORG-CONTINUING'], scopeGrades: {}, scopeClassIds: [], teachingScope: { classIds: [], majorIds: [], courseIds: [] }, extraPermIds: [] });
  const r = Perm.checkDeleteOrg(c, id(c, 'ACC-SUPER'), 'ORG-CONTINUING');
  assert.equal(r.allowed, false, '被角色范围引用不可删除');
  assert.ok(r.blockers.some(function (b) { return b.type === '角色范围引用'; }), '阻塞对象含角色范围引用');
});

/* ── D-14 王老师共享课件给酒店学院 ── */
test('D-14 共享到酒店学院：马老师可看、何老师不可看', function () {
  const c = ctx();
  const r = resource(c, 'RES-W1');
  r.shared = true;
  r.shareTargets = [{ type: 'org', targetId: 'ORG-HOTEL' }];
  assert.equal(Perm.canAccessResource(c, id(c, 'ACC-MA'), r, 'view'), true, '马老师可查看');
  assert.equal(Perm.canAccessResource(c, id(c, 'ACC-HE'), r, 'view'), false, '何老师不可查看');
});

/* ── D-15 马老师复制副本：原件不变 ── */
test('D-15 复制副本不改动原件', function () {
  const c = ctx();
  const r = resource(c, 'RES-W1');
  const copy = DEMO.clone(r);
  copy.id = r.id + '-COPY';
  copy.ownerId = 'ACC-MA';
  copy.shared = false;
  copy.shareTargets = [];
  assert.equal(copy.ownerId, 'ACC-MA', '副本作者为马老师');
  assert.equal(r.ownerId, 'ACC-WANG', '原件作者不变');
  assert.notEqual(copy.id, r.id, '副本独立 id');
  copy.title = '副本标题';
  assert.notEqual(r.title, '副本标题', '改动副本不影响原件');
});

/* ── D-16 推荐→发布：发布前全校不可见、发布后可见 ── */
test('D-16 校本资源库：发布前全校不可见、发布后可见', function () {
  const c = ctx();
  const r = resource(c, 'RES-W1');
  assert.equal(Perm.canShareResource(c, id(c, 'ACC-WANG'), r), true, '作者可共享（课件）');
  assert.equal(Perm.canShareResource(c, id(c, 'ACC-WANG'), resource(c, 'RES-W4')), false, '学情分析不可共享');
  r.recommended = true;
  assert.equal(Perm.canPublishResource(c, id(c, 'ACC-ZHOU'), r), true, '教务可发布推荐资源');
  assert.equal(Perm.canAccessResource(c, id(c, 'ACC-HE'), r, 'view'), false, '发布前其他教师不可见');
  r.published = true;
  assert.equal(Perm.canAccessResource(c, id(c, 'ACC-HE'), r, 'view'), true, '发布后其他教师可见');
});

/* ── D-17 撤回共享：原件不可见、副本仍在 ── */
test('D-17 撤回共享后原件不可见、副本仍在', function () {
  const c = ctx();
  const r = resource(c, 'RES-W1');
  r.shared = true;
  r.shareTargets = [{ type: 'org', targetId: 'ORG-HOTEL' }];
  assert.equal(Perm.canAccessResource(c, id(c, 'ACC-MA'), r, 'view'), true, '共享时可见');
  r.shared = false;
  r.shareTargets = [];
  assert.equal(Perm.canAccessResource(c, id(c, 'ACC-MA'), r, 'view'), false, '撤回后不可见');
  const copy = DEMO.clone(resource(c, 'RES-M1'));
  copy.id = 'RES-M1-COPY';
  copy.ownerId = 'ACC-MA';
  assert.equal(Perm.canAccessResource(c, id(c, 'ACC-MA'), copy, 'view'), true, '副本仍可见');
});

/* ── D-18 已毕业学生 / 教师对 2023 级只读 ── */
test('D-18 已毕业学生只读，无提交按钮；教师对 2023 级只读', function () {
  const c = ctx();
  const grad = id(c, 'ACC-GRAD');
  const stu = c.students.find(function (s) { return s.id === 'STU-T23-1-01'; });
  assert.equal(Perm.canSubmitHomework(c, grad), false, '已毕业学生无提交按钮');
  assert.equal(Perm.check(c, grad, 'student:info:view', stu, 'student').allowed, true, '本人信息可查看');
  assert.equal(Perm.studentReadonly(c, stu), true, '已毕业学生只读');
  const active = firstStudent(c, 'K-T26-1');
  assert.equal(Perm.studentReadonly(c, active), false, '在读学生非只读');
});

/* ── D-18 补充：在读学生有提交按钮（正向路径） ── */
test('在读学生有提交按钮（正向）', function () {
  const c = ctx();
  const active = firstStudent(c, 'K-T26-1'); // 在读
  assert.equal(active.status, '在读', '样本为在读');
  const fakeId = { account: { id: 'X', kind: '学生', studentId: active.id, status: '正常' }, assignments: [] };
  assert.equal(Perm.canSubmitHomework(c, fakeId), true, '在读学生可提交');
});

/* ── D-19 判定过程说明完整性 ── */
test('D-19 判定过程说明完整（命中分配/功能/范围/脱敏档）', function () {
  const c = ctx();
  const li = id(c, 'ACC-LI');
  const stu = firstStudent(c, 'K-T26-1');
  const t = Perm.explain(c, li, 'student:score:view', stu, 'score');
  assert.equal(t.assignments.length, 2, '列出全部分配');
  t.assignments.forEach(function (a) {
    assert.equal(typeof a.hasPerm, 'boolean', '每条有功能判定');
    assert.ok(a.scopePass === true || a.scopePass === false || a.scopePass === null, '每条有范围判定');
    assert.ok(a.roleName, '每条有角色名');
  });
  assert.ok(t.winningAssignmentId, '有命中分配');
  assert.ok(t.maskGroup, '有脱敏档');
  const denied = Perm.explain(c, li, 'teaching:content:audit', c.contents[0], 'content');
  assert.equal(denied.allowed, false);
  assert.ok(denied.denyReason, '拒绝时有原因');
});

/* ── D-20 许院管：学生带年级筛选、教师档案不带 ── */
test('D-20 组织管理员（+年级）学生按年级、教师档案不受年级影响', function () {
  const c = ctx();
  const xu = id(c, 'ACC-XU');
  const stuVisible = Perm.listFilter(c, xu, 'student:info:view', 'student', c.students);
  stuVisible.forEach(function (s) {
    const klass = c.klasses.find(function (k) { return k.id === s.klassId; });
    assert.equal(klass.gradeId, 'G-2026', '学生均 2026 级');
  });
  assert.ok(!stuVisible.some(function (s) { return s.klassId === 'K-T25-1'; }), '2025 级不可见');
  const profVisible = Perm.listFilter(c, xu, 'teaching:profile:view', 'teacherProfile', c.teacherProfiles).map(function (p) { return p.id; });
  assert.ok(profVisible.includes('TP-HE'), '旅游学院教师档案可见');
  assert.ok(!profVisible.includes('TP-MA'), '酒店学院教师档案不可见');
  assert.ok(!profVisible.includes('TP-WANG'), '公共基础部教师档案不可见');
});

/* ── D-21 冯导师：只本基地实习学生；AI 配额可见 ── */
test('D-21 企业导师 只本基地实习学生，AI 配额可见', function () {
  const c = ctx();
  const feng = id(c, 'ACC-FENG');
  const visible = Perm.listFilter(c, feng, 'student:info:view', 'student', c.students);
  assert.equal(visible.length, 3, '仅 3 名酒店基地实习生');
  visible.forEach(function (s) { assert.equal(s.internshipBaseId, 'BASE-HOTEL', '均在本基地'); });
  assert.ok(!visible.some(function (s) { return s.internshipBaseId === 'BASE-SCENIC'; }), '景区基地学生不可见');
  assert.ok(Perm.effectiveAiQuota(c, feng) > 0, 'AI 配额可见');
});

/* ── D-22 停用账号：分配失效、判定全不通过 ── */
test('D-22 停用账号分配失效、判定全不通过', function () {
  const c = ctx();
  const stop = id(c, 'ACC-STOP');
  assert.equal(stop.assignments.length, 1, '停用老师存在分配记录');
  assert.equal(Perm.activeAssignments(c, stop).length, 0, '分配全部失效');
  const stu = firstStudent(c, 'K-H26-1');
  const r = Perm.check(c, stop, 'student:score:view', stu, 'score');
  assert.equal(r.allowed, false, '判定不通过');
  assert.ok(/停用/.test(r.denyReason), '原因含「停用」');
});

/* ── D-23 已毕业学生查看本人：手机/身份证/住址全量 ── */
test('D-23 学生查看本人信息全量', function () {
  const c = ctx();
  const grad = id(c, 'ACC-GRAD');
  const stu = c.students.find(function (s) { return s.id === 'STU-T23-1-01'; });
  const phone = Perm.maskField(c, grad, 'phone', stu, 'student');
  assert.equal(phone.mode, 'plain', '手机全量');
  assert.equal(phone.value, stu.phone, '手机原值');
  const idCard = Perm.maskField(c, grad, 'idCard', stu, 'student');
  assert.equal(idCard.mode, 'plain', '身份证全量');
  assert.equal(idCard.value, stu.idCard, '身份证原值');
  const addr = Perm.maskField(c, grad, 'address', stu, 'student');
  assert.equal(addr.mode, 'plain', '住址全量');
});

/* ── D-24 陈双管：当前组织切换（过滤不改变权限，可区分被过滤与无权限） ── */
test('D-24 当前组织切换：过滤不改变权限，能区分被过滤与无权限，菜单不变', function () {
  const c = ctx();
  const chen = id(c, 'ACC-CHEN');
  // 全部授权范围（默认）：两学院账号都可见
  const all = Perm.listFilter(c, chen, 'org:account:view', 'account', c.accounts).map(function (a) { return a.id; });
  assert.ok(all.includes('ACC-LI') && all.includes('ACC-HE'), '全部范围两学院都可见');
  // 当前组织可选项 = 旅游学院 + 酒店学院 及其下级
  const opts = Perm.currentOrgOptions(c, chen).map(function (o) { return o.id; });
  assert.ok(opts.includes('ORG-TOURISM') && opts.includes('ORG-HOTEL'), '可选项含两个学院节点');
  // 切到「旅游学院」
  const r = Perm.listFilterWithOrg(c, chen, 'org:account:view', 'account', c.accounts, 'ORG-TOURISM');
  assert.ok(r.visible.some(function (a) { return a.id === 'ACC-HE'; }), '旅游学院账号可见');
  assert.ok(!r.visible.some(function (a) { return a.id === 'ACC-LI'; }), '酒店学院账号不在可见列表');
  assert.ok(r.filteredOut.some(function (a) { return a.id === 'ACC-LI'; }), '酒店学院账号标注为被当前组织过滤');
  assert.ok(r.filteredOut.some(function (a) { return a.id === 'ACC-MA'; }), '另一酒店学院账号同样被过滤');
  assert.ok(r.denied.some(function (a) { return a.id === 'ACC-WANG'; }), '公共基础部账号为无权限');
  assert.ok(!r.filteredOut.some(function (a) { return a.id === 'ACC-WANG'; }), '无权限账号不算被过滤');
  // 单条判定状态：酒店学院账号 = filteredOut（有权限被过滤）
  assert.equal(Perm.listItemStatus(c, chen, 'org:account:view', id(c, 'ACC-LI').account, 'account', 'ORG-TOURISM'), 'filteredOut');
  // 判定过程说明含「被当前组织过滤」
  const t = Perm.explain(c, chen, 'org:account:view', id(c, 'ACC-LI').account, 'account', 'ORG-TOURISM');
  assert.equal(t.allowed, true, '权限通过');
  assert.equal(t.orgFiltered, true, '被当前组织过滤');
  assert.equal(t.hiddenReason, '有权限，被当前组织过滤');
  // 切回「全部授权范围」
  const back = Perm.listFilterWithOrg(c, chen, 'org:account:view', 'account', c.accounts, null);
  assert.ok(back.visible.some(function (a) { return a.id === 'ACC-LI'; }) && back.visible.some(function (a) { return a.id === 'ACC-HE'; }), '切回后两学院都可见');
  // 菜单由角色决定，权限判定不受当前组织影响
  assert.equal(Perm.check(c, chen, 'org:node:edit', null, null).allowed, true, '组织管理权限（菜单）始终可用');
  assert.equal(Perm.check(c, chen, 'org:account:view', id(c, 'ACC-LI').account, 'account').allowed, true, '权限判定不受当前组织影响');
  // 没有组织节点范围的身份没有当前组织
  assert.equal(Perm.currentOrgOptions(c, id(c, 'ACC-WANG')).length, 0, '教师无当前组织');
  assert.equal(Perm.currentOrgOptions(c, id(c, 'ACC-SUN')).length, 0, '班主任无当前组织');
  assert.equal(Perm.currentOrgOptions(c, id(c, 'ACC-FENG')).length, 0, '企业导师无当前组织');
  assert.equal(Perm.currentOrgOptions(c, id(c, 'ACC-GRAD')).length, 0, '学生无当前组织');
  assert.ok(Perm.currentOrgOptions(c, id(c, 'ACC-ZHOU')).length > 0, '教务有当前组织');
});
