/* ======================================================================
   图谱「检查更新」：根据市场变化生成更新报告，人工逐条采纳后写入图谱
   能力图谱详情、知识体系详情共用。数据为前端 mock。

   GraphUpdate.mount({
     btn:'#checkUpdateBtn', title, scope, sources:[], lastChecked, steps:[],
     version:()=>'v1.3', disabled:()=>false|'原因',
     getItems:()=>[{id,kind,title,path,diff,desc,metrics,links,conf,impact,editName,note}],
     onApply:(accepted)=>'结果提示', toast:fn, storeKey,
     seedHist:[{time,from,version,scope,acc,ign,total,items:[{kind,name}]}]  // 历史报告 mock 初始数据
   })
   kind：add 新增 / modify 修改 / retire 建议下线 / gap 映射缺口
   ====================================================================== */
(function(){
  const KIND = { add:'新增', modify:'修改', retire:'建议下线', gap:'映射缺口' };
  const esc = s => String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const store = {
    get(k){ try{ return JSON.parse(localStorage.getItem(k)||'[]'); }catch(e){ return []; } },
    set(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} }
  };
  const nowStr = () => { const d=new Date(), p=n=>String(n).padStart(2,'0'); return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes()); };

  function mount(cfg){
    const btn = document.querySelector(cfg.btn);
    if(!btn) return;
    btn.classList.add('gu-btn');
    const histKey = cfg.storeKey + '-hist';
    const loadHist = () => store.get(histKey);
    if(cfg.seedHist && cfg.seedHist.length && !loadHist().length) store.set(histKey, cfg.seedHist);
    const mask = document.createElement('div');
    mask.className = 'gu-mask';
    mask.innerHTML = '<div class="gu-dialog" role="dialog" aria-modal="true" aria-label="'+esc(cfg.title)+'"></div>';
    document.body.appendChild(mask);
    const dlg = mask.firstChild;

    let items = [], decision = {}, names = {}, filter = 'all', confirming = false, open = {}, lastChecked = cfg.lastChecked, mode = 'report', wasChecked = false;
    const ignored = () => store.get(cfg.storeKey);
    const seenKey = cfg.storeKey + '-seen';
    const live = () => cfg.getItems().filter(x => !ignored().includes(x.id));

    // 历史更新报告入口（与「检查更新」按钮并列）
    const histBtn = document.createElement('button');
    histBtn.type = 'button';
    histBtn.className = btn.className;
    histBtn.style.marginLeft = '8px';
    histBtn.textContent = '历史报告';
    btn.insertAdjacentElement('afterend', histBtn);
    histBtn.onclick = () => { mode = 'history'; mask.classList.add('show'); renderHistory(); };

    // 定期检查结果：按钮角标提示待处理条数
    function refreshDot(){
      let dot = btn.querySelector('.gu-dot');
      const n = live().length;
      if(!n){ if(dot) dot.remove(); return; }
      if(!dot){ dot = document.createElement('span'); dot.className = 'gu-dot'; btn.appendChild(dot); }
      // 角标 = 全部待处理条数；「新增」= 上次打开报告后新出现的建议
      const seen = store.get(seenKey), fresh = live().filter(x => !seen.includes(x.id)).length;
      dot.textContent = n > 99 ? '99+' : n;
      btn.title = '共 '+n+' 项更新待处理' + (fresh ? '，其中 '+fresh+' 项为新增' : '');
    }

    function close(){ mask.classList.remove('show'); confirming = false; }
    mask.addEventListener('click', e => { if(e.target === mask) close(); });
    document.addEventListener('keydown', e => { if(e.key === 'Escape' && mask.classList.contains('show')) close(); });

    function head(withFilters){
      const counts = {all:items.length};
      items.forEach(x => counts[x.kind] = (counts[x.kind]||0)+1);
      return `<div class="gu-head">
        <div class="gu-head-top"><h2>${esc(cfg.title)}</h2><span class="gu-ver">当前 ${esc(cfg.version())}</span>
          ${withFilters ? '<span class="gu-head-spacer"></span><button class="gu-head-hist" data-gu="history">历史报告</button>' : ''}
          <button class="gu-close" data-gu="close" aria-label="关闭">×</button></div>
        <div class="gu-meta"><b>检查范围</b>　${esc(cfg.scope)}　·　<b>上次检查</b>　${esc(lastChecked)}<br>
          <b>数据来源</b>　${cfg.sources.map(s=>`<span class="gu-src">${esc(s)}</span>`).join('')}</div>
        ${withFilters ? `<div class="gu-filters">${['all','add','modify','retire','gap'].filter(k=>k==='all'||counts[k]).map(k=>
          `<button class="gu-chip ${filter===k?'on':''}" data-gu="filter" data-v="${k}">${k==='all'?'全部':KIND[k]} ${counts[k]}</button>`).join('')}</div>` : ''}
      </div>`;
    }

    function card(x){
      const d = decision[x.id];
      const conf = Math.round(x.conf*100);
      const nameEdit = x.editName && d === 'acc'
        ? `<div class="gu-diff">名称 <input class="gu-name-input" data-gu-name="${x.id}" value="${esc(names[x.id]!=null?names[x.id]:x.editName)}"></div>` : '';
      return `<div class="gu-card ${d||''}">
        <div class="gu-top"><span class="gu-type ${x.kind}">${KIND[x.kind]}</span><span class="gu-title">${esc(x.title)}</span>
          <span class="gu-conf">置信度 <b class="${conf<85?'mid':''}">${conf}%</b></span></div>
        <div class="gu-path">${esc(x.path)}</div>
        ${x.diff ? `<div class="gu-diff">${esc(x.diff.label||'')}<span class="gu-old">${esc(x.diff.from)}</span>→<span class="gu-new">${esc(x.diff.to)}</span></div>` : ''}
        ${x.desc ? `<div class="gu-desc">${esc(x.desc)}</div>` : ''}
        ${nameEdit}
        ${x.metrics && x.metrics.length ? `<div class="gu-ev">${x.metrics.map(m=>`<div class="gu-metric"><b>${esc(m.v)}${m.trend?`<span class="${m.dir==='down'?'gu-down':'gu-up'}">${m.dir==='down'?'↓':'↑'} ${esc(m.trend)}</span>`:''}</b><span>${esc(m.label)}</span></div>`).join('')}</div>` : ''}
        ${x.note ? `<div class="gu-note">${esc(x.note)}</div>` : ''}
        ${open[x.id] ? `<div class="gu-links">${x.links.map(l=>'· '+esc(l)).join('<br>')}</div>` : ''}
        <div class="gu-foot-row">
          ${x.impact ? `<span class="gu-impact">影响 <b>${esc(x.impact)}</b></span>` : ''}
          ${x.links && x.links.length ? `<button class="gu-more" data-gu="links" data-v="${x.id}">${open[x.id]?'收起':'查看'}证据来源（${x.links.length}）</button>` : ''}
          <div class="gu-acts">
            <button class="gu-act acc ${d==='acc'?'on':''}" data-gu="acc" data-v="${x.id}">${d==='acc'?'✓ 已采纳':'采纳'}</button>
            <button class="gu-act ign ${d==='ign'?'on':''}" data-gu="ign" data-v="${x.id}">${d==='ign'?'已忽略':'忽略'}</button>
          </div>
        </div>
      </div>`;
    }

    function foot(){
      const acc = items.filter(x=>decision[x.id]==='acc').length;
      const ign = items.filter(x=>decision[x.id]==='ign').length;
      const rest = items.length - acc - ign;
      const high = items.filter(x=>x.conf>=.85 && !decision[x.id]).length;
      if(confirming) return `<div class="gu-foot"><span class="gu-count">将采纳 <b>${acc}</b> 项并生成新版本；忽略的 <b>${ign}</b> 项下次不再提示；未处理的 <b>${rest}</b> 项保留到下次检查。</span>
        <span class="gu-spacer"></span><button class="gu-btn-ghost" data-gu="back">返回</button><button class="gu-btn-pri" data-gu="apply">确认应用</button></div>`;
      return `<div class="gu-foot"><span class="gu-count">已采纳 <b>${acc}</b> · 已忽略 <b>${ign}</b> · 待处理 <b>${rest}</b></span>
        <button class="gu-more" data-gu="high" ${high?'':'disabled style="color:#b4bdcb;cursor:default"'}>采纳全部高置信（≥85%，${high} 项）</button>
        <span class="gu-spacer"></span><button class="gu-btn-ghost" data-gu="close">稍后处理</button>
        <button class="gu-btn-pri" data-gu="confirm" ${acc||ign?'':'disabled'}>应用更新</button></div>`;
    }

    function render(){
      const list = items.filter(x => filter==='all' || x.kind===filter);
      dlg.innerHTML = head(true) + `<div class="gu-body">${list.map(card).join('')}</div>` + foot();
    }

    function histCard(h){
      const itemsHtml = (h.items||[]).map(x => `<span class="gu-type ${x.kind}">${KIND[x.kind]||x.kind}</span><span class="gu-hist-name">${esc(x.name||x.title)}</span>`).join('');
      const ver = esc(h.version);
      return `<div class="gu-hist">
        <div class="gu-hist-top"><span class="gu-hist-time">${esc(h.time)}</span><span class="gu-ver">${ver}</span></div>
        <div class="gu-hist-scope">${esc(h.scope||'')}</div>
        <div class="gu-hist-stats">采纳 <b>${h.acc||0}</b> 项 · 忽略 <b>${h.ign||0}</b> 项 · 共 <b>${h.total||0}</b> 项</div>
        ${itemsHtml ? `<div class="gu-hist-items">${itemsHtml}</div>` : ''}
      </div>`;
    }
    function renderHistory(){
      const list = loadHist();
      dlg.innerHTML = `<div class="gu-head">
        <div class="gu-head-top"><h2>历史更新报告</h2><button class="gu-close" data-gu="close" aria-label="关闭">×</button></div>
        <div class="gu-meta"><b>检查范围</b>　${esc(cfg.scope)}　·　共 ${list.length} 份报告（数据保存在本机浏览器）</div>
      </div>
      <div class="gu-body">${list.length ? list.slice().reverse().map(histCard).join('') : '<div class="gu-empty"><b>暂无历史报告</b>完成并应用一次「检查更新」后，会在这里留下记录。</div>'}</div>
      <div class="gu-foot"><span class="gu-spacer"></span><button class="gu-btn-ghost" data-gu="back-report">返回检查更新</button><button class="gu-btn-pri" data-gu="close">关闭</button></div>`;
    }

    function check(){
      const why = cfg.disabled && cfg.disabled();
      if(why){ cfg.toast(why); return; }
      mask.classList.add('show');
      btn.disabled = true;
      let i = 0;
      const tick = () => {
        dlg.innerHTML = head(false) + `<div class="gu-loading"><div class="gu-spin"></div><div>正在检查更新…</div>
          <div class="gu-steps">${cfg.steps.map((s,k)=>`<span class="${k<i?'done':k===i?'cur':''}">${k<i?'✓':k===i?'●':'○'} ${esc(s)}</span>`).join('')}</div></div>`;
        if(i++ < cfg.steps.length){ setTimeout(tick, 450); return; }
        btn.disabled = false;
        lastChecked = '刚刚';
        items = live(); decision = {}; names = {}; filter = 'all'; confirming = false; open = {}; mode = 'report'; wasChecked = true;
        if(!items.length){
          dlg.innerHTML = head(false) + `<div class="gu-empty"><b>已是最新</b>与上次检查相比，市场数据没有达到更新门槛的变化。<br>系统每月自动检查一次，发现变化会在按钮上提示。</div>
            <div class="gu-foot"><span class="gu-spacer"></span><button class="gu-btn-pri" data-gu="close">知道了</button></div>`;
          return;
        }
        store.set(seenKey, Array.from(new Set(store.get(seenKey).concat(items.map(x => x.id)))));
        refreshDot();
        render();
      };
      tick();
    }

    dlg.addEventListener('input', e => { const id = e.target.dataset.guName; if(id) names[id] = e.target.value; });
    dlg.addEventListener('click', e => {
      const el = e.target.closest('[data-gu]'); if(!el) return;
      const a = el.dataset.gu, v = el.dataset.v;
      if(a==='close') return close();
      if(a==='history'){ mode = 'history'; renderHistory(); return; }
      if(a==='back-report'){ mode = 'report'; if(items.length) render(); else check(); return; }
      if(a==='filter') filter = v;
      else if(a==='acc' || a==='ign') decision[v] = decision[v]===a ? undefined : a;
      else if(a==='links') open[v] = !open[v];
      else if(a==='high') items.forEach(x => { if(x.conf>=.85 && !decision[x.id]) decision[x.id]='acc'; });
      else if(a==='confirm'){
        const blank = items.find(x => decision[x.id]==='acc' && x.editName && !(names[x.id]!=null?names[x.id]:x.editName).trim());
        if(blank){ cfg.toast('请填写「'+blank.title+'」的名称'); return; }
        confirming = true;
      }
      else if(a==='back') confirming = false;
      else if(a==='apply'){
        const accepted = items.filter(x=>decision[x.id]==='acc').map(x => Object.assign({}, x, {name: x.editName ? (names[x.id]!=null?names[x.id]:x.editName).trim() : undefined}));
        const ignCount = items.filter(x=>decision[x.id]==='ign').length;
        store.set(cfg.storeKey, ignored().concat(items.filter(x=>decision[x.id]==='ign').map(x=>x.id)));
        const from = cfg.version();
        const msg = accepted.length ? cfg.onApply(accepted) : '已忽略 '+ignCount+' 项，图谱未变化';
        const hist = loadHist();
        hist.push({ time: nowStr(), from: from, version: cfg.version(), scope: cfg.scope, acc: accepted.length, ign: ignCount, total: items.length, items: accepted.map(x => ({kind:x.kind, title:x.title, name:x.name||x.title})) });
        store.set(histKey, hist.slice(-50));
        close(); refreshDot(); cfg.toast(msg);
        return;
      }
      render();
    });

    btn.onclick = check;
    refreshDot();
    return { refreshDot };
  }

  window.GraphUpdate = { mount };
})();
