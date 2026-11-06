const $ = s => document.querySelector(s);
const uid = () => 'id-' + Math.random().toString(36).slice(2, 9);

// 勾选能力项时自动选中等级 L2
function autoSelectL2(cb){
  if(cb.checked){
    const row = cb.closest('.ability-select-row');
    if(row){
      const checked = row.querySelector('.abi-level:checked');
      if(!checked){
        const l2 = row.querySelector('.abi-level[value="L2"]');
        if(l2) l2.checked = true;
      }
    }
  }
  updateMSTrigger(cb);
}

function toggleMS(panelId, triggerId){
  const panel = document.getElementById(panelId);
  const trigger = document.getElementById(triggerId);
  if(!panel) return;
  const isOpen = panel.classList.contains('open');
  // Close all other ms-panels
  document.querySelectorAll('.ms-panel.open').forEach(p=>{ if(p.id!==panelId) p.classList.remove('open'); });
  document.querySelectorAll('.ms-trigger.open').forEach(t=>{ if(t.id!==triggerId) t.classList.remove('open'); });
  if(isOpen){
    panel.classList.remove('open');
    if(trigger) trigger.classList.remove('open');
  } else {
    panel.classList.add('open');
    if(trigger) trigger.classList.add('open');
  }
}

function updateMSTrigger(cb){
  const panel = cb.closest('.ms-panel');
  if(!panel) return;
  const trigger = panel.previousElementSibling;
  if(!trigger) return;
  const checks = panel.querySelectorAll('.abi-check:checked, .child-check:checked');
  if(checks.length === 0){
    trigger.textContent = '请选择';
  } else {
    trigger.textContent = '已选 ' + checks.length + ' 项';
  }
}

// Close dropdown when clicking outside
document.addEventListener('click', function(e){
  if(!e.target.closest('.ms-dropdown')){
    document.querySelectorAll('.ms-panel.open').forEach(p=>p.classList.remove('open'));
    document.querySelectorAll('.ms-trigger.open').forEach(t=>t.classList.remove('open'));
  }
});

function addLevel(blockId, btnId){
  const b = document.getElementById(blockId);
  const btn = document.getElementById(btnId);
  if(b) b.style.display = '';
  if(btn) btn.style.display = 'none';
}
function removeLevel(blockId, btnId){
  const b = document.getElementById(blockId);
  const btn = document.getElementById(btnId);
  if(b) b.style.display = 'none';
  if(btn) btn.style.display = '';
}

let aiGeneratedChildren = [];

// AI 根据子行业名称生成岗位列表（调用 AI 构建流程）
function aiGeneratePositions(industryName){
  // 实际调用 AI 自动构建流程，此处为前端模拟
  return [
    { name: industryName + '主管', level:'高级', describe:'负责团队管理和业务协调' },
    { name: industryName + '专员', level:'中级', describe:'负责日常业务执行' },
    { name: industryName + '助理', level:'初级', describe:'负责基础事务和辅助工作' },
    { name: industryName + '运营', level:'中级', describe:'负责运营策划和执行' },
    { name: industryName + '客服', level:'初级', desc:'负责客户接待和服务' }
  ];
}

// AI 根据岗位名称生成能力项列表（调用 AI 构建流程）
function aiGenerateAbilities(posName){
  // 实际调用 AI 自动构建流程，此处为前端模拟
  return [
    { name:'专业知识储备', type:'knowledge', domain:'专业知识', core:true, weight:0.25, level:'L2', l1:'了解基本概念和术语', a1:'笔试', l2:'能解释原理和关联', a2:'口试' },
    { name:'核心操作技能', type:'skill', domain:'核心操作', core:true, weight:0.3, level:'L2', l1:'能完成基本操作', a1:'实操考核', l2:'能独立处理复杂情况', a2:'现场考核' },
    { name:'沟通与服务能力', type:'skill', domain:'服务与沟通', core:false, weight:0.2, level:'L2', l1:'能进行基本交流', a1:'情景模拟', l2:'能处理投诉和特殊需求', a2:'神秘客考核' },
    { name:'应急处置能力', type:'skill', domain:'安全管理', core:false, weight:0.15, level:'L2', l1:'了解应急预案', a1:'笔试', l2:'能独立处置常见突发情况', a2:'情景模拟' },
    { name:'数字化工具应用', type:'skill', domain:'数字化系统', core:false, weight:0.2, level:'L2', l1:'能使用基本功能', a1:'实操考核', l2:'能利用工具提升效率', a2:'限时考核' },
    { name:'团队协作与管理', type:'skill', domain:'组织管理', core:false, weight:0.15, level:'L2', l1:'了解团队协作基本要求', a1:'笔试', l2:'能协调团队完成目标', a2:'项目考核' },
    { name:'质量管控与评估', type:'skill', domain:'质量管理', core:false, weight:0.15, level:'L3', l1:'了解质量标准', a1:'笔试', l2:'能执行质量检查', a2:'实操考核', l3:'能建立质量评估体系', a3:'方案评审' },
    { name:'资源协调与调度', type:'skill', domain:'资源配置', core:false, weight:0.2, level:'L2', l1:'了解资源分布', a1:'笔试', l2:'能合理调度资源', a2:'情景模拟' }
  ].map(t => ({
    id: uid(), name: posName + t.name, type:t.type, domain:t.domain, core:t.core, weight:t.weight,
    requiredLevel:t.level, behaviorDesc:'', inferred:false, flag:null, prerequisites:[],
    l1Req: t.l1 || '', l1AssessMethod: t.a1 || '',
    l2Req: t.l2 || '', l2AssessMethod: t.a2 || '',
    l3Req: t.l3 || null, l3AssessMethod: t.a3 || null,
    assessMethod: t.a1 || ''
  }));
}

function generateAIChildren(parentName, nodeType){
  if(nodeType === 1){
    // 子行业 → AI 生成若干岗位，每个岗位再递归生成能力项到末节点
    const positions = aiGeneratePositions(parentName);
    return positions.map(p => ({
      id: uid(), name: p.name, careerLevel: p.level, describe: p.describe,
      abilities: generateAIChildren(p.name, 2)
    }));
  } else if(nodeType === 2){
    // 岗位 → AI 生成若干能力项（末节点）
    return aiGenerateAbilities(parentName);
  }
  return [];
}

function aiBuildNewChildren(){
  const type = parseInt($('#newNodeType').value);
  const name = $('#newNodeName').value.trim();
  if(!name) return toast('请先输入节点名称');
  if(type === 3){
    // AI 补充能力项的描述、等级划分、考核方式等信息
    const btn3 = $('#newNodeAIBuildBtn');
    if(btn3){ btn3.disabled = true; btn3.textContent = 'AI构建中…'; }
    setTimeout(()=>{
      // AI 根据能力项名称自动填充字段
      const l1Desc = '了解' + name + '的基本概念和术语';
      const l1Assess = '笔试';
      const l2Desc = '能独立完成' + name + '相关操作';
      const l2Assess = '实操考核';
      // 填充表单字段（addNodeModal 使用 newNode* 前缀）
      if($('#newNodeAbiType')) $('#newNodeAbiType').value = 'knowledge';
      if($('#newNodeDomain')) $('#newNodeDomain').value = name + '领域';
      if($('#newNodeL1')) $('#newNodeL1').value = l1Desc;
      if($('#newNodeL1Assess')) $('#newNodeL1Assess').value = l1Assess;
      // 展示 L2 区块并填充
      addLevel('newL2Block', 'newL2AddBtn');
      if($('#newNodeL2')) $('#newNodeL2').value = l2Desc;
      if($('#newNodeL2Assess')) $('#newNodeL2Assess').value = l2Assess;
      if($('#newNodeBehavior')){
        $('#newNodeBehavior').value = '能在实际工作中运用' + name + '完成相关任务';
      }
      if(btn3){ btn3.disabled = false; btn3.textContent = '⚡ AI自动构建'; }
      toast('AI已补充「' + name + '」的等级要求和描述信息');
    }, 1500);
    return;
  }
  const btn = $('#newNodeAIBuildBtn');
  if(btn){ btn.disabled = true; btn.textContent = 'AI构建中…'; }
  setTimeout(()=>{
    const g = getGraph();
    if(!g || !g.tree){ if(btn){btn.disabled=false;btn.textContent='⚡ AI自动构建';} return; }
    const tree = g.tree;
    const parentId = $('#newNodeParent').value;
    const newNode = { id: uid(), name };
    if(type === 1){
      newNode.describe = ($('#newNodeDesc')?.value || '').trim();
      newNode.positions = generateAIChildren(name, 1);
      tree.subIndustries = tree.subIndustries || [];
      tree.subIndustries.push(newNode);
    } else if(type === 2){
      newNode.describe = ($('#newNodeDesc')?.value || '').trim();
      newNode.careerLevel = '';
      newNode.abilities = generateAIChildren(name, 2);
      const sub = (tree.subIndustries||[]).find(s=>s.id===parentId);
      if(sub){ sub.positions = sub.positions || []; sub.positions.push(newNode); }
    }
    closeModal('#addNodeModal');
    renderGraph(tree);
    renderTreeStats(tree);
    if(btn){ btn.disabled = false; btn.textContent = '⚡ AI自动构建'; }
    const cnt = type === 1 ? newNode.positions.length : newNode.abilities.length;
    toast('AI已创建「' + name + '」并构建 ' + cnt + ' 个下层节点');
  }, 1500);
}

function toggleExistingChildren(listId, btnId){
  const div = document.getElementById(listId);
  const btn = document.getElementById(btnId);
  if(!div) return;
  if(div.style.display === 'none'){
    div.style.display = '';
    if(btn) btn.textContent = '从已有节点选择 ▾';
  } else {
    div.style.display = 'none';
    if(btn) btn.textContent = '从已有节点选择 ▸';
  }
}

function aiBuildAddChildren(){
  const name = $('#addChildName').value.trim();
  if(!name) return toast('请先输入名称');
  if(addChildLevel === 2){
    // AI 补充能力项的描述、等级划分、考核方式等信息
    const btn2 = $('#addChildAIBuildBtn');
    if(btn2){ btn2.disabled = true; btn2.textContent = 'AI构建中…'; }
    setTimeout(()=>{
      const name2 = $('#addChildName').value.trim();
      // AI 根据能力项名称自动填充字段
      const l1Desc = '了解' + name2 + '的基本概念和术语';
      const l1Assess = '笔试';
      const l2Desc = '能独立完成' + name2 + '相关操作';
      const l2Assess = '实操考核';
      // 填充表单字段
      if($('#addChildL1')) $('#addChildL1').value = l1Desc;
      if($('#addChildL1Assess')) $('#addChildL1Assess').value = l1Assess;
      // 展示 L2 区块并填充
      addLevel('childL2Block', 'childL2AddBtn');
      if($('#addChildL2')) $('#addChildL2').value = l2Desc;
      if($('#addChildL2Assess')) $('#addChildL2Assess').value = l2Assess;
      if($('#addChildBehavior')){
        $('#addChildBehavior').value = '能在实际工作中运用' + name2 + '完成相关任务';
      }
      if(btn2){ btn2.disabled = false; btn2.textContent = '⚡ AI自动构建'; }
      toast('AI已补充「' + name2 + '」的等级要求和描述信息');
    }, 1500);
    return;
  }
  const btn = $('#addChildAIBuildBtn');
  if(btn){ btn.disabled = true; btn.textContent = 'AI构建中…'; }
  setTimeout(()=>{
    const result = findNode(addChildParentId, addChildLevel);
    if(!result){ if(btn){btn.disabled=false;btn.textContent='⚡ AI自动构建';} return; }
    const node = result.node;
    const child = { id: uid(), name };
    if(addChildLevel === 0){
      child.describe = ($('#addChildDesc')?.value || '').trim();
      child.positions = generateAIChildren(name, 1);
      node.positions = node.positions || [];
      node.positions.push(child);
    } else if(addChildLevel === 1){
      child.describe = ($('#addChildDesc')?.value || '').trim();
      child.careerLevel = '';
      child.abilities = generateAIChildren(name, 2);
      node.abilities = node.abilities || [];
      node.abilities.push(child);
    }
    const g = getGraph();
    closeModal('#addChildModal');
    renderGraph(g?.tree);
    renderTreeStats(g?.tree);
    if(btn){ btn.disabled = false; btn.textContent = '⚡ AI自动构建'; }
    const cnt = addChildLevel === 0 ? child.positions.length : child.abilities.length;
    toast('AI已创建「' + name + '」并构建 ' + cnt + ' 个下层节点');
  }, 1500);
}

// 能力图谱列表数据
let graphs = [
  {
    id: 'g1',
    name: '旅游业',
    describe: '本图谱以旅游活动组织、目的地接待与游览服务为核心，按岗位能力体系相似性划定边界。纳入旅行社组团与地接、景区运营、研学定制、在线旅游平台及酒店前厅等直接面向游客的接待服务岗位。',
    buildStatus: 'built', syncStatus: 'synced', version: 'v1.3',
    createdAt: '2026-09-09', updatedAt: '2026-10-02',
    stats: { positions: 10, abilities: 28, subIndustries: 5 },
    tree: {
      id: 'n1', name: '旅游业', aliases: ['旅游产业','文旅产业'], describe: '以旅游活动组织、目的地接待与游览服务为核心',
      info: { stats: { positions:10, distinctAbilities:28, subIndustries:5 } },
      subIndustries: [
        {
          id: 'n2', name: '旅行社与组团地接服务', describe: '从事旅游线路设计、团队组织、地接安排与导游带团服务',
          info: { priority: 'core', typicalEmployers: ['传统旅行社','地接社','出境游批发商'] },
          positions: [
            {
              id: 'n3', name: '导游', aliases: ['地陪','全陪'], describe: '带领游客按行程游览，负责讲解、照料及突发事件处理', careerLevel: '初级/中级',
              abilities: [
                { id:'n5', name:'旅游产品与目的地知识储备', type:'knowledge', domain:'产品策划与行程设计', core:true, weight:0.25, requiredLevel:'L2', behaviorDesc:'独立向客户完整讲述目的地的历史沿革、文化特色与游览亮点', observablePoints:['按时间线叙述历史沿革','将文化特色与具体建筑或风俗对应','结合季节说明最佳游览方式','回答游客即兴追问'], assessMethod:'模拟讲解考核', inferred:false, flag:null },
                { id:'n6', name:'行程动线规划与设计', type:'skill', domain:'产品策划与行程设计', core:false, weight:0.3, requiredLevel:'L3', behaviorDesc:'设计包含沉浸式演艺、非遗手作等新业态的非标线路', observablePoints:['产出图文并茂的路书文档','将声光电互动节点嵌入行程时间轴','根据天气预案生成AB两套路线'], assessMethod:'客户验收与转化率追踪', inferred:false, flag:null },
                { id:'n7', name:'AI行程规划工具应用', type:'skill', domain:'数字化系统与信息处理', core:false, weight:0.2, requiredLevel:'L2', behaviorDesc:'使用AI工具生成行程初稿并30分钟内完成人工校验', observablePoints:['调整AI生成的景点顺序','补充AI遗漏的特殊需求','核查AI输出的门票价格时效性'], assessMethod:'限时实操考核', inferred:true, flag:'新兴能力：仅有市场来源' },
                { id:'n8', name:'景点讲解与文化传播表达', type:'skill', domain:'讲解服务与文化传播', core:true, weight:0.35, requiredLevel:'L2', behaviorDesc:'根据游客年龄与兴趣点灵活运用故事化手法即兴调整讲解内容', observablePoints:['针对亲子团增加趣味互动','针对老年团放慢语速','用类比法解释生僻概念'], assessMethod:'神秘客暗访或录音抽检', inferred:false, flag:null }
              ]
            },
            {
              id:'n4', name:'旅行社计调', aliases:['OP','计调员'], describe:'负责旅游线路产品的策划、报价、采购与行程安排', careerLevel:'中级/高级',
              abilities: [
                { id:'n9', name:'旅游产品线路设计与成本核算', type:'skill', domain:'产品策划与行程设计', core:true, weight:0.3, requiredLevel:'L3', behaviorDesc:'独立完成线路设计、成本核算与报价方案', observablePoints:['产出含成本明细的报价单','比较至少三家地接资源价格','根据客户预算调整行程要素'], assessMethod:'方案评审', inferred:false, flag:null },
                { id:'n10', name:'计调操作系统与订单处理', type:'skill', domain:'数字化系统与信息处理', core:false, weight:0.2, requiredLevel:'L2', behaviorDesc:'熟练使用旅行社管理系统完成订单录入、改单与退单', observablePoints:['15分钟内完成标准订单录入','正确处理退改签规则','生成结算清单'], assessMethod:'系统操作考核', inferred:false, flag:null }
              ]
            }
          ]
        },
        {
          id:'n11', name:'旅游景区与主题公园运营管理', describe: '从事景区票务、游客服务、讲解与活动运营管理',
          info: { priority:'core', typicalEmployers:['旅游景区','主题公园','博物馆'] },
          positions: [
            {
              id:'n12', name:'景区讲解员', aliases:['景区导游'], describe:'在景区内为游客提供专业讲解与导览服务', careerLevel:'初级/中级',
              abilities: [
                { id:'n13', name:'旅游资源归类与讲解', type:'knowledge', domain:'讲解服务与文化传播', core:true, weight:0.3, requiredLevel:'L2', behaviorDesc:'按国标分类体系准确识别并讲解自然与人文旅游资源', observablePoints:['现场辨识建筑形制','准确使用专业术语','回答游客延伸提问'], assessMethod:'现场讲解考核', inferred:false, flag:null },
                { id:'n14', name:'分众化讲解适配', type:'skill', domain:'讲解服务与文化传播', core:true, weight:0.25, requiredLevel:'L2', behaviorDesc:'根据游客群体特征调整讲解内容深度与表达方式', observablePoints:['为研学团增加互动设计','为银发团调整语速','为亲子团增加趣味问答'], assessMethod:'多客群模拟讲解', inferred:false, flag:null }
              ]
            }
          ]
        },
        {
          id:'n15', name:'研学旅行与定制旅游策划执行', describe:'从事研学课程开发、定制旅游方案设计与执行',
          info:{priority:'emerging',typicalEmployers:['研学机构','定制旅行公司']},
          positions:[
            {
              id:'n16', name:'研学旅行指导师', aliases:['研学导师'], describe:'策划并实施研学旅行课程，引导学生在旅行中学习', careerLevel:'中级',
              abilities:[
                { id:'n17', name:'研学课程设计与实施', type:'skill', domain:'产品策划与行程设计', core:true, weight:0.35, requiredLevel:'L3', behaviorDesc:'围绕教育目标设计研学课程方案并组织现场实施', observablePoints:['产出含教学目标的课程方案','设计研学任务单与评价表','现场引导学生完成探究活动'], assessMethod:'课程方案评审+现场观察', inferred:false, flag:null },
                { id:'n18', name:'安全风险识别与隐患排查', type:'skill', domain:'安全管理与应急处置', core:true, weight:0.2, requiredLevel:'L2', behaviorDesc:'在研学场景中识别安全风险并启动隐患排查流程', observablePoints:['行前完成场地安全踏勘','识别交通与餐饮风险点','启动应急预案'], assessMethod:'安全踏勘报告评审', inferred:false, flag:null }
              ]
            }
          ]
        }
      ]
    }
  },
  { id:'g2', name:'电商行业', describe:'以电子商务平台运营、网店管理、直播带货与供应链服务为核心能力体系。', buildStatus:'built', syncStatus:'syncing', createdAt:'2026-09-08', updatedAt:'2026-09-25', stats:{positions:8,abilities:22,subIndustries:4}, tree:{id:'n20',name:'电商行业',aliases:['电子商务'],describe:'以电子商务平台运营为核心',info:{stats:{positions:8,distinctAbilities:22,subIndustries:4}},subIndustries:[]} },
  { id:'g3', name:'酒店管理', describe:'以前厅接待、宾客关系与管家服务为核心，不覆盖客房工程与后厨岗位。', buildStatus:'building', syncStatus:'', createdAt:'2026-09-10', stats:{positions:0,abilities:0,subIndustries:0}, tree:null },
  { id:'g4', name:'物流行业', describe:'以仓储管理、运输调度与供应链协同为核心能力体系。', buildStatus:'build_failed', syncStatus:'', createdAt:'2026-09-12', stats:{positions:0,abilities:0,subIndustries:0}, tree:null },
  { id:'g5', name:'文化创意产业', describe:'以内容创作、数字媒体与文创产品设计为核心能力体系。', buildStatus:'built', syncStatus:'sync_failed', createdAt:'2026-09-13', updatedAt:'2026-10-05', stats:{positions:6,abilities:16,subIndustries:3}, tree:{id:'n30',name:'文化创意产业',describe:'以内容创作、数字媒体与文创产品设计为核心',info:{stats:{positions:6,distinctAbilities:16,subIndustries:3}},subIndustries:[]} },
  { id:'g6', name:'研学旅行', describe:'围绕研学课程设计、活动组织与安全管理构建岗位能力体系。', creator:'平台管理员', sharedTo:['张明'], buildStatus:'built', syncStatus:'synced', createdAt:'2026-09-15', stats:{positions:4,abilities:12,subIndustries:2}, tree:{id:'n31',name:'研学旅行',describe:'围绕研学课程设计、活动组织与安全管理',info:{stats:{positions:4,distinctAbilities:12,subIndustries:2}},subIndustries:[]} }
];

// 当前状态
let currentGraphId = null;
let expandedNodes = new Set();

// sessionStorage 数据同步
function saveGraphs(){
  try { sessionStorage.setItem('ability_graphs_v3', JSON.stringify(graphs)); } catch(e) {}
}
// 状态字段归一化：兼容旧单一 status，迁移为「构建状态 + 同步状态」两维
function normalizeGraphs(){
  graphs.forEach(g=>{
    if(g.status){
      const st = g.status;
      if(st==='failed') g.buildStatus='build_failed';
      else if(st==='confirmed'){ g.buildStatus='built'; g.confirmed=true; }
      else g.buildStatus=st; // building / built
      delete g.status;
    }
    if(!g.buildStatus) g.buildStatus='built';
    if(g.syncStatus===undefined) g.syncStatus='';
    if(!g.creator) g.creator='平台管理员';
  });
}
function loadGraphs(){
  try {
    const stored = sessionStorage.getItem('ability_graphs_v3');
    if(stored){ graphs = JSON.parse(stored); normalizeGraphs(); return true; }
  } catch(e) {}
  return false;
}

// 层级配置
const LEVELS = [
  { key:'subIndustries', label:'子行业', icon:'行', cls:'level-subindustry', childKey:'positions' },
  { key:'positions', label:'岗位', icon:'岗', cls:'level-position', childKey:'abilities' },
  { key:'abilities', label:'能力项', icon:'能', cls:'level-ability', childKey:null }
];

function toast(text){const t=$('#toast');t.textContent=text;t.classList.add('show');clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>t.classList.remove('show'),2400)}

// 组织树（院校 → 校区 → 学院/部门 → 系 → 教研室，叶子节点挂成员）
const ORG_TREE = [
  { id:'root', name:'某职业技术学院', type:'院校', children:[
    { id:'east', name:'东校区', type:'校区', children:[
      { id:'east-tourism', name:'旅游学院', type:'学院', children:[
        { id:'east-tourism-mgmt', name:'旅游管理系', type:'系', children:[
          { id:'east-tourism-guide', name:'导游教研室', type:'教研室', members:[
            {id:'m01', name:'张伟', title:'教研室主任'},
            {id:'m02', name:'李娜', title:'专任教师'},
            {id:'m03', name:'王强', title:'专任教师'},
            {id:'m04', name:'刘敏', title:'专任教师'}
          ]}
        ]}
      ]},
      { id:'east-hotel', name:'酒店学院', type:'学院', members:[
        {id:'m05', name:'赵磊', title:'副院长'},
        {id:'m06', name:'孙悦', title:'专任教师'},
        {id:'m07', name:'周明', title:'专任教师'}
      ]}
    ]},
    { id:'west', name:'西校区', type:'校区', children:[
      { id:'west-voc', name:'中职部', type:'部门', children:[
        { id:'west-voc-tourism', name:'旅游专业部', type:'专业部', members:[
          {id:'m08', name:'吴婷', title:'专业部长'},
          {id:'m09', name:'郑浩', title:'专任教师'},
          {id:'m10', name:'冯雪', title:'专任教师'}
        ]}
      ]},
      { id:'west-cont', name:'继续教育部', type:'部门', members:[
        {id:'m11', name:'陈晨', title:'主任'},
        {id:'m12', name:'杨帆', title:'教务员'}
      ]}
    ]},
    { id:'public-basic', name:'公共基础部', type:'部门', members:[
      {id:'m13', name:'黄娟', title:'副主任'},
      {id:'m14', name:'林涛', title:'专任教师'},
      {id:'m15', name:'罗静', title:'专任教师'}
    ]}
  ]}
];

function collectMemberIds(node){
  let ids = (node.members || []).map(m=>m.id);
  (node.children || []).forEach(c=>{ ids = ids.concat(collectMemberIds(c)); });
  return ids;
}
const ORG_MAP = {};
(function buildOrgMap(nodes){ nodes.forEach(n=>{ ORG_MAP[n.id] = n; if(n.children) buildOrgMap(n.children); }); })(ORG_TREE);
const ORG_TOTAL_MEMBERS = ORG_TREE.reduce((n,o)=>n + collectMemberIds(o).length, 0);
const MEMBER_MAP = {};
(function collectMembers(nodes){ nodes.forEach(n=>{ (n.members||[]).forEach(m=>{ MEMBER_MAP[m.id] = m; }); if(n.children) collectMembers(n.children); }); })(ORG_TREE);
const ORG_PARENT = {};
(function buildParent(nodes, pid){ nodes.forEach(n=>{ ORG_PARENT[n.id] = pid || null; if(n.children) buildParent(n.children, n.id); }); })(ORG_TREE, null);

// 是否为「他人分享给我」的图谱：创建者非本人且共享名单含当前用户
function isSharedGraph(g){
  // 图谱中心教师端：他人创建的图谱一律仅查看
  return !!(g.creator && g.creator !== CURRENT_USER.name && ((g.sharedTo||[]).indexOf(CURRENT_USER.name) >= 0 || (window.GC && GC.teacher())));
}
// 汇总勾选：顶层组织 + 未被组织覆盖的单独成员
function collectSelectedPerm(tree){
  const allOrgIds = [...tree.querySelectorAll('.org-select:checked')].map(cb=>cb.value);
  const checkedOrg = {};
  allOrgIds.forEach(oid=>{ checkedOrg[oid]=1; });
  const orgs = allOrgIds.filter(oid=>!ORG_PARENT[oid] || !checkedOrg[ORG_PARENT[oid]]);
  const covered = {};
  allOrgIds.forEach(oid=>{ const n = ORG_MAP[oid]; if(!n) return; collectMemberIds(n).forEach(id=>{ covered[id]=1; }); });
  const members = [...tree.querySelectorAll('.perm-member:checked')].map(c=>c.value).filter(id=>!covered[id]);
  return { orgs, members };
}
// 权限覆盖的成员总数（组织展开 + 单独成员）
function permCoveredCount(g){
  const orgs = (g.permissions && g.permissions.orgs) || [];
  const members = (g.permissions && g.permissions.members) || [];
  const covered = {};
  orgs.forEach(oid=>{ const n = ORG_MAP[oid]; if(n) collectMemberIds(n).forEach(id=>{ covered[id]=1; }); });
  members.forEach(id=>{ covered[id]=1; });
  return Object.keys(covered).length;
}
// 还原为扁平成员列表（用于回显组织树勾选）
function permFlatMembers(g){
  const orgs = (g.permissions && g.permissions.orgs) || [];
  const members = (g.permissions && g.permissions.members) || [];
  const ids = [];
  orgs.forEach(oid=>{ const n = ORG_MAP[oid]; if(n) ids.push(...collectMemberIds(n)); });
  return ids.concat(members);
}
// 权限文案（卡片元信息）
function permText(g){
  if(isSharedGraph(g)) return (g.sharedTo||[]).indexOf(CURRENT_USER.name) >= 0 ? '分享给我' : '仅查看 · 创建人 ' + g.creator;
  const orgs = (g.permissions && g.permissions.orgs) || [];
  const members = (g.permissions && g.permissions.members) || [];
  if(!orgs.length && !members.length) return '权限：仅自己';
  if(permCoveredCount(g) >= ORG_TOTAL_MEMBERS) return '权限：公开';
  const parts = [];
  if(orgs.length) parts.push(orgs.length + '个组织');
  if(members.length) parts.push(members.length + '个成员');
  return '权限：' + parts.join('、');
}

// 卡片操作菜单（··· 编辑 / 删除 / 分享）
let cardMenuEl = null, cardMenuGid = null;
function toggleCardMenu(e, gid){
  e.stopPropagation();
  if(cardMenuEl && cardMenuGid === gid){ hideCardMenu(); return; }
  hideCardMenu();
  cardMenuGid = gid;
  cardMenuEl = document.createElement('div');
  cardMenuEl.className = 'card-action-menu';
  const menuGraph = graphs.find(x=>x.id===gid);
  const menuBuilding = menuGraph && menuGraph.buildStatus==='building';
  cardMenuEl.innerHTML = ''
    + (menuBuilding ? '' : '<div class="card-action-item" data-act="edit">编辑</div>')
    + '<div class="card-action-item danger" data-act="delete">删除</div>'
    + '<div class="card-action-item" data-act="settings">分享</div>';
  document.body.appendChild(cardMenuEl);
  const rect = e.currentTarget.getBoundingClientRect();
  cardMenuEl.style.top = (rect.bottom + 4) + 'px';
  cardMenuEl.style.left = Math.min(rect.right - cardMenuEl.offsetWidth, window.innerWidth - cardMenuEl.offsetWidth - 8) + 'px';
  cardMenuEl.addEventListener('click', ev => {
    ev.stopPropagation();
    const act = ev.target.closest('.card-action-item')?.dataset.act;
    hideCardMenu();
    if(act === 'edit') editGraph(gid);
    else if(act === 'settings') openGraphSettings(gid);
    else if(act === 'delete') deleteGraph(gid);
  });
}
function hideCardMenu(){
  if(cardMenuEl){ cardMenuEl.remove(); cardMenuEl = null; }
  cardMenuGid = null;
}

// ========== 范围（起建层级）==========
function onGraphScopeChange(){
  const scope = $('#newGraphScope') ? $('#newGraphScope').value : '行业';
  const nameInput = $('#newGraphName');
  if(!nameInput) return;
  const placeholderMap = { '行业':'请输入行业名称', '子行业':'请输入子行业名称', '岗位':'请输入岗位名称' };
  nameInput.placeholder = placeholderMap[scope] || '请输入名称';
}
function readGraphScope(){
  const scopeLevel = $('#newGraphScope').value;
  const name = $('#newGraphName') ? $('#newGraphName').value.trim() : '';
  return {
    scopeLevel,
    industryName: scopeLevel==='行业' ? name : '',
    subIndustryName: scopeLevel==='子行业' ? name : '',
    positionName: scopeLevel==='岗位' ? name : '',
    desc: $('#newGraphDesc').value.trim()
  };
}
function graphScopeError(scope){
  if(!scope.industryName && !scope.subIndustryName && !scope.positionName) return '请输入名称';
  return '';
}
function graphScopeLevel(g){ return g.scopeLevel || '行业'; }
function graphScopeObject(g){
  if(g.scopeLevel==='子行业') return g.subIndustryName;
  if(g.scopeLevel==='岗位') return g.positionName;
  return g.name;
}
// 由 readGraphScope() 结果取「对象名」，作为图谱名称
function graphScopeName(scope){
  if(scope.scopeLevel==='子行业') return scope.subIndustryName;
  if(scope.scopeLevel==='岗位') return scope.positionName;
  return scope.industryName;
}
function graphScopeLabel(g){ return graphScopeLevel(g) + ' · ' + graphScopeObject(g); }
// AI 构建：按起建层级生成树（当前 mock，真实 AI 见 data.js 注释）
function buildGraphTree(scope){
  const ind = INDUSTRY_LIST.find(i=>i.name===scope.industryName) || {};
  const subs = ind.subIndustries || [];
  const root = { id:uid(), name:graphScopeName(scope), aliases:[], describe:scope.desc, info:{stats:{}}, subIndustries:[] };
  const makePositions = si => aiGeneratePositions(si).map(p=>({ id:uid(), name:p.name, careerLevel:p.level, describe:p.describe, abilities: aiGenerateAbilities(p.name) }));
  if(scope.scopeLevel==='行业'){
    const list = subs.length ? subs.slice(0,3) : [scope.industryName+'核心业务', scope.industryName+'运营管理', scope.industryName+'服务支持'];
    list.forEach(si=>{ root.subIndustries.push({ id:uid(), name:si, describe:'', positions: makePositions(si) }); });
  } else if(scope.scopeLevel==='子行业'){
    root.subIndustries.push({ id:uid(), name:scope.subIndustryName, describe:'', positions: makePositions(scope.subIndustryName) });
  } else {
    const fallbackSub = subs[0] || '核心业务';
    root.subIndustries.push({ id:uid(), name:fallbackSub, describe:'', positions:[ { id:uid(), name:scope.positionName, careerLevel:'', describe:'', abilities: aiGenerateAbilities(scope.positionName) } ] });
  }
  return root;
}
function graphStats(tree){
  let positions=0; const ablSet=new Set();
  (tree.subIndustries||[]).forEach(s=>{ positions+=(s.positions||[]).length; (s.positions||[]).forEach(p=>(p.abilities||[]).forEach(a=>ablSet.add(a.id))); });
  return { subIndustries:(tree.subIndustries||[]).length, positions, abilities: ablSet.size };
}

// ========== 身份切换 ==========
function onSwitchUser(key){
  switchUser(key);   // data.js
  renderList();
}

// ========== 列表渲染 ==========
function matchGraphStatus(g, status){
  if(status==='all') return true;
  if(['building','built','build_failed'].includes(status)) return g.buildStatus===status;
  return g.syncStatus===status;
}
// 日期字符串补充分秒；已含时分秒则原样返回
function fmtDateTime(d){
  if(!d) return '';
  if(d.includes(':')) return d;
  let h=0, m=0, s=0;
  for(let i=0;i<d.length;i++){ const c=d.charCodeAt(i); h=(h*31+c)%24; m=(m*37+c)%60; s=(s*41+c)%60; }
  const p = n => String(n).padStart(2,'0');
  return d+' '+p(h)+':'+p(m)+':'+p(s);
}
// 当前本地时间（含时分秒）
function nowDateTime(){
  const d=new Date(), p=n=>String(n).padStart(2,'0');
  return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes())+':'+p(d.getSeconds());
}
// 卡片右下角时间：更新过显示「更新于」，否则「创建于」
function graphTimeText(g){
  if(g.updatedAt && g.updatedAt !== g.createdAt) return '更新于 ' + fmtDateTime(g.updatedAt);
  return g.createdAt ? ('创建于 ' + fmtDateTime(g.createdAt)) : '';
}

function renderList(){
  if(!$('#graphList')) return;
  const scopeFilter = $('#agScopeFilter') ? $('#agScopeFilter').value : 'all';
  const statusFilter = $('#agStatusFilter') ? $('#agStatusFilter').value : 'all';
  const ownerFilter = $('#agOwnerFilter') ? $('#agOwnerFilter').value : 'all';
  const search = $('#agSearchInput') ? $('#agSearchInput').value.trim().toLowerCase() : '';
  const list = graphs.filter(g => {
    const matchSearch = !search || (g.name||'').toLowerCase().includes(search) || (g.describe||'').toLowerCase().includes(search);
    const matchOwner = ownerFilter==='all' || (ownerFilter==='mine' ? (!g.creator || g.creator===CURRENT_USER.name) : isSharedGraph(g));
    return matchSearch && matchOwner && (scopeFilter==='all' || graphScopeLevel(g)===scopeFilter) && matchGraphStatus(g, statusFilter);
  });
  const html = list.map(g=>{
    const isBuilding = g.buildStatus==='building';
    const isFailed = g.buildStatus==='build_failed';
    // 状态文案与徽标；节点数弱化为 meta 行内文本（与知识体系卡片一致）
    let statusBadge, nodeCountText, statsBox;
    if(isBuilding){
      statusBadge = '<span class="graph-card-status building">构建中</span>';
      nodeCountText = '—';
      statsBox = `<div class="graph-card-stats"><div><span>节点数</span><strong>—</strong></div></div>`;
    } else if(isFailed){
      statusBadge = '<span class="graph-card-status failed">构建失败</span>';
      nodeCountText = '—';
      statsBox = '';
    } else {
      statusBadge = '<span class="graph-card-status built">构建完成</span>';
      const nodeCount = (g.stats.subIndustries||0) + (g.stats.positions||0) + (g.stats.abilities||0);
      nodeCountText = String(nodeCount);
      statsBox = '';
    }
    // 同步状态徽标（同步中 / 同步完成 / 同步失败）
    const syncMap = {syncing:'同步中', synced:'同步完成', sync_failed:'同步失败'};
    if(g.syncStatus){
      const syncCls = g.syncStatus==='sync_failed' ? 'failed' : g.syncStatus;
      statusBadge += '<span class="graph-card-status '+syncCls+'">'+(syncMap[g.syncStatus]||'')+'</span>';
    }
    const isShared = isSharedGraph(g);
    // 右上角操作按钮（··· 菜单：编辑 / 删除 / 分享）；他人分享给我的不显示
    const cardActions = isShared ? '' : `<div class="graph-card-corner" onclick="event.stopPropagation()">
      <button class="corner-btn corner-more" onclick="toggleCardMenu(event, '${g.id}')" aria-label="操作">⋮</button>
    </div>`;
    // 底部按钮：构建中不显示，构建失败显示"重新构建"，其他显示"进入图谱"；他人分享给我的仅可查看
    let bottomBtn = '';
    if(isFailed){
      bottomBtn = isShared ? '' : `<div class="graph-card-actions" onclick="event.stopPropagation()"><button onclick="rebuildGraph('${g.id}')" class="rebuild-btn">重新构建</button></div>`;
    } else if(!isBuilding){
      bottomBtn = `<div class="graph-card-actions" onclick="event.stopPropagation()"><button onclick="enterTree('${g.id}')" class="enter-btn">进入图谱</button></div>`;
    }
    const cardClick = (isBuilding || isFailed) ? '' : ` onclick="enterTree('${g.id}')"`;
    const meta = `<div class="graph-card-meta"><span>创建人：${g.creator||CURRENT_USER.name} · ${permText(g)} · 节点数 ${nodeCountText}</span><span>${graphTimeText(g)}</span></div>`;
    return `<div class="graph-card" data-graph="${g.id}"${cardClick}>
      ${cardActions}
      <div class="graph-card-name">${g.name}</div>
      <div class="graph-card-tags"><span class="graph-card-tag">${graphScopeLevel(g)}</span>${statusBadge}</div>
      <div class="graph-card-desc">${g.describe||''}</div>
      ${statsBox}
      ${meta}
      ${bottomBtn}
    </div>`;
  }).join('');
  $('#graphList').innerHTML = html || '<div class="empty-state">暂无能力图谱，点击右上角新增</div>';
}

// 确认能力图谱（在详情页操作）
function confirmGraph(graphId){
  const g = graphs.find(x=>x.id===graphId);
  if(!g) return;
  if(!g.tree || !g.tree.subIndustries || g.tree.subIndustries.length===0){
    return toast('图谱尚未构建任何节点，无法确认');
  }
  g.buildStatus = 'built';
  g.confirmed = true;
  toast('能力图谱已确认');
  // 刷新详情页状态徽标和按钮
  const badge = $('#treeStatusBadge');
  if(badge){ badge.textContent = '已确认'; badge.className = 'tree-status-badge confirmed'; }
  const confirmBtn = $('#confirmGraphBtn');
  if(confirmBtn) confirmBtn.style.display = 'none';
  // 同步更新列表数据
  saveGraphs();
  renderList();
}

// 编辑图谱基本信息（名称、描述）
let editingGraphId = null;
function editGraph(graphId){
  editingGraphId = graphId;
  const g = graphs.find(x=>x.id===graphId);
  if(!g) return;
  $('#editGraphName').value = g.name || '';
  $('#editGraphDesc').value = g.describe || '';
  const scopeSel = $('#editGraphScope');
  if(scopeSel) scopeSel.value = graphScopeLevel(g);
  openModal('#editGraphModal');
}

let currentSettingsGraphId = null;
function renderOrgNode(node, selected){
  const memberIds = collectMemberIds(node);
  const allChecked = memberIds.length > 0 && memberIds.every(id=>selected.includes(id));
  const kids = node.children || [];
  const members = node.members || [];
  const typeTag = node.type ? `<span class="org-type">${node.type}</span>` : '';
  let html = `<div class="org-node" data-org="${node.id}">`;
  html += `<div class="org-row">`;
  html += (kids.length || members.length)
    ? `<button type="button" class="org-toggle" onclick="toggleOrg(event)" aria-label="展开/收起">▾</button>`
    : `<span class="org-toggle empty"></span>`;
  html += `<label class="org-check"><input type="checkbox" class="org-select" value="${node.id}" ${allChecked?'checked':''}> <span class="org-name">${node.name}</span>${typeTag}</label>`;
  html += `</div>`;
  if(kids.length || members.length){
    html += `<div class="org-body">`;
    if(members.length){
      html += `<div class="org-members">`;
      members.forEach(m=>{
        html += `<label class="org-member"><input type="checkbox" class="perm-member" value="${m.id}" ${selected.includes(m.id)?'checked':''}> <span class="org-member-name">${m.name}</span>${m.title?`<span class="org-member-title">${m.title}</span>`:''}</label>`;
      });
      html += `</div>`;
    }
    if(kids.length){
      html += `<div class="org-children">`;
      kids.forEach(c=>{ html += renderOrgNode(c, selected); });
      html += `</div>`;
    }
    html += `</div>`;
  }
  html += `</div>`;
  return html;
}
function renderOrgTree(selected){
  return ORG_TREE.map(n=>renderOrgNode(n, selected)).join('');
}
function refreshOrgTree(){
  const selectedSet = new Set([...document.querySelectorAll('.perm-member:checked')].map(c=>c.value));
  document.querySelectorAll('.org-select').forEach(cb=>{
    const node = ORG_MAP[cb.value];
    if(!node){ cb.checked = false; cb.indeterminate = false; return; }
    const ids = collectMemberIds(node);
    const sel = ids.filter(id=>selectedSet.has(id)).length;
    cb.checked = ids.length > 0 && sel === ids.length;
    cb.indeterminate = sel > 0 && sel < ids.length;
  });
  refreshPermEcho();
}
function refreshPermEcho(){
  const tree = $('#orgTree');
  const echoEl = $('#permEcho');
  const countEl = $('#permEchoCount');
  if(!tree || !echoEl) return;
  const { orgs: orgIds, members: memberIds } = collectSelectedPerm(tree);
  const total = orgIds.length + memberIds.length;
  if(countEl) countEl.textContent = total ? ('已选 ' + total + ' 项') : '当前勾选的组织与用户';
  if(!total){
    echoEl.innerHTML = '<div class="perm-echo-empty">未选择任何组织或成员，仅自己可见</div>';
    return;
  }
  let html = '';
  if(orgIds.length){
    html += '<div class="perm-echo-group-title">组织（' + orgIds.length + '）</div>';
    orgIds.forEach(oid=>{
      const node = ORG_MAP[oid];
      const name = node ? node.name : oid;
      const typeTag = node && node.type ? '<span class="org-type">' + node.type + '</span>' : '';
      html += '<div class="perm-echo-item">' + name + typeTag + '<button type="button" class="perm-echo-remove" onclick="removePermEchoItem(\'org\',\'' + oid + '\')" aria-label="移除">×</button></div>';
    });
  }
  if(memberIds.length){
    html += '<div class="perm-echo-group-title">成员（' + memberIds.length + '）</div>';
    memberIds.forEach(mid=>{
      const m = MEMBER_MAP[mid];
      const name = m ? m.name : mid;
      const title = m && m.title ? '<span class="org-member-title">' + m.title + '</span>' : '';
      html += '<div class="perm-echo-item">' + name + title + '<button type="button" class="perm-echo-remove" onclick="removePermEchoItem(\'user\',\'' + mid + '\')" aria-label="移除">×</button></div>';
    });
  }
  echoEl.innerHTML = html;
}
function removePermEchoItem(kind, id){
  const tree = $('#orgTree');
  if(!tree) return;
  if(kind === 'org'){
    const cb = tree.querySelector('.org-select[value="' + id + '"]');
    if(cb) cb.checked = false;
    const node = ORG_MAP[id];
    const ids = node ? collectMemberIds(node) : [];
    tree.querySelectorAll('.perm-member').forEach(mc=>{ if(ids.includes(mc.value)) mc.checked = false; });
  } else {
    const mc = tree.querySelector('.perm-member[value="' + id + '"]');
    if(mc) mc.checked = false;
  }
  refreshOrgTree();
}
function toggleOrg(e){
  e.stopPropagation();
  e.currentTarget.closest('.org-node').classList.toggle('collapsed');
}
function bindOrgTree(){
  const tree = $('#orgTree');
  tree.querySelectorAll('.org-select').forEach(cb=>{
    cb.onchange = ()=>{
      const node = ORG_MAP[cb.value];
      const ids = node ? collectMemberIds(node) : [];
      const check = cb.checked;
      document.querySelectorAll('.perm-member').forEach(mc=>{ if(ids.includes(mc.value)) mc.checked = check; });
      refreshOrgTree();
    };
  });
  tree.querySelectorAll('.perm-member').forEach(cb=>{ cb.onchange = refreshOrgTree; });
  refreshOrgTree();
}
function openGraphSettings(graphId){
  currentSettingsGraphId = graphId;
  const g = graphs.find(x=>x.id===graphId);
  if(!g) return;
  const selected = permFlatMembers(g);
  $('#settingsForm').innerHTML = `
    <div class="perm-layout">
      <div class="perm-pane">
        <div class="perm-heading">选择组织与成员</div>
        <div class="settings-tip">勾选可访问该图谱的组织与用户</div>
        <div class="org-tree open" id="orgTree">${renderOrgTree(selected)}</div>
      </div>
      <div class="perm-pane perm-echo">
        <div class="perm-heading">已选</div>
        <div class="settings-tip" id="permEchoCount">当前勾选的组织与用户</div>
        <div class="perm-echo-list" id="permEcho"></div>
      </div>
    </div>`;
  bindOrgTree();
  openModal('#graphSettingsModal');
}

// ========== 进入详情页（跳转到独立页面）==========
function enterTree(graphId){
  const g = graphs.find(x=>x.id===graphId);
  if(!g || !g.tree) { toast('图谱尚未构建完成'); return; }
  saveGraphs();
  location.href=GC.url('ability-graph-tree.html?id=' + graphId);
}

// ========== 详情页初始化 ==========
function initTreePage(){
  loadGraphs();
  const gid = new URLSearchParams(location.search).get('id');
  normalizeGraphs();
  if(!gid){ location.href=GC.url('ability-graph.html'); return; }
  const g = graphs.find(x=>x.id===gid);
  if(!g || !g.tree){ location.href=GC.url('ability-graph.html'); return; }
  currentGraphId = gid;
  $('#treeTitle').textContent = g.name + ' · 能力图谱';
  // 渲染状态徽标
  const badge = $('#treeStatusBadge');
  const isConfirmed = !!g.confirmed;
  if(g.buildStatus === 'building'){
    badge.textContent = '构建中';
    badge.className = 'tree-status-badge building';
  } else if(isConfirmed){
    badge.textContent = '已确认';
    badge.className = 'tree-status-badge confirmed';
  } else {
    badge.textContent = '构建完成';
    badge.className = 'tree-status-badge built';
  }
  const confirmBtn = $('#confirmGraphBtn');
  confirmBtn.style.display = (g.buildStatus === 'built' && !isConfirmed) ? '' : 'none';
  renderTreeStats(g.tree);
  renderGraph(g.tree);
}

function renderTreeStats(tree){
  const si = tree.subIndustries?.length || 0;
  let posCount=0, ablCount=0, coreCount=0;
  const ablSet = new Set();
  (tree.subIndustries||[]).forEach(sub=>{
    posCount += sub.positions?.length||0;
    (sub.positions||[]).forEach(p=>{
      (p.abilities||[]).forEach(a=>{
        ablCount++;
        if(a.core) coreCount++;
        ablSet.add(a.id);
      });
    });
  });
  $('#treeStats').innerHTML = `
    <div><span>子行业</span><strong>${si}</strong></div>
    <div><span>岗位</span><strong>${posCount}</strong></div>
    <div><span>能力项</span><strong>${ablSet.size}</strong></div>
    <div><span>核心能力</span><strong>${coreCount}</strong></div>`;
}

// SVG 横向四列布局
function renderGraph(tree){
  const subs = tree.subIndustries || [];
  // 扁平化岗位
  const positions = [];
  subs.forEach(s => {
    (s.positions||[]).forEach(p => {
      positions.push({ ...p, subId: s.id, subName: s.name });
    });
  });
  // 扁平化能力项（去重 + 记录被哪些岗位要求）
  const ablMap = new Map();
  positions.forEach(p => {
    (p.abilities||[]).forEach(a => {
      if(!ablMap.has(a.id)){
        ablMap.set(a.id, { ...a, requiredBy: [], parentPosId: p.id });
      }
      ablMap.get(a.id).requiredBy.push({ position: p.id, posName: p.name, level: a.requiredLevel });
    });
  });
  const abilities = [...ablMap.values()];

  // 布局参数
  const ROWH = 24, TOP = 18;
  const XI=[8,100], XS=[150,310], XP=[360,510], XA=[600,860];
  const GW = 868;
  const GH = TOP*2 + Math.max(abilities.length, positions.length, 1)*ROWH + 10;

  // 岗位 Y 坐标：按子行业分组排列
  const posLayout = [];
  let y = TOP + 12;
  const gaps = subs.length - 1;
  const totalSlots = positions.length + gaps * 0.7;
  const step = totalSlots > 1 ? (GH - TOP*2 - 24) / (totalSlots - 1) : 0;
  let prevSub = null;
  subs.forEach(s => {
    if(prevSub !== null) y += step * 0.7;
    (s.positions||[]).forEach(p => {
      posLayout.push({ id: p.id, y, subId: s.id });
      y += step;
    });
    prevSub = s.id;
  });
  const posY = {};
  posLayout.forEach(p => { posY[p.id] = p.y; });

  // 能力项 Y 坐标：按要求它的岗位的平均 y 排序
  const ablOrder = abilities.slice().sort((a, b) => {
    const myA = a.requiredBy.length ? a.requiredBy.reduce((s, r) => s + (posY[r.position]||0), 0) / a.requiredBy.length : 0;
    const myB = b.requiredBy.length ? b.requiredBy.reduce((s, r) => s + (posY[r.position]||0), 0) / b.requiredBy.length : 0;
    return myA - myB;
  });
  const ablY = {};
  ablOrder.forEach((a, i) => { ablY[a.id] = TOP + 12 + i * ROWH; });

  // 子行业 Y 坐标
  const subY = {};
  subs.forEach(s => {
    const ys = (s.positions||[]).map(p => posY[p.id]).filter(v => v !== undefined);
    subY[s.id] = ys.length ? (Math.min(...ys) + Math.max(...ys)) / 2 : GH / 2;
  });
  const indY = GH / 2;

  // 贝塞尔曲线连接函数
  function link(x1, y1, x2, y2){
    const dx = (x2 - x1) * 0.5;
    return `M ${x1} ${y1.toFixed(1)} C ${x1+dx} ${y1.toFixed(1)}, ${x2-dx} ${y2.toFixed(1)}, ${x2} ${y2.toFixed(1)}`;
  }

  // 构建连线
  let links = '';
  // 行业 → 子行业
  subs.forEach(s => {
    links += `<path class="glink base" d="${link(XI[1], indY, XS[0], subY[s.id])}"></path>`;
  });
  // 子行业 → 岗位
  posLayout.forEach(p => {
    links += `<path class="glink base" d="${link(XS[1], subY[p.subId], XP[0], p.y)}"></path>`;
  });
  // 岗位 → 能力项（多对多交叉连线）
  positions.forEach(p => {
    (p.abilities||[]).forEach(a => {
      const lv = (a.requiredLevel || 'L2').replace('L','');
      links += `<path class="glink lv${lv}" d="${link(XP[1], posY[p.id], XA[0]-6, ablY[a.id])}"></path>`;
    });
  });

  // 构建节点
  let nodes = '';
  // 行业节点
  nodes += `<g class="gnode" data-nid="${esc(tree.id)}" data-level="0">
    <rect x="${XI[0]}" y="${indY-18}" width="${XI[1]-XI[0]}" height="36" rx="9" fill="#edeaff" stroke="#5149e9"/>
    <text x="${(XI[0]+XI[1])/2}" y="${indY}" text-anchor="middle" dominant-baseline="central" class="gt gt-ind">${esc(tree.name)}</text></g>`;

  // 子行业节点
  subs.forEach(s => {
    const w = XS[1]-XS[0];
    nodes += `<g class="gnode${s.disabled?' off':''}" data-nid="${esc(s.id)}" data-level="1">
      <rect x="${XS[0]}" y="${subY[s.id]-15}" width="${w}" height="30" rx="8" fill="#f0f4ff" stroke="#d0d8e8"/>
      <text x="${XS[0]+11}" y="${subY[s.id]}" dominant-baseline="central" class="gt">${esc(fitText(s.name, w-38))}${s.disabled?'（已停用）':''}</text>
      <text x="${XS[1]-10}" y="${subY[s.id]}" text-anchor="end" dominant-baseline="central" class="gt gt-n">${(s.positions||[]).length}</text></g>`;
  });

  // 岗位节点
  posLayout.forEach(p => {
    const w = XP[1]-XP[0];
    const P = positions.find(x=>x.id===p.id);
    nodes += `<g class="gnode${P.disabled?' off':''}" data-nid="${esc(p.id)}" data-level="2">
      <rect x="${XP[0]}" y="${p.y-14}" width="${w}" height="28" rx="8" fill="#fff8ef" stroke="#e8d8c0"/>
      <text x="${XP[0]+11}" y="${p.y}" dominant-baseline="central" class="gt">${esc(fitText(P.name, w-38))}${P.disabled?'（已停用）':''}</text>
      <text x="${XP[1]-10}" y="${p.y}" text-anchor="end" dominant-baseline="central" class="gt gt-n">${(P.abilities||[]).length}</text></g>`;
  });

  // 能力项节点
  abilities.forEach(a => {
    const y = ablY[a.id];
    nodes += `<g class="gnode ab${a.disabled?' off':''}" data-nid="${esc(a.id)}" data-level="3">
      <rect x="${XA[0]-4}" y="${y-11}" width="${XA[1]-XA[0]+4}" height="22" rx="6" class="abbg"/>
      <text x="${XA[0]+14}" y="${y}" dominant-baseline="central" class="gt gt-ab">${esc(fitText(a.name, 180))}${a.core ? ' ★' : ''}${a.disabled?'（已停用）':''}</text>
      ${a.requiredBy.length > 1
        ? `<g><rect x="${XA[1]-58}" y="${y-9}" width="54" height="18" rx="9" fill="#fff3e0" stroke="#ffb74d"/><text x="${XA[1]-31}" y="${y}" text-anchor="middle" dominant-baseline="central" class="gt" style="font-size:10px;fill:#e65100;font-weight:600;">共享×${a.requiredBy.length}</text></g>`
        : `<text x="${XA[1]-4}" y="${y}" text-anchor="end" dominant-baseline="central" class="gt gt-n">×${a.requiredBy.length}</text>`}</g>`;
  });

  // 操作按钮覆盖层已移除，改用右键菜单和左键选中
  let actionOverlay = '';

  const colHeaders = `<text x="${XI[0]}" y="8" class="gch">行业</text>
    <text x="${XS[0]}" y="8" class="gch">子行业 ${subs.length}</text>
    <text x="${XP[0]}" y="8" class="gch">岗位 ${positions.length}</text>
    <text x="${XA[0]}" y="8" class="gch">能力项 ${abilities.length}</text>`;

  $('#treeContainer').innerHTML = `<div class="tree-svg-wrap" style="min-width:${GW}px">
    <svg viewBox="0 0 ${GW} ${GH}" preserveAspectRatio="xMidYMin meet" role="img" aria-label="四层能力树形图">
      <g class="colhead">${colHeaders}</g>
      ${links}${nodes}
    </svg>
  </div>`;
  bindNodeEvents();
}

// 当前选中节点
let selectedNodeId = null;

function selectNode(nodeId){
  selectedNodeId = nodeId;
  document.querySelectorAll('.gnode').forEach(g => {
    g.classList.toggle('sel', g.dataset.nid === nodeId);
  });
}

function hideContextMenu(){
  const m = $('#contextMenu');
  if(m){ m.classList.remove('open'); m.setAttribute('aria-hidden','true'); }
}

function showContextMenu(nodeId, level, x, y){
  const m = $('#contextMenu');
  if(!m) return;
  const labels = ['行业','子行业','岗位','能力项'];
  let items = '';
  // 添加子节点（仅 0/1/2 层级）
  if(level < 3){
    items += `<div class="context-menu-item" data-cmd="add" data-nid="${nodeId}" data-level="${level}"><span class="cm-icon">＋</span>添加${level===0?'子行业':level===1?'岗位':'能力项'}</div>`;
    items += `<div class="context-menu-separator"></div>`;
  }
  // 添加同级节点（level > 0）
  if(level > 0){
    items += `<div class="context-menu-item" data-cmd="addSibling" data-nid="${nodeId}" data-level="${level}"><span class="cm-icon">＋</span>添加同级${labels[level]}</div>`;
  }
  // 编辑（所有层级）
  items += `<div class="context-menu-item" data-cmd="edit" data-nid="${nodeId}" data-level="${level}"><span class="cm-icon">✎</span>编辑${labels[level]}</div>`;
  // 删除 / 停用（仅 1/2/3 层级，根节点不可删）：被全景图谱引用的节点只能停用
  if(level > 0){
    const f = findNode(nodeId, level);
    if(f && f.node.disabled)
      items += `<div class="context-menu-item" data-cmd="restore" data-nid="${nodeId}" data-level="${level}"><span class="cm-icon">↺</span>恢复启用</div>`;
    else if(f && isReferenced(f.node))
      items += `<div class="context-menu-item danger" data-cmd="retire" data-nid="${nodeId}" data-level="${level}"><span class="cm-icon">⊘</span>停用${labels[level]}</div>`;
    else
      items += `<div class="context-menu-item danger" data-cmd="delete" data-nid="${nodeId}" data-level="${level}"><span class="cm-icon">✕</span>删除${labels[level]}</div>`;
  }
  m.innerHTML = items;
  // 边界处理
  const w = 180, h = items.split('context-menu-item').length * 32 + 10;
  const maxX = window.innerWidth - w - 4;
  const maxY = window.innerHeight - h - 4;
  m.style.left = Math.min(x, maxX) + 'px';
  m.style.top = Math.min(y, maxY) + 'px';
  m.classList.add('open');
  m.setAttribute('aria-hidden','false');
  // 绑定菜单项点击
  m.querySelectorAll('.context-menu-item').forEach(it => {
    it.onclick = (e) => {
      e.stopPropagation();
      const cmd = it.dataset.cmd;
      const nid = it.dataset.nid;
      const lv = parseInt(it.dataset.level);
      hideContextMenu();
      if(cmd === 'add') openAddChild(nid, lv);
      else if(cmd === 'addSibling') addSibling(nid, lv);
      else if(cmd === 'edit') editNode(nid, lv);
      else if(cmd === 'delete') deleteNode(nid, lv);
      else if(cmd === 'retire') retireNode(nid, lv);
      else if(cmd === 'restore') restoreNode(nid, lv);
    };
  });
}

// 添加同级节点：找到父节点，在父节点下添加同类型子节点
function addSibling(nodeId, level){
  const parentResult = findParent(nodeId, level);
  if(!parentResult || !parentResult.parent){ toast('无法添加同级节点'); return; }
  const parentLevel = parentResult.level - 1;
  openAddChild(parentResult.parent.id, parentLevel);
}

// 节点事件：选中 + 右键菜单
function bindNodeEvents(){
  const svg = document.querySelector('.tree-svg-wrap svg');
  if(!svg) return;
  // 左键点击：选中节点
  svg.addEventListener('click', e => {
    const g = e.target.closest('g.gnode');
    if(!g){ return; }
    const nid = g.dataset.nid;
    selectNode(nid);
  });
  // 右键：弹出操作菜单
  svg.addEventListener('contextmenu', e => {
    const g = e.target.closest('g.gnode');
    if(!g) return;
    e.preventDefault();
    const nid = g.dataset.nid;
    const lv = parseInt(g.dataset.level);
    selectNode(nid);
    showContextMenu(nid, lv, e.clientX, e.clientY);
  });
  // 复用原 hover 联动
  bindNodeHover();
}

// SVG 节点 hover 联动（操作按钮已移除，仅保留函数避免报错）
function bindNodeHover(){}

// 文本截断
function fitText(s, maxPx, fontSize){
  if(!s) return '';
  if(!fontSize) fontSize = 11.5;
  const charW = fontSize * 0.95;
  const max = Math.floor(maxPx / charW);
  return s.length > max ? s.slice(0, max-1) + '…' : s;
}

// 以下函数保留供 CRUD 使用
function getNodeChildren(node, level){
  if(level === 0) return node.subIndustries;
  if(level === 1) return node.positions;
  if(level === 2) return node.abilities;
  return null;
}

function setNodeChildren(node, level, children){
  if(level === 0) node.subIndustries = children;
  else if(level === 1) node.positions = children;
  else if(level === 2) node.abilities = children;
}

// ========== 查找节点 ==========
function findNode(nodeId, level){
  const g = graphs.find(x=>x.id===currentGraphId);
  if(!g || !g.tree) return null;
  return _findInTree(g.tree, nodeId, 0);
}

function _findInTree(node, nodeId, level){
  if(node.id === nodeId) return { node, level };
  const children = getNodeChildren(node, level);
  if(children){
    for(const c of children){
      const found = _findInTree(c, nodeId, level+1);
      if(found) return found;
    }
  }
  return null;
}

function findParent(nodeId, level){
  const g = graphs.find(x=>x.id===currentGraphId);
  if(!g || !g.tree) return null;
  if(level === 0) return { parent: null, level: -1 };
  return _findParentInTree(g.tree, nodeId, 0, null);
}

function _findParentInTree(node, nodeId, level, parent){
  if(node.id === nodeId) return { parent, level };
  const children = getNodeChildren(node, level);
  if(children){
    for(const c of children){
      const found = _findParentInTree(c, nodeId, level+1, node);
      if(found) return found;
    }
  }
  return null;
}

// ========== 删除图谱 ==========
function deleteGraph(graphId){
  if(!confirm('确认删除该能力图谱？此操作不可撤销。')) return;
  graphs = graphs.filter(g=>g.id!==graphId);
  toast('已删除能力图谱');
  saveGraphs();
  renderList();
}

// ========== 删除节点 ==========
function deleteNode(nodeId, level){
  if(!confirm('确认删除该节点及其所有子节点？')) return;
  const result = findParent(nodeId, level);
  if(!result || !result.parent) { toast('无法删除根节点'); return; }
  const children = getNodeChildren(result.parent, result.level-1);
  const idx = children.findIndex(c=>c.id===nodeId);
  if(idx>-1){
    children.splice(idx,1);
    setNodeChildren(result.parent, result.level-1, children);
    toast('已删除节点');
    const g = graphs.find(x=>x.id===currentGraphId);
    renderGraph(g.tree);
    renderTreeStats(g.tree);
    saveGraphs();
  }
}

// ========== 停用节点 ==========
// 原型约定：已同步进全景图谱的节点（演示数据 n1、n2…）视为被引用；本次新增的节点未被引用，仍可删除
function isReferenced(node){ return /^n\d+$/.test(node.id); }
function walkNode(node, level, fn){
  fn(node);
  (getNodeChildren(node, level) || []).forEach(c => walkNode(c, level+1, fn));
}
// 同一能力项可被多个岗位引用（共享），按 ID 统一设置
function setDisabled(tree, ids, val){
  walkNode(tree, 0, n => { if(ids[n.id]){ if(val) n.disabled = true; else delete n.disabled; } });
}
function retireNode(nodeId, level){
  const g = graphs.find(x=>x.id===currentGraphId);
  const f = findNode(nodeId, level);
  if(!g || !f) return;
  // 下级里仍被其他岗位要求的共享能力项不随之停用
  const outside = {};
  (function walkOut(n, lv){
    if(n === f.node) return;
    outside[n.id] = true;
    (getNodeChildren(n, lv) || []).forEach(c => walkOut(c, lv+1));
  })(g.tree, 0);
  const ids = {}; let sub = 0;
  ids[f.node.id] = true;
  walkNode(f.node, level, n => { if(n !== f.node && !outside[n.id]){ ids[n.id] = true; sub++; } });
  const labels = ['行业','子行业','岗位','能力项'];
  NodeRetire.open({
    name: f.node.name, typeLabel: labels[level], subCount: sub, graph: g.name,
    // 能力图谱是行业级共享来源，同行业各专业只读引用
    majors: /旅游/.test(g.tree.name) ? ['酒店管理','旅游管理'] : [g.tree.name+'相关专业'],
    onConfirm: () => {
      setDisabled(g.tree, ids, true);
      renderGraph(g.tree); renderTreeStats(g.tree); saveGraphs();
      toast('已停用「'+f.node.name+'」，已生成影响分析记录');
    }
  });
}
function restoreNode(nodeId, level){
  const g = graphs.find(x=>x.id===currentGraphId);
  const f = findNode(nodeId, level);
  if(!g || !f) return;
  const ids = {};
  walkNode(f.node, level, n => { ids[n.id] = true; });
  setDisabled(g.tree, ids, false);
  renderGraph(g.tree); renderTreeStats(g.tree); saveGraphs();
  toast('已恢复启用「'+f.node.name+'」');
}

// ========== 编辑节点弹窗 ==========
let editingNodeId = null, editingNodeLevel = -1;

function editNode(nodeId, level){
  editingNodeId = nodeId;
  editingNodeLevel = level;
  const result = findNode(nodeId, level);
  if(!result) return;
  const node = result.node;
  const g = getGraph();
  const tree = g?.tree;
  const titles = ['编辑行业','编辑子行业','编辑岗位','编辑能力项'];
  $('#editNodeTitle').textContent = titles[level] || '编辑节点';
  let fields = `<label>名称<input id="editName" type="text" value="${esc(node.name||'')}" /></label>`;
  if(level <= 2 && node.describe !== undefined) fields += `<label>描述<textarea id="editDesc" rows="3">${esc(node.describe||'')}</textarea></label>`;
  if(level === 3){
    fields += `<label>类型<select id="editType"><option value="knowledge" ${node.type==='knowledge'?'selected':''}>知识</option><option value="skill" ${node.type==='skill'?'selected':''}>技能</option><option value="attitude" ${node.type==='attitude'?'selected':''}>素养</option></select></label>`;
    fields += `<label>领域<input id="editDomain" type="text" value="${esc(node.domain||'')}" /></label>`;
    fields += `<label>L1 要求（选填）<input id="editL1" type="text" value="${esc(node.l1Req||'')}" placeholder="L1 级别的要求描述" /></label>`;
    fields += `<label>L2 要求（选填）<input id="editL2" type="text" value="${esc(node.l2Req||'')}" placeholder="L2 级别的要求描述" /></label>`;
    fields += `<label>L3 要求（选填）<input id="editL3" type="text" value="${esc(node.l3Req||'')}" placeholder="L3 级别的要求描述" /></label>`;
    fields += `<label>核心能力<select id="editCore"><option value="true" ${node.core?'selected':''}>是</option><option value="false" ${!node.core?'selected':''}>否</option></select></label>`;
    fields += `<label>行为描述<textarea id="editBehavior" rows="3">${esc(node.behaviorDesc||'')}</textarea></label>`;
    fields += `<label>评估方式<input id="editAssess" type="text" value="${esc(node.assessMethod||'')}" /></label>`;
  }
  // 上下层关系调整（仅 1/2/3 层级，参考新增节点的字段结构）
  if(tree && level === 1){
    // 编辑子行业：上层=行业（只读），下层=岗位多选
    fields += `<label>上层节点（行业）<input type="text" value="${esc(tree.name)}" disabled /></label>`;
    const allPos = [];
    (tree.subIndustries||[]).forEach(s=>(s.positions||[]).forEach(p=>allPos.push({id:p.id,name:p.name,subName:s.name,inSub:s.id===node.id})));
    if(allPos.length){
      fields += `<label>下层节点（岗位 · 勾选移入当前子行业）<div class="checkbox-group">`;
      allPos.forEach(p=>{
        fields += `<label><input type="checkbox" class="edit-child" value="${p.id}" ${p.inSub?'checked':''}> ${esc(p.name)} <span style="color:var(--text3);font-size:11px">(原属：${esc(p.subName)})</span></label>`;
      });
      fields += `</div></label>`;
    } else {
      fields += `<label>下层节点（岗位）<span style="font-size:12px;color:var(--text3)">暂无可选岗位</span></label>`;
    }
  } else if(tree && level === 2){
    // 编辑岗位：上层=子行业下拉，下层=能力项多选
    const pr = findParent(node.id, level);
    const parentSubId = pr?.parent?.id || '';
    fields += `<label>上层节点（子行业）<select id="editParentSub">`;
    (tree.subIndustries||[]).forEach(s=>{
      fields += `<option value="${s.id}" ${s.id===parentSubId?'selected':''}>${esc(s.name)}</option>`;
    });
    fields += `</select></label>`;
    const allAbl = new Map();
    (tree.subIndustries||[]).forEach(s=>(s.positions||[]).forEach(p=>(p.abilities||[]).forEach(a=>{
      if(!allAbl.has(a.id)) allAbl.set(a.id, {id:a.id,name:a.name,posName:p.name,inPos:p.id===node.id});
    })));
    if(allAbl.size){
      fields += `<label>下层节点（能力项 · 勾选移入当前岗位）<div class="checkbox-group">`;
      [...allAbl.values()].forEach(a=>{
        fields += `<label><input type="checkbox" class="edit-child" value="${a.id}" ${a.inPos?'checked':''}> ${esc(a.name)}</label>`;
      });
      fields += `</div></label>`;
    } else {
      fields += `<label>下层节点（能力项）<span style="font-size:12px;color:var(--text3)">暂无可选能力项</span></label>`;
    }
  } else if(tree && level === 3){
    // 编辑能力项：上层=岗位下拉，无下层
    const pr = findParent(node.id, level);
    const parentPosId = pr?.parent?.id || '';
    fields += `<label>上层节点（岗位）<select id="editParentPos">`;
    (tree.subIndustries||[]).forEach(s=>(s.positions||[]).forEach(p=>{
      fields += `<option value="${p.id}" ${p.id===parentPosId?'selected':''}>${esc(p.name)}</option>`;
    }));
    fields += `</select></label>`;
  }
  $('#editNodeForm').innerHTML = fields;
  openModal('#editNodeModal');
}

if($('#submitEditNode')) $('#submitEditNode').onclick = ()=>{
  const result = findNode(editingNodeId, editingNodeLevel);
  if(!result) return;
  const { node, level } = result;
  const g = getGraph();
  const tree = g?.tree;
  // 基础属性
  node.name = $('#editName').value.trim() || node.name;
  if($('#editDesc')) node.describe = $('#editDesc').value.trim();
  if($('#editType')) node.type = $('#editType').value;
  if($('#editDomain')) node.domain = $('#editDomain').value.trim();
  if($('#editL1')){ node.l1Req = $('#editL1').value.trim(); }
  if($('#editL2')){ node.l2Req = $('#editL2').value.trim(); }
  if($('#editL3')){ node.l3Req = $('#editL3').value.trim(); node.requiredLevel = node.l3Req ? 'L3' : (node.l2Req ? 'L2' : 'L1'); }
  if($('#editCore')) node.core = $('#editCore').value === 'true';
  if($('#editBehavior')) node.behaviorDesc = $('#editBehavior').value.trim();
  if($('#editAssess')) node.assessMethod = $('#editAssess').value.trim();
  // 处理上下层关系调整
  if(tree && level === 1){
    // 编辑子行业：勾选=移入当前子行业，取消勾选=移出到其他子行业
    const cbs = [...document.querySelectorAll('#editNodeForm .edit-child')];
    const checkedIds = new Set(cbs.filter(c=>c.checked).map(c=>c.value));
    // 勾选的岗位：从其他子行业移入
    checkedIds.forEach(pid=>{
      if((node.positions||[]).find(p=>p.id===pid)) return;
      (tree.subIndustries||[]).forEach(s=>{
        if(s.id!==node.id){
          const idx=(s.positions||[]).findIndex(p=>p.id===pid);
          if(idx>-1){ node.positions=node.positions||[]; node.positions.push(s.positions.splice(idx,1)[0]); }
        }
      });
    });
    // 取消勾选的岗位：从当前子行业移出，放到第一个其他子行业
    const otherSubs=(tree.subIndustries||[]).filter(s=>s.id!==node.id);
    cbs.filter(c=>!c.checked).forEach(cb=>{
      const pid=cb.value;
      const idx=(node.positions||[]).findIndex(p=>p.id===pid);
      if(idx>-1){
        const moved=node.positions.splice(idx,1)[0];
        if(otherSubs.length){ otherSubs[0].positions=otherSubs[0].positions||[]; otherSubs[0].positions.push(moved); }
        else { node.positions.push(moved); toast('岗位必须属于一个子行业，已保留原位'); }
      }
    });
  } else if(tree && level === 2){
    // 编辑岗位：上层变更
    const newParentId=$('#editParentSub')?.value;
    if(newParentId){
      const oldPr=findParent(node.id, level);
      if(oldPr?.parent?.id !== newParentId){
        if(oldPr?.parent){
          const idx=(oldPr.parent.positions||[]).findIndex(p=>p.id===node.id);
          if(idx>-1) oldPr.parent.positions.splice(idx,1);
        }
        const newSub=(tree.subIndustries||[]).find(s=>s.id===newParentId);
        if(newSub){ newSub.positions=newSub.positions||[]; newSub.positions.push(node); }
      }
    }
    // 下层能力项：勾选=移入，取消勾选=移出到其他岗位
    const cbs=[...document.querySelectorAll('#editNodeForm .edit-child')];
    const checkedIds=new Set(cbs.filter(c=>c.checked).map(c=>c.value));
    checkedIds.forEach(aid=>{
      if((node.abilities||[]).find(a=>a.id===aid)) return;
      (tree.subIndustries||[]).forEach(s=>(s.positions||[]).forEach(p=>{
        if(p.id!==node.id){
          const a=(p.abilities||[]).find(x=>x.id===aid);
          if(a){ node.abilities=node.abilities||[]; node.abilities.push({ ...a }); }
        }
      }));
    });
    const allOtherPos=[];
    (tree.subIndustries||[]).forEach(s=>(s.positions||[]).forEach(p=>{ if(p.id!==node.id) allOtherPos.push(p); }));
    cbs.filter(c=>!c.checked).forEach(cb=>{
      const aid=cb.value;
      const idx=(node.abilities||[]).findIndex(a=>a.id===aid);
      if(idx>-1){
        // Check if shared with another position
        const isShared = (tree.subIndustries||[]).some(s=>(s.positions||[]).some(p=>p.id!==node.id && (p.abilities||[]).some(a=>a.id===aid)));
        if(isShared){
          node.abilities.splice(idx,1);
        } else {
          const moved=node.abilities.splice(idx,1)[0];
          if(allOtherPos.length){ allOtherPos[0].abilities=allOtherPos[0].abilities||[]; allOtherPos[0].abilities.push(moved); }
          else { node.abilities.push(moved); toast('能力项必须属于一个岗位，已保留原位'); }
        }
      }
    });
  } else if(tree && level === 3){
    // 编辑能力项：上层变更
    const newParentId=$('#editParentPos')?.value;
    if(newParentId){
      const oldPr=findParent(node.id, level);
      if(oldPr?.parent?.id !== newParentId){
        if(oldPr?.parent){
          const idx=(oldPr.parent.abilities||[]).findIndex(a=>a.id===node.id);
          if(idx>-1) oldPr.parent.abilities.splice(idx,1);
        }
        let newParent=null;
        (tree.subIndustries||[]).forEach(s=>{ const p=(s.positions||[]).find(p=>p.id===newParentId); if(p) newParent=p; });
        if(newParent){ newParent.abilities=newParent.abilities||[]; newParent.abilities.push(node); }
      }
    }
  }
  closeModal('#editNodeModal');
  toast('已保存修改');
  if(tree){ renderGraph(tree); renderTreeStats(tree); saveGraphs(); }
};

// ========== 添加子节点弹窗 ==========

// ========== 新增节点弹框 ==========
function getGraph(){ return graphs.find(x=>x.id===currentGraphId); }

function openAddNodeModal(){
  aiGeneratedChildren = [];
  const aiResults = $('#newNodeAIResults');
  if(aiResults) aiResults.innerHTML = '';
  $('#newNodeName').value = '';
  $('#newNodeType').value = '2';
  $('#newNodeExtraFields').innerHTML = '';
  updateNodeParentOptions();
  openModal('#addNodeModal');
}

function updateNodeParentOptions(){
  const g = getGraph();
  if(!g || !g.tree) return;
  const type = parseInt($('#newNodeType').value);
  const tree = g.tree;
  let parents = [];
  let children = [];
  if(type === 1){ // 子行业 → 上层=行业, 下层=岗位
    parents = [{id:tree.id, name:tree.name}];
    children = [];
    (tree.subIndustries||[]).forEach(s=>{ (s.positions||[]).forEach(p=>children.push({id:p.id,name:p.name})) });
  } else if(type === 2){ // 岗位 → 上层=子行业, 下层=能力项
    const ablSet = new Map();
    (tree.subIndustries||[]).forEach(s=>{
      parents.push({id:s.id, name:s.name});
      (s.positions||[]).forEach(p=>{
        (p.abilities||[]).forEach(a=>{
          if(!ablSet.has(a.id)) ablSet.set(a.id, {id:a.id,name:a.name,requiredLevel:a.requiredLevel});
        });
      });
    });
    children = [...ablSet.values()];
  } else if(type === 3){ // 能力项 → 上层=岗位, 无下层
    (tree.subIndustries||[]).forEach(s=>{
      (s.positions||[]).forEach(p=>parents.push({id:p.id,name:p.name}));
    });
    children = [];
  }
  // 填充上层节点下拉
  $('#newNodeParent').innerHTML = parents.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
  // 能力项类型：隐藏下层节点
  $('#newNodeChildrenWrap').style.display = type === 3 ? 'none' : 'block';
  // 更新标签文案
  const lbl = document.querySelector('#newNodeChildrenLabel');
  if(lbl) lbl.firstChild.nodeValue = type === 2 ? '能力项（可多选）' : '下层节点（可多选）';
  // 填充下层节点多选
  if(children.length){
    if(type === 2){
      // 岗位：每个能力项附带 L1/L2/L3 勾选
      $('#newNodeChildren').innerHTML = children.map(c=>{
        const lvl = '';
        const l1Chk = lvl === 'L1' ? 'checked' : '';
        const l2Chk = lvl === 'L2' ? 'checked' : '';
        const l3Chk = lvl === 'L3' ? 'checked' : '';
        return `<div class="ability-select-row" data-id="${c.id}" style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid #f0f0f0;">
          <label style="flex:1;display:flex;align-items:center;gap:6px;"><input type="checkbox" class="abi-check" value="${c.id}" onclick="autoSelectL2(this)"> ${c.name}</label>
          <span style="display:flex;gap:6px;">
            <label style="font-size:12px;display:flex;align-items:center;gap:2px;"><input type="radio" class="abi-level" name="lvl-${c.id}" value="L1" ${l1Chk}> L1</label>
            <label style="font-size:12px;display:flex;align-items:center;gap:2px;"><input type="radio" class="abi-level" name="lvl-${c.id}" value="L2" ${l2Chk}> L2</label>
            <label style="font-size:12px;display:flex;align-items:center;gap:2px;"><input type="radio" class="abi-level" name="lvl-${c.id}" value="L3" ${l3Chk}> L3</label>
          </span>
        </div>`;
      }).join('');
    } else {
      $('#newNodeChildren').innerHTML = children.map(c=>`<label><input type="checkbox" class="child-check" onclick="updateMSTrigger(this)" value="${c.id}"> ${c.name}</label>`).join('');
    }
  } else {
    $('#newNodeChildren').innerHTML = '<span style="font-size:12px;color:var(--text3)">暂无可选下层节点</span>';
  }
  // 能力项额外字段
  if(type === 3){
    // 收集当前图谱中所有已存在的能力项作为前置能力候选
    const allAbi = [];
    (g?.tree?.subIndustries||[]).forEach(sub=>(sub.positions||[]).forEach(pos=>(pos.abilities||[]).forEach(ab=>allAbi.push({id:ab.id,name:ab.name}))));
    const prereqOpts = allAbi.map(a=>`<label><input type="checkbox" value="${a.id}"> ${a.name}</label>`).join('');
    $('#newNodeExtraFields').innerHTML = `
      <label>类型<select id="newNodeAbiType"><option value="knowledge">知识</option><option value="skill">技能</option><option value="attitude">素养</option></select></label>
      <label>领域<input id="newNodeDomain" type="text" placeholder="如：产品策划与行程设计" /></label>
      <div style="margin-bottom:15px;border-left:3px solid #5149e9;padding-left:10px;">
        <div style="color:var(--text2);font-size:12px;font-weight:600;margin-bottom:7px;">L1 要求</div>
        <label>描述（必输）<input id="newNodeL1" type="text" placeholder="L1 级别的要求描述" /></label>
        <label>建议考核方式<input id="newNodeL1Assess" type="text" placeholder="如：模拟讲解考核" /></label>
      </div>
      <div id="newL2Block" style="display:none;margin-bottom:15px;border-left:3px solid #5149e9;padding-left:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;color:var(--text2);font-size:12px;font-weight:600;margin-bottom:7px;">L2 要求 <button type="button" onclick="removeLevel('newL2Block','newL2AddBtn')" style="border:none;background:none;color:#f44;cursor:pointer;font-size:12px;">× 删除</button></div>
        <label>描述<input id="newNodeL2" type="text" placeholder="L2 级别的要求描述" /></label>
        <label>建议考核方式<input id="newNodeL2Assess" type="text" placeholder="如：方案评审" /></label>
      </div>
      <div id="newL3Block" style="display:none;margin-bottom:15px;border-left:3px solid #5149e9;padding-left:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;color:var(--text2);font-size:12px;font-weight:600;margin-bottom:7px;">L3 要求 <button type="button" onclick="removeLevel('newL3Block','newL3AddBtn')" style="border:none;background:none;color:#f44;cursor:pointer;font-size:12px;">× 删除</button></div>
        <label>描述<input id="newNodeL3" type="text" placeholder="L3 级别的要求描述" /></label>
        <label>建议考核方式<input id="newNodeL3Assess" type="text" placeholder="如：限时实操考核" /></label>
      </div>
      <div style="margin-bottom:15px;display:flex;gap:8px;">
        <button type="button" id="newL2AddBtn" onclick="addLevel('newL2Block','newL2AddBtn')" style="border:1px solid #5149e9;color:#5149e9;background:#fff;border-radius:6px;padding:4px 12px;font-size:12px;cursor:pointer;">+ 增加 L2</button>
        <button type="button" id="newL3AddBtn" onclick="addLevel('newL3Block','newL3AddBtn')" style="border:1px solid #5149e9;color:#5149e9;background:#fff;border-radius:6px;padding:4px 12px;font-size:12px;cursor:pointer;">+ 增加 L3</button>
      </div>
      <label>核心能力<select id="newNodeCore"><option value="false">否</option><option value="true">是</option></select></label>
      <div style="margin-bottom:15px;"><span style="display:block;color:var(--text2);font-size:12px;font-weight:600;">前置能力项（选填，可多选）</span><div id="newNodePrereq" class="checkbox-group" style="margin-top:7px;">${prereqOpts || '<span style="font-size:12px;color:#999;">暂无可选能力项</span>'}</div></div>
      <label>行为描述<textarea id="newNodeBehavior" rows="2" placeholder="描述该能力项的可观察行为（可选）"></textarea></label>`;
  } else {
    $('#newNodeExtraFields').innerHTML = '<label>描述<textarea id="newNodeDesc" rows="2" placeholder="描述（可选）"></textarea></label>';
  }
}

$('#addNodeBtn')?.addEventListener('click', openAddNodeModal);
$('#newNodeType')?.addEventListener('change', ()=>{ aiGeneratedChildren = []; updateNodeParentOptions(); });

$('#submitAddNode')?.addEventListener('click', ()=>{
  const g = getGraph();
  if(!g || !g.tree) return toast('请先打开图谱');
  const name = $('#newNodeName').value.trim();
  if(!name) return toast('请输入节点名称');
  const type = parseInt($('#newNodeType').value);
  const parentId = $('#newNodeParent').value;
  const tree = g.tree;
  const newNode = { id: uid(), name };

  if(type === 1){ // 子行业
    newNode.describe = ($('#newNodeDesc')?.value || '').trim();
    newNode.positions = [];
    // 找到选中的下层节点（岗位），移动到这个新子行业下
    const checkedBoxes = [...$('#newNodeChildrenWrap').querySelectorAll('.child-check:checked')];
    newNode.positions = checkedBoxes.map(cb => {
      const cid = cb.value;
      if(cb.dataset.new === 'true'){
        const gen = aiGeneratedChildren.find(p=>p.id===cid);
        return gen ? { ...gen } : null;
      }
      let found = null;
      (tree.subIndustries||[]).forEach(s=>{
        const idx = (s.positions||[]).findIndex(p=>p.id===cid);
        if(idx>-1){ found = s.positions.splice(idx,1)[0]; }
      });
      return found;
    }).filter(Boolean);
    tree.subIndustries = tree.subIndustries || [];
    tree.subIndustries.push(newNode);
  } else if(type === 2){ // 岗位
    newNode.describe = ($('#newNodeDesc')?.value || '').trim();
    newNode.careerLevel = '';
    newNode.abilities = [];
    // 找到选中的能力项，链接到新岗位并更新 L1/L2/L3
    const rows = [...$('#newNodeChildrenWrap').querySelectorAll('.ability-select-row')];
    rows.forEach(row => {
      const check = row.querySelector('.abi-check');
      if(!check || !check.checked) return;
      const cid = check.value;
      const levelRadio = row.querySelector('.abi-level:checked');
      const lvl = levelRadio ? levelRadio.value : 'L2';
      if(row.dataset.new === 'true'){
        const gen = aiGeneratedChildren.find(a=>a.id===cid);
        if(gen){ gen.requiredLevel = lvl; newNode.abilities.push({ ...gen }); }
        return;
      }
      let found = null;
      (tree.subIndustries||[]).forEach(s=>{
        (s.positions||[]).forEach(p=>{
          const a = (p.abilities||[]).find(x=>x.id===cid);
          if(a && !found) found = { ...a };
        });
      });
      if(!found) return;
      found.requiredLevel = lvl;
      newNode.abilities.push(found);
    });
    // 找到父节点（子行业），添加岗位
    const sub = (tree.subIndustries||[]).find(s=>s.id===parentId);
    if(sub){ sub.positions = sub.positions || []; sub.positions.push(newNode); }
  } else if(type === 3){ // 能力项
    const l1 = ($('#newNodeL1')?.value || '').trim();
    if(!l1) return toast('L1 描述为必输项');
    const l2Vis = $('#newL2Block')?.style.display !== 'none';
    const l3Vis = $('#newL3Block')?.style.display !== 'none';
    const l2 = l2Vis ? ($('#newNodeL2')?.value || '').trim() : '';
    const l3 = l3Vis ? ($('#newNodeL3')?.value || '').trim() : '';
    newNode.type = $('#newNodeAbiType').value;
    newNode.domain = $('#newNodeDomain').value.trim();
    newNode.l1Req = l1;
    newNode.l1AssessMethod = ($('#newNodeL1Assess')?.value || '').trim();
    newNode.l2Req = l2;
    newNode.l2AssessMethod = l2Vis ? ($('#newNodeL2Assess')?.value || '').trim() : '';
    newNode.l3Req = l3;
    newNode.l3AssessMethod = l3Vis ? ($('#newNodeL3Assess')?.value || '').trim() : '';
    newNode.requiredLevel = (l3Vis && l3) ? 'L3' : ((l2Vis && l2) ? 'L2' : 'L1');
    newNode.core = $('#newNodeCore').value === 'true';
    newNode.behaviorDesc = $('#newNodeBehavior').value.trim();
    newNode.assessMethod = newNode.l1AssessMethod || '';
    newNode.inferred = false;
    newNode.flag = null;
    const prereqBox = $('#newNodePrereq');
    newNode.prerequisites = prereqBox ? [...prereqBox.querySelectorAll('input:checked')].map(c=>c.value) : [];
    // 找到父节点（岗位），添加能力项
    let parentPos = null;
    (tree.subIndustries||[]).forEach(s=>{
      const p = (s.positions||[]).find(p=>p.id===parentId);
      if(p) parentPos = p;
    });
    if(parentPos){ parentPos.abilities = parentPos.abilities || []; parentPos.abilities.push(newNode); }
  }
  closeModal('#addNodeModal');
  toast('已添加节点：' + name);
  renderGraph(tree);
  renderTreeStats(tree);
  renderList();
  saveGraphs();
});

$('#cancelAddNode')?.addEventListener('click', ()=>closeModal('#addNodeModal'));
$('#closeAddNode')?.addEventListener('click', ()=>closeModal('#addNodeModal'));
$('#addNodeModal')?.addEventListener('click', e=>{ if(e.target.id==='addNodeModal') closeModal('#addNodeModal'); });


let addChildParentId = null, addChildLevel = -1;

function openAddChild(parentId, level){
  aiGeneratedChildren = [];
  addChildParentId = parentId;
  addChildLevel = level;
  const result = findNode(parentId, level);
  if(!result) return;
  const g = getGraph();
  const tree = g?.tree;
  const childLabels = ['子行业','岗位','能力项'];
  $('#addChildTitle').textContent = '添加' + childLabels[level];
  let fields = `<label>名称<input id="addChildName" type="text" placeholder="请输入${childLabels[level]}名称" /></label>`;

  if(level === 0){
    // 子行业：下层节点（岗位可多选）
    const positions = [];
    (tree?.subIndustries||[]).forEach(s=>(s.positions||[]).forEach(p=>positions.push({id:p.id,name:p.name})));
    const posHtml = positions.length
      ? positions.map(p=>`<label><input type="checkbox" class="child-check" onclick="updateMSTrigger(this)" value="${p.id}"> ${p.name}</label>`).join('')
      : '<span style="font-size:12px;color:#999;">暂无可选岗位</span>';
    fields += `<span style="display:block;color:var(--text2);font-size:12px;font-weight:600;margin-bottom:7px;">下层节点（可多选）</span>`;
    fields += `<div class="ms-dropdown"><button type="button" class="ms-trigger" id="addChildMSTrigger0" onclick="toggleMS('addChildChildren','addChildMSTrigger0')">请选择</button><div id="addChildChildren" class="checkbox-group ms-panel">${posHtml}</div></div>`;
    fields += `<label>描述<textarea id="addChildDesc" rows="2" placeholder="描述（可选）"></textarea></label>`;
  }

  if(level === 1){
    // 岗位：能力项（可多选）附带 L1/L2/L3 单选
    const ablSet = new Map();
    (tree?.subIndustries||[]).forEach(s=>(s.positions||[]).forEach(p=>(p.abilities||[]).forEach(a=>{
      if(!ablSet.has(a.id)) ablSet.set(a.id, {id:a.id,name:a.name,requiredLevel:a.requiredLevel});
    })));
    const abilities = [...ablSet.values()];
    const abiHtml = abilities.length
      ? abilities.map(c=>{
          const lvl = '';
          const l1Chk = lvl === 'L1' ? 'checked' : '';
          const l2Chk = lvl === 'L2' ? 'checked' : '';
          const l3Chk = lvl === 'L3' ? 'checked' : '';
          return `<div class="ability-select-row" data-id="${c.id}" style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid #f0f0f0;">
            <label style="flex:1;display:flex;align-items:center;gap:6px;"><input type="checkbox" class="abi-check" value="${c.id}" onclick="autoSelectL2(this)"> ${c.name}</label>
            <span style="display:flex;gap:6px;">
              <label style="font-size:12px;display:flex;align-items:center;gap:2px;"><input type="radio" class="abi-level" name="lvl-${c.id}" value="L1" ${l1Chk}> L1</label>
              <label style="font-size:12px;display:flex;align-items:center;gap:2px;"><input type="radio" class="abi-level" name="lvl-${c.id}" value="L2" ${l2Chk}> L2</label>
              <label style="font-size:12px;display:flex;align-items:center;gap:2px;"><input type="radio" class="abi-level" name="lvl-${c.id}" value="L3" ${l3Chk}> L3</label>
            </span>
          </div>`;
        }).join('')
      : '<span style="font-size:12px;color:#999;">暂无可选能力项</span>';
    fields += `<span style="display:block;color:var(--text2);font-size:12px;font-weight:600;margin-bottom:7px;">能力项（可多选）</span>`;
    fields += `<div class="ms-dropdown"><button type="button" class="ms-trigger" id="addChildMSTrigger1" onclick="toggleMS('addChildAbilities','addChildMSTrigger1')">请选择</button><div id="addChildAbilities" class="checkbox-group ms-panel">${abiHtml}</div></div>`;
    fields += `<label>描述<textarea id="addChildDesc" rows="2" placeholder="描述（可选）"></textarea></label>`;
  }

  if(level === 2){
    // 能力项：与新增节点弹框完全一致
    fields += `<label>类型<select id="addChildType"><option value="knowledge">知识</option><option value="skill">技能</option><option value="attitude">素养</option></select></label>`;
    fields += `<label>领域<input id="addChildDomain" type="text" placeholder="如：产品策划与行程设计" /></label>`;
    fields += `<div style="margin-bottom:15px;border-left:3px solid #5149e9;padding-left:10px;">
      <div style="color:var(--text2);font-size:12px;font-weight:600;margin-bottom:7px;">L1 要求</div>
      <label>描述（必输）<input id="addChildL1" type="text" placeholder="L1 级别的要求描述" /></label>
      <label>建议考核方式<input id="addChildL1Assess" type="text" placeholder="如：模拟讲解考核" /></label>
    </div>
    <div id="childL2Block" style="display:none;margin-bottom:15px;border-left:3px solid #5149e9;padding-left:10px;">
      <div style="display:flex;justify-content:space-between;align-items:center;color:var(--text2);font-size:12px;font-weight:600;margin-bottom:7px;">L2 要求 <button type="button" onclick="removeLevel('childL2Block','childL2AddBtn')" style="border:none;background:none;color:#f44;cursor:pointer;font-size:12px;">× 删除</button></div>
      <label>描述<input id="addChildL2" type="text" placeholder="L2 级别的要求描述" /></label>
      <label>建议考核方式<input id="addChildL2Assess" type="text" placeholder="如：方案评审" /></label>
    </div>
    <div id="childL3Block" style="display:none;margin-bottom:15px;border-left:3px solid #5149e9;padding-left:10px;">
      <div style="display:flex;justify-content:space-between;align-items:center;color:var(--text2);font-size:12px;font-weight:600;margin-bottom:7px;">L3 要求 <button type="button" onclick="removeLevel('childL3Block','childL3AddBtn')" style="border:none;background:none;color:#f44;cursor:pointer;font-size:12px;">× 删除</button></div>
      <label>描述<input id="addChildL3" type="text" placeholder="L3 级别的要求描述" /></label>
      <label>建议考核方式<input id="addChildL3Assess" type="text" placeholder="如：限时实操考核" /></label>
    </div>
    <div style="margin-bottom:15px;display:flex;gap:8px;">
      <button type="button" id="childL2AddBtn" onclick="addLevel('childL2Block','childL2AddBtn')" style="border:1px solid #5149e9;color:#5149e9;background:#fff;border-radius:6px;padding:4px 12px;font-size:12px;cursor:pointer;">+ 增加 L2</button>
      <button type="button" id="childL3AddBtn" onclick="addLevel('childL3Block','childL3AddBtn')" style="border:1px solid #5149e9;color:#5149e9;background:#fff;border-radius:6px;padding:4px 12px;font-size:12px;cursor:pointer;">+ 增加 L3</button>
    </div>`;
    fields += `<label>核心能力<select id="addChildCore"><option value="false">否</option><option value="true">是</option></select></label>`;
    const allAbilities = [];
    (g?.tree?.subIndustries||[]).forEach(sub=>(sub.positions||[]).forEach(pos=>(pos.abilities||[]).forEach(ab=>allAbilities.push({id:ab.id,name:ab.name}))));
    const prereqOptions = allAbilities.map(a=>`<label><input type="checkbox" value="${a.id}"> ${a.name}</label>`).join('');
    fields += `<div style="margin-bottom:15px;"><span style="display:block;color:var(--text2);font-size:12px;font-weight:600;">前置能力项（选填，可多选）</span><div id="addChildPrereq" class="checkbox-group" style="margin-top:7px;">${prereqOptions || '<span style="font-size:12px;color:#999;">暂无可选能力项</span>'}</div></div>`;
    fields += `<label>行为描述<textarea id="addChildBehavior" rows="2" placeholder="描述该能力项的可观察行为（可选）"></textarea></label>`;
  }
  $('#addChildForm').innerHTML = fields;
  openModal('#addChildModal');
}

if($('#submitAddChild')) $('#submitAddChild').onclick = ()=>{
  const name = $('#addChildName').value.trim();
  if(!name) return toast('请输入名称');
  const result = findNode(addChildParentId, addChildLevel);
  if(!result) return;
  const node = result.node;
  const child = { id: uid(), name };
  const g = graphs.find(x=>x.id===currentGraphId);
  const tree = g?.tree;

  if(addChildLevel === 0){
    // 子行业
    child.describe = ($('#addChildDesc')?.value || '').trim();
    child.positions = [];
    // 找到选中的岗位，移动到这个新子行业下
    const checkedBoxes = [...$('#addChildForm').querySelectorAll('.child-check:checked')];
    checkedBoxes.forEach(cb => {
      const cid = cb.value;
      if(cb.dataset.new === 'true'){
        const gen = aiGeneratedChildren.find(p=>p.id===cid);
        if(gen) child.positions.push({ ...gen });
      } else {
        let found = null;
        (tree?.subIndustries||[]).forEach(s=>{
          const idx = (s.positions||[]).findIndex(p=>p.id===cid);
          if(idx>-1){ found = s.positions.splice(idx,1)[0]; }
        });
        if(found) child.positions.push(found);
      }
    });
  }

  if(addChildLevel === 1){
    // 岗位
    child.describe = ($('#addChildDesc')?.value || '').trim();
    child.careerLevel = '';
    child.abilities = [];
    // 找到选中的能力项，移动到新岗位并设置等级
    const rows = [...$('#addChildForm').querySelectorAll('.ability-select-row')];
    rows.forEach(row => {
      const check = row.querySelector('.abi-check');
      if(!check || !check.checked) return;
      const cid = check.value;
      const levelRadio = row.querySelector('.abi-level:checked');
      const lvl = levelRadio ? levelRadio.value : 'L2';
      if(row.dataset.new === 'true'){
        const gen = aiGeneratedChildren.find(a=>a.id===cid);
        if(gen){ gen.requiredLevel = lvl; child.abilities.push({ ...gen }); }
        return;
      }
      let found = null;
      (tree?.subIndustries||[]).forEach(s=>{
        (s.positions||[]).forEach(p=>{
          const a = (p.abilities||[]).find(x=>x.id===cid);
          if(a && !found) found = { ...a };
        });
      });
      if(!found) return;
      found.requiredLevel = lvl;
      child.abilities.push(found);
    });
  }

  if(addChildLevel === 2){
    // 能力项
    const l1 = ($('#addChildL1')?.value || '').trim();
    if(!l1) return toast('L1 描述为必输项');
    const l2Vis = $('#childL2Block')?.style.display !== 'none';
    const l3Vis = $('#childL3Block')?.style.display !== 'none';
    const l2 = l2Vis ? ($('#addChildL2')?.value || '').trim() : '';
    const l3 = l3Vis ? ($('#addChildL3')?.value || '').trim() : '';
    child.type = $('#addChildType').value;
    child.domain = $('#addChildDomain').value.trim();
    child.l1Req = l1;
    child.l1AssessMethod = ($('#addChildL1Assess')?.value || '').trim();
    child.l2Req = l2;
    child.l2AssessMethod = l2Vis ? ($('#addChildL2Assess')?.value || '').trim() : '';
    child.l3Req = l3;
    child.l3AssessMethod = l3Vis ? ($('#addChildL3Assess')?.value || '').trim() : '';
    child.requiredLevel = (l3Vis && l3) ? 'L3' : ((l2Vis && l2) ? 'L2' : 'L1');
    child.core = $('#addChildCore').value === 'true';
    child.behaviorDesc = $('#addChildBehavior').value.trim();
    child.assessMethod = child.l1AssessMethod || '';
    const prereqBox = $('#addChildPrereq');
    child.prerequisites = prereqBox ? [...prereqBox.querySelectorAll('input:checked')].map(c=>c.value) : [];
    child.inferred = false;
    child.flag = null;
  }
  const children = getNodeChildren(node, addChildLevel) || [];
  children.push(child);
  setNodeChildren(node, addChildLevel, children);
  expandedNodes.add(node.id);
  closeModal('#addChildModal');
  toast('已添加' + (addChildLevel===0?'子行业':addChildLevel===1?'岗位':'能力项'));
  renderGraph(tree);
  renderTreeStats(tree);
  saveGraphs();
};

// ========== 弹窗通用 ==========
function openModal(sel){ $(sel).classList.add('open'); $(sel).setAttribute('aria-hidden','false'); }
function closeModal(sel){ $(sel).classList.remove('open'); $(sel).setAttribute('aria-hidden','true'); }

if($('#closeEditNode')) $('#closeEditNode').onclick = ()=>closeModal('#editNodeModal');
if($('#cancelEditNode')) $('#cancelEditNode').onclick = ()=>closeModal('#editNodeModal');
if($('#closeAddChild')) $('#closeAddChild').onclick = ()=>closeModal('#addChildModal');
if($('#cancelAddChild')) $('#cancelAddChild').onclick = ()=>closeModal('#addChildModal');
if($('#editNodeModal')) $('#editNodeModal').onclick = e=>{if(e.target.id==='editNodeModal')closeModal('#editNodeModal')};
if($('#addChildModal')) $('#addChildModal').onclick = e=>{if(e.target.id==='addChildModal')closeModal('#addChildModal')};

// ========== 新增能力图谱 ==========
if($('#createGraphButton')) $('#createGraphButton').onclick = ()=>{
  $('#newGraphScope').value = defaultAgScope();
  $('#newGraphName').value = '';
  $('#newGraphDesc').value = '';
  onGraphScopeChange();
  openModal('#createGraphModal');
};
if($('#closeCreateGraph')) $('#closeCreateGraph').onclick = ()=>closeModal('#createGraphModal');
if($('#cancelCreateGraph')) $('#cancelCreateGraph').onclick = ()=>closeModal('#createGraphModal');

if($('#manualCreateGraph')) $('#manualCreateGraph').onclick = ()=>{
  const scope = readGraphScope();
  const err = graphScopeError(scope);
  if(err) return toast(err);
  closeModal('#createGraphModal');
  // 手动创建：直接生成所选层级下的空树骨架，不经过 AI 构建
  const newId = uid();
  const name = graphScopeName(scope);
  const newTree = { id:uid(), name:name, aliases:[], describe:scope.desc, info:{stats:{positions:0,distinctAbilities:0,subIndustries:0}}, subIndustries:[] };
  graphs.push({ id:newId, name, describe:scope.desc, scopeLevel:scope.scopeLevel, industryName:scope.industryName, subIndustryName:scope.subIndustryName, positionName:scope.positionName, buildStatus:'built', syncStatus:'', creator:CURRENT_USER.name, createdAt:nowDateTime(), stats:{positions:0,abilities:0,subIndustries:0}, tree:newTree });
  renderList();
  saveGraphs();
  toast('已创建空能力图谱，请手动添加节点');
};
if($('#createGraphModal')) $('#createGraphModal').onclick = e=>{if(e.target.id==='createGraphModal')closeModal('#createGraphModal')};

if($('#submitCreateGraph')) $('#submitCreateGraph').onclick = ()=>{
  const scope = readGraphScope();
  const err = graphScopeError(scope);
  if(err) return toast(err);
  closeModal('#createGraphModal');
  // 显示AI构建中
  showBuildingAnimation(scope);
};

function showBuildingAnimation(scope){
  if($('#treeView')) $('#treeView').style.display = 'none';
  if($('#listView')) $('#listView').style.display = 'block';
  // 添加构建中的卡片
  const tempId = 'temp-' + uid();
  const name = graphScopeName(scope);
  graphs.push({ id:tempId, name, describe:scope.desc, scopeLevel:scope.scopeLevel, industryName:scope.industryName, subIndustryName:scope.subIndustryName, positionName:scope.positionName, buildStatus:'building', syncStatus:'', creator:CURRENT_USER.name, createdAt:nowDateTime(), stats:{positions:0,abilities:0,subIndustries:0}, tree:null });
  renderList();
  // 模拟AI构建过程
  const card = document.querySelector(`[data-graph="${tempId}"]`);
  if(card) card.querySelector('.graph-card-stats').innerHTML = '<div class="loading-overlay"><div class="loading-spinner"></div><div class="loading-text">AI 正在分析行业语料并构建能力图谱…</div></div>';
  setTimeout(()=>{
    const idx = graphs.findIndex(g=>g.id===tempId);
    if(idx===-1) return;
    // 模拟30%概率构建失败
    if(Math.random() < 0.3){
      graphs[idx].buildStatus = 'build_failed';
      renderList();
      saveGraphs();
      toast('AI 构建失败，请重新构建');
      return;
    }
    // 构建完成：按所选层级生成树
    const newTree = buildGraphTree(scope);
    graphs[idx].buildStatus = 'built';
    graphs[idx].tree = newTree;
    graphs[idx].stats = graphStats(newTree);
    renderList();
    saveGraphs();
    toast('AI 已完成「'+name+'」能力图谱构建，请进入编辑');
  }, 3000);
};

// 重新构建图谱
function rebuildGraph(graphId){
  const g = graphs.find(x=>x.id===graphId);
  if(!g) return;
  const scope = { scopeLevel: graphScopeLevel(g), industryName: g.industryName || g.name, subIndustryName: g.subIndustryName, positionName: g.positionName, desc: g.describe };
  g.buildStatus = 'building';
  g.syncStatus = '';
  g.tree = null;
  g.stats = { positions:0, abilities:0, subIndustries:0 };
  renderList();
  // 显示构建中动画
  const card = document.querySelector(`[data-graph="${graphId}"]`);
  if(card) card.querySelector('.graph-card-stats').innerHTML = '<div class="loading-overlay"><div class="loading-spinner"></div><div class="loading-text">AI 正在分析行业语料并构建能力图谱…</div></div>';
  setTimeout(()=>{
    const idx = graphs.findIndex(x=>x.id===graphId);
    if(idx===-1) return;
    if(Math.random() < 0.3){
      graphs[idx].buildStatus = 'build_failed';
      renderList();
      saveGraphs();
      toast('AI 构建失败，请重新构建');
      return;
    }
    const newTree = buildGraphTree(scope);
    graphs[idx].buildStatus = 'built';
    graphs[idx].tree = newTree;
    graphs[idx].stats = graphStats(newTree);
    renderList();
    saveGraphs();
    toast('AI 已完成能力图谱构建，请进入编辑');
  }, 3000);
}

// ========== 详情页按钮 ==========
// ========== 检查更新：按市场变化生成更新建议（mock，仅「旅游业」有示例数据） ==========
function marketUpdateItems(g){
  if(!g || g.id!=='g1' || !g.tree) return [];
  const subs = g.tree.subIndustries||[];
  const sub = name => subs.find(s=>s.name===name);
  const pos = name => subs.flatMap(s=>s.positions||[]).find(p=>p.name===name);
  const abl = (p,name) => p && (p.abilities||[]).find(a=>a.name===name);
  const items = [];
  const guide = pos('导游');
  if(guide && !abl(guide,'短视频与直播讲解')) items.push({ id:'ag-live', kind:'add', title:'新增能力项「短视频与直播讲解」',
    path:'旅游业 › 旅行社与组团地接服务 › 导游', editName:'短视频与直播讲解',
    desc:'导游岗位 JD 中「短视频拍摄」「直播讲解」「账号运营」的要求快速增加，现有能力项未覆盖线上讲解场景。建议类型：技能 · 讲解服务与文化传播 · 要求等级 L2。',
    metrics:[{v:'23%',label:'导游 JD 提及率（近 90 天）',trend:'14pt',dir:'up'},{v:'2,140',label:'导游岗位 JD 样本'},{v:'3 个月',label:'连续上升'}],
    links:['招聘平台 A：导游岗位 1,320 条（2026-07 至 2026-10）','招聘平台 B：导游岗位 820 条','行业报告：《2026 文旅从业者技能需求调研》'],
    conf:.91, impact:'0 条映射（新增后需在知识体系补技能）' });
  const op = pos('旅行社计调'), sys = abl(op,'计调操作系统与订单处理');
  if(sys && sys.requiredLevel==='L2') items.push({ id:'ag-level', kind:'modify', title:'「计调操作系统与订单处理」要求等级提高',
    path:'旅游业 › 旅行社与组团地接服务 › 旅行社计调', diff:{label:'要求等级 ',from:'L2',to:'L3'},
    desc:'计调 JD 普遍要求同时处理 OTA 多平台订单与库存同步，超出 L2「熟练录入、改单与退单」的描述。',
    metrics:[{v:'41%',label:'要求多平台订单对接',trend:'17pt',dir:'up'},{v:'960',label:'计调岗位 JD 样本'}],
    links:['招聘平台 A：计调岗位 610 条','招聘平台 B：计调岗位 350 条'],
    conf:.84, impact:'2 条映射需复核等级' });
  const study = sub('研学旅行与定制旅游策划执行');
  if(study && !(study.positions||[]).some(p=>p.name==='定制旅行师')) items.push({ id:'ag-pos', kind:'add', title:'新增岗位「定制旅行师」',
    path:'旅游业 › 研学旅行与定制旅游策划执行', editName:'定制旅行师',
    desc:'定制游需求增长，出现独立招聘的「定制旅行师」岗位。建议同时新增 2 个能力项：客户需求访谈与画像、定制行程方案设计与报价。',
    metrics:[{v:'680',label:'定制旅行师 JD（近 90 天）',trend:'2.1 倍',dir:'up'},{v:'1',label:'相关新职业公告'}],
    links:['人社部新职业信息公告（示例）','招聘平台 A：定制旅行师 420 条','招聘平台 B：定制旅行师 260 条'],
    conf:.87, impact:'新增 1 个岗位、2 个能力项' });
  const ai = abl(guide,'AI行程规划工具应用');
  if(ai && ai.flag) items.push({ id:'ag-emerging', kind:'modify', title:'「AI行程规划工具应用」转为常规能力',
    path:'旅游业 › 旅行社与组团地接服务 › 导游', diff:{label:'标记 ',from:ai.flag,to:'常规能力'},
    desc:'该能力已连续 3 个月在导游 JD 中稳定出现（提及率 > 15%），不再属于仅有市场来源的新兴能力。',
    metrics:[{v:'18%',label:'导游 JD 提及率',trend:'2pt',dir:'up'},{v:'3 个月',label:'稳定超过门槛 15%'}],
    links:['招聘平台 A、B 导游岗位连续 3 个月统计'],
    conf:.79, impact:'1 个能力项标记变化' });
  const applied = g.appliedUpdates || {};
  return items.filter(x => !(x.id in applied));
}
function applyMarketUpdates(g, accepted){
  g.appliedUpdates = g.appliedUpdates || {};
  accepted.forEach(x => g.appliedUpdates[x.id] = x.name || x.title);
  const subs = g.tree.subIndustries||[];
  const pos = name => subs.flatMap(s=>s.positions||[]).find(p=>p.name===name);
  accepted.forEach(x=>{
    if(x.id==='ag-live') pos('导游').abilities.push({ id:uid(), name:x.name, type:'skill', domain:'讲解服务与文化传播', core:false, weight:0.2, requiredLevel:'L2',
      behaviorDesc:'策划并完成短视频讲解或直播导览，内容准确、节奏适合线上观看', observablePoints:['产出 1–3 分钟讲解短视频','完成一场 30 分钟直播导览','回应直播间提问'], assessMethod:'作品评审', inferred:true, flag:'新兴能力：仅有市场来源' });
    if(x.id==='ag-level'){ const a=(pos('旅行社计调').abilities||[]).find(a=>a.name==='计调操作系统与订单处理'); a.requiredLevel='L3'; a.behaviorDesc='熟练处理多平台（含 OTA）订单录入、改退与库存同步'; }
    if(x.id==='ag-pos') subs.find(s=>s.name==='研学旅行与定制旅游策划执行').positions.push({ id:uid(), name:x.name, aliases:['定制师'], describe:'根据客户需求设计并落地个性化旅行方案', careerLevel:'中级',
      abilities:[
        { id:uid(), name:'客户需求访谈与画像', type:'skill', domain:'产品策划与行程设计', core:true, weight:0.4, requiredLevel:'L2', behaviorDesc:'通过访谈梳理客户偏好、预算与禁忌并形成画像', observablePoints:['输出客户需求画像','识别隐性需求'], assessMethod:'情景模拟', inferred:true, flag:'新兴能力：仅有市场来源' },
        { id:uid(), name:'定制行程方案设计与报价', type:'skill', domain:'产品策划与行程设计', core:true, weight:0.6, requiredLevel:'L3', behaviorDesc:'独立完成定制行程方案、资源采购与报价', observablePoints:['产出含成本明细的定制方案','提供至少两套备选'], assessMethod:'方案评审', inferred:true, flag:'新兴能力：仅有市场来源' }
      ]});
    if(x.id==='ag-emerging'){ const a=(pos('导游').abilities||[]).find(a=>a.name==='AI行程规划工具应用'); a.flag=null; a.inferred=false; }
  });
  let posCount=0; const ablSet=new Set();
  subs.forEach(s=>{ posCount+=(s.positions||[]).length; (s.positions||[]).forEach(p=>(p.abilities||[]).forEach(a=>ablSet.add(a.id))); });
  g.stats = { subIndustries:subs.length, positions:posCount, abilities:ablSet.size };
  const m = /^v(\d+)\.(\d+)$/.exec(g.version||'v1.0');
  g.version = 'v'+m[1]+'.'+(+m[2]+1);
  g.updatedAt = nowDateTime();
  saveGraphs(); renderTreeStats(g.tree); renderGraph(g.tree);
  return '已更新到 '+g.version+'：采纳 '+accepted.length+' 项市场变化';
}
const ABILITY_HIST_SEED = [
  { time:'2026-09-14 10:32', from:'v1.0', version:'v1.1', scope:'旅游业 · 全国 · 近 90 天', acc:2, ign:1, total:3,
    items:[{kind:'add', name:'多语言导览服务'},{kind:'modify', name:'「旅游产品与目的地知识储备」要求等级提高'}] },
  { time:'2026-09-28 14:05', from:'v1.1', version:'v1.2', scope:'旅游业 · 全国 · 近 90 天', acc:1, ign:2, total:3,
    items:[{kind:'add', name:'旅行管家'}] },
  { time:'2026-10-12 09:40', from:'v1.2', version:'v1.3', scope:'旅游业 · 全国 · 近 90 天', acc:1, ign:0, total:1,
    items:[{kind:'retire', name:'「手绘地图讲解」不再满足需求'}] }
];
function mountGraphUpdate(){
  if(!$('#checkUpdateBtn') || !window.GraphUpdate) return;
  const cur = () => graphs.find(x=>x.id===currentGraphId);
  GraphUpdate.mount({
    btn:'#checkUpdateBtn', title:'能力图谱更新报告', toast,
    scope: (cur()?.name||'') + ' · 全国 · 近 90 天',
    sources:['招聘 JD 12,480 条','新职业公告 1 条','行业报告 3 份'],
    lastChecked:'2026-10-13（每月自动检查）',
    steps:['拉取近 90 天招聘数据','识别岗位与能力要求','与当前图谱比对','生成更新建议'],
    storeKey:'gu-ignored-ability-'+currentGraphId,
    version: () => cur()?.version || 'v1.0',
    disabled: () => cur()?.buildStatus==='building' ? '图谱构建中，暂不能检查更新' : false,
    getItems: () => marketUpdateItems(cur()),
    onApply: acc => applyMarketUpdates(cur(), acc),
    seedHist: currentGraphId==='g1' ? ABILITY_HIST_SEED : undefined
  });
}
if($('#confirmGraphBtn')) $('#confirmGraphBtn').onclick = ()=>{ if(currentGraphId) confirmGraph(currentGraphId); };
if($('#saveGraphBtn')) $('#saveGraphBtn').onclick = ()=>{
  saveGraphs();
  // 重新计算统计
  const g = graphs.find(x=>x.id===currentGraphId);
  if(g && g.tree){
    let posCount=0, ablCount=0;
    const ablSet = new Set();
    (g.tree.subIndustries||[]).forEach(s=>{
      posCount += (s.positions||[]).length;
      (s.positions||[]).forEach(p=>(p.abilities||[]).forEach(a=>{ ablCount++; ablSet.add(a.id); }));
    });
    g.stats = { subIndustries:(g.tree.subIndustries||[]).length, positions:posCount, abilities:ablSet.size };
    renderTreeStats(g.tree);
  }
  toast('已保存');
};

// HTML转义
function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// 点击空白处关闭右键菜单
document.addEventListener('click', e => {
  if(!e.target.closest('.context-menu') && !e.target.closest('g.gnode')) hideContextMenu();
  if(!e.target.closest('.card-action-menu') && !e.target.closest('.corner-more')) hideCardMenu();
});
document.addEventListener('scroll', ()=>{ hideContextMenu(); hideCardMenu(); }, true);
window.addEventListener('resize', ()=>{ hideContextMenu(); hideCardMenu(); });

// 编辑图谱弹窗事件（仅列表页）
if($('#submitEditGraph')){
  $('#submitEditGraph').onclick = ()=>{
    const g = graphs.find(x=>x.id===editingGraphId);
    if(!g) return;
    const name = $('#editGraphName').value.trim();
    if(!name) return toast('请输入图谱名称');
    g.name = name;
    g.describe = $('#editGraphDesc').value.trim();
    // 同步树根节点名称
    if(g.tree) g.tree.name = name;
    saveGraphs(); renderList(); closeModal('#editGraphModal'); toast('已保存图谱信息');
  };
  $('#closeEditGraph').onclick = ()=>closeModal('#editGraphModal');
  $('#cancelEditGraph').onclick = ()=>closeModal('#editGraphModal');
  $('#editGraphModal').onclick = e=>{ if(e.target.id==='editGraphModal') closeModal('#editGraphModal'); };
}
if($('#closeGraphSettings')){
  $('#closeGraphSettings').onclick = ()=>closeModal('#graphSettingsModal');
  $('#cancelGraphSettings').onclick = ()=>closeModal('#graphSettingsModal');
  $('#submitGraphSettings').onclick = ()=>{
    const g = graphs.find(x=>x.id===currentSettingsGraphId);
    if(!g){ closeModal('#graphSettingsModal'); return; }
    g.permissions = collectSelectedPerm($('#orgTree'));
    saveGraphs(); renderList(); closeModal('#graphSettingsModal'); toast('设置已保存');
  };
  $('#graphSettingsModal').onclick = e=>{ if(e.target.id==='graphSettingsModal') closeModal('#graphSettingsModal'); };
}

// 页面初始化：根据当前页面元素决定执行列表页还是详情页
if($('#graphList')){
  // 列表页
  if($('#agScopeFilter')) $('#agScopeFilter').onchange = renderList;
  if($('#agStatusFilter')) $('#agStatusFilter').onchange = renderList;
  if($('#agOwnerFilter')) $('#agOwnerFilter').onchange = renderList;
  if($('#agSearchInput')) $('#agSearchInput').onkeydown = e => { if(e.key==='Enter') renderList(); };
  if($('#agSearchBtn')) $('#agSearchBtn').onclick = renderList;
  const hadData = loadGraphs();
  // 确保示例数据中的构建失败卡片存在
  if(!graphs.find(g=>g.id==='g4' && g.buildStatus==='build_failed')){
    graphs = graphs.filter(g=>g.id!=='g4');
    graphs.push({ id:'g4', name:'物流行业', describe:'以仓储管理、运输调度与供应链协同为核心能力体系。', buildStatus:'build_failed', syncStatus:'', createdAt:'2026-09-12', stats:{positions:0,abilities:0,subIndustries:0}, tree:null });
    saveGraphs();
  }
  normalizeGraphs();
  renderList();
} else if($('#treeContainer')){
  // 详情页
  initTreePage();
  mountGraphUpdate();
}
