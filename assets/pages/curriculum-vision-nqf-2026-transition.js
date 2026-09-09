const soOrder=['SO1','SO2','SO3','SO4','SO5','SO6','SO7'];
    const statusClass=s=>'badge-'+String(s).toLowerCase().replace(/\s*\/\s*|\s+/g,'-');
    const dObj=d=>({id:d[0],domain:d[1],subdomain:d[2],title:d[3],descriptor:d[4]});
    function renderFramework(title,rows,cls){return `<article class="framework-card ${cls}"><h3>${portal.esc(title)}</h3>${rows.map(g=>`<h4>${portal.esc(g.domain)}</h4><ul>${g.items.map(i=>`<li>${portal.esc(i)}</li>`).join('')}</ul>`).join('')}</article>`}
    function mark(v){if(v==='Primary')return'<td class="mark-primary">P</td>';if(v==='Supporting')return'<td class="mark-supporting">S</td>';return'<td></td>'}
    document.addEventListener('DOMContentLoaded',async()=>{
      const nqf=await portal.loadJSON('../data/nqf_2026_alignment.json');
      const layerNames=['National','Institutional','Program','Course','Evidence'];
      byId('alignmentFlow').innerHTML=nqf.alignment_layers.map((layer,i)=>`<div class="flow-node"><span>${layerNames[i]}</span><strong>${portal.esc(layer)}</strong></div>`).join('');
      byId('frameworkCompare').innerHTML=renderFramework('OLD NQF — 2023 PSU implementation',nqf.old_nqf_2023,'old')+renderFramework('NEW NQF — 2026 Third Edition',nqf.new_nqf_2026,'new');
      const domainClass=d=>d==='Knowledge'?'domain-knowledge':d==='Values'?'domain-values':'domain-skills';
      const transitionDomain=r=>/Values|Autonomy|Responsibility/i.test(r.old+' '+r.new)?'Values':/Knowledge/i.test(r.old+' '+r.new)?'Knowledge':'Skills';
      byId('transitionRows').innerHTML=['Knowledge','Skills','Values'].map(domain=>`<tr class="domain-band ${domainClass(domain)}"><th colspan="4">${portal.esc(domain)}</th></tr>`+nqf.transition_map.filter(r=>transitionDomain(r)===domain).map(r=>`<tr><td>${portal.esc(r.old)}</td><td>${portal.esc(r.new)}</td><td>${r.transition.map(s=>portal.badge(s,statusClass(s))).join(' ')}</td><td>${portal.esc(r.note)}</td></tr>`).join('')).join('');
      const descriptors=nqf.descriptors.map(dObj), descriptorById=Object.fromEntries(descriptors.map(d=>[d.id,d]));
      const majorDomain=d=>d.domain==='Knowledge'?'Knowledge':d.domain==='Values'?'Values':'Skills';
      let lastDescriptorDomain='',lastDescriptorSubdomain='';
      byId('descriptorRows').innerHTML=descriptors.map(d=>{const domain=majorDomain(d),subdomain=domain==='Skills'?d.domain:'';let bands='';if(domain!==lastDescriptorDomain){bands+=`<tr class="domain-band ${domainClass(domain)}"><th colspan="5">${portal.esc(domain)}</th></tr>`;lastDescriptorDomain=domain;lastDescriptorSubdomain=''}if(subdomain&&subdomain!==lastDescriptorSubdomain){bands+=`<tr class="subdomain-band"><th colspan="5">${portal.esc(subdomain)}</th></tr>`;lastDescriptorSubdomain=subdomain}return bands+`<tr><td><span class="descriptor-id">${portal.esc(d.id)}</span></td><td>${portal.esc(domain)}</td><td>${portal.esc(d.domain==='Knowledge'||d.domain==='Values'?(d.subdomain||'—'):d.domain+(d.subdomain?' · '+d.subdomain:''))}</td><td><strong>${portal.esc(d.title)}</strong></td><td>${portal.esc(d.descriptor)}</td></tr>`}).join('');
      const iloNames=Object.fromEntries(nqf.psu_ilos.map(i=>[i[0],`${i[1]} / ${i[0]} — ${i[2]}`]));
      byId('iloRows').innerHTML=nqf.ilo_mapping.map(r=>`<tr><td>${portal.esc(r.nqf)}</td><td>${r.ilo.map(i=>portal.badge(iloNames[i]||i)).join(' ')}</td><td>${portal.badge(r.strength,statusClass(r.strength))}</td><td>${portal.esc(r.interpretation)}</td></tr>`).join('');
      byId('matrixHead').innerHTML='<tr><th>NQF descriptor</th>'+soOrder.map(so=>`<th>${so}</th>`).join('')+'<th>Rationale</th></tr>';
      let lastDomain='',lastSubdomain='';
      byId('matrixBody').innerHTML=nqf.abet_matrix.map(r=>{const d=descriptorById[r.descriptor_id],domain=majorDomain(d),subdomain=domain==='Skills'?d.domain:'';let bands='';if(domain!==lastDomain){bands+=`<tr class="domain-band ${domainClass(domain)}"><th colspan="9">${portal.esc(domain)}</th></tr>`;lastDomain=domain;lastSubdomain=''}if(subdomain&&subdomain!==lastSubdomain){bands+=`<tr class="subdomain-band"><th colspan="9">${portal.esc(subdomain)}</th></tr>`;lastSubdomain=subdomain}return bands+`<tr><td><span class="descriptor-id">${portal.esc(r.descriptor_id)}</span><br>${portal.esc(d?.title||'')}</td>${soOrder.map(so=>mark(r.so[so])).join('')}<td>${portal.esc(r.rationale)}</td></tr>`}).join('');
      byId('sourceList').innerHTML=nqf.sources.map(s=>`<article class="source-item"><span>${portal.esc(s.group)}</span><strong>${portal.esc(s.title)}</strong><p class="muted">${portal.esc(s.role)}</p>${s.href?`<a class="btn primary" href="${encodeURI(s.href)}" target="_blank" rel="noopener">Open reference</a>`:''}</article>`).join('');
    });
