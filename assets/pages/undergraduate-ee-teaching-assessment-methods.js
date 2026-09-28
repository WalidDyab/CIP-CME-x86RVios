document.addEventListener('DOMContentLoaded', async () => {
    const root = byId('assessmentPlan');
    try {
      const { standards } = await portal.loadJSON('../data/ee-standards.json');
      const byKey = new Map(standards.map(item => [`${item.organization}|${item.identifier}`, item]));
      document.querySelectorAll('.ethics-card[data-standard-key]').forEach(card => {
        const standard = byKey.get(card.dataset.standardKey);
        if (!standard) throw new Error(`Missing ethics code: ${card.dataset.standardKey}`);
        const clean = portal.esc;
        card.querySelector('.ethics-identity').innerHTML = `<h3>${clean(standard.title)}</h3>
          <p class="ethics-org">${clean(standard.issuingOrganization)}</p>
          <div class="label">Classification</div><p class="ethics-value">${clean(standard.classification)}</p>
          <div class="label">Citation</div><p class="ethics-citation">${clean(standard.citation)}</p>`;
        if (standard.language) {
          card.querySelector('.ethics-summary').insertAdjacentHTML('afterend',
            `<p class="ethics-language">Official document language: ${clean(standard.language)}</p>`);
        }
        const standardsUrl = `standards-and-codes.html?organization=${encodeURIComponent(standard.organization)}&standard=${encodeURIComponent(standard.identifier)}`;
        card.querySelector('.ethics-actions').innerHTML = `
          <a class="btn primary" href="${clean(standard.documentUrl)}" target="_blank" rel="noopener" aria-label="View packaged document for ${clean(standard.title)} (PDF, opens in a new tab)">View Document <span class="file-type">PDF</span></a>
          <a class="btn" href="${clean(standard.officialUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Open official source for ${clean(standard.title)} (opens in a new tab)">Official ${clean(standard.organization)} Source <span aria-hidden="true">&#8599;</span></a>
          <a class="btn" href="${standardsUrl}">View in Standards &amp; Codes</a>`;
      });
    } catch (error) {
      document.querySelectorAll('.ethics-identity').forEach(element => {
        element.innerHTML = '<p class="alert">The ethics code details could not be loaded.</p>';
      });
      console.error('Failed to load ethics codes:', error);
    }
    try {
      const [plan, curriculum] = await Promise.all([
        portal.loadJSON('../data/ee-assessment.json'),
        portal.loadJSON('../data/ee_curriculum.json')
      ]);
      const terms = plan.roadmap.flatMap(year => year.semesters.map(semester => ({...semester, academic_year: year.academic_year})));
      const courseTitles = new Map((curriculum.curriculum?.courses || []).map(course => [course.course_code.replace(/\s+/g, '').toUpperCase(), course.course_title]));
      const statusPill = (so, status) => `<span class="status status-${status.toLowerCase().replace('/', '')}">${portal.esc(so)} · ${portal.esc(status)}</span>`;
      const renderTerm = term => {
        const activeSos = Object.entries(term.statuses).filter(([, status]) => status === 'A').map(([so]) => so);
        const selected = new Map();
        activeSos.forEach(so => (plan.so_course_selection[so] || []).forEach(code => {
          if (!selected.has(code)) selected.set(code, []);
          selected.get(code).push(so);
        }));
        const rows = [...selected].map(([code, sos]) => `<tr><td class="code">${portal.esc(code)}</td><td>${portal.esc(courseTitles.get(code.replace(/\s+/g, '').toUpperCase()) || 'Title not available')}</td><td>${sos.map(so => portal.badge(so)).join('')}</td></tr>`).join('');
        byId('activeTermSummary').innerHTML = `<h3>${portal.esc(term.academic_year)} · ${portal.esc(term.term)}</h3><div class="muted">SOs Under Assessment</div><div class="status-list">${activeSos.map(so => statusPill(so, 'A')).join('') || '<span class="muted">No SOs are in active assessment.</span>'}</div>`;
        byId('assessmentCoursesBody').innerHTML = rows || '<tr><td colspan="3" class="muted">No courses are selected for active assessment in this term.</td></tr>';
      };
      root.innerHTML = `<div class="assessment-toolbar"><label for="assessmentTerm">Assessment semester<select id="assessmentTerm">${terms.map(term => `<option value="${portal.esc(term.term)}"${term.term === plan.active_term ? ' selected' : ''}>${portal.esc(term.academic_year)} · ${portal.esc(term.term)}</option>`).join('')}</select></label><span class="muted">A = Assess · E = Evaluate · C = Change</span></div><div id="activeTermSummary" class="term-summary"></div><div class="assessment-courses"><h3>Courses Under Assessment</h3><div class="table-wrap"><table><thead><tr><th>Course</th><th>Course Title</th><th>SO(s) Under Assessment</th></tr></thead><tbody id="assessmentCoursesBody"></tbody></table></div></div><h3 class="space-top-22">Assessment Roadmap</h3><div class="roadmap-grid">${plan.roadmap.map(year => `<article class="roadmap-year"><h3>AY ${portal.esc(year.academic_year)}</h3>${year.semesters.map(semester => `<div class="roadmap-term"><strong>${portal.esc(semester.term)}</strong><div class="status-list">${Object.entries(semester.statuses).map(([so,status]) => statusPill(so,status)).join('')}</div></div>`).join('')}</article>`).join('')}</div><div class="grid three assessment-meta"><article class="card"><div class="stat">${portal.esc(plan.targets.direct_assessment_percent)}%</div><div class="label">Direct target</div></article><article class="card"><div class="stat">${portal.esc(plan.targets.indirect_assessment_percent)}%</div><div class="label">Indirect target</div></article><article class="card"><div class="stat-text-size stat">${portal.esc(plan.targets.indirect_assessment_method)}</div><div class="label">Indirect method</div></article></div>`;
      const select = byId('assessmentTerm');
      select.addEventListener('change', () => renderTerm(terms.find(term => term.term === select.value)));
      renderTerm(terms.find(term => term.term === plan.active_term) || terms[0]);
    } catch (error) {
      root.innerHTML = `<p class="assessment-error">The program assessment plan could not be loaded.</p>`;
      console.error('Failed to load program assessment plan:', error);
    }
  });
