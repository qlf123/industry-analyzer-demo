/* 字典数据（localStorage sysDict.v1）：字典管理页维护，院校基础信息等页面取下拉选项 */
(function (root) {
  'use strict';
  var KEY = 'sysDict.v1';
  function seed() {
    var at = '2026-08-05 16:30', by = '管理员', n = 0;
    function cat(name, en, code, items) {
      var c = { id: 'DC' + (++n), name: name, en: en, code: code, status: '启用', by: by, at: at, items: [] }, k = 0;
      (function add(list, parentId) {
        list.forEach(function (x, i) {
          var it = { id: c.id + '-' + (++k), name: x[0], en: x[1] || '', code: x[2], order: i + 1, status: '启用', start: '', end: '', parentId: parentId, by: by, at: at };
          c.items.push(it); if (x[3]) add(x[3], it.id);
        });
      })(items, '');
      return c;
    }
    return { cats: [
      cat('办学类型', 'School Type', 'DM_BXLX', [['本科', 'Undergraduate', 'BK'], ['高职（专科）', 'Higher Vocational', 'GZ'], ['中职', 'Secondary Vocational', 'ZZ']]),
      cat('办学性质', 'School Nature', 'DM_BXXZ', [['公办', 'Public', 'GB'], ['民办', 'Private', 'MB'], ['中外合作', 'Joint Venture', 'ZWHZ'], ['其他', 'Other', 'QT']]),
      cat('所在地区', 'Region', 'DM_DQ', [['北京市', 'Beijing', '110000', [['北京市', 'Beijing', '110100']]], ['浙江省', 'Zhejiang', '330000', [['杭州市', 'Hangzhou', '330100'], ['宁波市', 'Ningbo', '330200']]], ['广东省', 'Guangdong', '440000', [['广州市', 'Guangzhou', '440100'], ['深圳市', 'Shenzhen', '440300']]], ['四川省', 'Sichuan', '510000', [['成都市', 'Chengdu', '510100']]]]),
      cat('教师职称', 'Title', 'DM_ZC', [['正高级', 'Senior', 'ZGJ'], ['副高级', 'Associate Senior', 'FGJ'], ['中级', 'Intermediate', 'ZJ'], ['初级', 'Junior', 'CJ']]),
      cat('学历', 'Education', 'DM_XL', [['博士', 'Doctor', 'BS'], ['硕士', 'Master', 'SS'], ['本科', 'Bachelor', 'BK'], ['其他', 'Other', 'QT']]),
      cat('课程类型', 'Course Type', 'DM_KCLX', [['公共基础课程', 'General Course', 'GGJCKC'], ['专业基础课程', 'Major Foundation Course', 'ZYJCKC'], ['专业核心课程', 'Major Core Course', 'ZYHXKC'], ['专业拓展课程', 'Major Extension Course', 'ZYTZKC'], ['其他', 'Others', 'QT']]),
      cat('备课资源类型', 'Resource Type', 'DM_ZYLX', [['课件', 'Courseware', 'KJ'], ['教案', 'Lesson Plan', 'JA'], ['图片', 'Image', 'TP'], ['视频', 'Video', 'SP'], ['情景互动游戏', 'Scenario Game', 'QJYX']]),
      cat('学籍状态', 'Student Status', 'DM_XJZT', [['在读', 'Enrolled', 'ZD'], ['休学', 'Suspended', 'XX'], ['毕业', 'Graduated', 'BY']])
    ] };
  }
  function save(D) { try { localStorage.setItem(KEY, JSON.stringify(D)); } catch (e) {} }
  function load() {
    var D; try { D = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
    if (!D || !D.cats) { D = seed(); save(D); }
    return D;
  }
  function today() { var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }
  function usable(it) { var d = today(); return it.status === '启用' && (!it.start || it.start <= d) && (!it.end || it.end > d); }
  // 某分类下可选的字典项（启用且在有效期内）；parentName 指定时取该上级的下级，否则取顶层
  function opts(code, parentName) {
    var c = load().cats.filter(function (x) { return x.code === code; })[0];
    if (!c || c.status !== '启用') return [];
    var pid = '';
    if (parentName) { var p = c.items.filter(function (x) { return !x.parentId && x.name === parentName; })[0]; if (!p) return []; pid = p.id; }
    return c.items.filter(function (x) { return x.parentId === pid && usable(x); }).sort(function (a, b) { return a.order - b.order; }).map(function (x) { return x.name; });
  }
  root.SysDict = { KEY: KEY, load: load, save: save, opts: opts };
})(window);
