/* ============================================================
   Mine projects — options, Opportunity Score and the Match Engine
   ------------------------------------------------------------
   Plain functions with no page code, so the project form, the admin
   review screen and the tests (tests/project-scoring.test.mjs) all
   use exactly the same lists and arithmetic.

   Opportunity Score (out of 100) — fixed criteria, same for every
   project:
     Rights & regulatory   25   licence/right, environmental, water
     Technical confidence  20   how well the resource is known
     Project maturity      15   greenfield … operational
     Infrastructure        10   2 per item on site, up to 5 items
     Commercial / offtake  10   signed offtake down to none yet
     Management            10   team in place
     Information provided  10   documents + key details filled in

   Match score (out of 100%) — one project against one investor:
     Capital fit           40   budget against the capital required
     Location fit          25   preferred region/country, residence
     Sector fit            15   has the investor chosen Mining
     Risk vs stage         10   risk appetite against project stage
     Readiness             10   proof of funds, verification, speed

   Both are guidance for the team, not an approval or a valuation.
   ============================================================ */
(function (root) {
  'use strict';

  const opt = (value, label, points) => ({ value, label, points: points || 0 });

  const OPTIONS = {
    commodity: [
      opt('diamond', 'Diamond'), opt('gold', 'Gold'), opt('coal', 'Coal'), opt('chrome', 'Chrome'),
      opt('manganese', 'Manganese'), opt('titanium', 'Titanium minerals'), opt('pgm', 'Platinum group metals'),
      opt('iron_ore', 'Iron ore'), opt('copper', 'Copper'), opt('other', 'Other')
    ],
    provinces: ['KwaZulu-Natal', 'Gauteng', 'Limpopo', 'Mpumalanga', 'North West', 'Free State',
      'Northern Cape', 'Western Cape', 'Eastern Cape'],
    project_stage: [
      opt('greenfield', 'Greenfield', 2), opt('exploration', 'Exploration', 4), opt('prospecting', 'Prospecting', 6),
      opt('mining_right', 'Mining right', 11), opt('operational', 'Operational', 15),
      opt('care_maintenance', 'Care & maintenance', 9), opt('brownfield', 'Brownfield', 12),
      opt('expansion', 'Expansion', 14), opt('rehabilitation', 'Rehabilitation / redevelopment', 7)
    ],
    owner_role: [
      opt('owner', 'Owner / right holder'), opt('shareholder', 'Shareholder'), opt('operator', 'Operator / contractor'),
      opt('representative', 'Authorised representative'), opt('investor', 'Investor in the project'), opt('other', 'Other')
    ],
    right_status: [
      opt('none', 'No right or application yet', 0), opt('prospecting_applied', 'Prospecting right — applied', 4),
      opt('prospecting_granted', 'Prospecting right — granted', 10), opt('mining_permit', 'Mining permit — granted', 12),
      opt('mining_right_applied', 'Mining right — applied', 7), opt('mining_right_granted', 'Mining right — granted', 15),
      opt('other', 'Other (explain below)', 3)
    ],
    environmental_status: [
      opt('not_started', 'Not started', 0), opt('in_progress', 'Application in progress', 3),
      opt('authorised', 'Environmental authorisation granted', 6), opt('not_required', 'Not required at this stage', 6)
    ],
    water_status: [
      opt('none', 'No water use licence yet', 0), opt('applied', 'Water use licence applied for', 2),
      opt('granted', 'Water use licence granted', 4), opt('not_required', 'Not required', 4)
    ],
    technical_status: [
      opt('none', 'No technical data yet', 0), opt('historical', 'Historical / desktop data only', 4),
      opt('exploration_results', 'Exploration or sampling results', 8),
      opt('resource_estimate', 'Resource estimate (not code-compliant)', 12),
      opt('compliant_resource', 'SAMREC / JORC-compliant resource', 17),
      opt('feasibility', 'Feasibility study completed', 20)
    ],
    infrastructure: [
      opt('power', 'Grid power'), opt('water', 'Water supply'), opt('road', 'Road access'), opt('rail', 'Rail access'),
      opt('plant', 'Processing plant'), opt('camp', 'Site camp / accommodation'), opt('equipment', 'Equipment on site')
    ],
    offtake_status: [
      opt('none', 'No offtake yet', 0), opt('identified', 'Potential buyers identified', 4),
      opt('loi', 'LOI / MOU in place', 7), opt('signed', 'Signed offtake agreement', 10)
    ],
    capital_band: [
      Object.assign(opt('100k-500k', 'R100k – R500k'), { min: 100000, max: 500000 }),
      Object.assign(opt('500k-5m', 'R500k – R5m'), { min: 500000, max: 5000000 }),
      Object.assign(opt('5m-50m', 'R5m – R50m'), { min: 5000000, max: 50000000 }),
      Object.assign(opt('50m+', 'R50m+'), { min: 50000000, max: Infinity }),
      Object.assign(opt('strategic', 'Strategic / institutional'), { min: 50000000, max: Infinity })
    ],
    capital_use: [
      opt('equipment', 'Equipment'), opt('working_capital', 'Working capital'), opt('processing', 'Processing'),
      opt('offtake', 'Offtake / sales'), opt('exploration', 'Exploration & drilling'), opt('permitting', 'Permitting'),
      opt('infrastructure', 'Infrastructure'), opt('other', 'Other')
    ],
    investor_requirements: [
      opt('equity', 'Equity'), opt('debt', 'Debt'), opt('jv', 'Joint venture (JV)'),
      opt('offtake_financing', 'Offtake financing'), opt('equipment_financing', 'Equipment financing'),
      opt('working_capital', 'Working capital'), opt('strategic_partner', 'Strategic partner')
    ],
    management_status: [
      opt('to_appoint', 'Team still to be appointed', 1), opt('partial', 'Some key people in place', 5),
      opt('experienced', 'Experienced mining team in place', 10)
    ],
    document_kind: [
      opt('rights', 'Right / permit'), opt('geology', 'Geological report'), opt('sampling', 'Sampling / assay results'),
      opt('environmental', 'Environmental / water'), opt('financial', 'Financials / model'),
      opt('company', 'Company documents'), opt('photos', 'Site photos'), opt('other', 'Other')
    ],
    status: [
      opt('draft', 'Draft'), opt('submitted', 'Submitted'), opt('under_review', 'Under review'),
      opt('changes_requested', 'Changes requested'), opt('approved', 'Approved'), opt('rejected', 'Declined')
    ],
    /* What the project owner sees. Until the team decides, a submitted
       project simply waits for approval; nothing about scoring, matching
       or investor listings is shown to the owner. */
    owner_status: [
      opt('draft', 'Draft'), opt('submitted', 'Awaiting approval'), opt('under_review', 'Awaiting approval'),
      opt('changes_requested', 'Changes requested'), opt('approved', 'Approved'), opt('rejected', 'Not approved')
    ]
  };

  /* A photograph for each commodity, from the site's own image library. */
  const IMAGES = {
    diamond: 'images/mines/bucklands-wide.jpg', gold: 'images/lots/G-2201.jpg', coal: 'images/mines/site-04.jpg',
    chrome: 'images/minerals-mine-stones.jpg', manganese: 'images/mines/site-03.jpg', titanium: 'images/mines/site-10.jpg',
    pgm: 'images/mines/site-06.jpg', iron_ore: 'images/mines/site-09.jpg', copper: 'images/mineral-collection.jpg',
    other: 'images/mines/mine-projects.jpg'
  };
  function image(commodity) { return IMAGES[commodity] || 'images/mines/mine-projects.jpg'; }

  function find(list, value) { return (OPTIONS[list] || []).find(o => o.value === value) || null; }
  function label(list, value) {
    const o = find(list, value);
    return o ? o.label : (value == null ? '' : String(value));
  }
  function points(list, value) { const o = find(list, value); return o ? o.points : 0; }
  const filled = v => Array.isArray(v) ? v.length > 0 : v !== null && v !== undefined && String(v).trim() !== '';
  const normal = v => String(v || '').trim().toLowerCase();
  const listOf = v => (Array.isArray(v) ? v : String(v || '').split(',')).map(normal).filter(Boolean);

  /* ---------------- Opportunity Score ---------------- */
  function opportunityScore(p) {
    p = p || {};
    const parts = [];
    const add = (key, name, got, max, note) => parts.push({ key, label: name, points: Math.min(max, Math.round(got * 10) / 10), max, note });

    const rights = points('right_status', p.right_status) + points('environmental_status', p.environmental_status) + points('water_status', p.water_status);
    add('rights', 'Rights & regulatory', rights, 25,
      [label('right_status', p.right_status) || 'Right status not given', label('environmental_status', p.environmental_status), label('water_status', p.water_status)].filter(Boolean).join(' · '));

    add('technical', 'Technical confidence', points('technical_status', p.technical_status), 20,
      label('technical_status', p.technical_status) || 'Not given');

    add('maturity', 'Project maturity', points('project_stage', p.project_stage), 15,
      label('project_stage', p.project_stage) || 'Not given');

    const infra = (p.infrastructure || []).filter(v => find('infrastructure', v));
    add('infrastructure', 'Infrastructure', infra.length * 2, 10,
      infra.length ? infra.map(v => label('infrastructure', v)).join(', ') : 'None listed');

    add('offtake', 'Commercial / offtake', points('offtake_status', p.offtake_status), 10,
      label('offtake_status', p.offtake_status) || 'Not given');

    add('management', 'Management', points('management_status', p.management_status), 10,
      label('management_status', p.management_status) || 'Not given');

    const docs = Array.isArray(p.documents) ? p.documents.length : 0;
    const details = ['estimated_resource', 'grade', 'latitude', 'municipality', 'capital_required_zar',
      'funding_structure', 'production_potential', 'investment_requirement', 'management_notes', 'risks'];
    const done = details.filter(k => filled(p[k])).length;
    add('information', 'Information provided', Math.min(docs, 5) + done * 0.5, 10,
      docs + ' document' + (docs === 1 ? '' : 's') + ' · ' + done + ' of ' + details.length + ' key details');

    const score = Math.round(parts.reduce((s, x) => s + x.points, 0));
    const rating = score >= 75 ? 'Strong' : score >= 55 ? 'Promising' : score >= 35 ? 'Early stage' : 'Needs work';
    return { score, rating, breakdown: parts };
  }

  /* ---------------- Match Engine ---------------- */

  /* The amount the project is asking for, in rand. An exact figure wins;
     otherwise the bottom of the chosen band (the cautious reading). */
  function capitalNeeded(p) {
    const exact = Number(p && p.capital_required_zar);
    if (Number.isFinite(exact) && exact > 0) return exact;
    const band = find('capital_band', p && p.capital_band);
    return band ? band.min : 0;
  }

  /* An investor's budget as {min, max}. Uses the same reading as the
     investor dashboard (js/investor-matching.js) when it is loaded. */
  function investorBudget(application) {
    const shared = root.T7InvestorMatch && root.T7InvestorMatch.budget;
    if (shared) return shared(application || {});
    const exact = Number(application && application.investment_budget_zar);
    return Number.isFinite(exact) && exact > 0 ? { min: exact, max: exact } : { min: 0, max: 0 };
  }

  const STAGE_RISK = {
    greenfield: 3, exploration: 3, prospecting: 3, rehabilitation: 3,
    mining_right: 2, care_maintenance: 2, brownfield: 2, expansion: 2,
    operational: 1
  };
  function appetite(text) {
    const t = normal(text);
    if (t.startsWith('high')) return 3;
    if (t.startsWith('medium')) return 2;
    if (t.startsWith('low')) return 1;
    return 0;
  }

  function rand(n) {
    if (!Number.isFinite(n)) return 'no upper limit';
    if (n >= 1e6) return 'R' + (Math.round(n / 1e5) / 10).toString().replace(/\.0$/, '') + 'm';
    if (n >= 1e3) return 'R' + Math.round(n / 1e3) + 'k';
    return 'R' + Math.round(n);
  }

  function matchInvestor(p, investor) {
    p = p || {}; investor = investor || {};
    const a = investor.application || {};
    const reasons = [];
    const parts = {};

    // Capital fit — 40
    const need = capitalNeeded(p), b = investorBudget(a);
    let capital = 0, covers = 'none';
    if (!need) { reasons.push('Project capital requirement not set'); }
    else if (!b.max) { reasons.push('Investor has not given a budget'); }
    else if (b.min >= need) { capital = 40; covers = 'full'; reasons.push('Budget covers the ' + rand(need) + ' required'); }
    else if (b.max >= need) { capital = 30; covers = 'full'; reasons.push('Budget range reaches ' + rand(need) + ' — confirm the amount'); }
    else if (b.max >= need * 0.25) { capital = 18; covers = 'part'; reasons.push('Could fund part (up to ' + rand(b.max) + ' of ' + rand(need) + ')'); }
    else { reasons.push('Budget is well below the ' + rand(need) + ' required'); }
    parts.capital = capital;

    // Location fit — 25
    const province = normal(p.province), country = normal(p.country || 'South Africa');
    const regions = listOf(a.preferred_regions), countries = listOf(a.preferred_countries);
    const regionHit = province && regions.some(r => r === province || r.includes(province) || province.includes(r));
    let location = 0;
    if (regionHit) { location = 25; reasons.push('Prefers projects in ' + p.province); }
    else if (countries.includes(country)) { location = 18; reasons.push('Prefers projects in ' + (p.country || 'South Africa')); }
    else if (normal(investor.country) === country) { location = 12; reasons.push('Based in ' + (p.country || 'South Africa')); }
    else if (!regions.length && !countries.length) { location = 8; reasons.push('No location preference given'); }
    else { reasons.push('Outside the investor\'s preferred locations'); }
    parts.location = location;

    // Sector fit — 15
    const types = (a.investment_types || []).map(normal);
    let sector = 0;
    if (types.includes('mining')) { sector = 15; reasons.push('Has invested in mining'); }
    else if (!types.length) sector = 6;
    else if (types.includes('none')) sector = 3;
    else sector = 4;
    parts.sector = sector;

    // Risk appetite vs stage — 10
    const want = appetite(a.risk), stage = STAGE_RISK[p.project_stage] || 0;
    let risk = 5;
    if (want && stage) {
      const gap = Math.abs(want - stage);
      risk = gap === 0 ? 10 : gap === 1 ? 5 : 0;
      if (gap === 0) reasons.push('Risk appetite suits this project stage');
      if (gap === 2) reasons.push('Risk appetite does not suit this stage');
    }
    parts.risk = risk;

    // Readiness — 10
    let ready = 0;
    if (normal(a.funds) === 'yes') ready += 4;
    if (normal(a.verification) === 'yes') ready += 3;
    const timing = normal(a.timing);
    ready += timing.startsWith('24') ? 3 : timing.startsWith('1 week') ? 2 : timing ? 1 : 0;
    if (ready >= 7) reasons.push('Proof of funds and verification available');
    parts.readiness = ready;

    const score = capital + location + sector + risk + ready;
    const level = score >= 75 ? 'Strong match' : score >= 55 ? 'Good match' : score >= 35 ? 'Possible match' : 'Weak match';
    return { score, level, reasons, parts, structure: suggestStructure(p, want, covers) };
  }

  /* Which of the project's requested support types to lead with for
     this investor, and whether others need to come in alongside. */
  function suggestStructure(p, want, covers) {
    const asked = (p.investor_requirements || []).filter(v => find('investor_requirements', v));
    if (!asked.length) return 'To be agreed';
    const growth = ['equity', 'jv', 'strategic_partner', 'offtake_financing', 'equipment_financing', 'working_capital', 'debt'];
    const secured = ['debt', 'equipment_financing', 'offtake_financing', 'working_capital', 'jv', 'equity', 'strategic_partner'];
    const order = want === 3 ? growth : want === 1 ? secured : null;
    const ranked = order ? asked.slice().sort((x, y) => order.indexOf(x) - order.indexOf(y)) : asked.slice();
    let text = ranked.slice(0, 2).map(v => label('investor_requirements', v)).join(' or ');
    if (covers === 'part') text += ' — as a co-investor, with others for the balance';
    return text;
  }

  /* All investors for one project, best first. */
  function rankInvestors(p, investors) {
    return (investors || []).map(inv => Object.assign({ investor: inv }, matchInvestor(p, inv)))
      .sort((x, y) => y.score - x.score);
  }

  root.T7Projects = { OPTIONS, image, label, find, opportunityScore, capitalNeeded, matchInvestor, rankInvestors, rand };
})(typeof window === 'undefined' ? globalThis : window);
