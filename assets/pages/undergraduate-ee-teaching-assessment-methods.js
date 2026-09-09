document.addEventListener('DOMContentLoaded', async () => {
    const root = byId('assessmentPlan');
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
