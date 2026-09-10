/* ═══ 4b. 四层能力全景 · 树形（连线图） ═══ */
const LV = {L1:1,L2:2,L3:3};
const builtSubs = subOrder;
// 上浮口径：被全部已建图子行业要求 = 全行业通用；子行业内半数以上岗位要求 = 该子行业共性
const isInd = new Set(D.abilities.filter(a=>a.acrossSubIndustries.length===builtSubs.length).map(a=>a.id));
const subSharedSet = {};
builtSubs.forEach(sid=>{
  const need = Math.max(2, Math.ceil(sub[sid].positionIds.length/2));
  subSharedSet[sid] = new Set(D.abilities.filter(a=>!isInd.has(a.id) &&
    a.requiredBy.filter(r=>pos[r.position].sub===sid).length >= need).map(a=>a.id));
});
function breakdown(pid){
  const p = pos[pid]; let ind=0, sh=0, own=0;
  p.abilities.forEach(r=>{
    if(isInd.has(r.ability)) ind++;
    else if(subSharedSet[p.sub].has(r.ability)) sh++;
    else own++;
  });
  return {ind, sh, own};
}

/* ---- 布局 ---- */
const GW = 812, ROWH = 23, TOP = 16;
const XI=[8,92], XS=[140,276], XP=[320,456], XA=[560,GW];
const GH = TOP*2 + (D.abilities.length-1)*ROWH + 24;

const posLayout = [];          // {id, y}
(function(){
  const n = D.positions.length, gaps = builtSubs.length-1;
  const span = GH - TOP*2 - 24;
  const step = span / (n - 1 + gaps*0.7);
  let y = TOP + 12, prev = null;
  builtSubs.forEach(sid=>{
    if(prev !== null) y += step*0.7;
    sub[sid].positionIds.forEach(pid=>{ posLayout.push({id:pid, y}); y += step; });
    prev = sid;
  });
  y -= step;
})();
const posY = Object.fromEntries(posLayout.map(p=>[p.id,p.y]));

// 能力项按「要求它的岗位的平均 y」排序，减少连线交叉
const ablOrder = D.abilities.slice().sort((a,b)=>{
  const my = x => x.requiredBy.reduce((s,r)=>s+posY[r.position],0)/x.requiredBy.length;
  return my(a)-my(b) || b.positionCount-a.positionCount;
});
const ablY = {};
ablOrder.forEach((a,i)=>{ ablY[a.id] = TOP + 12 + i*ROWH; });

const subY = {};
builtSubs.forEach(sid=>{
  const ys = sub[sid].positionIds.map(p=>posY[p]);
  subY[sid] = (Math.min(...ys)+Math.max(...ys))/2;
});
const pendSubs = D.subIndustries.filter(s=>!s.built);
pendSubs.forEach((s,i)=>{ subY[s.id] = GH - 26 - i*30; });
const indY = GH/2;

/* ---- 选中与联动 ---- */
let sel = {type:'sub', id:builtSubs[0]};
function activeSets(){
  const subs=new Set(), poss=new Set(), abls=new Set();
  if(!sel) return null;
  if(sel.type==='sub'){
    subs.add(sel.id);
    (sub[sel.id].positionIds||[]).forEach(p=>{ poss.add(p); pos[p].abilities.forEach(r=>abls.add(r.ability)); });
  } else if(sel.type==='pos'){
    poss.add(sel.id); subs.add(pos[sel.id].sub);
    pos[sel.id].abilities.forEach(r=>abls.add(r.ability));
  } else if(sel.type==='abl'){
    abls.add(sel.id);
    abl[sel.id].requiredBy.forEach(r=>{ poss.add(r.position); subs.add(pos[r.position].sub); });
  } else if(sel.type==='ind'){ return null; }
  return {subs, poss, abls};
}

function link(x1,y1,x2,y2){
  const dx = (x2-x1)*0.5;
  return `M ${x1} ${y1.toFixed(1)} C ${x1+dx} ${y1.toFixed(1)}, ${x2-dx} ${y2.toFixed(1)}, ${x2} ${y2.toFixed(1)}`;
}
const cls = (on)=> on===null ? '' : (on ? ' on' : ' off');

function renderGraph(){
  const A = activeSets();
  const sOn = id => A ? A.subs.has(id) : null;
  const pOn = id => A ? A.poss.has(id) : null;
  const aOn = id => A ? A.abls.has(id) : null;
  let links = '', nodes = '';

  // 行业 → 子行业
  D.subIndustries.forEach(s=>{
    links += `<path class="glink base${cls(sOn(s.id))}" d="${link(XI[1], indY, XS[0], subY[s.id])}"></path>`;
  });
  // 子行业 → 岗位
  posLayout.forEach(p=>{
    const sid = pos[p.id].sub;
    links += `<path class="glink base${cls(A ? (A.subs.has(sid)&&A.poss.has(p.id)) : null)}"
      d="${link(XS[1], subY[sid], XP[0], p.y)}"></path>`;
  });
  // 岗位 → 能力项（颜色 = 要求等级）
  posLayout.forEach(p=>{
    pos[p.id].abilities.forEach(r=>{
      const on = A ? (A.poss.has(p.id) && A.abls.has(r.ability)) : null;
      links += `<path class="glink lv${LV[r.level]}${cls(on)}" d="${link(XP[1], p.y, XA[0]-6, ablY[r.ability])}"></path>`;
    });
  });

  // 行业节点
  nodes += `<g class="gnode${sel&&sel.type==='ind'?' sel':''}" data-n="ind|${I.name}">
    <rect x="${XI[0]}" y="${indY-17}" width="${XI[1]-XI[0]}" height="34" rx="9"
      fill="var(--brand-soft)" stroke="var(--brand)"></rect>
    <text x="${(XI[0]+XI[1])/2}" y="${indY}" text-anchor="middle" dominant-baseline="central"
      class="gt gt-ind">${esc(I.name)}</text></g>`;

  // 子行业节点
  D.subIndustries.forEach(s=>{
    const on = sOn(s.id), w = XS[1]-XS[0];
    nodes += `<g class="gnode${cls(on)}${sel&&sel.type==='sub'&&sel.id===s.id?' sel':''}" data-n="sub|${s.id}">
      <rect x="${XS[0]}" y="${subY[s.id]-15}" width="${w}" height="30" rx="8"
        fill="${s.built?'var(--card-2)':'var(--card)'}" stroke="${s.built?'var(--rule)':'var(--rule)'}"
        ${s.built?'':'stroke-dasharray="3 3"'}></rect>
      <text x="${XS[0]+11}" y="${subY[s.id]}" dominant-baseline="central" class="gt">${esc(fit(s.name, w-46, 11.5))}</text>
      <text x="${XS[1]-10}" y="${subY[s.id]}" text-anchor="end" dominant-baseline="central"
        class="gt gt-n">${s.built? s.positionIds.length : '—'}</text></g>`;
  });

  // 岗位节点
  posLayout.forEach(p=>{
    const P = pos[p.id], on = pOn(p.id), w = XP[1]-XP[0];
    const nocov = SC.uncovered_positions.includes(p.id);
    nodes += `<g class="gnode${cls(on)}${sel&&sel.type==='pos'&&sel.id===p.id?' sel':''}${nocov?' nocovnode':''}" data-n="pos|${p.id}">
      <rect x="${XP[0]}" y="${p.y-14}" width="${w}" height="28" rx="8"
        fill="var(--card-2)" stroke="var(--rule)"></rect>
      <text x="${XP[0]+11}" y="${p.y}" dominant-baseline="central" class="gt">${esc(fit(P.name, w-44, 11.5))}</text>
      <text x="${XP[1]-10}" y="${p.y}" text-anchor="end" dominant-baseline="central"
        class="gt gt-n">${P.abilityCount}</text></g>`;
  });

  // 能力项节点
  ablOrder.forEach(a=>{
    const on = aOn(a.id), y = ablY[a.id];
    const gap = SC.uncovered_abilities.includes(a.id);
    const tier = isInd.has(a.id) ? '通用' : '';
    nodes += `<g class="gnode ab${cls(on)}${sel&&sel.type==='abl'&&sel.id===a.id?' sel':''}" data-n="abl|${a.id}">
      <rect x="${XA[0]-4}" y="${y-10}" width="${XA[1]-XA[0]+4}" height="20" rx="6"
        class="abbg"></rect>
      <circle cx="${XA[0]+4}" cy="${y}" r="3" fill="var(--${a.core?'brand':'muted'})"></circle>
      <text x="${XA[0]+14}" y="${y}" dominant-baseline="central" class="gt gt-ab">${esc(fit(a.name, 168, 11))}${a.core?' ★':''}</text>
      ${tier?`<text x="${XA[1]-42}" y="${y}" text-anchor="end" dominant-baseline="central" class="gt gt-tier">${tier}</text>`:''}
      ${gap?`<circle class="gapc" cx="${XA[1]-32}" cy="${y}" r="3" fill="var(--crit)"></circle>`:''}
      <text x="${XA[1]-4}" y="${y}" text-anchor="end" dominant-baseline="central" class="gt gt-n">×${a.positionCount}</text></g>`;
  });

  $('#posTree').innerHTML = `<svg viewBox="0 0 ${GW} ${GH}" preserveAspectRatio="xMidYMin meet"
    role="img" aria-label="四层能力全景树形图：行业、子行业、岗位、能力项四列，连线表示归属与能力要求">
    <g class="colhead">
      <text x="${XI[0]}" y="8" class="gch">行业</text>
      <text x="${XS[0]}" y="8" class="gch">子行业 ${D.subIndustries.length}</text>
      <text x="${XP[0]}" y="8" class="gch">岗位 ${D.positions.length}</text>
      <text x="${XA[0]}" y="8" class="gch">能力项 ${D.abilities.length}</text>
    </g>
    ${links}${nodes}</svg>`;
  renderSelBar(A);
}

function renderSelBar(A){
  let h = '';
  if(!sel){
    h = `<span class="sb-t">未选中</span>
      <span class="sb-d">点击任一节点：子行业与岗位向右追出关联能力，能力项向左反推出关联岗位与子行业</span>`;
  } else {
    const n = {sub:sub[sel.id], pos:pos[sel.id], abl:abl[sel.id], ind:{name:I.name}}[sel.type];
    const kind = {sub:'子行业', pos:'岗位', abl:'能力项', ind:'行业'}[sel.type];
    let meta = '';
    if(sel.type==='sub'){
      const b = sub[sel.id].positionIds.reduce((o,p)=>{const x=breakdown(p);return o;},null);
      meta = `<span class="pill k">${A.poss.size} 个岗位</span><span class="pill k">${A.abls.size} 条关联能力</span>`;
    } else if(sel.type==='pos'){
      const b = breakdown(sel.id);
      meta = `<span class="pill core">通用 ${b.ind}</span><span class="pill k">共性 ${b.sh}</span>
        <span class="pill good">本岗位 ${b.own}</span>`;
    } else if(sel.type==='abl'){
      const a = abl[sel.id];
      meta = `<span class="pill k">${A.poss.size} 个岗位要求</span>
        <span class="pill k">跨 ${A.subs.size} 个子行业</span>
        <span class="pill ${a.maxRequiredLevel==='L3'?'core':'k'}">最高 ${a.maxRequiredLevel}</span>
        ${a.core?'<span class="pill core">核心能力</span>':''}`;
    }
    h = `<span class="pill core">${kind}</span><span class="sb-t">${esc(n.name)}</span>${meta}
      <span style="flex:1"></span>
      ${sel.type!=='ind'?`<button class="chip" id="selDetail">查看详情</button>`:''}
      <button class="chip" id="selClear">清除选择</button>`;
  }
  $('#selBar').innerHTML = h;
}

renderGraph();

$('#posTree').addEventListener('click', e=>{
  const g = e.target.closest('[data-n]');
  if(!g){ sel = null; renderGraph(); return; }
  const [t,id] = g.dataset.n.split('|');
  if(t==='ind'){ sel = null; }
  else if(sel && sel.type===t && sel.id===id){ sel = null; }
  else { sel = {type:t, id}; }
  renderGraph();
});
$('#selBar').addEventListener('click', e=>{
  if(e.target.id==='selClear'){ sel = null; renderGraph(); return; }
  if(e.target.id==='selDetail' && sel){
    if(sel.type==='pos'){ const p=pos[sel.id];
      openDrawer('岗位 · '+p.id, p.name,
        `${sub[p.sub].name} · ${p.career_level} · 别名 ${p.aliases.join(' / ')}`, positionHTML(p));
    } else if(sel.type==='abl'){ const a=abl[sel.id];
      openDrawer('能力项 · '+a.id, a.name,
        `${a.typeCn} · ${a.domain} · ${a.core?'核心能力 · ':''}最高要求 ${a.maxRequiredLevel}`, abilityHTML(a));
    } else if(sel.type==='sub'){ const s=sub[sel.id];
      openDrawer('子行业 · '+s.id, s.name, `${s.priority} · ${s.positionIds.length} 个岗位`,
        `<div class="dr-s"><div class="dr-st">定位</div><div class="dr-def">${esc(s.desc)}</div></div>
         <div class="dr-s"><div class="dr-st">典型用人单位</div>
           ${s.typicalEmployers.map(x=>`<div class="arow"><span class="arow-n">${esc(x)}</span></div>`).join('')}</div>
         <div class="dr-s"><div class="dr-st">下辖岗位</div>
           ${s.positionIds.map(pid=>`<button class="arow" data-pos="${pid}">
             <span class="arow-n">${esc(pos[pid].name)}</span>
             <span class="pill k">${pos[pid].abilityCount} 条能力</span>
             <span class="arow-w">${pos[pid].l3Count} 条需 L3</span></button>`).join('')}</div>`);
    }
  }
});
$('#posTree').addEventListener('mouseover', e=>{
  const g = e.target.closest('[data-n]'); if(!g){ tip.classList.remove('on'); return; }
  const [t,id] = g.dataset.n.split('|');
  if(t==='sub'){ const s=sub[id];
    tip.innerHTML = `<b>${esc(s.name)}</b><span class="tk">${s.built?
      `${s.positionIds.length} 个岗位 · ${s.distinctAbilityCount} 条去重能力项`:'本期未建图'}</span>`;
  } else if(t==='pos'){ const p=pos[id], b=breakdown(id);
    tip.innerHTML = `<b>${esc(p.name)}</b><span class="tk">${esc(p.aliases.join(' / '))}</span>
      <span class="tk">通用 ${b.ind} · 共性 ${b.sh} · 本岗位 ${b.own}　${p.l3Count} 条需 L3</span>`;
  } else if(t==='abl'){ const a=abl[id];
    tip.innerHTML = `<b>${esc(a.name)}</b><span class="tk">${a.typeCn} · ${esc(a.domain)}</span>
      <span class="tk">${a.positionCount} 个岗位要求 · 最高 ${a.maxRequiredLevel}${a.core?' · 核心能力':''}</span>`;
  } else { tip.classList.remove('on'); return; }
  tip.classList.add('on');
});
$('#posTree').addEventListener('mouseleave', ()=>tip.classList.remove('on'));

$('#burstCard .viewsw').addEventListener('click', e=>{
  const b = e.target.closest('[data-bview]'); if(!b) return;
  const tree = b.dataset.bview==='tree';
  $('#burstCard').querySelectorAll('.vs').forEach(v=>v.setAttribute('aria-pressed', String(v===b)));
  $('#burst').hidden = tree;      $('#treeWrap').hidden = !tree;
  $('#ringLegend').hidden = tree; $('#treeLegend').hidden = !tree;
});

