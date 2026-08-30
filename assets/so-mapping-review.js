(function () {
  'use strict';
  const overlay = () => document.getElementById('soMappingReviewOverlay');
  const content = () => document.getElementById('soMappingReviewContent');
  const title = () => document.getElementById('soMappingReviewTitle');
  const dateISO = () => { const now = new Date(); return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-'); };
  const clone = value => typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
  const sameCodes = (left, right) => left.length === right.length && left.every((code, index) => code === right[index]);
  const sanitize = value => String(value || '').trim().replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '');
  let state = null;

  function relevantCourses(context, soCode) { return (context.courses || []).filter(course => (course.clos || []).some(clo => (clo.mapped_sos || []).includes(soCode))); }
  function performanceLevel(course, piCodes) { const levels = [...new Set(piCodes.map(pi => (course.pi_levels || {})[pi]).filter(Boolean))]; return levels.length ? levels.join(' / ') : 'Not assigned'; }
  function rowsForCourse(course) {
    return (course.clos || []).filter(clo => (clo.mapped_sos || []).includes(state.soCode)).map(clo => {
      const original = state.piCodes.filter(pi => (clo.pi_codes || []).includes(pi));
      return { clo: clone(clo), original, proposed: [...original] };
    });
  }
  function isModified(row) { return !sameCodes(row.original, row.proposed); }
  function modifiedCount(group) { return group.rows.filter(isModified).length; }
  function totalRows() { return state.groups.reduce((total, group) => total + group.rows.length, 0); }
  function totalModified() { return state.groups.reduce((total, group) => total + modifiedCount(group), 0); }
  function mappingText(codes) { return codes.length ? codes.join(', ') : `No PI selected under ${state.soCode}`; }

  function closeReview() {
    overlay().classList.remove('visible'); overlay().setAttribute('aria-hidden', 'true');
    document.body.classList.remove('review-open'); content().innerHTML = ''; state = null;
  }
  function renderDefinitions() {
    return `<section class="so-mapping-definitions"><div class="code">${portal.esc(state.soCode)}</div><p>${portal.esc(state.outcome.statement || '')}</p><ul>${state.piCodes.map(pi => `<li><strong>${portal.esc(pi)}</strong><span>${portal.esc(state.piDefinitions[pi]?.statement || '')}</span></li>`).join('')}</ul></section>`;
  }
  function renderTable(group, groupIndex) {
    const level = performanceLevel(group.course, state.piCodes);
    return `<div class="table-wrap so-mapping-table-wrap"><table class="so-mapping-table"><thead><tr><th>CLO</th><th>CLO Statement</th><th>Performance Level</th>${state.piCodes.map(pi => `<th>${portal.esc(pi)}</th>`).join('')}<th>Status</th></tr></thead><tbody>${group.rows.map((row, rowIndex) => {
      const modified = isModified(row);
      return `<tr class="${modified ? 'mapping-modified' : ''}" data-mapping-row="${groupIndex}-${rowIndex}"><td class="code">${portal.esc(row.clo.clo_number)}</td><td>${portal.esc(row.clo.clo_text)}</td><td><span class="pill">${portal.esc(level)}</span></td>${state.piCodes.map(pi => `<td class="mapping-check-cell"><label><input type="checkbox" data-mapping-group-index="${groupIndex}" data-mapping-row-index="${rowIndex}" data-mapping-pi="${portal.esc(pi)}"${row.proposed.includes(pi) ? ' checked' : ''}><span class="sr-only">Map CLO ${portal.esc(row.clo.clo_number)} to ${portal.esc(pi)}</span></label></td>`).join('')}<td><span class="mapping-status ${modified ? 'is-modified' : ''}">${modified ? 'Modified' : 'No Change'}</span></td></tr>`;
    }).join('')}</tbody></table></div>`;
  }
  function renderCourse(group, groupIndex) {
    return `<section class="so-mapping-course" data-mapping-course="${groupIndex}"><header class="so-mapping-course-head"><div class="code">${portal.esc(group.course.course_code)}</div><h3>${portal.esc(group.course.course_title)}</h3><p>${group.rows.length} relevant CLO${group.rows.length === 1 ? '' : 's'} · <strong data-course-modified="${groupIndex}">${modifiedCount(group)}</strong> modified</p></header>${renderTable(group, groupIndex)}</section>`;
  }
  function render() {
    title().textContent = `${state.soCode} Mapping Review`;
    content().innerHTML = `${renderDefinitions()}<div class="review-meta so-mapping-meta"><label class="review-field">Reviewer Name<input id="soMappingReviewer" value="${portal.esc(state.reviewer)}" autocomplete="name" placeholder="Enter reviewer name"><span class="review-error" data-mapping-error="reviewer"></span></label><label class="review-field">Review Date<input value="${state.reviewDate}" readonly></label></div><div class="so-mapping-overall"><span><strong>${state.groups.length}</strong> courses</span><span><strong>${totalRows()}</strong> CLOs</span><span><strong data-overall-modified>${totalModified()}</strong> modified</span></div><div class="review-section-heading"><h3>Current and Proposed PI Mapping</h3><button class="review-secondary" id="resetSOMapping" type="button">Reset All to Current Mapping</button></div><p class="mapping-help">Only PIs belonging to ${portal.esc(state.soCode)} are editable. Selecting no PI is a valid proposal.</p><div class="so-mapping-course-list">${state.groups.length ? state.groups.map(renderCourse).join('') : '<div class="alert">No courses are currently mapped to this student outcome.</div>'}</div><div class="review-footer"><button class="review-primary" id="generateSOMappingPdf" type="button">Generate ${portal.esc(state.soCode)} Mapping Review PDF</button></div>`;
  }
  function openReview(event) {
    const context = window.soMappingReviewContext, soCode = event.detail?.so;
    if (!context || !['SO1', 'SO3'].includes(soCode)) return;
    const outcome = context.abet?.student_outcomes?.[soCode]; if (!outcome) return;
    state = { soCode, outcome: clone(outcome), piCodes: [...(outcome.pis || [])], piDefinitions: clone(context.abet?.performance_indicators || {}), groups: [], reviewer: '', reviewDate: dateISO() };
    state.groups = clone(relevantCourses(context, soCode)).map(course => ({ course, rows: rowsForCourse(course) }));
    render(); overlay().classList.add('visible'); overlay().setAttribute('aria-hidden', 'false'); document.body.classList.add('review-open');
    setTimeout(() => document.getElementById('soMappingReviewer')?.focus(), 0);
  }
  function updateCounts(groupIndex) {
    const courseCount = content().querySelector(`[data-course-modified="${groupIndex}"]`), overallCount = content().querySelector('[data-overall-modified]');
    if (courseCount) courseCount.textContent = modifiedCount(state.groups[groupIndex]);
    if (overallCount) overallCount.textContent = totalModified();
  }
  function updateRowStatus(groupIndex, rowIndex) {
    const row = state.groups[groupIndex].rows[rowIndex], tr = content().querySelector(`[data-mapping-row="${groupIndex}-${rowIndex}"]`), modified = isModified(row);
    tr?.classList.toggle('mapping-modified', modified); const status = tr?.querySelector('.mapping-status');
    if (status) { status.textContent = modified ? 'Modified' : 'No Change'; status.classList.toggle('is-modified', modified); }
    updateCounts(groupIndex);
  }
  function setReviewerError(message) {
    const error = content().querySelector('[data-mapping-error="reviewer"]'), input = document.getElementById('soMappingReviewer');
    if (error) error.textContent = message; input?.classList.toggle('review-invalid', Boolean(message));
  }

  function generatePDF() {
    state.reviewer = document.getElementById('soMappingReviewer').value.trim();
    if (!state.reviewer) { setReviewerError('Reviewer name is required.'); document.getElementById('soMappingReviewer').focus(); return; }
    setReviewerError('');
    if (!window.jspdf?.jsPDF || typeof window.jspdf.jsPDF.API.autoTable !== 'function') { setReviewerError('PDF generation dependencies are unavailable. Refresh while connected and try again.'); return; }
    const { jsPDF } = window.jspdf, doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const width = doc.internal.pageSize.getWidth(), height = doc.internal.pageSize.getHeight(), margin = 15, blue = [20, 61, 102], orange = [242, 162, 58];
    const footer = () => { const page = doc.internal.getCurrentPageInfo().pageNumber; doc.setFillColor(...blue); doc.rect(0, height - 10, width, 10, 'F'); doc.setTextColor(255); doc.setFontSize(8); doc.text('PSU Curriculum Intelligence Portal', margin, height - 4); doc.text(`Page ${page}`, width - margin - 12, height - 4); };
    const ensureSpace = (y, needed = 34) => { if (y > height - needed) { doc.addPage(); return 20; } return y; };
    const groupTables = (heading, startY, changed) => {
      let y = ensureSpace(startY, 42), rendered = false;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...blue); doc.text(heading, margin, y); y += 5;
      state.groups.forEach(group => {
        const rows = group.rows.filter(row => changed ? isModified(row) : !isModified(row)); if (!rows.length) return;
        rendered = true; y = ensureSpace(y, 42); doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(35); doc.text(`${group.course.course_code} — ${group.course.course_title}`, margin, y);
        const level = performanceLevel(group.course, state.piCodes);
        doc.autoTable({ startY: y + 3, head: changed ? [['CLO', 'CLO Statement', 'Level', 'Current', 'Proposed']] : [['CLO', 'CLO Statement', 'Level', 'Retained Mapping']], body: rows.map(row => changed ? [String(row.clo.clo_number), row.clo.clo_text, level, mappingText(row.original), mappingText(row.proposed)] : [String(row.clo.clo_number), row.clo.clo_text, level, mappingText(row.original)]), margin: { left: margin, right: margin, bottom: 15 }, styles: { fontSize: 7.8, cellPadding: 3, lineColor: [205, 210, 218], lineWidth: .25, overflow: 'linebreak' }, headStyles: { fillColor: blue, textColor: 255 }, columnStyles: changed ? { 0: { cellWidth: 14, fontStyle: 'bold' }, 2: { cellWidth: 17 }, 3: { cellWidth: 32 }, 4: { cellWidth: 39 } } : { 0: { cellWidth: 14, fontStyle: 'bold' }, 2: { cellWidth: 18 }, 3: { cellWidth: 45 } }, alternateRowStyles: { fillColor: [244, 247, 250] } });
        y = doc.lastAutoTable.finalY + 8;
      });
      if (!rendered) { doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(75); doc.text(changed ? 'No PI mapping changes proposed.' : 'No unchanged mappings.', margin, y + 2); y += 10; }
      return y;
    };
    doc.setFillColor(...blue); doc.rect(0, 0, width, 24, 'F'); doc.setFillColor(...orange); doc.rect(0, 24, width, 2, 'F');
    doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.text(`${state.soCode} Mapping Review Report`, margin, 15);
    doc.setTextColor(25); doc.setFontSize(13); const statementLines = doc.splitTextToSize(`${state.soCode}: ${state.outcome.statement || ''}`, width - margin * 2); doc.text(statementLines, margin, 36);
    let y = 36 + statementLines.length * 4.7 + 2; doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(75);
    doc.text([`Reviewer: ${state.reviewer}`, `Review Date: ${state.reviewDate}`, `Courses Reviewed: ${state.groups.length}`, `CLOs Reviewed: ${totalRows()}`, `Modified Mappings: ${totalModified()}`], margin, y); y += 24;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...blue); doc.text('Performance Indicator Definitions', margin, y);
    doc.autoTable({ startY: y + 4, head: [['PI', 'Current Definition']], body: state.piCodes.map(pi => [pi, state.piDefinitions[pi]?.statement || '']), margin: { left: margin, right: margin, bottom: 15 }, styles: { fontSize: 8.5, cellPadding: 3, lineColor: [205, 210, 218], lineWidth: .25, overflow: 'linebreak' }, headStyles: { fillColor: blue, textColor: 255 }, columnStyles: { 0: { cellWidth: 20, fontStyle: 'bold' } }, alternateRowStyles: { fillColor: [244, 247, 250] } });
    y = groupTables('Proposed Changes', doc.lastAutoTable.finalY + 9, true); y = groupTables('Reviewed — No Change', y, false); y = ensureSpace(y, 25);
    doc.setFont('helvetica', 'italic'); doc.setFontSize(8.5); doc.setTextColor(75); doc.text(doc.splitTextToSize('This report contains proposed PI mapping revisions only. It does not modify the approved curriculum database.', width - margin * 2), margin, y);
    const pages = doc.internal.getNumberOfPages(); for (let page = 1; page <= pages; page++) { doc.setPage(page); footer(); }
    doc.save([state.soCode, 'Mapping_Review', sanitize(state.reviewer), state.reviewDate].filter(Boolean).join('_') + '.pdf');
  }

  window.addEventListener('open-so-mapping-review', openReview);
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('soMappingReviewClose')?.addEventListener('click', closeReview);
    overlay()?.addEventListener('click', event => { if (event.target === overlay()) closeReview(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && overlay()?.classList.contains('visible')) closeReview(); });
    content()?.addEventListener('input', event => { if (event.target.id === 'soMappingReviewer') { state.reviewer = event.target.value; if (event.target.value.trim()) setReviewerError(''); } });
    content()?.addEventListener('change', event => {
      const groupIndex = event.target.dataset.mappingGroupIndex, rowIndex = event.target.dataset.mappingRowIndex, pi = event.target.dataset.mappingPi;
      if (groupIndex !== undefined && rowIndex !== undefined && pi) { const row = state.groups[+groupIndex].rows[+rowIndex]; row.proposed = state.piCodes.filter(code => code === pi ? event.target.checked : row.proposed.includes(code)); updateRowStatus(+groupIndex, +rowIndex); }
    });
    content()?.addEventListener('click', event => {
      if (event.target.id === 'resetSOMapping') { state.reviewer = document.getElementById('soMappingReviewer').value; state.groups.forEach(group => group.rows.forEach(row => { row.proposed = [...row.original]; })); render(); }
      if (event.target.id === 'generateSOMappingPdf') generatePDF();
    });
  });
})();
