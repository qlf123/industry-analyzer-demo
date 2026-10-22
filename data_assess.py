# -*- coding: utf-8 -*-
"""「能力测评」（专业建设评估）专属数据：数据源位置、专业与知识体系的对应、实训数量标准、本校专业数据预填（职业面向、开设课程、实训资源；不含学时学分）。

由 build_assess.py 读取，产出 js/assess-data.js。
口径与字段说明见 docs/能力测评/数据需求.md；映射判定规则见 .claude/skills/ability-skill-mapping/SKILL.md。
"""

# ── 数据源 ──────────────────────────────────────────────────────────────
# 能力图谱：19 岗位 / 58 能力（含 L1–L3 行为描述）；映射数据中的能力全部来自这一版
GRAPH_FILE = 'raw-data/data_kmap-旅游行业19岗位-备份.py'
# 各专业知识体系导出（Excel）：平台专业 id → 文件
KNOWLEDGE_FILES = {
    'MAJOR-GUIDE': 'raw-data/knowledge_system_43338f8f-099c-4f72-9d63-cbb85e74d039.xlsx',
}
# 各专业映射（系统导出格式 JSON；导游为 2026-10-21 草稿，待人工审核）
MAPPING_FILES = {
    'MAJOR-GUIDE': 'docs/能力测评/导游专业-映射草稿.json',
}

# 各专业实训需求（字典 + 技能 → 实训条件，导游为 2026-10-21 推导草稿，待审核）
# 规则：.claude/skills/training-condition-derivation/SKILL.md；维护规则：docs/能力测评/实训条件-数据与维护规则.md
TRAINING_FILES = {
    'MAJOR-GUIDE': 'docs/能力测评/导游专业-实训条件草稿.json',
}
# 实训条件数量标准（来自标准原文；没有原文就留空——留空时页面不显示任何数量）
# (条件编号, 规定方式 'per_station' 每工位人数 / 'min_count' 最少数量, 数值, 出处, 原文摘录)
TRAINING_STANDARDS = []

# 平台专业（js/mock-data.js 的 MAJORS）→ 专业目录信息；层次用于判断适用的比例规则
MAJOR_CATALOG = {
    'MAJOR-GUIDE':    {'code': '540102', 'name': '导游', 'stage': '高职', 'years': 3},
    'MAJOR-TOURISM':  {'code': '540101', 'name': '旅游管理', 'stage': '高职', 'years': 3},
    'MAJOR-HOTEL':    {'code': '540106', 'name': '酒店管理与数字化运营', 'stage': '高职', 'years': 3},
    'MAJOR-TOUR-SVC': {'code': '740101', 'name': '旅游服务与管理', 'stage': '中职', 'years': 3},
}

# ── 本校专业数据（预填，页面「核对本校数据」可修改） ───────────────────────
# 只记录专业建设评估需要的内容：职业面向、开设了知识体系中的哪些专业课程、实训资源。
# 不记录学时、学分（专业建设评估不做到这一层）。
SCHOOL_PLANS = {
    'MAJOR-GUIDE': {
        'positions': ['POS-09', 'POS-10', 'POS-12', 'POS-06'],   # 职业面向：导游、旅游团队领队、景区讲解员、旅游计调
        # 未开设的专业课程（知识体系中的其余课程视为已开设）
        'not_opened': ['定制旅行管家服务', '研学旅游产品设计与实施'],
        # 实训资源：名称, 类型（校内 / 校外）, 具备的条件编号, 工位数（选填，None 表示未填）, 状态
        # 前三项沿用项目中已有的本校实训室数据（data_courselib.SCHOOL_LABS）
        'labs': [
            ('导游服务综合实训室', '校内', ['LAB-GUIDE', 'EQ-AID'], 40, '在用'),
            ('语言实训室', '校内', ['LAB-LANG'], None, '在用'),
            ('多媒体机房（兼讲解演练）', '校内', ['LAB-SPEAK', 'LAB-COMP'], None, '在用'),
            ('合作旅行社实训基地', '校外', ['BASE-AGENCY'], None, '在用'),
            ('合作景区实训基地', '校外', ['BASE-SCENIC'], None, '在用'),
        ],
    },
}

# 计入能力覆盖的映射类型（与映射 skill 的测评口径一致）
COUNTED_TYPES = ['直接支撑', '部分支撑']

# 测评只计入人工确认过的数据（映射、实训需求的状态为「已审核」或「已调整」）；待审核、驳回、失效一律不计入
CONFIRMED_STATUSES = ['已审核', '已调整']

# 演示用：以下专业的映射草稿、实训需求草稿尚未人工审核，演示环境中视为已确认（待审核 → 已审核），用来展示完整报告。
# 生产环境不设此项，以真实审核状态为准。（2026-10-21 经产品确认）
DEMO_TREAT_DRAFT_AS_CONFIRMED = ['MAJOR-GUIDE']
