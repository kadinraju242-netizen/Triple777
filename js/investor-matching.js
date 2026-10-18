/* Deterministic matching. Residence restrictions and location preferences stay distinct. */
(function(root){
 const normal=value=>String(value||'').trim().toLowerCase();
 const list=value=>(Array.isArray(value)?value:String(value||'').split(',')).map(normal).filter(Boolean);
 function budget(application={}) {
  const exact=Number(application.investment_budget_zar);
  if(Number.isFinite(exact)&&exact>0)return {min:exact,max:exact};
  const text=String(application.capacity||'').replaceAll(',','');
  if(/under|below/i.test(text))return {min:0,max:Number(text.match(/[\d.]+/)?.[0]||0)};
  const nums=[...text.matchAll(/([\d.]+)\s*(m|million|k)?/gi)].map(m=>Number(m[1])*(m[2]?.toLowerCase().startsWith('m')?1e6:m[2]?.toLowerCase()==='k'?1e3:1));
  return {min:nums[0]||0,max:/\+/.test(text)?Infinity:nums[1]||nums[0]||0};
 }
 function match(record,project){
  const a=record.application||{},b=budget(a),minimum=Number(project.minimum_investment_zar),reasons=[];
  const country=normal(project.country),region=normal(project.region),residence=normal(record.country);
  const allowed=list(project.eligible_countries),countries=list(a.preferred_countries),regions=list(a.preferred_regions);
  if(allowed.length&&(!residence||!allowed.includes(residence)))return {level:'Other opportunity',score:0,reasons:['Residence does not meet the project country criteria']};
  if(!minimum||!country)return {level:'Details pending',score:1,reasons:['Project budget or location criteria not published']};
  if(!b.max)return {level:'Complete profile',score:2,reasons:['Add your investment budget']};
  if(minimum>b.max)return {level:'Outside budget',score:0,reasons:['Minimum participation exceeds your budget']};
  const preferred= countries.includes(country)||regions.includes(region);
  const local=Boolean(residence&&residence===country);
  reasons.push(b.min>=minimum?'Within your budget':'Budget range overlaps · confirm available amount');
  if(local)reasons.push('Matches your country of residence');
  if(preferred)reasons.push('Matches your preferred project location');
  if(!preferred&&!local)reasons.push(countries.length||regions.length?'Outside your preferred locations':'Add preferred project locations');
  const matched=b.min>=minimum&&(local||preferred);
  return {level:matched?'Matched': 'Potential match',score:matched?100+(local?10:0)+(preferred?20:0):10+(local?10:0)+(preferred?20:0),reasons};
 }
 root.T7InvestorMatch={match,budget};
})(typeof window==='undefined'?globalThis:window);
