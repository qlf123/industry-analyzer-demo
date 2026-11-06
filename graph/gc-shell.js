/* 图谱中心 · 外壳
 * 图谱平台页面迁入后共用 ../js/common.js 的左侧菜单；页面间跳转带上当前身份与端。
 * 教师端：可以新建能力图谱 / 知识体系 / 知识库，自己创建的可维护，他人创建的仅查看；
 *         知识图谱的映射任务只读（隐藏规则见 gc-shell.css），映射审核不开放。
 */
window.GC = (function () {
  'use strict';
  var portal = '';
  var userName = '';

  function url(href) { return UI.link(href, portal); }
  function teacher() { return portal === 'teacher'; }

  /* 图谱平台的「当前用户」：管理端=平台管理员；教师端=当前登录的老师 */
  function platformUser(USERS) {
    if (!teacher()) return USERS.admin;
    var u = {};
    Object.keys(USERS.teacher).forEach(function (k) { u[k] = USERS.teacher[k]; });
    u.name = userName || u.name;
    return u;
  }

  /* 图谱页面里记录「谁做的」统一用当前登录人：管理端=平台管理员，教师端=老师本人 */
  function me() { return teacher() ? (userName || '教师') : '平台管理员'; }

  function readonly() { document.documentElement.classList.add('gc-ro'); }

  /* 详情页：教师打开的不是自己创建的图谱 / 知识体系时只读 */
  function ownerOf(key) {
    var id = new URLSearchParams(location.search).get('id');
    try {
      if (key === 'gc-ag') {
        var g = (typeof graphs !== 'undefined' ? graphs : []).find(function (x) { return x.id === id; });
        return g ? (g.creator || '平台管理员') : '平台管理员';
      }
      if (key === 'gc-kb') return sessionStorage.getItem('gc_kb_owner_' + id) || '平台管理员';
      if (key === 'gc-ks') {
        var list = JSON.parse(sessionStorage.getItem('ks_systems_v2') || '[]');
        var s = list.find(function (x) { return x.id === id; });
        return s ? (s.creator || '平台管理员') : '平台管理员';
      }
    } catch (e) {}
    return '平台管理员';
  }

  function boot(key) {
    UI.boot({ portal: 'auto', active: key, base: '../' });
    portal = UI.portal();
    try {
      var iden = UI.currentIdentity(DEMO.getState());
      userName = iden.account ? iden.account.name : '';
    } catch (e) {}
    if (teacher()) {
      if (key === 'gc-mr') { location.replace(url('knowledge-graph.html')); return; }
      var page = location.pathname.split('/').pop();
      if (key === 'gc-kg' && page === 'knowledge-graph.html') readonly();
      if (page === 'ability-graph-tree.html' || page === 'knowledge-system-detail.html' || page === 'knowledge-base-detail.html') {
        document.addEventListener('DOMContentLoaded', function () {
          if (ownerOf(key) !== userName) readonly();
        });
      }
    }
    // 页面内的站内链接（含动态生成的）点击时补上身份与端
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href]');
      if (!a) return;
      var h = a.getAttribute('href');
      if (!h || /^(#|[a-z]+:|\/|\.\.\/)/i.test(h) || /[?&]u=/.test(h) || !/\.html(\?|#|$)/.test(h)) return;
      a.setAttribute('href', url(h));
    }, true);
  }

  return { boot: boot, url: url, teacher: teacher, me: me, platformUser: platformUser };
}());
