(function () {
  'use strict';

  const overlay = () => document.getElementById('cloReviewOverlay');
  const content = () => document.getElementById('cloReviewContent');
  const dateISO = () => {
    const now = new Date();
    return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
  };
  let state = null;
  const clone = value => typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));

  function closeReview() {
    overlay().classList.remove('visible');
    overlay().setAttribute('aria-hidden', 'true');
    document.body.classList.remove('review-open');
    content().innerHTML = '';
    state = null;
  }

  function mappingModel() {
    const outcomes = window.cloReviewContext.abet.student_outcomes || {};
    return Object.fromEntries(Object.entries(outcomes).map(([so, value]) => [so, [...(value.pis || [])]]));
  }

  const unique = values => [...new Set(values)];
  const sameSelection = (left, right) => {
    const a = unique(left || []).sort(), b = unique(right || []).sort();
    return a.length === b.length && a.every((value, index) => value === b[index]);
  };
  function methodPools() {
    const context = window.cloReviewContext;
    const code = context.raw.course_code;
    const sourceCourses = ['EE 490', 'EE 492'].includes(code)
      ? (context.courses || []).filter(course => course.course_code === code)
      : (context.courses || []).filter(course => !['EE 490', 'EE 492'].includes(course.course_code));
    const clos = sourceCourses.flatMap(course => course.clos || []);
    return {
      teaching: unique(clos.flatMap(clo => clo.teaching_strategy || [])),
      assessment: unique(clos.flatMap(clo => clo.assessment_methods || []))
    };
  }

  function freshState() {
    const context = window.cloReviewContext;
    // Clone every approved value used by the form so editable state never shares
    // mutable object references with the authoritative dashboard data.
    const approvedCourse = clone(context.normalized);
    const approvedClos = clone(context.raw.clos || []);
    return {
      reviewer: '', reviewDate: dateISO(), course: approvedCourse,
      mappings: mappingModel(), methodPools: methodPools(),
      existing: approvedClos.map(clo => ({
        source: clo, action: 'no-change', proposedText: clo.clo_text || '',
        sos: [...(clo.mapped_sos || [])], pis: [...(clo.pi_codes || [])], justification: '',
        teachingStrategies: [...(clo.teaching_strategy || [])], assessmentMethods: [...(clo.assessment_methods || [])], methodAutoModify: false
      })),
      added: [], nextId: 1
    };
  }

  const options = (values, selected) => {
    const chosen = Array.isArray(selected) ? selected : [selected];
    return values.map(value => `<option value="${portal.esc(value)}"${chosen.includes(value) ? ' selected' : ''}>${portal.esc(value)}</option>`).join('');
  };
  const piChoices = item => [...new Set(item.sos.flatMap(so => state.mappings[so] || []))];

  function methodChecklist(item, kind, index, field, values, label) {
    const selected = field === 'teaching' ? item.teachingStrategies : item.assessmentMethods;
    return `<fieldset class="review-methods"><legend>${label}</legend><div class="review-method-options">${values.map((value, optionIndex) => `<label class="review-method-option"><input type="checkbox" data-method-kind="${kind}" data-method-index="${index}" data-method-field="${field}" value="${portal.esc(value)}"${selected.includes(value) ? ' checked' : ''}><span>${portal.esc(value)}</span></label>`).join('')}</div></fieldset>`;
  }

  function methodFields(item, kind, index) {
    return `<div class="review-method-grid">${methodChecklist(item, kind, index, 'teaching', state.methodPools.teaching, 'Teaching Strategies')}${methodChecklist(item, kind, index, 'assessment', state.methodPools.assessment, 'Assessment Methods')}</div>`;
  }

  function methodsChanged(item) {
    return !sameSelection(item.teachingStrategies, item.source.teaching_strategy || []) || !sameSelection(item.assessmentMethods, item.source.assessment_methods || []);
  }

  function otherProposalChanged(item) {
    return item.proposedText !== (item.source.clo_text || '') || !sameSelection(item.sos, item.source.mapped_sos || []) || !sameSelection(item.pis, item.source.pi_codes || []) || Boolean(item.justification);
  }

  function mappingFields(item, kind, index) {
    return `<label class="review-field">Proposed SO <small>Select all that apply</small><select multiple size="4" data-${kind}-so="${index}">${options(Object.keys(state.mappings), item.sos)}</select><span class="review-error" data-error="${kind}-${index}-so"></span></label>
      <label class="review-field">Proposed PI <small>Filtered by selected SOs</small><select multiple size="4" data-${kind}-pi="${index}">${options(piChoices(item), item.pis)}</select><span class="review-error" data-error="${kind}-${index}-pi"></span></label>`;
  }

  function existingCard(item, index) {
    const clo = item.source;
    const justification = `<label class="review-field review-text review-justification">Comment / Justification<textarea data-existing-justification="${index}" placeholder="Briefly explain why this change is proposed">${portal.esc(item.justification)}</textarea><span class="review-error" data-error="existing-${index}-justification"></span></label>`;
    const proposal = item.action === 'modify' ? `<div class="review-proposal"><label class="review-field review-text">Proposed CLO<textarea data-existing-text="${index}">${portal.esc(item.proposedText)}</textarea><span class="review-error" data-error="existing-${index}-text"></span></label>${mappingFields(item, 'existing', index)}</div>` : (item.action === 'omit' ? `<div class="review-proposal">${justification}</div>` : '');
    return `<article class="review-clo is-${item.action}" data-existing-card="${index}"><div class="review-clo-head"><div><div class="code">CLO ${portal.esc(clo.clo_number)}</div><p class="review-current">${portal.esc(clo.clo_text)}</p><div class="review-mapping">Current SO: ${portal.esc((clo.mapped_sos || []).join(', ') || 'None')} &nbsp;·&nbsp; Current PI: ${portal.esc((clo.pi_codes || []).join(', ') || 'None')}</div></div><div class="review-actions" role="radiogroup" aria-label="Action for CLO ${portal.esc(clo.clo_number)}">${['no-change','modify','omit'].map(action => `<label class="review-choice"><input type="radio" name="existing-action-${index}" value="${action}" data-existing-action="${index}"${item.action === action ? ' checked' : ''}><span>${action === 'no-change' ? 'No Change' : action[0].toUpperCase() + action.slice(1)}</span></label>`).join('')}</div></div>${proposal}${item.action === 'modify' ? methodFields(item, 'existing', index) + justification : ''}</article>`;
  }

  function newCard(item, index) {
    const justification = `<label class="review-field review-text review-justification">Comment / Justification<textarea data-new-justification="${index}" placeholder="Briefly explain why this new CLO is proposed">${portal.esc(item.justification)}</textarea><span class="review-error" data-error="new-${index}-justification"></span></label>`;
    return `<article class="review-clo" data-new-card="${index}"><div class="review-clo-head"><div class="code">Proposed New CLO ${index + 1}</div><button type="button" class="review-remove" data-remove-new="${index}">Remove</button></div><div class="review-proposal"><label class="review-field review-text">Proposed CLO<textarea data-new-text="${index}" placeholder="Enter the proposed CLO wording">${portal.esc(item.proposedText)}</textarea><span class="review-error" data-error="new-${index}-text"></span></label>${mappingFields(item, 'new', index)}</div>${methodFields(item, 'new', index)}${justification}</article>`;
  }

  function render() {
    const c = state.course;
    content().innerHTML = `<div class="review-meta"><div class="review-course"><div class="code">${portal.esc(c.code)}</div><h3>${portal.esc(c.title)}</h3><div>${portal.badge(c.credits ? c.credits + ' credits' : 'Credits unavailable')}${c.track ? portal.badge(c.track) : ''}${c.re ? portal.badge(c.re) : ''}${c.level ? portal.badge('Level ' + c.level) : ''}</div></div><label class="review-field">Reviewer Name<input id="reviewerName" value="${portal.esc(state.reviewer)}" autocomplete="name" placeholder="Enter reviewer name"><span class="review-error" data-error="reviewer"></span></label><label class="review-field">Review Date<input value="${state.reviewDate}" readonly></label></div>
      <div class="review-section-heading"><h3>Existing CLO Review</h3></div><div class="review-list">${state.existing.map(existingCard).join('')}</div>
      <div class="review-section-heading"><h3>Proposed New CLOs</h3><button class="review-secondary" id="addNewClo" type="button">+ Add New CLO</button></div><div class="review-list" id="newCloList">${state.added.length ? state.added.map(newCard).join('') : '<p class="review-new-empty">No new CLOs proposed.</p>'}</div>
      <div class="review-footer"><button class="review-primary" id="generateReviewPdf" type="button">Generate CLO Review PDF</button></div>`;
  }

  function openReview() {
    if (!window.cloReviewContext) return;
    state = freshState();
    render();
    overlay().classList.add('visible');
    overlay().setAttribute('aria-hidden', 'false');
    document.body.classList.add('review-open');
    setTimeout(() => document.getElementById('reviewerName')?.focus(), 0);
  }

  function updateDependentPI(kind, index, sos) {
    const item = kind === 'existing' ? state.existing[index] : state.added[index];
    item.sos = sos;
    const allowed = piChoices(item);
    item.pis = item.pis.filter(pi => allowed.includes(pi));
    const select = content().querySelector(`[data-${kind}-pi="${index}"]`);
    select.innerHTML = options(allowed, item.pis);
  }

  function setError(key, message, input) {
    const el = content().querySelector(`[data-error="${key}"]`);
    if (el) el.textContent = message;
    if (input) input.classList.toggle('review-invalid', Boolean(message));
  }

  function validate() {
    let valid = true;
    const reviewer = document.getElementById('reviewerName');
    state.reviewer = reviewer.value.trim();
    setError('reviewer', state.reviewer ? '' : 'Reviewer name is required.', reviewer);
    valid = Boolean(state.reviewer);
    state.existing.forEach((item, index) => {
      if (item.action === 'no-change') return;
      const justification = content().querySelector(`[data-existing-justification="${index}"]`);
      item.justification = justification.value.trim();
      setError(`existing-${index}-justification`, item.justification ? '' : 'Comment / Justification is required.', justification);
      valid = valid && Boolean(item.justification);
      if (item.action === 'omit') return;
      const text = content().querySelector(`[data-existing-text="${index}"]`);
      const so = content().querySelector(`[data-existing-so="${index}"]`);
      const pi = content().querySelector(`[data-existing-pi="${index}"]`);
      item.proposedText = text.value.trim(); item.sos = [...so.selectedOptions].map(x => x.value); item.pis = [...pi.selectedOptions].map(x => x.value);
      setError(`existing-${index}-text`, item.proposedText ? '' : 'Proposed CLO text is required.', text);
      setError(`existing-${index}-so`, item.sos.length ? '' : 'Select an SO.', so);
      setError(`existing-${index}-pi`, item.pis.length ? '' : 'Select a PI.', pi);
      valid = valid && Boolean(item.proposedText && item.sos.length && item.pis.length);
    });
    state.added.forEach((item, index) => {
      const text = content().querySelector(`[data-new-text="${index}"]`);
      const so = content().querySelector(`[data-new-so="${index}"]`);
      const pi = content().querySelector(`[data-new-pi="${index}"]`);
      const justification = content().querySelector(`[data-new-justification="${index}"]`);
      item.proposedText = text.value.trim(); item.sos = [...so.selectedOptions].map(x => x.value); item.pis = [...pi.selectedOptions].map(x => x.value); item.justification = justification.value.trim();
      setError(`new-${index}-text`, item.proposedText ? '' : 'Proposed CLO text is required.', text);
      setError(`new-${index}-so`, item.sos.length ? '' : 'Select an SO.', so);
      setError(`new-${index}-pi`, item.pis.length ? '' : 'Select a PI.', pi);
      setError(`new-${index}-justification`, item.justification ? '' : 'Comment / Justification is required.', justification);
      valid = valid && Boolean(item.proposedText && item.sos.length && item.pis.length && item.justification);
    });
    if (!valid) content().querySelector('.review-invalid')?.focus();
    return valid;
  }

  function sanitize(value) { return value.trim().replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, ''); }

  function generatePDF() {
    if (!validate()) return;
    if (!window.jspdf?.jsPDF || typeof window.jspdf.jsPDF.API.autoTable !== 'function') { setError('reviewer', 'PDF generation dependencies are unavailable. Refresh while connected and try again.'); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const width = doc.internal.pageSize.getWidth(), height = doc.internal.pageSize.getHeight(), margin = 15;
    const blue = [20,61,102], orange = [242,162,58];
    const footer = data => { const page = doc.internal.getCurrentPageInfo().pageNumber; doc.setFillColor(...blue); doc.rect(0,height-10,width,10,'F'); doc.setTextColor(255); doc.setFontSize(8); doc.text('PSU Curriculum Intelligence Portal',margin,height-4); doc.text(`Page ${page}`,width-margin-12,height-4); };
    doc.setFillColor(...blue); doc.rect(0,0,width,24,'F'); doc.setFillColor(...orange); doc.rect(0,24,width,2,'F');
    doc.setTextColor(255); doc.setFont('helvetica','bold'); doc.setFontSize(17); doc.text('CLO Review Report',margin,15);
    doc.setTextColor(25); doc.setFontSize(15); doc.text(`${state.course.code} — ${state.course.title}`,margin,37);
    doc.setFont('helvetica','normal'); doc.setFontSize(9.5); doc.setTextColor(80);
    const meta = [`Credits: ${state.course.credits || 'N/A'}`,`Type: ${state.course.re || 'N/A'}`,`Level: ${state.course.level || 'N/A'}`,`Reviewer: ${state.reviewer}`,`Review Date: ${state.reviewDate}`];
    doc.text(meta,margin,44);
    doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.setTextColor(...blue); doc.text('Existing CLO Review',margin,67);
    const rows = state.existing.map(item => {
      const action = item.action === 'no-change' ? 'NO CHANGE' : item.action.toUpperCase();
      const methodChange = methodsChanged(item);
      const currentMethods = methodChange ? `\nCurrent Teaching Strategies: ${(item.source.teaching_strategy || []).join('; ') || 'None'}\nCurrent Assessment Methods: ${(item.source.assessment_methods || []).join('; ') || 'None'}` : '';
      const proposedMethods = methodChange ? `\nProposed Teaching Strategies: ${item.teachingStrategies.join('; ') || 'None'}\nProposed Assessment Methods: ${item.assessmentMethods.join('; ') || 'None'}` : '';
      const current = `Current CLO: ${item.source.clo_text}\nCurrent SO: ${(item.source.mapped_sos || []).join(', ') || 'None'}\nCurrent PI: ${(item.source.pi_codes || []).join(', ') || 'None'}${currentMethods}`;
      const proposed = item.action === 'modify' ? `Proposed CLO: ${item.proposedText}\nProposed SO: ${item.sos.join(', ')}\nProposed PI: ${item.pis.join(', ')}${proposedMethods}\nComment / Justification: ${item.justification}` : (item.action === 'omit' ? `Proposed Action: OMIT\nComment / Justification: ${item.justification}` : 'Proposed Action: NO CHANGE');
      return [String(item.source.clo_number), current, action, proposed];
    });
    doc.autoTable({ startY: 71, head: [['CLO','Current Approved CLO / Mapping','Proposed Action','Proposal Details']], body: rows, margin:{left:margin,right:margin,bottom:15}, styles:{fontSize:8,cellPadding:3,lineColor:[205,210,218],lineWidth:.25,overflow:'linebreak'}, headStyles:{fillColor:blue,textColor:255}, columnStyles:{0:{cellWidth:14,fontStyle:'bold'},2:{cellWidth:27,fontStyle:'bold'},3:{cellWidth:55}}, alternateRowStyles:{fillColor:[244,247,250]} });
    let y = doc.lastAutoTable.finalY + 10;
    if (y > height - 40) { doc.addPage(); y = 20; }
    doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.setTextColor(...blue); doc.text('Proposed New CLOs',margin,y);
    if (state.added.length) {
      doc.autoTable({ startY:y+4, head:[['New CLO','Proposed CLO Wording','SO','PI','Comment / Justification']], body:state.added.map((item,index)=>[String(index+1),`${item.proposedText}\nTeaching Strategies: ${item.teachingStrategies.join('; ') || 'None'}\nAssessment Methods: ${item.assessmentMethods.join('; ') || 'None'}`,item.sos.join(', '),item.pis.join(', '),item.justification]), margin:{left:margin,right:margin,bottom:15}, styles:{fontSize:8.5,cellPadding:3,lineColor:[205,210,218],lineWidth:.25,overflow:'linebreak'}, headStyles:{fillColor:blue,textColor:255}, columnStyles:{0:{cellWidth:16,fontStyle:'bold'},2:{cellWidth:16},3:{cellWidth:20},4:{cellWidth:48}}, alternateRowStyles:{fillColor:[244,247,250]} });
    } else { doc.setFont('helvetica','normal'); doc.setFontSize(9.5); doc.setTextColor(80); doc.text('No new CLOs proposed.',margin,y+7); }
    const pages = doc.internal.getNumberOfPages(); for (let page=1; page<=pages; page++){ doc.setPage(page); footer(); }
    const parts = [sanitize(state.course.code), 'CLO_Review']; if (state.reviewer) parts.push(sanitize(state.reviewer)); parts.push(state.reviewDate);
    doc.save(parts.filter(Boolean).join('_') + '.pdf');
  }

  window.addEventListener('open-clo-review', openReview);
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('cloReviewClose').addEventListener('click', closeReview);
    overlay().addEventListener('click', event => { if (event.target === overlay()) closeReview(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && overlay().classList.contains('visible')) closeReview(); });
    content().addEventListener('input', event => { if (event.target.id === 'reviewerName') state.reviewer = event.target.value; const ex=event.target.dataset.existingText, nw=event.target.dataset.newText, exj=event.target.dataset.existingJustification, nwj=event.target.dataset.newJustification; if(ex!==undefined) state.existing[+ex].proposedText=event.target.value; if(nw!==undefined) state.added[+nw].proposedText=event.target.value; if(exj!==undefined) state.existing[+exj].justification=event.target.value; if(nwj!==undefined) state.added[+nwj].justification=event.target.value; });
    content().addEventListener('change', event => {
      const action=event.target.dataset.existingAction; if(action!==undefined){ state.reviewer=document.getElementById('reviewerName').value; const item=state.existing[+action]; item.action=event.target.value; item.methodAutoModify=false; if(event.target.value==='no-change'){ item.teachingStrategies=[...(item.source.teaching_strategy||[])]; item.assessmentMethods=[...(item.source.assessment_methods||[])]; } render(); return; }
      const methodKind=event.target.dataset.methodKind, methodIndex=event.target.dataset.methodIndex, methodField=event.target.dataset.methodField;
      if(methodKind!==undefined && methodIndex!==undefined && methodField!==undefined){
        const item=methodKind==='existing'?state.existing[+methodIndex]:state.added[+methodIndex];
        const selector=`[data-method-kind="${methodKind}"][data-method-index="${methodIndex}"][data-method-field="${methodField}"]:checked`;
        const selected=[...content().querySelectorAll(selector)].map(input=>input.value);
        if(methodField==='teaching') item.teachingStrategies=selected; else item.assessmentMethods=selected;
        if(methodKind==='existing'){
          if(methodsChanged(item) && item.action==='no-change'){ item.action='modify'; item.methodAutoModify=true; state.reviewer=document.getElementById('reviewerName').value; render(); }
          else if(!methodsChanged(item) && item.methodAutoModify && !otherProposalChanged(item)){ item.action='no-change'; item.methodAutoModify=false; state.reviewer=document.getElementById('reviewerName').value; render(); }
        }
        return;
      }
      for (const kind of ['existing','new']) { const so=event.target.dataset[`${kind}So`], pi=event.target.dataset[`${kind}Pi`]; if(so!==undefined) updateDependentPI(kind,+so,[...event.target.selectedOptions].map(x=>x.value)); if(pi!==undefined) (kind==='existing'?state.existing[+pi]:state.added[+pi]).pis=[...event.target.selectedOptions].map(x=>x.value); }
    });
    content().addEventListener('click', event => {
      if(event.target.id==='addNewClo'){ state.reviewer=document.getElementById('reviewerName').value; state.added.push({id:state.nextId++,proposedText:'',sos:[],pis:[],justification:'',teachingStrategies:[],assessmentMethods:[]}); render(); }
      const remove=event.target.dataset.removeNew; if(remove!==undefined){ state.reviewer=document.getElementById('reviewerName').value; state.added.splice(+remove,1); render(); }
      if(event.target.id==='generateReviewPdf') generatePDF();
    });
  });
})();
