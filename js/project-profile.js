/* ============================================================
   Mine projects — project-profile.html
     owner, draft / changes requested  → guided project profile, one
                                         step at a time, saving as it goes
     owner, submitted or later          → status ("Awaiting approval")
                                         and a read-only copy
     admin                              → review: Opportunity Score, the
                                         decision and message to the owner,
                                         then (only once approved) an
                                         optional investor listing, the
                                         Match Engine and the brief
   Owners never see scores, matching or investor listings.
   Only reachable from the project portal (mine-projects.html → portal).
   ============================================================ */
(async function () {
  'use strict';
  const root = document.getElementById('project-profile-root');
  const P = window.T7Projects;
  const el = T7P.el;
  const BUCKET = 'project-documents';
  const MAX_FILE = 25 * 1024 * 1024;

  /* ---------------- The project profile ----------------
     One list drives the form, the read-only view and the brief. */
  const SECTIONS = [
    { id: 'basics', em: 'What it is.', image: 'images/mines/bucklands-wide.jpg', title: 'Project basics', intro: 'What the project is and what it produces.', fields: [
      { key: 'name', label: 'Project name', required: true, maxlength: 140 },
      { key: 'commodity', label: 'Commodity', type: 'select', list: 'commodity', required: true },
      { key: 'commodity_other', label: 'Other commodity', showIf: r => r.commodity === 'other', requiredIf: r => r.commodity === 'other', maxlength: 80 },
      { key: 'summary', label: 'Short description', type: 'textarea', wide: true, help: 'Two or three sentences an investor would read first.' }
    ] },
    { id: 'location', em: 'Where it is.', image: 'images/mines/longlands-wide.jpg', title: 'Location', intro: 'Projects in KwaZulu-Natal and elsewhere are all welcome.', fields: [
      { key: 'country', label: 'Country', placeholder: 'South Africa', maxlength: 80 },
      { key: 'province', label: 'Province / region', type: 'datalist', list: 'provinces', required: true, maxlength: 80 },
      { key: 'district', label: 'District', maxlength: 120 },
      { key: 'municipality', label: 'Municipality', maxlength: 120 },
      { key: 'latitude', label: 'Latitude', type: 'number', step: 'any', min: -90, max: 90, placeholder: 'e.g. -28.7410', help: 'Decimal degrees. South is negative.' },
      { key: 'longitude', label: 'Longitude', type: 'number', step: 'any', min: -180, max: 180, placeholder: 'e.g. 30.2152' },
      { key: 'geological_area', label: 'Geological area', wide: true, placeholder: 'e.g. Kaapvaal Craton, alluvial gravels of the Tugela', maxlength: 200 }
    ] },
    { id: 'ownership', em: 'Who holds it.', image: 'images/mine-projects/req-position.jpg', title: 'Ownership', intro: 'Who owns the project and how it is held.', fields: [
      { key: 'company', label: 'Company that holds the project', maxlength: 160 },
      { key: 'owner_role', label: 'Your role', type: 'select', list: 'owner_role' },
      { key: 'right_holder', label: 'Right holder (if different)', maxlength: 160 },
      { key: 'shareholding', label: 'Shareholding', type: 'textarea', help: 'Who owns what percentage.' },
      { key: 'jv_structure', label: 'JV or partnership structure', type: 'textarea', wide: true, help: 'Any existing joint venture, partner or agreement.' }
    ] },
    { id: 'regulatory', em: 'The paperwork behind it.', image: 'images/mine-projects/req-ground.webp', title: 'Rights & regulatory', intro: 'The licences and authorisations behind the project.', fields: [
      { key: 'right_status', label: 'Licence / right status', type: 'select', list: 'right_status', required: true },
      { key: 'right_reference', label: 'Right or permit reference and expiry', maxlength: 160 },
      { key: 'environmental_status', label: 'Environmental status', type: 'select', list: 'environmental_status' },
      { key: 'water_status', label: 'Water use licence', type: 'select', list: 'water_status' },
      { key: 'water_requirements', label: 'Water requirements', type: 'textarea', help: 'Source and approximate volumes needed.' },
      { key: 'other_authorisations', label: 'Other relevant authorisations', type: 'textarea', help: 'Land-use, surface rights, community agreements, SLP and so on.' }
    ] },
    { id: 'technical', em: 'How well it is known.', image: 'images/mine-projects/req-stage.webp', title: 'Stage & technical status', intro: 'How far the project has come and how well the resource is known.', fields: [
      { key: 'project_stage', label: 'Project status', type: 'select', list: 'project_stage', required: true },
      { key: 'technical_status', label: 'Technical status', type: 'select', list: 'technical_status' },
      { key: 'estimated_resource', label: 'Estimated resource', placeholder: 'e.g. 1.2 Mt at 0.15 ct/t', maxlength: 200 },
      { key: 'grade', label: 'Grade', placeholder: 'e.g. 15 cpht, 4.2 g/t', maxlength: 120 },
      { key: 'technical_notes', label: 'Technical work completed', type: 'textarea', wide: true, help: 'Drilling, sampling, bulk samples, studies — who did them and when.' }
    ] },
    { id: 'production', em: 'What is on site.', image: 'images/mine-projects/req-needed.jpeg', title: 'Production & infrastructure', intro: 'What is produced today and what is on site.', fields: [
      { key: 'current_production', label: 'Current production', placeholder: 'e.g. 800 ct/month, or none yet', maxlength: 200 },
      { key: 'production_potential', label: 'Production potential', placeholder: 'e.g. 2,500 ct/month with a second plant', maxlength: 200 },
      { key: 'infrastructure', label: 'Infrastructure on site', type: 'checks', list: 'infrastructure', wide: true },
      { key: 'infrastructure_notes', label: 'Infrastructure notes', type: 'textarea', wide: true }
    ] },
    { id: 'commercial', em: 'Who will buy it.', image: 'images/live-operations.jpg', title: 'Commercial & offtake', intro: 'Costs and who will buy what the project produces.', fields: [
      { key: 'offtake_status', label: 'Offtake', type: 'select', list: 'offtake_status' },
      { key: 'offtake_notes', label: 'Offtake potential', type: 'textarea', help: 'Buyers, markets or agreements.' },
      { key: 'capex_notes', label: 'CAPEX requirement', type: 'textarea', help: 'What has to be bought or built, and roughly what it costs.' },
      { key: 'opex_notes', label: 'OPEX considerations', type: 'textarea', help: 'Main running costs: fuel, labour, contractors, processing.' }
    ] },
    { id: 'capital', em: 'What you need.', image: 'images/hero-banner2.jpg', title: 'Capital & investment requirement', intro: 'How much you need, what it is for and the kind of support you are looking for.', fields: [
      { key: 'capital_band', label: 'Capital required', type: 'select', list: 'capital_band', required: true },
      { key: 'capital_required_zar', label: 'Exact amount (ZAR), if known', type: 'number', min: 1, step: '0.01', placeholder: 'e.g. 5000000' },
      { key: 'capital_use', label: 'What the capital is for', type: 'checks', list: 'capital_use', wide: true },
      { key: 'investor_requirements', label: 'Type of investor support needed', type: 'checks', list: 'investor_requirements', wide: true, required: true },
      { key: 'funding_structure', label: 'Funding structure', type: 'textarea', help: 'How the project is funded today, and the structure you propose.' },
      { key: 'investment_requirement', label: 'Investment requirement', type: 'textarea', help: 'Describe the ask: amount, use of funds, timing, what the investor gets.' }
    ] },
    { id: 'management', em: 'The people and the risks.', image: 'images/mines/site-05.jpg', title: 'Management & risks', intro: 'The people running it and what could go wrong.', fields: [
      { key: 'management_status', label: 'Management team', type: 'select', list: 'management_status' },
      { key: 'management_notes', label: 'Who is on the team', type: 'textarea', help: 'Key people, roles and experience.' },
      { key: 'risks', label: 'Key risks', type: 'textarea', wide: true, help: 'Technical, regulatory, community, market — and how you manage them.' }
    ] }
  ];
  const ALL_FIELDS = SECTIONS.flatMap(s => s.fields);
  const NUMERIC = new Set(['latitude', 'longitude', 'capital_required_zar']);
  const DOCS_STEP = { id: 'documents', title: 'Documents', em: 'The evidence.', image: 'images/mines/site-07.jpg', intro: 'Rights and permits, geological and sampling reports, environmental approvals, financial models, company documents and site photos. PDF, images, Word or Excel, up to 25 MB each.' };
  const REVIEW_STEP = { id: 'review', title: 'Review & submit', em: 'Check it, then send it.', image: 'images/kimberley-big-hole.jpg', intro: 'Look over everything below. Once you submit, the project waits for approval from the Mining Division and can no longer be edited unless the team reopens it.' };
  const STEPS = SECTIONS.concat([DOCS_STEP, REVIEW_STEP]);

  function display(f, value) {
    if (value === null || value === undefined || value === '' || (Array.isArray(value) && !value.length)) return '';
    if (f.type === 'checks') return value.map(v => P.label(f.list, v)).join(', ');
    if (f.type === 'select') return P.label(f.list, value);
    if (f.key === 'capital_required_zar') return 'R' + Number(value).toLocaleString('en-ZA');
    return String(value);
  }
  const isFilled = v => Array.isArray(v) ? v.length > 0 : v !== null && v !== undefined && String(v).trim() !== '';
  const commodityText = r => r.commodity === 'other' ? (r.commodity_other || 'Other') : P.label('commodity', r.commodity);
  const place = r => [r.municipality, r.district, r.province, r.country].filter(Boolean).join(', ');
  const bytes = n => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
  const two = n => String(n).padStart(2, '0');
  const ownerPill = s => el('span', { class: 'pp-pill s-' + s, text: P.label('owner_status', s) });
  const adminPill = s => el('span', { class: 'pp-pill s-' + s, text: P.label('status', s) });
  function show(nodes) { root.replaceChildren(...[].concat(nodes).filter(Boolean)); }
  function top() { const h = document.querySelector('.pp-body'); window.scrollTo({ top: h ? Math.max(0, h.offsetTop - 90) : 0, behavior: 'smooth' }); }
  function fail(text) {
    show(el('div', { class: 'pp-card pp-narrow' }, [el('h2', { text: 'Unable to open this project' }), el('p', { text: text }), el('a', { class: 'btn btn-solid', href: 'project-portal.html', text: 'Back to Project Portal' })]));
  }

  if (!T7P.configured) { fail('Project sign-in is not configured on this copy of the site.'); return; }
  const client = await T7P.client();
  const session = await T7P.session();
  if (!session) { location.replace('project-portal.html'); return; }
  const profile = await T7P.profile(true);
  const id = new URLSearchParams(location.search).get('id');

  let row = { country: 'South Africa', infrastructure: [], capital_use: [], investor_requirements: [], documents: [], status: 'draft' };
  if (id) {
    const res = await client.from('mine_projects').select('*').eq('id', id).maybeSingle();
    if (res.error) { fail(T7P.friendly(res.error)); return; }
    if (!res.data) { fail('This project does not exist, or it belongs to another account.'); return; }
    row = res.data;
  }

  /* ---------------- Documents (shared) ---------------- */
  async function openDoc(doc, link) {
    const label = link.textContent;
    link.textContent = 'Opening…';
    const r = await client.storage.from(BUCKET).createSignedUrl(doc.path, 600);
    link.textContent = label;
    if (r.error) { alert(T7P.friendly(r.error)); return; }
    window.open(r.data.signedUrl, '_blank', 'noopener');
  }
  function docList(docs, onRemove) {
    if (!docs.length) return el('p', { class: 'pp-muted', text: 'No documents uploaded yet.' });
    return el('ul', { class: 'pp-docs' }, docs.map((d, i) => {
      const link = el('button', { type: 'button', class: 'pp-doc-name', text: d.name });
      link.addEventListener('click', () => openDoc(d, link));
      const ext = (d.name.split('.').pop() || '').slice(0, 4).toUpperCase();
      return el('li', {}, [
        el('span', { class: 'pp-doc-ext', text: ext }),
        el('div', { class: 'pp-doc-text' }, [link, el('span', { text: P.label('document_kind', d.kind) + (d.size ? ' · ' + bytes(d.size) : '') })]),
        onRemove ? el('button', { type: 'button', class: 'pp-link pp-danger', text: 'Remove', onclick: () => onRemove(i) }) : null
      ]);
    }));
  }

  /* ---------------- Read-only summary ---------------- */
  function summary(r, opts) {
    opts = opts || {};
    const out = el('div', { class: 'pp-summary' });
    SECTIONS.forEach((s, i) => {
      const items = s.fields.filter(f => !f.showIf || f.showIf(r)).map(f => [f.label, display(f, r[f.key])]).filter(x => x[1] || opts.showEmpty);
      if (!items.length && !opts.onEdit) return;
      out.append(el('section', { class: 'pp-sum' }, [
        el('div', { class: 'pp-sum-head' }, [
          el('span', { class: 'pp-sum-no', text: two(i + 1) }), el('h3', { text: s.title }),
          opts.onEdit ? el('button', { type: 'button', class: 'pp-link', text: 'Edit', onclick: () => opts.onEdit(i) }) : null
        ]),
        items.length ? el('dl', {}, items.flatMap(([k, v]) => [el('dt', { text: k }), el('dd', { class: v ? '' : 'is-empty', text: v || '—' })]))
          : el('p', { class: 'pp-muted', text: 'Nothing added yet.' })
      ]));
    });
    out.append(el('section', { class: 'pp-sum' }, [
      el('div', { class: 'pp-sum-head' }, [el('span', { class: 'pp-sum-no', text: two(SECTIONS.length + 1) }), el('h3', { text: 'Documents' }),
        opts.onEdit ? el('button', { type: 'button', class: 'pp-link', text: 'Edit', onclick: () => opts.onEdit(SECTIONS.length) }) : null]),
      docList(r.documents || [])
    ]));
    return out;
  }

  function stageHead(step, i) {
    return el('header', { class: 'pp-stage-head' }, [
      el('img', { src: step.image, alt: '', loading: i ? 'lazy' : 'eager' }),
      el('div', {}, [
        el('p', { class: 'pp-stage-count', text: 'Step ' + two(i + 1) + ' of ' + two(STEPS.length) }),
        el('h2', {}, [step.title, el('br'), el('em', { text: step.em })]),
        step.intro ? el('p', { class: 'pp-stage-intro', text: step.intro }) : null
      ])
    ]);
  }

  /* ============================================================
     Owner: the guided form
     ============================================================ */
  function renderForm() {
    let docs = (row.documents || []).slice();
    let dirty = false;
    let step = 0;
    const inputs = {};

    T7P.hero({
      eyebrow: row.id ? 'Project profile · ' + T7P.reference(row.id) : 'Project profile',
      title: row.id ? (row.name || 'Your project.') : 'Your project.',
      em: row.status === 'changes_requested' ? 'A few changes, then resubmit.' : 'Told properly.',
      sub: 'Eleven short steps. Your draft saves every time you move between them.',
      image: row.commodity ? P.image(row.commodity) : 'images/hero-banner3.jpg'
    });

    function control(f) {
      const idAttr = 'f-' + f.key;
      const value = row[f.key];
      let input;
      if (f.type === 'select') {
        input = el('select', { id: idAttr, name: f.key }, [el('option', { value: '', text: 'Select an option' })].concat(
          P.OPTIONS[f.list].map(o => el('option', { value: o.value, text: o.label, selected: value === o.value }))));
      } else if (f.type === 'textarea') {
        input = el('textarea', { id: idAttr, name: f.key, rows: 4, maxlength: 4000 });
        input.value = value || '';
      } else if (f.type === 'checks') {
        const box = el('fieldset', { class: 'pp-chips' }, [el('legend', { text: f.label + (f.required ? ' *' : '') })]);
        for (const o of P.OPTIONS[f.list]) {
          box.append(el('label', { class: 'pp-chip' }, [el('input', { type: 'checkbox', name: f.key, value: o.value, checked: (value || []).includes(o.value) }), el('span', { text: o.label })]));
        }
        inputs[f.key] = box;
        return el('div', { class: 'pp-field is-wide', 'data-field': f.key }, [box, f.help ? el('p', { class: 'pp-help', text: f.help }) : null]);
      } else {
        const attrs = { id: idAttr, name: f.key, type: f.type === 'number' ? 'number' : 'text', placeholder: f.placeholder, maxlength: f.maxlength, step: f.step, min: f.min, max: f.max };
        if (f.type === 'datalist') attrs.list = idAttr + '-list';
        if (f.type === 'number') attrs.inputmode = 'decimal';
        input = el('input', attrs);
        input.value = value === null || value === undefined ? '' : value;
      }
      inputs[f.key] = input;
      return el('div', { class: 'pp-field' + (f.wide ? ' is-wide' : ''), 'data-field': f.key }, [
        el('label', { for: idAttr }, [f.label, f.required ? el('span', { class: 'pp-req', text: ' *', 'aria-hidden': 'true' }) : null]), input,
        f.type === 'datalist' ? el('datalist', { id: idAttr + '-list' }, P.OPTIONS[f.list].map(v => el('option', { value: v }))) : null,
        f.help ? el('p', { class: 'pp-help', text: f.help }) : null
      ]);
    }

    /* One panel per step; inputs stay alive while hidden. */
    const panels = SECTIONS.map((s, i) => el('section', { class: 'pp-panel', 'data-step': i }, [stageHead(s, i), el('div', { class: 'pp-stage-body' }, [el('div', { class: 'pp-grid' }, s.fields.map(control))])]));

    /* Documents step */
    const docBox = el('div', { class: 'pp-doc-box' });
    const fileInput = el('input', { type: 'file', id: 'doc-file', class: 'pp-file-input', multiple: true, accept: '.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.csv' });
    const kindSelect = el('select', { id: 'doc-kind' }, P.OPTIONS.document_kind.map(o => el('option', { value: o.value, text: o.label })));
    const dropLabel = el('span', { class: 'pp-drop-text', text: 'Choose files or drag them here' });
    const drop = el('label', { class: 'pp-drop', for: 'doc-file' }, [
      el('span', { class: 'pp-drop-icon', 'aria-hidden': 'true', text: '↑' }), dropLabel,
      el('small', { text: 'PDF, JPG, PNG, Word, Excel or CSV · up to 25 MB each' }), fileInput
    ]);
    const uploadBtn = el('button', { type: 'button', class: 'btn btn-solid', text: 'Upload' });
    const docStatus = el('p', { class: 'pp-help', role: 'status' });
    function paintDocs() { docBox.replaceChildren(docList(docs, removeDoc)); }
    paintDocs();
    fileInput.addEventListener('change', () => { const n = fileInput.files.length; dropLabel.textContent = n ? n + (n === 1 ? ' file chosen: ' + fileInput.files[0].name : ' files chosen') : 'Choose files or drag them here'; });
    ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('is-over'); }));
    ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, () => drop.classList.remove('is-over')));
    drop.addEventListener('drop', e => { e.preventDefault(); fileInput.files = e.dataTransfer.files; fileInput.dispatchEvent(new Event('change')); });
    panels.push(el('section', { class: 'pp-panel', 'data-step': SECTIONS.length }, [stageHead(DOCS_STEP, SECTIONS.length), el('div', { class: 'pp-stage-body' }, [
      drop,
      el('div', { class: 'pp-upload-row' }, [el('div', { class: 'pp-field' }, [el('label', { for: 'doc-kind', text: 'Document type' }), kindSelect]), uploadBtn]),
      docStatus, docBox
    ])]));

    /* Review step */
    const declaration = el('input', { type: 'checkbox', id: 'f-declaration', name: 'declaration', checked: Boolean(row.declaration) });
    const errors = el('div', { class: 'pp-errors', role: 'alert', hidden: true });
    const reviewSummary = el('div');
    panels.push(el('section', { class: 'pp-panel', 'data-step': SECTIONS.length + 1 }, [stageHead(REVIEW_STEP, SECTIONS.length + 1), el('div', { class: 'pp-stage-body' }, [
      errors, reviewSummary,
      el('label', { class: 'pp-declare', for: 'f-declaration' }, [declaration,
        el('span', { text: 'I confirm the information is accurate to the best of my knowledge, that I am entitled to share it, and that Triple 7 may share a summary with prospective partners if the project is approved.' })])
    ])]));

    const backBtn = el('button', { type: 'button', class: 'btn btn-ghost-dark', text: '← Back' });
    const saveBtn = el('button', { type: 'button', class: 'pp-link', text: 'Save draft' });
    const nextBtn = el('button', { type: 'button', class: 'btn btn-solid', text: 'Next →' });
    const status = el('p', { class: 'pp-save-status', role: 'status' });
    const nav = el('div', { class: 'pp-stage-nav' }, [backBtn, el('div', { class: 'pp-nav-mid' }, [saveBtn, status]), nextBtn]);
    const stage = el('form', { class: 'pp-stage', novalidate: true }, panels.concat([nav]));

    /* The rail */
    const railList = el('ol', { class: 'pp-rail-steps' });
    const meter = el('div', { class: 'pp-meter' }, [el('i')]);
    const meterText = el('p', { class: 'pp-meter-text' });
    const railName = el('h3', { text: row.name || 'New project' });
    const rail = el('aside', { class: 'pp-rail' }, [
      el('p', { class: 'eyebrow', text: row.id ? T7P.reference(row.id) : 'New project' }),
      railName, ownerPill(row.status), meter, meterText, railList,
      el('a', { class: 'pp-link pp-rail-back', href: 'project-portal.html', text: '← All my projects' })
    ]);

    if (row.status === 'changes_requested' && row.review_note) {
      stage.prepend(el('div', { class: 'pp-note pp-note-lg' }, [el('strong', { text: 'The Mining Division asked for changes' }), el('p', { text: row.review_note })]));
    }

    function read() {
      const out = {};
      for (const f of ALL_FIELDS) {
        const node = inputs[f.key];
        if (f.type === 'checks') out[f.key] = [...node.querySelectorAll('input:checked')].map(i => i.value);
        else {
          const v = node.value.trim();
          out[f.key] = v === '' ? null : NUMERIC.has(f.key) ? Number(v) : v;
        }
      }
      if (out.commodity !== 'other') out.commodity_other = null;
      if (!out.country) out.country = 'South Africa';
      out.declaration = declaration.checked;
      out.documents = docs;
      return out;
    }

    function stepState(i, v) {
      if (i === SECTIONS.length) return docs.length ? 'is-done' : '';
      if (i === SECTIONS.length + 1) return v.declaration ? 'is-done' : '';
      const s = SECTIONS[i];
      const req = s.fields.filter(f => f.required || (f.requiredIf && f.requiredIf(v)));
      const any = s.fields.some(f => f.key !== 'country' && isFilled(v[f.key]));
      if (req.length ? req.every(f => isFilled(v[f.key])) && any : any) return 'is-done';
      return any ? 'is-started' : '';
    }

    function paintRail() {
      const v = read();
      const states = STEPS.map((_, i) => stepState(i, v));
      const done = states.filter(s => s === 'is-done').length;
      meter.firstChild.style.width = Math.round(done / STEPS.length * 100) + '%';
      meterText.textContent = done + ' of ' + STEPS.length + ' steps complete';
      railList.replaceChildren(...STEPS.map((s, i) => el('li', { class: states[i] + (i === step ? ' is-current' : '') }, [
        el('button', { type: 'button', onclick: () => go(i) }, [el('span', { class: 'pp-rail-no', text: states[i] === 'is-done' ? '✓' : two(i + 1) }), el('span', { text: s.title })])
      ])));
      /* Phone layout: keep the current step's chip in view. */
      const cur = railList.querySelector('.is-current');
      if (cur && railList.scrollWidth > railList.clientWidth) railList.scrollLeft += cur.getBoundingClientRect().left - railList.getBoundingClientRect().left - railList.clientWidth / 2 + cur.clientWidth / 2;
      for (const f of ALL_FIELDS) {
        if (!f.showIf) continue;
        const wrap = stage.querySelector('[data-field="' + f.key + '"]');
        if (wrap) wrap.hidden = !f.showIf(v);
      }
    }

    function paintStep() {
      panels.forEach((p, i) => { p.hidden = i !== step; });
      backBtn.hidden = step === 0;
      const last = step === STEPS.length - 1;
      nextBtn.textContent = last ? (row.status === 'changes_requested' ? 'Resubmit for Approval' : 'Submit for Approval') : step === STEPS.length - 2 ? 'Review →' : 'Next →';
      nextBtn.classList.toggle('is-submit', last);
      if (last) reviewSummary.replaceChildren(summary(read(), { onEdit: i => go(i) }));
      paintRail();
    }

    async function go(i, quiet) {
      if (i < 0 || i >= STEPS.length) return;
      if (dirty) { try { await save(); } catch (e) { status.textContent = T7P.friendly(e); } }
      step = i; paintStep();
      if (!quiet) top();
    }

    function touched(e) {
      dirty = true; paintRail(); status.textContent = 'Unsaved changes';
      const wrap = e.target.closest('.has-error');
      if (wrap) wrap.classList.remove('has-error');
    }
    stage.addEventListener('input', touched);
    stage.addEventListener('change', touched);
    window.addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

    function validate(v) {
      const missing = [];
      SECTIONS.forEach((s, i) => s.fields.forEach(f => {
        const needed = f.required || (f.requiredIf && f.requiredIf(v));
        const node = inputs[f.key];
        if (needed && !isFilled(v[f.key])) missing.push([f.key, f.label, i]);
        else if (node && node.tagName === 'INPUT' && !node.checkValidity()) missing.push([f.key, f.label + ' (check the value)', i]);
      }));
      if (!v.declaration) missing.push(['declaration', 'The declaration', STEPS.length - 1]);
      return missing;
    }

    function showErrors(missing) {
      stage.querySelectorAll('.has-error').forEach(n => n.classList.remove('has-error'));
      if (!missing.length) { errors.hidden = true; return; }
      errors.hidden = false;
      errors.replaceChildren(el('strong', { text: 'Almost there. Please complete:' }), el('ul', {}, missing.map(([k, label, i]) => {
        const wrap = k === 'declaration' ? declaration.closest('label') : stage.querySelector('[data-field="' + k + '"]');
        if (wrap) wrap.classList.add('has-error');
        return el('li', {}, [el('button', { type: 'button', class: 'pp-link', text: label + ' — ' + STEPS[i].title, onclick: async () => {
          await go(i, true);
          const target = k === 'declaration' ? declaration : inputs[k];
          const focusable = target.matches('input,select,textarea') ? target : target.querySelector('input');
          target.scrollIntoView({ block: 'center' }); if (focusable) focusable.focus();
        } })]);
      })));
    }

    let saving = null;
    async function save(next) {
      if (saving) await saving.catch(() => {});
      saving = (async () => {
        const values = read();
        values.status = next || (row.status === 'changes_requested' ? 'changes_requested' : 'draft');
        status.textContent = 'Saving…';
        const res = row.id
          ? await client.from('mine_projects').update(values).eq('id', row.id).select('*').single()
          : await client.from('mine_projects').insert(values).select('*').single();
        row = T7P.unwrap(res);
        dirty = false;
        if (location.search.indexOf(row.id) === -1) history.replaceState(null, '', '?id=' + row.id);
        railName.textContent = row.name || 'New project';
        rail.querySelector('.eyebrow').textContent = T7P.reference(row.id);
        status.textContent = 'Saved ' + new Date().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
        return row;
      })();
      try { return await saving; } finally { saving = null; }
    }

    saveBtn.addEventListener('click', async () => { saveBtn.disabled = true; try { await save(); } catch (e) { status.textContent = T7P.friendly(e); } finally { saveBtn.disabled = false; } });
    backBtn.addEventListener('click', () => go(step - 1));
    nextBtn.addEventListener('click', async () => {
      if (step < STEPS.length - 1) { go(step + 1); return; }
      const v = read();
      const missing = validate(v);
      showErrors(missing);
      if (missing.length) { errors.scrollIntoView({ block: 'start', behavior: 'smooth' }); return; }
      nextBtn.disabled = true; backBtn.disabled = true;
      try { await save('submitted'); renderSubmitted(); }
      catch (err) {
        status.textContent = '';
        errors.hidden = false; errors.replaceChildren(el('strong', { text: T7P.friendly(err) }));
        errors.scrollIntoView({ block: 'start' });
      } finally { nextBtn.disabled = false; backBtn.disabled = false; }
    });
    stage.addEventListener('submit', e => e.preventDefault());

    async function upload() {
      const files = [...fileInput.files];
      if (!files.length) { docStatus.textContent = 'Choose one or more files first.'; return; }
      const big = files.find(f => f.size > MAX_FILE);
      if (big) { docStatus.textContent = big.name + ' is larger than 25 MB.'; return; }
      if (docs.length + files.length > 30) { docStatus.textContent = 'A project can carry at most 30 documents.'; return; }
      uploadBtn.disabled = true;
      try {
        if (!row.id) { docStatus.textContent = 'Saving a draft first…'; await save(); }
        for (const [i, file] of files.entries()) {
          docStatus.textContent = 'Uploading ' + (i + 1) + ' of ' + files.length + '…';
          const safe = file.name.replace(/[^\w.\-]+/g, '_').slice(-120);
          const path = session.user.id + '/' + row.id + '/' + Date.now() + '-' + safe;
          T7P.unwrap(await client.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined, upsert: false }));
          docs.push({ path: path, name: file.name, kind: kindSelect.value, size: file.size, uploaded_at: new Date().toISOString() });
        }
        await save();
        fileInput.value = ''; dropLabel.textContent = 'Choose files or drag them here';
        docStatus.textContent = files.length === 1 ? 'Uploaded.' : files.length + ' files uploaded.';
      } catch (e) { docStatus.textContent = T7P.friendly(e); }
      finally { uploadBtn.disabled = false; paintDocs(); paintRail(); }
    }
    uploadBtn.addEventListener('click', upload);

    async function removeDoc(i) {
      const d = docs[i];
      if (!confirm('Remove ' + d.name + '?')) return;
      try {
        await client.storage.from(BUCKET).remove([d.path]);
        docs.splice(i, 1);
        await save();
        docStatus.textContent = 'Removed ' + d.name + '.';
      } catch (e) { docStatus.textContent = T7P.friendly(e); }
      paintDocs(); paintRail();
    }

    paintStep();
    show(el('div', { class: 'pp-wizard' }, [rail, stage]));
  }

  function renderSubmitted() {
    T7P.hero({ eyebrow: 'Project profile · ' + T7P.reference(row.id), title: 'Submitted.', em: 'Now awaiting approval.', sub: 'The Mining Division has your project. You will see the decision in your project portal.', image: P.image(row.commodity) });
    show(el('div', { class: 'pp-done' }, [
      el('span', { class: 'pp-done-mark', 'aria-hidden': 'true', text: '✓' }),
      el('p', { class: 'eyebrow', text: 'Reference ' + T7P.reference(row.id) }),
      el('h2', { class: 'section-title' }, [row.name || 'Your project', el('br'), el('em', { text: 'is with the team.' })]),
      el('p', { class: 'pp-lede', text: 'The Mining Division reviews every submission. If anything is missing, the project reopens for you to update. Otherwise you will see the decision here and the team will be in touch.' }),
      T7P.tracker(row.status),
      el('div', { class: 'pp-done-actions' }, [
        el('a', { class: 'btn btn-solid', href: 'project-portal.html', text: 'Back to My Projects' }),
        el('a', { class: 'btn btn-ghost-dark', href: 'mine-projects.html', text: 'Mine Projects' })
      ])
    ]));
    top();
  }

  /* ============================================================
     Owner: after submission (read-only)
     ============================================================ */
  function renderOwnerView() {
    const waiting = row.status === 'submitted' || row.status === 'under_review';
    T7P.hero({
      eyebrow: 'Project profile · ' + T7P.reference(row.id), title: row.name || 'Your project',
      em: waiting ? 'Awaiting approval.' : row.status === 'approved' ? 'Approved.' : 'Not approved.',
      sub: [commodityText(row), place(row)].filter(Boolean).join(' · '), image: P.image(row.commodity)
    });
    const headline = waiting
      ? ['With the Mining Division.', 'The team is reviewing your project. Nothing is needed from you right now.']
      : row.status === 'approved'
        ? ['Your project is approved.', 'The Mining Division will contact you about the next steps.']
        : ['The team will not take this project forward.', 'See the message from the Mining Division below.'];
    show([
      el('section', { class: 'pp-status-card' }, [
        el('div', {}, [ownerPill(row.status), el('h2', { class: 'pp-h2', text: headline[0] }), el('p', { class: 'pp-lede', text: headline[1] })]),
        T7P.tracker(row.status),
        row.review_note ? el('div', { class: 'pp-note pp-note-lg' }, [el('strong', { text: 'From the Mining Division' }), el('p', { text: row.review_note })]) : null,
        el('p', { class: 'pp-date', text: row.submitted_at ? 'Submitted ' + T7P.date(row.submitted_at) : '' })
      ]),
      el('div', { class: 'pp-toolbar' }, [el('div', {}, [el('p', { class: 'eyebrow', text: 'What you sent' }), el('h2', { class: 'pp-h2', text: 'Your project profile' })]),
        el('a', { class: 'btn btn-ghost-dark', href: 'project-portal.html', text: '← My Projects' })]),
      el('div', { class: 'pp-card' }, [summary(row)])
    ]);
  }

  /* ============================================================
     Admin: review, decide, then (optionally) list and match
     ============================================================ */
  async function renderAdmin() {
    const scored = P.opportunityScore(row);
    const [ownerRes, investorsRes, oppRes] = await Promise.all([
      client.from('profiles').select('first_name,last_name,email,phone,company,country').eq('id', row.owner_id).maybeSingle(),
      client.from('investor_applications').select('user_id,full_name,email,country,company,application,status').eq('status', 'approved'),
      row.investor_project_id ? client.from('investor_projects').select('id,published,minimum_investment_zar').eq('id', row.investor_project_id).maybeSingle() : Promise.resolve({ data: null })
    ]);
    const owner = ownerRes.data || {};
    const investors = investorsRes.error ? null : investorsRes.data;
    let opp = oppRes.data;

    function hero() {
      T7P.hero({ eyebrow: 'Project review · ' + T7P.reference(row.id), title: row.name || 'Untitled project',
        em: row.status === 'approved' ? 'Approved.' : row.status === 'rejected' ? 'Declined.' : row.status === 'changes_requested' ? 'Changes requested.' : row.status === 'draft' ? 'Still a draft.' : 'Awaiting your decision.',
        sub: [commodityText(row), place(row)].filter(Boolean).join(' · '), image: P.image(row.commodity) });
    }
    hero();

    /* Score */
    const rk = scored.rating.toLowerCase().replace(/\s+/g, '-');
    const scoreCard = el('section', { class: 'pp-side-card pp-score' }, [
      el('p', { class: 'eyebrow', text: 'Opportunity Score' }),
      el('div', { class: 'pp-score-top' }, [
        el('span', { class: 'pp-ring pp-ring-lg r-' + rk, style: '--v:' + scored.score }, [el('b', { text: String(scored.score) })]),
        el('div', {}, [el('strong', { text: scored.rating }), el('span', { text: 'out of 100, on fixed criteria' })])
      ]),
      el('ul', { class: 'pp-breakdown' }, scored.breakdown.map(b => el('li', {}, [
        el('div', { class: 'pp-bd-top' }, [el('span', { text: b.label }), el('strong', { text: b.points + ' / ' + b.max })]),
        el('div', { class: 'pp-bar' }, [el('i', { style: 'width:' + Math.round(b.points / b.max * 100) + '%' })]),
        el('p', { text: b.note })
      ]))),
      el('p', { class: 'pp-help', text: 'Only the team sees this. It is saved with each decision.' })
    ]);

    /* Decision */
    const CHOICES = [
      ['under_review', 'In review', 'Mark that the team is looking at it'],
      ['changes_requested', 'Request changes', 'Reopen it for the owner to update'],
      ['approved', 'Approve', 'Tell the owner it is approved'],
      ['rejected', 'Decline', 'Tell the owner it is not going forward']
    ];
    const choiceBox = el('div', { class: 'pp-choices', role: 'radiogroup', 'aria-label': 'Decision' }, CHOICES.map(([v, t, d]) =>
      el('label', { class: 'pp-choice c-' + v }, [el('input', { type: 'radio', name: 'decision', value: v, checked: row.status === v }), el('span', {}, [el('strong', { text: t }), el('small', { text: d })])])));
    const note = el('textarea', { id: 'rv-note', rows: 4, maxlength: 4000, placeholder: 'e.g. Thank you — please upload the mining right certificate.' }); note.value = row.review_note || '';
    const rvBtn = el('button', { type: 'submit', class: 'btn btn-solid pp-wide', text: 'Save Decision' });
    const rvMsg = el('p', { class: 'form-feedback', role: 'status' });
    const decision = el('form', { class: 'pp-side-card pp-decision' }, [
      el('p', { class: 'eyebrow', text: 'Decision' }),
      el('h3', { class: 'pp-side-title', text: 'Approve this project?' }),
      choiceBox,
      el('div', { class: 'pp-field' }, [el('label', { for: 'rv-note', text: 'Message to the project owner' }), note,
        el('p', { class: 'pp-help', text: 'The owner sees this message and the outcome in their portal. They never see the score, matches or any investor listing.' })]),
      rvBtn, rvMsg
    ]);
    decision.addEventListener('submit', async e => {
      e.preventDefault();
      const picked = decision.querySelector('input[name=decision]:checked');
      if (!picked) { rvMsg.textContent = 'Choose a decision first.'; rvMsg.classList.add('is-error'); return; }
      rvBtn.disabled = true; rvMsg.classList.remove('is-error'); rvMsg.textContent = 'Saving…';
      try {
        row = T7P.unwrap(await client.from('mine_projects').update({ status: picked.value, review_note: note.value.trim() || null, score: scored.score, score_breakdown: scored.breakdown }).eq('id', row.id).select('*').single());
        /* No longer approved: take any investor listing down with it. */
        if (row.status !== 'approved' && opp && opp.published) {
          T7P.unwrap(await client.from('investor_projects').update({ published: false }).eq('id', opp.id));
          opp.published = false;
        }
        rvMsg.textContent = 'Saved. The owner now sees: ' + P.label('owner_status', row.status) + '.';
        hero(); paintListing(); pillBox.replaceChildren(adminPill(row.status));
      } catch (err) { rvMsg.textContent = T7P.friendly(err); rvMsg.classList.add('is-error'); }
      finally { rvBtn.disabled = false; }
    });

    /* Investor listing — only after approval, and off until the team turns it on */
    const listing = el('section', { class: 'pp-side-card pp-listing' });
    function paintListing() {
      if (row.status !== 'approved') {
        listing.className = 'pp-side-card pp-listing is-locked';
        listing.replaceChildren(
          el('p', { class: 'eyebrow', text: 'Investor opportunity' }),
          el('h3', { class: 'pp-side-title', text: 'Not visible to investors' }),
          el('p', { class: 'pp-muted', text: 'Approve the project first. You then decide separately whether to list it as an opportunity for approved investors.' })
        );
        return;
      }
      const band = P.find('capital_band', row.capital_band);
      const minInput = el('input', { id: 'pub-min', type: 'number', min: 100000, step: '1000', required: true });
      minInput.value = opp && opp.minimum_investment_zar ? opp.minimum_investment_zar : Math.max(100000, band ? band.min : 100000);
      const live = Boolean(opp && opp.published);
      const pubCheck = el('input', { type: 'checkbox', id: 'pub-show', checked: live });
      const btn = el('button', { type: 'submit', class: 'btn btn-solid pp-wide', text: opp ? 'Update Listing' : 'Save Listing' });
      const msg = el('p', { class: 'form-feedback', role: 'status' });
      const form = el('form', {}, [
        el('div', { class: 'pp-field' }, [el('label', { for: 'pub-min', text: 'Minimum participation per investor (ZAR)' }), minInput]),
        el('label', { class: 'pp-switch', for: 'pub-show' }, [pubCheck, el('span', { class: 'pp-switch-ui', 'aria-hidden': 'true' }), el('span', { text: 'Show to approved investors' })]),
        btn, msg
      ]);
      form.addEventListener('submit', async e => {
        e.preventDefault(); if (!form.reportValidity()) return;
        btn.disabled = true; msg.textContent = 'Saving…';
        try {
          const oppId = T7P.unwrap(await client.rpc('publish_mine_project', { p_id: row.id, p_minimum: Number(minInput.value), p_publish: pubCheck.checked }));
          opp = { id: oppId, published: pubCheck.checked, minimum_investment_zar: Number(minInput.value) };
          row.investor_project_id = oppId;
          paintListing();
          listing.querySelector('.form-feedback').textContent = pubCheck.checked ? 'Listed. Approved investors can now see it on their dashboard.' : 'Saved, and hidden from investors.';
        } catch (err) { msg.textContent = T7P.friendly(err); btn.disabled = false; }
      });
      listing.className = 'pp-side-card pp-listing' + (live ? ' is-live' : '');
      listing.replaceChildren(
        el('p', { class: 'eyebrow', text: 'Investor opportunity' }),
        el('h3', { class: 'pp-side-title', text: live ? 'Listed for investors' : 'Not listed yet' }),
        el('p', { class: 'pp-muted', text: live ? 'Approved investors can see this project on their dashboard. Switch it off at any time.' : 'Approved projects stay hidden from investors until you list them here.' }),
        form
      );
    }
    paintListing();

    /* Match Engine */
    const need = P.capitalNeeded(row);
    const matchBox = el('section', { class: 'pp-matches' });
    function budgetText(a) {
      a = a || {};
      if (Number(a.investment_budget_zar) > 0) return 'Budget ' + P.rand(Number(a.investment_budget_zar));
      return a.capacity ? 'Capacity ' + a.capacity : '';
    }
    function paintMatches(all) {
      const ranked = P.rankInvestors(row, investors || []);
      const list = all ? ranked : ranked.slice(0, 6);
      matchBox.replaceChildren(...[
        el('div', { class: 'pp-matches-head' }, [
          el('div', {}, [el('p', { class: 'eyebrow', text: 'Match Engine · team only' }), el('h2', { class: 'section-title' }, ['Suitable investors.', el('br'), el('em', { text: 'Ranked for this project.' })])]),
          el('div', { class: 'pp-flow' }, [
            el('span', { text: 'Project' }), el('i', { text: '→' }), el('span', { text: 'Capital ' + (need ? P.rand(need) : 'not set') }), el('i', { text: '→' }),
            el('span', { text: 'Investors' }), el('i', { text: '→' }), el('span', { text: 'Structure' })
          ]),
          el('button', { type: 'button', class: 'btn btn-ghost-dark', text: 'Opportunity Brief', onclick: () => brief(null) })
        ]),
        investors === null ? el('p', { class: 'pp-muted', text: 'Investor applications could not be loaded. Check that the investor portal migrations are installed.' })
          : !ranked.length ? el('div', { class: 'pp-empty' }, [el('h3', { text: 'No approved investors yet.' }), el('p', { text: 'Matches appear here once investor applications are approved.' })])
          : el('ol', { class: 'pp-match-list' }, list.map((m, i) => el('li', { class: 'pp-match' + (i === 0 ? ' is-top' : '') }, [
            el('span', { class: 'pp-ring pp-ring-md r-' + (m.score >= 75 ? 'strong' : m.score >= 55 ? 'promising' : m.score >= 35 ? 'early-stage' : 'needs-work'), style: '--v:' + m.score }, [el('b', { text: m.score + '%' })]),
            el('div', { class: 'pp-match-body' }, [
              el('div', { class: 'pp-match-name' }, [el('h3', { text: m.investor.full_name || m.investor.email }), el('span', { class: 'pp-level', text: m.level })]),
              el('p', { class: 'pp-meta', text: [m.investor.email, m.investor.country, budgetText(m.investor.application)].filter(Boolean).join(' · ') }),
              el('ul', { class: 'pp-reasons' }, m.reasons.slice(0, 4).map(r => el('li', { text: r }))),
              el('p', { class: 'pp-structure' }, [el('span', { text: 'Suggested structure' }), el('strong', { text: m.structure })])
            ]),
            el('button', { type: 'button', class: 'btn btn-ghost-dark', text: 'Brief', onclick: () => brief(m) })
          ]))),
        ranked.length > 6 && !all ? el('button', { type: 'button', class: 'pp-link', text: 'Show all ' + ranked.length + ' approved investors', onclick: () => paintMatches(true) }) : null
      ].filter(Boolean));
    }
    paintMatches(false);

    const pillBox = el('span', { class: 'pp-pill-box' }, [adminPill(row.status)]);
    const ownerPanel = el('section', { class: 'pp-card pp-owner' }, [
      el('span', { class: 'pp-avatar', text: (T7P.name(owner) || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() }),
      el('div', {}, [
        el('p', { class: 'eyebrow', text: 'Submitted by' }),
        el('h3', { text: T7P.name(owner) || 'Unknown owner' }),
        el('p', { class: 'pp-meta', text: [owner.email, owner.phone, owner.company].filter(Boolean).join(' · ') }),
        el('p', { class: 'pp-meta', text: [P.label('owner_role', row.owner_role), row.company, row.submitted_at ? 'Submitted ' + T7P.date(row.submitted_at) : 'Not submitted yet'].filter(Boolean).join(' · ') })
      ]),
      pillBox
    ]);

    show([
      el('div', { class: 'pp-toolbar' }, [el('a', { class: 'pp-link', href: 'project-portal.html', text: '← All submissions' })]),
      el('div', { class: 'pp-admin' }, [
        el('div', { class: 'pp-admin-main' }, [ownerPanel, el('div', { class: 'pp-card' }, [summary(row, { showEmpty: true })])]),
        el('div', { class: 'pp-admin-side' }, [decision, listing, scoreCard])
      ]),
      matchBox
    ]);
  }

  /* ---------------- Investment Opportunity Brief (team only) ---------------- */
  function brief(match) {
    const s = P.opportunityScore(row);
    const need = P.capitalNeeded(row);
    const line = (k, v) => v ? [el('dt', { text: k }), el('dd', { text: v })] : [];
    const req = (row.investor_requirements || []).map(v => P.label('investor_requirements', v)).join(', ');
    const uses = (row.capital_use || []).map(v => P.label('capital_use', v)).join(', ');
    const doc = el('article', { class: 'pp-brief-doc' }, [
      el('header', { class: 'pp-brief-cover' }, [
        el('img', { class: 'pp-brief-photo', src: P.image(row.commodity), alt: '' }),
        el('div', { class: 'pp-brief-cover-in' }, [
          el('div', { class: 'pp-brief-top' }, [el('img', { src: 'images/logo-light.png?v=2', alt: 'Triple 7 Holdings', class: 'pp-brief-logo' }),
            el('p', {}, ['Investment Opportunity Brief', el('br'), T7P.reference(row.id) + ' · ' + T7P.date(new Date())])]),
          el('h1', {}, [row.name || 'Mine project', el('br'), el('em', { text: [commodityText(row), row.province].filter(Boolean).join(' · ') })])
        ])
      ]),
      el('div', { class: 'pp-brief-in' }, [
        el('p', { class: 'pp-brief-lede', text: row.summary || [commodityText(row), 'project in', place(row)].join(' ') }),
        el('div', { class: 'pp-brief-keys' }, [
          el('div', {}, [el('span', { text: 'Capital required' }), el('strong', { text: row.capital_required_zar ? 'R' + Number(row.capital_required_zar).toLocaleString('en-ZA') : (P.label('capital_band', row.capital_band) || '—') })]),
          el('div', {}, [el('span', { text: 'Project status' }), el('strong', { text: P.label('project_stage', row.project_stage) || '—' })]),
          el('div', {}, [el('span', { text: 'Opportunity Score' }), el('strong', { text: s.score + '/100 · ' + s.rating })]),
          match ? el('div', {}, [el('span', { text: 'Match' }), el('strong', { text: match.score + '% · ' + match.level })]) : null
        ]),
        match ? el('div', { class: 'pp-brief-match' }, [el('p', { text: 'Prepared for' }), el('strong', { text: match.investor.full_name || match.investor.email }), el('p', { text: 'Suggested structure: ' + match.structure })]) : null,
        el('div', { class: 'pp-brief-grid' }, [
          el('section', {}, [el('h2', { text: 'Project' }), el('dl', {}, [
            ...line('Commodity', commodityText(row)), ...line('Location', place(row)), ...line('Geological area', row.geological_area),
            ...line('Licence / right', P.label('right_status', row.right_status)),
            ...line('Environmental', P.label('environmental_status', row.environmental_status)), ...line('Water', P.label('water_status', row.water_status))
          ])]),
          el('section', {}, [el('h2', { text: 'Capital requirement' }), el('dl', {}, [
            ...line('Amount', need ? (row.capital_required_zar ? 'R' + Number(row.capital_required_zar).toLocaleString('en-ZA') : P.label('capital_band', row.capital_band)) : ''),
            ...line('Use of funds', uses), ...line('Requirement', req), ...line('Funding structure', row.funding_structure)
          ])]),
          el('section', {}, [el('h2', { text: 'Technical & commercial' }), el('dl', {}, [
            ...line('Technical status', P.label('technical_status', row.technical_status)), ...line('Estimated resource', row.estimated_resource),
            ...line('Grade', row.grade), ...line('Current production', row.current_production), ...line('Production potential', row.production_potential),
            ...line('Infrastructure', (row.infrastructure || []).map(v => P.label('infrastructure', v)).join(', ')),
            ...line('Offtake', P.label('offtake_status', row.offtake_status))
          ])]),
          el('section', {}, [el('h2', { text: 'Opportunity Score' }),
            el('ul', { class: 'pp-brief-score' }, s.breakdown.map(b => el('li', {}, [el('span', { text: b.label }), el('strong', { text: b.points + '/' + b.max })])))])
        ]),
        row.investment_requirement ? el('section', {}, [el('h2', { text: 'The opportunity' }), el('p', { text: row.investment_requirement })]) : null,
        row.risks ? el('section', {}, [el('h2', { text: 'Key risks' }), el('p', { text: row.risks })]) : null,
        el('footer', {}, [el('p', { text: 'Prepared by the Triple 7 Holdings Mining Division from information supplied by the project owner, which has not been independently verified. This brief is not an offer of securities or investment advice. Contact: info@triple7holdings.co.za · +27 73 569 4045.' })])
      ])
    ]);
    const overlay = el('div', { class: 'pp-brief', id: 'pp-brief', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Investment Opportunity Brief' }, [
      el('div', { class: 'pp-brief-bar' }, [
        el('button', { type: 'button', class: 'btn btn-light', text: 'Print / Save as PDF', onclick: () => window.print() }),
        el('button', { type: 'button', class: 'btn btn-ghost-light', text: 'Close', onclick: close })
      ]),
      doc
    ]);
    function close() { overlay.remove(); document.body.classList.remove('pp-brief-open'); document.removeEventListener('keydown', esc); }
    function esc(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', esc);
    document.body.classList.add('pp-brief-open');
    document.body.append(overlay);
    overlay.querySelector('button').focus();
  }

  /* ---------------- Route ---------------- */
  try {
    if (profile.is_admin && row.id && row.owner_id !== profile.id) await renderAdmin();
    else if (row.status === 'draft' || row.status === 'changes_requested') renderForm();
    else if (profile.is_admin) await renderAdmin();
    else renderOwnerView();
  } catch (e) { console.error(e); fail(T7P.friendly(e)); }
})();
