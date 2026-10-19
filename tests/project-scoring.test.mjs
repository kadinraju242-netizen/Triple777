import test from 'node:test';
import assert from 'node:assert/strict';
await import('../js/investor-matching.js');
await import('../js/project-scoring.js');
const { opportunityScore, matchInvestor, rankInvestors, capitalNeeded } = globalThis.T7Projects;

const strong = {
  name: 'Ridge Diamonds', commodity: 'diamond', country: 'South Africa', province: 'KwaZulu-Natal',
  right_status: 'mining_right_granted', environmental_status: 'authorised', water_status: 'granted',
  technical_status: 'feasibility', project_stage: 'operational',
  infrastructure: ['power', 'water', 'road', 'plant', 'camp', 'rail'],
  offtake_status: 'signed', management_status: 'experienced',
  documents: [1, 2, 3, 4, 5, 6].map(i => ({ path: 'x/' + i })),
  estimated_resource: '1.2 Mct', grade: '12 cpht', latitude: -28.7, municipality: 'Msinga',
  capital_required_zar: 5000000, funding_structure: 'Self-funded to date', production_potential: '2,000 ct/month',
  investment_requirement: 'Second plant', management_notes: 'GM with 20 years', risks: 'Rainfall',
  capital_band: '500k-5m', investor_requirements: ['equipment_financing', 'equity', 'working_capital']
};

test('a fully developed project scores 100 and an empty one scores 0', () => {
  assert.equal(opportunityScore(strong).score, 100);
  assert.equal(opportunityScore(strong).rating, 'Strong');
  const empty = opportunityScore({});
  assert.equal(empty.score, 0);
  assert.equal(empty.breakdown.length, 7);
  assert.equal(empty.breakdown.reduce((s, p) => s + p.max, 0), 100);
});

test('infrastructure and information parts are capped at their maximum', () => {
  const s = opportunityScore(strong);
  assert.equal(s.breakdown.find(p => p.key === 'infrastructure').points, 10);
  assert.equal(s.breakdown.find(p => p.key === 'information').points, 10);
});

test('early-stage project lands in a lower band', () => {
  const early = opportunityScore({ right_status: 'prospecting_applied', environmental_status: 'in_progress', technical_status: 'historical', project_stage: 'greenfield', management_status: 'partial' });
  assert.ok(early.score < 35, String(early.score));
  assert.equal(early.rating, 'Needs work');
});

test('capital needed uses the exact figure, otherwise the bottom of the band', () => {
  assert.equal(capitalNeeded({ capital_required_zar: 3200000, capital_band: '500k-5m' }), 3200000);
  assert.equal(capitalNeeded({ capital_band: '5m-50m' }), 5000000);
  assert.equal(capitalNeeded({}), 0);
});

const ideal = {
  country: 'South Africa',
  application: { investment_budget_zar: 8000000, preferred_regions: 'KwaZulu-Natal', investment_types: ['Mining'], risk: 'Low risk / Low return', funds: 'Yes', verification: 'Yes', timing: '24–48 hours' }
};

test('the brief example: right budget, region, sector and readiness is a strong match', () => {
  const m = matchInvestor(strong, ideal);
  assert.equal(m.score, 100);
  assert.equal(m.level, 'Strong match');
  assert.match(m.structure, /Equipment financing/);
});

test('an investor below the requirement is flagged as a co-investor, not a full match', () => {
  const small = { country: 'South Africa', application: { investment_budget_zar: 1500000, investment_types: ['Mining'] } };
  const m = matchInvestor(strong, small);
  assert.equal(m.parts.capital, 18);
  assert.match(m.structure, /co-investor/);
  const tiny = matchInvestor(strong, { application: { investment_budget_zar: 200000 } });
  assert.equal(tiny.parts.capital, 0);
});

test('legacy capacity bands are read the same way as the investor dashboard', () => {
  const m = matchInvestor(strong, { application: { capacity: 'R5M+' } });
  assert.equal(m.parts.capital, 40);
});

test('location prefers region, then country, then residence', () => {
  const base = { application: { investment_budget_zar: 9e6 } };
  assert.equal(matchInvestor(strong, { ...base, application: { ...base.application, preferred_regions: 'kwazulu-natal' } }).parts.location, 25);
  assert.equal(matchInvestor(strong, { ...base, application: { ...base.application, preferred_countries: 'South Africa' } }).parts.location, 18);
  assert.equal(matchInvestor(strong, { ...base, country: 'south africa', application: { ...base.application, preferred_regions: 'Gauteng' } }).parts.location, 12);
  assert.equal(matchInvestor(strong, base).parts.location, 8);
});

test('high-risk investors suit greenfield, not operational projects', () => {
  const bold = { application: { investment_budget_zar: 9e6, risk: 'High risk / High return' } };
  assert.equal(matchInvestor({ ...strong, project_stage: 'greenfield' }, bold).parts.risk, 10);
  assert.equal(matchInvestor(strong, bold).parts.risk, 0);
  assert.match(matchInvestor(strong, bold).structure, /^Equity/);
});

test('ranking puts the best investor first', () => {
  const list = rankInvestors(strong, [{ application: { investment_budget_zar: 200000 } }, ideal]);
  assert.equal(list[0].investor, ideal);
});
