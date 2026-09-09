/* Prerequisite Flow section on the EE Program Overview page.
 *
 * Every academic value rendered here is read from data/ee_program_structure.json:
 * the eight-semester placement, course codes, titles, credits, requirement
 * categories, prerequisite course codes, broad (non-course) prerequisite
 * conditions, corequisites, and the elective selection rule. No relationship is
 * hard-coded in this file — the graph is built from the recorded data, and any
 * prerequisite that cannot be resolved is reported rather than invented.
 *
 * It runs independently of the page's inline script and of program-structure.js,
 * so a data or rendering failure here cannot affect the program structure, the
 * heatmaps, the textbook/reference tools, or the course browser.
 */
document.addEventListener('DOMContentLoaded', async () => {
  const host = document.getElementById('prerequisite-flow-body');
  if (!host) return;

  const SVG_NS = 'http://www.w3.org/2000/svg';

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  };

  const svgEl = (tag, className) => {
    const node = document.createElementNS(SVG_NS, tag);
    if (className) node.setAttribute('class', className);
    return node;
  };

  const failure = message => {
    host.replaceChildren(el('div', 'alert', message));
  };

  const num = value => (Number.isFinite(Number(value)) ? Number(value) : 0);
  const str = value => String(value ?? '').trim();

  /* Short presentation labels for the requirement categories declared in the
     data. These are display abbreviations only — the category identity, its
     full name, and its membership all come from the JSON. Category is never
     signalled by colour alone: every node carries this tag, and the full
     category name is exposed to assistive technology. */
  const CATEGORY_TAGS = {
    university_requirements: 'UNI',
    college_requirements: 'COL',
    program_core_requirements: 'CORE',
    program_elective_requirements: 'ELEC',
    capstone_project: 'CAP',
    field_experience: 'FLD'
  };
  const tagFor = (categoryId, categoryName) => CATEGORY_TAGS[categoryId] ||
    str(categoryName || categoryId).replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase() || 'REQ';

  /* "Completion of 90 credit hours" -> "90+ credits" for the compact node badge.
     The recorded wording is kept for the tooltip, the detail panel, and the
     assistive-technology text; only the badge is shortened. */
  const shortCondition = condition => {
    const match = str(condition).match(/(\d+)\s*credit/i);
    return match ? `${match[1]}+ credits` : str(condition);
  };

  /* "MATH 113", "MATH113" and "Math 113" all name the same course. Codes are
     compared in this normalized form; the recorded spelling is what gets
     displayed. */
  const normalizeCode = code => str(code).replace(/\s+/g, '').toUpperCase();

  /* The canonical curriculum file is the course-level source that
     course-dashboard.html reads. It is used here for two things only: deciding
     which codes can safely be linked, and reading the eligibility rule the
     approved electives record for themselves. */
  const loadCurriculumCourses = async () => {
    try {
      const curriculum = await portal.loadJSON('../data/ee_curriculum.json');
      const courses = curriculum?.curriculum?.courses;
      if (!Array.isArray(courses)) return new Map();
      return new Map(courses
        .filter(course => course.course_code)
        .map(course => [normalizeCode(course.course_code), course]));
    } catch {
      return new Map(); // Degrade to plain text rather than risk a broken link.
    }
  };

  try {
    const [data, curriculumByCode] = await Promise.all([
      portal.loadJSON('../data/ee_program_structure.json'),
      loadCurriculumCourses()
    ]);

    // A course code is only linked when it exists in the canonical curriculum
    // file, so no broken link can be produced for university or college courses.
    const linkableCodes = new Set(curriculumByCode.keys());

    const requirementCategories = data?.requirement_categories;
    const studyPlan = data?.study_plan;
    if (!Array.isArray(requirementCategories) || !requirementCategories.length ||
        !Array.isArray(studyPlan) || !studyPlan.length) {
      throw new Error('ee_program_structure.json is missing the requirement categories or the study plan.');
    }

    // -------------------------------------------------------------- Model ---
    const catalogue = new Map();
    const categoryById = new Map(requirementCategories.map(category => [category.category_id, category]));
    let electiveCategory = null;
    for (const category of requirementCategories) {
      if (category.selection_rule) electiveCategory = category;
      for (const course of category.courses || []) {
        const code = str(course.course_code);
        if (!code || catalogue.has(code)) continue;
        catalogue.set(code, {
          record: course,
          categoryId: category.category_id,
          categoryName: category.category_name || category.brochure_heading || category.category_id
        });
      }
    }

    /* The two study-plan elective slots stand for "any approved technical
       elective", so they carry no prerequisite record of their own. Every
       approved elective states its own eligibility rule in the canonical
       curriculum file; that rule is adopted for the slots only when it is a
       non-course condition and the whole approved list states it identically.
       Nothing is assumed if the list disagrees or a course is missing. */
    const electiveEligibility = (() => {
      const courses = electiveCategory?.courses || [];
      if (!courses.length) return '';
      const stated = new Set();
      for (const course of courses) {
        const record = curriculumByCode.get(normalizeCode(course.course_code));
        if (!record) return '';
        // A recorded course prerequisite is a relationship, not a condition.
        if (Array.isArray(record.prerequisites) && record.prerequisites.length) return '';
        const wording = str(record.prerequisite_text);
        if (!wording || wording === '-') return '';
        stated.add(wording);
      }
      return stated.size === 1 ? [...stated][0] : '';
    })();

    // Study-plan placement drives the chronology: one column per semester.
    const columns = [];
    for (const year of studyPlan) {
      for (const semester of year.semesters || []) {
        columns.push({
          year: year.year,
          label: str(semester.semester),
          statedTotal: semester.brochure_semester_total,
          entries: semester.courses || []
        });
      }
    }

    const nodes = [];
    const nodeByCode = new Map();
    columns.forEach((column, col) => {
      for (const entry of column.entries) {
        const code = str(entry.course_code);
        if (!code || nodeByCode.has(code)) continue;
        const catalogued = catalogue.get(code);
        const record = catalogued?.record || {};
        const categoryId = entry.elective_category_id || catalogued?.categoryId || '';
        const categoryName = catalogued?.categoryName ||
          categoryById.get(categoryId)?.category_name || '';
        const prerequisiteText = str(record.prerequisite_text);
        const node = {
          code,
          displayCode: str(entry.display_code || record.display_code || code),
          title: str(entry.course_title || record.course_title),
          credits: num(entry.credit_hours ?? record.credits),
          categoryId,
          categoryName,
          isPlaceholder: entry.is_elective_placeholder === true,
          year: column.year,
          semesterLabel: column.label,
          col,
          row: 0,
          prerequisiteText: prerequisiteText === '-' ? '' : prerequisiteText,
          prerequisites: Array.isArray(record.prerequisites) ? record.prerequisites.map(str).filter(Boolean) : [],
          conditions: Array.isArray(record.prerequisite_conditions) ? record.prerequisite_conditions.map(str).filter(Boolean) : [],
          corequisiteText: str(record.corequisite_text),
          corequisites: Array.isArray(record.corequisites) ? record.corequisites.map(str).filter(Boolean) : [],
          incoming: [],
          outgoing: []
        };
        // The slot inherits the approved list's shared eligibility rule. It is a
        // condition, never a prerequisite code, so it can add no connector.
        if (node.isPlaceholder && electiveEligibility) {
          node.conditions = [electiveEligibility];
          node.prerequisiteText = electiveEligibility;
        }
        nodes.push(node);
        nodeByCode.set(code, node);
      }
    });

    // -------------------------------------------------------------- Edges ---
    // A connector is drawn only where the data records an actual course code,
    // that code resolves to a course placed in the study plan, and the edge is
    // neither a self-loop nor a duplicate. Broad conditions such as "Completion
    // of 90 credit hours" are never turned into edges.
    const edges = [];
    const seenEdges = new Set();
    const issues = [];
    const unresolved = [];

    const addEdge = (fromCode, toCode, kind) => {
      if (fromCode === toCode) {
        issues.push(`${toCode} lists itself as a ${kind === 'coreq' ? 'co-requisite' : 'prerequisite'}.`);
        return true;
      }
      const from = nodeByCode.get(fromCode);
      const to = nodeByCode.get(toCode);
      if (!from || !to) return false;
      const key = `${kind}:${fromCode}>${toCode}`;
      if (seenEdges.has(key)) return true;
      seenEdges.add(key);
      const edge = { from, to, kind };
      edges.push(edge);
      if (kind === 'prereq') {
        to.incoming.push(edge);
        from.outgoing.push(edge);
        if (from.col >= to.col) {
          issues.push(`${from.displayCode} is a prerequisite of ${to.displayCode} but is not placed in an earlier semester.`);
        }
      }
      return true;
    };

    for (const node of nodes) {
      for (const code of node.prerequisites) {
        if (!addEdge(code, node.code, 'prereq')) {
          unresolved.push({ course: node.displayCode, code, inCatalogue: catalogue.has(code), kind: 'prerequisite' });
        }
      }
      for (const code of node.corequisites) {
        if (!addEdge(code, node.code, 'coreq')) {
          unresolved.push({ course: node.displayCode, code, inCatalogue: catalogue.has(code), kind: 'co-requisite' });
        }
      }
    }

    for (const item of unresolved) {
      issues.push(`${item.course}: ${item.kind} "${item.code}" is not placed in the study plan` +
        `${item.inCatalogue ? ' (it is listed in a requirement category)' : ''}.`);
    }
    if (issues.length) {
      console.warn('[prerequisite-flow] Some recorded relationships could not be drawn as connectors:\n- ' + issues.join('\n- '));
    }

    const prereqEdges = edges.filter(edge => edge.kind === 'prereq');

    // -------------------------------------------------------- Row ordering ---
    // Courses keep their semester; only their vertical order inside a semester
    // is chosen, by an iterated barycentre sweep seeded with the study-plan
    // order, to reduce connector crossings. Courses with no recorded
    // relationship keep their study-plan position, which leaves the general
    // university requirements as a calm band above the technical chain.
    const order = columns.map((column, col) => nodes.filter(node => node.col === col));
    const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
    const sweep = (index, forward) => {
      const current = order[index];
      const reference = order[forward ? index - 1 : index + 1];
      if (!reference || !current.length) return;
      const position = new Map(reference.map((node, at) => [node, at]));
      const base = new Map(current.map((node, at) => [node, at]));
      const scores = new Map(current.map(node => {
        const linked = (forward ? node.incoming : node.outgoing)
          .map(edge => position.get(forward ? edge.from : edge.to))
          .filter(value => value !== undefined);
        return [node, linked.length ? mean(linked) : base.get(node)];
      }));
      current.sort((a, b) => (scores.get(a) - scores.get(b)) || (base.get(a) - base.get(b)));
    };
    for (let pass = 0; pass < 8; pass += 1) {
      if (pass % 2 === 0) for (let i = 1; i < order.length; i += 1) sweep(i, true);
      else for (let i = order.length - 2; i >= 0; i -= 1) sweep(i, false);
    }
    order.forEach(column => column.forEach((node, row) => { node.row = row; }));

    // ---------------------------------------------------- Derived helpers ---
    const reachable = (start, direction) => {
      const found = new Set();
      const queue = [start];
      while (queue.length) {
        const node = queue.shift();
        for (const edge of direction === 'up' ? node.incoming : node.outgoing) {
          const next = direction === 'up' ? edge.from : edge.to;
          if (found.has(next) || next === start) continue;
          found.add(next);
          queue.push(next);
        }
      }
      return found;
    };

    /* Connector-display policy.
     *
     * Arrows are an optional reading aid, not the record of the curriculum.
     * The relationships themselves are always carried by the node highlighting,
     * the relationship badge, and the details panel, so an arrow is drawn only
     * where it makes a relationship easier to follow and is dropped wherever it
     * would add clutter. Nothing is hidden by dropping one: the same
     * relationship is still stated in at least three other places.
     *
     * Two cheap tests decide, applied to a whole group of arrows at once —
     * either every arrow into (or out of) the selected course is drawn or none
     * of them is. Drawing only the readable subset would be the one genuinely
     * misleading option, because two arrows out of a course that unlocks four
     * would read as "this unlocks two".
     */
    const CONNECTOR_MAX_GROUP = 3;  // More than three at one node reads as a fan.
    const CONNECTOR_MAX_SPAN = 2;   // Columns an arrow may cross before it is lost behind cards.
    const connectorsReadable = group => group.length > 0 &&
      group.length <= CONNECTOR_MAX_GROUP &&
      group.every(edge => Math.abs(edge.to.col - edge.from.col) <= CONNECTOR_MAX_SPAN);

    const GATEWAY_MINIMUM = 3; // Presentation threshold for the "unlocks" badge.
    const gateways = nodes.filter(node => node.outgoing.length >= GATEWAY_MINIMUM)
      .sort((a, b) => b.outgoing.length - a.outgoing.length || a.col - b.col);

    // ------------------------------------------------------------ Legend ----
    const fragment = document.createDocumentFragment();
    const legend = el('div', 'pf-legend');

    const categoryLegend = el('ul', 'pf-legend-list');
    categoryLegend.setAttribute('aria-label', 'Requirement categories');
    for (const category of requirementCategories) {
      if (!nodes.some(node => node.categoryId === category.category_id)) continue;
      const item = el('li');
      item.dataset.category = category.category_id;
      const swatch = el('span', 'pf-swatch');
      swatch.setAttribute('aria-hidden', 'true');
      item.append(swatch);
      item.append(el('span', 'pf-tag', tagFor(category.category_id, category.category_name)));
      item.append(el('span', 'pf-legend-name', category.category_name || category.category_id));
      categoryLegend.append(item);
    }
    legend.append(categoryLegend);

    const keyList = el('ul', 'pf-legend-list pf-key');
    keyList.setAttribute('aria-label', 'How to read the flow');
    const addKey = (markClass, label) => {
      const item = el('li');
      const mark = el('span', `pf-key-mark ${markClass}`);
      mark.setAttribute('aria-hidden', 'true');
      item.append(mark);
      item.append(el('span', 'pf-legend-name', label));
      keyList.append(item);
    };
    addKey('pf-key-up', 'Direct prerequisite of the selected course');
    addKey('pf-key-down', 'Course the selected course directly unlocks');
    addKey('pf-key-coreq', 'Co-requisite — taken in the same semester');
    addKey('pf-key-cond', 'Credit-hour condition — a completion rule, not a course');
    addKey('pf-key-slot', 'Elective slot — filled by any approved technical elective');
    legend.append(keyList);
    fragment.append(legend);

    // ------------------------------------------------------ Detail panel ----
    const panel = el('div', 'pf-panel');
    const panelBody = el('div', 'pf-panel-body');
    panelBody.setAttribute('aria-live', 'polite');
    panel.append(panelBody);
    fragment.append(panel);

    // ------------------------------------------------------------- Graph ----
    const scroll = el('div', 'pf-scroll');
    const grid = el('div', 'pf-grid');
    // Numeric, data-derived CSSOM properties preserve the unbounded grid layout.
    // Direct property writes are permitted by CSP; do not replace with style text.
    grid.style.setProperty('--pf-cols', String(columns.length));
    grid.setAttribute('role', 'group');
    grid.setAttribute('aria-label',
      `Prerequisite flow across the ${columns.length} semesters of the study plan. Use the arrow keys to move between courses and Enter to trace one.`);

    const svg = svgEl('svg', 'pf-svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    grid.append(svg);

    // Node builder ---------------------------------------------------------
    const buildNode = node => {
      const button = el('button', 'pf-node');
      button.type = 'button';
      button.dataset.code = node.code;
      button.dataset.category = node.categoryId;
      button.style.gridColumn = String(node.col + 1);
      button.style.gridRow = String(node.row + 3);
      button.setAttribute('aria-pressed', 'false');
      button.tabIndex = -1;
      if (node.isPlaceholder) button.classList.add('is-slot');
      if (node.title) button.title = `${node.displayCode} — ${node.title}`;

      const top = el('span', 'pf-node-top');
      top.append(el('span', 'pf-code', node.displayCode));
      const tag = el('span', 'pf-tag', tagFor(node.categoryId, node.categoryName));
      tag.setAttribute('aria-hidden', 'true');
      top.append(tag);
      button.append(top);

      button.append(el('span', 'pf-node-title', node.title));

      const meta = el('span', 'pf-node-meta');
      meta.append(el('span', 'pf-cr', `${node.credits} cr`));
      for (const condition of node.conditions) {
        const badge = el('span', 'pf-cond', shortCondition(condition));
        badge.title = condition;
        meta.append(badge);
      }
      if (node.outgoing.length >= GATEWAY_MINIMUM) {
        const gate = el('span', 'pf-gate', `Unlocks ${node.outgoing.length}`);
        gate.title = `${node.displayCode} is a prerequisite for ${node.outgoing.length} later courses.`;
        meta.append(gate);
      }
      button.append(meta);

      // Text equivalent of the connectors, in both directions. It is read by
      // assistive technology at every screen size and becomes visible in the
      // stacked mobile layout, so the drawn lines are never the only source of
      // this information.
      const relations = el('span', 'pf-rel');
      const before = [];
      if (node.isPlaceholder) {
        before.push('Elective slot — choose an approved technical elective');
        for (const condition of node.conditions) before.push(condition);
      } else {
        const resolved = node.incoming
          .slice()
          .sort((a, b) => a.from.col - b.from.col || a.from.row - b.from.row)
          .map(edge => edge.from.displayCode);
        if (resolved.length) before.push(`Requires ${resolved.join(', ')}`);
        for (const condition of node.conditions) before.push(condition);
        if (node.corequisites.length) {
          before.push(`Co-requisite ${node.corequisites.map(code => nodeByCode.get(code)?.displayCode || code).join(', ')}`);
        }
        if (!before.length) before.push('No prerequisite');
      }
      relations.append(el('span', 'pf-rel-line', before.join(' · ')));
      if (node.outgoing.length) {
        const unlocked = node.outgoing
          .slice()
          .sort((a, b) => a.to.col - b.to.col || a.to.row - b.to.row)
          .map(edge => edge.to.displayCode);
        relations.append(el('span', 'pf-rel-line pf-rel-next', `Unlocks ${unlocked.join(', ')}`));
      }
      button.append(relations);

      button.append(el('span', 'pf-sr',
        ` ${node.categoryName || 'Course'}. Year ${node.year}, ${node.semesterLabel}. ${node.credits} credits.`));

      const marker = el('span', 'pf-reltag');
      marker.hidden = true;
      button.append(marker);

      node.element = button;
      return button;
    };

    // The DOM order is year, semester, then the courses of that semester, so the
    // stacked mobile layout and the screen-reader reading order both follow the
    // curriculum. The grid places each node in its semester column visually.
    let cursor = 0;
    for (const year of studyPlan) {
      const yearSemesters = year.semesters || [];
      if (!yearSemesters.length) continue;
      const yearCredits = yearSemesters.reduce((sum, semester) =>
        sum + (semester.courses || []).reduce((inner, course) => inner + num(course.credit_hours), 0), 0);

      const band = el('div', 'pf-year');
      band.style.gridColumn = `${cursor + 1} / span ${yearSemesters.length}`;
      band.append(el('span', 'pf-year-name', `Year ${year.year}`));
      band.append(el('span', 'pf-year-total', `${yearCredits} cr`));
      grid.append(band);

      for (const semester of yearSemesters) {
        const column = columns[cursor];
        const computed = (semester.courses || []).reduce((sum, course) => sum + num(course.credit_hours), 0);
        const head = el('div', 'pf-sem');
        head.style.gridColumn = String(cursor + 1);
        head.append(el('span', 'pf-sem-name', column.label));
        head.append(el('span', 'pf-sem-total',
          `${typeof column.statedTotal === 'number' ? column.statedTotal : computed} cr`));
        grid.append(head);
        for (const node of order[cursor]) grid.append(buildNode(node));
        cursor += 1;
      }
    }

    scroll.append(grid);
    fragment.append(scroll);

    fragment.append(el('p', 'pf-hint',
      'Semesters run left to right, Year 1 first. On narrow screens the map stacks semester by semester and each course lists its prerequisites as text.'));

    if (unresolved.length) {
      const note = el('p', 'pf-issue');
      note.append(el('strong', null, 'Note: '));
      note.append(document.createTextNode(
        `${unresolved.length} recorded ${unresolved.length === 1 ? 'relationship' : 'relationships'} could not be placed in the study plan and ` +
        `${unresolved.length === 1 ? 'is' : 'are'} shown as text only — ` +
        unresolved.map(item => `${item.course} → ${item.code}`).join('; ') + '.'));
      fragment.append(note);
    }

    host.replaceChildren(fragment);

    // -------------------------------------------------------- Connectors ----
    const edgeLayer = svgEl('g', 'pf-edges');
    svg.append(edgeLayer);
    for (const edge of edges) {
      edge.group = svgEl('g', `pf-edge pf-edge-${edge.kind}`);
      edge.line = svgEl('path', 'pf-edge-line');
      edge.group.append(edge.line);
      if (edge.kind === 'prereq') {
        edge.head = svgEl('path', 'pf-edge-head');
        edge.group.append(edge.head);
      }
      edgeLayer.append(edge.group);
    }

    // Several connectors can meet the same node. Their endpoints are fanned out
    // across the middle of the node edge, ordered by the other endpoint's row,
    // so converging lines stay distinguishable instead of stacking up.
    const anchor = (rect, position, count) => {
      if (count <= 1) return rect.top + rect.height / 2;
      const spread = Math.min(rect.height * 0.5, 11 * (count - 1));
      return rect.top + rect.height / 2 + (position - (count - 1) / 2) * (spread / (count - 1));
    };

    const drawEdges = () => {
      const width = grid.scrollWidth;
      const height = grid.scrollHeight;
      svg.setAttribute('width', String(width));
      svg.setAttribute('height', String(height));
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

      const rects = new Map(nodes.map(node => [node, {
        left: node.element.offsetLeft,
        top: node.element.offsetTop,
        width: node.element.offsetWidth,
        height: node.element.offsetHeight
      }]));
      const rank = new Map();
      for (const node of nodes) {
        const incoming = node.incoming.slice().sort((a, b) => a.from.row - b.from.row || a.from.col - b.from.col);
        incoming.forEach((edge, at) => rank.set(`in:${edge.from.code}>${edge.to.code}`, { at, of: incoming.length }));
        const outgoing = node.outgoing.slice().sort((a, b) => a.to.row - b.to.row || a.to.col - b.to.col);
        outgoing.forEach((edge, at) => rank.set(`out:${edge.from.code}>${edge.to.code}`, { at, of: outgoing.length }));
      }

      for (const edge of edges) {
        const source = rects.get(edge.from);
        const target = rects.get(edge.to);
        if (!source || !target) continue;

        if (edge.kind === 'coreq') {
          // Same semester: routed as a soft bracket in the channel to the left
          // of the column, so it never reads as a left-to-right prerequisite.
          const sy = source.top + source.height / 2;
          const ty = target.top + target.height / 2;
          const x = Math.min(source.left, target.left) - 1;
          // The bracket stays inside the gutter to the left of the column.
          const bow = Math.min(12, Math.max(6, x - 2));
          edge.line.setAttribute('d', `M ${x} ${sy} C ${x - bow} ${sy}, ${x - bow} ${ty}, ${x} ${ty}`);
          continue;
        }

        const out = rank.get(`out:${edge.from.code}>${edge.to.code}`) || { at: 0, of: 1 };
        const into = rank.get(`in:${edge.from.code}>${edge.to.code}`) || { at: 0, of: 1 };
        const sx = source.left + source.width;
        const sy = anchor(source, out.at, out.of);
        const tx = target.left - 4;
        const ty = anchor(target, into.at, into.of);
        const reach = Math.max(26, (tx - sx) * 0.42);
        edge.line.setAttribute('d', `M ${sx} ${sy} C ${sx + reach} ${sy}, ${tx - reach} ${ty}, ${tx} ${ty}`);
        edge.head.setAttribute('d', `M ${tx} ${ty} L ${tx - 8} ${ty - 3.6} L ${tx - 8} ${ty + 3.6} Z`);
      }
    };

    const isGraphMode = () => getComputedStyle(grid).getPropertyValue('--pf-mode').trim() === 'graph';

    const refresh = () => {
      if (!isGraphMode()) {
        svg.classList.add('pf-connectors-hidden');
        return;
      }
      svg.classList.remove('pf-connectors-hidden');
      drawEdges();
    };

    // ------------------------------------------------------- Interaction ----
    let selected = null;
    let focusIndex = 0;

    const focusNode = (node, moveFocus = true) => {
      const index = nodes.indexOf(node);
      if (index < 0) return;
      nodes[focusIndex].element.tabIndex = -1;
      focusIndex = index;
      node.element.tabIndex = 0;
      if (moveFocus) {
        node.element.focus();
        node.element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    };

    const resetButton = () => {
      const button = el('button', 'btn pf-reset', 'Show full map');
      button.type = 'button';
      button.addEventListener('click', () => {
        const previous = selected;
        select(null);
        if (previous) focusNode(previous);
      });
      return button;
    };

    const chip = (label, code) => {
      if (code && nodeByCode.has(code)) {
        const button = el('button', 'pf-chip', label);
        button.type = 'button';
        button.dataset.code = code;
        return button;
      }
      return el('span', 'pf-chip is-static', label);
    };

    const metaChips = node => {
      const chips = el('div', 'pf-panel-chips');
      chips.append(el('span', 'pf-meta-chip', `Year ${node.year}`));
      chips.append(el('span', 'pf-meta-chip', node.semesterLabel));
      chips.append(el('span', 'pf-meta-chip', `${node.credits} credits`));
      if (node.categoryName) chips.append(el('span', 'pf-meta-chip', node.categoryName));
      if (!node.isPlaceholder && linkableCodes.has(normalizeCode(node.displayCode))) {
        const link = el('a', 'pf-dash', 'Open course dashboard');
        link.href = `course-dashboard.html?course=${encodeURIComponent(node.displayCode)}&layout=full`;
        chips.append(link);
      }
      return chips;
    };

    const panelHead = (node, suffix) => {
      const head = el('div', 'pf-panel-head');
      const identity = el('div', 'pf-panel-identity');
      identity.append(el('span', 'pf-panel-code', node.displayCode));
      identity.append(el('span', 'pf-panel-title', suffix ? `${node.title} — ${suffix}` : node.title));
      head.append(identity);
      head.append(resetButton());
      return head;
    };

    const panelSection = (title, className) => {
      const section = el('div', `pf-panel-section${className ? ' ' + className : ''}`);
      section.append(el('h4', null, title));
      return section;
    };

    const renderDefaultPanel = () => {
      const wrap = el('div', 'pf-panel-intro');
      wrap.append(el('p', 'pf-panel-lead',
        'Select a course to trace its prerequisite path. Its prerequisites, the whole chain behind them, and every course it unlocks are highlighted, and the rest of the map fades back. Arrows are drawn for direct links only, and only where they stay easy to follow — the highlighted courses and the details here always carry the complete relationship.'));
      const stats = el('ul', 'pf-stats');
      const addStat = (value, label) => {
        const item = el('li');
        item.append(el('b', null, value));
        item.append(el('span', null, label));
        stats.append(item);
      };
      addStat(nodes.length, nodes.length === 1 ? 'course in the plan' : 'courses in the plan');
      addStat(prereqEdges.length, 'prerequisite links');
      addStat(columns.length, 'semesters');
      addStat(gateways.length, gateways.length === 1 ? 'gateway course' : 'gateway courses');
      wrap.append(stats);
      if (gateways.length) {
        const line = el('p', 'pf-panel-note');
        line.append(el('strong', null, 'Gateways: '));
        line.append(document.createTextNode(
          gateways.map(node => `${node.displayCode} (${node.outgoing.length})`).join(', ') +
          ` — each is a direct prerequisite for that many later courses.`));
        wrap.append(line);
      }
      panelBody.replaceChildren(wrap);
    };

    const renderElectivePanel = node => {
      const wrap = document.createDocumentFragment();
      wrap.append(panelHead(node, 'elective slot'));
      wrap.append(metaChips(node));

      const section = panelSection('Approved technical electives');
      if (electiveEligibility) {
        const eligibility = el('div', 'pf-chip-row');
        eligibility.append(el('span', 'pf-chip-label', 'Eligibility'));
        const badge = el('span', 'pf-chip is-condition', electiveEligibility);
        badge.title = 'A completion requirement, not a course prerequisite.';
        eligibility.append(badge);
        section.append(eligibility);
      }
      const rule = electiveCategory?.selection_rule;
      if (rule) {
        const statement = el('p', 'pf-panel-note');
        statement.append(el('strong', null,
          `Select ${rule.courses_to_select} courses × ${rule.credits_per_course} credits = ${rule.total_credits} credits. `));
        if (rule.brochure_statement) statement.append(document.createTextNode(rule.brochure_statement));
        section.append(statement);
      }
      section.append(el('p', 'pf-panel-note',
        'This slot is filled by any one of the courses below, so no prerequisite arrow is drawn to it. Each elective carries its own recorded requirement.'));

      const list = el('ul', 'pf-elective-list');
      for (const course of electiveCategory?.courses || []) {
        const item = el('li');
        const code = str(course.display_code || course.course_code);
        if (linkableCodes.has(normalizeCode(code))) {
          const link = el('a', 'pf-elective-code', code);
          link.href = `course-dashboard.html?course=${encodeURIComponent(code)}&layout=full`;
          item.append(link);
        } else {
          item.append(el('span', 'pf-elective-code', code));
        }
        item.append(el('span', 'pf-elective-title', str(course.course_title)));
        item.append(el('span', 'pf-elective-cr', `${num(course.credits)} cr`));
        const requirement = str(course.prerequisite_text);
        if (requirement && requirement !== '-') item.append(el('span', 'pf-elective-req', requirement));
        list.append(item);
      }
      section.append(list);
      wrap.append(section);
      panelBody.replaceChildren(wrap);
    };

    const renderCoursePanel = node => {
      const wrap = document.createDocumentFragment();
      wrap.append(panelHead(node));
      wrap.append(metaChips(node));

      const grid2 = el('div', 'pf-panel-columns');

      // Prerequisites: every recorded course code is listed separately, so a
      // course with three prerequisites shows three, never a collapsed one.
      const before = panelSection('Prerequisites', 'pf-before');
      if (node.prerequisiteText) {
        before.append(el('p', 'pf-recorded', `As recorded: ${node.prerequisiteText}`));
      }
      if (node.prerequisites.length || node.conditions.length) {
        const row = el('div', 'pf-chip-row');
        for (const code of node.prerequisites) {
          const target = nodeByCode.get(code);
          row.append(chip(target ? target.displayCode : code, target ? code : ''));
        }
        for (const condition of node.conditions) {
          const badge = el('span', 'pf-chip is-condition', condition);
          badge.title = 'A completion requirement, not a course prerequisite.';
          row.append(badge);
        }
        before.append(row);
      } else {
        before.append(el('p', 'pf-panel-note', 'No prerequisite is recorded for this course.'));
      }
      if (node.corequisites.length || node.corequisiteText) {
        const row = el('div', 'pf-chip-row');
        row.append(el('span', 'pf-chip-label', 'Co-requisite'));
        if (node.corequisites.length) {
          for (const code of node.corequisites) {
            const target = nodeByCode.get(code);
            row.append(chip(target ? target.displayCode : code, target ? code : ''));
          }
        } else {
          row.append(el('span', 'pf-chip is-static', node.corequisiteText));
        }
        before.append(row);
      }
      const ancestors = [...reachable(node, 'up')].filter(item => !node.incoming.some(edge => edge.from === item));
      if (ancestors.length) {
        const earlier = el('p', 'pf-panel-note');
        earlier.append(el('strong', null, `Earlier in the chain (${ancestors.length}): `));
        earlier.append(document.createTextNode(ancestors
          .sort((a, b) => a.col - b.col || a.row - b.row)
          .map(item => item.displayCode).join(', ')));
        before.append(earlier);
      }
      grid2.append(before);

      const after = panelSection('Unlocks', 'pf-after');
      if (node.outgoing.length) {
        const row = el('div', 'pf-chip-row');
        for (const edge of node.outgoing.slice().sort((a, b) => a.to.col - b.to.col || a.to.row - b.to.row)) {
          row.append(chip(edge.to.displayCode, edge.to.code));
        }
        after.append(row);
        const descendants = [...reachable(node, 'down')].filter(item => !node.outgoing.some(edge => edge.to === item));
        if (descendants.length) {
          const later = el('p', 'pf-panel-note');
          later.append(el('strong', null, `Further downstream (${descendants.length}): `));
          later.append(document.createTextNode(descendants
            .sort((a, b) => a.col - b.col || a.row - b.row)
            .map(item => item.displayCode).join(', ')));
          after.append(later);
        }
      } else {
        after.append(el('p', 'pf-panel-note', 'No later course in the study plan lists this course as a prerequisite.'));
      }
      grid2.append(after);

      wrap.append(grid2);
      panelBody.replaceChildren(wrap);
    };

    const clearState = () => {
      for (const node of nodes) {
        node.element.classList.remove('is-selected', 'is-up', 'is-down', 'is-coreq', 'is-direct', 'is-dim');
        node.element.setAttribute('aria-pressed', 'false');
        const marker = node.element.querySelector('.pf-reltag');
        marker.hidden = true;
        marker.textContent = '';
      }
      for (const edge of edges) edge.group.classList.remove('is-up', 'is-down');
      host.classList.remove('is-focused');
    };

    const select = node => {
      const repeat = selected === node;
      clearState();
      if (!node || repeat) {
        selected = null;
        renderDefaultPanel();
        return;
      }
      selected = node;
      host.classList.add('is-focused');

      const up = reachable(node, 'up');
      const down = reachable(node, 'down');
      const directUp = new Set(node.incoming.map(edge => edge.from));
      const directDown = new Set(node.outgoing.map(edge => edge.to));

      node.element.classList.add('is-selected');
      node.element.setAttribute('aria-pressed', 'true');

      const mark = (item, className, label) => {
        item.element.classList.add(className);
        if (directUp.has(item) || directDown.has(item)) item.element.classList.add('is-direct');
        const marker = item.element.querySelector('.pf-reltag');
        marker.textContent = label;
        marker.hidden = false;
      };
      // A corequisite is a partner in the same semester, not a step in the
      // chain, so it is marked in its own right rather than as an arrow.
      const partners = new Set(edges
        .filter(edge => edge.kind === 'coreq' && (edge.from === node || edge.to === node))
        .map(edge => (edge.from === node ? edge.to : edge.from)));

      for (const item of up) mark(item, 'is-up', directUp.has(item) ? 'Prerequisite' : 'Earlier');
      for (const item of down) mark(item, 'is-down', directDown.has(item) ? 'Unlocks' : 'Later');
      for (const item of partners) {
        if (item === node || up.has(item) || down.has(item)) continue;
        mark(item, 'is-coreq', 'Co-requisite');
      }
      for (const item of nodes) {
        if (item !== node && !up.has(item) && !down.has(item) && !partners.has(item)) {
          item.element.classList.add('is-dim');
        }
      }

      /* Only the selected course's own direct links are candidates. The wider
         upstream and downstream chains stay highlighted as nodes and listed in
         the panel, but are never wired up — connecting a whole dependency tree
         is what turns the map into a spider web. */
      const coreqEdges = edges.filter(edge =>
        edge.kind === 'coreq' && (edge.from === node || edge.to === node));
      for (const group of [node.incoming, node.outgoing, coreqEdges]) {
        if (!connectorsReadable(group)) continue;
        for (const edge of group) {
          edge.group.classList.add(edge.kind !== 'coreq' && edge.to === node ? 'is-up' : 'is-down');
        }
      }

      if (node.isPlaceholder) renderElectivePanel(node);
      else renderCoursePanel(node);
    };

    // Roving tabindex: the map is a single stop in the page tab order and the
    // arrow keys move between courses, instead of adding 40-odd tab stops.
    if (nodes.length) nodes[0].element.tabIndex = 0;

    const neighbour = (node, dCol, dRow) => {
      if (dRow) return order[node.col][node.row + dRow] || null;
      let col = node.col + dCol;
      while (col >= 0 && col < order.length) {
        if (order[col].length) return order[col][Math.min(node.row, order[col].length - 1)];
        col += dCol;
      }
      return null;
    };

    const nodeOf = event => {
      const button = event.target.closest('.pf-node');
      return button ? nodeByCode.get(button.dataset.code) || null : null;
    };

    grid.addEventListener('click', event => {
      const node = nodeOf(event);
      if (!node) return;
      focusNode(node, false);
      select(node);
    });

    grid.addEventListener('keydown', event => {
      const node = nodeOf(event);
      if (!node) return;
      const moves = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
      if (moves[event.key]) {
        const next = neighbour(node, moves[event.key][0], moves[event.key][1]);
        if (next) {
          event.preventDefault();
          focusNode(next);
        }
        return;
      }
      if (event.key === 'Home' || event.key === 'End') {
        const column = order[node.col];
        event.preventDefault();
        focusNode(event.key === 'Home' ? column[0] : column[column.length - 1]);
      }
    });

    panelBody.addEventListener('click', event => {
      const button = event.target.closest('.pf-chip[data-code]');
      if (!button) return;
      const node = nodeByCode.get(button.dataset.code);
      if (!node) return;
      select(node);
      focusNode(node);
    });

    scroll.addEventListener('click', event => {
      if (event.target === scroll || event.target === grid || event.target === svg) select(null);
    });

    host.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || !selected) return;
      event.preventDefault();
      const previous = selected;
      select(null);
      focusNode(previous);
    });

    renderDefaultPanel();
    refresh();

    if (typeof ResizeObserver === 'function') {
      let frame = 0;
      // Held in a variable so the observer is not collected while it is active.
      const observer = new ResizeObserver(() => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(refresh);
      });
      observer.observe(grid);
    }
    // Kept as a fallback for browsers without ResizeObserver, and harmless
    // alongside it because redrawing is idempotent.
    window.addEventListener('resize', refresh);
    if (document.fonts?.ready) document.fonts.ready.then(refresh).catch(() => {});
  } catch (error) {
    console.error('Could not load the prerequisite flow:', error);
    failure('The prerequisite flow is currently unavailable. The rest of this page is unaffected.');
  }
});
