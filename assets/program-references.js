// Read-only viewer for the program-wide textbook and reference list.
//
// Reads exactly the same records the program list PDF is built from
// (referenceManagement.programReferenceGroups -> collectProgramReferences), so the
// popup and the PDF can never drift apart. Presentation only: nothing here writes
// to curriculum data.
//
// A native <dialog> is used rather than the portal's overlay-div modal pattern
// because this is a plain viewer with no form state: showModal() supplies Escape
// handling, focus containment, background inertness and the backdrop for free.
//
// The filter box is type="text" rather than type="search" on purpose: Chrome makes
// Escape clear a search field instead of closing the dialog it sits in.
(function (global) {
  'use strict';

  const esc = value => global.portal.esc(value);

  function referencesCell(citations) {
    if (!citations.length) return '<span class="pref-none">None recorded</span>';
    return `<ol>${citations.map(citation => `<li>${esc(citation)}</li>`).join('')}</ol>`;
  }

  function rowMarkup(group) {
    const main = group.mainTextbook
      ? esc(group.mainTextbook)
      : '<span class="pref-none">Not recorded</span>';
    return `<tr role="row">`
      + `<th role="rowheader" scope="row" class="pref-course"><span class="pref-code">${esc(group.courseCode)}</span><span class="pref-title">${esc(group.courseTitle)}</span></th>`
      + `<td role="cell" class="pref-main" data-label="Main textbook">${main}</td>`
      + `<td role="cell" class="pref-refs" data-label="Additional references">${referencesCell(group.additionalReferences)}</td>`
      + `</tr>`;
  }

  function build(groups) {
    const referenceCount = groups.reduce((total, group) =>
      total + (group.mainTextbook ? 1 : 0) + group.additionalReferences.length, 0);
    const summary = `${referenceCount} references across ${groups.length} courses`;

    const dialog = document.createElement('dialog');
    dialog.className = 'pref-dialog';
    dialog.id = 'programReferenceDialog';
    dialog.setAttribute('aria-labelledby', 'programReferenceTitle');
    dialog.innerHTML = `
      <header class="pref-head">
        <div>
          <span class="kicker">Undergraduate EE</span>
          <h2 id="programReferenceTitle">Textbooks &amp; References</h2>
          <p>The approved main textbook and additional references recorded for each course in the curriculum dataset. Nothing here changes curriculum records.</p>
        </div>
        <button class="pref-close" type="button" data-pref-close aria-label="Close textbooks and references">&times;</button>
      </header>
      <div class="pref-toolbar">
        <input class="pref-search" type="text" placeholder="Filter by course code, title, textbook or author…" aria-label="Filter by course code, course title, textbook or author" aria-controls="programReferenceTable">
        <span class="pref-count" aria-live="polite"></span>
      </div>
      <div class="pref-body">
        <table class="pref-table" id="programReferenceTable" role="table">
          <thead role="rowgroup">
            <tr role="row">
              <th role="columnheader" scope="col" class="pref-course">Course</th>
              <th role="columnheader" scope="col" class="pref-main">Main Textbook</th>
              <th role="columnheader" scope="col" class="pref-refs">Additional References</th>
            </tr>
          </thead>
          <tbody role="rowgroup">${groups.map(rowMarkup).join('')}</tbody>
        </table>
        <p class="pref-empty" hidden>No course matches that search.</p>
      </div>`;
    document.body.appendChild(dialog);

    const search = dialog.querySelector('.pref-search');
    const count = dialog.querySelector('.pref-count');
    const empty = dialog.querySelector('.pref-empty');
    const rows = [...dialog.querySelectorAll('tbody > tr')]
      .map(row => ({ row, text: row.textContent.toLowerCase() }));

    const applyFilter = () => {
      const query = search.value.trim().toLowerCase();
      let visible = 0;
      rows.forEach(entry => {
        const match = !query || entry.text.includes(query);
        entry.row.hidden = !match;
        if (match) visible += 1;
      });
      empty.hidden = visible > 0;
      count.textContent = query ? `${visible} of ${groups.length} courses` : summary;
    };
    applyFilter();
    search.addEventListener('input', applyFilter);

    let opener = null;
    // Leave the viewer the way it was found, and hand focus back to whatever opened it.
    const restore = () => {
      search.value = '';
      applyFilter();
      dialog.querySelector('.pref-body').scrollTop = 0;
      opener?.focus();
    };
    const dismiss = () => { dialog.close(); restore(); };

    dialog.querySelector('[data-pref-close]').addEventListener('click', dismiss);
    // showModal() already closes on Escape; handling the key here as well keeps the
    // behaviour identical when the user closes it that way.
    dialog.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); dismiss(); }
    });
    // Clicks land on the dialog element itself only when they hit the backdrop.
    dialog.addEventListener('click', event => { if (event.target === dialog) dismiss(); });
    dialog.addEventListener('close', restore); // native close path; restore() is idempotent

    return {
      dialog,
      open(trigger) {
        opener = trigger || null;
        dialog.showModal();
        // Focused here rather than via an autofocus attribute: the dialog is built at
        // page load, where Chrome logs "autofocus processing was blocked".
        search.focus();
      }
    };
  }

  // Wires a trigger button to the viewer. Failures stay inside this feature: the
  // trigger is withdrawn and a compact message replaces it, leaving the rest of the
  // page — including the PDF button — untouched.
  function mount({ courses, trigger, errorTarget }) {
    try {
      const groups = global.referenceManagement.programReferenceGroups(courses);
      if (!groups.length) throw new Error('No textbook or reference records were found in the curriculum data.');
      const view = build(groups);
      trigger.addEventListener('click', () => view.open(trigger));
      return view;
    } catch (error) {
      if (trigger) trigger.hidden = true;
      if (errorTarget) errorTarget.innerHTML = `<div class="alert">The textbooks and references view could not be built. ${esc(error.message)}</div>`;
      return null;
    }
  }

  global.programReferences = { mount };
}(typeof window !== 'undefined' ? window : globalThis));
