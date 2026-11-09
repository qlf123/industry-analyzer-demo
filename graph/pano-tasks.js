/* 全景图谱列表（知识图谱 → 全景图谱 与 能力地图共用）：映射任务按行业汇总成卡片，「全部」固定在最前。
 * 数据存 localStorage（kg_tasks_v7），两个页面读同一份，看到的列表和名称一致；跨 tab 不会各自播种出不一致的数据。 */
(function (root) {
  'use strict';
  /* 只保留有能力地图数据的行业：能力地图下拉列「映射完成」的行业（kmap_template.html），
     其他行业映射完成了也没有能力地图内容，列出会导致两页数量对不上（全景图谱 6 个 vs 能力地图 1 个）。 */
  var KEY = 'kg_tasks_v7';
  var SEED = [
          {id:'T001',name:'旅游管理-能力图谱映射',graph:'旅游行业能力图谱 V1.0',industry:'旅游业',majors:[{name:'旅游管理专业知识体系 V1.0',scope:'专业'}],graphScope:'行业',status:'done',creator:'张明',createdAt:'2026-09-18 10:30'},
          {id:'T002',name:'酒店管理-能力图谱映射',graph:'旅游行业能力图谱 V1.0',industry:'旅游业',majors:[{name:'酒店管理专业知识体系 V1.0',scope:'专业大类'}],graphScope:'行业',status:'done',creator:'张明',createdAt:'2026-09-19 14:20'},
          {id:'T008',name:'学前教育-能力图谱映射',graph:'教育行业能力图谱 V1.0',industry:'教育业',majors:[{name:'学前教育专业知识体系 V1.0',scope:'专业'}],graphScope:'行业',status:'generating',creator:'赵琳',createdAt:'2026-09-23 14:00'},
          {id:'T009',name:'新媒体运营-能力图谱映射',graph:'传媒行业能力图谱 V1.0',industry:'传媒业',majors:[{name:'新媒体运营课程知识体系 V1.0',scope:'课程'}],graphScope:'行业',status:'failed',creator:'张明',createdAt:'2026-09-23 16:00'},
          {id:'T010',name:'智慧农业-能力图谱映射',graph:'农业行业能力图谱 V1.0',industry:'农业',majors:[{name:'智慧农业专业知识体系 V1.0',scope:'专业'}],graphScope:'行业',status:'failed',creator:'王强',createdAt:'2026-09-24 09:30'}
        ];
  function load() {
    var t = [];
    try { t = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { t = []; }
    if (!t.length) { t = JSON.parse(JSON.stringify(SEED)); try { localStorage.setItem(KEY, JSON.stringify(t)); } catch (e) {} }
    return t;
  }
  function save(tasks) { try { localStorage.setItem(KEY, JSON.stringify(tasks)); } catch (e) {} }
  // 行业卡片：同一行业的映射任务汇总，状态取最近一次；顺序与全景图谱页一致（映射完成 → 映射中 → 映射失败）
  function industries(tasks) {
    tasks = tasks || load();
    var map = {}, order = { done: 0, generating: 1, failed: 2 };
    tasks.forEach(function (t) {
      if (!t.industry) return;
      var g = map[t.industry] || (map[t.industry] = { industry: t.industry, graph: t.graph, tasks: [], latestTime: '', latestStatus: t.status });
      g.tasks.push(t);
      if (t.createdAt >= g.latestTime) { g.latestTime = t.createdAt; g.latestStatus = t.status; }
    });
    return Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) { return (order[a.latestStatus] || 3) - (order[b.latestStatus] || 3); });
  }
  root.PanoTasks = { KEY: KEY, SEED: SEED, load: load, save: save, industries: industries };
})(window);
