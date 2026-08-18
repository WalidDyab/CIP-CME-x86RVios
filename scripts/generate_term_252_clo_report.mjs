import fs from 'node:fs/promises';

const auditSource = 'data/clo_revision_audit.json';
const curriculumSource = 'data/ee_curriculum.json';
const auditOutput = 'data/clo_revision_audit_core_courses.json';
const htmlOutput = 'curriculum-vision/clo-revision-report-term-252.html';
const scope = ['EE 101','EE 201','EE 202','EE 211','EE 221','EE 231','EE 304','EE 305','EE 312','EE 322','EE 332','EE 341','EE 351','EE 403','EE 490','EE 492'];
const introduction = 'The Undergraduate Electrical Engineering program reviewed its Course Learning Outcomes in Term 252 following ABET feedback concerning Student Outcome assessment. The previous curriculum mapping primarily followed the NCAAA learning domains. To strengthen outcome assessment under the ABET framework, the program revised the CLO structure to establish explicit alignment between Course Learning Outcomes, ABET Student Outcomes, and program Performance Indicators. As part of this review, selected CLO statements were modified, added, or omitted where necessary to support a clearer and more systematic assessment framework.';
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

const fullAudit = JSON.parse(await fs.readFile(auditSource, 'utf8'));
const curriculum = JSON.parse(await fs.readFile(curriculumSource, 'utf8'));
const courseMap = new Map((curriculum.curriculum?.courses ?? []).map(course => [course.course_code, course]));
const changes = fullAudit.changes.filter(change => scope.includes(change.course_code));
const unchangedClos = (fullAudit.unchanged_clos ?? []).filter(clo => scope.includes(clo.course_code));
const counts = {
  baseline_clos: unchangedClos.length + changes.filter(change => ['modified','omitted'].includes(change.change_type)).length,
  final_clos: unchangedClos.length + changes.filter(change => ['modified','added'].includes(change.change_type)).length,
  unchanged: unchangedClos.length,
  modified: changes.filter(change => change.change_type === 'modified').length,
  added: changes.filter(change => change.change_type === 'added').length,
  omitted: changes.filter(change => change.change_type === 'omitted').length,
  ambiguous: (fullAudit.ambiguous_cases ?? []).filter(item => scope.includes(item.course_code)).length
};
const coursesWithChanges = scope.filter(code => changes.some(change => change.course_code === code));
const coursesWithoutChanges = scope.filter(code => !coursesWithChanges.includes(code));
if (counts.unchanged + counts.modified + counts.omitted !== counts.baseline_clos) throw new Error('Scoped baseline accounting failed');
if (counts.unchanged + counts.modified + counts.added !== counts.final_clos) throw new Error('Scoped final accounting failed');
if (new Set(changes.map(change => change.course_code)).size !== coursesWithChanges.length) throw new Error('Scoped course accounting failed');

const audit = {
  report_title: 'Term 252 CLO Revision Report',
  scope: 'Undergraduate EE core courses including EE490 and EE492',
  included_courses: scope,
  excluded_courses: 'All Undergraduate EE electives',
  baseline_source: 'EE Program Design Full ABET.xlsx',
  final_source: 'ee_curriculum.json',
  term: '252',
  introduction,
  counts,
  courses_with_changes: coursesWithChanges,
  courses_without_clo_changes: coursesWithoutChanges,
  changes,
  ambiguous_cases: (fullAudit.ambiguous_cases ?? []).filter(item => scope.includes(item.course_code))
};

const changeLabel = type => type === 'modified' ? 'Modified CLO wording' : type === 'added' ? 'Added CLO' : 'Omitted CLO';
const cloCell = (id, text) => id && text ? `<span class="clo-id">CLO ${esc(id)}</span><span class="clo-wording">${esc(text)}</span>` : '<span class="dash">—</span>';
const courseSections = coursesWithChanges.map(code => {
  const course = courseMap.get(code);
  const rows = changes.filter(change => change.course_code === code).map(change => `<tr>
    <td><span class="change-type ${esc(change.change_type)}">${changeLabel(change.change_type)}</span>${change.note ? `<span class="change-note">${esc(change.note)}</span>` : ''}</td>
    <td>${cloCell(change.old_clo_id, change.old_clo_text)}</td>
    <td>${cloCell(change.new_clo_id, change.new_clo_text)}</td>
  </tr>`).join('\n');
  return `<section class="course-revision">
    <h3>${esc(code)} <span>${esc(course?.course_title ?? '')}</span></h3>
    <div class="report-table-wrap"><table><thead><tr><th>Change Type</th><th>Previous CLO</th><th>Revised CLO</th></tr></thead><tbody>${rows}</tbody></table></div>
  </section>`;
}).join('\n');
const unchangedList = coursesWithoutChanges.map(code => `<li><strong>${esc(code)}</strong><span>${esc(courseMap.get(code)?.course_title ?? '')}</span></li>`).join('');
const statCards = [['Baseline CLOs',counts.baseline_clos],['Final CLOs',counts.final_clos],['Modified',counts.modified],['Added',counts.added],['Omitted',counts.omitted],['Unchanged',counts.unchanged]].map(([label,value]) => `<div class="report-stat"><strong>${value}</strong><span>${label}</span></div>`).join('');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta name="robots" content="noindex, nofollow">
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Term 252 CLO Revision Report | Curriculum Intelligence Portal</title>
  <link rel="stylesheet" href="../assets/portal.css">
  <script defer src="../assets/portal.js"></script>
  <style>
    body { background:#eef1f4; color:#1d2732; }
    .portal-header .header-row { background:linear-gradient(135deg,#08111e,#143d66); border-color:rgba(255,255,255,.2); box-shadow:0 12px 28px rgba(15,31,48,.28); }
    .portal-header .nav-center .btn { color:rgba(255,255,255,.94); background:rgba(255,255,255,.08); border-color:rgba(255,255,255,.22); }
    .portal-header .nav-center .btn:hover, .portal-header .nav-center .btn:focus-visible { color:#fff; background:rgba(255,255,255,.16); border-color:rgba(255,255,255,.4); }
    .portal-header .ce-logo, .portal-header .psu-logo { filter:drop-shadow(0 4px 9px rgba(0,0,0,.35)); }
    .report-shell { max-width:1120px; margin:0 auto; padding:0 20px 48px; }
    .report-toolbar { display:flex; justify-content:space-between; gap:12px; align-items:center; margin:18px 0; }
    .report-toolbar a { color:#143d66; font-weight:750; }
    .report-paper { background:#fff; border:1px solid #d8dee5; border-radius:10px; box-shadow:0 10px 28px rgba(24,39,55,.1); overflow:hidden; }
    .report-masthead { display:flex; align-items:center; justify-content:space-between; gap:28px; padding:28px 38px; border-bottom:5px solid #143d66; }
    .report-masthead img { max-width:190px; max-height:76px; object-fit:contain; }
    .report-identity { text-align:center; flex:1; }
    .report-identity p { margin:0 0 5px; color:#53606d; font-weight:700; }
    .report-identity h1 { margin:0; font-size:clamp(24px,4vw,36px); color:#143d66; line-height:1.15; }
    .report-identity h2 { margin:8px 0 0; font-size:18px; color:#8a5a12; font-weight:750; }
    .report-content { padding:34px 42px 48px; }
    .report-section { margin:0 0 34px; }
    .report-section > h2 { margin:0 0 14px; padding-bottom:8px; border-bottom:1px solid #cfd6dd; color:#143d66; font-size:21px; }
    .report-section p, .report-section li { color:#303b46; line-height:1.7; }
    .scope-list { margin:10px 0 0; padding-left:22px; }
    .report-stats { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:10px; }
    .report-stat { border:1px solid #d9e0e6; border-top:3px solid #143d66; padding:15px 10px; text-align:center; background:#f7f9fb; }
    .report-stat strong { display:block; color:#143d66; font-size:26px; }
    .report-stat span { display:block; margin-top:3px; color:#596674; font-size:12px; font-weight:750; }
    .course-revision { margin:0 0 26px; break-inside:avoid-page; }
    .course-revision h3 { margin:0; padding:11px 14px; color:#fff; background:#143d66; font-size:17px; }
    .course-revision h3 span { margin-left:8px; font-weight:500; opacity:.9; }
    .report-table-wrap { overflow-x:auto; max-width:100%; }
    .report-table-wrap table { width:100%; min-width:720px; border-collapse:collapse; table-layout:fixed; }
    .report-table-wrap th { background:#e8edf2; color:#243444; text-align:left; font-size:12px; letter-spacing:.03em; }
    .report-table-wrap th:first-child { width:19%; }
    .report-table-wrap th, .report-table-wrap td { border:1px solid #ccd4dc; padding:12px; vertical-align:top; }
    .clo-id { display:block; color:#143d66; font-weight:800; margin-bottom:5px; }
    .clo-wording { display:block; color:#202b35; line-height:1.5; }
    .change-type { display:inline-block; border-radius:999px; padding:5px 8px; font-size:11px; font-weight:800; background:#e8edf2; color:#243444; }
    .change-type.added { background:#e2f0e7; color:#235b36; }
    .change-type.omitted { background:#f6e5e5; color:#7b2929; }
    .change-note { display:block; margin-top:8px; color:#596674; font-size:12px; line-height:1.45; }
    .dash { color:#77828d; }
    .unchanged-courses { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px 22px; padding:0; list-style:none; }
    .unchanged-courses li { display:flex; gap:10px; border-bottom:1px solid #e1e6eb; padding:8px 0; }
    .unchanged-courses strong { color:#143d66; min-width:58px; }
    .report-footer { border-top:1px solid #d8dee5; padding-top:18px; color:#66727e; font-size:12px; }
    @media (max-width:760px) {
      .report-shell { padding:0 10px 28px; }
      .report-toolbar { align-items:stretch; flex-direction:column; }
      .report-toolbar .btn { text-align:center; }
      .report-masthead { padding:22px 18px; flex-direction:column; }
      .report-masthead img { max-width:150px; max-height:62px; }
      .report-content { padding:25px 18px 34px; }
      .report-stats { grid-template-columns:repeat(2,minmax(0,1fr)); }
      .unchanged-courses { grid-template-columns:1fr; }
      .course-revision h3 span { display:block; margin:4px 0 0; }
    }
    @page { size:A4; margin:15mm 13mm 16mm; }
    @media print {
      body { background:#fff !important; color:#111 !important; }
      .portal-header, .portal-footer, .report-toolbar, #footer-placeholder, #header-placeholder { display:none !important; }
      .report-shell { max-width:none; padding:0; margin:0; }
      .report-paper { border:0; border-radius:0; box-shadow:none; overflow:visible; }
      .report-masthead { padding:0 0 16px; border-bottom:4px solid #143d66; }
      .report-masthead img { max-width:145px; max-height:58px; }
      .report-identity h1 { font-size:25px; }
      .report-identity h2 { font-size:15px; }
      .report-content { padding:20px 0 0; }
      .report-section { margin-bottom:24px; }
      .report-stats { grid-template-columns:repeat(6,1fr); }
      .report-stat { padding:9px 4px; }
      .report-stat strong { font-size:20px; }
      .report-table-wrap { overflow:visible; }
      .report-table-wrap table { min-width:0; font-size:10.5pt; }
      .report-table-wrap thead { display:table-header-group; }
      .report-table-wrap tr { break-inside:avoid; page-break-inside:avoid; }
      .course-revision { break-inside:avoid-page; page-break-inside:avoid; }
      .course-revision h3 { print-color-adjust:exact; -webkit-print-color-adjust:exact; }
      .change-type, .report-stat, .report-table-wrap th { print-color-adjust:exact; -webkit-print-color-adjust:exact; }
      a { color:inherit !important; text-decoration:none !important; }
    }
  </style>
</head>
<body>
  <div id="header-placeholder"></div>
  <div class="report-shell">
    <div class="report-toolbar" aria-label="Report actions">
      <a href="index.html">← Back to Curriculum Vision</a>
      <button class="btn primary" type="button" onclick="window.print()">Print / Save as PDF</button>
    </div>
    <article class="report-paper">
      <header class="report-masthead">
        <img src="../assets/CE-LOGO.png" alt="College of Engineering">
        <div class="report-identity">
          <p>Undergraduate Electrical Engineering Program</p>
          <h1>Undergraduate EE Program CLO Revision Report</h1>
          <h2>Term 252 Targeted Curriculum Improvement</h2>
        </div>
        <img src="../assets/PSU.svg" alt="Prince Sultan University">
      </header>
      <div class="report-content">
        <section class="report-section"><h2>1. Purpose</h2><p>This report documents the Course Learning Outcome modifications resulting from the Undergraduate EE program’s Term 252 review following ABET feedback concerning Student Outcome assessment.</p></section>
        <section class="report-section"><h2>2. Continuous Improvement Context</h2><p>The Term 252 review represents a targeted improvement step within the program’s broader continuous-improvement process. It establishes an updated CLO basis for systematic outcome assessment and precedes the program’s wider major curriculum revision.</p></section>
        <section class="report-section"><h2>3. Revision Rationale</h2><p>${esc(introduction)}</p></section>
        <section class="report-section"><h2>4. Scope</h2><p>The report covers the Undergraduate EE core courses, including EE 490 and EE 492.</p><ul class="scope-list"><li>All program electives are excluded.</li><li>Only modified CLO wording, added CLOs, and omitted CLOs are reported.</li><li>SO/PI mappings, I/P/M levels, Teaching Strategies, and Assessment Methods are outside the scope of this report.</li></ul></section>
        <section class="report-section"><h2>5. Summary of Changes</h2><div class="report-stats">${statCards}</div></section>
        <section class="report-section"><h2>6. Detailed CLO Revisions</h2>${courseSections}</section>
        <section class="report-section"><h2>7. Courses with No CLO Changes</h2><ul class="unchanged-courses">${unchangedList}</ul></section>
        <section class="report-section"><h2>8. Conclusion</h2><p>The Term 252 revisions establish the CLO basis for the program’s ABET-aligned SO/PI assessment framework and form part of the Undergraduate EE program’s continuing curriculum-improvement activities.</p></section>
        <footer class="report-footer">Sources: EE Program Design Full ABET.xlsx (baseline) and ee_curriculum.json (final/current curriculum).</footer>
      </div>
    </article>
  </div>
  <div id="footer-placeholder"></div>
</body>
</html>`;

await fs.mkdir('curriculum-vision', { recursive:true });
await fs.writeFile(auditOutput, `${JSON.stringify(audit, null, 2)}\n`, 'utf8');
await fs.writeFile(htmlOutput, html, 'utf8');
console.log(JSON.stringify({ counts, coursesWithChanges, coursesWithoutChanges, auditOutput, htmlOutput }, null, 2));
