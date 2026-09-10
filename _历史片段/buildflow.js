
/* ═══ 9a. 新行业构建流程（V2 流水线 + 人工确认闸口） ═══ */
const BN = D.buildNodes;
let bf = null;   // {name, step, gateAnswers, timer, done}

function openBuild(name){
  const demo = D.buildDemo[name];
  bf = {name, demo, step:-1, answers:{}, extra:0, cancelled:false};
  $('#buildOv').hidden = false;
  document.body.style.overflow = 'hidden';
  renderBuild();
  stepBuild();
}
function closeBuild(){
  if(bf) bf.cancelled = true;
  clearTimeout(bf && bf.timer);
  $('#buildOv').hidden = true;
  document.body.style.overflow = '';
  bf = null;
}
function stepBuild(){
  if(!bf || bf.cancelled) return;
  bf.step++;
  if(bf.step >= BN.length){ renderBuild(); return; }
  renderBuild();
  if(BN[bf.step].id === 'GATE') return;          // 闸口：等人拍板
  bf.timer = setTimeout(stepBuild, BN[bf.step].ms);
}

function renderBuild(){
  if(!bf) return;
  const d = bf.demo, done = bf.step >= BN.length;
  const gateIdx = BN.findIndex(n=>n.id==='GATE');
  const atGate = bf.step === gateIdx;

  const steps = BN.map((n,i)=>{
    const st = i < bf.step ? 'ok' : i === bf.step ? (n.id==='GATE'?'gate':'run') : 'wait';
    return `<div class="bstep ${st}">
      <span class="bs-dot">${st==='ok'?'✓':st==='gate'?'⛔':st==='run'?'':''}</span>
      <span class="bs-id mono">${n.id}</span>
      <span class="bs-n">${esc(n.name)}</span>
      <span class="bs-note">${esc(n.note)}</span>
      <span class="bs-m mono">${esc(n.model)}</span></div>`;
  }).join('');

  let panel = '';
  if(atGate){
    const posN = d.positions.length + bf.extra;
    panel = `<div class="gate">
      <div class="gate-h"><span class="ico warning">⛔</span>
        <div><b>人工确认闸口</b><div class="gate-d">AI 已产出前三层骨架。下面三件事请业务方拍板——只看三样：子行业是否按业务形态划分、岗位有无遗漏、排除理由是否具体到岗位层面。</div></div></div>

      <div class="gate-s"><div class="gate-st">✅ 本次建图包含</div>
        <div class="gate-subs">${d.subIndustries.map(s=>`<div class="gsub">
          <div class="gsub-h"><b>${esc(s.name)}</b>
            <span class="pill ${s.priority==='core'?'core':'ext'}">${s.priority}</span></div>
          <div class="gsub-e">${s.employers.map(e=>`<span class="emp">${esc(e)}</span>`).join('')}</div>
        </div>`).join('')}</div>
        <div class="gate-note">自检：4 个子行业的典型用人单位互不相同 → 按业务形态划分成立</div></div>

      <div class="gate-s"><div class="gate-st">❌ 本次不包含</div>
        ${d.excluded.map(e=>`<div class="brow"><span class="bmark ex">✕</span><div>
          <div class="bitem">${esc(e.item)}</div><div class="breason">${esc(e.reason)}</div></div></div>`).join('')}</div>

      <div class="gate-s"><div class="gate-st">⚠️ 需要你拍板（${d.questions.length} 项）</div>
        ${d.questions.map((q,i)=>`<div class="gq">
          <div class="gq-t">${esc(q.q)}</div>
          <div class="seg gq-seg">
            <button data-gq="${i}" data-v="纳入" aria-pressed="${bf.answers[i]==='纳入'}">纳入</button>
            <button data-gq="${i}" data-v="不纳入" aria-pressed="${bf.answers[i]==='不纳入'}">不纳入</button>
          </div></div>`).join('')}</div>

      <div class="gate-s"><div class="gate-st">📋 岗位清单 ${posN} 个</div>
        <div class="gpos">${d.positions.map(p=>`<span class="pchip" aria-pressed="true">
          <span class="pc-x">✓</span>${esc(p)}</span>`).join('')}
          ${bf.extra?`<span class="pchip" aria-pressed="true"><span class="pc-x">✓</span>民宿管家（拍板新增）</span>`:''}</div></div>

      <div class="gate-f">
        <span class="gate-fd">${Object.keys(bf.answers).length}/${d.questions.length} 项已拍板</span>
        <span style="flex:1"></span>
        <button class="btn ghost" data-bf="cancel">修改范围</button>
        <button class="btn" data-bf="go" ${Object.keys(bf.answers).length<d.questions.length?'disabled style="opacity:.45;cursor:not-allowed"':''}>确认并开始采集</button>
      </div></div>`;
  } else if(done){
    const r = d.result, srcTot = Object.values(r.sourceDist).reduce((a,b)=>a+b,0);
    const checks = [
      ['excluded 理由说到岗位层面', true, `${d.excluded.length} 条排除项均指向岗位能力重合度或标准归属`],
      ['子行业能对应到不同用人单位', true, '4 个子行业的典型用人单位无重复'],
      ['证据 URL 编造率', r.failedUrl===0, `failedUrl = ${r.failedUrl}`],
      ['原文摘录比对失败率', r.failedExcerpt/r.evidence < 0.2, `${r.failedExcerpt}/${r.evidence} = ${(r.failedExcerpt/r.evidence*100).toFixed(1)}%，低于 20% 阈值`],
      ['AI 推断率落在健康区间', r.inferredRate>=0.10 && r.inferredRate<=0.15, `${(r.inferredRate*100).toFixed(1)}%，健康区间 10~15%`],
    ];
    panel = `<div class="bdone">
      <div class="bdone-h"><span class="ico good">✓</span><div><b>「${esc(bf.name)}」能力图谱构建完成</b>
        <div class="gate-d">耗时约 6 分钟 · 搜索 12 次 · LLM 调用 15 次</div></div></div>
      <div class="kgrid" style="margin-bottom:14px">
        ${[[r.subIndustries,'子行业',''],[r.positions+bf.extra,'岗位','含拍板新增 '+bf.extra],
           [r.abilities,'能力项',''],[r.core,'核心能力','多岗位 + 国标来源']]
          .map(([v,k,s])=>`<div class="kt"><div class="kt-v">${v}</div><div class="kt-k">${esc(k)}</div>
            <div class="kt-s">${esc(s)}</div></div>`).join('')}
      </div>
      <div class="gate-st">验收五信号</div>
      ${checks.map(([n,ok,d2])=>`<div class="bcheck"><span class="ico ${ok?'good':'warning'}">${ok?'✓':'!'}</span>
        <span class="bc-n">${esc(n)}</span><span class="bc-d">${esc(d2)}</span></div>`).join('')}
      <div class="gate-note" style="margin-top:12px">来源分布：${Object.entries(r.sourceDist).map(([k,v])=>`${k.split('_')[1]} ${v} 条（${Math.round(v/srcTot*100)}%）`).join(' · ')}</div>
      <div class="gate-f"><span class="gate-fd">图谱已入库，版本 v1.0</span><span style="flex:1"></span>
        <button class="btn ghost" data-bf="cancel">关闭</button>
        <button class="btn" data-bf="view">查看行业全景</button></div></div>`;
  } else {
    const n = BN[bf.step];
    panel = `<div class="brun"><div class="spin"></div>
      <div><b>${esc(n.id)} · ${esc(n.name)}</b><div class="gate-d">${esc(n.note)}　—　${esc(n.model)}</div></div></div>`;
  }

  $('#buildBody').innerHTML = `
    <div class="bcols">
      <div class="bsteps"><div class="eyebrow" style="margin-bottom:10px">流水线节点</div>${steps}</div>
      <div class="bpanel">${panel}</div>
    </div>`;
  $('#buildTitle').textContent = `构建「${bf.name}」能力图谱`;
  $('#buildSub').textContent = done ? '构建完成' : (atGate ? '等待人工确认' : `进行中 · ${bf.step+1}/${BN.length}`);
}

$('#buildOv').addEventListener('click', e=>{
  const q = e.target.closest('[data-gq]');
  if(q){ bf.answers[q.dataset.gq] = q.dataset.v;
    bf.extra = (bf.answers['0']==='纳入') ? 1 : 0;
    renderBuild(); return; }
  const b = e.target.closest('[data-bf]');
  if(!b) return;
  if(b.dataset.bf==='cancel'){ closeBuild(); return; }
  if(b.dataset.bf==='go'){ stepBuild(); return; }
  if(b.dataset.bf==='view'){
    closeBuild();
    openDrawer('原型说明', '仅装载旅游业数据',
      '真实版本此处会切换到新建成的行业全景',
      `<div class="dr-s"><div class="dr-def">构建流程本身是完整可走的——输入规范化、行业界定、人工确认闸口、语料采集、证据校验、归并分级、组装自检，每一步都对应《四层能力图谱构建方案 V2》里的节点。<br><br>
        但本原型只装载了旅游业一个行业的完整数据（9 岗位 / 28 能力项 / 50 条证据 / 91 条双图谱映射边），所以构建完成后不切换全景图。</div></div>
       <div class="dr-s"><div class="dr-st">刚才这一遍验证了什么</div>
        <ul class="pts"><li>闸口卡片能在 60 秒内看完并作出三项决策</li>
        <li>拍板结果会影响产出（选「纳入」民宿管家，岗位数从 10 变 11）</li>
        <li>完成页给出验收五信号，而不只是一句「构建成功」</li></ul></div>`);
  }
});
