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
    if (a.partOrgIds) a.partOrgIds.forEach(function (oid) { assert.ok(orgIds.has(oid), '账号兼职组织存在 ' + a.id); });
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
  assert.ok(visible.includes('ACC-WANG'), '公共基础部账号因兼职旅游学院可见');
  assert.ok(!visible.includes('ACC-SUPER'), '根账号不可见');
  visible.forEach(function (aid) {
    var a = c.accounts.find(function (x) { return x.id === aid; });
    assert.ok(Perm.accountOrgIds(c, a).some(function (oid) { return tourTree.has(oid); }), '账号主/兼职组织均在旅游学院下级');
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
  assert.ok(visible.includes('ACC-WANG'), '公共基础部账号因兼职旅游学院可见');
});

/* ── D-03 李老师：平台超级管理员（全权限）+ 教师@旅游管理2026级1班 ── */
test('D-03 李老师 管理端全平台可见，教师端仍限本班', function () {
  const c = ctx();
  const li = id(c, 'ACC-LI');
  // 多端身份缺省按管理端判定：超管全平台
  const liAdmin = id(c, 'ACC-LI');
  const contTour = c.contents.find(function (x) { return x.orgId === 'ORG-TOUR-DEPT'; });
  assert.equal(Perm.check(c, liAdmin, 'teaching:content:audit', contTour, 'content').allowed, true, '管理端：旅游学院内容可审核');
  assert.equal(Perm.check(c, liAdmin, 'org:account:view', id(c, 'ACC-HE').account, 'account').allowed, true, '管理端：旅游学院账号可见');
  // 切到教师端：教师@旅游管理 2026 级 1 班（超管不跨端）
  const liTeacher = id(c, 'ACC-LI');
  liTeacher.currentPortal = 'teacher';
  const stu = firstStudent(c, 'K-T26-1');
  assert.equal(Perm.check(c, liTeacher, 'student:score:view', stu, 'score').allowed, true, '教师端：教学范围内班级成绩可见');
  assert.equal(Perm.check(c, liTeacher, 'org:account:view', id(c, 'ACC-HE').account, 'account').allowed, false, '教师端：跨端无账号查看权限');
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
  li.currentPortal = 'teacher'; // 李老师为多端身份，成绩命中在教师端
  const stu = firstStudent(c, 'K-T26-1');
  const t = Perm.explain(c, li, 'student:score:view', stu, 'score');
  assert.equal(t.assignments.length, 3, '列出全部分配（含另一端）');
  t.assignments.forEach(function (a) {
    assert.equal(typeof a.hasPerm, 'boolean', '每条有功能判定');
    assert.ok(a.scopePass === true || a.scopePass === false || a.scopePass === null, '每条有范围判定');
    assert.ok(a.roleName, '每条有角色名');
    assert.equal(typeof a.inPortal, 'boolean', '每条有是否当前端标记');
  });
  assert.equal(t.currentPortal, 'teacher', '标注当前端');
  assert.ok(t.assignments.some(function (a) { return a.inPortal === false; }), '另一端分配标记为不参与');
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
  assert.ok(profVisible.includes('TP-WANG'), '公共基础部教师档案因兼职旅游学院可见');
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
  assert.ok(r.visible.some(function (a) { return a.id === 'ACC-WANG'; }), '公共基础部账号因兼职旅游学院可见');
  assert.ok(!r.filteredOut.some(function (a) { return a.id === 'ACC-WANG'; }), '兼职账号不算被过滤');
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

/* ── D-31 刘院管：王老师兼职可见，不可维护主组织 ── */
test('D-31 王老师兼职旅游学院：可查看、不可维护主组织、主+兼职组织口径', function () {
  const c = ctx();
  const liu = id(c, 'ACC-LIU');
  const wang = id(c, 'ACC-WANG').account;
  assert.deepEqual(Perm.accountOrgIds(c, wang), ['ORG-BASE-DEPT', 'ORG-TOURISM'], '主组织在前、兼职在后');
  assert.equal(Perm.accountMainOrgId(wang), 'ORG-BASE-DEPT', '主组织为公共基础部');
  assert.equal(Perm.accountPartOrgIds(wang).length, 1, '兼职组织为旅游学院一项');
  assert.equal(Perm.check(c, liu, 'org:account:view', wang, 'account').allowed, true, '兼职命中可查看');
  assert.equal(Perm.check(c, liu, 'org:account:edit', wang, 'account').allowed, false, '范围未覆盖主组织，不可维护');
});

/* ── D-32 刘院管：为马老师增删兼职组织 ── */
test('D-32 为马老师增删兼职组织：增可见、删不可见、主组织不可改', function () {
  const c = ctx();
  const liu = id(c, 'ACC-LIU');
  const ma = id(c, 'ACC-MA').account;
  // 增加兼职组织「导游教研室」（旅游学院下级）
  ma.partOrgIds = ['ORG-GUIDE-ROOM'];
  assert.equal(Perm.check(c, liu, 'org:account:view', ma, 'account').allowed, true, '兼职导游教研室命中可见');
  assert.equal(Perm.check(c, liu, 'org:account:edit', ma, 'account').allowed, false, '主组织酒店学院不在范围，不可维护');
  // 移除兼职组织
  ma.partOrgIds = [];
  assert.equal(Perm.check(c, liu, 'org:account:view', ma, 'account').allowed, false, '移除兼职后不可见');
});

/* ── D-33 主组织单选、兼职组织扁平且不与主组织重复 ── */
test('D-33 主组织单选、兼职组织扁平且不与主组织重复', function () {
  const c = ctx();
  const wang = id(c, 'ACC-WANG').account;
  assert.equal(typeof wang.orgId, 'string', '主组织为单个值');
  assert.ok(!wang.partOrgIds.includes(wang.orgId), '兼职组织不包含主组织');
  assert.deepEqual(wang.partOrgIds, ['ORG-TOURISM'], '兼职组织为扁平选中节点（无级联下级自动填充）');
});

/* ── D-34 张校管：删除旅游学院因王老师兼职组织被拒 ── */
test('D-34 删除旅游学院：王老师兼职组织阻塞删除', function () {
  const c = ctx();
  const zhang = id(c, 'ACC-ZHANG');
  const r = Perm.checkDeleteOrg(c, zhang, 'ORG-TOURISM');
  assert.equal(r.allowed, false, '删除被拒绝');
  assert.ok(r.blockers.some(function (b) { return b.type === '账号' && b.name === '王老师'; }), '阻塞对象含王老师');
});

/* ── D-35 陈双管/周教务：只有管理端（无切换按钮），同端多分配取并集 ── */
test('D-35 陈双管/周教务 仅管理端，同端多条分配合并生效', function () {
  const c = ctx();
  const chen = id(c, 'ACC-CHEN');
  const zhou = id(c, 'ACC-ZHOU');
  // 只有一个端 → 无「切换到教师端」按钮（rolePortals 长度 1）
  assert.deepEqual(Perm.rolePortals(c, chen), ['admin'], '陈双管仅管理端');
  assert.deepEqual(Perm.rolePortals(c, zhou), ['admin'], '周教务仅管理端');
  assert.equal(Perm.defaultPortal(c, chen), 'admin', '陈双管默认管理端');
  assert.equal(Perm.defaultPortal(c, zhou), 'admin', '周教务默认管理端');
  // 陈双管两条组织管理员分配（旅游学院 + 酒店学院）同端取并集
  assert.equal(Perm.check(c, chen, 'org:account:view', id(c, 'ACC-HE').account, 'account').allowed, true, '旅游学院账号可见');
  assert.equal(Perm.check(c, chen, 'org:account:view', id(c, 'ACC-MA').account, 'account').allowed, true, '酒店学院账号可见');
  // 周教务：加第二条管理端分配（东校区），两条都在当前端生效、范围取并集
  c.assignments.push({ id: 'A-ZHOU-2', accountId: 'ACC-ZHOU', roleId: 'R-ACADEMIC', scopeOrgIds: ['ORG-EAST'], scopeGrades: {}, scopeClassIds: [], teachingScope: { majorIds: [], classIds: [], courseIds: [] }, extraPermIds: [] });
  const zhou2 = id(c, 'ACC-ZHOU');
  assert.equal(Perm.activeAssignments(c, zhou2).length, 2, '两条分配都在管理端生效');
  assert.equal(Perm.check(c, zhou2, 'student:score:view', firstStudent(c, 'K-H25-1'), 'score').allowed, true, '东校区范围分配生效');
  assert.equal(Perm.check(c, zhou2, 'student:score:view', firstStudent(c, 'K-S25-1'), 'score').allowed, true, '根范围分配仍生效（并集）');
});

/* ── D-36 李老师：跨端不混、默认进入管理端 ── */
test('D-36 李老师 跨端不混，默认进入管理端', function () {
  const c = ctx();
  const li = id(c, 'ACC-LI');
  // 可进入两个端
  assert.deepEqual(Perm.rolePortals(c, li), ['admin', 'teacher'], '李老师可进入管理端与教师端');
  assert.equal(Perm.defaultPortal(c, li), 'admin', '多端无记录默认管理端');
  // 管理端（缺省）：超管全平台
  assert.equal(Perm.check(c, li, 'org:account:view', id(c, 'ACC-MA').account, 'account').allowed, true, '管理端：酒店学院账号可见');
  assert.equal(Perm.check(c, li, 'org:account:view', id(c, 'ACC-HE').account, 'account').allowed, true, '管理端：旅游学院账号可见（超管全平台）');
  // 教师端：教师@旅游管理 2026 级 1 班；跨端角色不参与
  const liTeacher = id(c, 'ACC-LI');
  liTeacher.currentPortal = 'teacher';
  assert.equal(Perm.check(c, liTeacher, 'student:score:view', firstStudent(c, 'K-T26-1'), 'score').allowed, true, '教师端：本班成绩可见');
  assert.equal(Perm.check(c, liTeacher, 'org:account:view', id(c, 'ACC-MA').account, 'account').allowed, false, '教师端：跨端不混，酒店学院账号不可见');
  assert.equal(Perm.check(c, liTeacher, 'student:score:view', firstStudent(c, 'K-T25-1'), 'score').allowed, false, '教师端：非教学班成绩不可见');
  // 停用老师：无任何可进入的端
  assert.deepEqual(Perm.rolePortals(c, id(c, 'ACC-STOP')), [], '停用老师无可进入端');
  assert.equal(Perm.defaultPortal(c, id(c, 'ACC-STOP')), null, '停用老师默认端为空');
});

/* ── D-35 / D-36 补充：common.js 的端判定（不持久化，多端默认管理端） ── */
function freshUI() {
  global.Perm = Perm;
  global.DEMO = DEMO;
  global.window = global.window || { console: console };
  delete require.cache[require.resolve('../js/common.js')];
  return require('../js/common.js');
}

test('common.js portalOf：单端 / 多端默认管理端 / 无有效分配（不记忆）', function () {
  const UI = freshUI();
  const c = ctx();
  assert.equal(UI.portalOf(c, id(c, 'ACC-CHEN')), 'admin', '陈双管单端→管理端');
  assert.equal(UI.portalOf(c, id(c, 'ACC-WANG')), 'teacher', '王老师单端→教师端');
  assert.equal(UI.portalOf(c, id(c, 'ACC-GRAD')), 'student', '已毕业学生→学生端');
  assert.equal(UI.portalOf(c, id(c, 'ACC-LI')), 'admin', '李老师多端→默认管理端（不再记忆上次端）');
  assert.equal(UI.portalOf(c, id(c, 'ACC-STOP')), null, '停用老师→无可用端');
});

/* ── 成员批量操作（js/member.js）与新增权限点 ── */
const Member = require('../js/member.js');

test('新增权限点：组织成员管理 / 账号新建 已注册', function () {
  const c = ctx();
  const codes = c.permissions.map(function (p) { return p.code; });
  assert.ok(codes.indexOf('org:member:manage') >= 0, '有 组织成员管理');
  assert.ok(codes.indexOf('account:account:create') >= 0, '有 账号新建');
});

test('学院秘书 / 信息中心 / 组织管理员 的成员与账号新建权限差异', function () {
  const c = ctx();
  function perms(roleId) { return c.roles.find(function (r) { return r.id === roleId; }).permissionIds; }
  assert.ok(perms('R-SECRETARY').indexOf('org:member:manage') >= 0, '学院秘书有成员管理');
  assert.ok(perms('R-SECRETARY').indexOf('account:account:create') < 0, '学院秘书无账号新建');
  assert.ok(perms('R-SECRETARY').indexOf('org:account:view') >= 0, '学院秘书有账号查看');
  assert.ok(perms('R-SECRETARY').indexOf('org:node:view') >= 0, '学院秘书有节点查看');
  assert.ok(perms('R-INFO').indexOf('account:account:create') >= 0, '信息中心有账号新建');
  assert.ok(perms('R-INFO').indexOf('org:member:manage') < 0, '信息中心无成员管理');
  assert.ok(perms('R-ORG-ADMIN').indexOf('org:member:manage') >= 0, '组织管理员有成员管理');
  assert.ok(perms('R-ORG-ADMIN').indexOf('account:account:create') >= 0, '组织管理员有账号新建');
});

test('秦秘书身份：主组织旅游学院、角色学院秘书、可进入管理端', function () {
  const c = ctx();
  const qin = id(c, 'ACC-QIN');
  assert.equal(Perm.accountMainOrgId(qin.account), 'ORG-TOURISM', '主组织旅游学院');
  const roleIds = c.assignments.filter(function (a) { return a.accountId === 'ACC-QIN'; }).map(function (a) { return a.roleId; });
  assert.deepEqual(roleIds, ['R-SECRETARY'], '角色学院秘书');
  assert.deepEqual(Perm.rolePortals(c, qin), ['admin'], '可进入管理端');
});

test('秦秘书 组织成员管理范围：旅游学院账号允许、酒店学院账号拒绝', function () {
  const c = ctx();
  const qin = id(c, 'ACC-QIN');
  const tourAcc = id(c, 'ACC-LIU');   // 刘院管，orgId ORG-TOURISM
  const hotelAcc = id(c, 'ACC-MA');   // 马老师，orgId ORG-HOTEL
  assert.equal(Perm.check(c, qin, 'org:member:manage', tourAcc.account, 'account').allowed, true, '旅游学院账号允许');
  assert.equal(Perm.check(c, qin, 'org:member:manage', hotelAcc.account, 'account').allowed, false, '酒店学院账号拒绝');
});

test('member.js 成员口径：加入/移出组织、添加角色 scopeOrgIds=全部所属组织、主组织校验', function () {
  const c = ctx();
  const qin = c.accounts.find(function (a) { return a.id === 'ACC-QIN'; });
  assert.deepEqual(Member.memberOrgIds(c, qin), ['ORG-TOURISM'], '初始仅旅游学院');

  Member.addOrgs(c, qin, ['ORG-HOTEL']);
  assert.deepEqual(Member.memberOrgIds(c, qin).slice().sort(), ['ORG-HOTEL', 'ORG-TOURISM'].sort(), '加入后两个组织');

  Member.addRoles(c, qin, ['R-INFO']);
  const infoAs = c.assignments.find(function (a) { return a.accountId === 'ACC-QIN' && a.roleId === 'R-INFO'; });
  assert.ok(infoAs, '新分配存在');
  assert.ok(infoAs.scopeOrgIds.indexOf('ORG-TOURISM') >= 0 && infoAs.scopeOrgIds.indexOf('ORG-HOTEL') >= 0, '新分配 scopeOrgIds 含全部所属组织');

  assert.equal(Member.canRemoveOrg(c, qin, 'ORG-TOURISM').ok, false, '主组织不可移出');
  assert.match(Member.canRemoveOrg(c, qin, 'ORG-TOURISM').reason, /主组织/, '主组织提示语');

  assert.equal(Member.canRemoveOrg(c, qin, 'ORG-HOTEL').ok, true, '非主组织可移出');
  Member.removeOrg(c, qin, 'ORG-HOTEL');
  assert.deepEqual(Member.memberOrgIds(c, qin), ['ORG-TOURISM'], '移出后回到旅游学院');

  assert.equal(Member.canRemoveOrg(c, qin, 'ORG-TOURISM').ok, false, '唯一组织也不可移出');
  assert.match(Member.canRemoveOrg(c, qin, 'ORG-TOURISM').reason, /唯一组织/, '唯一组织提示语');
});

test('member.js addRoles 显式 orgs：新建账号分配 scopeOrgIds 用传入的组织', function () {
  const c = ctx();
  const newAcc = { id: 'ACC-TMP', name: '临时账号', orgId: 'ORG-TOURISM', status: '正常' };
  c.accounts.push(newAcc);
  Member.addRoles(c, newAcc, ['R-SECRETARY'], ['ORG-TOURISM', 'ORG-HOTEL']);
  const as = c.assignments.find(function (a) { return a.accountId === 'ACC-TMP' && a.roleId === 'R-SECRETARY'; });
  assert.deepEqual(as.scopeOrgIds.slice().sort(), ['ORG-HOTEL', 'ORG-TOURISM'].sort(), 'scopeOrgIds 用传入组织');
});

test('member.js 移除角色：删除分配、可移除到零角色', function () {
  const c = ctx();
  const qin = c.accounts.find(function (a) { return a.id === 'ACC-QIN'; });
  assert.deepEqual(Member.accountRoleIds(c, qin), ['R-SECRETARY'], '初始一个角色');
  Member.removeRoles(c, qin, ['R-SECRETARY']);
  assert.deepEqual(Member.accountRoleIds(c, qin), [], '移除后无角色');
  assert.ok(!c.assignments.some(function (a) { return a.accountId === 'ACC-QIN'; }), '分配已删除');
});
