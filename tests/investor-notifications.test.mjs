import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../supabase/functions/investor-notifications/index.ts',import.meta.url),'utf8');
const {handleRequest,buildEmail}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const secrets={INVESTOR_WORKER_TOKEN:'test-worker-token',SUPABASE_URL:'https://db.test',SUPABASE_SERVICE_ROLE_KEY:'server-only',RESEND_API_KEY:'test-resend',INVESTOR_EMAIL_FROM:'Team <team@example.test>',INVESTOR_TEAM_EMAIL:'team@example.test',INVESTOR_SITE_URL:'https://site.test'};
const env=k=>secrets[k];
const request=()=>new Request('https://worker.test',{method:'POST',headers:{'x-investor-worker-token':'test-worker-token'},body:JSON.stringify({to:'attacker@example.test'})});
const interest={id:'12345678-1111-4111-8111-111111111111',user_id:'user1',project_id:'project1'};
const investor={full_name:'Test Investor',email:'investor@example.test'};
const project={name:'Test Mine'};
function mockWorker({providerFails=false,attempts=1}={}){
 const calls=[];
 async function fetcher(url,options){
  calls.push({url,options});
  if(url.endsWith('/rpc/claim_investor_emails'))return Response.json(['investor','team'].map((recipient_kind,i)=>({id:'job'+i,interest_id:interest.id,recipient_kind,attempts})));
  if(url.includes('/investor_interests?'))return Response.json([interest]);
  if(url.includes('/investor_applications?'))return Response.json([investor]);
  if(url.includes('/investor_projects?'))return Response.json([project]);
  if(url==='https://api.resend.com/emails')return providerFails?new Response('Unavailable',{status:503}):Response.json({id:'provider1'});
  if(url.includes('/investor_email_queue?'))return new Response(null,{status:204});
  throw new Error('Unexpected request');
 }
 return {calls,fetcher};
}
test('unauthorized worker makes no external calls',async()=>{
 const response=await handleRequest(new Request('https://worker.test',{method:'POST'}),env,()=>{throw Error('Must not fetch');});assert.equal(response.status,401);
});
test('missing email configuration makes no external calls',async()=>{
 const response=await handleRequest(request(),key=>key==='RESEND_API_KEY'?null:env(key),()=>{throw Error('Must not fetch');});assert.equal(response.status,503);
});
test('only database investor and configured team receive email; stable idempotency keys',async()=>{
 const mock=mockWorker();const response=await handleRequest(request(),env,mock.fetcher);assert.deepEqual(await response.json(),{sent:2,failed:0});
 const mails=mock.calls.filter(c=>c.url==='https://api.resend.com/emails');assert.deepEqual(mails.map(c=>JSON.parse(c.options.body).to),[['investor@example.test'],['team@example.test']]);
 assert.deepEqual(mails.map(c=>c.options.headers['Idempotency-Key']),['investor-interest/job0','investor-interest/job1']);
 assert.equal(mock.calls.filter(c=>c.options.method==='PATCH').every(c=>JSON.parse(c.options.body).state==='sent'),true);
});
test('provider failure keeps both notifications pending for retry',async()=>{
 const mock=mockWorker({providerFails:true});const r=await handleRequest(request(),env,mock.fetcher);assert.deepEqual(await r.json(),{sent:0,failed:2});
 const changes=mock.calls.filter(c=>c.options.method==='PATCH').map(c=>JSON.parse(c.options.body));assert.equal(changes.every(c=>c.state==='pending'&&new Date(c.next_attempt_at)>new Date()),true);
});
test('sixth failed attempt stops retrying',async()=>{
 const mock=mockWorker({providerFails:true,attempts:6});await handleRequest(request(),env,mock.fetcher);assert.equal(mock.calls.filter(c=>c.options.method==='PATCH').every(c=>JSON.parse(c.options.body).state==='failed'),true);
});
test('confirmation includes reference and does not promise an investment',()=>{
 const mail=buildEmail('investor',interest,investor,project,{from:'team@example.test',team:'team@example.test',site:'https://site.test'});assert.match(mail.text,/T7-12345678/);assert.match(mail.text,/not a financial commitment/);
});
