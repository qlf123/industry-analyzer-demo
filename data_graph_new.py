# -*- coding: utf-8 -*-
"""双图谱 · 新并行数据源（能力图谱 + 能力—技能映射）

数据文件：
- data_in/能力图谱-旅游业.json   行业 / 子行业 / 岗位 / 能力，以及
  BELONGS_TO、REQUIRES_ABILITY（带 requiredLevel、weight）、PREREQUISITE_FOR 三种边
- data_in/映射数据-旅游业.json   能力—技能映射（按名称），带 mapping_type / service_level
- data_in/知识体系信息-旅游业示例.json  见 data_knowledge_new.py

与旧 data_ability.py / data_knowledge.py / data_courselib.py **并行存在，互不替代**；
本模块只负责把两份新 JSON 解析成完整结构并做名称连接，供后续页面使用，
不改动 course_lib / D.courseLib / 能力测评的任何计算与页面。

口径（已与用户确认）：
- 映射按名称连接技能与能力。重名技能「投诉接待与情绪疏导」按「双写」处理：
  两条同名技能都视为支撑同一条能力，各算一条支撑技能（过渡做法；正式修法
  是数据侧给映射补 UUID，不阻塞开发）。
- mapping_type 计入口径：「直接支撑」「部分支撑」计入达成；「基础支撑」不计入。
- 能力图谱里 inferred=true 的能力不纳入测评；flag 为「新兴能力」但
  inferred=false 的能力正常纳入。
- 无映射的能力如实显示为「未覆盖」，不做特殊处理。

各层原始属性原样保留：能力节点保留 core / domain / type / flag / levels /
evidences / inferred / definition / acrossSubIndustries / is_universal；
技能、标准、案例、课程等见 data_knowledge_new.py。
"""

import json
import os
from collections import defaultdict

import data_knowledge_new as K

_HERE = os.path.dirname(os.path.abspath(__file__))
_GRAPH_PATH = os.path.join(_HERE, 'data_in', '能力图谱-旅游业.json')
_MAPPING_PATH = os.path.join(_HERE, 'data_in', '映射数据-旅游业.json')


def _load(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


_GRAPH = _load(_GRAPH_PATH)['data']
_MAPPING = _load(_MAPPING_PATH)['data']

# ---------------------------------------------------------------------------
# 能力图谱：节点
# ---------------------------------------------------------------------------

NODES = _GRAPH['nodes']
EDGES = _GRAPH['edges']

NODES_BY_ID = {n['id']: n for n in NODES}

INDUSTRIES = [n for n in NODES if n['node_type'] == '行业']
SUB_INDUSTRIES = [n for n in NODES if n['node_type'] == '子行业']
POSITIONS = [n for n in NODES if n['node_type'] == '岗位']
ABILITIES = [n for n in NODES if n['node_type'] == '能力']

ABILITIES_BY_NAME = defaultdict(list)
for _a in ABILITIES:
    ABILITIES_BY_NAME[_a['name']].append(_a)

# 能力 ID -> 名称索引，便于按名取能力
ABILITIES_BY_ID = {n['id']: n for n in ABILITIES}

# ---------------------------------------------------------------------------
# 能力图谱：边
# ---------------------------------------------------------------------------

BELONGS_TO_EDGES = [e for e in EDGES if e['relation_type'] == 'BELONGS_TO']
REQUIRES_ABILITY_EDGES = [e for e in EDGES if e['relation_type'] == 'REQUIRES_ABILITY']
PREREQUISITE_FOR_EDGES = [e for e in EDGES if e['relation_type'] == 'PREREQUISITE_FOR']


def node_type(node):
    """节点的 node_type：行业 / 子行业 / 岗位 / 能力。"""
    return node.get('node_type')


def ability_info(ability):
    """能力节点的 info 字段原样返回（core/domain/type/flag/levels/evidences/inferred/definition）。"""
    return ability.get('info') or {}


def ability_levels(ability):
    """能力的分级要求：info.levels 是列表，每项 {level, assessMethod, behaviorDesc, observablePoints}。"""
    return ability_info(ability).get('levels') or []


def ability_level(ability, level_label):
    """取指定等级（L1/L2/L3）的条目；没有返回 None。"""
    for lv in ability_levels(ability):
        if lv.get('level') == level_label:
            return lv
    return None


def ability_is_inferred(ability):
    """能力是否 inferred=true（此类不纳入测评）。"""
    return bool(ability_info(ability).get('inferred'))


def ability_flag(ability):
    """能力的 flag 文案（可能为 None、「新兴能力：…」或「AI 推断项：…」）。"""
    return ability_info(ability).get('flag') or ''


# 归属 / 要求 / 前置 三类关系的解析

def sub_industries_of(industry):
    """行业 → 其子行业节点列表（BELONGS_TO：行业指向子行业）。"""
    out = []
    for e in BELONGS_TO_EDGES:
        if e['source_node_id'] == industry['id']:
            t = NODES_BY_ID.get(e['target_node_id'])
            if t is not None and t['node_type'] == '子行业':
                out.append(t)
    return out


def positions_of(sub_industry):
    """子行业 → 其岗位节点列表（BELONGS_TO：子行业指向岗位）。"""
    out = []
    for e in BELONGS_TO_EDGES:
        if e['source_node_id'] == sub_industry['id']:
            t = NODES_BY_ID.get(e['target_node_id'])
            if t is not None and t['node_type'] == '岗位':
                out.append(t)
    return out


def required_abilities(position):
    """岗位 → [(能力节点, info)]，按 REQUIRES_ABILITY 边（岗位指向能力，info 含 requiredLevel/weight）。"""
    out = []
    for e in REQUIRES_ABILITY_EDGES:
        if e['source_node_id'] == position['id']:
            t = NODES_BY_ID.get(e['target_node_id'])
            if t is not None and t['node_type'] == '能力':
                out.append((t, e.get('info') or {}))
    return out


def requiring_positions(ability):
    """能力 → 要求它的岗位节点列表。"""
    out = []
    for e in REQUIRES_ABILITY_EDGES:
        if e['target_node_id'] == ability['id']:
            s = NODES_BY_ID.get(e['source_node_id'])
            if s is not None and s['node_type'] == '岗位':
                out.append(s)
    return out


def prerequisites_of(ability):
    """能力 → 它的前置能力节点列表（PREREQUISITE_FOR：源是前置，目标是本能力）。"""
    out = []
    for e in PREREQUISITE_FOR_EDGES:
        if e['target_node_id'] == ability['id']:
            s = NODES_BY_ID.get(e['source_node_id'])
            if s is not None and s['node_type'] == '能力':
                out.append(s)
    return out


def dependents_of(ability):
    """能力 → 依赖它的能力节点列表（本能力是别人的前置）。"""
    out = []
    for e in PREREQUISITE_FOR_EDGES:
        if e['source_node_id'] == ability['id']:
            t = NODES_BY_ID.get(e['target_node_id'])
            if t is not None and t['node_type'] == '能力':
                out.append(t)
    return out


# ---------------------------------------------------------------------------
# 映射：按名称连接技能与能力
# ---------------------------------------------------------------------------

RAW_MAPPINGS = _MAPPING['items']  # 115 条

# 计入口径：只有这两种计入「达成」，基础支撑不计入
COUNTED_MAPPING_TYPES = {'直接支撑', '部分支撑'}


def _skills_named(name):
    """按名称找技能规范节点（可能同名多条）。"""
    return [s for s in K.SKILLS if s.get('name') == name]


def _abilities_named(name):
    """按名称找能力节点（本数据中名称唯一，返回列表以兼容同名）。"""
    return list(ABILITIES_BY_NAME.get(name, []))


def resolve_mappings():
    """把 115 条映射按名称连成「技能 ↔ 能力」边。

    返回 (resolved, unmatched_knowledge, unmatched_ability, dup_conflicts)：
    - resolved：去重后的映射边列表，每条 dict 含
        skill / ability / mapping_type / service_level / raw(原始条目)
      去重键为 (skill.id, ability.id)。
    - unmatched_knowledge / unmatched_ability：名称在知识侧 / 能力侧都未命中的原始条目。
    - dup_conflicts：同一 (skill, ability) 对在原始数据里出现了不同的
      mapping_type / service_level（本数据中应为空，仅作校验用）。
    """
    resolved = []
    seen = {}
    conflicts = []
    unmatched_knowledge = []
    unmatched_ability = []
    for it in RAW_MAPPINGS:
        skills = _skills_named(it['knowledge_node_name'])
        abilities = _abilities_named(it['ability_node_name'])
        if not skills:
            unmatched_knowledge.append(it)
        if not abilities:
            unmatched_ability.append(it)
        for s in skills:
            for a in abilities:
                key = (s['id'], a['id'])
                prior = seen.get(key)
                if prior is not None:
                    if (prior['mapping_type'] != it['mapping_type']
                            or prior['service_level'] != it['service_level']):
                        conflicts.append((key, prior, it))
                    continue
                rec = {
                    'skill': s,
                    'ability': a,
                    'mapping_type': it['mapping_type'],
                    'service_level': it['service_level'],
                    'raw': it,
                }
                seen[key] = rec
                resolved.append(rec)
    return resolved, unmatched_knowledge, unmatched_ability, conflicts


RESOLVED_MAPPINGS, UNMATCHED_KNOWLEDGE, UNMATCHED_ABILITY, _DUP_CONFLICTS = resolve_mappings()

# 能力 -> 支撑它的技能（计入口径：直接支撑/部分支撑）
SUPPORT_BY_ABILITY = defaultdict(list)
for _r in RESOLVED_MAPPINGS:
    if _r['mapping_type'] in COUNTED_MAPPING_TYPES:
        SUPPORT_BY_ABILITY[_r['ability']['id']].append(_r)

# 技能 -> 支撑的能力（计入口径）
SUPPORT_BY_SKILL = defaultdict(list)
for _r in RESOLVED_MAPPINGS:
    if _r['mapping_type'] in COUNTED_MAPPING_TYPES:
        SUPPORT_BY_SKILL[_r['skill']['id']].append(_r)


def support_skills(ability, counted_only=True):
    """能力 → 支撑它的技能列表（默认按计入口径：直接支撑/部分支撑）。

    返回 [{skill, ability, mapping_type, service_level, raw}]。
    """
    if counted_only:
        return list(SUPPORT_BY_ABILITY.get(ability['id'], []))
    return [r for r in RESOLVED_MAPPINGS if r['ability']['id'] == ability['id']]


def support_abilities(skill, counted_only=True):
    """技能 → 它支撑的能力列表（默认按计入口径）。"""
    if counted_only:
        return list(SUPPORT_BY_SKILL.get(skill['id'], []))
    return [r for r in RESOLVED_MAPPINGS if r['skill']['id'] == skill['id']]
