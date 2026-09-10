
/* ═══ 9b. 报告版本与导出 ═══ */
let versions = [];   // {no, at, mode, scopeN, scopeNames, metrics}
function nowStr(){
  const d = new Date();
  const p = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function pushVersion(mode, metrics){
  const v = {no: versions.length+1, at: nowStr(), mode, scopeN: scope.size,
             scopeNames: scopedPos().map(p=>p.name), metrics};
  versions.push(v);
  return v;
}
function verBar(v){
  return `<div class="verbar">
    <span class="pill core">诊断 #${v.no}</span>
    <span class="ver-t mono">${v.at}</span>
    <span class="ver-d">${v.mode==='manual'?'人工填报':'双图谱映射'} · ${v.scopeN} 个岗位</span>
    <span style="flex:1"></span>
    ${versions.length>1?`<button class="chip" data-ver="hist">历史 ${versions.length} 次</button>`:''}
    <button class="chip" data-ver="export">导出报告</button>
  </div>`;
}

function reportMarkdown(){
  const v = versions[versions.length-1]; if(!v) return '';
  const m = v.metrics;
  const L = [];
  L.push(`# ${I.name} · 本校能力覆盖诊断报告`);
  L.push('');
  L.push(`- 诊断批次：#${v.no}　生成时间：${v.at}`);
  L.push(`- 数据来源：${v.mode==='manual'?'人工填报（不可追溯到具体课程与知识点）':'双图谱映射自动推导（可追溯到知识点）'}`);
  L.push(`- 测评范围：${v.scopeN} 个岗位 —— ${v.scopeNames.join('、')}`);
  L.push(`- 行业图谱：${I.name} ${I.version}（${I.builtAt}） · ${S.positions} 岗位 / ${S.abilities} 能力项 / ${S.evidenceTotal} 条来源证据`);
  L.push('');
  L.push('## 一、岗位达标情况');
  L.push('');
  L.push('| 岗位 | 子行业 | 能力项 | 已达标 | 等级不足 | 未覆盖 | 达标率 |');
  L.push('|---|---|---|---|---|---|---|');
  m.rows.forEach(r=> L.push(`| ${r.name} | ${r.sub} | ${r.total} | ${r.ok} | ${r.levelgap} | ${r.none} | ${Math.round(r.rate*100)}% |`));
  L.push('');
  L.push('## 二、缺口清单');
  L.push('');
  if(m.none.length){
    L.push(`### 内容缺口 —— 本校完全未开设（${m.none.length} 条）`);
    L.push('');
    L.push('| 能力项 | 领域 | 核心 | 要求岗位数 | 岗位最高要求 |');
    L.push('|---|---|---|---|---|');
    m.none.forEach(a=> L.push(`| ${a.name} | ${a.domain} | ${a.core?'★':''} | ${a.positionCount} | ${a.maxRequiredLevel} |`));
    L.push('');
  }
  if(m.gap.length){
    L.push(`### 等级缺口 —— 教了但未教到岗位要求（${m.gap.length} 条）`);
    L.push('');
    L.push('| 能力项 | 本校教到 | 岗位要求 | 差距 |');
    L.push('|---|---|---|---|');
    m.gap.forEach(a=> L.push(`| ${a.name} | ${a.att} | ${a.req} | ${a.d} 级 |`));
    L.push('');
  }
  L.push('## 三、诊断结论');
  L.push('');
  m.findings.forEach(f=>{ L.push(`### ${f.title}`); L.push(''); L.push(f.body); L.push(''); });
  L.push('---');
  L.push('');
  L.push(v.mode==='manual'
    ? '> 本报告依据人工填报，反映填报人对本校教学的判断，无法追溯到具体课程与知识点。接入知识图谱后可由映射自动生成。'
    : `> 本报告由「能力项 ↔ 技能规范/知识点」的映射边自动推导，检索范围为${SC.majorWithKg.name}专业知识图谱（${SC.majorWithKg.courses.length} 门课 · ${SC.majorWithKg.leafCount} 个知识节点 · ${SC.majorWithKg.mappingCount} 条映射边）。`);
  return L.join('\n');
}

function openExport(){
  const md = reportMarkdown();
  openDrawer('导出报告', `诊断 #${versions.length}`, '两种带走方式',
    `<div class="dr-s"><div class="dr-st">打印 / 另存为 PDF</div>
      <div class="dr-def">隐藏导航与交互控件，只保留报告正文，交给浏览器打印。这是拿去开会、放进申报书最直接的一种。</div>
      <button class="btn" id="doPrint" style="margin-top:11px">打开打印视图</button></div>
     <div class="dr-s"><div class="dr-st">复制为 Markdown</div>
      <div class="dr-def">结构化文本，可直接粘进文档或 Obsidian。</div>
      <button class="chip" id="doCopy" style="margin:11px 0 8px">复制到剪贴板</button>
      <textarea class="mdbox" id="mdBox" readonly>${esc(md)}</textarea></div>
     <div class="dr-s"><div class="assess">正式版本还会提供 Word / PDF 后端导出与分享链接；原型内以浏览器打印与文本复制替代。</div></div>`);
  $('#doPrint').addEventListener('click', ()=>{ closeDrawer(); setTimeout(()=>window.print(), 220); });
  $('#doCopy').addEventListener('click', async ()=>{
    const el = $('#mdBox'); el.select();
    try { await navigator.clipboard.writeText(el.value); $('#doCopy').textContent = '✓ 已复制'; }
    catch { $('#doCopy').textContent = '请按 Ctrl/Cmd+C 复制'; }
  });
}
function openHist(){
  openDrawer('版本历史', `共 ${versions.length} 次诊断`, '同一份行业图谱下的历次测评',
    versions.slice().reverse().map(v=>`<div class="ev">
      <div class="ev-h"><span class="pill core">#${v.no}</span>
        <span class="ev-t">${v.mode==='manual'?'人工填报':'双图谱映射'}</span>
        <span class="pill k mono">${v.at}</span></div>
      <div class="ev-x">范围 ${v.scopeN} 个岗位 · 未覆盖 ${v.metrics.none.length} 条 · 等级缺口 ${v.metrics.gap.length} 条 ·
        达标率 ≥60% 的岗位 ${v.metrics.rows.filter(r=>r.rate>=0.6).length} 个</div>
      <div class="ev-u">${esc(v.scopeNames.join('、'))}</div></div>`).join('') +
    `<div class="assess" style="margin-top:12px">正式版本中，每次「重算」都会生成新版本并可回看与对比；原型内仅记录本次会话内的批次。</div>`);
}
document.addEventListener('click', e=>{
  const b = e.target.closest('[data-ver]'); if(!b) return;
  if(b.dataset.ver==='export') openExport();
  if(b.dataset.ver==='hist') openHist();
});
