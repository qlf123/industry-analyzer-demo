# -*- coding: utf-8 -*-
"""把双图谱示例数据渲染成一个可直接打开的 Obsidian vault。"""
import os, json, shutil, sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from data_ability import (INDUSTRY, SUB_INDUSTRIES, POSITIONS, ABILITIES,
                          POSITION_ABILITY, PREREQUISITES)
from data_knowledge import (MAJOR, COURSES, MODULES, TASKS, FLOWS, STEPS,
                            SKILL_SPECS, KNOWLEDGE_POINTS, STANDARDS, CASES, MAPPINGS)

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "vault", "旅游业双图谱示例")
LV = {"L1": 1, "L2": 2, "L3": 3}
TYPE_CN = {"knowledge": "知识", "skill": "技能", "literacy": "素养"}
REL_CN = {"covers": "直接支撑", "partially_covers": "部分支撑",
          "prerequisite_of": "前置铺垫", "assesses": "提供达标判据"}

# ── 建索引 ────────────────────────────────────────────────
sub_by = {s["id"]: s for s in SUB_INDUSTRIES}
pos_by = {p["id"]: p for p in POSITIONS}
abl_by = {a["id"]: a for a in ABILITIES}
crs_by = {c["id"]: c for c in COURSES}
mod_by = {m["id"]: m for m in MODULES}
tsk_by = {t["id"]: t for t in TASKS}
flw_by = {f["id"]: f for f in FLOWS}
stp_by = {s["id"]: s for s in STEPS}

leaf_by = {}
SKS = [{"id": r[0], "name": r[1], "parent": r[2], "observable": r[3], "object": r[4],
        "conditions": r[5], "tools": r[6], "key_req": r[7], "achievement": r[8]} for r in SKILL_SPECS]
KNP = [{"id": r[0], "name": r[1], "parent": r[2], "kp_type": r[3], "core": r[4],
        "role": r[5], "en": r[6]} for r in KNOWLEDGE_POINTS]
STD = [{"id": r[0], "name": r[1], "parent": r[2], "std_type": r[3], "content": r[4],
        "applicable": r[5], "source": r[6]} for r in STANDARDS]
CAS = [{"id": r[0], "name": r[1], "parent": r[2], "case_type": r[3], "desc": r[4],
        "judgment": r[5], "analysis": r[6], "principle": r[7]} for r in CASES]
for lst in (SKS, KNP, STD, CAS):
    for n in lst:
        leaf_by[n["id"]] = n

NODE_KIND = {}
for n in SKS: NODE_KIND[n["id"]] = "技能规范"
for n in KNP: NODE_KIND[n["id"]] = "知识点"
for n in STD: NODE_KIND[n["id"]] = "标准"
for n in CAS: NODE_KIND[n["id"]] = "案例"

# 文件名
FN = {}
FN[INDUSTRY["id"]] = f'{INDUSTRY["id"]} {INDUSTRY["name"]}'
FN[MAJOR["id"]] = f'{MAJOR["id"]} {MAJOR["name"]}'
for coll in (SUB_INDUSTRIES, POSITIONS, ABILITIES, COURSES, MODULES, TASKS, FLOWS, STEPS, SKS, KNP, STD, CAS):
    for n in coll:
        FN[n["id"]] = f'{n["id"]} {n["name"]}'

def L(nid):
    return f"[[{FN[nid]}]]"

# ── 派生：岗位-能力 ────────────────────────────────────────
pa_by_pos, pa_by_abl = defaultdict(list), defaultdict(list)
for p, a, w, lv in POSITION_ABILITY:
    pa_by_pos[p].append((a, w, lv))
    pa_by_abl[a].append((p, w, lv))
for k in pa_by_pos: pa_by_pos[k].sort(key=lambda x: -x[1])
for k in pa_by_abl: pa_by_abl[k].sort(key=lambda x: -x[1])

# ── 派生：映射 ────────────────────────────────────────────
map_by_kg, map_by_abl = defaultdict(list), defaultdict(list)
MAPS = []
for i, (kg, ab, rel, lv, cov, anchor, conf, note) in enumerate(MAPPINGS, 1):
    m = {"id": f"MAP-{i:03d}", "kg": kg, "abl": ab, "rel": rel, "level": lv,
         "coverage": cov, "anchor": anchor, "conf": conf, "note": note,
         "review": "pending" if (conf < 0.9 or abl_by[ab].get("inferred") or abl_by[ab].get("flag")) else "auto_confirmed"}
    MAPS.append(m)
    map_by_kg[kg].append(m)
    map_by_abl[ab].append(m)

def leaf_course(leaf_id):
    """叶子节点上溯到课程"""
    n = leaf_by[leaf_id]
    p = n["parent"]
    while True:
        if p in stp_by: p = stp_by[p]["flow"]
        elif p in flw_by: p = flw_by[p]["task"]
        elif p in tsk_by: p = tsk_by[p]["module"]
        elif p in mod_by: return mod_by[p]["course"]
        else: return None

# 能力 → 覆盖情况
abl_cov = {}
for a in ABILITIES:
    ms = map_by_abl[a["id"]]
    teach = [m for m in ms if m["rel"] in ("covers", "partially_covers")]
    levels = sorted({m["level"] for m in teach}, key=lambda x: LV[x])
    req = [lv for _, _, lv in pa_by_abl[a["id"]]]
    max_req = max(req, key=lambda x: LV[x]) if req else "L1"
    if not teach:
        status, gap = "未覆盖", f"本专业课程未涉及，岗位最高要求 {max_req}"
    elif LV[levels[-1]] >= LV[max_req]:
        status, gap = "已覆盖", ""
    else:
        status, gap = "等级缺口", f"课程覆盖至 {levels[-1]}，岗位要求 {max_req}，差 {LV[max_req]-LV[levels[-1]]} 级"
    abl_cov[a["id"]] = {"status": status, "gap": gap, "levels": levels, "max_req": max_req,
                        "maps": ms,
                        "courses": sorted({leaf_course(m["kg"]) for m in ms}) if ms else []}

# 课程 → 能力
crs_abl = defaultdict(set)
for m in MAPS:
    c = leaf_course(m["kg"])
    if c: crs_abl[c].add(m["abl"])

# 子行业 → 能力
sub_abl = defaultdict(set)
for p, a, w, lv in POSITION_ABILITY:
    sub_abl[pos_by[p]["sub"]].add(a)
abl_subs = defaultdict(set)
for p, a, w, lv in POSITION_ABILITY:
    abl_subs[a].add(pos_by[p]["sub"])

# ── 渲染工具 ──────────────────────────────────────────────
def yaml_val(v):
    if v is None: return "null"
    if isinstance(v, bool): return "true" if v else "false"
    if isinstance(v, (int, float)): return str(v)
    return '"' + str(v).replace('"', '\\"') + '"'

def fm(d):
    out = ["---"]
    for k, v in d.items():
        if isinstance(v, list):
            if not v:
                out.append(f"{k}: []")
            else:
                out.append(f"{k}:")
                out += [f"  - {yaml_val(x)}" for x in v]
        else:
            out.append(f"{k}: {yaml_val(v)}")
    out.append("---")
    return "\n".join(out)

files = {}
def write(folder, nid, front, body):
    files[f"{folder}/{FN[nid]}.md"] = fm(front) + "\n\n" + body.strip() + "\n"

def table(header, rows):
    if not rows: return "_（暂无）_\n"
    out = ["| " + " | ".join(header) + " |", "|" + "|".join(["---"] * len(header)) + "|"]
    out += ["| " + " | ".join(str(c) for c in r) + " |" for r in rows]
    return "\n".join(out) + "\n"

def dv(q):
    return "```dataview\n" + q.strip() + "\n```\n"

# ── 1. 能力图谱：行业 ──────────────────────────────────────
ind_body = f"""> [!abstract] 行业边界
> {INDUSTRY['boundary_notes']}

## 纳入范围
""" + "\n".join(f"- {x}" for x in INDUSTRY["included"]) + """

## 排除项与理由
""" + table(["排除项", "理由"], [[e["item"], e["reason"]] for e in INDUSTRY["excluded"]]) + """
## 待业务方拍板
""" + "\n".join(f"- [ ] {q}" for q in INDUSTRY["boundary_questions"]) + """

## 产业趋势
""" + "\n".join(f"{i}. {t}" for i, t in enumerate(INDUSTRY["trends"], 1)) + """

## 子行业
""" + table(["子行业", "优先级", "典型用人单位", "岗位数", "能力项数"],
            [[L(s["id"]), s["priority"],
              "、".join(s["employers"]),
              sum(1 for p in POSITIONS if p["sub"] == s["id"]),
              len(sub_abl[s["id"]])] for s in SUB_INDUSTRIES]) + f"""
## 统计
- 子行业 {len(SUB_INDUSTRIES)} · 岗位 {len(POSITIONS)} · 能力项 {len(ABILITIES)} · 岗位-能力关系 {len(POSITION_ABILITY)} 条
- 核心能力 {sum(1 for a in ABILITIES if a['core'])} 条 · 跨子行业能力 {sum(1 for a in ABILITIES if len(abl_subs[a['id']])>1)} 条
- 需人工复核 {sum(1 for a in ABILITIES if a['inferred'] or a['flag'])} 条

## 对接的教育侧专业
- {L(MAJOR['id'])}
"""
write("10-能力图谱/行业", INDUSTRY["id"], {
    "node_type": "行业", "id": INDUSTRY["id"], "name": INDUSTRY["name"],
    "aliases": INDUSTRY["aliases"], "layer": 1,
    "sub_industry_count": len(SUB_INDUSTRIES), "position_count": len(POSITIONS),
    "ability_count": len(ABILITIES),
    "linked_majors": [f"[[{FN[MAJOR['id']]}]]"],
    "tags": ["能力图谱/行业"],
}, ind_body)

# ── 2. 子行业 ─────────────────────────────────────────────
for s in SUB_INDUSTRIES:
    poss = [p for p in POSITIONS if p["sub"] == s["id"]]
    notice = ("\n> [!info] 本期未建图\n> 该子行业 priority 为 `extended`，等待业务方在人工确认闸口拍板后再展开岗位与能力项。\n"
              if not poss else "")
    body = f"""{s['desc']}

**典型用人单位**：{ '、'.join(s['employers']) }
{notice}

## 岗位
""" + table(["岗位", "职业层级", "别名", "能力项数"],
            [[L(p["id"]), p["career_level"], "、".join(p["aliases"]), len(pa_by_pos[p["id"]])] for p in poss]) + """
## 本子行业涉及的能力项
""" + table(["能力项", "类型", "领域", "核心", "课程覆盖"],
            [[L(aid), TYPE_CN[abl_by[aid]["type"]], abl_by[aid]["domain"],
              "★" if abl_by[aid]["core"] else "", abl_cov[aid]["status"]]
             for aid in sorted(sub_abl[s["id"]])])
    write("10-能力图谱/子行业", s["id"], {
        "node_type": "子行业", "id": s["id"], "name": s["name"], "layer": 2,
        "priority": s["priority"], "industry": f"[[{FN[INDUSTRY['id']]}]]",
        "typical_employers": s["employers"],
        "position_count": len(poss), "distinct_ability_count": len(sub_abl[s["id"]]),
        "tags": ["能力图谱/子行业", f"优先级/{s['priority']}"],
    }, body)

# ── 3. 岗位 ───────────────────────────────────────────────
for p in POSITIONS:
    rows = []
    for aid, w, lv in pa_by_pos[p["id"]]:
        a = abl_by[aid]
        c = abl_cov[aid]
        rows.append([L(aid), TYPE_CN[a["type"]], a["domain"], "★" if a["core"] else "",
                     f"{w:.2f}", lv,
                     "、".join(L(x) for x in c["courses"]) or "—",
                     c["status"] + ("：" + c["gap"] if c["gap"] else "")])
    covered = sum(1 for aid, _, _ in pa_by_pos[p["id"]] if abl_cov[aid]["status"] == "已覆盖")
    gapped = [aid for aid, _, _ in pa_by_pos[p["id"]] if abl_cov[aid]["status"] != "已覆盖"]
    body = f"""{p['desc']}

- **所属子行业**：{L(p['sub'])}
- **职业层级**：{p['career_level']}
- **市场别名**：{ '、'.join(p['aliases']) }
- **检索主查询**：`{p['mergedQuery'] if 'mergedQuery' in p else p['merged_query']}`
- **备用查询**：`{p['fallback_query']}`

## 岗位能力要求（按权重降序）
""" + table(["能力项", "类型", "领域", "核心", "权重", "岗位要求等级", "支撑课程", "覆盖状态"], rows) + f"""
## 课程覆盖度
- 能力项总数 **{len(pa_by_pos[p['id']])}** · 已覆盖 **{covered}** · 覆盖率 **{covered/len(pa_by_pos[p['id']]):.0%}**
- 未达标能力项：{ '、'.join(L(x) for x in gapped) if gapped else '无' }

> [!tip] 这张表怎么用
> 从上往下读是「培养方案对照表」：这个岗位要什么、要到几级、哪门课在教、还差多少。
> 「覆盖状态」为未覆盖或等级缺口的行，就是本专业课程体系需要补的内容。
"""
    write("10-能力图谱/岗位", p["id"], {
        "node_type": "岗位", "id": p["id"], "name": p["name"], "layer": 3,
        "aliases": p["aliases"], "career_level": p["career_level"],
        "sub_industry": f"[[{FN[p['sub']]}]]", "industry": f"[[{FN[INDUSTRY['id']]}]]",
        "ability_count": len(pa_by_pos[p["id"]]),
        "core_ability_count": sum(1 for aid, _, _ in pa_by_pos[p["id"]] if abl_by[aid]["core"]),
        "course_coverage_rate": round(covered / len(pa_by_pos[p["id"]]), 2),
        "abilities": [f"[[{FN[aid]}]]" for aid, _, _ in pa_by_pos[p["id"]]],
        "tags": ["能力图谱/岗位", f"子行业/{sub_by[p['sub']]['name']}"],
    }, body)

# ── 4. 能力项 ─────────────────────────────────────────────
pre_from = defaultdict(list)
for f_, t_, note in PREREQUISITES:
    pre_from[f_].append((t_, note))
pre_to = defaultdict(list)
for f_, t_, note in PREREQUISITES:
    pre_to[t_].append((f_, note))

for a in ABILITIES:
    c = abl_cov[a["id"]]
    lv_rows = []
    for lname in ("L1", "L2", "L3"):
        l = a["levels"][lname]
        lv_rows.append([f"**{lname}**", l["desc"],
                        "<br>".join("· " + x for x in l["points"]), l["assess"]])
    map_rows = [[L(m["kg"]), NODE_KIND[m["kg"]], REL_CN[m["rel"]], m["level"],
                 f"{m['coverage']:.1f}", m["anchor"], f"{m['conf']:.2f}",
                 L(leaf_course(m["kg"])), m["note"]]
                for m in sorted(c["maps"], key=lambda x: (LV[x["level"]], x["kg"]))]
    pos_rows = [[L(pid), f"{w:.2f}", lv, pos_by[pid]["career_level"]]
                for pid, w, lv in pa_by_abl[a["id"]]]
    ev_rows = [[e["sourceTitle"], e["sourceLevel"], e["excerpt"], e["url"]] for e in a["evidences"]]

    flag_block = ""
    if a["flag"]:
        flag_block = f"\n> [!warning] {a['flag']}\n"
    if a["inferred"]:
        flag_block += "\n> [!caution] 本条为 AI 推断项，资料中无直接依据，须人工确认后方可进入主干\n"

    gap_block = ""
    if c["status"] == "未覆盖":
        gap_block = f"\n> [!danger] 教学缺口\n> {c['gap']}。本专业现有课程无任何知识点或技能规范映射到该能力。\n"
    elif c["status"] == "等级缺口":
        gap_block = f"\n> [!warning] 等级缺口\n> {c['gap']}。需在现有课程中增设更高阶的任务，或由实习/实训环节承接。\n"

    body = f"""> **定义**：{a['definition']}
{flag_block}{gap_block}
## 三级行为化描述

| 等级 | 行为描述（可观察） | 观察点 | 建议考核方式 |
|---|---|---|---|
""" + "\n".join("| " + " | ".join(r) + " |" for r in lv_rows) + f"""

## 被哪些岗位要求
""" + table(["岗位", "权重", "要求等级", "职业层级"], pos_rows) + f"""
- 覆盖岗位数 **{len(pos_rows)}** · 最高要求等级 **{c['max_req']}** · 跨子行业 **{'是' if len(abl_subs[a['id']])>1 else '否'}**

## 映射到的知识体系节点
""" + table(["知识节点", "节点类型", "关系", "服务等级", "覆盖度", "锚定方式", "置信度", "所属课程", "锚定依据"], map_rows) + f"""
**课程覆盖结论**：{c['status']}{'　—　' + c['gap'] if c['gap'] else ''}　（课程已覆盖等级：{ '、'.join(c['levels']) or '无' }）

## 来源证据
""" + table(["来源", "等级", "原文片段", "URL"], ev_rows) + """
_证据为示例占位；真实数据由能力图谱 V2 流水线的 C1 来源分级 + C1.5 逐字校验产出。_

## 能力关系
""" + ("**前置能力**：" + "、".join(f"{L(t)}（{n}）" for t, n in pre_from[a["id"]]) + "\n\n" if pre_from[a["id"]] else "") \
        + ("**本能力是以下能力的前置**：" + "、".join(f"{L(t)}（{n}）" for t, n in pre_to[a["id"]]) + "\n\n" if pre_to[a["id"]] else "") \
        + (f"**上位能力**：{L(a['parent'])}\n\n" if a["parent"] else "") \
        + ("**下位能力**：" + "、".join(L(x["id"]) for x in ABILITIES if x["parent"] == a["id"]) + "\n" if any(x["parent"] == a["id"] for x in ABILITIES) else "")

    write("10-能力图谱/能力项", a["id"], {
        "node_type": "能力项", "id": a["id"], "name": a["name"], "layer": 4,
        "aliases": a["aliases"], "ability_type": a["type"],
        "ability_type_cn": TYPE_CN[a["type"]], "domain": a["domain"], "core": a["core"],
        "parent_ability": f"[[{FN[a['parent']]}]]" if a["parent"] else None,
        "industry": f"[[{FN[INDUSTRY['id']]}]]",
        "positions": [f"[[{FN[pid]}]]" for pid, _, _ in pa_by_abl[a["id"]]],
        "position_count": len(pa_by_abl[a["id"]]),
        "max_required_level": c["max_req"],
        "across_sub_industries": [sub_by[x]["name"] for x in sorted(abl_subs[a["id"]])],
        "cross_sub_industry": len(abl_subs[a["id"]]) > 1,
        "maps_to": [f"[[{FN[m['kg']]}]]" for m in c["maps"]],
        "mapped_node_count": len(c["maps"]),
        "covered_levels": c["levels"],
        "coverage_status": c["status"],
        "coverage_gap": c["gap"] or None,
        "supporting_courses": [f"[[{FN[x]}]]" for x in c["courses"]],
        "inferred": a["inferred"], "flag": a["flag"],
        "review_status": "expert_required" if (a["inferred"] or a["flag"]) else "pending",
        "tags": ["能力图谱/能力项", f"领域/{a['domain']}", f"能力类型/{TYPE_CN[a['type']]}",
                 f"覆盖/{c['status']}"] + (["核心能力"] if a["core"] else []),
    }, body)

# ── 5. 知识图谱：专业 ─────────────────────────────────────
maj_body = f"""{MAJOR['desc']}

- **学段**：{MAJOR['stage']}　**专业代码**：{MAJOR['code']}　**专业大类**：{MAJOR['category']}
- **面向岗位**：{ '、'.join(L(x) for x in MAJOR['target_positions']) }
- **对接行业**：{L(INDUSTRY['id'])}

## 课程
""" + table(["课程", "课程类型", "课程模块", "学时", "开课学期", "支撑能力项数"],
            [[L(c["id"]), c["type"], c["block"], c["hours"], c["term"], len(crs_abl[c["id"]])] for c in COURSES]) + """
## 培养方案对照（面向岗位的能力覆盖）
""" + table(["岗位", "能力项数", "已覆盖", "覆盖率", "缺口能力项"],
            [[L(p), len(pa_by_pos[p]),
              sum(1 for aid, _, _ in pa_by_pos[p] if abl_cov[aid]["status"] == "已覆盖"),
              f"{sum(1 for aid,_,_ in pa_by_pos[p] if abl_cov[aid]['status']=='已覆盖')/len(pa_by_pos[p]):.0%}",
              "、".join(L(aid) for aid, _, _ in pa_by_pos[p] if abl_cov[aid]["status"] != "已覆盖") or "无"]
             for p in [x["id"] for x in POSITIONS]])
write("20-知识图谱/专业", MAJOR["id"], {
    "node_type": "专业", "id": MAJOR["id"], "name": MAJOR["name"],
    "major_code": MAJOR["code"], "stage": MAJOR["stage"], "category": MAJOR["category"],
    "industry": f"[[{FN[INDUSTRY['id']]}]]",
    "target_positions": [f"[[{FN[x]}]]" for x in MAJOR["target_positions"]],
    "courses": [f"[[{FN[c['id']]}]]" for c in COURSES],
    "tags": ["知识图谱/专业", f"学段/{MAJOR['stage']}"],
}, maj_body)

# ── 6. 课程 ───────────────────────────────────────────────
DEPTH = {"理论认知类": "模块 → 认知任务 → 叶子",
         "实操技能类": "技能领域 → 任务 → 操作流程 → 叶子",
         "岗位应用类": "项目 → 任务 → 操作流程 → 操作步骤 → 叶子"}
for c in COURSES:
    mods = [m for m in MODULES if m["course"] == c["id"]]
    tsks = [t for t in TASKS if t["module"] in {m["id"] for m in mods}]
    abl_rows = []
    for aid in sorted(crs_abl[c["id"]]):
        a = abl_by[aid]
        lvls = sorted({m["level"] for m in map_by_abl[aid] if leaf_course(m["kg"]) == c["id"]}, key=lambda x: LV[x])
        abl_rows.append([L(aid), TYPE_CN[a["type"]], a["domain"], "★" if a["core"] else "",
                         "、".join(lvls), abl_cov[aid]["max_req"], abl_cov[aid]["status"]])
    body = f"""{c['desc']}

- **课程类型**：{c['type']}（层级深度：{DEPTH[c['type']]}）
- **课程模块**：{c['block']}　**学时**：{c['hours']}　**开课学期**：{c['term']}
- **所属专业**：{L(MAJOR['id'])}

## 模块与任务
""" + "\n".join(
        f"### {L(m['id'])}　_{m['kind']}_\n{m['desc']}\n\n"
        + "\n".join(f"- {L(t['id'])}" for t in TASKS if t["module"] == m["id"]) + "\n"
        for m in mods) + """
## 本课程支撑的能力项
""" + table(["能力项", "类型", "领域", "核心", "本课覆盖等级", "岗位最高要求", "整体覆盖状态"], abl_rows) + f"""
> [!tip] 反向用法
> 这张表回答「这门课到底在为哪些岗位能力服务、教到了第几级」。
> 「本课覆盖等级」低于「岗位最高要求」的行，是本课程可以加深的地方。
"""
    write("20-知识图谱/课程", c["id"], {
        "node_type": "课程", "id": c["id"], "name": c["name"],
        "course_type": c["type"], "course_block": c["block"],
        "hours": c["hours"], "term": c["term"],
        "major": f"[[{FN[MAJOR['id']]}]]",
        "modules": [f"[[{FN[m['id']]}]]" for m in mods],
        "supports_abilities": [f"[[{FN[x]}]]" for x in sorted(crs_abl[c["id"]])],
        "supported_ability_count": len(crs_abl[c["id"]]),
        "tags": ["知识图谱/课程", f"课程类型/{c['type']}"],
    }, body)

# ── 7. 模块 ───────────────────────────────────────────────
for m in MODULES:
    ts = [t for t in TASKS if t["module"] == m["id"]]
    body = f"""{m['desc']}

- **模块性质**：{m['kind']}　**所属课程**：{L(m['course'])}（{crs_by[m['course']]['type']}）

## 下属任务
""" + table(["任务", "任务结果"], [[L(t["id"]), t["result"]] for t in ts])
    write("20-知识图谱/模块", m["id"], {
        "node_type": "模块", "id": m["id"], "name": m["name"], "module_kind": m["kind"],
        "course": f"[[{FN[m['course']]}]]",
        "tasks": [f"[[{FN[t['id']]}]]" for t in ts],
        "tags": ["知识图谱/模块", f"模块性质/{m['kind']}"],
    }, body)

# ── 8. 任务 ───────────────────────────────────────────────
def children_of(pid):
    return ([n for n in SKS if n["parent"] == pid], [n for n in KNP if n["parent"] == pid],
            [n for n in STD if n["parent"] == pid], [n for n in CAS if n["parent"] == pid])

def leaf_block(pid):
    sks, knp, std, cas = children_of(pid)
    out = ""
    if sks:
        out += "**技能规范**\n" + table(["技能规范", "可观察能力要求", "达成结果"],
                                    [[L(n["id"]), n["observable"], n["achievement"]] for n in sks])
    if knp:
        out += "\n**知识点**\n" + table(["知识点", "类型", "应用作用"],
                                    [[L(n["id"]), n["kp_type"], n["role"]] for n in knp])
    if std:
        out += "\n**标准**\n" + table(["标准", "类型", "来源依据"],
                                   [[L(n["id"]), n["std_type"], n["source"]] for n in std])
    if cas:
        out += "\n**案例**\n" + table(["案例", "类型", "判断结果"],
                                   [[L(n["id"]), n["case_type"], n["judgment"]] for n in cas])
    return out or ""

for t in TASKS:
    fl = [f for f in FLOWS if f["task"] == t["id"]]
    body = f"""> **任务结果**：{t['result']}

- **所属模块**：{L(t['module'])}　**所属课程**：{L(mod_by[t['module']]['course'])}

"""
    if fl:
        body += "## 操作流程\n" + table(["操作流程", "流程结果"], [[L(f["id"]), f["result"]] for f in fl])
    lb = leaf_block(t["id"])
    if lb:
        body += "\n## 本任务直属的知识要素\n" + lb
    write("20-知识图谱/任务", t["id"], {
        "node_type": "任务", "id": t["id"], "name": t["name"],
        "task_result": t["result"],
        "module": f"[[{FN[t['module']]}]]",
        "course": f"[[{FN[mod_by[t['module']]['course']]}]]",
        "flows": [f"[[{FN[f['id']]}]]" for f in fl],
        "tags": ["知识图谱/任务"],
    }, body)

# ── 9. 操作流程 / 操作步骤 ────────────────────────────────
for f in FLOWS:
    sts = [s for s in STEPS if s["flow"] == f["id"]]
    body = f"""> **流程结果**：{f['result']}

- **所属任务**：{L(f['task'])}　**所属课程**：{L(mod_by[tsk_by[f['task']]['module']]['course'])}

"""
    if sts:
        body += "## 操作步骤\n" + table(["序号", "操作步骤", "完成结果"],
                                    [[s["order"], L(s["id"]), s["result"]] for s in sts])
    lb = leaf_block(f["id"])
    if lb:
        body += "\n## 本流程直属的知识要素\n" + lb
    write("20-知识图谱/操作流程", f["id"], {
        "node_type": "操作流程", "id": f["id"], "name": f["name"],
        "flow_result": f["result"], "task": f"[[{FN[f['task']]}]]",
        "course": f"[[{FN[mod_by[tsk_by[f['task']]['module']]['course']]}]]",
        "steps": [f"[[{FN[s['id']]}]]" for s in sts],
        "tags": ["知识图谱/操作流程"],
    }, body)

for s in STEPS:
    body = f"""> **完成结果**：{s['result']}

- **所属流程**：{L(s['flow'])}　**步骤序号**：{s['order']}
- **所属任务**：{L(flw_by[s['flow']]['task'])}

## 本步骤直属的知识要素
""" + (leaf_block(s["id"]) or "_（暂无）_")
    write("20-知识图谱/操作步骤", s["id"], {
        "node_type": "操作步骤", "id": s["id"], "name": s["name"], "step_order": s["order"],
        "step_result": s["result"], "flow": f"[[{FN[s['flow']]}]]",
        "task": f"[[{FN[flw_by[s['flow']]['task']]}]]",
        "tags": ["知识图谱/操作步骤"],
    }, body)

# ── 10. 叶子节点 ─────────────────────────────────────────
def map_table(nid):
    ms = map_by_kg[nid]
    return table(["能力项", "关系", "服务等级", "覆盖度", "锚定方式", "置信度", "复核状态", "锚定依据"],
                 [[L(m["abl"]), REL_CN[m["rel"]], m["level"], f"{m['coverage']:.1f}",
                   m["anchor"], f"{m['conf']:.2f}", m["review"], m["note"]] for m in ms])

def parent_chain(pid):
    chain = []
    while pid:
        chain.append(L(pid))
        if pid in stp_by: pid = stp_by[pid]["flow"]
        elif pid in flw_by: pid = flw_by[pid]["task"]
        elif pid in tsk_by: pid = tsk_by[pid]["module"]
        elif pid in mod_by: pid = mod_by[pid]["course"]
        else: pid = None
    return " ← ".join(chain)

def common_fm(n, kind, extra):
    ms = map_by_kg[n["id"]]
    d = {"node_type": kind, "id": n["id"], "name": n["name"]}
    d.update(extra)
    d.update({
        "parent": f"[[{FN[n['parent']]}]]",
        "course": f"[[{FN[leaf_course(n['id'])]}]]",
        "maps_to_abilities": [f"[[{FN[m['abl']]}]]" for m in ms],
        "serves_levels": sorted({m["level"] for m in ms}, key=lambda x: LV[x]),
        "mapping_count": len(ms),
        "tags": ["知识图谱/" + kind] + [f"服务能力/{abl_by[m['abl']]['domain']}" for m in ms][:1],
    })
    return d

for n in SKS:
    body = f"""> **可观察能力要求**：{n['observable']}

| 字段 | 内容 |
|---|---|
| 操作对象 | {n['object']} |
| 适用条件 | {n['conditions']} |
| 工具/材料/设备 | {n['tools']} |
| 关键操作要求 | {n['key_req']} |
| 达成结果 | {n['achievement']} |

**归属链**：{parent_chain(n['parent'])}

## 映射到的能力项
""" + map_table(n["id"])
    write("20-知识图谱/技能规范", n["id"], common_fm(n, "技能规范", {
        "observable_ability_requirement": n["observable"],
        "achievement_result": n["achievement"]}), body)

for n in KNP:
    body = f"""> **核心内容**：{n['core']}

- **知识点类型**：{n['kp_type']}
- **应用作用**：{n['role']}
- **英文术语**：{n['en'] or '—'}

**归属链**：{parent_chain(n['parent'])}

## 映射到的能力项
""" + map_table(n["id"])
    write("20-知识图谱/知识点", n["id"], common_fm(n, "知识点", {
        "knowledge_point_type": n["kp_type"], "english_terms": n["en"]}), body)

for n in STD:
    body = f"""> **达标要求**：{n['content']}

- **标准类型**：{n['std_type']}
- **适用条件**：{n['applicable']}
- **来源依据**：{n['source']}

**归属链**：{parent_chain(n['parent'])}

## 映射到的能力项
""" + map_table(n["id"])
    write("20-知识图谱/标准", n["id"], common_fm(n, "标准", {
        "standard_type": n["std_type"], "source_basis": n["source"]}), body)

for n in CAS:
    body = f"""- **案例类型**：{n['case_type']}

**案例情景**
{n['desc']}

**判断结果**
{n['judgment']}

**原因分析**
{n['analysis']}

**处理原则**
{n['principle']}

**归属链**：{parent_chain(n['parent'])}

## 映射到的能力项
""" + map_table(n["id"])
    write("20-知识图谱/案例", n["id"], common_fm(n, "案例", {
        "case_type": n["case_type"]}), body)

# ── 11. 映射节点（仅需人工复核的落盘为独立文件）──────────────
review_maps = [m for m in MAPS if m["review"] == "pending"]
for m in review_maps:
    FN[m["id"]] = f'{m["id"]} {leaf_by[m["kg"]]["name"]} → {abl_by[m["abl"]]["name"]}'
for m in review_maps:
    a = abl_by[m["abl"]]
    lv = a["levels"][m["level"]]
    body = f"""> [!question] 待人工复核的映射边
> 置信度 {m['conf']:.2f}{'　·　能力项带 flag：' + a['flag'] if a['flag'] else ''}{'　·　能力项为 AI 推断项' if a['inferred'] else ''}

| 字段 | 值 |
|---|---|
| 知识侧节点 | {L(m['kg'])}（{NODE_KIND[m['kg']]}） |
| 能力侧节点 | {L(m['abl'])} |
| 关系类型 | {REL_CN[m['rel']]}（`{m['rel']}`） |
| 服务等级 | {m['level']} |
| 覆盖度 | {m['coverage']:.1f} |
| 锚定方式 | {m['anchor']} |
| 置信度 | {m['conf']:.2f} |
| 所属课程 | {L(leaf_course(m['kg']))} |

## 锚定依据
{m['note']}

## 对照材料

**能力项 {m['level']} 级行为描述**
> {lv['desc']}

**该级观察点**
""" + "\n".join(f"- {x}" for x in lv["points"]) + f"""

**知识侧节点内容**
> {leaf_by[m['kg']].get('observable') or leaf_by[m['kg']].get('core') or leaf_by[m['kg']].get('content') or leaf_by[m['kg']].get('desc')}

## 复核结论
- [ ] 确认映射成立
- [ ] 调整服务等级为：
- [ ] 调整关系类型为：
- [ ] 删除该映射，理由：
"""
    files[f"30-映射层/{FN[m['id']]}.md"] = fm({
        "node_type": "映射", "id": m["id"],
        "from_kg": f"[[{FN[m['kg']]}]]", "to_ability": f"[[{FN[m['abl']]}]]",
        "relation": m["rel"], "relation_cn": REL_CN[m["rel"]],
        "serves_level": m["level"], "coverage": m["coverage"],
        "anchor": m["anchor"], "confidence": m["conf"],
        "review_status": m["review"],
        "course": f"[[{FN[leaf_course(m['kg'])]}]]",
        "tags": ["映射层/待复核", f"关系/{m['rel']}"],
    }) + "\n\n" + body

# ── 12. 索引页 ───────────────────────────────────────────
def plain(nid): return FN[nid]

files["00-索引/图谱总览.md"] = fm({
    "node_type": "索引", "name": "图谱总览", "tags": ["索引"]}) + f"""

# 旅游业 × 导游服务专业 · 双图谱示例

这是一份把**产业侧能力图谱**（行业→子行业→岗位→能力项）与**教育侧知识体系**
（专业→课程→模块→任务→操作流程→操作步骤→技能规范/知识点/标准/案例）
通过映射层缝合成一张图的示例数据。

## 三层结构一览

```
产业侧                          映射层                     教育侧
{L(INDUSTRY['id'])}
  └ 子行业 ×{len(SUB_INDUSTRIES)}
      └ 岗位 ×{len(POSITIONS)}
          └ 能力项 ×{len(ABILITIES)}  ←── {len(MAPS)} 条映射边 ──→  技能规范 ×{len(SKS)} / 知识点 ×{len(KNP)}
                                                          标准 ×{len(STD)} / 案例 ×{len(CAS)}
                                                            ↑ 归属于
                                                          操作步骤 ×{len(STEPS)}
                                                          操作流程 ×{len(FLOWS)}
                                                          任务 ×{len(TASKS)}
                                                          模块 ×{len(MODULES)}
                                                          课程 ×{len(COURSES)}
                                                          {L(MAJOR['id'])}
```

## 入口

| 想看什么 | 从哪进 |
|---|---|
| **两侧到底怎么连的、为什么这么连** | **[[双图谱映射方案]]** |
| 产业侧全貌、边界与排除项 | {L(INDUSTRY['id'])} |
| 某个岗位要什么能力、课程覆盖多少 | [[POS-01 地接导游]] · [[POS-02 旅行社计调]] · [[POS-03 景区讲解员]] |
| 所有能力项与三级标准 | [[能力项字典]] |
| 教育侧课程体系与培养方案对照 | {L(MAJOR['id'])} |
| 所有知识点 | [[知识点字典]] |
| 两侧怎么连的、每条边什么依据 | [[映射总表]] |
| 课程体系差在哪 | [[缺口分析]] |
| 怎么用、怎么扩 | [[使用说明]] |

## 关键结论（由数据自动得出）

""" + table(["岗位", "能力项数", "课程已覆盖", "覆盖率", "结论"],
            [[L(p["id"]), len(pa_by_pos[p["id"]]),
              sum(1 for aid, _, _ in pa_by_pos[p["id"]] if abl_cov[aid]["status"] == "已覆盖"),
              f"{sum(1 for aid,_,_ in pa_by_pos[p['id']] if abl_cov[aid]['status']=='已覆盖')/len(pa_by_pos[p['id']]):.0%}",
              "本专业主干面向该岗位" if p["id"] in MAJOR["target_positions"] else "本专业不面向该岗位，覆盖率低属正常"]
             for p in POSITIONS])

files["00-索引/能力项字典.md"] = fm({
    "node_type": "索引", "name": "能力项字典", "tags": ["索引"]}) + """

# 能力项字典

去重后的全量能力项。表中「课程覆盖」由映射边自动推导，不手工维护。

""" + table(["ID", "能力项", "类型", "领域", "核心", "岗位数", "最高要求", "课程覆盖至", "覆盖状态", "映射边数"],
            [[a["id"], L(a["id"]), TYPE_CN[a["type"]], a["domain"], "★" if a["core"] else "",
              len(pa_by_abl[a["id"]]), abl_cov[a["id"]]["max_req"],
              "、".join(abl_cov[a["id"]]["levels"]) or "—",
              abl_cov[a["id"]]["status"], len(abl_cov[a["id"]]["maps"])] for a in ABILITIES]) + """

## 按领域分组
""" + "\n".join(f"- **{d}**：" + "、".join(L(a["id"]) for a in ABILITIES if a["domain"] == d)
                for d in sorted({a["domain"] for a in ABILITIES})) + """

## Dataview 查询（需安装 Dataview 插件）
""" + dv("""TABLE ability_type_cn AS 类型, domain AS 领域, position_count AS 岗位数,
      max_required_level AS 最高要求, coverage_status AS 覆盖状态
FROM #能力图谱/能力项
SORT domain ASC, id ASC""")

files["00-索引/知识点字典.md"] = fm({
    "node_type": "索引", "name": "知识点字典", "tags": ["索引"]}) + """

# 知识点与技能规范字典

""" + "## 技能规范\n" + table(["ID", "技能规范", "可观察能力要求", "所属课程", "服务能力项"],
                          [[n["id"], L(n["id"]), n["observable"], L(leaf_course(n["id"])),
                            "、".join(L(m["abl"]) for m in map_by_kg[n["id"]])] for n in SKS]) + """
## 知识点
""" + table(["ID", "知识点", "类型", "所属课程", "服务能力项"],
            [[n["id"], L(n["id"]), n["kp_type"], L(leaf_course(n["id"])),
              "、".join(L(m["abl"]) for m in map_by_kg[n["id"]])] for n in KNP]) + """
## 标准
""" + table(["ID", "标准", "类型", "来源依据", "服务能力项"],
            [[n["id"], L(n["id"]), n["std_type"], n["source"],
              "、".join(L(m["abl"]) for m in map_by_kg[n["id"]])] for n in STD]) + """
## 案例
""" + table(["ID", "案例", "类型", "服务能力项"],
            [[n["id"], L(n["id"]), n["case_type"],
              "、".join(L(m["abl"]) for m in map_by_kg[n["id"]])] for n in CAS])

files["00-索引/映射总表.md"] = fm({
    "node_type": "索引", "name": "映射总表", "tags": ["索引"]}) + f"""

# 映射总表

共 **{len(MAPS)}** 条映射边，其中 **{len(review_maps)}** 条置信度不足或涉及待确认能力项，已落盘为 `30-映射层/` 下的独立文件供人工复核。

## 关系类型约定

| 关系 | 含义 | 典型来源 |
|---|---|---|
| `covers` 直接支撑 | 知识侧节点的行为要求与能力项某级的观察点同构 | 技能规范 |
| `partially_covers` 部分支撑 | 知识侧节点是能力项的一个构成要素，单独不足以达成 | 知识点 |
| `prerequisite_of` 前置铺垫 | 不直接构成能力，但缺了它能力无法建立 | 概念类知识点 |
| `assesses` 提供达标判据 | 为能力的达标与否提供可援引的判据或检验情境 | 标准、案例 |

## 全部映射边

""" + table(["映射ID", "知识侧节点", "节点类型", "关系", "服务等级", "覆盖度", "锚定方式", "置信度", "能力项", "复核"],
            [[m["id"], L(m["kg"]), NODE_KIND[m["kg"]], REL_CN[m["rel"]], m["level"],
              f"{m['coverage']:.1f}", m["anchor"], f"{m['conf']:.2f}", L(m["abl"]),
              "待复核" if m["review"] == "pending" else "自动确认"] for m in MAPS]) + """
## 按锚定方式统计
""" + table(["锚定方式", "条数", "平均置信度"],
            [[k, sum(1 for m in MAPS if m["anchor"] == k),
              f"{sum(m['conf'] for m in MAPS if m['anchor']==k)/sum(1 for m in MAPS if m['anchor']==k):.2f}"]
             for k in sorted({m["anchor"] for m in MAPS})])

# 缺口分析
uncovered = [a for a in ABILITIES if abl_cov[a["id"]]["status"] == "未覆盖"]
levelgap = [a for a in ABILITIES if abl_cov[a["id"]]["status"] == "等级缺口"]
orphans = [n for n in (SKS + KNP + STD + CAS) if not map_by_kg[n["id"]]]
files["00-索引/缺口分析.md"] = fm({
    "node_type": "索引", "name": "缺口分析", "tags": ["索引"]}) + f"""

# 缺口分析

全部由映射边推导，无手工维护字段。三类缺口的处理动作不同。

## 一、内容缺口：岗位要、课程完全没教（{len(uncovered)} 条）

""" + table(["能力项", "领域", "要求岗位", "岗位要求等级", "处理建议"],
            [[L(a["id"]), a["domain"],
              "、".join(L(p) for p, _, _ in pa_by_abl[a["id"]]),
              abl_cov[a["id"]]["max_req"],
              "本专业不面向该岗位，可不补；若要拓宽面向需新增课程"] for a in uncovered]) + f"""
> [!note] 怎么读这张表
> 这 {len(uncovered)} 条全部集中在 [[POS-02 旅行社计调]] 这一岗位上（线路设计、资源采购、计调系统、短视频）。
> 这说明的不是课程体系有漏洞，而是 **{MAJOR['name']} 专业本就不面向计调岗位**。
> 如果学校希望本专业也能对口计调岗，需要新增「旅行社计调实务」「旅游产品设计与营销」等课程——
> 这正是双图谱能给出的、有依据的专业建设结论。

## 二、等级缺口：教了，但没教到岗位要求的高度（{len(levelgap)} 条）

""" + table(["能力项", "领域", "课程覆盖至", "岗位最高要求", "要求该等级的岗位", "支撑课程", "处理建议"],
            [[L(a["id"]), a["domain"], "、".join(abl_cov[a["id"]]["levels"]),
              abl_cov[a["id"]]["max_req"],
              "、".join(L(p) for p, _, lv in pa_by_abl[a["id"]] if lv == abl_cov[a["id"]]["max_req"]),
              "、".join(L(x) for x in abl_cov[a["id"]]["courses"]),
              "在现有课程中增设 L3 级综合任务，或由岗位实习环节承接"] for a in levelgap]) + f"""
> [!tip] 这是最有价值的一类缺口
> L3 的共同特征是「处理非常规情境、优化流程、指导他人」——这类要求很难在课堂任务里达成，
> 通常要靠**顶岗实习、真实项目、师带徒**承接。把这张表交给实习管理环节，就是实习任务书的依据。

## 三、知识孤儿：教了，但不服务于任何岗位能力（{len(orphans)} 条）

""" + (table(["节点", "类型", "所属课程", "处理建议"],
             [[L(n["id"]), NODE_KIND[n["id"]], L(leaf_course(n["id"])), "补映射或评估是否删除"] for n in orphans])
       if orphans else "本示例数据中无知识孤儿——每一条知识点、技能规范、标准、案例都至少服务于一条岗位能力。\n\n> [!success] 这是知识体系质量的一个硬指标\n> 真实数据里孤儿率通常在 10~20%，多为教材惯性保留的内容。孤儿率过高说明课程内容与岗位脱节；\n> 孤儿率为 0 也要警惕，可能是映射时为了好看硬凑。\n") + f"""

## 汇总

| 指标 | 数值 |
|---|---|
| 能力项总数 | {len(ABILITIES)} |
| 已覆盖 | {sum(1 for a in ABILITIES if abl_cov[a['id']]['status']=='已覆盖')} |
| 等级缺口 | {len(levelgap)} |
| 内容缺口 | {len(uncovered)} |
| 知识侧叶子节点总数 | {len(SKS)+len(KNP)+len(STD)+len(CAS)} |
| 知识孤儿 | {len(orphans)} |
| 映射边总数 | {len(MAPS)} |
| 待人工复核映射 | {len(review_maps)} |
"""

files["00-索引/使用说明.md"] = fm({
    "node_type": "索引", "name": "使用说明", "tags": ["索引"]}) + """

# 使用说明

## 一、怎么打开

用 Obsidian「打开文件夹作为仓库」，选中本文件夹即可。不装任何插件也能用；
装上 **Dataview** 后，索引页里的 dataview 代码块会变成可排序的动态表格。

## 二、目录约定

```
00-索引/        总览、字典、映射总表、缺口分析（全部由脚本生成，不手工改）
10-能力图谱/    产业侧：行业 / 子行业 / 岗位 / 能力项
20-知识图谱/    教育侧：专业 / 课程 / 模块 / 任务 / 操作流程 / 操作步骤 / 技能规范 / 知识点 / 标准 / 案例
30-映射层/      仅落盘「需人工复核」的映射边，每条一个文件，带复核清单
```

## 三、ID 命名空间

两侧 ID 前缀完全分离，避免合库冲突，也让标签树天然分层。

| 前缀 | 含义 | 侧 |
|---|---|---|
| `IND` `SUB` `POS` `ABL` | 行业 / 子行业 / 岗位 / 能力项 | 产业侧 |
| `MAJ` `CRS` `MOD` `TSK` `FLW` `STP` | 专业 / 课程 / 模块 / 任务 / 操作流程 / 操作步骤 | 教育侧 |
| `SKS` `KNP` `STD` `CAS` | 技能规范 / 知识点 / 标准 / 案例 | 教育侧叶子 |
| `MAP` | 映射边 | 映射层 |

文件名统一为 `ID 名称.md`。ID 在前，保证同名节点不冲突、排序稳定；名称在后，保证双链可读。

完整的设计取舍见 [[双图谱映射方案]]。

## 四、映射边的四个字段，为什么是这四个

| 字段 | 解决什么问题 |
|---|---|
| `relation` | 区分「这条知识就是这个能力」和「这条知识只是能力的一块拼图」，避免覆盖度虚高 |
| `serves_level` | 回答「教到什么程度」。同一个知识点服务 L1 还是 L3，决定任务设计的复杂度 |
| `anchor` | 记录这条边是怎么连上的。观测点锚定的边可复算，人工指定的边必须留人 |
| `confidence` | 决定这条边是自动入库还是进人工队列 |

## 五、图谱视图建议

打开 Obsidian 图谱视图，在「分组」里按 tag 上色，可以直接看出双图谱的缝合形态：

| 查询 | 建议颜色 | 看到什么 |
|---|---|---|
| `tag:#能力图谱` | 橙 | 产业侧整体 |
| `tag:#知识图谱` | 蓝 | 教育侧整体 |
| `tag:#能力图谱/能力项` | 深橙 | 缝合面的产业侧 |
| `tag:#知识图谱/知识点 OR tag:#知识图谱/技能规范` | 深蓝 | 缝合面的教育侧 |
| `tag:#覆盖/未覆盖` | 红 | 教学缺口，一眼可见 |
| `tag:#映射层/待复核` | 黄 | 待人工确认的边 |

本仓库已预置这套配色（`.obsidian/graph.json`），首次打开图谱视图即生效。

## 六、扩展到别的行业

1. 跑《四层能力图谱构建方案 V2》流水线，得到 `graph.json`（行业 / 子行业 / 岗位 / 能力项 + 三级描述 + 证据）
2. 跑《自动构建专业知识体系流程》，得到该专业的 `专业-课程-任务-流程-叶子` 结构
3. 跑映射生成（见方案文档「观测点锚定法」一节）产出映射边
4. 用同一套渲染脚本把三份 JSON 渲染成本仓库的目录结构

三步都是数据生产，渲染是纯机械转换——**换行业只换数据，不换结构**。
"""

# ── 13. 图谱视图配色 ─────────────────────────────────────
graph_cfg = {
    "collapse-filter": False, "search": "", "showTags": True, "showAttachments": False,
    "hideUnresolved": True, "showOrphans": True,
    "collapse-color-groups": False,
    "colorGroups": [
        {"query": "tag:#能力图谱/行业 OR tag:#能力图谱/子行业", "color": {"a": 1, "rgb": 14701138}},
        {"query": "tag:#能力图谱/岗位", "color": {"a": 1, "rgb": 15570212}},
        {"query": "tag:#能力图谱/能力项", "color": {"a": 1, "rgb": 15895379}},
        {"query": "tag:#知识图谱/专业 OR tag:#知识图谱/课程", "color": {"a": 1, "rgb": 2201331}},
        {"query": "tag:#知识图谱/模块 OR tag:#知识图谱/任务 OR tag:#知识图谱/操作流程 OR tag:#知识图谱/操作步骤", "color": {"a": 1, "rgb": 4304050}},
        {"query": "tag:#知识图谱/知识点 OR tag:#知识图谱/技能规范", "color": {"a": 1, "rgb": 6737151}},
        {"query": "tag:#知识图谱/标准 OR tag:#知识图谱/案例", "color": {"a": 1, "rgb": 9819076}},
        {"query": "tag:#映射层/待复核", "color": {"a": 1, "rgb": 16766720}},
        {"query": "tag:#覆盖/未覆盖", "color": {"a": 1, "rgb": 15277667}},
        {"query": "tag:#索引", "color": {"a": 1, "rgb": 8355711}},
    ],
    "collapse-display": False, "showArrow": True, "textFadeMultiplier": -0.5,
    "nodeSizeMultiplier": 1.1, "lineSizeMultiplier": 1,
    "collapse-forces": False, "centerStrength": 0.5, "repelStrength": 12,
    "linkStrength": 0.8, "linkDistance": 220, "scale": 0.5, "close": False,
}
app_cfg = {"attachmentFolderPath": "./", "alwaysUpdateLinks": True,
           "newLinkFormat": "shortest", "useMarkdownLinks": False}

# 方案文档（手写，随仓库分发）
_here = os.path.dirname(os.path.abspath(__file__))
files["00-索引/双图谱映射方案.md"] = open(os.path.join(_here, "doc_scheme.md"), encoding="utf-8").read()

# ── 落盘 ─────────────────────────────────────────────────
if os.path.exists(OUT):
    shutil.rmtree(OUT)
for path, content in files.items():
    full = os.path.join(OUT, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w", encoding="utf-8") as f:
        f.write(content)
os.makedirs(os.path.join(OUT, ".obsidian"), exist_ok=True)
with open(os.path.join(OUT, ".obsidian", "graph.json"), "w", encoding="utf-8") as f:
    json.dump(graph_cfg, f, ensure_ascii=False, indent=2)
with open(os.path.join(OUT, ".obsidian", "app.json"), "w", encoding="utf-8") as f:
    json.dump(app_cfg, f, ensure_ascii=False, indent=2)

print(f"生成文件 {len(files)} 个")
print(f"  能力侧 {1+len(SUB_INDUSTRIES)+len(POSITIONS)+len(ABILITIES)}")
print(f"  知识侧 {1+len(COURSES)+len(MODULES)+len(TASKS)+len(FLOWS)+len(STEPS)+len(SKS)+len(KNP)+len(STD)+len(CAS)}")
print(f"  映射层 {len(review_maps)} · 索引 6")
print(f"  映射边总数 {len(MAPS)}｜未覆盖 {len(uncovered)}｜等级缺口 {len(levelgap)}｜知识孤儿 {len(orphans)}")
