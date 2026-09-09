document.addEventListener('DOMContentLoaded', async () => {
      const data = await portal.loadJSON('../data/ee_curriculum.json');
      const rows = (data.curriculum.courses || []).flatMap(course => (course.clos || []).map(clo => ({course, clo})));
      const list = values => `<ul class="method-list">${(values || []).map(value => `<li>${portal.esc(value)}</li>`).join('')}</ul>`;
      const render = () => {
        const query = (byId('search').value || '').toLowerCase();
        const filtered = rows.filter(({course, clo}) => !query || [course.course_code, course.course_title, clo.clo_number, clo.clo_text, ...(clo.mapped_sos || []), ...(clo.pi_codes || []), ...(clo.teaching_strategy || []), ...(clo.assessment_methods || [])].join(' ').toLowerCase().includes(query));
        byId('count').textContent = `${filtered.length} of ${rows.length} CLOs`;
        byId('review').innerHTML = `<div class="table-wrap"><table class="review-table"><thead><tr><th>Course</th><th>CLO ID</th><th>CLO Wording</th><th>SOs</th><th>PIs</th><th>Teaching Strategies</th><th>Assessment Methods</th></tr></thead><tbody>${filtered.map(({course, clo}) => `<tr><td><span class="code">${portal.esc(course.course_code)}</span><br>${portal.esc(course.course_title)}</td><td class="code">${portal.esc(clo.clo_number)}</td><td>${portal.esc(clo.clo_text)}</td><td>${(clo.mapped_sos || []).map(portal.badge).join('')}</td><td>${(clo.pi_codes || []).map(portal.badge).join('')}</td><td>${list(clo.teaching_strategy)}</td><td>${list(clo.assessment_methods)}</td></tr>`).join('')}</tbody></table></div>`;
      };
      byId('search').addEventListener('input', render);
      render();
    });
