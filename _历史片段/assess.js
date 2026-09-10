
/* ═══ 7b. 测评 · 模式一：本校能力达成人工填报 ═══ */
const COVL = {full:'已覆盖', partial:'部分覆盖', none:'未开设'};
let fill = {};              // {ABL-xx: {cov, lv, by}}
let onlyCore = false;

function fillOrder(){
  return D.abilities.slice().sort((a,b)=>
    (b.core-a.core) || (b.positionCount-a.positionCount) || a.id.localeCompare(b.id));
}
function fillRows(){ return fillOrder().filter(a=>!onlyCore || a.core); }

function renderFill(){
  const rows = fillRows();
  const groups = [];
  rows.forEach(a=>{ let g=groups.find(x=>x.name===a.domain);
    if(!g){g={name:a.domain,items:[]};groups.push(g);} g.items.push(a); });

  $('#fillTable').innerHTML = `
    <div class="fhead"><span>能力项（按核心与被要求岗位数排序）</span><span>本校覆盖情况</span>
      <span>教到等级</span><span>承接专业 / 课程</span></div>` +
    groups.map(g=>{
      const done = g.items.filter(a=>fill[a.id]&&fill[a.id].cov).length;
      return `<div class="fgroup"><div class="fg-h"><b style="font-weight:500">${esc(g.name)}</b>
        <span class="fg-n">${done}/${g.items.length}</span>
        <span class="fg-bulk">
          <button class="chip" data-bulk="full" data-dm="${esc(g.name)}">全标已覆盖</button>
          <button class="chip" data-bulk="none" data-dm="${esc(g.name)}">全标未开设</button>
        </span></div>` +
      g.items.map(a=>{
        const f = fill[a.id] || {};
        const st = f.cov ? ' done '+f.cov : '';
        return `<div class="frow${st}" data-abl="${a.id}">
          <div class="fn"><span class="tdot ${a.type}" title="${a.typeCn}类"></span>
            <span class="fn-t" title="${esc(a.name)}">${esc(a.name)}</span>
            ${a.core?'<span class="star" title="核心能力">★</span>':''}
            <span class="fmeta">${a.positionCount} 岗 · 最高 ${a.maxRequiredLevel}</span></div>
          <div class="seg">${['full','partial','none'].map(c=>
            `<button data-cov="${c}" aria-pressed="${f.cov===c}">${COVL[c]}</button>`).join('')}</div>
          <div class="seg lv" data-disabled="${f.cov&&f.cov!=='none'?'0':'1'}">${['L1','L2','L3'].map(L=>
            `<button data-lv="${L}" aria-pressed="${f.lv===L}">${L}</button>`).join('')}</div>
          <input class="fby" data-by="${a.id}" value="${esc(f.by||'')}" placeholder="选填，如：导游服务 · 导游实务">
        </div>`;
      }).join('') + `</div>`;
    }).join('');

  const total = D.abilities.length;
  const done = Object.values(fill).filter(f=>f.cov).length;
  $('#fpBar').style.width = (done/total*100).toFixed(1)+'%';
  $('#fpText').textContent = `已填 ${done} / ${total}`;
}
renderFill();

$('#fillTable').addEventListener('click', e=>{
  const bulk = e.target.closest('[data-bulk]');
  if(bulk){
    fillRows().filter(a=>a.domain===bulk.dataset.dm).forEach(a=>{
      fill[a.id] = bulk.dataset.bulk==='none'
        ? {cov:'none', lv:null, by:(fill[a.id]||{}).by||''}
        : {cov:'full', lv:(fill[a.id]||{}).lv || (a.maxRequiredLevel==='L3'?'L2':a.maxRequiredLevel),
           by:(fill[a.id]||{}).by||''};
    });
    renderFill(); return;
  }
  const row = e.target.closest('[data-abl]'); if(!row) return;
  const id = row.dataset.abl;
  const cb = e.target.closest('[data-cov]');
  if(cb){
    const c = cb.dataset.cov;
    const cur = fill[id] || {};
    fill[id] = {cov: cur.cov===c ? null : c,
      lv: c==='none' ? null : (cur.lv || (abl[id].maxRequiredLevel==='L3'?'L2':abl[id].maxRequiredLevel)),
      by: cur.by||''};
    renderFill(); return;
  }
  const lb = e.target.closest('[data-lv]');
  if(lb){ const cur = fill[id]||{}; if(!cur.cov||cur.cov==='none') return;
    fill[id] = {...cur, lv: lb.dataset.lv}; renderFill(); }
});
$('#fillTable').addEventListener('input', e=>{
  const inp = e.target.closest('[data-by]'); if(!inp) return;
  const id = inp.dataset.by;
  fill[id] = {...(fill[id]||{cov:null,lv:null}), by: inp.value};
});
$('#onlyCore').addEventListener('click', ()=>{
  onlyCore = !onlyCore;
  $('#onlyCore').setAttribute('aria-pressed', String(onlyCore));
  $('#onlyCore').textContent = onlyCore ? '显示全部 28' : '只填核心能力 10';
  renderFill();
});
$('#clearFill').addEventListener('click', ()=>{ fill = {}; $('#manualReport').hidden = true; renderFill(); });
$('#loadSample').addEventListener('click', ()=>{
  fill = {};
  const partialSet = new Set(['ABL-09','ABL-24']);
  D.abilities.forEach(a=>{
    if(SC.uncovered_abilities.includes(a.id)) fill[a.id] = {cov:'none', lv:null, by:''};
    else if(partialSet.has(a.id)) fill[a.id] = {cov:'partial', lv:'L1', by:'康养休闲旅游服务'};
    else fill[a.id] = {cov:'full',
      lv: a.maxRequiredLevel==='L3' ? 'L2' : a.maxRequiredLevel,
      by: a.core ? '导游服务 · 旅游服务与管理' : ''};
  });
  renderFill();
  $('#genReport').scrollIntoView({behavior:'smooth', block:'center'});
});

/* ---- 由填报生成诊断 ---- */
function manualStatus(pid){
  const p = pos[pid];
  const c = {ok:0, levelgap:0, partial:0, none:0, unfilled:0};
  p.abilities.forEach(r=>{
    const f = fill[r.ability];
    if(!f || !f.cov) c.unfilled++;
    else if(f.cov==='none') c.none++;
    else if(f.cov==='partial') c.partial++;
    else c[LV[f.lv] >= LV[r.level] ? 'ok' : 'levelgap']++;
  });
  const rate = c.ok / p.abilityCount;
  return {c, rate};
}

$('#genReport').addEventListener('click', ()=>{
  const filled = Object.values(fill).filter(f=>f.cov).length;
  if(!filled){
    $('#manualReport').hidden = false;
    $('#manualReport').innerHTML = `<div class="dnote"><span class="ico warning">i</span>
      <span>还没有填报任何一条能力项。可以先点「载入示例填报」看看报告长什么样，或从「只填核心能力 10」开始。</span></div>`;
    return;
  }
  const stat = D.positions.map(p=>({p, ...manualStatus(p.id)})).sort((a,b)=>a.rate-b.rate);
  const noneAb = D.abilities.filter(a=>fill[a.id]&&fill[a.id].cov==='none')
    .sort((a,b)=>b.positionCount-a.positionCount);
  const gapAb = D.abilities.filter(a=>{ const f=fill[a.id];
    return f&&f.cov==='full'&&LV[f.lv]<LV[a.maxRequiredLevel]; })
    .sort((a,b)=>b.positionCount-a.positionCount);
  const partAb = D.abilities.filter(a=>fill[a.id]&&fill[a.id].cov==='partial');

  const findings = [];
  const worst = stat.filter(x=>x.rate<0.5).slice(0,2);
  worst.forEach(x=>findings.push({level:'critical',
    title:`${x.p.name}岗位达标率 ${Math.round(x.rate*100)}%`,
    body:`该岗位 ${x.p.abilityCount} 条能力要求中，已达标 ${x.c.ok} 条，等级不足 ${x.c.levelgap} 条，未开设 ${x.c.none} 条，部分覆盖 ${x.c.partial} 条${x.c.unfilled?`，另有 ${x.c.unfilled} 条未填报`:''}。未开设的能力项需要新增课程模块承接，不是调整现有课程能解决的。`}));
  if(noneAb.length) findings.push({level:'critical', title:`${noneAb.length} 条能力项本校完全未开设`,
    body:`按被要求的岗位数排序，最需要补的是「${noneAb.slice(0,3).map(a=>a.name).join('」「')}」${noneAb.length>3?' 等':''}。其中 ${noneAb.filter(a=>a.core).length} 条是核心能力（被 2 个以上岗位要求且有国家级来源），优先级最高。`});
  if(gapAb.length) findings.push({level:'warning', title:`${gapAb.length} 条能力项教了但未教到岗位要求的高度`,
    body:`集中在「${gapAb.slice(0,3).map(a=>a.name).join('」「')}」${gapAb.length>3?' 等':''}。L3 的共同特征是「处理非常规情境、优化流程、指导他人」，这类要求很难在课堂任务里达成，通常应由顶岗实习或真实项目承接——这张表可以直接作为实习任务书的依据。`});
  if(partAb.length) findings.push({level:'warning', title:`${partAb.length} 条能力项填报为部分覆盖`,
    body:`「部分覆盖」意味着教学内容触及但不成体系。建议在下一轮课程修订时明确：是并入现有课程加深，还是单独设立教学任务。`});
  const best = stat[stat.length-1];
  if(best && best.rate>=0.6) findings.push({level:'good', title:`${best.p.name}岗位达标率 ${Math.round(best.rate*100)}%`,
    body:`${best.p.abilityCount} 条能力要求中已达标 ${best.c.ok} 条${best.c.levelgap?`，未达标的 ${best.c.levelgap} 条集中在等级不足而非内容空白`:''}。这是本校在该行业里最扎实的岗位方向。`});

  const covered = D.positions.filter(p=>manualStatus(p.id).rate>=0.6).length;
  const rows = stat.slice().sort((a,b)=>b.rate-a.rate).map(x=>{
    const t = x.p.abilityCount;
    const seg = (k,v)=> x.c[k] ? `<i style="flex:${x.c[k]};background:var(--${v})" title="${k}"></i>` : '';
    return `<tr><td><b style="font-weight:500">${esc(x.p.name)}</b>
        <span class="mono" style="color:var(--muted);font-size:10.5px"> ${esc(sub[x.p.sub].name)}</span></td>
      <td><span class="covbar">${seg('ok','good')}${seg('levelgap','warn')}${seg('partial','lv1')}${seg('none','crit')}${seg('unfilled','rule')}</span></td>
      <td class="num">${x.c.ok}</td><td class="num">${x.c.levelgap}</td>
      <td class="num">${x.c.partial}</td><td class="num">${x.c.none}</td>
      <td class="num"><b>${Math.round(x.rate*100)}%</b></td></tr>`;
  }).join('');

  $('#manualReport').hidden = false;
  $('#manualReport').innerHTML = `
    <div style="margin:26px 0 14px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <span class="eyebrow">诊断报告</span>
      <span class="pill k">依据人工填报 ${filled}/${D.abilities.length} 条</span>
      <span style="flex:1"></span>
      <button class="btn" id="manualOverlay">叠加到行业全景</button>
    </div>
    <div class="dnote"><span class="ico warning">i</span>
      <span>本报告的依据是人工填报，反映的是填报人对本校教学的判断，<b>无法追溯到具体课程与知识点</b>。接入知识图谱后，同样结构的报告可由映射自动生成，每条结论都能落到某门课的某个知识点上。</span></div>
    <div class="card pad" style="margin-bottom:16px">
      <div class="eyebrow" style="margin-bottom:12px">岗位达标情况</div>
      <div style="overflow-x:auto"><table class="covtable"><thead><tr>
        <th style="min-width:150px">岗位</th><th style="min-width:120px">构成</th>
        <th style="text-align:right">已达标</th><th style="text-align:right">等级不足</th>
        <th style="text-align:right">部分</th><th style="text-align:right">未开设</th>
        <th style="text-align:right">达标率</th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="assess" style="margin-top:11px">达标 = 本校填报的教学等级 ≥ 该岗位对该能力的要求等级。
        9 个岗位中达标率 ≥ 60% 的有 <b>${covered}</b> 个。</div>
    </div>
    <div class="eyebrow" style="margin-bottom:10px">诊断结论</div>
    ${findings.map(f=>{
      const icon={critical:'!',warning:'!',good:'✓'}[f.level];
      const label={critical:'内容缺口',warning:'等级/深度缺口',good:'覆盖良好'}[f.level];
      return `<div class="find ${f.level}"><span class="find-s"></span><div>
        <div class="find-t"><span class="ico ${f.level}">${icon}</span>${esc(f.title)}
          <span class="pill ${f.level==='good'?'good':f.level==='warning'?'warn':'crit'}">${label}</span></div>
        <div class="find-b">${esc(f.body)}</div></div></div>`;
    }).join('')}`;
  $('#manualReport').scrollIntoView({behavior:'smooth', block:'start'});
});

$('#manualReport').addEventListener('click', e=>{
  if(e.target.id!=='manualOverlay') return;
  OVA = new Set(D.abilities.filter(a=>fill[a.id]&&fill[a.id].cov==='none').map(a=>a.id));
  OVP = new Set(D.positions.filter(p=>manualStatus(p.id).rate < 0.34).map(p=>p.id));
  OVC = Object.fromEntries(D.positions.map(p=>[p.id, manualStatus(p.id).rate]));
  OVSRC = 'manual';
  setDiag(true);
});

/* ---- 模式切换 ---- */
$('#tabs3').addEventListener('click', e=>{
  const b = e.target.closest('[data-mode]'); if(!b) return;
  $('#tabs3').querySelectorAll('.tab').forEach(x=>x.setAttribute('aria-selected', String(x===b)));
  $('#pane-manual').hidden = b.dataset.mode!=='manual';
  $('#pane-diag').hidden   = b.dataset.mode!=='auto';
});
