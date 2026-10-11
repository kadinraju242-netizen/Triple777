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
 document.querySelectorAll('[data-investor-signout]').forEach(button=>button.addEventListener('click',async()=>{try{unwrap(await client.auth.signOut({scope:'local'}));location.href='investor-login.html';}catch(e){message(friendly(e),true);}}));
 if(form){
  const submit=form.querySelector('[type=submit]');submit.disabled=false;
  form.addEventListener('submit',async event=>{
   event.preventDefault();if(!form.reportValidity())return;submit.disabled=true;message('Connecting…');
   try{
    const data=new FormData(form);
    if(form.id==='investor-login'){
     unwrap(await client.auth.signInWithPassword({email:data.get('login-email'),password:data.get('login-password')}));
     const record=await application();if(!record){await client.auth.signOut({scope:'local'});throw new Error('This account has no investor application. Use Investor Registration to create an investor account.');}
     location.href=record.status==='approved'?'investor-dashboard.html':'investor-pending.html';
    }else{
     if(data.get('password')!==data.get('password-confirm'))throw new Error('Passwords do not match.');
     const answers={};for(const key of ['capacity','funds','verification','experience','risk','timing','signature','signature-date'])answers[key]=data.get(key);answers.investment_types=data.getAll('investment-type');
     const result=unwrap(await client.auth.signUp({email:data.get('email'),password:data.get('password'),options:{emailRedirectTo:new URL('investor-login.html',location.href).href,data:{portal:'investor',full_name:data.get('full-name'),phone:data.get('phone'),country:data.get('country'),company:data.get('company'),investor_application:answers}}}));
     if(result.session){location.href='investor-pending.html';return;}
     form.reset();message('Check your email to confirm your account, then use Investor Login. If you already have an account, sign in with your existing password.');
    }
   }catch(error){message(friendly(error),true);}finally{submit.disabled=false;}
  });
 }
 const none=document.querySelector('input[name="investment-type"][value="None"]');
 document.querySelectorAll('input[name="investment-type"]').forEach(input=>input.addEventListener('change',()=>{if(input===none&&input.checked)document.querySelectorAll('input[name="investment-type"]').forEach(other=>{if(other!==none)other.checked=false});else if(input.checked&&none)none.checked=false;}));
 if(document.body.hasAttribute('data-investor-protected')){
  if(!session){location.replace('investor-login.html');return;}
  try{
   const record=await application();if(!record){location.replace('investor-login.html');return;}
   if(record.status!=='approved'&&document.body.hasAttribute('data-approved-only')){location.replace('investor-pending.html');return;}
   if(record.status==='approved'&&!document.body.hasAttribute('data-approved-only')){location.replace('investor-dashboard.html');return;}
   main.replaceChildren();const section=document.createElement('section');section.className='portal-section';const wrap=document.createElement('div');wrap.className='wrap';section.append(wrap);main.append(section);
   function add(tag,text,parent=wrap,cls){const el=document.createElement(tag);el.textContent=text;if(cls)el.className=cls;parent.append(el);return el;}
   add('p','Investor workspace',wrap,'eyebrow');add('h1',record.status==='approved'?'Welcome, '+record.full_name:'Application '+record.status);add('p','Account: '+record.email);add('p','Application received: '+new Date(record.created_at).toLocaleDateString());
   const actions=add('div','',wrap,'portal-actions');const signout=add('button','Sign Out',actions,'btn btn-outline');signout.onclick=async()=>{try{unwrap(await client.auth.signOut({scope:'local'}));location.href='investor-login.html';}catch(e){message(friendly(e),true);}};
   if(record.status!=='approved'){add('p',record.status==='pending'?'Your application is awaiting team review. Contact us if you need help.':'Contact the team to discuss your application status.');const a=add('a','Contact the Team',actions,'btn btn-solid');a.href='contact.html';return;}
   const projects=unwrap(await client.from('investor_projects').select('*').eq('published',true).order('created_at'));
   add('h2','Project opportunities');if(!projects.length)add('p','No opportunities have been published yet. Our team can help you discuss current projects.');
   for(const project of projects){const card=add('article','',wrap,'portal-panel');add('h3',project.name,card);add('p',project.location||'',card);add('p',project.description,card);const button=add('button','Register Interest',card,'btn btn-solid');button.onclick=async()=>{button.disabled=true;try{unwrap(await client.from('investor_interests').insert({project_id:project.id}));button.textContent='Interest registered';}catch(e){button.disabled=false;message(e.code==='23505'?'Your interest is already registered.':friendly(e),true);}};}
   add('h2','Your profile');add('p','Country: '+(record.country||'Not provided'));add('p','Company: '+(record.company||'Not provided'));add('p','Investment capacity: '+(record.application.capacity||'Not provided'));add('p','Documents and investment statements will be available once their secure storage and reporting are connected.');
  }catch(e){main.replaceChildren();message(friendly(e),true);}
 }
})().catch(error=>{const main=document.querySelector('main');main.textContent='Unable to load the investor portal. Please reload or contact the team.';console.error(error);});
