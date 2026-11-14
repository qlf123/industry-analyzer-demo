import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Presentation, PresentationFile } from '@oai/artifact-tool';

const here = path.dirname(fileURLToPath(import.meta.url));
const workspaceDir = path.resolve(here, '../..');
const skillDir = '/Users/qinlifang/.codex/plugins/cache/openai-primary-runtime/presentations/26.1030.10813/skills/presentations';
const runtimePython = '/Users/qinlifang/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3';
const outputDir = path.join(workspaceDir, '.codex-output');
const stagingDir = path.join(workspaceDir, '.codex-finalizer');
const finalPath = path.join(outputDir, 'AIGC智慧课堂教学平台介绍-最终版.pptx');
const candidatePath = path.join(stagingDir, 'aigc-classroom-candidate.pptx');

async function writeBlob(out, blob) {
  await fs.writeFile(out, new Uint8Array(await blob.arrayBuffer()));
}

const C = {
  navy: '#102A43', ink: '#183B56', muted: '#557086', aqua: '#29C7C9',
  blue: '#3C7CDE', sky: '#EAF6FB', mint: '#E7F8F4', pale: '#F5F8FB',
  line: '#CFE0EA', white: '#FFFFFF', gold: '#F3C566', coral: '#EE846A',
};
const font = 'Noto Sans CJK SC';
const noLine = { style: 'solid', fill: 'none', width: 0 };
const solid = (fill, width = 1) => ({ style: 'solid', fill, width });

function box(slide, name, x, y, w, h, fill, line = noLine, radius = 'rounded-xl') {
  return slide.shapes.add({ geometry: 'roundRect', name, position: { left: x, top: y, width: w, height: h }, fill, line, borderRadius: radius });
}
function text(slide, name, value, x, y, w, h, size, color = C.ink, bold = false, align = 'left') {
  const s = slide.shapes.add({ geometry: 'textbox', name, position: { left: x, top: y, width: w, height: h }, fill: 'none', line: noLine });
  s.text = value;
  s.text.style = { fontFamily: font, fontSize: size, color, bold, alignment: align, verticalAlignment: 'middle', marginLeft: 0, marginRight: 0, marginTop: 0, marginBottom: 0 };
  return s;
}
function line(slide, name, x1, y1, x2, y2, color, width = 2) {
  return slide.shapes.add({ geometry: 'line', name, position: { left: Math.min(x1, x2), top: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) }, fill: 'none', line: solid(color, width) });
}
function accent(slide, x, y, w = 56) { box(slide, 'accent', x, y, w, 6, C.aqua, noLine, 'rounded-full'); }
function footer(slide, n) {
  text(slide, 'footer', `AIGC 智慧课堂教学平台  /  ${String(n).padStart(2, '0')}`, 72, 674, 440, 20, 11, '#7890A0', false);
  line(slide, 'footer-line', 72, 660, 1208, 660, '#DCE7EE', 1);
}

const p = Presentation.create({ slideSize: { width: 1280, height: 720 } });

// Slide 1
{
  const s = p.slides.add();
  s.background.fill = C.white;
  box(s, 'top-band', 0, 0, 1280, 18, C.navy, noLine, 'rounded-none');
  text(s, 'section', '产品概述', 72, 55, 160, 24, 16, C.aqua, true);
  text(s, 'title', 'AIGC 智慧课堂教学平台', 72, 93, 630, 58, 38, C.navy, true);
  accent(s, 72, 165, 64);
  text(s, 'sub', '以校本知识驱动的智能教学应用平台', 72, 184, 500, 34, 22, C.ink, true);
  text(s, 'intro', '面向职业院校的教学场景，把专业、课程与岗位任务沉淀为可调用的知识基础，并将 AIGC 融入备课、课堂组织、学习、评价与成长全过程。', 72, 240, 530, 108, 18, C.muted, false);

  text(s, 'label1', '解决的问题', 72, 383, 180, 24, 15, C.blue, true);
  text(s, 'problem', '传统方式中，资源查找、内容整理、课件制作和评价反馈分散在多个环节，教师重复性工作较多，教学资源质量依赖个人经验。', 72, 416, 500, 82, 16, C.ink, false);
  text(s, 'label2', '平台定位', 72, 530, 180, 24, 15, C.blue, true);
  text(s, 'position', '教师端、学生端、能力图谱与知识库、管理后台协同构成教学闭环。', 72, 562, 540, 56, 16, C.ink, false);

  box(s, 'diagram-field', 654, 64, 554, 552, C.pale, noLine, 'rounded-2xl');
  text(s, 'diagram-title', '从校本知识到教学闭环', 696, 96, 420, 32, 20, C.navy, true);
  text(s, 'diagram-desc', '能力图谱和知识库为 AIGC 提供可信的生成依据', 696, 133, 430, 24, 14, C.muted, false);
  line(s, 'h-line', 696, 170, 1162, 170, C.line, 1);
  // central editable diagram
  box(s, 'center', 816, 282, 230, 112, C.navy, noLine, 'rounded-2xl');
  text(s, 'center-small', '平台核心', 846, 304, 170, 20, 14, '#AEECEF', true, 'center');
  text(s, 'center-text', '校本知识驱动\n智能备课与教学', 838, 330, 186, 48, 21, C.white, true, 'center');
  const nodes = [
    { x: 704, y: 204, w: 180, h: 66, t: '课程建构', d: '匹配专业与岗位任务', c: C.aqua },
    { x: 1032, y: 204, w: 142, h: 66, t: '教学组织', d: '生成教学资源', c: C.blue },
    { x: 704, y: 434, w: 142, h: 66, t: '学习任务', d: '任务发布与提交', c: C.coral },
    { x: 1014, y: 434, w: 160, h: 66, t: '评价反馈', d: '记录学习与成长', c: C.gold },
  ];
  for (const [i, n] of nodes.entries()) {
    box(s, `node-${i}`, n.x, n.y, n.w, n.h, C.white, solid('#D7E5ED'), 'rounded-xl');
    box(s, `node-dot-${i}`, n.x + 14, n.y + 16, 8, 34, n.c, noLine, 'rounded-full');
    text(s, `node-title-${i}`, n.t, n.x + 34, n.y + 12, n.w - 46, 23, 16, C.navy, true);
    text(s, `node-desc-${i}`, n.d, n.x + 34, n.y + 38, n.w - 46, 18, 11, C.muted, false);
  }
  line(s, 'line-1', 884, 270, 850, 282, C.line, 2);
  line(s, 'line-2', 1032, 270, 1015, 282, C.line, 2);
  line(s, 'line-3', 846, 394, 814, 434, C.line, 2);
  line(s, 'line-4', 1018, 394, 1050, 434, C.line, 2);
  text(s, 'outcome', '教学过程数据沉淀至师生成长与院校教学管理', 704, 544, 470, 26, 15, C.navy, true, 'center');
  footer(s, 1);
}

// Slide 2
{
  const s = p.slides.add();
  s.background.fill = C.white;
  box(s, 'top-band', 0, 0, 1280, 18, C.navy, noLine, 'rounded-none');
  text(s, 'section', '角色价值与核心功能', 72, 55, 260, 24, 16, C.aqua, true);
  text(s, 'title', '让教学参与者各得其所', 72, 93, 620, 52, 36, C.navy, true);
  text(s, 'desc', '围绕教师、学生与院校教学管理者的日常工作，平台把资源、任务、评价和数据连接起来。', 72, 159, 720, 30, 17, C.muted, false);
  accent(s, 72, 212, 64);

  text(s, 'role-head', '服务对象与获得价值', 72, 246, 390, 28, 20, C.navy, true);
  const roles = [
    { y: 295, color: C.aqua, role: '教师', value: '减少备课与基础评价工作\n聚焦教学设计、课堂组织和针对性反馈' },
    { y: 405, color: C.blue, role: '学生', value: '明确学习任务与状态\n获得可追溯的反馈、学习记录和成长建议' },
    { y: 515, color: C.coral, role: '院校 / 教学管理者', value: '统一管理账号、课程与教学基础数据\n支撑日常教学组织与教学管理' },
  ];
  for (const [i, r] of roles.entries()) {
    box(s, `role-stem-${i}`, 72, r.y, 8, 82, r.color, noLine, 'rounded-full');
    text(s, `role-${i}`, r.role, 104, r.y + 6, 190, 28, 19, C.navy, true);
    text(s, `value-${i}`, r.value, 104, r.y + 38, 410, 48, 15, C.ink, false);
    if (i < 2) line(s, `role-line-${i}`, 104, r.y + 101, 514, r.y + 101, '#DFE9EF', 1);
  }

  box(s, 'func-area', 578, 230, 630, 394, C.pale, noLine, 'rounded-2xl');
  text(s, 'func-head', '核心功能', 620, 260, 170, 30, 22, C.navy, true);
  text(s, 'func-note', '以能力图谱和多维知识库连接教学全过程', 620, 298, 420, 24, 14, C.muted, false);
  const funcs = [
    { x: 620, y: 350, n: '01', t: '能力图谱', d: '组织专业与课程能力结构', c: C.aqua },
    { x: 906, y: 350, n: '02', t: '知识库', d: '沉淀文档、章节与知识关系', c: C.blue },
    { x: 620, y: 462, n: '03', t: '智能备课', d: '辅助资源筛选与内容生成', c: C.coral },
    { x: 906, y: 462, n: '04', t: '任务与评价', d: '发布、提交、评价与反馈', c: C.gold },
  ];
  for (const f of funcs) {
    box(s, `function-${f.n}`, f.x, f.y, 244, 82, C.white, solid('#D7E5ED'), 'rounded-xl');
    box(s, `number-${f.n}`, f.x + 16, f.y + 17, 38, 38, f.c, noLine, 'rounded-full');
    text(s, `number-t-${f.n}`, f.n, f.x + 16, f.y + 20, 38, 28, 13, C.navy, true, 'center');
    text(s, `function-t-${f.n}`, f.t, f.x + 70, f.y + 14, 150, 22, 16, C.navy, true);
    text(s, `function-d-${f.n}`, f.d, f.x + 70, f.y + 42, 156, 22, 12, C.muted, false);
  }
  text(s, 'data-value', '教学数据沉淀：支持学生成长跟踪与院校教学管理', 620, 576, 532, 26, 15, C.navy, true, 'center');
  footer(s, 2);
}

for (let i = 0; i < p.slides.items.length; i++) {
  const png = await p.export({ slide: p.slides.items[i], format: 'png', scale: 1.5 });
  await writeBlob(path.join(here, `slide-${i + 1}.png`), png);
}

await fs.mkdir(stagingDir, { recursive: true });
await fs.mkdir(outputDir, { recursive: true });
await (await PresentationFile.exportPptx(p)).save(candidatePath);
const { finalizePresentation } = await import(pathToFileURL(path.join(skillDir, 'container_tools/artifact_tool_utils.mjs')).href);
await finalizePresentation({
  explicitTotalSlideCount: 2,
  workspaceDir,
  candidatePath,
  finalPath,
  pythonExecutable: runtimePython,
  integrityValidatorPath: path.join(skillDir, 'container_tools/inspect_presentation_package_integrity.py'),
  layoutValidatorPath: path.join(skillDir, 'container_tools/inspect_presentation_layout_geometry.py'),
  layoutArgs: ['--expected-slide-size-emu', '12192000,6858000', '--validate-heading-fit'],
  verifyArtifactToolImport: true,
  receiptPath: path.join(stagingDir, 'aigc-classroom-final.validation.json'),
});
console.log(finalPath);
