import fs from 'node:fs/promises';

const curriculumPath = 'data/ee_curriculum_with_sos_pis.json';
const mappingPath = 'data/ee_program_clo_so_pi_mapping.json';
const sourcePath = 'data/ee_approved_manual_elective_clos.json';
const targetCodes = new Set(['EE 417', 'EE 454']);
const PI_TO_SO = Object.fromEntries([
  ['PI11', 'SO1'], ['PI12', 'SO1'],
  ['PI21', 'SO2'], ['PI22', 'SO2'], ['PI23', 'SO2'], ['PI24', 'SO2'],
  ['PI31', 'SO3'], ['PI32', 'SO3'],
  ['PI41', 'SO4'], ['PI42', 'SO4'],
  ['PI51', 'SO5'], ['PI52', 'SO5'],
  ['PI61', 'SO6'], ['PI62', 'SO6'], ['PI63', 'SO6'], ['PI64', 'SO6'],
  ['PI71', 'SO7'], ['PI72', 'SO7'],
]);
const TEACHING_VOCABULARY = new Set([
  'Interactive Lectures', 'Guided Problem Solving and Tutorials', 'Case-Based Learning and Technical Discussion',
  'Laboratory Experimentation', 'Simulation and Computer-Based Learning', 'Design- and Project-Based Learning',
  'Collaborative/Team-Based Learning', 'Technical Communication Activities', 'Independent/Self-Directed Learning',
  'Flipped Classroom',
]);
const ASSESSMENT_VOCABULARY = new Set([
  'Quizzes', 'Homework and Classwork Assignments', 'Major and Final Exams', 'Laboratory Practical Assessment',
  'Laboratory Reports', 'Simulation/Computational Assignments', 'Design Project Assignment',
  'Prototype/System Demonstration', 'Oral Technical Presentation', 'Teamwork/Peer Assessment',
]);
const order = (values) => [...new Set(values)].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

const curriculum = JSON.parse(await fs.readFile(curriculumPath, 'utf8'));
const mapping = JSON.parse(await fs.readFile(mappingPath, 'utf8'));
const source = JSON.parse(await fs.readFile(sourcePath, 'utf8'));
const curriculumByCode = new Map(curriculum.curriculum.courses.map((course) => [course.course_code, course]));
const mappingByCode = new Map(mapping.courses.map((course) => [course.course_code, course]));
const overviewByCode = new Map(mapping.mapping_overview.map((course) => [course.course_code, course]));
const sourceByCode = new Map(source.courses.map((course) => [course.course_code, course]));

if (sourceByCode.size !== 2 || [...targetCodes].some((code) => !sourceByCode.has(code))) {
  throw new Error('Approved manual source must contain exactly EE 417 and EE 454');
}

const otherBefore = new Map(curriculum.curriculum.courses
  .filter((course) => !targetCodes.has(course.course_code))
  .map((course) => [course.course_code, JSON.stringify({
    curriculum: course,
    mapping: mappingByCode.get(course.course_code),
    overview: overviewByCode.get(course.course_code),
  })]));

for (const [courseCode, approved] of sourceByCode) {
  const curriculumCourse = curriculumByCode.get(courseCode);
  const mappingCourse = mappingByCode.get(courseCode);
  const overviewCourse = overviewByCode.get(courseCode);
  if (!curriculumCourse || !mappingCourse || !overviewCourse) throw new Error(`Missing course records for ${courseCode}`);

  const ids = approved.clos.map((clo) => String(clo.clo_id));
  if (new Set(ids).size !== ids.length) throw new Error(`Duplicate CLO IDs in ${courseCode}`);
  for (const clo of approved.clos) {
    if (!['Knowledge', 'Skills', 'Values'].includes(clo.nqf_domain)) throw new Error(`Invalid NQF domain in ${courseCode} ${clo.clo_id}`);
    if (clo.teaching_strategy.length < 2 || clo.teaching_strategy.length > 3 || clo.teaching_strategy.some((item) => !TEACHING_VOCABULARY.has(item))) {
      throw new Error(`Invalid Teaching Strategies in ${courseCode} ${clo.clo_id}`);
    }
    if (clo.assessment_methods.length < 4 || clo.assessment_methods.length > 5 || clo.assessment_methods.some((item) => !ASSESSMENT_VOCABULARY.has(item))) {
      throw new Error(`Invalid Assessment Methods in ${courseCode} ${clo.clo_id}`);
    }
    for (const pi of clo.pis) {
      if (!PI_TO_SO[pi]) throw new Error(`Unknown PI ${pi} in ${courseCode} ${clo.clo_id}`);
      if (!['I', 'P', 'M'].includes(approved.pi_levels[pi])) throw new Error(`Unresolved level for ${courseCode} ${pi}`);
    }
  }

  curriculumCourse.clos = approved.clos.map((clo) => ({
    clo_number: clo.clo_id,
    nqf_domain: clo.nqf_domain,
    clo_text: clo.clo_text,
    mapped_sos: order(clo.pis.map((pi) => PI_TO_SO[pi])),
    pi_codes: order(clo.pis),
    teaching_strategy: [...clo.teaching_strategy],
    assessment_methods: [...clo.assessment_methods],
  }));

  const seenDomains = new Set();
  mappingCourse.clos = approved.clos.map((clo) => {
    const domain = seenDomains.has(clo.nqf_domain)
      ? null
      : clo.nqf_domain === 'Knowledge' ? 'Knowledge and understanding'
        : clo.nqf_domain === 'Values' ? 'Values, autonomy and responsibility'
          : 'Skills';
    seenDomains.add(clo.nqf_domain);
    return {
      domain,
      clo_id: clo.clo_id,
      nqf_domain: clo.nqf_domain,
      clo_text: clo.clo_text,
      aligned_sos: order(clo.pis.map((pi) => PI_TO_SO[pi])),
      aligned_pis: order(clo.pis),
    };
  });
  mappingCourse.overall_aligned_pis = order(mappingCourse.clos.flatMap((clo) => clo.aligned_pis));
  mappingCourse.overall_aligned_sos = order(mappingCourse.overall_aligned_pis.map((pi) => PI_TO_SO[pi]));
  mappingCourse.mapping_pi_levels = Object.fromEntries(mappingCourse.overall_aligned_pis.map((pi) => [pi, approved.pi_levels[pi]]));
  overviewCourse.aligned_sos = [...mappingCourse.overall_aligned_sos];
  overviewCourse.pi_levels = { ...mappingCourse.mapping_pi_levels };
}

for (const [courseCode, before] of otherBefore) {
  const after = JSON.stringify({
    curriculum: curriculumByCode.get(courseCode),
    mapping: mappingByCode.get(courseCode),
    overview: overviewByCode.get(courseCode),
  });
  if (after !== before) throw new Error(`Unexpected modification to non-target course ${courseCode}`);
}

await fs.writeFile(curriculumPath, `${JSON.stringify(curriculum, null, 2)}\n`, 'utf8');
await fs.writeFile(mappingPath, `${JSON.stringify(mapping, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ updated_courses: [...targetCodes], source: sourcePath }, null, 2));
