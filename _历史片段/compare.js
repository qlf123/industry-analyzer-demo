
/* ═══ 7c. 能力结构对比：领域雷达 / 缺口哑铃 ═══ */
const cmpView = {manual:'radar', auto:'radar'};

// 本校已达成等级（0=未开设，1/2/3=L1/L2/L3，null=未填报）
function attainedOf(aid, mode){
  if(mode==='manual'){
    const f = fill[aid];
    if(!f || !f.cov) return null;
    if(f.cov==='none') return 0;
    return LV[f.lv] - (f.cov==='partial' ? 0.5 : 0);
  }
  const v = SC.attained[aid];
  return v==null ? null : (v===0 ? 0 : LV[v]);
}
// 范围内该能力被要求的最高等级
function requiredOf(aid){
  const rows = abl[aid].requiredBy.filter(r=>scope.has(r.position));
  return rows.length ? Math.max(...rows.map(r=>LV[r.level])) : 0;
}

function cmpRows(mode){
  return scopedAbl().map(a=>{
    const req = requiredOf(a.id), att = attainedOf(a.id, mode);
    return {a, req, att, gap: att==null ? null : Math.max(0, req-att)};
  }).filter(r=>r.req>0);
}

/* ---- 领域雷达 ---- */
function radarSVG(mode){
  const rows = cmpRows(mode);
  const byD = {};
  rows.forEach(r=>{ (byD[r.a.domain] = byD[r.a.domain] || []).push(r); });
  const axes = Object.keys(byD).sort();
  if(axes.length < 3) return `<div class="cmp-empty">所选范围只涉及 ${axes.length} 个能力领域，雷达图至少需要 3 个轴。请扩大测评范围，或切到「缺口哑铃」按能力项查看。</div>`;
  const R = 148, N = axes.length;
  const ang = i => -Math.PI/2 + i*2*Math.PI/N;
  const pt = (i, v) => [(v/3*R*Math.cos(ang(i))).toFixed(1), (v/3*R*Math.sin(ang(i))).toFixed(1)];
  const avg = (arr, f) => arr.reduce((s,x)=>s+f(x),0)/arr.length;

  const reqPts = axes.map((d,i)=> pt(i, avg(byD[d], r=>r.req)));
  const attPts = axes.map((d,i)=> pt(i, avg(byD[d], r=>r.att==null?0:r.att)));
  const poly = ps => ps.map(p=>p.join(',')).join(' ');

  let g = '';
  // 网格
  for(let v=1; v<=3; v++){
    g += `<polygon class="rgrid" points="${poly(axes.map((_,i)=>pt(i,v)))}"></polygon>`;
    g += `<text class="rtick" x="4" y="${(-v/3*R).toFixed(1)}" dy="3">L${v}</text>`;
  }
  axes.forEach((_,i)=>{ const p = pt(i,3);
    g += `<line class="raxis" x1="0" y1="0" x2="${p[0]}" y2="${p[1]}"></line>`; });

  g += `<polygon class="rreq" points="${poly(reqPts)}"></polygon>`;
  g += `<polygon class="ratt" points="${poly(attPts)}"></polygon>`;

  axes.forEach((d,i)=>{
    const rq = avg(byD[d], r=>r.req), at = avg(byD[d], r=>r.att==null?0:r.att);
    const p = pt(i, at);
    if(rq - at >= 0.4) g += `<circle class="rgap" cx="${p[0]}" cy="${p[1]}" r="4.5"
      data-tipd="${esc(d)}|${rq.toFixed(1)}|${at.toFixed(1)}"></circle>`;
    else g += `<circle class="rok" cx="${p[0]}" cy="${p[1]}" r="3"
      data-tipd="${esc(d)}|${rq.toFixed(1)}|${at.toFixed(1)}"></circle>`;
    const lp = pt(i, 3.62), c = Math.cos(ang(i));
    const anchor = Math.abs(c) < 0.3 ? 'middle' : (c > 0 ? 'start' : 'end');
    g += `<text class="rlab" x="${lp[0]}" y="${lp[1]}" text-anchor="${anchor}"
      dominant-baseline="central" data-tipd="${esc(d)}|${rq.toFixed(1)}|${at.toFixed(1)}"
      >${esc(fit(d, 86, 11))}</text>`;
    g += `<text class="rlab2" x="${lp[0]}" y="${(+lp[1]+13).toFixed(1)}" text-anchor="${anchor}"
      dominant-baseline="central">${at.toFixed(1)} / ${rq.toFixed(1)}</text>`;
  });

  const gaps = axes.filter(d=> avg(byD[d],r=>r.req) - avg(byD[d],r=>r.att==null?0:r.att) >= 0.4);
  return `<svg viewBox="-268 -212 536 424" class="radar" role="img"
      aria-label="能力结构雷达图：${N} 个领域的行业要求与本校达成对比">${g}</svg>
    <div class="cmp-note">轴为能力领域，半径为该领域内能力项的<b>平均等级</b>（外圈 L3）。
      灰色轮廓是行业要求，紫色实心是本校达成，两者之间的空白就是缺口。
      ${gaps.length?`<b>${gaps.length}</b> 个领域平均差距 ≥ 0.4 级：${gaps.map(esc).join('、')}。`:'各领域平均差距均小于 0.4 级。'}</div>`;
}

/* ---- 缺口哑铃 ---- */
function dumbbellSVG(mode){
  const rows = cmpRows(mode).filter(r=>r.att!=null)
    .sort((a,b)=> b.gap-a.gap || b.req-a.req || a.a.name.localeCompare(b.a.name));
  if(!rows.length) return `<div class="cmp-empty">所选范围内还没有可对比的填报数据。</div>`;
  const RH = 22, L = 210, W = 660, X0 = L + 12, X1 = W - 46;
  const H = rows.length*RH + 34;
  const x = v => X0 + (v/3)*(X1-X0);
  let g = '';
  for(let v=0; v<=3; v++){
    g += `<line class="dgrid" x1="${x(v)}" y1="18" x2="${x(v)}" y2="${H-6}"></line>
      <text class="dtick" x="${x(v)}" y="10" text-anchor="middle">${v===0?'未开设':'L'+v}</text>`;
  }
  rows.forEach((r,i)=>{
    const y = 30 + i*RH;
    const gap = r.gap > 0;
    g += `<text class="dlab${gap?' gap':''}" x="${L}" y="${y}" text-anchor="end"
        dominant-baseline="central" data-abl="${r.a.id}">${esc(fit(r.a.name, L-14, 11.5))}${r.a.core?' ★':''}</text>`;
    g += `<line class="dtrack" x1="${x(0)}" y1="${y}" x2="${x(3)}" y2="${y}"></line>`;
    if(gap) g += `<line class="dgap" x1="${x(r.att)}" y1="${y}" x2="${x(r.req)}" y2="${y}"></line>`;
    g += `<circle class="datt" cx="${x(r.att)}" cy="${y}" r="4.5"
        data-tipa="${r.a.id}|${r.att}|${r.req}"></circle>`;
    g += `<circle class="dreq" cx="${x(r.req)}" cy="${y}" r="4.5"
        data-tipa="${r.a.id}|${r.att}|${r.req}"></circle>`;
    if(gap) g += `<text class="dnum" x="${X1+8}" y="${y}" dominant-baseline="central">−${r.gap}</text>`;
  });
  const withGap = rows.filter(r=>r.gap>0).length;
  return `<svg viewBox="0 0 ${W} ${H}" class="dumb" role="img"
      aria-label="能力缺口哑铃图：${rows.length} 条能力项的本校达成与行业要求对比">${g}</svg>
    <div class="cmp-note">每行一条能力项，按缺口从大到小排。空心点是<b>本校达成</b>，实心点是<b>行业要求</b>，
      中间红线就是差距。${withGap?`共 <b>${withGap}</b> 条存在缺口，最大差 ${rows[0].gap} 级。`:'所选范围内无缺口。'}</div>`;
}

function drawCmp(mode){
  const box = $(mode==='manual' ? '#cmpManual' : '#cmpAuto');
  if(!box) return;
  const v = cmpView[mode];
  box.querySelectorAll('.vs').forEach(b=>b.setAttribute('aria-pressed', String(b.dataset.cv===v)));
  $('.cmp-body', box).innerHTML = v==='radar' ? radarSVG(mode) : dumbbellSVG(mode);
}
function cmpCard(mode){
  return `<div class="card pad cmpcard" id="cmp${mode==='manual'?'Manual':'Auto'}" data-cmpmode="${mode}">
    <div class="cmp-h"><span class="eyebrow">能力结构对比</span>
      <span class="pill k">行业要求 vs 本校达成</span>
      <span style="flex:1"></span>
      <div class="viewsw"><button class="vs" data-cv="radar" aria-pressed="true">领域雷达</button>
        <button class="vs" data-cv="dumbbell" aria-pressed="false">缺口哑铃</button></div></div>
    <div class="cmp-body"></div>
    <div class="cmp-legend">
      <span class="bl"><i class="lg-req"></i>行业要求</span>
      <span class="bl"><i class="lg-att"></i>本校达成</span>
      <span class="bl"><i class="lg-gap"></i>缺口</span>
      <span class="bl" style="color:var(--muted)">部分覆盖按「该等级 − 0.5」计入</span>
    </div></div>`;
}
document.addEventListener('click', e=>{
  const b = e.target.closest('[data-cv]'); if(!b) return;
  const card = b.closest('[data-cmpmode]'); if(!card) return;
  cmpView[card.dataset.cmpmode] = b.dataset.cv;
  drawCmp(card.dataset.cmpmode);
});
document.addEventListener('mouseover', e=>{
  const d = e.target.closest('[data-tipd]');
  if(d){ const [n,rq,at] = d.dataset.tipd.split('|');
    tip.innerHTML = `<b>${esc(n)}</b><span class="tk">行业要求平均 ${rq} 级 · 本校达成平均 ${at} 级</span>
      <span class="tk">差距 ${(rq-at).toFixed(1)} 级</span>`;
    tip.classList.add('on'); return; }
  const a = e.target.closest('[data-tipa]');
  if(a){ const [id,att,req] = a.dataset.tipa.split('|');
    tip.innerHTML = `<b>${esc(abl[id].name)}</b>
      <span class="tk">本校达成 ${att==0?'未开设':'L'+att} · 行业要求 L${req}</span>
      <span class="tk">${esc(abl[id].domain)}${abl[id].core?' · 核心能力':''}</span>`;
    tip.classList.add('on'); }
});
