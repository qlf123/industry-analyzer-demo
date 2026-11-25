# 项目约定（2026-11-25，细节见日志）

## 范围与铁律
- 只改 industry-analyzer-demo；**PRD 冻结**：页面调整不主动同步 PRD，明说「同步 PRD」才统一同步
- **load 铁律**：teacher-kit.js load() 最新版直通（当前 **v22**）；v21→22 seedExtSkills、v20→22 +seedFbDemo、v17–19 走 upFrom17(s) 统一链；**v13–16 升 17 后 return upFrom17**（旧写法落穿误触重置，已修），v12→13 落 v13 分支；seed 路径跑全链再 s2.v=22。坑：migratePubs 判定 `!c.publishes||!c.publishes.length`（[] truthy）；验证「写新数据→刷新→仍在」
- 调试 `?u=ACC-LI`；学情 `#course/CP1/stat`、学生 `#course/CP1/stu`、备课资源 `?t=res`；agent-browser 同 URL 加 `?r=N` 才重载；本地服务器 run_in_background 启动
- UI：必填打红 `*`，禁「可选/选填」；`.ff input{width:100%}` 拉满 checkbox（自建树容器 `width:auto!important`）；删渲染块逐数 div 开闭；课堂首页「接下来的课」带日期

## 备课资源（=资料库，2026-11-25 定）
- 只做资源管理；文件平铺每行一文件，包仅可选归属（留空=独立文件）；**知识库文档只读并览**（「加入知识库」已删）；列表列：复选/文件/内容/关联技能/关联知识点/时间/操作；规模概览+批量下载/删除+表头排序（仅资源页）；课程空间页签无批量排序、筛选换资源包
- 标注下沉文件级 f.skillIds/f.kpIds，包级=并集（TK.syncResTags）；上传/编辑两行下拉多选（体系下拉+搜索+递归树+自定义+全选/确认；取消丢 draft）；自定义节点存 S.customNodes 天然「拓展」
- 文件详情（基本信息+kbOn+标注/预览/下载）；资源包详情头部 编辑/下载全部/删除；删除保护按 pubFileIds 并集；课次「添加资料」文件级（整包/单文件/知识库引用）

## 发布（v18+）
- 抽屉 blk：发布对象→下发资料（未发布全选；再次发布默认勾最近一次，含知识库 `kb:库:文档`）→**考察项**（独立 blk 随任务显隐，平铺勾选+rs-pk 面板，默认资源带出；pkSaveCustom 确认发布才落库）→情景任务→课程反馈
- PUB_TPLS 4 套模板只填 TASK_F 初值；占位符 {课程名}/{技能名}/{知识点名} 全局替换、缺省 XX；pubDirty 或已填切模板走 TK.confirm、同模板=clearTpl；「AI生成」=名称(空时)+genDesc+AI评价要求
- **一课次多次发布**：c.publishes=[{id,at,classIds,fileIds,task,feedback}]，c.publish=最近一次镜像；submissions 挂 taskId、只为新任务补未提交行；TK.pubsOf/pubFileIds；教师端按 {c,pub} 对/taskId 聚合；publishView data-pvsel 切历史；**学生端展开多任务=P1**
- 发布默认：考查技能/知识点=资源关联项（都没配不勾）；kp 候选=courseKps 全集+拓展；kpSnap 含 ext；标注在提交级 teacher.kpMarks/ai.kpMarks

## 知识体系
- 体系分标准/拓展：标准关联教务课程进达成率，教师创建锁死拓展；知识点非技能子节点，两维独立统计
- 换体系：eduCourse.ksChangedAt+linked → 课程卡橙色 ⟳（不显示口径标签）

## 达成率口径
- 教师端技能达成率=达成人数/(已评价技能数×班级人数)；无评价显「—」
- 管理端（11-25 拍板）：技能、知识点统一「**已达成人次/已提交且已评价人次**」，标准拓展都计入；「标准达成率」更名「技能达成率」；拆分用 stdSkillMap（纯知识体系）、planStd.set=stdRows 仅供覆盖度（std+ext=整体守恒，未关联体系课程全计拓展）
- 知识点掌握率=掌握/已评价（最近一次老师确认评价，含退回）；教学三态：未考查→已考查 x/N→已评价 y/x→学生口径

## 学情/学生 tab（M=statModel(p)、KP=kpModel(p,M)）
- 学情 tab=课程整体（标准要求→教学覆盖→学生达成率三层，柱图分母纯标准数）+技能状态+知识点掌握（tbl2 五列，达成率=达成/(达成+未达成)，待评价不计分母）
- 学生 tab=学生明细唯一入口（4 列，点行插删 tr.stu-detail-tr 展开）；下钻定位 `space||statPlan` 排除 button/a

## 课次与排课
- 编号 slot.no：删除不重排、新增 max+1；「重新编号」只调未发布+autoName
- 多班 plan.classIds；停用=释放时间+不计进度；审核=停用语义（通过→停用原排课+swappedIn；驳回→删）；冲突四类 published>other>admin>own；过期课次操作一致仅红标
- 待评价：task.on 已提交都算、跨课程排队；反馈停留 3 秒自动已读

## 管理端教学达成分析（PRD v1.9，11-25 更名自「教学成果统计」）
- dashboard 第6块+teach-quality.html；指标全在 js/teach-reach.js（TR），概览/明细同函数；三组指标：覆盖率(已教∩标准/标准)、达成率(证据口径)、拓展(已教−标准)；权限名随更名（code 仍 teach:quality:view，mock-data DATA_VERSION=17）
- 趋势 6 线（整体/标准/拓展×技能/知识点，.lg2 可点开关、默认整体 2 条）；学生掌握分布（stdStu+kpsAgg().stu）；环比（上周期无证据隐藏）；口径说明 .qmark；三卡行间距 14px
- 详情页拓展列表：表格 类型/内容/来自课程/来自老师，teachScope 的 skWhere/kpWhere 按发布任务归属（同课去重）
- mock：v20 CP1 融入导游基础知识 2 技能 6 对拓展证据（张晓雨回填 10 月底跨月）、CRS3/5 快照加 2 拓展知识点+标注；v22 seedExtSkills 把 2 技能补进 CRS3 快照使其算「已教」。数值：技能 81%(标83/拓67)、知识点 70%(标75/拓50)、覆盖 78/78、拓展 6项/2个；拓展知识点仅 11 月首评→单点；李嘉豪最近评价 CRS2 退回不计拓展标注
