/* 权限管理升级 Demo · mock 数据 + 演示数据存储
 * 纯数据：初始数据（INITIAL）+ 浏览器 localStorage 读写 + 重置。
 * 数据之间靠 id 互相关联，引用关系见 docs/permission-demo-plan.md 第 7 节。
 * UMD：浏览器挂 window.DEMO；Node 可 require（localStorage 不存在时退化为内存存储，供测试用）。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DEMO = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var STORAGE_KEY = 'permission-demo-state';
  var DATA_VERSION = 1; // 数据版本：seed 结构变更时 +1，旧 localStorage 缓存自动失效

  function clone(x) { return JSON.parse(JSON.stringify(x)); }

  /* ── 组织类型 ── */
  var ORG_TYPES = [
    { id: 'OT-ORG',    name: '院校' },
    { id: 'OT-CAMPUS', name: '校区' },
    { id: 'OT-COLLEGE',name: '学院' },
    { id: 'OT-DEPT',   name: '系' },
    { id: 'OT-ROOM',   name: '教研室' },
    { id: 'OT-DIV',    name: '部门' },
    { id: 'OT-MAJORDEPT', name: '专业部' }
  ];

  /* ── 组织树 ── */
  var ORGS = [
    { id: 'ORG-ROOT', name: '某职业技术学院', code: 'ORG-ROOT', typeId: 'OT-ORG', parentId: null, sort: 0, status: 'enabled', desc: '根节点（院校）' },
    { id: 'ORG-EAST', name: '东校区', code: 'CMP-EAST', typeId: 'OT-CAMPUS', parentId: 'ORG-ROOT', sort: 1, status: 'enabled', desc: '' },
    { id: 'ORG-TOURISM', name: '旅游学院', code: 'COL-TOURISM', typeId: 'OT-COLLEGE', parentId: 'ORG-EAST', sort: 1, status: 'enabled', desc: '' },
    { id: 'ORG-TOUR-DEPT', name: '旅游管理系', code: 'DEP-TOUR', typeId: 'OT-DEPT', parentId: 'ORG-TOURISM', sort: 1, status: 'enabled', desc: '' },
    { id: 'ORG-GUIDE-ROOM', name: '导游教研室', code: 'ROOM-GUIDE', typeId: 'OT-ROOM', parentId: 'ORG-TOUR-DEPT', sort: 1, status: 'enabled', desc: '' },
    { id: 'ORG-HOTEL', name: '酒店学院', code: 'COL-HOTEL', typeId: 'OT-COLLEGE', parentId: 'ORG-EAST', sort: 2, status: 'enabled', desc: '' },
    { id: 'ORG-WEST', name: '西校区', code: 'CMP-WEST', typeId: 'OT-CAMPUS', parentId: 'ORG-ROOT', sort: 2, status: 'enabled', desc: '' },
    { id: 'ORG-VOCATIONAL', name: '中职部', code: 'DIV-VOC', typeId: 'OT-DIV', parentId: 'ORG-WEST', sort: 1, status: 'enabled', desc: '' },
    { id: 'ORG-TOUR-MAJOR-DEPT', name: '旅游专业部', code: 'MAJOR-TOUR', typeId: 'OT-MAJORDEPT', parentId: 'ORG-VOCATIONAL', sort: 1, status: 'enabled', desc: '' },
    { id: 'ORG-CONTINUING', name: '继续教育部', code: 'DIV-CONT', typeId: 'OT-DIV', parentId: 'ORG-WEST', sort: 2, status: 'enabled', desc: '' },
    { id: 'ORG-BASE-DEPT', name: '公共基础部', code: 'DIV-BASE', typeId: 'OT-DIV', parentId: 'ORG-ROOT', sort: 3, status: 'enabled', desc: '' }
  ];

  /* ── 专业（挂到组织节点） ── */
  var MAJORS = [
    { id: 'MAJOR-TOURISM', name: '旅游管理', orgId: 'ORG-TOUR-DEPT' },
    { id: 'MAJOR-GUIDE', name: '导游', orgId: 'ORG-GUIDE-ROOM' },
    { id: 'MAJOR-HOTEL', name: '酒店管理与数字化运营', orgId: 'ORG-HOTEL' },
    { id: 'MAJOR-TOUR-SVC', name: '旅游服务与管理（中职）', orgId: 'ORG-TOUR-MAJOR-DEPT' }
  ];

  /* ── 课程（挂到专业，用于教学范围的课程维度） ── */
  var COURSES = [
    { id: 'CRS-T1', name: '旅游学概论',   majorId: 'MAJOR-TOURISM' },
    { id: 'CRS-T2', name: '导游业务',     majorId: 'MAJOR-TOURISM' },
    { id: 'CRS-T3', name: '旅游市场营销', majorId: 'MAJOR-TOURISM' },
    { id: 'CRS-G1', name: '导游基础知识', majorId: 'MAJOR-GUIDE' },
    { id: 'CRS-G2', name: '导游服务技能', majorId: 'MAJOR-GUIDE' },
    { id: 'CRS-H1', name: '前厅服务与管理', majorId: 'MAJOR-HOTEL' },
    { id: 'CRS-H2', name: '客房服务与管理', majorId: 'MAJOR-HOTEL' },
    { id: 'CRS-H3', name: '酒店英语',     majorId: 'MAJOR-HOTEL' },
    { id: 'CRS-S1', name: '旅游服务礼仪', majorId: 'MAJOR-TOUR-SVC' },
    { id: 'CRS-S2', name: '景区讲解',     majorId: 'MAJOR-TOUR-SVC' }
  ];

  /* ── 基地（不进组织树，挂在组织节点下，见 5.5） ── */
  var BASES = [
    { id: 'BASE-HOTEL', name: '某酒店基地', orgId: 'ORG-HOTEL' },
    { id: 'BASE-SCENIC', name: '某景区基地', orgId: 'ORG-TOURISM' }
  ];

  /* ── 年级（全校通用，不挂组织） ── */
  var GRADES = [
    { id: 'G-2023', name: '2023级', graduated: true },
    { id: 'G-2024', name: '2024级', graduated: false },
    { id: 'G-2025', name: '2025级', graduated: false },
    { id: 'G-2026', name: '2026级', graduated: false }
  ];

  /* ── 班级（每个专业在每个年级下 1~2 个班） ── */
  var KLASSES = [
    { id: 'K-T23-1', name: '旅游管理 2023级 1班', majorId: 'MAJOR-TOURISM', gradeId: 'G-2023' },
    { id: 'K-T24-1', name: '旅游管理 2024级 1班', majorId: 'MAJOR-TOURISM', gradeId: 'G-2024' },
    { id: 'K-T25-1', name: '旅游管理 2025级 1班', majorId: 'MAJOR-TOURISM', gradeId: 'G-2025' },
    { id: 'K-T26-1', name: '旅游管理 2026级 1班', majorId: 'MAJOR-TOURISM', gradeId: 'G-2026' },
    { id: 'K-T26-2', name: '旅游管理 2026级 2班', majorId: 'MAJOR-TOURISM', gradeId: 'G-2026' },
    { id: 'K-G23-1', name: '导游 2023级 1班', majorId: 'MAJOR-GUIDE', gradeId: 'G-2023' },
    { id: 'K-G24-1', name: '导游 2024级 1班', majorId: 'MAJOR-GUIDE', gradeId: 'G-2024' },
    { id: 'K-G25-1', name: '导游 2025级 1班', majorId: 'MAJOR-GUIDE', gradeId: 'G-2025' },
    { id: 'K-G26-1', name: '导游 2026级 1班', majorId: 'MAJOR-GUIDE', gradeId: 'G-2026' },
    { id: 'K-H23-1', name: '酒店管理与数字化运营 2023级 1班', majorId: 'MAJOR-HOTEL', gradeId: 'G-2023' },
    { id: 'K-H24-1', name: '酒店管理与数字化运营 2024级 1班', majorId: 'MAJOR-HOTEL', gradeId: 'G-2024' },
    { id: 'K-H25-1', name: '酒店管理与数字化运营 2025级 1班', majorId: 'MAJOR-HOTEL', gradeId: 'G-2025' },
    { id: 'K-H26-1', name: '酒店管理与数字化运营 2026级 1班', majorId: 'MAJOR-HOTEL', gradeId: 'G-2026' },
    { id: 'K-S23-1', name: '旅游服务与管理（中职） 2023级 1班', majorId: 'MAJOR-TOUR-SVC', gradeId: 'G-2023' },
    { id: 'K-S24-1', name: '旅游服务与管理（中职） 2024级 1班', majorId: 'MAJOR-TOUR-SVC', gradeId: 'G-2024' },
    { id: 'K-S25-1', name: '旅游服务与管理（中职） 2025级 1班', majorId: 'MAJOR-TOUR-SVC', gradeId: 'G-2025' },
    { id: 'K-S26-1', name: '旅游服务与管理（中职） 2026级 1班', majorId: 'MAJOR-TOUR-SVC', gradeId: 'G-2026' }
  ];

  /* ── 学生（确定性生成，保证学号/手机号/身份证唯一，便于脱敏可测） ── */
  var SURNAMES = ['张','李','王','刘','陈','杨','赵','黄','周','吴','徐','孙','马','朱','胡','郭','何','高','林','罗','郑','梁','谢','宋','唐','许','韩','冯','邓','曹'];
  var GIVEN = ['伟','芳','娜','敏','静','磊','军','洋','勇','艳','杰','娟','涛','明','超','秀英','霞','平','刚','桂英','文','辉','力','俊','昊','雨','辰','一','诺','欣'];
  var ADDR_PREFIX = ['北京市朝阳区','上海市浦东新区','广州市天河区','深圳市南山区','杭州市西湖区'];

  function pad(n, w) { return String(n).padStart(w, '0'); }

  var seq = 0;
  var STUDENTS = [];
  KLASSES.forEach(function (k) {
    var grade = GRADES.find(function (g) { return g.id === k.gradeId; });
    var count = (k.id === 'K-H25-1') ? 8 : 6;   // 酒店管理 2025 级 1 班 8 人（含 5 名实习生）
    for (var i = 0; i < count; i++) {
      seq++;
      var intern = null;
      if (k.id === 'K-H25-1') {
        if (i < 3) intern = 'BASE-HOTEL';        // 3 人在某酒店基地实习
        else if (i < 5) intern = 'BASE-SCENIC';  // 2 人在某景区基地实习
      }
      STUDENTS.push({
        id: 'STU-' + k.id.slice(2) + '-' + pad(i + 1, 2),
        name: SURNAMES[(seq * 7) % SURNAMES.length] + GIVEN[(seq * 11) % GIVEN.length],
        sno: String(20230000 + seq),
        phone: '138' + String(10000000 + seq * 3).slice(-8),
        idCard: '110101' + String(19900101 + seq) + String(1000 + seq).slice(-4),
        address: ADDR_PREFIX[seq % ADDR_PREFIX.length] + '幸福路' + ((seq % 99) + 1) + '号',
        klassId: k.id,
        status: grade.graduated ? '已毕业' : '在读',
        scores: [
          { course: '旅游学概论', score: 60 + (seq * 7) % 40 },
          { course: '导游业务', score: 60 + (seq * 11) % 40 }
        ],
        internshipBaseId: intern
      });
    }
  });

  /* ── 作业（每班按课程生成 3 条；在读可提交，已毕业全部已提交） ── */
  var HOMEWORKS = [];
  STUDENTS.forEach(function (s, i) {
    var k = KLASSES.find(function (x) { return x.id === s.klassId; });
    var cs = COURSES.filter(function (c) { return c.majorId === k.majorId; }).slice(0, 3);
    var graduated = GRADES.find(function (g) { return g.id === k.gradeId; }).graduated;
    cs.forEach(function (c, ci) {
      HOMEWORKS.push({
        id: 'HW-' + pad(i + 1, 4) + '-' + ci,
        studentId: s.id,
        klassId: k.id,
        courseId: c.id,
        title: c.name + ' · 第' + (ci + 1) + '次作业',
        submitted: graduated ? true : ((i + ci) % 3 !== 0)
      });
    });
  });

  /* ── 权限点（操作级；code 格式「模块:资源:动作」） ── */
  var PERMISSIONS = [
    { id: 'P-ORG-NODE-VIEW',     code: 'org:node:view',            name: '组织节点查看',   module: '组织', resource: '节点', action: '查看' },
    { id: 'P-ORG-NODE-EDIT',     code: 'org:node:edit',            name: '组织节点维护',   module: '组织', resource: '节点', action: '编辑' },
    { id: 'P-ACCOUNT-VIEW',      code: 'org:account:view',         name: '账号查看',       module: '组织', resource: '账号', action: '查看' },
    { id: 'P-ACCOUNT-EDIT',      code: 'org:account:edit',         name: '账号维护',       module: '组织', resource: '账号', action: '编辑' },
    { id: 'P-ACCOUNT-ASSIGN',    code: 'org:account:assign',       name: '账号分配角色',   module: '组织', resource: '账号', action: '分配角色' },
    { id: 'P-TEACH-SCOPE-GRANT', code: 'org:teachingScope:grant',  name: '教学范围授予',   module: '组织', resource: '教学范围', action: '授予' },
    { id: 'P-ROLE-DEFINE',       code: 'org:role:define',          name: '角色定义',       module: '组织', resource: '角色', action: '定义' },
    { id: 'P-AUDIT-VIEW',        code: 'org:audit:view',           name: '审计查看',       module: '组织', resource: '审计', action: '查看' },
    { id: 'P-STUDENT-INFO-VIEW', code: 'student:info:view',        name: '学生信息查看',   module: '学生', resource: '学生信息', action: '查看' },
    { id: 'P-STUDENT-SCORE-VIEW',code: 'student:score:view',       name: '学生成绩查看',   module: '学生', resource: '学生成绩', action: '查看' },
    { id: 'P-IDCARD-PLAIN',      code: 'student:idcard:plain',     name: '身份证明文',     module: '学生', resource: '身份证明文', action: '查看' },
    { id: 'P-PROFILE-VIEW',      code: 'teaching:profile:view',    name: '教师档案查看',   module: '教研', resource: '教师档案', action: '查看' },
    { id: 'P-CONTENT-VIEW',      code: 'teaching:content:view',    name: '内容查看',       module: '教研', resource: '内容', action: '查看' },
    { id: 'P-CONTENT-AUDIT',     code: 'teaching:content:audit',   name: '课程内容审核',   module: '教研', resource: '内容', action: '审核发布' },
    { id: 'P-INTERN-VIEW',       code: 'intern:task:view',         name: '实习任务查看',   module: '实践', resource: '实习任务', action: '查看' },
    { id: 'P-RESOURCE-SHARE',    code: 'resource:share',           name: '内容共享',       module: '资源', resource: '内容共享', action: '发起' },
    { id: 'P-SCHOOLPUB-PUBLISH', code: 'resource:schoolpub:publish', name: '发布到校本资源库', module: '资源', resource: '校本资源库', action: '发布' },
    { id: 'P-SCHOOLPUB-VIEW',    code: 'resource:schoolpub:view',  name: '校本资源库查看复制', module: '资源', resource: '校本资源库', action: '查看复制' },
    { id: 'P-MEMBER-MANAGE',     code: 'org:member:manage',        name: '组织成员管理',   module: '组织', resource: '成员', action: '管理' },
    { id: 'P-ACCOUNT-CREATE',    code: 'account:account:create',   name: '账号新建',       module: '组织', resource: '账号', action: '新建' }
  ];

  /* ── 角色（type：内置 / 预设 / 部门模板 / 自定义；key 供权限模块判定用） ── */
  var ROLES = [
    { id: 'R-SUPER', key: 'super', portal: 'admin', name: '平台超级管理员', type: '内置',     status: '启用', aiQuota: 200,
      description: '系统内置的最高权限角色，覆盖全校全部功能与数据', createdBy: '系统', createdAt: '2024-09-01', permissionIds: [
      'org:node:view','org:node:edit','org:account:view','org:account:edit','org:account:assign','org:teachingScope:grant',
      'org:role:define','org:audit:view','student:info:view','student:score:view','student:idcard:plain','teaching:profile:view',
      'teaching:content:view','teaching:content:audit','intern:task:view','resource:share','resource:schoolpub:publish','resource:schoolpub:view','org:member:manage','account:account:create' ] },
    { id: 'R-ORG-ADMIN', key: 'orgAdmin', portal: 'admin', name: '组织管理员', type: '预设', status: '启用', aiQuota: 100,
      description: '负责本单位组织、账号与基础数据的日常维护', createdBy: '超管', createdAt: '2024-09-10', permissionIds: [
      'org:node:view','org:node:edit','org:account:view','org:account:edit','org:account:assign','org:teachingScope:grant',
      'org:audit:view','student:info:view','student:score:view','teaching:profile:view','teaching:content:view','teaching:content:audit',
      'intern:task:view','resource:share','resource:schoolpub:publish','resource:schoolpub:view','org:member:manage','account:account:create' ] },
    { id: 'R-MAJOR-LEAD', key: 'majorLead', portal: 'teacher', name: '专业负责人', type: '预设', status: '启用', aiQuota: 50,
      description: '负责本专业教学与人才培养相关的查看与协作', createdBy: '超管', createdAt: '2024-09-10', permissionIds: [
      'teaching:profile:view','teaching:content:view','student:score:view','resource:share','resource:schoolpub:view' ] },
    { id: 'R-TEACHER', key: 'teacher', portal: 'teacher', name: '教师', type: '预设', status: '启用', aiQuota: 30,
      description: '授课教师，可查看所带班级学生与备课资源', createdBy: '超管', createdAt: '2024-09-10', permissionIds: [
      'student:info:view','student:score:view','teaching:profile:view','resource:share','resource:schoolpub:view' ] },
    { id: 'R-HEAD-TEACHER', key: 'headTeacher', portal: 'admin', name: '班主任', type: '预设', status: '启用', aiQuota: 30,
      description: '负责本班学生信息与成绩管理', createdBy: '超管', createdAt: '2024-09-10', permissionIds: [
      'student:info:view','student:score:view' ] },
    { id: 'R-COUNSELOR', key: 'counselor', portal: 'admin', name: '辅导员', type: '预设', status: '启用', aiQuota: 30,
      description: '负责所辖学生日常事务与实习任务跟进', createdBy: '超管', createdAt: '2024-09-10', permissionIds: [
      'student:info:view','student:score:view','intern:task:view' ] },
    { id: 'R-STUDENT', key: 'student', portal: 'student', name: '学生', type: '预设', status: '启用', aiQuota: 0,
      description: '学生角色，查看本人信息与成绩', createdBy: '超管', createdAt: '2024-09-10', permissionIds: [
      'student:info:view','student:score:view' ] },
    { id: 'R-ACADEMIC', key: 'academic', portal: 'admin', name: '教务', type: '部门模板', status: '启用', aiQuota: 100,
      description: '教务管理，负责教学安排、成绩与课程内容', createdBy: '超管', createdAt: '2024-10-15', permissionIds: [
      'org:account:view','org:teachingScope:grant','org:audit:view','student:info:view','student:score:view','teaching:profile:view',
      'teaching:content:view','teaching:content:audit','resource:share','resource:schoolpub:publish','resource:schoolpub:view' ] },
    { id: 'R-STUDENT-AFFAIRS', key: 'studentAffairs', portal: 'admin', name: '学工', type: '部门模板', status: '启用', aiQuota: 50,
      description: '学生工作管理，负责学生信息与实习任务', createdBy: '超管', createdAt: '2024-10-15', permissionIds: [
      'org:account:view','org:audit:view','student:info:view','student:score:view','intern:task:view' ] },
    { id: 'R-SUPERVISOR', key: 'supervisor', portal: 'admin', name: '督导', type: '部门模板', status: '启用', aiQuota: 50,
      description: '教学督导，负责课程内容与教师档案的督导查看', createdBy: '超管', createdAt: '2024-10-15', permissionIds: [
      'org:audit:view','teaching:profile:view','student:score:view','teaching:content:view' ] },
    { id: 'R-INFO', key: 'info', portal: 'admin', name: '信息中心', type: '部门模板', status: '启用', aiQuota: 50,
      description: '信息化运维，负责账号与审计相关维护', createdBy: '超管', createdAt: '2024-10-15', permissionIds: [
      'org:account:view','org:account:edit','org:audit:view','account:account:create' ] },
    { id: 'R-ENTERPRISE', key: 'enterprise', portal: 'teacher', name: '企业导师', type: '自定义', status: '启用', aiQuota: 50,
      description: '企业导师，负责实习学生与实习任务管理', createdBy: '超管', createdAt: '2025-03-20', permissionIds: [
      'student:info:view','student:score:view','intern:task:view','resource:share','resource:schoolpub:view' ] },
    { id: 'R-SECRETARY', key: 'secretary', portal: 'admin', name: '学院秘书', type: '自定义', status: '启用', aiQuota: 30,
      description: '学院级成员与账号协作管理，仅限本学院范围', createdBy: '超管', createdAt: '2026-10-16', permissionIds: [
      'org:node:view','org:account:view','org:member:manage' ] }
  ];

  /* ── 账号 ── */
  var ACCOUNTS = [
    { id: 'ACC-SUPER', name: '超管',     orgId: 'ORG-ROOT',       kind: '超管',     status: '正常', studentId: null, phone: '13800000001', lastLoginAt: '2026-10-12 08:45', createdAt: '2024-09-01', createdBy: '系统',     updatedAt: '2026-10-12 08:45', updatedBy: '系统' },
    { id: 'ACC-ZHANG', name: '张校管',   orgId: 'ORG-ROOT',       kind: '管理员',   status: '正常', studentId: null, phone: '13800000002', lastLoginAt: '2026-10-12 09:10', createdAt: '2024-09-05', createdBy: '系统',     updatedAt: '2026-10-11 18:22', updatedBy: '超管' },
    { id: 'ACC-LIU',   name: '刘院管',   orgId: 'ORG-TOURISM',    kind: '管理员',   status: '正常', studentId: null, phone: '13800000003', lastLoginAt: '2026-10-11 16:30', createdAt: '2024-09-06', createdBy: '系统',     updatedAt: '2026-10-10 10:05', updatedBy: '张校管' },
    { id: 'ACC-CHEN',  name: '陈双管',   orgId: 'ORG-EAST',       kind: '管理员',   status: '正常', studentId: null, phone: '13800000004', lastLoginAt: '2026-10-11 14:20', createdAt: '2024-09-07', createdBy: '系统',     updatedAt: '2026-10-09 11:40', updatedBy: '张校管' },
    { id: 'ACC-LI',    name: '李老师',   orgId: 'ORG-HOTEL',      kind: '教师',     status: '正常', studentId: null, phone: '13800000005', lastLoginAt: '2026-10-12 07:55', createdAt: '2024-09-08', createdBy: '系统',     updatedAt: '2026-10-08 09:12', updatedBy: '刘院管' },
    { id: 'ACC-WANG',  name: '王老师',   orgId: 'ORG-BASE-DEPT',  partOrgIds: ['ORG-TOURISM'], kind: '教师',     status: '正常', studentId: null, phone: '13800000006', lastLoginAt: '2026-10-11 20:15', createdAt: '2024-09-09', createdBy: '系统',     updatedAt: '2026-10-07 15:33', updatedBy: '刘院管' },
    { id: 'ACC-HE',    name: '何老师',   orgId: 'ORG-TOUR-DEPT',  kind: '教师',     status: '正常', studentId: null, phone: '13800000007', lastLoginAt: '2026-10-10 11:02', createdAt: '2024-09-10', createdBy: '系统',     updatedAt: '2026-10-06 10:00', updatedBy: '张校管' },
    { id: 'ACC-MA',    name: '马老师',   orgId: 'ORG-HOTEL',      kind: '教师',     status: '正常', studentId: null, phone: '13800000008', lastLoginAt: '2026-10-09 08:30', createdAt: '2024-09-11', createdBy: '系统',     updatedAt: '2026-10-05 16:48', updatedBy: '张校管' },
    { id: 'ACC-ZHAO',  name: '赵辅导员', orgId: 'ORG-TOURISM',    kind: '辅导员',   status: '正常', studentId: null, phone: '13800000009', lastLoginAt: '2026-10-12 06:40', createdAt: '2024-09-12', createdBy: '系统',     updatedAt: '2026-10-04 14:21', updatedBy: '刘院管' },
    { id: 'ACC-XU',    name: '许院管',   orgId: 'ORG-TOURISM',    kind: '管理员',   status: '正常', studentId: null, phone: '13800000010', lastLoginAt: '2026-10-08 17:05', createdAt: '2024-09-13', createdBy: '系统',     updatedAt: '2026-10-03 09:55', updatedBy: '张校管' },
    { id: 'ACC-SUN',   name: '孙班主任', orgId: 'ORG-TOUR-MAJOR-DEPT', kind: '班主任', status: '正常', studentId: null, phone: '13800000011', lastLoginAt: '2026-10-07 13:18', createdAt: '2024-09-14', createdBy: '系统', updatedAt: '2026-10-02 08:10', updatedBy: '刘院管' },
    { id: 'ACC-ZHOU',  name: '周教务',   orgId: 'ORG-ROOT',       kind: '教务',     status: '正常', studentId: null, phone: '13800000012', lastLoginAt: '2026-10-11 09:00', createdAt: '2024-09-15', createdBy: '系统',     updatedAt: '2026-10-01 15:45', updatedBy: '张校管' },
    { id: 'ACC-WU',    name: '吴学工',   orgId: 'ORG-ROOT',       kind: '学工',     status: '正常', studentId: null, phone: '13800000013', lastLoginAt: '2026-10-10 19:30', createdAt: '2024-09-16', createdBy: '系统',     updatedAt: '2026-09-30 11:20', updatedBy: '张校管' },
    { id: 'ACC-ZHENG', name: '郑督导',   orgId: 'ORG-ROOT',       kind: '督导',     status: '正常', studentId: null, phone: '13800000014', lastLoginAt: '2026-10-09 10:45', createdAt: '2024-09-17', createdBy: '系统',     updatedAt: '2026-09-29 16:05', updatedBy: '张校管' },
    { id: 'ACC-QIAN',  name: '钱信息',   orgId: 'ORG-ROOT',       kind: '信息中心', status: '正常', studentId: null, phone: '13800000015', lastLoginAt: '2026-10-08 14:00', createdAt: '2024-09-18', createdBy: '系统',     updatedAt: '2026-09-28 09:30', updatedBy: '张校管' },
    { id: 'ACC-FENG',  name: '冯导师',   orgId: 'ORG-HOTEL', baseId: 'BASE-HOTEL', kind: '企业导师', status: '正常', studentId: null, phone: '13800000016', lastLoginAt: '2026-10-05 10:30', createdAt: '2024-09-19', createdBy: '系统', updatedAt: '2026-09-27 14:15', updatedBy: '张校管' },
    { id: 'ACC-GRAD',  name: '已毕业学生', orgId: 'ORG-TOUR-DEPT', kind: '学生',   status: '正常', studentId: 'STU-T23-1-01', phone: '13800000017', lastLoginAt: '2025-06-30 12:00', createdAt: '2024-09-20', createdBy: '系统', updatedAt: '2025-07-01 09:00', updatedBy: '系统' },
    { id: 'ACC-STOP',  name: '停用老师', orgId: 'ORG-HOTEL',      kind: '教师',     status: '停用', studentId: null, phone: '13800000018', lastLoginAt: '2026-01-15 09:00', createdAt: '2024-09-21', createdBy: '系统',     updatedAt: '2026-02-10 10:00', updatedBy: '刘院管' },
    { id: 'ACC-QIN',   name: '秦秘书',   orgId: 'ORG-TOURISM',    kind: '管理员',   status: '正常', studentId: null, phone: '13800000019', lastLoginAt: null, createdAt: '2026-10-16', createdBy: '系统', updatedAt: '2026-10-16', updatedBy: '系统' }
  ];

  /* ── 角色分配（一条 = 角色 + 数据范围 + 教学范围 + 额外权限点） ── */
  var ASSIGNMENTS = [
    { id: 'A-01', accountId: 'ACC-SUPER', roleId: 'R-SUPER', scopeOrgIds: ['ORG-ROOT'], scopeGrades: {}, scopeClassIds: [], teachingScope: { majorIds: [], classIds: [], courseIds: [] }, extraPermIds: [] },
    { id: 'A-02', accountId: 'ACC-ZHANG', roleId: 'R-ORG-ADMIN', scopeOrgIds: ['ORG-ROOT'], scopeGrades: {}, scopeClassIds: [], teachingScope: { majorIds: [], classIds: [], courseIds: [] }, extraPermIds: [] },
    { id: 'A-03', accountId: 'ACC-LIU', roleId: 'R-ORG-ADMIN', scopeOrgIds: ['ORG-TOURISM'], scopeGrades: {}, scopeClassIds: [], teachingScope: { majorIds: [], classIds: [], courseIds: [] }, extraPermIds: [] },
    { id: 'A-04', accountId: 'ACC-CHEN', roleId: 'R-ORG-ADMIN', scopeOrgIds: ['ORG-TOURISM'], scopeGrades: {}, scopeClassIds: [], teachingScope: { majorIds: [], classIds: [], courseIds: [] }, extraPermIds: [] },
    { id: 'A-05', accountId: 'ACC-CHEN', roleId: 'R-ORG-ADMIN', scopeOrgIds: ['ORG-HOTEL'], scopeGrades: {}, scopeClassIds: [], teachingScope: { majorIds: [], classIds: [], courseIds: [] }, extraPermIds: [] },
    { id: 'A-06', accountId: 'ACC-LI', roleId: 'R-ORG-ADMIN', scopeOrgIds: ['ORG-HOTEL'], scopeGrades: {}, scopeClassIds: [], teachingScope: { majorIds: [], classIds: [], courseIds: [] }, extraPermIds: [] },
    { id: 'A-07', accountId: 'ACC-LI', roleId: 'R-TEACHER', scopeOrgIds: [], scopeGrades: {}, scopeClassIds: [], teachingScope: { majorIds: [], classIds: ['K-T26-1'], courseIds: ['CRS-T1', 'CRS-T3'] }, extraPermIds: [] },
    { id: 'A-22', accountId: 'ACC-LI', roleId: 'R-SUPER', scopeOrgIds: ['ORG-HOTEL'], scopeGrades: {}, scopeClassIds: [], teachingScope: { majorIds: [], classIds: [], courseIds: [] }, extraPermIds: [] },
    { id: 'A-08', accountId: 'ACC-WANG', roleId: 'R-TEACHER', scopeOrgIds: [], scopeGrades: {}, scopeClassIds: [], teachingScope: { majorIds: [], classIds: ['K-T26-1', 'K-H26-1'], courseIds: ['CRS-T1', 'CRS-T2', 'CRS-H1', 'CRS-H2'] }, extraPermIds: [] },
    { id: 'A-09', accountId: 'ACC-HE', roleId: 'R-TEACHER', scopeOrgIds: [], scopeGrades: {}, scopeClassIds: [], teachingScope: { majorIds: [], classIds: ['K-T25-1'], courseIds: ['CRS-T1', 'CRS-T2'] }, extraPermIds: [] },
    { id: 'A-10', accountId: 'ACC-MA', roleId: 'R-TEACHER', scopeOrgIds: [], scopeGrades: {}, scopeClassIds: [], teachingScope: { majorIds: [], classIds: ['K-H25-1'], courseIds: ['CRS-H2', 'CRS-H3'] }, extraPermIds: [] },
    { id: 'A-11', accountId: 'ACC-ZHAO', roleId: 'R-COUNSELOR', scopeOrgIds: ['ORG-TOURISM'], scopeGrades: { 'ORG-TOURISM': ['G-2026'] }, scopeClassIds: [], teachingScope: { majorIds: [], classIds: [], courseIds: [] }, extraPermIds: [] },
    { id: 'A-12', accountId: 'ACC-XU', roleId: 'R-ORG-ADMIN', scopeOrgIds: ['ORG-TOURISM'], scopeGrades: { 'ORG-TOURISM': ['G-2026'] }, scopeClassIds: [], teachingScope: { majorIds: [], classIds: [], courseIds: [] }, extraPermIds: [] },
    { id: 'A-13', accountId: 'ACC-SUN', roleId: 'R-HEAD-TEACHER', scopeOrgIds: [], scopeGrades: {}, scopeClassIds: ['K-S25-1'], teachingScope: { majorIds: [], classIds: [], courseIds: [] }, extraPermIds: [] },
    { id: 'A-14', accountId: 'ACC-ZHOU', roleId: 'R-ACADEMIC', scopeOrgIds: ['ORG-ROOT'], scopeGrades: {}, scopeClassIds: [], teachingScope: { majorIds: [], classIds: [], courseIds: [] }, extraPermIds: [] },
    { id: 'A-15', accountId: 'ACC-WU', roleId: 'R-STUDENT-AFFAIRS', scopeOrgIds: ['ORG-ROOT'], scopeGrades: {}, scopeClassIds: [], teachingScope: { majorIds: [], classIds: [], courseIds: [] }, extraPermIds: [] },
    { id: 'A-16', accountId: 'ACC-ZHENG', roleId: 'R-SUPERVISOR', scopeOrgIds: ['ORG-ROOT'], scopeGrades: {}, scopeClassIds: [], teachingScope: { majorIds: [], classIds: [], courseIds: [] }, extraPermIds: [] },
    { id: 'A-17', accountId: 'ACC-QIAN', roleId: 'R-INFO', scopeOrgIds: ['ORG-ROOT'], scopeGrades: {}, scopeClassIds: [], teachingScope: { majorIds: [], classIds: [], courseIds: [] }, extraPermIds: [] },
    { id: 'A-18', accountId: 'ACC-FENG', roleId: 'R-ENTERPRISE', scopeOrgIds: [], scopeGrades: {}, scopeClassIds: [], teachingScope: { majorIds: [], classIds: [], courseIds: [] }, extraPermIds: [] },
    { id: 'A-19', accountId: 'ACC-GRAD', roleId: 'R-STUDENT', scopeOrgIds: [], scopeGrades: {}, scopeClassIds: [], teachingScope: { majorIds: [], classIds: [], courseIds: [] }, extraPermIds: [] },
    { id: 'A-20', accountId: 'ACC-STOP', roleId: 'R-TEACHER', scopeOrgIds: [], scopeGrades: {}, scopeClassIds: [], teachingScope: { majorIds: [], classIds: ['K-H26-1'], courseIds: ['CRS-H1'] }, extraPermIds: [] },
    { id: 'A-21', accountId: 'ACC-QIN', roleId: 'R-SECRETARY', scopeOrgIds: ['ORG-TOURISM'], scopeGrades: {}, scopeClassIds: [], teachingScope: { majorIds: [], classIds: [], courseIds: [] }, extraPermIds: [] }
  ];

  /* ── 演示身份（下拉用；停用老师不进下拉） ── */
  var DEMO_IDENTITIES = [
    { id: 'D-01', label: '超管',     accountId: 'ACC-SUPER' },
    { id: 'D-02', label: '张校管',   accountId: 'ACC-ZHANG' },
    { id: 'D-03', label: '刘院管',   accountId: 'ACC-LIU' },
    { id: 'D-04', label: '陈双管',   accountId: 'ACC-CHEN' },
    { id: 'D-05', label: '李老师',   accountId: 'ACC-LI' },
    { id: 'D-06', label: '王老师',   accountId: 'ACC-WANG' },
    { id: 'D-07', label: '何老师',   accountId: 'ACC-HE' },
    { id: 'D-08', label: '马老师',   accountId: 'ACC-MA' },
    { id: 'D-09', label: '赵辅导员', accountId: 'ACC-ZHAO' },
    { id: 'D-10', label: '许院管',   accountId: 'ACC-XU' },
    { id: 'D-11', label: '孙班主任', accountId: 'ACC-SUN' },
    { id: 'D-12', label: '周教务',   accountId: 'ACC-ZHOU' },
    { id: 'D-13', label: '吴学工',   accountId: 'ACC-WU' },
    { id: 'D-14', label: '郑督导',   accountId: 'ACC-ZHENG' },
    { id: 'D-15', label: '钱信息',   accountId: 'ACC-QIAN' },
    { id: 'D-16', label: '冯导师',   accountId: 'ACC-FENG' },
    { id: 'D-17', label: '已毕业学生', accountId: 'ACC-GRAD' },
    { id: 'D-18', label: '停用老师', accountId: 'ACC-STOP' },
    { id: 'D-19', label: '秦秘书', accountId: 'ACC-QIN' }
  ];

  /* ── 教师档案（简单档案，组织随账号） ── */
  var TEACHER_PROFILES = [
    { id: 'TP-LI',   accountId: 'ACC-LI',   title: '酒店学院专任教师' },
    { id: 'TP-WANG', accountId: 'ACC-WANG', title: '公共基础部专任教师' },
    { id: 'TP-HE',   accountId: 'ACC-HE',   title: '旅游管理系专任教师' },
    { id: 'TP-MA',   accountId: 'ACC-MA',   title: '酒店学院专任教师' }
  ];

  /* ── 资源（每位教师 3 份 + 1 份学情分析） ── */
  var RESOURCES = [
    { id: 'RES-W1', title: '《旅游英语情景对话》课件', type: '课件',     ownerId: 'ACC-WANG', orgId: 'ORG-BASE-DEPT', shared: false, shareTargets: [], recommended: false, published: false },
    { id: 'RES-W2', title: '《跨文化服务》教案',       type: '教案',     ownerId: 'ACC-WANG', orgId: 'ORG-BASE-DEPT', shared: false, shareTargets: [], recommended: false, published: false },
    { id: 'RES-W3', title: '《导游基础知识》题库',     type: '题库',     ownerId: 'ACC-WANG', orgId: 'ORG-BASE-DEPT', shared: false, shareTargets: [], recommended: false, published: false },
    { id: 'RES-W4', title: '酒店管理 2026级 1班学情分析', type: '学情分析', ownerId: 'ACC-WANG', orgId: 'ORG-BASE-DEPT', shared: false, shareTargets: [], recommended: false, published: false },
    { id: 'RES-M1', title: '《客房服务流程》课件',     type: '课件',     ownerId: 'ACC-MA', orgId: 'ORG-HOTEL', shared: false, shareTargets: [], recommended: false, published: false },
    { id: 'RES-M2', title: '《前厅服务》图集素材',     type: '素材',     ownerId: 'ACC-MA', orgId: 'ORG-HOTEL', shared: false, shareTargets: [], recommended: false, published: false },
    { id: 'RES-M3', title: '《酒店英语》教案',         type: '教案',     ownerId: 'ACC-MA', orgId: 'ORG-HOTEL', shared: false, shareTargets: [], recommended: false, published: false },
    { id: 'RES-M4', title: '酒店管理 2025级 1班学情分析', type: '学情分析', ownerId: 'ACC-MA', orgId: 'ORG-HOTEL', shared: false, shareTargets: [], recommended: false, published: false },
    { id: 'RES-H1', title: '《导游词创作》课件',       type: '课件',     ownerId: 'ACC-HE', orgId: 'ORG-TOUR-DEPT', shared: false, shareTargets: [], recommended: false, published: false },
    { id: 'RES-H2', title: '《导游业务》题库',         type: '题库',     ownerId: 'ACC-HE', orgId: 'ORG-TOUR-DEPT', shared: false, shareTargets: [], recommended: false, published: false },
    { id: 'RES-H3', title: '《旅游服务礼仪》教案',     type: '教案',     ownerId: 'ACC-HE', orgId: 'ORG-TOUR-DEPT', shared: false, shareTargets: [], recommended: false, published: false },
    { id: 'RES-H4', title: '旅游管理 2025级 1班学情分析', type: '学情分析', ownerId: 'ACC-HE', orgId: 'ORG-TOUR-DEPT', shared: false, shareTargets: [], recommended: false, published: false },
    { id: 'RES-L1', title: '《酒店运营管理》教案',     type: '教案',     ownerId: 'ACC-LI', orgId: 'ORG-HOTEL', shared: false, shareTargets: [], recommended: false, published: false },
    { id: 'RES-L2', title: '《酒店服务规范》素材',     type: '素材',     ownerId: 'ACC-LI', orgId: 'ORG-HOTEL', shared: false, shareTargets: [], recommended: false, published: false },
    { id: 'RES-L3', title: '《酒店收益管理》题库',     type: '题库',     ownerId: 'ACC-LI', orgId: 'ORG-HOTEL', shared: false, shareTargets: [], recommended: false, published: false },
    { id: 'RES-L4', title: '旅游管理 2026级 1班学情分析', type: '学情分析', ownerId: 'ACC-LI', orgId: 'ORG-HOTEL', shared: false, shareTargets: [], recommended: false, published: false }
  ];

  /* ── 内容审核（占位页用，5~6 条，每条挂所属组织） ── */
  var CONTENTS = [
    { id: 'CONT-01', title: '《旅游服务礼仪》课程标准', type: '课程内容', orgId: 'ORG-TOUR-DEPT', status: '待审核' },
    { id: 'CONT-02', title: '《导游业务》教材',         type: '教材',     orgId: 'ORG-GUIDE-ROOM', status: '待审核' },
    { id: 'CONT-03', title: '旅游管理专业人才培养方案', type: '人培方案', orgId: 'ORG-TOUR-DEPT', status: '待审核' },
    { id: 'CONT-04', title: '《酒店前厅服务》课程标准', type: '课程内容', orgId: 'ORG-HOTEL', status: '待审核' },
    { id: 'CONT-05', title: '《客房服务与管理》教材',   type: '教材',     orgId: 'ORG-HOTEL', status: '待审核' },
    { id: 'CONT-06', title: '酒店管理专业人才培养方案', type: '人培方案', orgId: 'ORG-HOTEL', status: '待审核' }
  ];

  /* ── 审计日志（初始为空） ── */
  var AUDITS = [];

  var INITIAL = {
    orgTypes: ORG_TYPES,
    orgs: ORGS,
    bases: BASES,
    majors: MAJORS,
    courses: COURSES,
    grades: GRADES,
    klasses: KLASSES,
    students: STUDENTS,
    homeworks: HOMEWORKS,
    permissions: PERMISSIONS,
    roles: ROLES,
    accounts: ACCOUNTS,
    assignments: ASSIGNMENTS,
    demoIdentities: DEMO_IDENTITIES,
    teacherProfiles: TEACHER_PROFILES,
    resources: RESOURCES,
    contents: CONTENTS,
    audits: AUDITS,
    __version: DATA_VERSION
  };

  /* ── 存储（localStorage，Node 下退化为内存） ── */
  var memState = null;

  function saveState(state) {
    memState = clone(state);
    if (typeof localStorage !== 'undefined') {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
    }
    return clone(state);
  }

  function loadState() {
    if (typeof localStorage !== 'undefined') {
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          var parsed = JSON.parse(raw);
          if (parsed && parsed.__version === DATA_VERSION) { memState = parsed; return clone(memState); }
          localStorage.removeItem(STORAGE_KEY); // 数据版本不符（seed 有更新），丢弃旧缓存
        }
      } catch (e) {}
    }
    if (memState) return clone(memState);
    memState = clone(INITIAL);
    return clone(memState);
  }

  function resetDemoData() {
    memState = null;
    if (typeof localStorage !== 'undefined') {
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    }
    return clone(INITIAL);
  }

  /* ── 数据改动（页面用，演示改动跨页面保留） ── */
  function addAudit(state, actorId, action, object, before, after, result) {
    var rec = { id: 'AUD-' + pad(state.audits.length + 1, 4), ts: new Date().toISOString(),
      actorId: actorId, action: action, object: object, before: JSON.stringify(before == null ? null : before),
      after: JSON.stringify(after == null ? null : after), result: result };
    state.audits.push(rec);
    return rec;
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    INITIAL: INITIAL,
    clone: clone,
    saveState: saveState,
    loadState: loadState,
    resetDemoData: resetDemoData,
    getState: loadState,
    addAudit: addAudit
  };
}));
