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
