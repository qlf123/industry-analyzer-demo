/* 教师端业务页共用：mock 数据（本机存储，三个页面共享）+ 抽屉 / 弹窗 / 表单 / 轻提示
   知识体系取自 assess-data.js，页面需先引入它 */
(function (root) {
  'use strict';
  var KEY = 'teacherDemo.v1';

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function fmt(d, withTime) {
    d = d instanceof Date ? d : new Date(d);
    var s = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    return withTime === false ? s : s + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  // 今天发生的事：把 0:00–24:00 按比例压到「现在之前」，保证不会出现未来时间且先后顺序不变
  function today(h, m) { var d = new Date(), now = d.getHours() * 60 + d.getMinutes(), t = Math.floor((h * 60 + (m || 0)) * Math.max(now - 5, 0) / 1440); d.setHours(Math.floor(t / 60), t % 60, 0, 0); return fmt(d); }
  function hoursLater(n) { var d = new Date(Date.now() + n * 3600e3); d.setMinutes(0, 0, 0); return fmt(d); }
  function daysAgo(n, h, m) { var d = new Date(); d.setDate(d.getDate() - n); d.setHours(h || 9, m || 0, 0, 0); return fmt(d); }
  function uid(p) { return (p || 'X') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ── 知识体系（导游专业，来自 assess-data.js）：课程 › 任务 › 技能，以及已确认的能力—技能映射 ── */
  var KN = null;
  function kn() {
    if (KN) return KN;
    var A = root.ASSESS_DATA || { knowledge: {}, mappings: {}, graph: { abilities: [] }, confirmedStatuses: [], countedTypes: [] };
    KN = { course: {}, task: {}, skill: {}, abl: {}, map: {} };
    ((A.knowledge['MAJOR-GUIDE'] || {}).courses || []).forEach(function (c) {
      KN.course[c.id] = c;
      c.tasks.forEach(function (t) { t.courseId = c.id; KN.task[t.id] = t; t.skills.forEach(function (x) { x.taskId = t.id; KN.skill[x.id] = x; }); });
    });
    A.graph.abilities.forEach(function (x) { KN.abl[x.id] = x; });
    (A.mappings['MAJOR-GUIDE'] || []).forEach(function (m) {
      if (A.confirmedStatuses.indexOf(m.status) >= 0 && A.countedTypes.indexOf(m.type) >= 0) (KN.map[m.skill] = KN.map[m.skill] || []).push(m);
    });
    return KN;
  }
  function skillName(id) { var x = kn().skill[id]; return x ? x.name : id; }
  // 考查知识点：技能下的知识点（知识体系「知识点数据」），按技能分组 [{sid, skill, kps:[{id, name, type, core}]}]
  function kpsOf(skillIds) { return (skillIds || []).map(function (sid) { var x = kn().skill[sid]; return { sid: sid, skill: x ? x.name : sid, kps: (x && x.kps) || [] }; }).filter(function (g) { return g.kps.length; }); }
  /* 知识点掌握（只用于学情分析和补训，不进证据、不汇总到能力）：
     演示用 AI 标注——按该技能的评价等级和提交内容，标出没体现的知识点；老师确认评价时可改。 */
  function hash(str) { var h = 0; for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0; return Math.abs(h); }
  function aiKpMarks(sid, grade, student, allowIds) {
    var x = kn().skill[sid], ks = (x && x.kps) || [], out = {};
    if (allowIds && allowIds.length) ks = ks.filter(function (k) { return allowIds.indexOf(k.id) >= 0; });
    ks.forEach(function (k, i) {
      var miss = grade === '需改进' ? (hash(student + k.id) % 2 === 0 || i === 0) : grade === '合格' ? (ks.length > 1 && hash(student + k.id) % 3 === 0) : false;
      out[k.id] = miss ? 'miss' : 'ok';
    });
    return out;
  }
  // 一次老师评价里，某技能下各知识点的结果：老师确认过的优先，没有则用 AI 标注（存量数据）；
  // allowIds：本次任务发布时勾选的考查知识点（kpIds），有则只保留这些（不传 = 全部，兼容存量数据）
  function itemKps(item, student, allowIds) {
    var m = (item && item.kps) || (item ? aiKpMarks(item.sid, item.grade, student) : {});
    if (!allowIds || !allowIds.length) return m;
    var out = {}; Object.keys(m).forEach(function (k) { if (allowIds.indexOf(k) >= 0) out[k] = m[k]; }); return out;
  }
  function kpCount(skillIds, kpIds) { return kpIds && kpIds.length ? kpIds.length : kpsOf(skillIds).reduce(function (a, g) { return a + g.kps.length; }, 0); }
  // 知识点判定依据：发布时为每个考查知识点定一条「体现了什么算掌握」，默认取知识体系里该知识点的核心内容，老师可改；
  // 任务里存了（task.kpCrit）以任务为准，存量任务没有则用默认
  function kpCritDefault(k) { return k.core ? '作答中体现：' + k.core : '作答中能正确运用「' + k.name + '」'; }
  function kpCrit(task, k) { return (task && task.kpCrit && task.kpCrit[k.id]) || kpCritDefault(k); }
  // 判定依据列表（只读）：按技能分组，每个知识点一行
  function kpCritHTML(task) {
    var gs = kpsOf((task && task.skillIds) || []), ids = task && task.kpIds && task.kpIds.length ? task.kpIds : null;
    if (ids) gs = gs.map(function (g) { var k2 = g.kps.filter(function (k) { return ids.indexOf(k.id) >= 0; }); return k2.length ? { skill: g.skill, kps: k2 } : null; }).filter(function (g) { return g; });
    if (!gs.length) return '';
    return gs.map(function (g) {
      return '<div style="font-size:12px;color:var(--muted);margin-top:6px">' + esc(g.skill) + '</div>' + g.kps.map(function (k) {
        return '<div style="font-size:12.5px;line-height:1.7;padding:2px 0 2px 10px;border-left:2px solid var(--rule)"><b style="font-weight:600">' + esc(k.name) + '</b>：<span style="color:var(--ink-2)">' + esc(kpCrit(task, k)) + '</span></div>';
      }).join('');
    }).join('');
  }
  // 考查知识点展示：每个技能一行，知识点标类型，悬停看核心内容；kpIds = 发布时勾选的，有则只显示勾选的
  function kpHTML(skillIds, kpIds) {
    var gs = kpsOf(skillIds);
    if (kpIds && kpIds.length) gs = gs.map(function (g) { var k2 = g.kps.filter(function (k) { return kpIds.indexOf(k.id) >= 0; }); return k2.length ? { sid: g.sid, skill: g.skill, kps: k2 } : null; }).filter(function (g) { return g; });
    if (!gs.length) return '<span style="color:var(--muted);font-size:12px">' + ((skillIds || []).length ? '所选技能下没有知识点' : '未挂技能，没有考查知识点') + '</span>';
    return gs.map(function (g) {
      return '<div style="font-size:12.5px;line-height:1.9"><span style="color:var(--muted)">' + esc(g.skill) + '：</span>' + g.kps.map(function (k) {
        return '<span title="' + esc(k.core || '') + '" style="display:inline-block;border:1px solid var(--rule);border-radius:6px;padding:0 7px;margin:0 6px 4px 0;background:var(--card)">' + esc(k.name) + (k.type ? '<small style="color:var(--muted);margin-left:4px">' + esc(k.type) + '</small>' : '') + '</span>';
      }).join('') + '</div>';
    }).join('');
  }

  /* ── 图谱中心（graph/）新建的课程级知识体系：建课次时可选用；选用时导入一份到本机数据（st.gks），之后与预置知识体系同样使用 ── */
  function graphSystems(courseName) {
    var list = [];
    try { list = JSON.parse(sessionStorage.getItem('ks_systems_v2') || '[]'); } catch (e) {}
    return list.filter(function (s) { return s.range === '课程' && s.relObject === courseName && s.buildStatus === 'built' && s.tree; });
  }
  function gksFrom(s) {
    var cid = 'GKS-' + s.id, c = { id: cid, name: s.relObject, ksName: s.name, source: '图谱中心', category: '', tasks: [] }, ti = 0;
    var clean = function (n) { return String(n).replace(/^(技能|达标依据)：/, ''); };
    (function walk(n) {
      if (n.type === 'task') {
        ti++;
        var t = { id: cid + '-T' + ti, name: n.name, courseId: cid, skills: [] }, si = 0;
        (n.children || []).forEach(function (ch) {
          if (ch.type !== 'skill') return;
          si++;
          var std = (ch.children || []).find(function (x) { return x.type === 'criterion' || x.type === 'standard'; });
          t.skills.push({ id: t.id + '-S' + si, name: clean(ch.name), taskId: t.id, require: clean(ch.name), result: std ? clean(std.name) : '达到该技能要求，内容完整、表述准确' });
        });
        if (t.skills.length) c.tasks.push(t);   // 没有技能的任务不能用于建课次（无法生成评价标准）
        return;
      }
      (n.children || []).forEach(walk);
    })(s.tree);
    return c;
  }
  function registerGks(c) {
    var K = kn();
    K.course[c.id] = c;
    c.tasks.forEach(function (t) { K.task[t.id] = t; t.skills.forEach(function (x) { K.skill[x.id] = x; }); });
  }
  function importGks(st, s) { var c = gksFrom(s); (st.gks = st.gks || {})[s.id] = c; registerGks(c); return c; }
  /* 课程计划对应的知识体系：以课程上记录的关联为准（预置知识体系的课程，或图谱中心为这门课建的课程知识体系 GKS-…） */
  function eduCourse(st, p) { return st.edu ? st.edu.courses.filter(function (c) { return c.id === p.eduCourseId; })[0] : null; }
  function planKsId(st, p) { var ec = eduCourse(st, p); return ec ? (ec.ks || '') : (p.courseId || ''); }
  function ensureKs(st, ks) {
    if (!ks || kn().course[ks] || ks.indexOf('GKS-') !== 0) return;
    if (st.gks && st.gks[ks.slice(4)]) { registerGks(st.gks[ks.slice(4)]); return; }
    var list = []; try { list = JSON.parse(sessionStorage.getItem('ks_systems_v2') || '[]'); } catch (e) {}
    var s = list.filter(function (x) { return 'GKS-' + x.id === ks && x.buildStatus === 'built' && x.tree; })[0];
    if (s) importGks(st, s);   // 选用时导入一份，之后图谱中心的修改不影响已建课次
  }
  function planTasks(st, p) { var ks = planKsId(st, p); ensureKs(st, ks); return ((kn().course[ks] || { tasks: [] }).tasks).slice(); }
  // 课程计划的三种情况：linked 已关联知识体系；unlinked 专业课未关联；public 公共基础课（默认不计入技能达成，关联了知识体系则按已关联处理）
  function planKind(st, p) {
    if (planKsId(st, p)) return 'linked';
    var ec = eduCourse(st, p);
    return ec && ec.type === '公共基础课' ? 'public' : 'unlinked';
  }

  /* ── 评价标准：每个评价项对应一个技能，分优秀 / 合格 / 需改进三档 ── */
  var GRADES = ['优秀', '合格', '需改进'];
  // 演示用 AI 生成：优秀取技能的达成结果，合格取技能要求
  function genCriteria(skillIds) {
    return skillIds.map(function (id) {
      var x = kn().skill[id] || { name: id, require: '', result: '' };
      return { sid: id, name: x.name, levels: { '优秀': x.result, '合格': '基本做到：' + x.require, '需改进': '未做到上述要求，关键环节缺失或有明显错误' } };
    });
  }
  // 整体等级：全部优秀为优秀；需改进超过一半为需改进；其余为合格
  function overall(items) {
    var g = items.map(function (x) { return x.grade; });
    if (!g.length) return '';
    if (g.every(function (x) { return x === '优秀'; })) return '优秀';
    return g.filter(function (x) { return x === '需改进'; }).length * 2 > g.length ? '需改进' : '合格';
  }
  var AI_REASON = { '优秀': '内容完整，达到该项的达成结果要求。', '合格': '基本做到，细节和依据还需完善。', '需改进': '缺少该项要求的内容，或有明显错误。' };
  function gradeItems(crit, grades) { return crit.map(function (c, i) { return { sid: c.sid, grade: grades[i] || grades[grades.length - 1] }; }); }
  function aiItems(crit, grades) { return gradeItems(crit, grades).map(function (x) { x.reason = AI_REASON[x.grade]; return x; }); }
  /* 证据：老师确认「通过」后，每个评价项记一条「学生 × 技能」 */
  function addEvidence(st, c, s) {
    (s.teacher.items || []).forEach(function (x) {
      st.evidence.push({ id: uid('E'), student: s.student, sid: x.sid, grade: x.grade, tid: c.id, planId: c.planId, subAt: s.at, by: st.teacher, at: s.teacher.at });
    });
  }

  /* ── mock 数据 ── */
  var TERM = '2026-2027 第一学期';
  function seed() {
    var stu1 = ['张晓雨', '李嘉豪', '王思琪'], stu2 = ['陈子轩', '刘雨涵', '赵一鸣', '孙佳怡'];
    var files = function (base, types) {
      var all = {
        '课件': { name: base + '_课件.pptx', size: '32.5 MB' }, '教案': { name: base + '_教案.docx', size: '22.3 KB' },
        '图片': { name: base + '_图片1.png', size: '1.1 MB' }, '情景互动游戏': { name: base + '_游戏.docx', size: '22.5 KB' },
        '视频': { name: base + '_讲解视频.mp4', size: '48.2 MB' }
      };
      return types.map(function (t) { return { id: uid('F'), type: t, name: all[t].name, size: all[t].size }; });
    };
    var K = kn(), sk = function (tid) { return ((K.task[tid] || {}).skills || []).map(function (x) { return x.id; }); };
    var kw = function (tid) { return sk(tid).map(skillName).join(' › '); };
    // 知识体系任务：旅行策划 / 旅行社经营与管理
    var T_THEME = 'T92182239a1', T_ROUTE = 'T882fe6be5b', T_PROMO = 'T41f49eb1dc', T_RECEIVE = 'T4683a72cc3', T_SALE = 'T692a377f02', T_ADMIN = 'T9b6539bf94';
    var T_GUIDE = 'T32b70c3195', T_EMERG = 'Teb4a82849c';   // 导游业务：导览讲解 / 问题与突发事件处理
    var R1 = { id: 'RES1', name: '《客户咨询与接待》备课资源包', status: '已完成', createdAt: daysAgo(2, 10, 7), skillIds: sk(T_RECEIVE), knowledge: kw(T_RECEIVE), files: files('客户咨询与接待', ['课件', '教案', '图片', '情景互动游戏']) };
    var R2 = { id: 'RES2', name: '《策划方案呈现与营销推广》备课资源包', status: '已完成', createdAt: daysAgo(1, 15, 18), skillIds: sk(T_PROMO), knowledge: kw(T_PROMO), files: files('策划方案呈现与营销推广', ['课件', '教案', '图片', '情景互动游戏']) };
    var R3 = { id: 'RES3', name: '《旅行线路规划与资源整合》备课资源包', status: '已完成', createdAt: daysAgo(3, 14, 20), skillIds: sk(T_ROUTE), knowledge: kw(T_ROUTE), files: files('旅行线路规划与资源整合', ['课件', '教案', '图片', '视频']) };
    var R4 = { id: 'RES4', name: '《旅行社基层管理》备课资源包', status: '生成中', createdAt: today(9, 30), skillIds: sk(T_ADMIN), knowledge: kw(T_ADMIN), files: files('旅行社基层管理', ['图片']) };
    var R5 = { id: 'RES5', name: '《策划方案呈现与营销推广》课件', status: '生成失败', createdAt: daysAgo(1, 15, 26), skillIds: sk(T_PROMO), knowledge: kw(T_PROMO), files: [] };
    var R6 = { id: 'RES6', name: '《旅行社产品推荐与销售》备课资源包', status: '已完成', createdAt: daysAgo(34, 9, 40), skillIds: sk(T_SALE), knowledge: kw(T_SALE), files: files('旅行社产品推荐与销售', ['课件', '教案']) };
    var R7 = { id: 'RES7', name: '《客户需求分析与行程主题定位》备课资源包', status: '已完成', createdAt: daysAgo(3, 8, 30), skillIds: sk(T_THEME), knowledge: kw(T_THEME), files: files('客户需求分析与行程主题定位', ['课件', '教案', '图片']) };
    var R8 = { id: 'RES8', name: '《导游业务·导览讲解与应急处置》备课资源包', status: '已完成', createdAt: daysAgo(12, 9, 30), skillIds: sk(T_GUIDE).concat(sk(T_EMERG)), knowledge: kw(T_GUIDE) + ' › ' + kw(T_EMERG), files: files('导游业务', ['课件', '教案', '视频']) };
    // 学习记录按文件记：{ 学生: { 文件id: 学习时间 } }
    var L = function (R, types, at) { var m = {}; R.files.forEach(function (f) { if (types.indexOf(f.type) >= 0) m[f.id] = at; }); return m; };
    var sub = function (st, extra) { return Object.assign({ student: st, status: '未提交', modes: [], at: '', files: [], ai: null, teacher: null }, extra || {}); };
    // 课次的情景任务：评价标准按课次对应任务的技能生成
    var task = function (tid, o) { return Object.assign({ on: true, ai: true, needTeacher: true, skillIds: sk(tid), criteria: genCriteria(sk(tid)) }, o); };
    var AI = function (t, grades, txt) { return Object.assign({ result: overall(gradeItems(t.criteria, grades)), items: aiItems(t.criteria, grades) }, txt); };
    var TE = function (t, grades, comment, at, result) { var it = gradeItems(t.criteria, grades); return { items: it, grade: overall(it), comment: comment, result: result || '通过', at: at }; };
    var good = { summary: '按要求完成了任务，主要内容齐全。', highlights: '结构清楚，关键要素都有涉及。', problems: '部分内容缺少依据或数据来源。', advice: '补充关键数据的来源，结论部分再精炼一些。' };

    var tk2 = task(T_RECEIVE, { name: '门店客户咨询接待记录', desc: '以一位咨询周边游的客户为对象，完成一次门店咨询接待演练，提交接待记录：客户需求要点、推荐思路和接待礼仪自查。', modes: ['文字', '语音', '图片', '文档'], due: daysAgo(0, 18, 0) });
    var tk3 = task(T_ROUTE, { name: '三日游线路设计与报价', desc: '设计一条本地三日游线路，完成成本核算与报价单。', modes: ['文档'], due: daysAgo(-1, 18, 0) });
    var tk4 = task(T_PROMO, { name: '线路推介方案', desc: '为一条本地线路制作推介方案：主题包装、三条卖点和一份新媒体推广计划。', modes: ['文字', '图片', '文档'], due: hoursLater(6) });
    var tk5 = task(T_ROUTE, { name: '本地一日游线路设计', desc: '设计一条本地一日游线路，写明行程安排、交通方式、餐饮安排与报价，报价需列出成本构成。', modes: ['文字', '文档'], due: daysAgo(1, 23, 0) });
    var tk6 = task(T_SALE, { name: '本地旅行社产品调查', desc: '调查本地两家旅行社的主打产品和销售方式，比较两者在产品组合和销售话术上的差异。', modes: ['文字', '文档'], due: daysAgo(30, 18, 0) });
    var tk7 = task(T_THEME, { name: '大学生周末短途产品策划', desc: '为大学生群体设计一款周末短途产品，包括客群分析、主题定位、行程亮点和宣传语。', modes: ['文字', '图片', '文档'], due: daysAgo(1, 0, 0) });
    var tk9 = task(T_GUIDE, { name: '景区导览讲解演练', desc: '以本市一处景区为对象，录制一段 5 分钟的导览讲解，并写出讲解提纲和针对亲子游客的调整方案。', modes: ['语音', '文档'], due: daysAgo(9, 18, 0) });
    var tk10 = task(T_EMERG, { name: '带团突发事件处置预案', desc: '针对游客中暑和游客投诉两种情形，写出现场处置步骤、沟通话术和事后报告要点。', modes: ['文字', '文档'], due: daysAgo(4, 18, 0) });
    var tk8 = task(T_ROUTE, { name: '三日游线路设计与报价', desc: '设计一条本地三日游线路，完成成本核算与报价单。', modes: ['文档'], due: daysAgo(-1, 18, 0) });
    var base = function (id, planId, ktask, name, o) { return Object.assign({ id: id, planId: planId, ktask: ktask, skillIds: sk(ktask), name: name, major: '导游', source: '自建课次', term: TERM, status: '已发布', resIds: [], publish: null, submissions: [], feedbacks: [], learn: {} }, o); };
    var courses = [
      base('CRS1', 'CP2', T_ADMIN, '旅行社基层管理', { classIds: ['CL1'], start: daysAgo(-6, 9, 0), end: daysAgo(-6, 11, 0), status: '未发布', createdAt: today(8, 40) }),
      base('CRS2', 'CP2', T_RECEIVE, '客户咨询与接待', { classIds: ['CL1'], start: today(14, 0), end: today(16, 0), resIds: ['RES1'], createdAt: daysAgo(1, 14, 42),
        publish: { at: today(12, 1), classIds: ['CL1'], fileIds: R1.files.slice(0, 2).map(function (f) { return f.id; }), task: tk2, feedback: true },
        submissions: [sub('林同学', { status: '已退回', modes: ['文字'], at: today(12, 30), files: [{ type: '文字', name: '文字提交', size: '14 字', text: '客户想去海边，我推荐了海岛三日游。' }], ai: AI(tk2, ['合格', '需改进'], { summary: '只写了推荐结果，没有记录客户需求。', highlights: '接待用语礼貌。', problems: '没有问清出行人数、预算、时间等需求。', advice: '补充需求询问的过程和记录。' }), teacher: TE(tk2, ['合格', '需改进'], '需求挖掘不够：没有问清出行人数、预算和时间，请补充接待记录后重新提交。', today(13, 20), '退回修改') }),
          sub(stu1[0], { status: '已提交', modes: ['图片', '文字', '文档', '语音'], at: today(15, 36), files: [{ type: '图片', name: '接待演练现场.jpeg', size: '1.1 MB' }, { type: '语音', name: '语音汇报_15:36.wav', size: '151.9 KB' }, { type: '文档', name: '门店客户咨询接待记录.docx', size: '37.9 KB' }, { type: '文字', name: '文字说明', size: '115 字', text: '客户为三口之家，预算 3000 元，想在国庆假期去海边。我先确认了出行时间、孩子年龄和住宿要求，推荐了两条海滨线路并说明了差别，最后约定第二天回访。' }], ai: AI(tk2, ['合格', '合格'], good) }),
          sub(stu1[1], { status: '已退回', modes: ['文字'], at: today(12, 50), files: [{ type: '文字', name: '文字说明', size: '86 字', text: '客户问有没有便宜的周边游，我介绍了店里的两条线路，客户说再考虑。' }], ai: AI(tk2, ['合格', '需改进'], { summary: '记录了接待过程，但没有挖掘需求。', highlights: '接待流程完整。', problems: '没有了解客户的预算和偏好。', advice: '用开放式提问了解客户需求。' }), teacher: TE(tk2, ['合格', '需改进'], '请补充对客户需求的询问和记录后重新提交。', today(13, 0), '退回修改') }),
          sub(stu1[2], { status: '超时未交' })],
        feedbacks: [{ student: stu1[1], at: today(17, 10), scores: { '讲授内容': 4, '教学方式': 4, '互动体验': 3, '学习收获': 4 }, text: '接待演练很实用，希望多练几次。', read: false }],
        learn: { '张晓雨': L(R1, ['课件', '教案'], today(13, 10)), '李嘉豪': L(R1, ['课件'], today(12, 20)) } }),
      base('CRS3', 'CP1', T_ROUTE, '三日游线路规划与成本', { classIds: ['CL1'], start: daysAgo(1, 14, 0), end: daysAgo(1, 16, 0), resIds: ['RES3'], createdAt: daysAgo(2, 9, 12),
        publish: { at: daysAgo(1, 15, 24), classIds: ['CL1'], fileIds: R3.files.map(function (f) { return f.id; }), task: tk3, feedback: true },
        submissions: [sub('林同学', { status: '已提交', modes: ['文字', '文档'], at: daysAgo(1, 21, 5), files: [{ type: '文字', name: '文字提交', size: '38 字', text: '设计了“古城文化三日游”，第一天古城墙与博物馆，第二天非遗工坊体验，第三天湿地公园，人均报价 980 元。' }, { type: '文档', name: '三日游线路方案_林同学.docx', size: '55KB' }], ai: AI(tk3, ['合格', '需改进'], { summary: '线路设计完整，报价缺少成本明细。', highlights: '三天主题清楚，节奏合理。', problems: '报价只给了总价，没有列出交通、住宿、门票、餐饮等成本。', advice: '补充成本明细表，说明报价构成。' }) }),
          sub(stu1[0], { status: '已评分', modes: ['文档'], at: daysAgo(1, 20, 10), files: [{ type: '文档', name: '张晓雨_三日游线路方案.docx', size: '48 KB' }], ai: AI(tk3, ['优秀', '合格'], good), teacher: TE(tk3, ['优秀', '优秀'], '线路设计有亮点，成本核算清楚。', daysAgo(1, 21, 30)) }),
          sub(stu1[1], { status: '已评分', modes: ['文档'], at: daysAgo(1, 20, 11), files: [{ type: '文档', name: '李嘉豪_三日游线路方案.docx', size: '48 KB' }], ai: AI(tk3, ['合格', '需改进'], good), teacher: TE(tk3, ['合格', '需改进'], '行程合理；成本只列了交通和住宿，门票和餐饮没有核算。', daysAgo(1, 21, 31)) }),
          sub(stu1[2], { status: '已评分', modes: ['文档'], at: daysAgo(1, 20, 12), files: [{ type: '文档', name: '王思琪_三日游线路方案.docx', size: '48 KB' }], ai: AI(tk3, ['合格', '合格'], good), teacher: TE(tk3, ['合格', '合格'], '整体完成，注意淡旺季差异。', daysAgo(1, 21, 32)) })],
        feedbacks: [{ student: '张晓雨', at: daysAgo(1, 17, 2), scores: { '讲授内容': 5, '教学方式': 4, '互动体验': 4, '学习收获': 5 }, text: '成本核算讲得很清楚。', read: true }],
        learn: { '林同学': L(R3, ['课件'], daysAgo(1, 19, 40)), '张晓雨': L(R3, ['课件', '教案', '图片', '视频'], daysAgo(1, 16, 30)), '李嘉豪': L(R3, ['课件', '视频'], daysAgo(1, 17, 0)) } }),
      base('CRS4', 'CP1', T_PROMO, '策划方案呈现与推广', { classIds: ['CL1'], start: today(8, 0), end: today(10, 0), resIds: ['RES2'], createdAt: daysAgo(1, 16, 0),
        publish: { at: today(9, 20), classIds: ['CL1'], fileIds: R2.files.filter(function (f) { return f.type !== '图片'; }).map(function (f) { return f.id; }), task: tk4, feedback: true },
        submissions: [sub('林同学'), sub(stu1[0], { status: '已提交', modes: ['文档'], at: today(10, 40), files: [{ type: '文档', name: '线路推介方案_张晓雨.docx', size: '41KB' }], ai: AI(tk4, ['合格', '合格'], good) }), sub(stu1[1]), sub(stu1[2])],
        feedbacks: [], learn: { '张晓雨': L(R2, ['课件', '教案'], today(10, 0)) } }),
      base('CRS5', 'CP1', T_ROUTE, '一日游线路设计', { classIds: ['CL1'], start: daysAgo(2, 14, 0), end: daysAgo(2, 16, 0), resIds: ['RES3'], createdAt: daysAgo(3, 9, 0),
        publish: { at: daysAgo(2, 14, 27), classIds: ['CL1'], fileIds: R3.files.filter(function (f) { return f.type === '课件' || f.type === '图片'; }).map(function (f) { return f.id; }), task: tk5, feedback: false },
        submissions: [sub('林同学', { status: '超时未交' }), sub(stu1[0], { status: '已评分', modes: ['文档'], at: daysAgo(1, 20, 0), files: [{ type: '文档', name: '一日游线路_张晓雨.docx', size: '36KB' }], ai: AI(tk5, ['合格', '需改进'], good), teacher: TE(tk5, ['合格', '需改进'], '行程合理，报价缺少门票明细，成本核算不完整。', today(8, 50)) }),
          sub(stu1[1], { status: '超时未交' }), sub(stu1[2], { status: '已提交', modes: ['文字'], at: daysAgo(1, 22, 30), files: [{ type: '文字', name: '文字提交', size: '96 字', text: '上午古城墙骑行，中午老街小吃，下午博物馆参观，人均报价 158 元，含大巴、门票与午餐。' }], ai: AI(tk5, ['合格', '合格'], good) })],
        feedbacks: [], learn: { '张晓雨': L(R3, ['课件', '图片'], daysAgo(1, 19, 0)) } }),
      base('CRS6', 'CP2', T_SALE, '旅行社产品推荐与销售', { classIds: ['CL1'], start: daysAgo(33, 14, 0), end: daysAgo(33, 16, 0), resIds: ['RES6'], createdAt: daysAgo(34, 9, 0),
        publish: { at: daysAgo(33, 16, 0), classIds: ['CL1'], fileIds: R6.files.map(function (f) { return f.id; }), task: tk6, feedback: true },
        submissions: [sub('林同学', { status: '已评分', modes: ['文档'], at: daysAgo(31, 21, 0), files: [{ type: '文档', name: '本地旅行社产品调查_林同学.docx', size: '52KB' }], ai: AI(tk6, ['合格', '合格'], good), teacher: TE(tk6, ['合格', '合格'], '调查对象和比较维度清楚，建议补充销售话术的具体例子。', daysAgo(29, 10, 0)) }),
          sub(stu1[0], { status: '已评分', modes: ['文档'], at: daysAgo(31, 20, 0), files: [{ type: '文档', name: '本地旅行社产品调查_张晓雨.docx', size: '58KB' }], ai: AI(tk6, ['优秀', '优秀'], good), teacher: TE(tk6, ['优秀', '优秀'], '数据翔实，比较有深度。', daysAgo(29, 10, 5)) }),
          sub(stu1[1], { status: '已评分', modes: ['文字'], at: daysAgo(30, 17, 0), files: [{ type: '文字', name: '文字提交', size: '120 字', text: '两家旅行社分别以出境游和研学游为主，前者门店销售为主，后者主要通过学校渠道。' }], ai: AI(tk6, ['合格', '优秀'], good), teacher: TE(tk6, ['合格', '优秀'], '结论清楚，产品组合可以分析得更具体。', daysAgo(29, 10, 10)) }),
          sub(stu1[2], { status: '已评分', modes: ['文档'], at: daysAgo(30, 15, 0), files: [{ type: '文档', name: '本地旅行社产品调查_王思琪.docx', size: '47KB' }], ai: AI(tk6, ['合格', '需改进'], good), teacher: TE(tk6, ['合格', '需改进'], '产品比较完成，销售话术部分缺少分析。', daysAgo(29, 10, 15)) })],
        feedbacks: [{ student: '林同学', at: daysAgo(31, 21, 20), overall: 5, scores: { '讲授内容': 5, '教学方式': 4, '互动体验': 4, '学习收获': 5 }, tags: ['内容清楚易懂', '学习资源有帮助'], text: '', read: true }],
        learn: { '林同学': L(R6, ['课件', '教案'], daysAgo(32, 20, 10)), '张晓雨': L(R6, ['课件', '教案'], daysAgo(32, 19, 0)) } }),
      base('CRS7', 'CP1', T_THEME, '客户需求分析与主题定位', { classIds: ['CL1'], start: daysAgo(2, 9, 0), end: daysAgo(2, 11, 0), resIds: ['RES7'], createdAt: daysAgo(3, 8, 0),
        publish: { at: daysAgo(2, 10, 0), classIds: ['CL1'], fileIds: R7.files.filter(function (f) { return f.type === '图片' || f.type === '教案'; }).map(function (f) { return f.id; }), task: tk7, feedback: true },
        submissions: [sub('林同学', { status: '已评分', modes: ['文字', '文档'], at: daysAgo(2, 15, 29), evalSeen: false,
            files: [{ type: '文字', name: '文字提交', size: '61 字', text: '“青春山海周末游”：周六海滨栈道徒步、渔村午餐，周日灯塔公园打卡后返程。人均成本 268 元，报价 328 元。' }, { type: '文档', name: '大学生周末短途产品策划_林同学.docx', size: '45KB' }],
            ai: AI(tk7, ['优秀', '合格'], good), teacher: TE(tk7, ['优秀', '优秀'], '客群分析有数据，主题包装贴合大学生。下一步可以补充一个雨天备选方案。', today(9, 30)) }),
          sub(stu1[0], { status: '已提交', modes: ['文档'], at: daysAgo(2, 20, 0), files: [{ type: '文档', name: '产品策划_张晓雨.docx', size: '50KB' }], ai: AI(tk7, ['合格', '合格'], good) }), sub(stu1[1], { status: '超时未交' }), sub(stu1[2], { status: '超时未交' })],
        feedbacks: [], learn: { '林同学': L(R7, ['图片', '教案'], daysAgo(2, 11, 20)) } }),
      base('CRS8', 'CP3', T_ROUTE, '三日游线路规划与成本', { classIds: ['CL2'], start: daysAgo(1, 9, 0), end: daysAgo(1, 11, 0), resIds: ['RES3'], createdAt: daysAgo(2, 9, 30),
        publish: { at: daysAgo(1, 10, 30), classIds: ['CL2'], fileIds: R3.files.map(function (f) { return f.id; }), task: tk8, feedback: true },
        submissions: [sub(stu2[0], { status: '已提交', modes: ['文档'], at: today(10, 5), files: [{ type: '文档', name: '陈子轩_三日游线路方案.docx', size: '52 KB' }], ai: AI(tk8, ['合格', '合格'], good) }),
          sub(stu2[1], { status: '已提交', modes: ['文档'], at: today(10, 6), files: [{ type: '文档', name: '刘雨涵_三日游线路方案.docx', size: '50 KB' }], ai: AI(tk8, ['优秀', '合格'], good) }), sub(stu2[2]), sub(stu2[3])],
        feedbacks: [
          { student: '陈子轩', at: daysAgo(1, 18, 30), scores: { '讲授内容': 4, '教学方式': 3, '互动体验': 3, '学习收获': 4 }, text: '小组讨论时间有点短。', read: true },
          { student: '刘雨涵', at: today(9, 12), scores: { '讲授内容': 4, '教学方式': 4, '互动体验': 3, '学习收获': 4 }, text: '', read: false }],
        learn: { '陈子轩': L(R3, ['课件'], daysAgo(1, 18, 0)), '刘雨涵': L(R3, ['课件', '教案', '视频'], today(9, 0)) } })
    ];
    courses.push(
      base('CRS9', 'CP4', T_GUIDE, '规范化导览讲解', { classIds: ['CL1'], start: daysAgo(11, 9, 0), end: daysAgo(11, 11, 0), resIds: ['RES8'], createdAt: daysAgo(12, 10, 0),
        publish: { at: daysAgo(11, 11, 10), classIds: ['CL1'], fileIds: R8.files.map(function (f) { return f.id; }), task: tk9, feedback: false },
        submissions: [sub('林同学', { status: '已评分', modes: ['语音', '文档'], at: daysAgo(10, 20, 15), files: [{ type: '语音', name: '古城墙导览讲解.wav', size: '4.2 MB' }, { type: '文档', name: '导览讲解提纲_林同学.docx', size: '38KB' }], ai: AI(tk9, ['合格', '合格'], good), teacher: TE(tk9, ['合格', '优秀'], '讲解流程规范，亲子调整方案有新意；讲解节奏可以再放慢一些。', daysAgo(9, 10, 0)) }),
          sub(stu1[0], { status: '已评分', modes: ['语音', '文档'], at: daysAgo(10, 19, 0), files: [{ type: '文档', name: '导览讲解提纲_张晓雨.docx', size: '41KB' }], ai: AI(tk9, ['优秀', '合格'], good), teacher: TE(tk9, ['优秀', '优秀'], '讲解生动，互动设计好。', daysAgo(9, 10, 5)) }),
          sub(stu1[1], { status: '已评分', modes: ['文档'], at: daysAgo(10, 21, 0), files: [{ type: '文档', name: '导览讲解提纲_李嘉豪.docx', size: '30KB' }], ai: AI(tk9, ['合格', '合格'], good), teacher: TE(tk9, ['合格', '合格'], '提纲完整，缺少现场互动设计。', daysAgo(9, 10, 10)) }),
          sub(stu1[2], { status: '已评分', modes: ['语音', '文档'], at: daysAgo(10, 18, 30), files: [{ type: '文档', name: '导览讲解提纲_王思琪.docx', size: '35KB' }], ai: AI(tk9, ['需改进', '合格'], good), teacher: TE(tk9, ['需改进', '合格'], '讲解顺序有跳跃，请按服务流程重新梳理。', daysAgo(9, 10, 15)) })],
        feedbacks: [], learn: { '林同学': L(R8, ['课件', '视频'], daysAgo(11, 19, 0)), '张晓雨': L(R8, ['课件', '教案', '视频'], daysAgo(11, 18, 0)) } }),
      base('CRS10', 'CP4', T_EMERG, '导游突发事件应急处置', { classIds: ['CL1'], start: daysAgo(6, 14, 0), end: daysAgo(6, 16, 0), resIds: ['RES8'], createdAt: daysAgo(7, 9, 0),
        publish: { at: daysAgo(6, 16, 5), classIds: ['CL1'], fileIds: R8.files.filter(function (f) { return f.type !== '视频'; }).map(function (f) { return f.id; }), task: tk10, feedback: false },
        submissions: [sub('林同学', { status: '已评分', modes: ['文字', '文档'], at: daysAgo(5, 21, 0), files: [{ type: '文字', name: '文字提交', size: '72 字', text: '游客中暑：移到阴凉处、补充淡盐水、冷敷降温，严重时拨打 120 并报告旅行社；投诉：先倾听安抚，记录诉求，在授权内提出补偿方案。' }, { type: '文档', name: '突发事件处置预案_林同学.docx', size: '44KB' }], ai: AI(tk10, ['合格', '合格'], good), teacher: TE(tk10, ['合格', '合格'], '处置步骤正确，投诉沟通话术可以更具体。', daysAgo(4, 9, 30)) }),
          sub(stu1[0], { status: '已评分', modes: ['文档'], at: daysAgo(5, 20, 0), files: [{ type: '文档', name: '突发事件处置预案_张晓雨.docx', size: '47KB' }], ai: AI(tk10, ['优秀', '合格'], good), teacher: TE(tk10, ['优秀', '合格'], '投诉处理思路清楚，中暑处置补充一下报告流程。', daysAgo(4, 9, 35)) }),
          sub(stu1[1], { status: '已退回', modes: ['文字'], at: daysAgo(5, 22, 0), files: [{ type: '文字', name: '文字提交', size: '20 字', text: '中暑就送医院，投诉就让游客找旅行社。' }], ai: AI(tk10, ['需改进', '需改进'], { summary: '处置步骤过于简单。', highlights: '—', problems: '缺少现场处置和沟通过程。', advice: '按任务要求写出具体步骤和话术。' }), teacher: TE(tk10, ['需改进', '需改进'], '缺少现场处置步骤和沟通话术，请补充后重新提交。', daysAgo(4, 9, 40), '退回修改') }),
          sub(stu1[2], { status: '已评分', modes: ['文档'], at: daysAgo(5, 19, 0), files: [{ type: '文档', name: '突发事件处置预案_王思琪.docx', size: '40KB' }], ai: AI(tk10, ['合格', '需改进'], good), teacher: TE(tk10, ['合格', '需改进'], '投诉处理到位，中暑处置缺少报告环节。', daysAgo(4, 9, 45)) })],
        feedbacks: [], learn: { '林同学': L(R8, ['课件', '教案'], daysAgo(6, 19, 0)) } })
    );
    var growth = [
      { id: uid('G'), at: daysAgo(4, 9, 45), type: '评价学生任务', target: '《带团突发事件处置预案》学生任务评价', desc: '完成学生任务评价，当前进度：4/4', stars: 5, ref: { kind: 'course', id: 'CRS10' } },
      { id: uid('G'), at: daysAgo(9, 10, 15), type: '评价学生任务', target: '《景区导览讲解演练》学生任务评价', desc: '完成学生任务评价，当前进度：4/4', stars: 5, ref: { kind: 'course', id: 'CRS9' } },
      { id: uid('G'), at: daysAgo(12, 10, 5), type: '备课', target: '《导游业务·导览讲解与应急处置》备课资源包', desc: '生成课件、教案、视频', stars: 3, ref: { kind: 'res', id: 'RES8' } },
      { id: uid('G'), at: today(15, 21), type: '备课', target: '《旅行社基层管理》备课资源包 · 图片', desc: '生成图片素材成功', stars: 1, ref: { kind: 'res', id: 'RES4' } },
      { id: uid('G'), at: today(12, 1), type: '发布学习内容', target: '《客户咨询与接待》发布学习内容', desc: '同时发布学习资源 + 情景任务', stars: 5, ref: { kind: 'course', id: 'CRS2' } },
      { id: uid('G'), at: daysAgo(1, 21, 40), type: '评价学生任务', target: '《三日游线路设计与报价》学生任务评价', desc: '完成学生任务评价，当前进度：3/4', stars: 3.75, ref: { kind: 'course', id: 'CRS3' } },
      { id: uid('G'), at: daysAgo(1, 15, 26), type: '备课', target: '《策划方案呈现与营销推广》备课资源包 · 课件', desc: '生成课件成功', stars: 1, ref: { kind: 'res', id: 'RES2' } },
      { id: uid('G'), at: daysAgo(1, 15, 24), type: '发布学习内容', target: '《三日游线路规划与成本》发布学习内容', desc: '同时发布学习资源 + 情景任务', stars: 5, ref: { kind: 'course', id: 'CRS3' } },
      { id: uid('G'), at: daysAgo(1, 15, 23), type: '备课', target: '《策划方案呈现与营销推广》备课资源包 · 情景互动游戏', desc: '生成情景互动游戏成功', stars: 1, ref: { kind: 'res', id: 'RES2' } },
      { id: uid('G'), at: daysAgo(1, 15, 20), type: '备课', target: '《策划方案呈现与营销推广》备课资源包 · 教案', desc: '生成教案成功', stars: 1, ref: { kind: 'res', id: 'RES2' } },
      { id: uid('G'), at: daysAgo(2, 10, 15), type: '备课', target: '《客户咨询与接待》备课资源包', desc: '生成课件、教案、图片、情景互动游戏', stars: 4, ref: { kind: 'res', id: 'RES1' } },
      { id: uid('G'), at: daysAgo(3, 14, 30), type: '备课', target: '《旅行线路规划与资源整合》备课资源包', desc: '生成课件、教案、图片、视频', stars: 4, ref: { kind: 'res', id: 'RES3' } },
      { id: uid('G'), at: daysAgo(1, 19, 0), type: '学生课程反馈', target: '《三日游线路规划与成本》学生课程反馈', desc: '课程反馈均分 4.0 分', stars: 2, ref: { kind: 'course', id: 'CRS3' } },
      { id: uid('G'), at: daysAgo(34, 10, 0), type: '备课', target: '《旅行社产品推荐与销售》备课资源包', desc: '生成课件、教案', stars: 2, ref: { kind: 'res', id: 'RES6' } },
      { id: uid('G'), at: daysAgo(33, 16, 0), type: '发布学习内容', target: '《旅行社产品推荐与销售》发布学习内容', desc: '同时发布学习资源 + 情景任务', stars: 5, ref: { kind: 'course', id: 'CRS6' } },
      { id: uid('G'), at: daysAgo(40, 9, 0), type: '评价学生任务', target: '《旅游市场调研》学生任务评价', desc: '完成学生任务评价，当前进度：4/4', stars: 5, ref: null }
    ];
    var st = {
      v: 6, teacher: '李老师', gks: {},
      classes: [{ id: 'CL1', name: '导游 2024级 1班', major: '导游', students: ['林同学'].concat(stu1) }, { id: 'CL2', name: '导游 2024级 2班', major: '导游', students: stu2 }],
      // 管理端课程计划（班级 × 课程 × 授课教师 × 学期），课程已关联知识体系课程
      plans: [
        { id: 'CP1', courseId: 'C6a16162d72', course: '旅行策划', classId: 'CL1', teacher: '李老师', term: TERM },
        { id: 'CP2', courseId: 'C5f2ef49d1e', course: '旅行社经营与管理', classId: 'CL1', teacher: '李老师', term: TERM },
        { id: 'CP3', courseId: 'C6a16162d72', course: '旅行策划', classId: 'CL2', teacher: '李老师', term: TERM },
        { id: 'CP4', courseId: 'C7b923953d1', course: '导游业务', classId: 'CL1', teacher: '何老师', term: TERM },
        // 研学旅行管理与服务：预置知识体系里没有这门课，由老师在图谱中心建课程知识体系后再建课次
        { id: 'CP5', courseId: 'C-YX', course: '研学旅行管理与服务', classId: 'CL1', teacher: '何老师', term: TERM }
      ],
      majors: ['导游'],
      terms: [TERM, '2025-2026 第二学期'],
      resources: [R4, R2, R5, R3, R7, R1, R8, R6],
      courses: courses,
      evidence: [],
      growth: growth,
      plan: { stage: '', cycle: '', direction: '', support: '', updatedAt: '' },
      archives: {}, base: null, stuGrowth: {}
    };
    courses.forEach(function (c) { c.submissions.forEach(function (s) { if (s.teacher && s.teacher.result === '通过') addEvidence(st, c, s); }); });
    seedStuGrowth(st);
    return st;
  }
  /* 学生成长记录由学习 / 提交 / 评价 / 反馈数据生成，规则见 STU_STAR */
  var STU_STAR = { learn: 1, submit: 2, submitLate: 1, feedback: 1, grade: { '优秀': 5, '合格': 3, '需改进': 1 } };
  function seedStuGrowth(st) {
    st.courses.forEach(function (c) {
      if (!c.publish) return;
      var fname = {}; st.resources.forEach(function (r) { r.files.forEach(function (f) { fname[f.id] = f.name; }); });
      Object.keys(c.learn || {}).forEach(function (who) { Object.keys(c.learn[who]).forEach(function (fid) { addStuGrowth(st, who, { at: c.learn[who][fid], type: '学习资源', target: fname[fid], desc: '学习资源完成', stars: STU_STAR.learn, tid: c.id }); }); });
      c.submissions.forEach(function (x) {
        var first = (x.history && x.history[0]) || (x.at ? x : null);
        if (first) addStuGrowth(st, x.student, { at: first.at, type: '提交任务', target: c.publish.task.name, desc: first.late ? '超时提交情景任务' : '正常提交情景任务', stars: first.late ? STU_STAR.submitLate : STU_STAR.submit, tid: c.id });
        if (x.teacher && x.teacher.result === '通过') addStuGrowth(st, x.student, { at: x.teacher.at, type: '老师评价', target: c.publish.task.name, desc: '老师评价：' + x.teacher.grade, stars: STU_STAR.grade[x.teacher.grade], tid: c.id });
      });
      c.feedbacks.forEach(function (f) { addStuGrowth(st, f.student, { at: f.at, type: '课程反馈', target: c.name, desc: '提交课程反馈', stars: STU_STAR.feedback, tid: c.id }); });
    });
    Object.keys(st.stuGrowth).forEach(function (k) { st.stuGrowth[k].sort(function (a, b) { return a.at < b.at ? 1 : -1; }); });
  }
  function addStuGrowth(st, who, rec) { (st.stuGrowth[who] = st.stuGrowth[who] || []).unshift(Object.assign({ id: uid('G'), at: fmt(new Date()) }, rec)); }
  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.v === 6) { seedEdu(s); s.v = 7; }   // 补上管理端教务基础数据，原有数据保留
      if (s && s.v === 7) { seedCourseType(s); s.v = 8; save(s); }   // 补上课程类型与公共基础课
      if (s && s.v === 8) { seedMajorLevel(s); s.v = 9; save(s); }   // 专业树补第三层
      if (s && s.v === 9) { seedStudents(s); s.v = 10; save(s); }   // 学生档案
      if (s && s.v === 10) { syncSessions(s); s.v = 11; save(s); }   // 排课自动生成课次
      if (s && s.v === 11) { if (seedLabs(s)) save(s); Object.keys(s.gks || {}).forEach(function (k) { registerGks(s.gks[k]); }); return s; }
    } catch (e) {}
    var s2 = seed(); seedEdu(s2); seedCourseType(s2); seedMajorLevel(s2); seedStudents(s2); syncSessions(s2); seedLabs(s2); s2.v = 11; save(s2); return s2;
  }
  /* 实训资源（校内：实训室 / 设备 / 软件）：管理端「教务基础数据 › 实训资源管理」维护；能力测评的实训条件差距读这里。
     首次从能力测评原来预置的本校校内实训资源导入；校外基地第一阶段不在这里管 */
  function seedLabs(st) {
    if (!st.edu || st.edu.labs) return false;
    var A = root.ASSESS_DATA, base = (((A || {}).plans || {})['MAJOR-GUIDE'] || {}).labs || [], n = 0;
    st.edu.labs = base.filter(function (l) { return (l.kind || '校内') === '校内'; }).map(function (l) {
      return { id: 'LAB' + (++n), name: l.name, type: /机房|实训室/.test(l.name) ? '实训室' : '设备', conds: (l.conds || []).slice(), seats: l.seats || '', location: '', owner: '', desc: '', status: '启用', by: '超管', at: '2026-08-20 10:00' };
    });
    return true;
  }
  /* 课程类型：专业课 / 公共基础课（公共基础课默认不计入技能达成）；预置两门公共基础课，并给「大学英语」建一个课程计划 */
  function seedCourseType(st) {
    var E = st.edu;
    E.courses.forEach(function (c) { if (!c.type) c.type = '专业课'; if (c.ks && !c.ksVia) { c.ksVia = '预置'; c.ksBy = '专业负责人'; } });
    if (E.courses.some(function (c) { return c.type === '公共基础课'; })) return;
    var n = E.courses.length;
    E.courses.push({ id: 'EC' + (++n), name: '大学英语', code: 'GG001', majorId: '', type: '公共基础课', desc: '全校公共基础课', status: '启用', ks: '', by: '超管', at: '2026-08-20 10:05' });
    E.courses.push({ id: 'EC' + (++n), name: '思想道德与法治', code: 'GG002', majorId: '', type: '公共基础课', desc: '全校公共基础课', status: '启用', ks: '', by: '超管', at: '2026-08-20 10:06' });
    var en = E.courses[E.courses.length - 2], slots = [];
    for (var i = -2; i <= 3; i++) { var d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 1 + 7 * i); var day = fmt(d, false); slots.push({ id: uid('SL'), start: day + ' 10:00', end: day + ' 12:00' }); }
    st.plans.push({ id: 'CP6', courseId: '', eduCourseId: en.id, course: en.name, classId: 'CL1', teacher: '王老师', term: TERM, status: '启用', by: '超管', at: '2026-08-25 10:00', slots: slots });
  }

  /* ── 管理端教务基础数据 + 课程计划排课 ──
     edu.majors（树）/ grades / terms / courses（课程，可关联知识体系课程）；plans[].slots 为管理端排好的上课时间，老师建课次时从中选 */
  var PERIODS = [['08:00', '10:00'], ['10:00', '12:00'], ['14:00', '16:00'], ['16:00', '18:00']];
  function periodOf(start) { var h = +String(start).slice(11, 13); return h < 10 ? 1 : h < 12 ? 2 : h < 16 ? 3 : 4; }
  function seedEdu(st) {
    if (st.edu) return;
    var by = '超管', at = '2026-08-05 16:06';
    var majors = [
      { id: 'M1', name: '旅游类', code: 'ZY001', parentId: null, status: '启用', desc: '旅游大类专业群', by: by, at: at },
      { id: 'M2', name: '导游', code: 'ZY001001', parentId: 'M1', status: '启用', desc: '专业代码 540102', by: by, at: at },
      { id: 'M3', name: '旅行社经营与管理', code: 'ZY001002', parentId: 'M1', status: '启用', desc: '', by: by, at: '2026-08-05 16:09' },
      { id: 'M4', name: '酒店管理与数字化运营', code: 'ZY001003', parentId: 'M1', status: '启用', desc: '', by: by, at: '2026-08-05 16:09' }
    ];
    var grades = ['2023', '2024', '2025', '2026'].map(function (y) { return { id: 'GR' + y, name: y + '级', code: y, status: '启用', by: by, at: '2026-08-18 15:48' }; });
    var terms = [
      { id: 'TM1', year: '2026-2027', term: '第一学期', start: '2026-09-01', end: '2027-01-31', status: '启用', by: by, at: '2026-08-05 16:20' },
      { id: 'TM0', year: '2025-2026', term: '第二学期', start: '2026-02-23', end: '2026-07-10', status: '启用', by: by, at: '2026-01-10 09:00' },
      { id: 'TM2', year: '2026-2027', term: '第二学期', start: '2027-02-22', end: '2027-07-09', status: '停用', by: by, at: '2026-08-05 16:22' }
    ];
    // 课程：知识体系里导游专业的课程都建为课程并关联；研学旅行管理与服务暂未关联（老师可在图谱中心为它建课程知识体系）
    var K = kn(), n = 0, courses = Object.keys(K.course).map(function (id) {
      n++; return { id: 'EC' + n, name: K.course[id].name, code: 'COURSE' + pad3(n), majorId: 'M2', desc: K.course[id].category ? K.course[id].category + '课程' : '', status: '启用', ks: id, by: by, at: '2026-08-20 10:00' };
    });
    courses.push({ id: 'EC' + (++n), name: '研学旅行管理与服务', code: 'COURSE' + pad3(n), majorId: 'M2', desc: '专业拓展课程', status: '启用', ks: '', by: by, at: '2026-10-20 14:00' });
    st.edu = { majors: majors, grades: grades, terms: terms, courses: courses };
    st.classes.forEach(function (c) { c.majorId = 'M2'; c.gradeId = 'GR2024'; c.status = '启用'; c.desc = c.desc || ''; c.by = by; c.at = '2026-08-20 09:30'; });
    st.classes.push({ id: 'CL3', name: '导游 2025级 1班', major: '导游', majorId: 'M2', gradeId: 'GR2025', status: '启用', desc: '', students: [], by: by, at: '2026-08-20 09:31' });
    st.classes.push({ id: 'CL4', name: '旅行社经营与管理 2024级 1班', major: '旅行社经营与管理', majorId: 'M3', gradeId: 'GR2024', status: '启用', desc: '', students: [], by: by, at: '2026-08-20 09:32' });
    // 课程计划：关联课程、状态，并把已建课次的时间作为已排课时间，再往后排几次未建课次的课
    st.plans.forEach(function (p) {
      var ec = courses.filter(function (c) { return c.name === p.course; })[0];
      p.eduCourseId = ec ? ec.id : ''; p.status = '启用'; p.by = by; p.at = '2026-08-25 10:00';
      var own = st.courses.filter(function (c) { return c.planId === p.id && c.source !== '补训课次'; });
      p.slots = own.map(function (c) { return { id: uid('SL'), start: c.start, end: c.end }; });
      var last = own.reduce(function (m, c) { return c.start > m ? c.start : m; }, daysAgo(7, 8, 0));
      var base = new Date(last.replace(' ', 'T')), per = PERIODS[(p.id.charCodeAt(2) || 0) % 4];
      for (var i = 1; i <= 3; i++) {
        var d = new Date(base); d.setDate(d.getDate() + 7 * i);
        var day = fmt(d, false); p.slots.push({ id: uid('SL'), start: day + ' ' + per[0], end: day + ' ' + per[1] });
      }
      p.slots.sort(function (a, b) { return a.start < b.start ? -1 : 1; });
    });
  }
  /* 专业树层级不限：补一个第三层专业方向，并在它下面建一个班级 */
  function seedMajorLevel(st) {
    var E = st.edu;
    if (E.majors.some(function (m) { return m.id === 'M5'; })) return;
    E.majors.push({ id: 'M5', name: '研学旅行方向', code: 'ZY001001001', parentId: 'M2', status: '启用', desc: '导游专业下设方向', by: '超管', at: '2026-08-05 16:12' });
    if (!st.classes.some(function (c) { return c.id === 'CL5'; })) st.classes.push({ id: 'CL5', name: '导游（研学旅行方向）2025级 1班', major: '研学旅行方向', majorId: 'M5', gradeId: 'GR2025', status: '启用', desc: '', students: [], by: '超管', at: '2026-08-20 09:33' });
  }
  /* ── 排课 → 课次：管理端每排一次课，教师端就有一个课次（source '排课'，带 slotId）──
     未发布的课次跟着排课改时间、随排课删除；已发布的锁定（管理端不能再改这次排课）。
     名称默认「课程名 · 第 N 次课」，老师没改过名称（autoName）的随排课顺序更新。老师另建的课次 source '自建课次'，不带 slotId */
  function syncSessions(st) {
    var changed = false;
    st.plans.forEach(function (p) {
      var slots = (p.slots || []).slice().sort(function (a, b) { return a.start < b.start ? -1 : 1; });
      var cl = st.classes.filter(function (c) { return c.id === p.classId; })[0] || {};
      slots.forEach(function (sl, i) {
        var name = p.course + ' · 第 ' + (i + 1) + ' 次课';
        var c = st.courses.filter(function (x) { return x.planId === p.id && x.slotId === sl.id; })[0];
        // 旧数据：老师按已排时间建的课次，按开始时间认领
        if (!c) { c = st.courses.filter(function (x) { return x.planId === p.id && !x.slotId && x.source !== '补训课次' && x.start === sl.start; })[0]; if (c) { c.slotId = sl.id; c.source = '排课'; changed = true; } }
        if (!c) {
          st.courses.push({ id: uid('CRS'), planId: p.id, slotId: sl.id, source: '排课', autoName: true, name: name, ktask: '', skillIds: [], classIds: [p.classId], major: cl.major || '', term: p.term,
            start: sl.start, end: sl.end, status: '未发布', resIds: [], createdAt: fmt(new Date()), publish: null, submissions: [], feedbacks: [], learn: {} });
          changed = true; return;
        }
        if (c.status !== '已发布') {
          if (c.start !== sl.start || c.end !== sl.end) { c.start = sl.start; c.end = sl.end; changed = true; }
          if (c.autoName && c.name !== name) { c.name = name; changed = true; }
        }
      });
    });
    // 排课删掉了：未发布的课次一起删除
    for (var i = st.courses.length - 1; i >= 0; i--) {
      var c = st.courses[i];
      if (c.source !== '排课' || c.status === '已发布') continue;
      var p = st.plans.filter(function (x) { return x.id === c.planId; })[0];
      if (!p || !(p.slots || []).some(function (sl) { return sl.id === c.slotId; })) { st.courses.splice(i, 1); changed = true; }
    }
    return changed;
  }
  /* ── 课次技能从备课资源自动补上 ──
     课次还没有技能（或技能本来就是从资源补的，skillsFrom '资源'）时，取它关联的备课资源记下的技能；
     老师在「编辑」里改过技能后不再自动变；已发布、补训课次、公共基础课不动。老师确认发布即确认这些技能 */
  function fillSkillsFromRes(st, c) {
    if (!c || c.status === '已发布' || c.remedy) return false;
    var p = st.plans.filter(function (x) { return x.id === c.planId; })[0];
    if (!p || planKind(st, p) === 'public') return false;
    if ((c.skillIds || []).length && c.skillsFrom !== '资源') return false;
    var K = kn(), out = [];
    (c.resIds || []).forEach(function (id) { var r = st.resources.filter(function (x) { return x.id === id; })[0]; ((r && r.skillIds) || []).forEach(function (s) { if (K.skill[s] && out.indexOf(s) < 0) out.push(s); }); });
    c.skillIds = out; c.skillsFrom = out.length ? '资源' : '';
    return true;
  }
  /* ── 学生档案（教务 › 学生管理）──
     edu.students：学号、姓名、班级、学籍状态（在读 / 休学 / 毕业）、所属组织、联系方式、账号是否开通；
     班级的 students（姓名名单）只含在读学生，由 syncRoster 按档案生成，任务发布、学情都读它 */
  function seedStudents(st) {
    var E = st.edu;
    if (E.students) return;
    var by = '超管', at = '2026-08-20 10:30', n = 0, out = [];
    function add(name, classId, status, extra) {
      n++;
      var cl = st.classes.filter(function (c) { return c.id === classId; })[0] || {}, yr = String(cl.gradeId || 'GR2024').slice(2);
      out.push(Object.assign({ id: 'ST' + n, sno: yr + '0101' + ('0' + n).slice(-2), name: name, classId: classId, status: status, orgId: 'ORG-GUIDE-ROOM',
        phone: '139' + String(20260000 + n * 37).slice(-8), idCard: '330102' + (2004 + (n % 3)) + '0' + (1 + n % 9) + '1' + (n % 9) + ('00' + n).slice(-3) + 'X', account: true, by: by, at: at }, extra || {}));
    }
    if (!st.classes.some(function (c) { return c.id === 'CL6'; })) st.classes.push({ id: 'CL6', name: '导游 2023级 1班', major: '导游', majorId: 'M2', gradeId: 'GR2023', status: '启用', desc: '已毕业班级', students: [], by: by, at: '2026-08-20 09:34' });
    st.classes.forEach(function (c) { (c.students || []).forEach(function (nm) { add(nm, c.id, '在读'); }); });
    add('周子墨', 'CL2', '休学', { desc: '2026-09 因病休学一年' });
    add('吴思远', 'CL3', '在读', { account: false });
    add('郑可欣', 'CL3', '在读', { account: false });
    add('钱一凡', 'CL6', '毕业');
    add('冯晓彤', 'CL6', '毕业', { account: false });
    E.students = out;
    syncRoster(st);
  }
  // 班级名单 = 该班在读学生（保留档案顺序）
  function syncRoster(st) {
    st.classes.forEach(function (c) { c.students = st.edu.students.filter(function (s) { return s.classId === c.id && s.status === '在读'; }).map(function (s) { return s.name; }); });
  }
  // 学生是否已有学习记录（已提交的任务、反馈、证据、成长记录）
  function studentHasRecords(st, name) {
    return st.courses.some(function (c) { return (c.submissions || []).some(function (x) { return x.student === name && x.status !== '未提交'; }) || (c.feedbacks || []).some(function (x) { return x.student === name; }); }) ||
      (st.evidence || []).some(function (e) { return e.student === name; }) || !!((st.stuGrowth || {})[name] || []).length;
  }
  /* ── 专业树（层级不限）── */
  function majorOf(E, id) { return E.majors.filter(function (m) { return m.id === id; })[0]; }
  // 从最上层到该节点的链
  function majorChain(E, id) { var out = [], m = majorOf(E, id), guard = 0; while (m && guard++ < 50) { out.unshift(m); m = m.parentId ? majorOf(E, m.parentId) : null; } return out; }
  function majorPath(E, id) { var c = majorChain(E, id); return c.length ? c.map(function (m) { return m.name; }).join(' › ') : ''; }
  function majorTop(E, id) { return majorChain(E, id)[0] || null; }
  // 该节点及其全部下级的 id
  function majorSubIds(E, id) {
    var out = [id], i = 0;
    while (i < out.length) { var p = out[i++]; E.majors.forEach(function (m) { if (m.parentId === p && out.indexOf(m.id) < 0) out.push(m.id); }); }
    return out;
  }
  // 按树的顺序（先序）展开，附带层级 depth
  function majorTree(E) {
    var out = [];
    (function walk(pid, d) { E.majors.filter(function (m) { return (m.parentId || null) === pid; }).forEach(function (m) { out.push({ m: m, depth: d }); walk(m.id, d + 1); }); })(null, 0);
    return out;
  }
  function pad3(n) { return ('00' + n).slice(-3); }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }

  /* ── 期间 ── */
  function periodRange(p) {
    var now = new Date(), a = new Date(now), b = new Date(now);
    if (p === 'week') { var d = (now.getDay() + 6) % 7; a.setDate(now.getDate() - d); a.setHours(0, 0, 0, 0); b = new Date(a); b.setDate(a.getDate() + 7); }
    else if (p === 'month') { a = new Date(now.getFullYear(), now.getMonth(), 1); b = new Date(now.getFullYear(), now.getMonth() + 1, 1); }
    else if (p === 'year') { a = new Date(2026, 8, 1); b = new Date(2027, 7, 1); }
    else { a = new Date(2026, 8, 1); b = new Date(2027, 1, 1); }
    return { a: a, b: b, label: p === 'term' ? TERM + ' 2026-09-01 ~ 2027-01-31' : fmt(a, false) + ' ~ ' + fmt(new Date(b - 864e5), false) };
  }
  function inRange(s, r) { var d = new Date(String(s).replace(' ', 'T')); return d >= r.a && d < r.b; }
  function addGrowth(st, rec) { st.growth.unshift(Object.assign({ id: uid('G'), at: fmt(new Date()) }, rec)); }

  /* ── 轻提示 ── */
  var toastT = 0;
  function toast(msg) {
    var t = document.getElementById('tkToast');
    if (!t) { t = document.createElement('div'); t.id = 'tkToast'; t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, 2200);
  }

  /* ── 抽屉（可叠加） ── */
  var stack = [];
  function drawer(o) {
    var sc = document.createElement('div'); sc.className = 'tdr-scrim';
    var el = document.createElement('div'); el.className = 'tdr'; el.style.width = 'min(' + (o.width || 720) + 'px, 96vw)';
    el.innerHTML = '<div class="tdr-h"><b>' + esc(o.title) + '</b>' + (o.sub ? '<span class="sub">' + esc(o.sub) + '</span>' : '') + (o.tag || '') +
      '<span class="sp"></span><button class="x" type="button" data-tk-close aria-label="关闭">✕</button></div><div class="tdr-b"></div>' + (o.foot ? '<div class="tdr-f"></div>' : '');
    var z = 480 + stack.length * 20; sc.style.zIndex = z; el.style.zIndex = z + 1;   // 后打开的抽屉 / 弹窗叠在上面
    document.body.appendChild(sc); document.body.appendChild(el);
    var api = { el: el, body: el.querySelector('.tdr-b'), foot: el.querySelector('.tdr-f'), close: close, onClose: o.onClose };
    function close() { var i = stack.indexOf(api); if (i >= 0) stack.splice(i, 1); sc.remove(); el.remove(); if (api.onClose) api.onClose(); }
    sc.addEventListener('click', close);
    el.querySelector('[data-tk-close]').addEventListener('click', close);
    if (o.body != null) api.body.innerHTML = o.body;
    if (o.foot) api.foot.innerHTML = o.foot;
    stack.push(api); return api;
  }
  function modal(o) {
    var sc = document.createElement('div'); sc.className = 'tmd-scrim';
    sc.innerHTML = '<div class="tmd" style="width:min(' + (o.width || 560) + 'px,100%)"><div class="tmd-h"><b>' + esc(o.title) + '</b><button class="x" type="button" data-tk-close aria-label="关闭">✕</button></div>' +
      '<div class="tmd-b">' + (o.body || '') + '</div><div class="tmd-f">' + (o.foot || '') + '</div></div>';
    sc.style.zIndex = 480 + stack.length * 20 + 10;
    document.body.appendChild(sc);
    var api = { el: sc, body: sc.querySelector('.tmd-b'), foot: sc.querySelector('.tmd-f'), close: close };
    function close() { var i = stack.indexOf(api); if (i >= 0) stack.splice(i, 1); sc.remove(); }
    sc.addEventListener('click', function (e) { if (e.target === sc) close(); });
    sc.querySelector('[data-tk-close]').addEventListener('click', close);
    stack.push(api); return api;
  }
  function confirmBox(msg, ok) {
    var m = modal({ title: '确认', width: 400, body: '<p style="font-size:13px;margin:4px 0 8px">' + esc(msg) + '</p>', foot: '<button class="btn-s" data-c>取消</button><button class="btn" data-o style="height:32px">确定</button>' });
    m.foot.querySelector('[data-c]').onclick = m.close;
    m.foot.querySelector('[data-o]').onclick = function () { m.close(); ok(); };
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && stack.length) stack[stack.length - 1].close(); });

  /* ── 表单引擎 ──
     字段：{k, label, type:text|number|date|datetime|select|textarea|switch|chips|files, options, req, ai, full, ph, accept, max} */
  function fieldHTML(f, v) {
    var id = 'f_' + f.k, req = f.req ? ' req' : '';
    var head = '<span class="lh"><span class="' + req + '">' + esc(f.label) + '</span><span class="sp"></span>' + (f.ai ? '<button type="button" class="ai-btn" data-ai="' + f.k + '">AI润色</button>' : '') + '</span>';
    var body;
    if (f.type === 'select') body = '<select id="' + id + '" data-f="' + f.k + '"><option value="">请选择</option>' + f.options.map(function (o) { return '<option' + (o === v ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select>';
    else if (f.type === 'textarea') body = '<textarea id="' + id + '" data-f="' + f.k + '" placeholder="' + esc(f.ph || '请输入') + '" maxlength="' + (f.max || 500) + '">' + esc(v || '') + '</textarea>';
    else if (f.type === 'switch') body = '<span class="lh"><button type="button" class="sw" data-f="' + f.k + '" data-sw aria-pressed="' + (!!v) + '"></button><span class="note" style="font-size:12px;color:var(--muted)">' + esc(f.ph || '') + '</span></span>';
    else if (f.type === 'chips') body = '<div class="chips2" data-f="' + f.k + '" data-chips>' + f.options.map(function (o) { return '<button type="button" aria-pressed="' + ((v || []).indexOf(o) >= 0) + '">' + esc(o) + '</button>'; }).join('') + '</div>';
    else if (f.type === 'files') body = '<div data-f="' + f.k + '" data-files><label class="upl">点击上传' + (f.ph ? '，' + esc(f.ph) : '') + '<input type="file" multiple hidden' + (f.accept ? ' accept="' + f.accept + '"' : '') + '></label><div class="flist">' + (v || []).map(fileRow).join('') + '</div></div>';
    else body = '<input id="' + id + '" data-f="' + f.k + '" type="' + (f.type === 'datetime' ? 'datetime-local' : f.type || 'text') + '" value="' + esc(f.type === 'datetime' && v ? String(v).replace(' ', 'T') : v || '') + '" placeholder="' + esc(f.ph || '请输入') + '">';
    return '<div class="ff' + (f.full || f.type === 'textarea' || f.type === 'files' || f.type === 'chips' ? ' full' : '') + '">' + head + body + '</div>';
  }
  function fileRow(x) { return '<div class="fitem" data-file="' + esc(x.name) + '"><span class="fi" style="background:#7f63d8">' + esc((x.name.split('.').pop() || 'F').slice(0, 3).toUpperCase()) + '</span><span class="fn">' + esc(x.name) + '<small>' + esc(x.size || '') + '</small></span><button type="button" class="lk del" data-rmfile>删除</button></div>'; }
  function formHTML(fields, v) { v = v || {}; return '<div class="fgrid">' + fields.map(function (f) { return fieldHTML(f, v[f.k]); }).join('') + '</div>'; }
  function bindForm(root) {
    root.addEventListener('click', function (e) {
      var t;
      if ((t = e.target.closest('[data-sw]'))) { t.setAttribute('aria-pressed', t.getAttribute('aria-pressed') !== 'true'); t.dispatchEvent(new Event('change', { bubbles: true })); return; }
      if ((t = e.target.closest('[data-chips] button'))) { t.setAttribute('aria-pressed', t.getAttribute('aria-pressed') !== 'true'); return; }
      if ((t = e.target.closest('[data-rmfile]'))) { t.closest('.fitem').remove(); return; }
      if ((t = e.target.closest('[data-ai]'))) {
        var ta = root.querySelector('[data-f="' + t.getAttribute('data-ai') + '"]');
        if (!ta.value.trim()) { toast('请先填写内容，再用 AI 润色'); return; }
        ta.value = polish(ta.value); toast('已润色，可继续修改'); return;
      }
    });
    root.addEventListener('change', function (e) {
      if (e.target.type === 'file') {
        var box = e.target.closest('[data-files]').querySelector('.flist');
        [].forEach.call(e.target.files, function (f) { box.insertAdjacentHTML('beforeend', fileRow({ name: f.name, size: f.size > 1048576 ? (f.size / 1048576).toFixed(1) + ' MB' : Math.ceil(f.size / 1024) + ' KB' })); });
        e.target.value = '';
      }
    });
  }
  // 演示用的 AI 润色：整理标点与分句
  function polish(s) {
    var t = s.trim().replace(/\s+/g, ' ').replace(/,/g, '，').replace(/;/g, '；').replace(/([^。！？])$/, '$1。');
    return t.split(/(?<=[。！？])/).map(function (x) { return x.trim(); }).filter(Boolean).join('');
  }
  function readForm(root, fields) {
    var v = {}, bad = [];
    fields.forEach(function (f) {
      var el = root.querySelector('[data-f="' + f.k + '"]'); if (!el) return;
      var val;
      if (f.type === 'switch') val = el.getAttribute('aria-pressed') === 'true';
      else if (f.type === 'chips') val = [].map.call(el.querySelectorAll('button[aria-pressed="true"]'), function (b) { return b.textContent; });
      else if (f.type === 'files') val = [].map.call(el.querySelectorAll('.fitem'), function (x) { return { name: x.getAttribute('data-file'), size: (x.querySelector('small') || {}).textContent || '' }; });
      else val = (el.value || '').trim();
      if (f.type === 'datetime' && val) val = val.replace('T', ' ');
      v[f.k] = val;
      var empty = f.type === 'chips' || f.type === 'files' ? !val.length : f.type === 'switch' ? false : !val;
      if (el.classList) el.classList.toggle('err', !!(f.req && empty));
      if (f.req && empty) bad.push(f.label);
    });
    return { v: v, bad: bad };
  }

  var FT_COLOR = { '课件': '#7f63d8', '教案': '#10b981', '图片': '#0ea5e9', '情景互动游戏': '#f59e0b', '视频': '#ef4444', '文档': '#ef4444', '语音': '#0ea5e9', '文字': '#7f63d8' };
  root.TK = { load: load, save: save, reset: function () { localStorage.removeItem(KEY); }, fmt: fmt, uid: uid, esc: esc, TERM: TERM,
    periodRange: periodRange, inRange: inRange, addGrowth: addGrowth, addStuGrowth: addStuGrowth, STU_STAR: STU_STAR, toast: toast, drawer: drawer, modal: modal, confirm: confirmBox,
    formHTML: formHTML, bindForm: bindForm, readForm: readForm, fileRow: fileRow, FT_COLOR: FT_COLOR,
    PERIODS: PERIODS, periodOf: periodOf,
    kn: kn, skillName: skillName, kpsOf: kpsOf, kpCount: kpCount, kpHTML: kpHTML, kpCrit: kpCrit, kpCritDefault: kpCritDefault, kpCritHTML: kpCritHTML, aiKpMarks: aiKpMarks, itemKps: itemKps, graphSystems: graphSystems, importGks: importGks, planTasks: planTasks, planKind: planKind, planKsId: planKsId, eduCourse: eduCourse, ensureKs: ensureKs,
    syncRoster: syncRoster, syncSessions: syncSessions, fillSkillsFromRes: fillSkillsFromRes, studentHasRecords: studentHasRecords, majorPath: majorPath, majorTop: majorTop, majorSubIds: majorSubIds, majorTree: majorTree, majorChain: majorChain, GRADES: GRADES, genCriteria: genCriteria, overall: overall, addEvidence: addEvidence };
})(window);
