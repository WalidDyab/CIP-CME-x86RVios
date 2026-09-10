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
      return { clo: clone(clo), original, proposed: [...original], review_comment: '', commentOpen: false };
    });
  }
  function isMappingChanged(row) { return !sameCodes(row.original, row.proposed); }
  function commentText(row) { return String(row.review_comment || '').trim(); }
  function hasComment(row) { return commentText(row) !== ''; }
  // A reviewer comment is a review modification in its own right; a row carrying both a
  // mapping change and a comment still counts once.
  function isModified(row) { return isMappingChanged(row) || hasComment(row); }
  function rowStatusText(row) { const mapped = isMappingChanged(row), commented = hasComment(row); return mapped && commented ? 'Modified + Comment' : mapped ? 'Modified' : commented ? 'Comment Added' : 'No Change'; }
  function commentToggleLabel(row) { return hasComment(row) ? 'Comment added' : 'Add comment'; }
  function commentToggleAria(row) { return hasComment(row) ? `Comment added for CLO ${row.clo.clo_number}, edit comment` : `Add comment for CLO ${row.clo.clo_number}`; }
  function modifiedCount(group) { return group.rows.filter(isModified).length; }
  function totalRows() { return state.groups.reduce((total, group) => total + group.rows.length, 0); }
  function totalModified() { return state.groups.reduce((total, group) => total + modifiedCount(group), 0); }
  function countRows(predicate) { return state.groups.reduce((total, group) => total + group.rows.filter(predicate).length, 0); }
  function totalMappingChanged() { return countRows(isMappingChanged); }
  function totalComments() { return countRows(hasComment); }
  function generalComment() { return String(state.generalComment || '').trim(); }
  function mappingText(codes) { return codes.length ? codes.join(', ') : `No PI selected under ${state.soCode}`; }
  function definitionAttrs(code, statement) { return `title="${portal.esc(statement || '')}" tabindex="0" aria-label="${portal.esc(`${code}: ${statement || ''}`)}"`; }

  function closeReview() {
    overlay().classList.remove('visible'); overlay().setAttribute('aria-hidden', 'true');
    document.body.classList.remove('review-open'); content().innerHTML = ''; state = null;
  }
  function renderDefinitions() {
    return `<section class="so-mapping-definitions"><div class="code" ${definitionAttrs(state.soCode, state.outcome.statement)}>${portal.esc(state.soCode)}</div><p>${portal.esc(state.outcome.statement || '')}</p><ul>${state.piCodes.map(pi => `<li><strong ${definitionAttrs(pi, state.piDefinitions[pi]?.statement)}>${portal.esc(pi)}</strong><span>${portal.esc(state.piDefinitions[pi]?.statement || '')}</span></li>`).join('')}</ul></section>`;
  }
  function renderCommentCell(row, key) {
    return `<td class="mapping-comment-cell"><button type="button" class="mapping-comment-toggle${hasComment(row) ? ' has-comment' : ''}" data-mapping-comment-toggle="${key}" aria-expanded="${row.commentOpen ? 'true' : 'false'}" aria-controls="soMappingComment-${key}" aria-label="${portal.esc(commentToggleAria(row))}"><span data-comment-icon aria-hidden="true">${hasComment(row) ? '\u270E' : '+'}</span><span data-comment-label>${portal.esc(commentToggleLabel(row))}</span></button></td>`;
  }
  function renderCommentRow(row, key, span, modified) {
    return `<tr class="mapping-comment-row${modified ? ' mapping-modified' : ''}" data-mapping-comment-row="${key}"${row.commentOpen ? '' : ' hidden'}><td colspan="${span}"><div class="mapping-comment-inner"><label for="soMappingComment-${key}">Reviewer comment — CLO ${portal.esc(row.clo.clo_number)} <span class="mapping-comment-optional">(optional)</span></label><textarea id="soMappingComment-${key}" data-mapping-comment="${key}" rows="3" placeholder="Describe the issue or the action requested from the course instructor">${portal.esc(row.review_comment)}</textarea></div></td></tr>`;
  }
  function renderTable(group, groupIndex) {
    const level = performanceLevel(group.course, state.piCodes), span = state.piCodes.length + 5;
    return `<div class="table-wrap so-mapping-table-wrap"><table class="so-mapping-table"><thead><tr><th>CLO</th><th>CLO Statement</th><th>Performance Level</th>${state.piCodes.map(pi => `<th ${definitionAttrs(pi, state.piDefinitions[pi]?.statement)}>${portal.esc(pi)}</th>`).join('')}<th>Comment</th><th>Status</th></tr></thead><tbody>${group.rows.map((row, rowIndex) => {
      const modified = isModified(row), key = `${groupIndex}-${rowIndex}`;
      return `<tr class="${modified ? 'mapping-modified' : ''}" data-mapping-row="${key}"><td class="code">${portal.esc(row.clo.clo_number)}</td><td>${portal.esc(row.clo.clo_text)}</td><td><span class="pill">${portal.esc(level)}</span></td>${state.piCodes.map(pi => `<td class="mapping-check-cell"><label title="${portal.esc(state.piDefinitions[pi]?.statement || '')}"><input type="checkbox" data-mapping-group-index="${groupIndex}" data-mapping-row-index="${rowIndex}" data-mapping-pi="${portal.esc(pi)}" aria-label="${portal.esc(`${pi}: ${state.piDefinitions[pi]?.statement || ''}; CLO ${row.clo.clo_number}`)}"${row.proposed.includes(pi) ? ' checked' : ''}><span class="sr-only">Map CLO ${portal.esc(row.clo.clo_number)} to ${portal.esc(pi)}</span></label></td>`).join('')}${renderCommentCell(row, key)}<td><span class="mapping-status ${modified ? 'is-modified' : ''}">${rowStatusText(row)}</span></td></tr>${renderCommentRow(row, key, span, modified)}`;
    }).join('')}</tbody></table></div>`;
  }
  function renderCourse(group, groupIndex) {
    return `<section class="so-mapping-course" data-mapping-course="${groupIndex}"><header class="so-mapping-course-head"><div class="code">${portal.esc(group.course.course_code)}</div><h3>${portal.esc(group.course.course_title)}</h3><p>${group.rows.length} relevant CLO${group.rows.length === 1 ? '' : 's'} · <strong data-course-modified="${groupIndex}">${modifiedCount(group)}</strong> modified</p></header>${renderTable(group, groupIndex)}</section>`;
  }
  function render() {
    title().textContent = `${state.soCode} Mapping Review`;
    content().innerHTML = `${renderDefinitions()}<div class="review-meta so-mapping-meta"><label class="review-field">Reviewer Name<input id="soMappingReviewer" value="${portal.esc(state.reviewer)}" autocomplete="name" placeholder="Enter reviewer name"><span class="review-error" data-mapping-error="reviewer"></span></label><label class="review-field">Review Date<input value="${state.reviewDate}" readonly></label><label class="review-field so-mapping-general"><span>General Review Comment <span class="mapping-comment-optional">(optional)</span></span><textarea id="soMappingGeneralComment" rows="2" placeholder="Optional overall note for this student outcome review">${portal.esc(state.generalComment)}</textarea></label></div><div class="so-mapping-overall"><span><strong>${state.groups.length}</strong> courses</span><span><strong>${totalRows()}</strong> CLOs</span><span><strong data-overall-modified>${totalModified()}</strong> modified</span><span><strong data-overall-comments>${totalComments()}</strong> with comments</span></div><div class="review-section-heading"><h3>Current and Proposed PI Mapping</h3><button class="review-secondary" id="resetSOMapping" type="button">Reset All to Current Mapping</button></div><p class="mapping-help">Only PIs belonging to ${portal.esc(state.soCode)} are editable. Selecting no PI is a valid proposal. Use <strong>Add comment</strong> on any CLO that needs instructor action — unclear wording, a questionable SO mapping or any other curriculum issue. A comment on its own counts as a review modification.</p><div class="so-mapping-course-list">${state.groups.length ? state.groups.map(renderCourse).join('') : '<div class="alert">No courses are currently mapped to this student outcome.</div>'}</div><div class="review-footer"><button class="review-primary" id="generateSOMappingPdf" type="button">Generate ${portal.esc(state.soCode)} Mapping Review PDF</button></div>`;
  }
  function openReview(event) {
    const context = window.soMappingReviewContext, soCode = event.detail?.so;
    if (!context || !soCode) return;
    const outcome = context.abet?.student_outcomes?.[soCode]; if (!outcome || !(outcome.pis || []).length) return;
    state = { soCode, outcome: clone(outcome), piCodes: [...(outcome.pis || [])], piDefinitions: clone(context.abet?.performance_indicators || {}), groups: [], reviewer: '', generalComment: '', reviewDate: dateISO() };
    state.groups = clone(relevantCourses(context, soCode)).map(course => ({ course, rows: rowsForCourse(course) }));
    render(); overlay().classList.add('visible'); overlay().setAttribute('aria-hidden', 'false'); document.body.classList.add('review-open');
    setTimeout(() => document.getElementById('soMappingReviewer')?.focus(), 0);
  }
  function updateCounts(groupIndex) {
    const courseCount = content().querySelector(`[data-course-modified="${groupIndex}"]`), overallCount = content().querySelector('[data-overall-modified]'), overallComments = content().querySelector('[data-overall-comments]');
    if (courseCount) courseCount.textContent = modifiedCount(state.groups[groupIndex]);
    if (overallCount) overallCount.textContent = totalModified();
    if (overallComments) overallComments.textContent = totalComments();
  }
  function updateRowStatus(groupIndex, rowIndex) {
    const key = `${groupIndex}-${rowIndex}`, row = state.groups[groupIndex].rows[rowIndex];
    const tr = content().querySelector(`[data-mapping-row="${key}"]`), detail = content().querySelector(`[data-mapping-comment-row="${key}"]`), modified = isModified(row);
    tr?.classList.toggle('mapping-modified', modified); detail?.classList.toggle('mapping-modified', modified);
    const status = tr?.querySelector('.mapping-status');
    if (status) { status.textContent = rowStatusText(row); status.classList.toggle('is-modified', modified); }
    const toggle = tr?.querySelector('[data-mapping-comment-toggle]');
    if (toggle) {
      toggle.classList.toggle('has-comment', hasComment(row)); toggle.setAttribute('aria-label', commentToggleAria(row));
      const label = toggle.querySelector('[data-comment-label]'), icon = toggle.querySelector('[data-comment-icon]');
      if (label) label.textContent = commentToggleLabel(row);
      if (icon) icon.textContent = hasComment(row) ? '\u270E' : '+';
    }
    updateCounts(groupIndex);
  }
  function growComment(field) { if (field && field.scrollHeight > field.clientHeight) field.style.height = `${Math.min(field.scrollHeight + 2, 260)}px`; }
  function toggleComment(key) {
    const [groupIndex, rowIndex] = key.split('-').map(Number), row = state.groups[groupIndex]?.rows[rowIndex];
    if (!row) return;
    row.commentOpen = !row.commentOpen;
    const detail = content().querySelector(`[data-mapping-comment-row="${key}"]`), toggle = content().querySelector(`[data-mapping-comment-toggle="${key}"]`);
    if (detail) detail.hidden = !row.commentOpen;
    toggle?.setAttribute('aria-expanded', row.commentOpen ? 'true' : 'false');
    if (row.commentOpen) { const field = document.getElementById(`soMappingComment-${key}`); field?.focus(); growComment(field); }
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
        const rows = group.rows.filter(row => changed ? isMappingChanged(row) : !isMappingChanged(row)); if (!rows.length) return;
        rendered = true; y = ensureSpace(y, 42); doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(35); doc.text(`${group.course.course_code} — ${group.course.course_title}`, margin, y);
        const level = performanceLevel(group.course, state.piCodes);
        doc.autoTable({ startY: y + 3, head: changed ? [['CLO', 'CLO Statement', 'Level', 'Current', 'Proposed']] : [['CLO', 'CLO Statement', 'Level', 'Retained Mapping']], body: rows.map(row => changed ? [String(row.clo.clo_number), row.clo.clo_text, level, mappingText(row.original), mappingText(row.proposed)] : [String(row.clo.clo_number), row.clo.clo_text, level, mappingText(row.original)]), margin: { left: margin, right: margin, bottom: 15 }, styles: { fontSize: 7.8, cellPadding: 3, lineColor: [205, 210, 218], lineWidth: .25, overflow: 'linebreak' }, headStyles: { fillColor: blue, textColor: 255 }, columnStyles: changed ? { 0: { cellWidth: 14, fontStyle: 'bold' }, 2: { cellWidth: 17 }, 3: { cellWidth: 32 }, 4: { cellWidth: 39 } } : { 0: { cellWidth: 14, fontStyle: 'bold' }, 2: { cellWidth: 18 }, 3: { cellWidth: 45 } }, alternateRowStyles: { fillColor: [244, 247, 250] } });
        y = doc.lastAutoTable.finalY + 8;
      });
      if (!rendered) { doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(75); doc.text(changed ? 'No PI mapping changes proposed.' : 'No unchanged mappings.', margin, y + 2); y += 10; }
      return y;
    };
    const commentTable = startY => {
      const rows = [];
      state.groups.forEach(group => group.rows.filter(hasComment).forEach(row => rows.push([group.course.course_code, String(row.clo.clo_number), row.clo.clo_text, commentText(row)])));
      let y = ensureSpace(startY, 42);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...blue); doc.text('Reviewer Comments — Instructor Action Requested', margin, y); y += 5;
      if (!rows.length) { doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(75); doc.text('No reviewer comments were recorded.', margin, y + 2); return y + 10; }
      doc.autoTable({ startY: y + 3, head: [['Course', 'CLO', 'CLO Statement', 'Reviewer Comment']], body: rows, margin: { left: margin, right: margin, bottom: 15 }, styles: { fontSize: 7.8, cellPadding: 3, lineColor: [205, 210, 218], lineWidth: .25, overflow: 'linebreak', valign: 'top' }, headStyles: { fillColor: orange, textColor: 25 }, columnStyles: { 0: { cellWidth: 20, fontStyle: 'bold' }, 1: { cellWidth: 12 }, 2: { cellWidth: 58 }, 3: { fontStyle: 'italic', textColor: blue } }, alternateRowStyles: { fillColor: [253, 245, 231] } });
      return doc.lastAutoTable.finalY + 8;
    };
    doc.setFillColor(...blue); doc.rect(0, 0, width, 24, 'F'); doc.setFillColor(...orange); doc.rect(0, 24, width, 2, 'F');
    doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.text(`${state.soCode} Mapping Review Report`, margin, 15);
    doc.setTextColor(25); doc.setFontSize(13); const statementLines = doc.splitTextToSize(`${state.soCode}: ${state.outcome.statement || ''}`, width - margin * 2); doc.text(statementLines, margin, 36);
    let y = 36 + statementLines.length * 4.7 + 2; doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(75);
    doc.text([`Reviewer: ${state.reviewer}`, `Review Date: ${state.reviewDate}`, `Courses Reviewed: ${state.groups.length}`, `CLOs Reviewed: ${totalRows()}`, `Modified Rows: ${totalModified()}`, `PI Mapping Changes: ${totalMappingChanged()}`, `Reviewer Comments: ${totalComments()}`], margin, y); y += 32;
    if (generalComment()) {
      const generalLines = doc.splitTextToSize(generalComment(), width - margin * 2);
      y = ensureSpace(y, generalLines.length * 4.2 + 20);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...blue); doc.text('General Review Comment', margin, y);
      doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(45); doc.text(generalLines, margin, y + 5.5);
      y += generalLines.length * 4.2 + 12;
    }
    y = ensureSpace(y, 42);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...blue); doc.text('Performance Indicator Definitions', margin, y);
    doc.autoTable({ startY: y + 4, head: [['PI', 'Current Definition']], body: state.piCodes.map(pi => [pi, state.piDefinitions[pi]?.statement || '']), margin: { left: margin, right: margin, bottom: 15 }, styles: { fontSize: 8.5, cellPadding: 3, lineColor: [205, 210, 218], lineWidth: .25, overflow: 'linebreak' }, headStyles: { fillColor: blue, textColor: 255 }, columnStyles: { 0: { cellWidth: 20, fontStyle: 'bold' } }, alternateRowStyles: { fillColor: [244, 247, 250] } });
    y = groupTables('Proposed Changes', doc.lastAutoTable.finalY + 9, true); y = groupTables('Reviewed — No Change', y, false); y = commentTable(y); y = ensureSpace(y, 25);
    doc.setFont('helvetica', 'italic'); doc.setFontSize(8.5); doc.setTextColor(75); doc.text(doc.splitTextToSize('This report contains proposed PI mapping revisions and reviewer comments only. It does not modify the approved curriculum database, CLO wording, SO mapping or delivery methods.', width - margin * 2), margin, y);
    const pages = doc.internal.getNumberOfPages(); for (let page = 1; page <= pages; page++) { doc.setPage(page); footer(); }
    doc.save([state.soCode, 'Mapping_Review', sanitize(state.reviewer), state.reviewDate].filter(Boolean).join('_') + '.pdf');
  }

  window.addEventListener('open-so-mapping-review', openReview);
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('soMappingReviewClose')?.addEventListener('click', closeReview);
    overlay()?.addEventListener('click', event => { if (event.target === overlay()) closeReview(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && overlay()?.classList.contains('visible')) closeReview(); });
    content()?.addEventListener('input', event => {
      if (event.target.id === 'soMappingReviewer') { state.reviewer = event.target.value; if (event.target.value.trim()) setReviewerError(''); return; }
      if (event.target.id === 'soMappingGeneralComment') { state.generalComment = event.target.value; return; }
      const commentKey = event.target.dataset.mappingComment;
      if (commentKey !== undefined) { const [groupIndex, rowIndex] = commentKey.split('-').map(Number); state.groups[groupIndex].rows[rowIndex].review_comment = event.target.value; growComment(event.target); updateRowStatus(groupIndex, rowIndex); }
    });
    content()?.addEventListener('change', event => {
      const groupIndex = event.target.dataset.mappingGroupIndex, rowIndex = event.target.dataset.mappingRowIndex, pi = event.target.dataset.mappingPi;
      if (groupIndex !== undefined && rowIndex !== undefined && pi) { const row = state.groups[+groupIndex].rows[+rowIndex]; row.proposed = state.piCodes.filter(code => code === pi ? event.target.checked : row.proposed.includes(code)); updateRowStatus(+groupIndex, +rowIndex); }
    });
    content()?.addEventListener('click', event => {
      const toggle = event.target.closest?.('[data-mapping-comment-toggle]');
      if (toggle) { toggleComment(toggle.dataset.mappingCommentToggle); return; }
      if (event.target.id === 'resetSOMapping') { state.reviewer = document.getElementById('soMappingReviewer').value; state.generalComment = ''; state.groups.forEach(group => group.rows.forEach(row => { row.proposed = [...row.original]; row.review_comment = ''; row.commentOpen = false; })); render(); }
      if (event.target.id === 'generateSOMappingPdf') generatePDF();
    });
  });
})();
