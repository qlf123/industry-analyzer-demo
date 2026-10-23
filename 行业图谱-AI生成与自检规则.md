# 行业图谱 · AI 生成与自检规则（开发用）

本文档整理「行业图谱」页面（`kmap.html`）里两条 AI 规则，供开发和维护使用：

- **AI 生成后续节点**（点末级节点后逐层细分）：规则在 `kmap_template.html`。
- **AI 自检**（「自检」按钮检查已生成的 AI 节点）：规则唯一来源是 `.claude/skills/kmap-ai-selfcheck/SKILL.md` 的 `RULES:START`/`RULES:END` 块，构建时带进页面。

本文档面向开发：会写函数名、常量、schema、提示词原文。产品视角的说明在 `PRD-行业分析模块.md`，此处不重复。

---

## 0. 规则的位置与构建关系（先读这段）

| 规则 | 唯一来源 | 进入页面的方式 |
|---|---|---|
| 生成规则（AI_RULE / 提示词 / 约束） | `kmap_template.html` 的常量与函数 | 直接写在模板里，构建时原样带入 |
| 自检规则（4 维度 / 判定 / 优先级） | `.claude/skills/kmap-ai-selfcheck/SKILL.md` 的 `<!-- RULES:START -->`…`<!-- RULES:END -->` 块 | `build_kmap.py` 把该块注入为页面的 `D.selfCheckRules` |

**改规则后必须重新构建**：`python3 build_kmap.py`（模板 → `kmap.html`）。改了 `SKILL.md` 的自检规则、或改了 `kmap_template.html` 里的生成规则，不重新构建页面，页面仍用旧规则。

---

## 1. AI 生成后续节点（扩展 / 细分）

### 1.1 触发入口

- 点「技能」列的**末级节点**（类型为 知识点 / 操作步骤 / 标准 / 案例）→ 在该节点右侧新开一列，由 AI 生成它的下级节点。
- 点**已生成的 AI 节点**（第 7 列起）→ 继续往下细分，再开一列。
- 同一节点的生成结果会缓存（`aiStore`，父 key → 该列），并持久化到 `localStorage`（key `kmapAiSaved.v2`；2026-10-22 换图谱版本时由 `kmapAiSaved` 升级）；重新打开页面复用，不重复调接口。

### 1.2 按类型拆分的规则（`AI_RULE`）

生成时按父节点类型套用不同的拆分要求（`kmap_template.html` 981–986 行）：

| 父节点类型 | 拆分要求 |
|---|---|
| 知识点 | 拆成更细的子知识点，每个是一个可以单独讲授的概念或要点 |
| 操作步骤 | 拆成可执行的子步骤，按实际操作的先后顺序排列 |
| 标准 | 拆成该标准中具体的条款或要求，写明要求本身 |
| 案例 | 拆成该案例的关键情节、问题或可借鉴的要点 |

### 1.3 提示词构成（`aiExpand`）

`system` 固定为：

> 你是职业教育课程设计与行业能力分析专家。用户给出从行业到当前节点的归属链，你把最后一个节点拆分为更细的下级节点，内容要准确、具体、可教学，不编造法规条款编号。拆分必须始终停留在该岗位与能力项的场景内，不得扩展到无关领域。

`prompt` 依次拼入：

1. **归属链**：`行业 › 子行业 › 岗位 › 能力项 › 技能 › 末级节点 › 各层 AI 节点`（由 `aiChain(level)` 生成，每行一项）。
2. **同层节点**（去重提示）：与父节点同层的其它节点名称，要求「下级节点不要与它们的内容重复」。
3. **保留节点**（仅重新生成整列时）：`keep` 里已有人工新增/人工编辑过的节点，要求「新生成的不要与它们重复」。
4. **拆分指令**：`请把最后一个节点「{父节点名}」{AI_RULE[父类型]}。`
5. **硬性约束**（写死在 prompt 里）：

   > 要求：生成 3–6 个下级节点；name 不超过 20 个汉字；desc 一句话说明，不超过 40 个汉字；如果该节点已经无法再合理细分，返回空数组。

### 1.4 输出结构（`AI_SCHEMA`）

```json
{ "children": [ { "name": "下级节点名称", "desc": "一句话说明" } ] }
```

结构化输出由 schema 保证：`type:object, required:['children']`；`children` 为数组，元素 `required:['name','desc']`，`additionalProperties:false`。

### 1.5 生成结果怎么落位

- 每个 `child` → 一个节点：`key = 父key + '/' + newKeyPart('a')`，`name`/`desc` 做 `trim()`。
- 重新生成整列时，`keep` 里保留的节点排在 AI 新生成节点前面。
- 生成成功把该列写进 `aiStore[parent.key]`；失败则该列 `status='error'`，记录 `err`。

### 1.6 重新生成（两种粒度）

| 粒度 | 函数 | 行为 | 输出 schema / 参数 |
|---|---|---|---|
| 整列 | `regenerateLevel(i)` | 保留 `manual` / `edited` 节点，其余重生成；下面已展开的列收起；可撤销 | 复用 `aiExpand`（`AI_EXPAND_OPT`） |
| 单节点 | `regenerateNode(i, j)` | 只重写该节点 `name`/`desc`，位置不变；下面已展开的列收起；可撤销 | `NODE_REG_SCHEMA` / `NODE_REG_OPT` |

**单节点重新生成**的特别之处（`regenerateNode`）：

- 输出从「数组」变成「单对象」：`{name, desc}`（`NODE_REG_SCHEMA`，`required:['name','desc']`）。
- `prompt` 里额外带上「**自检结论作为修正提示**」：若该节点自检判定不是「通过」，追加 `该节点自检判定为「存疑/有问题」{原因}{修改建议}`，让模型据此修正。
- 其 `system` 与 `aiExpand` 同源约束：`…不编造法规条款编号。生成的节点必须仍属于该岗位与能力项的场景内，不得扩展到无关领域。`
- 完成后：`it.check = null`（清空自检判定）、`delete it.edited`、`it.regen = true`。
- 重新生成前后都做 `ai[i]===lv && lv.items[j]===it` 一致性校验，中途切换了内容就放弃本次结果。

---

## 2. AI 自检

### 2.1 触发与范围

- 点工具栏「自检」按钮 → `runSelfCheck()`。
- 检查范围：当前展开路径上**每一个已生成的 AI 列**（`ai` 中 `status==='ok' && items.length` 的层）。
- 未填 API Key 时先弹「AI 设置」；没有已生成的 AI 节点时按钮禁用。

### 2.2 自检规则（唯一来源，逐字）

自检规则的权威文本在 `.claude/skills/kmap-ai-selfcheck/SKILL.md` 的 `RULES:START`/`RULES:END` 块之间，构建时原样注入为 `D.selfCheckRules`。内容如下（**改这里要同时改 SKILL.md**）：

> 你在检查「行业图谱」中由 AI 从末级节点逐层细分出来的节点。每个待检查的层给出：归属链（从行业到上级节点）、上级节点的类型、本层全部 AI 节点（id、名称、说明），以及上级节点的同层节点。
>
> **检查维度**
>
> 1. **归属与粒度**：节点必须是上级节点的合理细分，内容不跑出上级节点的范围，也不跑出归属链里的岗位和技能场景；无论层级多深，内容都必须仍属于归属链最顶部的「岗位 · 能力项 · 技能」场景，一旦明显偏离到无关领域（例如从讲解漂移到营销、财务、人事等）判有问题，不得因上级节点本身已偏离而放宽；类型与上级一致（知识点下仍是知识点、操作步骤下是可执行的子步骤且顺序合理、标准下是该标准中的具体条款或要求、案例下是该案例的关键情节/问题/可借鉴要点）；粒度必须比上级更细，与上级几乎同义、只是换了说法的算有问题。
> 2. **重复与遗漏**：本层节点之间不能重复或互相包含，也不能与上级的同层节点内容重复；按上级节点的常规内容，指出本层明显遗漏的关键子项（只列确有必要的，不凑数）。
> 3. **事实准确**：不得编造法规、国家/行业标准的名称与编号、条款号、数据、机构名称；内容不能与行业常识或现行规定冲突；提到具体法规/标准/数据但无法确认真实性的，判「存疑」。
> 4. **表述规范**：名称不超过 20 个汉字，是名词短语或动宾短语、不写成句子，用词专业、与归属链术语一致；说明一句话、通顺、不超过 40 个汉字、不与名称简单重复。
>
> **判定**
>
> - **通过**：四个维度都没有问题。
> - **存疑**：有轻微问题，或涉及无法确认的事实，需要人工复核。
> - **有问题**：跑题、类型不符、与上级同义、与其他节点重复、事实错误或编造。
> - 一个节点有多个问题时，只报最严重的一个维度（顺序：事实准确 > 归属与粒度 > 重复与遗漏 > 表述规范），原因里可顺带提及其他问题。
> - 原因和修改建议各一句话，具体到怎么改；判「通过」时原因和建议留空。

### 2.3 待检查内容（`selfCheckPayload`）

对每个 AI 列生成一条，字段：

```json
{
  "id": "该列的父节点 key（层 id）",
  "归属链": ["行业：…", "子行业：…", "…", "各层 AI 节点"],
  "上级节点": "父节点名称",
  "类型": "父节点类型",
  "上级的同层节点": ["…"],
  "本层AI节点": [
    { "id": "节点 key", "名称": "…", "说明": "…" },
    { "id": "…", "名称": "…", "说明": "…", "来源": "人工新增" }
  ]
}
```

其中「上级的同层节点」：第 1 层 AI 列取的是技能下的末级节点名称；后续层取的是上一 AI 列的所有节点名称（去掉父节点自己）。「本层AI节点」里，`manual` 节点带 `来源:"人工新增"`，`edited` 节点带 `来源:"AI 生成后人工编辑"`。

### 2.4 提示词与输出

`system`：

> 你是职业教育课程与行业能力领域的审核专家，严格按下面的自检规则检查 AI 生成的节点，结论要有依据、不放过问题、也不吹毛求疵。
>
> （后接 `D.selfCheckRules` 全文）

`prompt`：把 `selfCheckPayload()` 的 JSON 贴进去，并说明「对『本层AI节点』里每一个节点给出判定（nodes 中逐个列出，id 原样返回），并对每一层给出遗漏提示（levels，id 为层 id）」。

输出结构（`SC_SCHEMA`）：

```json
{
  "nodes": [
    { "id": "节点 key", "verdict": "pass|doubt|fail",
      "dimension": "归属与粒度|重复与遗漏|事实准确|表述规范（通过时为空）",
      "reason": "一句话原因（通过时为空）", "suggestion": "一句话修改建议（通过时为空）" }
  ],
  "levels": [ { "id": "层 id", "missing": "该层明显遗漏的关键子项，没有则为空" } ]
}
```

- `verdict` 枚举：`pass`（通过）/ `doubt`（存疑）/ `fail`（有问题）。
- `dimension` 枚举：四个维度之一，通过时为空。

### 2.5 结果落位与展示

- 每个节点：`it.check = {verdict, dimension, reason, suggestion}`（`SC_MARK` 映射为图标/文案：✓ 通过 / ! 存疑 / ✕ 有问题）。
- 每层：`lv.missing = 遗漏提示`。
- `lv.checkedAt` 记录自检时间。
- 自检条汇总计数；「查看报告」列出每条：判定 · 维度 · 原因 · 建议，并可逐条「修改」（打开编辑框）或「重新生成」（调 `regenerateNode`）。

### 2.6 自检后的修改 / 重新生成，如何影响判定

- 自检结论挂在节点上（`it.check`），**该节点被修改或重新生成后判定即清空**（回到「未检查」状态）。
- 人工修改节点 → `it.edited = true`，判定清空。
- 重新生成节点 → `it.regen = true`、判定清空（`it.check = null`）。

---

## 3. 接口与配置

### 3.1 「AI 设置」（用户可改）

- `type`：`anthropic` 或 `openai`。
- `url` / `model` / `key` 四项，存 `localStorage`（key `kmapAi`），只存本机浏览器，覆盖默认配置。

### 3.2 默认配置的组成（`aiCfg`）

```
aiCfg() = AI_DEFAULT ∪ localStorage['kmapAi']
AI_DEFAULT = AI_PRESETS.claude ∪ AI_BUILTIN
AI_BUILTIN = 构建时由 ai_config.json 注入
```

- `AI_PRESETS`：
  - `claude`：`{type:'anthropic', url:'https://api.anthropic.com/v1/messages', model:'claude-opus-5-5'}`
  - `deepseek`：`{type:'openai', url:'https://api.deepseek.com/chat/completions', model:'deepseek-chat'}`
- `AI_BUILTIN`：来自 `ai_config.json`（**已 gitignore，不提交**），部署时预置接口与 Key；模板见 `ai_config.example.json`。
- 预设一键填入只改 type/url/model，Key 由使用者自己填。

### 3.3 两种接口的调用差异（`aiCallJSON`）

按 `type` 分发：

- **Anthropic**（`aiCallAnthropic`）：Messages API，用 `output_config.format.type='json_schema'` + `schema` 做结构化输出；`x-api-key` 鉴权；`anthropic-dangerous-direct-browser-access` 允许浏览器直连；命中 `AI_FALLBACK_MODELS` 时加 `fallbacks`/`anthropic-beta`。`stop_reason==='refusal'` / `'max_tokens'` 分别报「模型拒绝」「输出被截断」。
- **OpenAI 兼容**（`aiCallOpenAI`，含 DeepSeek）：`response_format:{type:'json_object'}`，且必须把 JSON 格式写进 system（`formatHint`）。`finish_reason==='length'` 报「输出被截断」。
- 两者返回文本后统一 `JSON.parse`，并先剥离可能的 ` ```json ` 包裹。

### 3.4 三个调用点的参数汇总

| 调用点 | 常量 | effort | maxTokens | schema / formatHint |
|---|---|---|---|---|
| 扩展 / 整列重生成 | `AI_EXPAND_OPT` | `low` | 4000 | `AI_SCHEMA` / `{"children":[…]}` |
| 单节点重生成 | `NODE_REG_OPT` | `low` | 1200 | `NODE_REG_SCHEMA` / `{"name":…,"desc":…}` |
| 自检 | `SC_OPT` | `medium` | 16000 | `SC_SCHEMA` / `{"nodes":[…],"levels":[…]}` |

---

## 4. 维护约定

1. **自检规则的唯一来源是 SKILL.md**（`RULES:START`/`RULES:END` 块），`kmap_template.html` 里的 `SC_SCHEMA`/`SC_DIMS`/`SC_MARK` 只负责承载与展示，规则的语义以 SKILL.md 为准。改规则两边要一致，且改完跑 `python3 build_kmap.py`。
2. **生成规则在 `kmap_template.html`**：`AI_RULE`（类型拆分）、`AI_SCHEMA` / `NODE_REG_SCHEMA`（输出结构）、`AI_EXPAND_OPT` / `NODE_REG_OPT`（参数）、`aiExpand` / `regenerateLevel` / `regenerateNode`（提示词与流程）。
3. **改动清单**（改任何一条规则后都走一遍）：
   - 改 `kmap_template.html` 或 `.claude/skills/kmap-ai-selfcheck/SKILL.md`。
   - `python3 build_kmap.py`（确认无断言报错，打印「AI 预置配置：已注入」）。
   - `kmap.html` 用 headless Chrome 冒烟验证（页面能开、点末级节点能触发生成/自检按钮可用）。
4. `ai_config.json` 与 `kmap.html` **不提交 git**（前者含 Key，后者是构建产物）。
