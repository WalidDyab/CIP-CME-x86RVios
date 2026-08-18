import fs from 'node:fs/promises';

const curriculumPath = 'data/ee_curriculum.json';
const sourcePath = 'data/ee_approved_manual_elective_clos.json';
const targetCodes = new Set(['EE 417', 'EE 454']);
const TEACHING_VOCABULARY = new Set(['Interactive Lectures','Guided Problem Solving and Tutorials','Case-Based Learning and Technical Discussion','Laboratory Experimentation','Simulation and Computer-Based Learning','Design- and Project-Based Learning','Collaborative/Team-Based Learning','Technical Communication Activities','Independent/Self-Directed Learning','Flipped Classroom']);
const ASSESSMENT_VOCABULARY = new Set(['Quizzes','Homework and Classwork Assignments','Major and Final Exams','Laboratory Practical Assessment','Laboratory Reports','Simulation/Computational Assignments','Design Project Assignment','Prototype/System Demonstration','Oral Technical Presentation','Teamwork/Peer Assessment']);
const order = values => [...new Set(values)].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));

const curriculum = JSON.parse(await fs.readFile(curriculumPath,'utf8'));
const source = JSON.parse(await fs.readFile(sourcePath,'utf8'));
const courses = curriculum.curriculum?.courses ?? [];
const courseByCode = new Map(courses.map(course=>[course.course_code,course]));
const sourceByCode = new Map((source.courses??[]).map(course=>[course.course_code,course]));
const piDefinitions = curriculum.abet?.performance_indicators ?? {};
if(sourceByCode.size!==2||[...targetCodes].some(code=>!sourceByCode.has(code))) throw new Error('Approved manual source must contain exactly EE 417 and EE 454');
const protectedBefore = new Map(courses.filter(course=>!targetCodes.has(course.course_code)).map(course=>[course.course_code,JSON.stringify(course)]));

for(const [courseCode,approved] of sourceByCode){
  const course=courseByCode.get(courseCode);
  if(!course) throw new Error(`Missing canonical course ${courseCode}`);
  const ids=approved.clos.map(clo=>String(clo.clo_id));
  if(new Set(ids).size!==ids.length) throw new Error(`Duplicate CLO IDs in ${courseCode}`);
  for(const clo of approved.clos){
    if(!['Knowledge','Skills','Values'].includes(clo.nqf_domain)) throw new Error(`Invalid NQF domain in ${courseCode} ${clo.clo_id}`);
    if(clo.teaching_strategy.length<2||clo.teaching_strategy.length>3||clo.teaching_strategy.some(item=>!TEACHING_VOCABULARY.has(item))) throw new Error(`Invalid Teaching Strategies in ${courseCode} ${clo.clo_id}`);
    if(clo.assessment_methods.length<4||clo.assessment_methods.length>5||clo.assessment_methods.some(item=>!ASSESSMENT_VOCABULARY.has(item))) throw new Error(`Invalid Assessment Methods in ${courseCode} ${clo.clo_id}`);
    for(const pi of clo.pis){
      if(!piDefinitions[pi]) throw new Error(`Unknown PI ${pi} in ${courseCode} ${clo.clo_id}`);
      if(!['I','P','M'].includes(approved.pi_levels[pi])) throw new Error(`Unresolved level for ${courseCode} ${pi}`);
    }
  }
  course.clos=approved.clos.map(clo=>({clo_number:clo.clo_id,nqf_domain:clo.nqf_domain,clo_text:clo.clo_text,mapped_sos:order(clo.pis.map(pi=>piDefinitions[pi].so)),pi_codes:order(clo.pis),teaching_strategy:[...clo.teaching_strategy],assessment_methods:[...clo.assessment_methods]}));
  const represented=order(course.clos.flatMap(clo=>clo.pi_codes));
  course.pi_levels=Object.fromEntries(represented.map(pi=>[pi,approved.pi_levels[pi]]));
}
for(const [code,before] of protectedBefore) if(JSON.stringify(courseByCode.get(code))!==before) throw new Error(`Unexpected modification to non-target course ${code}`);
await fs.writeFile(curriculumPath,`${JSON.stringify(curriculum,null,2)}\n`,'utf8');
console.log(JSON.stringify({updated_courses:[...targetCodes],source:sourcePath,output:curriculumPath},null,2));
