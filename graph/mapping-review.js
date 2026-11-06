// 可选的知识体系节点列表
const sourceNodeOptions = [
  {value:'KNP-19|投诉四要素与记录表填写规范|知识点', label:'KNP-19 投诉四要素与记录表填写规范', type:'知识点'},
  {value:'KNP-39|讲解时长与行程节点的匹配规则|知识点', label:'KNP-39 讲解时长与行程节点的匹配规则', type:'知识点'},
  {value:'SKS-09|投诉要素倾听与记录|技能规范', label:'SKS-09 投诉要素倾听与记录', type:'技能规范'},
  {value:'SKS-10|情绪安抚与复述确认|技能规范', label:'SKS-10 情绪安抚与复述确认', type:'技能规范'},
  {value:'SKS-12|补偿方案设计与书面确认|技能规范', label:'SKS-12 补偿方案设计与书面确认', type:'技能规范'},
  {value:'SKS-14|应急上报与事件记录|技能规范', label:'SKS-14 应急上报与事件记录', type:'技能规范'},
  {value:'SKS-16|讲解词结构编排|技能规范', label:'SKS-16 讲解词结构编排', type:'技能规范'},
  {value:'CAS-05|五分钟内完成情绪安抚的成功处置|案例', label:'CAS-05 五分钟内完成情绪安抚的成功处置', type:'案例'},
];

// 可选的能力项列表
const targetAbilityOptions = [
  {value:'ABL-07|客诉情绪安抚与共情表达', label:'ABL-07 客诉情绪安抚与共情表达'},
  {value:'ABL-08|补偿方案设计与权限判断', label:'ABL-08 补偿方案设计与权限判断'},
  {value:'ABL-11|突发事件现场处置与上报', label:'ABL-11 突发事件现场处置与上报'},
  {value:'ABL-04|现场讲解与节奏控制', label:'ABL-04 现场讲解与节奏控制'},
  {value:'ABL-03|导游讲解词编创', label:'ABL-03 导游讲解词编创'},
];

// 初始化模糊搜索下拉框
function initSearchSelect(inputId, dropdownId, hiddenId, options) {
  const input = document.getElementById(inputId);
  const dropdown = document.getElementById(dropdownId);
  const hidden = document.getElementById(hiddenId);
  if(!input || !dropdown) return;

  function renderDropdown(query) {
    const q = query.trim().toLowerCase();
    const filtered = q ? options.filter(o => o.label.toLowerCase().includes(q)) : options;
    if(!filtered.length) {
      dropdown.innerHTML = '<div class="search-select-empty">无匹配结果</div>';
      dropdown.style.display = 'block';
      return;
    }
    dropdown.innerHTML = filtered.map(o => '<div class="search-select-option" data-value="'+o.value+'" data-label="'+o.label+'">'+o.label+'<span class="search-select-type">'+(o.type||'')+'</span></div>').join('');
    dropdown.style.display = 'block';
    dropdown.querySelectorAll('.search-select-option').forEach(el => {
      el.onmousedown = function(e) {
        e.preventDefault();
        input.value = el.dataset.label;
        hidden.value = el.dataset.value;
        dropdown.style.display = 'none';
      };
    });
  }

  input.onfocus = () => renderDropdown(input.value);
  input.oninput = () => { hidden.value=''; renderDropdown(input.value); };
  input.onblur = () => { setTimeout(() => { dropdown.style.display='none'; }, 200); };
}


const records = [
  {id:'MAP-ABL07-KNP19',sourceType:'知识点',sourceId:'KNP-19',sourceName:'投诉四要素与记录表填写规范',sourceText:'记录表需完整填写投诉时间、地点、事由、诉求四项要素。',targetId:'ABL-07',targetName:'客诉情绪安抚与共情表达',course:'CRS-02 导游实务',relation:'partial_support',relationLabel:'部分支撑',level:'L1',confidence:.95,evidence:'对应 L1 观察点“记录表四项要素填写完整”，但不覆盖情绪安抚行为。',ks:'旅游管理专业知识体系 V1.0',ag:'旅游行业能力图谱 V1.0',status:'pending'},
  {id:'MAP-ABL07-SKS09',sourceType:'技能规范',sourceId:'SKS-09',sourceName:'投诉要素倾听与记录',sourceText:'能在投诉场景中耐心倾听游客陈述，完整记录时间、地点、事由、诉求四项投诉要素。',targetId:'ABL-07',targetName:'客诉情绪安抚与共情表达',course:'CRS-02 导游实务',relation:'direct_support',relationLabel:'直接支撑',level:'L1',confidence:.95,evidence:'与 L1“全程不打断游客陈述，并按表单记录四项要素”直接对应。',ks:'旅游管理专业知识体系 V1.0',ag:'旅游行业能力图谱 V1.0',status:'pending'},
  {id:'MAP-ABL07-SKS10',sourceType:'技能规范',sourceId:'SKS-10',sourceName:'情绪安抚与复述确认',sourceText:'能通过共情表达与复述确认在 5 分钟内使游客情绪平复并接受处理时限。',targetId:'ABL-07',targetName:'客诉情绪安抚与共情表达',course:'CRS-02 导游实务',relation:'direct_support',relationLabel:'直接支撑',level:'L2',confidence:.95,evidence:'与 L2“5 分钟内完成场景隔离与情绪安抚，并明确告知处理时限”逐字对应。',ks:'旅游管理专业知识体系 V1.0',ag:'旅游行业能力图谱 V1.0',status:'expert_required'},
  {id:'MAP-ABL07-CAS05',sourceType:'案例',sourceId:'CAS-05',sourceName:'五分钟内完成情绪安抚的成功处置',sourceText:'游客情绪激动时，导游将其带离团队视线范围，使用复述确认并在五分钟内获得游客对处理时限的认可。',targetId:'ABL-07',targetName:'客诉情绪安抚与共情表达',course:'CRS-02 导游实务',relation:'scenario_support',relationLabel:'情境案例',level:'L2',confidence:.95,evidence:'正例完整演示 L2 的场景隔离、复述确认、时限承诺三项观察点。',ks:'旅游管理专业知识体系 V1.0',ag:'旅游行业能力图谱 V1.0',status:'expert_required'},
  {id:'MAP-ABL08-SKS12',sourceType:'技能规范',sourceId:'SKS-12',sourceName:'补偿方案设计与书面确认',sourceText:'能在授权额度内提出现金或非现金补偿方案，说明方案依据并取得游客书面确认。',targetId:'ABL-08',targetName:'补偿方案设计与权限判断',course:'CRS-02 导游实务',relation:'direct_support',relationLabel:'直接支撑',level:'L2',confidence:.92,evidence:'“授权额度、方案依据、书面确认”分别对应能力 L2 的权限判断与方案落地要求。',ks:'旅游管理专业知识体系 V1.0',ag:'旅游行业能力图谱 V1.0',status:'pending'},
  {id:'MAP-ABL11-SKS14',sourceType:'技能规范',sourceId:'SKS-14',sourceName:'应急上报与事件记录',sourceText:'能按事件等级和规定时限完成首次上报，并在 24 小时内提交完整事件记录。',targetId:'ABL-11',targetName:'突发事件现场处置与上报',course:'CRS-02 导游实务',relation:'direct_support',relationLabel:'直接支撑',level:'L2',confidence:.95,evidence:'“事件等级、首次上报时限、24 小时记录”对应目标能力的上报与记录要求。',ks:'旅游管理专业知识体系 V1.0',ag:'旅游行业能力图谱 V1.0',status:'pending'},
  {id:'MAP-ABL04-KNP39',sourceType:'知识点',sourceId:'KNP-39',sourceName:'讲解时长与行程节点的匹配规则',sourceText:'讲解时长应与行程节点、游客注意力和后续安排相匹配，避免因讲解超时压缩行程。',targetId:'ABL-04',targetName:'现场讲解与节奏控制',course:'CRS-02 导游实务',relation:'foundation_support',relationLabel:'基础支撑',level:'L1',confidence:.88,evidence:'提供讲解时长与行程节点的规则基础，但没有覆盖现场实施技能。',ks:'旅游管理专业知识体系 V1.0',ag:'旅游行业能力图谱 V1.0',status:'pending'},
  {id:'MAP-ABL03-SKS16',sourceType:'技能规范',sourceId:'SKS-16',sourceName:'讲解词结构编排',sourceText:'能围绕主题完成导游词的开场、主体、过渡和收束结构编排，并进行口语化润色。',targetId:'ABL-03',targetName:'导游讲解词编创',course:'CRS-03 导游词编撰实务',relation:'direct_support',relationLabel:'直接支撑',level:'L2',confidence:.94,evidence:'“结构编排、主题组织、口语化润色”直接对应目标能力的编创行为。',status:'pending'}
];
// 图谱中心：映射任务生成的候选并入审核台；审核结果按记录保存，刷新后保留
GCF.cands().forEach(r=>{ if(!records.some(x=>x.id===r.id)) records.push(r); });
(()=>{ const rv=GCF.reviews(); records.forEach(r=>{ const v=rv[r.id]; if(v) Object.assign(r,{status:v.status,comment:v.comment,rejectReason:v.rejectReason,reviewer:v.reviewer}); }); })();
const state={status:'pending',query:'',type:'all',ks:'all',ag:'all',nodeType:'all',openReject:null,page:1,pageSize:10};
const $=s=>document.querySelector(s);
const statusText={pending:'待审',expert_required:'转专家标注',approved:'已确认',revision_requested:'复审中',rejected:'已驳回'};
const relationText={direct_support:'直接支撑',partial_support:'部分支撑',foundation_support:'基础支撑',assessment_basis:'提供达标判据',scenario_support:'情境案例',related:'相关但不构成覆盖'};
function visible(){return records.filter(r=>((state.status==='pending'?['pending','expert_required','revision_requested'].includes(r.status):r.status===state.status))&&(!state.query||[r.sourceId,r.sourceName,r.sourceText,r.targetId,r.targetName,r.course,r.evidence,r.ks,r.ag].join(' ').toLowerCase().includes(state.query))&&(state.type==='all'||r.relation===state.type)&&(state.ks==='all'||r.ks===state.ks)&&(state.ag==='all'||r.ag===state.ag)&&(state.nodeType==='all'||r.sourceType===state.nodeType));}
function pageItems(list){const totalPages=Math.max(1,Math.ceil(list.length/state.pageSize));if(state.page>totalPages)state.page=totalPages;const start=(state.page-1)*state.pageSize;return list.slice(start,start+state.pageSize)}
function row(r){const high=r.confidence>=.9;const reject=r.id===state.openReject;const isReadonly=r.status==='approved'||r.status==='rejected';return `<div class="mapping-row ${r.status==='rejected'?'rejected':''}"><div class="row-content"><div class="select-cell">${!isReadonly?'<input class="selected-check" type="checkbox" data-check="'+r.id+'" '+(r.checked?'checked':'')+'/>':''}</div><div class="ks-cell"><div class="ks-name">${r.ks||'—'}</div></div><div><div class="source-name">${r.sourceName}</div><span class="source-meta">${r.sourceType}</span></div><div class="ag-cell"><div class="ag-name">${r.ag||'—'}</div></div><div><div class="target-name">${r.targetName}</div></div><select class="relation-select" data-relation="${r.id}" ${isReadonly?'disabled':''}><option value="direct_support" ${r.relation==='direct_support'?'selected':''}>直接支撑</option><option value="partial_support" ${r.relation==='partial_support'?'selected':''}>部分支撑</option><option value="foundation_support" ${r.relation==='foundation_support'?'selected':''}>基础支撑</option><option value="assessment_basis" ${r.relation==='assessment_basis'?'selected':''}>提供达标判据</option><option value="scenario_support" ${r.relation==='scenario_support'?'selected':''}>情境案例</option><option value="related" ${r.relation==='related'?'selected':''}>相关但不构成覆盖</option></select><select class="level-select" data-level="${r.id}" ${isReadonly?'disabled':''}><option ${r.level==='L1'?'selected':''}>L1</option><option ${r.level==='L2'?'selected':''}>L2</option><option ${r.level==='L3'?'selected':''}>L3</option></select><div class="confidence ${high?'high':''}"><span class="confidence-meter"><i style="width:${r.confidence*100}%"></i></span><strong>${r.confidence.toFixed(2)}</strong></div><div class="ai-evidence">${r.evidence}</div><div class="origin"><strong>AI 候选</strong></div>${(r.status==='approved'||r.status==='rejected')?'<div class="reviewer-cell">'+(r.status==='approved'?(r.reviewer||'管理员'):'—')+'</div>':''}<div class="row-actions">${r.status==='approved'?'<span class="approved-label">已确认</span>':'<button class="confirm-button" data-confirm="'+r.id+'">✓ 确认</button><button class="reject-button" data-reject="'+r.id+'">× 驳回</button>'}</div></div>${reject?`<div class="reject-box"><h3>驳回必须填写理由 · 该条将进入负样本集</h3><div class="reject-form"><select data-reason="${r.id}"><option>语义相关但不构成教学支撑关系</option><option>映射目标能力不准确</option><option>证据不足，需补充原始资料</option><option>能力等级判断不准确</option></select><textarea data-comment="${r.id}" placeholder="补充说明（可选）：写清专家判定的依据，便于下一轮提示词与规则优化">${r.comment||''}</textarea><div class="reject-actions"><button class="confirm-reject" data-confirm-reject="${r.id}">确认驳回</button><button class="cancel-reject" data-cancel-reject="${r.id}">取消</button></div></div></div>`:''}</div>`;}
function updateSelectionColumnVisibility(){const hide=state.status==='approved'||state.status==='rejected';document.body.classList.toggle('hide-selection-column',hide)}function render(){refreshFilterOptions();updateSelectionColumnVisibility();document.body.classList.toggle('has-reviewer-col',state.status==='approved'||state.status==='rejected');const list=visible();const items=pageItems(list);$('#tableBody').innerHTML=list.length?items.map(row).join(''):'<div class="empty">当前状态下没有匹配的候选映射。</div>';document.querySelectorAll('.mapping-row').forEach((element,index)=>element.classList.toggle('approved',items[index]?.status==='approved'));$('#visibleCount').textContent=list.length;$('#totalCount').textContent=list.length;bind();counts();renderPagination(list,items);GCF.saveReviews(records.map(r=>((r.status==='approved'||r.status==='rejected')&&!r.reviewer?Object.assign(r,{reviewer:GC.me()}):r)));}
function counts(){$('#pendingCount').textContent=records.filter(r=>['pending','expert_required','revision_requested'].includes(r.status)).length;$('#approvedCount').textContent=records.filter(r=>r.status==='approved').length;$('#rejectedCount').textContent=records.filter(r=>r.status==='rejected').length;}
function renderPagination(list,items){const totalPages=Math.max(1,Math.ceil(list.length/state.pageSize));$('#pageNumbers').innerHTML=Array.from({length:totalPages},(_,index)=>{const page=index+1;return `<button type="button" class="page-number ${page===state.page?'active':''}" data-page="${page}">${page}</button>`}).join('');$('#prevPage').disabled=state.page===1;$('#nextPage').disabled=state.page===totalPages;const selected=items.length>0&&items.every(r=>r.checked);const pageSelectAll=$('#pageSelectAll');pageSelectAll.checked=selected;pageSelectAll.indeterminate=!selected&&items.some(r=>r.checked);document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{state.page=Number(b.dataset.page);render()});}
function bind(){document.querySelectorAll('[data-confirm]').forEach(b=>b.onclick=()=>change(b.dataset.confirm,'approved'));document.querySelectorAll('[data-reject]').forEach(b=>b.onclick=()=>{state.openReject=state.openReject===b.dataset.reject?null:b.dataset.reject;render()});document.querySelectorAll('[data-cancel-reject]').forEach(b=>b.onclick=()=>{state.openReject=null;render()});document.querySelectorAll('[data-confirm-reject]').forEach(b=>b.onclick=()=>{const r=records.find(x=>x.id===b.dataset.confirmReject);r.comment=document.querySelector(`[data-comment="${r.id}"]`).value;r.rejectReason=document.querySelector(`[data-reason="${r.id}"]`).value;r.status='rejected';state.openReject=null;toast(`${r.sourceId} 已驳回并记录原因`);render()});document.querySelectorAll('[data-check]').forEach(i=>i.onchange=()=>{records.find(r=>r.id===i.dataset.check).checked=i.checked;renderPagination(visible(),pageItems(visible()))});document.querySelectorAll('[data-relation]').forEach(s=>s.onchange=()=>{const r=records.find(x=>x.id===s.dataset.relation);r.relation=s.value;r.relationLabel=relationText[s.value]||'相关但不构成覆盖';toast('已调整候选映射类型')});document.querySelectorAll('[data-level]').forEach(s=>s.onchange=()=>{const r=records.find(x=>x.id===s.dataset.level);r.level=s.value;toast('已调整服务等级')});document.querySelectorAll('[data-add-resource]').forEach(b=>b.onclick=()=>{toast('打开实训资源添加面板')});}
function change(id,status){const r=records.find(x=>x.id===id);r.status=status;r.checked=false;state.openReject=null;toast(`${r.sourceId} → ${r.targetId} 已${statusText[status]}`);render();}
function toast(text){const t=$('#toast');t.textContent=text;t.classList.add('show');clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>t.classList.remove('show'),2200)}
function refreshFilterOptions(){const ksSet=new Set(),agSet=new Set();records.forEach(r=>{if(r.ks)ksSet.add(r.ks);if(r.ag)agSet.add(r.ag)});const ksSel=$('#ksFilter'),agSel=$('#agFilter');if(ksSel){const cur=ksSel.value;ksSel.innerHTML='<option value="all">全部知识体系</option>'+[...ksSet].map(v=>'<option value="'+v+'">'+v+'</option>').join('');ksSel.value=cur}if(agSel){const cur=agSel.value;agSel.innerHTML='<option value="all">全部能力图谱</option>'+[...agSet].map(v=>'<option value="'+v+'">'+v+'</option>').join('');agSel.value=cur}}
document.querySelectorAll('.status-tab').forEach(t=>t.onclick=()=>{state.status=t.dataset.status;state.page=1;state.openReject=null;document.querySelectorAll('.status-tab').forEach(x=>x.classList.toggle('active',x===t));render()});$('#searchInput').onkeydown=e=>{if(e.key==='Enter'){state.query=e.target.value.trim().toLowerCase();state.page=1;render()}};$('#searchBtn').onclick=()=>{state.query=$('#searchInput').value.trim().toLowerCase();state.page=1;render()};$('#typeFilter').onchange=e=>{state.type=e.target.value;state.page=1;render()};$('#ksFilter').onchange=e=>{state.ks=e.target.value;state.page=1;render()};$('#agFilter').onchange=e=>{state.ag=e.target.value;state.page=1;render()};$('#nodeTypeFilter').onchange=e=>{state.nodeType=e.target.value;state.page=1;render()};$('#pageSelectAll').onchange=e=>{pageItems(visible()).forEach(r=>r.checked=e.target.checked);render()};$('#pageSize').onchange=e=>{state.pageSize=Number(e.target.value);state.page=1;render()};$('#prevPage').onclick=()=>{if(state.page>1){state.page-=1;render()}};$('#nextPage').onclick=()=>{if(state.page<Math.ceil(visible().length/state.pageSize)){state.page+=1;render()}};$('#batchApprove').onclick=()=>{const selected=visible().filter(r=>r.checked);if(!selected.length)return toast('请先选择当前筛选结果中的候选映射');selected.forEach(r=>{r.status='approved';r.checked=false});toast(`已确认 ${selected.length} 条候选映射`);render()};
$('#autoApproveHigh').onclick=()=>{const high=records.filter(r=>r.confidence>=0.9&&['pending','expert_required','revision_requested'].includes(r.status));if(!high.length)return toast('当前没有置信度≥0.9的待审核候选');high.forEach(r=>{r.status='approved';r.checked=false});toast(`一键通过 ${high.length} 条高置信度候选映射`);render()};

// 知识体系节点选项（按节点类型分类）
const ksNodeOptions = {
  '知识点': [
    {value:'KNP-19|投诉四要素与记录表填写规范', label:'KNP-19 投诉四要素与记录表填写规范'},
    {value:'KNP-39|讲解时长与行程节点的匹配规则', label:'KNP-39 讲解时长与行程节点的匹配规则'},
    {value:'KNP-40|讲解词主题提炼方法', label:'KNP-40 讲解词主题提炼方法'},
    {value:'KNP-50|入住登记信息核对规范', label:'KNP-50 入住登记信息核对规范'},
  ],
  '技能规范': [
    {value:'SKS-09|投诉要素倾听与记录', label:'SKS-09 投诉要素倾听与记录'},
    {value:'SKS-10|情绪安抚与复述确认', label:'SKS-10 情绪安抚与复述确认'},
    {value:'SKS-12|补偿方案设计与书面确认', label:'SKS-12 补偿方案设计与书面确认'},
    {value:'SKS-14|应急上报与事件记录', label:'SKS-14 应急上报与事件记录'},
    {value:'SKS-16|讲解词结构编排', label:'SKS-16 讲解词结构编排'},
    {value:'SKS-20|入住登记操作', label:'SKS-20 入住登记操作'},
  ],
  '章节': [
    {value:'CH-02-01|第一章 投诉处理规范', label:'第一章 投诉处理规范'},
    {value:'CH-02-02|第二章 讲解服务规范', label:'第二章 讲解服务规范'},
    {value:'CH-03-01|第一章 讲解词创作', label:'第一章 讲解词创作'},
    {value:'CH-05-01|第一章 入住登记', label:'第一章 入住登记'},
  ],
  '课程': [
    {value:'CRS-02|导游实务', label:'CRS-02 导游实务'},
    {value:'CRS-03|导游词编撰实务', label:'CRS-03 导游词编撰实务'},
    {value:'CRS-05|前厅服务实务', label:'CRS-05 前厅服务实务'},
  ],
};

// 能力图谱节点选项（按节点类型分类）
const agNodeOptions = {
  '岗位': [
    {value:'POS-01|导游', label:'POS-01 导游', level:''},
    {value:'POS-02|计调', label:'POS-02 计调', level:''},
    {value:'POS-10|电商运营专员', label:'POS-10 电商运营专员', level:''},
  ],
  '能力项': [
    {value:'ABL-07|客诉情绪安抚与共情表达', label:'ABL-07 客诉情绪安抚与共情表达', level:'L1'},
    {value:'ABL-08|补偿方案设计与权限判断', label:'ABL-08 补偿方案设计与权限判断', level:'L2'},
    {value:'ABL-11|突发事件现场处置与上报', label:'ABL-11 突发事件现场处置与上报', level:'L2'},
    {value:'ABL-04|现场讲解与节奏控制', label:'ABL-04 现场讲解与节奏控制', level:'L1'},
    {value:'ABL-03|导游讲解词编创', label:'ABL-03 导游讲解词编创', level:'L2'},
    {value:'ABL-15|行程编排与资源调度', label:'ABL-15 行程编排与资源调度', level:'L1'},
    {value:'ABL-16|供应商谈判与合同管理', label:'ABL-16 供应商谈判与合同管理', level:'L2'},
    {value:'ABL-20|商品上架与详情页维护', label:'ABL-20 商品上架与详情页维护', level:'L1'},
    {value:'ABL-21|店铺活动策划与执行', label:'ABL-21 店铺活动策划与执行', level:'L2'},
  ],
};

// 初始化模糊搜索下拉框
function initSearchSelect(inputId, dropdownId, hiddenId, options) {
  const input = document.getElementById(inputId);
  const dropdown = document.getElementById(dropdownId);
  const hidden = document.getElementById(hiddenId);
  if(!input || !dropdown) return;
  function renderDropdown(query) {
    const q = query.trim().toLowerCase();
    const filtered = q ? options.filter(o => o.label.toLowerCase().includes(q)) : options;
    if(!filtered.length) {
      dropdown.innerHTML = '<div style="padding:8px 12px;color:#999;font-size:12px;text-align:center;">无匹配结果</div>';
      dropdown.style.display = 'block';
      return;
    }
    dropdown.innerHTML = filtered.map(o => '<div class="search-select-option" data-value="'+o.value+'" data-label="'+o.label+'" style="padding:8px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid #f0f0f0;">'+o.label+'</div>').join('');
    dropdown.style.display = 'block';
    dropdown.querySelectorAll('.search-select-option').forEach(el => {
      el.onmousedown = function(e) {
        e.preventDefault();
        input.value = el.dataset.label;
        hidden.value = el.dataset.value;
        dropdown.style.display = 'none';
      };
      el.onmouseenter = function(){this.style.background='#f5f3fa'};
      el.onmouseleave = function(){this.style.background=''};
    });
  }
  input.onfocus = () => renderDropdown(input.value);
  input.oninput = () => { hidden.value=''; renderDropdown(input.value); };
  input.onblur = () => { setTimeout(() => { dropdown.style.display = 'none'; }, 200); };
}


// Toggle relation field between text input and select dropdown
function toggleRelationField(){
  var sourceType=$('#newSourceType').value;
  var targetType=$('#newTargetType').value;
  var isSkillMapping=(sourceType==='技能'&&targetType==='能力');
  var textInput=$('#newRelationText');
  var selectEl=$('#newRelationSelect');
  if(isSkillMapping){
    textInput.style.display='none';
    selectEl.style.display='block';
    textInput.value='';
  }else{
    textInput.style.display='block';
    selectEl.style.display='none';
    selectEl.value='';
  }
}

const addMappingModal=$('#addMappingModal');
function closeAddMappingModal(){addMappingModal.classList.remove('open');addMappingModal.setAttribute('aria-hidden','true');$('#newEvidence').value='';$('#newRelationText').value='';$('#newSourceNodeInput').value='';$('#newSourceNode').value='';$('#newTargetAbilityInput').value='';$('#newTargetAbility').value='';$('#newKnowledgeSystem').value='';$('#newIndustryGraph').value='';}
$('#addMappingButton').onclick=()=>{
  addMappingModal.classList.add('open');addMappingModal.setAttribute('aria-hidden','false');
  initSearchSelect('newSourceNodeInput','sourceNodeDropdown','newSourceNode', ksNodeOptions[$('#newSourceType').value]||[]);
  initSearchSelect('newTargetAbilityInput','targetAbilityDropdown','newTargetAbility', agNodeOptions[$('#newTargetType').value]||[]);
  toggleRelationField();
};
$('#newSourceType').onchange=function(){
  $('#newSourceNodeInput').value='';$('#newSourceNode').value='';
  initSearchSelect('newSourceNodeInput','sourceNodeDropdown','newSourceNode', ksNodeOptions[this.value]||[]);
  toggleRelationField();
};
$('#newTargetType').onchange=function(){
  $('#newTargetAbilityInput').value='';$('#newTargetAbility').value='';
  initSearchSelect('newTargetAbilityInput','targetAbilityDropdown','newTargetAbility', agNodeOptions[this.value]||[]);
  var levelWrap=$('#levelFieldWrap');
  levelWrap.style.display=(this.value==='能力')?'block':'none';
  if(this.value!=='能力')$('#newLevel').value='L1';
  toggleRelationField();
};
$('#closeAddMapping').onclick=closeAddMappingModal;
$('#cancelAddMapping').onclick=closeAddMappingModal;
addMappingModal.onclick=e=>{if(e.target===addMappingModal)closeAddMappingModal()};
$('#submitAddMapping').onclick=()=>{
  const ksVal=$('#newKnowledgeSystem').value;
  if(!ksVal)return toast('请选择知识体系');
  const agVal=$('#newIndustryGraph').value;
  if(!agVal)return toast('请选择能力图谱');
  const sourceVal=$('#newSourceNode').value;
  if(!sourceVal)return toast('请选择知识体系节点');
  const targetVal=$('#newTargetAbility').value;
  if(!targetVal)return toast('请选择能力图谱节点');
  var relText=$('#newRelationText').value.trim()||$('#newRelationSelect').value;
  if(!relText)return toast('请输入映射关系');
  const [sid,sname]=sourceVal.split('|');
  const [tid,tname]=targetVal.split('|');
  const newId='MAP-'+sid+'-'+tid;
  if(records.some(r=>r.id===newId))return toast('该映射关系已存在');
  const sourceType=$('#newSourceType').value;
  const targetType=$('#newTargetType').value;
  const levelVal=$('#newLevel').value;
  const evidenceVal=$('#newEvidence').value;
  records.unshift({id:newId,sourceType:sourceType,sourceId:sid,sourceName:sname,sourceText:'',targetId:tid,targetName:tname,course:'自定义映射',ks:ksVal,ag:agVal,relation:relText,relationLabel:relText,level:levelVal,confidence:1,evidence:evidenceVal||'人工新增映射关系',status:'pending'});
  closeAddMappingModal();
  state.status='pending';state.page=1;
  document.querySelectorAll('.status-tab').forEach(x=>x.classList.toggle('active',x.dataset.status==='pending'));
  toast('已新增映射关系：'+sname+' → '+tname);
  render();
};
render();
