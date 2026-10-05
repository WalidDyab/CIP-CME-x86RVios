/* Prerequisite Flow section on the EE Program Overview page — "system board".
 *
 * Every academic value rendered here is read from data/ee_program_structure.json:
 * the eight-semester placement, course codes, titles, credits, requirement
 * categories, prerequisite course codes, broad (non-course) prerequisite
 * conditions, corequisites, and the elective selection rule. No relationship is
 * hard-coded in this file — the graph is built from the recorded data, and any
 * prerequisite that cannot be resolved is reported rather than invented. The
 * Open Day narration is generated from that same graph.
 *
 * Structure: courses keep their literal semester column. Courses that take part
 * in a prerequisite or co-requisite link form the technical spine; courses with
 * no link sit on a quieter support rail beneath it, in the same semester column.
 * Prerequisite traces are routed as orthogonal PCB-style paths through the
 * channels between columns and the lanes between rows, so a trace never runs
 * behind a course card.
 *
 * It runs independently of the page's inline script and of program-structure.js,
 * so a data or rendering failure here cannot affect the program structure, the
 * heatmaps, the textbook/reference tools, or the course browser.
 */
document.addEventListener('DOMContentLoaded', async () => {
  const host = document.getElementById('prerequisite-flow-body');
  if (!host) return;
  const section = host.closest('.program-prereq') || host;

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

  /* "Completion of 90 credit hours" -> "90 cr" for the compact condition chip.
     The recorded wording is kept for the tooltip, the detail panel, and the
     assistive-technology text; only the chip is shortened. */
  const shortCondition = condition => {
    const match = str(condition).match(/(\d+)\s*credit/i);
    return match ? `${match[1]} cr` : str(condition);
  };
  const conditionThreshold = condition => {
    const match = str(condition).match(/(\d+)\s*credit/i);
    return match ? Number(match[1]) : 0;
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
          level: columns.length + 1,
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
          outgoing: [],
          partners: []
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
      } else {
        from.partners.push(to);
        to.partners.push(from);
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
    const coreqEdges = edges.filter(edge => edge.kind === 'coreq');

    // ---------------------------------------------------- Derived helpers ---
    /* Breadth-first walk returning how many links away each course is. The
       hop count orders the trace animation; membership drives the highlighting. */
    const hops = (start, direction) => {
      const found = new Map();
      let frontier = [start];
      let depth = 0;
      while (frontier.length) {
        depth += 1;
        const next = [];
        for (const node of frontier) {
          for (const edge of direction === 'up' ? node.incoming : node.outgoing) {
            const other = direction === 'up' ? edge.from : edge.to;
            if (found.has(other) || other === start) continue;
            found.set(other, depth);
            next.push(other);
          }
        }
        frontier = next;
      }
      return found;
    };

    const GATEWAY_MINIMUM = 3; // Presentation threshold for the "unlocks" badge.
    const gateways = nodes.filter(node => node.outgoing.length >= GATEWAY_MINIMUM)
      .sort((a, b) => b.outgoing.length - a.outgoing.length || a.col - b.col);
    const isGateway = node => node.outgoing.length >= GATEWAY_MINIMUM;

    /* Technical spine vs support rail. A course that takes part in no
       prerequisite or co-requisite link is placed on the rail. This is purely a
       graph-readability treatment — its semester column is unchanged. */
    for (const node of nodes) {
      node.rail = !(node.incoming.length || node.outgoing.length || node.partners.length);
    }

    // -------------------------------------------------------- Row ordering ---
    // Spine courses keep their semester; only their vertical order is chosen.
    // An iterated barycentre sweep over every linked neighbour (not just those in
    // the adjacent column) is run from two seeds and the arrangement with the
    // fewest straight-line crossings is kept. Rail courses keep plan order.
    const spineByCol = columns.map((column, col) => nodes.filter(node => node.col === col && !node.rail));
    const railByCol = columns.map((column, col) => nodes.filter(node => node.col === col && node.rail));
    const linkedNeighbours = node => [
      ...node.incoming.map(edge => edge.from),
      ...node.outgoing.map(edge => edge.to),
      ...node.partners
    ];
    const crossingScore = () => {
      const segments = prereqEdges.map(edge => [edge.from.col, edge.from.row, edge.to.col, edge.to.row]);
      let crossings = 0;
      for (let i = 0; i < segments.length; i += 1) {
        for (let j = i + 1; j < segments.length; j += 1) {
          const [ax, ay, bx, by] = segments[i];
          const [cx, cy, dx, dy] = segments[j];
          if (ax === cx && ay === cy) continue; // shared source: a bus, not a crossing
          if (bx === dx && by === dy) continue; // shared target
          const d1 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
          const d2 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
          const d3 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx);
          const d4 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
          if (d1 * d2 < 0 && d3 * d4 < 0) crossings += 1;
        }
      }
      const stretch = prereqEdges.reduce((sum, edge) => sum + Math.abs(edge.from.row - edge.to.row), 0);
      return crossings * 100 + stretch;
    };
    const arrange = reverseSeed => {
      const order = spineByCol.map(column => (reverseSeed ? column.slice().reverse() : column.slice()));
      const assign = () => order.forEach(column => column.forEach((node, row) => { node.row = row; }));
      assign();
      for (let pass = 0; pass < 12; pass += 1) {
        const indices = order.map((_, index) => index);
        if (pass % 2) indices.reverse();
        for (const index of indices) {
          const column = order[index];
          const base = new Map(column.map((node, at) => [node, at]));
          const score = new Map(column.map(node => {
            const rows = linkedNeighbours(node).filter(other => !other.rail).map(other => other.row);
            return [node, rows.length ? rows.reduce((a, b) => a + b, 0) / rows.length : base.get(node)];
          }));
          column.sort((a, b) => (score.get(a) - score.get(b)) || (base.get(a) - base.get(b)));
          column.forEach((node, row) => { node.row = row; });
        }
      }
      // A co-requisite partner sits directly beside its course.
      for (const edge of coreqEdges) {
        if (edge.from.col !== edge.to.col) continue;
        const column = order[edge.from.col];
        column.splice(column.indexOf(edge.to), 1);
        column.splice(column.indexOf(edge.from) + 1, 0, edge.to);
      }
      assign();
      return { order, score: crossingScore() };
    };
    const candidates = [arrange(false), arrange(true)];
    const best = candidates.reduce((a, b) => (b.score < a.score ? b : a));
    best.order.forEach(column => column.forEach((node, row) => { node.row = row; }));
    railByCol.forEach(column => column.forEach((node, row) => { node.row = row; }));

    // ------------------------------------------------------------ Metrics ---
    const M = {
      pad: 26,
      node: { w: 192, h: 76 },
      colGap: 36,
      rowPitch: 94,
      railH: 44,
      railPitch: 50,
      railLabel: 30,
      header: 104
    };
    M.pitch = M.node.w + M.colGap;
    M.laneGap = M.rowPitch - M.node.h;
    const spineRows = Math.max(1, ...spineByCol.map(column => column.length));
    const railRows = Math.max(0, ...railByCol.map(column => column.length));
    M.spineTop = M.header + 22;
    M.railTop = M.spineTop + spineRows * M.rowPitch + 8;
    M.railNodesTop = M.railTop + M.railLabel;
    M.width = M.pad * 2 + columns.length * M.pitch - M.colGap;
    M.height = M.railNodesTop + railRows * M.railPitch + 16;
    const colX = col => M.pad + col * M.pitch;

    for (const node of nodes) {
      node.x = colX(node.col);
      node.w = M.node.w;
      if (node.rail) {
        node.h = M.railH;
        node.y = M.railNodesTop + node.row * M.railPitch;
      } else {
        node.h = M.node.h;
        node.y = M.spineTop + node.row * M.rowPitch;
      }
      node.pinY = node.y + node.h / 2;
    }

    // ------------------------------------------------------- Trace routing ---
    /* Orthogonal routing with 45-degree chamfers.
     *
     *  - A trace leaves a course on its right pin, travels in the channel to the
     *    right of that column, and enters the target on its left pin through the
     *    channel to the left of the target column.
     *  - A trace that spans more than one column rides a horizontal lane in the
     *    gap between two rows. Lanes and channels are empty space by
     *    construction, so no trace passes behind a course card.
     *  - Traces that share a source share one vertical bus. Parallel segments
     *    inside a channel or lane are separated onto tracks by interval
     *    colouring so unrelated traces never overlap.
     */
    const spineGrid = new Map();
    for (const node of nodes) if (!node.rail) spineGrid.set(`${node.col}:${node.row}`, node);
    const laneY = lane => M.spineTop + lane * M.rowPitch - M.laneGap / 2;
    const laneCount = spineRows + 1;
    const channelLeft = channel => colX(channel) + M.node.w;

    const planned = [];
    const channelTrunks = new Map(); // channel -> Map(key -> {lo, hi, x})
    const laneRuns = new Map();      // lane -> [{edge, lo, hi, track}]

    const addTrunk = (channel, key, y1, y2) => {
      if (!channelTrunks.has(channel)) channelTrunks.set(channel, new Map());
      const trunks = channelTrunks.get(channel);
      const lo = Math.min(y1, y2);
      const hi = Math.max(y1, y2);
      const trunk = trunks.get(key);
      if (trunk) {
        trunk.lo = Math.min(trunk.lo, lo);
        trunk.hi = Math.max(trunk.hi, hi);
      } else {
        trunks.set(key, { lo, hi, x: 0 });
      }
    };

    const rowClear = edge => {
      if (edge.from.row !== edge.to.row) return false;
      for (let col = edge.from.col + 1; col < edge.to.col; col += 1) {
        if (spineGrid.has(`${col}:${edge.from.row}`)) return false;
      }
      return true;
    };

    for (const edge of prereqEdges) {
      const plan = { edge, kind: 'adjacent' };
      const span = edge.to.col - edge.from.col;
      const yS = edge.from.pinY;
      const yT = edge.to.pinY;
      if (edge.from.rail || edge.to.rail) {
        plan.kind = 'adjacent';
      }
      if (span === 1) {
        plan.kind = 'adjacent';
        addTrunk(edge.from.col, `out:${edge.from.code}`, yS, yT);
      } else if (span > 1 && rowClear(edge)) {
        plan.kind = 'direct';
      } else if (span > 1) {
        plan.kind = 'lane';
        // Candidate lanes lie between the two rows (inclusive of the gaps on
        // either side). Prefer the one that overlaps the fewest runs already
        // placed, then the one closest to the source.
        const rowA = Math.min(edge.from.row, edge.to.row);
        const rowB = Math.max(edge.from.row, edge.to.row);
        const lo = Math.max(0, rowA);
        const hi = Math.min(laneCount - 1, rowB + 1);
        let bestLane = lo;
        let bestCost = Infinity;
        for (let lane = lo; lane <= hi; lane += 1) {
          const overlap = (laneRuns.get(lane) || []).filter(run =>
            run.edge.from !== edge.from && !(run.hiCol < edge.from.col || run.loCol > edge.to.col)).length;
          const detour = Math.abs(laneY(lane) - yS) + Math.abs(laneY(lane) - yT);
          const cost = overlap * 1000 + detour + Math.abs(laneY(lane) - yS) * 0.01;
          if (cost < bestCost) { bestCost = cost; bestLane = lane; }
        }
        plan.lane = bestLane;
        if (!laneRuns.has(bestLane)) laneRuns.set(bestLane, []);
        laneRuns.get(bestLane).push({ edge, loCol: edge.from.col, hiCol: edge.to.col, plan });
        const y = laneY(bestLane);
        addTrunk(edge.from.col, `out:${edge.from.code}`, yS, y);
        addTrunk(edge.to.col - 1, `in:${edge.to.code}`, y, yT);
      }
      planned.push(plan);
    }

    for (const edge of coreqEdges) {
      const plan = { edge, kind: 'coreq' };
      addTrunk(edge.from.col, `co:${edge.from.code}>${edge.to.code}`, edge.from.pinY, edge.to.pinY);
      planned.push(plan);
    }

    // Track assignment per channel (vertical trunks) by greedy interval colouring.
    let widestChannel = 0;
    for (const [channel, trunks] of channelTrunks) {
      const sorted = [...trunks.entries()].sort((a, b) => a[1].lo - b[1].lo || a[1].hi - b[1].hi);
      const tracks = [];
      for (const [, trunk] of sorted) {
        let index = tracks.findIndex(end => end < trunk.lo - 10);
        if (index < 0) { tracks.push(-Infinity); index = tracks.length - 1; }
        tracks[index] = trunk.hi;
        trunk.track = index;
      }
      widestChannel = Math.max(widestChannel, tracks.length);
      const spacing = Math.min(9, (M.colGap - 8) / Math.max(1, tracks.length));
      const left = channelLeft(channel);
      const used = (tracks.length - 1) * spacing;
      for (const [, trunk] of sorted) {
        trunk.x = left + M.colGap / 2 - used / 2 + trunk.track * spacing;
      }
    }

    // Track assignment per lane (horizontal runs).
    for (const [lane, runs] of laneRuns) {
      const groups = new Map();
      for (const run of runs) {
        const key = run.edge.from.code;
        const group = groups.get(key) || { runs: [], lo: Infinity, hi: -Infinity };
        group.runs.push(run);
        const xOut = channelTrunks.get(run.edge.from.col).get(`out:${run.edge.from.code}`).x;
        const xIn = channelTrunks.get(run.edge.to.col - 1).get(`in:${run.edge.to.code}`).x;
        group.lo = Math.min(group.lo, xOut);
        group.hi = Math.max(group.hi, xIn);
        groups.set(key, group);
      }
      const sorted = [...groups.values()].sort((a, b) => a.lo - b.lo);
      const tracks = [];
      for (const group of sorted) {
        let index = tracks.findIndex(end => end < group.lo - 8);
        if (index < 0) { tracks.push(-Infinity); index = tracks.length - 1; }
        tracks[index] = group.hi;
        group.track = index;
      }
      const spacing = Math.min(6, (M.laneGap - 8) / Math.max(1, tracks.length));
      const used = (tracks.length - 1) * spacing;
      for (const group of sorted) {
        for (const run of group.runs) run.plan.laneOffset = -used / 2 + group.track * spacing;
      }
    }

    const chamfer = (points, radius) => {
      const cleaned = points.filter((point, index) =>
        index === 0 || point[0] !== points[index - 1][0] || point[1] !== points[index - 1][1]);
      let d = `M ${cleaned[0][0]} ${cleaned[0][1]}`;
      for (let i = 1; i < cleaned.length - 1; i += 1) {
        const [px, py] = cleaned[i - 1];
        const [cx, cy] = cleaned[i];
        const [nx, ny] = cleaned[i + 1];
        const inLen = Math.hypot(cx - px, cy - py);
        const outLen = Math.hypot(nx - cx, ny - cy);
        const r = Math.min(radius, inLen / 2, outLen / 2);
        const ax = cx - ((cx - px) / inLen) * r;
        const ay = cy - ((cy - py) / inLen) * r;
        const bx = cx + ((nx - cx) / outLen) * r;
        const by = cy + ((ny - cy) / outLen) * r;
        d += ` L ${ax} ${ay} L ${bx} ${by}`;
      }
      const last = cleaned[cleaned.length - 1];
      return `${d} L ${last[0]} ${last[1]}`;
    };

    const vias = [];
    const sharedOut = new Map();
    for (const plan of planned) {
      if (plan.edge.kind === 'prereq') {
        const key = plan.edge.from.code;
        sharedOut.set(key, (sharedOut.get(key) || 0) + 1);
      }
    }

    for (const plan of planned) {
      const { edge } = plan;
      const xS = edge.from.x + edge.from.w;
      const yS = edge.from.pinY;
      const xT = edge.to.x;
      const yT = edge.to.pinY;
      let points;
      if (plan.kind === 'coreq') {
        const trunk = channelTrunks.get(edge.from.col).get(`co:${edge.from.code}>${edge.to.code}`);
        points = [[xS, yS], [trunk.x, yS], [trunk.x, yT], [edge.to.x + edge.to.w, yT]];
      } else if (plan.kind === 'direct' || yS === yT && plan.kind === 'adjacent') {
        points = [[xS, yS], [xT, yT]];
      } else if (plan.kind === 'adjacent') {
        const trunk = channelTrunks.get(edge.from.col).get(`out:${edge.from.code}`);
        points = [[xS, yS], [trunk.x, yS], [trunk.x, yT], [xT, yT]];
        if (sharedOut.get(edge.from.code) > 1) { vias.push([trunk.x, yS], [trunk.x, yT]); }
      } else {
        const out = channelTrunks.get(edge.from.col).get(`out:${edge.from.code}`);
        const into = channelTrunks.get(edge.to.col - 1).get(`in:${edge.to.code}`);
        const y = laneY(plan.lane) + (plan.laneOffset || 0);
        points = [[xS, yS], [out.x, yS], [out.x, y], [into.x, y], [into.x, yT], [xT, yT]];
        if (sharedOut.get(edge.from.code) > 1) vias.push([out.x, yS]);
      }
      edge.points = points;
      edge.d = chamfer(points, 6);
    }

    // ------------------------------------------------------------ Legend ----
    const fragment = document.createDocumentFragment();
    const shell = el('div', 'pf-shell');
    shell.dataset.view = 'journey';
    shell.dataset.focus = 'both';
    fragment.append(shell);

    // ------------------------------------------------- Presentation bar ----
    const presbar = el('div', 'pf-presbar');
    presbar.setAttribute('role', 'group');
    presbar.setAttribute('aria-label', 'Open Day presentation controls');
    const caption = el('p', 'pf-caption');
    caption.setAttribute('aria-live', 'polite');
    const presControls = el('div', 'pf-prescontrols');
    const presBtn = (label, text, handler) => {
      const button = el('button', 'pf-presbtn', text);
      button.type = 'button';
      button.setAttribute('aria-label', label);
      button.addEventListener('click', handler);
      return button;
    };
    const stepCounter = el('span', 'pf-stepcount');
    stepCounter.setAttribute('aria-hidden', 'true');
    presbar.append(caption, presControls);
    shell.append(presbar);

    // ----------------------------------------------------------- Toolbar ----
    const toolbar = el('div', 'pf-toolbar');

    const search = el('div', 'pf-search');
    const searchLabel = el('label', 'pf-sr-only', 'Search courses by code or title');
    searchLabel.htmlFor = 'pf-search-input';
    const searchInput = el('input', 'input pf-search-input');
    searchInput.id = 'pf-search-input';
    searchInput.type = 'search';
    searchInput.placeholder = 'Find a course — code or title';
    searchInput.autocomplete = 'off';
    searchInput.setAttribute('role', 'combobox');
    searchInput.setAttribute('aria-expanded', 'false');
    searchInput.setAttribute('aria-controls', 'pf-search-results');
    searchInput.setAttribute('aria-autocomplete', 'list');
    const searchResults = el('ul', 'pf-results');
    searchResults.id = 'pf-search-results';
    searchResults.setAttribute('role', 'listbox');
    searchResults.setAttribute('aria-label', 'Matching courses');
    searchResults.hidden = true;
    search.append(searchLabel, searchInput, searchResults);

    const viewGroup = el('div', 'pf-seg');
    viewGroup.setAttribute('role', 'group');
    viewGroup.setAttribute('aria-label', 'Map view');
    const viewButton = (view, text) => {
      const button = el('button', 'pf-seg-btn', text);
      button.type = 'button';
      button.dataset.view = view;
      button.setAttribute('aria-pressed', view === 'journey' ? 'true' : 'false');
      viewGroup.append(button);
      return button;
    };
    const journeyBtn = viewButton('journey', 'Degree journey');
    const boardBtn = viewButton('board', 'Prerequisite map');

    const bankBtn = el('button', 'btn pf-bankbtn');
    bankBtn.type = 'button';
    bankBtn.setAttribute('aria-expanded', 'false');
    const electiveCourses = electiveCategory?.courses || [];
    const selectionRule = electiveCategory?.selection_rule;
    bankBtn.textContent = `Elective bank · ${electiveCourses.length}`;
    bankBtn.hidden = !electiveCourses.length;

    const presentBtn = el('button', 'btn primary pf-presentbtn', 'Open Day mode');
    presentBtn.type = 'button';
    presentBtn.setAttribute('aria-pressed', 'false');

    toolbar.append(search, viewGroup, bankBtn, presentBtn);
    shell.append(toolbar);

    // ------------------------------------------------------------ Legend ----
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
    keyList.setAttribute('aria-label', 'How to read the board');
    const addKey = (markClass, label) => {
      const item = el('li');
      const mark = el('span', `pf-key-mark ${markClass}`);
      mark.setAttribute('aria-hidden', 'true');
      item.append(mark);
      item.append(el('span', 'pf-legend-name', label));
      keyList.append(item);
    };
    addKey('pf-key-up', 'Prerequisite chain');
    addKey('pf-key-down', 'Unlocked courses');
    addKey('pf-key-coreq', 'Co-requisite (same semester)');
    addKey('pf-key-cond', 'Credit-hour condition — not a course');
    addKey('pf-key-slot', 'Elective slot');
    legend.append(keyList);
    shell.append(legend);

    // ------------------------------------------------------------- Stage ----
    const stage = el('div', 'pf-stage');
    const sizer = el('div', 'pf-sizer');
    const canvas = el('div', 'pf-canvas');
    canvas.style.setProperty('--pf-cw', `${M.width}px`);
    canvas.style.setProperty('--pf-ch', `${M.height}px`);
    canvas.setAttribute('role', 'group');
    canvas.setAttribute('aria-label',
      `Prerequisite board across the ${columns.length} semesters of the study plan. Use the arrow keys to move between courses and Enter to trace one.`);

    // Decorative year zones.
    const zoneLayer = el('div', 'pf-zones');
    zoneLayer.setAttribute('aria-hidden', 'true');
    const zones = [];
    let cursor = 0;
    for (const year of studyPlan) {
      const count = (year.semesters || []).length;
      if (!count) continue;
      const zone = el('div', 'pf-zone');
      const x0 = cursor === 0 ? 0 : colX(cursor) - M.colGap / 2;
      const x1 = cursor + count >= columns.length ? M.width : colX(cursor + count) - M.colGap / 2;
      zone.style.setProperty('--x', String(x0));
      zone.style.setProperty('--w', String(x1 - x0));
      zone.dataset.year = String(year.year);
      zone.append(el('span', 'pf-zone-numeral', year.year));
      zoneLayer.append(zone);
      zones.push({ zone, year: year.year });
      cursor += count;
    }
    canvas.append(zoneLayer);

    const svg = svgEl('svg', 'pf-svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('width', String(M.width));
    svg.setAttribute('height', String(M.height));
    svg.setAttribute('viewBox', `0 0 ${M.width} ${M.height}`);
    const defs = svgEl('defs');
    svg.append(defs);
    const edgeLayer = svgEl('g', 'pf-edges');
    const viaLayer = svgEl('g', 'pf-vias');
    const pulseLayer = svgEl('g', 'pf-pulses');
    svg.append(edgeLayer, viaLayer, pulseLayer);
    canvas.append(svg);

    for (const edge of edges) {
      edge.group = svgEl('g', `pf-edge pf-edge-${edge.kind}`);
      edge.line = svgEl('path', 'pf-edge-line');
      edge.line.setAttribute('d', edge.d);
      edge.line.setAttribute('pathLength', '1');
      edge.group.append(edge.line);
      if (edge.kind === 'prereq') {
        const [tipX, tipY] = edge.points[edge.points.length - 1];
        edge.head = svgEl('path', 'pf-edge-head');
        edge.head.setAttribute('d', `M ${tipX - 1} ${tipY} L ${tipX - 9} ${tipY - 4} L ${tipX - 9} ${tipY + 4} Z`);
        edge.group.append(edge.head);
      } else {
        for (const [px, py] of [edge.points[0], edge.points[edge.points.length - 1]]) {
          const cap = svgEl('circle', 'pf-edge-cap');
          cap.setAttribute('cx', String(px));
          cap.setAttribute('cy', String(py));
          cap.setAttribute('r', '3');
          edge.group.append(cap);
        }
      }
      edgeLayer.append(edge.group);
    }
    const seenVia = new Set();
    for (const [vx, vy] of vias) {
      const key = `${vx}:${vy}`;
      if (seenVia.has(key)) continue;
      seenVia.add(key);
      const via = svgEl('circle', 'pf-via');
      via.setAttribute('cx', String(vx));
      via.setAttribute('cy', String(vy));
      via.setAttribute('r', '2.4');
      viaLayer.append(via);
    }

    // Support rail label (decorative structure; the courses themselves are real).
    const railLabel = el('div', 'pf-railbar');
    railLabel.style.setProperty('--y', String(M.railTop));
    railLabel.append(el('span', 'pf-rail-name', 'Support rail'));
    railLabel.append(el('span', 'pf-rail-note',
      'Courses with no prerequisite link, in the same semester column — shown apart only to keep the prerequisite chain readable.'));
    canvas.append(railLabel);

    // Node builder ---------------------------------------------------------
    const buildNode = node => {
      const button = el('button', 'pf-node');
      button.type = 'button';
      button.dataset.code = node.code;
      button.dataset.category = node.categoryId;
      button.style.setProperty('--x', String(node.x));
      button.style.setProperty('--y', String(node.y));
      button.style.setProperty('--w', String(node.w));
      button.style.setProperty('--h', String(node.h));
      button.setAttribute('aria-pressed', 'false');
      button.tabIndex = -1;
      if (node.rail) button.classList.add('is-rail');
      if (node.isPlaceholder) button.classList.add('is-slot');
      if (node.incoming.length) button.classList.add('has-in');
      if (node.outgoing.length) button.classList.add('has-out');
      if (node.partners.length) button.classList.add('has-co');
      if (isGateway(node)) button.classList.add('is-gateway');
      if (node.conditions.length) button.classList.add('has-condition');
      if (node.title) button.title = `${node.displayCode} — ${node.title}`;

      const top = el('span', 'pf-node-top');
      top.append(el('span', 'pf-code', node.displayCode));
      const tag = el('span', 'pf-tag', tagFor(node.categoryId, node.categoryName));
      tag.setAttribute('aria-hidden', 'true');
      top.append(tag);
      button.append(top);

      button.append(el('span', 'pf-node-title', node.title));

      if (node.conditions.length && !node.isPlaceholder) {
        const meta = el('span', 'pf-node-meta');
        for (const condition of node.conditions) {
          const badge = el('span', 'pf-cond', `≥ ${shortCondition(condition)}`);
          badge.title = condition;
          meta.append(badge);
        }
        button.append(meta);
      }
      if (node.isPlaceholder) {
        const meta = el('span', 'pf-node-meta');
        meta.append(el('span', 'pf-socket-note', `Pick 1 of ${electiveCourses.length}`));
        button.append(meta);
      }

      if (isGateway(node)) {
        const gate = el('span', 'pf-gate', `Unlocks ${node.outgoing.length}`);
        gate.title = `${node.displayCode} is a prerequisite for ${node.outgoing.length} later courses.`;
        button.append(gate);
      }

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

    // Credit milestones: where in the plan the recorded credit-hour conditions
    // become satisfiable. Derived from the study plan only.
    const semesterCredits = columns.map(column =>
      column.entries.reduce((sum, course) => sum + num(course.credit_hours), 0));
    const cumulative = [];
    semesterCredits.reduce((sum, value, index) => { cumulative[index] = sum + value; return sum + value; }, 0);
    const thresholds = [...new Set(nodes.flatMap(node => node.conditions.map(conditionThreshold)).filter(Boolean))]
      .sort((a, b) => a - b);
    const milestoneAt = new Map(); // column -> [{value, element}]
    for (const value of thresholds) {
      const index = cumulative.findIndex(total => total >= value);
      if (index < 0) continue;
      if (!milestoneAt.has(index)) milestoneAt.set(index, []);
      milestoneAt.get(index).push({ value, element: null });
    }
    const totalCredits = cumulative[cumulative.length - 1] || 0;

    // The DOM order is year, semester, then the courses of that semester, so the
    // stacked mobile layout and the screen-reader reading order both follow the
    // curriculum. Absolute positions place each node in its semester visually.
    const yearBands = [];
    const semHeads = [];
    cursor = 0;
    for (const year of studyPlan) {
      const yearSemesters = year.semesters || [];
      if (!yearSemesters.length) continue;
      const yearCredits = yearSemesters.reduce((sum, semester) =>
        sum + (semester.courses || []).reduce((inner, course) => inner + num(course.credit_hours), 0), 0);
      const yearNodes = nodes.filter(node => node.year === year.year);

      const band = el('div', 'pf-year');
      band.style.setProperty('--x', String(colX(cursor)));
      band.style.setProperty('--w', String(yearSemesters.length * M.pitch - M.colGap));
      band.dataset.year = String(year.year);
      band.append(el('span', 'pf-year-label', 'Year'));
      band.append(el('span', 'pf-year-name', year.year));
      band.append(el('span', 'pf-year-total', `${yearCredits} cr`));
      const yearGate = yearNodes.filter(isGateway).map(node => node.displayCode);
      const summary = el('span', 'pf-year-sum',
        `${yearNodes.length} courses${yearGate.length ? ` · gateway ${yearGate.join(', ')}` : ''}`);
      band.append(summary);
      canvas.append(band);
      yearBands.push({ band, year: year.year });

      for (const semester of yearSemesters) {
        const column = columns[cursor];
        const computed = (semester.courses || []).reduce((sum, course) => sum + num(course.credit_hours), 0);
        const head = el('div', 'pf-sem');
        head.style.setProperty('--x', String(colX(cursor)));
        head.style.setProperty('--w', String(M.node.w));
        head.dataset.year = String(year.year);
        head.append(el('span', 'pf-sem-level', `Level ${column.level}`));
        head.append(el('span', 'pf-sem-name', column.label));
        head.append(el('span', 'pf-sem-total',
          `${typeof column.statedTotal === 'number' ? column.statedTotal : computed} cr`));
        for (const milestone of milestoneAt.get(cursor) || []) {
          const chip = el('span', 'pf-milestone', `${milestone.value} cr reached`);
          chip.title = `The study plan has accumulated ${milestone.value} credit hours by the end of this semester, ` +
            `so a "Completion of ${milestone.value} credit hours" condition can be met afterwards.`;
          chip.dataset.threshold = String(milestone.value);
          milestone.element = chip;
          head.append(chip);
        }
        canvas.append(head);
        semHeads.push({ head, year: year.year });
        for (const node of [...spineByCol[cursor], ...railByCol[cursor]]) canvas.append(buildNode(node));
        cursor += 1;
      }
    }

    // ------------------------------------------------------- Elective bank --
    const bank = el('div', 'pf-bank');
    bank.setAttribute('role', 'region');
    bank.setAttribute('aria-label', 'Elective bank');
    const bankItems = [];
    if (electiveCourses.length) {
      const bankCol = Math.max(0, columns.length - 2);
      const slotNode = nodes.find(node => node.isPlaceholder);
      const anchorCol = slotNode ? Math.min(slotNode.col, columns.length - 2) : bankCol;
      bank.style.setProperty('--x', String(colX(anchorCol)));
      bank.style.setProperty('--y', String(M.spineTop - 6));
      bank.style.setProperty('--w', String(2 * M.pitch - M.colGap));
      bank.style.setProperty('--h', String(M.railTop - M.spineTop - 4));
      const head = el('div', 'pf-bank-head');
      head.append(el('span', 'pf-bank-title', 'Elective bank'));
      if (selectionRule) {
        head.append(el('span', 'pf-bank-rule',
          `Choose ${selectionRule.courses_to_select} of ${electiveCourses.length} · ${selectionRule.credits_per_course} cr each · ${selectionRule.total_credits} cr`));
      }
      const close = el('button', 'pf-bank-close', 'Close');
      close.type = 'button';
      close.setAttribute('aria-label', 'Close elective bank');
      close.addEventListener('click', () => setBank(false, true));
      head.append(close);
      bank.append(head);
      if (electiveEligibility) {
        const cond = el('p', 'pf-bank-cond');
        cond.append(el('span', 'pf-cond', `≥ ${shortCondition(electiveEligibility)}`));
        cond.append(document.createTextNode(` ${electiveEligibility} — a completion rule, not a course.`));
        bank.append(cond);
      }
      const list = el('ul', 'pf-bank-list');
      for (const course of electiveCourses) {
        const item = el('li');
        const button = el('button', 'pf-bank-item');
        button.type = 'button';
        button.dataset.bank = str(course.course_code);
        button.append(el('span', 'pf-bank-code', str(course.display_code || course.course_code)));
        button.append(el('span', 'pf-bank-name', str(course.course_title)));
        item.append(button);
        list.append(item);
        bankItems.push({ course, button });
      }
      bank.append(list);
      canvas.append(bank);
    }

    sizer.append(canvas);
    stage.append(sizer);
    shell.append(stage);

    // ------------------------------------------------------- Detail dock ----
    const panel = el('div', 'pf-panel');
    const panelBody = el('div', 'pf-panel-body');
    panelBody.setAttribute('aria-live', 'polite');
    panel.append(panelBody);
    shell.append(panel);

    shell.append(el('p', 'pf-hint',
      'Semesters run left to right, Year 1 first. On narrow screens the map stacks semester by semester and each course lists its prerequisites as text.'));

    if (unresolved.length) {
      const note = el('p', 'pf-issue');
      note.append(el('strong', null, 'Note: '));
      note.append(document.createTextNode(
        `${unresolved.length} recorded ${unresolved.length === 1 ? 'relationship' : 'relationships'} could not be placed in the study plan and ` +
        `${unresolved.length === 1 ? 'is' : 'are'} shown as text only — ` +
        unresolved.map(item => `${item.course} → ${item.code}`).join('; ') + '.'));
      shell.append(note);
    }

    host.replaceChildren(fragment);

    // ------------------------------------------------------------ Motion ----
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const stackQuery = window.matchMedia('(max-width: 820px)');
    const motionOk = () => !motionQuery.matches;
    const isStacked = () => stackQuery.matches;

    let pulseFrame = 0;
    const clearPulses = () => {
      cancelAnimationFrame(pulseFrame);
      pulseLayer.replaceChildren();
    };
    /* One small pulse per highlighted trace, travelling in the direction of the
       prerequisite relationship (earlier course -> later course). Delays follow
       the hop distance so the signal visibly flows along the chain. It plays
       once per selection and never loops. */
    const runPulses = (items) => {
      clearPulses();
      if (!motionOk() || isStacked() || !items.length) return;
      const dots = items.map(({ edge, delay }) => {
        const dot = svgEl('circle', 'pf-pulse');
        dot.setAttribute('r', '3.4');
        dot.setAttribute('opacity', '0');
        pulseLayer.append(dot);
        return { dot, path: edge.line, delay, total: edge.line.getTotalLength() };
      });
      const DURATION = 420;
      const started = performance.now();
      const frame = now => {
        let active = false;
        for (const item of dots) {
          const t = (now - started - item.delay) / DURATION;
          if (t < 0) { active = true; continue; }
          if (t >= 1) { item.dot.setAttribute('opacity', '0'); continue; }
          active = true;
          const point = item.path.getPointAtLength(item.total * t);
          item.dot.setAttribute('cx', String(point.x));
          item.dot.setAttribute('cy', String(point.y));
          item.dot.setAttribute('opacity', String(Math.sin(Math.PI * t).toFixed(2)));
        }
        if (active) pulseFrame = requestAnimationFrame(frame);
        else pulseLayer.replaceChildren();
      };
      pulseFrame = requestAnimationFrame(frame);
    };

    // ----------------------------------------------------------- Fitting ----
    const MIN_SCALE = 0.62;
    let presenting = false;
    let scale = 1;
    const fit = () => {
      if (isStacked()) {
        canvas.style.removeProperty('transform');
        sizer.style.removeProperty('width');
        sizer.style.removeProperty('height');
        return;
      }
      const availW = stage.clientWidth;
      if (presenting) {
        const availH = stage.clientHeight;
        scale = Math.min(availW / M.width, availH / M.height, 1.4);
      } else {
        scale = Math.max(MIN_SCALE, Math.min(availW / M.width, 1));
      }
      if (!Number.isFinite(scale) || scale <= 0) scale = 1;
      canvas.style.setProperty('transform', `scale(${scale})`);
      // Keep traces a legible thickness on screen whatever the fit scale is.
      canvas.style.setProperty('--pf-w1', String(Math.max(1.7, 1.4 / scale).toFixed(2)));
      canvas.style.setProperty('--pf-w2', String(Math.max(2.3, 2 / scale).toFixed(2)));
      canvas.style.setProperty('--pf-w3', String(Math.max(3, 2.8 / scale).toFixed(2)));
      sizer.style.setProperty('width', `${Math.round(M.width * scale)}px`);
      sizer.style.setProperty('height', `${Math.round(M.height * scale)}px`);
    };

    // ------------------------------------------------------- Interaction ----
    let selected = null;
    let selectedBankCode = '';
    let focusIndex = 0;
    let focusMode = 'both';
    let bankOpen = false;
    let revealYear = Infinity;

    const order = columns.map((_, col) => [...spineByCol[col], ...railByCol[col]]);

    const focusNode = (node, moveFocus = true) => {
      const index = nodes.indexOf(node);
      if (index < 0) return;
      nodes[focusIndex].element.tabIndex = -1;
      focusIndex = index;
      node.element.tabIndex = 0;
      if (moveFocus) {
        node.element.focus({ preventScroll: presenting });
        if (!presenting) node.element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
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

    const actionButton = (label, mode, handler, pressed) => {
      const button = el('button', `btn pf-action${pressed ? ' is-active' : ''}`, label);
      button.type = 'button';
      button.dataset.mode = mode;
      button.setAttribute('aria-pressed', pressed ? 'true' : 'false');
      button.addEventListener('click', handler);
      return button;
    };

    const dashboardLink = (displayCode, className = 'pf-dash') => {
      if (!linkableCodes.has(normalizeCode(displayCode))) return null;
      const link = el('a', className, 'Open course dashboard');
      link.href = `course-dashboard.html?course=${encodeURIComponent(displayCode)}&layout=full`;
      return link;
    };

    const metaChips = (node, extra) => {
      const chips = el('div', 'pf-panel-chips');
      if (node.year) chips.append(el('span', 'pf-meta-chip', `Year ${node.year}`));
      if (node.semesterLabel) chips.append(el('span', 'pf-meta-chip', node.semesterLabel));
      chips.append(el('span', 'pf-meta-chip', `${node.credits} credits`));
      if (node.categoryName) chips.append(el('span', 'pf-meta-chip', node.categoryName));
      if (extra) chips.append(extra);
      if (!node.isPlaceholder) {
        const link = dashboardLink(node.displayCode);
        if (link) chips.append(link);
      }
      return chips;
    };

    const resetAction = () => actionButton('Show full map', 'reset', () => {
      const previous = selected;
      select(null);
      closeBankIfSelectedItem();
      if (previous) focusNode(previous);
    }, false);

    const panelHead = (node, suffix, withActions) => {
      const head = el('div', 'pf-panel-head');
      const identity = el('div', 'pf-panel-identity');
      identity.append(el('span', 'pf-panel-code', node.displayCode));
      identity.append(el('span', 'pf-panel-title', suffix ? `${node.title} — ${suffix}` : node.title));
      head.append(identity);
      if (withActions) {
        const actions = el('div', 'pf-actions');
        actions.setAttribute('role', 'group');
        actions.setAttribute('aria-label', 'Focus this course');
        const hasUp = node.incoming.length > 0;
        const hasDown = node.outgoing.length > 0;
        const reach = actionButton('How do I reach this?', 'reach', () => setFocusMode('reach'), focusMode === 'reach');
        const unlock = actionButton('What does this unlock?', 'unlock', () => setFocusMode('unlock'), focusMode === 'unlock');
        if (!hasUp) { reach.disabled = true; reach.title = 'No prerequisite course is recorded for this course.'; }
        if (!hasDown) { unlock.disabled = true; unlock.title = 'No later course lists this course as a prerequisite.'; }
        actions.append(reach, unlock, resetAction());
        head.append(actions);
      } else {
        const actions = el('div', 'pf-actions');
        actions.append(resetAction());
        head.append(actions);
      }
      return head;
    };

    const panelSection = (title, className) => {
      const section = el('div', `pf-panel-section${className ? ' ' + className : ''}`);
      section.append(el('h4', null, title));
      return section;
    };

    const setDetail = content => {
      const box = el('div', 'pf-detail');
      box.append(content);
      panelBody.replaceChildren(box);
    };

    const renderDefaultPanel = () => {
      const wrap = el('div', 'pf-panel-intro');
      wrap.append(el('p', 'pf-panel-lead',
        'Select a course to see where it comes from and what it opens up. Its prerequisite chain and everything it unlocks light up along the traces; the rest of the board fades back but stays in place.'));
      const stats = el('ul', 'pf-stats');
      const addStat = (value, label) => {
        const item = el('li');
        item.append(el('b', null, value));
        item.append(el('span', null, label));
        stats.append(item);
      };
      addStat(nodes.length, nodes.length === 1 ? 'course in the plan' : 'courses in the plan');
      addStat(totalCredits, 'credit hours');
      addStat(prereqEdges.length, 'prerequisite links');
      addStat(gateways.length, gateways.length === 1 ? 'gateway course' : 'gateway courses');
      wrap.append(stats);
      if (gateways.length) {
        const line = el('p', 'pf-panel-note pf-gateway-note');
        line.append(el('strong', null, 'Gateways: '));
        line.append(document.createTextNode(
          gateways.map(node => `${node.displayCode} (${node.outgoing.length})`).join(', ') +
          ' — each is a direct prerequisite for that many later courses.'));
        wrap.append(line);
      }
      panelBody.replaceChildren(wrap);
    };

    const electiveRuleLine = () => {
      if (!selectionRule) return null;
      const statement = el('p', 'pf-panel-note');
      statement.append(el('strong', null,
        `Select ${selectionRule.courses_to_select} courses × ${selectionRule.credits_per_course} credits = ${selectionRule.total_credits} credits. `));
      if (selectionRule.brochure_statement) statement.append(document.createTextNode(selectionRule.brochure_statement));
      return statement;
    };

    const renderElectivePanel = node => {
      const wrap = document.createDocumentFragment();
      wrap.append(panelHead(node, 'elective slot', false));
      wrap.append(metaChips(node));
      const body = el('div', 'pf-panel-columns');
      const section = panelSection('Approved technical electives');
      if (electiveEligibility) {
        const eligibility = el('div', 'pf-chip-row');
        eligibility.append(el('span', 'pf-chip-label', 'Eligibility'));
        const badge = el('span', 'pf-chip is-condition', electiveEligibility);
        badge.title = 'A completion requirement, not a course prerequisite.';
        eligibility.append(badge);
        section.append(eligibility);
      }
      const rule = electiveRuleLine();
      if (rule) section.append(rule);
      section.append(el('p', 'pf-panel-note',
        'This slot is filled by any one course in the elective bank, so no prerequisite trace is drawn to it. Each elective carries its own recorded requirement.'));
      body.append(section);
      wrap.append(body);
      setDetail(wrap);
    };

    const renderBankItemPanel = course => {
      const code = str(course.display_code || course.course_code);
      const pseudo = { displayCode: code, title: str(course.course_title), credits: num(course.credits),
        categoryName: electiveCategory?.category_name || '', isPlaceholder: false, year: '', semesterLabel: '' };
      const wrap = document.createDocumentFragment();
      const head = el('div', 'pf-panel-head');
      const identity = el('div', 'pf-panel-identity');
      identity.append(el('span', 'pf-panel-code', code));
      identity.append(el('span', 'pf-panel-title', pseudo.title));
      head.append(identity);
      const actions = el('div', 'pf-actions');
      actions.append(actionButton('Back to the board', 'reset', () => { selectBankItem(null); }, false));
      head.append(actions);
      wrap.append(head);
      wrap.append(metaChips(pseudo));
      const body = el('div', 'pf-panel-columns');
      const section = panelSection('Requirement');
      const recorded = str(course.prerequisite_text);
      const record = curriculumByCode.get(normalizeCode(code));
      const stated = recorded && recorded !== '-' ? recorded : str(record?.prerequisite_text);
      if (stated && stated !== '-') {
        const row = el('div', 'pf-chip-row');
        const badge = el('span', 'pf-chip is-condition', stated);
        badge.title = 'A completion requirement, not a course prerequisite.';
        row.append(badge);
        section.append(row);
      } else {
        section.append(el('p', 'pf-panel-note', 'No prerequisite is recorded for this course.'));
      }
      section.append(el('p', 'pf-panel-note',
        'An approved elective: it can fill either elective slot in the study plan. It has no trace on the board because it is not a fixed step in the chain.'));
      body.append(section);
      wrap.append(body);
      setDetail(wrap);
    };

    const renderCoursePanel = node => {
      const wrap = document.createDocumentFragment();
      wrap.append(panelHead(node, '', true));
      wrap.append(metaChips(node));

      const columnsBox = el('div', 'pf-panel-columns');

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
      const ancestors = [...hops(node, 'up').keys()].filter(item => !node.incoming.some(edge => edge.from === item));
      if (ancestors.length) {
        const earlier = el('p', 'pf-panel-note');
        earlier.append(el('strong', null, `Earlier in the chain (${ancestors.length}): `));
        earlier.append(document.createTextNode(ancestors
          .sort((a, b) => a.col - b.col || a.row - b.row)
          .map(item => item.displayCode).join(', ')));
        before.append(earlier);
      }
      columnsBox.append(before);

      const after = panelSection('Unlocks', 'pf-after');
      if (node.outgoing.length) {
        const row = el('div', 'pf-chip-row');
        for (const edge of node.outgoing.slice().sort((a, b) => a.to.col - b.to.col || a.to.row - b.to.row)) {
          row.append(chip(edge.to.displayCode, edge.to.code));
        }
        after.append(row);
        const descendants = [...hops(node, 'down').keys()].filter(item => !node.outgoing.some(edge => edge.to === item));
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
      columnsBox.append(after);

      wrap.append(columnsBox);
      setDetail(wrap);
    };

    const clearState = () => {
      for (const node of nodes) {
        node.element.classList.remove('is-selected', 'is-up', 'is-down', 'is-coreq', 'is-direct', 'is-dim', 'is-far');
        node.element.setAttribute('aria-pressed', 'false');
        const marker = node.element.querySelector('.pf-reltag');
        marker.hidden = true;
        marker.textContent = '';
      }
      for (const edge of edges) {
        edge.group.classList.remove('is-up', 'is-down', 'is-direct', 'is-hot', 'is-co');
        edge.group.style.removeProperty('--pf-delay');
      }
      for (const chipEl of semHeads.flatMap(({ head }) => [...head.querySelectorAll('.pf-milestone')])) {
        chipEl.classList.remove('is-hot');
      }
      shell.classList.remove('is-focused');
      clearPulses();
    };

    const paint = () => {
      clearState();
      shell.classList.toggle('is-focused', Boolean(selected));
      shell.dataset.focus = selected ? focusMode : 'both';
      if (!selected) return;
      const node = selected;
      const up = hops(node, 'up');
      const down = hops(node, 'down');
      const showUp = focusMode !== 'unlock';
      const showDown = focusMode !== 'reach';
      const directUp = new Set(node.incoming.map(edge => edge.from));
      const directDown = new Set(node.outgoing.map(edge => edge.to));

      node.element.classList.add('is-selected');
      node.element.setAttribute('aria-pressed', 'true');

      const mark = (item, className, label, direct) => {
        item.element.classList.add(className);
        if (direct) item.element.classList.add('is-direct');
        else item.element.classList.add('is-far');
        const marker = item.element.querySelector('.pf-reltag');
        marker.textContent = label;
        marker.hidden = false;
      };
      const partners = new Set(focusMode === 'unlock' ? [] : node.partners);
      const lit = new Set([node]);

      if (showUp) {
        for (const [item] of up) { mark(item, 'is-up', directUp.has(item) ? 'Prerequisite' : 'Earlier', directUp.has(item)); lit.add(item); }
      }
      if (showDown) {
        for (const [item] of down) { mark(item, 'is-down', directDown.has(item) ? 'Unlocks' : 'Later', directDown.has(item)); lit.add(item); }
      }
      for (const item of partners) {
        if (item === node || lit.has(item)) continue;
        mark(item, 'is-coreq', 'Co-requisite', true);
        lit.add(item);
      }
      for (const item of nodes) if (!lit.has(item)) item.element.classList.add('is-dim');

      const maxUp = Math.max(1, ...up.values());
      const pulses = [];
      for (const edge of prereqEdges) {
        let hop = 0;
        let cls = '';
        if (showUp && (edge.to === node || up.has(edge.to)) && up.has(edge.from)) {
          hop = up.get(edge.from);
          cls = 'is-up';
          pulses.push({ edge, delay: (maxUp - hop) * 110 });
        } else if (showDown && (edge.from === node || down.has(edge.from)) && down.has(edge.to)) {
          hop = down.get(edge.to);
          cls = 'is-down';
          pulses.push({ edge, delay: (hop - 1) * 110 });
        } else {
          continue;
        }
        edge.group.classList.add(cls, 'is-hot');
        if (hop === 1) edge.group.classList.add('is-direct');
        edge.group.style.setProperty('--pf-delay', `${cls === 'is-up' ? (maxUp - hop) * 110 : (hop - 1) * 110}ms`);
      }
      for (const edge of coreqEdges) {
        if (focusMode === 'unlock') continue;
        if (edge.from === node || edge.to === node) edge.group.classList.add('is-co', 'is-hot');
      }
      // The credit-hour condition and the point in the plan where it is met.
      for (const condition of node.conditions) {
        const value = conditionThreshold(condition);
        for (const { head } of semHeads) {
          for (const chipEl of head.querySelectorAll('.pf-milestone')) {
            if (Number(chipEl.dataset.threshold) === value) chipEl.classList.add('is-hot');
          }
        }
      }
      // Restart the draw-in animation for the freshly highlighted traces.
      void edgeLayer.getBoundingClientRect();
      runPulses(pulses);
    };

    const showPanel = () => {
      if (selectedBankCode) {
        const item = bankItems.find(entry => str(entry.course.course_code) === selectedBankCode);
        if (item) { renderBankItemPanel(item.course); return; }
      }
      if (!selected) renderDefaultPanel();
      else if (selected.isPlaceholder) renderElectivePanel(selected);
      else renderCoursePanel(selected);
    };

    const setView = (view, announce) => {
      const next = view === 'board' ? 'board' : 'journey';
      const changed = shell.dataset.view !== next;
      shell.dataset.view = next;
      journeyBtn.setAttribute('aria-pressed', String(next === 'journey'));
      boardBtn.setAttribute('aria-pressed', String(next === 'board'));
      if (changed && next === 'board') {
        // Stagger the trace draw-in from the earliest semester onward.
        for (const edge of edges) edge.group.style.setProperty('--pf-reveal', `${edge.from.col * 55}ms`);
        shell.classList.remove('is-revealing');
        void shell.getBoundingClientRect();
        shell.classList.add('is-revealing');
      }
      if (announce) shell.classList.toggle('is-journey-note', next === 'journey');
    };

    const select = (node, mode) => {
      const repeat = selected === node && node && !mode;
      selectedBankCode = '';
      for (const item of bankItems) item.button.classList.remove('is-selected');
      if (!node || repeat) {
        selected = null;
        focusMode = 'both';
        paint();
        showPanel();
        return;
      }
      selected = node;
      focusMode = mode || 'both';
      if (shell.dataset.view !== 'board') setView('board');
      paint();
      showPanel();
      if (node.isPlaceholder) setBank(true);
    };

    function setFocusMode(mode) {
      if (!selected) return;
      focusMode = focusMode === mode ? 'both' : mode;
      paint();
      showPanel();
    }

    function setBank(open, restoreFocus) {
      if (!electiveCourses.length) return;
      bankOpen = open;
      bank.classList.toggle('is-open', open);
      bankBtn.setAttribute('aria-expanded', String(open));
      shell.classList.toggle('is-bank-open', open);
      if (open && shell.dataset.view !== 'board') setView('board');
      if (!open && selectedBankCode) selectBankItem(null);
      if (!open && restoreFocus) bankBtn.focus();
    }

    function selectBankItem(code) {
      if (code) {
        if (selected) { selected = null; focusMode = 'both'; paint(); }
        selectedBankCode = code;
        setBank(true);
      } else {
        selectedBankCode = '';
      }
      for (const item of bankItems) {
        item.button.classList.toggle('is-selected', Boolean(code) && str(item.course.course_code) === code);
      }
      showPanel();
    }

    function closeBankIfSelectedItem() {
      if (selectedBankCode) selectBankItem(null);
    }

    // Roving tabindex: the map is a single stop in the page tab order and the
    // arrow keys move between courses, instead of adding 40-odd tab stops.
    if (nodes.length) nodes[0].element.tabIndex = 0;

    const neighbour = (node, dCol, dRow) => {
      const column = order[node.col];
      const at = column.indexOf(node);
      if (dRow) return column[at + dRow] || null;
      let col = node.col + dCol;
      while (col >= 0 && col < order.length) {
        const target = order[col];
        if (target.length) {
          // Prefer the course nearest in height, within the same band (spine/rail).
          let bestNode = target[0];
          let bestGap = Infinity;
          for (const candidate of target) {
            const gap = Math.abs(candidate.pinY - node.pinY) + (candidate.rail === node.rail ? 0 : 400);
            if (gap < bestGap) { bestGap = gap; bestNode = candidate; }
          }
          return bestNode;
        }
        col += dCol;
      }
      return null;
    };

    const nodeOf = event => {
      const button = event.target.closest('.pf-node');
      return button ? nodeByCode.get(button.dataset.code) || null : null;
    };

    canvas.addEventListener('click', event => {
      const node = nodeOf(event);
      if (!node) return;
      focusNode(node, false);
      select(node);
    });

    canvas.addEventListener('keydown', event => {
      const node = nodeOf(event);
      if (!node) return;
      const moves = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
      if (moves[event.key]) {
        // While presenting, plain Left/Right step the presentation; Shift+Arrow
        // still moves between courses.
        if (presenting && !event.shiftKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) return;
        const next = neighbour(node, moves[event.key][0], moves[event.key][1]);
        if (next) {
          event.preventDefault();
          event.stopPropagation();
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

    stage.addEventListener('click', event => {
      if (event.target === stage || event.target === sizer || event.target === canvas ||
          event.target === svg || event.target.closest('.pf-zones')) {
        if (selected) select(null);
        else if (bankOpen) setBank(false);
      }
    });

    for (const item of bankItems) {
      item.button.addEventListener('click', () => selectBankItem(str(item.course.course_code)));
    }
    bankBtn.addEventListener('click', () => {
      setBank(!bankOpen);
      if (bankOpen && selected) { select(null); }
    });
    journeyBtn.addEventListener('click', () => { select(null); setView('journey'); showPanel(); });
    boardBtn.addEventListener('click', () => setView('board'));

    // ------------------------------------------------------------ Search ----
    const searchable = [
      ...nodes.filter(node => !node.isPlaceholder).map(node => ({
        label: node.displayCode, title: node.title, kind: 'node', node
      })),
      ...electiveCourses.map(course => ({
        label: str(course.display_code || course.course_code), title: str(course.course_title),
        kind: 'bank', course
      }))
    ];
    let activeResult = -1;
    const closeResults = () => {
      searchResults.hidden = true;
      searchResults.replaceChildren();
      searchInput.setAttribute('aria-expanded', 'false');
      searchInput.removeAttribute('aria-activedescendant');
      activeResult = -1;
    };
    const chooseResult = item => {
      closeResults();
      searchInput.value = '';
      if (item.kind === 'node') {
        focusNode(item.node, false);
        select(item.node);
        item.node.element.scrollIntoView({ block: 'center', inline: 'center', behavior: 'auto' });
      } else {
        selectBankItem(str(item.course.course_code));
      }
    };
    const renderResults = () => {
      const query = normalizeCode(searchInput.value);
      const raw = searchInput.value.trim().toLowerCase();
      if (!raw) { closeResults(); return; }
      const matches = searchable.filter(item =>
        normalizeCode(item.label).includes(query) || item.title.toLowerCase().includes(raw)).slice(0, 8);
      searchResults.replaceChildren();
      activeResult = -1;
      if (!matches.length) {
        const none = el('li', 'pf-result-none', 'No matching course');
        none.setAttribute('role', 'presentation');
        searchResults.append(none);
      }
      matches.forEach((item, index) => {
        const li = el('li', 'pf-result');
        li.setAttribute('role', 'option');
        li.id = `pf-result-${index}`;
        li.dataset.index = String(index);
        li.append(el('span', 'pf-result-code', item.label));
        li.append(el('span', 'pf-result-title', item.title));
        if (item.kind === 'bank') li.append(el('span', 'pf-result-tag', 'Elective'));
        li.addEventListener('mousedown', event => { event.preventDefault(); chooseResult(item); });
        searchResults.append(li);
        item.li = li;
      });
      searchResults.hidden = false;
      searchInput.setAttribute('aria-expanded', 'true');
      searchResults._matches = matches;
    };
    searchInput.addEventListener('input', renderResults);
    let blurTimer = 0;
    searchInput.addEventListener('focus', () => { clearTimeout(blurTimer); renderResults(); });
    searchInput.addEventListener('blur', () => { blurTimer = setTimeout(closeResults, 120); });
    searchInput.addEventListener('keydown', event => {
      const matches = searchResults._matches || [];
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        if (!matches.length || searchResults.hidden) return;
        event.preventDefault();
        activeResult = (activeResult + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length;
        matches.forEach((item, index) => {
          item.li.classList.toggle('is-active', index === activeResult);
          item.li.setAttribute('aria-selected', String(index === activeResult));
        });
        searchInput.setAttribute('aria-activedescendant', `pf-result-${activeResult}`);
      } else if (event.key === 'Enter') {
        const pick = matches[activeResult >= 0 ? activeResult : 0];
        if (pick && !searchResults.hidden) { event.preventDefault(); chooseResult(pick); }
      } else if (event.key === 'Escape') {
        if (!searchResults.hidden || searchInput.value) {
          event.preventDefault();
          event.stopPropagation();
          searchInput.value = '';
          closeResults();
        }
      }
    });

    // ------------------------------------------------- Open Day sequence ----
    /* The sequence is built from the live graph: the gateway, the deep chain and
       the credit-hour example are chosen from the data, never named here. */
    const longestChain = (() => {
      const depth = new Map();
      const visit = node => {
        if (depth.has(node)) return depth.get(node);
        const value = 1 + Math.max(0, ...node.incoming.map(edge => visit(edge.from)));
        depth.set(node, value);
        return value;
      };
      let winner = null;
      for (const node of nodes) {
        const length = visit(node);
        const reach = hops(node, 'up').size;
        if (!winner || length > winner.length || (length === winner.length && reach > winner.reach)) {
          winner = { node, length, reach };
        }
      }
      return winner;
    })();
    const conditionExample = nodes.find(node => node.categoryId === 'capstone_project' && node.conditions.length) ||
      nodes.find(node => !node.isPlaceholder && node.conditions.length && !node.rail) || null;
    const spanOf = node => {
      const found = [...hops(node, 'up').keys()];
      return new Set(found.map(item => item.col)).size + 1;
    };

    const reveal = year => {
      revealYear = year;
      for (const node of nodes) node.element.classList.toggle('is-unrevealed', node.year > year);
      for (const edge of edges) {
        edge.group.classList.toggle('is-unrevealed', edge.from.year > year || edge.to.year > year);
      }
      for (const { band, year: y } of yearBands) band.classList.toggle('is-unrevealed', y > year);
      for (const { head, year: y } of semHeads) head.classList.toggle('is-unrevealed', y > year);
      for (const { zone, year: y } of zones) zone.classList.toggle('is-unrevealed', y > year);
      shell.classList.toggle('is-partial', Number.isFinite(year));
      bank.classList.toggle('is-unrevealed', year < Math.max(...columns.map(c => c.year)));
    };

    const yearSummary = year => {
      const members = nodes.filter(node => node.year === year);
      const credits = members.reduce((sum, node) => sum + node.credits, 0);
      return { count: members.length, credits };
    };

    const steps = [];
    steps.push({
      title: 'Degree journey',
      caption: () => `Four years, ${columns.length} semesters, ${totalCredits} credit hours — one path to the degree.`,
      apply: () => { reveal(Infinity); setBank(false); select(null); setView('journey'); showPanel(); }
    });
    for (const { year } of yearBands) {
      steps.push({
        title: `Year ${year}`,
        caption: () => {
          const info = yearSummary(year);
          return `Year ${year}: ${info.count} courses, ${info.credits} credit hours` +
            `${year > 1 ? ' — building on everything revealed so far.' : '.'}`;
        },
        apply: () => { setBank(false); select(null); reveal(year); setView('board'); showPanel(); }
      });
    }
    steps.push({
      title: 'Complete board',
      caption: () => `The complete prerequisite board: ${prereqEdges.length} prerequisite links across ${nodes.length} courses.`,
      apply: () => { setBank(false); select(null); reveal(Infinity); setView('board'); showPanel(); }
    });
    if (gateways.length) {
      const gate = gateways[0];
      steps.push({
        title: `Gateway · ${gate.displayCode}`,
        caption: () => {
          const further = hops(gate, 'down').size - gate.outgoing.length;
          return `${gate.displayCode} is a gateway: ${gate.outgoing.length} courses build directly on it` +
            `${further > 0 ? `, and ${further} more further downstream` : ''}.`;
        },
        apply: () => { setBank(false); reveal(Infinity); setView('board'); focusNode(gate, false); select(gate, 'unlock'); }
      });
    }
    if (longestChain && longestChain.length > 2) {
      const deep = longestChain.node;
      steps.push({
        title: `Deep chain · ${deep.displayCode}`,
        caption: () => `${deep.displayCode} rests on ${longestChain.reach} earlier courses — a chain of ${longestChain.length} courses spanning ${spanOf(deep)} semesters.`,
        apply: () => { setBank(false); reveal(Infinity); setView('board'); focusNode(deep, false); select(deep, 'reach'); }
      });
    }
    if (conditionExample) {
      const target = conditionExample;
      steps.push({
        title: `${target.displayCode} and its condition`,
        caption: () => {
          const courses = target.incoming.map(edge => edge.from.displayCode);
          const parts = [];
          if (courses.length) parts.push(`requires ${courses.join(', ')}`);
          parts.push(...target.conditions.map(condition => condition.charAt(0).toLowerCase() + condition.slice(1)));
          const co = target.partners.map(partner => partner.displayCode);
          return `${target.displayCode} ${parts.join(' and ')}${co.length ? `, with ${co.join(', ')} taken alongside` : ''} — the credit-hour condition is a completion rule, not a course.`;
        },
        apply: () => { setBank(false); reveal(Infinity); setView('board'); focusNode(target, false); select(target); }
      });
    }
    if (electiveCourses.length) {
      steps.push({
        title: 'Elective bank',
        caption: () => `${electiveCourses.length} approved electives${selectionRule ? `; students choose ${selectionRule.courses_to_select}` : ''} to fill the two Year 4 elective slots.`,
        apply: () => { reveal(Infinity); select(null); setView('board'); setBank(true); showPanel(); }
      });
    }
    steps.push({
      title: 'Full map',
      caption: () => 'Back to the full map — select any course to trace where it comes from and what it opens up.',
      apply: () => { setBank(false); select(null); reveal(Infinity); setView('board'); showPanel(); }
    });

    let stepIndex = 0;
    const goToStep = index => {
      stepIndex = Math.max(0, Math.min(steps.length - 1, index));
      const step = steps[stepIndex];
      step.apply();
      caption.textContent = step.caption();
      stepCounter.textContent = `${stepIndex + 1} / ${steps.length}`;
      prevBtn.disabled = stepIndex === 0;
      nextBtn.disabled = stepIndex === steps.length - 1;
      stepTitle.textContent = step.title;
    };

    const stepTitle = el('span', 'pf-steptitle');
    stepTitle.setAttribute('aria-hidden', 'true');
    const prevBtn = presBtn('Previous step', '‹', () => goToStep(stepIndex - 1));
    const nextBtn = presBtn('Next step', '›', () => goToStep(stepIndex + 1));
    const fullBtn = presBtn('Toggle full screen', 'Full screen', () => {
      if (document.fullscreenElement) document.exitFullscreen?.();
      else section.requestFullscreen?.().catch(() => {});
    });
    fullBtn.classList.add('pf-presbtn-wide');
    const exitBtn = presBtn('Exit Open Day mode', 'Exit', () => exitPresentation());
    exitBtn.classList.add('pf-presbtn-wide');
    presControls.append(stepTitle, prevBtn, stepCounter, nextBtn, fullBtn, exitBtn);

    let restoreView = 'journey';
    function enterPresentation() {
      if (presenting || isStacked()) return;
      presenting = true;
      restoreView = shell.dataset.view;
      section.classList.add('is-presenting');
      document.documentElement.classList.add('pf-presenting');
      presentBtn.setAttribute('aria-pressed', 'true');
      closeResults();
      fit();
      goToStep(0);
      requestAnimationFrame(() => { fit(); nextBtn.focus({ preventScroll: true }); });
    }
    function exitPresentation() {
      if (!presenting) return;
      presenting = false;
      if (document.fullscreenElement) document.exitFullscreen?.();
      section.classList.remove('is-presenting');
      document.documentElement.classList.remove('pf-presenting');
      presentBtn.setAttribute('aria-pressed', 'false');
      reveal(Infinity);
      setBank(false);
      select(null);
      setView(restoreView);
      showPanel();
      fit();
      presentBtn.focus({ preventScroll: true });
    }
    presentBtn.addEventListener('click', () => (presenting ? exitPresentation() : enterPresentation()));

    document.addEventListener('keydown', event => {
      const inField = event.target instanceof HTMLElement && event.target.matches('input, textarea, select');
      if (presenting && !inField) {
        if (event.key === 'ArrowRight' || event.key === 'PageDown' || (event.key === ' ' && !event.target.closest?.('button, a'))) {
          if (event.target.closest?.('.pf-node') && event.key === 'ArrowRight' && event.shiftKey) return;
          event.preventDefault();
          goToStep(stepIndex + 1);
          return;
        }
        if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
          if (event.target.closest?.('.pf-node') && event.shiftKey) return;
          event.preventDefault();
          goToStep(stepIndex - 1);
          return;
        }
        if (event.key === 'Home') { if (event.target.closest?.('.pf-node')) return; event.preventDefault(); goToStep(0); return; }
        if (event.key === 'End') { if (event.target.closest?.('.pf-node')) return; event.preventDefault(); goToStep(steps.length - 1); return; }
        if (event.key === 'f' || event.key === 'F') {
          event.preventDefault();
          fullBtn.click();
          return;
        }
      }
      if (event.key !== 'Escape') return;
      if (bankOpen) {
        event.preventDefault();
        if (selectedBankCode) selectBankItem(null); else setBank(false, !presenting);
        return;
      }
      if (selected) {
        event.preventDefault();
        const previous = selected;
        select(null);
        focusNode(previous);
        return;
      }
      if (presenting) {
        event.preventDefault();
        exitPresentation();
      }
    });

    document.addEventListener('fullscreenchange', () => { requestAnimationFrame(fit); });

    // ------------------------------------------------------------- Boot -----
    showPanel();
    setView('journey');
    reveal(Infinity);
    fit();

    if (typeof ResizeObserver === 'function') {
      let frame = 0;
      // Held in a variable so the observer is not collected while it is active.
      const observer = new ResizeObserver(() => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(fit);
      });
      observer.observe(stage);
      observer.observe(document.documentElement);
    }
    window.addEventListener('resize', fit);
    stackQuery.addEventListener?.('change', () => {
      if (isStacked() && presenting) exitPresentation();
      fit();
    });
    if (document.fonts?.ready) document.fonts.ready.then(fit).catch(() => {});

    // Test and review hook: read-only access to the routed geometry.
    host.dataset.traces = String(prereqEdges.length);
  } catch (error) {
    console.error('Could not load the prerequisite flow:', error);
    failure('The prerequisite flow is currently unavailable. The rest of this page is unaffected.');
  }
});
