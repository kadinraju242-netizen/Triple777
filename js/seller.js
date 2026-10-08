/* ============================================================
   Triple 7 Holdings — seller dashboard
   ------------------------------------------------------------
   Everything a seller does, on one page:

     the numbers     what is live, what is waiting, what came in
     list a lot      pick a category, fill in its details, name a
                     price in rand, submit for approval
     your lots       every listing and where it stands
     enquiries       messages from buyers, with their contact details

   A new lot is never live straight away. The database marks it
   "pending" and an admin approves or rejects it; nothing this file
   sends can change that. The same goes for the supporting document
   filed with each lot (see step 5 of the form).
   ============================================================ */
(function () {
  const root = document.getElementById('seller-root');
  if (!root) return;

  const cat = T7.catalog;
  const esc = T7.esc;

  let profile = null;
  let lots = [];
  let documents = [];
  let enquiries = [];
  let lotFilter = 'all';

  /* What the seller has typed so far, so re-drawing the form (for
     example after picking a different category) loses nothing. */
  let draft = { commodity: 'diamond', specs: {}, titleEdited: false };

  const DOC_STATUS = { pending: ['Document waiting for review', 'is-wait'], approved: ['Document approved', 'is-good'], rejected: ['Document not accepted', 'is-bad'] };
  const ENQ_STATUS = { new: ['New', 'is-new'], answered: ['Answered', 'is-good'], closed: ['Closed', ''] };

  const dateShort = iso => new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });

  /* ---------- Numbers ---------- */
  function kpi(label, value, note, extra) {
    return '<div class="kpi' + (extra || '') + '"><p class="kpi-label">' + esc(label) + '</p>' +
           '<p class="kpi-value">' + esc(String(value)) + '</p>' +
           (note ? '<p class="kpi-note">' + esc(note) + '</p>' : '') + '</div>';
  }

  function numbers() {
    const by = s => lots.filter(l => l.status === s);
    const liveValue = by('live').reduce((sum, l) => sum + Number(l.price_zar), 0);
    const fresh = enquiries.filter(e => e.status === 'new').length;
    return '<div class="kpi-grid">' +
      kpi('Live on the board', by('live').length, by('live').length ? cat.money(liveValue) + ' asking in total' : 'Nothing live yet') +
      kpi('Waiting for approval', by('pending').length, by('pending').length ? 'The desk reviews each lot' : 'Nothing waiting') +
      kpi('New enquiries', fresh, enquiries.length + ' in total', fresh ? ' is-action' : '') +
      kpi('Sold', by('sold').length, by('rejected').length ? by('rejected').length + ' not approved' : '') +
    '</div>';
  }

  /* ---------- Listing form ---------- */
  function suggestTitle() {
    const c = cat.get(draft.commodity);
    const s = draft.specs;
    const w = draft.weight ? Number(draft.weight) + ' ' + c.unit : '';
    if (c.unit === 'ct') {
      const shape = s.shape && s.shape !== 'Rough / uncut' ? s.shape : (draft.type === 'Rough' ? 'Rough' : '');
      return [w, shape, c.label].filter(Boolean).join(' ');
    }
    const purity = s.purity ? s.purity.split(' ')[0] : '';
    return [w, purity, c.label, draft.type].filter(Boolean).join(' ');
  }

  function select(name, label, options, value, placeholder) {
    return '<div class="field"><label for="f-' + name + '">' + esc(label) + '</label>' +
      '<select id="f-' + name + '" name="' + name + '">' +
        '<option value="">' + esc(placeholder || 'Choose…') + '</option>' +
        options.map(o => '<option' + (o === value ? ' selected' : '') + '>' + esc(o) + '</option>').join('') +
      '</select><p class="field-error"></p></div>';
  }

  function detailFields() {
    const c = cat.get(draft.commodity);
    return '<div class="form-3">' +
        select('type', c.typeLabel, c.types, draft.type) +
        '<div class="field"><label for="f-weight">' + esc(c.unitLabel) + '</label>' +
          '<input id="f-weight" name="weight" type="number" inputmode="decimal" min="0" step="0.001" placeholder="' + (c.unit === 'ct' ? 'e.g. 1.52' : 'e.g. 100') + '" value="' + esc(draft.weight || '') + '"><p class="field-error"></p></div>' +
        c.fields.map(f => select('spec.' + f.key, f.label, f.options, draft.specs[f.key])).join('') +
        '<div class="field"><label for="f-quantity">Number of pieces</label>' +
          '<input id="f-quantity" name="quantity" type="number" inputmode="numeric" min="1" step="1" value="' + esc(draft.quantity || 1) + '"><p class="field-error"></p></div>' +
        '<div class="field"><label for="f-origin">Country of origin <span class="opt">(optional)</span></label>' +
          '<input id="f-origin" name="origin" type="text" list="origin-list" value="' + esc(draft.origin || '') + '">' +
          '<datalist id="origin-list">' + cat.countries.filter(x => x !== 'Other').map(x => '<option value="' + esc(x) + '">').join('') + '</datalist></div>' +
      '</div>';
  }

  function listingForm() {
    const picks = cat.order.map(key =>
      '<label class="role-card"><input type="radio" name="commodity" value="' + key + '"' + (draft.commodity === key ? ' checked' : '') + '>' +
      '<span class="role-title">' + esc(cat.get(key).label) + '</span></label>').join('');

    return '<section class="card" id="new">' +
      '<div class="card-head"><h2>List a lot</h2><p>Five short steps. The desk approves it before buyers see it.</p></div>' +
      '<form id="lot-form" novalidate>' +
        '<div class="sell-step"><b>1</b><div><h3>What are you selling?</h3>' +
          '<fieldset class="pick"><legend class="sr-only">Category</legend><div class="pick-grid">' + picks + '</div></fieldset></div></div>' +

        '<div class="sell-step"><b>2</b><div><h3>Its details</h3><div id="detail-fields">' + detailFields() + '</div></div></div>' +

        '<div class="sell-step"><b>3</b><div><h3>Name and description</h3><div class="form">' +
          '<div class="field"><label for="f-name">Listing title</label>' +
            '<input id="f-name" name="name" type="text" maxlength="90" value="' + esc(draft.name || '') + '" placeholder="Filled in for you from the details above">' +
            '<p class="field-error"></p></div>' +
          '<div class="field"><label for="f-description">Description <span class="opt">(optional)</span></label>' +
            '<textarea id="f-description" name="description" maxlength="1200" placeholder="Anything a buyer should know: condition, paperwork, where it can be viewed.">' + esc(draft.description || '') + '</textarea></div>' +
        '</div></div></div>' +

        '<div class="sell-step"><b>4</b><div><h3>Your asking price</h3>' +
          '<div class="field" style="max-width:320px"><label for="f-price">Price in rand, for the whole lot</label>' +
            '<div class="money-wrap"><span>R</span><input id="f-price" name="price_zar" type="number" inputmode="decimal" min="1" step="1" value="' + esc(draft.price_zar || '') + '"></div>' +
            '<p class="field-hint" id="price-echo"></p><p class="field-error"></p></div></div></div>' +

        '<div class="sell-step"><b>5</b><div><h3>Supporting document</h3>' +
          '<div class="doc-step"><strong>Nothing to upload yet.</strong> A blank verification document is filed with this listing ' +
          'automatically and reviewed by the desk. When ID and licence uploads open, this is where they will go.</div></div></div>' +

        '<p class="form-error" id="lot-error" role="alert" hidden></p>' +
        '<div class="action-row" style="margin-top:8px">' +
          '<button type="submit" class="btn-desk" id="lot-submit">Submit For Approval</button>' +
          '<button type="button" class="btn-line" id="lot-clear">Clear Form</button>' +
        '</div>' +
      '</form>' +
    '</section>';
  }

  function readDraft(form) {
    const d = { commodity: draft.commodity, specs: {}, titleEdited: draft.titleEdited };
    Array.prototype.forEach.call(form.elements, el => {
      if (!el.name || el.name === 'commodity') return;
      const v = el.value.trim();
      if (el.name.indexOf('spec.') === 0) { if (v) d.specs[el.name.slice(5)] = v; }
      else d[el.name] = v;
    });
    return d;
  }

  function echoPrice(form) {
    const n = Number(form.elements.price_zar.value);
    document.getElementById('price-echo').textContent = n > 0 ? 'Buyers will see ' + cat.money(n) : '';
  }

  function wireForm() {
    const form = document.getElementById('lot-form');
    if (!form) return;
    echoPrice(form);

    function syncTitle() {
      if (draft.titleEdited) return;
      draft.name = suggestTitle();
      form.elements.name.value = draft.name;
    }

    form.addEventListener('change', e => {
      if (e.target.name === 'commodity') {
        /* Details differ per category, so start that step afresh. */
        draft = Object.assign(readDraft(form), { commodity: e.target.value, specs: {}, type: '', weight: '' });
        document.getElementById('detail-fields').innerHTML = detailFields();
        syncTitle();
        return;
      }
      draft = readDraft(form);
      syncTitle();
    });

    form.addEventListener('input', e => {
      if (e.target.name === 'name') draft.titleEdited = e.target.value.trim() !== '';
      if (e.target.name === 'price_zar') echoPrice(form);
      if (e.target.name === 'weight') { draft = readDraft(form); syncTitle(); }
      const wrap = e.target.closest('.field');
      if (wrap) { wrap.classList.remove('is-invalid'); const er = wrap.querySelector('.field-error'); if (er) er.textContent = ''; }
      document.getElementById('lot-error').hidden = true;
    });

    document.getElementById('lot-clear').addEventListener('click', () => {
      draft = { commodity: draft.commodity, specs: {}, titleEdited: false };
      render();
      document.getElementById('new').scrollIntoView({ block: 'start' });
    });

    form.addEventListener('submit', async e => {
      e.preventDefault();
      draft = readDraft(form);
      const c = cat.get(draft.commodity);
      let first = null;
      const bad = (name, message) => {
        const el = form.elements[name];
        const wrap = el.closest('.field');
        wrap.classList.add('is-invalid');
        wrap.querySelector('.field-error').textContent = message;
        if (!first) first = el;
      };

      if (!draft.type) bad('type', 'Please choose one.');
      if (!(Number(draft.weight) > 0)) bad('weight', 'Enter the weight in ' + (c.unit === 'ct' ? 'carats' : 'grams') + '.');
      c.fields.forEach(f => { if (!draft.specs[f.key]) bad('spec.' + f.key, 'Please choose one.'); });
      if (!(Number(draft.quantity) >= 1)) bad('quantity', 'At least 1.');
      if (!draft.name || draft.name.length < 3) bad('name', 'Give the listing a title.');
      if (!(Number(draft.price_zar) > 0)) bad('price_zar', 'Enter your asking price in rand.');

      if (first) { first.focus(); first.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }

      const btn = document.getElementById('lot-submit');
      btn.disabled = true;
      btn.textContent = 'Submitting…';
      try {
        const made = await T7.api.createLot({
          commodity: draft.commodity, name: draft.name, type: draft.type,
          description: draft.description, price_zar: Number(draft.price_zar),
          weight: Number(draft.weight), weight_unit: c.unit,
          quantity: Math.floor(Number(draft.quantity)) || 1, origin: draft.origin, specs: draft.specs
        });
        draft = { commodity: draft.commodity, specs: {}, titleEdited: false };
        T7.toast(made.lot_id + ' submitted for approval');
        await load();
        document.getElementById('your-lots').scrollIntoView({ block: 'start', behavior: 'smooth' });
      } catch (err) {
        console.error(err);
        btn.disabled = false;
        btn.textContent = 'Submit For Approval';
        const box = document.getElementById('lot-error');
        box.textContent = err.message || 'We could not submit that. Please try again.';
        box.hidden = false;
      }
    });
  }

  /* ---------- Your lots ---------- */
  function lotsTable() {
    const counts = { all: lots.length };
    lots.forEach(l => { counts[l.status] = (counts[l.status] || 0) + 1; });
    const seg = ['all', 'live', 'pending', 'rejected', 'sold', 'withdrawn']
      .filter(k => k === 'all' || counts[k])
      .map(k => '<button type="button" data-lot-filter="' + k + '" aria-pressed="' + (lotFilter === k) + '">' +
                (k === 'all' ? 'All' : cat.status[k].short) + ' ' + (counts[k] || 0) + '</button>').join('');

    const shown = lots.filter(l => lotFilter === 'all' || l.status === lotFilter);
    const rows = shown.map(l => {
      const st = cat.status[l.status];
      const doc = documents.find(d => d.lot_id === l.id);
      const ds = doc ? DOC_STATUS[doc.status] : null;
      const n = enquiries.filter(e => e.lot_id === l.id).length;
      const actions = [];
      if (l.status === 'live') actions.push('<button type="button" class="btn-line btn-sm" data-lot-status="sold" data-id="' + l.id + '">Mark Sold</button>');
      if (['live', 'pending', 'rejected'].indexOf(l.status) !== -1) actions.push('<button type="button" class="btn-line btn-sm btn-danger" data-lot-status="withdrawn" data-id="' + l.id + '">Withdraw</button>');
      return '<tr>' +
        '<td><a class="cell-main textlink" href="lot.html?id=' + encodeURIComponent(l.lot_id) + '">' + esc(l.name) + '</a>' +
          '<span class="muted">' + esc(l.lot_id) + ' · ' + esc(cat.label(l.commodity)) + ' · listed ' + esc(dateShort(l.created_at)) + '</span></td>' +
        '<td class="num strong">' + esc(cat.money(l.price_zar)) + '</td>' +
        '<td><span class="pill is-' + st.tone + '">' + esc(st.label) + '</span>' +
          (l.review_note ? '<p class="review-note">' + esc(l.review_note) + '</p>' : '') + '</td>' +
        '<td>' + (ds ? '<span class="pill ' + ds[1] + '">' + ds[0] + '</span>' : '<span class="muted">—</span>') + '</td>' +
        '<td class="num">' + n + '</td>' +
        '<td class="actions">' + actions.join('') + '</td>' +
      '</tr>';
    }).join('');

    return '<section class="dash-section" id="your-lots">' +
      '<h2>Your lots</h2>' +
      (lots.length
        ? '<div class="filters"><div class="seg" role="group" aria-label="Show lots by status">' + seg + '</div></div>' +
          '<div class="table-wrap"><table class="data-table"><thead><tr><th>Lot</th><th class="num">Asking price</th><th>Status</th><th>Document</th><th class="num">Enquiries</th><th></th></tr></thead>' +
          '<tbody>' + rows + '</tbody></table></div>'
        : '<div class="empty"><h3>You have not listed anything yet</h3><p>Use the form above. Your first lot will show here as soon as you submit it.</p></div>') +
    '</section>';
  }

  /* ---------- Enquiries ---------- */
  function enquiriesTable() {
    const rows = enquiries.map(e => {
      const s = ENQ_STATUS[e.status] || [e.status, ''];
      const lot = e.lot || lots.find(l => l.id === e.lot_id);
      const subject = encodeURIComponent('Your enquiry ' + e.ref + (lot ? ' about ' + lot.name : ''));
      const actions = [];
      if (e.buyer_email) actions.push('<a class="btn-line btn-sm" href="mailto:' + esc(e.buyer_email) + '?subject=' + subject + '">Reply By Email</a>');
      if (e.status === 'new') actions.push('<button type="button" class="btn-line btn-sm" data-enq-status="answered" data-id="' + e.id + '">Mark Answered</button>');
      if (e.status !== 'closed') actions.push('<button type="button" class="btn-line btn-sm" data-enq-status="closed" data-id="' + e.id + '">Close</button>');
      return '<tr>' +
        '<td><span class="cell-main">' + esc(e.buyer_name || 'Buyer') + '</span>' +
          '<span class="muted">' + esc(e.buyer_email || '') + (e.buyer_phone ? ' · ' + esc(e.buyer_phone) : '') + '</span></td>' +
        '<td>' + (lot ? '<a class="textlink" href="lot.html?id=' + encodeURIComponent(lot.lot_id) + '">' + esc(lot.name) + '</a>' : '') +
          '<span class="muted" style="display:block">' + esc(e.ref) + ' · ' + esc(T7.ago(e.created_at)) + '</span></td>' +
        '<td style="min-width:220px">' + esc(e.message) + '</td>' +
        '<td><span class="pill ' + s[1] + '">' + s[0] + '</span></td>' +
        '<td class="actions">' + actions.join('') + '</td>' +
      '</tr>';
    }).join('');

    return '<section class="dash-section" id="enquiries">' +
      '<h2>Enquiries from buyers</h2>' +
      (enquiries.length
        ? '<div class="table-wrap"><table class="data-table"><thead><tr><th>Buyer</th><th>About</th><th>Message</th><th>Status</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>'
        : '<div class="empty"><h3>No enquiries yet</h3><p>When a buyer asks about one of your live lots, their message and contact details appear here.</p></div>') +
    '</section>';
  }

  /* ---------- Page ---------- */
  function render() {
    root.innerHTML =
      '<div class="dash-head">' +
        '<div><p class="market-state">Seller account</p>' +
          '<p class="dash-name">' + esc(profile.company || T7.auth.displayName(profile)) + '</p>' +
          '<p class="muted">' + esc(T7.auth.displayName(profile)) + ' · ' + esc(profile.email) + '</p></div>' +
        '<div class="action-row"><a class="btn-desk" href="#new">List A Lot</a>' +
          '<a class="btn-line" href="trade.html">View The Board</a>' +
          '<a class="btn-line" href="signin.html?signout=1">Sign Out</a></div>' +
      '</div>' +
      numbers() +
      listingForm() +
      lotsTable() +
      enquiriesTable();
    wireForm();
  }

  async function load() {
    const [l, d, e] = await Promise.all([T7.api.myLots(), T7.api.myDocuments(), T7.api.sellerEnquiries()]);
    lots = l; documents = d; enquiries = e;
    render();
  }

  root.addEventListener('click', async e => {
    const filter = e.target.closest('[data-lot-filter]');
    if (filter) {
      lotFilter = filter.dataset.lotFilter;
      const form = document.getElementById('lot-form');
      if (form) draft = readDraft(form);
      render();
      document.getElementById('your-lots').scrollIntoView({ block: 'start' });
      return;
    }

    const lotBtn = e.target.closest('[data-lot-status]');
    if (lotBtn) {
      const status = lotBtn.dataset.lotStatus;
      const lot = lots.find(l => l.id === lotBtn.dataset.id);
      /* Both are final, so ask once in the button itself rather than a pop-up. */
      if (!lotBtn.dataset.sure) {
        lotBtn.dataset.sure = '1';
        lotBtn.textContent = status === 'sold' ? 'Yes, It Is Sold' : 'Yes, Withdraw It';
        setTimeout(() => { if (lotBtn.isConnected) { delete lotBtn.dataset.sure; lotBtn.textContent = status === 'sold' ? 'Mark Sold' : 'Withdraw'; } }, 4000);
        return;
      }
      lotBtn.disabled = true;
      try {
        await T7.api.setLotStatus(lot.id, status);
        T7.toast(lot.lot_id + (status === 'sold' ? ' marked as sold' : ' withdrawn'));
        const form = document.getElementById('lot-form');
        if (form) draft = readDraft(form);
        await load();
      } catch (err) {
        console.error(err);
        lotBtn.disabled = false;
        T7.toast(err.message || 'That did not work. Please try again.');
      }
      return;
    }

    const enqBtn = e.target.closest('[data-enq-status]');
    if (enqBtn) {
      enqBtn.disabled = true;
      try {
        await T7.api.setEnquiryStatus(enqBtn.dataset.id, enqBtn.dataset.enqStatus);
        const form = document.getElementById('lot-form');
        if (form) draft = readDraft(form);
        await load();
      } catch (err) {
        console.error(err);
        enqBtn.disabled = false;
        T7.toast(err.message || 'That did not work. Please try again.');
      }
    }
  });

  T7.auth.require(['seller']).then(p => {
    if (!p) return;
    profile = p;
    return load().then(() => {
      if (location.hash) {
        const target = document.getElementById(location.hash.slice(1));
        if (target) target.scrollIntoView({ block: 'start' });
      }
    });
  }).catch(err => {
    console.error(err);
    root.innerHTML = '<div class="empty"><h3>We could not load your dashboard</h3><p>' + esc(err.message || 'Please try again in a moment.') +
      '</p><button type="button" class="btn-desk" onclick="location.reload()">Try Again</button></div>';
  });
})();
