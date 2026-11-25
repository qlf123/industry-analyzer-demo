/* 备课资源 ↔ 知识库：统一资源读适配层
 * 一套文件实体（teacherDemo.v1 的 S.resources[].files），两个使用场景视图：
 *   - 备课视图： teacher-tasks.html 的 resList（文件平铺 + 技能/知识点 + 课次发布）
 *   - 知识视图： graph/knowledge-base-detail.html 的 DOCS（分段 / 索引 / 召回）
 * P0：知识库读取带 kbOn 标记的备课文件；P1：两个方向各一个入口，避免重复上传。
 * 不新建存储、不改发布/学情口径；只操作文件上的知识属性字段。
 */
(function (root) {
  'use strict';
  var KEY = 'teacherDemo.v1';
  var CAT = { '课件': 'text', '教案': 'text', '图片': 'image', '视频': 'av', '情景互动游戏': 'av' };
  var STATUS = { available: 1, indexing: 1, queuing: 1, waiting: 1, unavailable: 1, error: 1 };

  function uid(p) { return (p || 'X') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function now() { var d = new Date(), p = function (n) { return n < 10 ? '0' + n : '' + n; }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); }
  function ensure(f) {
    if (!f) return f;
    if (typeof f.kbOn !== 'boolean') f.kbOn = false;
    if (!f.kbStatus || !STATUS[f.kbStatus]) f.kbStatus = 'waiting';
    if (!f.kbCat) f.kbCat = CAT[f.type] || 'text';
    if (!Array.isArray(f.kbTags)) f.kbTags = [];
    if (!Array.isArray(f.kbSegs)) f.kbSegs = [];
    if (typeof f.kbHits !== 'number') f.kbHits = 0;
    if (!Array.isArray(f.kbSharedTo)) f.kbSharedTo = [];
    if (!f.kbDocId) f.kbDocId = '';
    return f;
  }
  function load() {
    var st = null;
    try { st = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; }
    if (!st || !Array.isArray(st.resources)) return null;
    (st.resources || []).forEach(function (r) { (r.files || []).forEach(ensure); });
    return st;
  }
  function save(st) { try { localStorage.setItem(KEY, JSON.stringify(st)); return true; } catch (e) { return false; } }
  function ext(f) { return String(f.name || '').split('.').pop().toUpperCase(); }
  function typeOfExt(e) {
    e = String(e || '').toLowerCase();
    if (/^(ppt|pptx|key)$/.test(e)) return '课件';
    if (/^(png|jpg|jpeg|gif|webp|svg)$/.test(e)) return '图片';
    if (/^(mp4|mov|avi|mkv)$/.test(e)) return '视频';
    if (/^(html|htm|zip)$/.test(e)) return '情景互动游戏';
    return '教案';
  }
  function segsOf(f) {
    var raw = Array.isArray(f.kbSegs) && f.kbSegs.length ? f.kbSegs : [String(f.name || '资源') + '：来自备课资源，待解析分段。'];
    if (f.kbCat === 'av') return raw.map(function (x, i) { return Array.isArray(x) ? x : [i * 60, (i + 1) * 60, '', String(x)]; });
    return raw.map(String);
  }
  /* 知识视图读取：把标记了 kbOn 的备课文件映射成知识库文档结构 */
  function teacherDocs() {
    var st = load(), out = [];
    if (!st) return out;
    st.resources.forEach(function (r) {
      (r.files || []).forEach(function (f) {
        ensure(f);
        if (!f.kbOn) return;
        var segs = segsOf(f), n = f.kbCat === 'text' ? segs.length : 0;
        out.push({
          id: 'kbres_' + f.id, teacherFileId: f.id, teacherResId: r.id, kbDocId: f.kbDocId || '',
          name: f.name, ext: ext(f), cat: f.kbCat || 'text', media: f.kbCat === 'av' ? 'video' : '', size: f.size || '',
          status: f.kbStatus, source: f.kbDocId ? 'web' : 'local', time: r.createdAt || now(),
          hits: f.kbHits || 0, segs: segs, pageCount: n, pages: segs.map(function (_, i) { return Math.floor(i / 2) + 1; }),
          tags: (f.kbTags || []).slice(), ocr: f.kbOcr || '', sec: f.kbSec || 60,
          desc: '来自备课资源：' + (r.name || '独立资源'), fromTeacher: true, owner: r.owner || ''
        });
      });
    });
    return out;
  }
  /* 备课 → 知识库：只加标记，不搬文件、不复制存储 */
  function pushToKb(resId, fileId) {
    var st = load(); if (!st) return { ok: false, reason: 'no-state' };
    var r = st.resources.filter(function (x) { return x.id === resId; })[0];
    var f = r && (r.files || []).filter(function (x) { return x.id === fileId; })[0];
    if (!f) return { ok: false, reason: 'not-found' };
    ensure(f);
    if (f.kbOn) return { ok: false, reason: 'exists', file: f };
    f.kbOn = true; f.kbStatus = 'waiting';
    if (!f.kbSegs.length) f.kbSegs = [String(f.name) + '：来自备课资源，待解析分段。'];
    if (!f.kbTags.length) f.kbTags = ['备课资源'];
    return { ok: save(st), file: f };
  }
  /* 备课资源（资料库）全部文件：供知识库选择数据来源 */
  function libraryFiles() {
    var st = load(), out = [];
    if (!st) return out;
    st.resources.forEach(function (r) {
      (r.files || []).forEach(function (f) {
        ensure(f);
        out.push({ resId: r.id, fileId: f.id, name: f.name, ext: ext(f), size: f.size || '', type: f.type || '',
          resName: r.name || '', owner: r.owner || '', source: r.source || '', kbOn: !!f.kbOn });
      });
    });
    return out;
  }
  function removeFromKb(fileId) {
    var st = load(); if (!st) return false;
    var f = null;
    st.resources.some(function (r) { f = (r.files || []).filter(function (x) { return x.id === fileId; })[0]; return !!f; });
    if (!f || !f.kbOn) return false;
    f.kbOn = false; f.kbStatus = 'waiting';
    return save(st);
  }
  /* 知识库 → 备课：作为独立文件加入资源列表；技能/知识点留空，等老师标注；已加过则直接返回 */
  function pullFromKb(doc, owner) {
    var st = load(); if (!st) return { ok: false, reason: 'no-state' };
    var hit = null;
    st.resources.some(function (r) { hit = (r.files || []).filter(function (x) { return x.kbDocId === doc.id; })[0]; return !!hit; });
    if (hit) return { ok: false, reason: 'exists', file: hit };
    var f = { id: uid('F'), type: typeOfExt(doc.ext || doc.name), name: doc.name, size: doc.size || '', url: '', skillIds: [], kpIds: [] };
    ensure(f);
    f.kbOn = true; f.kbStatus = doc.status === 'available' ? 'available' : 'waiting';
    f.kbCat = doc.cat || f.kbCat;
    f.kbHits = doc.hits || 0;
    f.kbDocId = doc.id;
    f.kbTags = (doc.tags || []).slice();
    f.kbSegs = Array.isArray(doc.segs) ? doc.segs.map(function (x) { return Array.isArray(x) ? x[3] : x; }).filter(Boolean) : [];
    var rec = { id: uid('RES'), name: '', status: '已完成', source: '知识库', createdAt: now(), owner: owner || '李老师', course: '', skillIds: [], kpIds: [], knowledge: '', files: [f] };
    st.resources.unshift(rec);
    return { ok: save(st), file: f, resource: rec };
  }
  function hasTeacherCopy(docId) {
    var st = load(); if (!st) return false;
    return st.resources.some(function (r) { return (r.files || []).some(function (f) { return f.kbDocId === docId; }); });
  }
  root.ResourceBridge = { ensure: ensure, load: load, save: save, teacherDocs: teacherDocs, libraryFiles: libraryFiles, pushToKb: pushToKb, removeFromKb: removeFromKb, pullFromKb: pullFromKb, hasTeacherCopy: hasTeacherCopy };
})(window);
