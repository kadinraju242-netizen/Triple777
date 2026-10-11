/* ============================================================
   Triple 7 Holdings — what can be listed
   ------------------------------------------------------------
   ONE place that says which commodities the desk trades and which
   details a seller gives for each. The sell form, the buyer's
   request form, the lot page, the board filters and the admin
   dashboard all read this, so adding a field or a commodity is a
   change here (and in the database check constraint) only.

   The list is South Africa's 26 leading mineral commodities, plus
   the four coloured gemstones on the Minerals page (ruby,
   sapphire, emerald, tanzanite). Each sits in a group so the
   board can be filtered by group first, then by commodity.

   To add a commodity: add it here, to GROUPS, AND to the check
   constraint on lots.commodity / buy_requests.commodity in
   supabase/01_schema.sql (and local-db/schema.sql), with a lot
   number prefix in public.lot_prefix().

   Field storage:
     type, weight, quantity, origin -> their own columns on lots
     every field in `fields`        -> inside lots.specs (jsonb)
   ============================================================ */
window.T7 = window.T7 || {};

(function () {
  const CERT_STONE = ['GIA', 'IGI', 'HRD', 'EGL', 'GRS', 'SSEF', 'Gübelin', 'None'];
  const CERT_METAL = ['Rand Refinery', 'LBMA refiner', 'Independent assay', 'None'];
  const STONE_SHAPES = ['Round', 'Oval', 'Cushion', 'Emerald', 'Pear', 'Princess', 'Marquise', 'Heart', 'Cabochon', 'Rough / uncut'];
  const STONE_CLARITY = ['Eye clean', 'Slightly included', 'Moderately included', 'Heavily included'];
  const METAL_FORMS = ['Bar', 'Coin', 'Grain', 'Jewellery', 'Scrap'];
  const PGM_FORMS = ['Sponge', 'Grain', 'Powder', 'Bar', 'Ingot'];
  const PGM_PURITY = ['99.95%', '99.9%', '99.5%', 'Below 99.5%'];

  /* Bulk commodities are bought by the tonne and on a delivery basis. */
  const DELIVERY = ['FOT mine', 'FCA rail siding', 'FOB Durban', 'FOB Richards Bay', 'FOB Saldanha Bay',
    'FOB Port Elizabeth (Ngqura)', 'CIF destination port', 'To be agreed'];
  const ASSAY = ['SGS', 'Bureau Veritas', 'Intertek', 'Alex Stewart', 'Mine laboratory', 'None'];

  function stone(label, plural, prefix, colours, treatments) {
    return {
      label: label, plural: plural, prefix: prefix, symbol: null, unit: 'ct', unitLabel: 'Carat weight',
      typeLabel: 'Cut or rough', types: ['Cut', 'Rough'],
      fields: [
        { key: 'shape',       label: 'Shape',       options: STONE_SHAPES },
        { key: 'colour',      label: 'Colour',      options: colours },
        { key: 'clarity',     label: 'Clarity',     options: STONE_CLARITY },
        { key: 'treatment',   label: 'Treatment',   options: treatments },
        { key: 'certificate', label: 'Certificate', options: CERT_STONE }
      ]
    };
  }

  function metal(label, prefix, symbol, purities, forms, certs) {
    return {
      label: label, plural: label, prefix: prefix, symbol: symbol, unit: 'g', unitLabel: 'Weight in grams',
      typeLabel: 'Form', types: forms || METAL_FORMS,
      fields: [
        { key: 'purity',      label: 'Purity',              options: purities },
        { key: 'certificate', label: 'Assay / certificate', options: certs || CERT_METAL }
      ]
    };
  }

  /* Ores, concentrates, alloys and industrial minerals: tonnes, a
     grade, a delivery basis and who assayed it. */
  function bulk(label, prefix, symbol, typeLabel, types, gradeLabel, grades, extra) {
    return {
      label: label, plural: label, prefix: prefix, symbol: symbol, unit: 't', unitLabel: 'Quantity in tonnes',
      typeLabel: typeLabel, types: types,
      fields: [{ key: 'grade', label: gradeLabel, options: grades }]
        .concat(extra || [])
        .concat([
          { key: 'delivery', label: 'Delivery basis', options: DELIVERY },
          { key: 'assay',    label: 'Assay by',       options: ASSAY }
        ])
    };
  }

  const COMMODITIES = {
    /* ---- Precious stones ---- */
    diamond: {
      label: 'Diamond', plural: 'Diamonds', prefix: 'D', symbol: 'C', unit: 'ct', unitLabel: 'Carat weight',
      typeLabel: 'Polished or rough', types: ['Polished', 'Rough'],
      fields: [
        { key: 'shape',       label: 'Cut (shape)', options: ['Round Brilliant', 'Princess', 'Cushion', 'Oval', 'Emerald', 'Pear', 'Marquise', 'Radiant', 'Asscher', 'Heart', 'Rough / uncut'] },
        { key: 'colour',      label: 'Colour',      options: ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'Fancy', 'Mixed'] },
        { key: 'clarity',     label: 'Clarity',     options: ['FL', 'IF', 'VVS1', 'VVS2', 'VS1', 'VS2', 'SI1', 'SI2', 'I1', 'Mixed'] },
        { key: 'cut_grade',   label: 'Cut grade',   options: ['Excellent', 'Very Good', 'Good', 'Fair', 'Not graded'] },
        { key: 'certificate', label: 'Certificate', options: ['GIA', 'IGI', 'HRD', 'EGL', 'None'] }
      ]
    },
    ruby: stone('Ruby', 'Rubies', 'R',
      ['Pigeon blood red', 'Red', 'Pinkish red', 'Purplish red'],
      ['None', 'Heated', 'Glass filled', 'Unknown']),
    sapphire: stone('Sapphire', 'Sapphires', 'SA',
      ['Royal blue', 'Cornflower blue', 'Blue', 'Padparadscha', 'Pink', 'Yellow', 'Green', 'White'],
      ['None', 'Heated', 'Diffusion', 'Unknown']),
    emerald: stone('Emerald', 'Emeralds', 'E',
      ['Vivid green', 'Green', 'Bluish green', 'Light green'],
      ['None', 'Minor oil', 'Moderate oil', 'Significant oil', 'Unknown']),
    tanzanite: stone('Tanzanite', 'Tanzanites', 'T',
      ['Vivid violet-blue (AAAA)', 'Violet-blue (AAA)', 'Blue-violet (AA)', 'Light violet (A)'],
      ['Heated', 'Unheated', 'Unknown']),

    /* ---- Precious metals ---- */
    gold: metal('Gold', 'G', 'Au', ['24K (999.9)', '22K (916)', '18K (750)', '14K (585)', '9K (375)', 'Doré (unrefined)'],
      ['Bar', 'Coin', 'Nugget', 'Dust / granules', 'Doré bar', 'Jewellery', 'Scrap']),
    silver: metal('Silver', 'S', 'Ag', ['999', '958', '925', '800']),

    /* ---- Platinum group metals ---- */
    platinum:  metal('Platinum',  'P',  'Pt', ['999.5', '950', '900', '850']),
    palladium: metal('Palladium', 'PD', 'Pd', PGM_PURITY, PGM_FORMS),
    rhodium:   metal('Rhodium',   'RH', 'Rh', PGM_PURITY, PGM_FORMS),
    iridium:   metal('Iridium',   'IR', 'Ir', PGM_PURITY, PGM_FORMS),
    ruthenium: metal('Ruthenium', 'RU', 'Ru', PGM_PURITY, PGM_FORMS),

    /* ---- Ferrous metals and alloys ---- */
    iron_ore: bulk('Iron ore', 'FE', 'Fe', 'Product', ['Lump', 'Fines', 'Concentrate', 'Pellets'],
      'Iron (Fe) grade', ['Fe 58–60%', 'Fe 60–62%', 'Fe 62–64%', 'Fe 64–66%', 'Fe 66% and above']),
    manganese: bulk('Manganese ore', 'MN', 'Mn', 'Product', ['Lump', 'Fines', 'Sinter'],
      'Manganese (Mn) grade', ['Mn 30–34%', 'Mn 34–37%', 'Mn 37–40%', 'Mn 40–44%', 'Mn 44% and above']),
    chrome: bulk('Chrome ore', 'CR', 'Cr', 'Product', ['Lumpy ore', 'Chip ore', 'Metallurgical concentrate', 'Chemical-grade concentrate', 'Foundry sand'],
      'Cr₂O₃ grade', ['Cr₂O₃ 38–40%', 'Cr₂O₃ 40–42%', 'Cr₂O₃ 42–44%', 'Cr₂O₃ 44–46%', 'Cr₂O₃ 46% and above']),
    ferrochrome: bulk('Ferrochrome', 'FC', 'FeCr', 'Type', ['High-carbon', 'Charge chrome', 'Medium-carbon', 'Low-carbon'],
      'Chromium (Cr) content', ['Cr 50–55%', 'Cr 55–60%', 'Cr 60–65%', 'Cr 65% and above']),
    vanadium: bulk('Vanadium', 'V', 'V', 'Product', ['Vanadium pentoxide flake', 'Vanadium pentoxide powder', 'Ferrovanadium', 'Vanadium slag', 'Titaniferous magnetite'],
      'Grade', ['V₂O₅ 98% and above', 'FeV 78–82%', 'Slag or ore (see description)']),

    /* ---- Base and battery metals ---- */
    copper: bulk('Copper', 'CU', 'Cu', 'Product', ['Cathode', 'Concentrate', 'Rod / wire', 'Scrap'],
      'Grade', ['Grade A cathode (99.99%)', 'Standard cathode', 'Concentrate Cu 20–25%', 'Concentrate Cu 25–30%', 'Concentrate Cu 30% and above', 'Mixed scrap']),
    nickel: bulk('Nickel', 'NI', 'Ni', 'Product', ['Cathode / briquettes', 'Concentrate', 'Nickel sulphate', 'Matte'],
      'Grade', ['Metal 99.8% and above', 'Concentrate Ni 10–15%', 'Sulphate Ni 22%', 'Other (see description)']),
    cobalt: bulk('Cobalt', 'CO', 'Co', 'Product', ['Metal', 'Hydroxide', 'Cobalt sulphate', 'Concentrate'],
      'Grade', ['Metal 99.8% and above', 'Hydroxide Co 30–40%', 'Sulphate Co 20.5%', 'Other (see description)']),
    zinc: bulk('Zinc', 'ZN', 'Zn', 'Product', ['Concentrate', 'Special high grade ingot', 'Scrap'],
      'Grade', ['Concentrate Zn 45–50%', 'Concentrate Zn 50–55%', 'SHG 99.995%', 'Other (see description)']),
    lead: bulk('Lead', 'PB', 'Pb', 'Product', ['Concentrate', 'Ingot', 'Scrap'],
      'Grade', ['Concentrate Pb 55–65%', 'Concentrate Pb 65% and above', 'Ingot 99.97%', 'Other (see description)']),
    aluminium: bulk('Aluminium', 'AL', 'Al', 'Product', ['Primary ingot', 'T-bar / sow', 'Billet', 'Scrap'],
      'Grade', ['P1020 (99.7%)', '99.5%', 'Alloy', 'Scrap']),

    /* ---- Energy ---- */
    coal: bulk('Coal', 'C', 'C', 'Size', ['RB1', 'RB2', 'RB3', 'Nuts', 'Peas', 'Duff / fines'],
      'Calorific value', ['6000 kcal/kg NAR and above', '5500 kcal/kg NAR', '5000 kcal/kg NAR', '4800 kcal/kg NAR', 'Below 4800 kcal/kg'],
      [{ key: 'sulphur', label: 'Sulphur', options: ['Below 0.8%', '0.8–1%', 'Above 1%'] }]),

    /* ---- Industrial minerals and mineral sands ---- */
    titanium: bulk('Titanium minerals', 'TI', 'Ti', 'Product', ['Ilmenite', 'Rutile', 'Titanium slag', 'Leucoxene'],
      'TiO₂ grade', ['TiO₂ 46–50%', 'TiO₂ 50–54%', 'TiO₂ 85% and above (slag)', 'TiO₂ 94% and above (rutile)']),
    zircon: bulk('Zircon', 'ZR', 'Zr', 'Product', ['Premium zircon', 'Standard zircon', 'Zircon concentrate', 'Zircon flour'],
      'ZrO₂ grade', ['ZrO₂ 66% and above', 'ZrO₂ 65–66%', 'ZrO₂ below 65%']),
    fluorspar: bulk('Fluorspar', 'FL', 'CaF₂', 'Grade type', ['Acid grade', 'Metallurgical grade', 'Ceramic grade'],
      'CaF₂ content', ['CaF₂ 97% and above', 'CaF₂ 85–97%', 'CaF₂ below 85%']),
    phosphate: bulk('Phosphate rock', 'PH', 'P', 'Product', ['Rock concentrate', 'Phosphoric acid'],
      'P₂O₅ grade', ['P₂O₅ 30–32%', 'P₂O₅ 32–35%', 'P₂O₅ 35% and above']),
    andalusite: bulk('Andalusite', 'AN', 'Al₂SiO₅', 'Product', ['Kiln-run', 'Graded', 'Fines'],
      'Al₂O₃ grade', ['Al₂O₃ 57–58%', 'Al₂O₃ 58–59%', 'Al₂O₃ 59% and above']),
    vermiculite: bulk('Vermiculite', 'VM', 'Vm', 'Size grade', ['Micron', 'Superfine', 'Fine', 'Medium', 'Large', 'Premium'],
      'State', ['Unexfoliated (crude)', 'Exfoliated'])
  };

  /* The board filters by group first, then by commodity. */
  const GROUPS = [
    { key: 'stones',     label: 'Precious stones',        items: ['diamond', 'ruby', 'sapphire', 'emerald', 'tanzanite'] },
    { key: 'precious',   label: 'Precious metals',        items: ['gold', 'silver'] },
    { key: 'pgm',        label: 'Platinum group metals',  items: ['platinum', 'palladium', 'rhodium', 'iridium', 'ruthenium'] },
    { key: 'ferrous',    label: 'Ferrous and alloys',     items: ['iron_ore', 'manganese', 'chrome', 'ferrochrome', 'vanadium'] },
    { key: 'base',       label: 'Base and battery metals', items: ['copper', 'nickel', 'cobalt', 'zinc', 'lead', 'aluminium'] },
    { key: 'energy',     label: 'Energy',                 items: ['coal'] },
    { key: 'industrial', label: 'Industrial minerals',    items: ['titanium', 'zircon', 'fluorspar', 'phosphate', 'andalusite', 'vermiculite'] }
  ];

  const ORDER = GROUPS.reduce((all, g) => all.concat(g.items), []);
  GROUPS.forEach(g => g.items.forEach(k => { COMMODITIES[k].group = g.key; }));

  /* South Africa's 26 leading mineral commodities (the four coloured
     gemstones are the ones that are not). */
  const SA_TOP = ORDER.filter(k => ['ruby', 'sapphire', 'emerald', 'tanzanite'].indexOf(k) === -1);
  SA_TOP.forEach(k => { COMMODITIES[k].saTop = true; });

  const STATUS = {
    pending:   { label: 'Waiting for approval', short: 'Pending',   tone: 'wait' },
    live:      { label: 'Live on the board',    short: 'Live',      tone: 'good' },
    rejected:  { label: 'Not approved',         short: 'Rejected',  tone: 'bad'  },
    sold:      { label: 'Sold',                 short: 'Sold',      tone: 'done' },
    withdrawn: { label: 'Withdrawn',            short: 'Withdrawn', tone: 'done' }
  };

  /* Where an enquiry stands. Every message goes through the desk:
     buyer -> desk -> seller -> desk -> buyer. */
  const ENQUIRY_STATUS = {
    new:            { label: 'Waiting for the desk',  buyer: 'With the desk',      tone: 'wait' },
    with_seller:    { label: 'Asked the seller',      buyer: 'With the desk',      tone: 'new'  },
    seller_replied: { label: 'Seller replied',        buyer: 'With the desk',      tone: 'wait' },
    answered:       { label: 'Answered',              buyer: 'The desk replied',   tone: 'good' },
    closed:         { label: 'Closed',                buyer: 'Closed',             tone: 'done' }
  };

  const REQUEST_STATUS = {
    new:      { label: 'Received',        tone: 'wait' },
    sourcing: { label: 'Sourcing',        tone: 'new'  },
    matched:  { label: 'Match found',     tone: 'good' },
    closed:   { label: 'Closed',          tone: 'done' }
  };

  const TIMEFRAMES = ['As soon as possible', 'Within a month', 'One to three months', 'Ongoing supply', 'Flexible'];

  const COUNTRIES = ['South Africa', 'Botswana', 'Namibia', 'Zimbabwe', 'Zambia', 'Mozambique', 'Lesotho', 'Eswatini',
    'Angola', 'Tanzania', 'Kenya', 'Nigeria', 'Ghana', 'DR Congo', 'United Arab Emirates', 'India', 'China', 'Hong Kong',
    'Japan', 'South Korea', 'Israel', 'Belgium', 'United Kingdom', 'United States', 'Switzerland', 'Germany', 'Netherlands', 'Australia', 'Other'];

  /* R 1 250 000 — the way rand is written in South Africa. Cents are
     dropped unless there are some. */
  function money(value) {
    const n = Number(value);
    if (!isFinite(n)) return '';
    const whole = Math.floor(Math.abs(n));
    const cents = Math.round((Math.abs(n) - whole) * 100);
    const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return (n < 0 ? '-' : '') + 'R ' + grouped + (cents ? ',' + String(cents).padStart(2, '0') : '');
  }

  /* R 1.2m / R 340k for tiles and chart labels. */
  function moneyShort(value) {
    const n = Number(value) || 0;
    if (n >= 1e9) return 'R ' + (n / 1e9).toFixed(n >= 1e10 ? 0 : 1) + 'bn';
    if (n >= 1e6) return 'R ' + (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'm';
    if (n >= 1e3) return 'R ' + Math.round(n / 1e3) + 'k';
    return 'R ' + Math.round(n);
  }

  const grouped = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  function amount(value, unit) {
    if (value == null || value === '') return '';
    const n = Number(value);
    if (unit === 'g' && n >= 1000) return (n / 1000).toLocaleString('en-ZA', { maximumFractionDigits: 3 }).replace(',', '.') + ' kg';
    if (unit === 't') return grouped(Math.round(n * 1000) / 1000) + ' t';
    return String(n) + ' ' + (unit || '');
  }

  function weight(lot) {
    return lot.weight == null ? '' : amount(lot.weight, lot.weight_unit);
  }

  /* The short line under a lot name: "Polished · 1.52 ct · F · VS1 · GIA". */
  function summary(lot) {
    const c = COMMODITIES[lot.commodity];
    const specs = lot.specs || {};
    const parts = [lot.type, weight(lot)];
    if (c) {
      c.fields.forEach(f => {
        const v = specs[f.key];
        if (!v || v === 'None' || v === 'Unknown' || v === 'Not graded' || v === 'Mixed' || v === 'To be agreed') return;
        if (f.key === 'shape' || f.key === 'cut_grade' || f.key === 'treatment' || f.key === 'assay') return;
        parts.push(f.key === 'certificate' ? v + (c.unit === 'ct' ? ' certified' : '') : v);
      });
    }
    return parts.filter(Boolean);
  }

  T7.catalog = {
    commodities: COMMODITIES,
    groups: GROUPS,
    order: ORDER,
    saTop: SA_TOP,
    status: STATUS,
    enquiryStatus: ENQUIRY_STATUS,
    requestStatus: REQUEST_STATUS,
    timeframes: TIMEFRAMES,
    countries: COUNTRIES,
    get: key => COMMODITIES[key] || null,
    group: key => GROUPS.find(g => g.key === key) || null,
    groupOf: key => (COMMODITIES[key] ? GROUPS.find(g => g.key === COMMODITIES[key].group) : null),
    label: key => (COMMODITIES[key] ? COMMODITIES[key].label : key),
    money: money,
    moneyShort: moneyShort,
    amount: amount,
    weight: weight,
    summary: summary
  };
})();
