import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';

const workbookPath = 'data/EE Program Design Full ABET.xlsx';
const curriculumPath = 'data/ee_curriculum.json';
const sourcePath = 'data/ee_course_topics_contact_hours.json';
const auditOnly = process.argv.includes('--audit-only');

const cleanText = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\u00a0/g, ' ').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
};
const normalizeCode = (value) => {
  const match = cleanText(value).match(/^([A-Za-z]+)\s*([0-9]{3})$/);
  return match ? `${match[1].toUpperCase()} ${match[2]}` : null;
};
const isPlaceholder = (value) => /^(?:N\/?A|NA|NONE|-|0)$/i.test(cleanText(value));
const canonicalReference = (value) => cleanText(value).toLocaleLowerCase('en');
const unique = (values) => [...new Set(values)];
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

const curriculumText = await fs.readFile(curriculumPath, 'utf8');
const curriculum = JSON.parse(curriculumText);
const courses = curriculum.curriculum?.courses;
if (!Array.isArray(courses)) throw new Error('Missing curriculum.courses array');
const coreCourses = courses.filter((course) => cleanText(course.required_or_elective).toLowerCase() !== 'elective');
const electiveCourses = courses.filter((course) => cleanText(course.required_or_elective).toLowerCase() === 'elective');
if (courses.length !== 32 || coreCourses.length !== 16 || electiveCourses.length !== 16) {
  throw new Error(`Unexpected course population: ${courses.length} total, ${coreCourses.length} core, ${electiveCourses.length} elective`);
}

const protectedBefore = new Map(courses.map((course) => {
  const { course_topics, total_topic_contact_hours, references, ...protectedCourse } = course;
  return [course.course_code, JSON.stringify(protectedCourse)];
}));

const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(workbookPath));
const sourceCourses = {};
const audit = [];

for (const course of coreCourses) {
  const code = normalizeCode(course.course_code);
  if (!code) throw new Error(`Invalid curriculum course code: ${course.course_code}`);
  let sheet;
  try {
    sheet = workbook.worksheets.getItem(code);
  } catch {
    audit.push({ course_code: code, credits: course.credit_hours, topic_count: 0, topic_hours_total: 0, expected: null, difference: null, status: 'MISMATCH', reference_count: 0, anomalies: ['Missing course worksheet'], reference_action: 'No source' });
    continue;
  }

  const sheetCode = normalizeCode(sheet.getRange('A2').values?.[0]?.[0]);
  if (sheetCode !== code) throw new Error(`${code}: worksheet A2 contains ${sheetCode ?? 'no valid course code'}`);

  const topicRows = sheet.getRange('C21:D30').values;
  const topics = [];
  const anomalies = [];
  for (let index = 0; index < topicRows.length; index += 1) {
    const excelRow = 21 + index;
    const topic = cleanText(topicRows[index]?.[0]);
    const rawHours = topicRows[index]?.[1];
    const hoursBlank = rawHours === null || rawHours === undefined || cleanText(rawHours) === '';
    if (!topic && hoursBlank) continue;
    if (topic && hoursBlank) {
      anomalies.push(`Row ${excelRow}: topic present but contact hours missing`);
      continue;
    }
    if (!topic && !hoursBlank) {
      anomalies.push(`Row ${excelRow}: contact hours present without a topic`);
      continue;
    }
    const hours = typeof rawHours === 'number' ? rawHours : Number(cleanText(rawHours));
    if (!Number.isFinite(hours) || hours <= 0) {
      anomalies.push(`Row ${excelRow}: invalid contact hours ${JSON.stringify(rawHours)}`);
      continue;
    }
    topics.push({ topic_number: topics.length + 1, topic_title: topic, contact_hours: hours });
  }

  const total = topics.reduce((sum, topic) => sum + topic.contact_hours, 0);
  const credits = Number(course.credit_hours);
  const expected = credits === 3 ? 60 : credits === 4 ? 90 : null;
  if (expected === null) anomalies.push(`Unclear credit-hour value: ${JSON.stringify(course.credit_hours)}`);
  if (topics.length < 1 || topics.length > 10) anomalies.push(`Topic count ${topics.length} is outside 1–10`);
  const difference = expected === null ? null : total - expected;
  if (expected !== null && difference !== 0) anomalies.push(`Topic-hour total ${total} differs from expected ${expected}`);

  const references = sheet.getRange('C18:C20').values
    .flat()
    .map(cleanText)
    .filter((value) => value && !isPlaceholder(value));
  const deduplicatedReferences = unique(references.map(canonicalReference)).length === references.length;
  if (!deduplicatedReferences) anomalies.push('Duplicate R1/R2/R3 references in workbook');

  const existingReferences = Array.isArray(course.references) ? course.references.map(cleanText).filter(Boolean) : [];
  const existingCanonical = existingReferences.map(canonicalReference);
  const workbookCanonical = references.map(canonicalReference);
  let referenceAction = 'No workbook references';
  if (references.length && existingReferences.length === 0) referenceAction = 'Fill from workbook';
  else if (references.length && JSON.stringify(existingCanonical) === JSON.stringify(workbookCanonical)) referenceAction = 'Equivalent; retain existing';
  else if (references.length && existingReferences.length) referenceAction = 'CONFLICT; retain existing';

  const status = anomalies.length === 0 ? 'PASS' : 'MISMATCH';
  sourceCourses[code] = {
    course_title: cleanText(sheet.getRange('C2').values?.[0]?.[0]),
    course_topics: topics,
    total_topic_contact_hours: total,
    references,
    validation_status: status,
    anomalies,
  };
  audit.push({
    course_code: code,
    credits,
    topic_count: topics.length,
    topic_hours_total: total,
    expected,
    difference,
    status,
    reference_count: references.length,
    reference_action: referenceAction,
    anomalies,
  });
}

const summary = {
  workbook: workbookPath,
  total_courses: courses.length,
  core_courses: coreCourses.length,
  electives: electiveCourses.length,
  passing_core_courses: audit.filter((row) => row.status === 'PASS').length,
  mismatched_core_courses: audit.filter((row) => row.status === 'MISMATCH').length,
  total_valid_topics: audit.filter((row) => row.status === 'PASS').reduce((sum, row) => sum + row.topic_count, 0),
  row_anomalies: audit.flatMap((row) => row.anomalies.filter((item) => item.startsWith('Row '))).length,
  reference_conflicts: audit.filter((row) => row.reference_action.startsWith('CONFLICT')).length,
  audit,
};

if (auditOnly) {
  console.log(JSON.stringify(summary, null, 2));
  process.exit(0);
}

for (const course of courses) {
  const code = normalizeCode(course.course_code);
  const source = sourceCourses[code];
  if (source?.validation_status === 'PASS') {
    course.course_topics = source.course_topics;
    course.total_topic_contact_hours = source.total_topic_contact_hours;
  } else {
    if (!Array.isArray(course.course_topics)) course.course_topics = [];
    if (!Object.hasOwn(course, 'total_topic_contact_hours')) course.total_topic_contact_hours = null;
  }

  if (source?.references.length) {
    const existingReferences = Array.isArray(course.references) ? course.references.map(cleanText).filter(Boolean) : [];
    const existingCanonical = existingReferences.map(canonicalReference);
    const workbookCanonical = source.references.map(canonicalReference);
    if (existingReferences.length === 0) course.references = source.references;
    else if (JSON.stringify(existingCanonical) !== JSON.stringify(workbookCanonical)) {
      // Existing validated values win; the discrepancy remains visible in the audit.
    }
  }
}

for (const course of courses) {
  const { course_topics, total_topic_contact_hours, references, ...protectedCourse } = course;
  if (JSON.stringify(protectedCourse) !== protectedBefore.get(course.course_code)) {
    throw new Error(`${course.course_code}: protected curriculum content changed`);
  }
}

const sourceDocument = {
  source_file: 'EE Program Design Full ABET.xlsx',
  source_ranges: { topics: 'C21:C30', contact_hours: 'D21:D30', references: 'C18:C20' },
  courses: sourceCourses,
};
const sourceOutput = `${JSON.stringify(sourceDocument, null, 2)}\n`;
const curriculumOutput = `${JSON.stringify(curriculum, null, 2)}\n`;
await fs.writeFile(sourcePath, sourceOutput, 'utf8');
await fs.writeFile(curriculumPath, curriculumOutput, 'utf8');

console.log(JSON.stringify({
  ...summary,
  source_output: sourcePath,
  curriculum_output: curriculumPath,
  source_sha256: sha256(sourceOutput),
  curriculum_sha256: sha256(curriculumOutput),
}, null, 2));
