/* Contact details from a verified session; no cached-profile or demo identities. */
(() => {
 const forms=[...document.querySelectorAll('[data-enquiry-form], #invest-enquiry')];
 if(!forms.length)return;
 const touched=new WeakSet(),filled=new Map();let revision=0;
 forms.forEach(form=>form.addEventListener('input',event=>touched.add(event.target)));
 const cfg=window.T7_CONFIG||{};
 let keys=['t7.local-token'];
 if(cfg.supabaseUrl&&cfg.supabaseAnonKey){
  try{keys=['sb-'+new URL(cfg.supabaseUrl).hostname.split('.')[0]+'-auth-token','t7.investor.auth'];}catch{return;}
 }
 function stored(key){try{return localStorage.getItem(key);}catch{return null;}}
 async function library(){
  if(window.supabase?.createClient)return;
  if(!window.T7EnquiryLibrary)window.T7EnquiryLibrary=new Promise((resolve,reject)=>{
   const script=document.createElement('script');script.src='js/vendor/supabase.js';script.onload=resolve;script.onerror=()=>reject(new Error('Auth library unavailable'));document.head.append(script);
  });
  await window.T7EnquiryLibrary;
 }
 async function details(){
  if(!keys.some(stored))return null;
  if(!cfg.supabaseUrl||!cfg.supabaseAnonKey){
   const token=stored('t7.local-token');if(!token)return null;
   const response=await fetch('/api/rpc',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({fn:'me',args:{}})});
   if(!response.ok)return null;const result=await response.json();const profile=result.data;
   if(!profile)return null;return {name:[profile.first_name,profile.last_name].filter(Boolean).join(' '),email:profile.email,phone:profile.phone,company:profile.company,country:profile.country};
  }
  await library();
  const candidates=await Promise.all(keys.map(async key=>{
   if(!stored(key))return null;
   const client=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey,{auth:{storageKey:key,persistSession:true,autoRefreshToken:false,detectSessionInUrl:false}});
   const session=await client.auth.getSession();if(session.error||!session.data?.session)return null;
   const verified=await client.auth.getUser();if(verified.error||!verified.data?.user)return null;
   return {client,user:verified.data.user,key};
  }));
  const active=candidates.filter(Boolean).sort((a,b)=>(Date.parse(b.user.last_sign_in_at)||0)-(Date.parse(a.user.last_sign_in_at)||0))[0];
  if(!active)return null;
  const {client,user,key}=active;
  const [trade,investor]=await Promise.all([
   client.from('profiles').select('first_name,last_name,phone,company,country').eq('id',user.id).maybeSingle(),
   client.from('investor_applications').select('full_name,phone,company,country').eq('user_id',user.id).maybeSingle()
  ]);
  const t=trade.error?{}:(trade.data||{}),i=investor.error?{}:(investor.data||{});
  const tradeName=[t.first_name,t.last_name].filter(Boolean).join(' ');
  const primary=key==='t7.investor.auth'?i:t,secondary=key==='t7.investor.auth'?t:i;
  return {name:(key==='t7.investor.auth'?i.full_name||tradeName:tradeName||i.full_name)||user.user_metadata?.full_name||'',email:user.email||'',phone:primary.phone||secondary.phone||'',company:primary.company||secondary.company||'',country:primary.country||secondary.country||''};
 }
 async function autofill(){
  const current=++revision;
  try{
   const profile=await details();if(current!==revision)return;
   for(const [field,value] of filled){if(!touched.has(field)&&field.value===value)field.value='';}filled.clear();
   if(!profile)return;
   for(const form of forms)for(const [name,value] of Object.entries(profile)){
    const field=form.querySelector('input[name="'+name+'"]');
    if(field&&!field.value&&!touched.has(field)&&value){field.value=String(value).slice(0,field.maxLength>0?field.maxLength:undefined);filled.set(field,field.value);}
   }
  }catch{ /* Network/auth failures leave the ordinary enquiry form usable. */ }
 }
 window.addEventListener('storage',event=>{if(event.key===null||keys.includes(event.key))autofill();});
 autofill();
})();
