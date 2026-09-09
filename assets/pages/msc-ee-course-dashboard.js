// ── Store course data globally for the print feature ──
let _printCourseRaw = null;
let _printCourseNorm = null;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const courses = await portal.loadJSON('../data/msc_ee_courses_full.json');
    portal.setupCourseBrowser(courses, { linkPrefix: 'course-dashboard.html?course=' });
    const wanted = portal.getParam('course') || portal.normCourse(courses[0]).code;
    const raw = courses.find(x => portal.normCourse(x).code === wanted) || courses[0];
    const c = portal.normCourse(raw);

    // Store for print
    _printCourseRaw = raw;
    _printCourseNorm = c;

    byId('detail').innerHTML = `<section class="card"><div class="code">${portal.esc(c.code)}</div><h2>${portal.esc(c.title)}</h2><div>${portal.badge(c.track)}${portal.badge(c.re)}${portal.badge(c.credits + ' credits')}${portal.badge('Prereq: ' + (c.prereq || 'N.A.'))}</div><button class="print-btn" id="printReportBtn" title="Export course report as PDF"><svg viewBox="0 0 24 24"><path d="M19 8h-1V3H6v5H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zM8 5h8v3H8V5zm8 14H8v-4h8v4zm2-4v-2H6v2H4v-4c0-.55.45-1 1-1h14c.55 0 1 .45 1 1v4h-2z"/><circle cx="18" cy="11.5" r="1"/></svg>Print Report</button><p class="muted">${portal.esc(c.desc)}</p></section><section class="card"><h2>Course Learning Outcomes</h2>${portal.renderCLOTable(c.clos)}</section><section class="card"><h2>Topics</h2>${portal.renderTopics(c.topics)}</section><section class="grid two"><div class="card"><h2>Textbooks</h2><p class="muted">${portal.esc((raw.textbooks || []).join('\n'))}</p></div><div class="card"><h2>References</h2><p class="muted">${portal.esc((raw.references || []).join('\n'))}</p></div></section>`;

    // Attach print button handler
    byId('printReportBtn').addEventListener('click', () => {
      document.getElementById('printModalOverlay').classList.add('visible');
    });

  } catch (e) {
    byId('detail').innerHTML = '<div class="alert">Could not load JSON. Run: python -m http.server 8000</div>';
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

  // ── Helper: check page space and add new page if needed ──
  function ensureSpace(needed) {
    if (y + needed > pageH - 18) {
      doc.addPage();
      y = margin;
    }
  }

  // ── Header Bar ──
  doc.setFillColor(...PSU_BLUE);
  doc.rect(0, 0, pageW, 22, 'F');
  doc.setFillColor(...ORANGE);
  doc.rect(0, 22, pageW, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text('PSU College of Engineering — MSc EE Curriculum Intelligence Portal', margin, 14);

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
      'Credits: ' + (c.credits || 'N/A'),
      'Prereq: ' + (c.prereq || 'N.A.'),
      'Coreq: ' + (c.coreq || 'N.A.')
    ].join('   |   ');
    doc.text(infoLine, margin + 8, y + 23);

    y += 40;
  }

  // ── Description Section ──
  if (sections.has('description') && c.desc) {
    ensureSpace(30);
    doc.setFontSize(13);
    doc.setTextColor(...PSU_BLUE);
    doc.setFont('helvetica', 'bold');
    doc.text('Course Description', margin, y + 4);
    y += 8;

    doc.setFontSize(9);
    doc.setTextColor(...DARK);
    doc.setFont('helvetica', 'normal');
    const descLines = doc.splitTextToSize(c.desc, pageW - margin * 2 - 4);
    doc.text(descLines, margin + 2, y + 4);
    y += descLines.length * 4.5 + 10;
  }

  // ── CLO Table ──
  if (sections.has('cloTable')) {
    const clos = raw.clos || [];
    if (clos.length > 0) {
      ensureSpace(20);
      doc.setFontSize(13);
      doc.setTextColor(...PSU_BLUE);
      doc.setFont('helvetica', 'bold');
      doc.text('Course Learning Outcomes', margin, y + 4);
      y += 8;

      const headers = ['No.', 'CLO Description', 'PLO Mapping'];
      const rows = clos.map(x => [
        String(x.no || x.clo_number || ''),
        x.text || x.clo_text || '',
        x.plos || [...(x.mapped_sos || []), ...(x.pi_codes || [])].join(', ')
      ]);

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
        alternateRowStyles: { fillColor: [240, 243, 248] },
        columnStyles: {
          0: { cellWidth: 18, fontStyle: 'bold', halign: 'center' },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 35, halign: 'center' }
        }
      });
      y = doc.lastAutoTable.finalY + 10;
    }
  }

  // ── Topics Table ──
  if (sections.has('topics')) {
    const topics = raw.topics || c.topics || [];
    if (topics.length > 0) {
      ensureSpace(20);
      doc.setFontSize(13);
      doc.setTextColor(...PSU_BLUE);
      doc.setFont('helvetica', 'bold');
      doc.text('Topics', margin, y + 4);
      y += 8;

      const rows = topics.map(t => [t.name || '', t.hours || '']);
      doc.autoTable({
        startY: y,
        head: [['Topic', 'Hours']],
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
        alternateRowStyles: { fillColor: [240, 243, 248] },
        columnStyles: {
          0: { cellWidth: 'auto' },
          1: { cellWidth: 22, halign: 'center' }
        }
      });
      y = doc.lastAutoTable.finalY + 10;
    }
  }

  // ── Textbooks ──
  if (sections.has('textbooks')) {
    const textbooks = raw.textbooks || [];
    if (textbooks.length > 0) {
      ensureSpace(20);
      doc.setFontSize(13);
      doc.setTextColor(...PSU_BLUE);
      doc.setFont('helvetica', 'bold');
      doc.text('Textbooks', margin, y + 4);
      y += 8;

      doc.setFontSize(9);
      doc.setTextColor(...DARK);
      doc.setFont('helvetica', 'normal');
      const tbText = textbooks.join('\n');
      const tbLines = doc.splitTextToSize(tbText, pageW - margin * 2 - 4);
      tbLines.forEach(line => {
        ensureSpace(6);
        doc.text(line, margin + 2, y + 4);
        y += 4.5;
      });
      y += 8;
    }
  }

  // ── References ──
  if (sections.has('references')) {
    const refs = raw.references || [];
    if (refs.length > 0) {
      ensureSpace(20);
      doc.setFontSize(13);
      doc.setTextColor(...PSU_BLUE);
      doc.setFont('helvetica', 'bold');
      doc.text('References', margin, y + 4);
      y += 8;

      doc.setFontSize(9);
      doc.setTextColor(...DARK);
      doc.setFont('helvetica', 'normal');
      const refText = refs.join('\n');
      const refLines = doc.splitTextToSize(refText, pageW - margin * 2 - 4);
      refLines.forEach(line => {
        ensureSpace(6);
        doc.text(line, margin + 2, y + 4);
        y += 4.5;
      });
      y += 8;
    }
  }

  // ── Footer on all pages ──
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
