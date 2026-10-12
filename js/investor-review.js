(async()=>{
 const root=document.getElementById('investor-review-root');
 function add(parent,tag,text,cls){const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;parent.append(e);return e;}
 try{
  const profile=await T7.auth.require(['admin']);if(!profile)return;
  const client=await T7.client();
  const [interests,applications,projects,emails]=await Promise.all([
   client.from('investor_interests').select('*').order('created_at',{ascending:false}),
   client.from('investor_applications').select('user_id,full_name,email'),
   client.from('investor_projects').select('id,name'),
   client.from('investor_email_queue').select('interest_id,recipient_kind,state')
  ]);
  for(const r of [interests,applications,projects,emails])if(r.error)throw r.error;
  root.replaceChildren();
  if(!interests.data.length)add(root,'p','No investor interests have been received.');
  for(const interest of interests.data){
   const investor=applications.data.find(a=>a.user_id===interest.user_id);
   const project=projects.data.find(p=>p.id===interest.project_id);
   const form=add(root,'form','','portal-panel interest-review-form');
   add(form,'h2',project?.name||'Project enquiry');add(form,'p',(investor?.full_name||'Investor')+' · '+(investor?.email||''));
   add(form,'p','Reference: T7-'+interest.id.slice(0,8).toUpperCase());
   const statusLabel=add(form,'label','Review status');const select=add(statusLabel,'select','');
   for(const [value,text] of Object.entries(T7InvestorTracking.labels)){const o=add(select,'option',text);o.value=value;o.selected=value===interest.status;}
   const noteLabel=add(form,'label','Update visible to the investor');const note=add(noteLabel,'textarea','');note.value=interest.review_note||'';note.maxLength=2000;note.rows=3;
   const queued=emails.data.filter(e=>e.interest_id===interest.id);
   add(form,'p',queued.length?queued.map(e=>(e.recipient_kind==='team'?'Team notification':'Investor confirmation')+': '+e.state).join(' · '):'No email jobs (interest predates the notification setup).','field-help');
   const button=add(form,'button','Save Review','btn btn-solid');button.type='submit';const feedback=add(form,'p','');feedback.setAttribute('role','status');
   form.addEventListener('submit',async e=>{e.preventDefault();button.disabled=true;feedback.textContent='Saving…';try{const result=await client.from('investor_interests').update({status:select.value,review_note:note.value.trim()}).eq('id',interest.id).select('id');if(result.error)throw result.error;if(result.data.length!==1)throw new Error('Review was not saved. Check your admin access.');feedback.textContent='Saved. The investor can see this update in their dashboard.';}catch(error){feedback.textContent=error.message;}finally{button.disabled=false;}});
  }
 }catch{root.textContent='Unable to load review tracking. Confirm the investor review migration is installed and you are signed in as an admin.';}
})();
