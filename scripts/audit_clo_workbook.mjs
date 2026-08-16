import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';

const workbookPath = process.argv[2] || 'data/EE Program CLO-SO-PI Mapping.xlsx';
const requestedCodes = new Set((process.argv[3] || '').split(',').map((value) => value.trim()).filter(Boolean));
const clean = (value) => value == null ? '' : String(value).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
const normalizeCode = (value) => {
  const match = clean(value).match(/^EE\s*(\d{3})$/i);
  return match ? `EE ${match[1]}` : '';
};
const normalizeId = (value) => {
  if (typeof value === 'number') return Number(value.toPrecision(12)).toString();
  return clean(value);
};
const isSelected = (value) => {
  const text = clean(value).toUpperCase();
  return value === true || (typeof value === 'number' && value !== 0) || ['X', 'Y', 'YES', 'TRUE', 'I', 'P', 'M', '1'].includes(text);
};

const blob = await FileBlob.load(workbookPath);
const workbook = await SpreadsheetFile.importXlsx(blob);
const courses = [];

for (const sheet of workbook.worksheets.items) {
  const values = sheet.getUsedRange(true).values;
  const code = normalizeCode(values?.[1]?.[0] || sheet.name);
  if (!code) continue;
  const piHeaders = (values?.[3] || []).slice(4, 22).map(clean);
  const clos = [];
  for (let index = 4; index < values.length; index += 1) {
    const row = values[index] || [];
    if (clean(row[0]).toLowerCase() === 'aligned pis' || clean(row[1]).toLowerCase() === 'aligned pis') break;
    const text = clean(row[2]);
    if (!text) continue;
    const pis = piHeaders.filter((pi, offset) => pi && isSelected(row[offset + 4]));
    clos.push({
      excel_row: index + 1,
      domain: clean(row[0]),
      clo_id: normalizeId(row[1]),
      clo_text: text,
      selected_pis: pis,
      raw_pi_cells: row.slice(4, 22),
    });
  }
  courses.push({
    sheet: sheet.name,
    course_code: code,
    course_id: clean(values?.[1]?.[1]),
    course_title: clean(values?.[1]?.[2]),
    performance_level: clean(values?.[1]?.[3]),
    clos,
  });
}

console.log(JSON.stringify({
  workbook: workbookPath,
  sheet_names: workbook.worksheets.items.map((sheet) => sheet.name),
  course_count: courses.length,
  clo_count: courses.reduce((sum, course) => sum + course.clos.length, 0),
  courses: requestedCodes.size ? courses.filter((course) => requestedCodes.has(course.course_code)) : courses,
}, null, 2));
