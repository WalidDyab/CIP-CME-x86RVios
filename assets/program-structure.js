/* Program Structure section on the EE Program Overview page.
 *
 * Every academic value rendered here is read from data/ee_program_structure.json.
 * Nothing about the curriculum is hard-coded in this file: credit totals,
 * category names, course lists, prerequisites, the elective rule, and the
 * study-plan placement all come from the JSON. This module only presents them.
 *
 * It runs independently of the page's inline script, so a data or rendering
 * failure here cannot affect the heatmaps, the textbook/reference tools, or the
 * course browser.
 */
document.addEventListener('DOMContentLoaded', async () => {
  const host = document.getElementById('program-structure-body');
  if (!host) return;

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  };

  const failure = message => {
    const box = el('div', 'alert', message);
    host.replaceChildren(box);
  };

  // --- Course-dashboard link safety ------------------------------------------
  // A course code is only turned into a link when that exact code exists in the
  // canonical curriculum file that course-dashboard.html reads. Anything else
  // (university, college, and other non-EE courses) renders as plain text, so
  // the section can never produce a broken link.
  const loadLinkableCodes = async () => {
    try {
      const curriculum = await portal.loadJSON('../data/ee_curriculum.json');
      const courses = curriculum?.curriculum?.courses;
      if (!Array.isArray(courses)) return new Set();
      return new Set(courses.map(course => course.course_code).filter(Boolean));
    } catch {
      return new Set(); // Degrade to plain text rather than risk a broken link.
    }
  };

  try {
    const [data, linkableCodes] = await Promise.all([
      portal.loadJSON('../data/ee_program_structure.json'),
      loadLinkableCodes()
    ]);

    const categories = data?.credit_distribution?.categories;
    const requirementCategories = data?.requirement_categories;
    const studyPlan = data?.study_plan;
    const declaredTotal = data?.program_summary?.total_credit_hours;

    if (!Array.isArray(categories) || !categories.length ||
        !Array.isArray(requirementCategories) || !requirementCategories.length ||
        !Array.isArray(studyPlan) || !studyPlan.length ||
        typeof declaredTotal !== 'number') {
      throw new Error('ee_program_structure.json is missing the expected program structure fields.');
    }

    const num = value => (Number.isFinite(Number(value)) ? Number(value) : 0);

    // --- Validation -----------------------------------------------------------
    // Confirm the three independent statements of the program total agree before
    // presenting any of them. Discrepancies are surfaced, never silently shown.
    const categoryTotal = categories.reduce((sum, c) => sum + num(c.credit_hours), 0);
    const semesters = studyPlan.flatMap(year =>
      (year.semesters || []).map(semester => ({
        year,
        semester,
        computed: (semester.courses || []).reduce((sum, c) => sum + num(c.credit_hours), 0)
      })));
    const studyPlanTotal = semesters.reduce((sum, s) => sum + s.computed, 0);

    const problems = [];
    if (categoryTotal !== declaredTotal) {
      problems.push(`Requirement categories sum to ${categoryTotal} credits but the program total is stated as ${declaredTotal}.`);
    }
    if (studyPlanTotal !== declaredTotal) {
      problems.push(`The study plan sums to ${studyPlanTotal} credits but the program total is stated as ${declaredTotal}.`);
    }
    for (const { year, semester, computed } of semesters) {
      const stated = semester.brochure_semester_total;
      if (typeof stated === 'number' && stated !== computed) {
        problems.push(`Year ${year.year} ${semester.semester}: courses sum to ${computed} credits but the stated semester total is ${stated}.`);
      }
    }
    for (const category of requirementCategories) {
      // The elective menu legitimately lists more credits than are required,
      // because students take only a subset. Every other category must balance.
      if (category.selection_rule) continue;
      const listed = (category.courses || []).reduce((sum, c) => sum + num(c.credits), 0);
      const stated = num(category.brochure_credit_hours);
      if (listed !== stated) {
        problems.push(`${category.category_name}: listed courses sum to ${listed} credits but the category total is ${stated}.`);
      }
    }

    if (problems.length) {
      console.warn('[program-structure] Credit totals in ee_program_structure.json are inconsistent; ' +
        'displayed totals may be unreliable:\n- ' + problems.join('\n- '));
    }

    const percentOf = credits => (credits / declaredTotal) * 100;
    const formatPercent = credits => `${percentOf(credits).toFixed(1)}%`;
    const categoryNameById = new Map(requirementCategories.map(c => [c.category_id, c.category_name]));
    const displayName = category => categoryNameById.get(category.category_id) || category.course_type || category.category_id;

    const fragment = document.createDocumentFragment();

    if (problems.length) {
      const warning = el('div', 'alert');
      warning.append(el('strong', null, 'Credit totals could not be reconciled.'));
      warning.append(el('p', 'muted', 'The figures below are shown as recorded in the program data, but at least one total does not balance. See the browser console for details.'));
      fragment.append(warning);
    }

    // ------------------------------------------------------ A. At a Glance ---
    const glanceBlock = el('section', 'ps-block');
    glanceBlock.append(el('h3', null, 'Program at a Glance'));

    const glance = el('div', 'ps-glance');

    const totalBox = el('div', 'ps-total');
    totalBox.append(el('div', 'ps-total-number', declaredTotal));
    totalBox.append(el('div', 'ps-total-label', 'Total Credit Hours'));
    glance.append(totalBox);

    const distribution = el('div', 'ps-distribution');

    const semesterCount = semesters.length;
    const barLabel = 'Credit distribution across the six requirement categories: ' +
      categories.map(c => `${displayName(c)} ${c.credit_hours} credits, ${formatPercent(num(c.credit_hours))}`).join('; ') + '.';

    const bar = el('div', 'ps-bar');
    bar.setAttribute('role', 'img');
    bar.setAttribute('aria-label', barLabel);
    for (const category of categories) {
      const credits = num(category.credit_hours);
      const share = percentOf(credits);
      const segment = el('div', 'ps-bar-seg');
      segment.dataset.category = category.category_id;
      segment.style.width = `${share}%`;
      segment.title = `${displayName(category)} — ${credits} credits (${formatPercent(credits)})`;
      // Only the widest segments can hold a legible inline figure; the legend
      // below carries the full text equivalent for every category.
      if (share >= 12) segment.textContent = String(credits);
      bar.append(segment);
    }
    distribution.append(bar);

    const legend = el('ul', 'ps-legend');
    for (const category of categories) {
      const credits = num(category.credit_hours);
      const item = el('li');
      item.dataset.category = category.category_id;
      const swatch = el('span', 'ps-swatch');
      swatch.setAttribute('aria-hidden', 'true');
      item.append(swatch);
      item.append(el('span', 'ps-legend-name', displayName(category)));
      item.append(el('b', null, `${credits} cr`));
      item.append(el('span', null, formatPercent(credits)));
      legend.append(item);
    }
    distribution.append(legend);

    const facts = el('div', 'ps-facts');
    const addFact = (value, label) => {
      const fact = el('div', 'ps-fact');
      fact.append(el('b', null, value));
      fact.append(el('span', null, label));
      facts.append(fact);
    };
    addFact(studyPlan.length, studyPlan.length === 1 ? 'Year' : 'Years');
    addFact(semesterCount, semesterCount === 1 ? 'Semester' : 'Semesters');
    addFact(categories.length, 'Categories');
    distribution.append(facts);

    glance.append(distribution);
    glanceBlock.append(glance);
    fragment.append(glanceBlock);

    // ---------------------------------------------- B. Requirement Breakdown --
    const buildCourseItem = course => {
      const item = el('li', 'ps-course');
      const code = String(course.display_code || course.course_code || '');
      if (linkableCodes.has(code)) {
        const link = el('a', 'ps-code', code);
        link.href = `course-dashboard.html?course=${encodeURIComponent(code)}&layout=full`;
        item.append(link);
      } else {
        item.append(el('span', 'ps-code', code));
      }
      item.append(el('span', 'ps-course-title', course.course_title || ''));
      const credits = num(course.credits);
      item.append(el('span', 'ps-cr', `${credits} cr`));

      const requirements = [];
      const prerequisiteText = String(course.prerequisite_text || '').trim();
      if (prerequisiteText && prerequisiteText !== '-') requirements.push(['Prerequisite: ', prerequisiteText]);
      const corequisiteText = String(course.corequisite_text || '').trim();
      if (corequisiteText) requirements.push(['Co-requisite: ', corequisiteText]);
      for (const [label, value] of requirements) {
        const line = el('span', 'ps-prereq');
        line.append(el('b', null, label));
        line.append(document.createTextNode(value));
        item.append(line);
      }
      return item;
    };

    const categoriesBlock = el('section', 'ps-block');
    categoriesBlock.append(el('h3', null, 'Requirement Breakdown'));
    categoriesBlock.append(el('p', 'ps-block-note', 'Select a category to see the courses it contains. Credit hours, prerequisites, and the elective rule are read from the program data.'));

    const categoryGrid = el('div', 'ps-categories');
    for (const category of requirementCategories) {
      const credits = num(category.brochure_credit_hours);
      const courses = category.courses || [];
      const rule = category.selection_rule;

      const details = el('details', 'ps-cat');
      details.dataset.category = category.category_id;

      const summary = el('summary');
      const heading = el('div');
      heading.append(el('div', 'ps-cat-name', category.category_name || ''));
      const countText = rule
        ? `Choose ${rule.courses_to_select} of ${courses.length} · ${formatPercent(credits)} of program`
        : `${courses.length} ${courses.length === 1 ? 'course' : 'courses'} · ${formatPercent(credits)} of program`;
      heading.append(el('div', 'ps-cat-meta', countText));
      summary.append(heading);

      const creditBox = el('div', 'ps-cat-credits');
      creditBox.append(el('b', null, credits));
      creditBox.append(el('span', null, 'credits'));
      const chevron = el('span', 'ps-chevron');
      chevron.setAttribute('aria-hidden', 'true');
      creditBox.append(chevron);
      summary.append(creditBox);
      details.append(summary);

      const body = el('div', 'ps-cat-body');
      if (rule) {
        const callout = el('div', 'ps-rule');
        const equation = el('strong', null,
          `Select ${rule.courses_to_select} courses × ${rule.credits_per_course} credits = ${rule.total_credits} credits`);
        callout.append(equation);
        if (rule.brochure_statement) callout.append(el('span', 'muted', rule.brochure_statement));
        body.append(callout);
        body.append(el('p', 'ps-menu-label',
          `Approved technical electives — ${courses.length} courses available, ${rule.courses_to_select} required`));
      }
      const list = el('ul', 'ps-courses');
      for (const course of courses) list.append(buildCourseItem(course));
      body.append(list);
      details.append(body);

      categoryGrid.append(details);
    }
    categoriesBlock.append(categoryGrid);
    fragment.append(categoriesBlock);

    // ------------------------------------------------ C. Four-Year Study Plan --
    // Maps every course in the plan back to its requirement category so each row
    // can carry that identity. Elective placeholders declare their own category.
    const categoryOfCourse = new Map();
    for (const category of requirementCategories) {
      for (const course of category.courses || []) {
        categoryOfCourse.set(course.course_code, category.category_id);
      }
    }

    const planBlock = el('section', 'ps-block');
    planBlock.append(el('h3', null, 'Four-Year Study Plan'));
    planBlock.append(el('p', 'ps-block-note', 'The recommended sequence through the degree. Semester totals are taken from the program data.'));

    const planLegendWrap = el('div', 'ps-plan-legend');
    const planLegend = el('ul', 'ps-legend');
    for (const category of categories) {
      const item = el('li');
      item.dataset.category = category.category_id;
      const swatch = el('span', 'ps-swatch');
      swatch.setAttribute('aria-hidden', 'true');
      item.append(swatch);
      item.append(el('span', 'ps-legend-name', displayName(category)));
      planLegend.append(item);
    }
    planLegendWrap.append(planLegend);
    planBlock.append(planLegendWrap);

    const plan = el('div', 'ps-plan');
    for (const year of studyPlan) {
      const yearSemesters = year.semesters || [];
      const yearTotal = yearSemesters.reduce((sum, semester) =>
        sum + (semester.courses || []).reduce((inner, c) => inner + num(c.credit_hours), 0), 0);

      const yearCard = el('section', 'ps-year');
      const yearHead = el('div', 'ps-year-head');
      yearHead.append(el('h4', null, `Year ${year.year}`));
      const yearTotalLabel = el('div', 'ps-year-total');
      yearTotalLabel.append(document.createTextNode('Year total '));
      yearTotalLabel.append(el('b', null, `${yearTotal} credits`));
      yearHead.append(yearTotalLabel);
      yearCard.append(yearHead);

      const semesterGrid = el('div', 'ps-semesters');
      for (const semester of yearSemesters) {
        const courses = semester.courses || [];
        const computed = courses.reduce((sum, c) => sum + num(c.credit_hours), 0);
        const stated = typeof semester.brochure_semester_total === 'number'
          ? semester.brochure_semester_total
          : computed;

        const semesterBox = el('section', 'ps-sem');
        const semesterHead = el('div', 'ps-sem-head');
        semesterHead.append(el('h5', null, semester.semester || ''));
        semesterHead.append(el('span', 'ps-sem-total', `${stated} credits`));
        semesterBox.append(semesterHead);

        const courseList = el('ul', 'ps-sem-courses');
        for (const course of courses) {
          const categoryId = course.elective_category_id || categoryOfCourse.get(course.course_code) || '';
          const row = el('li', 'ps-plan-course');
          if (categoryId) row.dataset.category = categoryId;
          if (course.is_elective_placeholder) row.classList.add('is-placeholder');

          const code = String(course.display_code || course.course_code || '');
          if (linkableCodes.has(code)) {
            const link = el('a', 'ps-code', code);
            link.href = `course-dashboard.html?course=${encodeURIComponent(code)}&layout=full`;
            row.append(link);
          } else {
            row.append(el('span', 'ps-code', code));
          }

          const title = el('span', 'ps-plan-title', course.course_title || '');
          // Category is conveyed as text for assistive technology, so the colored
          // edge is never the only signal.
          const categoryName = categoryNameById.get(categoryId);
          if (categoryName) title.append(el('span', 'ps-sr-only', ` — ${categoryName}`));
          row.append(title);

          row.append(el('span', 'ps-cr', `${num(course.credit_hours)} cr`));
          courseList.append(row);
        }
        semesterBox.append(courseList);
        semesterGrid.append(semesterBox);
      }
      yearCard.append(semesterGrid);
      plan.append(yearCard);
    }
    planBlock.append(plan);
    fragment.append(planBlock);

    host.replaceChildren(fragment);
  } catch (error) {
    console.error('Could not load the program structure:', error);
    failure('The program structure is currently unavailable. The rest of this page is unaffected.');
  }
});
