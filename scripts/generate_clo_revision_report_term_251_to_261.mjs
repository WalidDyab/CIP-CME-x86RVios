import crypto from 'node:crypto';
import fs from 'node:fs/promises';

const baselinePath = 'data/clo_baseline_term_251_abet.json';
const curriculumPath = 'data/ee_curriculum.json';
const auditOutput = 'data/clo_revision_audit_term_251_to_261.json';
const htmlOutput = 'curriculum-vision/clo-revision-report-term-251-to-261.html';

const baseline = JSON.parse(await fs.readFile(baselinePath, 'utf8'));
const curriculum = JSON.parse(await fs.readFile(curriculumPath, 'utf8'));
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const norm = value => String(value ?? '').toLowerCase().replace(/[‐‑‒–—−]/g, '-').replace(/[^a-z0-9]+/g, ' ').trim();
const domainName = value => String(value ?? '').startsWith('Knowledge') ? 'Knowledge' : String(value ?? '').startsWith('Skills') ? 'Skills' : 'Values';
const currentByCode = new Map((curriculum.curriculum?.courses ?? []).map(course => [course.course_code, {
  ...course,
  clos: (course.clos ?? []).map(clo => ({...clo, current_clo_id:String(clo.clo_number), current_clo_text:clo.clo_text}))
}]));
const baselineByCode = new Map(baseline.courses.map(course => [course.course_code, course]));

for (const code of baseline.included_courses) {
  if (!currentByCode.has(code)) throw new Error(`Missing current course ${code}`);
  if (!baselineByCode.has(code)) throw new Error(`Missing baseline course ${code}`);
}

const manual = {
  'EE 202': [{type:'merged', oldIds:['2.3','2.4'], newIds:['2.3'], note:'Two overlapping skills CLOs were consolidated into one current CLO.'}],
  'EE 211': [{type:'modified', oldIds:['3.1'], newIds:['2.2'], note:'Experimental work was retained with revised wording and classification.'}],
  'EE 332': [{type:'merged', oldIds:['1.1','2.2'], newIds:['1.1'], note:'The repeated feedback-and-stability outcome was consolidated into one CLO.'}],
};

const relationships = [];
const courseSummaries = [];
for (const code of baseline.included_courses) {
  const oldCourse = baselineByCode.get(code);
  const newCourse = currentByCode.get(code);
  const oldById = new Map(oldCourse.clos.map(clo => [clo.baseline_clo_ref, clo]));
  const newById = new Map(newCourse.clos.map(clo => [clo.current_clo_id, clo]));
  const oldUsed = new Set();
  const newUsed = new Set();
  const add = (type, oldIds, newIds, note = null) => {
    const oldClos = oldIds.map(id => oldById.get(id));
    const newClos = newIds.map(id => newById.get(id));
    if (oldClos.some(item => !item) || newClos.some(item => !item)) throw new Error(`Invalid relationship for ${code}`);
    oldIds.forEach(id => oldUsed.add(id));
    newIds.forEach(id => newUsed.add(id));
    relationships.push({course_code:code, course_title:newCourse.course_title, type, baseline_clos:oldClos, current_clos:newClos, note});
  };

  for (const item of manual[code] ?? []) add(item.type, item.oldIds, item.newIds, item.note);

  for (const oldClo of oldCourse.clos) {
    if (oldUsed.has(oldClo.baseline_clo_ref)) continue;
    const newClo = newCourse.clos.find(candidate => !newUsed.has(candidate.current_clo_id) && norm(candidate.current_clo_text) === norm(oldClo.clo_text));
    if (!newClo) continue;
    const sameIdentity = oldClo.baseline_clo_ref === newClo.current_clo_id && domainName(oldClo.nqf_domain) === domainName(newClo.nqf_domain);
    add(sameIdentity ? 'unchanged' : 'renumbered', [oldClo.baseline_clo_ref], [newClo.current_clo_id], sameIdentity ? null : 'Learning outcome retained under a revised CLO number.');
  }

  for (const oldClo of oldCourse.clos) {
    if (oldUsed.has(oldClo.baseline_clo_ref)) continue;
    const newClo = newById.get(oldClo.baseline_clo_ref);
    if (newClo && !newUsed.has(newClo.current_clo_id)) add('modified', [oldClo.baseline_clo_ref], [newClo.current_clo_id]);
  }
  for (const oldClo of oldCourse.clos) if (!oldUsed.has(oldClo.baseline_clo_ref)) add('omitted', [oldClo.baseline_clo_ref], [], 'Outcome content was incorporated into the revised CLO set.');
  for (const newClo of newCourse.clos) if (!newUsed.has(newClo.current_clo_id)) add('added', [], [newClo.current_clo_id], 'New CLO added to strengthen assessment coverage.');

  const courseRelationships = relationships.filter(item => item.course_code === code);
  const accountedOld = courseRelationships.reduce((sum, item) => sum + item.baseline_clos.length, 0);
  const accountedNew = courseRelationships.reduce((sum, item) => sum + item.current_clos.length, 0);
  if (accountedOld !== oldCourse.clos.length || accountedNew !== newCourse.clos.length) throw new Error(`Course accounting failed for ${code}`);
  courseSummaries.push({course_code:code, course_title:newCourse.course_title, baseline_clos:oldCourse.clos.length, current_clos:newCourse.clos.length, change_types:[...new Set(courseRelationships.filter(item => item.type !== 'unchanged').map(item => item.type))]});
}

const countRelations = type => relationships.filter(item => item.type === type).length;
const countOld = type => relationships.filter(item => item.type === type).reduce((sum, item) => sum + item.baseline_clos.length, 0);
const countNew = type => relationships.filter(item => item.type === type).reduce((sum, item) => sum + item.current_clos.length, 0);
const counts = {
  baseline_clos: baseline.baseline_clo_count,
  current_clos: baseline.included_courses.reduce((sum, code) => sum + currentByCode.get(code).clos.length, 0),
  unchanged: countRelations('unchanged'), modified: countRelations('modified'), renumbered: countRelations('renumbered'),
  added: countNew('added'), omitted: countOld('omitted'), merge_cases: countRelations('merged'),
  merged_baseline_clos: countOld('merged'), merged_current_clos: countNew('merged'),
  split_cases: countRelations('split'), split_baseline_clos: countOld('split'), split_current_clos: countNew('split'),
  ambiguous: countRelations('ambiguous')
};
const accountedBaseline = ['unchanged','modified','renumbered','omitted','merged','split','ambiguous'].reduce((sum, type) => sum + countOld(type), 0);
const accountedCurrent = ['unchanged','modified','renumbered','added','merged','split','ambiguous'].reduce((sum, type) => sum + countNew(type), 0);
if (accountedBaseline !== counts.baseline_clos || accountedCurrent !== counts.current_clos) throw new Error('Global CLO accounting failed');
if (counts.ambiguous) throw new Error('Ambiguous CLO relationships require review');

const labels = {unchanged:'Unchanged',modified:'Modified',renumbered:'Renumbered',added:'Added',omitted:'Omitted',merged:'Merged',split:'Split',ambiguous:'Review required'};
const cloParts = value => String(value || '').split('.').map(part => Number.parseInt(part, 10));
const relationshipId = item => item.current_clos[0]?.current_clo_id || item.baseline_clos[0]?.baseline_clo_ref || '';
const sortRelationships = items => items.map((item,index)=>({item,index})).sort((a,b)=>{
  const left=cloParts(relationshipId(a.item)), right=cloParts(relationshipId(b.item));
  for(let i=0;i<Math.max(left.length,right.length);i++){const difference=(left[i]??-1)-(right[i]??-1);if(difference)return difference;}
  return Number(a.item.type==='omitted')-Number(b.item.type==='omitted') || a.index-b.index;
}).map(entry=>entry.item);
const relationshipKey = item => `${item.course_code}|${item.baseline_clos.map(clo => clo.baseline_clo_ref).join('+')}->${item.current_clos.map(clo => clo.current_clo_id).join('+')}`;
const editorialComments = new Map(Object.entries({
  'EE 201|1.1->1.1':'CLO expanded to cover electrical quantities, circuit elements, and basic AC signal relationships.',
  'EE 201|2.1->2.1':'CLO refocused on DC circuit analysis using nodal, mesh, and network-theorem methods.',
  'EE 201|2.2->2.2':'CLO refocused on AC phasor, impedance, power, and power-factor analysis.',
  'EE 201|2.3->2.3':'CLO scope revised to emphasize experimental and simulation-based investigation.',
  'EE 201|3.1->3.1':'Teamwork outcome clarified in the context of electric-circuits laboratory activities.',
  'EE 201|->3.2':'New ethical and professional responsibility CLO added to strengthen assessment coverage.',
  'EE 211|1.1->1.1':'CLO revised from description to problem solving across diodes, BJTs, and operational amplifiers.',
  'EE 211|2.1->2.1':'CLO revised to emphasize circuit design against specified performance requirements.',
  'EE 211|->1.2':'New technical-explanation CLO added for semiconductor devices and amplifiers.',
  'EE 211|->2.3':'New teamwork CLO added for laboratory building, testing, and troubleshooting.',
  'EE 231|1.1->1.1':'Signal and system properties were clarified through standard classification criteria.',
  'EE 231|1.2->1.2':'Sampling outcome clarified to address continuous-to-discrete signal conversion.',
  'EE 231|2.2->2.2':'Z-transform outcome revised to emphasize analysis, interpretation, and engineering conclusions.',
  'EE 231|2.3->2.3':'Fourier-transform outcome clarified to include interpretation of frequency-domain results.',
  'EE 231|2.4->2.4':'MATLAB outcome expanded to include performance evaluation and independently learned tools.',
  'EE 202|->3.1':'New independent-learning CLO added to strengthen circuit-analysis assessment coverage.',
  'EE 322|1.1->1.1':'Microprocessor organization clarified through explicit datapath, control, register, ALU, and bus components.',
  'EE 322|2.1->2.1':'CLO scope shifted toward design of processor datapath and timing components.',
  'EE 322|2.2->2.2':'CLO scope revised to emphasize control-unit and sequential-system design.',
  'EE 322|3.1->3.1':'Implementation outcome made more specific through integrated FPGA-based system verification.',
  'EE 322|->1.3':'New HDL and RTL modeling CLO added to strengthen digital-system assessment coverage.',
  'EE 341|1.1->1.1':'Electromagnetic-field concepts expanded to include sources in free space and material media.',
  'EE 341|2.1->2.1':'Application of Maxwell’s equations clarified to include boundary-condition analysis.',
  'EE 341|2.2->2.2':'Technical scope refocused on analysis of key electric and magnetic field quantities.',
  'EE 341|->2.4':'New oral technical communication CLO added for an electromagnetics application.',
  'EE 341|->3.1':'New independent-learning CLO added for an electromagnetics application.',
  'EE 304|2.1->2.1':'CLO revised to emphasize DC-machine design rather than selection and speed-control analysis.',
  'EE 304|2.2->2.2':'CLO revised to emphasize AC-machine design rather than selection and speed-control analysis.',
  'EE 304|3.1->3.1':'CLO scope changed from sustainability awareness to acquisition and application of new knowledge.',
  'EE 403|1.2->1.2':'CLO revised to focus on transformer and transmission-line modeling.',
  'EE 403|2.1->2.1':'CLO revised to emphasize balanced three-phase, transformer, and per-unit analysis.',
  'EE 403|2.2->2.2':'CLO revised to introduce transmission-line design requirements.',
  'EE 403|2.3->2.3':'CLO revised to focus on steady-state transmission-line performance.',
  'EE 403|->3.1':'New technical communication CLO added for power-system analysis and results.',
  'EE 403|->3.2':'New independent-learning CLO added for power systems.',
  'EE 490|1.1->1.1':'Information-identification outcome streamlined around technical information and engineering principles.',
  'EE 490|2.1->2.1':'Design outcome clarified to include specified needs, relevant constraints, and standards or codes.',
  'EE 490|2.2->2.2':'Concept-generation outcome streamlined around alternatives and preferred-solution selection.',
  'EE 490|2.3->2.3':'Visual communication outcome clarified through engineering tools and drawings.',
  'EE 490|2.4->2.4':'Communication outcome clarified to emphasize written, visual, and oral technical communication.',
  'EE 490|3.1->3.1':'Ethical and legal responsibility clarified in the context of engineering decisions.',
  'EE 490|3.2->3.2':'Teamwork outcome refined to emphasize shared goals, task planning, and project objectives.',
  'EE 490|->2.5':'New design-validation CLO added for testing, data analysis, and engineering conclusions.',
  'EE 490|->3.3':'New independent-learning CLO added for project-specific knowledge, tools, standards, and technologies.',
  'EE 492|1.2->1.2':'Wording refined to emphasize identification of complex engineering problems in industry.',
  'EE 492|2.2->2.2':'CLO refined to emphasize application of technical skills in a professional work environment.',
  'EE 492|3.2->3.2':'Professional and ethical responsibility clarified in engineering practice and decision-making.',
  'EE 492|->2.3':'New multidisciplinary teamwork CLO added to strengthen workplace assessment coverage.'
}));
const editorialCommentFor = item => editorialComments.get(relationshipKey(item)) || item.note || (item.type === 'unchanged' ? 'No wording change.' : item.type === 'added' ? 'New CLO added to strengthen assessment coverage.' : labels[item.type]);
for (const item of relationships) {
  item.comment = editorialCommentFor(item);
  if (item.type === 'modified' && !editorialComments.has(relationshipKey(item)) && !item.note) throw new Error(`Missing editorial comment for ${relationshipKey(item)}`);
}

const changedCourses = courseSummaries.filter(course => course.change_types.length).map(course => course.course_code);
const unchangedCourses = courseSummaries.filter(course => !course.change_types.length).map(course => course.course_code);
const excludedCurrentCourses = [...currentByCode.keys()].filter(code => !baselineByCode.has(code)).map(course_code => ({course_code, reason:'No matching course specification in the Term 251 baseline package.'}));
const audit = {
  schema_version:'1.0', comparison:'Term 251 ABET Submission → Term 261 Proposed Curriculum',
  baseline_source:{dataset:baselinePath,pdf:baseline.source_pdf,pdf_sha256:baseline.source_pdf_sha256,identifier_note:baseline.identifier_note},
  current_source:curriculumPath,
  scope:{included_courses:baseline.included_courses,excluded_term_251_supporting_courses:baseline.excluded_source_courses,excluded_current_courses:excludedCurrentCourses},
  counts, accounting:{baseline_accounted:accountedBaseline,current_accounted:accountedCurrent},
  courses_with_changes:changedCourses,courses_without_clo_changes:unchangedCourses,course_summaries:courseSummaries,relationships,ambiguous_cases:[]
};

const commentFor = item => item.comment;
const piOwners = new Map(Object.entries(curriculum.abet?.performance_indicators ?? {}).map(([pi, definition]) => [pi, definition.so]));
const currentMapping = clo => {
  const sos = (clo.mapped_sos ?? []).map(String);
  const grouped = new Map(sos.map(so => [so, []]));
  for (const pi of clo.pi_codes ?? []) {
    const owner = piOwners.get(pi);
    if (!owner || !grouped.has(owner)) throw new Error(`Invalid SO/PI relationship for ${clo.current_clo_id}: ${pi}`);
    grouped.get(owner).push(pi);
  }
  return [domainName(clo.nqf_domain), sos.map(so => grouped.get(so).length ? `${so} (${grouped.get(so).join(', ')})` : so).join(', ')].filter(Boolean).join(' · ');
};
const baselineMapping = clo => {
  const sos = [...new Set((String(clo.source_so ?? '').match(/\d+/g) ?? []).map(value => `SO${value}`))];
  return [domainName(clo.nqf_domain), sos.join(', ')].filter(Boolean).join(' · ');
};
const cloBlock = (clo, side) => {
  if (!clo) return '<span class="empty">—</span>';
  const id = side === 'baseline' ? clo.baseline_clo_ref : clo.current_clo_id;
  const text = side === 'baseline' ? clo.clo_text : clo.current_clo_text;
  const mapping = side === 'baseline' ? baselineMapping(clo) : currentMapping(clo);
  return `<div class="clo"><strong>CLO ${esc(id)}</strong><span>${esc(mapping)}</span><p>${esc(text)}</p></div>`;
};
const cell = (items, side) => items.length ? items.map(item => cloBlock(item, side)).join('') : '<span class="empty">—</span>';
const courseSections = changedCourses.map(code => {
  const course = currentByCode.get(code);
  const rows = sortRelationships(relationships.filter(item => item.course_code === code)).map(item => `<tr><td>${esc(labels[item.type])}</td><td>${cell(item.baseline_clos,'baseline')}</td><td>${cell(item.current_clos,'current')}</td><td>${esc(commentFor(item))}</td></tr>`).join('');
  return `<section class="course"><h3>${esc(code)} - ${esc(course.course_title)}</h3><table><thead><tr><th>Change</th><th>Term 251 CLO</th><th>Term 261 CLO</th><th>Brief Justification / Comment</th></tr></thead><tbody>${rows}</tbody></table></section>`;
}).join('');
const summaryRows = [
  ['Term 251 CLOs',counts.baseline_clos],['Term 261 CLOs',counts.current_clos],['Unchanged',counts.unchanged],['Modified',counts.modified],['Renumbered',counts.renumbered],['Added',counts.added],['Omitted',counts.omitted],['Merged',counts.merge_cases],['Split',counts.split_cases],['Ambiguous',counts.ambiguous]
].map(([label,value]) => `<tr><td>${esc(label)}</td><td>${value}</td></tr>`).join('');
const unchangedRows = unchangedCourses.map(code => `<tr><td>${esc(code)}</td><td>${esc(currentByCode.get(code).course_title)}</td></tr>`).join('');
const includedRows = baseline.included_courses.map(code => `<tr><td>${esc(code)}</td><td>${esc(currentByCode.get(code).course_title)}</td></tr>`).join('');
const reportScopeOptions = [`<option value="all">All Courses</option>`, ...baseline.included_courses.map(code => `<option value="${esc(code)}">${esc(code)} — ${esc(currentByCode.get(code).course_title)}</option>`)].join('');
const printScript = "document.getElementById('printReport').addEventListener('click', () => window.print());";
const cspHash = crypto.createHash('sha256').update(printScript).digest('base64');

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'sha256-${cspHash}'; style-src 'self' 'unsafe-inline'; img-src 'self'; object-src 'none'; base-uri 'self'">
<meta name="referrer" content="strict-origin-when-cross-origin"><title>Term 251-261 CLO Revision Report</title><script defer src="../assets/vendor/jszip.min.js"></script><script defer src="../assets/clo-revision-docx-generator.js"></script>
<style>
  :root{color:#1b1b1b;background:#ececec;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.45}*{box-sizing:border-box}body{margin:0}.toolbar{max-width:210mm;margin:18px auto 8px;display:flex;justify-content:space-between;align-items:center}.toolbar a{color:#17365d}.toolbar button,.report-generator button{background:#17365d;color:#fff;border:0;padding:9px 16px;border-radius:3px;font-weight:700;cursor:pointer}.report-generator button:disabled{opacity:.65;cursor:wait}.document{width:210mm;max-width:calc(100% - 24px);margin:0 auto 28px;background:#fff;padding:22mm 20mm 20mm;box-shadow:0 2px 12px #999}.title{text-align:center;border-bottom:2px solid #17365d;padding-bottom:18px;margin-bottom:28px}.title h1{font-family:Georgia,serif;font-size:23px;margin:6px 0;color:#17365d}.title h2{font-size:17px;margin:5px 0;font-weight:600}.title p{margin:4px 0}.report-generator{border:1px solid #9eabb9;background:#f5f7f9;padding:14px 16px;margin:0 0 24px}.report-generator h2{border:0;margin:0 0 9px;padding:0}.report-generator-controls{display:flex;gap:10px;align-items:end;flex-wrap:wrap}.report-generator label{font-weight:700}.report-generator select{display:block;margin-top:4px;min-width:310px;max-width:100%;padding:8px;border:1px solid #777;background:#fff}.report-generator-status{display:block;margin-top:8px}.report-generator-status.success{color:#176b32}.report-generator-status.error{color:#9b1c1c}.muted{color:#59636e}.document h2{font-family:Georgia,serif;color:#17365d;font-size:18px;border-bottom:1px solid #9eabb9;padding-bottom:4px;margin:28px 0 10px}.document h3{font-size:15px;color:#17365d;margin:22px 0 6px}.document p{margin:7px 0}.document ul{margin:7px 0;padding-left:22px}table{width:100%;border-collapse:collapse;margin:8px 0 16px;table-layout:fixed;font-size:12px}th,td{border:1px solid #777;padding:7px;vertical-align:top;text-align:left}th{background:#e8edf3;color:#111}th:first-child{width:12%}th:nth-child(2),th:nth-child(3){width:31%}.summary{width:55%;table-layout:auto}.summary th:first-child{width:auto}.summary td:last-child,.summary th:last-child{text-align:right;width:25%}.scope{width:75%;table-layout:auto}.scope th:first-child{width:24%}.clo strong,.clo span{display:block}.clo span{font-size:11px;font-style:italic;color:#444}.clo p{margin:4px 0 0}.clo+.clo{border-top:1px dotted #999;margin-top:7px;padding-top:7px}.empty{color:#666}.course{break-inside:auto}.course table thead{display:table-header-group}.approval{table-layout:auto}.approval th:first-child{width:38%}.approval-section{break-inside:avoid;page-break-inside:avoid}.footer-note{margin-top:28px;border-top:1px solid #777;padding-top:8px;font-size:11px;color:#555}
  @page{size:A4 portrait;margin:15mm 14mm 16mm}@media print{:root{background:#fff;font-size:10pt}.toolbar,.report-generator{display:none}.document{width:auto;max-width:none;margin:0;padding:0;box-shadow:none}.title{margin-bottom:18px}.document h2{margin-top:20px}.course{break-before:auto}.course h3{break-after:avoid}.course table{font-size:8.2pt}tr,.clo{break-inside:avoid;page-break-inside:avoid}th{print-color-adjust:exact;-webkit-print-color-adjust:exact}.footer-note{margin-top:18px}}
</style></head><body>
<div class="toolbar"><a href="index.html">Back to Curriculum Vision</a><button id="printReport" type="button">Print / Save as PDF</button></div>
<main class="document">
  <header class="title"><p><strong>Undergraduate Electrical Engineering Program</strong></p><h1>CLO Revision Report</h1><h2>Term 251 ABET Submission vs Term 261 Proposed Curriculum</h2></header>
  <section class="report-generator" id="cloReportGenerator" data-baseline="../data/clo_baseline_term_251_abet.json" data-audit="../data/clo_revision_audit_term_251_to_261.json" data-curriculum="../data/ee_curriculum.json" data-template="../templates/CLO-Revision-Report-Template.docx"><h2>Generate CLO Revision Report</h2><div class="report-generator-controls"><label for="cloReportScope">Report scope<select id="cloReportScope">${reportScopeOptions}</select></label><button id="generateCloReport" type="button">Generate Word Report</button></div><span id="cloReportStatus" class="report-generator-status muted" aria-live="polite"></span></section>
  <section><h2>1. Purpose</h2><p>This report documents the revision of the CLOs of the Undergraduate Electrical Engineering Program from the Term 251 curriculum submitted to ABET to the proposed Term 261 curriculum. It provides a concise record for curriculum review and approval.</p></section>
  <section><h2>2. Background</h2><p>The CLO review formed part of the program's continuous-improvement process initiated in December 2025 following ABET review and assessment discussions. Faculty review and refinement continued through Term 252 and subsequent stages, resulting in the proposed Term 261 CLO set.</p></section>
  <section><h2>3. Rationale for CLO Review</h2><p>The review was undertaken to improve CLO clarity and measurability and to strengthen alignment with SO assessment and the program's assessment framework. The revisions support assessment improvement; they do not imply that ABET prescribed specific CLO wording.</p></section>
  <section><h2>4. Scope</h2><p>The scope of this review is limited to the 16 Undergraduate EE courses represented in both the Term 251 and Term 261 curricula. Elective courses and non-EE College/supporting courses are excluded from the comparison.</p><table class="scope"><thead><tr><th>Course</th><th>Title</th></tr></thead><tbody>${includedRows}</tbody></table></section>
  <section><h2>5. Summary of CLO Changes</h2><table class="summary"><thead><tr><th>Category</th><th>Count</th></tr></thead><tbody>${summaryRows}</tbody></table><p>The comparison accounts for all ${counts.baseline_clos} Term 251 CLOs and all ${counts.current_clos} Term 261 CLOs. Merged relationships are counted once and are not duplicated as omissions or additions.</p></section>
  <section><h2>6. Detailed CLO Comparison by Course</h2>${courseSections}</section>
  <section><h2>7. Courses with No CLO Changes</h2><table class="scope"><thead><tr><th>Course Code</th><th>Course Title</th></tr></thead><tbody>${unchangedRows}</tbody></table></section>
  <section><h2>8. Impact on ABET Assessment</h2><p>The revised framework strengthens the alignment and traceability among CLOs, SOs, PIs, and assessment evidence. This supports systematic continuous improvement while keeping the detailed comparison focused on CLO wording and structure.</p></section>
  <section class="approval-section"><h2>9. Approval Status</h2><table class="approval"><tbody><tr><th>Program</th><td>B.Sc. Electrical Engineering</td></tr><tr><th>Curriculum Term</th><td>261</td></tr><tr><th>Prepared by</th><td>Curriculum Committee</td></tr><tr><th>Review Status</th><td>Proposed for Approval</td></tr><tr><th>College Curriculum Committee</th><td></td></tr><tr><th>Approval Date</th><td></td></tr><tr><th>Institutional Curriculum Committee, if required</th><td></td></tr><tr><th>Approval Date</th><td></td></tr></tbody></table></section>
  <section><h2>10. Conclusion</h2><p>This report compares the Term 251 CLO baseline submitted to ABET with the proposed Term 261 CLO framework. The changes reflect the program's continuous-improvement and faculty-review process and strengthen CLO clarity, measurability, and alignment with ABET assessment. The Term 261 CLO set is presented for the required curriculum approval.</p></section>
  <p class="footer-note">Undergraduate Electrical Engineering Program - CLO Revision Report - Term 251 to Term 261</p>
</main><script>${printScript}</script></body></html>`;

await fs.writeFile(auditOutput, `${JSON.stringify(audit,null,2)}\n`, 'utf8');
await fs.writeFile(htmlOutput, `${html}\n`, 'utf8');
console.log(JSON.stringify({auditOutput,htmlOutput,counts,changedCourses,unchangedCourses,accountedBaseline,accountedCurrent},null,2));
