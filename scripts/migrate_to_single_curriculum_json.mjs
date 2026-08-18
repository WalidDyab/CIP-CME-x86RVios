import fs from 'node:fs/promises';

const basePath = 'data/ee_curriculum_with_sos_pis.json';
const mappingPath = 'data/ee_program_clo_so_pi_mapping.json';
const outputPath = 'data/ee_curriculum.json';
const stable = value => JSON.stringify(value);

const base = JSON.parse(await fs.readFile(basePath, 'utf8'));
const mapping = JSON.parse(await fs.readFile(mappingPath, 'utf8'));
const curriculum = structuredClone(base.curriculum);
const abet = structuredClone(base.abet);
const mappingByCode = new Map((mapping.courses ?? []).map(course => [course.course_code, course]));
const piMetadata = new Map((mapping.student_outcomes ?? []).flatMap(outcome =>
  (outcome.pis ?? []).map(pi => [pi.pi_code, pi])
));

if ((curriculum.courses ?? []).length !== 32 || mappingByCode.size !== 32) {
  throw new Error('Expected exactly 32 courses in both source datasets');
}

let cloCount = 0;
for (const course of curriculum.courses) {
  const mapped = mappingByCode.get(course.course_code);
  if (!mapped) throw new Error(`Missing mapping record for ${course.course_code}`);
  if (course.course_title !== mapped.course_title) throw new Error(`Course title mismatch for ${course.course_code}`);
  if ((course.clos ?? []).length !== (mapped.clos ?? []).length) throw new Error(`CLO count mismatch for ${course.course_code}`);
  for (let index = 0; index < course.clos.length; index += 1) {
    const comprehensiveClo = course.clos[index];
    const mappingClo = mapped.clos[index];
    const checks = [
      ['CLO number', comprehensiveClo.clo_number, mappingClo.clo_id],
      ['CLO wording', comprehensiveClo.clo_text, mappingClo.clo_text],
      ['NQF domain', comprehensiveClo.nqf_domain, mappingClo.nqf_domain],
      ['mapped SOs', comprehensiveClo.mapped_sos, mappingClo.aligned_sos],
      ['mapped PIs', comprehensiveClo.pi_codes, mappingClo.aligned_pis]
    ];
    for (const [label, left, right] of checks) {
      if (stable(left) !== stable(right)) throw new Error(`${label} mismatch for ${course.course_code} CLO ${comprehensiveClo.clo_number}`);
    }
    cloCount += 1;
  }
  course.course_id = mapped.course_id;
  course.instructor = mapped.instructor ?? null;
  course.pi_levels = structuredClone(mapped.mapping_pi_levels ?? {});
}

if (cloCount !== 170) throw new Error(`Expected 170 CLOs, found ${cloCount}`);
for (const [piCode, definition] of Object.entries(abet.performance_indicators ?? {})) {
  const metadata = piMetadata.get(piCode);
  if (!metadata) throw new Error(`Missing mapping metadata for ${piCode}`);
  if (metadata.rubric !== undefined) definition.rubric = metadata.rubric;
  if (metadata.abet_illustration !== undefined) definition.abet_illustration = metadata.abet_illustration;
}

const result = {
  schema_version: '2.0',
  program: base.program,
  consolidated_on: '2026-08-16',
  provenance: {
    primary_source: 'ee_curriculum_with_sos_pis.json',
    mapping_source: 'ee_program_clo_so_pi_mapping.json',
    mapping_workbook: mapping.source_file ?? null,
    migration_script: 'scripts/migrate_to_single_curriculum_json.mjs',
    note: 'The primary course and CLO records are preserved unchanged; mapping-specific course identity, instructor, PI-level, and PI metadata were consolidated from the mapping source.'
  },
  performance_levels_legend: structuredClone(mapping.performance_levels_legend ?? { I:'Introduced', P:'Practiced', M:'Mastered' }),
  curriculum,
  abet
};

if (Object.keys(result.abet.student_outcomes ?? {}).length !== 7) throw new Error('Expected 7 Student Outcomes');
if (Object.keys(result.abet.performance_indicators ?? {}).length !== 18) throw new Error('Expected 18 Performance Indicators');
if (result.curriculum.courses.filter(course => course.required_or_elective === 'Elective').length !== 16) throw new Error('Expected 16 electives');
await fs.writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ output:outputPath, courses:32, clos:cloCount, student_outcomes:7, performance_indicators:18, electives:16 }, null, 2));
