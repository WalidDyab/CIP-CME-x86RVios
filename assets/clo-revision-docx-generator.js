(function (global) {
  'use strict';

  const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const LABELS = { unchanged:'Unchanged', modified:'Modified', renumbered:'Renumbered', added:'Added', omitted:'Omitted', merged:'Merged', split:'Split', ambiguous:'Review required' };
  const SUMMARY_KEYS = [
    ['Term 251 CLOs','baseline_clos'], ['Term 261 CLOs','current_clos'], ['Unchanged','unchanged'],
    ['Modified','modified'], ['Renumbered','renumbered'], ['Added','added'], ['Omitted','omitted'],
    ['Merged','merge_cases'], ['Split','split_cases'], ['Ambiguous','ambiguous']
  ];
  const PURPOSE = 'This report documents the revision of the CLOs of the Undergraduate Electrical Engineering Program from the Term 251 curriculum submitted to ABET to the proposed Term 261 curriculum. It provides a concise record for curriculum review and approval.';
  const BACKGROUND = "The CLO review formed part of the program's continuous-improvement process initiated in December 2025 following ABET review and assessment discussions. Faculty review and refinement continued through Term 252 and subsequent stages, resulting in the proposed Term 261 CLO set.";
  const RATIONALE = "The review was undertaken to improve CLO clarity and measurability and to strengthen alignment with SO assessment and the program's assessment framework. The revisions support assessment improvement; they do not imply that ABET prescribed specific CLO wording.";
  const IMPACT = 'The revised framework strengthens the alignment and traceability among CLOs, SOs, PIs, and assessment evidence. This supports systematic continuous improvement while keeping the detailed comparison focused on CLO wording and structure.';
  const CONCLUSION = "This report compares the Term 251 CLO baseline submitted to ABET with the proposed Term 261 CLO framework. The changes reflect the program's continuous-improvement and faculty-review process and strengthen CLO clarity, measurability, and alignment with ABET assessment. The Term 261 CLO set is presented for the required curriculum approval.";

  class ValidationError extends Error { constructor(message) { super(message); this.name = 'ValidationError'; } }
  const norm = value => String(value ?? '').toLowerCase().replace(/[‐‑‒–—−]/g, '-').replace(/[^a-z0-9]+/g, ' ').trim();
  const code = value => String(value ?? '').replace(/\s+/g, ' ').trim();
  const cloId = value => String(value ?? '').trim();
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));
  const safeFilenameCode = value => code(value).replace(/[^A-Za-z0-9]+/g, '');
  const domainName = value => String(value ?? '').startsWith('Knowledge') ? 'Knowledge' : String(value ?? '').startsWith('Skills') ? 'Skills' : 'Values';
  const byId = items => new Map((items || []).map(item => [cloId(item.current_clo_id ?? item.clo_number), item]));

  function relationshipKey(item) {
    return `${item.course_code}|${(item.baseline_clos || []).map(x => x.baseline_clo_ref).join('+')}->${(item.current_clos || []).map(x => x.current_clo_id).join('+')}`;
  }

  function piOwnerMap(curriculum) {
    const indicators = curriculum.abet && curriculum.abet.performance_indicators;
    if (!indicators) throw new ValidationError('The curriculum does not contain ABET performance-indicator definitions');
    return new Map(Object.entries(indicators).map(([pi, definition]) => [pi, definition.so]));
  }

  function formatCurrentMapping(clo, curriculum) {
    const domain = domainName(clo.nqf_domain);
    const sos = (clo.mapped_sos || []).map(String);
    const pis = (clo.pi_codes || []).map(String);
    const owners = piOwnerMap(curriculum);
    const grouped = new Map(sos.map(so => [so, []]));
    for (const pi of pis) {
      const owner = owners.get(pi);
      if (!owner) throw new ValidationError(`${pi} has no canonical SO definition`);
      if (!grouped.has(owner)) throw new ValidationError(`${pi} belongs to ${owner}, which is not mapped for CLO ${cloId(clo.clo_number ?? clo.current_clo_id)}`);
      grouped.get(owner).push(pi);
    }
    const mapping = sos.map(so => grouped.get(so).length ? `${so} (${grouped.get(so).join(', ')})` : so).join(', ');
    return mapping ? `${domain} · ${mapping}` : domain;
  }

  function formatBaselineMapping(clo) {
    const domain = domainName(clo.nqf_domain);
    const sos = [...new Set((String(clo.source_so || '').match(/\d+/g) || []).map(value => `SO${value}`))];
    return sos.length ? `${domain} · ${sos.join(', ')}` : domain;
  }

  function liveCurrentClo(clo) {
    return {
      ...clo,
      current_clo_id: cloId(clo.clo_number),
      current_clo_text: clo.clo_text
    };
  }

  function reconcileAudit(audit, baseline, curriculum) {
    if (!audit || !Array.isArray(audit.relationships)) throw new ValidationError('The comparison audit is unavailable or malformed');
    if (!baseline || !Array.isArray(baseline.courses)) throw new ValidationError('The Term 251 baseline data is unavailable or malformed');
    const courses = curriculum && curriculum.curriculum && curriculum.curriculum.courses;
    if (!Array.isArray(courses)) throw new ValidationError('The current curriculum data is unavailable or malformed');
    const currentCourses = new Map(courses.map(course => [code(course.course_code), course]));
    const baselineCourses = new Map(baseline.courses.map(course => [code(course.course_code), course]));
    const included = audit.scope && audit.scope.included_courses || [];
    const relationships = [];

    for (const courseCode of included) {
      const current = currentCourses.get(courseCode);
      const historical = baselineCourses.get(courseCode);
      if (!current || !historical) throw new ValidationError(`Selected comparison course ${courseCode} cannot be found`);
      const liveById = new Map((current.clos || []).map(clo => [cloId(clo.clo_number), liveCurrentClo(clo)]));
      const usedCurrent = new Set();
      const audited = audit.relationships.filter(item => item.course_code === courseCode);
      if (audited.some(item => item.type === 'ambiguous')) throw new ValidationError('The CLO relationship structure is ambiguous and the comparison audit should be regenerated before producing the formal report.');

      for (const source of audited) {
        const expectedIds = (source.current_clos || []).map(item => cloId(item.current_clo_id));
        const available = expectedIds.map(id => liveById.get(id)).filter(Boolean);
        if (available.length !== expectedIds.length) {
          if (source.type === 'added' && available.length === 0) continue;
          if (['unchanged','modified'].includes(source.type) && expectedIds.length === 1 && available.length === 0 && source.baseline_clos.length === 1) {
            relationships.push({...source, type:'omitted', current_clos:[], comment:'Outcome is no longer present in the current CLO set.'});
            continue;
          }
          throw new ValidationError('The CLO relationship structure has changed and the comparison audit should be regenerated before producing the formal report.');
        }
        expectedIds.forEach(id => usedCurrent.add(id));
        let type = source.type;
        let comment = source.comment || source.note || LABELS[type];
        const wordingChangedAfterAudit = available.some((item, index) => norm(item.current_clo_text) !== norm(source.current_clos[index].current_clo_text));
        if (source.type === 'unchanged' && wordingChangedAfterAudit) type = 'modified';
        if (wordingChangedAfterAudit) comment = 'Term 261 CLO wording updated after the validated comparison audit.';
        relationships.push({...source, type, current_clos:available, comment});
      }
      for (const [id, item] of liveById) {
        if (!usedCurrent.has(id)) relationships.push({course_code:courseCode, course_title:current.course_title, type:'added', baseline_clos:[], current_clos:[item], note:null, comment:'New CLO added to the current curriculum.'});
      }
    }

    const countRelations = type => relationships.filter(item => item.type === type).length;
    const countOld = type => relationships.filter(item => item.type === type).reduce((sum, item) => sum + item.baseline_clos.length, 0);
    const countNew = type => relationships.filter(item => item.type === type).reduce((sum, item) => sum + item.current_clos.length, 0);
    const countsFor = selected => {
      const list = selected ? relationships.filter(item => item.course_code === selected) : relationships;
      const rel = type => list.filter(item => item.type === type).length;
      const old = type => list.filter(item => item.type === type).reduce((sum,item) => sum + item.baseline_clos.length, 0);
      const fresh = type => list.filter(item => item.type === type).reduce((sum,item) => sum + item.current_clos.length, 0);
      return {
        baseline_clos:list.reduce((sum,item) => sum + item.baseline_clos.length,0), current_clos:list.reduce((sum,item) => sum + item.current_clos.length,0),
        unchanged:rel('unchanged'), modified:rel('modified'), renumbered:rel('renumbered'), added:fresh('added'), omitted:old('omitted'),
        merge_cases:rel('merged'), split_cases:rel('split'), ambiguous:rel('ambiguous')
      };
    };
    const courseSummaries = included.map(courseCode => {
      const course = currentCourses.get(courseCode);
      const rels = relationships.filter(item => item.course_code === courseCode);
      return {course_code:courseCode, course_title:course.course_title, change_types:[...new Set(rels.filter(item => item.type !== 'unchanged').map(item => item.type))], counts:countsFor(courseCode)};
    });
    const counts = countsFor(null);
    if (counts.ambiguous) throw new ValidationError('The CLO relationship structure is ambiguous and the comparison audit should be regenerated before producing the formal report.');
    return {relationships, courseSummaries, counts, currentCourses, curriculum, included};
  }

  function reportForScope(reconciled, scope) {
    if (!scope || scope === 'all') return {...reconciled, scope:'all'};
    const summary = reconciled.courseSummaries.find(item => item.course_code === scope);
    if (!summary) throw new ValidationError(`Selected course ${scope} cannot be found`);
    return {
      ...reconciled, scope, selectedCourse:summary,
      relationships:reconciled.relationships.filter(item => item.course_code === scope),
      courseSummaries:[summary], counts:summary.counts
    };
  }

  const wRun = (text, options={}) => text === '\n' ? '<w:r><w:br/></w:r>' : `<w:r><w:rPr>${options.bold?'<w:b/>':''}${options.italic?'<w:i/>':''}${options.color?`<w:color w:val="${options.color}"/>`:''}${options.size?`<w:sz w:val="${options.size}"/><w:szCs w:val="${options.size}"/>`:''}</w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
  function wParagraph(content, options={}) {
    const runs = Array.isArray(content) ? content.join('') : wRun(content, options.run || {});
    return `<w:p><w:pPr>${options.style?`<w:pStyle w:val="${options.style}"/>`:''}${options.align?`<w:jc w:val="${options.align}"/>`:''}${options.keep?'<w:keepNext/>':''}${options.pageBefore?'<w:pageBreakBefore/>':''}${options.before||options.after?`<w:spacing w:before="${options.before||0}" w:after="${options.after||0}"/>`:''}</w:pPr>${runs}</w:p>`;
  }
  const pageBreak = () => '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
  function wCell(content, width, options={}) {
    const paragraphs = Array.isArray(content) ? content.join('') : content;
    return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${options.fill?`<w:shd w:fill="${options.fill}"/>`:''}<w:vAlign w:val="center"/><w:tcMar><w:top w:w="90" w:type="dxa"/><w:start w:w="120" w:type="dxa"/><w:bottom w:w="90" w:type="dxa"/><w:end w:w="120" w:type="dxa"/></w:tcMar></w:tcPr>${paragraphs}</w:tc>`;
  }
  function wTable(rows, widths, options={}) {
    const grid = widths.map(width => `<w:gridCol w:w="${width}"/>`).join('');
    const body = rows.map((row,index) => `<w:tr><w:trPr>${index===0&&options.header!==false?'<w:tblHeader/>':''}<w:cantSplit/></w:trPr>${row.map((cell,col) => wCell(cell,widths[col],{fill:index===0&&options.header!==false?'E8EDF3':null})).join('')}</w:tr>`).join('');
    return `<w:tbl><w:tblPr><w:tblW w:w="9400" w:type="dxa"/><w:tblInd w:w="120" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders>${['top','left','bottom','right','insideH','insideV'].map(edge=>`<w:${edge} w:val="single" w:sz="5" w:color="A9B3BE"/>`).join('')}</w:tblBorders></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${body}</w:tbl>`;
  }
  const heading = (text, level=1, pageBefore=false) => wParagraph(text,{style:`Heading${level}`,keep:true,pageBefore});
  function cloCell(items, side, curriculum) {
    if (!items.length) return wParagraph('-', {run:{color:'59636E'}});
    return items.map(item => {
      const id = side === 'baseline' ? item.baseline_clo_ref : item.current_clo_id;
      const text = side === 'baseline' ? item.clo_text : item.current_clo_text;
      const mapping = side === 'baseline' ? formatBaselineMapping(item) : formatCurrentMapping(item, curriculum);
      return wParagraph([wRun(`CLO ${id}`,{bold:true,color:'17365D'}),wRun('\n'),wRun(mapping,{italic:true,color:'59636E'}),wRun('\n'),wRun(text)]);
    });
  }
  function detailTable(items, curriculum) {
    const rows = [[wParagraph('Change',{run:{bold:true}}),wParagraph('Term 251 CLO',{run:{bold:true}}),wParagraph('Term 261 CLO',{run:{bold:true}}),wParagraph('Brief Justification / Comment',{run:{bold:true}})]];
    for (const item of items) rows.push([wParagraph(LABELS[item.type]),cloCell(item.baseline_clos,'baseline',curriculum),cloCell(item.current_clos,'current',curriculum),wParagraph(item.comment)]);
    return wTable(rows,[1400,2650,2650,2700]);
  }
  function cloNumberParts(value) {
    return String(value||'').split('.').map(part=>Number.parseInt(part,10)).map(value=>Number.isFinite(value)?value:Number.MAX_SAFE_INTEGER);
  }
  function presentationCloId(item) {
    return item.current_clos[0]?.current_clo_id || item.baseline_clos[0]?.baseline_clo_ref || '';
  }
  function compareCloIds(left,right) {
    const a=cloNumberParts(left), b=cloNumberParts(right), length=Math.max(a.length,b.length);
    for(let index=0;index<length;index++){const difference=(a[index]??-1)-(b[index]??-1);if(difference)return difference;}
    return 0;
  }
  function sortRelationships(items) {
    return items.map((item,index)=>({item,index})).sort((left,right)=>compareCloIds(presentationCloId(left.item),presentationCloId(right.item))||(left.item.type==='omitted'?1:0)-(right.item.type==='omitted'?1:0)||left.index-right.index).map(entry=>entry.item);
  }
  function summaryTable(counts) {
    return wTable([[wParagraph('Category',{run:{bold:true}}),wParagraph('Count',{run:{bold:true}})],...SUMMARY_KEYS.map(([label,key])=>[wParagraph(label),wParagraph(String(counts[key]))])],[7000,2400]);
  }
  function approvalTable() {
    const rows = [['Item','Status / Approval'],['Program','B.Sc. Electrical Engineering'],['Curriculum Term','261'],['Prepared by','Curriculum Committee'],['Review Status','Proposed for Approval'],['College Curriculum Committee',''],['Approval Date',''],['Institutional Curriculum Committee, if required',''],['Approval Date','']].map(row=>row.map(value=>wParagraph(value)));
    return wTable(rows,[3800,5600]);
  }
  function titleBlock(report) {
    const selected = report.scope === 'all' ? null : report.selectedCourse;
    return wParagraph('UNDERGRADUATE ELECTRICAL ENGINEERING PROGRAM',{align:'center',after:160,run:{bold:true,color:'2E74B5'}})+wParagraph('CLO Revision Report',{align:'center',after:120,run:{bold:true,color:'17365D',size:48}})+(selected?wParagraph(`${selected.course_code} — ${selected.course_title}`,{align:'center',after:80,run:{bold:true,color:'17365D',size:28}}):'')+wParagraph('Term 251 ABET Submission to Term 261 Proposed Curriculum',{align:'center',after:320,run:{bold:true,color:'59636E',size:26}});
  }
  function allCourseBody(report) {
    const changed = report.courseSummaries.filter(item=>item.change_types.length);
    const unchanged = report.courseSummaries.filter(item=>!item.change_types.length);
    const scopeRows = [[wParagraph('Course',{run:{bold:true}}),wParagraph('Title',{run:{bold:true}})],...report.courseSummaries.map(item=>[wParagraph(item.course_code),wParagraph(item.course_title)])];
    let xml = titleBlock(report)+heading('1. Purpose')+wParagraph(PURPOSE)+heading('2. Background')+wParagraph(BACKGROUND)+heading('3. Rationale for CLO Review')+wParagraph(RATIONALE)+heading('4. Scope')+wParagraph('The scope of this review is limited to the 16 Undergraduate EE courses represented in both the Term 251 and Term 261 curricula. Elective courses and non-EE College/supporting courses are excluded from the comparison.')+wTable(scopeRows,[1800,7600])+heading('5. Summary of CLO Changes')+summaryTable(report.counts)+wParagraph(`The comparison accounts for all ${report.counts.baseline_clos} Term 251 CLOs and all ${report.counts.current_clos} Term 261 CLOs. Merged relationships are counted once and are not duplicated as omissions or additions.`)+pageBreak()+heading('6. Detailed CLO Comparison by Course');
    for (const [index, course] of changed.entries()) xml += heading(`${course.course_code} - ${course.course_title}`,2,index>0)+detailTable(sortRelationships(report.relationships.filter(item=>item.course_code===course.course_code)),report.curriculum);
    xml += heading('7. Courses with No CLO Changes')+wTable([[wParagraph('Course Code',{run:{bold:true}}),wParagraph('Course Title',{run:{bold:true}})],...unchanged.map(item=>[wParagraph(item.course_code),wParagraph(item.course_title)])],[2200,7200])+heading('8. Impact on ABET Assessment')+wParagraph(IMPACT)+heading('9. Approval Status',1,true)+approvalTable()+heading('10. Conclusion')+wParagraph(CONCLUSION);
    return xml;
  }
  function singleCourseBody(report) {
    const course=report.selectedCourse;
    const unchanged=course.change_types.length===0;
    return titleBlock(report)+heading('1. Purpose')+wParagraph(`${PURPOSE} This standalone report is limited to ${course.course_code} - ${course.course_title}.`)+heading('2. Background / Rationale')+wParagraph(`${BACKGROUND} ${RATIONALE}`)+heading(`3. Summary of CLO Changes for ${course.course_code}`)+summaryTable(report.counts)+wParagraph(unchanged?'The CLO set is unchanged between Term 251 and Term 261.':'The summary reflects only this selected course.')+heading('4. Detailed CLO Comparison')+detailTable(sortRelationships(report.relationships),report.curriculum)+heading('5. Impact on ABET Assessment')+wParagraph(IMPACT)+heading('6. Approval Status',1,true)+approvalTable();
  }
  function buildDocumentXml(report, templateXml) {
    const sectMatch = templateXml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/);
    if (!sectMatch) throw new ValidationError('The CLO report Word template is missing page-layout information');
    const body = report.scope==='all'?allCourseBody(report):singleCourseBody(report);
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}${sectMatch[0]}</w:body></w:document>`;
  }
  function filenameForScope(scope) { return scope==='all'?'CLO_Revision_Report_Term_251_to_261.docx':`${safeFilenameCode(scope)}_CLO_Revision_Report_Term_251_to_261.docx`; }

  async function generateDocx(report, templateBytes, JSZipImpl, outputType='blob') {
    if (!JSZipImpl) throw new ValidationError('The local DOCX ZIP library is unavailable');
    let zip;
    try { zip=await JSZipImpl.loadAsync(templateBytes); } catch { throw new ValidationError('The CLO report Word template could not be opened'); }
    const part=zip.file('word/document.xml');
    if (!part) throw new ValidationError('The CLO report Word template is missing word/document.xml');
    const templateXml=await part.async('string');
    const documentXml=buildDocumentXml(report,templateXml);
    if (!documentXml.includes('Brief Justification / Comment')) throw new ValidationError('The generated document failed validation');
    zip.file('word/document.xml',documentXml);
    const options={type:outputType,compression:'DEFLATE'};
    if(outputType==='blob') options.mimeType=DOCX_MIME;
    const file=await zip.generateAsync(options);
    return {file,filename:filenameForScope(report.scope),report};
  }
  async function loadJson(url,label) {
    let response;
    try { response=await fetch(url,{credentials:'same-origin'}); } catch { throw new ValidationError(`${label} could not be loaded`); }
    if(!response.ok) throw new ValidationError(`${label} could not be loaded (${response.status})`);
    try { return await response.json(); } catch { throw new ValidationError(`${label} is not valid JSON`); }
  }
  async function loadRuntimeData(urls) {
    const [baseline,audit,curriculum]=await Promise.all([loadJson(urls.baseline,'Term 251 baseline data'),loadJson(urls.audit,'Comparison audit'),loadJson(urls.curriculum,'Current curriculum')]);
    return {baseline,audit,curriculum};
  }
  async function generateFromUrls(scope,urls,JSZipImpl=global.JSZip) {
    if(!JSZipImpl) throw new ValidationError('The local DOCX ZIP library is unavailable');
    const data=await loadRuntimeData(urls);
    const reconciled=reconcileAudit(data.audit,data.baseline,data.curriculum);
    const report=reportForScope(reconciled,scope);
    let response;
    try { response=await fetch(urls.template,{credentials:'same-origin'}); } catch { throw new ValidationError('The CLO report Word template could not be loaded'); }
    if(!response.ok) throw new ValidationError(`The CLO report Word template could not be loaded (${response.status})`);
    return generateDocx(report,await response.arrayBuffer(),JSZipImpl,'blob');
  }
  function downloadBlob(blob,filename) { const url=URL.createObjectURL(blob); const link=document.createElement('a'); link.href=url; link.download=filename; link.hidden=true; document.body.appendChild(link); link.click(); link.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000); }
  async function initializePage() {
    const root=document.getElementById('cloReportGenerator'); if(!root) return;
    const select=document.getElementById('cloReportScope'), button=document.getElementById('generateCloReport'), status=document.getElementById('cloReportStatus');
    const urls={baseline:root.dataset.baseline,audit:root.dataset.audit,curriculum:root.dataset.curriculum,template:root.dataset.template};
    button.addEventListener('click',async()=>{ button.disabled=true; status.className='report-generator-status muted'; status.textContent='Generating Word report...'; try{const result=await generateFromUrls(select.value,urls); downloadBlob(result.file,result.filename); status.className='report-generator-status success'; status.textContent='Downloaded successfully.';}catch(error){status.className='report-generator-status error'; status.textContent=error.message||'Could not generate the Word report.';}finally{button.disabled=false;} });
  }

  const api={ValidationError,formatCurrentMapping,formatBaselineMapping,reconcileAudit,reportForScope,sortRelationships,buildDocumentXml,filenameForScope,generateDocx,loadRuntimeData,generateFromUrls};
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
  global.cloRevisionDocxGenerator=api;
  if(typeof document!=='undefined') document.addEventListener('DOMContentLoaded',initializePage);
}(typeof window!=='undefined'?window:globalThis));
