// Server-only scheduled worker. No browser-provided recipients or email content.
export function buildEmail(kind, interest, investor, project, config) {
 const reference='T7-'+interest.id.slice(0,8).toUpperCase();
 const investorMail=kind==='investor';
 return {
  from:config.from, to:[investorMail?investor.email:config.team],
  subject:investorMail?'We received your interest — '+project.name:'New investor interest — '+project.name,
  text:investorMail
   ? `Hello ${investor.full_name},\n\nWe received your interest in ${project.name}.\nReference: ${reference}\nStatus: Received\n\nOur team will review your enquiry and contact you to discuss the next step. This is an enquiry, not a financial commitment.\n\nView your interests: ${config.site}/investor-dashboard.html\nContact: ${config.team}\n\nTriple 7 Holdings`
   : `New investor interest\nReference: ${reference}\nProject: ${project.name}\nInvestor: ${investor.full_name}\nEmail: ${investor.email}\n\nReview and update the status: ${config.site}/investor-review.html\n\nTriple 7 Holdings`
 };
}
export async function handleRequest(request, env, fetcher=fetch) {
 if(request.method!=='POST')return new Response('Method not allowed',{status:405});
 const token=env('INVESTOR_WORKER_TOKEN');
 if(!token || request.headers.get('x-investor-worker-token')!==token)return new Response('Unauthorized',{status:401});
 const cfg={url:env('SUPABASE_URL'),key:env('SUPABASE_SERVICE_ROLE_KEY'),resend:env('RESEND_API_KEY'),from:env('INVESTOR_EMAIL_FROM'),team:env('INVESTOR_TEAM_EMAIL'),site:env('INVESTOR_SITE_URL')};
 if(Object.values(cfg).some(value=>!value) || !/^https:\/\//.test(cfg.site))return new Response('Email configuration incomplete',{status:503});
 async function db(path,options={}) {
  const r=await fetcher(cfg.url+'/rest/v1/'+path,{...options,headers:{apikey:cfg.key,Authorization:'Bearer '+cfg.key,'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw new Error('Database request failed ('+r.status+')');
  return r.status===204?null:await r.json();
 }
 let sent=0,failed=0;
 try {
  const jobs=await db('rpc/claim_investor_emails',{method:'POST',body:'{}'});
  for(const job of jobs){
   try {
    const [interest]=await db('investor_interests?id=eq.'+job.interest_id+'&select=id,user_id,project_id');
    const [investor]=await db('investor_applications?user_id=eq.'+interest.user_id+'&select=full_name,email');
    const [project]=await db('investor_projects?id=eq.'+interest.project_id+'&select=name');
    if(!investor || !project)throw new Error('Missing investor or project');
    const r=await fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+cfg.resend,'Content-Type':'application/json','Idempotency-Key':'investor-interest/'+job.id},body:JSON.stringify(buildEmail(job.recipient_kind,interest,investor,project,cfg)),signal:AbortSignal.timeout(15000)});
    if(!r.ok)throw new Error('Email provider request failed ('+r.status+')');
    const result=await r.json();
    await db('investor_email_queue?id=eq.'+job.id,{method:'PATCH',body:JSON.stringify({state:'sent',sent_at:new Date().toISOString(),provider_id:result.id,last_error:null})});sent++;
   }catch(error){
    const next=new Date(Date.now()+Math.min(60,2**job.attempts)*60000).toISOString();
    await db('investor_email_queue?id=eq.'+job.id,{method:'PATCH',body:JSON.stringify({state:job.attempts>=6?'failed':'pending',next_attempt_at:next,last_error:error.message})});failed++;
   }
  }
  return Response.json({sent,failed});
 }catch{return new Response('Notification worker failed',{status:500});}
}
if(typeof Deno!=='undefined')Deno.serve(request=>handleRequest(request,key=>Deno.env.get(key)));
