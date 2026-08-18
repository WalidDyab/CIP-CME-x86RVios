import fs from 'node:fs/promises';
import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';

const baselinePath = 'data/EE Program Design Full ABET.xlsx';
const finalPath = 'data/ee_curriculum.json';
const auditPath = 'data/clo_revision_audit.json';
const dryRun = process.argv.includes('--dry-run');
const rationale = 'The Course Learning Outcomes were reviewed as part of the transition to an ABET-aligned curriculum assessment framework. The previous curriculum structure primarily mapped CLOs according to the NCAAA learning domains. The revised framework establishes explicit alignment between CLOs, ABET Student Outcomes, and program Performance Indicators. During this review, selected CLO statements were revised, added, or omitted where necessary to support the updated curriculum structure and ensure appropriate outcome assessment.';
const clean = value => String(value ?? '').replace(/\u00a0/g, ' ').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
const idText = value => typeof value==='number' ? String(Math.round(value*10)/10) : clean(value);
const norm = value => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const tokens = value => new Set(norm(value).split(' ').filter(word => word.length > 2));
const jaccard = (a, b) => { const x=tokens(a), y=tokens(b), i=[...x].filter(v=>y.has(v)).length, u=new Set([...x,...y]).size; return u ? i/u : 0; };
const bigrams = value => { const s=norm(value); const out=[]; for(let i=0;i<s.length-1;i++) out.push(s.slice(i,i+2)); return out; };
const dice = (a,b) => { const x=bigrams(a), y=bigrams(b), pool=[...y]; let hit=0; for(const v of x){const i=pool.indexOf(v);if(i>=0){hit++;pool.splice(i,1)}} return x.length+y.length?2*hit/(x.length+y.length):0; };
const similarity = (a,b) => 0.55*jaccard(a,b)+0.45*dice(a,b);
const domain = value => { const s=norm(value); return s.startsWith('knowledge')?'Knowledge':s.startsWith('skills')?'Skills':s.startsWith('values')?'Values':null; };

const baselineHashBefore = (await fs.readFile(baselinePath)).byteLength;
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(baselinePath));
const baselineByCourse = new Map();
for (const sheet of workbook.worksheets.items) {
  if (!/^EE \d{3}$/.test(sheet.name)) continue;
  const values = sheet.getRange('A1:C40').values;
  const code = clean(values[1]?.[0]) || sheet.name;
  let currentDomain = null;
  const clos=[];
  const cloHeader=values.findIndex(row=>norm(row?.[0])==='course learning outcomes');
  const cloEnd=values.findIndex((row,index)=>index>cloHeader&&norm(row?.[0]).startsWith('aligned plo'));
  if(cloHeader<0||cloEnd<0) throw new Error(`Could not locate CLO table boundaries in ${sheet.name}`);
  for(let r=cloHeader+1;r<cloEnd;r++){
    if(clean(values[r]?.[0])) currentDomain=domain(values[r][0]);
    const text=clean(values[r]?.[2]), id=idText(values[r]?.[1]);
    if(text) clos.push({course_code:code,old_clo_id:/^\d+(?:\.\d+)?$/.test(id)?id:null,old_clo_text:text,old_nqf_domain:currentDomain,source_sheet:sheet.name,source_cell:`C${r+1}`,source_row:r+1});
  }
  baselineByCourse.set(code,clos);
}
const finalJson=JSON.parse(await fs.readFile(finalPath,'utf8'));
const finalCourses=finalJson.curriculum?.courses??[];
const finalByCourse=new Map(finalCourses.map(course=>[course.course_code,(course.clos??[]).map(clo=>({course_code:course.course_code,new_clo_id:idText(clo.clo_number),new_clo_text:clean(clo.clo_text),nqf_domain:clo.nqf_domain}))]));
const courseCodes=[...new Set([...baselineByCourse.keys(),...finalByCourse.keys()])].sort((a,b)=>Number(a.slice(3))-Number(b.slice(3)));
const changes=[], unchanged=[], ambiguous=[];

for(const code of courseCodes){
  const old=baselineByCourse.get(code)??[], fresh=finalByCourse.get(code)??[];
  const usedOld=new Set(), usedNew=new Set();
  const pair=(oi,ni,type,note=null)=>{usedOld.add(oi);usedNew.add(ni);const o=old[oi],n=fresh[ni];if(type==='unchanged')unchanged.push({course_code:code,old_clo_id:o.old_clo_id,new_clo_id:n.new_clo_id});else changes.push({course_code:code,change_type:'modified',old_clo_id:o.old_clo_id,old_clo_text:o.old_clo_text,new_clo_id:n.new_clo_id,new_clo_text:n.new_clo_text,old_nqf_domain:o.old_nqf_domain,new_nqf_domain:n.nqf_domain,note,source_sheet:o.source_sheet,source_cell:o.source_cell});};
  const oldIndex=id=>old.findIndex((clo,index)=>!usedOld.has(index)&&clo.old_clo_id===id);
  const newIndex=id=>fresh.findIndex((clo,index)=>!usedNew.has(index)&&clo.new_clo_id===id);
  const residualNote=(type,id)=>{
    const notes={
      'EE 202:omitted:2.4':'Content merged with baseline CLO 2.3 into revised CLO 2.3.',
      'EE 211:omitted:2.2':'Operational-amplifier content was reorganized across revised CLOs 1.1, 1.2, and 2.1.',
      'EE 434:omitted:2.2':'PLC program-design content was reorganized into revised CLOs 1.2 and 2.1.',
      'EE 434:added:1.2':'Added as part of the PLC knowledge and programming-content restructuring.'
    };
    return notes[`${code}:${type}:${id}`]??null;
  };
  if(code==='EE 436'){
    const note='The baseline CLOs concern antenna and electromagnetics content, while the final course is Artificial Intelligence; no genuine CLO correspondence was found.';
    for(const o of old) changes.push({course_code:code,change_type:'omitted',old_clo_id:o.old_clo_id,old_clo_text:o.old_clo_text,new_clo_id:null,new_clo_text:null,old_nqf_domain:o.old_nqf_domain,new_nqf_domain:null,note,source_sheet:o.source_sheet,source_cell:o.source_cell});
    for(const n of fresh) changes.push({course_code:code,change_type:'added',old_clo_id:null,old_clo_text:null,new_clo_id:n.new_clo_id,new_clo_text:n.new_clo_text,old_nqf_domain:null,new_nqf_domain:n.nqf_domain,note,source_sheet:null,source_cell:null});
    continue;
  }
  if(code==='EE 202') pair(oldIndex('2.3'),newIndex('2.3'),'modified','Merged with baseline CLO 2.4 into revised CLO 2.3.');
  if(code==='EE 211') pair(oldIndex('3.1'),newIndex('2.2'),'modified','Renumbered from 3.1 to 2.2; domain changed from Values to Skills.');
  for(let oi=0;oi<old.length;oi++)for(let ni=0;ni<fresh.length;ni++)if(!usedOld.has(oi)&&!usedNew.has(ni)&&norm(old[oi].old_clo_text)===norm(fresh[ni].new_clo_text))pair(oi,ni,'unchanged',old[oi].old_clo_id===fresh[ni].new_clo_id?null:'Renumbered without wording change');
  for(let oi=0;oi<old.length;oi++){
    if(usedOld.has(oi))continue;
    const ni=fresh.findIndex((n,index)=>!usedNew.has(index)&&n.new_clo_id===old[oi].old_clo_id&&n.nqf_domain===old[oi].old_nqf_domain);
    if(ni>=0)pair(oi,ni,'modified');
  }
  const candidates=[];
  for(let oi=0;oi<old.length;oi++)if(!usedOld.has(oi))for(let ni=0;ni<fresh.length;ni++)if(!usedNew.has(ni)&&old[oi].old_nqf_domain===fresh[ni].nqf_domain)candidates.push({oi,ni,score:similarity(old[oi].old_clo_text,fresh[ni].new_clo_text)});
  candidates.sort((a,b)=>b.score-a.score);
  for(const c of candidates)if(c.score>=0.42&&!usedOld.has(c.oi)&&!usedNew.has(c.ni))pair(c.oi,c.ni,'modified',old[c.oi].old_clo_id===fresh[c.ni].new_clo_id?null:'Renumbered CLO matched by wording and domain');
  for(let oi=0;oi<old.length;oi++)if(!usedOld.has(oi))changes.push({course_code:code,change_type:'omitted',old_clo_id:old[oi].old_clo_id,old_clo_text:old[oi].old_clo_text,new_clo_id:null,new_clo_text:null,old_nqf_domain:old[oi].old_nqf_domain,new_nqf_domain:null,note:residualNote('omitted',old[oi].old_clo_id),source_sheet:old[oi].source_sheet,source_cell:old[oi].source_cell});
  for(let ni=0;ni<fresh.length;ni++)if(!usedNew.has(ni))changes.push({course_code:code,change_type:'added',old_clo_id:null,old_clo_text:null,new_clo_id:fresh[ni].new_clo_id,new_clo_text:fresh[ni].new_clo_text,old_nqf_domain:null,new_nqf_domain:fresh[ni].nqf_domain,note:residualNote('added',fresh[ni].new_clo_id),source_sheet:null,source_cell:null});
}
const counts={baseline_clos:[...baselineByCourse.values()].flat().length,final_clos:[...finalByCourse.values()].flat().length,unchanged:unchanged.length,modified:changes.filter(x=>x.change_type==='modified').length,added:changes.filter(x=>x.change_type==='added').length,omitted:changes.filter(x=>x.change_type==='omitted').length,ambiguous:ambiguous.length};
const changedCourses=[...new Set(changes.map(x=>x.course_code))];
const unchangedCourses=courseCodes.filter(code=>!changedCourses.includes(code));
if(counts.unchanged+counts.modified+counts.omitted!==counts.baseline_clos) throw new Error('Baseline CLO accounting failed');
if(counts.unchanged+counts.modified+counts.added!==counts.final_clos) throw new Error('Final CLO accounting failed');
if(counts.final_clos!==170) throw new Error(`Expected 170 final CLOs, found ${counts.final_clos}`);
const audit={baseline_source:'EE Program Design Full ABET.xlsx',final_source:'ee_curriculum.json',common_rationale:rationale,counts,courses_with_changes:changedCourses,courses_without_clo_changes:unchangedCourses,unchanged_clos:unchanged,changes,ambiguous_cases:ambiguous};
if(dryRun){console.log(JSON.stringify({counts,changedCourses,unchangedCourses,changeCountsByCourse:Object.fromEntries(courseCodes.map(code=>[code,changes.filter(x=>x.course_code===code).length]))},null,2));process.exit(0);}
await fs.writeFile(auditPath,`${JSON.stringify(audit,null,2)}\n`,'utf8');
console.log(JSON.stringify({counts,changedCourses,unchangedCourses,auditPath,baselineBytes:baselineHashBefore},null,2));
