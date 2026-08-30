(function () {
  'use strict';

  const overlay = () => document.getElementById('soMappingReviewOverlay');
  const content = () => document.getElementById('soMappingReviewContent');
  const title = () => document.getElementById('soMappingReviewTitle');
  const dateISO = () => {
    const now = new Date();
    return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
  };
  const clone = value => typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
  const sameCodes = (left, right) => left.length === right.length && left.every((code, index) => code === right[index]);
  const sanitize = value => String(value || '').trim().replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '');
  let state = null;

  function relevantCourses(context, soCode) {
    return (context.courses || []).filter(course => (course.clos || []).some(clo => (clo.mapped_sos || []).includes(soCode)));
  }

  function performanceLevel(course, piCodes) {
    const levels = [...new Set(piCodes.map(pi => (course.pi_levels || {})[pi]).filter(Boolean))];
    return levels.length ? levels.join(' / ') : 'Not assigned';
  }

  function rowsForCourse(course) {
    return (course.clos || []).filter(clo => (clo.mapped_sos || []).includes(state.soCode)).map(clo => {
      const original = state.piCodes.filter(pi => (clo.pi_codes || []).includes(pi));
      return { clo: clone(clo), original, proposed: [...original] };
    });
  }

  function selectCourse(courseCode) {
    state.course = state.courses.find(course => course.course_code === courseCode) || state.courses[0];
    state.rows = state.course ? rowsForCourse(state.course) : [];
  }

  function isModified(row) {
    return !sameCodes(row.original, row.proposed);
  }

  function mappingText(codes) {
    return codes.length ? codes.join(', ') : `No PI selected under ${state.soCode}`;
  }

  function closeReview() {
    overlay().classList.remove('visible');
    overlay().setAttribute('aria-hidden', 'true');
    document.body.classList.remove('review-open');
    content().innerHTML = '';
    state = null;
  }

  function renderDefinitions() {
    return `<section class="so-mapping-definitions"><div class="code">${portal.esc(state.soCode)}</div><p>${portal.esc(state.outcome.statement || '')}</p><ul>${state.piCodes.map(pi => `<li><strong>${portal.esc(pi)}</strong><span>${portal.esc(state.piDefinitions[pi]?.statement || '')}</span></li>`).join('')}</ul></section>`;
  }

  function renderTable() {
    if (!state.course) return '<div class="alert">No courses are currently mapped to this student outcome.</div>';
    const level = performanceLevel(state.course, state.piCodes);
    return `<div class="table-wrap"><table class="so-mapping-table"><thead><tr><th>CLO</th><th>CLO Statement</th><th>Performance Level</th>${state.piCodes.map(pi => `<th>${portal.esc(pi)}</th>`).join('')}<th>Status</th></tr></thead><tbody>${state.rows.map((row, rowIndex) => {
      const modified = isModified(row);
      return `<tr class="${modified ? 'mapping-modified' : ''}" data-mapping-row="${rowIndex}"><td class="code">${portal.esc(row.clo.clo_number)}</td><td>${portal.esc(row.clo.clo_text)}</td><td><span class="pill">${portal.esc(level)}</span></td>${state.piCodes.map(pi => `<td class="mapping-check-cell"><label><input type="checkbox" data-mapping-row-index="${rowIndex}" data-mapping-pi="${portal.esc(pi)}"${row.proposed.includes(pi) ? ' checked' : ''}><span class="sr-only">Map CLO ${portal.esc(row.clo.clo_number)} to ${portal.esc(pi)}</span></label></td>`).join('')}<td><span class="mapping-status ${modified ? 'is-modified' : ''}">${modified ? 'Modified' : 'No Change'}</span></td></tr>`;
    }).join('')}</tbody></table></div>`;
  }

  function render() {
    const selectedCode = state.course?.course_code || '';
    const reviewer = state.reviewer;
    title().textContent = `${state.soCode} Mapping Review`;
    content().innerHTML = `${renderDefinitions()}<div class="review-meta"><label class="review-field">Course<select id="soMappingCourse">${state.courses.map(course => `<option value="${portal.esc(course.course_code)}"${course.course_code === selectedCode ? ' selected' : ''}>${portal.esc(course.course_code)} — ${portal.esc(course.course_title)}</option>`).join('')}</select></label><label class="review-field">Reviewer Name<input id="soMappingReviewer" value="${portal.esc(reviewer)}" autocomplete="name" placeholder="Enter reviewer name"><span class="review-error" data-mapping-error="reviewer"></span></label><label class="review-field">Review Date<input value="${state.reviewDate}" readonly></label><label class="review-field">Course Performance Level<input value="${portal.esc(state.course ? performanceLevel(state.course, state.piCodes) : 'N/A')}" readonly></label></div><div class="review-section-heading"><h3>Current and Proposed PI Mapping</h3><button class="review-secondary" id="resetSOMapping" type="button">Reset to Current Mapping</button></div><p class="mapping-help">Only PIs belonging to ${portal.esc(state.soCode)} are editable. Selecting no PI is a valid proposal.</p>${renderTable()}<div class="review-footer"><button class="review-primary" id="generateSOMappingPdf" type="button">Generate ${portal.esc(state.soCode)} Mapping Review PDF</button></div>`;
  }

  function openReview(event) {
    const context = window.soMappingReviewContext;
    const soCode = event.detail?.so;
    if (!context || !['SO1', 'SO3'].includes(soCode)) return;
    const outcome = context.abet?.student_outcomes?.[soCode];
    if (!outcome) return;
    const courses = relevantCourses(context, soCode);
    state = {
      soCode,
      outcome: clone(outcome),
      piCodes: [...(outcome.pis || [])],
      piDefinitions: clone(context.abet?.performance_indicators || {}),
      courses: clone(courses),
      reviewer: '',
      reviewDate: dateISO(),
      course: null,
      rows: []
    };
    selectCourse(courses[0]?.course_code);
    render();
    overlay().classList.add('visible');
    overlay().setAttribute('aria-hidden', 'false');
    document.body.classList.add('review-open');
    setTimeout(() => document.getElementById('soMappingReviewer')?.focus(), 0);
  }

  function updateRowStatus(rowIndex) {
    const row = state.rows[rowIndex];
    const tr = content().querySelector(`[data-mapping-row="${rowIndex}"]`);
    const modified = isModified(row);
    tr?.classList.toggle('mapping-modified', modified);
    const status = tr?.querySelector('.mapping-status');
    if (status) {
      status.textContent = modified ? 'Modified' : 'No Change';
      status.classList.toggle('is-modified', modified);
    }
  }

  function setReviewerError(message) {
    const error = content().querySelector('[data-mapping-error="reviewer"]');
    const input = document.getElementById('soMappingReviewer');
    if (error) error.textContent = message;
    input?.classList.toggle('review-invalid', Boolean(message));
  }

  function generatePDF() {
    state.reviewer = document.getElementById('soMappingReviewer').value.trim();
    if (!state.reviewer) {
      setReviewerError('Reviewer name is required.');
      document.getElementById('soMappingReviewer').focus();
      return;
    }
    setReviewerError('');
    if (!window.jspdf?.jsPDF || typeof window.jspdf.jsPDF.API.autoTable !== 'function') {
      setReviewerError('PDF generation dependencies are unavailable. Refresh while connected and try again.');
      return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const width = doc.internal.pageSize.getWidth(), height = doc.internal.pageSize.getHeight(), margin = 15;
    const blue = [20, 61, 102], orange = [242, 162, 58];
    const level = performanceLevel(state.course, state.piCodes);
    const footer = () => {
      const page = doc.internal.getCurrentPageInfo().pageNumber;
      doc.setFillColor(...blue); doc.rect(0, height - 10, width, 10, 'F');
      doc.setTextColor(255); doc.setFontSize(8);
      doc.text('PSU Curriculum Intelligence Portal', margin, height - 4);
      doc.text(`Page ${page}`, width - margin - 12, height - 4);
    };
    doc.setFillColor(...blue); doc.rect(0, 0, width, 24, 'F');
    doc.setFillColor(...orange); doc.rect(0, 24, width, 2, 'F');
    doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(17);
    doc.text(`${state.soCode} Mapping Review Report`, margin, 15);
    doc.setTextColor(25); doc.setFontSize(14);
    doc.text(`${state.course.course_code} — ${state.course.course_title}`, margin, 36);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(75);
    const statementLines = doc.splitTextToSize(`${state.soCode}: ${state.outcome.statement || ''}`, width - margin * 2);
    doc.text(statementLines, margin, 43);
    let y = 43 + statementLines.length * 4.2 + 2;
    doc.text([`Reviewer: ${state.reviewer}`, `Review Date: ${state.reviewDate}`, `Course Performance Level for ${state.soCode}: ${level}`], margin, y);
    y += 16;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...blue);
    doc.text('Performance Indicator Definitions', margin, y);
    doc.autoTable({ startY: y + 4, head: [['PI', 'Current Definition']], body: state.piCodes.map(pi => [pi, state.piDefinitions[pi]?.statement || '']), margin: { left: margin, right: margin, bottom: 15 }, styles: { fontSize: 8.5, cellPadding: 3, lineColor: [205, 210, 218], lineWidth: .25, overflow: 'linebreak' }, headStyles: { fillColor: blue, textColor: 255 }, columnStyles: { 0: { cellWidth: 20, fontStyle: 'bold' } }, alternateRowStyles: { fillColor: [244, 247, 250] } });
    const changed = state.rows.filter(isModified);
    const unchanged = state.rows.filter(row => !isModified(row));
    y = doc.lastAutoTable.finalY + 9;
    if (y > height - 45) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...blue); doc.text('Proposed Changes', margin, y);
    if (changed.length) {
      doc.autoTable({ startY: y + 4, head: [['CLO', 'CLO Statement', 'Current', 'Proposed', 'Level']], body: changed.map(row => [String(row.clo.clo_number), row.clo.clo_text, mappingText(row.original), mappingText(row.proposed), level]), margin: { left: margin, right: margin, bottom: 15 }, styles: { fontSize: 8, cellPadding: 3, lineColor: [205, 210, 218], lineWidth: .25, overflow: 'linebreak' }, headStyles: { fillColor: blue, textColor: 255 }, columnStyles: { 0: { cellWidth: 15, fontStyle: 'bold' }, 2: { cellWidth: 31 }, 3: { cellWidth: 39 }, 4: { cellWidth: 16 } }, alternateRowStyles: { fillColor: [244, 247, 250] } });
      y = doc.lastAutoTable.finalY + 9;
    } else {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(75); doc.text('No PI mapping changes proposed.', margin, y + 6); y += 14;
    }
    if (y > height - 45) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...blue); doc.text('Reviewed — No Change', margin, y);
    doc.autoTable({ startY: y + 4, head: [['CLO', 'CLO Statement', 'Retained Mapping', 'Level']], body: unchanged.map(row => [String(row.clo.clo_number), row.clo.clo_text, mappingText(row.original), level]), margin: { left: margin, right: margin, bottom: 24 }, styles: { fontSize: 8, cellPadding: 3, lineColor: [205, 210, 218], lineWidth: .25, overflow: 'linebreak' }, headStyles: { fillColor: blue, textColor: 255 }, columnStyles: { 0: { cellWidth: 16, fontStyle: 'bold' }, 2: { cellWidth: 43 }, 3: { cellWidth: 18 } }, alternateRowStyles: { fillColor: [244, 247, 250] } });
    y = doc.lastAutoTable.finalY + 8;
    if (y > height - 25) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'italic'); doc.setFontSize(8.5); doc.setTextColor(75);
    doc.text(doc.splitTextToSize('This report contains proposed PI mapping revisions only. It does not modify the approved curriculum database.', width - margin * 2), margin, y);
    const pages = doc.internal.getNumberOfPages();
    for (let page = 1; page <= pages; page++) { doc.setPage(page); footer(); }
    doc.save([sanitize(state.course.course_code), state.soCode, 'Mapping_Review', sanitize(state.reviewer), state.reviewDate].filter(Boolean).join('_') + '.pdf');
  }

  window.addEventListener('open-so-mapping-review', openReview);
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('soMappingReviewClose')?.addEventListener('click', closeReview);
    overlay()?.addEventListener('click', event => { if (event.target === overlay()) closeReview(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && overlay()?.classList.contains('visible')) closeReview(); });
    content()?.addEventListener('input', event => {
      if (event.target.id === 'soMappingReviewer') {
        state.reviewer = event.target.value;
        if (event.target.value.trim()) setReviewerError('');
      }
    });
    content()?.addEventListener('change', event => {
      if (event.target.id === 'soMappingCourse') {
        state.reviewer = document.getElementById('soMappingReviewer').value;
        selectCourse(event.target.value);
        render();
        return;
      }
      const rowIndex = event.target.dataset.mappingRowIndex;
      const pi = event.target.dataset.mappingPi;
      if (rowIndex !== undefined && pi) {
        const row = state.rows[+rowIndex];
        row.proposed = state.piCodes.filter(code => code === pi ? event.target.checked : row.proposed.includes(code));
        updateRowStatus(+rowIndex);
      }
    });
    content()?.addEventListener('click', event => {
      if (event.target.id === 'resetSOMapping') {
        state.reviewer = document.getElementById('soMappingReviewer').value;
        state.rows.forEach(row => { row.proposed = [...row.original]; });
        render();
      }
      if (event.target.id === 'generateSOMappingPdf') generatePDF();
    });
  });
})();
