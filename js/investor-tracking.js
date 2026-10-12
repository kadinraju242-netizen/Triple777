/* Shared, text-only rendering for live interests and the local demo. */
window.T7InvestorTracking = (() => {
 const labels={received:'Received',in_discussion:'In discussion',closed:'Closed'};
 const next={received:'The team will review your enquiry and contact you.',in_discussion:'Your enquiry is being discussed with the team. Contact them for the next step.',closed:'This enquiry is closed. Contact the team if you would like to discuss it again.'};
 function add(parent,tag,text,cls){const el=document.createElement(tag);el.textContent=text;if(cls)el.className=cls;parent.append(el);return el;}
 function render(container,interests,projects,{demo=false,ready=true}={}){
  container.replaceChildren();container.className='interest-tracking';container.id='my-interests';
  add(container,'p','Your investor enquiries','eyebrow');add(container,'h2','My Interests');
  add(container,'p',demo?'Sample review tracking · changes stay in this preview.':'Track the team’s review of your project enquiries.');
  if(!ready)add(container,'p','Review tracking is being set up. Contact the team for an update.','interest-notice');
  if(!interests.length)add(container,'p','You have not registered interest in a project yet.','interest-empty');
  for(const interest of interests){
   const project=projects.find(p=>p.id===interest.project_id);
   const row=add(container,'article','','portal-panel interest-row');
   add(row,'h3',project?.name||'Project enquiry');
   add(row,'span',ready?(labels[interest.status]||'Received'):'Registered','interest-status');
   add(row,'p','Reference: T7-'+interest.id.slice(0,8).toUpperCase());
   add(row,'p','Received: '+new Date(interest.created_at).toLocaleDateString('en-ZA'));
   if(interest.updated_at)add(row,'p','Last updated: '+new Date(interest.updated_at).toLocaleDateString('en-ZA'));
   if(interest.review_note)add(row,'p','Team update: '+interest.review_note);
   add(row,'p',next[interest.status]||next.received,'interest-next-step');
   if(demo){
    const label=add(row,'label','Preview team review: ');const select=add(label,'select','');
    select.setAttribute('aria-label','Preview review status for '+(project?.name||'project'));
    for(const [value,text] of Object.entries(labels)){const option=add(select,'option',text);option.value=value;option.selected=value===interest.status;}
    select.addEventListener('change',()=>{interest.status=select.value;interest.updated_at=new Date().toISOString();render(container,interests,projects,{demo,ready});});
   }
  }
  const contact=add(container,'a','Contact the investor team','btn btn-outline');contact.href='mailto:info@triple7holdings.co.za';
 }
 return {labels,render};
})();
