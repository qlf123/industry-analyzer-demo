import json
import math
import re
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor

ROOT = Path(__file__).resolve().parents[1]
HTML_OUT = ROOT / "output" / "旅游业行业能力测评报告.html"
DOCX_OUT = ROOT / "output" / "旅游业行业能力测评数据来源及判断标准.docx"
EXPLAIN_HTML_OUT = ROOT / "output" / "旅游业行业能力测评数据来源及判断标准.html"
HTML_OUT.parent.mkdir(parents=True, exist_ok=True)


def load_data():
    text = (ROOT / "panorama.html").read_text(encoding="utf-8")
    start = text.index("const D = ") + len("const D = ")
    end = text.index(";\nconst $", start)
    return json.loads(text[start:end])


D = load_data()
I = D["industry"]
S = D["stats"]
ABILITIES = D["abilities"]
POSITIONS = D["positions"]
SUBS = D["subIndustries"]
BY_A = {x["id"]: x for x in ABILITIES}
BY_P = {x["id"]: x for x in POSITIONS}
BY_S = {x["id"]: x for x in SUBS}

level_name = {"L1": "认知 / 辅助级", "L2": "独立操作级", "L3": "综合应用级"}
colors = ["#0f766e", "#14b8a6", "#38bdf8", "#f59e0b", "#f97316", "#8b5cf6", "#ef4444", "#64748b"]


def esc(v):
    return (str(v).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            .replace('"', "&quot;"))


def svg_bar(items, width=760, height=300, color="#0f766e", value_suffix=""):
    if not items:
        return ""
    maxv = max(v for _, v in items) or 1
    left, right, top, row = 200, 36, 26, 34
    h = max(height, top + row * len(items) + 20)
    out = [f'<svg viewBox="0 0 {width} {h}" role="img" aria-label="横向条形图">']
    for idx, (label, val) in enumerate(items):
        y = top + idx * row
        barw = (width - left - right) * val / maxv
        out.append(f'<text x="{left-10}" y="{y+17}" text-anchor="end" class="svg-label">{esc(label)}</text>')
        out.append(f'<rect x="{left}" y="{y+4}" width="{barw:.1f}" height="18" rx="9" fill="{color}" opacity=".88"/>')
        out.append(f'<text x="{left+barw+8:.1f}" y="{y+18}" class="svg-value">{val}{esc(value_suffix)}</text>')
    out.append("</svg>")
    return "".join(out)


def svg_donut(items, size=260):
    total = sum(v for _, v in items) or 1
    cx = cy = size / 2
    r, stroke = 74, 28
    start = -math.pi / 2
    out = [f'<svg viewBox="0 0 {size} {size}" role="img" aria-label="环形图">']
    for idx, (label, value) in enumerate(items):
        sweep = 2 * math.pi * value / total
        end = start + sweep
        large = 1 if sweep > math.pi else 0
        x1, y1 = cx + r * math.cos(start), cy + r * math.sin(start)
        x2, y2 = cx + r * math.cos(end), cy + r * math.sin(end)
        path = f"M {x1:.2f} {y1:.2f} A {r} {r} 0 {large} 1 {x2:.2f} {y2:.2f}"
        out.append(f'<path d="{path}" fill="none" stroke="{colors[idx % len(colors)]}" stroke-width="{stroke}"/>')
        start = end
    out.append(f'<text x="{cx}" y="{cy-2}" text-anchor="middle" class="donut-big">{total}</text>')
    out.append(f'<text x="{cx}" y="{cy+22}" text-anchor="middle" class="donut-small">岗位能力关系</text>')
    out.append("</svg>")
    return "".join(out)


def svg_radar(series, labels, size=360):
    cx = cy = size / 2
    radius = 116
    n = len(labels)
    points = []
    for i in range(n):
        a = -math.pi / 2 + i * 2 * math.pi / n
        points.append((cx + radius * math.cos(a), cy + radius * math.sin(a)))
    out = [f'<svg viewBox="0 0 {size} {size}" role="img" aria-label="岗位能力侧重雷达图">']
    for scale in (0.33, 0.66, 1):
        p = " ".join(f"{cx+(x-cx)*scale:.1f},{cy+(y-cy)*scale:.1f}" for x, y in points)
        out.append(f'<polygon points="{p}" fill="none" stroke="#d6e4e1" stroke-width="1"/>')
    for x, y in points:
        out.append(f'<line x1="{cx}" y1="{cy}" x2="{x:.1f}" y2="{y:.1f}" stroke="#d6e4e1"/>')
    for i, label in enumerate(labels):
        x, y = points[i]
        a = -math.pi / 2 + i * 2 * math.pi / n
        lx, ly = cx + (radius + 18) * math.cos(a), cy + (radius + 18) * math.sin(a)
        anchor = "middle" if abs(math.cos(a)) < .35 else ("start" if math.cos(a) > 0 else "end")
        out.append(f'<text x="{lx:.1f}" y="{ly:.1f}" text-anchor="{anchor}" class="radar-label">{esc(label)}</text>')
    for idx, (name, vals, color) in enumerate(series):
        p = []
        for i, val in enumerate(vals):
            x, y = points[i]
            p.append(f"{cx+(x-cx)*val/100:.1f},{cy+(y-cy)*val/100:.1f}")
        out.append(f'<polygon points="{" ".join(p)}" fill="{color}" fill-opacity=".16" stroke="{color}" stroke-width="2"/>')
    out.append("</svg>")
    return "".join(out)


def domain_counts():
    c = Counter()
    for a in ABILITIES:
        c[a["domain"]] += 1
    return c


def level_counts():
    c = Counter()
    for p in POSITIONS:
        for rel in p["abilities"]:
            c[rel["level"]] += 1
    return c


def cluster_abilities(position_ids):
    c = Counter()
    for pid in position_ids:
        for rel in BY_P[pid]["abilities"]:
            c[rel["ability"]] += 1
    return c


def build_report():
    domains = domain_counts()
    levels = level_counts()
    pos_items = sorted([(p["name"], len(p["abilities"])) for p in POSITIONS], key=lambda x: x[1], reverse=True)
    domain_items = sorted(domains.items(), key=lambda x: x[1], reverse=True)
    cluster_defs = [
        ("一线服务与讲解", ["POS-01", "POS-03", "POS-06", "POS-07"], "#0f766e"),
        ("业务运营与产品", ["POS-02", "POS-04", "POS-05", "POS-09"], "#f59e0b"),
        ("研学与定制服务", ["POS-08", "POS-09"], "#8b5cf6"),
    ]
    radar_labels = ["专业知识", "讲解表达", "服务沟通", "组织应急", "合规安全", "数字工具"]
    def radar_values(pids):
        keys = {
            "专业知识": ["资源与产品"], "讲解表达": ["讲解与表达"], "服务沟通": ["服务与沟通"],
            "组织应急": ["行程组织与调度", "安全与应急"], "合规安全": ["政策法规与合规", "安全与应急"],
            "数字工具": ["数字工具与新媒体"],
        }
        cc = Counter()
        for pid in pids:
            for rel in BY_P[pid]["abilities"]:
                cc[BY_A[rel["ability"]]["domain"]] += 1
        mx = max(cc.values() or [1])
        return [round(100 * sum(cc[k] for k in ks) / mx / max(1, len(pids)), 1) for ks in keys.values()]
    series = [(name, radar_values(pids), color) for name, pids, color in cluster_defs]
    core_names = [a["name"] for a in ABILITIES if a.get("core")]
    emerging = [a for a in ABILITIES if a.get("flag")]
    relation_total = sum(len(p["abilities"]) for p in POSITIONS)
    l1 = levels["L1"]
    l2 = levels["L2"]
    l3 = levels["L3"]
    html = f'''<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>旅游业行业能力测评报告</title>
<style>
@page {{ size:A4; margin:16mm 15mm; }}
:root {{ --ink:#16312f; --muted:#58706d; --line:#d9e8e4; --soft:#f2f8f6; --teal:#0f766e; --blue:#0ea5e9; --orange:#f59e0b; }}
* {{ box-sizing:border-box; }} body {{ margin:0; color:var(--ink); background:#e9f1ef; font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",Arial,sans-serif; line-height:1.6; }}
.page {{ width:210mm; margin:20px auto; background:white; padding:18mm 17mm; box-shadow:0 12px 40px #16312f18; break-after:page; }}
.cover {{ min-height:255mm; display:flex; flex-direction:column; justify-content:center; background:linear-gradient(145deg,#effaf7 0%,#fff 58%); }}
.eyebrow {{ color:var(--teal); font-weight:700; letter-spacing:.16em; font-size:12px; text-transform:uppercase; }}
h1 {{ font-size:34px; line-height:1.2; margin:18px 0 14px; letter-spacing:-.03em; }} h2 {{ font-size:24px; margin:0 0 16px; color:var(--teal); }} h3 {{ font-size:16px; margin:22px 0 8px; }} p {{ margin:8px 0 12px; }}
.subtitle {{ font-size:17px; color:var(--muted); max-width:650px; }} .meta {{ margin-top:30px; color:var(--muted); font-size:13px; }}
.hero-mark {{ width:130px; height:130px; border-radius:34px; background:linear-gradient(135deg,var(--teal),#36c7bc); color:white; display:grid; place-items:center; font-size:48px; font-weight:800; box-shadow:0 18px 36px #0f766e38; }}
.grid {{ display:grid; gap:14px; }} .kpis {{ grid-template-columns:repeat(4,1fr); margin:18px 0 22px; }} .kpi {{ padding:15px; background:var(--soft); border:1px solid var(--line); border-radius:14px; }} .kpi b {{ display:block; font-size:26px; color:var(--teal); line-height:1.1; }} .kpi span {{ color:var(--muted); font-size:12px; }}
.cols {{ grid-template-columns:1fr 1fr; }} .card {{ border:1px solid var(--line); border-radius:16px; padding:16px; background:#fff; }} .soft {{ background:var(--soft); }} .note {{ color:var(--muted); font-size:12px; }}
.chart {{ margin:10px 0; overflow:hidden; }} svg {{ width:100%; height:auto; display:block; }} .svg-label,.radar-label {{ fill:#45615d; font-size:12px; }} .svg-value {{ fill:#16312f; font-size:12px; font-weight:700; }} .donut-big {{ fill:var(--teal); font-size:30px; font-weight:800; }} .donut-small {{ fill:var(--muted); font-size:11px; }}
.legend {{ display:flex; gap:12px; flex-wrap:wrap; font-size:12px; color:var(--muted); }} .legend i {{ display:inline-block; width:10px; height:10px; border-radius:50%; margin-right:4px; }}
table {{ width:100%; border-collapse:collapse; font-size:12px; }} th,td {{ border-bottom:1px solid var(--line); padding:8px 7px; text-align:left; vertical-align:top; }} th {{ color:var(--teal); background:var(--soft); }}
.tag {{ display:inline-block; padding:2px 8px; border-radius:99px; background:#e7f5f2; color:var(--teal); font-size:11px; margin:2px 4px 2px 0; }} .warn {{ color:#a15c00; background:#fff5df; }} .blue {{ color:#0369a1; background:#e8f5ff; }}
.flow {{ display:flex; gap:8px; align-items:stretch; margin:18px 0; }} .flow > div {{ flex:1; padding:14px 10px; background:var(--soft); border-radius:12px; text-align:center; font-weight:700; color:var(--teal); }} .arrow {{ align-self:center; color:#9ab6b1; font-size:20px; }}
.footer {{ margin-top:28px; border-top:1px solid var(--line); padding-top:10px; color:var(--muted); font-size:11px; }}
@media print {{ body {{ background:white; }} .page {{ width:auto; margin:0; box-shadow:none; padding:0; }} .no-print {{ display:none; }} }}
</style></head><body>
<section class="page cover"><div class="hero-mark">旅</div><div class="eyebrow" style="margin-top:34px">Industry Capability Assessment</div>
<h1>旅游业行业能力测评报告</h1><div class="subtitle">基于四层行业能力图谱，识别旅游业岗位结构、能力分布、等级要求与新兴能力方向。</div>
<div class="meta">报告日期：{date.today().isoformat()}<br>数据版本：旅游业能力图谱 v{esc(I.get('version',''))} · 图谱构建时间 {esc(I.get('builtAt',''))}<br>报告性质：行业侧能力画像，不包含具体院校诊断</div>
<div class="footer">本报告以项目内嵌的已发布图谱示例为测评底稿；宏观供需与薪酬内容仅作为框架文档建议，不纳入本报告的量化结论。</div></section>

<section class="page"><div class="eyebrow">01 / 执行摘要</div><h2>先看结论</h2>
<p>旅游业的能力结构呈现“服务与讲解为底座、组织与合规为关键、数字工具为增量”的特征。图谱覆盖 3 个已建子行业、9 个代表岗位和 28 条能力项；岗位能力关系共 {relation_total} 条，能力要求以 L3 综合应用级为主，说明行业对复杂情境处理和跨环节协同的要求较高。</p>
<div class="grid kpis"><div class="kpi"><b>{S['subIndustriesBuilt']}</b><span>已建子行业</span></div><div class="kpi"><b>{S['positions']}</b><span>代表岗位</span></div><div class="kpi"><b>{S['abilities']}</b><span>能力项</span></div><div class="kpi"><b>{S['coreAbilities']}</b><span>核心能力</span></div></div>
<div class="grid cols"><div class="card soft"><h3>三条判断</h3><ol><li><b>能力共性强：</b>跨 3 个已建子行业的能力有 {S['crossSub']} 条，占能力项 {S['crossSub']/S['abilities']:.1%}。</li><li><b>复杂应用占比高：</b>L3 要求关系 {l3} 条，占全部岗位能力关系 {l3/relation_total:.1%}。</li><li><b>数字化是增量方向：</b>数字工具与新媒体领域已出现计调系统、短视频、在线产品和口碑运营等能力项，其中部分能力带有市场侧或推断标记。</li></ol></div><div class="card"><h3>使用边界</h3><p>本报告回答“行业岗位要求什么能力”，不回答“某所学校已经教会了什么”。若没有学校实际填报数据，报告不生成院校覆盖率或培养质量结论。</p><p class="note">能力测评2.0所需的课程、知识点、任务和实训条件映射不在本报告范围内。</p></div></div>
<div class="footer">核心数据：行业能力图谱字段 industry、subIndustries、positions、abilities、stats；详见配套说明文档。</div></section>

<section class="page"><div class="eyebrow">02 / 行业现状</div><h2>行业现状与能力结构</h2>
<div class="grid cols"><div class="card soft"><h3>现状一：行业边界以岗位体系划分</h3><p>当前图谱纳入旅行社组团服务、游览景区服务和研学与定制旅游 3 个已建子行业；在线旅游服务仍处于未纳入状态。住宿、航空铁路客运等岗位标准自成体系，不与旅游服务岗位混编。</p></div><div class="card"><h3>现状二：服务能力与复杂应用是主干</h3><p>28 条能力项中有 12 条被标记为核心能力；岗位能力关系中 L3 综合应用级要求占比较高，说明岗位不只需要“会做”，还需要现场判断、跨环节协同和异常处置。</p></div></div>
<div class="grid cols"><div class="card"><h3>现状三：岗位呈现三类能力侧重</h3><p>一线服务与讲解强调文化表达、服务沟通和安全应急；业务运营与产品强调资源整合、行程组织和合规；研学与定制服务增加教育设计、客户需求理解和个性化服务。</p></div><div class="card soft"><h3>现状四：数字化能力正在成为增量要求</h3><p>计调系统、短视频、在线产品运营和口碑修复已经出现在图谱能力项中。数字工具目前更多表现为跨岗位增量能力，而不是独立替代传统旅游专业力。</p></div></div>
<h3>四层能力图谱总览</h3>
<div class="flow"><div>行业<br><small>旅游业</small></div><div class="arrow">→</div><div>子行业<br><small>3 个已建</small></div><div class="arrow">→</div><div>岗位<br><small>9 个代表岗位</small></div><div class="arrow">→</div><div>能力项<br><small>28 条</small></div></div>
<div class="grid cols"><div class="card"><h3>岗位能力关系分布</h3><div class="chart">{svg_donut([(level_name[k], levels[k]) for k in ('L3','L2','L1')])}</div><div class="legend"><span><i style="background:#0f766e"></i>L3 {l3}</span><span><i style="background:#14b8a6"></i>L2 {l2}</span><span><i style="background:#38bdf8"></i>L1 {l1}</span></div></div><div class="card"><h3>岗位能力项数量</h3><div class="chart">{svg_bar(pos_items, height=360)}</div><p class="note">数量代表岗位关联的能力项条数，不等同于岗位价值或人才数量。</p></div></div>
<h3>子行业边界</h3><table><thead><tr><th>子行业</th><th>状态</th><th>岗位数</th><th>定位</th></tr></thead><tbody>{''.join(f'<tr><td>{esc(s["name"])}</td><td><span class="tag {"blue" if s["built"] else "warn"}">{"已建图" if s["built"] else "未纳入"}</span></td><td>{len(s["positionIds"])}</td><td>{esc(s.get("desc",""))}</td></tr>' for s in SUBS)}</tbody></table>
<div class="footer">未建子行业不参与能力统计；行业边界以图谱 industry.boundaryNotes 和 excluded 为准。</div></section>

<section class="page"><div class="eyebrow">03 / 行业趋势</div><h2>行业趋势与能力变化</h2>
<p>以下趋势来自行业能力图谱中的趋势字段，用于解释能力变化方向。趋势文本不是岗位硬性要求，也不替代来源证据；学校应把它们作为专业调整和能力观察的线索。</p>
<div class="grid cols">{''.join(f'<div class="card"><span class="tag">趋势 {i+1}</span><p>{esc(t)}</p></div>' for i,t in enumerate(I['trends']))}</div>
<div class="card soft" style="margin-top:16px"><h3>趋势对学校的直接含义</h3><ul><li>专业建设不能只围绕传统带团流程，还要覆盖产品设计、资源协调、合规和复杂情境处置。</li><li>新媒体、在线产品和 AI 工具应先作为能力增量观察，不宜在缺少岗位证据时简单改成独立专业方向。</li><li>研学、定制、适老化和无障碍等方向需要同时考虑服务能力、教育设计和安全管理。</li><li>趋势能力进入课程或实训方案前，应经过岗位证据、行业标准和学校资源条件的二次核验。</li></ul></div>
<div class="footer">趋势是方向性判断；正式建设决策应结合学校专业定位、师资条件和本地产业需求再次论证。</div></section>

<section class="page"><div class="eyebrow">04 / 岗位篇</div><h2>岗位群与能力侧重</h2>
<p>报告框架建议用三类岗位群观察能力差异。当前图谱没有单独建立“数字营销岗”子行业，因此将数字能力作为跨岗位增量能力观察，不把它虚构成独立岗位群。</p>
<div class="grid cols"><div class="card"><h3>岗位能力雷达</h3><div class="chart">{svg_radar(series, radar_labels)}</div><div class="legend"><span><i style="background:#0f766e"></i>一线服务与讲解</span><span><i style="background:#f59e0b"></i>业务运营与产品</span><span><i style="background:#8b5cf6"></i>研学与定制服务</span></div></div><div class="card"><h3>岗位观察</h3><ul><li><b>一线服务与讲解：</b>讲解表达、服务沟通、现场组织和安全应急是主干。</li><li><b>业务运营与产品：</b>资源与产品、行程组织、政策合规和数字工具共同构成岗位底座。</li><li><b>研学与定制服务：</b>在服务沟通之外，研学教育设计和客户需求理解成为差异化能力。</li></ul></div></div>
<h3>岗位—能力关系示例</h3><table><thead><tr><th>岗位</th><th>能力项</th><th>L3 要求</th><th>核心能力数</th><th>能力重点</th></tr></thead><tbody>{''.join(f'<tr><td>{esc(p["name"])}</td><td>{len(p["abilities"])}</td><td>{p["l3Count"]}</td><td>{p["coreAbilityCount"]}</td><td>{esc(", ".join(sorted(set(BY_A[r["ability"]]["domain"] for r in p["abilities"]))))}</td></tr>' for p in pos_items and POSITIONS)}</tbody></table>
<div class="footer">雷达图为能力领域侧重的归一化展示，用于比较结构，不作为岗位评分。</div></section>

<section class="page"><div class="eyebrow">05 / 能力篇</div><h2>AI 时代的能力重构</h2>
<p>框架文档提出“专业力、数字直播力、AI 协作力”三维模型。本报告将其作为解释框架，并用图谱中可核验的能力项进行映射；其中 AI 协作力尚未形成独立能力域，不能据此计算正式得分。</p>
<div class="grid cols"><div class="card soft"><h3>三维能力模型</h3><div style="display:grid;gap:10px;margin-top:14px"><div style="padding:18px;background:#dff5ef;border-radius:14px;text-align:center;font-weight:800;color:#0f766e">AI 协作力<br><small>工具应用 · 结果校验 · 批判性判断</small></div><div style="padding:18px;background:#e6f6ff;border-radius:14px;text-align:center;font-weight:800;color:#0369a1">数字表达力<br><small>短视频 · 在线产品 · 内容运营</small></div><div style="padding:18px;background:#fff3d9;border-radius:14px;text-align:center;font-weight:800;color:#a15c00">旅游专业力<br><small>资源知识 · 服务设计 · 安全合规</small></div></div></div><div class="card"><h3>图谱中的高优先级能力</h3><ol>{''.join(f'<li><b>{esc(a["name"])}</b><br><span class="note">{esc(a["domain"])} · {a["positionCount"]} 个岗位要求 · 最高 {a["maxRequiredLevel"]}</span></li>' for a in sorted(ABILITIES,key=lambda x:(not x.get("core"),-x.get("positionCount",0)))[:8])}</ol></div></div>
<h3>新兴或需谨慎使用的能力项</h3><table><thead><tr><th>能力项</th><th>图谱标记</th><th>使用建议</th></tr></thead><tbody>{''.join(f'<tr><td>{esc(a["name"])}</td><td><span class="tag warn">{esc(a.get("flag","市场侧 / 推断项"))}</span></td><td>可作为趋势线索，不能替代国家标准或岗位硬性要求。</td></tr>' for a in emerging)}</tbody></table>
<div class="footer">框架文档中的“学历、经验、薪酬”数字未在本次数据包中提供可核验原始表，因此没有写入本报告的量化结论。</div></section>

<section class="page"><div class="eyebrow">06 / 学校建议</div><h2>面向学校的专业建设建议</h2>
<div class="flow"><div>行业需求<br><small>趋势与边界</small></div><div class="arrow">→</div><div>岗位能力<br><small>等级与证据</small></div><div class="arrow">→</div><div>专业测评<br><small>覆盖与缺口</small></div><div class="arrow">→</div><div>建设决策<br><small>课程与实训另行接入</small></div></div>
<div class="grid cols"><div class="card"><h3>当前可直接使用</h3><ul><li>用岗位抽屉查看岗位职责、能力等级和权重。</li><li>用能力项抽屉追溯定义、三级行为描述、岗位要求和来源证据。</li><li>选择目标岗位后填写本校能力现状，生成覆盖与等级缺口。</li><li>优先关注核心能力、高等级要求和多岗位共需能力。</li></ul></div><div class="card"><h3>需要谨慎解读</h3><ul><li>图谱能力项数量不代表就业人数或市场规模。</li><li>岗位能力关系数量不等同于岗位薪酬或岗位价值。</li><li>新兴能力项可用于发现方向，但必须经过人工复核。</li><li>课程、知识点和实训条件建议需等待能力测评2.0的数据打通。</li></ul></div></div>
<h3>学校建设建议</h3><table><thead><tr><th>建设领域</th><th>图谱依据</th><th>建议动作</th></tr></thead><tbody><tr><td>专业定位</td><td>3 个已建子行业的岗位能力侧重不同</td><td>先明确专业主要服务的子行业和岗位群，再确定课程与实训投入；避免“所有旅游岗位都覆盖”的泛化定位。</td></tr><tr><td>课程体系</td><td>服务与讲解、组织应急、合规安全是多岗位共需能力</td><td>把核心能力拆成可观察的能力单元，保证基础模块覆盖；再根据学校定位增加研学、定制或数字化模块。</td></tr><tr><td>实训条件</td><td>L3 能力集中在现场讲解、组织调度、应急处置和合规判断</td><td>建设情境化、综合化的任务训练，覆盖接待计划变更、游客投诉、突发事件和多方协调，而不只做单项演示。</td></tr><tr><td>师资建设</td><td>数字工具与新媒体是增量能力，且部分能力带有市场侧标记</td><td>采用“专业教师 + 企业导师 + 数字工具培训”组合，教师能力提升同步围绕内容生产、平台运营和 AI 结果审核展开。</td><tr><td>评价机制</td><td>能力项提供 L1/L2/L3 行为描述和考核方式</td><td>把行为描述转化为学生任务、作品、情境演练和复盘记录，评价“能否完成任务”，不只评价知识记忆。</td></tr><tr><td>数据闭环</td><td>图谱会随岗位语料和行业趋势更新</td><td>建立“岗位变化—能力项—培养方案—学生表现”的年度复核机制，记录新增、降级和待确认能力。</td></tr></tbody></table>
<div class="footer">报告结束 · 详细数据来源及判断标准见配套说明文档。</div></section>
</body></html>'''
    html = html.replace("</td><tr><td>评价机制", "</td></tr><tr><td>评价机制")
    HTML_OUT.write_text(html, encoding="utf-8")


def shade(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), fill)
    tc_pr.append(shd)


def set_cell_text(cell, text, bold=False, color=None):
    cell.text = ""
    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(2)
    r = p.add_run(str(text))
    r.bold = bold
    r.font.name = "Hiragino Sans GB W3"
    r._element.rPr.rFonts.set(qn("w:eastAsia"), "Hiragino Sans GB W3")
    r.font.size = Pt(9.5)
    if color:
        r.font.color.rgb = RGBColor.from_string(color)
    cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER


def add_table(doc, headers, rows):
    table = doc.add_table(rows=1, cols=len(headers))
    table.style = "Table Grid"
    for i, h in enumerate(headers):
        set_cell_text(table.rows[0].cells[i], h, True, "FFFFFF")
        shade(table.rows[0].cells[i], "0F766E")
    for ri, row in enumerate(rows):
        cells = table.add_row().cells
        for i, value in enumerate(row):
            set_cell_text(cells[i], value)
            if ri % 2 == 1:
                shade(cells[i], "F2F8F6")
    doc.add_paragraph()
    return table


def build_explanation():
    doc = Document()
    section = doc.sections[0]
    section.top_margin = Inches(.65)
    section.bottom_margin = Inches(.65)
    section.left_margin = Inches(.75)
    section.right_margin = Inches(.75)
    styles = doc.styles
    styles["Normal"].font.name = "Hiragino Sans GB W3"
    styles["Normal"]._element.rPr.rFonts.set(qn("w:eastAsia"), "Hiragino Sans GB W3")
    styles["Normal"].font.size = Pt(10.5)
    for name, size in (("Title", 24), ("Heading 1", 17), ("Heading 2", 13)):
        styles[name].font.name = "Hiragino Sans GB W3"
        styles[name]._element.rPr.rFonts.set(qn("w:eastAsia"), "Hiragino Sans GB W3")
        styles[name].font.color.rgb = RGBColor(15, 118, 110)
        styles[name].font.size = Pt(size)
    title = doc.add_paragraph(style="Title")
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title.add_run("旅游业行业能力测评数据来源及判断标准")
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.add_run(f"配套说明文档  |  {date.today().isoformat()}").italic = True
    doc.add_heading("一 说明范围", level=1)
    doc.add_paragraph("本说明文档解释《旅游业行业能力测评报告》的数据来源、统计口径、判断规则和使用边界。报告的测评对象是旅游业行业侧能力结构，不是某所院校的教学质量评分。")
    doc.add_paragraph("报告框架来自《报告核心框架与数据可视化建议.docx》，能力统计来自项目入口 panorama.html 中内嵌的旅游业能力图谱数据。两类材料的用途不同：前者规定报告结构和可视化表达，后者提供可计算的行业能力事实。")
    doc.add_heading("二 数据来源", level=1)
    add_table(doc, ["来源", "用于报告的内容", "限制"], [
        ["报告核心框架与数据可视化建议.docx", "报告章节结构、岗位群观察角度、三维能力模型和图表建议", "其中学历、经验、薪酬等宏观数字未附原始数据，本报告不将其作为量化结论"],
        ["panorama.html 内嵌能力图谱数据", "行业、子行业、岗位、能力项、能力等级、权重、核心标识、证据等级和趋势", "当前是项目原型内嵌示例，正式上线应替换为正式发布版本"],
        ["四层能力图谱构建规则", "四层结构、L1/L2/L3 等级、证据分级、核心能力和前置关系的解释依据", "规则本身不是岗位数量或薪酬数据来源"],
    ])
    doc.add_heading("三 数据规模", level=1)
    add_table(doc, ["指标", "数值", "说明"], [
        ["子行业", f"{S['subIndustries']} 个（其中 {S['subIndustriesBuilt']} 个已建）", "未建子行业不参与能力统计"],
        ["代表岗位", f"{S['positions']} 个", "四层图谱第三层节点"],
        ["能力项", f"{S['abilities']} 条", "去重后的第四层能力节点"],
        ["岗位能力关系", f"{S['relations']} 条", "岗位对能力项提出要求的关系"],
        ["核心能力", f"{S['coreAbilities']} 条", "由图谱 core 字段标记"],
        ["跨子行业能力", f"{S['crossSub']} 条", "被全部已建子行业覆盖的能力"],
        ["来源证据", f"{S['evidenceTotal']} 条", "图谱 evidence 字段汇总"],
    ])
    doc.add_heading("四 判断标准", level=1)
    doc.add_heading("1 能力等级", level=2)
    doc.add_paragraph("L1 为认知或辅助级，L2 为独立操作级，L3 为综合应用级。岗位能力关系中的 required level 表示该岗位对该能力的最高要求等级。")
    add_table(doc, ["等级", "含义", "报告中的用途"], [["L1", "认知 / 辅助级", "识别基础知识和辅助任务要求"], ["L2", "独立操作级", "识别能够独立完成常规任务的要求"], ["L3", "综合应用级", "识别复杂情境、跨环节协同和综合判断要求"]])
    doc.add_heading("2 核心能力", level=2)
    doc.add_paragraph("本报告沿用图谱的 core 字段，不在报告运行时重新发明核心能力。图谱规则通常综合岗位覆盖面和国家级来源判断；报告只展示 core 标识、岗位数量和来源证据，不把核心能力解释为薪酬高低或岗位价值评分。")
    doc.add_heading("3 能力缺口", level=2)
    add_table(doc, ["状态", "判定", "解释"], [["未提供", "没有本校能力现状输入", "不推断为已覆盖或未覆盖"], ["内容缺口", "本校达成等级为 0", "目标岗位要求的能力尚未覆盖"], ["等级缺口", "本校达成等级大于 0 且低于岗位要求等级", "已有基础，但未达到目标等级"], ["已达标", "本校达成等级大于或等于岗位要求等级", "达到该岗位对该能力的要求"]])
    doc.add_heading("4 缺口优先级", level=2)
    doc.add_paragraph("优先级依次参考：核心能力、高等级要求、被多个岗位共同要求、前置关系和岗位专项。该排序用于帮助用户先核对重要能力，不代表系统已经生成课程、学时、设备或实训方案。")
    doc.add_heading("5 新兴能力和证据风险", level=2)
    doc.add_paragraph("带有市场侧来源、推断或无直接文献依据标记的能力项，属于趋势线索。它们可以进入观察清单，但不能替代国家标准、行业标准或正式岗位要求。产业趋势文本同样用于方向提示，不作为硬性能力判定依据。")
    doc.add_heading("五 图表与指标解释", level=1)
    add_table(doc, ["图表", "计算方式", "不能解释为"], [["岗位能力项数量", "统计岗位关联的能力项关系数", "岗位价值、就业人数或薪酬"], ["L1/L2/L3 环形图", "统计全部岗位能力关系中各要求等级的数量", "个人能力水平"], ["岗位能力雷达图", "按能力领域统计岗位关系后归一化展示", "岗位评分或人才排名"], ["核心能力列表", "按 core 标识、岗位覆盖面和最高要求等级排序", "唯一的培养优先级"]])
    doc.add_heading("六 使用边界", level=1)
    for text in [
        "本报告不包含某所院校的真实填报，因此不能得出“某校覆盖率”“培养质量”或“课程缺口”的结论。",
        "报告框架中提到的学历、经验、薪酬和企业招聘案例，需要补充独立的原始数据后才能进入正式量化报告。",
        "课程、知识点、任务、实训室和专业教学标准的自动诊断属于能力测评2.0，不属于本报告。",
        "正式交付时应将原型内嵌示例替换为有版本号、发布时间和证据链的正式发布图谱。",
    ]:
        doc.add_paragraph(text, style="List Bullet")
    doc.add_heading("七 数据版本记录", level=1)
    doc.add_paragraph(f"行业：{I['name']}；图谱版本：{I.get('version','未标注')}；构建时间：{I.get('builtAt','未标注')}；生成日期：{date.today().isoformat()}。")
    doc.save(DOCX_OUT)


def build_explanation_html():
    html = f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>旅游业行业能力测评数据来源及判断标准</title>
<style>
@page {{ size:A4; margin:16mm 15mm; }} :root {{--ink:#16312f;--muted:#58706d;--line:#d9e8e4;--soft:#f2f8f6;--teal:#0f766e;}}
*{{box-sizing:border-box}}body{{margin:0;background:#e9f1ef;color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",Arial,sans-serif;line-height:1.65}}
.page{{width:210mm;margin:20px auto;background:#fff;padding:17mm;box-shadow:0 12px 40px #16312f18}}h1{{font-size:30px;line-height:1.25;margin:0 0 8px;color:var(--teal)}}h2{{font-size:21px;color:var(--teal);margin:28px 0 10px;border-bottom:1px solid var(--line);padding-bottom:6px}}h3{{font-size:15px;margin:18px 0 6px}}p{{margin:7px 0 11px}}.meta,.note{{font-size:12px;color:var(--muted)}}table{{width:100%;border-collapse:collapse;margin:10px 0 18px;font-size:12px}}th,td{{border:1px solid var(--line);padding:8px;vertical-align:top;text-align:left}}th{{background:var(--teal);color:#fff}}tr:nth-child(even){{background:var(--soft)}}ul{{padding-left:22px}}.tag{{display:inline-block;padding:2px 8px;border-radius:99px;background:#e5f4f0;color:var(--teal);font-size:12px}}.footer{{border-top:1px solid var(--line);padding-top:10px;margin-top:28px;color:var(--muted);font-size:11px}}@media print{{body{{background:#fff}}.page{{width:auto;margin:0;box-shadow:none;padding:0}}}}
</style></head><body><main class="page"><div class="meta">配套说明文档 · {date.today().isoformat()}</div><h1>旅游业行业能力测评数据来源及判断标准</h1>
<p>本说明文档解释《旅游业行业能力测评报告》的数据来源、统计口径、判断规则和使用边界。报告测评的是旅游业行业侧能力结构，不是某所院校的教学质量评分。</p>
<h2>一 说明范围</h2><p>报告框架来自《报告核心框架与数据可视化建议.docx》，能力统计来自项目入口 <code>panorama.html</code> 中内嵌的旅游业能力图谱数据。前者规定报告结构与可视化表达，后者提供可计算的行业能力事实。</p>
<h2>二 数据来源</h2><table><tr><th>来源</th><th>用于报告的内容</th><th>限制</th></tr><tr><td>报告核心框架与数据可视化建议.docx</td><td>报告章节结构、岗位群观察角度、三维能力模型和图表建议</td><td>学历、经验、薪酬等宏观数字未附原始数据，不作为本次量化结论</td></tr><tr><td>panorama.html 内嵌能力图谱数据</td><td>行业、子行业、岗位、能力项、等级、权重、核心标识、证据等级和趋势</td><td>当前是项目原型内嵌示例，正式上线应替换为正式发布版本</td></tr><tr><td>四层能力图谱构建规则</td><td>行业→子行业→岗位→能力项结构，L1/L2/L3等级，证据分级与核心能力口径</td><td>规则不是岗位数量、薪酬或就业规模数据来源</td></tr></table>
<h2>三 数据规模</h2><table><tr><th>指标</th><th>数值</th><th>说明</th></tr><tr><td>子行业</td><td>{S['subIndustries']} 个，其中 {S['subIndustriesBuilt']} 个已建</td><td>未建子行业不参与能力统计</td></tr><tr><td>代表岗位</td><td>{S['positions']} 个</td><td>四层图谱第三层节点</td></tr><tr><td>能力项</td><td>{S['abilities']} 条</td><td>去重后的第四层能力节点</td></tr><tr><td>岗位能力关系</td><td>{S['relations']} 条</td><td>岗位对能力项提出要求的关系</td></tr><tr><td>核心能力</td><td>{S['coreAbilities']} 条</td><td>由图谱 core 字段标记</td></tr><tr><td>跨子行业能力</td><td>{S['crossSub']} 条</td><td>被全部已建子行业覆盖的能力</td></tr><tr><td>来源证据</td><td>{S['evidenceTotal']} 条</td><td>图谱 evidence 字段汇总</td></tr></table>
<h2>四 判断标准</h2><h3>1 能力等级</h3><p>L1 为认知或辅助级，L2 为独立操作级，L3 为综合应用级。岗位能力关系中的 required level 表示该岗位对该能力的最高要求等级。</p><table><tr><th>等级</th><th>含义</th><th>报告用途</th></tr><tr><td>L1</td><td>认知 / 辅助级</td><td>识别基础知识和辅助任务要求</td></tr><tr><td>L2</td><td>独立操作级</td><td>识别能够独立完成常规任务的要求</td></tr><tr><td>L3</td><td>综合应用级</td><td>识别复杂情境、跨环节协同和综合判断要求</td></tr></table>
<h3>2 核心能力</h3><p>报告沿用图谱的 core 字段，不在报告运行时重新发明核心能力。图谱规则综合岗位覆盖面和国家级来源判断；核心能力不等同于薪酬高低或岗位价值评分。</p>
<h3>3 能力缺口</h3><table><tr><th>状态</th><th>判定</th><th>解释</th></tr><tr><td>未提供</td><td>没有本校能力现状输入</td><td>不推断为已覆盖或未覆盖</td></tr><tr><td>内容缺口</td><td>本校达成等级为 0</td><td>目标岗位要求的能力尚未覆盖</td></tr><tr><td>等级缺口</td><td>达成等级大于 0 且低于岗位要求</td><td>已有基础，但未达到目标等级</td></tr><tr><td>已达标</td><td>达成等级大于或等于岗位要求</td><td>达到该岗位对该能力的要求</td></tr></table>
<h3>4 缺口优先级</h3><p>优先参考核心能力、高等级要求、被多个岗位共同要求、前置关系和岗位专项。该排序用于帮助用户先核对重要能力，不代表系统已经生成课程、学时、设备或实训方案。</p>
<h3>5 新兴能力和证据风险</h3><p>带有市场侧来源、推断或无直接文献依据标记的能力项，属于趋势线索。它们可以进入观察清单，但不能替代国家标准、行业标准或正式岗位要求。</p>
<h2>五 图表与指标解释</h2><table><tr><th>图表</th><th>计算方式</th><th>不能解释为</th></tr><tr><td>岗位能力项数量</td><td>统计岗位关联的能力项关系数</td><td>岗位价值、就业人数或薪酬</td></tr><tr><td>L1/L2/L3 环形图</td><td>统计全部岗位能力关系中各要求等级数量</td><td>个人能力水平</td></tr><tr><td>岗位能力雷达图</td><td>按能力领域统计岗位关系后归一化展示</td><td>岗位评分或人才排名</td></tr><tr><td>核心能力列表</td><td>按 core 标识、岗位覆盖面和最高要求等级排序</td><td>唯一的培养优先级</td></tr></table>
<h2>六 使用边界</h2><ul><li>本报告不包含某所院校的真实填报，因此不能得出某校覆盖率、培养质量或课程缺口结论。</li><li>学历、经验、薪酬和企业招聘案例，需要补充独立原始数据后才能进入正式量化报告。</li><li>课程、知识点、任务、实训室和专业教学标准的自动诊断属于能力测评2.0，不属于本报告。</li><li>正式交付时应将原型示例替换为有版本号、发布时间和证据链的正式发布图谱。</li></ul>
<h2>七 数据版本记录</h2><p>行业：{esc(I['name'])}；图谱版本：{esc(I.get('version','未标注'))}；构建时间：{esc(I.get('builtAt','未标注'))}；生成日期：{date.today().isoformat()}。</p><div class="footer">本说明文档与《旅游业行业能力测评报告》配套使用。</div></main></body></html>'''
    EXPLAIN_HTML_OUT.write_text(html, encoding="utf-8")


if __name__ == "__main__":
    build_report()
    build_explanation()
    build_explanation_html()
    print(HTML_OUT)
    print(DOCX_OUT)
    print(EXPLAIN_HTML_OUT)
