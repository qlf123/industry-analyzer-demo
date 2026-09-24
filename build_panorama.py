# -*- coding: utf-8 -*-
"""合并能力图谱示例数据 + 全景扩充数据，产出原型页面所需的 JSON，并注入 HTML 模板。"""
import os, sys, json, re
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from data_ability import (INDUSTRY, SUB_INDUSTRIES, POSITIONS, ABILITIES,
                          POSITION_ABILITY, PREREQUISITES)
import panorama_ext as X
import data_major_standard as MS

LV = {"L1": 1, "L2": 2, "L3": 3}
TYPE_CN = {"knowledge": "知识", "skill": "技能", "literacy": "素养"}

subs = [dict(s) for s in SUB_INDUSTRIES]
for s in subs:
    s["priority"] = X.SUB_PRIORITY_OVERRIDE.get(s["id"], s["priority"])
    s["typicalEmployers"] = s.pop("employers")

positions = [dict(p) for p in POSITIONS] + [dict(p) for p in X.NEW_POSITIONS]
abilities = [dict(a) for a in ABILITIES] + [dict(a) for a in X.NEW_ABILITIES]
pa = list(POSITION_ABILITY) + list(X.NEW_POSITION_ABILITY)
pre = list(PREREQUISITES) + list(X.NEW_PREREQUISITES)

abl_by = {a["id"]: a for a in abilities}
pos_by = {p["id"]: p for p in positions}
sub_by = {s["id"]: s for s in subs}

by_pos, by_abl = defaultdict(list), defaultdict(list)
for p, a, w, lv in pa:
    assert p in pos_by, p
    assert a in abl_by, a
    by_pos[p].append({"ability": a, "weight": w, "level": lv})
    by_abl[a].append({"position": p, "weight": w, "level": lv})
for k in by_pos: by_pos[k].sort(key=lambda x: -x["weight"])
for k in by_abl: by_abl[k].sort(key=lambda x: -x["weight"])

orphan = [a["id"] for a in abilities if not by_abl[a["id"]]]
assert not orphan, f"未被任何岗位引用的能力项：{orphan}"

# 派生字段
for p in positions:
    rows = by_pos[p["id"]]
    p["abilityCount"] = len(rows)
    p["l3Count"] = sum(1 for r in rows if r["level"] == "L3")
    p["abilities"] = rows

for s in subs:
    ps = [p for p in positions if p["sub"] == s["id"]]
    also = [p for p in positions if s["id"] in p.get("also_in", [])]
    s["positionIds"] = [p["id"] for p in ps]
    s["alsoPositionIds"] = [p["id"] for p in also]
    s["positionCount"] = len(ps)
    s["distinctAbilityCount"] = len({r["ability"] for p in ps for r in by_pos[p["id"]]})
    s["built"] = len(ps) > 0

for a in abilities:
    rows = by_abl[a["id"]]
    a["positionCount"] = len(rows)
    a["maxRequiredLevel"] = "L%d" % max(LV[r["level"]] for r in rows)
    a["requiredBy"] = rows
    a["typeCn"] = TYPE_CN[a["type"]]
    ss = sorted({pos_by[r["position"]]["sub"] for r in rows})
    a["acrossSubIndustries"] = ss
    a["crossSubIndustry"] = len(ss) > 1
    a["sourceLevels"] = sorted({e["sourceLevel"] for e in a["evidences"]})
    a["topSourceLevel"] = a["sourceLevels"][0] if a["sourceLevels"] else None
    # V2《归并规则 6》口径：被 2 个以上岗位要求 且 至少一条 L1_国家 来源。
    # 示例数据里手写的 core 一律以此为准覆盖，避免页面口径与方案不一致。
    a["coreAuthored"] = a["core"]
    a["core"] = len(rows) >= 2 and any(e["sourceLevel"] == "L1_国家" for e in a["evidences"])
    a["coreComputed"] = a["core"]

for p in positions:
    p["coreAbilityCount"] = sum(1 for r in p["abilities"] if abl_by[r["ability"]]["core"])

domains = []
for d in sorted({a["domain"] for a in abilities}):
    items = [a for a in abilities if a["domain"] == d]
    domains.append({
        "name": d, "count": len(items),
        "core": sum(1 for a in items if a["core"]),
        "byType": {t: sum(1 for a in items if a["type"] == t) for t in ("knowledge", "skill", "literacy")},
    })

src_dist = defaultdict(int)
for a in abilities:
    for e in a["evidences"]:
        src_dist[e["sourceLevel"]] += 1

stats = {
    "subIndustries": len(subs),
    "subIndustriesBuilt": sum(1 for s in subs if s["built"]),
    "positions": len(positions),
    "abilities": len(abilities),
    "relations": len(pa),
    "coreAbilities": sum(1 for a in abilities if a["core"]),
    "crossSub": sum(1 for a in abilities if a["crossSubIndustry"]),
    "domains": len(domains),
    "inferred": sum(1 for a in abilities if a["inferred"]),
    "flagged": sum(1 for a in abilities if a["flag"]),
    "evidenceTotal": sum(len(a["evidences"]) for a in abilities),
    "withL1": sum(1 for a in abilities if "L1_国家" in a["sourceLevels"]),
    "noEvidence": sum(1 for a in abilities if not a["evidences"]),
    "sourceDist": dict(src_dist),
    "inferredRate": round(sum(1 for a in abilities if a["inferred"]) / len(abilities), 3),
}

industry = dict(INDUSTRY)
industry["boundaryNotes"] = industry.pop("boundary_notes")
industry["boundaryQuestions"] = industry.pop("boundary_questions")
industry["gbClassification"] =["L7271 旅行社服务", "L7272 旅游管理服务", "N7851 公园管理", "R8830 文化场馆管理"]
industry["version"] = "v1.3"
industry["builtAt"] = "2026-09-09"
industry["pipeline"] = "四层能力图谱构建方案 V2 · 语料驱动抽取 + 人在环确认"

# ── 教育侧：从 Obsidian 示例数据取真实的双图谱映射，供「本校支撑情况」下钻 ──
import data_knowledge as K

REL_CN = {"covers": "直接支撑", "partially_covers": "部分支撑",
          "prerequisite_of": "前置铺垫", "assesses": "达标判据"}
_leaf, _kind = {}, {}
for rows, kind in [(K.SKILL_SPECS, "技能规范"), (K.KNOWLEDGE_POINTS, "知识点"),
                   (K.STANDARDS, "标准"), (K.CASES, "案例")]:
    for r in rows:
        _leaf[r[0]] = {"id": r[0], "name": r[1], "parent": r[2], "extra": r[3]}
        _kind[r[0]] = kind
_tsk = {t["id"]: t for t in K.TASKS}
_flw = {f["id"]: f for f in K.FLOWS}
_stp = {s["id"]: s for s in K.STEPS}
_mod = {m["id"]: m for m in K.MODULES}
_crs = {c["id"]: c for c in K.COURSES}

def _chain(leaf_id):
    """叶子 → 课程的归属链，返回 (课程名, 由外到内的链条文本)"""
    names, p = [], _leaf[leaf_id]["parent"]
    while p:
        if p in _stp:   names.append(_stp[p]["name"]); p = _stp[p]["flow"]
        elif p in _flw: names.append(_flw[p]["name"]); p = _flw[p]["task"]
        elif p in _tsk: names.append(_tsk[p]["name"]); p = _tsk[p]["module"]
        elif p in _mod: names.append(_mod[p]["name"]); p = _mod[p]["course"]
        elif p in _crs: names.append(_crs[p]["name"]); p = None
        else: p = None
    names.reverse()
    return (names[0] if names else None), " › ".join(names)

support = {}
for kg, ab, rel, lv, cov, anchor, conf, note in K.MAPPINGS:
    course, chain = _chain(kg)
    support.setdefault(ab, []).append({
        "id": kg, "name": _leaf[kg]["name"], "kind": _kind[kg],
        "rel": rel, "relCn": REL_CN[rel], "level": lv,
        "coverage": cov, "anchor": anchor, "conf": conf, "note": note,
        "course": course, "chain": chain,
    })
for ab in support:
    support[ab].sort(key=lambda e: (-LV[e["level"]], -e["conf"]))

# 已达成等级由映射推导：取 covers / partially_covers 中最高的 serves_level
_att = {}
for a in abilities:
    edges = [e for e in support.get(a["id"], []) if e["rel"] in ("covers", "partially_covers")]
    _att[a["id"]] = ("L%d" % max(LV[e["level"]] for e in edges)) if edges else 0
# 未覆盖能力项同样由映射推导，保证诊断结论与下钻证据一致
X.SCHOOL["uncovered_abilities"] = [a["id"] for a in abilities if _att[a["id"]] == 0]
X.SCHOOL["attained"] = _att
X.SCHOOL["support"] = support
X.SCHOOL["majorWithKg"] = {
    "code": K.MAJOR["code"], "name": K.MAJOR["name"], "stage": K.MAJOR["stage"],
    "courses": [{"id": c["id"], "name": c["name"], "type": c["type"],
                 "hours": c["hours"], "term": c["term"]} for c in K.COURSES],
    "leafCount": len(_leaf), "mappingCount": len(K.MAPPINGS),
    "taskCount": len(K.TASKS), "flowCount": len(K.FLOWS), "stepCount": len(K.STEPS),
}

# ── 课程体系：平台预置，学校勾选「本校已有哪些课程与知识点」即可推出达成情况 ──
import data_courselib as CL

_lib_leaf, _lib_kind = {}, {}
for r in CL.LIB_SKILL_SPECS:
    _lib_leaf[r[0]] = {"id": r[0], "name": r[1], "module": r[2], "req": r[3]}
    _lib_kind[r[0]] = "技能规范"
for r in CL.LIB_KNOWLEDGE_POINTS:
    _lib_leaf[r[0]] = {"id": r[0], "name": r[1], "module": r[2], "req": r[4]}
    _lib_kind[r[0]] = "知识点"
_lib_mod = {m["id"]: m for m in CL.LIB_MODULES}

# 课程 → 该课程下的知识节点
course_leaves = defaultdict(list)
for lid, leaf in _lib_leaf.items():
    cid = _lib_mod[leaf["module"]]["course"]
    course_leaves[cid].append({"id": lid, "name": leaf["name"], "kind": _lib_kind[lid],
                               "module": _lib_mod[leaf["module"]]["name"], "req": leaf["req"]})
for lid in _leaf:                                   # 本校已开的 3 门课
    c, chain = _chain(lid)
    cid = next((x["id"] for x in K.COURSES if x["name"] == c), None)
    if cid:
        course_leaves[cid].append({"id": lid, "name": _leaf[lid]["name"], "kind": _kind[lid],
                                   "module": chain.split(" › ")[1] if " › " in chain else "",
                                   "req": _leaf[lid]["extra"]})

# 课程 → 它能支撑的能力项（取该课程下所有映射边中最高的 serves_level）
ALL_MAPPINGS = list(K.MAPPINGS) + list(CL.LIB_MAPPINGS)
leaf_course = {}
for cid, rows in course_leaves.items():
    for r in rows:
        leaf_course[r["id"]] = cid

def _rank(e):
    # 先看是不是「支撑类」关系，再看服务等级——支撑类永远优先于达标判据/前置
    return (1 if e["rel"] in ("covers", "partially_covers") else 0, LV[e["level"]])

course_edges = defaultdict(list)      # 课程 → 全部映射边（保留到知识节点一级）
course_ab = defaultdict(dict)         # 课程 → 能力项 → 最优的一条边（用于展示计数）
for kg, ab, rel, lv, cov, anchor_, conf, note in ALL_MAPPINGS:
    cid = leaf_course.get(kg)
    if not cid or ab not in abl_by:
        continue
    edge = {"leaf": kg, "leafName": _lib_leaf[kg]["name"] if kg in _lib_leaf else _leaf[kg]["name"],
            "kind": _lib_kind.get(kg) or _kind.get(kg), "ability": ab,
            "rel": rel, "relCn": REL_CN[rel], "level": lv, "note": note}
    course_edges[cid].append(edge)
    cur = course_ab[cid].get(ab)
    if cur is None or _rank(edge) > _rank(cur):
        course_ab[cid][ab] = edge

lab_equip = {e for lab in CL.SCHOOL_LABS for e in lab["equip"]}
lab_by_equip = {e: lab["name"] for lab in CL.SCHOOL_LABS for e in lab["equip"]}

course_lib = []
for c in list(K.COURSES) + list(CL.LIB_COURSES):
    cid = c["id"]
    reqs = c.get("practiceReq") or CL.OFFERED_PRACTICE_REQ.get(cid, [])
    course_lib.append({
        "id": cid, "name": c["name"], "type": c["type"], "block": c.get("block", ""),
        "hours": c["hours"], "term": c["term"], "desc": c["desc"],

        "leaves": sorted(course_leaves.get(cid, []), key=lambda x: x["id"]),
        "leafCount": len(course_leaves.get(cid, [])),
        "abilities": [{"id": a, **e} for a, e in sorted(course_ab.get(cid, {}).items())],
        "edges": course_edges.get(cid, []),
        "practiceReq": [{**r, "have": r["equip"] in lab_equip,
                         "lab": lab_by_equip.get(r["equip"])} for r in reqs],
    })

# ── 专业教学标准：能力测评 V2.0 的「选专业」入口 ──
clib_by = {c["id"]: c for c in course_lib}
majors = []
for m in MS.MAJORS:
    mm = dict(m)
    mm["positions"] = [
        {"id": p["id"], "stdText": p["stdText"], "match": p["match"],
         "name": pos_by[p["id"]]["name"]}
        for p in m["positions"] if p["id"] in pos_by
    ]
    mm["courses"] = [
        {"id": cid, "name": clib_by[cid]["name"], "type": clib_by[cid]["type"],
         "block": clib_by[cid]["block"]}
        for cid in m["courses"] if cid in clib_by
    ]
    majors.append(mm)

# ── 全景图谱：融合双图谱的下钻树数据（教学层级 + 能力 + 映射边 + 对口表）──
# 只新增一个 DATA 键 kgraph，不动上面任何现有键，原「行业全景」tab 不受影响。
import data_pano_tree as PT

def _leaf_definition(kind, r):
    if kind == "技能规范": return r[3]
    if kind == "知识点": return r[4]
    if kind == "标准": return r[4]
    if kind == "案例": return r[4]
    return None

_kg_leaves = []
for rows, kind in [(K.SKILL_SPECS, "技能规范"), (K.KNOWLEDGE_POINTS, "知识点"),
                   (K.STANDARDS, "标准"), (K.CASES, "案例"),
                   (CL.LIB_SKILL_SPECS, "技能规范"), (CL.LIB_KNOWLEDGE_POINTS, "知识点")]:
    for r in rows:
        _kg_leaves.append({"id": r[0], "name": r[1], "kind": kind, "parent": r[2],
                           "definition": _leaf_definition(kind, r)})

_kg_mapping = []
for kg, ab, rel, lv, cov, anchor_, conf, note in ALL_MAPPINGS:
    if ab not in abl_by:
        continue
    _kg_mapping.append({"leaf": kg, "ability": ab, "rel": rel, "relCn": REL_CN[rel],
                        "level": lv, "coverage": cov, "anchor": anchor_, "conf": conf, "note": note})

kgraph = {
    "industry": {"id": industry["id"], "name": industry["name"]},
    "majors": [{
        "code": m["code"], "name": m["name"], "stage": m["stage"], "category": m.get("category", ""),
        "years": m.get("years"), "source": m.get("source"), "goal": m.get("goal"),
        "courses": m["courses"],
        "positions": [{"id": pid, "degree": PT.MAJOR_POSITION_DEGREE.get(m["code"], {}).get(pid, "不对口")}
                      for pid in PT.ALL_POSITIONS if pid in pos_by],
    } for m in MS.MAJORS],
    "courses": [{"id": c["id"], "name": c["name"], "type": c["type"], "block": c.get("block", ""),
                 "hours": c["hours"], "term": c["term"], "desc": c["desc"]}
                for c in list(K.COURSES) + list(CL.LIB_COURSES)],
    "modules": [{"id": m["id"], "name": m["name"], "course": m["course"], "kind": m["kind"]}
                for m in list(K.MODULES) + list(CL.LIB_MODULES)],
    "tasks": [{"id": t["id"], "name": t["name"], "module": t["module"], "result": t["result"]} for t in K.TASKS],
    "flows": [{"id": f["id"], "name": f["name"], "task": f["task"], "result": f["result"]} for f in K.FLOWS],
    "steps": [{"id": s["id"], "name": s["name"], "flow": s["flow"], "order": s["order"], "result": s["result"]} for s in K.STEPS],
    "leaves": _kg_leaves,
    "mapping": _kg_mapping,
    "sample": "专业—岗位对口表为示例数据 · 待人工确认",
}

# ── 能力测评2（新双图谱数据源：知识体系 + 能力图谱 + 映射）· 步骤 1–3，无报告 ──
# 只新增一个 DATA 键 assess3，不动上面任何现有键，原「能力测评」(assess2) 不受影响。
import data_knowledge_new as KN
import data_graph_new as GN

_A3_MAJOR_CODES = {"旅游管理（540101）", "导游（540102）"}

def _a3_first(text):
    return re.split(r"[。！？；\n]", text or "")[0].strip()

_a3_children = defaultdict(list)
for _n in KN.NODES_BY_ID.values():
    if _n.get("parent_id"):
        _a3_children[_n["parent_id"]].append(_n)

def _a3_skill(s):
    steps, stds, cases = [], [], []
    step_leaves, std_leaves, case_leaves = [], [], []
    for c in _a3_children.get(s["id"], []):
        lv = KN.level(c)
        if lv == "操作步骤":
            steps.append(c["name"]); step_leaves.append({"id": c["id"], "name": c["name"]})
        elif lv == "标准":
            stds.append(c["name"]); std_leaves.append({"id": c["id"], "name": c["name"], "content": KN.attr(c, "标准内容")})
        elif lv == "案例":
            cases.append(c["name"]); case_leaves.append({"id": c["id"], "name": c["name"], "content": KN.attr(c, "案例情景")})
    kp_leaves = [{"id": p["id"], "name": p["name"], "content": p.get("description") or ""}
                 for p in (s.get("points") or [])]
    by = {KN.level(n): n for n in KN.chain(s)}
    course = by.get("课程")
    major = by.get("专业")
    return {
        "id": s["id"], "name": s["name"],
        "obs": KN.attr(s, "可观察能力要求"),
        "result": KN.attr(s, "达成结果"),
        "kp": [p["name"] for p in (s.get("points") or [])],
        "steps": steps, "standards": stds, "cases": cases,
        # 下挂叶子（含 id 与内容说明），供详情抽屉点击下钻
        "leaves": {"kp": kp_leaves, "steps": step_leaves, "standards": std_leaves, "cases": case_leaves},
        # 归属链定位：专业 › 课程 › 任务（不显示操作流程层）
        "courseName": course["name"] if course else "",
        "taskName": by.get("任务", {}).get("name", ""),
        "majorName": major["name"].split("（")[0] if major else "",
        "courseId": course["id"] if course else "",
        "taskId": by.get("任务", {}).get("id", ""),
        "majorId": major["id"] if major else "",
    }

a3_majors, a3_major_skill_ids = [], {}
for m in KN.MAJORS:
    if m["name"] not in _A3_MAJOR_CODES:
        continue
    code = m["name"].split("（")[1].rstrip("）") if "（" in m["name"] else m["name"]
    name = m["name"].split("（")[0]
    skill_ids, categories = [], []
    for cat in [n for n in KN.COURSE_CATEGORIES if n.get("parent_id") == m["id"]]:
        courses = []
        for c in [n for n in KN.COURSES if n.get("parent_id") == cat["id"]]:
            tasks = []
            for t in [n for n in KN.TASKS if n.get("parent_id") == c["id"]]:
                sks = [_a3_skill(s) for s in KN.SKILLS if s.get("parent_id") == t["id"]]
                for f in [n for n in KN.FLOWS if n.get("parent_id") == t["id"]]:
                    sks += [_a3_skill(s) for s in KN.SKILLS if s.get("parent_id") == f["id"]]
                skill_ids += [x["id"] for x in sks]
                tasks.append({"id": t["id"], "name": t["name"], "skills": sks,
                              "courseName": c["name"], "majorName": name})
            courses.append({"id": c["id"], "name": c["name"], "category": cat["name"],
                            "courseType": KN.course_type(c), "majorName": name, "tasks": tasks})
        categories.append({"name": cat["name"], "courses": courses})
    a3_major_skill_ids[code] = skill_ids
    a3_majors.append({"code": code, "name": name, "nameFull": m["name"],
                      "describe": m.get("describe") or "", "categories": categories})

# 全量知识索引：覆盖所有专业（含未开放选择的两专业），供详情抽屉跨专业取数。
# 支撑技能可来自任一专业（②在哪教 里「需开设《课程名》」即跨专业技能），点开专业/课程/
# 任务/技能/知识点/标准/案例详情都要能取到数据，不能用只含已选专业的 a3_majors 建索引。
a3_skill_index, a3_course_index, a3_task_index, a3_major_index, a3_leaf_index = {}, {}, {}, {}, {}
for m in KN.MAJORS:
    major_id = m["id"]
    major_name = m["name"].split("（")[0]
    major_course_ids = []
    for cat in [n for n in KN.COURSE_CATEGORIES if n.get("parent_id") == major_id]:
        for c in [n for n in KN.COURSES if n.get("parent_id") == cat["id"]]:
            major_course_ids.append(c["id"])
            task_ids = []
            for t in [n for n in KN.TASKS if n.get("parent_id") == c["id"]]:
                skill_ids, flows = [], []
                for s in [n for n in KN.SKILLS if n.get("parent_id") == t["id"]]:
                    a3_skill_index[s["id"]] = _a3_skill(s)
                    skill_ids.append(s["id"])
                for f in [n for n in KN.FLOWS if n.get("parent_id") == t["id"]]:
                    f_ids = []
                    for s in [n for n in KN.SKILLS if n.get("parent_id") == f["id"]]:
                        a3_skill_index[s["id"]] = _a3_skill(s)
                        skill_ids.append(s["id"]); f_ids.append(s["id"])
                    flows.append({"id": f["id"], "name": f["name"], "skillIds": f_ids})
                a3_task_index[t["id"]] = {"id": t["id"], "name": t["name"],
                                          "courseName": c["name"], "majorName": major_name,
                                          "majorId": major_id, "courseId": c["id"],
                                          "result": t.get("describe") or "",
                                          "flows": flows, "skillIds": skill_ids}
                task_ids.append(t["id"])
            a3_course_index[c["id"]] = {"id": c["id"], "name": c["name"],
                                        "category": cat["name"], "courseType": KN.course_type(c),
                                        "majorName": major_name, "majorId": major_id,
                                        "taskIds": task_ids}
    a3_major_index[major_id] = {"id": major_id, "name": major_name, "nameFull": m["name"],
                                "industryName": (GN.INDUSTRIES[0]["name"] if GN.INDUSTRIES else "旅游业"),
                                "courseIds": major_course_ids}

# 叶子索引：知识点 / 标准 / 案例 → 详情（内容说明 + 归属技能），供详情抽屉点击下钻
for sid, sk in a3_skill_index.items():
    for kind, key in (("知识点", "kp"), ("标准", "standards"), ("案例", "cases")):
        for leaf in (sk.get("leaves") or {}).get(key, []):
            a3_leaf_index[leaf["id"]] = {"id": leaf["id"], "name": leaf["name"],
                                         "kind": kind, "content": leaf.get("content", ""),
                                         "skillId": sid, "skillName": sk["name"]}

a3_positions = []
for p in GN.POSITIONS:
    sub_name = ""
    for e in GN.BELONGS_TO_EDGES:
        if e["target_node_id"] == p["id"] and GN.NODES_BY_ID[e["source_node_id"]]["node_type"] == "子行业":
            sub_name = GN.NODES_BY_ID[e["source_node_id"]]["name"]
            break
    reqs = [{"id": a["id"], "requiredLevel": info.get("requiredLevel")}
            for a, info in GN.required_abilities(p) if not GN.ability_is_inferred(a)]
    a3_positions.append({"id": p["id"], "name": p["name"], "sub": sub_name,
                         "describe": p.get("describe") or "",
                         "abilityIds": [r["id"] for r in reqs], "abilityReqs": reqs})

# 能力清单（排除 inferred；原样保留领域/类型/核心/新兴标志）
a3_abilities = []
for a in GN.ABILITIES:
    if GN.ability_is_inferred(a):
        continue
    info = GN.ability_info(a)
    a3_abilities.append({
        "id": a["id"], "name": a["name"], "domain": info.get("domain", ""),
        "type": info.get("type", ""), "core": bool(info.get("core")),
        "flag": info.get("flag") or "", "definition": info.get("definition") or "",
        # L1–L3 的分级描述与考核方式：assess 供建议里的教学形式提示按 ASSESS_RULES 匹配，
        # desc/points 供能力详情抽屉展示
        "levels": {lv.get("level"): {
            "assess": lv.get("assessMethod") or "",
            "desc": lv.get("behaviorDesc") or "",
            "points": lv.get("observablePoints") or [],
        } for lv in GN.ability_levels(a) if lv.get("level")},
    })


def _a3_skill_loc(s):
    """技能 → (课程名, 任务名, 课程id, 任务id)，用于报告建议定位到任务级。"""
    by = {KN.level(n): n for n in KN.chain(s)}
    course = by.get("课程")
    return (course["name"] if course else "", by.get("任务", {}).get("name", ""),
            course["id"] if course else "", by.get("任务", {}).get("id", ""))


# 技能 → 支撑的能力（计入口径：直接支撑/部分支撑，含 service_level）
a3_skill_support = {}
# 能力 → 支撑它的技能（含课程/任务定位）
a3_ability_skills = defaultdict(list)
for r in GN.RESOLVED_MAPPINGS:
    if r["mapping_type"] not in GN.COUNTED_MAPPING_TYPES:
        continue
    if GN.ability_is_inferred(r["ability"]):
        continue
    sid, aid = r["skill"]["id"], r["ability"]["id"]
    sl = r["service_level"]
    a3_skill_support.setdefault(sid, []).append({"abilityId": aid, "serviceLevel": sl})
    cn, tn, cid, tid = _a3_skill_loc(r["skill"])
    a3_ability_skills[aid].append({
        "skillId": sid, "skillName": r["skill"]["name"], "serviceLevel": sl,
        "courseName": cn, "taskName": tn, "courseId": cid, "taskId": tid,
    })

# 能力前置依赖（PREREQUISITE_FOR：源=前置，目标=本能力；两端都不含 inferred）
a3_prerequisites = []
for e in GN.PREREQUISITE_FOR_EDGES:
    src = GN.NODES_BY_ID.get(e["source_node_id"])
    dst = GN.NODES_BY_ID.get(e["target_node_id"])
    if src is None or dst is None:
        continue
    if GN.ability_is_inferred(src) or GN.ability_is_inferred(dst):
        continue
    a3_prerequisites.append({"from": src["id"], "to": dst["id"],
                             "note": (e.get("info") or {}).get("note", "")})

assess3 = {
    "majors": a3_majors,
    "majorSkillIds": a3_major_skill_ids,
    "positions": a3_positions,
    "skillSupport": a3_skill_support,
    "abilities": a3_abilities,
    "abilitySkills": dict(a3_ability_skills),
    "prerequisites": a3_prerequisites,
    # 全量知识索引（详情抽屉取数，覆盖所有专业）
    "skillIndex": a3_skill_index,
    "courseIndex": a3_course_index,
    "taskIndex": a3_task_index,
    "majorIndex": a3_major_index,
    "leafIndex": a3_leaf_index,
    # 概况总览的「行业信息」一行：行业名 · 子行业数 / 岗位数 / 能力项数（按新能力图谱计）
    # 导出报告「行业现状与趋势」章：行业节点 info 里的 trends / included / excluded / boundaryNotes
    "meta": {
        "industryName": GN.INDUSTRIES[0]["name"] if GN.INDUSTRIES else "旅游业",
        "subIndustries": len(GN.SUB_INDUSTRIES),
        "positions": len(GN.POSITIONS),
        "abilities": len(GN.ABILITIES),
        "trends": (GN.INDUSTRIES[0].get("info") or {}).get("trends") or [],
        "included": (GN.INDUSTRIES[0].get("info") or {}).get("included") or [],
        "excluded": (GN.INDUSTRIES[0].get("info") or {}).get("excluded") or [],
        "boundaryNotes": (GN.INDUSTRIES[0].get("info") or {}).get("boundaryNotes") or "",
    },
}

# 平台侧实训条件字典：把 equip 键的含义集中定义（V2.0 第 4 层勾选用）
labDict = {}
for c in course_lib:
    for r in c.get("practiceReq", []):
        labDict.setdefault(r["equip"], {"name": r["item"], "spec": r["spec"],
                                        "source": r["source"]})

DATA = {
    "industry": industry,
    "subIndustries": subs,
    "positions": positions,
    "abilities": abilities,
    "domains": domains,
    "stats": stats,
    "prerequisites": [{"from": f, "to": t, "note": n} for f, t, n in pre],
    "school": X.SCHOOL,
    "courseLib": course_lib,
    "schoolLabs": CL.SCHOOL_LABS,
    "majors": majors,
    "kgraph": kgraph,
    "assess3": assess3,
    "labDict": labDict,
    "assessRules": MS.ASSESS_RULES,
    "buildDemo": X.BUILD_DEMO,
    "buildNodes": X.BUILD_NODES,
}

payload = json.dumps(DATA, ensure_ascii=False, separators=(",", ":"))

tpl_path = os.path.join(HERE, "panorama_template.html")
out_path = os.path.join(HERE, "panorama.html")
tpl = open(tpl_path, encoding="utf-8").read()
assert "/*__DATA__*/" in tpl, "模板缺少数据占位符"
open(out_path, "w", encoding="utf-8").write(tpl.replace("/*__DATA__*/", payload))

print(f"子行业 {stats['subIndustries']}（已建图 {stats['subIndustriesBuilt']}）· "
      f"岗位 {stats['positions']} · 能力项 {stats['abilities']} · 关系 {stats['relations']}")
print(f"领域 {stats['domains']} · 核心能力 {stats['coreAbilities']} · 跨子行业 {stats['crossSub']}")
print(f"证据 {stats['evidenceTotal']} 条 · 含国家级来源的能力项 {stats['withL1']} · 推断率 {stats['inferredRate']}")
print(f"来源分布 {stats['sourceDist']}")
print(f"映射边 {len(K.MAPPINGS)} 条 · 有支撑的能力项 {len(support)} · 无映射（教学缺口）{len(X.SCHOOL['uncovered_abilities'])}")
print(f"课程体系 {len(course_lib)} 门 · "
      f"知识节点 {sum(c['leafCount'] for c in course_lib)} · 映射边 {len(ALL_MAPPINGS)} · "
      f"课程可支撑能力项 {len({a['id'] for c in course_lib for a in c['abilities']})}")
print(f"专业教学标准 {len(majors)} 个专业 · 实训条件字典 {len(labDict)} 项 · 教学形式规则 {len(MS.ASSESS_RULES)} 条")
print(f"输出 {out_path}（{len(payload)/1024:.0f} KB 数据）")
