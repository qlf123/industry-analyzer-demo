/* ===== 全景图谱子图（原型）=====
 * - 子图只存规则（起点 + 链路 + 筛选），打开时从大图谱实时取数，不存数据副本。
 * - 三类：权限子图（按数据权限自动确定）/ 场景子图（预设链路模板）/ 自定义子图（保存的规则，可分享）。
 * - 可见范围 = 子图范围 ∩ 用户权限；权限外的关联节点只提示数量。
 * - 默认跟随最新已发布版本，可锁定在保存时的版本。子图不能编辑结构。
 */
(function(){
  var G=window.PanoGraph,ctrl=document.getElementById('sgCtrl'),note=document.getElementById('sgNote');
  if(!G||!ctrl)return;
  var KEY='pano_subgraphs_v1',ROLE_KEY='pano_role';
  // 演示用视角：管理员看全部；教师按数据权限只看所在专业
  var ROLES={admin:{label:'平台管理员',majors:null},teacher:{label:'李老师 · 旅游管理',majors:['旅游管理']}};
  // 场景模板登记：赛、证、资源入图后新增模板即可
  var SCENES=[
    {id:'course',label:'课程图谱',ready:true},
    {id:'post',label:'岗位能力图谱',ready:false,wait:'能力点入图后开放'},
    {id:'comp',label:'备赛图谱',ready:false,wait:'赛项入图后开放'},
    {id:'cert',label:'考证图谱',ready:false,wait:'证书入图后开放'}
  ];
  var role=sessionStorage.getItem(ROLE_KEY)||'admin';
  // 图谱中心：视角跟随登录身份，不再手动切换
  var GC_ROLE=!!window.GC;
  if(GC_ROLE){ role=GC.teacher()?'teacher':'admin'; ROLES.teacher.label=GC.me()+' · 旅游管理'; }
  var saved=[];try{saved=JSON.parse(sessionStorage.getItem(KEY))||[]}catch(e){}
  var rule={kind:'all'},active=null;

  function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function persist(){try{sessionStorage.setItem(KEY,JSON.stringify(saved))}catch(e){}}
  function byId(id){return G.nodes[id]}
  function adj(){var a={};G.links.forEach(function(l){(a[l.source]=a[l.source]||[]).push(l.target);(a[l.target]=a[l.target]||[]).push(l.source)});return a}

  function permSet(){
    var r=ROLES[role],s={};
    G.nodes.forEach(function(n){if(!r.majors||r.majors.indexOf(n.major)>=0)s[n.id]=true});
    return s;
  }
  // 课程图谱：从课程出发取两跳（章节 / 知识点 → 技能 / 概念），不越过其他课程
  function scopeSet(r){
    var s={};
    if(r.kind!=='course'){G.nodes.forEach(function(n){s[n.id]=true});return s}
    var a=adj(),frontier=[r.courseId];s[r.courseId]=true;
    for(var depth=0;depth<2;depth++){
      var next=[];
      frontier.forEach(function(id){(a[id]||[]).forEach(function(nb){if(!s[nb]&&byId(nb).type!=='课程'){s[nb]=true;next.push(nb)}})});
      frontier=next;
    }
    return s;
  }
  function describe(r){return r.kind==='course'?'课程图谱 · '+byId(r.courseId).name:'整张图谱'}
  function majorsIn(ids){var m={};Object.keys(ids).forEach(function(id){var mj=byId(id).major;if(mj)m[mj]=true});return Object.keys(m)}
  function currentLock(ids){var l={};majorsIn(ids).forEach(function(m){if(window.PanoVersion)l[m]=PanoVersion.current(m).cur});return l}

  var lastVis=null;
  function apply(){
    var perm=permSet(),scope=scopeSet(rule),vis={},a=adj(),hidden={};
    Object.keys(scope).forEach(function(id){if(perm[id])vis[id]=true});
    // 权限外、但与可见节点直接相连的节点：只计数，不显示内容
    Object.keys(vis).forEach(function(id){(a[id]||[]).forEach(function(nb){if(!vis[nb]&&!perm[nb])hidden[nb]=true})});
    lastVis=vis;
    var full=rule.kind==='all'&&!ROLES[role].majors;
    G.setVisible(full?null:vis);
    var hn=Object.keys(hidden).length,msgs=[];
    if(ROLES[role].majors)msgs.push('按数据权限显示（'+ROLES[role].majors.join('、')+'）'+(hn?'，另有 <b>'+hn+'</b> 个关联节点无权限查看':''));
    if(rule.kind!=='all')msgs.push('子图：'+esc(describe(rule))+' · '+Object.keys(vis).length+' 个节点');
    if(active&&active.lock){
      var diff=Object.keys(active.lock).filter(function(m){return window.PanoVersion&&PanoVersion.current(m).cur!==active.lock[m]});
      msgs.push('锁定于 '+Object.keys(active.lock).map(function(m){return esc(m)+' '+active.lock[m]}).join('、')
        +(diff.length?'；当前已发布 '+diff.map(function(m){return esc(m)+' '+PanoVersion.current(m).cur}).join('、')+'，仍按锁定版本显示 <a href="javascript:;" id="sgFollow">改为跟随最新</a>':''));
    }
    note.innerHTML=msgs.join('<br>');note.style.display=msgs.length?'block':'none';
    var f=document.getElementById('sgFollow');if(f)f.onclick=function(){active.lock=null;persist();apply();toast('已改为跟随最新版本')};
    renderCtrl();
  }

  function renderCtrl(){
    var sel=active?'s:'+active.id:rule.kind==='course'?'course':'all';
    var opts='<option value="all">整张图谱</option><optgroup label="场景子图">'
      +SCENES.map(function(s){return '<option value="'+s.id+'"'+(s.ready?'':' disabled')+'>'+s.label+(s.ready?'…':'（'+s.wait+'）')+'</option>'}).join('')+'</optgroup>'
      +(saved.length?'<optgroup label="我的子图">'+saved.map(function(s){return '<option value="s:'+s.id+'">'+esc(s.name)+(s.lock?' 🔒':'')+'</option>'}).join('')+'</optgroup>':'');
    if(rule.kind==='course'&&!active)opts=opts.replace('<option value="course">课程图谱…','<option value="course">课程图谱 · '+esc(byId(rule.courseId).name));
    ctrl.innerHTML='<label class="sg-field">子图 <select id="sgSel">'+opts+'</select></label>'
      +'<button class="pv-btn" id="sgSave" type="button"'+(rule.kind==='all'&&!ROLES[role].majors?' disabled title="整张图谱无需保存"':'')+'>保存为子图</button>'
      +(GC_ROLE?'':'<label class="sg-field sg-role" title="演示用：切换查看视角">视角 <select id="sgRole">'+Object.keys(ROLES).map(function(k){return '<option value="'+k+'"'+(k===role?' selected':'')+'>'+ROLES[k].label+'</option>'}).join('')+'</select></label>');
    var s=document.getElementById('sgSel');s.value=sel;
    s.onchange=function(){
      var v=s.value;
      if(v==='all'){rule={kind:'all'};active=null;apply()}
      else if(v==='course'){pickCourse()}
      else if(v.indexOf('s:')===0){active=saved.filter(function(x){return 's:'+x.id===v})[0];rule=JSON.parse(JSON.stringify(active.rule));apply()}
    };
    document.getElementById('sgSave').onclick=openSave;
    if(document.getElementById('sgRole'))document.getElementById('sgRole').onchange=function(){role=this.value;try{sessionStorage.setItem(ROLE_KEY,role)}catch(e){}apply()};
  }

  // ---------- 弹窗 ----------
  var mask=document.createElement('div');mask.className='pv-mask';document.body.appendChild(mask);
  mask.addEventListener('click',function(e){if(e.target===mask)close()});
  function open(html){mask.innerHTML='<div class="pv-dialog sm">'+html+'</div>';mask.classList.add('show');mask.querySelectorAll('[data-close]').forEach(function(b){b.onclick=function(){close();renderCtrl()}})}
  function close(){mask.classList.remove('show');mask.innerHTML=''}
  function head(t,sub){return '<div class="pv-head"><div class="pv-head-top"><h2>'+t+'</h2><button class="pv-close" data-close>×</button></div>'+(sub?'<div class="pv-sub">'+sub+'</div>':'')+'</div>'}
  function toast(t){var el=document.getElementById('pvToast');if(!el){el=document.createElement('div');el.id='pvToast';el.style.cssText='position:fixed;left:50%;top:24px;transform:translateX(-50%);z-index:80;background:#1f2d46;color:#fff;padding:8px 16px;border-radius:8px;font-size:13px;display:none';document.body.appendChild(el)}el.textContent=t;el.style.display='block';clearTimeout(el._t);el._t=setTimeout(function(){el.style.display='none'},2400)}

  function pickCourse(){
    var courses=G.nodes.filter(function(n){return n.type==='课程'}),perm=permSet();
    open(head('场景子图 · 课程图谱','从一门课程出发，沿「课程 → 章节 / 知识点 → 技能」取出相关节点。子图只保存这条规则，打开时实时取数。')
      +'<div class="pv-body"><div class="pv-sec">'+courses.map(function(c){
        return '<label class="pv-src-row"><input type="radio" name="sgCourse" value="'+c.id+'"><span>'+esc(c.name)+'</span><span class="layer">'+esc(c.major)+'</span>'+(perm[c.id]?'':'<span class="latest">无权限，仅显示有权限的关联节点</span>')+'</label>';
      }).join('')+'</div></div>'
      +'<div class="pv-foot"><span class="pv-spacer"></span><button class="pv-btn" data-close>取消</button><button class="pv-btn pri" id="sgOk">打开子图</button></div>');
    document.getElementById('sgOk').onclick=function(){
      var r=mask.querySelector('input[name=sgCourse]:checked');if(!r)return;
      rule={kind:'course',courseId:+r.value};active=null;close();apply();
    };
  }

  function openSave(){
    var lock=currentLock(lastVis||{});
    var lockTxt=Object.keys(lock).map(function(m){return esc(m)+' '+lock[m]}).join('、')||'—';
    open(head('保存为子图','保存的是规则，不是数据副本：'+esc(describe(rule))+(ROLES[role].majors?'（打开时再按查看人的权限过滤）':'')+'。子图不能编辑节点和关系。')
      +'<div class="pv-body"><div class="pv-sec">'
      +'<div style="font-size:13px;color:#41536f;margin-bottom:6px">名称</div><input id="sgName" class="pv-input" value="'+esc(rule.kind==='course'?byId(rule.courseId).name+' 备课范围':'我的视图')+'">'
      +'<div style="font-size:13px;color:#41536f;margin:14px 0 6px">版本</div>'
      +'<label class="pv-src-row"><input type="radio" name="sgLock" value="follow" checked><span>跟随最新</span><span class="latest">各专业发布新版本后自动更新</span></label>'
      +'<label class="pv-src-row"><input type="radio" name="sgLock" value="lock"><span>锁定当前版本</span><span class="latest">'+lockTxt+'</span></label>'
      +'<div class="pv-note info" style="margin-top:10px">人培方案、备赛方案等需要固定口径的场景建议锁定。</div>'
      +'</div></div>'
      +'<div class="pv-foot"><span class="pv-spacer"></span><button class="pv-btn" data-close>取消</button><button class="pv-btn pri" id="sgOk">保存</button></div>');
    document.getElementById('sgOk').onclick=function(){
      var nm=document.getElementById('sgName').value.trim();if(!nm)return;
      var lk=mask.querySelector('input[name=sgLock]:checked').value==='lock'?lock:null;
      active={id:Date.now().toString(36),name:nm,rule:JSON.parse(JSON.stringify(rule)),lock:lk};
      saved.push(active);persist();close();apply();toast('已保存子图「'+nm+'」');
    };
  }

  apply();
})();
