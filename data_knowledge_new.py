# -*- coding: utf-8 -*-
"""教学侧知识体系（双图谱结构）· 新数据源

数据文件：data_in/知识体系信息-旅游业示例.json

这是按《双图谱结构说明.md》组织的教学侧知识体系，与旧的 data_knowledge.py /
data_courselib.py（课程 → 模块 → 任务 → 叶子）**并行存在，互不替代**。
旧数据继续驱动「能力测评」；本模块只负责把新 JSON 解析成完整层级，供后续页面
使用，不改动 course_lib / D.courseLib / 能力测评的任何计算与页面。

层级（level_type.level）：
    专业 → 课程分类 → 课程 → 任务 → [操作流程] → 技能规范 → 操作步骤 / 标准 / 案例
知识点（points）是技能规范的下挂内容，不是独立层级节点。

要点：
- 操作流程层可选：理论认知类课程的任务直连技能，技能下无操作步骤，属正常形态，不补空层。
- level_type 除「level」外，个别层带附加字段：课程的 course_type（理论认知类/岗位应用类/
  综合拓展类/实操技能类）、案例的「子类型」（正例/反例/应急或异常处理）。
- 各层 attributes 原样保留（技能的可观察能力要求/达成结果/操作对象/适用条件/
  工具材料设备条件/关键操作要求，标准的标准类型/标准内容/适用条件/标准编号及版本，
  案例的案例情景/判断结果/分析说明/处理原则，操作步骤的步骤内容/操作对象/关键控制点/达成结果）。
"""

import csv
import json
import os

_HERE = os.path.dirname(os.path.abspath(__file__))
_JSON_PATH = os.path.join(_HERE, 'data_in', '知识体系信息-旅游业示例.json')

# 层级顺序（自上而下）
LEVEL_ORDER = ['专业', '课程分类', '课程', '任务', '操作流程', '技能规范', '操作步骤', '标准', '案例']


def _load():
    with open(_JSON_PATH, encoding='utf-8') as f:
        return json.load(f)


TREE = _load()  # 4 个专业根节点，节点保留 JSON 原字段（id/name/describe/level_type/attributes/parent_id/position/points/children）


def _walk(node, by_id, by_level):
    by_id[node['id']] = node
    by_level[node['level_type']['level']].append(node)
    for c in sorted(node.get('children') or [], key=lambda x: x.get('position', 0)):
        _walk(c, by_id, by_level)


NODES_BY_ID = {}
_BY_LEVEL = {name: [] for name in LEVEL_ORDER}
for _root in TREE:
    _walk(_root, NODES_BY_ID, _BY_LEVEL)

# 按层展平的列表（节点对象引用，未复制）
MAJORS = _BY_LEVEL['专业']
COURSE_CATEGORIES = _BY_LEVEL['课程分类']
COURSES = _BY_LEVEL['课程']
TASKS = _BY_LEVEL['任务']
FLOWS = _BY_LEVEL['操作流程']
SKILLS = _BY_LEVEL['技能规范']
STEPS = _BY_LEVEL['操作步骤']
STANDARDS = _BY_LEVEL['标准']
CASES = _BY_LEVEL['案例']

# 知识点：技能规范的 points 字段，每条含 binding_id/point_id/id/name/description/position/updated_at/attributes/files
KNOWLEDGE_POINTS = [p for s in SKILLS for p in (s.get('points') or [])]


def level(node):
    """节点所属层级名（level_type.level）。"""
    return (node.get('level_type') or {}).get('level')


def course_type(node):
    """课程类型（level_type.course_type），只对课程节点有意义。"""
    return (node.get('level_type') or {}).get('course_type', '')


def subtype(node):
    """案例子类型：优先 level_type.子类型，缺失时回退 attributes 里的 type。"""
    st = (node.get('level_type') or {}).get('子类型')
    if st:
        return st
    return attr(node, 'type')


def attr(node, name):
    """取节点 attributes 里指定 name 的值；没有则返回空字符串。"""
    for a in node.get('attributes') or []:
        if a.get('name') == name:
            return a.get('value', '')
    return ''


def attrs(node):
    """节点 attributes 转成 {name: value} 字典（同名属性后者覆盖前者）。"""
    return {a['name']: a.get('value', '') for a in (node.get('attributes') or [])}


def parent_of(node):
    """节点的父节点（按 parent_id 解析）；根节点返回 None。"""
    return NODES_BY_ID.get(node.get('parent_id'))


def chain(node):
    """节点 → 专业的归属链（由内到外），返回节点列表 [本节点, 父, …, 专业]。"""
    out = []
    p = node
    while p:
        out.append(p)
        pid = p.get('parent_id')
        p = NODES_BY_ID.get(pid) if pid else None
    return out


# 映射待补清单列（最后四列留空，由数据侧填写）
_TODO_COLUMNS = ['专业', '课程', '课程类型', '任务', '操作流程',
                 '技能名', '技能UUID', '可观察能力要求', '达成结果',
                 '对应能力编号', '对应能力名称', '可达等级', '支撑强度']


def mapping_todo_rows():
    """映射待补清单：一行一条技能规范。

    前九列由本模块从新 JSON 解析填充；后四列（对应能力编号/对应能力名称/
    可达等级/支撑强度）留空，供数据侧填写。不按名称相似度推断任何能力。
    """
    rows = []
    for s in SKILLS:
        by = {level(n): n for n in chain(s)}
        course = by.get('课程')
        rows.append({
            '专业': by.get('专业', {}).get('name', ''),
            '课程': course.get('name', '') if course else '',
            '课程类型': course_type(course) if course else '',
            '任务': by.get('任务', {}).get('name', ''),
            '操作流程': by.get('操作流程', {}).get('name', ''),
            '技能名': s.get('name', ''),
            '技能UUID': s.get('id', ''),
            '可观察能力要求': attr(s, '可观察能力要求'),
            '达成结果': attr(s, '达成结果'),
            '对应能力编号': '',
            '对应能力名称': '',
            '可达等级': '',
            '支撑强度': '',
        })
    return rows


def write_mapping_todo(path):
    """把 mapping_todo_rows() 写成 CSV（UTF-8 BOM，Excel 可直接打开）。"""
    rows = mapping_todo_rows()
    with open(path, 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, fieldnames=_TODO_COLUMNS)
        w.writeheader()
        w.writerows(rows)
    return len(rows)
