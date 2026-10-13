/* Approved dashboard: database records only; decisions remain with the team. */
window.T7InvestorDashboard = function(wrap, record, projects, interests, ready, register, signout) {
 const add=(parent,tag,text,cls)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;parent.append(e);return e;};
 wrap.replaceChildren();
 const welcome=add(wrap,'div','','dashboard-welcome'), heading=add(welcome,'div','','portal-heading');
 add(heading,'p','Investor workspace','eyebrow');add(heading,'h1','Welcome, '+record.full_name);add(heading,'p','Explore your approved investor dashboard.');
 const exit=add(welcome,'button','Sign Out','btn btn-outline');exit.type='button';exit.onclick=signout;
 const stats=add(wrap,'div','','dashboard-stats');let count;
 for(const [label,value,detail] of [['Application status','Approved','Investor access approved'],['Project opportunities',projects.length,'Published opportunities'],['Registered interests',interests.length,'Your saved enquiries']]){const box=add(stats,'div');add(box,'span',label);const strong=add(box,'strong',String(value));add(box,'small',detail);if(label==='Registered interests')count=strong;}
 const grid=add(wrap,'div','','dashboard-grid'),profile=add(grid,'article','','portal-panel');
 add(profile,'p','Your profile','eyebrow');add(profile,'h2',record.full_name);const dl=add(profile,'dl','','portal-dl');
 for(const [label,value] of [['Email',record.email],['Country',record.country||'Not provided'],['Company',record.company||'Not provided'],['Account status','Approved'],['Investment capacity',record.application?.capacity||'Not provided']]){const row=add(dl,'div');add(row,'dt',label);add(row,'dd',value);}
 add(profile,'p','Documents, balances and statements are not connected yet.');
 const next=add(grid,'article','','portal-panel');add(next,'p','Next steps','eyebrow');add(next,'h2','Explore the opportunities.');add(next,'p','Review the projects below and register interest. Your enquiry is saved to your account so you can follow the team’s review under My Interests.');
 const feedback=add(next,'p');feedback.id='investor-feedback';feedback.setAttribute('role','status');
 const invitation=add(wrap,'aside','','portal-panel project-submission-callout');invitation.style.margin='32px 0';add(invitation,'p','Bring an opportunity to the table','eyebrow');add(invitation,'h2','Have a project opportunity you’d like to submit?');add(invitation,'p','Share your mining or mineral project with the Triple 7 team. Tell us where it is, its current stage, and the partnership or investment you’re seeking.');
 const submission=add(invitation,'a','Submit a Project Opportunity','btn btn-solid');submission.href='mailto:info@triple7holdings.co.za?subject=Project%20opportunity%20submission&body='+encodeURIComponent('Your name:\nCompany:\nProject name:\nProject location:\nMineral or commodity:\nProject stage:\nOpportunity overview:\nPartnership or funding required:\nContact details:\n');add(invitation,'p','Opens your email app with the project details ready to fill in.','field-help');
 const tracking=add(wrap,'section');const refresh=()=>{T7InvestorTracking.render(tracking,interests,projects,{ready});count.textContent=String(interests.length);};refresh();
 const title=add(wrap,'div','','portal-heading');add(title,'p','Project opportunities','eyebrow');add(title,'h2','Explore our mine projects.');
 if(!projects.length)add(wrap,'p','No opportunities have been published yet. Contact the investor team to discuss current projects.');
 const cards=add(wrap,'div','','opportunities-grid');
 for(const project of projects){
  const mine=project.name.toLowerCase().includes('bucklands')?'bucklands':project.name.toLowerCase().includes('longlands')?'longlands':null;
  const card=add(cards,'article','','opportunity-card'),imageWrap=add(card,'div','','project-image-wrap');const image=add(imageWrap,'img');image.src=mine==='bucklands'?'images/mines/bucklands-wide.jpg':mine==='longlands'?'images/live-operations.jpg':'images/mines/mine-projects.jpg';image.alt=project.name+' project';image.loading='lazy';add(imageWrap,'span','Project opportunity','image-project-tag');
  const body=add(card,'div','','opportunity-body');add(body,'p',project.location||'Triple 7 project opportunity','eyebrow');const h=add(body,'h2');if(mine){const link=add(h,'a',project.name,'mine-card-link');link.href='mine-'+mine+'.html?from=investor-dashboard';}else h.textContent=project.name;
  add(body,'p',project.description||'Contact the team for project details and availability.');
  const button=add(body,'button','','btn btn-solid');button.type='button';button.style.marginTop='24px';const existing=interests.some(i=>i.project_id===project.id);button.disabled=existing||!ready;button.textContent=existing?'Interest registered':ready?'Register Interest':'Interest setup pending';
  button.onclick=async()=>{button.disabled=true;button.textContent='Saving interest…';feedback.textContent='';try{const saved=await register(project);if(!interests.some(i=>i.id===saved.id))interests.unshift(saved);refresh();button.textContent='Interest registered';feedback.style.color='';feedback.textContent='Your interest in '+project.name+' has been received. Track the team’s review under My Interests.';}catch(error){button.disabled=false;button.textContent='Register Interest';feedback.style.color='#9a2637';feedback.textContent=error.message||'Unable to save your interest. Please try again.';}};
 }
};
