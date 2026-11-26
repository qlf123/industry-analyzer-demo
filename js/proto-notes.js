/* 原型标注（2026-11-26）：给研发看的实现状态说明，不参与业务功能。
   展示方式：标注贴在目标位置本身（模块标题、操作按钮旁），不遮挡页面内容；
   右下角只保留全局「标注」开关，状态存本地，开一次全站生效。
   汇总页：proto-notes.html　维护：只改下面的 NOTES，不要改业务页面。 */
(function (root) {
  'use strict';

  var STATUS = {
    done: { t: '本期实现', c: '#059669', bg: '#d1fae5' },
    doing: { t: '实现中', c: '#1d4ed8', bg: '#dbeafe' },
    design: { t: '设计中', c: '#b45309', bg: '#fef3c7' },
    off: { t: '本期不做', c: '#6b7280', bg: '#f3f4f6' }
  };
  var RULE = { t: '规则', c: '#1e40af', bg: '#e0e7ff' };

  /* ── 标注清单（唯一维护处）──
     page：页面文件名；target：徽标贴靠的目标元素选择器（模块标题、按钮等）；
     where：默认插在目标元素后面，'prepend' 表示插到目标容器内部最前面（用于没有标题的页面）；
     status：done / doing / design / off；prio：P0 / P1 / P2；note：一句话说明（研发视角） */
  var NOTES = [
    {
      page: 'teacher-growth.html', portal: '教师端', module: '教师成长中心', target: '.tk-h h2',
      status: 'design', prio: 'P1', open: 'teacher-growth.html?u=ACC-HE&pn=1',
      note: '整个模块处于设计阶段：页面内容只示意信息结构与交互，具体口径（成长星、教研贡献、统计周期）待 PRD 评审后确定，暂不进入开发排期。'
    },
    {
      page: 'student-growth.html', portal: '学生端', module: '学生成长中心', target: '.top .sp',
      status: 'design', prio: 'P1', open: 'student-growth.html?u=ACC-STU&pn=1',
      note: '整个模块处于设计阶段：成长星、技能达成、知识点掌握等展示方式仅示意，统计口径与激励规则待定，暂不进入开发排期。'
    },
    {
      page: 'workbench.html', portal: '教师端', module: '工作台', target: '.wb', where: 'prepend',
      status: 'design', prio: 'P1', open: 'workbench.html?u=ACC-HE&pn=1',
      note: '整个模块处于设计阶段：首页发起、任务过程、资源包结果的信息结构与交互仅为示意，待 PRD 评审后确定，暂不进入开发排期。'
    },
    {
      page: 'workbench.html', portal: '教师端', module: '工作台 · 任务列表', target: '#lnav .ltasks .lth', where: 'append',
      status: 'design', prio: 'P1', open: 'workbench.html?u=ACC-HE&pn=1',
      note: '任务列表处于设计阶段：任务分组、状态与置顶/重命名等操作口径待定，当前仅示意位置与信息密度。'
    },
    {
      page: 'teacher-growth.html', portal: '教师端', module: '教师成长中心 · 成长值概览', target: '.big .k', where: 'append', kind: 'rule',
      title: '成长星计算口径', prd: 'PRD 成长值规则（章节待补）', open: 'teacher-growth.html?u=ACC-HE&pn=1',
      items: [
        '计星行为共五类：备课、发布学习内容、评价学生任务、学生课程反馈、教研贡献，分别计入对应维度。',
        '成长星按行为发生时间归入所选统计周期（本周 / 本月 / 本学期 / 本学年），切换周期只改统计范围，不改历史记录。',
        '教研贡献只统计本人提交的记录，他人提交不计入个人成长星。'
      ]
    }
  ];

  var KEY = 'protoNotes.on';
  var POS_KEY = 'protoNotes.pos';

  function loadPos() {
    try {
      var s = localStorage.getItem(POS_KEY);
      if (!s) return null;
      var p = JSON.parse(s);
      if (typeof p.left === 'number' && typeof p.top === 'number') return p;
    } catch (e) {}
    return null;
  }
  function savePos(left, top) {
    try { localStorage.setItem(POS_KEY, JSON.stringify({ left: left, top: top })); } catch (e) {}
  }
  function applyPos(btn, p) {
    if (p) {
      btn.style.right = 'auto';
      btn.style.bottom = 'auto';
      btn.style.left = p.left + 'px';
      btn.style.top = p.top + 'px';
    }
  }
  function clampPos(btn, left, top) {
    var w = btn.offsetWidth || 120, h = btn.offsetHeight || 34;
    var maxL = window.innerWidth - w - 4;
    var maxT = window.innerHeight - h - 4;
    return { left: Math.max(4, Math.min(left, maxL)), top: Math.max(4, Math.min(top, maxT)) };
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function file() { var a = location.pathname.split('/'); return a[a.length - 1] || 'index.html'; }
  function notesOf(f) { return NOTES.filter(function (n) { return n.page === f; }); }
  function inSub() { return location.pathname.indexOf('/platform/') >= 0 || location.pathname.indexOf('/graph/') >= 0; }
  function st(n) { return STATUS[n.status] || STATUS.design; }

  var CSS = '' +
    '.pn-toggle{position:fixed;right:16px;bottom:16px;z-index:9000;font:inherit;font-size:12px;display:inline-flex;align-items:center;gap:6px;padding:6px 10px 6px 6px;border:1px solid var(--rule, #e5e7eb);border-radius:18px;background:var(--card, #fff);color:var(--ink-2, #4b5563);box-shadow:0 2px 10px rgba(0,0,0,.08);user-select:none;touch-action:none}' +
    '.pn-toggle .pn-drag{width:14px;height:14px;display:inline-grid;place-items:center;color:#9ca3af;font-size:11px;cursor:grab;line-height:1;flex:0 0 auto}' +
    '.pn-toggle.pn-dragging .pn-drag{cursor:grabbing}' +
    '.pn-toggle:hover{border-color:var(--brand, #4f46e5);color:var(--brand-ink, #3730a3)}' +
    '.pn-toggle:hover .pn-drag{color:var(--brand-ink, #3730a3)}' +
    '.pn-toggle::before{content:"";width:7px;height:7px;border-radius:50%;background:#b45309;margin-left:2px}' +
    '.pn-toggle[aria-pressed="true"]{background:var(--brand, #4f46e5);border-color:var(--brand, #4f46e5);color:#fff}' +
    '.pn-toggle[aria-pressed="true"]::before{background:#fff}' +
    '.pn-toggle[aria-pressed="true"] .pn-drag{color:rgba(255,255,255,.7)}' +
    '.pn-badge{font-family:var(--mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace)!important;font-size:10px!important;font-weight:400!important;letter-spacing:.02em!important;line-height:15px!important;padding:0 5px!important;margin-left:6px;border:1px dashed var(--pn-c, #b45309)!important;border-radius:3px!important;color:var(--pn-c, #b45309)!important;background:var(--pn-bg, #fef3c7)!important;background-image:repeating-linear-gradient(135deg, rgba(0,0,0,.07) 0 1px, transparent 1px 5px)!important;cursor:pointer;vertical-align:2px;white-space:nowrap;flex:0 0 auto}' +
    '.pn-badge:hover{background-image:none!important;border-style:solid!important}' +
    '.pn-badge.pn-page{align-self:flex-start;margin:12px 0 0 24px;vertical-align:0;z-index:5}' +
    '.pn-badge.pn-inline{margin-left:auto;align-self:center;vertical-align:0;flex:0 0 auto}' +
    '.pn-pop{position:fixed;z-index:9500;width:300px;max-width:calc(100vw - 24px);background:#fffdf6;border:1px dashed #d3b98a;border-radius:8px;box-shadow:0 10px 26px rgba(0,0,0,.14);padding:10px 12px;font-size:12px;line-height:1.65;color:var(--ink-2, #4b5563)}' +
    '.pn-pop .pn-tag{font-family:var(--mono, ui-monospace, Menlo, monospace);font-size:9.5px;letter-spacing:.08em;color:#a16207;margin-bottom:4px}' +
    '.pn-pop .pn-h{display:flex;align-items:center;gap:6px;margin-bottom:3px;color:var(--ink, #111827);font-weight:600;font-size:12.5px}' +
    '.pn-pop .pn-meta{font-size:10.5px;color:var(--muted, #6b7280);margin-bottom:4px}' +
    '.pn-pop .pn-ul{margin:2px 0 0;padding-left:16px}' +
    '.pn-pop .pn-ul li{margin:3px 0}' +
    '.pn-pop .pn-prd{margin-top:6px;font-size:11px;color:#a16207}' +
    '.pn-pop .pn-chip{font-style:normal;font-size:10px;border-radius:4px;padding:0 5px;line-height:15px;white-space:nowrap}' +
    '.pn-pop a{display:inline-block;margin-top:6px;font-size:11px;color:var(--brand-ink, #3730a3);text-decoration:none}' +
    '.pn-pop a:hover{text-decoration:underline}';

  function ensureCss() {
    if (document.getElementById('pn-style')) return;
    var s = document.createElement('style');
    s.id = 'pn-style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  var on = false;
  var pageNotes = [];
  var pop = null, popFor = null, pinned = false, hideTimer = null;

  function closePop() {
    clearTimeout(hideTimer);
    if (pop) { pop.remove(); pop = null; }
    if (popFor) { popFor.setAttribute('aria-expanded', 'false'); popFor = null; }
    pinned = false;
  }

  function scheduleClose() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(function () { if (!pinned) closePop(); }, 140);
  }

  function openPop(badge, n, side) {
    if (popFor === badge) return;
    closePop();
    var isRule = n.kind === 'rule';
    var s = isRule ? RULE : st(n);
    var body = isRule
      ? '<div class="pn-meta">' + esc(n.portal) + ' · ' + esc(n.module) + '</div>' +
        '<ul class="pn-ul">' + (n.items || []).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' +
        (n.prd ? '<div class="pn-prd">PRD 参考：' + esc(n.prd) + '</div>' : '')
      : '<div class="pn-meta">' + esc(n.portal) + ' · ' + esc(n.page) + '</div><div>' + esc(n.note) + '</div>';
    pop = document.createElement('div');
    pop.className = 'pn-pop';
    pop.innerHTML = '<div class="pn-tag">' + (isRule ? '§ 原型规则' : '✎ 原型标注') + '</div>' +
      '<div class="pn-h">' + esc(isRule ? (n.title || n.module) : n.module) +
      '<i class="pn-chip" style="color:' + s.c + ';background:' + s.bg + '">' + s.t + '</i>' +
      (isRule ? '' : '<i class="pn-chip" style="color:var(--muted, #6b7280);background:var(--card-2, #f9fafb)">' + esc(n.prio) + '</i>') + '</div>' +
      body +
      '<a href="' + (inSub() ? '../' : '') + 'proto-notes.html">查看全部标注 ›</a>';
    document.body.appendChild(pop);
    badge.setAttribute('aria-expanded', 'true');
    popFor = badge;
    placePop(badge, side);
    pop.addEventListener('mouseenter', function () { clearTimeout(hideTimer); pinned = true; });
    pop.addEventListener('mouseleave', function () { pinned = false; closePop(); });
  }

  function placePop(badge, side) {
    if (!pop) return;
    var r = badge.getBoundingClientRect(), w = 300, h = pop.offsetHeight || 120;
    var left, top;
    if (side === 'side' && r.right + 8 + w <= window.innerWidth - 10) {
      left = r.right + 8;
      top = Math.min(Math.max(8, r.top - 4), window.innerHeight - h - 8);
    } else {
      left = Math.max(8, Math.min(r.left, window.innerWidth - w - 10));
      top = r.bottom + 6;
      if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 6);
    }
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
  }

  function renderMarks(list) {
    list.forEach(function (n) {
      if (!n.target) return;
      var host = document.querySelector(n.target);
      if (!host || document.querySelector('[data-pn-mark="' + n.module + '"]')) return;
      var s = n.kind === 'rule' ? RULE : st(n);
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'pn-badge';
      b.setAttribute('data-pn-mark', n.module);
      b.setAttribute('aria-expanded', 'false');
      b.style.setProperty('--pn-c', s.c);
      b.style.setProperty('--pn-bg', s.bg);
      b.textContent = n.kind === 'rule' ? '§ 规则' : '✎ ' + s.t;
      b.addEventListener('mouseenter', function () { clearTimeout(hideTimer); openPop(b, n, 'below'); });
      b.addEventListener('mouseleave', function () { if (!pinned) scheduleClose(); });
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        if (popFor === b && pinned) closePop();
        else { pinned = true; openPop(b, n, 'below'); }
      });
      if (n.where === 'prepend') {
        b.classList.add('pn-page');
        host.insertBefore(b, host.firstChild);
      } else if (n.where === 'append') {
        b.classList.add('pn-inline');
        host.appendChild(b);
      } else {
        host.insertAdjacentElement('afterend', b);
      }
    });
  }

  function renderAll() {
    renderMarks(pageNotes);
  }

  function setState(v) {
    on = v;
    ensureCss();
    var btn = document.querySelector('.pn-toggle');
    if (btn) {
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.querySelector('.pn-label').textContent = on ? '关闭标注' : '打开标注';
      btn.title = on ? '关闭标注：所有页面恢复演示状态（按住左侧抓手可拖动）' : '打开标注：所有页面显示原型标注（按住左侧抓手可拖动）';
    }
    if (!on) {
      closePop();
      document.querySelectorAll('[data-pn-mark]').forEach(function (x) { x.remove(); });
    } else {
      renderAll();
    }
    try { localStorage.setItem(KEY, on ? '1' : ''); } catch (e) {}
  }

  function ensureMarks() {
    if (!on) return;
    pageNotes.forEach(function (n) {
      if (n.target && !document.querySelector('[data-pn-mark="' + n.module + '"]')) renderMarks([n]);
    });
  }

  function init() {
    if (file() === 'proto-notes.html') return;   // 汇总页不显示开关
    ensureCss();
    pageNotes = notesOf(file());
    var force = /[?&]pn=1/.test(location.search);
    var saved = false;
    try { saved = !!localStorage.getItem(KEY); } catch (e) {}
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pn-toggle';
    btn.innerHTML = '<span class="pn-drag" aria-label="拖动" title="拖动位置">⋮⋮</span><span class="pn-label">打开标注</span>';
    btn.title = '打开标注：所有页面显示原型标注（按住左侧抓手可拖动）';
    btn.setAttribute('aria-pressed', 'false');
    document.body.appendChild(btn);

    // 应用已保存位置（覆盖默认右下角）
    applyPos(btn, loadPos());

    // 拖拽
    var dragging = false, moved = false, sx = 0, sy = 0, ox = 0, oy = 0, threshold = 3;
    var drag = btn.querySelector('.pn-drag');
    function onDown(e) {
      var pos = btn.getBoundingClientRect();
      ox = pos.left; oy = pos.top;
      sx = (e.clientX != null ? e.clientX : e.touches && e.touches[0] && e.touches[0].clientX);
      sy = (e.clientY != null ? e.clientY : e.touches && e.touches[0] && e.touches[0].clientY);
      dragging = true; moved = false;
      btn.classList.add('pn-dragging');
      try { btn.setPointerCapture && btn.setPointerCapture(e.pointerId); } catch (e2) {}
      e.preventDefault();
    }
    function onMove(e) {
      if (!dragging) return;
      var cx = (e.clientX != null ? e.clientX : e.touches && e.touches[0] && e.touches[0].clientX);
      var cy = (e.clientY != null ? e.clientY : e.touches && e.touches[0] && e.touches[0].clientY);
      var dx = cx - sx, dy = cy - sy;
      if (!moved && Math.abs(dx) + Math.abs(dy) > threshold) moved = true;
      if (!moved) return;
      var p = clampPos(btn, ox + dx, oy + dy);
      btn.style.right = 'auto'; btn.style.bottom = 'auto';
      btn.style.left = p.left + 'px'; btn.style.top = p.top + 'px';
      e.preventDefault();
    }
    function onUp(e) {
      if (!dragging) return;
      dragging = false;
      btn.classList.remove('pn-dragging');
      if (moved) {
        var r = btn.getBoundingClientRect();
        savePos(Math.round(r.left), Math.round(r.top));
      }
    }
    drag.addEventListener('pointerdown', onDown);
    drag.addEventListener('touchstart', onDown, { passive: false });
    window.addEventListener('pointermove', onMove);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('touchend', onUp);

    // 点击切换（拖拽过则不触发）
    btn.addEventListener('click', function (e) {
      if (moved) { moved = false; e.preventDefault(); e.stopPropagation(); return; }
      setState(!on);
    });

    window.addEventListener('resize', function () {
      var p = loadPos();
      if (p) { var c = clampPos(btn, p.left, p.top); applyPos(btn, c); savePos(c.left, c.top); }
      closePop();
    });

    if (force || saved) setState(true);
    document.addEventListener('click', function (e) {
      if (!pop) return;
      if (e.target.closest && (e.target.closest('.pn-pop') || e.target.closest('[data-pn-mark]'))) return;
      closePop();
    });
    window.addEventListener('scroll', closePop, true);
    // 页面内容重绘 / 侧栏重渲染后补回标注
    try {
      new MutationObserver(function () { ensureMarks(); }).observe(document.body, { childList: true, subtree: true });
    } catch (e) {}
  }

  var PN = {
    notes: NOTES,
    status: STATUS,
    rule: RULE,
    init: init,
    esc: esc
  };
  root.ProtoNotes = PN;
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }
}(typeof window !== 'undefined' ? window : this));
