/* ============================================================
   公共 mock 数据：当前用户、专业树、行业列表
   原型演示用。真实环境由「账号管理」和后端接口提供，此处为前端模拟。
   ============================================================ */

// ===== 当前用户（原型支持切换身份）=====
// role: 'admin' | 'teacher'；teacher 带「可授课程」，teacher_empty 用于演示「暂无可授课程」
var USERS = {
  admin:         { role:'admin',   name:'平台管理员', major:'',            teachableCourses:[] },
  teacher:       { role:'teacher', name:'张明',       major:'导游专业',     teachableCourses:['导游业务','研学旅行管理与服务'] },
  teacher_empty: { role:'teacher', name:'李四',       major:'酒店管理专业', teachableCourses:[] }
};
// 图谱中心：按智慧课堂当前身份取用户（管理端=平台管理员，教师端=当前教师）；单独打开时默认「张明（教师）」
var CURRENT_USER = (window.GC && GC.platformUser) ? GC.platformUser(USERS) : USERS.teacher;
function switchUser(key){ if(USERS[key]) CURRENT_USER = USERS[key]; }

// ===== 专业树：专业大类 → 专业 → 课程 =====
var MAJOR_TREE = [
  { name: '旅游类', majors: [
    { name: '导游专业', courses: ['导游业务', '研学旅行管理与服务', '景区讲解', '旅游政策法规'] },
    { name: '酒店管理专业', courses: ['前厅服务与管理', '客房服务与管理', '餐饮服务与管理'] },
    { name: '旅行社经营与管理专业', courses: ['旅行社计调业务', '旅游市场营销'] },
    { name: '研学旅行管理与服务专业', courses: ['研学课程设计', '研学旅行组织'] }
  ]},
  { name: '军事类', majors: [
    { name: '国防教育专业', courses: ['国防教育基础', '军事理论'] }
  ]},
  { name: '电子信息类', majors: [
    { name: '电子信息工程技术专业', courses: ['电路基础', '嵌入式系统开发'] }
  ]},
  { name: '其他', majors: [
    { name: '通用专业', courses: ['职业素养', '信息技术基础'] }
  ]}
];

// ===== 课程列表（mock「课程管理」）：平铺，每门课带「所属专业」 =====
var COURSE_LIST = [];
MAJOR_TREE.forEach(function(cat){
  cat.majors.forEach(function(m){
    m.courses.forEach(function(c){ COURSE_LIST.push({ name:c, major:m.name }); });
  });
});
// 预置「已被关联」的课程（演示唯一性提示）：导游业务 已被《导游业务》知识体系关联
var PRE_LINKED_COURSE = { name:'导游业务', linkedKs:'导游业务' };

// ===== 行业列表（能力图谱）：行业 → 子行业 / 岗位 =====
var INDUSTRY_LIST = [
  { name: '旅游业', subIndustries: ['旅行社', '景区运营', '研学定制', '在线旅游平台', '酒店前厅'], positions: ['研学旅行指导师', '导游', '酒店前台', '旅游计调'] },
  { name: '电商行业', subIndustries: ['网店运营', '直播带货', '供应链服务'], positions: ['电商运营', '直播主播', '客服专员'] },
  { name: '酒店管理', subIndustries: ['前厅', '客房', '餐饮'], positions: ['前厅接待', '客房主管', '餐饮领班'] },
  { name: '物流行业', subIndustries: ['仓储', '运输', '供应链'], positions: ['仓储管理', '运输调度'] }
];

// ===== 通用取数辅助 =====
// 并入平台后专业取管理端「专业管理」（与课程的所属专业一致）：层级不限，任意一层都可选，
// path 为完整路径，category（专业大类）取该节点的最上层节点
function eduMajors(){ return window.TK ? TK.load().edu : null; }
function allMajors(){
  var E = eduMajors();
  if(E){
    return TK.majorTree(E).filter(function(x){ return x.m.status === '启用'; }).map(function(x){
      var top = TK.majorTop(E, x.m.id);
      return { name: x.m.name, path: TK.majorPath(E, x.m.id), category: top && top.id !== x.m.id ? top.name : '' };
    });
  }
  var list = [];
  MAJOR_TREE.forEach(function(cat){ cat.majors.forEach(function(m){ list.push({ name: m.name, category: cat.name }); }); });
  return list;
}
function categoryOfMajor(majorName){
  var E = eduMajors();
  if(E){ var m = E.majors.filter(function(x){ return x.name === majorName; })[0], top = m && TK.majorTop(E, m.id); return top && top.id !== m.id ? top.name : null; }
  var found = null;
  MAJOR_TREE.forEach(function(cat){ cat.majors.forEach(function(m){ if(m.name === majorName) found = cat.name; }); });
  return found;
}
// 教师「所属专业」的上级大类
function teacherCategory(){
  return categoryOfMajor(CURRENT_USER.major);
}
// 可选「专业大类」：不区分角色，老师也可生成专业大类级体系，返回全部大类
function selectableCategories(){
  var E = eduMajors();
  if(E) return E.majors.filter(function(m){ return !m.parentId && m.status === '启用'; }).map(function(m){ return m.name; });
  return MAJOR_TREE.map(function(c){ return c.name; });
}
// 可选「专业」：管理员全部 / 教师仅本人所属专业
function selectableMajors(){
  if(CURRENT_USER.role === 'admin') return allMajors();
  var c = teacherCategory();
  return [{ name: CURRENT_USER.major, category: c }];
}
// 可选「课程」：管理员该专业全部 / 教师仅可授课程
function selectableCourses(majorName){
  var major = null;
  MAJOR_TREE.forEach(function(cat){ cat.majors.forEach(function(m){ if(m.name === majorName) major = m; }); });
  if(!major) return [];
  if(CURRENT_USER.role === 'admin') return major.courses;
  return major.courses.filter(function(c){ return CURRENT_USER.teachableCourses.indexOf(c) >= 0; });
}
// 知识体系「范围」默认值：教师=课程，管理员=专业
function defaultKsRange(){ return '专业大类'; }
// 能力图谱「范围」默认值：教师=岗位，管理员=行业
function defaultAgScope(){ return CURRENT_USER.role === 'teacher' ? '岗位' : '行业'; }

// ===== 关联对象取数（知识体系「关联对象」下拉用）=====
function allCategories(){ return selectableCategories(); }
function allCourses(){ return COURSE_LIST; }
// 并入平台后：「关联课程」取管理端「课程管理」的课程（与教务同一份数据，页面需引入 teacher-kit.js）；
// 管理员全部 / 教师只列自己课程计划里的课程；公共基础课没有所属专业
function eduRelCourses(){
  if(!window.TK) return null;
  var S = TK.load();
  var maj = function(id){ var m = S.edu.majors.filter(function(x){ return x.id === id; })[0]; return m ? m.name : ''; };
  var mine = CURRENT_USER.role === 'admin' ? null : S.plans.filter(function(p){ return p.teacher === CURRENT_USER.name; }).map(function(p){ return p.eduCourseId; });
  return S.edu.courses.filter(function(c){ return c.status === '启用' && (!mine || mine.indexOf(c.id) >= 0); })
    .map(function(c){ return { id: c.id, name: c.name, major: maj(c.majorId), type: c.type }; });
}
// 可选「关联课程」：管理员全部 / 教师仅可授课程（带所属专业）
function selectableRelCourses(){
  var edu = eduRelCourses(); if(edu) return edu;
  if(CURRENT_USER.role === 'admin') return COURSE_LIST;
  return COURSE_LIST.filter(function(c){ return CURRENT_USER.teachableCourses.indexOf(c.name) >= 0; });
}
// 课程是否属于该专业（含其下级专业）
function courseInMajor(courseMajor, majorName){
  if(!majorName) return true;
  var E = eduMajors();
  if(!E) return courseMajor === majorName;
  var m = E.majors.filter(function(x){ return x.name === majorName; })[0];
  if(!m) return false;
  return TK.majorSubIds(E, m.id).some(function(id){ var y = E.majors.filter(function(x){ return x.id === id; })[0]; return y && y.name === courseMajor; });
}
// 课程所属专业
function majorOfCourse(courseName){
  var list = eduRelCourses() || COURSE_LIST;
  var c = list.find(function(x){ return x.name === courseName; });
  return c ? c.major : '';
}

/* ============================================================
   AI 构建（当前为前端 mock，接入真实 AI 时替换此处）
   知识体系调用入口：knowledge-system.html 的 submitCreateKs()
   能力图谱调用入口：ability-graph.js 的 showBuildingAnimation()
   真实接入：把下面 mock 函数替换为后端 / Dify 工作流调用。
   入参：范围 + 对象名 + 父链；出参：{ tree, nodeCount }。
   ============================================================ */

// 知识体系：按「范围」生成以所选对象为根的树
function mockKsTree(range, objectName, path){
  if(range === '课程'){
    return { name: objectName, type: 'course', path: path, children: [
      { name: objectName + '·任务1', type: 'task', children: [
        { name: '操作流程：' + objectName + '服务', type: 'process' },
        { name: '技能：' + objectName + '执行', type: 'skill', children: [
          { name: '知识点：' + objectName + '基础', type: 'knowledge' },
          { name: '达标依据：' + objectName + '规范', type: 'criterion' }
        ]}
      ]},
      { name: objectName + '·任务2', type: 'task', children: [
        { name: '案例：' + objectName + '实操', type: 'case' }
      ]}
    ]};
  }
  if(range === '专业'){
    return { name: objectName, type: 'major', path: path, children: [
      { name: '专业核心课程', type: 'category', children: [
        { name: objectName + '核心课1', type: 'course', children: [
          { name: '任务：课程基础', type: 'task', children: [ { name: '知识点', type: 'knowledge' } ] }
        ]}
      ]}
    ]};
  }
  return { name: objectName, type: 'major_category', path: path, children: [
    { name: objectName + '专业A', type: 'major' },
    { name: objectName + '专业B', type: 'major' }
  ]};
}
function countTreeNodes(node){
  if(!node) return 0;
  var n = 1;
  (node.children || []).forEach(function(c){ n += countTreeNodes(c); });
  return n;
}
