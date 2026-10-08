/* ============================================================
   Triple 7 Holdings — what can be listed
   ------------------------------------------------------------
   ONE place that says which commodities the desk trades and which
   details a seller gives for each. The sell form, the lot page,
   the board filters and the admin dashboard all read this, so
   adding a field or a commodity is a change here and nowhere else.

   To add a ninth commodity: add it here AND to the check
   constraint on lots.commodity in supabase/01_schema.sql.

   Field storage:
     in: 'column'  -> its own column on the lots table
     (default)     -> inside lots.specs (jsonb)
   ============================================================ */
window.T7 = window.T7 || {};

(function () {
  const CERT_STONE = ['GIA', 'IGI', 'HRD', 'EGL', 'GRS', 'SSEF', 'Gübelin', 'None'];
  const CERT_METAL = ['Rand Refinery', 'LBMA refiner', 'Independent assay', 'None'];
  const STONE_SHAPES = ['Round', 'Oval', 'Cushion', 'Emerald', 'Pear', 'Princess', 'Marquise', 'Heart', 'Cabochon', 'Rough / uncut'];
  const STONE_CLARITY = ['Eye clean', 'Slightly included', 'Moderately included', 'Heavily included'];
  const METAL_FORMS = ['Bar', 'Coin', 'Grain', 'Jewellery', 'Scrap'];

  function stone(label, prefix, colours, treatments) {
    return {
      label: label, plural: label === 'Ruby' ? 'Rubies' : label + 's', prefix: prefix, unit: 'ct', unitLabel: 'Carat weight',
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

  function metal(label, prefix, purities, forms) {
    return {
      label: label, plural: label, prefix: prefix, unit: 'g', unitLabel: 'Weight in grams',
      typeLabel: 'Form', types: forms || METAL_FORMS,
      fields: [
        { key: 'purity',      label: 'Purity',              options: purities },
        { key: 'certificate', label: 'Assay / certificate', options: CERT_METAL }
      ]
    };
  }

  const COMMODITIES = {
    diamond: {
      label: 'Diamond', plural: 'Diamonds', prefix: 'D', unit: 'ct', unitLabel: 'Carat weight',
      typeLabel: 'Polished or rough', types: ['Polished', 'Rough'],
      fields: [
        { key: 'shape',       label: 'Cut (shape)', options: ['Round Brilliant', 'Princess', 'Cushion', 'Oval', 'Emerald', 'Pear', 'Marquise', 'Radiant', 'Asscher', 'Heart', 'Rough / uncut'] },
        { key: 'colour',      label: 'Colour',      options: ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'Fancy', 'Mixed'] },
        { key: 'clarity',     label: 'Clarity',     options: ['FL', 'IF', 'VVS1', 'VVS2', 'VS1', 'VS2', 'SI1', 'SI2', 'I1', 'Mixed'] },
        { key: 'cut_grade',   label: 'Cut grade',   options: ['Excellent', 'Very Good', 'Good', 'Fair', 'Not graded'] },
        { key: 'certificate', label: 'Certificate', options: ['GIA', 'IGI', 'HRD', 'EGL', 'None'] }
      ]
    },
    gold: metal('Gold', 'G', ['24K (999.9)', '22K (916)', '18K (750)', '14K (585)', '9K (375)'],
      ['Bar', 'Coin', 'Nugget', 'Dust / granules', 'Jewellery', 'Scrap']),
    platinum: metal('Platinum', 'P', ['999.5', '950', '900', '850']),
    silver: metal('Silver', 'S', ['999', '958', '925', '800']),
    ruby: stone('Ruby', 'R',
      ['Pigeon blood red', 'Red', 'Pinkish red', 'Purplish red'],
      ['None', 'Heated', 'Glass filled', 'Unknown']),
    sapphire: stone('Sapphire', 'SA',
      ['Royal blue', 'Cornflower blue', 'Blue', 'Padparadscha', 'Pink', 'Yellow', 'Green', 'White'],
      ['None', 'Heated', 'Diffusion', 'Unknown']),
    emerald: stone('Emerald', 'E',
      ['Vivid green', 'Green', 'Bluish green', 'Light green'],
      ['None', 'Minor oil', 'Moderate oil', 'Significant oil', 'Unknown']),
    tanzanite: stone('Tanzanite', 'T',
      ['Vivid violet-blue (AAAA)', 'Violet-blue (AAA)', 'Blue-violet (AA)', 'Light violet (A)'],
      ['Heated', 'Unheated', 'Unknown'])
  };

  const ORDER = ['diamond', 'gold', 'platinum', 'silver', 'ruby', 'sapphire', 'emerald', 'tanzanite'];

  const STATUS = {
    pending:   { label: 'Waiting for approval', short: 'Pending',   tone: 'wait' },
    live:      { label: 'Live on the board',    short: 'Live',      tone: 'good' },
    rejected:  { label: 'Not approved',         short: 'Rejected',  tone: 'bad'  },
    sold:      { label: 'Sold',                 short: 'Sold',      tone: 'done' },
    withdrawn: { label: 'Withdrawn',            short: 'Withdrawn', tone: 'done' }
  };

  const COUNTRIES = ['South Africa', 'Botswana', 'Namibia', 'Zimbabwe', 'Zambia', 'Mozambique', 'Lesotho', 'Eswatini',
    'Angola', 'Tanzania', 'Kenya', 'Nigeria', 'Ghana', 'DR Congo', 'United Arab Emirates', 'India', 'China', 'Hong Kong',
    'Israel', 'Belgium', 'United Kingdom', 'United States', 'Switzerland', 'Germany', 'Netherlands', 'Australia', 'Other'];

  /* R 1 250 000 — the way rand is written in South Africa. Cents are
     dropped unless there are some. */
  function money(value) {
    const n = Number(value);
    if (!isFinite(n)) return '';
    const whole = Math.floor(Math.abs(n));
    const cents = Math.round((Math.abs(n) - whole) * 100);
    const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return (n < 0 ? '-' : '') + 'R ' + grouped + (cents ? ',' + String(cents).padStart(2, '0') : '');
  }

  /* R 1.2m / R 340k for tiles and chart labels. */
  function moneyShort(value) {
    const n = Number(value) || 0;
    if (n >= 1e9) return 'R ' + (n / 1e9).toFixed(n >= 1e10 ? 0 : 1) + 'bn';
    if (n >= 1e6) return 'R ' + (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'm';
    if (n >= 1e3) return 'R ' + Math.round(n / 1e3) + 'k';
    return 'R ' + Math.round(n);
  }

  function weight(lot) {
    if (lot.weight == null) return '';
    const n = Number(lot.weight);
    if (lot.weight_unit === 'g' && n >= 1000) return (n / 1000).toLocaleString('en-ZA', { maximumFractionDigits: 3 }).replace(',', '.') + ' kg';
    return String(n) + ' ' + (lot.weight_unit || '');
  }

  /* The short line under a lot name: "Polished · 1.52 ct · F · VS1 · GIA". */
  function summary(lot) {
    const c = COMMODITIES[lot.commodity];
    const specs = lot.specs || {};
    const parts = [lot.type, weight(lot)];
    if (c) {
      c.fields.forEach(f => {
        const v = specs[f.key];
        if (!v || v === 'None' || v === 'Unknown' || v === 'Not graded' || v === 'Mixed') return;
        if (f.key === 'shape' || f.key === 'cut_grade' || f.key === 'treatment') return;
        parts.push(f.key === 'certificate' ? v + (c.unit === 'ct' ? ' certified' : '') : v);
      });
    }
    return parts.filter(Boolean);
  }

  T7.catalog = {
    commodities: COMMODITIES,
    order: ORDER,
    status: STATUS,
    countries: COUNTRIES,
    get: key => COMMODITIES[key] || null,
    label: key => (COMMODITIES[key] ? COMMODITIES[key].label : key),
    money: money,
    moneyShort: moneyShort,
    weight: weight,
    summary: summary
  };
})();
