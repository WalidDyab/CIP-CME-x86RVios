import fs from 'node:fs/promises';

const curriculumPath = 'data/ee_curriculum_with_sos_pis.json';
const mappingPath = 'data/ee_program_clo_so_pi_mapping.json';
const metadataPath = 'data/ee_course_metadata.json';
const electiveCataloguePath = 'data/ee_elective_catalogue_metadata.json';
const electiveStandingRequirement = 'Senior level standing (completion of 90 credit hours)';

const newElectiveClos = {
  'EE 414': [
    {
      clo_id: 1.1,
      nqf_domain: 'Knowledge',
      clo_text: 'Explain fundamental concepts such as accuracy, precision, sensitivity, and error analysis in electrical and electronic measurements.',
      pis: ['PI12'],
      teaching_strategy: ['Interactive Lectures', 'Guided Problem Solving and Tutorials'],
      assessment_methods: ['Quizzes', 'Homework and Classwork Assignments', 'Major and Final Exams', 'Laboratory Reports'],
    },
    {
      clo_id: 2.1,
      nqf_domain: 'Skills',
      clo_text: 'Demonstrate proficiency in using instruments like voltmeters, ammeters, wattmeters, oscilloscopes, and digital multimeters for accurate measurements.',
      pis: ['PI62'],
      teaching_strategy: ['Laboratory Experimentation', 'Guided Problem Solving and Tutorials'],
      assessment_methods: ['Laboratory Practical Assessment', 'Laboratory Reports', 'Homework and Classwork Assignments', 'Major and Final Exams'],
    },
    {
      clo_id: 2.2,
      nqf_domain: 'Skills',
      clo_text: 'Evaluate measurement data, identify errors, and apply corrective techniques to improve accuracy in electrical and electronic systems.',
      pis: ['PI63', 'PI64'],
      teaching_strategy: ['Laboratory Experimentation', 'Guided Problem Solving and Tutorials', 'Case-Based Learning and Technical Discussion'],
      assessment_methods: ['Laboratory Practical Assessment', 'Laboratory Reports', 'Homework and Classwork Assignments', 'Major and Final Exams'],
    },
    {
      clo_id: 2.3,
      nqf_domain: 'Skills',
      clo_text: 'Utilize modern data acquisition systems, sensors, and transducers for real-world applications in power systems, electronics, and automation.',
      pis: ['PI62'],
      teaching_strategy: ['Laboratory Experimentation', 'Simulation and Computer-Based Learning', 'Design- and Project-Based Learning'],
      assessment_methods: ['Laboratory Practical Assessment', 'Laboratory Reports', 'Simulation/Computational Assignments', 'Prototype/System Demonstration'],
    },
  ],
  'EE 415': [
    {
      clo_id: 1.1,
      nqf_domain: 'Knowledge',
      clo_text: 'Understand light sources and detectors',
      pis: ['PI12'],
      teaching_strategy: ['Interactive Lectures', 'Guided Problem Solving and Tutorials'],
      assessment_methods: ['Quizzes', 'Homework and Classwork Assignments', 'Major and Final Exams', 'Simulation/Computational Assignments'],
    },
    {
      clo_id: 2.1,
      nqf_domain: 'Skills',
      clo_text: 'Design and evaluate optical network solutions',
      pis: ['PI21'],
      teaching_strategy: ['Design- and Project-Based Learning', 'Simulation and Computer-Based Learning', 'Guided Problem Solving and Tutorials'],
      assessment_methods: ['Design Project Assignment', 'Simulation/Computational Assignments', 'Homework and Classwork Assignments', 'Major and Final Exams'],
    },
    {
      clo_id: 2.2,
      nqf_domain: 'Skills',
      clo_text: 'Analyze optical signal impairments',
      pis: ['PI12'],
      teaching_strategy: ['Guided Problem Solving and Tutorials', 'Simulation and Computer-Based Learning'],
      assessment_methods: ['Simulation/Computational Assignments', 'Homework and Classwork Assignments', 'Quizzes', 'Major and Final Exams'],
    },
  ],
  'EE 423': [
    {
      clo_id: 1.1,
      nqf_domain: 'Knowledge',
      clo_text: 'Understand basic data communication and network concepts and protocols',
      pis: ['PI12'],
      teaching_strategy: ['Interactive Lectures', 'Case-Based Learning and Technical Discussion'],
      assessment_methods: ['Quizzes', 'Homework and Classwork Assignments', 'Major and Final Exams', 'Simulation/Computational Assignments'],
    },
    {
      clo_id: 2.1,
      nqf_domain: 'Skills',
      clo_text: 'Implement and evaluate middle-layer data access protocols',
      pis: ['PI12'],
      teaching_strategy: ['Laboratory Experimentation', 'Simulation and Computer-Based Learning', 'Design- and Project-Based Learning'],
      assessment_methods: ['Laboratory Practical Assessment', 'Simulation/Computational Assignments', 'Design Project Assignment', 'Prototype/System Demonstration'],
    },
    {
      clo_id: 2.2,
      nqf_domain: 'Skills',
      clo_text: 'Integrate Smart Systems with cloud-based networking solutions',
      pis: ['PI21'],
      teaching_strategy: ['Design- and Project-Based Learning', 'Simulation and Computer-Based Learning', 'Laboratory Experimentation'],
      assessment_methods: ['Design Project Assignment', 'Simulation/Computational Assignments', 'Prototype/System Demonstration', 'Laboratory Practical Assessment'],
    },
  ],
  'EE 424': [
    {
      clo_id: 1.1,
      nqf_domain: 'Knowledge',
      clo_text: 'Recognize the source and channel coding theorems.',
      pis: ['PI12'],
      teaching_strategy: ['Interactive Lectures', 'Guided Problem Solving and Tutorials'],
      assessment_methods: ['Quizzes', 'Homework and Classwork Assignments', 'Major and Final Exams', 'Simulation/Computational Assignments'],
    },
    {
      clo_id: 1.2,
      nqf_domain: 'Knowledge',
      clo_text: 'Explain the notions of entropy, relative entropy and mutual information, and how they are relevant.',
      pis: ['PI12'],
      teaching_strategy: ['Interactive Lectures', 'Guided Problem Solving and Tutorials'],
      assessment_methods: ['Quizzes', 'Homework and Classwork Assignments', 'Major and Final Exams', 'Simulation/Computational Assignments'],
    },
    {
      clo_id: 2.1,
      nqf_domain: 'Skills',
      clo_text: 'Calculate the capacity of different channels.',
      pis: ['PI12'],
      teaching_strategy: ['Guided Problem Solving and Tutorials', 'Simulation and Computer-Based Learning'],
      assessment_methods: ['Homework and Classwork Assignments', 'Major and Final Exams', 'Simulation/Computational Assignments', 'Quizzes'],
    },
    {
      clo_id: 2.2,
      nqf_domain: 'Skills',
      clo_text: 'Analyze and design source and channel coding schemes.',
      pis: ['PI21'],
      teaching_strategy: ['Design- and Project-Based Learning', 'Simulation and Computer-Based Learning', 'Guided Problem Solving and Tutorials'],
      assessment_methods: ['Design Project Assignment', 'Simulation/Computational Assignments', 'Homework and Classwork Assignments', 'Major and Final Exams'],
    },
  ],
  'EE 425': [
    {
      clo_id: 1.1,
      nqf_domain: 'Knowledge',
      clo_text: 'Explain fundamental wireless communication principles',
      pis: ['PI12'],
      teaching_strategy: ['Interactive Lectures', 'Guided Problem Solving and Tutorials'],
      assessment_methods: ['Quizzes', 'Homework and Classwork Assignments', 'Major and Final Exams', 'Simulation/Computational Assignments'],
    },
    {
      clo_id: 1.2,
      nqf_domain: 'Knowledge',
      clo_text: 'Describe the challenges in designing the physical and link layers of wireless systems.',
      pis: ['PI12'],
      teaching_strategy: ['Interactive Lectures', 'Case-Based Learning and Technical Discussion'],
      assessment_methods: ['Quizzes', 'Homework and Classwork Assignments', 'Major and Final Exams', 'Simulation/Computational Assignments'],
    },
    {
      clo_id: 2.1,
      nqf_domain: 'Skills',
      clo_text: 'Apply digital modulation and multiple access techniques',
      pis: ['PI12'],
      teaching_strategy: ['Guided Problem Solving and Tutorials', 'Simulation and Computer-Based Learning'],
      assessment_methods: ['Simulation/Computational Assignments', 'Homework and Classwork Assignments', 'Major and Final Exams', 'Quizzes'],
    },
    {
      clo_id: 2.2,
      nqf_domain: 'Skills',
      clo_text: 'Design wireless system components',
      pis: ['PI21'],
      teaching_strategy: ['Design- and Project-Based Learning', 'Simulation and Computer-Based Learning', 'Guided Problem Solving and Tutorials'],
      assessment_methods: ['Design Project Assignment', 'Simulation/Computational Assignments', 'Prototype/System Demonstration', 'Homework and Classwork Assignments'],
    },
  ],
  'EE 433': [
    {
      clo_id: 1.1,
      nqf_domain: 'Knowledge',
      clo_text: 'Understand the concept of mechatronic system design and how to construct a conceptual framework to select an appropriate solution approach',
      pis: ['PI11'],
      teaching_strategy: ['Interactive Lectures', 'Case-Based Learning and Technical Discussion', 'Guided Problem Solving and Tutorials'],
      assessment_methods: ['Quizzes', 'Homework and Classwork Assignments', 'Major and Final Exams', 'Design Project Assignment'],
    },
    {
      clo_id: 2.1,
      nqf_domain: 'Skills',
      clo_text: 'Learn how to work with sensors, actuators, controllers and how to read and interpret data sheets.',
      pis: [],
      teaching_strategy: ['Laboratory Experimentation', 'Guided Problem Solving and Tutorials', 'Independent/Self-Directed Learning'],
      assessment_methods: ['Laboratory Practical Assessment', 'Laboratory Reports', 'Homework and Classwork Assignments', 'Prototype/System Demonstration'],
    },
    {
      clo_id: 2.2,
      nqf_domain: 'Skills',
      clo_text: 'Learn how to model and simulate mechatronic systems and how to verify design solutions before their implementation.',
      pis: ['PI21'],
      teaching_strategy: ['Simulation and Computer-Based Learning', 'Design- and Project-Based Learning', 'Guided Problem Solving and Tutorials'],
      assessment_methods: ['Simulation/Computational Assignments', 'Design Project Assignment', 'Prototype/System Demonstration', 'Homework and Classwork Assignments'],
    },
    {
      clo_id: 2.3,
      nqf_domain: 'Skills',
      clo_text: 'Write technical reports following a well-defined design procedure',
      pis: ['PI31'],
      teaching_strategy: ['Technical Communication Activities', 'Design- and Project-Based Learning', 'Independent/Self-Directed Learning'],
      assessment_methods: ['Design Project Assignment', 'Homework and Classwork Assignments', 'Oral Technical Presentation', 'Teamwork/Peer Assessment'],
    },
  ],
  'EE 442': [
    {
      clo_id: 1.1,
      nqf_domain: 'Knowledge',
      clo_text: 'Demonstrate the role of DSP in communications, audio processing, and radar systems.',
      pis: ['PI12'],
      teaching_strategy: ['Interactive Lectures', 'Case-Based Learning and Technical Discussion'],
      assessment_methods: ['Quizzes', 'Homework and Classwork Assignments', 'Major and Final Exams', 'Simulation/Computational Assignments'],
    },
    {
      clo_id: 2.1,
      nqf_domain: 'Skills',
      clo_text: 'Analyze and manipulate discrete-time signals using time-domain and frequency-domain techniques.',
      pis: ['PI12'],
      teaching_strategy: ['Guided Problem Solving and Tutorials', 'Simulation and Computer-Based Learning'],
      assessment_methods: ['Simulation/Computational Assignments', 'Homework and Classwork Assignments', 'Major and Final Exams', 'Quizzes'],
    },
    {
      clo_id: 2.2,
      nqf_domain: 'Skills',
      clo_text: 'Implement Z-transform, DFT, and FFT for efficient signal analysis.',
      pis: ['PI12'],
      teaching_strategy: ['Guided Problem Solving and Tutorials', 'Simulation and Computer-Based Learning'],
      assessment_methods: ['Simulation/Computational Assignments', 'Homework and Classwork Assignments', 'Major and Final Exams', 'Quizzes'],
    },
    {
      clo_id: 2.3,
      nqf_domain: 'Skills',
      clo_text: 'Desgn and implement digital FIR and IIR filters for various signal processing applications.',
      pis: ['PI21'],
      teaching_strategy: ['Design- and Project-Based Learning', 'Simulation and Computer-Based Learning', 'Guided Problem Solving and Tutorials'],
      assessment_methods: ['Design Project Assignment', 'Simulation/Computational Assignments', 'Homework and Classwork Assignments', 'Major and Final Exams'],
    },
    {
      clo_id: 2.4,
      nqf_domain: 'Skills',
      clo_text: 'Apply sampling and reconstruction techniques in real-world scenarios.',
      pis: ['PI12'],
      teaching_strategy: ['Guided Problem Solving and Tutorials', 'Simulation and Computer-Based Learning'],
      assessment_methods: ['Simulation/Computational Assignments', 'Homework and Classwork Assignments', 'Major and Final Exams', 'Quizzes'],
    },
    {
      clo_id: 2.5,
      nqf_domain: 'Skills',
      clo_text: 'Utilize MATLAB for signal processing simulation and visualization.',
      pis: ['PI12'],
      teaching_strategy: ['Simulation and Computer-Based Learning', 'Independent/Self-Directed Learning'],
      assessment_methods: ['Simulation/Computational Assignments', 'Homework and Classwork Assignments', 'Design Project Assignment', 'Oral Technical Presentation'],
    },
  ],
};

const soForPi = (piCode) => `SO${piCode.slice(2, 3)}`;
const unique = (values) => [...new Set(values)];
const orderCodes = (values) => unique(values).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
const isPopulated = (value) => Array.isArray(value) ? value.length > 0 : value !== null && value !== undefined && value !== '';
const metadataFields = {
  course_description: null,
  prerequisites: [],
  prerequisite_text: null,
  corequisites: [],
  corequisite_text: null,
  course_objectives: [],
  textbooks: [],
  references: [],
};
const mappingCorrections = [
  { course_code: 'EE 415', clo_id: 2.2, clo_text: 'Analyze optical signal impairments', from: ['PI11'], to: ['PI12'] },
  { course_code: 'EE 423', clo_id: 2.1, clo_text: 'Implement and evaluate middle-layer data access protocols', from: ['PI21'], to: ['PI12'] },
  { course_code: 'EE 425', clo_id: 1.2, clo_text: 'Describe the challenges in designing the physical and link layers of wireless systems.', from: ['PI11'], to: ['PI12'] },
  { course_code: 'EE 433', clo_id: 2.1, clo_text: 'Learn how to work with sensors, actuators, controllers and how to read and interpret data sheets.', from: ['PI62'], to: [] },
  { course_code: 'EE 442', clo_id: 2.1, clo_text: 'Analyze and manipulate discrete-time signals using time-domain and frequency-domain techniques.', from: ['PI11'], to: ['PI12'] },
  { course_code: 'EE 442', clo_id: 2.5, clo_text: 'Utilize MATLAB for signal processing simulation and visualization.', from: ['PI72'], to: ['PI12'] },
];

const curriculum = JSON.parse(await fs.readFile(curriculumPath, 'utf8'));
const mapping = JSON.parse(await fs.readFile(mappingPath, 'utf8'));
const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
const electiveCatalogue = JSON.parse(await fs.readFile(electiveCataloguePath, 'utf8'));
const metadataByCode = new Map((metadata.courses ?? []).map((course) => [course.course_code, course]));
const catalogueByCode = new Map((electiveCatalogue.courses ?? []).map((course) => [course.course_code, course]));
const mappingByCode = new Map((mapping.courses ?? []).map((course) => [course.course_code, course]));
const overviewByCode = new Map((mapping.mapping_overview ?? []).map((course) => [course.course_code, course]));

const audit = [];
for (const course of curriculum.curriculum?.courses ?? []) {
  const metadataCourse = metadataByCode.get(course.course_code);
  for (const [field, emptyValue] of Object.entries(metadataFields)) {
    if (!isPopulated(course[field])) {
      course[field] = isPopulated(metadataCourse?.[field]) ? structuredClone(metadataCourse[field]) : structuredClone(emptyValue);
    }
  }
  if (course.required_or_elective === 'Elective') {
    const existingRequirements = String(course.prerequisite_text ?? '')
      .split(';')
      .map((item) => item.trim())
      .filter(Boolean)
      .filter((item) => item !== electiveStandingRequirement);
    course.prerequisite_text = [...existingRequirements, electiveStandingRequirement].join('; ');
  }

  const proposed = newElectiveClos[course.course_code];
  if (!proposed) continue;
  const catalogueOutcomes = new Set(catalogueByCode.get(course.course_code)?.catalogue_learning_outcomes ?? []);
  if (proposed.some((clo) => !catalogueOutcomes.has(clo.clo_text))) {
    throw new Error(`${course.course_code} proposed CLO wording does not match the catalogue provenance file`);
  }
  const mapCourse = mappingByCode.get(course.course_code);
  const overviewCourse = overviewByCode.get(course.course_code);
  if (!mapCourse || !overviewCourse) throw new Error(`Missing mapping records for ${course.course_code}`);

  if ((course.clos ?? []).length || (mapCourse.clos ?? []).length) {
    audit.push({ course_code: course.course_code, status: 'Preserved existing populated CLOs' });
    continue;
  }
  if (!course.performance_level || !['I', 'P', 'M'].includes(course.performance_level)) {
    throw new Error(`${course.course_code} has no approved course performance level`);
  }

  course.clos = proposed.map((clo) => ({
    clo_number: clo.clo_id,
    nqf_domain: clo.nqf_domain,
    clo_text: clo.clo_text,
    mapped_sos: orderCodes(clo.pis.map(soForPi)),
    pi_codes: orderCodes(clo.pis),
    teaching_strategy: clo.teaching_strategy,
    assessment_methods: clo.assessment_methods,
  }));

  const seenDomains = new Set();
  mapCourse.clos = proposed.map((clo) => {
    const domain = seenDomains.has(clo.nqf_domain)
      ? null
      : clo.nqf_domain === 'Knowledge' ? 'Knowledge and understanding' : clo.nqf_domain;
    seenDomains.add(clo.nqf_domain);
    return {
      domain,
      clo_id: clo.clo_id,
      nqf_domain: clo.nqf_domain,
      clo_text: clo.clo_text,
      aligned_sos: orderCodes(clo.pis.map(soForPi)),
      aligned_pis: orderCodes(clo.pis),
    };
  });
  mapCourse.overall_aligned_sos = orderCodes(mapCourse.clos.flatMap((clo) => clo.aligned_sos));
  mapCourse.overall_aligned_pis = orderCodes(mapCourse.clos.flatMap((clo) => clo.aligned_pis));
  mapCourse.mapping_pi_levels = Object.fromEntries(mapCourse.overall_aligned_pis.map((pi) => [pi, course.performance_level]));
  overviewCourse.aligned_sos = [...mapCourse.overall_aligned_sos];
  overviewCourse.pi_levels = { ...mapCourse.mapping_pi_levels };
  audit.push({
    course_code: course.course_code,
    status: 'Filled previously empty official CLO list',
    clo_count: proposed.length,
    performance_level_source: `Existing course performance_level ${course.performance_level}`,
  });
}

for (const correction of mappingCorrections) {
  const course = curriculum.curriculum.courses.find((item) => item.course_code === correction.course_code);
  const mapCourse = mappingByCode.get(correction.course_code);
  const overviewCourse = overviewByCode.get(correction.course_code);
  const curriculumClo = course?.clos?.find((clo) => String(clo.clo_number) === String(correction.clo_id));
  const mappingClo = mapCourse?.clos?.find((clo) => String(clo.clo_id) === String(correction.clo_id));
  if (!course || !mapCourse || !overviewCourse || !curriculumClo || !mappingClo) {
    throw new Error(`Cannot resolve mapping correction target ${correction.course_code} CLO ${correction.clo_id}`);
  }
  if (curriculumClo.clo_text !== correction.clo_text || mappingClo.clo_text !== correction.clo_text) {
    throw new Error(`CLO wording changed for mapping correction target ${correction.course_code} CLO ${correction.clo_id}`);
  }
  const currentPis = orderCodes(curriculumClo.pi_codes ?? []);
  const mappingPis = orderCodes(mappingClo.aligned_pis ?? []);
  const fromPis = orderCodes(correction.from);
  const toPis = orderCodes(correction.to);
  if (JSON.stringify(currentPis) !== JSON.stringify(mappingPis)) {
    throw new Error(`Cross-JSON PI mismatch before correction for ${correction.course_code} CLO ${correction.clo_id}`);
  }
  if (JSON.stringify(currentPis) !== JSON.stringify(fromPis) && JSON.stringify(currentPis) !== JSON.stringify(toPis)) {
    throw new Error(`Unexpected existing PI mapping for ${correction.course_code} CLO ${correction.clo_id}`);
  }
  for (const pi of toPis) {
    if (!mapCourse.mapping_pi_levels?.[pi]) {
      throw new Error(`${correction.course_code} has no approved course-level value for replacement ${pi}`);
    }
  }
  curriculumClo.pi_codes = toPis;
  curriculumClo.mapped_sos = orderCodes(toPis.map(soForPi));
  mappingClo.aligned_pis = [...toPis];
  mappingClo.aligned_sos = orderCodes(toPis.map(soForPi));
}

for (const mapCourse of mapping.courses ?? []) {
  const overviewCourse = overviewByCode.get(mapCourse.course_code);
  const previousLevels = { ...mapCourse.mapping_pi_levels };
  mapCourse.overall_aligned_sos = orderCodes(mapCourse.clos.flatMap((clo) => clo.aligned_sos ?? []));
  mapCourse.overall_aligned_pis = orderCodes(mapCourse.clos.flatMap((clo) => clo.aligned_pis ?? []));
  mapCourse.mapping_pi_levels = Object.fromEntries(mapCourse.overall_aligned_pis.map((pi) => {
    if (!previousLevels[pi]) throw new Error(`${mapCourse.course_code} has no approved course-level value for ${pi}`);
    return [pi, previousLevels[pi]];
  }));
  overviewCourse.aligned_sos = [...mapCourse.overall_aligned_sos];
  overviewCourse.pi_levels = { ...mapCourse.mapping_pi_levels };
}

await fs.writeFile(curriculumPath, `${JSON.stringify(curriculum, null, 2)}\n`, 'utf8');
await fs.writeFile(mappingPath, `${JSON.stringify(mapping, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(audit, null, 2));
