/* ===== 来源图谱节点「停用」与影响提示（能力图谱详情 / 知识体系详情共用，原型）=====
 * - 被全景图谱引用的节点不能删除，只能停用；未被引用的（如本次新增、尚未同步）仍可删除。
 * - 停用前提示影响范围：下级节点、映射关系、挂载资源、涉及专业；确认后生成影响分析记录。
 * - 停用保留节点 ID 与历史，可恢复启用；全景图谱在各专业下次同步时生成草稿，失效关系发布时下线。
 * 依赖 pano-version.css 的弹窗样式（pv-mask / pv-dialog）。
 */
(function(){
  var LOG_KEY='node_retire_log_v1';
  var RES_POOL=[
    {name:'讲解词范例.pdf',kind:'知识库资料'},{name:'实训操作视频.mp4',kind:'教学资源'},{name:'课堂课件.pptx',kind:'课件'},
    {name:'单元教案.docx',kind:'教案'},{name:'典型案例集.docx',kind:'知识库资料'},{name:'随堂测验题',kind:'题目'}
  ];
  function hash(s){var h=0;for(var i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;return h}
  function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}

  // 影响范围（mock，按节点名稳定生成）
  function impact(o){
    var h=hash(o.name),maps=1+h%4+(o.subCount||0),n=h%3+1,res=[];
    for(var i=0;i<n;i++){var r=RES_POOL[(h+i*7)%RES_POOL.length];res.push({name:o.name+' · '+r.name,kind:r.kind,partial:i===0&&n>1})}
    return {maps:maps,res:res,majors:o.majors||[]};
  }

  var mask;
  function open(o){
    if(!mask){mask=document.createElement('div');mask.className='pv-mask';document.body.appendChild(mask);mask.addEventListener('click',function(e){if(e.target===mask)close()})}
    var im=impact(o),hang=im.res.filter(function(r){return!r.partial}).length;
    var stats='<div class="pv-stats">'
      +(o.subCount?'<div class="pv-stat warn"><b>'+o.subCount+'</b><span>下级节点一并停用</span></div>':'')
      +'<div class="pv-stat bad"><b>'+im.maps+'</b><span>映射关系将失效</span></div>'
      +'<div class="pv-stat bad"><b>'+hang+'</b><span>资源将悬挂</span></div>'
      +'<div class="pv-stat"><b>'+(im.res.length-hang)+'</b><span>资源仍挂在其他节点</span></div>'
      +'<div class="pv-stat"><b>'+im.majors.length+'</b><span>涉及专业</span></div></div>';
    var res=im.res.map(function(r){
      return '<div class="pv-item"><div class="main"><span class="pv-tag res">'+esc(r.kind)+'</span><span class="name">'+esc(r.name)+'</span>'
        +'<div class="meta">'+(r.partial?'还挂在其他节点上，只下线这一条挂载':'只挂在该节点上，发布后进入悬挂资源池（不删除）')+'</div></div></div>';
    }).join('');
    mask.innerHTML='<div class="pv-dialog sm" style="width:min(560px,100%)">'
      +'<div class="pv-head"><div class="pv-head-top"><h2>停用'+esc(o.typeLabel)+'「'+esc(o.name)+'」</h2><button class="pv-close" data-close>×</button></div>'
      +'<div class="pv-sub">该节点已被全景图谱引用，不能删除，只能停用。停用后保留节点 ID 和历史，可随时恢复启用。</div></div>'
      +'<div class="pv-body"><div class="pv-sec"><h3>影响范围</h3>'+stats
      +(im.majors.length?'<div class="pv-sec-desc" style="margin:8px 0 0">涉及专业：'+im.majors.map(esc).join('、')+'</div>':'')+'</div>'
      +'<div class="pv-sec"><h3>挂载的资源 <span class="cnt">'+im.res.length+'</span></h3>'+res+'</div>'
      +'<div class="pv-sec"><h3>停用原因 <span class="cnt">选填，记入影响分析记录</span></h3><input id="nrReason" class="pv-input" placeholder="如：岗位已被新职业替代"></div>'
      +'<div class="pv-note info">停用在本图谱中立即生效；全景图谱不会直接改动已发布版本，各专业下次同步时生成草稿，失效关系在发布时下线。</div>'
      +'</div><div class="pv-foot"><span class="pv-spacer"></span><button class="pv-btn" data-close>取消</button><button class="pv-btn pri danger" id="nrOk">确认停用</button></div></div>';
    mask.classList.add('show');
    mask.querySelectorAll('[data-close]').forEach(function(b){b.onclick=close});
    document.getElementById('nrOk').onclick=function(){
      var reason=document.getElementById('nrReason').value.trim();
      log({time:new Date().toISOString(),graph:o.graph||'',node:o.name,type:o.typeLabel,subCount:o.subCount||0,maps:im.maps,res:im.res.length,hang:hang,majors:im.majors,reason:reason});
      close();o.onConfirm&&o.onConfirm(reason);
    };
  }
  function close(){if(mask){mask.classList.remove('show');mask.innerHTML=''}}
  function log(rec){try{var a=JSON.parse(sessionStorage.getItem(LOG_KEY))||[];a.unshift(rec);sessionStorage.setItem(LOG_KEY,JSON.stringify(a))}catch(e){}}

  window.NodeRetire={impact:impact,open:open,log:function(){try{return JSON.parse(sessionStorage.getItem(LOG_KEY))||[]}catch(e){return[]}}};
})();
