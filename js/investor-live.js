/* Separate investor session and database-backed application flow. */
(async () => {
 'use strict';
 const cfg = window.T7_CONFIG || {};
 const main = document.querySelector('main');
 const form = document.querySelector('#investor-login, #investor-intake');
 function message(text, error=false) {
  let el=document.getElementById('investor-feedback');
  if(!el){el=document.createElement('p');el.id='investor-feedback';el.setAttribute('role','status');(form||main).append(el);}
  el.textContent=text;el.style.color=error?'#9a2637':'';
 }
 function unwrap(result){if(result.error)throw result.error;return result.data;}
 function friendly(error){if(/relation.*does not exist|schema cache/i.test(error.message))return 'Investor setup is not active yet. Please contact the team.';return error.message||'Unable to connect. Please try again.';}
 if(!cfg.supabaseUrl||!cfg.supabaseAnonKey){message('Investor sign-in is not configured yet.',true);return;}
 const client=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey,{auth:{storageKey:'t7.investor.auth',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 const session=unwrap(await client.auth.getSession()).session;
 async function application(){const user=unwrap(await client.auth.getUser()).user;if(!user)return null;return unwrap(await client.from('investor_applications').select('*').eq('user_id',user.id).maybeSingle());}
 function answersFrom(data){const answers={};for(const key of ['capacity','funds','verification','experience','risk','timing','signature','signature-date'])answers[key]=data.get(key);answers.investment_types=data.getAll('investment-type');return answers;}
 /* Files the application against the account that is already signed in.
    Supabase Auth holds one row per email, so somebody who registered
    through Trade cannot sign up again — auth.signUp() returns success,
    inserts nothing and sends no mail, which means the trigger that
    normally creates the application never fires. Signing in proves the
    account is theirs; this records the application for it. */
 async function fileApplication(data){return unwrap(await client.rpc('submit_investor_application',{p_full_name:data.get('full-name'),p_phone:data.get('phone'),p_country:data.get('country'),p_company:data.get('company'),p_application:answersFrom(data)}));}
 document.querySelectorAll('[data-investor-signout]').forEach(button=>button.addEventListener('click',async()=>{try{unwrap(await client.auth.signOut({scope:'local'}));location.href='investor-login.html';}catch(e){message(friendly(e),true);}}));
 if(form){
  const submit=form.querySelector('[type=submit]');submit.disabled=false;
  /* The form doubles as "apply on the account I am already signed in to".
     In that mode the address comes from the session and there is no new
     password to choose, so section E is put away rather than asking for
     credentials that would be ignored. */
  if(form.id==='investor-intake'&&session){
   const email=form.querySelector('#email');if(email){email.value=session.user.email;email.readOnly=true;}
   const creds=form.querySelector('#password')&&form.querySelector('#password').closest('fieldset');
   if(creds){creds.hidden=true;creds.querySelectorAll('input').forEach(i=>{i.required=false;i.disabled=true;});}
   message('Signed in as '+session.user.email+'. Complete this form to add investor access to that account.');
  }
  form.addEventListener('submit',async event=>{
   event.preventDefault();if(!form.reportValidity())return;submit.disabled=true;message('Connecting…');
   try{
    const data=new FormData(form);
    if(form.id==='investor-login'){
     unwrap(await client.auth.signInWithPassword({email:data.get('login-email'),password:data.get('login-password')}));
     const record=await application();
     /* Signed in, but no application on file — a Trade account that has
        never applied. Keep the session and send them to the form, which
        now files against this account. Signing them out here left them
        with no way through at all. */
     if(!record){location.href='investor-register.html';return;}
     location.href=record.status==='approved'?'investor-dashboard.html':'investor-pending.html';
    }else{
     /* Already signed in: the account exists, so skip sign-up entirely. */
     if(session){await fileApplication(data);location.href='investor-pending.html';return;}
     if(data.get('password')!==data.get('password-confirm'))throw new Error('Passwords do not match.');
     const result=unwrap(await client.auth.signUp({email:data.get('email'),password:data.get('password'),options:{emailRedirectTo:new URL('investor-login.html',location.href).href,data:{portal:'investor',full_name:data.get('full-name'),phone:data.get('phone'),country:data.get('country'),company:data.get('company'),investor_application:answersFrom(data)}}}));
     if(result.session){location.href='investor-pending.html';return;}
     /* An empty identities array is how Supabase reports "that address is
        already registered" without confirming it to whoever is asking.
        Nothing was created and no mail was sent, so do not promise one. */
     if(result.user&&Array.isArray(result.user.identities)&&!result.user.identities.length){
      message('That email already has a Triple 7 account. Sign in with its password and you can finish this application on the same account.',true);
      const el=document.getElementById('investor-feedback');
      const link=document.createElement('a');link.href='investor-login.html';link.className='textlink';link.textContent='Go to Investor Login';link.style.marginLeft='8px';el.append(link);
      return;
     }
     form.reset();message('Check your email to confirm your account, then use Investor Login.');
    }
   }catch(error){message(friendly(error),true);}finally{submit.disabled=false;}
  });
 }
 const none=document.querySelector('input[name="investment-type"][value="None"]');
 document.querySelectorAll('input[name="investment-type"]').forEach(input=>input.addEventListener('change',()=>{if(input===none&&input.checked)document.querySelectorAll('input[name="investment-type"]').forEach(other=>{if(other!==none)other.checked=false});else if(input.checked&&none)none.checked=false;}));
 if(document.body.hasAttribute('data-investor-protected')){
  if(!session){location.replace('investor-login.html');return;}
  try{
   /* Signed in with no application: send them to the form, not back to a
      sign-in they have already passed. */
   const record=await application();if(!record){location.replace('investor-register.html');return;}
   if(record.status!=='approved'&&document.body.hasAttribute('data-approved-only')){location.replace('investor-pending.html');return;}
   if(record.status==='approved'&&!document.body.hasAttribute('data-approved-only')){location.replace('investor-dashboard.html');return;}
   main.replaceChildren();const section=document.createElement('section');section.className='portal-section';const wrap=document.createElement('div');wrap.className='wrap';section.append(wrap);main.append(section);
   function add(tag,text,parent=wrap,cls){const el=document.createElement(tag);el.textContent=text;if(cls)el.className=cls;parent.append(el);return el;}
   add('p','Investor workspace',wrap,'eyebrow');add('h1',record.status==='approved'?'Welcome, '+record.full_name:'Application '+record.status);add('p','Account: '+record.email);add('p','Application received: '+new Date(record.created_at).toLocaleDateString());
   const actions=add('div','',wrap,'portal-actions');const signout=add('button','Sign Out',actions,'btn btn-outline');signout.onclick=async()=>{try{unwrap(await client.auth.signOut({scope:'local'}));location.href='investor-login.html';}catch(e){message(friendly(e),true);}};
   if(record.status!=='approved'){add('p',record.status==='pending'?'Your application is awaiting team review. Contact us if you need help.':'Contact the team to discuss your application status.');const a=add('a','Contact the Team',actions,'btn btn-solid');a.href='contact.html';return;}
   let trackingReady=true;let interestResult=await client.from('investor_interests').select('id,project_id,created_at,status,review_note,updated_at').order('created_at',{ascending:false});
   if(interestResult.error?.code==='42703'){trackingReady=false;interestResult=await client.from('investor_interests').select('id,project_id,created_at').order('created_at',{ascending:false});}
   const interests=unwrap(interestResult);
   const tracking=add('section','',wrap);const renderTracking=()=>T7InvestorTracking.render(tracking,interests,projects,{ready:trackingReady});
   const projects=unwrap(await client.from('investor_projects').select('*').eq('published',true).order('created_at'));
   const invitation=add('aside','',wrap,'portal-panel project-submission-callout');invitation.style.margin='32px 0';add('p','Bring an opportunity to the table',invitation,'eyebrow');add('h2','Have a project opportunity you’d like to submit?',invitation);add('p','Share your mining or mineral project with the Triple 7 team. Tell us where it is, its current stage, and the partnership or investment you’re seeking.',invitation);const submission=add('a','Submit a Project Opportunity',invitation,'btn btn-solid');submission.style.marginTop='20px';submission.href="mailto:info@triple7holdings.co.za?subject=Project%20opportunity%20submission&body=Your%20name%3A%0ACompany%3A%0AProject%20name%3A%0AProject%20location%3A%0AMineral%20or%20commodity%3A%0AProject%20stage%3A%0AOpportunity%20overview%3A%0APartnership%20or%20funding%20required%3A%0AContact%20details%3A%0A";add('p','Opens your email app with the project details ready to fill in.',invitation,'field-help');
   renderTracking();
   add('h2','Project opportunities');if(!projects.length)add('p','No opportunities have been published yet. Our team can help you discuss current projects.');
   for(const project of projects){const card=add('article','',wrap,'portal-panel opportunity-card');const title=add('h3','',card);const mine=project.name.toLowerCase().includes('bucklands')?'bucklands':project.name.toLowerCase().includes('longlands')?'longlands':null;if(mine){const link=add('a',project.name,title,'mine-card-link');link.href='mine-'+mine+'.html?from=investor-dashboard';}else{title.textContent=project.name;}add('p',project.location||'',card);add('p',project.description,card);const button=add('button','Register Interest',card,'btn btn-solid');button.style.marginTop='24px';button.style.position='relative';button.style.zIndex='1';const existing=interests.some(i=>i.project_id===project.id);button.disabled=existing||!trackingReady;button.textContent=existing?'Interest registered':trackingReady?'Register Interest':'Interest setup pending';button.onclick=async()=>{button.disabled=true;try{const saved=unwrap(await client.from('investor_interests').insert({project_id:project.id}).select('id,project_id,created_at,status,review_note,updated_at').single());interests.unshift(saved);renderTracking();button.textContent='Interest received';message('Your interest has been received. Track the team’s review under My Interests.');}catch(e){button.disabled=false;message(e.code==='23505'?'Your interest is already registered.':friendly(e),true);}};}
   add('h2','Your profile');add('p','Country: '+(record.country||'Not provided'));add('p','Company: '+(record.company||'Not provided'));add('p','Investment capacity: '+(record.application.capacity||'Not provided'));add('p','Documents and investment statements will be available once their secure storage and reporting are connected.');
  }catch(e){main.replaceChildren();message(friendly(e),true);}
 }
})().catch(error=>{const main=document.querySelector('main');main.textContent='Unable to load the investor portal. Please reload or contact the team.';console.error(error);});
