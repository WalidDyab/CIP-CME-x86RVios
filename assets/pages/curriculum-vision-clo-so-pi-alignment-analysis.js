/* CLO-SO-PI Alignment & Evidence Analysis.
 *
 * Reads the approved curriculum mapping from data/ee_curriculum.json, the program
 * assessment cycle from data/ee-assessment.json, and the review knowledge layer from
 * data/ee_alignment_evidence.json. It never rewrites a mapping and never produces a
 * student-performance or attainment value: the Measurement and Improvement layers are
 * rendered from their declared record schemas with empty record sets.
 */
document.addEventListener('DOMContentLoaded', async () => {
  const el = id => document.getElementById(id);
  const esc = value => portal.esc(value);
  const slug = value => String(value || '').toLowerCase().replace(/_/g, '-');
  const pct = share => Math.round(share * 100);
  const barClass = share => `w-${Math.min(100, Math.max(0, Math.round(share * 20) * 5))}`;
  const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;
  const joinList = items => items.length <= 1 ? (items[0] || '')
    : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

  let curriculum;
  let knowledge;
  let plan;
  try {
    [curriculum, knowledge, plan] = await Promise.all([
      portal.loadJSON('../data/ee_curriculum.json'),
      portal.loadJSON('../data/ee_alignment_evidence.json'),
      portal.loadJSON('../data/ee-assessment.json')
    ]);
  } catch (error) {
    console.error('Alignment analysis data could not be loaded:', error);
    el('soDetail').innerHTML = '<div class="alert">The curriculum mapping or the alignment knowledge layer could not be loaded, so the analysis cannot be produced.</div>';
    return;
  }

  const courses = curriculum.curriculum?.courses || [];
  const outcomes = curriculum.abet?.student_outcomes || {};
  const indicators = curriculum.abet?.performance_indicators || {};
  const families = knowledge.demonstration_families || {};
  const artifactFamilies = knowledge.artifact_families || {};
  const methodProfiles = knowledge.assessment_method_profiles || {};
  const piProfiles = knowledge.pi_evidence_profiles || {};
  const statusModel = knowledge.status_model || {};
  const statusOrder = statusModel.order || [];
  const model = knowledge.coverage_model || {};
  const levelLegend = curriculum.performance_levels_legend || {};

  // ---------------------------------------------------------------- analysis

  function detectFamilies(text) {
    const haystack = String(text || '').toLowerCase();
    return Object.keys(families).filter(id => (families[id].cues || []).some(cue => haystack.includes(cue)));
  }

  function declaredArtifacts(methods) {
    const seen = new Map();
    (methods || []).forEach(method => {
      const profile = methodProfiles[method];
      if (!profile || seen.has(profile.artifact_family)) return;
      seen.set(profile.artifact_family, { family: profile.artifact_family, method, note: profile.note });
    });
    return [...seen.values()];
  }

  function familyLabel(id) { return families[id]?.label || id; }
  function artifactLabel(id) { return artifactFamilies[id]?.label || id; }

  // Preserve-first status model. "Review Recommended" is reached only where the outcome
  // statement describes a demonstration that is neither the indicator's own nor one of the
  // interpretations the indicator profile accepts as supporting it.
  function statusFor(match, evidence) {
    if (match === 'distant') return 'review_recommended';
    if (match === 'primary' && evidence === 'strong') return 'well_supported';
    if (match === 'primary' && evidence === 'partial') return 'defensible';
    if (match === 'supporting' && evidence === 'strong') return 'defensible';
    if (match === 'unclear' && evidence === 'strong') return 'defensible';
    return 'could_be_strengthened';
  }

  // Outcomes whose own indicators are built around the demonstration this CLO actually
  // describes. Offered as an alternative reading only, never as a correction.
  function closestOutcomes(cloFamilies, excludeSo) {
    const grouped = new Map();
    Object.entries(piProfiles).forEach(([code, profile]) => {
      if (!cloFamilies.includes(profile.primary_family)) return;
      const so = indicators[code]?.so;
      if (!so || so === excludeSo) return;
      if (!grouped.has(so)) grouped.set(so, []);
      grouped.get(so).push(code);
    });
    return [...grouped.entries()].sort().map(([so, codes]) => `${so} (${codes.join(', ')})`);
  }

  function analyseLink(course, clo, piCode) {
    const profile = piProfiles[piCode] || {};
    const indicator = indicators[piCode] || {};
    const soCode = indicator.so || '';
    const cloFamilies = detectFamilies(clo.clo_text);
    const artifacts = declaredArtifacts(clo.assessment_methods);
    const declared = artifacts.map(item => item.family);
    const primaryArtifacts = profile.primary_artifacts || [];
    const supportingArtifacts = profile.supporting_artifacts || [];
    const matchedPrimary = declared.filter(id => primaryArtifacts.includes(id));
    const matchedSupporting = declared.filter(id => supportingArtifacts.includes(id));

    let match;
    if (!cloFamilies.length) match = 'unclear';
    else if (cloFamilies.includes(profile.primary_family)) match = 'primary';
    else if (cloFamilies.some(id => (profile.supporting_families || []).includes(id))) match = 'supporting';
    else match = 'distant';

    const evidence = matchedPrimary.length ? 'strong' : matchedSupporting.length ? 'partial' : 'limited';
    const status = statusFor(match, evidence);
    const rubricFlagged = Boolean(indicator.rubric);
    const rubricReady = declared.some(id => artifactFamilies[id]?.rubric_ready);
    const directDeclared = declared.some(id => artifactFamilies[id]?.evidence_mode === 'direct');

    return {
      course, clo, piCode, soCode, profile, indicator,
      cloFamilies, artifacts, declared, matchedPrimary, matchedSupporting,
      match, evidence, status, rubricFlagged, rubricReady, directDeclared,
      fanOut: (clo.pi_codes || []).length,
      level: (course.pi_levels || {})[piCode] || ''
    };
  }

  function whyText(link) {
    const lead = statusModel[link.status]?.lead_phrase || '';
    const demonstrates = link.profile.demonstrates || 'the demonstration this indicator describes';
    const cloFamilyText = joinList(link.cloFamilies.map(familyLabel));
    const carriers = joinList(link.matchedPrimary.map(artifactLabel).map(label => label.toLowerCase()));
    if (link.status === 'well_supported') {
      return `${lead} the outcome statement is written around ${cloFamilyText}, which matches the demonstration ${link.piCode} asks for — ${demonstrates}. The methods already declared for this CLO cover an artifact type that normally carries ${link.piCode}: ${carriers}.`;
    }
    if (link.status === 'defensible') {
      if (link.match === 'primary') {
        return `${lead} the assessed task is scored in a way that shows ${demonstrates}. The outcome statement matches ${link.piCode} directly in the kind of work it asks for; the declared assessment methods can support the mapping, and nominating one of them as the artifact would settle it.`;
      }
      if (link.match === 'unclear') {
        return `${lead} the course team can point to where the assessed task shows that ${demonstrates}. The wording of this CLO does not surface a distinct demonstration verb, so the mapping currently rests on the design of the task rather than on the statement itself. The declared methods do cover a suitable artifact type: ${carriers || 'one of the approved artifact types'}.`;
      }
      return `${lead} the assessed task shows that ${demonstrates}. The statement is built around ${cloFamilyText}, which supports ${link.piCode} rather than naming it — a normal and defensible arrangement where one task carries several outcomes. The declared methods cover a suitable artifact type: ${carriers || 'one of the approved artifact types'}.`;
    }
    if (link.status === 'could_be_strengthened') {
      const target = link.profile.primary_artifacts?.[0];
      const opening = link.match === 'unclear'
        ? 'recording the intent behind this mapping in one sentence, so the reader does not have to infer it from the CLO wording'
        : `naming an artifact that would show that ${demonstrates}`;
      const artifactHint = target ? `, for example ${artifactLabel(target).toLowerCase()} work` : '';
      return `${lead} ${opening}${artifactHint}. The mapping itself is retained: the statement's ${cloFamilyText || 'subject matter'} sits close enough to ${link.piCode} that better evidence, rather than a different indicator, is what is missing.`;
    }
    const alternatives = closestOutcomes(link.cloFamilies, link.soCode);
    const alternativeText = alternatives.length
      ? ` If it does not, ${joinList(alternatives.slice(0, 2))} may describe this outcome more closely — a question for the course team rather than a conclusion.`
      : '';
    return `${lead} the assessed task genuinely does not show that ${demonstrates}. Take the preserve path first: the statement reads as ${cloFamilyText}, so if the task behind it does ask students for that demonstration, the mapping holds and only the CLO wording or a named rubric criterion needs to make it visible.${alternativeText}`;
  }

  function demonstratesText(link) {
    if (!link.cloFamilies.length) {
      return 'The wording of this CLO does not surface a distinct demonstration verb, so what the student produces is defined by the assessed task rather than by the statement. A one-line note on the intended demonstration would make the mapping self-explanatory.';
    }
    return link.cloFamilies.map(id => `${familyLabel(id)} — ${families[id].description}`).join(' ');
  }

  function strengtheningItems(link) {
    const items = [...(link.profile.strengthening || [])];
    if (link.evidence !== 'strong' && link.profile.primary_artifacts?.length) {
      const wanted = joinList(link.profile.primary_artifacts.map(artifactLabel).map(label => label.toLowerCase()));
      const have = link.declared.length ? joinList(link.declared.map(artifactLabel).map(label => label.toLowerCase())) : 'the methods declared for this CLO';
      items.unshift(`Nominate ${wanted} as the carrier for ${link.piCode}. ${have.charAt(0).toUpperCase()}${have.slice(1)} can support the mapping, but ${link.piCode} is normally reported from the first group.`);
    }
    if (link.rubricFlagged && !link.rubricReady) {
      items.push(`${link.piCode} carries an ABET rubric in the program framework, so pair it with a rubric-bearing artifact rather than a raw score.`);
    }
    if (link.match === 'unclear') {
      items.push('Add a short rationale sentence to the course file recording why this indicator was chosen; that is usually enough on its own.');
    }
    return items;
  }

  function noteItems(link) {
    const notes = [];
    const threshold = model.fan_out_advisory_threshold || 8;
    if (link.fanOut >= threshold) {
      notes.push(`This CLO carries ${plural(link.fanOut, 'Performance Indicator')}. Broad mapping is legitimate for an integrative outcome; the practical question is which of those indicators the declared artifacts can actually score separately.`);
    }
    if (link.evidence === 'limited') {
      notes.push(`None of the assessment methods declared for this CLO map to an artifact type normally used to report ${link.piCode}. The mapping stands; the evidence route for it is not yet named.`);
    }
    if (link.rubricFlagged && !link.rubricReady) {
      notes.push(`${link.piCode} is rubric-flagged in the program framework, and none of the declared methods is rubric-bearing as currently described.`);
    }
    if (!link.directDeclared && link.declared.length) {
      notes.push('The declared methods for this CLO are observational or third-party rather than direct student work. Pair them with one direct artifact before using them for attainment.');
    }
    const guidance = String(link.indicator.course_level_guidance || '').toLowerCase();
    if (guidance.includes('senior') && link.level === 'I') {
      notes.push(`Program guidance places ${link.piCode} in senior-level work, and this course is marked "${levelLegend.I || 'Introduced'}" for it. Introducing an indicator early is normal; the attainment evidence would usually be taken further along the sequence.`);
    }
    return notes;
  }

  // ------------------------------------------------------------------ index

  const links = [];
  const cloIndex = new Map();
  courses.forEach(course => (course.clos || []).forEach(clo => {
    const key = `${course.course_code}::${clo.clo_number}`;
    cloIndex.set(key, { course, clo });
    const piCodes = (clo.pi_codes || []).filter(code => indicators[code]);
    piCodes.forEach(code => links.push(Object.assign(analyseLink(course, clo, code), { key: `${key}::${code}` })));
    // A CLO mapped to an outcome without naming one of its indicators has no evidence
    // anchor. The approved data currently has none; the case is handled rather than assumed.
    (clo.mapped_sos || []).forEach(soCode => {
      if (piCodes.some(code => indicators[code].so === soCode)) return;
      links.push({
        key: `${key}::${soCode}::anchor`, course, clo, piCode: '', soCode, profile: {}, indicator: {},
        cloFamilies: detectFamilies(clo.clo_text), artifacts: declaredArtifacts(clo.assessment_methods),
        declared: [], matchedPrimary: [], matchedSupporting: [], match: 'unclear', evidence: 'limited',
        status: 'could_be_strengthened', rubricFlagged: false, rubricReady: false, directDeclared: false,
        fanOut: (clo.pi_codes || []).length, level: '', anchorGap: true
      });
    });
  }));

  const linkByKey = new Map(links.map(link => [link.key, link]));
  const isRequired = course => String(course.required_or_elective || '').toLowerCase() === 'required';
  const totalCourses = courses.length;
  const requiredCourses = courses.filter(isRequired);

  function summariseStatuses(items) {
    const counts = {};
    statusOrder.forEach(id => { counts[id] = 0; });
    items.forEach(item => { counts[item.status] = (counts[item.status] || 0) + 1; });
    return counts;
  }

  const soStats = Object.keys(outcomes).map(soCode => {
    const outcome = outcomes[soCode];
    const soLinks = links.filter(link => link.soCode === soCode);
    const courseCodes = new Set(soLinks.map(link => link.course.course_code));
    const requiredCodes = new Set(soLinks.filter(link => isRequired(link.course)).map(link => link.course.course_code));
    const cloKeys = new Set(soLinks.map(link => `${link.course.course_code}::${link.clo.clo_number}`));
    const expectedPis = outcome.pis || [];
    const piStats = expectedPis.map(code => {
      const piLinks = soLinks.filter(link => link.piCode === code);
      return {
        code,
        statement: indicators[code]?.statement || '',
        guidance: indicators[code]?.course_level_guidance || '',
        rubric: Boolean(indicators[code]?.rubric),
        links: piLinks,
        courses: new Set(piLinks.map(link => link.course.course_code)),
        clos: new Set(piLinks.map(link => `${link.course.course_code}::${link.clo.clo_number}`)),
        statuses: summariseStatuses(piLinks),
        evidenceShare: piLinks.length ? piLinks.filter(link => link.evidence === 'strong').length / piLinks.length : 0
      };
    });

    const perCourse = [...courseCodes].map(code => ({
      code, count: soLinks.filter(link => link.course.course_code === code).length
    })).sort((left, right) => right.count - left.count);
    const topN = model.concentration?.top_courses_considered || 3;
    const topShare = soLinks.length ? perCourse.slice(0, topN).reduce((sum, item) => sum + item.count, 0) / soLinks.length : 0;
    const courseShare = totalCourses ? courseCodes.size / totalCourses : 0;
    const breadth = courseShare >= (model.breadth?.broad_min_course_share ?? 0.5) ? 'broad'
      : courseShare >= (model.breadth?.moderate_min_course_share ?? 0.25) ? 'moderate' : 'focused';
    const evidenceShare = soLinks.length ? soLinks.filter(link => link.evidence === 'strong').length / soLinks.length : 0;
    const planCourses = (plan.so_course_selection?.[soCode] || []).map(code => {
      const normalised = code.replace(/\s+/g, '').toUpperCase();
      const course = courses.find(item => item.course_code.replace(/\s+/g, '').toUpperCase() === normalised);
      return {
        code,
        inDataset: Boolean(course),
        carriesOutcome: Boolean(course) && courseCodes.has(course.course_code)
      };
    });

    return {
      soCode, statement: outcome.statement || '', illustration: outcome.abet_illustration || '',
      expectedPis, piStats, links: soLinks, courseCodes, requiredCodes, cloKeys, perCourse,
      topShare, courseShare, breadth, evidenceShare, planCourses,
      statuses: summariseStatuses(soLinks),
      coveredPis: piStats.filter(item => item.links.length).length,
      evidenceNote: knowledge.so_evidence_notes?.[soCode] || ''
    };
  });

  const soByCode = new Map(soStats.map(item => [item.soCode, item]));

  // -------------------------------------------------------------- rendering

  function statusChip(statusId, count) {
    const label = statusModel[statusId]?.label || statusId;
    const suffix = count === undefined ? '' : ` <strong>${esc(count)}</strong>`;
    return `<span class="status-chip status-${slug(statusId)}" title="${esc(statusModel[statusId]?.definition || '')}">${esc(label)}${suffix}</span>`;
  }

  function statusChipRow(counts) {
    return statusOrder.filter(id => counts[id]).map(id => statusChip(id, counts[id])).join('');
  }

  function coverageBar(share, label) {
    return `<div class="coverage-bar" role="img" aria-label="${esc(label)}"><span class="bar-fill ${barClass(share)}"></span></div>`;
  }

  function definitionAttrs(code, statement) {
    return `title="${esc(statement || '')}" aria-label="${esc(`${code}: ${statement || ''}`)}"`;
  }

  function renderPhilosophy() {
    const philosophy = knowledge.philosophy || {};
    el('philosophyStatement').textContent = philosophy.statement || '';
    el('philosophyOrder').innerHTML = (philosophy.order_of_preference || [])
      .map(item => `<li>${esc(item)}</li>`).join('');
    el('philosophyAuthority').textContent = philosophy.authority_note || '';
  }

  function renderChain() {
    el('chainLayers').innerHTML = (knowledge.layers || []).map(layer => `
      <article class="chain-layer layer-${slug(layer.availability)}">
        <span class="layer-state">${esc(layer.availability_label || layer.availability)}</span>
        <h3>${esc(layer.name)}</h3>
        <p class="chain-path">${esc(layer.chain)}</p>
        <p class="muted">${esc(layer.description)}</p>
        <p class="layer-source"><span class="label">Source</span>${esc(layer.source)}</p>
      </article>`).join('');
  }

  function renderProgramSummary() {
    const clos = courses.reduce((sum, course) => sum + (course.clos || []).length, 0);
    portal.renderStats(el('programStats'), {
      'Courses mapped': totalCourses,
      'Course learning outcomes': clos,
      'CLO → PI relationships': links.length,
      'Student Outcomes': soStats.length
    });
    const counts = summariseStatuses(links);
    const total = links.length || 1;
    el('statusSummary').innerHTML = `
      <div class="status-bar" role="img" aria-label="${esc(statusOrder.map(id => `${statusModel[id]?.label}: ${counts[id]}`).join(', '))}">
        ${statusOrder.map(id => counts[id] ? `<span class="status-slice status-${slug(id)} ${barClass(counts[id] / total)}"></span>` : '').join('')}
      </div>
      <div class="status-chip-row">${statusOrder.map(id => statusChip(id, counts[id])).join('')}</div>`;
    el('statusLegend').innerHTML = statusOrder.map(id => `
      <article class="legend-card status-edge-${slug(id)}">
        <h3>${esc(statusModel[id]?.label || id)}</h3>
        <p class="muted">${esc(statusModel[id]?.definition || '')}</p>
      </article>`).join('');
  }

  function renderCoverageCards() {
    el('soCoverageCards').innerHTML = soStats.map(stat => {
      const breadthLabel = model.breadth?.labels?.[stat.breadth] || stat.breadth;
      const concentrated = stat.topShare >= (model.concentration?.concentrated_min_share ?? 0.6);
      const evidenceLevel = stat.evidenceShare >= (model.evidence_opportunity?.strong_min_share ?? 0.7) ? 'strong'
        : stat.evidenceShare >= (model.evidence_opportunity?.partial_min_share ?? 0.4) ? 'partial' : 'developing';
      return `
      <article class="so-card so-accent-${slug(stat.soCode)}">
        <header class="so-card-head">
          <span class="so-code">${esc(stat.soCode)}</span>
          <span class="pill breadth-${stat.breadth}">${esc(breadthLabel)}</span>
        </header>
        <p class="so-statement">${esc(stat.statement)}</p>
        <div class="so-metrics">
          <div><span class="metric-value">${esc(stat.cloKeys.size)}</span><span class="label">CLOs</span></div>
          <div><span class="metric-value">${esc(stat.courseCodes.size)}</span><span class="label">Courses</span></div>
          <div><span class="metric-value">${esc(stat.coveredPis)}/${esc(stat.expectedPis.length)}</span><span class="label">PIs covered</span></div>
          <div><span class="metric-value">${esc(stat.links.length)}</span><span class="label">CLO → PI links</span></div>
        </div>
        <div class="coverage-row">
          <span class="label">Curricular reach</span>
          ${coverageBar(stat.courseShare, `${stat.courseCodes.size} of ${totalCourses} courses carry ${stat.soCode}`)}
          <span class="coverage-value">${esc(pct(stat.courseShare))}% of courses · ${esc(stat.requiredCodes.size)} required</span>
        </div>
        <div class="coverage-row">
          <span class="label">Evidence opportunity</span>
          ${coverageBar(stat.evidenceShare, `${pct(stat.evidenceShare)} per cent of links already declare a preferred artifact type`)}
          <span class="coverage-value evidence-${evidenceLevel}">${esc(pct(stat.evidenceShare))}% of links already declare a preferred artifact type</span>
        </div>
        <div class="status-chip-row">${statusChipRow(stat.statuses)}</div>
        ${concentrated ? `<p class="so-flag">${esc(pct(stat.topShare))}% of this outcome's links sit in ${esc(plural(Math.min(stat.perCourse.length, model.concentration?.top_courses_considered || 3), 'course'))}.</p>` : ''}
        <button class="btn primary so-open" type="button" data-open-so="${esc(stat.soCode)}">Open ${esc(stat.soCode)} analysis</button>
      </article>`;
    }).join('');
  }

  function intensityClass(count) {
    if (!count) return 'lvl-0';
    if (count <= 2) return 'lvl-1';
    if (count <= 5) return 'lvl-2';
    if (count <= 9) return 'lvl-3';
    return 'lvl-4';
  }

  function renderMatrix() {
    const soCodes = soStats.map(stat => stat.soCode);
    const ordered = [...requiredCourses, ...courses.filter(course => !isRequired(course))];
    let electiveMarked = false;
    const rows = ordered.map(course => {
      let separator = '';
      if (!isRequired(course) && !electiveMarked) {
        electiveMarked = true;
        separator = `<tr class="matrix-separator"><td colspan="${soCodes.length + 1}">Elective courses</td></tr>`;
      }
      const cells = soCodes.map(soCode => {
        const count = links.filter(link => link.soCode === soCode && link.course.course_code === course.course_code).length;
        const levels = [...new Set((outcomes[soCode].pis || [])
          .map(code => (course.pi_levels || {})[code]).filter(Boolean))].join('/');
        const label = count
          ? `${course.course_code}, ${soCode}: ${plural(count, 'CLO to PI link')}${levels ? `, performance level ${levels}` : ''}`
          : `${course.course_code}, ${soCode}: no mapped link`;
        const inner = count
          ? `<button type="button" class="matrix-hit" data-open-so="${esc(soCode)}" data-course="${esc(course.course_code)}" aria-label="${esc(label)}"><span class="matrix-count">${esc(count)}</span>${levels ? `<span class="matrix-level">${esc(levels)}</span>` : ''}</button>`
          : `<span class="matrix-empty" aria-label="${esc(label)}">·</span>`;
        return `<td class="matrix-cell ${intensityClass(count)}">${inner}</td>`;
      }).join('');
      return `${separator}<tr><th scope="row" class="matrix-course"><span class="code">${esc(course.course_code)}</span><span class="matrix-course-title">${esc(course.course_title)}</span></th>${cells}</tr>`;
    }).join('');

    el('coverageMatrix').innerHTML = `<table class="matrix-table"><caption class="sr-only">Number of CLO to Performance Indicator links each course contributes to each Student Outcome</caption><thead><tr><th scope="col" class="matrix-course">Course</th>${soCodes.map(soCode => `<th scope="col" ${definitionAttrs(soCode, outcomes[soCode].statement)}>${esc(soCode)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`;
    el('matrixLegend').innerHTML = `
      <span class="legend-title">CLO → PI links per course</span>
      ${[['lvl-0', 'none'], ['lvl-1', '1–2'], ['lvl-2', '3–5'], ['lvl-3', '6–9'], ['lvl-4', '10+']]
        .map(([cls, label]) => `<span class="legend-item"><span class="legend-swatch ${cls}"></span>${esc(label)}</span>`).join('')}
      <span class="legend-item legend-levels">${esc(Object.entries(levelLegend).map(([key, value]) => `${key} = ${value}`).join(' · '))}</span>`;
  }

  // ------------------------------------------------------------- drill-down

  const state = { so: soStats[0]?.soCode || '', pi: 'all', status: 'all', query: '', course: '' };

  function filteredLinks(stat) {
    const query = state.query.trim().toLowerCase();
    return stat.links.filter(link => {
      if (state.pi !== 'all' && link.piCode !== state.pi) return false;
      if (state.status !== 'all' && link.status !== state.status) return false;
      if (state.course && link.course.course_code !== state.course) return false;
      if (!query) return true;
      return [link.course.course_code, link.course.course_title, link.clo.clo_text, link.piCode,
        (link.clo.assessment_methods || []).join(' ')].join(' ').toLowerCase().includes(query);
    });
  }

  function renderPiSelect(stat) {
    const select = el('piSelect');
    const options = ['<option value="all">All indicators</option>']
      .concat(stat.expectedPis.map(code => `<option value="${esc(code)}">${esc(code)}</option>`));
    select.innerHTML = options.join('');
    select.value = stat.expectedPis.includes(state.pi) ? state.pi : 'all';
    state.pi = select.value;
  }

  function evidenceBadge(link) {
    const map = { strong: 'Preferred artifact declared', partial: 'Supporting artifact declared', limited: 'Evidence route not yet named' };
    return `<span class="evidence-badge evidence-${link.evidence}">${esc(map[link.evidence])}</span>`;
  }

  function linkSummary(link) {
    const piLabel = link.piCode || `${link.soCode} (no indicator named)`;
    return `<span class="link-code">${esc(link.course.course_code)} · CLO ${esc(link.clo.clo_number)}</span>
      <span class="link-pi">${esc(piLabel)}</span>
      <span class="link-text">${esc(link.clo.clo_text)}</span>
      ${statusChip(link.status)}`;
  }

  function artifactRow(id, declaredIds, role) {
    const family = artifactFamilies[id] || {};
    const already = declaredIds.includes(id);
    return `<li class="artifact-item${already ? ' is-declared' : ''}">
      <div class="artifact-head"><strong>${esc(family.label || id)}</strong>
        <span class="artifact-tag">${esc(already ? 'Already declared for this CLO' : role === 'primary' ? 'Recommended carrier' : 'Supporting option')}</span>
        <span class="artifact-tag mode-${slug(family.evidence_mode)}">${esc(String(family.evidence_mode || '').replace(/_/g, ' '))}</span>
      </div>
      <p class="muted">${esc(family.description || '')}</p>
    </li>`;
  }

  function analysisPanel(link) {
    if (link.anchorGap) {
      return `<div class="analysis-panel"><section class="analysis-block"><h4>Evidence anchor</h4>
        <p class="muted">This CLO is mapped to ${esc(link.soCode)} without naming one of that outcome's Performance Indicators, so there is no indicator-level anchor to attach evidence to. The outcome mapping is retained; naming the indicator the course team had in mind is the smallest step that makes it reportable.</p></section></div>`;
    }
    const declared = link.declared;
    const strengthening = strengtheningItems(link);
    const notes = noteItems(link);
    const so = outcomes[link.soCode] || {};
    return `<div class="analysis-panel">
      <section class="analysis-block analysis-why status-edge-${slug(link.status)}">
        <h4>Why this mapping is defensible</h4>
        <p>${esc(whyText(link))}</p>
      </section>
      <div class="analysis-columns">
        <section class="analysis-block">
          <h4>What the CLO demonstrates</h4>
          <p class="muted">${esc(demonstratesText(link))}</p>
        </section>
        <section class="analysis-block">
          <h4>How it relates to ${esc(link.soCode)} and ${esc(link.piCode)}</h4>
          <p class="muted"><strong>${esc(link.soCode)}</strong> — ${esc(so.statement || '')}</p>
          <p class="muted"><strong>${esc(link.piCode)}</strong> — ${esc(link.indicator.statement || '')}</p>
          <p class="muted">${esc(link.profile.relationship || '')}</p>
        </section>
      </div>
      <section class="analysis-block">
        <h4>What would make the evidence stronger</h4>
        <ul class="analysis-list">${strengthening.map(item => `<li>${esc(item)}</li>`).join('')}</ul>
        ${link.profile.evidence_note ? `<p class="muted analysis-aside">${esc(link.profile.evidence_note)}</p>` : ''}
      </section>
      <div class="analysis-columns">
        <section class="analysis-block">
          <h4>Suitable assessment artifact</h4>
          <p class="muted">Declared for this CLO: ${esc(portal.listText(link.clo.assessment_methods) || 'none recorded')}.</p>
          <ul class="artifact-list">
            ${(link.profile.primary_artifacts || []).map(id => artifactRow(id, declared, 'primary')).join('')}
            ${(link.profile.supporting_artifacts || []).map(id => artifactRow(id, declared, 'supporting')).join('')}
          </ul>
        </section>
        <section class="analysis-block">
          <h4>Rubric criterion that could measure it</h4>
          <ul class="analysis-list">${(link.profile.rubric_criteria || []).map(item => `<li>${esc(item)}</li>`).join('')}</ul>
          <h4 class="analysis-subhead">Possible attainment metric</h4>
          <p class="muted">${esc(link.profile.attainment_methodology || '')}</p>
          <p class="muted analysis-aside">Methodology only. No attainment value is computed, stored or displayed in this release.</p>
        </section>
      </div>
      ${notes.length ? `<section class="analysis-block analysis-notes">
        <h4>For faculty attention</h4>
        <ul class="analysis-list">${notes.map(item => `<li>${esc(item)}</li>`).join('')}</ul>
      </section>` : ''}
      <p class="analysis-foot muted">Teaching strategies declared for this CLO: ${esc(portal.listText(link.clo.teaching_strategy) || 'none recorded')}.</p>
    </div>`;
  }

  function renderDetail() {
    const stat = soByCode.get(state.so);
    const container = el('soDetail');
    const status = el('detailStatus');
    if (!stat) { container.innerHTML = '<div class="alert">Select a Student Outcome to view its analysis.</div>'; return; }
    const visible = filteredLinks(stat);
    status.textContent = `${stat.soCode}: ${plural(visible.length, 'CLO to indicator relationship')} shown`
      + `${state.pi === 'all' ? '' : `, indicator ${state.pi}`}`
      + `${state.status === 'all' ? '' : `, status ${statusModel[state.status]?.label || state.status}`}`
      + `${state.course ? `, course ${state.course}` : ''}.`;
    const byCourse = new Map();
    visible.forEach(link => {
      const code = link.course.course_code;
      if (!byCourse.has(code)) byCourse.set(code, { course: link.course, items: [] });
      byCourse.get(code).items.push(link);
    });

    const piCards = stat.piStats.map(item => `
      <article class="pi-card${state.pi === item.code ? ' is-active' : ''}">
        <header class="pi-card-head">
          <button type="button" class="pi-select" data-select-pi="${esc(item.code)}" aria-pressed="${state.pi === item.code}">${esc(item.code)}</button>
          ${item.rubric ? '<span class="pill rubric-pill" title="An ABET rubric is defined for this indicator in the program framework">Rubric defined</span>' : ''}
        </header>
        <p class="muted pi-statement">${esc(item.statement)}</p>
        ${coverageBar(stat.links.length ? item.links.length / stat.links.length : 0, `${item.links.length} of ${stat.links.length} links for ${stat.soCode}`)}
        <p class="pi-metrics">${esc(plural(item.clos.size, 'CLO'))} · ${esc(plural(item.courses.size, 'course'))} · ${esc(plural(item.links.length, 'link'))}</p>
        ${item.guidance ? `<p class="muted pi-guidance"><span class="label">Program guidance</span>${esc(item.guidance)}</p>` : ''}
        <div class="status-chip-row">${statusChipRow(item.statuses)}</div>
        ${item.links.length ? '' : '<p class="so-flag">No CLO is currently mapped to this indicator.</p>'}
      </article>`).join('');

    const courseBlocks = [...byCourse.values()].map(group => `
      <details class="course-group">
        <summary>
          <span class="code">${esc(group.course.course_code)}</span>
          <span class="course-group-title">${esc(group.course.course_title)}</span>
          <span class="pill">${esc(group.course.required_or_elective || '')}</span>
          <span class="pill">${esc(plural(group.items.length, 'link'))}</span>
          <span class="status-chip-row">${statusChipRow(summariseStatuses(group.items))}</span>
        </summary>
        <div class="course-group-body">
          <p class="course-group-links"><a href="../undergraduate-ee/course-dashboard.html?course=${encodeURIComponent(group.course.course_code)}">Open ${esc(group.course.course_code)} in the Course Dashboard</a></p>
          ${group.items.map(link => `
            <details class="link-row status-edge-${slug(link.status)}" data-link="${esc(link.key)}">
              <summary>${linkSummary(link)}${evidenceBadge(link)}</summary>
              <div class="link-body" data-link-body="${esc(link.key)}"><p class="muted">Opening analysis…</p></div>
            </details>`).join('')}
        </div>
      </details>`).join('');

    const planRows = stat.planCourses.map(item => {
      const label = !item.inDataset ? 'Outside the Undergraduate EE dataset'
        : item.carriesOutcome ? 'Carries CLOs mapped to this outcome' : 'No CLO in this course is mapped to this outcome';
      const tone = !item.inDataset ? 'plan-unknown' : item.carriesOutcome ? 'plan-ok' : 'plan-check';
      return `<li class="${tone}"><span class="code">${esc(item.code)}</span><span>${esc(label)}</span></li>`;
    }).join('');

    container.innerHTML = `
      <article class="so-header so-accent-${slug(stat.soCode)}">
        <div class="so-header-main">
          <span class="so-code">${esc(stat.soCode)}</span>
          <p class="so-statement">${esc(stat.statement)}</p>
        </div>
        <div class="status-chip-row">${statusChipRow(stat.statuses)}</div>
        ${stat.evidenceNote ? `<p class="muted so-evidence-note">${esc(stat.evidenceNote)}</p>` : ''}
        ${stat.illustration ? `<details class="so-illustration"><summary>ABET illustration</summary><p class="muted">${esc(stat.illustration)}</p></details>` : ''}
      </article>

      <div class="so-subgrid">
        <section class="card">
          <h3>Curricular coverage</h3>
          <p class="muted">${esc(model.breadth?.notes?.[stat.breadth] || '')}</p>
          <ul class="fact-list">
            <li><span>Courses contributing</span><strong>${esc(stat.courseCodes.size)} of ${esc(totalCourses)}</strong></li>
            <li><span>Required courses contributing</span><strong>${esc(stat.requiredCodes.size)} of ${esc(requiredCourses.length)}</strong></li>
            <li><span>CLOs mapped</span><strong>${esc(stat.cloKeys.size)}</strong></li>
            <li><span>Indicators represented</span><strong>${esc(stat.coveredPis)} of ${esc(stat.expectedPis.length)}</strong></li>
          </ul>
          ${stat.topShare >= (model.concentration?.concentrated_min_share ?? 0.6)
            ? `<p class="so-flag">${esc(pct(stat.topShare))}% of the links for this outcome sit in ${esc(stat.perCourse.slice(0, model.concentration?.top_courses_considered || 3).map(item => item.code).join(', '))}. ${esc(model.concentration?.note || '')}</p>`
            : '<p class="muted">Links for this outcome are spread across its contributing courses rather than concentrated in a few.</p>'}
        </section>
        <section class="card">
          <h3>Assessment plan cross-check</h3>
          <p class="muted">Courses nominated for ${esc(stat.soCode)} in the program assessment plan (${esc(plan.assessment_cycle?.name || 'current cycle')}), checked against the approved mapping.</p>
          <ul class="plan-list">${planRows || '<li class="plan-unknown"><span>No courses nominated for this outcome in the plan.</span></li>'}</ul>
        </section>
      </div>

      <section class="card pi-section">
        <h3>Performance Indicators under ${esc(stat.soCode)}</h3>
        <div class="pi-grid">${piCards}</div>
      </section>

      <section class="card link-section">
        <div class="link-section-head">
          <h3>Contributing courses, CLOs and indicator relationships</h3>
          <span class="pill">${esc(plural(visible.length, 'relationship'))}${state.course ? ` · filtered to ${esc(state.course)}` : ''}</span>
          ${state.course ? '<button type="button" class="btn" id="clearCourseFilter">Clear course filter</button>' : ''}
        </div>
        ${courseBlocks || '<div class="alert">No relationship matches the current filters.</div>'}
      </section>`;
  }

  // Fill an analysis panel the first time its row is opened. `toggle` does not bubble,
  // so the listener runs in the capture phase.
  el('soDetail').addEventListener('toggle', event => {
    const row = event.target;
    if (!row.matches?.('.link-row') || !row.open) return;
    const body = row.querySelector('[data-link-body]');
    if (!body || body.dataset.rendered === 'true') return;
    const link = linkByKey.get(row.dataset.link);
    if (!link) return;
    body.innerHTML = analysisPanel(link);
    body.dataset.rendered = 'true';
  }, true);

  function openOutcome(soCode, courseCode) {
    if (!soByCode.has(soCode)) return;
    state.so = soCode;
    state.course = courseCode || '';
    state.pi = 'all';
    state.status = 'all';
    el('soSelect').value = soCode;
    el('statusSelect').value = 'all';
    renderPiSelect(soByCode.get(soCode));
    renderDetail();
    el('detailSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  document.addEventListener('click', event => {
    const opener = event.target.closest('[data-open-so]');
    if (opener) { openOutcome(opener.dataset.openSo, opener.dataset.course); return; }
    const piButton = event.target.closest('[data-select-pi]');
    if (piButton) {
      state.pi = state.pi === piButton.dataset.selectPi ? 'all' : piButton.dataset.selectPi;
      el('piSelect').value = state.pi;
      renderDetail();
      return;
    }
    if (event.target.closest('#clearCourseFilter')) { state.course = ''; renderDetail(); }
  });

  // ------------------------------------------------------------ observations

  function renderObservations() {
    const cards = [];
    const leanest = [...soStats].sort((left, right) => left.courseShare - right.courseShare).slice(0, 3);
    const focused = soStats.filter(stat => stat.breadth === 'focused');
    cards.push({
      title: 'Outcomes carried by fewer courses',
      body: focused.length
        ? model.breadth?.notes?.focused || ''
        : `Every outcome is carried by at least ${pct(model.breadth?.moderate_min_course_share ?? 0.25)}% of the curriculum, so none reads as under-served on curricular reach alone. The three with the narrowest reach are listed for context.`,
      items: (focused.length ? focused : leanest)
        .map(stat => `${stat.soCode} — ${stat.courseCodes.size} of ${totalCourses} courses (${pct(stat.courseShare)}%), ${stat.requiredCodes.size} of them required`)
    });
    const spread = model.concentration?.top_courses_considered || 3;
    const concentrated = soStats.filter(stat => stat.topShare >= (model.concentration?.concentrated_min_share ?? 0.6));
    const densest = [...soStats].sort((left, right) => right.topShare - left.topShare).slice(0, 3);
    cards.push({
      title: 'Outcomes concentrated in a few courses',
      body: concentrated.length
        ? model.concentration?.note || ''
        : `No outcome has more than ${pct(model.concentration?.concentrated_min_share ?? 0.6)}% of its links in its ${spread} largest contributing courses, so none depends on a very small set of course offerings. The three most concentrated are listed for context.`,
      items: (concentrated.length ? concentrated : densest)
        .map(stat => `${stat.soCode} — ${pct(stat.topShare)}% of links in ${stat.perCourse.slice(0, spread).map(item => item.code).join(', ')}`)
    });
    const thin = model.pi_thin_link_threshold ?? 12;
    const thinPis = soStats.flatMap(stat => stat.piStats.filter(item => item.links.length < thin)
      .map(item => `${item.code} (${stat.soCode}) — ${plural(item.links.length, 'link')} across ${plural(item.courses.size, 'course')}`));
    if (thinPis.length) {
      cards.push({
        title: 'Indicators with fewer mapped relationships',
        body: 'A smaller number of relationships is not a problem in itself; it does mean the assessment plan has fewer courses to choose from when this indicator comes up for assessment.',
        items: thinPis
      });
    }
    const fanOut = model.fan_out_advisory_threshold ?? 8;
    const broadClos = [...cloIndex.values()]
      .filter(entry => (entry.clo.pi_codes || []).length >= fanOut)
      .map(entry => `${entry.course.course_code} CLO ${entry.clo.clo_number} — ${plural((entry.clo.pi_codes || []).length, 'indicator')}`);
    if (broadClos.length) {
      cards.push({
        title: 'CLOs mapped to many indicators',
        body: 'Broad mapping suits an integrative outcome such as a design or capstone task. The question worth asking is which of those indicators the declared artifacts can score separately, so that reported attainment stays traceable to one indicator at a time.',
        items: broadClos
      });
    }
    const unclear = [...cloIndex.values()]
      .filter(entry => !detectFamilies(entry.clo.clo_text).length)
      .map(entry => `${entry.course.course_code} CLO ${entry.clo.clo_number} — “${entry.clo.clo_text}”`);
    if (unclear.length) {
      cards.push({
        title: 'CLO wording without a distinct demonstration verb',
        body: 'These statements do not surface the kind of demonstration they expect, so their mappings rest on the course team\'s knowledge of the assessed task. A clearer verb, or a one-line rationale in the course file, makes the mapping self-explanatory to a reviewer.',
        items: unclear
      });
    }
    const planGaps = soStats.flatMap(stat => stat.planCourses
      .filter(item => item.inDataset && !item.carriesOutcome)
      .map(item => `${stat.soCode} — ${item.code} is nominated in the assessment plan but carries no CLO mapped to ${stat.soCode}`));
    const planOutside = soStats.flatMap(stat => stat.planCourses
      .filter(item => !item.inDataset)
      .map(item => `${stat.soCode} — ${item.code} is nominated in the assessment plan and sits outside the Undergraduate EE dataset`));
    if (planGaps.length || planOutside.length) {
      cards.push({
        title: 'Assessment plan and mapping cross-check',
        body: 'Courses nominated in the program assessment plan are compared with the approved CLO mapping. A mismatch usually means the plan and the mapping were updated at different times rather than that either is wrong.',
        items: [...planGaps, ...planOutside]
      });
    }
    const review = links.filter(link => link.status === 'review_recommended');
    cards.push({
      title: 'Relationships flagged for a closer look',
      body: review.length
        ? 'These are the few relationships where the statement describes a different kind of demonstration from the indicator. Each one opens with the preserve path: if the assessed task carries the indicator, clarified wording or a named rubric criterion is enough.'
        : 'No relationship in the current mapping shows a specific conceptual difference between the outcome statement and the indicator it is mapped to.',
      items: review.map(link => `${link.course.course_code} CLO ${link.clo.clo_number} → ${link.piCode} (${link.soCode})`)
    });

    el('programObservations').innerHTML = cards.map(card => `
      <article class="card observation-card">
        <h3>${esc(card.title)}${card.items.length ? ` <span class="pill">${esc(card.items.length)}</span>` : ''}</h3>
        <p class="muted">${esc(card.body)}</p>
        ${card.items.length ? `<ul class="observation-list">${card.items.map(item => `<li>${esc(item)}</li>`).join('')}</ul>` : ''}
      </article>`).join('');
  }

  function renderEvidenceQuality() {
    el('evidenceQuality').innerHTML = (knowledge.evidence_quality_dimensions || []).map(dimension => `
      <article class="card quality-card">
        <h3>${esc(dimension.label)}</h3>
        <p class="quality-question">${esc(dimension.question)}</p>
        <p class="muted">${esc(dimension.guidance)}</p>
        <p class="quality-state"><span class="label">Current state</span>No assessment artifact is linked yet, so this check is shown as guidance against the recommended evidence type.</p>
      </article>`).join('');

    const methodsInUse = new Set();
    courses.forEach(course => (course.clos || []).forEach(clo => (clo.assessment_methods || []).forEach(method => methodsInUse.add(method))));
    const rows = [...methodsInUse].sort().map(method => {
      const profile = methodProfiles[method];
      const family = profile ? artifactFamilies[profile.artifact_family] || {} : {};
      return `<tr>
        <td>${esc(method)}</td>
        <td>${esc(family.label || 'Not yet profiled')}</td>
        <td><span class="evidence-mode mode-${slug(family.evidence_mode)}">${esc(String(family.evidence_mode || '—').replace(/_/g, ' '))}</span></td>
        <td>${esc(family.isolation || '—')}</td>
        <td>${family.rubric_ready === undefined ? '—' : family.rubric_ready ? 'Yes' : 'Needs a scoring key'}</td>
        <td class="muted">${esc(profile?.note || '')}</td>
      </tr>`;
    }).join('');
    el('artifactReference').innerHTML = `
      <h3>Approved assessment methods as evidence carriers</h3>
      <p class="muted">Every method below is already part of the program's approved assessment pool. Isolation describes how easily a single indicator can be scored separately from the rest of the task.</p>
      <div class="table-wrap"><table><thead><tr><th>Assessment method</th><th>Artifact type</th><th>Evidence mode</th><th>Isolation</th><th>Rubric-bearing</th><th>Note</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function renderFutureLayers() {
    const blocks = [
      { key: 'measurement_layer', name: 'Measurement Layer', chain: 'Student Performance → Attainment' },
      { key: 'improvement_layer', name: 'Improvement Layer', chain: 'Finding → Action → Reassessment' }
    ];
    el('futureLayers').innerHTML = blocks.map(block => {
      const layer = knowledge[block.key] || {};
      const schema = layer.record_schema || {};
      return `<article class="card future-card">
        <header class="future-head">
          <h3>${esc(block.name)}</h3>
          <span class="pill layer-state-pill">${esc(String(layer.status || '').replace(/_/g, ' ') || 'not connected')}</span>
        </header>
        <p class="chain-path">${esc(block.chain)}</p>
        <p class="muted">${esc(layer.policy || '')}</p>
        <p class="future-count"><span class="label">Records held</span>${esc((layer.records || []).length)}</p>
        <details class="future-schema">
          <summary>Record structure ready for real data</summary>
          <dl class="schema-list">${Object.entries(schema).map(([field, description]) => `<dt>${esc(field)}</dt><dd>${esc(description)}</dd>`).join('')}</dl>
        </details>
      </article>`;
    }).join('');
  }

  // ------------------------------------------------------------------- boot

  function renderControls() {
    const soSelect = el('soSelect');
    soSelect.innerHTML = soStats.map(stat => `<option value="${esc(stat.soCode)}">${esc(stat.soCode)} — ${esc(stat.statement.slice(0, 62))}${stat.statement.length > 62 ? '…' : ''}</option>`).join('');
    el('statusSelect').innerHTML = ['<option value="all">All statuses</option>']
      .concat(statusOrder.map(id => `<option value="${esc(id)}">${esc(statusModel[id]?.label || id)}</option>`)).join('');
    soSelect.addEventListener('change', () => { state.course = ''; openOutcome(soSelect.value); });
    el('piSelect').addEventListener('change', event => { state.pi = event.target.value; renderDetail(); });
    el('statusSelect').addEventListener('change', event => { state.status = event.target.value; renderDetail(); });
    el('detailSearch').addEventListener('input', event => { state.query = event.target.value; renderDetail(); });
  }

  renderPhilosophy();
  renderChain();
  renderProgramSummary();
  renderCoverageCards();
  renderMatrix();
  renderControls();
  renderObservations();
  renderEvidenceQuality();
  renderFutureLayers();

  const requestedSo = portal.getParam('so');
  const requestedCourse = portal.getParam('course');
  if (requestedSo && soByCode.has(requestedSo)) { state.so = requestedSo; state.course = requestedCourse || ''; }
  el('soSelect').value = state.so;
  renderPiSelect(soByCode.get(state.so));
  renderDetail();

  el('dataSources').textContent = `Curriculum mapping: data/ee_curriculum.json (consolidated ${curriculum.consolidated_on || 'n/a'}). `
    + `Assessment cycle: data/ee-assessment.json (${plan.assessment_cycle?.name || 'n/a'}). `
    + `Review knowledge layer: data/ee_alignment_evidence.json (${knowledge.status}). `
    + 'No student performance or attainment value is stored or generated by this page.';
});
