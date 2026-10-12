# 权限管理升级 Demo · 实现计划（第 1 步）

> 本文件是「权限管理升级」8 步开发第 1 步的产出：实现计划，不含代码。
> 依据：`docs/permission-demo-spec.md`（需求说明，Demo 化摘要）＋ `docs/AIGC智慧教学平台_权限管理升级方案_V2.1_开发交付版.docx`（业务规则唯一权威）。
> 两者冲突时以开发交付版为准；本文把所有冲突点和「没写清楚」的点集中列在第 9 节，待确认后再进入第 2 步。

---

## 1. 现有项目情况（已读代码核实）

### 1.1 怎么启动

- 项目是**纯静态 HTML**，无前端框架、无 `package.json`、无构建链以外的依赖。
- 现有 README 写法是「双击 `panorama.html` 在浏览器打开」，即 `file://` 协议。
- 需求说明第 1 节假设访问 `http://localhost:8765/panorama.html`。

**出入点 A（启动方式）**：项目里没有 8765 端口的启动脚本，README 写的是双击 `file://` 打开。
新 Demo 依赖 `localStorage`（跨页面保留演示数据）＋相对路径跳转，`file://` 下这两者在部分浏览器不稳定或受限制。
**✅ 已确认**：沿用 8765 端口约定，用 `python3 -m http.server 8765` 启动，并在说明文档里补一句启动说明。

### 1.2 页面怎么组织

| 页面 | 来源 | 说明 |
|---|---|---|
| `panorama.html` | `build_panorama.py` 注入 `panorama_template.html` 生成 | 行业分析（能力全景），体积大，内联行业数据 |
| `kmap.html` | `build_kmap.py` 注入 `kmap_template.html` 生成 | 行业图谱 |

- 两者都是**构建产物**：改模板（`*_template.html`）再跑对应 `build_*.py` 生成，直接改产物会在下次构建时被覆盖。
- 每个页面样式、脚本全部内联在单个 `.html` 里，数据以 `/*__DATA__*/` 占位符注入。
- 页面之间通过左侧栏 `<aside class="lnav">` 里的 `<a class="lmenu" href="...">` 跳转。

### 1.3 侧栏怎么写（现状）

两个页面侧栏结构一致（`panorama_template.html` 与 `kmap_template.html` 均如此）：

```html
<div class="app">
  <aside class="lnav">
    <div class="lbrand"><div class="ldot"></div>
      <div class="lname">AIGC 智慧课堂<br>教学平台 · 管理端</div></div>
    <div class="lgroup">
      <div class="lgt">概览</div>
      <button class="lmenu"><i>▤</i>数据概览</button>       <!-- 空 -->
      <button class="lmenu on"><i>◎</i>行业分析</button>   <!-- 当前页，on 高亮 -->
      <a class="lmenu" href="kmap.html"><i>◇</i>行业图谱</a>
    </div>
    <div class="lgroup">
      <div class="lgt">教务</div>
      <button class="lmenu"><i>▤</i>教务基础数据</button>  <!-- 空 -->
      <button class="lmenu"><i>▤</i>课程计划管理</button>  <!-- 空 -->
      <button class="lmenu"><i>▤</i>账号与角色</button>    <!-- 空 -->
    </div>
    <div class="lgroup">
      <div class="lgt">系统</div>
      <button class="lmenu"><i>▤</i>系统配置</button>      <!-- 空 -->
    </div>
    <div class="lfoot" id="lfoot"></div>
  </aside>
  <div class="panel"> … </div>
</div>
```

空菜单目前就是 `<button class="lmenu">`（无 `href`）。这与需求说明第 1 节的描述**完全一致**，无出入。

**出入点 B（侧栏统一渲染 vs 最小改动）**：需求说明第 2 节要求「侧栏：所有页面用同一份菜单配置渲染，菜单按当前演示身份的权限显示或隐藏」，第 3 节又只允许对现有两页「接侧栏链接和加演示身份条」。二者存在张力，见第 5 节改动点的两个方案。
**✅ 已确认**：选 **B1 最小改动**——现有两页保留手写 `<aside>`，只把空按钮换成链接 + 加身份条；新页面才用 `common.js` 动态渲染侧栏。

### 1.4 视觉与主题

- 品牌色紫罗兰（`--brand:#5b3fd6`），浅紫背景（`--plane:#f5f3f9`），白色窄侧栏（206px），白色卡片（`--card`）。
- CSS 变量在两页的 `:root` 里定义，内容一致（`panorama_template.html` 多一组 `--good-bg/--warn-bg/--crit-bg`、`--shadow/--pop-shadow`、`--src*`）。
- 支持 `prefers-color-scheme: dark` 与 `data-theme="dark"` 深色主题。

---

## 2. 验收编号约定

需求说明第 8 节编号为 **D-xx**，开发交付版第 16 章编号为 **AC-xx**，两套不同。**以 D-xx 为准**，对应关系如下（单元测试按 D-xx 编写）：

| D | AC / 文档章节 | D | AC / 文档章节 |
|---|---|---|---|
| D-01 | AC-01 | D-13 | AC-12 |
| D-02 | AC-02 | D-14 | AC-15 |
| D-03 | AC-03 | D-15 | 7.3 |
| D-04 | AC-04 | D-16 | AC-16 |
| D-05 | AC-05 | D-17 | 7.3 |
| D-06 | AC-06 | D-18 | AC-17 |
| D-07 | AC-07 | D-19 | Demo 专用 |
| D-08 | AC-08 | D-20 | AC-18 |
| D-09 | AC-13 | D-21 | AC-09 |
| D-10 | AC-14 | D-22 | AC-20 |
| D-11 | 第 10 章 | D-23 | AC-19 |
| D-12 | 4.5 | | |

不演示：AC-10（AI 配额用完）、AC-11（导出与页面脱敏一致）。

---

## 3. 复用哪些样式和组件（列出类名）

新页面直接复用现有 CSS 变量与类名，视觉与 `panorama.html`、`kmap.html` 保持一致。公共样式从两页抽取，**不新增风格**。

### 3.1 复用的 CSS 变量（`:root`）

`--plane --card --card-2 --ink --ink-2 --muted --rule --rule-2 --brand --brand-soft --brand-ink --good --warn --crit --warn-ink --good-bg --warn-bg --crit-bg --shadow --pop-shadow --sans --mono`（以及 `--lv1/--lv2/--lv3` 仅在需要等级配色处复用）。

### 3.2 平台外壳（shell）

`.app` `.lnav` `.lbrand` `.ldot` `.lname` `.lgroup` `.lgt` `.lmenu`（含 `.lmenu.on`、`:hover`）`.lfoot`

### 3.3 页头与卡片

`.panel` `.ptop` `.ptop-r` `.pt-l` `.pt-t` `.pt-d` `.body` `.hero` `.card` `.pad` `.eyebrow` `.mono`

### 3.4 表格

`.dtable` `.dt-row` `.dt-head` `.dt-name` `.dt-num` `.dt-tier`（列表行/表头风格）；报告式表格参考 `kmap` 的 `.rpt-lv table / th / td` 写法。

### 3.5 按钮

- `panorama` 侧：`.btn`（主）、`.btn.ghost`、`.btn.ghost.on`、`.chip`、`.chip[aria-pressed="true"]`、`.fbtn`
- `kmap` 侧：`.btn-s`（次级小按钮）、`.btn-p`（主小按钮）

**注意**：两页存在两套按钮写法。计划让新页面统一用一套（见第 6 节公共样式说明），现有页面不动。

### 3.6 标签 / 状态徽标

`.pill`（`.core` `.ext` `.k` `.warn` `.crit` `.good`）、`.ico`（`.warning` `.good`）、`.ver-t/.ver-d`（版本行，按需）。

### 3.7 Tab 与输入

`.tabs.l1` `.tab`（含 `[aria-selected="true"]`、`.tc`）`.tabs.l2` `.tab`；`.field` `.field.wide` `.fico` `.fk` `.fbtn`。

### 3.8 弹层与提示

- 抽屉：`.scrim` `.scrim.on` `.drawer` `.drawer.on`（`panorama`）
- 对话框：`.aidlg`、`.aidlg form / h2 / label / input / select / textarea / .acts`（`kmap`）
- 轻提示：`.toast`（`kmap`）
- 提示条：`.scbar`（`kmap` 自检条样式，可用于「为什么能看到/看不到」说明条）

---

## 4. 新增文件清单（提议）

```
docs/
  permission-demo-plan.md        # 本文件
  permission-demo.md             # 交付物②：改动清单 + 演示脚本 + 冲突/占位清单（后续步骤写）
css/
  common.css                     # 公共样式：从现有两页抽取 shell/页头/卡片/表格/按钮/tab/表单/弹层
js/
  common.js                      # 公共脚本：菜单配置渲染、演示身份条、主题、工具函数、toast/dialog 封装
  mock-data.js                   # 全部 mock 数据 + localStorage 读写 + resetDemoData()
  permission.js                  # 权限纯函数模块（判定/范围/脱敏/授权校验/判定链），UMD 以便 node 测试
basedata.html                    # 教务基础数据：专业 / 班级 / 年级 / 学生信息 / 内容审核(占位)，tab 切换
account.html                     # 账号与角色：账号管理 / 角色管理，tab 切换
system.html                      # 系统配置：组织管理 / 字典管理(组织类型) / 审计日志，tab 切换
teacher-resources.html           # 教师端 · 备课中心：我的资源 / 共享给我的 / 校本资源库
teacher-profile.html             # 教师端 · 教师档案
student.html                     # 学生端：本人信息 + 本人作业（极简）
test/
  permission.test.js             # node:test 单元测试，覆盖 D-01 ~ D-23（及不演示项排除）
```

各文件职责：

| 文件 | 职责 |
|---|---|
| `css/common.css` | 统一 `.app/.lnav/...` 外壳、页头、卡片、`.dtable` 表格、统一按钮 `.btn`（主/ghost）、`.pill/.chip` 标签、`.tabs`、`.field` 表单、`.drawer/.aidlg/.toast` 弹层、演示身份条、以及「为什么」问号提示样式。只做通用件，不含业务布局 |
| `js/common.js` | ① 读取 `mock-data.js` 的菜单配置，按当前演示身份渲染侧栏（管理端 / 教师端 / 学生端三套）；② 渲染顶部演示身份条（身份下拉、当前组织下拉、「为什么」开关、重置按钮）；③ 身份切换、端间自动跳转；④ `$ / esc / fit` 等工具函数；⑤ `showToast / openDialog / openDrawer` 封装 |
| `js/mock-data.js` | 全部 mock 数据（第 7 节结构）；`loadState()/saveState()/resetDemoData()` 用 `localStorage` 持久化演示改动；暴露全局 `window.DEMO` |
| `js/permission.js` | 唯一权限判定入口（第 8 节函数），纯函数不碰 DOM；审计「生成记录」纯函数，持久化委托给 `mock-data.js` |
| 6 个 `.html` | 各自页面骨架 + 内联本页脚本，只调用 `permission.js` 做判断，不写散落 `if` |
| `test/permission.test.js` | `node --test`，直接 `require('./js/permission.js')`，对 D-01~D-23 逐条断言 |

---

## 5. 对 panorama.html / kmap.html 的改动点

只允许两类改动：**接侧栏链接**、**加演示身份条**。功能与数据一律不动。

- 侧栏：把「教务基础数据 / 账号与角色 / 系统配置」三个空 `<button class="lmenu">` 换成 `<a class="lmenu" href="basedata.html|account.html|system.html">`。
- 顶部：在 `.app` 上方（或 `.panel` 顶部）插入演示身份条容器，由 `common.js` 渲染。
- 引入 `js/mock-data.js`、`js/permission.js`、`js/common.js`、`css/common.css`。

**必须说明的变化**：这两个页面现在是「单文件、零外部依赖」，接入身份条后会产生对外部 `js/css` 的依赖，不再是单文件。这是需求说明第 4 节「所有页面都加身份条」的必然结果，已接受，但在此明示。

**出入点 B 的两个方案（已定 B1）**：

- **方案 B1（最小改动，✅ 选定）**：两个页面保留手写 `<aside>`，只把手写空按钮换成链接 + 加身份条。新页面才用 `common.js` 动态渲染侧栏。
- **方案 B2（统一渲染）**：两个页面的 `<aside>` 也改成由 `common.js` 按菜单配置 + 当前身份渲染（符合需求说明第 2 节字面）。

差异：B2 改动大（要动两个页面的侧栏 DOM 和「当前页 on 高亮」逻辑），但「菜单显隐」真正统一；B1 改动小、更稳。因「行业分析 / 行业图谱对所有管理端身份可见」，两个方案在**演示效果上几乎无差异**（教师/学生身份会直接跳走，管理端身份都能看到这两项）。

**改动落点**：`kmap.html` 由 `kmap_template.html` 生成，`panorama.html` 由 `panorama_template.html` 生成。侧栏/身份条应改在 **`*_template.html`** 上，再各跑一次 `build_kmap.py` / `build_panorama.py` 重建，避免下次构建覆盖。

---

## 6. 公共样式与组件复用原则

- `common.css` 只承载**跨页通用件**（外壳、页头、卡片、表格、按钮、tab、表单、弹层、身份条、问号提示），各页面自身业务布局仍内联在各自 `.html`。
- 按钮统一采用 `panorama` 的 `.btn / .btn.ghost / .chip` 一套（新页面主导）；`kmap` 的 `.btn-s/.btn-p` 仅保留给 `kmap.html` 自身，不进公共样式。
- 侧栏三端差异只体现在「菜单项」和 `.lname` 标题文字（管理端 / 教学平台·教师端 / 教学平台·学生端），外壳样式共用。
- 脱敏、权限点、角色模板全部是 `mock-data.js` 里的配置数据，页面不硬编码。

---

## 7. Mock 数据结构

统一放在 `js/mock-data.js`，初始状态 `INITIAL` 对象 + 运行时 `state`（`localStorage` 持久化）。字段名用中文键还是英文键——**建议英文键 + 中文名**（便于 `permission.js` 与测试统一引用），页面显示时用中文。

### 7.1 组织节点 `org`

```
{ id, name, code, typeId, parentId, sort, status: 'enabled'|'disabled', desc }
```
- `typeId` → `orgType.id`；根节点 `parentId: null`、`code` 全局唯一、同父 `name` 不重。
- 组织树（在需求说明 5.1 基础上，按 5.5/第 6 节补齐基地节点，见出入点 E）：
  根(某职业技术学院) → 东校区 → 旅游学院 → 旅游管理系 → 导游教研室；东校区 → 酒店学院；西校区 → 中职部 → 旅游专业部；西校区 → 继续教育部；根 → 公共基础部。
  另：酒店学院 下挂「某酒店基地」，旅游学院 下挂「某景区基地」（作为组织节点，供企业导师挂「所属组织」）。

### 7.2 组织类型 `orgType`

```
{ id, name }   // 初始：校区、学院、系、教研室、部门、专业部（+ 基地，见出入点 E）
```
- 被节点引用时不可删。

### 7.3 专业 `major`

```
{ id, name, orgId }   // orgId = 所属组织（只能是启用中的节点）
```
- 4 条：旅游管理(旅游管理系)、导游(导游教研室)、酒店管理与数字化运营(酒店学院)、旅游服务与管理（中职）(旅游专业部)。

### 7.4 年级 `grade`

```
{ id, name }   // 2023 级 / 2024 级 / 2025 级 / 2026 级；全校通用不挂组织
```

### 7.5 班级 `klass`

```
{ id, name, majorId, gradeId }
```
- 组织由 `majorId → major.orgId` 带出；每专业每年级 1~2 个班。

### 7.6 学生 `student`

```
{ id, name, sno, phone, idCard, address, klassId,
  status: '在读'|'已毕业',
  scores: [{ course, score }] }
```
- `gradeId` 由 `klassId → klass.gradeId` 带出；`orgId` 由 `klassId → klass.majorId → major.orgId` 带出。
- 2023 级全部 `已毕业`；每班 6~8 人；酒店管理 2025 级 1 班 3 人在「某酒店基地」实习、2 人在「某景区基地」实习（挂 `internship: { baseId }` 或实习记录表，见 7.13）。

### 7.7 账号 `account`

```
{ id, name, orgId, kind: '管理员'|'教师'|'学生'|'企业导师'|...,
  status: '正常'|'停用', studentId? }   // 学生账号 studentId → student
```
- 教师/管理员账号的 `orgId` = 主岗所属组织；学生账号 `orgId` 由 `student → klass → major → org` 带出。
- 预置 17 个演示身份账号 + 「停用老师」（`status:'停用'`，带一条教学范围，用于 D-22）。

### 7.8 角色 `role`

```
{ id, name, type: '内置'|'预设'|'部门模板'|'自定义',
  permissionIds: [], aiQuota? }
```
- 角色：平台超级管理员（内置）、组织管理员 / 专业负责人 / 教师 / 班主任 / 辅导员 / 学生（预设）、教务 / 学工 / 督导 / 信息中心（部门模板）、企业导师 / 自定义（自定义）。

### 7.9 权限点 `permission`（树）

```
{ id, code: '模块:资源:动作', name, module, page, action, parentId? }
```
- 按需求说明 7.10 清单落到操作级，并映射到交付版第 8 章矩阵行：
  - `组织:组织管理:查看/编辑/删除/停用/移动`（M1 组织管理）
  - `组织:账号:查看/编辑/分配角色/停用启用/重置密码`（M1 组织/账号/角色分配）
  - `组织:账号:教学范围授予`（M1 教学范围授予）
  - `组织:角色定义:配置`（M1 角色定义/权限策略）
  - `组织:审计:查看`（M1 操作审计查看）
  - `学生:学生信息:查看`、`学生:学生成绩:查看`、`学生:学生信息:身份证明文`（学工专用，第 10 章）
  - `教研:教师档案:查看`（M5 教师档案查看）
  - `教研:内容:审核发布`（M2/M3/M4 审核发布，占位页按钮判定用）
  - `实践:实习任务:查看`（M6 实习任务/评价）
  - `资源:内容共享:发起`（内容共享）
  - `资源:校本资源库:发布`（发布到校本资源库）
  - `资源:校本资源库:查看复制`（校本资源库查看/复制）

### 7.10 角色分配 `assignment`

```
{ id, accountId, roleId,
  scopeOrgIds: [],               // 数据范围：组织节点多选
  scopeGrades: { [orgId]: [gradeId] },  // 每个节点可选年级（不选=全部）
  scopeClassIds: [],             // 班主任：直接选班级
  teachingScope: { majorIds:[], classIds:[], courseIds:[] }  // 仅教师类角色
}
```
- 一条分配 = 角色 + 数据范围 + 教学范围 + AI 配额；多分配各自生效。
- 账号停用 → 其所有分配与教学范围失效（D-22）。

### 7.11 教师档案 `teacherProfile`

```
{ id, accountId }   // 组织随 account.orgId；展示姓名/所属组织/简要字段
```
- 每个教师账号一份。

### 7.12 资源 `resource`

```
{ id, title, type: '课件'|'教案'|'题库'|'素材'|'学情分析',
  ownerId, orgId,           // 归属写入人所属组织
  shared: bool, shareTargets: [{ type:'teacher'|'org', targetId, active }],
  recommended: bool,        // 推荐到校本资源库
  published: bool }         // 已发布（校本库可见）
```
- 每位教师 3~5 份；1 份「学情分析」无共享入口（type 判定）。

### 7.13 基地与实习

```
{ id, name, orgId }                              // base：某酒店基地(酒店学院)、某景区基地(旅游学院)
student.internship 或 独立表 { studentId, baseId } // 企业导师范围=本基地实习学生
```

### 7.14 审计日志 `audit`

```
{ id, ts, actorId, action, object, before, after, result: '成功'|'被拒绝' }
```
- 初始为空，演示中实时写入；按当前身份范围过滤显示。

### 7.15 演示身份 `demoIdentity`

```
{ id, label, accountId }   // 第 6 节 17 个 + 「停用老师」账号；身份条下拉用它
```

**引用关系总览**：
`org.parentId→org`；`org.typeId→orgType`；`major.orgId→org`；`klass.majorId→major`、`klass.gradeId→grade`；`student.klassId→klass`；`account.orgId→org`（学生账号另 `studentId→student`）；`assignment.accountId→account`、`roleId→role`、`scopeOrgIds→org`、`scopeClassIds→klass`；`resource.ownerId→account`、`orgId→org`；`teacherProfile.accountId→account`；`base.orgId→org`；`audit.actorId→account`。

---

## 8. 权限模块 `js/permission.js` 对外函数

纯判定函数（可被 `node --test` 直接 `require`），全部以 `(identity, …)` 为第一参。`identity` = `{ account, assignments[] }`（含账号与分配），页面/测试自行从 `mock-data.js` 取。

| 函数 | 输入 | 输出 |
|---|---|---|
| `resolveScope(assignment)` | 一条 `assignment` | `{ orgIds:Set, classIds:Set, gradeByOrg:Map<orgId,Set<gradeId>> }`（节点含全部下级） |
| `hasPerm(identity, permCode)` | 身份 + 权限点 code | `boolean`（任一分配含该权限点） |
| `scopePass(identity, permCode, target, dataType)` | 身份 + 权限点 + 目标对象 + 数据类型（管理/年级/教学/本人/班级/基地） | `boolean`——**只用含该权限点的分配**的范围判定 |
| `check(identity, permCode, target, dataType)` | 同上 | `{ allowed, denyReason }`（功能→范围两步） |
| `listFilter(identity, permCode, dataType, items)` | 身份 + 权限点 + 数据列表 | 过滤后列表（按范围 + 年级叠加） |
| `maskField(identity, field, {student?, teacher?, target})` | 身份 + 字段名（phone/idCard/address/score）+ 上下文 | 脱敏后的值/档（`明文/脱敏/脱敏汇总/不可见`） |
| `maskValue(raw, mode)` | 原始值 + 脱敏模式 | 脱敏字符串（如 `138****1234`） |
| `visibleOrgNodes(identity, {forAssign?})` | 身份 | 可选组织节点集合（供「当前组织」下拉、范围选择器） |
| `visibleGrades(identity, orgId)` | 身份 + 节点 | 该节点可选年级（受授权约束限制） |
| `canDelegate(granter, granteeAccount, newAssignment)` | 授权人身份 + 被授权账号 + 新分配 | `{ ok } | { ok:false, reason }`（不能给自己、范围不越权、教学范围授予人限制） |
| `explain(identity, permCode, target, dataType)` | 同 `check` | 判定链数组（命中哪条分配 → 功能是否过 → 范围是否过 → 脱敏档），供「为什么」问号悬停 |
| `buildAudit(action, actor, target, before, after, result)` | 审计要素 | 一条审计记录（纯函数；持久化由 `mock-data.js` 负责） |
| `effectiveAiQuota(identity)` | 身份 | 多角色配额取最高值（D-21 只显示不计数） |

**脱敏表**（实现为 `permission.js` 内配置，以交付版第 10 章表为准）按「角色 → 字段」映射，命中「教师/班主任辅导员/学工/督导/信息中心/教务/组织管理员/专业负责人企业导师/其他」九档之一；**学生查看本人数据时全字段全量，不受表限制**。

---

## 9. 发现的冲突与「没写清楚」之处（需你确认）

### 9.1 冲突 / 出入

1. **启动方式**（出入点 A）：需求说明假设 `http://localhost:8765/`，项目 README 写双击 `file://`。新 Demo 依赖 `localStorage` + 相对跳转，建议改本地静态服务器。→ 需确认。
2. **侧栏渲染**（出入点 B）：第 2 节「所有页面同一份菜单配置渲染」vs 第 3 节「现有两页只接链接 + 身份条」。→ 需选 B1/B2（第 5 节）。
3. **基地是不是组织节点**（出入点 E）：5.1 组织树不含基地，但 5.5/第 6 节把「某酒店基地」当企业导师的「所属组织」，且基地又「所属组织=酒店学院」。只能解释为：基地是挂在酒店学院/旅游学院下的组织节点，需在 mock 组织树补两个基地节点；而「组织类型」字典（校区/学院/系/教研室/部门/专业部）里没有「基地」这一类型。**✅ 已确认**：组织树补「某酒店基地 / 某景区基地」两节点，并为「组织类型」字典增加「基地」一项。
4. **「当前组织」下拉 vs 「多节点取并集」**：7.10 说范围是「所选节点及全部下级、多节点取并集」，第 4 节又说「当前组织下拉选中后列表按该节点过滤」。若一个身份同时挂了两个节点（陈双管），「当前组织」是改成单节点视图、还是仅作展示型切换？两者口径有张力。**✅ 已确认**：按**过滤视图**处理——切换「当前组织」后列表只看该节点（及下级），作为对并集结果的一次再过滤。
5. **单文件特性被打破**：现有两页接身份条后不再是零依赖单文件（第 5 节已明示）。

### 9.2 没写清楚（计划按「Demo 占位」兜底，页面用灰字标注并记进说明文档）

> ✅ 已确认：以下 7 项均按本计划列的占位方案执行。

1. **身份证 / 家庭住址 / 成绩汇总的脱敏格式**：交付版只写「脱敏」「脱敏汇总」，未给具体掩码格式（手机号给了 `138****1234`）。计划暂定：身份证前 6 后 4（`110101********1234`）、住址保留省市区前缀、成绩汇总只显示等级/区间。→ 需确认或接受占位。
2. **「为什么」问号在「被隐藏的按钮」旁如何展示**：按钮既然被隐藏了，问号放哪、怎么触发悬停，文档未定义。计划：开关打开后，被隐藏按钮原位显示灰色 `?` 占位，悬停弹出判定链。
3. **教师端 / 学生端页面与身份条的物理关系**：需求说明说「切到教师端角色自动跳教师端」，即三个端是**不同 `.html` + 各自侧栏**，跳转 = `location` 跳到对应端首页；身份条是每个页面各自渲染一份（读同一个 `localStorage` 身份）。文档未明说，计划按此实现。
4. **内容审核占位页按钮判定**：需求说明 7.11 说按「M2/M3/M4 审核发布」判定，交付版矩阵里组织管理员/教务为 `◐`、督导为 `▽`。需把「课程内容审核」与「M2/M4 审核发布」两个权限点关系在实现时定死（计划：占位页只看「教研:内容:审核发布」一个权限点 + 范围覆盖）。
5. **教学范围的「课程」维度**：7.4 教学范围选「专业→班级+课程」，但 mock 数据里没有独立课程表，只有成绩里的 `course` 名。计划暂以课程名作维度，不建课程实体。
6. **「重置演示数据」入口位置**：需求说明只在第 4 节提了一句，未定位置。计划放在身份条最右。
7. **审计「操作前/操作后」字段格式**：文档只列字段名，未定义存 JSON 还是字符串。计划存 JSON 字符串。

---

## 10. 第 1 步确认结论（已定稿）

| # | 问题 | 结论 |
|---|---|---|
| 1 | 启动方式 | 沿用 `python3 -m http.server 8765`，说明文档补启动说明 |
| 2 | 侧栏改法 | **B1 最小改动**：现有两页只换链接 + 加身份条；新页面用 `common.js` 渲染 |
| 3 | 基地组织类型 | 组织树补「某酒店基地 / 某景区基地」节点，字典「组织类型」增加「基地」 |
| 4 | 「当前组织」下拉 | 过滤视图：切换后按该节点（及下级）再过滤 |
| 5 | 脱敏格式 | 接受占位：身份证前 6 后 4、住址留省市区、成绩汇总只显等级/区间 |
| 6 | 其余占位（9.2 七项） | 均按计划执行 |

计划已锁定，等待进入第 2 步。
