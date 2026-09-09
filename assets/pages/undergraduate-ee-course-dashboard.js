// ── Store course data globally for the print feature ──
let _printCourseRaw = null;
let _printCourseNorm = null;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const data = await portal.loadJSON('../data/ee_curriculum.json');
    const courses = data.curriculum.courses || [];
    const wanted = portal.getParam('course') || portal.normCourse(courses[0]).code;
    const raw = courses.find(x => portal.normCourse(x).code === wanted) || courses[0];
    const c = portal.normCourse(raw);
    const courseSelect = byId('courseSelect');
    courseSelect.innerHTML = courses.map(course => {
      const normalized = portal.normCourse(course);
      return `<option value="${portal.esc(normalized.code)}">${portal.esc(normalized.code)} — ${portal.esc(normalized.title)}</option>`;
    }).join('');
    courseSelect.value = c.code;
    courseSelect.addEventListener('change', () => {
      const nextUrl = new URL(location.href);
      nextUrl.searchParams.set('course', courseSelect.value);
      nextUrl.searchParams.set('layout', 'full');
      location.href = nextUrl.toString();
    });

    // Store for print
    _printCourseRaw = raw;
    _printCourseNorm = c;
    window.cloReviewContext = { raw, normalized: c, abet: data.abet || {}, courses };
    window.referenceManagementContext = { course: raw, normalized: c, courses };

    const metadataList = (values, ordered = false) => {
      const tag = ordered ? 'ol' : 'ul';
      return `<${tag} class="course-information-list">${(values || []).map(value => `<li>${portal.esc(value)}</li>`).join('')}</${tag}>`;
    };
    const renderCourseInformation = course => {
      const courseDescription = course.course_description;
      const blocks = [];
      if (courseDescription) blocks.push(`<div class="course-information-block"><h3>Course Description</h3><p>${portal.esc(courseDescription)}</p></div>`);
      if (course.prerequisite_text) blocks.push(`<div class="course-information-block"><h3>Prerequisite(s)</h3><p>${portal.esc(course.prerequisite_text)}</p></div>`);
      if (course.corequisite_text) blocks.push(`<div class="course-information-block"><h3>Co-requisite(s)</h3><p>${portal.esc(course.corequisite_text)}</p></div>`);
      if ((course.course_objectives || []).length) blocks.push(`<div class="course-information-block"><h3>Course Objectives</h3>${metadataList(course.course_objectives, true)}</div>`);
      if ((course.textbooks || []).length) blocks.push(`<div class="course-information-block"><h3>Textbook</h3>${metadataList(course.textbooks)}</div>`);
      if ((course.references || []).length) blocks.push(`<div class="course-information-block"><h3>References</h3>${metadataList(course.references)}</div>`);
      if (!blocks.length) return '<section class="card course-information"><h2>Course Information</h2><p class="muted">Additional course information is not available for this course.</p></section>';
      return `<section class="card course-information"><h2>Course Information</h2><div class="course-information-content">${blocks.join('')}</div></section>`;
    };
    const renderCourseTopics = course => {
      const topics = Array.isArray(course.course_topics) ? course.course_topics : [];
      if (course.course_code === 'EE 490' || course.course_code === 'EE 492' || !topics.length) return '';
      return `<section class="card course-topics"><h2>Course Topics and Contact Hours</h2><div class="table-wrap"><table class="course-topics-table"><thead><tr><th scope="col">No.</th><th scope="col">Course Topic</th><th scope="col">Contact Hours</th></tr></thead><tbody>${topics.map(topic => `<tr><td>${portal.esc(topic.topic_number)}</td><td>${portal.esc(topic.topic_title)}</td><td>${portal.esc(topic.contact_hours)}</td></tr>`).join('')}</tbody><tfoot><tr><th scope="row" colspan="2">Total Contact Hours</th><td>${portal.esc(course.total_topic_contact_hours)}</td></tr></tfoot></table></div></section>`;
    };
    const methodList = values => `<ul class="clo-method-list">${(values || []).map(value => `<li>${portal.esc(value)}</li>`).join('')}</ul>`;
    const methodsSection = (raw.clos || []).length ? `<section class="card"><h2>Teaching Strategies and Assessment Methods</h2><div class="table-wrap"><table class="clo-methods-table"><thead><tr><th>CLO ID</th><th>CLO Wording</th><th>Teaching Strategies</th><th>Assessment Methods</th></tr></thead><tbody>${raw.clos.map(x => `<tr><td class="code">${portal.esc(x.clo_number)}</td><td>${portal.esc(x.clo_text)}</td><td>${methodList(x.teaching_strategy)}</td><td>${methodList(x.assessment_methods)}</td></tr>`).join('')}</tbody></table></div></section>` : '';
    const academicPlacement = c.academicYear && c.academicLevel && c.academicYear !== '0' && c.academicLevel !== '0' ? `Year ${c.academicYear} / Level ${c.academicLevel}` : 'Academic placement not specified';
    byId('detail').innerHTML = `<section class="card"><div class="code">${portal.esc(c.code)}</div><h2>${portal.esc(c.title)}</h2><div>${portal.badge(c.track)}${portal.badge(c.re)}${portal.badge(academicPlacement)}${portal.badge(c.credits + ' credits')}</div><div class="course-actions"><button class="print-btn" id="printReportBtn" title="Export course report as PDF"><svg viewBox="0 0 24 24"><path d="M19 8h-1V3H6v5H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zM8 5h8v3H8V5zm8 14H8v-4h8v4zm2-4v-2H6v2H4v-4c0-.55.45-1 1-1h14c.55 0 1 .45 1 1v4h-2z"/><circle cx="18" cy="11.5" r="1"/></svg>Print Course Info</button><span id="ncaaaCsAction" class="ncaaa-cs-note muted" aria-live="polite">Checking NCAAA CS…</span><button class="print-btn clo-review-open" id="cloReviewOpen" type="button">Request Review CLOs</button><button class="print-btn" id="referenceReviewOpen" type="button">Request References Modification</button></div></section><section class="card"><h2>CLO–SO–PI Mapping</h2><div class="table-wrap"><table class="clo-main-table"><thead><tr><th>CLO ID</th><th>NQF Domain</th><th>CLO Wording</th><th>SO</th><th>PIs</th></tr></thead><tbody>${(raw.clos || []).map(x => `<tr><td class="code">${portal.esc(x.clo_number)}</td><td>${portal.badge(x.nqf_domain)}</td><td>${portal.esc(x.clo_text)}</td><td>${(x.mapped_sos || []).map(s => portal.badge(s)).join('')}</td><td>${(x.pi_codes || []).map(s => portal.badge(s)).join('')}</td></tr>`).join('')}</tbody></table></div></section>${methodsSection}${renderCourseTopics(raw)}`;

    byId('detail').firstElementChild.insertAdjacentHTML('afterend', renderCourseInformation(raw));

    // Attach print button handler
    byId('printReportBtn').addEventListener('click', () => {
      byId('printModalOverlay').classList.add('visible');
    });
    byId('cloReviewOpen').addEventListener('click', () => window.dispatchEvent(new CustomEvent('open-clo-review')));
    byId('referenceReviewOpen').addEventListener('click', () => window.dispatchEvent(new CustomEvent('open-reference-review')));
    const ncaaaAction = byId('ncaaaCsAction');
    const ncaaaKind = window.ncaaaCsGenerator.isCoop(raw) ? 'FES' : 'CS';
    const ncaaaButtonLabel = 'Generate NCAAA CS';
    const button = document.createElement('button');
    button.className = 'print-btn';
    button.type = 'button';
    button.textContent = ncaaaButtonLabel;
    button.title = `Generate the official NCAAA ${ncaaaKind === 'FES' ? 'Field Experience' : 'Course'} Specification locally in this browser`;
    const status = document.createElement('div');
    status.className = 'ncaaa-cs-note muted';
    status.setAttribute('aria-live', 'polite');
    ncaaaAction.replaceWith(button, status);
    button.addEventListener('click', async () => {
        if (button.disabled) return;
        button.disabled = true;
        button.textContent = 'Generating…';
        status.textContent = '';
        try {
          const result = await window.ncaaaCsGenerator.generateAndDownload(
            raw,
            {
              cs: '../templates/EE-CS-NCAAA-Template.docx',
              fes: '../templates/EE-FES-NCAAA-Template.docx'
            }
          );
          if (result.warnings.length) {
            const heading = document.createElement('strong');
            heading.className = 'ncaaa-cs-warning-title';
            heading.textContent = 'Downloaded successfully — data warnings:';
            const list = document.createElement('ul');
            list.className = 'ncaaa-cs-warning-list';
            result.warnings.forEach(warning => {
              const item = document.createElement('li');
              item.textContent = warning;
              list.appendChild(item);
            });
            status.replaceChildren(heading, list);
          } else {
            status.textContent = 'Downloaded successfully.';
          }
        } catch (error) {
          status.textContent = `Could not generate: ${error.message || 'unexpected error'}`;
        } finally {
          button.disabled = false;
          button.textContent = ncaaaButtonLabel;
        }
    });

  } catch (e) {
    byId('detail').innerHTML = '<div class="alert">Could not load course information.</div>';
  }
});

// ── Modal Logic ──
document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('printModalOverlay');
  const cancelBtn = document.getElementById('printCancelBtn');
  const generateBtn = document.getElementById('printGenerateBtn');
  const selectAll = document.getElementById('printSelectAll');
  const checkboxes = () => document.querySelectorAll('input[name="printOpt"]');

  // Close modal
  cancelBtn.addEventListener('click', () => overlay.classList.remove('visible'));
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('visible'); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') overlay.classList.remove('visible'); });

  // Select all toggle
  selectAll.addEventListener('change', () => {
    checkboxes().forEach(cb => cb.checked = selectAll.checked);
  });
  // Update select-all state when individual options change
  document.querySelector('.print-options').addEventListener('change', () => {
    const cbs = checkboxes();
    selectAll.checked = [...cbs].every(cb => cb.checked);
  });

  // Generate PDF
  generateBtn.addEventListener('click', () => {
    if (!_printCourseRaw || !_printCourseNorm) { alert('Course data is still loading. Please try again.'); return; }
    const selected = new Set([...checkboxes()].filter(cb => cb.checked).map(cb => cb.value));
    if (selected.size === 0) {
      alert('Please select at least one section to include.');
      return;
    }
    generateCoursePDF(_printCourseNorm, _printCourseRaw, selected);
    overlay.classList.remove('visible');
  });
});

// ── PDF Generation ──
function generateCoursePDF(c, raw, sections) {
  if (!window.jspdf || !window.jspdf.jsPDF) { alert('PDF library failed to load. Please check your internet connection and refresh.'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 16;
  let y = margin;

  // ── Colors ──
  const PSU_BLUE = [20, 61, 102];
  const ORANGE = [242, 162, 58];
  const DARK = [14, 25, 40];
  const LIGHT_BG = [245, 247, 250];

  // ── Header Bar ──
  doc.setFillColor(...PSU_BLUE);
  doc.rect(0, 0, pageW, 22, 'F');
  doc.setFillColor(...ORANGE);
  doc.rect(0, 22, pageW, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text('PSU College of Engineering — Curriculum Intelligence Portal', margin, 14);

  y = 32;

  // ── Course Info Section ──
  if (sections.has('courseInfo')) {
    doc.setFillColor(...LIGHT_BG);
    doc.roundedRect(margin, y, pageW - margin * 2, 32, 4, 4, 'F');
    doc.setDrawColor(...PSU_BLUE);
    doc.setLineWidth(0.5);
    doc.roundedRect(margin, y, pageW - margin * 2, 32, 4, 4, 'S');

    doc.setFontSize(18);
    doc.setTextColor(...DARK);
    doc.setFont('helvetica', 'bold');
    doc.text(c.code + ' — ' + c.title, margin + 8, y + 13);

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal');
    const infoLine = [
      'Track: ' + (c.track || 'N/A'),
      'Type: ' + (c.re || 'N/A'),
      'Academic placement: ' + (c.academicYear && c.academicLevel && c.academicYear !== '0' && c.academicLevel !== '0' ? `Year ${c.academicYear} / Level ${c.academicLevel}` : 'N/A'),
      'Credits: ' + (c.credits || 'N/A')
    ].join('   |   ');
    doc.text(infoLine, margin + 8, y + 23);

    y += 40;
  }

  // ── Build CLO Table ──
  const clos = raw.clos || [];
  if (clos.length === 0) {
    doc.setFontSize(12);
    doc.setTextColor(...DARK);
    doc.text('No CLOs available for this course.', margin, y + 8);
    doc.save(c.code.replace(/\s+/g, '_') + '_Report.pdf');
    return;
  }

  // Determine columns based on selections
  const headers = [];
  const columnStyles = {};
  let colIdx = 0;

  headers.push('CLO');
  columnStyles[colIdx] = { cellWidth: 14, fontStyle: 'bold', halign: 'center' };
  colIdx++;

  if (sections.has('cloText')) {
    headers.push('CLO Description');
    columnStyles[colIdx] = { cellWidth: 'auto' };
    colIdx++;
  }
  if (sections.has('soMapping')) {
    headers.push('SO');
    columnStyles[colIdx] = { cellWidth: 28, halign: 'center' };
    colIdx++;
  }
  if (sections.has('piMapping')) {
    headers.push('PI Codes');
    columnStyles[colIdx] = { cellWidth: 38, halign: 'center' };
    colIdx++;
  }
  if (sections.has('teachingStrategy')) {
    headers.push('Teaching Strategy');
    columnStyles[colIdx] = { cellWidth: 50 };
    colIdx++;
  }
  if (sections.has('assessmentMethods')) {
    headers.push('Assessment Methods');
    columnStyles[colIdx] = { cellWidth: 50 };
    colIdx++;
  }

  const rows = clos.map(x => {
    const row = [String(x.clo_number)];
    if (sections.has('cloText')) row.push(x.clo_text || '');
    if (sections.has('soMapping')) row.push((x.mapped_sos || []).join(', '));
    if (sections.has('piMapping')) row.push((x.pi_codes || []).join(', '));
    if (sections.has('teachingStrategy')) row.push(portal.listText(x.teaching_strategy));
    if (sections.has('assessmentMethods')) row.push(portal.listText(x.assessment_methods));
    return row;
  });

  // Section title
  doc.setFontSize(13);
  doc.setTextColor(...PSU_BLUE);
  doc.setFont('helvetica', 'bold');
  doc.text('CLO–SO–PI Mapping Table', margin, y + 4);
  y += 8;

  doc.autoTable({
    startY: y,
    head: [headers],
    body: rows,
    margin: { left: margin, right: margin },
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      cellPadding: 4,
      lineColor: [200, 200, 210],
      lineWidth: 0.3,
      textColor: [30, 30, 40],
      overflow: 'linebreak'
    },
    headStyles: {
      fillColor: PSU_BLUE,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'center'
    },
    alternateRowStyles: {
      fillColor: [240, 243, 248]
    },
    columnStyles: columnStyles,
    didDrawPage: function (data) {
      // Footer on every page
      const pageNum = doc.internal.getCurrentPageInfo().pageNumber;
      const totalPages = doc.internal.getNumberOfPages();
      doc.setFillColor(...PSU_BLUE);
      doc.rect(0, pageH - 10, pageW, 10, 'F');
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text('Generated by PSU Curriculum Intelligence Portal', margin, pageH - 4);
      doc.text('Page ' + pageNum + ' of ' + totalPages, pageW - margin - 20, pageH - 4);
      const now = new Date();
      doc.text(now.toLocaleDateString() + '  ' + now.toLocaleTimeString(), pageW / 2 - 15, pageH - 4);
    }
  });

  // Fix total page count on all pages
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFillColor(...PSU_BLUE);
    doc.rect(0, pageH - 10, pageW, 10, 'F');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text('Generated by PSU Curriculum Intelligence Portal', margin, pageH - 4);
    doc.text('Page ' + i + ' of ' + totalPages, pageW - margin - 20, pageH - 4);
    const now = new Date();
    doc.text(now.toLocaleDateString() + '  ' + now.toLocaleTimeString(), pageW / 2 - 15, pageH - 4);
  }

  doc.save(c.code.replace(/\s+/g, '_') + '_Report.pdf');
}
