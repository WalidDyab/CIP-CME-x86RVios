document.addEventListener('DOMContentLoaded', async () => {
      try {
        const data = await portal.loadJSON('../data/ee_curriculum.json');
        const courses = data.curriculum?.courses || [];
        const outcomeDefinitions = data.abet?.student_outcomes || {};
        const piDefinitions = data.abet?.performance_indicators || {};
        const outcomes = Object.entries(outcomeDefinitions).map(([soCode, definition]) => ({ soCode, ...definition }));
        const select = byId('soSelect');
        const search = byId('search');
        const info = byId('soInfo');
        const reviewButton = byId('soMappingReviewOpen');
        window.soMappingReviewContext = { courses, abet: data.abet || {} };
        const definitionAttrs = (code, statement) => `title="${portal.esc(statement || '')}" tabindex="0" aria-label="${portal.esc(`${code}: ${statement || ''}`)}"`;
        const piBadge = piCode => `<span class="pill" ${definitionAttrs(piCode, piDefinitions[piCode]?.statement)}>${portal.esc(piCode)}</span>`;
        select.innerHTML = outcomes.map(outcome => `<option value="${portal.esc(outcome.soCode)}">${portal.esc(outcome.soCode)}</option>`).join('');

        function renderSOReference() {
          const outcome = outcomes.find(item => item.soCode === select.value) || outcomes[0];
          if (!outcome) { info.innerHTML = ''; return; }
          const pis = outcome.pis || [];
          info.innerHTML = `<div class="so-reference"><div class="so-reference-code" ${definitionAttrs(outcome.soCode, outcome.statement)}>${portal.esc(outcome.soCode)}</div><p>${portal.esc(outcome.statement || '')}</p><div class="so-reference-label">Performance Indicators</div><ul>${pis.map(piCode => `<li><span class="code" ${definitionAttrs(piCode, piDefinitions[piCode]?.statement)}>${portal.esc(piCode)}</span><span>${portal.esc(piDefinitions[piCode]?.statement || '')}</span></li>`).join('')}</ul></div>`;
        }

        function render() {
          const so = select.value || outcomes[0]?.soCode;
          const query = (search.value || '').toLowerCase();
          const outcome = outcomes.find(item => item.soCode === so);
          const expectedPIs = outcome?.pis || [];
          const reviewEnabled = Boolean(outcome && expectedPIs.length);
          reviewButton.hidden = !reviewEnabled;
          reviewButton.textContent = reviewEnabled ? `Review ${so} Mapping` : '';
          const rows = [];
          courses.forEach(course => (course.clos || []).forEach(clo => {
            if ((clo.mapped_sos || []).includes(so)) {
              const searchable = [course.course_code, course.course_title, clo.clo_text, (clo.pi_codes || []).join(' ')].join(' ').toLowerCase();
              if (!query || searchable.includes(query)) rows.push({ course, clo });
            }
          }));
          const covered = new Set(rows.flatMap(row => row.clo.pi_codes || []).filter(pi => expectedPIs.includes(pi)));
          renderSOReference();
          portal.renderStats(byId('stats'), { 'Mapped courses':new Set(rows.map(row => row.course.course_code)).size, 'Mapped CLOs':rows.length, 'Expected PIs':expectedPIs.length, 'Covered PIs':covered.size });
          byId('evidence').innerHTML = `<div class="table-wrap"><table><thead><tr><th>Course</th><th>CLO</th><th>PI</th><th>Assessment</th></tr></thead><tbody>${rows.map(row => `<tr><td><a href="course-dashboard.html?course=${encodeURIComponent(row.course.course_code)}"><span class="code">${portal.esc(row.course.course_code)}</span><br>${portal.esc(row.course.course_title)}</a></td><td>${portal.esc(row.clo.clo_text)}</td><td>${(row.clo.pi_codes || []).map(piBadge).join('')}</td><td>${portal.esc(portal.listText(row.clo.assessment_methods))}</td></tr>`).join('')}</tbody></table></div>`;
        }
        select.onchange = render;
        reviewButton.onclick = () => window.dispatchEvent(new CustomEvent('open-so-mapping-review', { detail: { so: select.value } }));
        search.oninput = render;
        render();
      } catch (error) {
        console.error(error);
        byId('evidence').innerHTML = '<div class="alert">Could not load outcome information.</div>';
      }
    });
