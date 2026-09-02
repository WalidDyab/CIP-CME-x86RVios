'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const JSZip = require('../assets/vendor/jszip.min.js');
const generator = require('../assets/clo-revision-docx-generator.js');

const root = path.resolve(__dirname, '..');
const readJson = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const baseline = readJson('data/clo_baseline_term_251_abet.json');
const audit = readJson('data/clo_revision_audit_term_251_to_261.json');
const curriculum = readJson('data/ee_curriculum.json');
const template = fs.readFileSync(path.join(root, 'templates/CLO-Revision-Report-Template.docx'));

async function main() {
  const reconciled = generator.reconcileAudit(audit, baseline, curriculum);
  assert.deepStrictEqual(reconciled.counts, {
    baseline_clos:85, current_clos:94, unchanged:41, modified:37, renumbered:2,
    added:12, omitted:1, merge_cases:2, split_cases:0, ambiguous:0
  });
  assert(reconciled.relationships.some(item => item.type === 'added'));
  assert(reconciled.relationships.some(item => item.type === 'omitted'));
  assert(reconciled.relationships.some(item => item.type === 'merged'));
  assert(reconciled.relationships.some(item => item.type === 'renumbered'));

  const ee403 = generator.reportForScope(reconciled, 'EE 403');
  assert.deepStrictEqual(ee403.relationships.map(item => item.type), ['unchanged','modified','modified','modified','modified','added','added']);
  const live403 = curriculum.curriculum.courses.find(course => course.course_code === 'EE 403');
  const mapping21 = generator.formatCurrentMapping(live403.clos.find(clo => String(clo.clo_number) === '2.1'), curriculum);
  assert.strictEqual(mapping21, 'Skills · SO1 (PI12), SO2 (PI21, PI22)');
  assert.strictEqual(generator.formatCurrentMapping(live403.clos.find(clo => String(clo.clo_number) === '1.1'), curriculum), 'Knowledge · SO1 (PI12)');

  const ee211 = generator.reportForScope(reconciled, 'EE 211');
  const live211 = ee211.relationships.flatMap(item => item.current_clos).find(clo => clo.current_clo_id === '1.2');
  assert(live211.pi_codes.includes('PI31') && live211.pi_codes.includes('PI32') && live211.pi_codes.includes('PI33'));
  const unchanged = generator.reportForScope(reconciled, 'EE 221');
  assert.strictEqual(unchanged.selectedCourse.change_types.length, 0);
  assert.deepStrictEqual(generator.sortRelationships(ee403.relationships).flatMap(item=>item.current_clos.map(clo=>clo.current_clo_id)), ['1.1','1.2','2.1','2.2','2.3','3.1','3.2']);

  assert.throws(() => generator.reportForScope(reconciled, 'EE 999'), /cannot be found/);
  assert.throws(() => generator.reconcileAudit(audit, baseline, {}), /current curriculum data/);
  const ambiguous = JSON.parse(JSON.stringify(audit));
  ambiguous.relationships[0].type = 'ambiguous';
  assert.throws(() => generator.reconcileAudit(ambiguous, baseline, curriculum), /ambiguous/);
  const invalidCurriculum = JSON.parse(JSON.stringify(curriculum));
  invalidCurriculum.curriculum.courses.find(course => course.course_code === 'EE 403').clos.find(clo => String(clo.clo_number) === '2.1').pi_codes.push('PI71');
  const invalidReport = generator.reportForScope(generator.reconcileAudit(audit, baseline, invalidCurriculum), 'EE 403');
  assert.throws(() => generator.buildDocumentXml(invalidReport, '<w:sectPr></w:sectPr>'), /belongs to SO7/);

  const outputDir = path.join(root, 'output', 'browser-preview');
  fs.mkdirSync(outputDir, { recursive:true });
  for (const scope of ['all','EE 211','EE 221','EE 403']) {
    const report = generator.reportForScope(reconciled, scope);
    const result = await generator.generateDocx(report, template, JSZip, 'nodebuffer');
    fs.writeFileSync(path.join(outputDir, result.filename), result.file);
    const packageZip = await JSZip.loadAsync(result.file);
    const xml = await packageZip.file('word/document.xml').async('string');
    assert(xml.includes('Brief Justification / Comment'));
    assert(xml.includes('Curriculum Committee'));
    assert(!xml.includes('____________________________'));
    const section = xml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/)[0];
    assert(section.includes('w:top="2016"') && section.includes('w:bottom="1440"'));
    assert(section.includes('w:left="1008"') && section.includes('w:right="1008"'));
    assert(!xml.includes('&lt;w:p'), 'OOXML markup must not be rendered as visible table-cell text');
    if (scope === 'EE 403') assert(xml.includes('Skills · SO1 (PI12), SO2 (PI21, PI22)'));
    if (scope === 'EE 221') assert(xml.includes('The CLO set is unchanged between Term 251 and Term 261.'));
    assert(packageZip.file('word/media/CME-CE-letter-background.png'));
    const header = await packageZip.file('word/header1.xml').async('string');
    assert(header.includes('CMEStationeryBackground') && header.includes('z-index:-251654144'));
  }
  const ee211Docx = await generator.generateDocx(ee211, template, JSZip, 'nodebuffer');
  const ee211Xml = await (await JSZip.loadAsync(ee211Docx.file)).file('word/document.xml').async('string');
  assert(ee211Xml.includes(live211.current_clo_text));
  assert(ee211Xml.includes('SO3 (PI31, PI32, PI33)'));
  console.log('CLO revision browser generator tests passed.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
