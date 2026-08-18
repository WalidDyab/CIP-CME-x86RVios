import fs from 'node:fs/promises';

// Post-migration reconciliation guard. The canonical curriculum already contains
// the approved corrections; this script verifies them without rebuilding a
// second mapping representation.
const curriculumPath='data/ee_curriculum.json';
const curriculum=JSON.parse(await fs.readFile(curriculumPath,'utf8'));
const courses=new Map((curriculum.curriculum?.courses??[]).map(course=>[course.course_code,course]));
const clo=(code,id)=>courses.get(code)?.clos?.find(item=>String(item.clo_number)===String(id));
const requirePis=(code,id,pis)=>{
  const item=clo(code,id);
  if(!item) throw new Error(`Missing canonical CLO ${code} ${id}`);
  for(const pi of pis) if(!(item.pi_codes??[]).includes(pi)) throw new Error(`Missing approved ${pi} on ${code} CLO ${id}`);
};
const forbidPis=(code,id,pis)=>{
  const item=clo(code,id);
  if(!item) throw new Error(`Missing canonical CLO ${code} ${id}`);
  for(const pi of pis) if((item.pi_codes??[]).includes(pi)) throw new Error(`Unsupported ${pi} remains on ${code} CLO ${id}`);
};

const ee202= courses.get('EE 202');
if(JSON.stringify(ee202?.clos?.map(item=>item.clo_number))!==JSON.stringify([1.1,2.1,2.2,2.3,3.1])) throw new Error('EE 202 final CLO structure is not reconciled');
requirePis('EE 341','2.3',['PI31']);
requirePis('EE 403','2.3',['PI12']);
requirePis('EE 305','2.1',['PI23']);
requirePis('EE 305','3.1',['PI62','PI63','PI64','PI72']);
forbidPis('EE 426','3.1',['PI72']);
forbidPis('EE 456','3.1',['PI72']);
for(const [code,overrides] of Object.entries({'EE 211':{PI31:'P',PI32:'P'},'EE 490':{PI41:'P',PI42:'P'},'EE 492':{PI41:'P',PI42:'P'}})){
  for(const [pi,level] of Object.entries(overrides)) if(courses.get(code)?.pi_levels?.[pi]!==level) throw new Error(`${code} ${pi} level is not ${level}`);
}
console.log(JSON.stringify({canonical_source:curriculumPath,status:'approved final reconciliation verified',courses_checked:['EE 202','EE 211','EE 305','EE 341','EE 403','EE 426','EE 456','EE 490','EE 492']},null,2));
