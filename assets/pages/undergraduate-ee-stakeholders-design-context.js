document.addEventListener('DOMContentLoaded', async () => {
  const courseSelect = byId('contextCourse');
  const content = byId('contextContent');
  const printReport = byId('contextPrintReport');
  const states = new Map();
  let courses = new Map();
  let dimensions = {};
  let standards = new Map();
  let current = null;
  let nextRowId = 1;
  let customizing = false;

  const clean = value => portal.esc(value || '');
  const statusOptions = value => [
    ['', 'Select relevance'], ['Relevant', 'Relevant'],
    ['Possibly Relevant', 'Possibly Relevant'], ['Not Applicable', 'Not Applicable']
  ].map(([option, label]) => `<option value="${clean(option)}"${value === option ? ' selected' : ''}>${label}</option>`).join('');
  const textField = (label, role, value, index, multiline = false) => {
    const attr = `data-role="${role}" data-index="${index}"`;
    const control = multiline
      ? `<textarea ${attr}>${clean(value)}</textarea>`
      : `<input type="text" ${attr} value="${clean(value)}">`;
    return `<label class="context-field">${label}${control}</label>`;
  };

  function makeState(course) {
    return {
      stakeholders: course.stakeholders.map(item => ({ name: item.name, need: item.need, status: '', custom: false })),
      factors: course.factors.map(() => ({ status: '', note: '', extraConsideration: '', teachingIdea: '', assessmentPrompt: '' })),
      analysis: [], notes: ''
    };
  }

  function standardFor(id, courseCode) {
    const item = standards.get(id);
    return item && item.courses.some(mapping => mapping.courseCode === courseCode) ? item : null;
  }

  function courseStandards(courseCode) {
    return [...standards.entries()].filter(([, standard]) => standard.courses.some(mapping => mapping.courseCode === courseCode));
  }

  function standardsLinks(factor, courseCode) {
    return factor.standards.map(id => {
      const standard = standardFor(id, courseCode);
      if (!standard) return '';
      return `<a href="${clean(standard.officialUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Open official source for ${clean(standard.organization)} ${clean(standard.identifier)} (opens in a new tab)">${clean(standard.organization)} ${clean(standard.identifier)}</a>`;
    }).filter(Boolean).join('');
  }

  function guideMarkup(course, forPrint = false) {
    const suffix = forPrint ? '-print' : '';
    const emphasized = new Set(course.factors.map(factor => factor.dimension));
    const otherConcepts = Object.entries(dimensions).filter(([name]) => name !== 'Stakeholders' && !emphasized.has(name))
      .map(([name, definition]) => `<div><dt>${clean(name)}</dt><dd>${clean(definition)}</dd></div>`).join('');
    const people = course.stakeholders.map(person => `<article class="context-item context-guide-person">
      <h3>${clean(person.name)}</h3><p>${clean(person.why)}</p>
      <p><strong>Possible need / concern:</strong> ${clean(person.need)}</p>
    </article>`).join('');
    const factors = course.factors.map(factor => `<article class="context-item context-guide-factor">
      <h3>${clean(factor.dimension)}</h3>
      <div class="context-guide-grid">
        <div><span class="context-guide-label">What it means</span><p>${clean(dimensions[factor.dimension])}</p></div>
        <div><span class="context-guide-label">In this course</span><p>${clean(factor.consideration)}</p></div>
        <div><span class="context-guide-label">Example</span><p>${clean(factor.example)}</p></div>
        <div><span class="context-guide-label">Why it matters</span><p>${clean(factor.implication)}</p></div>
        <div><span class="context-guide-label">How to teach it</span><p>${clean(factor.teachingIdea)}</p></div>
        <div><span class="context-guide-label">How to assess it</span><p>${clean(factor.assessmentPrompt)}</p></div>
      </div>
      <div class="context-standard-links"><strong>Relevant standards:</strong> ${standardsLinks(factor, course.code) || '<span>None suggested for this factor</span>'}</div>
    </article>`).join('');
    return `<div class="context-guide"><section class="card context-course-head"><span class="code">${clean(course.code)}</span><h2>${clean(course.title)}</h2><p class="muted">${clean(course.rationale)}</p></section>
      <section class="card context-section" aria-labelledby="stakeholders-title${suffix}"><h2 id="stakeholders-title${suffix}">Why stakeholders matter</h2><p>Engineering decisions are rarely purely technical. Identifying the people who use, operate, maintain, regulate, purchase, or are affected by a system helps students recognize requirements that may not appear in the equations alone.</p><h3>Suggested stakeholders in ${clean(course.code)}</h3><div class="context-stakeholder-list">${people}</div>
      <div class="context-guide-activity"><span class="context-guide-label">How to teach stakeholders</span><p>${clean(course.stakeholderTeachingIdea)}</p><span class="context-guide-label">How to assess stakeholders</span><p>${clean(course.stakeholderAssessmentPrompt)}</p></div></section>
      <section class="card context-section" aria-labelledby="factors-title${suffix}"><h2 id="factors-title${suffix}">Contextual factors in ${clean(course.code)}</h2><p class="muted">Use the examples as teaching prompts. Their relevance depends on the particular engineering problem.</p><div class="context-factor-list">${factors}</div></section>
      ${otherConcepts ? `<section class="card context-section context-other-concepts"><h2>Other concepts to recognize</h2><p class="muted">These are not highlighted as course prompts here, but may matter for a particular problem or project.</p><dl>${otherConcepts}</dl></section>` : ''}</div>`;
  }

  function renderPage() {
    const course = courses.get(courseSelect.value);
    if (!course) return;
    current = course;
    if (!states.has(course.code)) states.set(course.code, makeState(course));
    if (customizing) renderEditor();
    else content.innerHTML = `${guideMarkup(course)}<section class="card context-section context-customize-callout"><h2>Customize for an activity</h2><p class="muted">Use the guide as it is, or adapt it to a specific engineering problem, laboratory, or project.</p><button id="contextCustomize" class="btn primary" type="button">Customize for this course</button></section>`;
  }

  function renderEditor() {
    const course = courses.get(courseSelect.value);
    const state = states.get(course.code);
    const stakeholderCards = state.stakeholders.map((person, index) => `<article class="context-item context-stakeholder">
      <h3>${clean(person.name)}${person.custom ? ' <span class="pill">Added by instructor</span>' : ''}</h3>
      ${person.custom ? '' : `<p>Possible need / concern: ${clean(course.stakeholders[index].need)}</p>`}
      <label class="context-field">Relevance for ${clean(person.name)}<select data-role="stakeholderStatus" data-index="${index}">${statusOptions(person.status)}</select></label>
      ${textField('Need / concern', 'stakeholderNeed', person.need, index)}
      ${person.custom ? `<button class="context-remove" type="button" data-remove-stakeholder="${index}">Remove custom stakeholder</button>` : ''}
    </article>`).join('');
    const factorCards = course.factors.map((factor, index) => {
      const choice = state.factors[index];
      const links = standardsLinks(factor, course.code);
      return `<article class="context-item context-factor-card">
        <h3>${clean(factor.dimension)}</h3><p class="context-definition">${clean(dimensions[factor.dimension])}</p>
        <p class="context-prompt"><strong>CIP suggestion:</strong> ${clean(factor.consideration)}</p>
        <p class="context-prompt"><strong>Possible engineering implication:</strong> ${clean(factor.implication)}</p>
        <div class="context-standard-links"><strong>Suggested standards:</strong> ${links || '<span>None suggested for this factor</span>'}</div>
        <label class="context-field">Relevance of ${clean(factor.dimension)}<select data-role="factorStatus" data-index="${index}">${statusOptions(choice.status)}</select></label>
        ${textField('Instructor addition: contextual consideration', 'factorExtraConsideration', choice.extraConsideration, index, true)}
        ${textField('Instructor addition: engineering implication / note', 'factorNote', choice.note, index, true)}
        ${textField('Instructor addition: teaching idea', 'factorTeachingIdea', choice.teachingIdea, index, true)}
        ${textField('Instructor addition: assessment idea', 'factorAssessmentPrompt', choice.assessmentPrompt, index, true)}
      </article>`;
    }).join('');
    const standardOptions = courseStandards(course.code).map(([id, standard]) =>
      `<option value="${clean(id)}">${clean(standard.organization)} ${clean(standard.identifier)}</option>`).join('');
    const factorOptions = Object.keys(dimensions).filter(name => name !== 'Stakeholders')
      .map(name => `<option value="${clean(name)}">${clean(name)}</option>`).join('');
    const analysisRows = state.analysis.map((row, index) => `<article class="context-item context-analysis-row">
      <div class="context-row-heading"><h3>Analysis ${index + 1}</h3><button type="button" data-remove-analysis="${index}">Remove row</button></div>
      ${textField('Stakeholder', 'analysisStakeholder', row.stakeholder, index)}
      ${textField('Need / concern', 'analysisNeed', row.need, index)}
      <label class="context-field">Contextual factor<select data-role="analysisFactor" data-index="${index}"><option value="">Choose if relevant</option>${factorOptions.replace(`value="${clean(row.factor)}"`, `value="${clean(row.factor)}" selected`)}</select></label>
      ${textField('Engineering implication', 'analysisImplication', row.implication, index, true)}
      ${textField('Requirement / constraint', 'analysisRequirement', row.requirement, index, true)}
      <label class="context-field">Relevant standard<select data-role="analysisStandard" data-index="${index}"><option value="">Choose if relevant</option>${standardOptions.replace(`value="${clean(row.standard)}"`, `value="${clean(row.standard)}" selected`)}</select></label>
      ${textField('Evidence / verification', 'analysisEvidence', row.evidence, index, true)}
    </article>`).join('');
    content.innerHTML = `<section class="card context-section context-edit-intro"><h2>Customize ${clean(course.code)}</h2><p class="muted">Customize these suggestions for the specific engineering problem, laboratory, activity, or project you are planning. Your additions remain separate from CIP suggestions.</p><button id="contextBackToGuide" class="btn" type="button">Back to teaching guide</button></section>
      <section class="card context-section" aria-labelledby="stakeholders-title"><h2 id="stakeholders-title">Suggested Stakeholders</h2><p class="muted">Choose who may be affected in the activity you are planning. Add others as needed.</p><div class="context-stakeholder-list">${stakeholderCards}</div>
        <form id="contextAddStakeholder" class="context-add-stakeholder"><label class="context-field">Custom stakeholder<input id="customStakeholderName" type="text" required></label><label class="context-field">Possible need / concern<input id="customStakeholderNeed" type="text"></label><button class="btn" type="submit">Add stakeholder</button></form></section>
      <section class="card context-section" aria-labelledby="factors-title"><h2 id="factors-title">Contextual Factors, Engineering Implications &amp; Relevant Standards</h2><p class="muted">These are potentially relevant prompts for this course. Choose the factors that fit the specific problem.</p><div class="context-factor-list">${factorCards}</div></section>
      <section class="card context-section" aria-labelledby="analysis-title"><h2 id="analysis-title">Working Analysis</h2><p class="muted">Connect a stakeholder to a need, contextual factor, engineering implication, requirement, standard, and evidence where useful. Fields can be left blank.</p><div class="context-analysis-list">${analysisRows || '<p class="context-empty">No analysis rows yet.</p>'}</div><div class="context-action-row"><button id="contextAddAnalysis" class="btn" type="button">Add analysis row</button></div></section>
      <section class="card context-section" aria-labelledby="notes-title"><h2 id="notes-title">Instructor Notes</h2><label class="context-field" for="contextNotes">Notes for this course or activity<textarea id="contextNotes" data-role="notes">${clean(state.notes)}</textarea></label></section>`;
  }

  function updateField(event) {
    const field = event.target;
    const role = field.dataset.role;
    if (!role || !current) return;
    const state = states.get(current.code);
    const index = Number(field.dataset.index);
    const value = field.value;
    if (role === 'stakeholderStatus') state.stakeholders[index].status = value;
    else if (role === 'stakeholderNeed') state.stakeholders[index].need = value;
    else if (role === 'factorStatus') state.factors[index].status = value;
    else if (role === 'factorNote') state.factors[index].note = value;
    else if (role === 'factorExtraConsideration') state.factors[index].extraConsideration = value;
    else if (role === 'factorTeachingIdea') state.factors[index].teachingIdea = value;
    else if (role === 'factorAssessmentPrompt') state.factors[index].assessmentPrompt = value;
    else if (role === 'notes') state.notes = value;
    else if (role.startsWith('analysis')) {
      const key = role.slice(8).toLowerCase();
      state.analysis[index][key] = value;
    }
  }

  function renderPrintReport() {
    if (!current) return;
    const state = states.get(current.code);
    const changed = state.notes.trim() || state.analysis.length ||
      state.stakeholders.some((person, index) => person.custom || person.status || person.need !== current.stakeholders[index]?.need) ||
      state.factors.some(choice => choice.status || choice.note.trim() || choice.extraConsideration.trim() || choice.teachingIdea.trim() || choice.assessmentPrompt.trim());
    const stakeholders = state.stakeholders.map((person, index) => ({ person, index }))
      .filter(({ person, index }) => person.custom || (person.status && person.status !== 'Not Applicable') || person.need !== current.stakeholders[index]?.need)
      .map(({ person }) => `<article class="print-row"><h3>${clean(person.name)} — ${clean(person.status || 'Not classified')}</h3><p><strong>Need / concern:</strong> ${clean(person.need)}</p></article>`).join('');
    const factors = current.factors.map((factor, index) => ({ factor, choice: state.factors[index] }))
      .filter(({ choice }) => choice.status || choice.note.trim() || choice.extraConsideration.trim() || choice.teachingIdea.trim() || choice.assessmentPrompt.trim())
      .map(({ factor, choice }) => {
        const refs = factor.standards.map(id => standardFor(id, current.code)).filter(Boolean)
          .map(item => `${item.organization} ${item.identifier}`).join(', ');
        return `<article class="print-row"><h3>${clean(factor.dimension)} — ${clean(choice.status || 'Not classified')}</h3><p><strong>CIP consideration:</strong> ${clean(factor.consideration)}</p><p><strong>Instructor consideration:</strong> ${clean(choice.extraConsideration)}</p><p><strong>Instructor engineering implication / note:</strong> ${clean(choice.note)}</p><p><strong>Instructor teaching idea:</strong> ${clean(choice.teachingIdea)}</p><p><strong>Instructor assessment idea:</strong> ${clean(choice.assessmentPrompt)}</p><p><strong>Suggested standards:</strong> ${clean(refs || 'None')}</p></article>`;
      }).join('');
    const rows = state.analysis.map((row, index) => `<article class="print-row"><h3>Analysis ${index + 1}</h3><p><strong>Stakeholder:</strong> ${clean(row.stakeholder)} · <strong>Need / concern:</strong> ${clean(row.need)}</p><p><strong>Factor:</strong> ${clean(row.factor)} · <strong>Engineering implication:</strong> ${clean(row.implication)}</p><p><strong>Requirement / constraint:</strong> ${clean(row.requirement)}</p><p><strong>Relevant standard:</strong> ${clean(row.standard.replace('|', ' '))} · <strong>Evidence:</strong> ${clean(row.evidence)}</p></article>`).join('');
    const custom = changed ? `<section class="context-print-custom"><h2>Instructor customization</h2><h3>Selected stakeholders</h3>${stakeholders || '<p>None selected.</p>'}<h3>Contextual decisions and additions</h3>${factors || '<p>No factor decisions recorded.</p>'}<h3>Working analysis, requirements, standards, and evidence</h3>${rows || '<p>No analysis rows recorded.</p>'}<h3>Instructor notes</h3><p>${clean(state.notes) || 'No notes recorded.'}</p></section>` : '';
    printReport.innerHTML = `<h1>Stakeholders &amp; Design Context</h1><p class="context-print-subtitle">${changed ? 'Customized Course Analysis' : 'Teaching and Assessment Guide'}</p><p>${clean(byId('contextDisclaimer').textContent)}</p>${guideMarkup(current, true)}${custom}`;
  }

  try {
    const [contextData, standardsData] = await Promise.all([
      portal.loadJSON('../data/ee-design-context.json'),
      portal.loadJSON('../data/ee-standards.json')
    ]);
    dimensions = contextData.dimensions;
    courses = new Map(contextData.courses.map(course => [course.code, course]));
    standards = new Map(standardsData.standards.map(item => [`${item.organization}|${item.identifier}`, item]));
    byId('contextDisclaimer').textContent = contextData.disclaimer;
    [...courses.values()].forEach(course => {
      const option = document.createElement('option');
      option.value = course.code;
      option.textContent = `${course.code} — ${course.title}`;
      courseSelect.append(option);
    });
    const requested = portal.getParam('course');
    courseSelect.value = courses.has(requested) ? requested : contextData.courses[0].code;
    courseSelect.addEventListener('change', () => { customizing = false; renderPage(); });
    content.addEventListener('input', updateField);
    content.addEventListener('change', updateField);
    content.addEventListener('submit', event => {
      if (event.target.id !== 'contextAddStakeholder') return;
      event.preventDefault();
      const name = byId('customStakeholderName').value.trim();
      if (!name) return;
      states.get(current.code).stakeholders.push({ name, need: byId('customStakeholderNeed').value.trim(), status: '', custom: true });
      renderPage();
    });
    content.addEventListener('click', event => {
      if (event.target.id === 'contextCustomize') {
        customizing = true;
        renderPage();
      }
      if (event.target.id === 'contextBackToGuide') {
        customizing = false;
        renderPage();
      }
      if (event.target.id === 'contextAddAnalysis') {
        states.get(current.code).analysis.push({ id: nextRowId++, stakeholder: '', need: '', factor: '', implication: '', requirement: '', standard: '', evidence: '' });
        renderPage();
      }
      if (event.target.dataset.removeAnalysis !== undefined) {
        states.get(current.code).analysis.splice(Number(event.target.dataset.removeAnalysis), 1);
        renderPage();
      }
      if (event.target.dataset.removeStakeholder !== undefined) {
        states.get(current.code).stakeholders.splice(Number(event.target.dataset.removeStakeholder), 1);
        renderPage();
      }
    });
    byId('contextPrint').addEventListener('click', () => { renderPrintReport(); window.print(); });
    window.addEventListener('beforeprint', renderPrintReport);
    renderPage();
  } catch (error) {
    content.innerHTML = '<p class="alert">The design-context suggestions could not be loaded.</p>';
    console.error('Could not load design-context suggestions:', error);
  }
});
