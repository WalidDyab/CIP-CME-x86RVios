import fs from 'node:fs/promises';

const curriculumPath = 'data/ee_curriculum_with_sos_pis.json';
const mappingPath = 'data/ee_program_clo_so_pi_mapping.json';

const PI_TO_SO = Object.fromEntries([
  ['PI11', 'SO1'], ['PI12', 'SO1'],
  ['PI21', 'SO2'], ['PI22', 'SO2'], ['PI23', 'SO2'], ['PI24', 'SO2'],
  ['PI31', 'SO3'], ['PI32', 'SO3'],
  ['PI41', 'SO4'], ['PI42', 'SO4'],
  ['PI51', 'SO5'], ['PI52', 'SO5'],
  ['PI61', 'SO6'], ['PI62', 'SO6'], ['PI63', 'SO6'], ['PI64', 'SO6'],
  ['PI71', 'SO7'], ['PI72', 'SO7'],
]);

const piSort = (a, b) => Number(a.slice(2)) - Number(b.slice(2));
const soSort = (a, b) => Number(a.slice(2)) - Number(b.slice(2));
const uniqueSorted = (values, sorter) => [...new Set(values)].sort(sorter);

const curriculum = JSON.parse(await fs.readFile(curriculumPath, 'utf8'));
const mapping = JSON.parse(await fs.readFile(mappingPath, 'utf8'));
const curriculumCourses = curriculum.curriculum.courses;
const mappingCourses = mapping.courses;
const curriculumByCode = new Map(curriculumCourses.map((course) => [course.course_code, course]));
const mappingByCode = new Map(mappingCourses.map((course) => [course.course_code, course]));

const protectedBefore = Object.fromEntries(['EE 101', 'EE 322'].map((code) => [code, {
  curriculum: JSON.stringify(curriculumByCode.get(code)),
  mapping: JSON.stringify(mappingByCode.get(code)),
  overview: JSON.stringify(mapping.mapping_overview.find((row) => row.course_code === code)),
}]));

const findClo = (course, id, idField) => course.clos.find((clo) => String(clo[idField]) === String(id));

function setCurriculumCloPis(courseCode, cloId, pis) {
  const clo = findClo(curriculumByCode.get(courseCode), cloId, 'clo_number');
  if (!clo) throw new Error(`Missing curriculum CLO ${courseCode} ${cloId}`);
  clo.pi_codes = uniqueSorted(pis, piSort);
  clo.mapped_sos = uniqueSorted(clo.pi_codes.map((pi) => PI_TO_SO[pi]), soSort);
}

function setMappingCloPis(courseCode, cloId, pis) {
  const clo = findClo(mappingByCode.get(courseCode), cloId, 'clo_id');
  if (!clo) throw new Error(`Missing mapping CLO ${courseCode} ${cloId}`);
  clo.aligned_pis = uniqueSorted(pis, piSort);
  clo.aligned_sos = uniqueSorted(clo.aligned_pis.map((pi) => PI_TO_SO[pi]), soSort);
}

function addPis(courseCode, cloId, pis) {
  const curriculumClo = findClo(curriculumByCode.get(courseCode), cloId, 'clo_number');
  const mappingClo = findClo(mappingByCode.get(courseCode), cloId, 'clo_id');
  setCurriculumCloPis(courseCode, cloId, [...curriculumClo.pi_codes, ...pis]);
  setMappingCloPis(courseCode, cloId, [...mappingClo.aligned_pis, ...pis]);
}

function removePis(courseCode, cloId, pis) {
  const blocked = new Set(pis);
  const curriculumClo = findClo(curriculumByCode.get(courseCode), cloId, 'clo_number');
  const mappingClo = findClo(mappingByCode.get(courseCode), cloId, 'clo_id');
  setCurriculumCloPis(courseCode, cloId, curriculumClo.pi_codes.filter((pi) => !blocked.has(pi)));
  setMappingCloPis(courseCode, cloId, mappingClo.aligned_pis.filter((pi) => !blocked.has(pi)));
}

// EE 202: workbook wording/IDs, with TS/AM retained by semantic CLO association.
{
  const curriculumCourse = curriculumByCode.get('EE 202');
  const mappingCourse = mappingByCode.get('EE 202');
  const oldCurriculum = new Map(curriculumCourse.clos.map((clo) => [String(clo.clo_number), clo]));
  const definitions = [
    ['1.1', 'Knowledge', 'Knowledge and understanding', 'Recognize the application of the basic electric circuit components in different electrical applications.', ['PI11', 'PI12'], '1.1'],
    ['2.1', 'Skills', 'Skills', 'Analyze first-order and second-order transient reponse of electrical circuits.', ['PI63', 'PI64'], '2.1'],
    ['2.2', 'Skills', null, 'Apply the Laplace transform in circuit analysis.', ['PI63', 'PI64'], '2.2'],
    ['2.3', 'Skills', null, 'Analyze frequency selective circuits, three-phase and two-port networks.', ['PI63', 'PI64'], '2.3'],
    // The workbook B13 cell is blank; 3.1 is the established Values-domain identifier.
    ['3.1', 'Values', 'Values, autonomy and responsibility', 'Acquire new circuit-analysis knowledge using appropriate learning strategies and apply it to solve circuit problems.', ['PI71'], '2.4'],
  ];
  curriculumCourse.clos = definitions.map(([id, nqf, , text, pis, metadataId]) => {
    const metadata = oldCurriculum.get(id) || oldCurriculum.get(metadataId);
    return {
      clo_number: Number(id),
      nqf_domain: nqf,
      clo_text: text,
      mapped_sos: uniqueSorted(pis.map((pi) => PI_TO_SO[pi]), soSort),
      pi_codes: pis,
      teaching_strategy: [...(metadata?.teaching_strategy || [])],
      assessment_methods: [...(metadata?.assessment_methods || [])],
    };
  });
  mappingCourse.clos = definitions.map(([id, nqf, domain, text, pis]) => ({
    domain,
    clo_id: Number(id),
    nqf_domain: nqf,
    clo_text: text,
    aligned_sos: uniqueSorted(pis.map((pi) => PI_TO_SO[pi]), soSort),
    aligned_pis: pis,
  }));
}

// Targeted course-level PDF reconciliation, assigned to the closest supporting CLO.
addPis('EE 341', '2.3', ['PI31']);
addPis('EE 403', '2.3', ['PI12']);

// Remaining approved PI-grid gaps in populated courses.
addPis('EE 305', '2.1', ['PI23']);
addPis('EE 305', '3.1', ['PI62', 'PI63', 'PI64', 'PI72']);
// Do not force PI72 onto these elective CLOs: neither wording demonstrates
// application of newly acquired knowledge, so the PDF-level gap remains a
// documented faculty-review item rather than an unsupported CLO mapping.
removePis('EE 426', '3.1', ['PI72']);
removePis('EE 456', '3.1', ['PI72']);

const levelOverrides = {
  'EE 211': { PI31: 'P', PI32: 'P' },
  'EE 490': { PI41: 'P', PI42: 'P' },
  'EE 492': { PI41: 'P', PI42: 'P' },
};

const changedCodes = new Set(['EE 202', 'EE 211', 'EE 305', 'EE 341', 'EE 403', 'EE 426', 'EE 456', 'EE 490', 'EE 492']);
for (const code of changedCodes) {
  const course = mappingByCode.get(code);
  const pis = uniqueSorted(course.clos.flatMap((clo) => clo.aligned_pis || []), piSort);
  const sos = uniqueSorted(pis.map((pi) => PI_TO_SO[pi]), soSort);
  course.overall_aligned_pis = pis;
  course.overall_aligned_sos = sos;
  const overrides = levelOverrides[code] || {};
  course.mapping_pi_levels = Object.fromEntries(pis.map((pi) => [pi, overrides[pi] || course.mapping_pi_levels[pi] || course.performance_level]));
  const overview = mapping.mapping_overview.find((row) => row.course_code === code);
  if (!overview) throw new Error(`Missing mapping overview row for ${code}`);
  overview.aligned_sos = [...sos];
  overview.pi_levels = { ...course.mapping_pi_levels };
}

for (const code of ['EE 101', 'EE 322']) {
  const after = {
    curriculum: JSON.stringify(curriculumByCode.get(code)),
    mapping: JSON.stringify(mappingByCode.get(code)),
    overview: JSON.stringify(mapping.mapping_overview.find((row) => row.course_code === code)),
  };
  for (const key of Object.keys(after)) {
    if (after[key] !== protectedBefore[code][key]) throw new Error(`${code} ${key} changed unexpectedly`);
  }
}

await fs.writeFile(curriculumPath, `${JSON.stringify(curriculum, null, 2)}\n`, 'utf8');
await fs.writeFile(mappingPath, `${JSON.stringify(mapping, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({ changed_courses: [...changedCodes], protected_courses: ['EE 101', 'EE 322'] }, null, 2));
