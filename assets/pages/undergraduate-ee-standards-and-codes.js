document.addEventListener('DOMContentLoaded', async () => {
  const elements = {
    course: byId('standardsCourse'), organization: byId('standardsOrganization'),
    priority: byId('standardsPriority'), access: byId('standardsAccess'),
    search: byId('standardsSearch'), count: byId('standardsCount'),
    results: byId('standardsResults')
  };
  const rank = { Core: 0, Useful: 1, Advanced: 2 };
  try {
    const { standards } = await portal.loadJSON('../data/ee-standards.json');
    const organizations = new Set(standards.map(standard => standard.organization));
    [...organizations].sort().forEach(organization => {
      const option = document.createElement('option');
      option.value = organization;
      option.textContent = organization;
      elements.organization.append(option);
    });
    const courses = new Map();
    standards.forEach(standard => standard.courses.forEach(mapping => {
      courses.set(mapping.courseCode, mapping.courseTitle);
    }));
    [...courses].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
      .forEach(([code, title]) => {
        const option = document.createElement('option');
        option.value = code;
        option.textContent = `${code} — ${title}`;
        elements.course.append(option);
      });
    const requestedCourse = portal.getParam('course');
    if (courses.has(requestedCourse)) elements.course.value = requestedCourse;
    const requestedOrganization = portal.getParam('organization');
    if (organizations.has(requestedOrganization)) elements.organization.value = requestedOrganization;
    const requestedStandard = portal.getParam('standard');
    if (requestedStandard) elements.search.value = requestedStandard;

    function render() {
      const query = elements.search.value.trim().toLocaleLowerCase();
      const groups = new Map();
      standards.forEach(standard => {
        if (elements.organization.value && standard.organization !== elements.organization.value) return;
        if (elements.access.value === 'free' && !standard.accessType.startsWith('Free')) return;
        if (elements.access.value === 'subscription' && standard.accessType !== 'Subscription / purchase') return;
        standard.courses.forEach(mapping => {
          if (elements.course.value && mapping.courseCode !== elements.course.value) return;
          if (elements.priority.value && mapping.priority !== elements.priority.value) return;
          const searchable = [standard.identifier, standard.title, mapping.courseCode,
            mapping.courseTitle, mapping.teachingUse].join(' ').toLocaleLowerCase();
          if (query && !searchable.includes(query)) return;
          if (!groups.has(mapping.courseCode)) groups.set(mapping.courseCode, []);
          groups.get(mapping.courseCode).push({ standard, mapping });
        });
      });
      const total = [...groups.values()].reduce((sum, items) => sum + items.length, 0);
      elements.count.textContent = `${total} course–standard ${total === 1 ? 'match' : 'matches'} across ${groups.size} ${groups.size === 1 ? 'course' : 'courses'}`;
      if (!total) {
        elements.results.innerHTML = '<p class="alert">No standards match these filters.</p>';
        return;
      }
      elements.results.innerHTML = [...groups].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
        .map(([code, items]) => {
          items.sort((a, b) => rank[a.mapping.priority] - rank[b.mapping.priority]
            || a.standard.organization.localeCompare(b.standard.organization)
            || a.standard.identifier.localeCompare(b.standard.identifier, undefined, { numeric: true }));
          const cards = items.map(({ standard, mapping }) => {
            const accessClass = standard.accessType.startsWith('Free') ? 'access-free' : 'access-subscription';
            const accessNote = standard.getUrl
              ? '<span class="standards-access-note">Available at no cost through IEEE GET</span>' : '';
            const getLink = standard.getUrl
              ? `<a href="${portal.esc(standard.getUrl)}" target="_blank" rel="noopener noreferrer" aria-label="IEEE GET access for ${portal.esc(standard.identifier)} (opens in a new tab)">IEEE GET access</a>` : '';
            const documentLink = standard.documentUrl
              ? `<a class="btn" href="${portal.esc(standard.documentUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Open packaged PDF for ${portal.esc(standard.title)} (opens in a new tab)">View packaged PDF</a>` : '';
            return `<article class="standard-card">
              <div class="standard-card-top"><span class="standard-org">${portal.esc(standard.organization)}</span><strong class="standard-id">${portal.esc(standard.identifier)}</strong><span class="standard-priority">${portal.esc(mapping.priority)}</span><span class="standard-access ${accessClass}">${portal.esc(standard.accessType)}</span></div>
              <h4>${portal.esc(standard.title)}</h4>
              ${standard.issuingOrganization ? `<p class="standard-issuer">${portal.esc(standard.issuingOrganization)}</p>` : ''}
              <p class="standard-use"><strong>Teaching use:</strong> ${portal.esc(mapping.teachingUse)}</p>
              ${accessNote}<div class="standard-links"><a class="btn" href="${portal.esc(standard.officialUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Open official source for ${portal.esc(standard.organization)} ${portal.esc(standard.identifier)} (opens in a new tab)">Open official source</a>${documentLink}${getLink}</div>
            </article>`;
          }).join('');
          return `<section class="standards-course" aria-label="${portal.esc(code)} ${portal.esc(courses.get(code))}"><div class="standards-course-heading"><div><span class="code">${portal.esc(code)}</span><h3>${portal.esc(courses.get(code))}</h3></div><span class="pill">${items.length} ${items.length === 1 ? 'standard' : 'standards'}</span></div><div class="standards-card-list">${cards}</div></section>`;
        }).join('');
    }
    [elements.course, elements.organization, elements.priority, elements.access].forEach(control => control.addEventListener('change', render));
    elements.search.addEventListener('input', render);
    render();
  } catch (error) {
    elements.count.textContent = 'Standards unavailable';
    elements.results.innerHTML = '<p class="alert">The standards inventory could not be loaded.</p>';
    console.error('Could not load standards inventory:', error);
  }
});
