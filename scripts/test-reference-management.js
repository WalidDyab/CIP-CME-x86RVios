'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const reference = require('../assets/reference-management.js');

const root = path.resolve(__dirname, '..');
const curriculum = JSON.parse(fs.readFileSync(path.join(root, 'data/ee_curriculum.json'), 'utf8'));
const courses = curriculum.curriculum.courses;

const book = reference.parseBibtex(`@book{example,
  author = {John A. Smith and Mary B. Jones},
  title = {Modern Power Systems},
  edition = {5},
  publisher = {Example Press},
  year = {2024},
  isbn = {978-1-2345-6789-0},
  url = {https://example.edu/book}
}`);
assert.deepStrictEqual(book, {
  type:'book', authors:'John A. Smith, Mary B. Jones', title:'Modern Power Systems', edition:'5',
  publisher:'Example Press', year:'2024', isbn:'978-1-2345-6789-0', url:'https://example.edu/book', location:''
});
assert.strictEqual(reference.formatBook(book), 'John A. Smith, Mary B. Jones, Modern Power Systems, 5th ed., Example Press, 2024.');
assert.strictEqual(reference.formatBook({...book, edition:''}), 'John A. Smith, Mary B. Jones, Modern Power Systems, Example Press, 2024.');
assert.throws(() => reference.parseBibtex('@article{x, title={No}}'), /Only @book/);
assert.throws(() => reference.validateBook({authors:'A',title:'T',publisher:'P',year:'24'}), /four digits/);
assert.throws(() => reference.validateBook({authors:'A',title:'T',publisher:'P',year:'2024',url:'ftp://example.com'}), /http or https/);

const populated = courses.find(course => course.course_code === 'EE 312');
const slots = reference.referenceSlots(populated);
assert.strictEqual(slots.length, 4);
assert.strictEqual(slots[0].role, 'Main Textbook');
assert(slots[0].current);
assert.strictEqual(slots[3].role, 'Additional Reference 3');
assert(slots[3].current);
assert.deepStrictEqual(reference.operationsForSlot(slots[0]), ['Keep', 'Change', 'Remove']);
assert.deepStrictEqual(reference.operationsForSlot({current:''}), ['Keep', 'Add']);

const rows = reference.collectProgramReferences(courses);
const expectedRows = courses.reduce((total, course) => total + Math.min((course.textbooks || []).length, 1) + Math.min((course.references || []).length, 3), 0);
assert.strictEqual(rows.length, expectedRows);
assert(rows.some(row => row.courseCode === 'EE 312' && row.role === 'Additional Reference 3'));
assert(rows.every(row => row.citation && row.courseCode && row.courseTitle));
assert.strictEqual(reference.referenceSlots({textbooks:[],references:[]}).filter(slot => slot.current).length, 0);

console.log(`Reference-management tests passed (${rows.length} current course-reference rows).`);
