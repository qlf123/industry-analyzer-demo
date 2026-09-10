# -*- coding: utf-8 -*-
"""对生成的 vault 做一致性与链接完整性校验。"""
import os, re, sys, json
from collections import defaultdict

try:
    import yaml
except ImportError:
    os.system("pip install pyyaml --break-system-packages -q")
    import yaml

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from data_ability import ABILITIES, POSITION_ABILITY, POSITIONS, SUB_INDUSTRIES, PREREQUISITES
from data_knowledge import (MAPPINGS, SKILL_SPECS, KNOWLEDGE_POINTS, STANDARDS,
                            CASES, TASKS, FLOWS, STEPS, MODULES, COURSES)

VAULT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "vault", "旅游业双图谱示例")
BAD_WORDS = ["较好地", "基本掌握", "熟悉", "了解", "能够较好", "适当", "一定程度"]
issues = []

# 收集所有 md
notes, contents, fms = {}, {}, {}
for root, _, fs in os.walk(VAULT):
    if ".obsidian" in root: continue
    for f in fs:
        if not f.endswith(".md"): continue
        stem = f[:-3]
        p = os.path.join(root, f)
        if stem in notes: issues.append(f"[重名] 文件名重复：{stem}")
        notes[stem] = p
        txt = open(p, encoding="utf-8").read()
        contents[stem] = txt
        m = re.match(r"^---\n(.*?)\n---\n", txt, re.S)
        if not m:
            issues.append(f"[frontmatter] {stem} 缺少 YAML frontmatter")
            fms[stem] = {}
        else:
            try:
                fms[stem] = yaml.safe_load(m.group(1)) or {}
            except Exception as e:
                issues.append(f"[frontmatter] {stem} YAML 解析失败：{e}")
                fms[stem] = {}

print(f"共 {len(notes)} 个笔记文件")

# 1. 悬空 wikilink
link_re = re.compile(r"\[\[([^\]|#]+)")
total_links = 0
for stem, txt in contents.items():
    for target in link_re.findall(txt):
        total_links += 1
        t = target.strip()
        if t not in notes:
            issues.append(f"[悬空链接] {stem} → [[{t}]]")
print(f"共 {total_links} 个 wikilink")

# 2. 每条能力被岗位引用
refd = {a for _, a, _, _ in POSITION_ABILITY}
for a in ABILITIES:
    if a["id"] not in refd:
        issues.append(f"[孤立能力] {a['id']} 未被任何岗位引用")

# 3. 三级描述完整 + 无不可观测词
for a in ABILITIES:
    if sorted(a["levels"].keys()) != ["L1", "L2", "L3"]:
        issues.append(f"[三级] {a['id']} 等级不完整")
    for lv, d in a["levels"].items():
        for w in BAD_WORDS:
            if w in d["desc"]:
                issues.append(f"[不可观测] {a['id']} {lv} 使用了「{w}」：{d['desc'][:30]}")
        if not (2 <= len(d["points"]) <= 4):
            issues.append(f"[观察点] {a['id']} {lv} 观察点数量 {len(d['points'])} 不在 2~4")
        if not d["assess"]:
            issues.append(f"[考核] {a['id']} {lv} 缺考核方式")
    if not a["evidences"] and not a["inferred"]:
        issues.append(f"[证据] {a['id']} 无来源且未标 inferred")

# 4. 能力项数量、子行业数量、岗位能力数（沿用 V2 自检口径）
if not (20 <= len(ABILITIES) <= 45):
    issues.append(f"[规模] 能力项 {len(ABILITIES)} 超出 20~45")
if not (3 <= len(SUB_INDUSTRIES) <= 6):
    issues.append(f"[规模] 子行业 {len(SUB_INDUSTRIES)} 超出 3~6（示例数据刻意取 2，已知偏差）")
cnt = defaultdict(int)
for p, a, w, lv in POSITION_ABILITY: cnt[p] += 1
for p, c in cnt.items():
    if not (4 <= c <= 20):
        issues.append(f"[岗位能力数] {p} 为 {c}，超出 4~20")

# 5. 权重与等级取值合法
for p, a, w, lv in POSITION_ABILITY:
    if not (0 < w <= 1): issues.append(f"[权重] {p}-{a} weight={w}")
    if lv not in ("L1", "L2", "L3"): issues.append(f"[等级] {p}-{a} level={lv}")

# 6. 映射两端存在 + 双向一致
abl_ids = {a["id"] for a in ABILITIES}
leaf_ids = {r[0] for r in SKILL_SPECS} | {r[0] for r in KNOWLEDGE_POINTS} | \
           {r[0] for r in STANDARDS} | {r[0] for r in CASES}
fwd, back = defaultdict(set), defaultdict(set)
for kg, ab, rel, lv, cov, anchor, conf, note in MAPPINGS:
    if kg not in leaf_ids: issues.append(f"[映射] 知识侧节点不存在：{kg}")
    if ab not in abl_ids: issues.append(f"[映射] 能力项不存在：{ab}")
    if rel not in ("covers", "partially_covers", "prerequisite_of", "assesses"):
        issues.append(f"[映射] 非法关系类型：{rel}")
    if lv not in ("L1", "L2", "L3"): issues.append(f"[映射] 非法服务等级：{kg}→{ab} {lv}")
    if not (0 < cov <= 1): issues.append(f"[映射] 覆盖度越界：{kg}→{ab} {cov}")
    if not (0 < conf <= 1): issues.append(f"[映射] 置信度越界：{kg}→{ab} {conf}")
    if not note: issues.append(f"[映射] {kg}→{ab} 缺锚定依据")
    fwd[kg].add(ab); back[ab].add(kg)

# frontmatter 双向一致
def ids_from_links(v):
    return {x.strip("[]").split(" ")[0] for x in (v or [])}
for stem, d in fms.items():
    if d.get("node_type") == "能力项":
        want = back[d["id"]]
        got = ids_from_links(d.get("maps_to"))
        if want != got:
            issues.append(f"[双向] {d['id']} frontmatter maps_to 与映射表不一致：{want ^ got}")
    if d.get("node_type") in ("技能规范", "知识点", "标准", "案例"):
        want = fwd[d["id"]]
        got = ids_from_links(d.get("maps_to_abilities"))
        if want != got:
            issues.append(f"[双向] {d['id']} maps_to_abilities 不一致：{want ^ got}")

# 7. 层级归属存在
tsk_ids = {t["id"] for t in TASKS}; flw_ids = {f["id"] for f in FLOWS}
stp_ids = {s["id"] for s in STEPS}; mod_ids = {m["id"] for m in MODULES}
crs_ids = {c["id"] for c in COURSES}
valid_parent = tsk_ids | flw_ids | stp_ids
for r in SKILL_SPECS + KNOWLEDGE_POINTS + STANDARDS + CASES:
    if r[2] not in valid_parent:
        issues.append(f"[归属] 叶子 {r[0]} 的 parent {r[2]} 不存在")
for t in TASKS:
    if t["module"] not in mod_ids: issues.append(f"[归属] 任务 {t['id']} module 缺失")
for f in FLOWS:
    if f["task"] not in tsk_ids: issues.append(f"[归属] 流程 {f['id']} task 缺失")
for s in STEPS:
    if s["flow"] not in flw_ids: issues.append(f"[归属] 步骤 {s['id']} flow 缺失")
for m in MODULES:
    if m["course"] not in crs_ids: issues.append(f"[归属] 模块 {m['id']} course 缺失")

# 8. 前后置依赖两端存在且不成环（本例为浅依赖，做简单自反检查）
for f_, t_, n in PREREQUISITES:
    if f_ not in abl_ids or t_ not in abl_ids: issues.append(f"[前置] {f_}→{t_} 端点不存在")
    if f_ == t_: issues.append(f"[前置] 自反依赖 {f_}")
    if not n: issues.append(f"[前置] {f_}→{t_} 缺 note")

# 9. 缺口统计复算，与缺口分析页对拍
LV = {"L1": 1, "L2": 2, "L3": 3}
mb = defaultdict(list)
for kg, ab, rel, lv, cov, anchor, conf, note in MAPPINGS: mb[ab].append((rel, lv))
maxreq = defaultdict(lambda: "L1")
for p, a, w, lv in POSITION_ABILITY:
    if LV[lv] > LV[maxreq[a]]: maxreq[a] = lv
unc = lg = ok = 0
for a in ABILITIES:
    teach = [lv for rel, lv in mb[a["id"]] if rel in ("covers", "partially_covers")]
    if not teach: unc += 1
    elif LV[max(teach, key=lambda x: LV[x])] >= LV[maxreq[a["id"]]]: ok += 1
    else: lg += 1
page = contents.get("缺口分析", "")
for label, val in (("内容缺口", unc), ("等级缺口", lg)):
    if f"| {label} | {val} |" not in page:
        issues.append(f"[对拍] 缺口分析页的「{label}」与复算值 {val} 不一致")
orphan = [x for x in leaf_ids if x not in fwd]
if orphan: issues.append(f"[孤儿] 无映射的知识侧叶子：{orphan}")

print(f"复算：已覆盖 {ok}｜等级缺口 {lg}｜内容缺口 {unc}｜知识孤儿 {len(orphan)}")
print()
if issues:
    print(f"发现 {len(issues)} 项问题：")
    for i in issues: print("  -", i)
    sys.exit(1)
print("✅ 全部校验通过：无悬空链接、无孤立能力、三级描述完备且无不可观测表述、映射双向一致、层级归属完整、缺口统计与页面一致")
