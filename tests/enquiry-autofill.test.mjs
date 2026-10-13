import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../js/enquiry-autofill.js',import.meta.url),'utf8');
const tradeKey='sb-project-auth-token',investorKey='t7.investor.auth';
const tick=()=>new Promise(setImmediate);
function setup({sessions={},cached=false,prefilled={},delay,local=false}={}){
 const fields=Object.fromEntries(['name','email','phone','company','country','message'].map(name=>[name,{value:prefilled[name]||'',maxLength:200}]));
 const events={},storageEvents={},stored={};for(const key of Object.keys(sessions))stored[key]='session';if(cached)stored['t7.session']='stale cached identity';
 const form={addEventListener:(name,fn)=>events[name]=fn,querySelector:selector=>fields[selector.match(/name="(.*?)"/)[1]]};let libraries=0,profileReads=0;
 const window={T7_CONFIG:local?{}:{supabaseUrl:'https://project.supabase.co',supabaseAnonKey:'public'},addEventListener:(name,fn)=>storageEvents[name]=fn,
  supabase:{createClient:(url,key,options)=>{const s=sessions[options.auth.storageKey];return {auth:{getSession:async()=>({data:{session:s?{user:s.user}:null}}),getUser:async()=>s?.invalid?{error:{message:'Invalid token'}}:{data:{user:s.user}}},from:table=>({select(){return this},eq(){return this},maybeSingle:async()=>{profileReads++;if(delay)await delay;return {data:table==='profiles'?s.trade:s.investor};}})};}}
 };
 const context={window,document:{querySelectorAll:()=>[form],head:{append(){libraries++;}}},localStorage:{getItem:key=>stored[key]||null},URL,WeakSet,Map,fetch:async()=>({ok:true,json:async()=>({data:{first_name:'Local',last_name:'Buyer',email:'local@example.test',phone:'123'}})})};
 vm.runInNewContext(source,context);
 return {fields,stored,input:field=>events.input({target:fields[field]}),storage:key=>storageEvents.storage({key}),libraries:()=>libraries,profileReads:()=>profileReads};
}
test('Trade login fills contact fields and leaves enquiry content alone',async()=>{
 const state=setup({sessions:{[tradeKey]:{user:{id:'trade',email:'trade@example.test'},trade:{first_name:'Trade',last_name:'Buyer',phone:'+27 123'},investor:null}},prefilled:{message:'My own enquiry'}});await tick();assert.equal(state.fields.name.value,'Trade Buyer');assert.equal(state.fields.email.value,'trade@example.test');assert.equal(state.fields.phone.value,'+27 123');assert.equal(state.fields.message.value,'My own enquiry');
});
test('Investor login uses investor details and most recent verified login wins',async()=>{
 const state=setup({sessions:{[tradeKey]:{user:{id:'older',email:'old@example.test',last_sign_in_at:'2026-10-12T10:00:00Z'},trade:{first_name:'Older'}},[investorKey]:{user:{id:'investor',email:'investor@example.test',last_sign_in_at:'2026-10-13T10:00:00Z'},trade:{first_name:'Other',phone:'123'},investor:{full_name:'Investor Name',phone:'456',company:'Investor Company'}}}});await tick();assert.equal(state.fields.name.value,'Investor Name');assert.equal(state.fields.email.value,'investor@example.test');assert.equal(state.fields.phone.value,'456');assert.equal(state.fields.company.value,'Investor Company');
});
test('Visitors and invalid sessions never use cached identities',async()=>{
 const visitor=setup({cached:true});await tick();assert.equal(visitor.fields.name.value,'');assert.equal(visitor.libraries(),0);assert.equal(visitor.profileReads(),0);
 const invalid=setup({cached:true,sessions:{[tradeKey]:{user:{id:'bad'},invalid:true}}});await tick();assert.equal(invalid.fields.email.value,'');assert.equal(invalid.profileReads(),0);
});
test('Existing or edited fields are preserved even when profile loading is delayed',async()=>{
 let finish;const delay=new Promise(resolve=>finish=resolve);const state=setup({sessions:{[tradeKey]:{user:{id:'one',email:'one@example.test'},trade:{first_name:'One',phone:'123'}}},prefilled:{name:'Already entered'},delay});await tick();state.fields.phone.value='Custom phone';state.input('phone');finish();await tick();assert.equal(state.fields.name.value,'Already entered');assert.equal(state.fields.phone.value,'Custom phone');assert.equal(state.fields.email.value,'one@example.test');
});
test('Signing out in another tab clears only unedited autofilled details',async()=>{
 const state=setup({sessions:{[tradeKey]:{user:{id:'one',email:'one@example.test'},trade:{first_name:'One',phone:'123'}}}});await tick();state.fields.phone.value='My new phone';state.input('phone');delete state.stored[tradeKey];state.storage(tradeKey);await tick();assert.equal(state.fields.name.value,'');assert.equal(state.fields.email.value,'');assert.equal(state.fields.phone.value,'My new phone');
});
test('Local Trade sessions use the authenticated local API',async()=>{
 const state=setup({local:true,sessions:{'t7.local-token':{}}});await tick();assert.equal(state.fields.name.value,'Local Buyer');assert.equal(state.fields.email.value,'local@example.test');
});
