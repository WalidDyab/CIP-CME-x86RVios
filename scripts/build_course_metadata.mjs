import fs from 'node:fs/promises';
import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';

const workbookPath = 'data/course-additional-data.xlsx';
const curriculumPath = 'data/ee_curriculum_with_sos_pis.json';
const electiveCataloguePath = 'data/ee_elective_catalogue_metadata.json';
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
const electiveCatalogue = JSON.parse(await fs.readFile(electiveCataloguePath, 'utf8'));
let existingOutputCourses = [];
try {
  existingOutputCourses = JSON.parse(await fs.readFile(outputPath, 'utf8')).courses ?? [];
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const existingOutputByCode = new Map(existingOutputCourses.map((course) => [normalizeCourseCode(course.course_code), course]));

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
  const existingDescription = cleanText(current.course_description ?? current.description) || null;
  const workbookDescription = isMissing(row[column['Course Description']]) ? null : cleanText(row[column['Course Description']]);
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
    course_description: existingDescription || workbookDescription,
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

const electiveMergeAudit = [];
for (const catalogueCourse of electiveCatalogue.courses ?? []) {
  const courseCode = normalizeCourseCode(catalogueCourse.course_code);
  const current = currentByCode.get(courseCode);
  if (!current) throw new Error(`Unresolved elective catalogue course code: ${courseCode}`);

  const catalogueDescription = cleanText(catalogueCourse.course_description) || null;
  const catalogueOutcomes = (catalogueCourse.catalogue_learning_outcomes ?? []).map(cleanText).filter(Boolean);
  const existing = existingOutputByCode.get(courseCode);
  const currentPortalDescription = cleanText(current.course_description ?? current.description) || null;
  let record = courses.find((course) => normalizeCourseCode(course.course_code) === courseCode);

  if (!record && existing) record = structuredClone(existing);
  if (!record && (catalogueDescription || catalogueOutcomes.length || currentPortalDescription)) {
    record = {
      course_code: cleanText(current.course_code),
      course_title: cleanText(current.course_title),
      prerequisites: [],
      prerequisite_text: null,
      corequisites: [],
      corequisite_text: null,
      course_description: currentPortalDescription,
      course_objectives: [],
      textbooks: [],
      references: [],
    };
  }

  if (!record) {
    electiveMergeAudit.push({ course_code: courseCode, status: 'No usable catalogue data' });
    continue;
  }

  const descriptionBefore = cleanText(record.course_description) || null;
  const outcomesBefore = Array.isArray(record.catalogue_learning_outcomes) ? record.catalogue_learning_outcomes.filter(Boolean) : [];
  if (!descriptionBefore && catalogueDescription) record.course_description = catalogueDescription;
  if (!outcomesBefore.length && catalogueOutcomes.length) record.catalogue_learning_outcomes = catalogueOutcomes;
  if (!courses.includes(record)) courses.push(record);

  electiveMergeAudit.push({
    course_code: courseCode,
    description: descriptionBefore ? 'Preserved' : catalogueDescription ? 'Filled previously empty field' : 'No usable catalogue data',
    catalogue_learning_outcomes: outcomesBefore.length ? 'Preserved' : catalogueOutcomes.length ? 'Filled previously empty field' : 'No usable catalogue data',
  });
}

const output = {
  metadata: {
    source: 'course-additional-data.xlsx',
    scope: 'Undergraduate EE non-elective courses',
    elective_catalogue_source: 'Electives-Catalogue.pdf',
    merge_policy: 'Fill missing fields only; existing portal values take precedence',
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
  workbook_courses: validationRows.length,
  metadata_courses: courses.length,
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
  elective_merge_audit: electiveMergeAudit,
}, null, 2));
