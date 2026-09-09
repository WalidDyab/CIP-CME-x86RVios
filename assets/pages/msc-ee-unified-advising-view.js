const DATA_URL = '../data/msc_ee_courses_full.json';
async function loadCourses(){
  const res = await fetch(DATA_URL);
  if(!res.ok) throw new Error('Could not load '+DATA_URL);
  return await res.json();
}
function esc(s){return String(s ?? '').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function uniq(a){return [...new Set(a.filter(Boolean))];}
function trackMeta(track){
  const map={
    'Electrical Power and Energy systems':{icon:'⚡',theme:'track-theme-power',interest:'You are interested in smart grids, renewable energy integration, hydrogen technologies, reliability, control, and electric drives.',short:'Smart grids, renewable integration, hydrogen technologies, drives, and energy sustainability.',tags:['Renewables','Smart Grid','Hydrogen']},
    'Intelligent Communications and Networks':{icon:'📡',theme:'track-theme-communications',interest:'You are interested in 5G/6G, wireless communications, optical networks, digital signal processing, and advanced protocols.',short:'Wireless systems, optical links, DSP, digital communications, and advanced networks.',tags:['5G/6G','DSP','Networks']},
    'Robotics and Automation':{icon:'🤖',theme:'track-theme-robotics',interest:'You are interested in automation, robotics, navigation, localization, ROS, computer vision, and intelligent control.',short:'Autonomous systems, ROS, navigation, digital twins, and intelligent perception.',tags:['ROS2','Navigation','Vision']},
    'Embedded systems and IoT':{icon:'🧠',theme:'track-theme-embedded',interest:'You are interested in embedded intelligence, IoT systems, edge AI, cybersecurity, sensor fusion, and smart connected devices.',short:'Embedded intelligence, edge AI, IoT systems, sensor fusion, and secure connected systems.',tags:['IoT','Edge AI','Sensors']},
    'Core':{icon:'📘',theme:'track-theme-core',interest:'Required foundation courses supporting research, modelling, embedded systems, mathematics, and graduate research practice.',short:'Graduate foundations in mathematics, modelling, embedded systems, and research methods.',tags:['Required','Foundation','Research']}
  };
  return map[track] || {icon:'📚',theme:'track-theme-other',interest:'Courses grouped under this focus area.',short:'Specialized MSc EE course group.',tags:['MSc EE']};
}
function coursesByTrack(courses, includeCore=false){
  const groups={};
  courses.forEach(c=>{ if(includeCore || c.track !== 'Core') (groups[c.track] ||= []).push(c); });
  return groups;
}

function render(courses){
 const tracks=Object.keys(coursesByTrack(courses,false));
 document.getElementById('heroStats').innerHTML=`<div class="stat"><div class="num">${tracks.length}</div><div class="lbl">Focus Areas</div></div><div class="stat"><div class="num">${courses.length}</div><div class="lbl">Courses</div></div><div class="stat"><div class="num">2</div><div class="lbl">Path Models</div></div><div class="stat"><div class="num">∞</div><div class="lbl">Theme Combinations</div></div>`;
 document.getElementById('trackGrid').innerHTML=tracks.map(t=>{const m=trackMeta(t); const list=courses.filter(c=>c.track===t).slice(0,3); return `<article class="panel track ${m.theme}"><div class="track-head"><div class="icon">${m.icon}</div><h4>${esc(t)}</h4><p>${esc(m.short)}</p></div><div class="track-body"><div class="pillrow">${m.tags.map(x=>`<span class="pill">${esc(x)}</span>`).join('')}</div><div class="course-list">${list.map(c=>`<div class="course-item">${esc(c.code)} — ${esc(c.title)}<span>${esc((c.description||'').slice(0,90))}...</span></div>`).join('')}</div></div></article>`;}).join('');
 const robotics=courses.filter(c=>c.track==='Robotics and Automation').slice(0,3);
 const mixed=['EE 542','EE 555','EE 531'].map(code=>courses.find(c=>c.code===code)).filter(Boolean);
 document.getElementById('focusedPath').innerHTML=robotics.map(c=>`<span class="badge">${esc(c.code)}: ${esc(c.title)}</span>`).join('');
 document.getElementById('mixedPath').innerHTML=mixed.map(c=>`<span class="badge">${esc(c.code)}: ${esc(c.title)}</span>`).join('');
}
loadCourses().then(render).catch(e=>{document.querySelector('main').insertAdjacentHTML('afterbegin',`<div class="note">Could not load JSON. Run with <code>python -m http.server 8000</code> or publish to GitHub Pages.</div>`)});
