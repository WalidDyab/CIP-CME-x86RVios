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
 const groups=coursesByTrack(courses,false);
 document.getElementById('trackGrid').innerHTML=Object.entries(groups).map(([t,list])=>{const m=trackMeta(t); return `<div class="track-col"><div class="track-header ${m.theme}"><div class="t-icon">${m.icon}</div><div class="t-title">${esc(t)}</div></div><div class="interest-box"><strong>Is this for you?</strong><p>${esc(m.interest)}</p></div><div class="course-list">${list.map(c=>`<div class="course-card ${m.theme}"><div class="c-header"><span class="c-code">${esc(c.code)}</span><span class="c-ch">${esc(c.credits)} CH</span></div><div class="c-title">${esc(c.title)}</div><div class="c-desc">${esc(c.description)}</div></div>`).join('')}</div></div>`;}).join('');
 const focused=courses.filter(c=>c.track==='Robotics and Automation').slice(0,3);
 const mixed=['EE 542','EE 555','EE 531'].map(code=>courses.find(c=>c.code===code)).filter(Boolean);
 document.getElementById('focusedTags').innerHTML=focused.map(c=>`<span class="pw-tag">${esc(c.code)}: ${esc(c.title)}</span>`).join('');
 document.getElementById('mixedTags').innerHTML=mixed.map(c=>`<span class="pw-tag">${esc(c.code)}: ${esc(c.title)}</span>`).join('');
}
loadCourses().then(render).catch(e=>{document.querySelector('.container').innerHTML='<div class="pathway-section"><div class="pw-title">Could not load JSON</div><p>Use a local server or GitHub Pages.</p></div>'});
