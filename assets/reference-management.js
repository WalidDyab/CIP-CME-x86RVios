(function (global) {
  'use strict';

  const ROLES = ['Main Textbook', 'Additional Reference 1', 'Additional Reference 2', 'Additional Reference 3'];
  const clean = value => String(value || '').replace(/[{}]/g, '').replace(/\s+/g, ' ').trim();
  const safeCode = value => String(value || 'Course').replace(/[^A-Za-z0-9]+/g, '');
  const pdfSafe = value => String(value || '')
    .replace(/[‘’‚‛]/g, "'").replace(/[“”„‟]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '');

  function parseBibtex(input) {
    const text = String(input || '').trim();
    const type = text.match(/^@([a-zA-Z]+)\s*\{/);
    if (!type) throw new Error('Paste a valid BibTeX entry.');
    if (type[1].toLowerCase() !== 'book') throw new Error('Only @book references are currently supported.');
    const fields = {};
    const pattern = /([a-zA-Z]+)\s*=\s*(?:\{((?:[^{}]|\{[^{}]*\})*)\}|"([^"]*)")\s*,?/g;
    let match;
    while ((match = pattern.exec(text))) fields[match[1].toLowerCase()] = clean(match[2] ?? match[3]);
    return {
      type: 'book', authors: clean(fields.author).replace(/\s+and\s+/gi, ', '), title: clean(fields.title),
      edition: clean(fields.edition), publisher: clean(fields.publisher), year: clean(fields.year),
      isbn: clean(fields.isbn), url: clean(fields.url), location: clean(fields.address || fields.location)
    };
  }

  function formatEdition(value) {
    const edition = clean(value);
    if (!edition) return '';
    if (/\bed\.?$/i.test(edition)) return edition;
    if (/^\d+$/.test(edition)) {
      const number = Number(edition), mod100 = number % 100;
      const suffix = mod100 >= 11 && mod100 <= 13 ? 'th' : ({1:'st',2:'nd',3:'rd'}[number % 10] || 'th');
      return `${number}${suffix} ed.`;
    }
    return `${edition} ed.`;
  }

  function formatBook(book) {
    const parts = [];
    const authors = clean(book?.authors);
    const title = clean(book?.title);
    if (authors) parts.push(authors.replace(/\s*;\s*/g, ', '));
    if (title) parts.push(title);
    const edition = formatEdition(book?.edition);
    if (edition) parts.push(edition);
    const publication = [clean(book?.location), clean(book?.publisher)].filter(Boolean).join(': ');
    if (publication) parts.push(publication);
    if (clean(book?.year)) parts.push(clean(book.year));
    return parts.join(', ').replace(/,+/g, ',').replace(/\s+,/g, ',') + (parts.length ? '.' : '');
  }

  function referenceSlots(course) {
    return [course?.textbooks?.[0] || '', ...(course?.references || []).slice(0, 3), '', '', ''].slice(0, 4)
      .map((current, index) => ({key:index === 0 ? 'main_textbook' : `additional_reference_${index}`, role:ROLES[index], current:String(current || '')}));
  }

  const operationsForSlot = slot => slot.current ? ['Keep', 'Change', 'Remove'] : ['Keep', 'Add'];

  function collectProgramReferences(courses) {
    return (courses || []).flatMap(course => referenceSlots(course).filter(slot => slot.current).map(slot => ({
      courseCode:course.course_code, courseTitle:course.course_title, role:slot.role, citation:slot.current, url:''
    })));
  }

  function validateBook(book) {
    const missing = [['authors','Author(s)'],['title','Book Title'],['publisher','Publisher'],['year','Publication Year']].filter(([key]) => !clean(book[key])).map(([,label]) => label);
    if (missing.length) throw new Error(`Complete: ${missing.join(', ')}.`);
    if (!/^\d{4}$/.test(clean(book.year))) throw new Error('Publication Year must use four digits.');
    if (book.url) { const url = new URL(book.url); if (!['http:','https:'].includes(url.protocol)) throw new Error('Reference URL must use http or https.'); }
    return book;
  }

  function addPdfFrame(doc, title, subtitle) {
    const blue = [20,61,102], width = doc.internal.pageSize.getWidth();
    doc.setFillColor(...blue); doc.rect(0,0,width,27,'F'); doc.setTextColor(255); doc.setFont('helvetica','bold'); doc.setFontSize(16); doc.text(title,14,12);
    doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.text(subtitle,14,19);
    return data => { const page = doc.internal.getCurrentPageInfo().pageNumber, height = doc.internal.pageSize.getHeight(); doc.setFillColor(...blue); doc.rect(0,height-9,width,9,'F'); doc.setTextColor(255); doc.setFontSize(8); doc.text('Undergraduate Electrical Engineering Program',14,height-3.5); doc.text(`Page ${page}`,width-28,height-3.5); };
  }

  function createProposalPdf(context, changes, justification, options={save:true}) {
    if (!global.jspdf?.jsPDF || typeof global.jspdf.jsPDF.API.autoTable !== 'function') throw new Error('PDF generation dependencies are unavailable.');
    const {jsPDF}=global.jspdf, doc=new jsPDF({unit:'mm',format:'a4'}), c=context.normalized, date=new Date().toISOString().slice(0,10);
    const footer=addPdfFrame(doc,'Textbook / Reference Change Request',pdfSafe(`${c.code} - ${c.title}`));
    doc.setTextColor(32); doc.setFontSize(10); doc.text(`Generated: ${date}`,14,35); doc.text('Submitted for Curriculum Committee review and approval',14,41);
    const rows=changes.map(change=>[change.role,change.operation,change.current || '-',change.proposedCitation || '-',justification + (change.proposed?.url ? `\nURL: ${change.proposed.url}` : '')].map(pdfSafe));
    doc.autoTable({startY:47,head:[['Reference Slot','Change','Current Reference','Proposed Reference','Justification']],body:rows,rowPageBreak:'avoid',margin:{left:14,right:14,bottom:16},styles:{fontSize:8,cellPadding:3,overflow:'linebreak',lineColor:[205,210,218],lineWidth:.25},headStyles:{fillColor:[20,61,102],textColor:255},columnStyles:{0:{cellWidth:25},1:{cellWidth:17},2:{cellWidth:48},3:{cellWidth:48},4:{cellWidth:42}},didDrawPage:footer});
    let y=(doc.lastAutoTable?.finalY||47)+8; if(y>260){doc.addPage();y=35;} doc.setFont('helvetica','italic');doc.setFontSize(9);doc.setTextColor(70);doc.text('This document is a proposal only. It does not update approved curriculum records or indicate approval.',14,y,{maxWidth:180});
    for(let page=1;page<=doc.internal.getNumberOfPages();page++){doc.setPage(page);footer();}
    const filename=`${safeCode(c.code)}_Reference_Change_Request.pdf`; if(options.save)doc.save(filename); return {doc,filename};
  }

  function createProgramListPdf(courses, options={save:true}) {
    if (!global.jspdf?.jsPDF || typeof global.jspdf.jsPDF.API.autoTable !== 'function') throw new Error('PDF generation dependencies are unavailable.');
    const rows=collectProgramReferences(courses), {jsPDF}=global.jspdf, doc=new jsPDF({unit:'mm',format:'a4'}), footer=addPdfFrame(doc,'Textbook and Reference List','Undergraduate Electrical Engineering Program');
    doc.setTextColor(50);doc.setFontSize(9);doc.text(`Current approved references generated from the curriculum dataset - ${new Date().toISOString().slice(0,10)}`,14,35);
    doc.autoTable({startY:41,head:[['Course','Course Title','Role','Reference']],body:rows.map(row=>[row.courseCode,row.courseTitle,row.role,row.citation].map(pdfSafe)),rowPageBreak:'avoid',margin:{left:12,right:12,bottom:15},styles:{fontSize:7.5,cellPadding:2.6,overflow:'linebreak',lineColor:[205,210,218],lineWidth:.25},headStyles:{fillColor:[20,61,102],textColor:255},columnStyles:{0:{cellWidth:18,fontStyle:'bold'},1:{cellWidth:42},2:{cellWidth:31},3:{cellWidth:85}},didDrawPage:footer});
    for(let page=1;page<=doc.internal.getNumberOfPages();page++){doc.setPage(page);footer();}
    const filename='Undergraduate_EE_Textbook_and_Reference_List.pdf';if(options.save)doc.save(filename);return {doc,filename,rows};
  }

  function bookFromEditor(editor) { const value=name=>editor.querySelector(`[data-book-field="${name}"]`).value.trim(); return {type:'book',authors:value('authors'),title:value('title'),edition:value('edition'),publisher:value('publisher'),year:value('year'),isbn:value('isbn'),url:value('url'),location:value('location')}; }
  function updatePreview(editor) { const citation=formatBook(bookFromEditor(editor)); editor.querySelector('[data-reference-preview]').textContent=citation||'Complete the book fields to preview the IEEE-style citation.'; }

  function renderModal() {
    const context=global.referenceManagementContext, container=document.getElementById('referenceReviewContent'), slots=referenceSlots(context.course);
    container.innerHTML=`<p class="reference-intro">Compare the current approved book references with proposed changes. This request does not alter curriculum data.</p><div class="reference-slot-list">${slots.map((slot,index)=>{const options=slot.current?['Keep','Change','Remove']:['Keep','Add'];return `<article class="reference-slot" data-slot="${index}"><div class="reference-slot-head"><h3>${slot.role}</h3><label>Proposed action <select class="reference-operation">${options.map(value=>`<option>${value}</option>`).join('')}</select></label></div><div class="reference-current"><strong>CURRENT</strong>${global.portal.esc(slot.current||'No approved reference in this slot.')}</div><div class="reference-editor"><div class="reference-fields"><label class="reference-field">Author(s) *<input data-book-field="authors"></label><label class="reference-field">Book Title *<input data-book-field="title"></label><label class="reference-field">Edition<input data-book-field="edition"></label><label class="reference-field">Publisher *<input data-book-field="publisher"></label><label class="reference-field">Publication Year *<input data-book-field="year" inputmode="numeric"></label><label class="reference-field">ISBN<input data-book-field="isbn"></label><label class="reference-field">Location / City<input data-book-field="location"></label><label class="reference-field">Reference URL<input data-book-field="url" type="url"></label></div><div class="bibtex-row"><label class="reference-field">BibTeX @book import<textarea data-bibtex placeholder="Paste an @book entry to populate the fields"></textarea></label><button class="reference-secondary" data-import-bibtex type="button">Import BibTeX</button></div><span class="reference-error" data-slot-error></span><div class="reference-preview"><strong>PROPOSED - IEEE preview</strong><div data-reference-preview>Complete the book fields to preview the IEEE-style citation.</div></div></div></article>`}).join('')}</div><label class="reference-field reference-wide reference-justification">Justification / Reason for Change *<textarea id="referenceJustification" placeholder="Explain why the proposed reference change is needed."></textarea><span class="reference-error" id="referenceFormError"></span></label><div class="reference-actions"><button class="reference-secondary" id="referenceCancel" type="button">Cancel</button><button class="review-primary" id="generateReferenceProposal" type="button">Generate Change Request PDF</button></div>`;
    container.querySelectorAll('.reference-slot').forEach(slot=>{const select=slot.querySelector('.reference-operation'),editor=slot.querySelector('.reference-editor');const toggle=()=>editor.classList.toggle('visible',['Add','Change'].includes(select.value));select.addEventListener('change',toggle);toggle();editor.querySelectorAll('[data-book-field]').forEach(input=>input.addEventListener('input',()=>updatePreview(editor)));slot.querySelector('[data-import-bibtex]').addEventListener('click',()=>{const error=slot.querySelector('[data-slot-error]');try{const book=parseBibtex(slot.querySelector('[data-bibtex]').value);Object.entries(book).forEach(([key,value])=>{const field=editor.querySelector(`[data-book-field="${key}"]`);if(field)field.value=value;});error.textContent='Book fields imported.';updatePreview(editor);}catch(e){error.textContent=e.message;}});});
    document.getElementById('referenceCancel').addEventListener('click',closeModal);document.getElementById('generateReferenceProposal').addEventListener('click',()=>{const error=document.getElementById('referenceFormError');try{const changes=[];container.querySelectorAll('.reference-slot').forEach((slot,index)=>{const operation=slot.querySelector('.reference-operation').value;if(operation==='Keep')return;const original=slots[index],change={role:original.role,operation,current:original.current};if(['Add','Change'].includes(operation)){change.proposed=validateBook(bookFromEditor(slot.querySelector('.reference-editor')));change.proposedCitation=formatBook(change.proposed);}changes.push(change);});if(!changes.length)throw new Error('Select at least one Add, Change, or Remove operation.');const justification=document.getElementById('referenceJustification').value.trim();if(!justification)throw new Error('Enter a justification for the proposed change.');createProposalPdf(context,changes,justification);error.textContent='Proposal generated. Approved curriculum data was not changed.';}catch(e){error.textContent=e.message;}});
  }
  function openModal(){renderModal();document.getElementById('referenceReviewOverlay').classList.add('visible');document.getElementById('referenceReviewOverlay').setAttribute('aria-hidden','false');document.body.classList.add('review-open');}
  function closeModal(){const overlay=document.getElementById('referenceReviewOverlay');overlay.classList.remove('visible');overlay.setAttribute('aria-hidden','true');document.body.classList.remove('review-open');}
  if(typeof document!=='undefined'){global.addEventListener('open-reference-review',openModal);document.addEventListener('DOMContentLoaded',()=>{document.getElementById('referenceReviewClose')?.addEventListener('click',closeModal);document.getElementById('referenceReviewOverlay')?.addEventListener('click',event=>{if(event.target.id==='referenceReviewOverlay')closeModal();});});}
  const api={ROLES,parseBibtex,formatEdition,formatBook,referenceSlots,operationsForSlot,collectProgramReferences,validateBook,createProposalPdf,createProgramListPdf};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;global.referenceManagement=api;
}(typeof window!=='undefined'?window:globalThis));
