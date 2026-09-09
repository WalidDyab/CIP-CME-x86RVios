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
  <link rel="stylesheet" href="../assets/pages/curriculum-vision-clo-revision-report-term-252.css">
<link rel="stylesheet" href="../assets/runtime-utilities.css">
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
        <img src="../assets/PSU.png" alt="Prince Sultan University">
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
        <footer class="report-footer">This report is created by the CME curriculum committee. Date: 16/8/2026</footer>
      </div>
    </article>
  </div>
  <div id="footer-placeholder"></div>
</body>
</html>`;

await fs.mkdir('curriculum-vision', { recursive:true });
await fs.writeFile(auditOutput, `${JSON.stringify(audit, null, 2)}\n`, 'utf8');
await fs.writeFile(htmlOutput, `${html}\n`, 'utf8');
console.log(JSON.stringify({ counts, coursesWithChanges, coursesWithoutChanges, auditOutput, htmlOutput }, null, 2));
