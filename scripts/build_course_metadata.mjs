import fs from 'node:fs/promises';
import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';

const workbookPath = 'data/course-additional-data.xlsx';
const curriculumPath = 'data/ee_curriculum_with_sos_pis.json';
const outputPath = 'data/ee_course_metadata.json';

const cleanText = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
};

const isMissing = (value) => {
  const text = cleanText(value);
  return !text || /^(?:NA|N\/A)$/i.test(text) || text === '28' || text === '0';
};

const normalizeCourseCode = (value) => {
  const match = cleanText(value).match(/^([A-Za-z]+)\s*([0-9]+)$/);
  return match ? `${match[1].toUpperCase()} ${match[2]}` : null;
};

const extractCourseCodes = (value) => {
  const text = cleanText(value);
  const codes = [];
  for (const match of text.matchAll(/\b([A-Za-z]{2,6})\s*([0-9]{3})\b/g)) {
    if (match[1].toUpperCase() === 'OF') continue;
    const code = `${match[1].toUpperCase()} ${match[2]}`;
    if (!codes.includes(code)) codes.push(code);
  }
  return codes;
};

const sourceBlob = await FileBlob.load(workbookPath);
const workbook = await SpreadsheetFile.importXlsx(sourceBlob);
const sheet = workbook.worksheets.getItemAt(0);
const values = sheet.getUsedRange(true).values;
const headers = values[0].map(cleanText);
const column = Object.fromEntries(headers.map((header, index) => [header, index]));

const requiredHeaders = [
  'Course Code:', 'Course Title', 'Pre-req.:', 'Co-req.:', 'Course Description',
  'Textbook', 'Ref. 1', 'Ref. 2', 'Ref. 3', 'Objective', 'Objective 2', 'Objective 3',
];
for (const header of requiredHeaders) {
  if (!(header in column)) throw new Error(`Missing required workbook column: ${header}`);
}

const curriculum = JSON.parse(await fs.readFile(curriculumPath, 'utf8'));
const curriculumCourses = curriculum.curriculum?.courses ?? [];
const currentByCode = new Map(curriculumCourses.map((course) => [normalizeCourseCode(course.course_code), course]));

const courses = [];
const validationRows = [];
for (const row of values.slice(1)) {
  const workbookCode = normalizeCourseCode(row[column['Course Code:']]);
  if (!workbookCode) continue;
  const current = currentByCode.get(workbookCode);
  const workbookTitle = cleanText(row[column['Course Title']]);
  if (!current) throw new Error(`Unresolved workbook course code: ${workbookCode}`);

  const prerequisiteText = isMissing(row[column['Pre-req.:']]) ? null : cleanText(row[column['Pre-req.:']]);
  const corequisiteText = isMissing(row[column['Co-req.:']]) ? null : cleanText(row[column['Co-req.:']]);
  const objectives = ['Objective', 'Objective 2', 'Objective 3']
    .map((name) => row[column[name]])
    .filter((value) => !isMissing(value))
    .map(cleanText);
  const textbooks = isMissing(row[column.Textbook]) ? [] : [cleanText(row[column.Textbook])];
  const references = ['Ref. 1', 'Ref. 2', 'Ref. 3']
    .map((name) => row[column[name]])
    .filter((value) => !isMissing(value))
    .map(cleanText);

  courses.push({
    course_code: cleanText(current.course_code),
    course_title: cleanText(current.course_title),
    prerequisites: prerequisiteText ? extractCourseCodes(prerequisiteText) : [],
    prerequisite_text: prerequisiteText,
    corequisites: corequisiteText ? extractCourseCodes(corequisiteText) : [],
    corequisite_text: corequisiteText,
    course_description: isMissing(row[column['Course Description']]) ? null : cleanText(row[column['Course Description']]),
    course_objectives: objectives,
    textbooks,
    references,
  });

  validationRows.push({
    course_code: workbookCode,
    workbook_title: workbookTitle,
    existing_title: cleanText(current.course_title),
    title_match: workbookTitle === cleanText(current.course_title) ? 'exact' :
      workbookTitle.toLowerCase() === cleanText(current.course_title).toLowerCase() ? 'minor formatting difference' : 'substantive difference',
  });
}

const output = {
  metadata: {
    source: 'course-additional-data.xlsx',
    scope: 'Undergraduate EE non-elective courses',
  },
  courses,
};

await fs.writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

const externalRequirements = [];
for (const course of courses) {
  for (const [kind, codes] of [['prerequisite', course.prerequisites], ['corequisite', course.corequisites]]) {
    for (const code of codes) {
      if (!currentByCode.has(code)) externalRequirements.push({ course_code: course.course_code, kind, code });
    }
  }
}

console.log(JSON.stringify({
  sheet_names: workbook.worksheets.items.map((item) => item.name),
  headers,
  workbook_courses: courses.length,
  matched_courses: validationRows.length,
  unmatched_courses: 0,
  title_matches: validationRows,
  counts: {
    prerequisites: courses.filter((course) => course.prerequisite_text).length,
    corequisites: courses.filter((course) => course.corequisite_text).length,
    descriptions: courses.filter((course) => course.course_description).length,
    objectives: courses.filter((course) => course.course_objectives.length).length,
    textbooks: courses.filter((course) => course.textbooks.length).length,
    references: courses.filter((course) => course.references.length).length,
  },
  external_or_unresolved_requirement_codes: externalRequirements,
}, null, 2));
