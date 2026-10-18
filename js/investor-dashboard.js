/* Live workspace: enquiries never count as confirmed investments. */
window.T7InvestorDashboard=function(wrap,record,projects,interests,ready,register,signout,workspace={}){
 const add=(parent,tag,text,cls)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;parent.append(e);return e;};
 const money=(v,c='ZAR')=>new Intl.NumberFormat('en-ZA',{style:'currency',currency:c,maximumFractionDigits:0}).format(Number(v));
 const date=v=>v?new Date(v+'T12:00:00').toLocaleDateString('en-ZA',{day:'numeric',month:'short',year:'numeric'}):'Not provided';
 const field=(form,label,name,value,type='text')=>{const l=add(form,'label',label);const input=add(l,'input');input.name=name;input.type=type;input.value=value||'';input.maxLength=500;return input;};
 const imageFor=p=>/bucklands/i.test(p.name)?'images/mines/bucklands-wide.jpg':'images/live-operations.jpg';
 const holdings=workspace.holdings||[],updates=workspace.updates||[];
 wrap.replaceChildren();wrap.classList.add('investor-workspace');
 const welcome=add(wrap,'div',null,'dashboard-welcome'),head=add(welcome,'div',null,'portal-heading');
 add(head,'p','Your investor workspace','eyebrow');add(head,'h1','Welcome, '+record.full_name);add(head,'p','Your profile, your investments and the next opportunity.');
 const exit=add(welcome,'button','Sign Out','btn btn-outline');exit.type='button';exit.onclick=signout;
 const profile=add(wrap,'section',null,'workspace-profile portal-panel');
 const profileHead=add(profile,'div',null,'workspace-section-heading');const profileTitle=add(profileHead,'div');add(profileTitle,'p','Your profile','eyebrow');add(profileTitle,'h2',record.full_name);
 const edit=add(profileHead,'button','Edit profile','btn btn-outline');edit.type='button';
 const facts=add(profile,'dl',null,'workspace-facts');
 for(const [label,value] of [['Email',record.email],['Residence',record.country],['Capacity',record.application?.capacity],['Project countries',record.application?.preferred_countries],['Project regions',record.application?.preferred_regions]]){const row=add(facts,'div');add(row,'dt',label);add(row,'dd',value||'Not provided');}
 const form=add(profile,'form',null,'workspace-edit');form.hidden=true;
 const residence=field(form,'Country of residence','country',record.country);residence.required=true;residence.maxLength=80;
 const budget=field(form,'Available investment budget (ZAR)','budget',record.application?.investment_budget_zar,'number');budget.required=true;budget.min=100000;budget.step='0.01';
 const countries=field(form,'Preferred project countries (comma separated)','countries',record.application?.preferred_countries);
 const regions=field(form,'Preferred project regions (comma separated)','regions',record.application?.preferred_regions);
 add(form,'p','For example: South Africa, Botswana · Northern Cape. Matches use your budget, residence and project location preferences.','field-help');
 const save=add(form,'button','Save preferences','btn btn-solid');save.type='submit';save.disabled=!workspace.saveProfile;
 const profileFeedback=add(form,'p',workspace.saveProfile?'':'Profile editing will be available after the workspace database update.');profileFeedback.setAttribute('role','status');
 edit.onclick=()=>{form.hidden=!form.hidden;edit.textContent=form.hidden?'Edit profile':'Close editor';if(!form.hidden)residence.focus();};
 form.onsubmit=async e=>{e.preventDefault();if(!form.reportValidity())return;save.disabled=true;try{const capacity=Number(budget.value)<500000?'R100,000 – R500,000':Number(budget.value)<1000000?'R500,000 – R1M':Number(budget.value)<5000000?'R1M – R5M':'R5M+';await workspace.saveProfile({country:residence.value,capacity,budget:Number(budget.value),countries:countries.value,regions:regions.value});record.country=residence.value;Object.assign(record.application,{capacity,investment_budget_zar:Number(budget.value),preferred_countries:countries.value,preferred_regions:regions.value});window.T7InvestorDashboard(wrap,record,projects,interests,ready,register,signout,workspace);}catch(error){profileFeedback.textContent=error.message||'Could not save preferences.';save.disabled=false;}};
 const owned=add(wrap,'section',null,'workspace-section');add(owned,'p','Your portfolio','eyebrow');add(owned,'h2','Your investments.');add(owned,'p','Confirmed participation recorded by the Triple 7 team.');
 if(workspace.error)add(owned,'p',workspace.error,'workspace-empty');
 else if(!workspace.ready)add(owned,'p','Investment records and project updates are awaiting the database update. Your existing project enquiries remain available below.','workspace-empty');
 else if(!holdings.length)add(owned,'p','No confirmed investments yet. Explore available projects below or follow your enquiries under My Interests.','workspace-empty');
 const ownedList=add(owned,'div',null,'workspace-holdings');
 function details(project,personal=[]){
  const dialog=add(wrap,'dialog',null,'document-dialog workspace-dialog');
  const top=add(dialog,'div',null,'dialog-top');add(top,'p',personal.length?'Your investment':'Project overview','eyebrow');const close=add(top,'button','×');close.type='button';close.setAttribute('aria-label','Close project');close.onclick=()=>dialog.close();
  add(dialog,'h2',project.name);const img=add(dialog,'img',null,'workspace-dialog-image');img.src=imageFor(project);img.alt=project.name;
  add(dialog,'p',[project.commodity,project.stage,project.region,project.country||project.location].filter(Boolean).join(' · '));add(dialog,'p',project.description||'Contact our team for a detailed project overview.');
  if(personal.length){add(dialog,'h3','Your recorded participation');for(const holding of personal)add(dialog,'p',`${money(holding.amount,holding.currency)} · ${date(holding.invested_on)} · ${holding.status}${holding.reference?' · '+holding.reference:''}`);
   add(dialog,'h3','Project progress');const reports=updates.filter(u=>u.project_id===project.id).sort((a,b)=>b.report_date.localeCompare(a.report_date)||String(b.created_at||'').localeCompare(String(a.created_at||'')));
   if(!reports.length)add(dialog,'p','No project progress reports have been published yet.');
   for(const report of reports){const article=add(dialog,'article',null,'workspace-report');add(article,'p',date(report.report_date),'eyebrow');add(article,'h3',report.title);add(article,'p',report.body);if(report.milestone)add(article,'p','Milestone: '+report.milestone);if(report.progress_percent!=null){add(article,'p','Reported project progress: '+report.progress_percent+'%');const bar=add(article,'progress');bar.max=100;bar.value=report.progress_percent;bar.setAttribute('aria-label','Reported project progress');}}
  }else if(project.minimum_investment_zar)add(dialog,'p','Minimum participation: '+money(project.minimum_investment_zar));
  const contact=add(dialog,'a','Contact investor support','text-link');contact.href='contact.html';
  dialog.addEventListener('close',()=>dialog.remove());dialog.showModal();
 }
 for(const id of [...new Set(holdings.map(h=>h.project_id))]){const personal=holdings.filter(h=>h.project_id===id),project=projects.find(p=>p.id===id)||{id,name:'Project record',description:'Contact the team for project information.'};const card=add(ownedList,'button',null,'workspace-holding');card.type='button';const img=add(card,'img');img.src=imageFor(project);img.alt='';const content=add(card,'span');add(content,'strong',project.name);add(content,'span',personal.map(h=>money(h.amount,h.currency)).join(' + '));add(content,'small','View your investment and project progress →');card.onclick=()=>details(project,personal);}
 const available=add(wrap,'section',null,'workspace-section');available.id='available-projects';const availableHead=add(available,'div',null,'workspace-section-heading');const ah=add(availableHead,'div');add(ah,'p','Find your next project','eyebrow');add(ah,'h2','Available projects.');
 const filterLabel=add(availableHead,'label','Show projects');const filter=add(filterLabel,'select');for(const [v,t] of [['all','All available · matches first'],['matched','Matched to my profile']]){const o=add(filter,'option',t);o.value=v;}
 add(available,'p','Matches consider your budget, residence and preferred countries or regions. A match is an introduction for team review.');
 const feedback=add(available,'p');feedback.id='investor-feedback';feedback.setAttribute('role','status');
 const rows=add(available,'div',null,'workspace-project-list');
 const tracking=add(wrap,'section',null,'workspace-section');
 const refreshTracking=()=>window.T7InvestorTracking.render(tracking,interests,projects,{ready});refreshTracking();
 const renderProjects=()=>{rows.replaceChildren();const sorted=projects.filter(p=>p.published).map(project=>({project,match:T7InvestorMatch.match(record,project)})).sort((a,b)=>b.match.score-a.match.score);const shown=sorted.filter(item=>filter.value!=='matched'||item.match.level==='Matched');if(!shown.length)add(rows,'p',filter.value==='matched'?'No exact matches yet. Update your profile or browse all available projects.':'No project opportunities have been published yet.','workspace-empty');for(const {project,match} of shown){const row=add(rows,'article',null,'workspace-project-row');const img=add(row,'img');img.src=imageFor(project);img.alt=project.name;img.loading='lazy';const copy=add(row,'div');add(copy,'span',match.level,'workspace-match '+(match.level==='Matched'?'is-match':''));add(copy,'h3',project.name);add(copy,'p',[project.commodity,project.stage,project.country||project.location,project.region].filter(Boolean).join(' · '));add(copy,'p',project.description);add(copy,'p',project.minimum_investment_zar?'Minimum participation '+money(project.minimum_investment_zar):'Minimum participation to be confirmed','workspace-minimum');add(copy,'small',match.reasons.join(' · '));const actions=add(row,'div',null,'workspace-row-actions');const view=add(actions,'button','View project','btn btn-outline');view.type='button';view.onclick=()=>details(project);const button=add(actions,'button',null,'btn btn-solid');button.type='button';button.disabled=!ready||interests.some(i=>i.project_id===project.id);button.textContent=interests.some(i=>i.project_id===project.id)?'Interest registered':ready?'Register interest':'Interest setup pending';button.onclick=async()=>{button.disabled=true;try{const saved=await register(project);if(!interests.some(i=>i.id===saved.id))interests.unshift(saved);button.textContent='Interest registered';feedback.textContent='Interest received for '+project.name+'. Follow the team’s review under My Interests.';refreshTracking();}catch(error){button.disabled=false;feedback.textContent=error.message||'Could not save interest.';}};}};
 filter.onchange=renderProjects;renderProjects();
};
