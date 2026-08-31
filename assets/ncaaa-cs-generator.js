(function (global) {
  'use strict';

  const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const W14_NS = 'http://schemas.microsoft.com/office/word/2010/wordml';
  const XML_NS = 'http://www.w3.org/XML/1998/namespace';
  const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const FIXED_VALUES = Object.freeze({
    Program: 'Electrical Engineering',
    Department: 'Communications and Networks Engineering',
    Version: '2',
    Revision_Date: 'Aug-26',
    COUNCIL_COMMITTEE: 'Department Council',
    REFERENCE_NO: '2',
    Date_of_Approval: 'August 2026'
  });
  const CLO_SLOT_BY_CODE = Object.freeze({
    '1.1': 1, '1.2': 2, '1.3': 3,
    '2.1': 4, '2.2': 5, '2.3': 6, '2.4': 7, '2.5': 8,
    '3.1': 9, '3.2': 10, '3.3': 11
  });
  const REQUIRED_GENERAL_FIELDS = Object.freeze([
    'course_code', 'course_title', 'required_or_elective', 'level', 'year',
    'credit_hours', 'course_description'
  ]);

  class ValidationError extends Error { constructor(message) { super(message); this.name = 'ValidationError'; } }
  class ExcludedCourse extends Error { constructor(message) { super(message); this.name = 'ExcludedCourse'; } }

  const elements = (node, namespace, name) => Array.from(node.getElementsByTagNameNS(namespace, name));
  const directChildren = node => Array.from(node.childNodes).filter(child => child.nodeType === 1);
  const cleanList = value => Array.isArray(value)
    ? value.filter(item => item !== null && item !== undefined && String(item).trim()).map(String)
    : [];
  const normalizedCourseCode = value => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const filenameForCourse = code => `${normalizedCourseCode(code)}_NCAAA_Course_Specification.docx`;
  const isCoop = course => String(course.type || '').trim().toUpperCase() === 'COOP';
  const isSeniorDesign = course => String(course.type || '').trim().toLowerCase() === 'capstone';
  const optionalText = (course, textKey, listKey) => {
    const direct = course[textKey];
    return direct !== null && direct !== undefined && String(direct).trim()
      ? String(direct)
      : cleanList(course[listKey]).join('; ');
  };
  const cloCode = value => {
    const number = Number(value);
    if (!Number.isFinite(number)) throw new ValidationError(`invalid CLO code ${JSON.stringify(value)}`);
    return number.toFixed(1);
  };

  function contactHours(course) {
    const credits = Number(course.credit_hours);
    if (!Number.isFinite(credits)) throw new ValidationError('credit_hours is missing or not numeric');
    const requirement = String(course.required_or_elective || '').trim().toLowerCase();
    if (!['required', 'elective'].includes(requirement)) {
      throw new ValidationError(`required_or_elective must be Required or Elective, got ${JSON.stringify(course.required_or_elective)}`);
    }
    if (credits === 4) return [{ LabHrs: '30', TutHrs: '15', TotalCH: '90' }, '4-credit laboratory rule'];
    if (credits === 3 && (requirement === 'elective' || isSeniorDesign(course))) {
      return [{ LabHrs: '', TutHrs: '', TotalCH: '45' }, isSeniorDesign(course) ? '3-credit senior-design rule' : '3-credit elective rule'];
    }
    if (credits === 3 && requirement === 'required') {
      return [{ LabHrs: '', TutHrs: '15', TotalCH: '60' }, '3-credit core/tutorial rule'];
    }
    throw new ValidationError(`no approved contact-hour rule for ${JSON.stringify(course.credit_hours)} credits`);
  }

  function validateAndBuildValues(course) {
    const code = String(course.course_code || '<unknown>');
    if (isCoop(course)) throw new ExcludedCourse('Co-Op/Field Experience uses a different NCAAA template');
    const missing = REQUIRED_GENERAL_FIELDS.filter(key => !String(course[key] || '').trim());
    if (missing.length) throw new ValidationError(`missing required general field(s): ${missing.join(', ')}`);
    const [hours, hoursRule] = contactHours(course);
    const warnings = [];
    const values = Object.assign({}, FIXED_VALUES, {
      Course_Title: String(course.course_title), Course_Code: code,
      Credit_Hours: String(course.credit_hours), Type: String(course.required_or_elective),
      Level: String(course.level), Year: String(course.year),
      Course_Description: String(course.course_description),
      Prereq: optionalText(course, 'prerequisite_text', 'prerequisites'),
      Coreq: optionalText(course, 'corequisite_text', 'corequisites'),
      Textbook: cleanList(course.textbooks).slice(0, 1).join('; ')
    }, hours);

    const objectives = cleanList(course.course_objectives);
    if (objectives.length > 3) warnings.push(`${code}: only the first 3 of ${objectives.length} objectives fit the template`);
    for (let index = 1; index <= 3; index += 1) values[`O${index}`] = objectives[index - 1] || '';
    const references = cleanList(course.references);
    for (let index = 1; index <= 3; index += 1) values[`Ref_${index}`] = references[index - 1] || '';
    for (let index = 1; index <= 11; index += 1) {
      values[`CLO_${index}`] = '';
      values[`MPLO${index}`] = '';
      values[`CLO_${index}_TS`] = '';
      values[`CLO_${index}_AM`] = '';
    }

    const clos = course.clos || [];
    if (clos.length > 11) throw new ValidationError(`contains ${clos.length} CLOs; template capacity is 11`);
    const seenCodes = new Set();
    clos.forEach(clo => {
      const codeValue = cloCode(clo.clo_number);
      if (!CLO_SLOT_BY_CODE[codeValue]) throw new ValidationError(`unsupported CLO code ${codeValue}; no matching NCAAA row`);
      if (seenCodes.has(codeValue)) throw new ValidationError(`duplicate CLO code ${codeValue}`);
      seenCodes.add(codeValue);
      const slot = CLO_SLOT_BY_CODE[codeValue];
      values[`CLO_${slot}`] = String(clo.clo_text || '');
      values[`MPLO${slot}`] = cleanList(clo.mapped_sos).join(', ');
      values[`CLO_${slot}_TS`] = cleanList(clo.teaching_strategy).join('; ');
      values[`CLO_${slot}_AM`] = cleanList(clo.assessment_methods).join('; ');
    });

    const topics = course.course_topics || [];
    if (topics.length > 10) throw new ValidationError(`contains ${topics.length} topics; template capacity is 10`);
    for (let index = 1; index <= 10; index += 1) { values[`Top${index}`] = ''; values[`Top${index}_CH`] = ''; }
    let topicSum = 0;
    topics.forEach((topic, offset) => {
      const index = offset + 1;
      values[`Top${index}`] = String(topic.topic_title || '');
      if (topic.contact_hours === null || topic.contact_hours === undefined || String(topic.contact_hours).trim() === '') {
        warnings.push(`${code}: topic ${index} has no contact_hours`);
      } else {
        const numericHours = Number(topic.contact_hours);
        if (!Number.isFinite(numericHours)) throw new ValidationError(`topic ${index} contact_hours is not numeric`);
        topicSum += numericHours;
        values[`Top${index}_CH`] = String(topic.contact_hours);
      }
    });
    values.TopicHrs = hours.TotalCH;
    if (topicSum !== Number(hours.TotalCH)) warnings.push(`${code}: stored topic hours total ${topicSum}, expected ${hours.TotalCH} under the ${hoursRule}`);
    if (course.total_topic_contact_hours !== null && course.total_topic_contact_hours !== undefined && String(course.total_topic_contact_hours) !== '') {
      const declared = Number(course.total_topic_contact_hours);
      if (!Number.isFinite(declared)) warnings.push(`${code}: total_topic_contact_hours is not numeric`);
      else if (declared !== topicSum) warnings.push(`${code}: declared total_topic_contact_hours ${declared} does not match stored topic sum ${topicSum}`);
    }
    return { values, warnings, hoursRule };
  }

  function fieldName(instruction) {
    const match = /\bMERGEFIELD\s+(?:"([^"]+)"|([^\s\\]+))/i.exec(instruction);
    return match ? (match[1] || match[2]) : null;
  }

  function firstDescendant(node, namespace, name) { return elements(node, namespace, name)[0] || null; }
  function fldCharType(run) {
    const fld = firstDescendant(run, W_NS, 'fldChar');
    return fld ? fld.getAttributeNS(W_NS, 'fldCharType') : null;
  }

  function replacementRun(documentNode, fieldRuns, value) {
    let resultRun = null;
    let separated = false;
    fieldRuns.forEach(run => {
      if (fldCharType(run) === 'separate') separated = true;
      else if (!resultRun && separated && firstDescendant(run, W_NS, 't')) resultRun = run;
    });
    resultRun = resultRun || fieldRuns[0];
    const newRun = documentNode.createElementNS(W_NS, 'w:r');
    const runProperties = directChildren(resultRun).find(child => child.namespaceURI === W_NS && child.localName === 'rPr');
    if (runProperties) newRun.appendChild(runProperties.cloneNode(true));
    const text = documentNode.createElementNS(W_NS, 'w:t');
    if (String(value).startsWith(' ') || String(value).endsWith(' ')) text.setAttributeNS(XML_NS, 'xml:space', 'preserve');
    text.textContent = String(value);
    newRun.appendChild(text);
    return newRun;
  }

  function replaceMergeFields(root, values) {
    const replaced = new Set();
    const containers = [...elements(root, W_NS, 'p'), ...elements(root, W_NS, 'sdtContent')];
    containers.forEach(container => {
      let children = directChildren(container);
      let index = 0;
      while (index < children.length) {
        const child = children[index];
        if (child.namespaceURI !== W_NS || child.localName !== 'r' || fldCharType(child) !== 'begin') { index += 1; continue; }
        let endIndex = index;
        let depth = 0;
        const instructions = [];
        while (endIndex < children.length) {
          const candidate = children[endIndex];
          if (candidate.namespaceURI === W_NS && candidate.localName === 'r') {
            elements(candidate, W_NS, 'fldChar').forEach(fld => {
              const kind = fld.getAttributeNS(W_NS, 'fldCharType');
              if (kind === 'begin') depth += 1;
              else if (kind === 'end') depth -= 1;
            });
            elements(candidate, W_NS, 'instrText').forEach(text => instructions.push(text.textContent));
          }
          if (depth === 0) break;
          endIndex += 1;
        }
        const name = fieldName(instructions.join('').trim());
        if (!name) { index = endIndex + 1; continue; }
        if (!Object.prototype.hasOwnProperty.call(values, name)) throw new ValidationError(`template field ${JSON.stringify(name)} has no supplied value`);
        const oldRuns = children.slice(index, endIndex + 1);
        container.insertBefore(replacementRun(root, oldRuns, values[name]), oldRuns[0]);
        oldRuns.forEach(run => container.removeChild(run));
        replaced.add(name);
        children = directChildren(container);
        index += 1;
      }
    });
    return replaced;
  }

  function setCourseTypeCheckboxes(root, requirement) {
    const desired = {
      University: false, College: false, Program: true, Track: false, Others: false,
      Required: String(requirement).toLowerCase() === 'required',
      Elective: String(requirement).toLowerCase() === 'elective'
    };
    const found = new Set();
    elements(root, W_NS, 'sdt').forEach(control => {
      if (!firstDescendant(control, W14_NS, 'checkbox')) return;
      const paragraph = control.parentNode;
      const paragraphText = elements(paragraph, W_NS, 't').map(node => node.textContent).join('');
      const label = Object.keys(desired).find(candidate => paragraphText.includes(candidate));
      if (!label) return;
      const checked = firstDescendant(control, W14_NS, 'checked');
      const text = firstDescendant(control, W_NS, 't');
      if (!checked || !text) throw new ValidationError(`checkbox ${label} is structurally incomplete`);
      checked.setAttributeNS(W14_NS, 'w14:val', desired[label] ? '1' : '0');
      text.textContent = desired[label] ? '☒' : '☐';
      found.add(label);
    });
    const missing = Object.keys(desired).filter(label => !found.has(label));
    if (missing.length) throw new ValidationError(`template checkbox controls not found: ${missing.sort().join(', ')}`);
  }

  function keepApprovalRowsTogether(root) {
    const table = elements(root, W_NS, 'tbl').find(candidate => {
      const text = elements(candidate, W_NS, 't').map(node => node.textContent).join(' ').toUpperCase();
      return text.includes('DEPARTMENT COUNCIL') && text.includes('AUGUST 2026');
    });
    if (!table) throw new ValidationError('specification approval table not found');
    const rows = directChildren(table).filter(child => child.namespaceURI === W_NS && child.localName === 'tr');
    rows.slice(0, -1).forEach(row => {
      let trPr = directChildren(row).find(child => child.namespaceURI === W_NS && child.localName === 'trPr');
      if (!trPr) { trPr = root.createElementNS(W_NS, 'w:trPr'); row.insertBefore(trPr, row.firstChild); }
      if (!firstDescendant(trPr, W_NS, 'cantSplit')) trPr.appendChild(root.createElementNS(W_NS, 'w:cantSplit'));
      elements(row, W_NS, 'p').forEach(paragraph => {
        let pPr = directChildren(paragraph).find(child => child.namespaceURI === W_NS && child.localName === 'pPr');
        if (!pPr) { pPr = root.createElementNS(W_NS, 'w:pPr'); paragraph.insertBefore(pPr, paragraph.firstChild); }
        if (!firstDescendant(pPr, W_NS, 'keepNext')) pPr.appendChild(root.createElementNS(W_NS, 'w:keepNext'));
      });
    });
  }

  function patchDocumentXml(xmlText, values, requirement) {
    if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') throw new ValidationError('This browser does not provide the required XML APIs');
    const root = new DOMParser().parseFromString(xmlText, 'application/xml');
    if (elements(root, 'http://www.mozilla.org/newlayout/xml/parsererror.xml', 'parsererror').length || elements(root, '*', 'parsererror').length) {
      throw new ValidationError('The Word template XML could not be parsed');
    }
    const replaced = replaceMergeFields(root, values);
    const missing = Object.keys(values).filter(name => !replaced.has(name)).sort();
    if (missing.length) throw new ValidationError(`expected merge field(s) not found: ${missing.join(', ')}`);
    setCourseTypeCheckboxes(root, requirement);
    keepApprovalRowsTogether(root);
    const output = new XMLSerializer().serializeToString(root);
    if (/MERGEFIELD|«|»/.test(output)) throw new ValidationError('unresolved merge-field content remains in word/document.xml');
    return output;
  }

  async function generateDocxBlob(course, templateUrl) {
    if (!global.JSZip) throw new ValidationError('The local DOCX ZIP library is unavailable');
    const response = await fetch(templateUrl, { credentials: 'same-origin' });
    if (!response.ok) throw new ValidationError(`Could not load the NCAAA Word template (${response.status})`);
    const templateBytes = await response.arrayBuffer();
    const zip = await global.JSZip.loadAsync(templateBytes);
    const documentPart = zip.file('word/document.xml');
    if (!documentPart) throw new ValidationError('The Word template is missing word/document.xml');
    const built = validateAndBuildValues(course);
    const xml = await documentPart.async('string');
    zip.file('word/document.xml', patchDocumentXml(xml, built.values, course.required_or_elective));
    const blob = await zip.generateAsync({ type: 'blob', mimeType: DOCX_MIME, compression: 'DEFLATE' });
    return { blob, filename: filenameForCourse(course.course_code), warnings: built.warnings, hoursRule: built.hoursRule };
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = filename; link.hidden = true;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function generateAndDownload(course, templateUrl) {
    const result = await generateDocxBlob(course, templateUrl);
    downloadBlob(result.blob, result.filename);
    return result;
  }

  const api = {
    CLO_SLOT_BY_CODE, ValidationError, ExcludedCourse, cleanList, cloCode,
    normalizedCourseCode, filenameForCourse, isCoop, contactHours,
    validateAndBuildValues, fieldName, patchDocumentXml, generateDocxBlob,
    generateAndDownload
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.ncaaaCsGenerator = api;
}(typeof window !== 'undefined' ? window : globalThis));
