// Required Textbooks order document for the Library, generated from the official Word template.
//
// Reads the live curriculum records (main textbook of every course that has one, required or
// elective), lets the user complete/verify the details in a dialog, and fills the unmodified
// official template (templates/EE-Required-Textbooks-Template.docx). Same approach as the
// NCAAA Course Specification generator: JSZip + DOM patching of word/document.xml, with the
// header, footer, signature areas and table structure left exactly as the template ships them.
//
// Nothing here writes to curriculum data. Required Quantity, campus, semester and term exist only
// in the dialog and the generated file.
(function (global) {
  'use strict';

  const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const W14_NS = 'http://schemas.microsoft.com/office/word/2010/wordml';
  const XML_NS = 'http://www.w3.org/XML/1998/namespace';
  const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const DURATIONS = ['12', '18', '24'];
  const COLUMNS = ['Course Code', 'Course Title', 'Textbook Title', 'Edition', 'Author', 'ISBN (Print)', 'Publisher', 'Required Quantity', 'Access Code', 'Access Code Duration'];
  const DEFAULT_COLLEGE = 'College of Engineering';

  class ValidationError extends Error { constructor(message) { super(message); this.name = 'ValidationError'; } }

  const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
  const elements = (node, name) => Array.from(node.getElementsByTagNameNS(W_NS, name));
  const directChildren = (node, name) => Array.from(node.childNodes).filter(child => child.nodeType === 1 && child.namespaceURI === W_NS && (!name || child.localName === name));
  const textOf = node => elements(node, 't').map(item => item.textContent).join('');
  const refs = () => global.referenceManagement;

  // One entry per course that has a main textbook, in curriculum order. Structured details on the
  // course record win; otherwise whatever can be read from the citation is offered for review.
  function collectMainTextbooks(courses, estimates = {}) {
    const entries = [], withoutTextbook = [];
    (courses || []).forEach(course => {
      const citation = clean((course.textbooks || []).find(item => clean(item)));
      if (!citation) { withoutTextbook.push({courseCode: course.course_code, courseTitle: course.course_title, requirement: course.required_or_elective}); return; }
      const parsed = refs().parseCitation(citation), stored = refs().entryMetadata(course, 'textbooks', 0);
      const pick = key => stored[key] || parsed[key] || '';
      entries.push({
        courseCode: clean(course.course_code), courseTitle: clean(course.course_title), requirement: clean(course.required_or_elective), citation,
        title: pick('title'), edition: pick('edition'), author: pick('author'), isbn: pick('isbn'), publisher: pick('publisher'),
        quantity: estimates[clean(course.course_code)] ? String(estimates[clean(course.course_code)]) : '', quantityEstimated: Boolean(estimates[clean(course.course_code)]), accessCode: stored.accessCode, accessDuration: stored.accessDuration
      });
    });
    return {entries, withoutTextbook};
  }

  // Blank fields are allowed (the sheet can be completed in Word); malformed ones are not.
  function validateEntry(entry) {
    const errors = [], label = entry.courseCode || 'Course';
    if (clean(entry.isbn) && !/^(\d{9}[\dXx]|\d{13})$/.test(clean(entry.isbn).replace(/[-\s]/g, ''))) errors.push(`${label}: ISBN must have 10 or 13 digits.`);
    if (clean(entry.quantity) && !/^[1-9]\d*$/.test(clean(entry.quantity))) errors.push(`${label}: Required Quantity must be a positive whole number.`);
    if (entry.accessCode && !['Yes', 'No'].includes(entry.accessCode)) errors.push(`${label}: Access Code must be Yes or No.`);
    if (entry.accessCode === 'Yes' && entry.accessDuration && !DURATIONS.includes(String(entry.accessDuration))) errors.push(`${label}: Access Code Duration must be 12, 18, or 24 months.`);
    if (entry.accessCode !== 'Yes' && clean(entry.accessDuration)) errors.push(`${label}: Access Code Duration applies only when Access Code is Yes.`);
    return errors;
  }

  // Campus, semester and term are optional; blank values leave the template fields empty for hand completion.
  function validateHeader(header) { return header; }

  // Cell values in the template's column order.
  function tableRow(entry) {
    const duration = entry.accessCode === 'Yes' ? (entry.accessDuration ? `${entry.accessDuration} Months` : '') : entry.accessCode === 'No' ? 'N/A' : '';
    return [entry.courseCode, entry.courseTitle, entry.title, entry.edition, entry.author, entry.isbn, entry.publisher, clean(entry.quantity), entry.accessCode || '', duration].map(clean);
  }

  function filenameForTerm(term, kind = 'required') {
    const safe = clean(term).replace(/[^A-Za-z0-9-]+/g, '_').replace(/^_+|_+$/g, ''), base = kind === 'alternatives' ? 'EE_Alternative_Textbooks' : 'EE_Required_Textbooks';
    return safe ? `${base}_${safe}.docx` : `${base}.docx`;
  }

  // ---- Alternatives (official Alternatives template: the first seven columns) ----------------
  // The preferred alternative textbook of each course is its Reference 1 (references[0]); the rest of the
  // list holds supporting references. The Alternatives form therefore always mirrors the curriculum record.
  const ALT_COLUMNS = COLUMNS.slice(0, 7);
  const altTableRow = entry => [entry.courseCode, entry.courseTitle, entry.title, entry.edition, entry.author, entry.isbn, entry.publisher].map(clean);
  const KINDS = {
    required: {columns: COLUMNS, row: tableRow, label: 'Required Textbooks'},
    alternatives: {columns: ALT_COLUMNS, row: altTableRow, label: 'Alternative Textbooks'}
  };

  // One entry per course whose Reference 1 exists, in curriculum order. Courses that have a main textbook
  // but no Reference 1 are returned separately so the dialog can count them.
  function collectAlternatives(courses) {
    const entries = [], withoutAlternative = [];
    (courses || []).forEach(course => {
      const code = clean(course.course_code), reference = clean((course.references || [])[0]);
      if (!reference) {
        if ((course.textbooks || []).some(item => clean(item))) withoutAlternative.push({courseCode: code, courseTitle: clean(course.course_title)});
        return;
      }
      const parsed = refs().parseCitation(reference), stored = refs().entryMetadata(course, 'references', 0);
      const pick = key => stored[key] || parsed[key] || '';
      entries.push({courseCode: code, courseTitle: clean(course.course_title), requirement: clean(course.required_or_elective), citation: reference,
        title: pick('title'), edition: pick('edition'), author: pick('author'), isbn: pick('isbn'), publisher: pick('publisher')});
    });
    return {entries, withoutAlternative};
  }

  function validateAlternative(entry) {
    const label = entry.courseCode || 'Course';
    return clean(entry.isbn) && !/^(\d{9}[\dXx]|\d{13})$/.test(clean(entry.isbn).replace(/[-\s]/g, '')) ? [`${label}: ISBN must have 10 or 13 digits.`] : [];
  }

  // ---- Word template patching -----------------------------------------------------------
  function setCellText(documentNode, cell, text) {
    let paragraph = directChildren(cell, 'p')[0];
    if (!paragraph) { paragraph = documentNode.createElementNS(W_NS, 'w:p'); cell.appendChild(paragraph); }
    directChildren(paragraph, 'r').forEach(run => paragraph.removeChild(run));
    if (!text) return;
    const run = documentNode.createElementNS(W_NS, 'w:r');
    // The template stores the cell's character formatting on the paragraph mark; reuse it.
    const markProperties = directChildren(directChildren(paragraph, 'pPr')[0] || documentNode.createElementNS(W_NS, 'w:pPr'), 'rPr')[0];
    if (markProperties) run.appendChild(markProperties.cloneNode(true));
    const node = documentNode.createElementNS(W_NS, 'w:t');
    node.setAttributeNS(XML_NS, 'xml:space', 'preserve');
    node.textContent = String(text);
    run.appendChild(node);
    paragraph.appendChild(run);
  }

  function stripIds(node) {
    [node, ...node.getElementsByTagName('*')].forEach(item => { ['paraId', 'textId'].forEach(name => item.removeAttributeNS(W14_NS, name)); });
  }

  function patchDocumentXml(xmlText, header, entries, kind = 'required') {
    const spec = KINDS[kind] || KINDS.required;
    if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') throw new ValidationError('This browser does not provide the required XML APIs');
    const root = new DOMParser().parseFromString(xmlText, 'application/xml');
    if (elements(root, 'parsererror').length || root.getElementsByTagName('parsererror').length) throw new ValidationError('The Word template XML could not be parsed');
    if (!entries.length) throw new ValidationError('No course has a textbook to include.');

    const rowsOf = table => directChildren(table, 'tr');
    const cellsOf = row => directChildren(row, 'tc');
    const table = elements(root, 'tbl').find(candidate => rowsOf(candidate).some(row => cellsOf(row).some(cell => clean(textOf(cell)) === 'Course Code')));
    if (!table) throw new ValidationError('The textbook table was not found in the Word template');
    const rows = rowsOf(table);

    // Header block: the value cell sits beside its label cell, matched by label text.
    const fields = [['Campus', header.campus], ['College', header.college], ['Department', header.department], ['Semester', header.semester], ['Term', header.term]];
    fields.forEach(([label, value]) => {
      const row = rows.find(candidate => { const cells = cellsOf(candidate); return cells.length === 2 && clean(textOf(cells[0])).replace(/\s*\[.*$/, '') === label; });
      if (!row) throw new ValidationError(`The template field "${label}" was not found`);
      setCellText(root, cellsOf(row)[1], clean(value));
    });

    // Data block: every row below the column-header row. The first and last template rows serve
    // as prototypes (top/bottom borders differ); all are replaced by one row per textbook.
    const headerIndex = rows.findIndex(row => cellsOf(row).some(cell => clean(textOf(cell)) === 'Course Code'));
    const columnCount = cellsOf(rows[headerIndex]).length;
    if (columnCount !== spec.columns.length) throw new ValidationError(`The template has ${columnCount} columns; expected ${spec.columns.length}`);
    const body = rows.slice(headerIndex + 1).filter(row => cellsOf(row).length === columnCount);
    if (!body.length) throw new ValidationError('The template has no data rows to copy');
    const firstPrototype = body[0], lastPrototype = body[body.length - 1];
    const anchor = rows[headerIndex];
    let previous = anchor;
    entries.forEach((entry, index) => {
      const row = (index === entries.length - 1 && entries.length > 1 ? lastPrototype : firstPrototype).cloneNode(true);
      stripIds(row);
      let trPr = directChildren(row, 'trPr')[0];
      if (!trPr) { trPr = root.createElementNS(W_NS, 'w:trPr'); row.insertBefore(trPr, row.firstChild); }
      if (!directChildren(trPr, 'cantSplit').length) trPr.insertBefore(root.createElementNS(W_NS, 'w:cantSplit'), trPr.firstChild);
      spec.row(entry).forEach((value, cellIndex) => setCellText(root, cellsOf(row)[cellIndex], value));
      previous.parentNode.insertBefore(row, previous.nextSibling);
      previous = row;
    });
    body.forEach(row => row.parentNode.removeChild(row));
    return new XMLSerializer().serializeToString(root);
  }

  async function generateDocxBlob(header, entries, templateUrl, kind = 'required') {
    validateHeader(header);
    const problems = entries.flatMap(kind === 'alternatives' ? validateAlternative : validateEntry);
    if (problems.length) throw new ValidationError(problems.join(' '));
    if (!global.JSZip) throw new ValidationError('The local DOCX ZIP library is unavailable');
    const response = await fetch(templateUrl, {credentials: 'same-origin'});
    if (!response.ok) throw new ValidationError(`Could not load the ${(KINDS[kind] || KINDS.required).label} Word template (${response.status})`);
    const zip = await global.JSZip.loadAsync(await response.arrayBuffer());
    const part = zip.file('word/document.xml');
    if (!part) throw new ValidationError('The Word template is missing word/document.xml');
    zip.file('word/document.xml', patchDocumentXml(await part.async('string'), header, entries, kind));
    const blob = await zip.generateAsync({type: 'blob', mimeType: DOCX_MIME, compression: 'DEFLATE'});
    return {blob, filename: filenameForTerm(header.term, kind)};
  }

  // ---- Completion dialog (Program Overview) ------------------------------------------------
  const esc = value => global.portal.esc(value);
  const FIELD_INPUTS = [['title', 'Textbook Title'], ['edition', 'Edition'], ['author', 'Author'], ['isbn', 'ISBN (Print)'], ['publisher', 'Publisher']];

  function build(model, templateUrl, kind = 'required') {
    const alt = kind === 'alternatives', {entries} = model, spec = KINDS[kind];
    const dialog = document.createElement('dialog');
    dialog.className = 'pref-dialog tbo-dialog';
    dialog.setAttribute('aria-labelledby', `textbookOrderTitle-${kind}`);
    const fixed = global.ncaaaCsGenerator?.FIXED_VALUES || {};
    const extraHeads = alt ? [] : ['Required Quantity', 'Access Code', 'Access Code Duration'];
    const rowMarkup = (entry, index) => `<tr data-row="${index}">
      <th scope="row" class="pref-course"><span class="pref-code">${esc(entry.courseCode)}</span><span class="pref-title">${esc(entry.courseTitle)}</span><span class="tbo-record" title="${alt ? 'Reference 1 on record' : 'Citation on record'}">${alt ? 'Reference 1 on record: ' : ''}${esc(entry.citation)}</span></th>
      ${FIELD_INPUTS.map(([key, label]) => `<td data-label="${label}"><input class="tbo-input" data-field="${key}" aria-label="${label} for ${esc(entry.courseCode)}" value="${esc(entry[key])}"></td>`).join('')}
      ${alt ? '' : `<td data-label="Required Quantity"><input class="tbo-input tbo-narrow" data-field="quantity" type="number" min="1" step="1" inputmode="numeric" value="${esc(entry.quantity)}"${entry.quantityEstimated ? ' title="Estimate from the Term 241 Library order form"' : ''} aria-label="Required Quantity for ${esc(entry.courseCode)}"></td>
      <td data-label="Access Code"><select class="tbo-input tbo-narrow" data-field="accessCode" aria-label="Access Code for ${esc(entry.courseCode)}"><option value="">-</option><option${entry.accessCode === 'Yes' ? ' selected' : ''}>Yes</option><option${entry.accessCode === 'No' ? ' selected' : ''}>No</option></select></td>
      <td data-label="Access Code Duration"><select class="tbo-input tbo-narrow" data-field="accessDuration" aria-label="Access Code Duration for ${esc(entry.courseCode)}"${entry.accessCode === 'Yes' ? '' : ' disabled'}><option value="">-</option>${DURATIONS.map(months => `<option value="${months}"${entry.accessDuration === months ? ' selected' : ''}>${months} Months</option>`).join('')}</select></td>`}</tr>`;
    const missing = alt ? model.withoutAlternative : model.withoutTextbook;
    dialog.innerHTML = `
      <header class="pref-head"><div><span class="kicker">Undergraduate EE</span><h2 id="textbookOrderTitle-${kind}">${alt ? 'Alternative Textbooks - Library Order Form' : 'Required Textbooks - Library Order Form'}</h2>
        <p>${alt ? 'One row per course that has a Reference 1 (the preferred alternative textbook). Details are read from the curriculum records and the recorded citation; review or edit any cell, then generate the official Word form. Courses without a Reference 1 are left out. Nothing entered here is saved to the curriculum.' : 'One row per course with a main textbook (required and elective). Details are read from the curriculum records and the recorded citation; review them, confirm quantities (pre-filled from the Term 241 order form where one existed; these are estimates) and access codes, then generate the official Word form. Nothing entered here is saved to the curriculum.'}</p></div>
        <button class="pref-close" type="button" data-tbo-close aria-label="Close ${spec.label} form">&times;</button></header>
      <div class="tbo-header-fields">
        <label>Campus<select data-header="campus"><option value="">Select</option><option>Men</option><option>Women</option></select></label>
        <label>College<input data-header="college" value="${esc(DEFAULT_COLLEGE)}"></label>
        <label>Department<input data-header="department" value="${esc(fixed.Department || '')}"></label>
        <label>Semester<input data-header="semester"></label>
        <label>Term<input data-header="term" inputmode="numeric" placeholder="e.g. 261"></label>
      </div>
      <div class="pref-body"><table class="pref-table tbo-table"><thead><tr><th scope="col" class="pref-course">Course</th>${[...FIELD_INPUTS.map(item => item[1]), ...extraHeads].map(label => `<th scope="col">${label}</th>`).join('')}</tr></thead>
        <tbody>${entries.map(rowMarkup).join('')}</tbody></table>
        ${missing.length ? `<p class="tbo-note">${alt ? 'No Reference 1 (alternative textbook) is recorded for' : 'No main textbook is recorded for'} ${missing.length} course${missing.length === 1 ? '' : 's'}, so ${missing.length === 1 ? 'it is' : 'they are'} not listed: ${missing.map(item => esc(item.courseCode)).join(', ')}.</p>` : ''}</div>
      <footer class="tbo-footer"><span class="tbo-status" aria-live="polite"></span><button class="btn primary" type="button" data-tbo-generate>Generate Word Document</button></footer>`;
    document.body.appendChild(dialog);

    const status = dialog.querySelector('.tbo-status'), rows = [...dialog.querySelectorAll('tbody tr')];
    const read = row => Object.fromEntries([...row.querySelectorAll('[data-field]')].map(input => [input.dataset.field, input.value.trim()]));
    const header = () => Object.fromEntries([...dialog.querySelectorAll('[data-header]')].map(input => [input.dataset.header, input.value.trim()]));
    if (!alt) rows.forEach(row => row.querySelector('[data-field="accessCode"]').addEventListener('change', event => {
      const duration = row.querySelector('[data-field="accessDuration"]');
      duration.disabled = event.target.value !== 'Yes'; if (duration.disabled) duration.value = '';
    }));
    const close = () => dialog.close();
    dialog.querySelector('[data-tbo-close]').addEventListener('click', close);
    dialog.addEventListener('click', event => { if (event.target === dialog) close(); });
    const blankKeys = alt ? ['title', 'author', 'edition', 'isbn', 'publisher'] : ['title', 'author', 'edition', 'isbn', 'publisher', 'quantity', 'accessCode'];
    dialog.querySelector('[data-tbo-generate]').addEventListener('click', async () => {
      try {
        const completed = rows.map((row, index) => ({...entries[index], ...read(row)}));
        const result = await generateDocxBlob(header(), completed, templateUrl, kind);
        global.ncaaaCsGenerator.downloadBlob(result.blob, result.filename);
        const blanks = completed.reduce((total, entry) => total + blankKeys.filter(key => !clean(entry[key])).length, 0);
        status.textContent = `${result.filename} generated with ${completed.length} textbooks.${blanks ? ` ${blanks} cells were left blank.` : ''}`;
      } catch (error) { status.textContent = error.message || 'The document could not be generated.'; }
    });
    return {dialog, open(trigger) { dialog.showModal(); dialog.querySelector('[data-header="campus"]').focus(); }};
  }

  async function mount({courses, trigger, errorTarget, templateUrl, estimatesUrl, kind = 'required'}) {
    const spec = KINDS[kind];
    try {
      if (!global.JSZip || !global.ncaaaCsGenerator) throw new Error('The Word generation libraries are unavailable.');
      let model;
      if (kind === 'alternatives') {
        model = collectAlternatives(courses);
        if (!model.entries.length) throw new Error('No course has a Reference 1 (alternative textbook).');
      } else {
        let estimates = {};
        if (estimatesUrl) { try { estimates = (await global.portal.loadJSON(estimatesUrl)).quantities || {}; } catch (error) { estimates = {}; } }
        model = collectMainTextbooks(courses, estimates);
        if (!model.entries.length) throw new Error('No main textbooks were found in the curriculum data.');
      }
      const view = build(model, templateUrl, kind);
      trigger.addEventListener('click', () => view.open(trigger));
      return view;
    } catch (error) {
      if (trigger) trigger.hidden = true;
      if (errorTarget) errorTarget.innerHTML = `<div class="alert">The ${spec.label} form could not be built. ${esc(error.message)}</div>`;
      return null;
    }
  }

  const api = {COLUMNS, DURATIONS, ValidationError, collectMainTextbooks, validateEntry, validateHeader, tableRow, filenameForTerm, patchDocumentXml, generateDocxBlob, collectAlternatives, validateAlternative, altTableRow, ALT_COLUMNS, mount};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.textbookOrderGenerator = api;
}(typeof window !== 'undefined' ? window : globalThis));
