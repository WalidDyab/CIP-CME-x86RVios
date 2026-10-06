'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
global.referenceManagement = require('../assets/reference-management.js');
const order = require('../assets/textbook-order-generator.js');

const root = path.resolve(__dirname, '..');
const dataPath = path.join(root, 'data/ee_curriculum.json');
const before = fs.readFileSync(dataPath);
const courses = JSON.parse(before.toString('utf8')).curriculum.courses;

// Every course with a main textbook is listed, required and elective alike, in curriculum order.
const {entries, withoutTextbook} = order.collectMainTextbooks(courses);
const expected = courses.filter(course => (course.textbooks || []).some(item => String(item).trim()));
assert.deepStrictEqual(entries.map(entry => entry.courseCode), expected.map(course => course.course_code));
assert.strictEqual(entries.length + withoutTextbook.length, courses.length);
assert(entries.some(entry => entry.requirement === 'Elective'), 'electives with a main textbook are included');
assert(entries.some(entry => entry.requirement === 'Required'));
// Only the main textbook: supportive references never appear.
const references = courses.flatMap(course => course.references || []);
assert(references.length);
assert(entries.every(entry => !references.includes(entry.citation)));
assert(entries.every(entry => entry.citation === expected.find(course => course.course_code === entry.courseCode).textbooks[0].replace(/\s+/g, ' ').trim()));
// Nothing is invented: order metadata that is not on record stays blank.
// Quantity stays generation-time only; the program confirmed no main textbook ships with an access code.
assert(entries.every(entry => entry.quantity === '' && entry.accessCode === 'No' && entry.accessDuration === ''));
// Term 241 quantities are optional, editable estimates kept outside the curriculum record.
const estimates = JSON.parse(fs.readFileSync(path.join(root, 'data/textbook_order_estimates.json'), 'utf8')).quantities;
const estimated = order.collectMainTextbooks(courses, estimates).entries;
assert(estimated.every(entry => entry.quantity === String(estimates[entry.courseCode] ?? '')));
assert.strictEqual(estimated.find(entry => entry.courseCode === 'EE 101').quantity, '20');
assert.strictEqual(estimated.find(entry => entry.courseCode === 'EE 426').quantity, '');
assert(courses.every(course => !('required_quantity' in course) && !('quantity' in course)), 'quantities never enter curriculum records');
// Elective main textbooks supplied by the department.
for (const [code, title, isbn] of [['EE 426', 'Antenna Theory: Analysis and Design', '978-1-118-64206-1'], ['EE 425', 'Wireless Communications', '978-0-521-83716-3'], ['EE 424', 'Modern Digital and Analog Communication Systems', '0190686847'],
  ['EE 417', 'RF Microelectronics', '978-0-13-713473-1'], ['EE 442', 'Digital Signal Processing', '978-0-13-187374-2'], ['EE 416', 'RISC-V System-on-Chip Design', '978-0-323-99498-9']]) {
  const entry = entries.find(item => item.courseCode === code);
  assert.deepStrictEqual([entry.requirement, entry.title, entry.isbn], ['Elective', title, isbn], code);
}

// Uncertain citations leave structured fields blank; the full citation is never used as the title.
assert(entries.every(entry => entry.title !== entry.citation && !entry.title.includes(entry.citation)));
const byCode = code => entries.find(entry => entry.courseCode === code);
// Metadata recovered from the Term 241 Required form, only where it is the same book and edition.
assert.deepStrictEqual([byCode('EE 332').title, byCode('EE 332').author, byCode('EE 332').edition, byCode('EE 332').isbn, byCode('EE 332').publisher], ['Modern Control Engineering', 'Katsuhiko Ogata', '5th', '9780136156734', 'Pearson']);
assert.deepStrictEqual([byCode('EE 351').title, byCode('EE 351').author, byCode('EE 351').isbn, byCode('EE 351').publisher], ['Modern Digital and Analog Communication Systems', 'B. P. Lathi, Zhi Ding', '0190686847', 'Oxford University Press']);
assert.deepStrictEqual([byCode('EE 403').title, byCode('EE 403').author, byCode('EE 403').edition, byCode('EE 403').isbn], ['Power System Engineering', 'D. P. Kothari, I. J. Nagrath', '3rd', '9353165113']);
assert.strictEqual(byCode('EE 201').isbn, '978-1-292-09895-1');
assert.strictEqual(byCode('EE 341').isbn, '1260084566');
// Latest editions chosen by the department.
assert.deepStrictEqual([byCode('EE 305').edition, byCode('EE 305').isbn], ['5th', '978-0-323-99216-9']);
assert.deepStrictEqual([byCode('EE 490').edition, byCode('EE 490').isbn, byCode('EE 490').publisher], ['6th', '978-0-443-13541-5', 'Elsevier']);
assert.deepStrictEqual([byCode('EE 423').edition, byCode('EE 423').isbn], ['8th Global Edition', '978-1-292-40546-9']);
assert.strictEqual(byCode('EE 304').isbn, '978-93-5501-825-0');
assert.deepStrictEqual([byCode('EE 101').edition, byCode('EE 101').isbn], ['1st', '978-93-87067-01-1']);
assert.strictEqual(byCode('EE 202').isbn, '978-0-07-026096-2');
// Editions the publisher does not state are assumed to be first editions and shown in brackets.
for (const code of ['EE 202', 'EE 304', 'EE 425']) assert.strictEqual(byCode(code).edition, '(1st)', code);
assert.strictEqual(byCode('EE 322').isbn, '978-0-12-820064-3');
assert.deepStrictEqual([byCode('EE 322').title, byCode('EE 322').author, byCode('EE 322').publisher], ['Digital Design and Computer Architecture', 'David Harris and Sarah Harris', 'Elsevier']);
// Different books that share a course code with a historical record are left alone.
assert.strictEqual(byCode('EE 211').isbn, '9781292025643');
assert.strictEqual(byCode('EE 211').edition, '9th');
assert.strictEqual(byCode('EE 312').isbn, '978-1-292-02563-6');
assert.strictEqual(byCode('EE 312').edition, 'Eleventh');
// Descriptive (non-numeric) editions are valid and keep the book's own wording.
assert.strictEqual(byCode('EE 322').edition, 'RISC-V Edition');
assert.strictEqual(byCode('EE 231').edition, '5th Global Edition');
assert.strictEqual(referenceManagement.entryMetadata({textbook_details: [{edition: 'International Edition'}]}, 'textbooks', 0).edition, 'International Edition');
assert.strictEqual(referenceManagement.formatEdition('RISC-V Edition'), 'RISC-V Edition');
assert.doesNotThrow(() => referenceManagement.validateBook({authors: 'A', title: 'T', publisher: 'P', year: '2024', edition: 'Global Edition'}));
for (const edition of ['RISC-V Edition', 'International Edition', 'Global Edition', 'Pearson New International Edition']) {
  const meta = referenceManagement.entryMetadata({textbook_details: [{edition}]}, 'textbooks', 0);
  assert.strictEqual(meta.edition, edition);
  const [stored] = order.collectMainTextbooks([{course_code: 'X', course_title: 'Y', textbooks: ['A. B, "T", Pub, 2020.'], textbook_details: [{edition}]}]).entries;
  assert.strictEqual(stored.edition, edition);
  assert.strictEqual(referenceManagement.formatEdition(edition), edition);
}
for (const edition of ['Conventional Current Version', 'Global Edition']) assert.strictEqual(order.tableRow({courseCode: 'EE 1', edition})[3], edition);
assert.deepStrictEqual([byCode('EE 201').title, byCode('EE 201').author, byCode('EE 201').edition], ['Introductory Circuit Analysis', 'Robert L. Boylestad', '13th']);
assert.deepStrictEqual([byCode('EE 423').title, byCode('EE 423').author], ['Computer Networking: A Top-Down Approach', 'Kurose, J. F., & Ross, K. W.']);
assert.deepStrictEqual([byCode('EE 490').title, byCode('EE 490').author, byCode('EE 490').isbn], ['Exploring Engineering: An Introduction to Engineering and Design', 'Philip Kosky, Robert Balmer, William Keat, George Wise', '978-0-443-13541-5']);
assert.strictEqual(byCode('EE 202').publisher, 'McGraw Hill Education (India)');
assert.strictEqual(order.collectMainTextbooks([{course_code: 'X', course_title: 'Y', textbooks: ['Some unparseable free text']}]).entries[0].title, '');

// Structured details on the course record take precedence over the parsed citation.
const course = {course_code: 'EE 999', course_title: 'Test', required_or_elective: 'Required', textbooks: ['A. Author, "Parsed Title", 2nd edition, Pearson, 2020.'],
  textbook_details: [{edition: '3rd', isbn_print: '978-0-13-422013-0', access_code: 'Yes', access_code_duration_months: 18}]};
const [entry] = order.collectMainTextbooks([course]).entries;
assert.deepStrictEqual([entry.title, entry.edition, entry.author, entry.publisher, entry.isbn, entry.accessCode, entry.accessDuration],
  ['Parsed Title', '3rd', 'A. Author', 'Pearson', '978-0-13-422013-0', 'Yes', '18']);
// A duration is dropped when the access code is not Yes, and unknown durations are ignored.
const meta = referenceManagement.entryMetadata({textbooks: ['x'], textbook_details: [{access_code: 'No', access_code_duration_months: 12}]}, 'textbooks', 0);
assert.strictEqual(meta.accessDuration, '');
assert.strictEqual(referenceManagement.entryMetadata({textbook_details: [{access_code: 'Yes', access_code_duration_months: 6}]}, 'textbooks', 0).accessDuration, '');
assert.strictEqual(referenceManagement.entryMetadata({}, 'references', 2).isbn, '');

// Validation: blanks allowed, malformed values rejected.
const base = {courseCode: 'EE 1', isbn: '', quantity: '', accessCode: '', accessDuration: ''};
assert.deepStrictEqual(order.validateEntry(base), []);
for (const quantity of ['0', '-1', '2.5', 'x']) assert(order.validateEntry({...base, quantity}).length, quantity);
assert.deepStrictEqual(order.validateEntry({...base, quantity: '12', isbn: '978-0-13-422013-0', accessCode: 'Yes', accessDuration: '24'}), []);
assert(order.validateEntry({...base, isbn: '123'}).length);
assert(order.validateEntry({...base, accessCode: 'Yes', accessDuration: '6'}).length);
assert(order.validateEntry({...base, accessCode: 'No', accessDuration: '12'}).length);
assert.doesNotThrow(() => order.validateHeader({term: ''}), 'term is optional');
assert.strictEqual(order.filenameForTerm('', 'alternatives'), 'EE_Alternative_Textbooks.docx');
assert.strictEqual(order.filenameForTerm('261', 'alternatives'), 'EE_Alternative_Textbooks_261.docx');

// Row layout follows the official template columns.
assert.strictEqual(order.COLUMNS.length, 10);
const row = order.tableRow({courseCode: 'EE 1', courseTitle: 'T', title: 'B', edition: '2nd', author: 'A', isbn: '1', publisher: 'P', quantity: '5', accessCode: 'Yes', accessDuration: '12'});
assert.deepStrictEqual(row, ['EE 1', 'T', 'B', '2nd', 'A', '1', 'P', '5', 'Yes', '12 Months']);
assert.strictEqual(order.tableRow({courseCode: 'EE 1', accessCode: 'No'})[9], 'N/A');
assert.strictEqual(order.tableRow({courseCode: 'EE 1'})[9], '');
assert.strictEqual(order.filenameForTerm('261'), 'EE_Required_Textbooks_261.docx');
assert.strictEqual(order.filenameForTerm(' 26 1/2 '), 'EE_Required_Textbooks_26_1_2.docx');

// Add/Modify References form: ISBN and Access Code rules.
const book = {authors: 'A', title: 'T', publisher: 'P', year: '2024'};
assert.doesNotThrow(() => referenceManagement.validateBook({...book, isbn: '9780134746968', accessCode: 'Yes', accessDuration: '12'}));
assert.throws(() => referenceManagement.validateBook({...book, isbn: '12'}), /10 or 13/);
assert.throws(() => referenceManagement.validateBook({...book, accessCode: 'Yes', accessDuration: ''}), /12, 18, or 24/);
assert.throws(() => referenceManagement.validateBook({...book, accessCode: 'Maybe'}), /Yes or No/);

// Alternatives are Reference 1 (references[0]) of each course, read dynamically; supporting references are never used.
const alternatives = order.collectAlternatives(courses);
const withReference1 = courses.filter(course => (course.references || []).some(item => String(item).trim()));
assert.deepStrictEqual(alternatives.entries.map(entry => entry.courseCode), withReference1.map(course => course.course_code));
assert.deepStrictEqual(alternatives.withoutAlternative.map(item => item.courseCode),
  courses.filter(course => (course.textbooks || []).length && !(course.references || []).length).map(course => course.course_code));
assert(alternatives.entries.every(entry => entry.citation === String(withReference1.find(course => course.course_code === entry.courseCode).references[0]).replace(/\s+/g, ' ').trim()));
for (const course of courses.filter(item => item.reference_details)) {
  const entry = alternatives.entries.find(item => item.courseCode === course.course_code), detail = course.reference_details[0];
  assert.deepStrictEqual([entry.title, entry.edition, entry.author, entry.isbn, entry.publisher], [detail.title, detail.edition, detail.author, detail.isbn_print, detail.publisher], course.course_code);
  assert.strictEqual(course.references.length, 1, 'migrated courses carry the alternative as their only reference');
}
for (const entry of alternatives.entries) {
  const course = courses.find(item => item.course_code === entry.courseCode);
  (course.references || []).slice(1).forEach(reference => assert.notStrictEqual(entry.citation, String(reference).replace(/\s+/g, ' ').trim(), 'only Reference 1 is used'));
  assert.notStrictEqual(entry.citation, byCode(entry.courseCode)?.citation, 'an alternative is never the main textbook');
  assert(order.validateAlternative(entry).length === 0, entry.courseCode);
}
// Courses whose existing Reference 1 was not replaced keep their own text (no automatic overwrite).
const draftDoc = JSON.parse(fs.readFileSync(path.join(root, 'data/textbook_alternatives_draft.json'), 'utf8'));
const conflicts = Object.keys(draftDoc.alternatives).filter(code => { const course = courses.find(item => item.course_code === code); return (course.references || []).length && !course.reference_details; });
assert(conflicts.length > 0 && conflicts.every(code => !courses.find(item => item.course_code === code).references[0].includes(draftDoc.alternatives[code][0].author.split(',')[0].trim().split(' ').pop())), 'unreviewed conflicts keep their existing Reference 1');
assert.strictEqual(order.ALT_COLUMNS.length, 7);
assert.strictEqual(order.altTableRow(alternatives.entries[0]).length, 7);
assert(order.validateAlternative({courseCode: 'EE 1', isbn: '123'}).length);
assert(courses.every(course => !('textbook_alternatives' in course)), 'no separate alternatives field in curriculum records');
assert.strictEqual(order.collectAlternatives([{course_code: 'X', course_title: 'Y', textbooks: ['T'], references: []}]).entries.length, 0);
assert.strictEqual(order.collectAlternatives([{course_code: 'X', course_title: 'Y', textbooks: ['T'], references: []}]).withoutAlternative.length, 1);
// NCAAA Course Specification: References keep their order, so Reference 1 (the alternative) is Ref_1.
const ncaaa = require('../assets/ncaaa-cs-generator.js');
let specsChecked = 0;
for (const course of courses.filter(item => item.reference_details)) {
  let built;
  try { built = ncaaa.validateAndBuildValues(course).values; } catch (error) { if (error.name === 'ValidationError') continue; throw error; } // e.g. a course record without a description
  assert.strictEqual(built.Ref_1, course.references[0], course.course_code);
  assert.strictEqual(built.Textbook, course.textbooks[0], course.course_code);
  specsChecked += 1;
}
assert(specsChecked >= 10, 'NCAAA specifications were checked for the migrated courses');
assert(before.equals(fs.readFileSync(dataPath)), 'curriculum data must not change');
console.log(`Textbook-order tests passed (${entries.length} courses with a main textbook, ${withoutTextbook.length} without).`);
