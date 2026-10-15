# -*- coding: utf-8 -*-
"""「行业图谱」页面：读取 data_kmap.py 的专属数据，产出树形图所需 JSON，注入 kmap_template.html。"""
import os, sys, json, re
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import data_kmap as K

LV = {"L1": 1, "L2": 2, "L3": 3}
TYPE_CN = {"knowledge": "知识", "skill": "技能", "literacy": "素养"}

subs = [{"id": i, "name": n} for i, n in K.SUB_INDUSTRIES]
positions = [{"id": i, "name": n, "sub": s, "aliases": al} for i, n, s, al in K.POSITIONS]
abilities = [{"id": i, "name": n, "type": t, "domain": d, "core": c} for i, n, t, d, c in K.ABILITIES]
skills = [{"id": i, "name": n} for i, n in K.SKILLS]
CHILD_KINDS = ("知识点", "操作步骤", "标准", "案例")
nodes = [{"id": i, "kind": k, "name": n} for i, k, n in K.SKILL_NODES]

# 新兴标记：data_kmap.py 里的 EMERGING_* id 集合，标到对应节点上，供页面显示「新兴」徽标
for s in subs: s["emerging"] = s["id"] in getattr(K, "EMERGING_SUBS", set())
for p in positions: p["emerging"] = p["id"] in getattr(K, "EMERGING_POSITIONS", set())
for a in abilities: a["emerging"] = a["id"] in getattr(K, "EMERGING_ABILITIES", set())
for k in skills: k["emerging"] = k["id"] in getattr(K, "EMERGING_SKILLS", set())

# 节点详情（NODE_DETAILS）合入各节点 detail 字段，供页面「详情」弹窗展示
ND = getattr(K, "NODE_DETAILS", {})
for s in subs: s["detail"] = ND.get(s["id"], {})
for p in positions: p["detail"] = ND.get(p["id"], {})
for a in abilities: a["detail"] = ND.get(a["id"], {})
industry_detail = ND.get(K.INDUSTRY["id"], {})

abl_by = {a["id"]: a for a in abilities}
pos_by = {p["id"]: p for p in positions}
sub_by = {s["id"]: s for s in subs}
skl_by = {s["id"]: s for s in skills}
node_by = {n["id"]: n for n in nodes}

by_pos, by_abl = defaultdict(list), defaultdict(list)
for p, a, w, lv in K.POSITION_ABILITY:
    assert p in pos_by, f"岗位不存在：{p}"
    assert a in abl_by, f"能力项不存在：{a}"
    assert lv in LV, f"要求等级只能是 L1/L2/L3：{p} {a} {lv}"
    by_pos[p].append({"ability": a, "weight": w, "level": lv})
    by_abl[a].append({"position": p, "weight": w, "level": lv})
for k in by_pos: by_pos[k].sort(key=lambda x: -x["weight"])
for k in by_abl: by_abl[k].sort(key=lambda x: -x["weight"])

for p in positions:
    assert p["sub"] in sub_by, f"岗位 {p['id']} 的子行业不存在：{p['sub']}"
orphan = [a["id"] for a in abilities if not by_abl[a["id"]]]
assert not orphan, f"未被任何岗位引用的能力项：{orphan}"
nopos = [p["id"] for p in positions if not by_pos[p["id"]]]
assert not nopos, f"没有任何能力要求的岗位：{nopos}"

for p in positions:
    rows = by_pos[p["id"]]
    p["abilities"] = rows
    p["abilityCount"] = len(rows)
    p["l3Count"] = sum(1 for r in rows if r["level"] == "L3")

for s in subs:
    ps = [p for p in positions if p["sub"] == s["id"]]
    s["positionIds"] = [p["id"] for p in ps]
    s["distinctAbilityCount"] = len({r["ability"] for p in ps for r in by_pos[p["id"]]})
    s["built"] = len(ps) > 0

for a in abilities:
    rows = by_abl[a["id"]]
    a["requiredBy"] = rows
    a["positionCount"] = len(rows)
    a["maxRequiredLevel"] = "L%d" % max(LV[r["level"]] for r in rows)
    a["typeCn"] = TYPE_CN[a["type"]]
    a["acrossSubIndustries"] = sorted({pos_by[r["position"]]["sub"] for r in rows})

abl_skills, skl_abls = defaultdict(list), defaultdict(list)
for a, k in K.ABILITY_SKILL:
    assert a in abl_by, f"能力项不存在：{a}"
    assert k in skl_by, f"技能不存在：{k}"
    assert k not in abl_skills[a], f"重复的能力项 → 技能：{a} {k}"
    abl_skills[a].append(k)
    skl_abls[k].append(a)
for a in abilities:
    a["skills"] = abl_skills[a["id"]]
for k in skills:
    k["abilityIds"] = skl_abls[k["id"]]
unused = [k["id"] for k in skills if not k["abilityIds"]]
assert not unused, f"未归属任何能力项的技能：{unused}"

for n in nodes:
    assert n["kind"] in CHILD_KINDS, f"下级节点类型只能是 {'/'.join(CHILD_KINDS)}：{n['id']} {n['kind']}"
skl_children = defaultdict(list)
for k, n in K.SKILL_CHILD:
    assert k in skl_by, f"技能不存在：{k}"
    assert n in node_by, f"下级节点不存在：{n}"
    assert n not in skl_children[k], f"重复的技能 → 下级节点：{k} {n}"
    skl_children[k].append(n)
for k in skills:   # 按「知识点 / 操作步骤 / 标准 / 案例」分组，组内保持数据顺序
    k["children"] = sorted(skl_children[k["id"]], key=lambda n: CHILD_KINDS.index(node_by[n]["kind"]))
used = {n for k in skills for n in k["children"]}
assert used == set(node_by), f"未归属任何技能的下级节点：{sorted(set(node_by) - used)}"

# 自检规则：只在 skill 里维护，构建时取 RULES 标记之间的内容带进页面
skill_path = os.path.join(HERE, ".claude", "skills", "kmap-ai-selfcheck", "SKILL.md")
skill_md = open(skill_path, encoding="utf-8").read()
m = re.search(r"<!-- RULES:START -->(.*?)<!-- RULES:END -->", skill_md, re.S)
assert m, f"{skill_path} 缺少 RULES:START / RULES:END 标记"
selfcheck_rules = m.group(1).strip()

DATA = {"industry": {**dict(K.INDUSTRY), "detail": industry_detail}, "subIndustries": subs,
        "positions": positions, "abilities": abilities, "skills": skills, "skillNodes": nodes,
        "emergingReasons": dict(getattr(K, "EMERGING_REASONS", {})),
        "selfCheckRules": selfcheck_rules}
payload = json.dumps(DATA, ensure_ascii=False, separators=(",", ":"))

# AI 预置配置：ai_config.json 存在则注入（部署时把 Key 写在这里），不存在则空配置（保持现状，需使用者自填）
AI_CFG_PATH = os.path.join(HERE, "ai_config.json")
ai_cfg = {}
if os.path.exists(AI_CFG_PATH):
    try:
        raw_cfg = json.load(open(AI_CFG_PATH, encoding="utf-8"))
        for k in ("type", "url", "model", "key"):
            if k in raw_cfg and isinstance(raw_cfg[k], str):
                ai_cfg[k] = raw_cfg[k]
    except Exception as e:
        print(f"警告：ai_config.json 解析失败，已按空配置处理（{e}）")
ai_cfg_json = json.dumps(ai_cfg, ensure_ascii=False, separators=(",", ":"))

tpl = open(os.path.join(HERE, "kmap_template.html"), encoding="utf-8").read()
assert "/*__DATA__*/" in tpl, "模板缺少数据占位符"
assert "/*__AI_CFG__*/" in tpl, "模板缺少 AI 配置占位符"
out_path = os.path.join(HERE, "kmap.html")
html = tpl.replace("/*__DATA__*/", payload).replace("/*__AI_CFG__*/", ai_cfg_json)
open(out_path, "w", encoding="utf-8").write(html)

print(f"子行业 {sum(1 for s in subs if s['built'])}（共 {len(subs)}）· 岗位 {len(positions)} · "
      f"能力项 {len(abilities)} · 能力要求 {len(K.POSITION_ABILITY)} · "
      f"技能 {len(skills)}（能力项 → 技能 {len(K.ABILITY_SKILL)}，无技能的能力项 {sum(1 for a in abilities if not a['skills'])}）· "
      f"下级节点 {len(nodes)}（技能 → 下级节点 {len(K.SKILL_CHILD)}）")
print(f"自检规则 {len(selfcheck_rules)} 字（来自 .claude/skills/kmap-ai-selfcheck/SKILL.md）")
print(f"输出 {out_path}（{len(payload)/1024:.0f} KB 数据）")
if ai_cfg.get("key"):
    print(f"AI 预置配置：已注入 {ai_cfg.get('type', '')} / {ai_cfg.get('model', '')}")
else:
    print("AI 预置配置：Key 为空（未提供 ai_config.json 或其中 key 为空），AI 功能需使用者自填 Key")
