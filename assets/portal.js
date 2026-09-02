
async function loadJSON(path){const r=await fetch(path,{cache:'no-cache'}); if(!r.ok) throw new Error(path+': '+r.status); return await r.json();}
function byId(id){return document.getElementById(id)}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function badge(s, cls=''){return `<span class="pill ${cls}">${esc(s)}</span>`}
function listText(value){return (Array.isArray(value)?value:[value]).filter(Boolean).join('; ')}
function normCourse(c){return {code:c.code||c.course_code||'',title:c.title||c.course_title||'',track:c.track||c.type||'',credits:c.credits||c.credit_hours||'',re:c.re||c.required_or_elective||'',academicYear:c.year||'',academicLevel:c.level||'',desc:c.description||c.course_description||'',clos:c.clos||[],topics:c.topics||[],prereq:c.prereq||'',coreq:c.coreq||''}}
function countMsc(courses){const clos=courses.flatMap(c=>c.clos||[]); const topics=courses.flatMap(c=>c.topics||[]); return {courses:courses.length, credits:courses.reduce((a,c)=>a+(+c.credits||0),0), clos:clos.length, topics:topics.length, tracks:[...new Set(courses.map(c=>c.track).filter(Boolean))].length}}
function renderStats(el, stats){el.innerHTML=Object.entries(stats).map(([k,v])=>`<div class="card"><div class="stat">${esc(v)}</div><div class="label">${esc(k)}</div></div>`).join('')}
function courseCard(c, linkPrefix='course-dashboard.html?course='){c=normCourse(c); const plos=(c.clos||[]).flatMap(x=>String(x.plos||x.mapped_sos||'').split(/[, ]+/).filter(Boolean)); return `<a class="course-card" href="${linkPrefix}${encodeURIComponent(c.code)}"><div class="code">${esc(c.code)}</div><div class="course-title">${esc(c.title)}</div><div>${badge(c.re||'Course')}${badge(c.track||'General')}${c.credits?badge(c.credits+' cr'):''}</div><p class="desc">${esc(c.desc||((c.clos||[])[0]?.clo_text)||'')}</p></a>`}
function filterCourses(courses,q,track){q=(q||'').toLowerCase(); return courses.filter(c=>{const n=normCourse(c); const text=[n.code,n.title,n.track,n.re,n.desc,JSON.stringify(n.clos)].join(' ').toLowerCase(); return (!q||text.includes(q))&&(!track||track==='All'||n.track===track||n.re===track||`Level ${n.academicLevel}`===track);})}
function setupCourseBrowser(courses, opts={}){let state={q:'',track:'All'}; const list=byId('courseList'), search=byId('search'), track=byId('trackFilter'); const norms=courses.map(normCourse); if(track){const vals=['All',...[...new Set(norms.flatMap(c=>[c.track,c.re,c.academicLevel?`Level ${c.academicLevel}`:'']).filter(Boolean))].sort()]; track.innerHTML=vals.map(v=>`<option>${esc(v)}</option>`).join(''); track.onchange=()=>{state.track=track.value; render()}} if(search){search.oninput=()=>{state.q=search.value; render()}} function render(){const rows=filterCourses(courses,state.q,state.track); byId('resultCount')&&(byId('resultCount').textContent=rows.length+' courses'); list.innerHTML=rows.map(c=>courseCard(c,opts.linkPrefix||'course-dashboard.html?course=')).join('') || '<div class="alert">No matching courses.</div>'} render()}
function renderCLOTable(clos){return `<div class="table-wrap"><table><thead><tr><th>CLO</th><th>Domain</th><th>Outcome</th><th>Mapping</th></tr></thead><tbody>${(clos||[]).map(x=>`<tr><td class="code">CLO ${esc(x.no||x.clo_number||'')}</td><td>${x.nqf_domain?badge(x.nqf_domain):''}</td><td>${esc(x.text||x.clo_text||'')}</td><td>${esc(x.plos||[...(x.mapped_sos||[]),...(x.pi_codes||[])].join(', '))}</td></tr>`).join('')}</tbody></table></div>`}
function renderTopics(topics){return `<div class="table-wrap"><table><thead><tr><th>Topic</th><th>Hours</th></tr></thead><tbody>${(topics||[]).map(t=>`<tr><td>${esc(t.name||'')}</td><td>${esc(t.hours||'')}</td></tr>`).join('')}</tbody></table></div>`}
function getParam(name){return new URLSearchParams(location.search).get(name)}
window.portal={loadJSON,esc,badge,listText,normCourse,countMsc,renderStats,setupCourseBrowser,renderCLOTable,renderTopics,getParam};

async function loadSharedComponents() {
  const scriptSrc = document.querySelector('script[src*="portal.js"]')?.getAttribute('src') || 'assets/portal.js';
  const basePath = scriptSrc.replace('assets/portal.js', '');

  const headerEl = document.getElementById('header-placeholder');
  if (headerEl) {
    try {
      let headerHtml = await fetch(basePath + 'assets/header.html', { cache: 'no-cache' }).then(r => r.text());
      if (basePath) headerHtml = headerHtml.replace(/(src|href)="([^"]+)"/g, (m, a, p) => p.match(/^(?:https?:)?\/\/|^#/) ? m : `${a}="${basePath}${p}"`);
      headerEl.outerHTML = headerHtml;
    } catch (e) { console.error('Failed to load header:', e); }
  }

  const footerEl = document.getElementById('footer-placeholder');
  if (footerEl) {
    try {
      let footerHtml = await fetch(basePath + 'assets/footer.html', { cache: 'no-cache' }).then(r => r.text());
      if (basePath) footerHtml = footerHtml.replace(/(src|href)="([^"]+)"/g, (m, a, p) => p.match(/^(?:https?:)?\/\/|^#/) ? m : `${a}="${basePath}${p}"`);
      footerEl.outerHTML = footerHtml;
    } catch (e) { console.error('Failed to load footer:', e); }
  }
}

document.addEventListener('DOMContentLoaded', loadSharedComponents);
