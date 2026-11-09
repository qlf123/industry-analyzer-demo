/* ===== 全景图谱版本管理（原型）=====
 * 规则要点：
 * - 发布单元是专业：每个专业一套全景版本；平台大图谱（「全部」）与行业只汇总，不单独发版本。
 * - 来源：能力图谱（行业级共享、只读引用）/ 知识体系（专业）/ 标准库（赛项、证书）。全景图谱不建自己的节点。
 * - 骨架（来源节点 + 跨来源关系）进版本：同步先进草稿，人工发布生成新版本；已发布版本只读。
 * - 资源（知识库资料 / 教学资源）实时挂载在节点上，不随版本。
 * - 同一专业同时只有一份草稿；再次同步合并进草稿。
 * - 同步时做影响分析：节点停用 → 关系失效（发布时下线）、挂载资源悬挂（不自动删除）；等级变化 → 关系待复核；改名 → 保留。
 * - 发布前两级校验：覆盖率（阈值可按专业配置）、孤立节点、能力点无知识点阻止发布；失效 / 待复核 / 悬挂只提示。
 * - 回滚只切换该专业的当前版本，不回退来源图谱。
 */
(function(){
  var IND=sessionStorage.getItem('viewIndustry')||'';
  var IS_ALL=sessionStorage.getItem('viewTaskId')==='all'||!IND;

  // 行业 → 专业（发布单元）
  var MAJORS={'旅游业':['导游'],'电商行业':['电商运营'],'制造业':['智能制造'],'物流业':['现代物流管理'],'金融业':['金融科技'],'健康产业':['护理康养'],'教育业':['学前教育'],'传媒业':['新媒体运营'],'农业':['智慧农业']};
  function industryOf(major){for(var k in MAJORS)if(MAJORS[k].indexOf(major)>=0)return k;return IND||'旅游业'}

  // 来源登记：岗 / 课 / 赛 / 证
  var SOURCES=[
    {id:'ag',layer:'能力图谱',kind:'岗'},
    {id:'ks',layer:'知识体系',kind:'课'},
    {id:'comp',layer:'标准库 · 赛项',kind:'赛'},
    {id:'cert',layer:'标准库 · 证书',kind:'证'}
  ];
  var NONE='—';

  // 各专业的 mock：来源名称、初始版本、来源新版本带来的节点变化（rel=受影响关系，res=挂载资源）、覆盖率与映射缺口
  var PROFILE={
    '酒店管理':{
      names:{comp:'全国职业院校技能大赛 · 酒店服务',cert:'1+X 现代酒店服务质量管理'},
      base:84,gaps:[],
      seed:{cur:'v3',synced:{ag:'v1.4',ks:'v2.1',comp:NONE,cert:'2025 版'},latest:{ag:'v1.5',ks:'v2.2',comp:NONE,cert:'2025 版'},
        versions:[
          {v:'v3',time:'2026-10-12 15:20',by:'秦老师',manifest:{ag:'v1.4',ks:'v2.1',comp:NONE,cert:'2025 版'},sum:{nodeAdd:12,nodeOff:2,relAdd:36,relOff:3,review:0},note:'同步能力图谱 v1.4，补充 OTA 运营相关映射'},
          {v:'v2',time:'2026-09-02 10:05',by:'秦老师',manifest:{ag:'v1.3',ks:'v2.1',comp:NONE,cert:'2025 版'},sum:{nodeAdd:20,nodeOff:0,relAdd:58,relOff:1,review:0},note:'接入标准库 · 1+X 证书标准'},
          {v:'v1',time:'2026-07-18 16:40',by:'王强',manifest:{ag:'v1.3',ks:'v2.0',comp:NONE,cert:NONE},sum:{nodeAdd:186,nodeOff:0,relAdd:412,relOff:0,review:0},note:'首次发布'}
        ]},
      changes:{
        ag:[
          {id:'ag1',kind:'add',node:'短视频与直播讲解',type:'能力点',path:'旅游业 › 导游 › 能力点'},
          {id:'ag2',kind:'add',node:'定制旅行师',type:'岗位',path:'旅游业 › 旅行服务'},
          {id:'ag3',kind:'lv',node:'计调操作系统与订单处理',type:'能力点',path:'旅游业 › 旅行社计调',from:'L2',to:'L3',
            rel:[{id:'r1',a:'计调操作系统与订单处理',b:'旅游电子商务 · OTA 订单处理'},{id:'r2',a:'计调操作系统与订单处理',b:'旅行社计调实务 · 线路成本核算'}]},
          {id:'ag4',kind:'del',node:'传统门市接待',type:'能力点',path:'旅游业 › 旅行社门店',
            rel:[{id:'r3',a:'传统门市接待',b:'旅行社经营管理 · 门市服务规范'},{id:'r4',a:'传统门市接待',b:'旅游服务礼仪 · 柜台接待'}],
            res:[{id:'o1',name:'门市接待话术.pdf',kind:'知识库资料',owner:'旅游实训资料库'},{id:'o2',name:'门市接待实训视频.mp4',kind:'教学资源',owner:'张老师'},{id:'o3',name:'门市接待案例集.docx',kind:'知识库资料',owner:'旅游实训资料库'}]}
        ],
        ks:[
          {id:'ks1',kind:'add',node:'直播讲解技巧',type:'技能',path:'旅游电子商务 › 新媒体运营'},
          {id:'ks2',kind:'mod',node:'数字旅游电商',type:'课程',path:'专业核心课',from:'旅游电子商务'},
          {id:'ks3',kind:'del',node:'传统票务操作',type:'技能',path:'旅行社计调实务 › 票务',
            rel:[{id:'r5',a:'机票与火车票代订',b:'传统票务操作'}],
            res:[{id:'o4',name:'票务系统操作手册.pdf',kind:'知识库资料',owner:'旅游实训资料库'},{id:'o5',name:'票务操作微课.mp4',kind:'教学资源',owner:'李老师'}]}
        ]
      }
    },
    '导游':{
      names:{comp:'全国职业院校技能大赛 · 导游服务',cert:'1+X 研学旅行策划与管理'},
      base:78,gaps:['研学课程设计','导游词创作','游客投诉处理','景区数字化讲解'],
      seed:{cur:'v2',synced:{ag:'v1.5',ks:'v1.3',comp:'2026 年度',cert:NONE},latest:{ag:'v1.5',ks:'v1.4',comp:'2026 年度',cert:NONE},
        versions:[
          {v:'v2',time:'2026-10-20 09:30',by:'李老师',manifest:{ag:'v1.5',ks:'v1.3',comp:'2026 年度',cert:NONE},sum:{nodeAdd:8,nodeOff:0,relAdd:22,relOff:0,review:1},note:'同步能力图谱 v1.5，接入标准库 · 2026 年度导游服务赛项'},
          {v:'v1',time:'2026-08-05 14:10',by:'李老师',manifest:{ag:'v1.4',ks:'v1.3',comp:NONE,cert:NONE},sum:{nodeAdd:152,nodeOff:0,relAdd:301,relOff:0,review:0},note:'首次发布'}
        ]},
      changes:{
        ks:[
          {id:'tk1',kind:'add',node:'研学旅行课程设计',type:'任务',path:'研学旅行策划 › 课程设计'},
          {id:'tk2',kind:'del',node:'传统导游证考试辅导',type:'课程',path:'专业拓展课',
            rel:[{id:'tr1',a:'导游资格考试能力',b:'传统导游证考试辅导'}],
            res:[{id:'to1',name:'导游证真题汇编.pdf',kind:'知识库资料',owner:'旅游实训资料库'}]}
        ]
      }
    }
  };
  function profile(major){
    return PROFILE[major]||{names:{comp:'',cert:''},base:86,gaps:[],changes:{},
      seed:{cur:'v1',synced:{ag:'v1.0',ks:'v1.0',comp:NONE,cert:NONE},latest:{ag:'v1.0',ks:'v1.0',comp:NONE,cert:NONE},
        versions:[{v:'v1',time:'2026-09-28 11:00',by:'王强',manifest:{ag:'v1.0',ks:'v1.0',comp:NONE,cert:NONE},sum:{nodeAdd:120,nodeOff:0,relAdd:260,relOff:0,review:0},note:'首次发布'}]}};
  }
  function srcName(id,major){
    var p=profile(major);
    if(id==='ag')return '能力图谱「'+industryOf(major)+'」';
    if(id==='ks')return '知识体系「'+major+'」';
    return p.names[id]||'未接入';
  }
  var KIND_TXT={add:'新增',mod:'改名',lv:'等级变化',del:'停用'};
  var REATTACH=['短视频与直播讲解','旅行社经营管理 · 门店数字化','数字旅游电商','旅游服务礼仪','机票与火车票代订'];

  function keyOf(major){return 'pano_version_v2:'+major}
  function load(major){
    var st;try{st=JSON.parse(sessionStorage.getItem(keyOf(major)))}catch(e){}
    if(!st){st=JSON.parse(JSON.stringify(profile(major).seed));st.draft=null;st.orphans=[];st.threshold=80}
    return st;
  }
  function newerOf(st){return SOURCES.filter(function(s){return st.latest[s.id]!==NONE&&st.latest[s.id]!==st.synced[s.id]&&!(st.draft&&st.draft.sources[s.id])})}

  // 对外：列表页汇总、节点详情
  window.PanoVersion={
    majorsOf:function(ind){return MAJORS[ind]||[]},
    summary:function(ind){
      var ms=MAJORS[ind]||[],sync=0,draft=0;
      ms.forEach(function(m){var st=load(m);if(newerOf(st).length)sync++;if(st.draft)draft++});
      return {majors:ms.length,sync:sync,draft:draft};
    },
    current:function(major){var st=load(major);return {cur:st.cur,manifest:st.versions.filter(function(v){return v.v===st.cur})[0].manifest}},
    nodeSource:function(n){
      var major=n.major||'酒店管理',c=this.current(major);
      // 所属来源按节点真实 src 显示：ag=能力图谱 / ks=知识体系 / comp=赛项 / cert=证书 / self=全景自建
      var src=n.src||'ks';
      function ver(x){return x===NONE?'未接入':x}
      if(src==='ag')return {source:srcName('ag',major),sourceType:'能力图谱',sourceVer:ver(c.manifest.ag),panoVer:major+' '+c.cur+'（已发布）',href:'ability-graph.html'};
      if(src==='comp')return {source:srcName('comp',major),sourceType:'标准库 · 赛项',sourceVer:ver(c.manifest.comp),panoVer:major+' '+c.cur+'（已发布）',href:''};
      if(src==='cert')return {source:srcName('cert',major),sourceType:'标准库 · 证书',sourceVer:ver(c.manifest.cert),panoVer:major+' '+c.cur+'（已发布）',href:''};
      if(src==='self')return {source:'全景自建（老师补充，随全景版本发布）',sourceType:'能力地图',sourceVer:'—',panoVer:major+' '+c.cur+'（已发布）',href:'ability-graph.html'};
      return {source:srcName('ks',major),sourceType:'知识体系',sourceVer:ver(c.manifest.ks),panoVer:major+' '+c.cur+'（已发布）',href:'knowledge-system-detail.html'};
    }
  };
  if(!document.getElementById('pvBar'))return;

  var majors=IS_ALL?[]:(MAJORS[IND]||[IND]);
  var MAJOR=sessionStorage.getItem('pano_major:'+IND);
  if(majors.indexOf(MAJOR)<0)MAJOR=majors[0];
  var P,S;
  function use(major){MAJOR=major;P=profile(major);S=load(major);try{sessionStorage.setItem('pano_major:'+IND,major)}catch(e){}}
  if(!IS_ALL)use(MAJOR);
  function save(){try{sessionStorage.setItem(keyOf(MAJOR),JSON.stringify(S))}catch(e){}}
  function nowStr(){var d=new Date(),p=function(n){return(n<10?'0':'')+n};return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes())}
  function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function toast(t){var el=document.getElementById('pvToast');if(!el){el=document.createElement('div');el.id='pvToast';el.style.cssText='position:fixed;left:50%;top:24px;transform:translateX(-50%);z-index:80;background:#1f2d46;color:#fff;padding:8px 16px;border-radius:8px;font-size:13px;display:none';document.body.appendChild(el)}el.textContent=t;el.style.display='block';clearTimeout(el._t);el._t=setTimeout(function(){el.style.display='none'},2400)}
  function name(id){return srcName(id,MAJOR)}
  function isLatestCur(){return S.cur===S.versions[0].v}

  // ---------- 版本栏 ----------
  function draftPending(d){
    d=d||S.draft;if(!d)return 0;
    return d.review.filter(function(r){return!r.decision}).length+d.orphans.filter(function(o){return!o.decision}).length;
  }
  function renderBar(){
    var bar=document.getElementById('pvBar');
    if(IS_ALL)return renderAllBar(bar);
    var cur=S.versions.filter(function(v){return v.v===S.cur})[0];
    var h='<label class="pv-major" title="版本按专业发布；行业只是筛选入口">专业 <select id="pvMajor">'+majors.map(function(m){return '<option'+(m===MAJOR?' selected':'')+'>'+esc(m)+'</option>'}).join('')+'</select></label>';
    h+='<span class="pv-chip ver" title="已发布版本只读；使用方引用的是已发布版本">当前版本 <b>'+S.cur+'</b> · 已发布'+(isLatestCur()?'':'（已回滚）')+'</span>';
    // 顶部只显示标准库来源 chips；能力图谱 / 知识体系作为平台统一名称不在全景图谱顶部露出
    h+=SOURCES.filter(function(s){return s.id!=='ag'&&s.id!=='ks'}).map(function(s){
      var sv=cur.manifest[s.id],lt=S.latest[s.id];
      if(lt===NONE)return '<span class="pv-chip src off" title="该专业尚未接入此来源">'+s.layer+' 未接入</span>';
      var newer=sv!==lt,inDraft=S.draft&&S.draft.sources[s.id];
      var tip=name(s.id)+(s.id==='ag'?'（行业级共享来源，本专业只读引用）':'');
      return '<span class="pv-chip src" title="'+esc(tip)+'">'+s.layer+' '+esc(sv)+(newer?' <span class="new">→ '+esc(lt)+(inDraft?' 草稿中':' 可同步')+'</span>':' <span class="ok">✓</span>')+'</span>';
    }).join('');
    if(S.draft)h+='<span class="pv-chip draft" id="pvDraftChip">草稿 · '+draftPending()+' 项待处理</span>';
    if(S.orphans.length)h+='<span class="pv-chip orphan" id="pvOrphanChip">悬挂资源 '+S.orphans.length+'</span>';
    h+='<span class="pv-spacer"></span>';
    var n=newerOf(S).length;
    h+='<button class="pv-btn" id="pvHistBtn" type="button">版本记录</button>';
    h+='<button class="pv-btn pri" id="pvSyncBtn" type="button">'+(S.draft?'同步（合并进草稿）':'同步更新')+(n?'<span class="pv-dot">'+n+'</span>':'')+'</button>';
    if(S.draft)h+='<button class="pv-btn" id="pvOpenDraft" type="button">查看草稿</button>';
    bar.innerHTML=h;
    on('pvSyncBtn',openSync);on('pvHistBtn',openHistory);on('pvDraftChip',openDraft);on('pvOpenDraft',openDraft);on('pvOrphanChip',openOrphans);
    document.getElementById('pvMajor').onchange=function(){use(this.value);renderBar();toast('已切换到「'+MAJOR+'」的全景版本')};
  }
  function on(id,fn){var el=document.getElementById(id);if(el)el.onclick=fn}

  // 「全部」：平台大图谱 = 各专业当前已发布版本的合集，不单独发版本
  // 口径与列表页映射任务一致：只统计「映射完成」行业的专业（PanoTasks 提供行业状态）
  function allRows(){
    var done={};
    if(window.PanoTasks)PanoTasks.industries().forEach(function(g){if(g.latestStatus==='done')done[g.industry]=true});
    var rows=[],hasFilter=window.PanoTasks&&Object.keys(done).length>0;
    Object.keys(MAJORS).forEach(function(ind){
      if(hasFilter&&!done[ind])return;
      MAJORS[ind].forEach(function(m){var st=load(m);rows.push({ind:ind,major:m,st:st,newer:newerOf(st)})});
    });
    return rows;
  }
  function renderAllBar(bar){
    var rows=allRows(),sync=rows.filter(function(r){return r.newer.length}).length,draft=rows.filter(function(r){return r.st.draft}).length;
    bar.innerHTML='<span class="pv-chip ver">平台大图谱</span>'
      +'<span class="pv-chip src"><b>'+rows.length+'</b> 个专业已发布</span>'
      +(sync?'<span class="pv-chip draft" id="pvAllSync">'+sync+' 个专业有可同步更新</span>':'')
      +(draft?'<span class="pv-chip draft">'+draft+' 个专业有草稿</span>':'')
      +'<span class="pv-spacer"></span><button class="pv-btn" id="pvAllVer" type="button">各专业版本</button>';
    on('pvAllVer',openAllVersions);on('pvAllSync',openAllVersions);
  }
  function openAllVersions(){
    var rows=allRows();
    var h=rows.map(function(r){
      var man=r.st.versions.filter(function(v){return v.v===r.st.cur})[0].manifest;
      return '<div class="pv-item"><div class="main"><span class="name">'+esc(r.ind)+' › '+esc(r.major)+'</span> <span class="pv-ver-cur">'+r.st.cur+'</span>'
        +'<div class="pv-manifest" style="margin-top:6px">'+SOURCES.map(function(s){return man[s.id]===NONE?'':'<span>'+s.layer+' '+esc(man[s.id])+'</span>'}).join('')+'</div></div>'
        +'<div class="meta">'+(r.st.draft?'有草稿 · ':'')+(r.newer.length?'<span style="color:#dc6803">'+r.newer.map(function(s){return s.layer}).join('、')+' 可同步</span>':'来源均已同步')+'</div></div>';
    }).join('');
    open(head('各专业版本','同行业的专业只读引用同一个能力图谱，允许短期停在不同的能力图谱版本上。')
      +'<div class="pv-body"><div class="pv-sec">'+h+'</div></div>'
      +'<div class="pv-foot"><span class="pv-spacer"></span><button class="pv-btn" data-close>关闭</button></div>');
  }

  // ---------- 弹窗基础 ----------
  var mask=document.createElement('div');mask.className='pv-mask';document.body.appendChild(mask);
  mask.addEventListener('click',function(e){if(e.target===mask)close()});
  function open(html,sm){mask.innerHTML='<div class="pv-dialog'+(sm?' sm':'')+'">'+html+'</div>';mask.classList.add('show');mask.querySelectorAll('[data-close]').forEach(function(b){b.onclick=close})}
  function close(){mask.classList.remove('show');mask.innerHTML=''}
  function head(title,sub){return '<div class="pv-head"><div class="pv-head-top"><h2>'+title+'</h2><button class="pv-close" data-close>×</button></div>'+(sub?'<div class="pv-sub">'+sub+'</div>':'')+'</div>'}
  function confirmBox(title,body,okTxt,fn,danger){
    open(head(title)+'<div class="pv-body"><div style="font-size:13px;color:#41536f;line-height:1.8">'+body+'</div></div><div class="pv-foot"><span class="pv-spacer"></span><button class="pv-btn" data-close>取消</button><button class="pv-btn pri'+(danger?' danger':'')+'" id="pvOk">'+okTxt+'</button></div>',true);
    on('pvOk',function(){fn()});
  }

  // ---------- 同步预览（影响分析） ----------
  function analyze(ids){
    var nodes=[],review=[],invalid=[],orphans=[];
    ids.forEach(function(id){
      ((P.changes||{})[id]||[]).forEach(function(c){
        nodes.push(Object.assign({src:id},c));
        (c.rel||[]).forEach(function(r){
          if(c.kind==='del')invalid.push(Object.assign({src:id,why:'「'+c.node+'」已停用'},r));
          else review.push(Object.assign({src:id,why:'「'+c.node+'」等级 '+c.from+' → '+c.to+'，原映射可能达不到新要求',decision:null},r));
        });
        (c.res||[]).forEach(function(o){orphans.push(Object.assign({src:id,from:c.node,decision:null,target:''},o))});
      });
    });
    return {nodes:nodes,review:review,invalid:invalid,orphans:orphans};
  }
  function openSync(){
    var list=SOURCES.map(function(s){
      if(S.latest[s.id]===NONE)return '<label class="pv-src-row"><input type="checkbox" disabled><span class="layer">'+s.layer+'</span><span style="color:#8b99ac">未接入</span><span class="latest">在标准库导入后可接入</span></label>';
      var inDraft=S.draft&&S.draft.sources[s.id];
      var newer=S.latest[s.id]!==S.synced[s.id]&&!inDraft;
      return '<label class="pv-src-row"><input type="checkbox" data-src="'+s.id+'" '+(newer?'checked':'disabled')+'>'
        +'<span class="layer">'+s.layer+'</span><span>'+esc(name(s.id))+'</span>'
        +(newer?'<span class="arrow">'+esc(S.synced[s.id])+' →</span><span class="ver-new">'+esc(S.latest[s.id])+'</span><span class="latest">最新已确认版本</span>'
          :'<span class="latest">'+(inDraft?'已在草稿中（'+esc(S.latest[s.id])+'）':'已是最新（'+esc(S.synced[s.id])+'）')+'</span>')
        +'</label>';
    }).join('');
    open(head('同步更新 · '+esc(MAJOR),(S.draft?'当前已有草稿，本次同步将<b>合并进草稿</b>，不会生成第二份草稿。':'同步只会生成<b>草稿</b>，确认影响后再发布为新版本；发布前使用方仍看到当前版本 '+S.cur+'。')+'<br>仅可同步来源中<b>已确认</b>的版本；能力图谱为行业级共享来源，本专业同步不影响同行业其他专业。')
      +'<div class="pv-body"><div class="pv-sec"><h3>选择要同步的来源</h3>'+list+'</div><div id="pvImpact"></div></div>'
      +'<div class="pv-foot"><span class="pv-foot-note" id="pvSyncNote"></span><span class="pv-spacer"></span><button class="pv-btn" data-close>取消</button><button class="pv-btn pri" id="pvGen">'+(S.draft?'合并进草稿':'生成草稿')+'</button></div>');
    mask.querySelectorAll('[data-src]').forEach(function(cb){cb.onchange=renderImpact});
    renderImpact();
    on('pvGen',function(){
      var ids=checked();if(!ids.length)return;
      var a=analyze(ids);
      if(!S.draft)S.draft={created:nowStr(),sources:{},nodes:[],review:[],invalid:[],orphans:[],fixed:{}};
      ids.forEach(function(id){S.draft.sources[id]=S.latest[id]});
      ['nodes','review','invalid','orphans'].forEach(function(k){S.draft[k]=S.draft[k].concat(a[k])});
      save();renderBar();toast(Object.keys(S.draft.sources).length>ids.length?'已合并进草稿':'已生成草稿，请处理受影响项后发布');openDraft();
    });
  }
  function checked(){return [].slice.call(mask.querySelectorAll('[data-src]:checked')).map(function(c){return c.getAttribute('data-src')})}
  function renderImpact(){
    var ids=checked(),box=document.getElementById('pvImpact'),gen=document.getElementById('pvGen');
    gen.disabled=!ids.length;
    if(!ids.length){box.innerHTML='<div class="pv-sec"><div class="pv-empty">所有来源均已是最新，无需同步</div></div>';document.getElementById('pvSyncNote').textContent='';return}
    var a=analyze(ids);
    var add=a.nodes.filter(function(n){return n.kind==='add'}).length;
    var del=a.nodes.filter(function(n){return n.kind==='del'}).length;
    var mod=a.nodes.length-add-del;
    box.innerHTML='<div class="pv-sec"><h3>影响分析</h3><div class="pv-stats">'
      +stat(add,'新增节点')+stat(mod,'改名 / 等级变化')+stat(del,'停用节点',del?'bad':'')
      +stat(a.review.length,'关系待复核',a.review.length?'warn':'')+stat(a.invalid.length,'关系失效',a.invalid.length?'bad':'')
      +stat(a.orphans.length,'资源将悬挂',a.orphans.length?'bad':'')+'</div></div>'
      +'<div class="pv-sec"><h3>节点变化 <span class="cnt">'+a.nodes.length+'</span></h3>'
      +(a.nodes.length?a.nodes.map(function(n){
        var t='<span class="pv-tag '+n.kind+'">'+KIND_TXT[n.kind]+'</span><span class="name">'+esc(n.node)+'</span>';
        if(n.kind==='mod')t='<span class="pv-tag mod">改名</span><span class="name">'+esc(n.from)+' → '+esc(n.node)+'</span>';
        if(n.kind==='lv')t+=' <span class="meta">'+n.from+' → '+n.to+'</span>';
        var eff=n.kind==='add'?'不影响已有关系，计入映射缺口':n.kind==='mod'?'节点 ID 不变，关系与资源原样保留':n.kind==='lv'?(n.rel||[]).length+' 条关系待复核':(n.rel||[]).length+' 条关系失效，'+(n.res||[]).length+' 个资源悬挂';
        return '<div class="pv-item"><div class="main">'+t+'<div class="meta">'+n.type+' · '+esc(n.path)+' · 来自'+esc(name(n.src))+'</div></div><div class="meta">'+eff+'</div></div>';
      }).join(''):'<div class="pv-empty">来源有版本更新，但不涉及本专业的节点</div>')+'</div>';
    document.getElementById('pvSyncNote').textContent='停用的节点不会自动删除挂载资源，资源进入悬挂池待处理';
  }
  function stat(n,t,c){return '<div class="pv-stat '+(c||'')+'"><b>'+n+'</b><span>'+t+'</span></div>'}

  // ---------- 发布前校验 ----------
  function checks(d){
    d.fixed=d.fixed||{};
    var gapFixed=P.gaps.filter(function(g){return d.fixed['gap:'+g]}).length;
    var cov=P.base-d.invalid.length+gapFixed;
    var gaps=P.gaps.filter(function(g){return!d.fixed['gap:'+g]});
    var iso=d.nodes.filter(function(n){return n.kind==='add'&&n.type==='岗位'&&!d.fixed[n.id]});
    var noKnow=d.nodes.filter(function(n){return n.kind==='add'&&n.type==='能力点'&&!d.fixed[n.id]});
    var covOk=cov>=S.threshold;
    return {cov:cov,covOk:covOk,gaps:gaps,iso:iso,noKnow:noKnow,block:(covOk?0:1)+(iso.length?1:0)+(noKnow.length?1:0)};
  }
  function checkRow(ok,title,meta,items){
    return '<div class="pv-check '+(ok?'ok':'bad')+'"><div class="pv-check-top"><span class="pv-check-ic">'+(ok?'✓':'✕')+'</span><span class="name">'+title+'</span><span class="meta">'+meta+'</span></div>'+(items||'')+'</div>';
  }
  function fixItem(key,label,meta){
    return '<div class="pv-check-item"><span>'+esc(label)+' <span class="meta">'+meta+'</span></span><button class="pv-act" data-fix="'+esc(key)+'">去补充映射</button></div>';
  }
  function checkHtml(d){
    var c=checks(d),pr=d.review.filter(function(r){return!r.decision}).length,po=d.orphans.filter(function(o){return!o.decision}).length;
    var cov=checkRow(c.covOk,'映射覆盖率 '+c.cov+'%','阈值 '+S.threshold+'% · <a href="javascript:;" id="pvThr">调整阈值</a>',
      c.covOk?'':c.gaps.map(function(g){return fixItem('gap:'+g,g,'能力点未被任何课程 / 技能覆盖')}).join(''));
    var iso=checkRow(!c.iso.length,'无孤立节点',c.iso.length?c.iso.length+' 个':'',c.iso.map(function(n){return fixItem(n.id,n.node,n.type+' · 新增后没有任何关系')}).join(''));
    var nk=checkRow(!c.noKnow.length,'每个能力点至少关联 1 个知识点',c.noKnow.length?c.noKnow.length+' 个':'',c.noKnow.map(function(n){return fixItem(n.id,n.node,'新增能力点，尚未关联知识点')}).join(''));
    var warn='<div class="pv-check warn"><div class="pv-check-top"><span class="pv-check-ic">!</span><span class="name">提示项（不阻止发布）</span><span class="meta">关系失效 '+d.invalid.length+' · 未复核 '+pr+' · 未处理悬挂资源 '+po+'</span></div></div>';
    return '<div class="pv-sec"><h3>发布前校验 <span class="cnt">'+(c.block?c.block+' 项阻止发布':'可以发布')+'</span></h3><div class="pv-sec-desc">覆盖率、孤立节点、能力点无知识点会阻止发布；需回到映射审核台或来源图谱补充后再发布。</div>'+cov+iso+nk+warn+'</div>';
  }
  function bindChecks(d){
    mask.querySelectorAll('[data-fix]').forEach(function(b){b.onclick=function(){d.fixed[b.dataset.fix]=true;save();toast('已在映射审核台补充映射');openDraft()}});
    on('pvThr',function(){
      confirmBox('调整覆盖率阈值','<div>「'+esc(MAJOR)+'」发布前的映射覆盖率阈值：</div><div style="margin-top:8px"><input id="pvThrIn" type="number" min="50" max="100" value="'+S.threshold+'" style="width:80px;height:30px;border:1px solid #c9c2ef;border-radius:6px;padding:0 8px"> %</div><div class="pv-note info" style="margin-top:10px">默认 80%，按专业配置；调整会记入操作日志。</div>','保存',function(){
        var v=parseInt(document.getElementById('pvThrIn').value,10);if(v>=50&&v<=100){S.threshold=v;save()}openDraft();
      });
    });
  }

  // ---------- 草稿 ----------
  function openDraft(){
    var d=S.draft;if(!d)return;
    var srcTxt=Object.keys(d.sources).map(function(id){return name(id)+' '+S.synced[id]+' → '+d.sources[id]}).join('；');
    var pend=draftPending(),c=checks(d);
    var revHtml=d.review.length?d.review.map(function(r,i){
      return '<div class="pv-item"><div class="main"><span class="pv-tag lv">待复核</span><span class="name">'+esc(r.a)+'</span> ↔ '+esc(r.b)+'<div class="meta">'+esc(r.why)+'</div></div><div class="acts">'
        +'<button class="pv-act'+(r.decision==='keep'?' on':'')+'" data-rev="'+i+'" data-d="keep">保留</button>'
        +'<button class="pv-act'+(r.decision==='unlink'?' on gray':'')+'" data-rev="'+i+'" data-d="unlink">解除</button></div></div>';
    }).join(''):'<div class="pv-empty">无</div>';
    var invHtml=d.invalid.length?d.invalid.map(function(r){
      return '<div class="pv-item"><div class="main"><span class="pv-tag del">失效</span><span class="name">'+esc(r.a)+'</span> ↔ '+esc(r.b)+'<div class="meta">'+esc(r.why)+'，发布时自动下线，记入变更记录</div></div></div>';
    }).join(''):'<div class="pv-empty">无</div>';
    var orHtml=d.orphans.length?d.orphans.map(function(o,i){return orphanRow(o,i,'dor')}).join(''):'<div class="pv-empty">无</div>';
    open(head('全景草稿 · '+esc(MAJOR),'基于 '+S.cur+' · 创建于 '+d.created+' · 草稿仅建图人员可见，一个专业只保留一份草稿<br>本次来源：'+esc(srcTxt))
      +'<div class="pv-body">'+checkHtml(d)
      +'<div class="pv-sec"><h3>关系待复核 <span class="cnt">'+d.review.length+'</span></h3><div class="pv-sec-desc">来源节点改了等级或要求，原关系可能不再成立。未处理的按「保留」发布，并带待复核标记。</div>'+revHtml+'</div>'
      +'<div class="pv-sec"><h3>关系失效 <span class="cnt">'+d.invalid.length+'</span></h3>'+invHtml+'</div>'
      +'<div class="pv-sec"><h3>悬挂资源 <span class="cnt">'+d.orphans.length+'</span></h3><div class="pv-sec-desc">资源挂载的节点已停用。可重新挂载到其他节点或归档；未处理的发布后进入悬挂资源池，不会被删除。</div>'+orHtml+'</div>'
      +'</div>'
      +'<div class="pv-foot"><span class="pv-foot-note">'+(c.block?'<span style="color:#c72c2a">有 '+c.block+' 项校验未通过，暂不能发布</span>':(pend?'还有 '+pend+' 项提示未处理，可以先发布':'受影响项已全部处理'))+'</span><span class="pv-spacer"></span>'
      +'<button class="pv-btn danger" id="pvDiscard">丢弃草稿</button><button class="pv-btn pri" id="pvPublish"'+(c.block?' disabled':'')+'>发布为 '+nextVer()+'</button></div>');
    bindChecks(d);
    mask.querySelectorAll('[data-rev]').forEach(function(b){b.onclick=function(){var r=d.review[+b.dataset.rev];r.decision=r.decision===b.dataset.d?null:b.dataset.d;save();renderBar();openDraft()}});
    bindOrphanActs(d.orphans,'dor',function(){save();renderBar();openDraft()});
    on('pvDiscard',function(){confirmBox('丢弃草稿','丢弃后本次同步与草稿中的处理结果都会清除，来源图谱不受影响，可重新同步。','丢弃',function(){S.draft=null;save();renderBar();close();toast('草稿已丢弃')},true)});
    on('pvPublish',publish);
  }
  function nextVer(){return 'v'+(parseInt(S.versions[0].v.slice(1),10)+1)}
  function orphanRow(o,i,pfx){
    var acts;
    if(o.decision==='reattach')acts='<span class="pv-done">✓ 已挂载到「'+esc(o.target)+'」</span><button class="pv-act" data-'+pfx+'="'+i+'" data-d="undo">撤销</button>';
    else if(o.decision==='archive')acts='<span class="pv-done" style="color:#667085">已归档</span><button class="pv-act" data-'+pfx+'="'+i+'" data-d="undo">撤销</button>';
    else acts='<select class="pv-sel" data-'+pfx+'-sel="'+i+'"><option value="">重新挂载到…</option>'+REATTACH.map(function(n){return '<option>'+esc(n)+'</option>'}).join('')+'</select><button class="pv-act" data-'+pfx+'="'+i+'" data-d="archive">归档</button>';
    return '<div class="pv-item"><div class="main"><span class="pv-tag res">'+esc(o.kind)+'</span><span class="name">'+esc(o.name)+'</span><div class="meta">原挂载「'+esc(o.from)+'」已停用 · 资源负责人：'+esc(o.owner)+'</div></div><div class="acts">'+acts+'</div></div>';
  }
  function bindOrphanActs(arr,pfx,after){
    mask.querySelectorAll('[data-'+pfx+'-sel]').forEach(function(s){s.onchange=function(){if(!s.value)return;var o=arr[+s.getAttribute('data-'+pfx+'-sel')];o.decision='reattach';o.target=s.value;after()}});
    mask.querySelectorAll('[data-'+pfx+']').forEach(function(b){b.onclick=function(){var o=arr[+b.getAttribute('data-'+pfx)];if(b.dataset.d==='undo'){o.decision=null;o.target=''}else o.decision=b.dataset.d;after()}});
  }
  function publish(){
    var d=S.draft;if(checks(d).block)return;
    var pr=d.review.filter(function(r){return!r.decision}).length,po=d.orphans.filter(function(o){return!o.decision}).length;
    var v=nextVer();
    var body='将生成「'+esc(MAJOR)+'」全景版本 <b>'+v+'</b>，发布后不可修改，使用方会收到升级通知（不强制切换）。';
    if(pr||po)body+='<div class="pv-note" style="margin-top:10px">'+(pr?pr+' 条关系未复核，将按「保留」发布并带待复核标记。':'')+(po?(pr?'<br>':'')+po+' 个悬挂资源未处理，发布后进入悬挂资源池继续处理。':'')+'</div>';
    confirmBox('发布全景版本',body,'确认发布',function(){
      var man=Object.assign({},S.versions[0].manifest);
      Object.keys(d.sources).forEach(function(id){man[id]=d.sources[id];S.synced[id]=d.sources[id]});
      var add=d.nodes.filter(function(n){return n.kind==='add'}).length,off=d.nodes.filter(function(n){return n.kind==='del'}).length;
      var unl=d.review.filter(function(r){return r.decision==='unlink'}).length;
      var fixedN=Object.keys(d.fixed||{}).length;
      S.versions.unshift({v:v,time:nowStr(),by:(window.GC?GC.me():'秦老师'),manifest:man,sum:{nodeAdd:add,nodeOff:off,relAdd:fixedN,relOff:d.invalid.length+unl,review:pr},
        note:'同步 '+Object.keys(d.sources).map(function(id){return name(id)+' '+d.sources[id]}).join('、'),changes:d.nodes.map(function(n){return KIND_TXT[n.kind]+'「'+(n.kind==='mod'?n.from+' → ':'')+n.node+'」'})});
      S.orphans=S.orphans.concat(d.orphans.filter(function(o){return!o.decision}));
      S.cur=v;S.draft=null;save();renderBar();close();toast('已发布 '+MAJOR+' '+v);
    });
  }

  // ---------- 版本记录 / 对比 / 回滚 ----------
  var diffOpen={};
  function openHistory(){
    var cur=S.versions.filter(function(v){return v.v===S.cur})[0];
    var h=S.versions.map(function(v){
      var isCur=v.v===S.cur;
      var acts=isCur?'':'<button class="pv-act" data-diff="'+v.v+'">与当前对比</button><button class="pv-act" data-rb="'+v.v+'"'+(S.draft?' disabled title="存在草稿时不可切换版本"':'')+'>'+(v.v===S.versions[0].v?'恢复为当前':'回滚到此版本')+'</button>';
      var s=v.sum;
      var diff='';
      if(diffOpen[v.v]&&!isCur){
        diff='<div class="pv-diff">'+SOURCES.map(function(src){var a=v.manifest[src.id],b=cur.manifest[src.id];return src.layer+'：'+esc(a)+(a!==b?' <span class="chg">→ '+esc(b)+'（当前）</span>':'（相同）')}).join('<br>')
          +((v.changes||cur.changes)?'<br>节点变化：'+esc(((parseInt(v.v.slice(1))<parseInt(cur.v.slice(1))?cur.changes:v.changes)||['详见变更记录']).join('、')):'')+'</div>';
      }
      return '<div class="pv-ver'+(isCur?' cur':'')+'"><div class="pv-ver-top"><span class="pv-ver-no">'+v.v+'</span>'+(isCur?'<span class="pv-ver-cur">当前</span>':'')
        +'<span class="pv-ver-meta">'+v.time+' · '+esc(v.by)+' 发布</span><div class="acts">'+acts+'</div></div>'
        +'<div class="pv-manifest">'+SOURCES.map(function(src){return '<span>'+src.layer+' '+esc(v.manifest[src.id]===NONE?'未接入':v.manifest[src.id])+'</span>'}).join('')+'</div>'
        +'<div class="pv-ver-sum">'+esc(v.note)+' · 节点 <b>+'+s.nodeAdd+'</b> / 停用 <b>'+s.nodeOff+'</b> · 关系 <b>+'+s.relAdd+'</b> / 下线 <b>'+s.relOff+'</b>'+(s.review?' · 待复核 <b>'+s.review+'</b>':'')+'</div>'+diff+'</div>';
    }).join('');
    open(head('版本记录 · '+esc(MAJOR),'已发布版本只读，全部保留。回滚只切换本专业全景图谱的当前版本，<b>不会回退</b>能力图谱、知识体系、标准库等来源。')
      +'<div class="pv-body">'+(S.draft?'<div class="pv-note">当前有未发布草稿，发布或丢弃后才能切换版本。</div>':'')+h+'</div>'
      +'<div class="pv-foot"><span class="pv-foot-note">知识库资料、教学资源不随版本，按节点实时挂载</span><span class="pv-spacer"></span><button class="pv-btn" data-close>关闭</button></div>');
    mask.querySelectorAll('[data-diff]').forEach(function(b){b.onclick=function(){diffOpen[b.dataset.diff]=!diffOpen[b.dataset.diff];openHistory()}});
    mask.querySelectorAll('[data-rb]').forEach(function(b){b.onclick=function(){
      var v=b.dataset.rb;
      confirmBox('切换到 '+v,'「'+esc(MAJOR)+'」全景图谱当前版本将切换为 <b>'+v+'</b>，使用方会收到通知。<br>来源不回退；下次同步仍以各来源最新已确认版本为准。<br>挂在 '+v+' 中不存在节点上的资源会进入悬挂资源池。','确认切换',function(){S.cur=v;S.synced=Object.assign({},S.versions.filter(function(x){return x.v===v})[0].manifest);save();renderBar();close();toast('已切换到 '+v)});
    }});
  }

  // ---------- 悬挂资源池 ----------
  function openOrphans(){
    var pending=S.orphans;
    open(head('悬挂资源池 · '+esc(MAJOR),'资源原来挂载的节点在发布的版本中已停用。资源不会被自动删除，请重新挂载到其他节点或归档；处理后即时生效，不产生新版本。')
      +'<div class="pv-body"><div class="pv-sec">'+(pending.length?pending.map(function(o,i){return orphanRow(o,i,'por')}).join(''):'<div class="pv-empty">没有悬挂资源</div>')+'</div></div>'
      +'<div class="pv-foot"><span class="pv-spacer"></span><button class="pv-btn" data-close>关闭</button></div>');
    bindOrphanActs(pending,'por',function(){
      var done=pending.filter(function(o){return o.decision});
      S.orphans=pending.filter(function(o){return!o.decision});save();renderBar();
      if(done.length)toast(done[0].decision==='archive'?'已归档「'+done[0].name+'」':'已挂载到「'+done[0].target+'」');
      openOrphans();
    });
  }

  renderBar();
})();
