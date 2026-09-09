document.addEventListener('DOMContentLoaded', async () => {
      try {
        const data = await portal.loadJSON('../data/ee_curriculum.json');
        const courses = data.curriculum.courses || [];
        // The viewer is optional: if its module is missing, the section degrades to the
        // PDF button rather than taking the rest of the page down with it.
        if (window.programReferences) {
          window.programReferences.mount({ courses, trigger: byId('viewTextbookList'), errorTarget: byId('textbookListError') });
        } else {
          byId('viewTextbookList').hidden = true;
          byId('textbookListError').innerHTML = '<div class="alert">The textbooks and references view is unavailable.</div>';
        }
        byId('generateTextbookList').addEventListener('click', () => {
          const status = byId('textbookListStatus');
          try {
            window.referenceManagement.createProgramListPdf(courses);
            status.textContent = 'Textbook and reference list generated.';
          } catch (error) {
            status.textContent = error.message || 'The textbook and reference list could not be generated.';
          }
        });
        const mappingCourses = courses;
        const curriculumByCode = new Map(courses.map(course => [course.course_code, course]));
        const courseList = byId('courseList');
        const search = byId('search');
        const trackFilter = byId('trackFilter');
        const normalizedCourses = courses.map(course => ({ raw: course, normalized: portal.normCourse(course) }));
        const filterValues = ['All', ...new Set(normalizedCourses.flatMap(({ normalized }) => [normalized.track, normalized.re, normalized.academicLevel ? `Level ${normalized.academicLevel}` : '']).filter(Boolean))].sort();
        trackFilter.innerHTML = filterValues.map(value => `<option>${portal.esc(value)}</option>`).join('');
        const specialTypes = new Set(['Capstone', 'COOP']);
        const availableValue = value => {
          const text = String(value ?? '').trim();
          return text && text !== '0' ? text : '';
        };
        const courseCard = ({ raw, normalized: course }) => {
          const year = availableValue(raw.year);
          const level = availableValue(raw.level);
          const yearLevel = [year ? `Year ${year}` : '', level ? `Level ${level}` : ''].filter(Boolean).join(' / ');
          const prerequisite = raw.prerequisite_text || 'None';
          const corequisite = course.code === 'EE 490' && raw.corequisite_text ? raw.corequisite_text : '';
          const description = raw.course_description || 'Description not available';
          const requirements = `<div class="overview-card-requirements${corequisite ? ' has-corequisite' : ''}"><p class="overview-card-requirement" title="${portal.esc(prerequisite)}"><strong>Prerequisite:</strong> ${portal.esc(prerequisite)}</p>${corequisite ? `<p class="overview-card-requirement" title="${portal.esc(corequisite)}"><strong>Co-requisite:</strong> ${portal.esc(corequisite)}</p>` : ''}</div>`;
          return `<a class="course-card" href="course-dashboard.html?course=${encodeURIComponent(course.code)}&layout=full"><div class="code">${portal.esc(course.code)}</div><div class="course-title" title="${portal.esc(course.title)}">${portal.esc(course.title)}</div><div class="overview-card-badges">${portal.badge(course.re || 'Course')}${portal.badge(course.track || 'General')}${yearLevel ? portal.badge(yearLevel) : ''}${course.credits ? portal.badge(course.credits + ' cr') : ''}</div>${requirements}<p class="desc" title="${portal.esc(description)}">${portal.esc(description)}</p></a>`;
        };
        const courseGroup = (title, group, special = false) => group.length ? `<section class="overview-course-group"><h3>${portal.esc(title)}</h3><div class="overview-course-grid${special ? ' overview-special-grid' : ''}">${group.map(courseCard).join('')}</div></section>` : '';
        const renderCourseGroups = () => {
          const query = search.value.toLowerCase();
          const selectedFilter = trackFilter.value;
          const visible = normalizedCourses.filter(({ normalized: course }) => {
            const text = [course.code, course.title, course.track, course.re, course.desc, JSON.stringify(course.clos)].join(' ').toLowerCase();
            return (!query || text.includes(query)) && (selectedFilter === 'All' || course.track === selectedFilter || course.re === selectedFilter || `Level ${course.academicLevel}` === selectedFilter);
          });
          const required = visible.filter(({ normalized: course }) => course.re === 'Required' && !specialTypes.has(course.track));
          const special = visible.filter(({ normalized: course }) => course.re === 'Required' && specialTypes.has(course.track));
          const electives = visible.filter(({ normalized: course }) => course.re === 'Elective');
          byId('resultCount').textContent = visible.length + ' courses';
          courseList.innerHTML = [
            courseGroup('Required Courses', required),
            courseGroup('Senior Design and Capstone', special, true),
            courseGroup('Program Electives', electives)
          ].join('') || '<div class="alert">No matching courses.</div>';
        };
        search.addEventListener('input', renderCourseGroups);
        trackFilter.addEventListener('change', () => setTimeout(renderCourseGroups, 0));
        renderCourseGroups();

        const piDefinitions = data.abet?.performance_indicators || {};
        const soDefinitions = data.abet?.student_outcomes || {};
        const pis = Object.keys(piDefinitions);
        const soPIs = Object.fromEntries(Object.entries(soDefinitions).map(([so, definition]) => [so, definition.pis || []]));
        const sos = Object.keys(soPIs);
        const courseCell = course => `<td class="course-column" title="${portal.esc(course.course_title)}"><strong>${portal.esc(course.course_code)}</strong></td>`;
        const renderTable = (columns, cellRenderer, headerRows = '', headerClass = () => '') => {
          let html = `<div class="heatmap-wrap"><table class="heatmap-table"><thead>${headerRows}<tr>${headerRows ? '' : '<th class="course-column">Course</th>'}`;
          columns.forEach(column => html += `<th class="${headerClass(column)}">${portal.esc(column)}</th>`);
          html += '</tr></thead><tbody>';
          let electiveSeparatorAdded = false;
          mappingCourses.forEach(course => {
            const classification = curriculumByCode.get(course.course_code)?.required_or_elective;
            if (!electiveSeparatorAdded && classification === 'Elective') {
              html += `<tr class="elective-separator"><td colspan="${columns.length + 1}">PROGRAM ELECTIVE COURSES</td></tr>`;
              electiveSeparatorAdded = true;
            }
            html += `<tr>${courseCell(course)}`;
            columns.forEach(column => html += cellRenderer(course, column));
            html += '</tr>';
          });
          return html + '</tbody></table></div>';
        };
        const renderHeatmaps = () => {
          const piGroupHeader = `<tr class="so-group-row"><th class="course-column" rowspan="2">Course</th>${sos.map(so => `<th class="so-${so.toLowerCase()}" colspan="${soPIs[so].length}">${so}</th>`).join('')}</tr>`;
          byId('piHeatmapContainer').innerHTML = renderTable(pis, (course, pi) => {
            const level = (course.pi_levels || {})[pi] || '';
            return level ? `<td class="pi-${pi.toLowerCase()}">${portal.esc(level)}</td>` : '<td class="cell-unmapped"></td>';
          }, piGroupHeader, pi => `pi-${pi.toLowerCase()}`);
          byId('soHeatmapContainer').innerHTML = renderTable(sos, (course, so) => {
            const levelsByPI = soPIs[so].filter(pi => (course.pi_levels || {})[pi]).map(pi => [pi, course.pi_levels[pi]]);
            if (!levelsByPI.length) return '<td class="cell-unmapped"></td>';
            const levels = [...new Set(levelsByPI.map(([, level]) => level))].sort((a, b) => ['I', 'P', 'M'].indexOf(a) - ['I', 'P', 'M'].indexOf(b));
            const details = levelsByPI.map(([pi, level]) => `${pi}=${level}`).join(', ');
            return `<td class="so-${so.toLowerCase()}${levels.length > 1 ? ' cell-mixed' : ''}" title="${portal.esc(details)}">${portal.esc(levels.join(' / '))}</td>`;
          }, '', so => `so-${so.toLowerCase()}`);
        };

        const exportHeatmapPng = async (containerId, title, filename, exportButton) => {
          const table = byId(containerId).querySelector('table');
          if (!table) return;
          const originalText = exportButton.textContent;
          exportButton.disabled = true;
          exportButton.textContent = 'Exporting...';
          try {
            const exportSurface = document.createElement('div');
            exportSurface.className = 'heatmap-export-surface';
            exportSurface.innerHTML = `<h2>${portal.esc(title)}</h2>`;
            exportSurface.appendChild(table.cloneNode(true));
            document.body.appendChild(exportSurface);
            const exportTable = exportSurface.querySelector('table');
            const tableRect = exportTable.getBoundingClientRect();
            const margin = 28;
            const titleHeight = 48;
            const width = Math.ceil(tableRect.width + margin * 2);
            const height = Math.ceil(tableRect.height + margin * 2 + titleHeight);
            const scale = 2;
            const exportCanvas = document.createElement('canvas');
            exportCanvas.width = width * scale;
            exportCanvas.height = height * scale;
            const context = exportCanvas.getContext('2d');
            context.scale(scale, scale);
            context.fillStyle = '#ffffff';
            context.fillRect(0, 0, width, height);
            context.fillStyle = '#111111';
            context.font = '700 22px Arial, sans-serif';
            context.textAlign = 'left';
            context.textBaseline = 'middle';
            context.fillText(title, margin, margin + 12);
            exportTable.querySelectorAll('th, td').forEach(cell => {
              const rect = cell.getBoundingClientRect();
              const style = getComputedStyle(cell);
              const x = margin + rect.left - tableRect.left;
              const y = margin + titleHeight + rect.top - tableRect.top;
              context.fillStyle = style.backgroundColor;
              context.fillRect(x, y, rect.width, rect.height);
              context.strokeStyle = '#333333';
              context.lineWidth = 1;
              context.strokeRect(x + .5, y + .5, rect.width - 1, rect.height - 1);
              context.fillStyle = style.color;
              context.font = `${style.fontWeight} ${style.fontSize} Arial, sans-serif`;
              context.textBaseline = 'middle';
              const separator = cell.parentElement.classList.contains('elective-separator');
              context.textAlign = separator ? 'left' : 'center';
              const textX = separator ? x + 8 : x + rect.width / 2;
              context.fillText(cell.textContent.trim(), textX, y + rect.height / 2);
            });
            exportSurface.remove();
            const link = document.createElement('a');
            link.download = filename;
            link.href = exportCanvas.toDataURL('image/png');
            link.click();
            exportButton.dataset.exportWidth = String(exportCanvas.width);
            exportButton.dataset.exportHeight = String(exportCanvas.height);
            exportButton.dataset.exportStatus = 'complete';
          } catch (error) {
            document.querySelector('.heatmap-export-surface')?.remove();
            exportButton.dataset.exportStatus = 'failed';
            exportButton.dataset.exportError = error.message;
            alert(`PNG export failed: ${error.message}`);
          } finally {
            exportButton.disabled = false;
            exportButton.textContent = originalText;
          }
        };

        let heatmapRendered = false;
        const button = byId('toggleHeatmapBtn');
        const section = byId('heatmapSection');
        button.addEventListener('click', () => {
          const opening = section.classList.contains('hidden');
          section.classList.toggle('hidden');
          button.textContent = opening ? 'Hide Heatmaps' : 'Show Heatmaps';
          if (opening && !heatmapRendered) {
            renderHeatmaps();
            byId('exportPiBtn').addEventListener('click', event => exportHeatmapPng('piHeatmapContainer', 'Undergraduate EE PI Heatmap', 'EE_PI_Heatmap.png', event.currentTarget));
            byId('exportSoBtn').addEventListener('click', event => exportHeatmapPng('soHeatmapContainer', 'Undergraduate EE SO Heatmap', 'EE_SO_Heatmap.png', event.currentTarget));
            heatmapRendered = true;
          }
        });
      } catch (error) {
        console.error(error);
        byId('courseList').innerHTML = '<div class="alert">Could not load or validate the undergraduate mapping data.</div>';
      }
    });
