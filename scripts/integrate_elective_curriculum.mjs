import fs from 'node:fs/promises';

// The elective catalogue integration is complete. This canonical guard keeps
// the former fill-only workflow from recreating the retired two-file model or
// replacing approved CLO data on subsequent runs.
const curriculumPath='data/ee_curriculum.json';
const metadataPath='data/ee_course_metadata.json';
const cataloguePath='data/ee_elective_catalogue_metadata.json';
const curriculum=JSON.parse(await fs.readFile(curriculumPath,'utf8'));
const metadata=JSON.parse(await fs.readFile(metadataPath,'utf8'));
const catalogue=JSON.parse(await fs.readFile(cataloguePath,'utf8'));
const electives=(curriculum.curriculum?.courses??[]).filter(course=>course.required_or_elective==='Elective');
if(electives.length!==16) throw new Error(`Expected 16 canonical electives, found ${electives.length}`);
const codes=new Set(electives.map(course=>course.course_code));
if(codes.size!==16) throw new Error('Duplicate elective course code in canonical curriculum');
for(const course of electives){
  if(!Array.isArray(course.clos)) throw new Error(`Missing canonical CLO array for ${course.course_code}`);
  for(const clo of course.clos){
    for(const field of ['clo_number','nqf_domain','clo_text','mapped_sos','pi_codes','teaching_strategy','assessment_methods']) if(clo[field]===undefined) throw new Error(`Missing ${field} in ${course.course_code}`);
    for(const pi of clo.pi_codes) if(!course.pi_levels?.[pi]) throw new Error(`Missing canonical PI level ${course.course_code} ${pi}`);
  }
}
console.log(JSON.stringify({canonical_output:curriculumPath,status:'elective integration already complete; approved records preserved',electives:electives.length,metadata_source_courses:metadata.courses?.length??0,catalogue_source_courses:catalogue.courses?.length??0},null,2));
