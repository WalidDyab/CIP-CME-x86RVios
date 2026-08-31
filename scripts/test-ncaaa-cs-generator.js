'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const generator = require('../assets/ncaaa-cs-generator.js');

const root = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'data', 'ee_curriculum.json'), 'utf8'));
const courses = data.curriculum.courses;
const course = code => courses.find(item => generator.normalizedCourseCode(item.course_code) === generator.normalizedCourseCode(code));

assert.strictEqual(generator.CLO_SLOT_BY_CODE['3.3'], 11);
assert.strictEqual(generator.filenameForCourse('EE 351'), 'EE351_NCAAA_Course_Specification.docx');
assert.strictEqual(generator.contactHours(course('EE101'))[0].TotalCH, '90');
assert.strictEqual(generator.contactHours(course('EE231'))[0].TotalCH, '60');
assert.strictEqual(generator.contactHours(course('EE414'))[0].TotalCH, '45');
assert.strictEqual(generator.documentKindForCourse(course('EE492')), 'fes');
assert.strictEqual(generator.documentKindForCourse(course('EE351')), 'cs');
assert.strictEqual(generator.filenameForCourse('EE 492', 'fes'), 'EE492_NCAAA_Field_Experience_Specification.docx');
assert.strictEqual(generator.templateUrlForCourse(course('EE492'), {cs: 'cs.docx', fes: 'fes.docx'}), 'fes.docx');
assert.strictEqual(generator.templateUrlForCourse(course('EE351'), {cs: 'cs.docx', fes: 'fes.docx'}), 'cs.docx');
const ee492 = generator.validateAndBuildValues(course('EE492'));
assert.strictEqual(ee492.values.Version, '2');
assert.strictEqual(ee492.values.Revision_Date, 'Aug-26');
assert.strictEqual(ee492.values.COUNCIL_COMMITTEE, 'Department Council');
assert.strictEqual(ee492.values.REFERENCE_NO, '2');
assert.strictEqual(ee492.values.Date_of_Approval, 'August 2026');
const ee492Clo23 = course('EE492').clos.find(clo => generator.cloCode(clo.clo_number) === '2.3');
assert.strictEqual(ee492.values.CLO_6, ee492Clo23.clo_text);
assert.strictEqual(ee492.values.MPLO6, ee492Clo23.mapped_sos.join(', '));
assert.strictEqual(ee492.values.CLO_6_TS, ee492Clo23.teaching_strategy.join('; '));
assert.strictEqual(ee492.values.CLO_6_AM, ee492Clo23.assessment_methods.join('; '));
const ee490 = generator.validateAndBuildValues(course('EE490'));
const clo33 = course('EE490').clos.find(clo => generator.cloCode(clo.clo_number) === '3.3');
assert.strictEqual(ee490.values.CLO_11, clo33.clo_text);
assert.strictEqual(ee490.values.MPLO11, clo33.mapped_sos.join(', '));
assert.strictEqual(ee490.values.CLO_11_TS, clo33.teaching_strategy.join('; '));
assert.strictEqual(ee490.values.CLO_11_AM, clo33.assessment_methods.join('; '));
assert.strictEqual(generator.fieldName(' MERGEFIELD "CLO_11_TS" \\* MERGEFORMAT '), 'CLO_11_TS');
assert.throws(() => generator.validateAndBuildValues({ course_code: 'EE X' }), /missing required general field/);

console.log('Browser generator unit tests passed.');
