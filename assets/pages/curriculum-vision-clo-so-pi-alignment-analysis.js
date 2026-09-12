/* CLO-SO-PI Alignment Review.
 *
 * Simple by default, analysis on demand. The Overview answers only whether the required
 * curriculum serves the seven Student Outcomes and what faculty should look at; every
 * deeper capability sits behind the Analysis Tools rail and renders on first use.
 *
 * Reads the approved curriculum mapping from data/ee_curriculum.json, the program
 * assessment cycle from data/ee-assessment.json, and the review knowledge layer from
 * data/ee_alignment_evidence.json. It never rewrites a mapping and never produces a
 * student-performance or attainment value: the Measurement and Improvement layers are
 * rendered from their declared record schemas with empty record sets.
 *
 * Scope: every program-level conclusion is computed from required (core) courses only,
 * because they are the curriculum every student takes. Elective relationships are analysed
 * with the same engine and stay inspectable through the exploration tools, but they never
 * enter a core-coverage figure or a headline judgment.
 */
document.addEventListener('DOMContentLoaded', async () => {
  const el = id => document.getElementById(id);
  const esc = value => portal.esc(value);
  const slug = value => String(value || '').toLowerCase().replace(/_/g, '-');
  const pct = share => Math.round(share * 100);
  const barClass = share => `w-${Math.min(100, Math.max(0, Math.round(share * 20) * 5))}`;
  // Flex-grow keeps the stacked bar faithful to the underlying counts while the CSS
  // min-width keeps a small but non-zero slice visible. Both come from classes, never
  // from an inline style, so the page stays within the portal content-security policy.
  const growClass = share => `grow-${Math.min(100, Math.max(1, Math.round(share * 100)))}`;
  const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;
  const verb = (count, singular, pluralForm) => count === 1 ? singular : pluralForm;
  // Small shares round away to a misleading whole number, so keep one decimal below 5%.
  const pctText = value => value > 0 && value < 0.05 ? `${(value * 100).toFixed(1)}%` : `${pct(value)}%`;
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
  const dimensions = knowledge.dimension_model || {};
  const scopeModel = knowledge.analysis_scope || {};
  const levelLegend = curriculum.performance_levels_legend || {};

  const BROAD = model.breadth?.broad_min_course_share ?? 0.5;
  const MODERATE = model.breadth?.moderate_min_course_share ?? 0.25;
  const CONCENTRATED = model.concentration?.concentrated_min_share ?? 0.6;
  const TOP_COURSES = model.concentration?.top_courses_considered || 3;
  const EVIDENCE_STRONG = model.evidence_readiness?.strong_min_share ?? 0.7;
  const EVIDENCE_PARTIAL = model.evidence_readiness?.partial_min_share ?? 0.4;
  const FAN_OUT = model.fan_out_advisory_threshold ?? 8;

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

  // Measurement records would make a mapping's evidence specific rather than recommended.
  // The set is empty in this release; the lookup exists so real records connect cleanly.
  const documentedKeys = new Set((knowledge.measurement_layer?.records || [])
    .map(record => `${record.course_code}::${record.clo_number}::${record.pi_code}`));

  const isRequired = course => String(course.required_or_elective || '').toLowerCase() === 'required';

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
    const specificity = documentedKeys.has(`${course.course_code}::${clo.clo_number}::${piCode}`) ? 'documented'
      : primaryArtifacts.length ? 'recommended' : 'not_available';

    return {
      course, clo, piCode, soCode, profile, indicator,
      core: isRequired(course),
      cloFamilies, artifacts, declared, matchedPrimary, matchedSupporting,
      match, evidence, specificity,
      status: statusFor(match, evidence),
      rubricFlagged: Boolean(indicator.rubric),
      rubricReady: declared.some(id => artifactFamilies[id]?.rubric_ready),
      directDeclared: declared.some(id => artifactFamilies[id]?.evidence_mode === 'direct'),
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
    if (link.fanOut >= FAN_OUT) {
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
    cloIndex.set(key, { course, clo, core: isRequired(course) });
    const piCodes = (clo.pi_codes || []).filter(code => indicators[code]);
    piCodes.forEach(code => links.push(Object.assign(analyseLink(course, clo, code), { key: `${key}::${code}` })));
    // A CLO mapped to an outcome without naming one of its indicators has no evidence
    // anchor. The approved data currently has none; the case is handled rather than assumed.
    (clo.mapped_sos || []).forEach(soCode => {
      if (piCodes.some(code => indicators[code].so === soCode)) return;
      links.push({
        key: `${key}::${soCode}::anchor`, course, clo, piCode: '', soCode, profile: {}, indicator: {},
        core: isRequired(course), cloFamilies: detectFamilies(clo.clo_text),
        artifacts: declaredArtifacts(clo.assessment_methods), declared: [], matchedPrimary: [], matchedSupporting: [],
        match: 'unclear', evidence: 'limited', specificity: 'not_available', status: 'could_be_strengthened',
        rubricFlagged: false, rubricReady: false, directDeclared: false,
        fanOut: (clo.pi_codes || []).length, level: '', anchorGap: true
      });
    });
  }));

  const linkByKey = new Map(links.map(link => [link.key, link]));
  const requiredCourses = courses.filter(isRequired);
  const electiveCourses = courses.filter(course => !isRequired(course));
  const coreLinks = links.filter(link => link.core);
  const electiveLinks = links.filter(link => !link.core);
  const coreCourseCount = requiredCourses.length;
  const PI_THIN_COURSES = Math.max(2, Math.round(coreCourseCount * MODERATE));

  function summariseStatuses(items) {
    const counts = {};
    statusOrder.forEach(id => { counts[id] = 0; });
    items.forEach(item => { counts[item.status] = (counts[item.status] || 0) + 1; });
    return counts;
  }

  const share = (part, whole) => whole ? part / whole : 0;

  // One scope block per (outcome, course scope). The denominator is passed in so a core
  // block is measured against required courses and never against the whole catalogue.
  function scopeStats(soLinks, denominator, expectedPis) {
    const courseCodes = new Set(soLinks.map(link => link.course.course_code));
    const cloKeys = new Set(soLinks.map(link => `${link.course.course_code}::${link.clo.clo_number}`));
    const perCourse = [...courseCodes].map(code => ({
      code, count: soLinks.filter(link => link.course.course_code === code).length
    })).sort((left, right) => right.count - left.count);
    const relationshipConcentration = share(
      perCourse.slice(0, TOP_COURSES).reduce((sum, item) => sum + item.count, 0), soLinks.length);
    const courseShare = share(courseCodes.size, denominator);
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
        evidenceReadiness: share(piLinks.filter(link => link.evidence === 'strong').length, piLinks.length)
      };
    });
    const statuses = summariseStatuses(soLinks);
    return {
      links: soLinks, courseCodes, cloKeys, perCourse, piStats, statuses,
      denominator, courseShare, relationshipConcentration,
      concentrated: relationshipConcentration >= CONCENTRATED,
      breadth: courseShare >= BROAD ? 'broad' : courseShare >= MODERATE ? 'moderate' : 'focused',
      conceptualAlignment: share(soLinks.filter(link => link.match === 'primary' || link.match === 'supporting').length, soLinks.length),
      directlyAligned: share(soLinks.filter(link => link.match === 'primary').length, soLinks.length),
      evidenceReadiness: share(soLinks.filter(link => link.evidence === 'strong').length, soLinks.length),
      supportedShare: share((statuses.well_supported || 0) + (statuses.defensible || 0), soLinks.length),
      coveredPis: piStats.filter(item => item.links.length).length
    };
  }

  function attentionFor(scope) {
    if (scope.statuses.review_recommended) return 'review';
    if (scope.evidenceReadiness < EVIDENCE_PARTIAL) return 'evidence';
    const strengthenShare = share(scope.statuses.could_be_strengthened || 0, scope.links.length);
    if (scope.evidenceReadiness < EVIDENCE_STRONG || strengthenShare > 0.2) return 'evidence_watch';
    if (scope.breadth !== 'broad' || scope.concentrated) return 'confirm';
    return 'none';
  }

  const ATTENTION = {
    review: { label: 'Worth a review conversation', tone: 'review' },
    evidence: { label: 'Evidence to strengthen', tone: 'watch' },
    evidence_watch: { label: 'Evidence could be clearer', tone: 'watch' },
    confirm: { label: 'Worth confirming', tone: 'good' },
    none: { label: 'No action needed', tone: 'strong' }
  };

  const soStats = Object.keys(outcomes).map(soCode => {
    const outcome = outcomes[soCode];
    const expectedPis = outcome.pis || [];
    const all = links.filter(link => link.soCode === soCode);
    const core = scopeStats(all.filter(link => link.core), coreCourseCount, expectedPis);
    const elective = scopeStats(all.filter(link => !link.core), electiveCourses.length, expectedPis);
    const combined = scopeStats(all, courses.length, expectedPis);
    const planCourses = (plan.so_course_selection?.[soCode] || []).map(code => {
      const normalised = code.replace(/\s+/g, '').toUpperCase();
      const course = courses.find(item => item.course_code.replace(/\s+/g, '').toUpperCase() === normalised);
      return {
        code,
        inDataset: Boolean(course),
        isCore: Boolean(course) && isRequired(course),
        carriesOutcome: Boolean(course) && combined.courseCodes.has(course.course_code)
      };
    });
    return {
      soCode, statement: outcome.statement || '', illustration: outcome.abet_illustration || '',
      expectedPis, core, elective, all: combined, planCourses,
      attention: attentionFor(core),
      evidenceNote: knowledge.so_evidence_notes?.[soCode] || '',
      nextStep: knowledge.so_next_steps?.[soCode] || ''
    };
  });

  const soByCode = new Map(soStats.map(item => [item.soCode, item]));
  const coreStatuses = summariseStatuses(coreLinks);
  const coreSupported = (coreStatuses.well_supported || 0) + (coreStatuses.defensible || 0);
  const coreSupportedShare = share(coreSupported, coreLinks.length);
  const coreReviewShare = share(coreStatuses.review_recommended || 0, coreLinks.length);
  const coreReadyCount = coreLinks.filter(link => link.evidence === 'strong').length;
  const corePis = new Set(coreLinks.map(link => link.piCode).filter(Boolean));
  const outcomesRepresented = soStats.filter(stat => stat.core.links.length).length;
  const allOutcomesRepresented = outcomesRepresented === soStats.length;

  function programConclusion() {
    const tiers = knowledge.program_conclusion?.tiers || [];
    return tiers.find(tier => coreSupportedShare >= (tier.min_supported_share ?? 0)
      && coreReviewShare <= (tier.max_review_share ?? 1)
      && (!tier.requires_all_outcomes_represented || allOutcomesRepresented)) || tiers[tiers.length - 1] || {};
  }

  // -------------------------------------------------------------- rendering

  function statusChip(statusId, count) {
    const label = statusModel[statusId]?.label || statusId;
    const suffix = count === undefined ? '' : ` <strong>${esc(count)}</strong>`;
    return `<span class="status-chip status-${slug(statusId)}" title="${esc(statusModel[statusId]?.definition || '')}">${esc(label)}${suffix}</span>`;
  }

  function statusChipRow(counts) {
    return statusOrder.filter(id => counts[id]).map(id => statusChip(id, counts[id])).join('');
  }

  function statusBar(counts, total) {
    const label = statusOrder.filter(id => counts[id]).map(id => `${statusModel[id]?.label}: ${counts[id]}`).join(', ');
    return `<div class="status-bar" role="img" aria-label="${esc(label)}">${statusOrder
      .filter(id => counts[id])
      .map(id => `<span class="status-slice status-${slug(id)} ${growClass(share(counts[id], total))}"></span>`)
      .join('')}</div>`;
  }

  function coverageBar(value, label, tone) {
    return `<div class="coverage-bar${tone ? ` bar-${tone}` : ''}" role="img" aria-label="${esc(label)}"><span class="bar-fill ${barClass(value)}"></span></div>`;
  }

  function definitionAttrs(code, statement) {
    return `title="${esc(statement || '')}" aria-label="${esc(`${code}: ${statement || ''}`)}"`;
  }

  function dimensionChip(dimensionId, stateId) {
    const dimension = dimensions[dimensionId] || {};
    const state = dimension.states?.[stateId] || {};
    return `<span class="dim-chip tone-${slug(state.tone || 'watch')}" title="${esc(`${dimension.label}: ${state.description || ''}`)}">
      <span class="dim-name">${esc(dimension.label || dimensionId)}</span>
      <span class="dim-state">${esc(state.label || stateId)}</span></span>`;
  }

  function dimensionRow(link) {
    return `<div class="dim-row">
      ${dimensionChip('conceptual_alignment', link.match)}
      ${dimensionChip('evidence_readiness', link.evidence)}
      ${dimensionChip('evidence_specificity', link.specificity)}
    </div>`;
  }

  // ------------------------------------------------------ shared derived copy

  const shortName = soCode => knowledge.so_short_names?.[soCode] || soCode;
  const shortCheck = soCode => knowledge.so_short_checks?.[soCode] || '';
  const overviewState = attention => knowledge.overview_states?.[attention] || { label: attention, tone: 'watch' };

  // The faculty-facing one-liner for an outcome, composed from figures the engine has
  // already computed. No new measurement is introduced here.
  function overviewMessage(stat) {
    const core = stat.core;
    const reviewCount = core.statuses.review_recommended || 0;
    if (stat.attention === 'review') {
      return `${plural(reviewCount, 'CLO–PI relationship')} ${verb(reviewCount, 'is', 'are')} worth faculty confirmation.`;
    }
    if (stat.attention === 'evidence' || stat.attention === 'evidence_watch') {
      return shortCheck(stat.soCode);
    }
    if (stat.attention === 'confirm') {
      if (core.concentrated) {
        return `Concentrated in ${plural(Math.min(TOP_COURSES, core.perCourse.length), 'required course')} suited to this outcome; assessment opportunities look suitable.`;
      }
      return `Carried by a focused set of ${plural(core.courseCodes.size, 'required course')}; assessment opportunities look suitable.`;
    }
    return core.breadth === 'broad'
      ? 'Broadly represented in the required curriculum with suitable assessment opportunities.'
      : `Represented in ${plural(core.courseCodes.size, 'required course')} with suitable assessment opportunities.`;
  }

  function renderScopeBadge() {
    el('scopeBadge').textContent = `${scopeModel.core_label || 'Core curriculum'} · `
      + `${plural(coreCourseCount, 'required course')}. `
      + `Electives are analysed separately because students complete only part of the elective pool.`;
  }

  // -------------------------------------------------------------- overview tool

  function renderOverview() {
    const conclusion = programConclusion();
    const needAttention = soStats.filter(stat => stat.attention === 'review'
      || stat.attention === 'evidence' || stat.attention === 'evidence_watch');
    el('overviewConclusion').innerHTML = `
      <p class="conclusion-headline">${esc(conclusion.plain_headline || conclusion.headline || '')}</p>
      <p class="conclusion-detail">${esc(allOutcomesRepresented
        ? `All ${soStats.length} Student Outcomes are represented in the required curriculum.`
        : `${outcomesRepresented} of ${soStats.length} Student Outcomes are represented in the required curriculum.`)}
        ${esc(needAttention.length
          ? `Most existing mappings appear reasonable, with ${plural(needAttention.length, 'outcome')} where assessment evidence or faculty confirmation would make the alignment clearer.`
          : 'Most existing mappings appear reasonable, and no outcome currently needs faculty attention.')}</p>`;

    el('soOverview').innerHTML = soStats.map(stat => {
      const state = overviewState(stat.attention);
      return `<article class="so-row tone-${state.tone}">
        <div class="so-row-head">
          <span class="so-row-code">${esc(stat.soCode)}</span>
          <span class="so-row-name">${esc(shortName(stat.soCode))}</span>
          <span class="state-chip tone-${state.tone}">${esc(state.label)}</span>
        </div>
        <p class="so-row-message">${esc(overviewMessage(stat))}</p>
        <button type="button" class="so-row-link" data-open-so="${esc(stat.soCode)}">Details<span aria-hidden="true"> →</span><span class="sr-only"> for ${esc(stat.soCode)} ${esc(shortName(stat.soCode))}</span></button>
      </article>`;
    }).join('');

    el('reviewItems').innerHTML = needAttention.length
      ? needAttention.map(stat => `
        <article class="review-item tone-${overviewState(stat.attention).tone}">
          <div class="review-item-text">
            <p class="review-item-title">${esc(stat.soCode)} · ${esc(shortName(stat.soCode))}</p>
            <p class="review-item-check">${esc(shortCheck(stat.soCode))}</p>
          </div>
          <button type="button" class="btn primary" data-open-so="${esc(stat.soCode)}">Review ${esc(stat.soCode)}</button>
        </article>`).join('')
      : '<p class="muted">Nothing in the required curriculum currently needs a faculty review.</p>';
  }

  // ----------------------------------------------------------- SO details tool

  function meter(label, value, text, tone) {
    return `<div class="health-meter">
      <span class="meter-label">${esc(label)}</span>
      ${coverageBar(value, `${label}: ${text}`, tone)}
      <span class="meter-value tone-${tone}">${esc(text)}</span>
    </div>`;
  }

  function healthTone(value, strong, good) {
    return value >= strong ? 'strong' : value >= good ? 'good' : 'watch';
  }

  function renderSoChooser() {
    el('soDetailsChooser').innerHTML = `<span class="so-chooser-label" id="soChooserLabel">Choose an outcome</span>
      <div class="so-chooser-buttons" role="group" aria-labelledby="soChooserLabel">${soStats.map(stat => {
        const state = overviewState(stat.attention);
        return `<button type="button" class="so-chooser-button tone-${state.tone}${state.tone === 'strong' ? '' : ' is-flagged'}" data-open-so="${esc(stat.soCode)}" aria-pressed="${detailState.so === stat.soCode}">
          <span class="chooser-code">${esc(stat.soCode)}</span>
          <span class="chooser-name">${esc(shortName(stat.soCode))}</span>
        </button>`;
      }).join('')}</div>`;
  }

  // First screen for one outcome: a plain summary and a single deliberate action. The
  // relationship-level analysis stays behind "Explore mappings".
  function renderSoDetails() {
    const stat = soByCode.get(detailState.so);
    const body = el('soDetailsBody');
    renderSoChooser();
    if (!stat) {
      body.innerHTML = '<p class="muted">Select a Student Outcome above to see its summary.</p>';
      return;
    }
    const core = stat.core;
    const state = overviewState(stat.attention);
    const observation = [
      model.breadth?.notes?.[core.breadth] || '',
      core.concentrated
        ? `Most of its relationships sit in ${joinList(core.perCourse.slice(0, TOP_COURSES).map(item => item.code))}.`
        : '',
      stat.evidenceNote || ''
    ].filter(Boolean).join(' ');
    const soFindings = buildFindings().filter(finding => finding.so === stat.soCode);

    body.innerHTML = `
      <article class="so-summary so-accent-${slug(stat.soCode)}">
        <header class="so-summary-head">
          <h3>${esc(stat.soCode)} — ${esc(shortName(stat.soCode))}</h3>
          <span class="state-chip tone-${state.tone}">${esc(state.label)}</span>
        </header>
        <p class="so-summary-statement">${esc(stat.statement)}</p>
        <dl class="so-summary-facts">
          <dt>Overall</dt>
          <dd>${esc(stat.attention === 'review'
            ? 'Mapping is retained; a small number of relationships are worth confirming'
            : stat.attention === 'evidence' || stat.attention === 'evidence_watch'
              ? 'Mapping appears appropriate; the assessment evidence could be clearer'
              : 'Mapping appears appropriate')}</dd>
          <dt>Core curriculum</dt>
          <dd>${esc(plural(core.courseCodes.size, 'required course'))} contribute, through ${esc(plural(core.cloKeys.size, 'CLO'))}</dd>
          <dt>Main observation</dt>
          <dd>${esc(observation)}</dd>
          <dt>Suggested faculty check</dt>
          <dd>${esc(stat.nextStep)}</dd>
        </dl>
        <div class="so-summary-meters">
          ${meter('Core coverage', core.courseShare, `${core.courseCodes.size}/${coreCourseCount} courses`, healthTone(core.courseShare, BROAD, MODERATE))}
          ${meter('Conceptual alignment', core.conceptualAlignment, `${pct(core.conceptualAlignment)}%`, healthTone(core.conceptualAlignment, 0.95, 0.8))}
          ${meter('Evidence readiness', core.evidenceReadiness, `${pct(core.evidenceReadiness)}%`, healthTone(core.evidenceReadiness, EVIDENCE_STRONG, EVIDENCE_PARTIAL))}
        </div>
        <div class="status-chip-row">${statusChipRow(core.statuses)}</div>
        <p class="so-summary-elective muted">${esc(scopeModel.elective_label || 'Elective enrichment')}: ${esc(plural(stat.elective.links.length, 'relationship'))} in ${esc(plural(stat.elective.courseCodes.size, 'elective course'))}, not counted in the program conclusion.</p>
        <div class="so-summary-actions">
          <button type="button" class="btn primary" data-explore-so="${esc(stat.soCode)}">Explore ${esc(stat.soCode)} mappings</button>
        </div>
      </article>
      ${soFindings.length ? `<details class="so-interpretation">
        <summary>Full interpretation for ${esc(stat.soCode)}</summary>
        <div class="attention-list">${soFindings.map(findingCard).join('')}</div>
      </details>` : ''}`;
  }

  // --------------------------------------------------------- what deserves attention

  function findingCard(finding) {
    return `<article class="finding tone-${finding.tone}">
      <header class="finding-head">
        <h3>${esc(finding.title)}</h3>
      </header>
      <p class="finding-line"><span class="finding-label">What we see</span>${esc(finding.see)}</p>
      <p class="finding-line"><span class="finding-label">What it means</span>${esc(finding.means)}</p>
      ${finding.consider ? `<p class="finding-line"><span class="finding-label">What to consider</span>${esc(finding.consider)}</p>` : ''}
      ${finding.items?.length ? `<ul class="finding-items">${finding.items.map(item => `<li>${esc(item)}</li>`).join('')}</ul>` : ''}
    </article>`;
  }

  function buildFindings() {
    const findings = [];
    const reviewLinks = coreLinks.filter(link => link.status === 'review_recommended');
    const reviewOutcomes = [...new Set(reviewLinks.map(link => link.soCode))].sort();

    reviewOutcomes.forEach(soCode => {
      const stat = soByCode.get(soCode);
      const items = reviewLinks.filter(link => link.soCode === soCode);
      findings.push({
        priority: 100, tone: 'review', so: soCode,
        title: `${plural(items.length, 'relationship')} under ${soCode} would benefit from a short faculty conversation`,
        see: `${joinList(items.map(link => `${link.course.course_code} CLO ${link.clo.clo_number} → ${link.piCode}`))}. `
          + `${soCode} is carried by ${stat.core.courseCodes.size} of the ${coreCourseCount} required courses, the ${stat.core.breadth === 'broad' ? 'widest' : 'narrower'} end of the range.`,
        means: 'In each case the outcome statement describes a different kind of demonstration from the indicator it is mapped to. That is a wording-and-evidence observation, not a verdict: the mapping is retained, and the assessed task may well carry the indicator already.',
        consider: `${stat.nextStep} Open the relationships below to see the preserve path offered for each one before any remapping is discussed.`,
        items: items.map(link => `${link.course.course_code} CLO ${link.clo.clo_number} → ${link.piCode}: “${link.clo.clo_text}”`)
      });
    });

    soStats.forEach(stat => {
      if (stat.attention === 'review') return;
      if (stat.core.evidenceReadiness >= EVIDENCE_STRONG) return;
      const below = stat.core.evidenceReadiness < EVIDENCE_PARTIAL;
      const thin = stat.core.links.filter(link => link.evidence !== 'strong');
      const missing = [...new Set(thin.flatMap(link => link.profile.primary_artifacts || []))].map(artifactLabel);
      findings.push({
        priority: below ? 90 : 66, tone: 'watch', so: stat.soCode,
        title: `${stat.soCode} evidence readiness is ${pct(stat.core.evidenceReadiness)}% across the required curriculum`,
        see: `Of ${plural(stat.core.links.length, 'core relationship')}, ${thin.length} rely on an assessment method that is not the artifact type normally used to report the indicator. `
          + `Conceptual alignment for ${stat.soCode} remains ${pct(stat.core.conceptualAlignment)}%, so this is an evidence observation rather than a mapping one.`,
        means: stat.evidenceNote || 'The declared methods can support the mapping, but they are not the carriers these indicators are usually reported from.',
        consider: stat.nextStep,
        items: missing.length ? [`Artifact types that would carry these indicators most directly: ${joinList(missing)}.`] : []
      });
    });

    soStats.forEach(stat => {
      if (stat.attention === 'review' || stat.core.evidenceReadiness < EVIDENCE_STRONG) return;
      if (stat.core.breadth === 'broad') return;
      findings.push({
        priority: 60, tone: 'good', so: stat.soCode,
        title: `${stat.soCode} is carried by ${stat.core.courseCodes.size} of the ${coreCourseCount} required courses`,
        see: `${plural(stat.core.cloKeys.size, 'CLO')} across ${plural(stat.core.courseCodes.size, 'required course')} carry ${stat.core.links.length} relationships, with all ${stat.core.coveredPis} of its ${stat.expectedPis.length} indicators represented.`,
        means: model.breadth?.notes?.[stat.core.breadth] || '',
        consider: stat.nextStep
      });
    });

    soStats.forEach(stat => {
      if (!stat.core.concentrated || stat.attention === 'review') return;
      findings.push({
        priority: 55, tone: 'good', so: stat.soCode,
        title: `${pct(stat.core.relationshipConcentration)}% of ${stat.soCode} relationships sit in ${plural(Math.min(TOP_COURSES, stat.core.perCourse.length), 'required course')}`,
        see: `${joinList(stat.core.perCourse.slice(0, TOP_COURSES).map(item => `${item.code} (${item.count})`))} carry most of this outcome's core relationships, out of ${plural(stat.core.courseCodes.size, 'contributing required course')}.`,
        means: model.concentration?.note || '',
        consider: stat.nextStep
      });
    });

    const thinPis = soStats.flatMap(stat => stat.core.piStats
      .filter(item => item.links.length && item.courses.size <= PI_THIN_COURSES)
      .map(item => ({ stat, item })));
    if (thinPis.length) {
      findings.push({
        priority: 48, tone: 'good',
        title: `${plural(thinPis.length, 'Performance Indicator')} ${verb(thinPis.length, 'is', 'are')} supported by ${PI_THIN_COURSES} or fewer required courses`,
        see: joinList(thinPis.map(entry => `${entry.item.code} (${entry.stat.soCode}) in ${plural(entry.item.courses.size, 'course')}`)) + '.',
        means: 'A smaller number of contributing courses is not a problem in itself. It does mean the assessment plan has fewer options when these indicators come up in the cycle, and that a single course change has a larger effect on them.',
        consider: 'Confirm that at least one of these courses is a stable offering in the terms where the indicator is scheduled for assessment.',
        items: thinPis.map(entry => `${entry.item.code} (${entry.stat.soCode}) — ${joinList([...entry.item.courses])}`)
      });
    }

    const fanOut = [...cloIndex.values()].filter(entry => entry.core && (entry.clo.pi_codes || []).length >= FAN_OUT);
    if (fanOut.length) {
      findings.push({
        priority: 45, tone: 'good',
        title: `${plural(fanOut.length, 'core CLO')} ${verb(fanOut.length, 'is', 'are')} mapped to ${FAN_OUT} or more Performance Indicators`,
        see: joinList(fanOut.map(entry => `${entry.course.course_code} CLO ${entry.clo.clo_number} (${(entry.clo.pi_codes || []).length})`)) + '.',
        means: 'Broad mapping suits an integrative outcome such as a design, laboratory-integration or capstone task, and these are exactly that kind of CLO. The practical question is one of evidence isolation rather than of alignment.',
        consider: 'When one of these CLOs is nominated for assessment, use criterion-level rubric rows so reported attainment stays traceable to one indicator at a time rather than to a single overall mark.',
        items: fanOut.map(entry => `${entry.course.course_code} CLO ${entry.clo.clo_number} — ${plural((entry.clo.pi_codes || []).length, 'indicator')}: “${entry.clo.clo_text}”`)
      });
    }

    const planIssues = soStats.flatMap(stat => stat.planCourses
      .filter(item => !item.inDataset || !item.carriesOutcome)
      .map(item => ({ stat, item })));
    if (planIssues.length) {
      findings.push({
        priority: 40, tone: 'good',
        title: `${plural(planIssues.length, 'course')} nominated in the assessment plan ${verb(planIssues.length, 'needs', 'need')} a quick cross-check`,
        see: joinList(planIssues.map(entry => `${entry.item.code} for ${entry.stat.soCode}`)) + '.',
        means: 'Courses nominated in the program assessment plan are compared with the approved CLO mapping. A mismatch usually means the plan and the mapping were updated at different times rather than that either is wrong.',
        consider: 'Confirm the intended course code against the current curriculum record, so the assessment cycle and the mapping describe the same courses.',
        items: planIssues.map(entry => `${entry.stat.soCode} — ${entry.item.code}: ${!entry.item.inDataset
          ? 'sits outside the Undergraduate EE dataset'
          : 'carries no CLO mapped to this outcome'}`)
      });
    }

    const unclear = [...cloIndex.values()].filter(entry => entry.core && !detectFamilies(entry.clo.clo_text).length);
    if (unclear.length) {
      findings.push({
        priority: 30, tone: 'good',
        title: `${plural(unclear.length, 'core CLO')} ${verb(unclear.length, 'does', 'do')} not surface a distinct demonstration verb`,
        see: joinList(unclear.map(entry => `${entry.course.course_code} CLO ${entry.clo.clo_number}`)) + '.',
        means: 'The statement does not say what kind of demonstration it expects, so the mapping rests on the course team\'s knowledge of the assessed task. This is a wording observation, not a mapping concern.',
        consider: 'A clearer verb, or a one-line rationale in the course file, makes the mapping self-explanatory to a reviewer.',
        items: unclear.map(entry => `${entry.course.course_code} CLO ${entry.clo.clo_number} — “${entry.clo.clo_text}”`)
      });
    }

    const leanest = [...soStats].sort((left, right) => left.core.courseShare - right.core.courseShare).slice(0, 3);
    findings.push({
      priority: 20, tone: 'strong',
      title: allOutcomesRepresented && !soStats.some(stat => stat.core.breadth === 'focused')
        ? 'No core-coverage concern at program level'
        : 'Core coverage overview',
      see: `Every required course carries at least one mapped CLO, ${outcomesRepresented} of ${soStats.length} outcomes and ${corePis.size} of ${Object.keys(indicators).length} indicators appear in the required curriculum, and no outcome falls below the ${pct(MODERATE)}% descriptive coverage threshold.`,
      means: 'Coverage is not the limiting factor for this program. The useful work sits in evidence specificity rather than in adding more mapped relationships.',
      items: leanest.map(stat => `${stat.soCode} — ${stat.core.courseCodes.size} of ${coreCourseCount} required courses (${pct(stat.core.courseShare)}%), ${plural(stat.core.links.length, 'relationship')}`)
    });

    return findings.sort((left, right) => right.priority - left.priority);
  }

  // Program-wide observations (not tied to one outcome) live in Evidence Review; the
  // per-outcome ones are shown inside SO Details.
  function renderProgramObservations() {
    const general = buildFindings().filter(finding => !finding.so);
    el('programObservations').innerHTML = general.length
      ? general.map(findingCard).join('')
      : '<p class="muted">No program-wide observations.</p>';
  }

  // ------------------------------------------------------------------ matrix

  function intensityClass(count) {
    if (!count) return 'lvl-0';
    if (count <= 2) return 'lvl-1';
    if (count <= 5) return 'lvl-2';
    if (count <= 9) return 'lvl-3';
    return 'lvl-4';
  }

  function renderMatrix() {
    const soCodes = soStats.map(stat => stat.soCode);
    const ordered = [...requiredCourses, ...electiveCourses];
    let electiveMarked = false;
    const rows = ordered.map(course => {
      const core = isRequired(course);
      let separator = '';
      if (!core && !electiveMarked) {
        electiveMarked = true;
        separator = `<tr class="matrix-separator"><td colspan="${soCodes.length + 1}">${esc(scopeModel.elective_label || 'Elective enrichment')} — shown for exploration; not counted in core coverage</td></tr>`;
      }
      const cells = soCodes.map(soCode => {
        const count = links.filter(link => link.soCode === soCode && link.course.course_code === course.course_code).length;
        const levels = [...new Set((outcomes[soCode].pis || [])
          .map(code => (course.pi_levels || {})[code]).filter(Boolean))].join('/');
        const label = count
          ? `${course.course_code} (${core ? 'required' : 'elective'}), ${soCode}: ${plural(count, 'CLO to PI relationship')}${levels ? `, performance level ${levels}` : ''}`
          : `${course.course_code}, ${soCode}: no mapped relationship`;
        const inner = count
          ? `<button type="button" class="matrix-hit" data-explore-so="${esc(soCode)}" data-course="${esc(course.course_code)}" data-elective="${core ? 'false' : 'true'}" aria-label="${esc(label)}"><span class="matrix-count">${esc(count)}</span>${levels ? `<span class="matrix-level">${esc(levels)}</span>` : ''}</button>`
          : `<span class="matrix-empty" aria-label="${esc(label)}">·</span>`;
        return `<td class="matrix-cell ${intensityClass(count)}">${inner}</td>`;
      }).join('');
      return `${separator}<tr class="${core ? 'row-core' : 'row-elective'}"><th scope="row" class="matrix-course"><span class="code">${esc(course.course_code)}</span><span class="matrix-course-title">${esc(course.course_title)}</span></th>${cells}</tr>`;
    }).join('');

    el('coverageMatrix').innerHTML = `<table class="matrix-table"><caption class="sr-only">Number of CLO to Performance Indicator relationships each course contributes to each Student Outcome, required courses first</caption><thead><tr><th scope="col" class="matrix-course">Course</th>${soCodes.map(soCode => `<th scope="col" ${definitionAttrs(soCode, outcomes[soCode].statement)}>${esc(soCode)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`;
    el('matrixLegend').innerHTML = `
      <span class="legend-title">CLO → PI relationships per course</span>
      ${[['lvl-0', 'none'], ['lvl-1', '1–2'], ['lvl-2', '3–5'], ['lvl-3', '6–9'], ['lvl-4', '10+']]
        .map(([cls, label]) => `<span class="legend-item"><span class="legend-swatch ${cls}"></span>${esc(label)}</span>`).join('')}
      <span class="legend-item legend-levels">${esc(Object.entries(levelLegend).map(([key, value]) => `${key} = ${value}`).join(' · '))}</span>`;
  }

  // ------------------------------------------------------------- drill-down

  // Explorer filter state, and the single outcome the SO Details tool is showing.
  const state = { so: soStats[0]?.soCode || '', scope: 'core', pi: 'all', status: 'all', query: '', course: '' };
  const detailState = { so: '' };
  const activeScope = stat => state.scope === 'core' ? stat.core : stat.all;

  function filteredLinks(stat) {
    const query = state.query.trim().toLowerCase();
    return activeScope(stat).links.filter(link => {
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
    select.innerHTML = ['<option value="all">All indicators</option>']
      .concat(stat.expectedPis.map(code => `<option value="${esc(code)}">${esc(code)}</option>`)).join('');
    select.value = stat.expectedPis.includes(state.pi) ? state.pi : 'all';
    state.pi = select.value;
  }

  function evidenceBadge(link) {
    const state = dimensions.evidence_readiness?.states?.[link.evidence] || {};
    return `<span class="evidence-badge evidence-${link.evidence}" title="${esc(state.description || '')}">${esc(state.label || link.evidence)}</span>`;
  }

  function linkSummary(link) {
    const piLabel = link.piCode || `${link.soCode} (no indicator named)`;
    return `<span class="link-code">${esc(link.course.course_code)} · CLO ${esc(link.clo.clo_number)}</span>
      <span class="link-pi">${esc(piLabel)}</span>
      <span class="link-text">${esc(link.clo.clo_text)}</span>
      ${statusChip(link.status)}
      ${link.anchorGap ? '' : evidenceBadge(link)}`;
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
      ${dimensionRow(link)}
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
          <p class="muted analysis-aside">${esc(dimensions.evidence_readiness?.caution || '')}</p>
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

  function courseGroupBlock(group) {
    return `
      <details class="course-group course-group-${isRequired(group.course) ? 'core' : 'elective'}">
        <summary>
          <span class="code">${esc(group.course.course_code)}</span>
          <span class="course-group-title">${esc(group.course.course_title)}</span>
          <span class="pill scope-pill-${isRequired(group.course) ? 'core' : 'elective'}">${isRequired(group.course) ? 'Required' : 'Elective'}</span>
          <span class="pill">${esc(plural(group.items.length, 'relationship'))}</span>
          <span class="status-chip-row">${statusChipRow(summariseStatuses(group.items))}</span>
        </summary>
        <div class="course-group-body">
          <p class="course-group-links"><a href="../undergraduate-ee/course-dashboard.html?course=${encodeURIComponent(group.course.course_code)}">Open ${esc(group.course.course_code)} in the Course Dashboard</a></p>
          ${group.items.map(link => `
            <details class="link-row status-edge-${slug(link.status)}" data-link="${esc(link.key)}">
              <summary>${linkSummary(link)}</summary>
              <div class="link-body" data-link-body="${esc(link.key)}"><p class="muted">Opening analysis…</p></div>
            </details>`).join('')}
        </div>
      </details>`;
  }

  function renderDetail() {
    const stat = soByCode.get(state.so);
    const container = el('soDetail');
    const status = el('detailStatus');
    if (!stat) { container.innerHTML = '<div class="alert">Select a Student Outcome to view its analysis.</div>'; return; }
    const scope = activeScope(stat);
    const visible = filteredLinks(stat);
    status.textContent = `${stat.soCode}: ${plural(visible.length, 'CLO to indicator relationship')} shown`
      + `, scope ${state.scope === 'core' ? 'core curriculum' : 'core plus electives'}`
      + `${state.pi === 'all' ? '' : `, indicator ${state.pi}`}`
      + `${state.status === 'all' ? '' : `, status ${statusModel[state.status]?.label || state.status}`}`
      + `${state.course ? `, course ${state.course}` : ''}`
      + `${state.query ? `, search “${state.query}”` : ''}.`;

    const groups = new Map();
    visible.forEach(link => {
      const code = link.course.course_code;
      if (!groups.has(code)) groups.set(code, { course: link.course, items: [] });
      groups.get(code).items.push(link);
    });
    const coreGroups = [...groups.values()].filter(group => isRequired(group.course));
    const electiveGroups = [...groups.values()].filter(group => !isRequired(group.course));

    const piCards = scope.piStats.map(item => `
      <article class="pi-card${state.pi === item.code ? ' is-active' : ''}">
        <header class="pi-card-head">
          <button type="button" class="pi-select" data-select-pi="${esc(item.code)}" aria-pressed="${state.pi === item.code}">${esc(item.code)}</button>
          ${item.rubric ? '<span class="pill rubric-pill" title="An ABET rubric is defined for this indicator in the program framework">Rubric defined</span>' : ''}
        </header>
        <p class="muted pi-statement">${esc(item.statement)}</p>
        ${coverageBar(share(item.links.length, scope.links.length), `${item.links.length} of ${scope.links.length} relationships for ${stat.soCode}`)}
        <p class="pi-metrics">${esc(plural(item.clos.size, 'CLO'))} · ${esc(plural(item.courses.size, 'course'))} · ${esc(plural(item.links.length, 'relationship'))} · evidence readiness ${esc(pct(item.evidenceReadiness))}%</p>
        ${item.guidance ? `<p class="muted pi-guidance"><span class="label">Program guidance</span>${esc(item.guidance)}</p>` : ''}
        <div class="status-chip-row">${statusChipRow(item.statuses)}</div>
        ${item.links.length ? '' : '<p class="so-flag">No CLO is currently mapped to this indicator within this scope.</p>'}
      </article>`).join('');

    const planRows = stat.planCourses.map(item => {
      const label = !item.inDataset ? 'Outside the Undergraduate EE dataset'
        : item.carriesOutcome ? `Carries CLOs mapped to this outcome (${item.isCore ? 'required' : 'elective'})`
          : 'No CLO in this course is mapped to this outcome';
      const tone = !item.inDataset ? 'plan-unknown' : item.carriesOutcome ? 'plan-ok' : 'plan-check';
      return `<li class="${tone}"><span class="code">${esc(item.code)}</span><span>${esc(label)}</span></li>`;
    }).join('');

    container.innerHTML = `
      <article class="so-header so-accent-${slug(stat.soCode)}">
        <div class="so-header-main">
          <span class="so-code">${esc(stat.soCode)}</span>
          <p class="so-statement">${esc(stat.statement)}</p>
        </div>
        <div class="status-chip-row">${statusChipRow(scope.statuses)}</div>
        ${stat.evidenceNote ? `<p class="muted so-evidence-note">${esc(stat.evidenceNote)}</p>` : ''}
        ${stat.illustration ? `<details class="so-illustration"><summary>ABET illustration</summary><p class="muted">${esc(stat.illustration)}</p></details>` : ''}
      </article>

      <div class="so-subgrid">
        <section class="card">
          <h3>Coverage within the ${esc(state.scope === 'core' ? 'required curriculum' : 'whole catalogue')}</h3>
          <p class="muted">${esc(model.breadth?.notes?.[scope.breadth] || '')}</p>
          <ul class="fact-list">
            <li><span>Required courses contributing</span><strong>${esc(stat.core.courseCodes.size)} of ${esc(coreCourseCount)}</strong></li>
            <li><span>Elective courses contributing</span><strong>${esc(stat.elective.courseCodes.size)} of ${esc(electiveCourses.length)}</strong></li>
            <li><span>CLOs mapped (this scope)</span><strong>${esc(scope.cloKeys.size)}</strong></li>
            <li><span>Indicators represented (this scope)</span><strong>${esc(scope.coveredPis)} of ${esc(stat.expectedPis.length)}</strong></li>
            <li><span>Relationship concentration (top ${esc(TOP_COURSES)} courses)</span><strong>${esc(pct(scope.relationshipConcentration))}%</strong></li>
          </ul>
          <p class="${scope.concentrated ? 'so-flag' : 'muted'}">${scope.concentrated
            ? `${esc(pct(scope.relationshipConcentration))}% of the relationships for this outcome sit in ${esc(scope.perCourse.slice(0, TOP_COURSES).map(item => item.code).join(', '))}. ${esc(model.concentration?.note || '')}`
            : esc(model.concentration?.measures === 'share_of_clo_to_pi_relationships'
              ? 'Relationships for this outcome are spread across its contributing courses rather than concentrated in a few. This measures where the mapped relationships are declared, not how much time students spend on the outcome.'
              : '')}</p>
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
          ${state.course || state.query ? '<button type="button" class="btn" id="clearCourseFilter">Clear course and search filters</button>' : ''}
        </div>
        ${coreGroups.length || electiveGroups.length ? '' : '<div class="alert">No relationship matches the current filters.</div>'}
        ${coreGroups.length ? `<h4 class="group-heading">${esc(scopeModel.core_label || 'Core curriculum')} · required courses</h4>${coreGroups.map(courseGroupBlock).join('')}` : ''}
        ${electiveGroups.length ? `<h4 class="group-heading group-heading-elective">${esc(scopeModel.elective_label || 'Elective enrichment')}</h4><p class="muted group-note">${esc(scopeModel.elective_note || '')}</p>${electiveGroups.map(courseGroupBlock).join('')}` : ''}
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

  // Every navigation into an outcome starts from a clean filter state, so a query typed
  // for an earlier outcome cannot silently hide the relationships just asked for.
  // Every entry into the explorer starts from a clean filter state, so a query typed for
  // an earlier outcome cannot silently hide the relationships just asked for.
  function openExplorer(soCode, courseCode, isElective) {
    if (!soByCode.has(soCode)) return;
    state.so = soCode;
    state.course = courseCode || '';
    state.pi = 'all';
    state.status = 'all';
    state.query = '';
    if (isElective === 'true' || isElective === true) state.scope = 'all';
    el('soSelect').value = soCode;
    el('scopeSelect').value = state.scope;
    el('statusSelect').value = 'all';
    el('detailSearch').value = '';
    renderPiSelect(soByCode.get(soCode));
    renderDetail();
  }

  document.addEventListener('click', event => {
    const detailOpener = event.target.closest('[data-open-so]');
    if (detailOpener) { showTool('so-details', { so: detailOpener.dataset.openSo }); return; }
    const explorerOpener = event.target.closest('[data-explore-so]');
    if (explorerOpener) {
      showTool('explorer', {
        so: explorerOpener.dataset.exploreSo,
        course: explorerOpener.dataset.course,
        elective: explorerOpener.dataset.elective
      });
      return;
    }
    const piButton = event.target.closest('[data-select-pi]');
    if (piButton) {
      state.pi = state.pi === piButton.dataset.selectPi ? 'all' : piButton.dataset.selectPi;
      el('piSelect').value = state.pi;
      renderDetail();
      return;
    }
    if (event.target.closest('#clearCourseFilter')) {
      state.course = '';
      state.query = '';
      el('detailSearch').value = '';
      renderDetail();
    }
  });

  // ------------------------------------------------- methodology and reference

  function renderMethodologyScope() {
    el('scopeStatement').textContent = scopeModel.statement || '';
    el('scopeElectiveNote').textContent = scopeModel.elective_note || '';
    const coreClos = requiredCourses.reduce((sum, course) => sum + (course.clos || []).length, 0);
    const allClos = courses.reduce((sum, course) => sum + (course.clos || []).length, 0);
    el('scopeCounts').innerHTML = `<div class="table-wrap"><table><thead><tr><th>Dataset</th><th>${esc(scopeModel.core_label || 'Core curriculum')}</th><th>${esc(scopeModel.elective_label || 'Elective enrichment')}</th><th>Whole catalogue</th></tr></thead><tbody>
        <tr><td>Courses</td><td>${esc(coreCourseCount)}</td><td>${esc(electiveCourses.length)}</td><td>${esc(courses.length)}</td></tr>
        <tr><td>Course learning outcomes</td><td>${esc(coreClos)}</td><td>${esc(allClos - coreClos)}</td><td>${esc(allClos)}</td></tr>
        <tr><td>CLO → PI relationships</td><td>${esc(coreLinks.length)}</td><td>${esc(electiveLinks.length)}</td><td>${esc(links.length)}</td></tr>
        <tr><td>Student Outcomes represented</td><td>${esc(outcomesRepresented)} of ${esc(soStats.length)}</td><td>${esc(soStats.filter(stat => stat.elective.links.length).length)} of ${esc(soStats.length)}</td><td>${esc(soStats.filter(stat => stat.all.links.length).length)} of ${esc(soStats.length)}</td></tr>
        <tr><td>Performance Indicators represented</td><td>${esc(corePis.size)} of ${esc(Object.keys(indicators).length)}</td><td>${esc(new Set(electiveLinks.map(link => link.piCode).filter(Boolean)).size)} of ${esc(Object.keys(indicators).length)}</td><td>${esc(new Set(links.map(link => link.piCode).filter(Boolean)).size)} of ${esc(Object.keys(indicators).length)}</td></tr>
      </tbody></table></div>`;
  }

  function renderStatusDistribution() {
    el('statusDistribution').innerHTML = `
      <p class="muted">${esc(knowledge.program_conclusion?.intro || '')}</p>
      <p class="muted">How the ${esc(coreLinks.length)} relationships in the required curriculum currently fall across the four labels:</p>
      ${statusBar(coreStatuses, coreLinks.length)}
      <div class="status-chip-row">${statusOrder.map(id => statusChip(id, coreStatuses[id])).join('')}</div>`;
  }

  function renderEvidenceReadiness() {
    const ready = coreLinks.filter(link => link.evidence === 'strong').length;
    el('evidenceReadiness').innerHTML = `
      <p class="evidence-lead">A suitable evidence carrier is already declared for <strong>${esc(ready)} of ${esc(coreLinks.length)}</strong> relationships in the required curriculum (${esc(pct(share(ready, coreLinks.length)))}%).</p>
      <div class="evidence-rows">${soStats.map(stat => {
        const value = stat.core.evidenceReadiness;
        const tone = healthTone(value, EVIDENCE_STRONG, EVIDENCE_PARTIAL);
        return `<div class="evidence-row">
          <span class="evidence-row-code">${esc(stat.soCode)}</span>
          <span class="evidence-row-name">${esc(shortName(stat.soCode))}</span>
          ${coverageBar(value, `${stat.soCode} evidence readiness ${pct(value)} per cent`, tone)}
          <span class="evidence-row-value tone-${tone}">${esc(pct(value))}%</span>
          <button type="button" class="so-row-link" data-open-so="${esc(stat.soCode)}">Details<span class="sr-only"> for ${esc(stat.soCode)}</span></button>
        </div>`;
      }).join('')}</div>`;
  }


  function renderDimensionModel() {
    el('dimensionIntro').textContent = dimensions.intro || '';
    el('dimensionModel').innerHTML = ['conceptual_alignment', 'evidence_readiness', 'evidence_specificity']
      .map(id => {
        const dimension = dimensions[id] || {};
        return `<article class="card dimension-card">
          <h3>${esc(dimension.label || id)}</h3>
          <p class="dimension-question">${esc(dimension.question || '')}</p>
          <p class="muted">${esc(dimension.source || '')}</p>
          ${dimension.caution ? `<p class="dimension-caution">${esc(dimension.caution)}</p>` : ''}
          <ul class="dimension-states">${Object.entries(dimension.states || {}).map(([stateId, entry]) =>
            `<li class="tone-${slug(entry.tone)}"><strong>${esc(entry.label)}</strong><span>${esc(entry.description)}</span></li>`).join('')}</ul>
        </article>`;
      }).join('');
    el('statusLegend').innerHTML = statusOrder.map(id => `
      <article class="legend-card status-edge-${slug(id)}">
        <h3>${esc(statusModel[id]?.label || id)}</h3>
        <p class="muted">${esc(statusModel[id]?.definition || '')}</p>
      </article>`).join('');
    el('thresholdNote').textContent = model.threshold_note || '';
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

  function renderChain() {
    el('chainLayers').innerHTML = (knowledge.layers || []).map(layer => `
      <article class="chain-layer layer-${slug(layer.availability)}">
        <span class="layer-state">${esc(layer.availability_label || layer.availability)}</span>
        <h3>${esc(layer.name)}</h3>
        <p class="chain-path">${esc(layer.chain)}</p>
        <p class="muted">${esc(layer.description)}</p>
        <p class="layer-source"><span class="label">Source</span>${esc(layer.source)}</p>
      </article>`).join('');

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

    el('futureModules').innerHTML = (knowledge.future_modules || []).map(module => `
      <article class="card future-module">
        <header class="future-head">
          <h3>Future: ${esc(module.name)}</h3>
          <span class="pill layer-state-pill">${esc(module.status_label || module.status)}</span>
        </header>
        <p class="muted">${esc(module.rationale)}</p>
        <ul class="analysis-list">${(module.questions || []).map(question => `<li>${esc(question)}</li>`).join('')}</ul>
        <p class="muted analysis-aside">${esc(module.note)}</p>
      </article>`).join('');
  }

  function renderPhilosophy() {
    const philosophy = knowledge.philosophy || {};
    el('philosophyStatement').textContent = philosophy.statement || '';
    el('philosophyOrder').innerHTML = (philosophy.order_of_preference || [])
      .map(item => `<li>${esc(item)}</li>`).join('');
    el('philosophyAuthority').textContent = philosophy.authority_note || '';
  }

  // ------------------------------------------------------------- tool router

  const tools = knowledge.tools || [];
  // Panels render on first activation so the Overview stays light and the heavier tools
  // cost nothing until a faculty member asks for them.
  const rendered = new Set();
  let activeTool = '';

  function renderTool(id) {
    if (rendered.has(id)) return;
    rendered.add(id);
    if (id === 'matrix') renderMatrix();
    if (id === 'explorer') { renderControls(); renderPiSelect(soByCode.get(state.so)); renderDetail(); }
    if (id === 'evidence') { renderEvidenceReadiness(); renderProgramObservations(); renderEvidenceQuality(); }
    if (id === 'methodology') {
      renderPhilosophy();
      renderMethodologyScope();
      renderDimensionModel();
      renderStatusDistribution();
      renderChain();
      renderDataSources();
    }
  }

  // A deliberate tool change earns a history entry so Back returns to the previous tool;
  // the first render only syncs the address bar.
  function writeHash(id, soCode, replace) {
    const next = soCode ? `#${id}/${soCode}` : `#${id}`;
    if (location.hash === next) return;
    if (replace) history.replaceState(null, '', next);
    else history.pushState(null, '', next);
  }

  function showTool(id, options = {}) {
    const tool = tools.find(item => item.id === id) ? id : 'overview';
    // Build the panel before applying options: the explorer's controls have to exist
    // before openExplorer can set them.
    renderTool(tool);
    if (tool === 'so-details' && options.so && soByCode.has(options.so)) detailState.so = options.so;
    if (tool === 'explorer' && options.so && soByCode.has(options.so)) {
      openExplorer(options.so, options.course, options.elective);
    } else if (tool === 'explorer' && activeTool !== 'explorer') {
      // Re-entering the tool from the rail drops the drill-down filters, so a course or
      // search term left from an earlier visit cannot hide the relationships on screen.
      state.course = '';
      state.query = '';
      el('detailSearch').value = '';
      renderDetail();
    }
    if (tool === 'so-details') renderSoDetails();

    tools.forEach(item => {
      const selected = item.id === tool;
      const tab = el(`tab-${item.id}`);
      const panel = el(`panel-${item.id}`);
      if (tab) {
        tab.setAttribute('aria-selected', String(selected));
        tab.tabIndex = selected ? 0 : -1;
        tab.classList.toggle('is-active', selected);
      }
      if (panel) panel.hidden = !selected;
    });

    const first = !activeTool;
    const changed = activeTool !== tool;
    activeTool = tool;
    writeHash(tool, tool === 'so-details' ? detailState.so : tool === 'explorer' ? state.so : '', first);
    if (changed && !first) el('toolTabs').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderToolTabs() {
    el('toolTabs').innerHTML = tools.map(tool => `
      <button type="button" role="tab" class="tool-tab" id="tab-${esc(tool.id)}" aria-controls="panel-${esc(tool.id)}" aria-selected="false" tabindex="-1" title="${esc(tool.description || '')}">${esc(tool.label)}</button>`).join('');

    el('toolTabs').addEventListener('click', event => {
      const tab = event.target.closest('[role="tab"]');
      if (tab) showTool(tab.id.replace(/^tab-/, ''));
    });
    // Roving tabindex with the arrow-key behaviour expected of a tablist.
    el('toolTabs').addEventListener('keydown', event => {
      const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
      const index = tools.findIndex(tool => tool.id === activeTool);
      let target = null;
      if (keys[event.key]) target = tools[(index + keys[event.key] + tools.length) % tools.length];
      else if (event.key === 'Home') target = tools[0];
      else if (event.key === 'End') target = tools[tools.length - 1];
      if (!target) return;
      event.preventDefault();
      showTool(target.id);
      el(`tab-${target.id}`).focus();
    });
  }

  function readHash() {
    const [id, soCode] = location.hash.replace(/^#/, '').split('/');
    return { id: id || 'overview', so: soCode || '' };
  }

  // Back and forward move between tools; the hash already matches, so showTool writes
  // nothing further to history.
  window.addEventListener('hashchange', () => {
    const requested = readHash();
    if (requested.id === activeTool && (requested.so === '' || requested.so === detailState.so)) return;
    showTool(requested.id, { so: requested.so });
  });

  // ------------------------------------------------------------------- boot

  function renderDataSources() {
    el('dataSources').textContent = `Analysis scope: required courses only for every program-level conclusion (${coreCourseCount} of ${courses.length} courses). `
      + `Curriculum mapping: data/ee_curriculum.json (consolidated ${curriculum.consolidated_on || 'n/a'}). `
      + `Assessment cycle: data/ee-assessment.json (${plan.assessment_cycle?.name || 'n/a'}). `
      + `Review knowledge layer: data/ee_alignment_evidence.json (${knowledge.status}). `
      + 'No student performance or attainment value is stored or generated by this page.';
  }

  function renderControls() {
    el('soSelect').innerHTML = soStats.map(stat => `<option value="${esc(stat.soCode)}">${esc(stat.soCode)} — ${esc(shortName(stat.soCode))}</option>`).join('');
    el('scopeSelect').innerHTML = `
      <option value="core">${esc(scopeModel.core_label || 'Core curriculum')} (required only)</option>
      <option value="all">Core + ${esc((scopeModel.elective_label || 'Elective enrichment').toLowerCase())}</option>`;
    el('statusSelect').innerHTML = ['<option value="all">All statuses</option>']
      .concat(statusOrder.map(id => `<option value="${esc(id)}">${esc(statusModel[id]?.label || id)}</option>`)).join('');

    el('soSelect').addEventListener('change', event => { openExplorer(event.target.value); writeHash('explorer', state.so); });
    el('scopeSelect').addEventListener('change', event => {
      state.scope = event.target.value;
      state.course = '';
      renderDetail();
    });
    el('piSelect').addEventListener('change', event => { state.pi = event.target.value; renderDetail(); });
    el('statusSelect').addEventListener('change', event => { state.status = event.target.value; renderDetail(); });
    el('detailSearch').addEventListener('input', event => { state.query = event.target.value; renderDetail(); });
    el('scopeSelect').value = state.scope;
  }

  renderScopeBadge();
  renderOverview();
  renderToolTabs();

  // Legacy query-string deep links keep working alongside the new hash routing.
  const requestedSo = portal.getParam('so');
  const requestedCourse = portal.getParam('course');
  const hash = readHash();
  if (requestedSo && soByCode.has(requestedSo)) {
    state.course = requestedCourse || '';
    if (state.course && !requiredCourses.some(course => course.course_code === state.course)) state.scope = 'all';
    showTool(requestedCourse ? 'explorer' : 'so-details', { so: requestedSo, course: requestedCourse });
  } else {
    showTool(hash.id, { so: hash.so });
  }
});
