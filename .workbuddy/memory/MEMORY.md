# 项目约定（精简版 2026-11-24）

## 范围与铁律
- 只改 industry-analyzer-demo，不动其他项目；外项目截图/需求先确认
- **PRD 冻结**：页面调整一律不主动同步 PRD，等用户明说「同步 PRD」再统一一次性同步（2026-11-19 起长期有效）
- **load 升版铁律**：teacher-kit.js load() 升 vN→v(N+1) 必须保留最新版直通分支 `if(s && s.v===最新){...return finish(s)}`，否则已最新数据 fall through 到 seed() 被全量重置。当前 **v17**（v17 直通；v16→v17 补资源文件知识属性 migrateAssetFields + seedAssetDemo；v12 分支去掉 return 让旧数据走完 v13→v17）。改版本后验证「写新数据→刷新→仍在」
- 调试账号 `?u=ACC-LI`；学情 `#course/CP1/stat`、学生 `#course/CP1/stu`、备课资源 `?t=res`；同 URL agent-browser 不重载加 `?r=N`
- agent-browser 被 SIGKILL 时写 localStorage 可能损坏 JSON → TK.load() catch 静默重置；判断数据前先 close 重开浏览器

## 表单与通用 UI
- 必填标签后打红 `*`；非必填不打，且名称/placeholder 禁止出现「可选/选填」（「多选」等无关说明可留）
- 公共 css/teacher.css `.ff input{width:100%}` 会把 checkbox 拉满，新增自建树容器须并入 `.ktl/.kt-ex input[type=checkbox]{width:auto!important;flex:0 0 auto}` 选择器
- 删除渲染块时若末尾带父卡片闭合 `</div>`，必须逐个数 div 开闭，否则后续卡片被吞进前一张卡
- 课堂首页「接下来的课」要带日期（x月x日 周x）

## 备课资源（文件为主，v15；知识属性 v17）
- 文件平铺为主（每文件一行），包仅作可选归属（行内 📦 标注）；上传不强制进包（包名非必填，留空=独立文件）；无文件包仍占一行保住操作入口
- 【统一资源 P0/P1，2026-11-24】备课资源文件与知识库文档是**一套文件实体、两个视图**：在 `S.resources[].files` 上扩 `kbOn/kbStatus/kbCat/kbSegs/kbTags/kbHits/kbDocId/kbSharedTo`（默认 kbOn=false），不新建 S.assets、不改发布/学情口径。`js/resource-bridge.js` 为共用适配层：teacherDocs() 把 kbOn 文件映射成知识库 DOCS，pushToKb/removeFromKb/pullFromKb 做双向入口。备课 ⋯ 加「加入知识库」（已在库不显示），知识库行菜单/详情加「用于备课」（导入为独立文件，source='知识库'、技能知识点留空），从知识库删 teacher 文件只下架 kbOn=false 不删本体。知识库详情 DOCS 由 RB_DOCS + 静态演示文档（按 kbDocId 去重）组成；seed 文件 RES2 课件默认 kbOn=true 作演示
- **标注下沉到文件级** f.skillIds/f.kpIds；包级 = 包内文件并集（TK.syncResTags 重算），发布/学情仍读包级；v14→v15 迁移把包级标注复制给文件。resSkKpHTML(r,f) 传文件读文件标注
- 列表列：文件 / 内容 / 关联技能 / 关联知识点 / **时间（2026-11-24 独立一列，不再混在文件名 meta 内，.rs-d）** / 操作；技能、知识点两列独立、chips 最多 4 个（+N），空态各自独立
- 资源页只做资源管理（上传/编辑/删除/预览下载 + 技能知识点），**不做教学层操作**（关联课次/复用/发布/下发数据全去）；关联入口在课次侧；筛选含「资源包」（含未归属）；文件级删除 resFileDelete（已下发受 publish.fileIds 保护），包级操作在 ⋯
- 上传表单：所属课程非必填；「关联技能 · 关联知识点」= 先选可见知识体系（resVisSystems：预置+已导入+图谱中心 built 且本人创建/共享），再在树上勾（任务组→技能→知识点），不随课程、不联动；已选 chips 常驻顶部；切换体系只重绘树不清已选；自定义技能/知识点各留输入框
- 自定义节点存 S.customNodes={skill,kp}，TK.registerCustomNodes 注册进 K.skill/K.customKp，不进标准树→天然算「拓展」；表单内先暂存、保存才落库
- 发布抽屉技能/知识点补选都走内嵌体系树（data-sktreebox/data-kptreebox → details.ksadd），勾选即生效、取消作废；skTreeData 返回裸 root（勿用 td.root，那是 kpTreeData 写法）

## 知识体系与知识点
- 体系分「标准/拓展」：标准可关联教务课程、进达成率；拓展仅备课。教师创建锁死拓展；管理端标准→拓展允许纠错但已关联课程禁转；拓展→标准第一阶段不开放。与「范围」「创建方式」正交
- 知识点是独立节点（宿主可为技能/任务/课程/体系末叶），不是技能子节点；界面不体现挂载关系
- 技能、知识点两维独立统计，不按图谱挂载；学情算法见《计算PRD.md》v1.1
- 发布默认：考查技能=资源关联技能、考查知识点=资源关联知识点（都没配不勾）；知识点候选=courseKps 平铺全集（与技能无关），拓展 KP 须显式并入
- 评价标注在提交级 teacher.kpMarks/ai.kpMarks；task.kpSnap 平铺数组；kpModel 每生取范围内最近一次老师确认评价
- 换体系：eduCourse.ksChangedAt 存在且课程 linked → 「我的课程」课程卡标题右侧橙色 ⟳(.ks-chg)，title 含变更时间/新旧体系/快照；列表一律不显示「原口径/新口径」标签；data-space 委托排除 [data-kschg]

## 达成率口径
- 教师端技能达成率 = 达成人数 /（已评价技能数 × 班级人数）；未教/未评价不计分母；已评价中未提交/退回未重交按未达成；无评价显示「—」（无样本量护栏）
- 管理端「标准达成率」= 达成 /（课程标准技能数 × 班级人数），未教计入分母，学期末考核口径；两名字并存
- 过程口径 = 达成/(已评价的学生×技能人次)，只在学情页脚注展示；「学生达到什么程度」分档已删
- 知识点掌握率 = 掌握知识点 / 已评价知识点（最近一次老师确认评价，含退回）；各配置 ⓘ hover 说明
- 教学三态：未考查→已考查 x/N；已考查未评价→已评价 y/x；已评价→学生口径达成率
- 教学进度（老师层）含课次推进+标准技能考查覆盖，不放进学习效果块

## 学情 / 学生 tab（同源 M=statModel(p)、KP=kpModel(p,M)）
- 课程视角（学情 tab）= 课程整体情况 + 技能状态 + 知识点掌握，后两卡默认展开；底部口径说明文字已删（2026-11-24 前删「课程整体情况」脚注），口径走 KPI 的 ? 悬停
- 「课程整体情况」技能/知识点两维同构三层：标准要求（纯标准数 = 总数 − 拓展数）→ 教学覆盖（含拓展，显示「10 项（标准 6 · 拓展 4）」）→ 学生达成率（人均达成 / 纯标准数）；柱图分母为纯标准数，覆盖柱可超 100%；演示：CP1 的 CRS3 挂 4 个客源地技能（skillExt）
- 技能状态 / 知识点掌握统一 `table.tbl2` 五列「名称/达成/未达成/待评价/达成率」；达成率=达成/(达成+未达成)，待评价不计分母，无评价「—」；技能未达成=no+ret+todo→weakModal，待评价→data-goeval；知识点未达成=miss→kpWeakModal，待评价=cnt.none；不用条形图/chips/ml-row
- 学生 tab = 学生明细唯一入口：4 列「学生/技能/知识点/操作」，两列同构三段「达成 x · 待评价 x · 未达成 x / 总数」；点行行内展开/收起（直接操作 DOM 插删 tr.stu-detail-tr，不走 render，箭头 ▸↔▾），明细 stuDetailHTML 按技能/知识点各一表、一行一项带状态 tag（未达成细分 + 查看提交）；无全局学生×技能矩阵
- 下钻/弹层课程定位一律 `space || statPlan`，并排除 button/a 避免误触

## 课次与排课
- 编号存 slot.no（教学次序）：删除排课不重排（空缺保留），新增取最大+1，命名「课程名 · 第 sl.no 次课」，绝不用时间排序下标；手动命名 autoName=false 不随排课变，清空恢复自动；「按时间顺序重新编号」只调未发布+autoName 课次
- 多班合班：plan.classIds 数组（v13→v14 迁移），课次生成/冲突/学情并集/各端展示全按多班；专业非必填且与班级正交；班级控件 = 下拉多选框 .cl-msel（搜索+按专业分组 checkbox），勾选同步 initIds
- 课次可停用/启用（course.disabled + slot.disabled）：停用=释放时间+不计教学进度；导出/发布禁停；权限=创建者；source==='排课' 的停用课次教师端不给启用按钮
- 审核=停用语义，只有「通过/驳回」：通过→停用原排课(disabled+slot.disabled)+老师课次排上(swappedIn,status→未发布)+审核单已通过；驳回→删老师课次。syncSessions 认领排除自建/停用/swappedIn
- 新建课次冲突四类（优先级 published>other>admin>own）：已发布/其他老师课次→置灰只能改时间；教务排课未发布→置灰+「提交教务审核」（唯一入口）；自己课次→「仍要创建」确认后落库。cfKinds 遍历所有冲突分类
- 过期课次（未发布+非待审核+开始时间已过）操作与未过期**完全一致**，仅状态显示「已过期」红标；勿恢复 od 特殊分支
- 待评价全局口径：凡已布置任务(task.on)的已提交都算；评价抽屉「保存并评下一条」跨课程排队；反馈页签停留 3 秒自动已读
