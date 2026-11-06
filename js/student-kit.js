/* 学生端业务页共用（我的任务 / 学生成长中心）
   和教师端共用一份 mock 数据（teacher-kit.js 的 teacherDemo），学生看到的「任务」就是老师已发布、发给本人所在班级的课程：
   学生提交 → 教师端「情景任务评价」可评；老师评价 / 退回 → 学生端可见；学习资源、课程反馈同理。
   抽屉 / 弹窗 / 轻提示沿用 TK，页面需先引入 teacher-kit.js */
(function (root) {
  'use strict';
  var STAR = TK.STU_STAR;
  var GTYPES = ['学习资源', '提交任务', '老师评价', '课程反馈'];

  function me() { try { return UI.currentIdentity(DEMO.getState()).account.name; } catch (e) { return ''; } }
  function cls(S, id) { return S.classes.find(function (c) { return c.id === id; }); }
  function mine(S, c, who) { return c.status === '已发布' && c.publish && (!c.targets || c.targets.indexOf(who) >= 0) && c.publish.classIds.some(function (id) { return ((cls(S, id) || {}).students || []).indexOf(who) >= 0; }); }

  /* 教师端的一条提交记录 → 学生看到的「第 n 次提交」 */
  function attempt(x, n) {
    var te = x.teacher, back = te && te.result === '退回修改';
    return { n: n, at: x.at, late: !!x.late, items: x.files,
      returned: back ? { at: te.at || '', reason: te.comment || '请修改后重新提交' } : null,
      eval: te && !back ? { grade: te.grade, comment: te.comment, at: te.at || '', items: te.items || [] } : null, grades: te ? te.items || [] : [] };
  }
  function taskView(S, c, who) {
    var p = c.publish, sub = p.task && p.task.on ? c.submissions.find(function (x) { return x.student === who; }) : null, learn = (c.learn || {})[who] || {};
    var files = [];
    c.resIds.forEach(function (rid) {
      var r = S.resources.find(function (x) { return x.id === rid; }); if (!r) return;
      r.files.forEach(function (f) { if (p.fileIds.indexOf(f.id) >= 0) files.push({ id: f.id, type: f.type, name: f.name, size: f.size, pack: r.name, learnedAt: learn[f.id] || '' }); });
    });
    var subs = [];
    if (sub) { (sub.history || []).forEach(function (h, i) { subs.push(attempt(h, i + 1)); }); if (sub.at) subs.push(attempt(sub, subs.length + 1)); }
    var st = !sub ? '' : sub.status === '已提交' ? '已提交' : sub.status === '已退回' ? '已退回' : sub.status === '已评分' ? '已评价' : '待提交';
    var fb = c.feedbacks.find(function (f) { return f.student === who; });
    if (fb && !fb.overall) fb = Object.assign({ overall: Math.round((fb.scores['讲授内容'] + fb.scores['教学方式'] + fb.scores['互动体验'] + fb.scores['学习收获']) / 4), tags: [] }, fb);
    var pl = (S.plans || []).find(function (x) { return x.id === c.planId; });
    return { id: c.id, course: c.name, plan: pl ? pl.course : '', major: c.major, teacher: (pl && pl.teacher) || S.teacher || '老师', publishAt: p.at, due: sub ? p.task.due : '', status: st,
      task: sub ? { name: p.task.name, desc: p.task.desc, modes: p.task.modes, criteria: p.task.criteria || [], skillIds: p.task.skillIds || [] } : null, files: files, submissions: subs,
      evalSeen: !sub || sub.evalSeen !== false, feedbackOn: !!p.feedback, feedback: fb || null };
  }
  /* 当前学生的视图：{ name, klass, tasks, growth } */
  function view() {
    var S = TK.load(), who = me();
    var k = S.classes.find(function (c) { return c.students.indexOf(who) >= 0; });
    return { name: who, klass: k ? k.name : '', tasks: S.courses.filter(function (c) { return mine(S, c, who); }).map(function (c) { return taskView(S, c, who); }),
      growth: (S.stuGrowth[who] || []).slice(), skills: skillView(S, who), kps: kpView(S, who) };
  }

  /* 技能达成：只看老师确认通过的证据，单个技能按最近一次证据判断（需改进 = 未达成）；
     能力经已确认的能力—技能映射汇总，显示「支撑技能几个、已达成几个」，支撑技能只算已开课程 */
  function skillView(S, who) {
    var K = TK.kn(), last = {}, hist = {};
    (S.evidence || []).forEach(function (e) {
      if (e.student !== who) return;
      (hist[e.sid] = hist[e.sid] || []).push(e);
      if (!last[e.sid] || e.at >= last[e.sid].at) last[e.sid] = e;   // 证据按时间先后追加，同一分钟内取后记的
    });
    var list = Object.keys(last).map(function (sid) {
      var e = last[sid], c = S.courses.find(function (x) { return x.id === e.tid; }) || {}, pl = (S.plans || []).find(function (x) { return x.id === e.planId; }) || {};
      return { sid: sid, name: TK.skillName(sid), grade: e.grade, ok: e.grade !== '需改进', at: e.at, tid: e.tid, session: c.name || '', course: pl.course || '', times: hist[sid].length };
    }).sort(function (a, b) { return a.at < b.at ? 1 : -1; });
    // 支撑技能只算本人已开课程（所在班级的课程计划）里的技能
    var k = S.classes.find(function (c) { return c.students.indexOf(who) >= 0; }) || {};
    var opened = (S.plans || []).filter(function (pl) { return pl.classId === k.id; }).map(function (pl) { return pl.courseId; });
    var inOpened = function (sid) { var x = K.skill[sid], t = x && K.task[x.taskId]; return !!t && opened.indexOf(t.courseId) >= 0; };
    var abl = {};
    list.forEach(function (x) { (K.map[x.sid] || []).forEach(function (m) { abl[m.abl] = abl[m.abl] || { id: m.abl, name: (K.abl[m.abl] || {}).name || m.abl }; }); });
    var abls = Object.keys(abl).map(function (id) {
      var sup = Object.keys(K.map).filter(function (sid) { return inOpened(sid) && K.map[sid].some(function (m) { return m.abl === id; }); });
      var got = sup.filter(function (sid) { return last[sid] && last[sid].grade !== '需改进'; });
      return { id: id, name: abl[id].name, total: sup.length, ok: got.length, evd: sup.filter(function (sid) { return last[sid]; }).map(TK.skillName) };
    }).sort(function (a, b) { return b.ok / b.total - a.ok / a.total; });
    return { list: list, abls: abls };
  }

  /* 知识点掌握统计（学生端）：与老师端学情口径一致——
     按每个技能取本人最近一次老师确认的评价（含退回的那次），看技能下各知识点是否体现；
     只用于学习参考，不进证据、不汇总到技能达成 */
  function kpView(S, who) {
    var K = TK.kn(), last = {};
    S.courses.forEach(function (c) {
      if (!mine(S, c, who) || !c.publish.task) return;
      (c.submissions || []).forEach(function (sb) {
        if (sb.student !== who || !sb.teacher) return;
        (sb.teacher.items || []).forEach(function (it) {
          var ks = ((K.skill[it.sid] || {}).kps) || []; if (!ks.length) return;
          if (!last[it.sid] || sb.teacher.at >= last[it.sid].at)
            last[it.sid] = { at: sb.teacher.at, marks: TK.itemKps(it, who), tid: c.id, task: c.publish.task.name, course: c.name };
        });
      });
    });
    var list = Object.keys(last).map(function (sid) {
      var x = K.skill[sid], l = last[sid];
      var kps = x.kps.map(function (k) { return { id: k.id, name: k.name, type: k.type, core: k.core, miss: l.marks[k.id] === 'miss' }; });
      return { sid: sid, name: x.name, kps: kps, ok: kps.filter(function (k) { return !k.miss; }).length, miss: kps.filter(function (k) { return k.miss; }).length,
        at: l.at, tid: l.tid, task: l.task, course: l.course };
    }).sort(function (a, b) { return a.at < b.at ? 1 : -1; });
    var all = list.reduce(function (a, x) { return a.concat(x.kps); }, []);
    return { list: list, total: all.length, ok: all.filter(function (k) { return !k.miss; }).length, miss: all.filter(function (k) { return k.miss; }).length };
  }

  /* ── 学生操作（写回共用数据） ── */
  function edit(cid, fn) { var S = TK.load(), c = S.courses.find(function (x) { return x.id === cid; }), r = fn(S, c, me()); TK.save(S); return r; }
  function learn(cid, fid, name) {
    return edit(cid, function (S, c, who) {
      c.learn = c.learn || {}; var m = c.learn[who] = c.learn[who] || {};
      if (m[fid]) return false;
      m[fid] = TK.fmt(new Date());
      TK.addStuGrowth(S, who, { type: '学习资源', target: name, desc: '学习资源完成', stars: STAR.learn, tid: cid });
      return true;
    });
  }
  // 演示用 AI 初评：按提交内容是否完整，逐项给出等级，供老师在教师端确认或修改
  var AI_REASON = { '合格': '基本做到，细节和依据还需完善。', '需改进': '提交内容中没有体现该项要求。' };
  function mockAi(items, modes, crit, who) {
    var types = items.map(function (x) { return x.type; }).filter(function (t, i, a) { return a.indexOf(t) === i; });
    var txt = items.filter(function (x) { return x.type === '文字'; }).map(function (x) { return x.text; }).join('');
    var full = items.length >= 2 || txt.length >= 50;
    var per = (crit || []).map(function (x, i) {
      var g = full || i === 0 ? '合格' : '需改进', kps = TK.aiKpMarks(x.sid, g, who || ''), miss = (TK.kn().skill[x.sid] || { kps: [] }).kps.filter(function (k) { return kps[k.id] === 'miss'; }).map(function (k) { return k.name; });
      return { sid: x.sid, grade: g, reason: AI_REASON[g] + (miss.length ? '没有体现：' + miss.join('、') + '。' : ''), kps: kps };
    });
    return { result: per.length ? TK.overall(per) : full ? '合格' : '需改进', items: per, summary: '提交了' + types.join('、') + '，共 ' + items.length + ' 项内容。',
      highlights: full ? '内容覆盖了任务要求的主要方面，结构比较完整。' : '按时提交，结论明确。',
      problems: full ? '部分分析缺少数据来源。' : '内容较少，缺少分析过程' + (modes.length > types.length ? '，未使用' + modes.filter(function (m) { return types.indexOf(m) < 0; }).join('、') + '等形式补充' : '') + '。',
      advice: full ? '补充关键数据的来源，结论部分再精炼一些。' : '对照任务说明补充分析过程与依据。' };
  }
  function submit(cid, items) {
    return edit(cid, function (S, c, who) {
      var sub = c.submissions.find(function (x) { return x.student === who; }), t = c.publish.task, late = t.due < TK.fmt(new Date());
      var first = !sub.at;
      if (!first) { sub.history = sub.history || []; sub.history.push({ at: sub.at, late: !!sub.late, files: sub.files, teacher: sub.teacher }); }
      Object.assign(sub, { status: '已提交', at: TK.fmt(new Date()), late: late, files: items, modes: items.map(function (x) { return x.type; }).filter(function (m, i, a) { return a.indexOf(m) === i; }), teacher: null, ai: t.ai ? mockAi(items, t.modes, t.criteria, who) : null, evalSeen: true });
      // 成长星只记第一次提交，退回后重新提交不重复计
      var stars = first ? (late ? STAR.submitLate : STAR.submit) : 0;
      if (first) TK.addStuGrowth(S, who, { type: '提交任务', target: t.name, desc: late ? '超时提交情景任务' : '正常提交情景任务', stars: stars, tid: cid });
      return { first: first, stars: stars };
    });
  }
  function feedback(cid, v) {
    edit(cid, function (S, c, who) {
      c.feedbacks.push({ student: who, at: TK.fmt(new Date()), overall: v.overall, scores: v.scores, tags: v.tags, text: v.text, read: false });
      TK.addStuGrowth(S, who, { type: '课程反馈', target: c.name, desc: '提交课程反馈', stars: STAR.feedback, tid: cid });
    });
  }
  function seen(cid) { edit(cid, function (S, c, who) { var s = c.submissions.find(function (x) { return x.student === who; }); if (s) s.evalSeen = true; }); }

  /* ── 期间（可前后翻：off=-1 上一期） ── */
  var PNAME = { week: '周', month: '月', term: '学期', year: '学年' };
  function periodRange(p, off) {
    off = off || 0;
    var now = new Date(), fmt = TK.fmt, a, b, label;
    if (p === 'week') { a = new Date(now); a.setDate(now.getDate() - (now.getDay() + 6) % 7 + off * 7); a.setHours(0, 0, 0, 0); b = new Date(a); b.setDate(a.getDate() + 7); }
    else if (p === 'month') { a = new Date(now.getFullYear(), now.getMonth() + off, 1); b = new Date(a.getFullYear(), a.getMonth() + 1, 1); }
    else if (p === 'year') { var y0 = (now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1) + off; a = new Date(y0, 8, 1); b = new Date(y0 + 1, 8, 1); label = y0 + '-' + (y0 + 1) + ' 学年'; }
    else {
      // 第一学期 9/1–1/31，第二学期 2/1–8/31
      var y = now.getFullYear(), m = now.getMonth(), idx = m >= 8 ? y * 2 : m >= 1 ? (y - 1) * 2 + 1 : (y - 1) * 2;
      idx += off; var sy = Math.floor(idx / 2), second = idx % 2 === 1;
      a = second ? new Date(sy + 1, 1, 1) : new Date(sy, 8, 1); b = second ? new Date(sy + 1, 8, 1) : new Date(sy + 1, 1, 1);
      label = sy + '-' + (sy + 1) + (second ? ' 第二学期' : ' 第一学期');
    }
    var span = fmt(a, false) + ' ~ ' + fmt(new Date(b - 864e5), false);
    return { a: a, b: b, label: label ? label + ' (' + span + ')' : span, unit: PNAME[p] };
  }

  /* ── 任务状态派生 ── */
  function overdue(t) { return !!t.due && t.due < TK.fmt(new Date()); }
  function soon(t) { if (!t.due) return false; var d = new Date(t.due.replace(' ', 'T')) - Date.now(); return d > 0 && d <= 24 * 3600e3; }
  function canSubmit(t) { return !!t.task && (t.status === '待提交' || t.status === '已退回'); }
  function learned(t) { return t.files.filter(function (f) { return f.learnedAt; }).length; }
  function maxStars(t) { return t.files.length * STAR.learn + (t.task ? STAR.submit + STAR.grade['优秀'] : 0) + (t.feedbackOn ? STAR.feedback : 0); }

  root.SK = { view: view, learn: learn, submit: submit, feedback: feedback, seen: seen, periodRange: periodRange, kpView: kpView,
    STAR: STAR, GTYPES: GTYPES, maxStars: maxStars, overdue: overdue, soon: soon, canSubmit: canSubmit, learned: learned,
    GCOL: { '学习资源': '#6366f1', '提交任务': '#10b981', '老师评价': '#f59e0b', '课程反馈': '#8b5cf6' } };
})(window);
