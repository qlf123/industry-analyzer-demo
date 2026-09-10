# -*- coding: utf-8 -*-
"""国家专业教学标准侧数据：能力测评 V2.0 的「专业」入口。

定位：把「系统先按国家专业教学标准摆出标准答案，用户只做减法与修正」这个范式
落成结构化数据。每个专业回答三件事：

1. 培养什么（goal / stage / years / source）
2. 面向哪些岗位（positions —— 专业教学标准「面向的职业岗位」→ 能力图谱 POS-xx）
3. 开哪些课（courses —— 专业教学标准「专业课程」→ 课程体系 CRS-xx；对不上的如实列入 coursesUnmapped）

positions 里每条都必须带 stdText（标准原文怎么写）与 match（exact / 近义 / 归并），
这是 Gate1「行业—专业配对」的显式结果，报告里要让用户能核对「标准写的是 X，我们对到了岗位 Y」。
coursesUnmapped 是标准点名要求、但课程体系尚无对应课程的，如实列出、不硬凑。
"""

MAJORS = [
    {
        "code": "740102",
        "name": "导游服务",
        "stage": "中职",
        "years": 3,
        "source": "中等职业学校导游服务专业教学标准（2022 年修订）",
        "goal": "培养面向旅行社、景区等旅游企业，具备地接导游、全陪领队等岗位核心能力，能胜任旅游团队接待、讲解服务、行程执行与突发情况处置的高素质技术技能人才。",
        "positions": [
            {"id": "POS-01", "stdText": "地陪导游", "match": "exact"},
            {"id": "POS-04", "stdText": "全陪导游、领队", "match": "exact"},
            {"id": "POS-03", "stdText": "景区讲解员", "match": "近义"},
        ],
        "courses": ["CRS-01", "CRS-02", "CRS-03", "CRS-07"],
        "coursesUnmapped": ["旅游政策与法规"],
    },
    {
        "code": "740101",
        "name": "旅游服务与管理",
        "stage": "中职",
        "years": 3,
        "source": "中等职业学校旅游服务与管理专业教学标准",
        "goal": "培养面向旅行社、在线旅游平台及景区，具备旅游产品操作、计调、客户服务与线上运营等岗位核心能力，能胜任线路操作、订单执行、产品策划与游客服务的高素质技术技能人才。",
        "positions": [
            {"id": "POS-01", "stdText": "地陪导游", "match": "exact"},
            {"id": "POS-02", "stdText": "旅行社计调", "match": "近义"},
            {"id": "POS-05", "stdText": "旅游产品策划", "match": "近义"},
            {"id": "POS-06", "stdText": "游客中心接待员", "match": "归并"},
        ],
        "courses": ["CRS-01", "CRS-02", "CRS-04", "CRS-06", "CRS-07"],
        "coursesUnmapped": ["旅游政策与法规", "旅游电子商务概论"],
    },
    {
        "code": "570302",
        "name": "研学旅行管理与服务",
        "stage": "高职",
        "years": 3,
        "source": "高等职业学校研学旅行管理与服务专业教学标准",
        "goal": "培养面向研学旅行组织机构、营地与教育场馆，具备研学课程设计、活动带领、学情适配与安全管理等岗位核心能力，能胜任研学指导师、定制旅行管家等岗位的高素质技术技能人才。",
        "positions": [
            {"id": "POS-08", "stdText": "研学旅行指导师", "match": "exact"},
            {"id": "POS-09", "stdText": "定制旅行管家", "match": "近义"},
            {"id": "POS-07", "stdText": "场馆讲解与教育推广", "match": "近义"},
        ],
        "courses": ["CRS-01", "CRS-03", "CRS-05", "CRS-07"],
        "coursesUnmapped": ["教育心理学基础"],
    },
]
