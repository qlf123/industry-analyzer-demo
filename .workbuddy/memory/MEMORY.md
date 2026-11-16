# 项目约定

## 表单规范（用户 2026-11-16 定，全局强制）
- 必填项：标签后打红 *（TK 体系用 class="req"，图谱中心可用 `<span style="color:#F04438">*</span>`）；非必填不打 *
- 非必填的表单项名称里禁止出现「（可选）」「（选填）」等文字，可选项以"无星号"表达；placeholder 里也不要写"选填/可选"，给示例值
- 「多选」等与可选性无关的说明可保留，如「加入组织（多选）」「前置能力项（多选）」
- 已知校验实现：TK.formHTML 的 req → css/teacher.css `.ff .req::before` 红 *；知识体系弹框 `.ks-dialog-body .req`；knowledge-system-detail 用 `<em>*</em>`
