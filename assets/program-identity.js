document.addEventListener('DOMContentLoaded', async () => {
  const mission = document.getElementById('program-mission');
  const peos = document.getElementById('program-peos');
  const outcomes = document.getElementById('program-sos');
  if (!mission || !peos || !outcomes) return;
  const renderStatements = (target, entries) => {
    const fragment = document.createDocumentFragment();
    for (const [id, statement] of entries) {
      const card = document.createElement('article');
      card.className = 'statement-card';
      const term = document.createElement('span');
      term.className = 'statement-badge';
      term.textContent = id.replace(/(\D+)(\d+)/, '$1 $2');
      card.setAttribute('aria-label', term.textContent);
      const description = document.createElement('div');
      description.className = 'statement-copy';
      const separatorAt = target === peos ? statement.indexOf('- ') : -1;
      if (separatorAt !== -1) {
        const title = document.createElement('h3');
        title.textContent = statement.slice(0, separatorAt);
        // Retain all source characters while separating the title visually.
        const separator = document.createElement('span');
        separator.className = 'statement-separator';
        separator.textContent = '- ';
        title.append(separator);
        const body = document.createElement('p');
        body.textContent = statement.slice(separatorAt + 2);
        description.append(title, body);
      } else {
        const body = document.createElement('p');
        body.textContent = statement;
        description.append(body);
      }
      card.append(term, description);
      fragment.append(card);
    }
    target.replaceChildren(fragment);
  };
  try {
    const data = await portal.loadJSON('../data/ee_curriculum.json');
    const identity = data.program_identity;
    const peoEntries = Object.entries(identity?.educational_objectives || {});
    const soEntries = Object.entries(data.abet?.student_outcomes || {}).map(([id, value]) => [id, value.statement]);
    if (!identity?.mission || !peoEntries.length || soEntries.length !== 7 || [...peoEntries, ...soEntries].some(([, value]) => typeof value !== 'string' || !value)) throw new Error('Program statements are missing or incomplete.');
    mission.textContent = identity.mission;
    renderStatements(peos, peoEntries);
    renderStatements(outcomes, soEntries);
  } catch (error) {
    console.error('Could not load program statements:', error);
    mission.textContent = 'Program statements could not be loaded. Please reload the page.';
    renderStatements(peos, [['PEOs', 'Program educational objectives are temporarily unavailable.']]);
    renderStatements(outcomes, [['SOs', 'Student outcomes are temporarily unavailable.']]);
  }
});
