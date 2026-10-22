# -*- coding: utf-8 -*-
"""「能力测评」数据构建：能力图谱 + 各专业知识体系 + 映射 + 实训需求 + 本校专业数据预填 → js/assess-data.js

    python3 build_assess.py

只读数据、不含任何 API Key；页面 assess.html 读取生成的 js/assess-data.js（window.ASSESS_DATA）。
知识体系导出没有节点 ID，这里按「体系路径」生成稳定 ID（路径不变 ID 不变），见 docs/能力测评/数据需求.md 第 3 节。
"""
import os, sys, json, re, ast, hashlib, runpy
from collections import defaultdict, Counter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import data_assess as A

def P(rel): return os.path.join(HERE, rel)
def demo_status(mid, st):
    # 演示环境：草稿视为已确认（见 data_assess.DEMO_TREAT_DRAFT_AS_CONFIRMED）
    return '已审核' if mid in A.DEMO_TREAT_DRAFT_AS_CONFIRMED and st == '待审核' else st
def nid(prefix, path): return prefix + hashlib.sha1(path.encode('utf-8')).hexdigest()[:10]

# ── 能力图谱 ──
g = runpy.run_path(P(A.GRAPH_FILE))
nd = g.get('NODE_DETAILS', {})
def parse(v):
    if isinstance(v, str):
        try: return ast.literal_eval(v)
        except Exception: return v
    return v
graph = {
    'industry': {'id': g['INDUSTRY']['id'], 'name': g['INDUSTRY']['name'], 'version': g['INDUSTRY'].get('version', '')},
    'subs': [{'id': s[0], 'name': s[1]} for s in g['SUB_INDUSTRIES']],
    'positions': [{'id': p[0], 'name': p[1], 'sub': p[2], 'describe': nd.get(p[0], {}).get('describe', '')} for p in g['POSITIONS']],
    'abilities': [],
    'require': [{'pos': p, 'abl': a, 'level': lv} for p, a, w, lv in g['POSITION_ABILITY']],
}
for a in g['ABILITIES']:
    d = nd.get(a[0], {})
    levels = {x['level']: x.get('behaviorDesc', '') for x in (parse(d.get('levels')) or [])}
    assert set(levels) == {'L1', 'L2', 'L3'}, f'能力缺三级描述：{a[0]}'
    graph['abilities'].append({'id': a[0], 'name': a[1], 'type': a[2], 'domain': a[3] or '', 'core': bool(a[4]), 'levels': levels})
abl_by_id = {a['id']: a for a in graph['abilities']}
abl_by_name = {a['name']: a for a in graph['abilities']}
pos_ids = {p['id'] for p in graph['positions']}
for r in graph['require']:
    assert r['pos'] in pos_ids and r['abl'] in abl_by_id, r

# ── 知识体系（专业 → 课程 → 任务 → 技能规范） ──
def load_knowledge(path):
    import openpyxl
    wb = openpyxl.load_workbook(P(path), read_only=True)
    nodes, cur = {}, None
    for r in list(wb['节点属性数据'].iter_rows(values_only=True))[3:]:
        p, desc, info, an, av = (list(r) + [None] * 5)[:5]
        if p:
            cur = str(p).strip()
            kv = {}
            for part in re.split('[；;]', str(info or '')):
                if re.search('[:：]', part):
                    k, v = re.split('[:：]', part, 1); kv[k.strip()] = v.strip()
            nodes[cur] = {'level': kv.get('层级') or kv.get('类型') or kv.get('level'), 'ctype': kv.get('课程类型'), 'desc': desc, 'attrs': {}}
        if an and cur: nodes[cur]['attrs'][an] = av
    major_path = next(p for p, n in nodes.items() if n['level'] == '专业')
    courses = []
    for p, n in nodes.items():
        if n['level'] != '课程': continue
        seg = p.split('--')
        course = {'id': nid('C', p), 'name': seg[2], 'category': seg[1].replace('课程', ''), 'type': n['ctype'] or '', 'tasks': []}
        for tp, tn in nodes.items():
            if tn['level'] != '任务' or not tp.startswith(p + '--') or tp.count('--') != p.count('--') + 1: continue
            task = {'id': nid('T', tp), 'name': tp.split('--')[-1], 'skills': []}
            for sp, sn in nodes.items():
                if sn['level'] != '技能规范' or not sp.startswith(tp + '--') or sp.count('--') != tp.count('--') + 1: continue
                task['skills'].append({'id': nid('K', sp), 'path': sp, 'name': sp.split('--')[-1],
                                       'require': sn['attrs'].get('可观察能力要求', ''), 'result': sn['attrs'].get('达成结果', '')})
            course['tasks'].append(task)
        courses.append(course)
    return major_path, courses

knowledge, skill_by_path = {}, {}
for mid, f in A.KNOWLEDGE_FILES.items():
    mpath, courses = load_knowledge(f)
    knowledge[mid] = {'name': mpath, 'courses': courses}
    for c in courses:
        for t in c['tasks']:
            for s in t['skills']:
                skill_by_path[s['path']] = (mid, c['id'], s['id'])

# ── 映射 ──
mappings = {}
for mid, f in A.MAPPING_FILES.items():
    rows = json.load(open(P(f), encoding='utf-8'))
    out = []
    for r in rows:
        key = r.get('knowledge_node_path')
        assert key in skill_by_path, f'映射的技能在知识体系中找不到：{r.get("knowledge_node_name")}'
        ab = abl_by_id.get(r.get('ability_node_id')) or abl_by_name.get(r['ability_node_name'])
        assert ab, f'映射的能力在能力图谱中找不到：{r["ability_node_name"]}'
        assert r['mapping_type'] in ('直接支撑', '部分支撑', '前置支撑', '相关但不构成覆盖'), r['mapping_type']
        out.append({'id': r['id'], 'skill': skill_by_path[key][2], 'abl': ab['id'], 'type': r['mapping_type'],
                    'level': r.get('service_level'), 'status': demo_status(mid, r.get('status', '待审核')), 'source': r.get('source', 'auto'),
                    'basis': r.get('basis', '')})
    mappings[mid] = out

# ── 实训需求（字典 + 技能 → 实训条件） ──
training = {'dict': [], 'reqs': {}, 'standards': []}
for mid, f in A.TRAINING_FILES.items():
    t = json.load(open(P(f), encoding='utf-8'))
    if not training['dict']:
        training['dict'] = t['dictionary']
    ids = {d['id'] for d in training['dict']}
    out = []
    for r in t['requirements']:
        key = r['knowledge_node_path']
        assert key in skill_by_path, f'实训需求的技能在知识体系中找不到：{r["knowledge_node_name"]}'
        assert r['condition_id'] in ids, f'实训需求引用了字典外的条件：{r["condition_id"]}'
        assert r['level'] in ('必需', '建议'), r['level']
        out.append({'id': r['id'], 'target': 'skill', 'skill': skill_by_path[key][2], 'cond': r['condition_id'], 'level': r['level'],
                    'basis': r['basis'], 'source': r.get('source', 'auto'), 'status': demo_status(mid, r.get('status', '待审核'))})
    training['reqs'][mid] = out
dict_ids = {d['id'] for d in training['dict']}
for cid, how, val, src, quote in A.TRAINING_STANDARDS:
    assert cid in dict_ids and how in ('per_station', 'min_count') and src and quote, f'数量标准须有条件、方式、出处与原文：{cid}'
    training['standards'].append({'cond': cid, 'how': how, 'value': val, 'source': src, 'quote': quote})

# ── 本校专业数据预填：职业面向、开设了哪些专业课程、实训资源（不含学时学分） ──
plans = {}
for mid, plan in A.SCHOOL_PLANS.items():
    kcourses = knowledge.get(mid, {}).get('courses', [])
    names = {c['name'] for c in kcourses}
    miss = set(plan.get('not_opened', [])) - names
    assert not miss, f'未开设课程在知识体系中找不到：{miss}'
    courses = [{'name': c['name'], 'category': c['category'], 'kc': c['id'], 'opened': c['name'] not in plan.get('not_opened', [])}
               for c in kcourses]
    for p in plan['positions']: assert p in pos_ids, p
    plans[mid] = {'positions': plan['positions'], 'courses': courses,
                  'labs': [{'name': n, 'kind': k, 'conds': c, 'seats': st, 'status': ss} for n, k, c, st, ss in plan.get('labs', [])]}
    for l in plans[mid]['labs']:
        for c in l['conds']: assert c in dict_ids, f'本校实训资源引用了字典外的条件：{c}'

DATA = {
    'builtAt': __import__('datetime').date.today().isoformat(),
    'graph': graph,
    'catalog': A.MAJOR_CATALOG,
    'knowledge': knowledge,
    'mappings': mappings,
    'plans': plans,
    'countedTypes': A.COUNTED_TYPES,
    'confirmedStatuses': A.CONFIRMED_STATUSES,
    'training': training,
}
js = ('/* 由 build_assess.py 生成，勿手工修改。数据口径见 docs/能力测评/数据需求.md */\n'
      'window.ASSESS_DATA = ' + json.dumps(DATA, ensure_ascii=False, separators=(',', ':')) + ';\n')
open(P('js/assess-data.js'), 'w', encoding='utf-8').write(js)

for mid, k in knowledge.items():
    n_sk = sum(len(t['skills']) for c in k['courses'] for t in c['tasks'])
    ms = mappings.get(mid, [])
    print(f"{A.MAJOR_CATALOG[mid]['name']}：课程 {len(k['courses'])} · 技能 {n_sk} · 映射 {len(ms)}（{dict(Counter(m['status'] for m in ms))}）")
for mid, rs in training['reqs'].items():
    print(f"{A.MAJOR_CATALOG[mid]['name']} 实训需求 {len(rs)} 条（必需 {sum(1 for r in rs if r['level']=='必需')}）· 字典 {len(training['dict'])} 项 · 数量标准 {len(training['standards'])} 条 · 本校资源 {len(plans.get(mid, {}).get('labs', []))} 项")
if A.DEMO_TREAT_DRAFT_AS_CONFIRMED:
    print(f"注意：演示环境把 {A.DEMO_TREAT_DRAFT_AS_CONFIRMED} 的待审核草稿视为已确认")
print(f"能力图谱：岗位 {len(graph['positions'])} · 能力 {len(graph['abilities'])} · 岗位要求 {len(graph['require'])}")
print(f"输出 js/assess-data.js（{len(js)/1024:.0f} KB）")
