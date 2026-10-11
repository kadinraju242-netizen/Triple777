/* ============================================================
   Triple 7 Holdings — the buyer's account
   ------------------------------------------------------------
   Three things on one page:

     my enquiries   questions about lots, answered by the Triple 7
                    desk (the seller never sees the buyer, and the
                    buyer never talks to the seller directly)
     my requests    commodities the buyer asked the desk to find
     request form   "Can't find it?": describe what you need. Laid
                    out like the seller's "List a lot" form, with
                    only what the desk needs to start looking.
   ============================================================ */
(function () {
  const root = document.getElementById('buyer-root');
  if (!root) return;

  const cat = T7.catalog;
  const esc = T7.esc;
  const params = new URLSearchParams(location.search);

  let profile = null;
  let enquiries = [];
  let requests = [];
  let openId = null;
  let draft = { commodity: cat.get(params.get('commodity')) ? params.get('commodity') : 'diamond', specs: {} };

  /* ---------- Enquiries ---------- */
  function enquiriesSection() {
    const head = '<div class="td-section-head"><div><p class="eyebrow">My enquiries</p>' +
      '<h2 class="section-title td-small-title">Your questions.<br><em>Our answers.</em></h2></div>' +
      '<p class="muted">Ask about any lot from its page. The Triple 7 desk replies here, checking with the seller where needed.</p></div>';
    if (!enquiries.length) {
      return '<section class="dash-section" id="enquiries">' + head +
        '<div class="empty"><h3>No enquiries yet</h3><p>Open a lot on the board and ask the desk about it. Your conversation will show here.</p>' +
        '<div class="action-row"><a class="btn-desk" href="trade.html">Browse lots</a></div></div></section>';
    }
    const open = enquiries.find(e => e.id === openId) || enquiries[0];
    openId = open.id;
    return '<section class="dash-section" id="enquiries">' + head +
      '<div class="chat-layout">' +
        '<div class="chat-side">' + T7.chat.list(enquiries, open.id, 'buyer') + '</div>' +
        '<div class="chat-main">' + T7.chat.thread(open, 'buyer') + '</div>' +
      '</div></section>';
  }

  /* ---------- Requests ---------- */
  function requestCard(r) {
    const c = cat.get(r.commodity);
    const st = cat.requestStatus[r.status] || { label: r.status, tone: 'done' };
    const specs = Object.keys(r.specs || {}).map(k => r.specs[k]).filter(Boolean);
    const budget = r.budget_min || r.budget_max
      ? (r.budget_min ? cat.money(r.budget_min) : 'Up to') + (r.budget_min && r.budget_max ? ' to ' : ' ') + (r.budget_max ? cat.money(r.budget_max) : 'or more')
      : '';
    const facts = [
      r.product_type, specs.join(', '),
      r.quantity ? cat.amount(r.quantity, r.quantity_unit) : '',
      budget, r.delivery_country ? 'to ' + r.delivery_country : '', r.timeframe
    ].filter(Boolean);
    return '<article class="request-card">' +
      '<div class="request-top"><span class="pick-symbol" aria-hidden="true">' + esc(c ? (c.symbol || c.label.slice(0, 2)) : '?') + '</span>' +
        '<div><h3>' + esc(c ? c.label : r.commodity) + '</h3><p class="muted">' + esc(r.ref) + ', sent ' + esc(T7.ago(r.created_at)) + '</p></div>' +
        '<span class="pill is-' + st.tone + '">' + esc(st.label) + '</span></div>' +
      '<p class="request-facts">' + esc(facts.join(' · ')) + '</p>' +
      (r.notes ? '<p class="request-notes">“' + esc(r.notes) + '”</p>' : '') +
      (r.desk_reply ? '<div class="request-reply"><b>Triple 7 desk</b><p>' + esc(r.desk_reply) + '</p></div>'
                    : (r.status === 'new' ? '<p class="muted request-wait">The desk has your request and will reply here.</p>' : '')) +
      (r.status !== 'closed' ? '<div class="action-row"><button type="button" class="btn-line btn-sm" data-withdraw="' + esc(r.id) + '">Withdraw request</button></div>' : '') +
    '</article>';
  }

  function requestsSection() {
    if (!requests.length) return '';
    return '<section class="dash-section" id="requests">' +
      '<div class="td-section-head"><div><p class="eyebrow">My requests</p>' +
        '<h2 class="section-title td-small-title">What you asked us to find</h2></div></div>' +
      '<div class="request-grid">' + requests.map(requestCard).join('') + '</div></section>';
  }

  /* ---------- The request form ---------- */
  function select(name, label, options, value, any) {
    return '<div class="field"><label for="r-' + name + '">' + esc(label) + ' <span class="opt">(optional)</span></label>' +
      '<select id="r-' + name + '" name="' + name + '">' +
        '<option value="">' + esc(any || 'Any') + '</option>' +
        options.map(o => '<option' + (o === value ? ' selected' : '') + '>' + esc(o) + '</option>').join('') +
      '</select></div>';
  }

  function requestTypes(c) {
    return c.unit === 'ct' ? c.types.concat(['Set in jewellery']) : c.types;
  }

  function detailFields() {
    const c = cat.get(draft.commodity);
    /* Only the details that decide what the desk looks for. Certificate
       and assay stay, because buyers usually insist on them. */
    const fields = c.fields.filter(f => ['cut_grade', 'treatment', 'delivery'].indexOf(f.key) === -1 || c.unit === 't');
    return '<div class="form-3">' +
      select('product_type', c.typeLabel, requestTypes(c), draft.product_type) +
      fields.map(f => select('spec.' + f.key, f.label, f.options, draft.specs[f.key])).join('') +
    '</div>';
  }

  function unitWord(u) { return { ct: 'carats', g: 'grams', t: 'tonnes' }[u]; }

  function quantityFields() {
    const c = cat.get(draft.commodity);
    return '<div class="form-3">' +
      '<div class="field"><label for="r-quantity">How much, in ' + unitWord(c.unit) + ' <span class="opt">(optional)</span></label>' +
        '<input id="r-quantity" name="quantity" type="number" inputmode="decimal" min="0" step="any" placeholder="' + ({ ct: 'e.g. 2', g: 'e.g. 1000', t: 'e.g. 20000' })[c.unit] + '" value="' + esc(draft.quantity || '') + '"><p class="field-error"></p></div>' +
      '<div class="field"><label for="r-budget_min">Budget from <span class="opt">(rand, optional)</span></label>' +
        '<div class="money-wrap"><span>R</span><input id="r-budget_min" name="budget_min" type="number" inputmode="decimal" min="0" step="1" value="' + esc(draft.budget_min || '') + '"></div><p class="field-error"></p></div>' +
      '<div class="field"><label for="r-budget_max">Budget up to <span class="opt">(rand, optional)</span></label>' +
        '<div class="money-wrap"><span>R</span><input id="r-budget_max" name="budget_max" type="number" inputmode="decimal" min="0" step="1" value="' + esc(draft.budget_max || '') + '"></div><p class="field-error"></p></div>' +
      '<div class="field"><label for="r-delivery_country">Deliver to</label><select id="r-delivery_country" name="delivery_country">' +
        cat.countries.map(x => '<option' + (x === (draft.delivery_country || profile.country || 'South Africa') ? ' selected' : '') + '>' + esc(x) + '</option>').join('') + '</select></div>' +
      '<div class="field"><label for="r-timeframe">When do you need it?</label><select id="r-timeframe" name="timeframe">' +
        cat.timeframes.map(x => '<option' + (x === (draft.timeframe || 'Flexible') ? ' selected' : '') + '>' + esc(x) + '</option>').join('') + '</select></div>' +
    '</div>';
  }

  function requestForm() {
    return '<section class="card td-form-card" id="request">' +
      '<div class="card-head"><div><p class="eyebrow">Request a commodity</p>' +
        '<h2 class="section-title td-small-title">Can’t find it?<br><em>Tell us what you need.</em></h2></div>' +
        '<p>Four short steps. The desk looks for it among our sellers and mines and replies under My requests.</p></div>' +
      '<form id="request-form" novalidate>' +
        '<div class="sell-step"><b>1</b><div><h3>What are you looking for?</h3>' + T7.picker.html('commodity', draft.commodity) + '</div></div>' +
        '<div class="sell-step"><b>2</b><div><h3>Its details</h3><p class="step-hint">Leave anything you do not mind about on “Any”.</p><div id="request-details">' + detailFields() + '</div></div></div>' +
        '<div class="sell-step"><b>3</b><div><h3>Quantity, budget and delivery</h3><div id="request-quantity">' + quantityFields() + '</div></div></div>' +
        '<div class="sell-step"><b>4</b><div><h3>Anything else</h3>' +
          '<div class="field"><label for="r-notes">Notes for the desk <span class="opt">(optional)</span></label>' +
          '<textarea id="r-notes" name="notes" maxlength="2000" rows="3" placeholder="For example: as a matched pair for earrings, set in a ring, monthly cargoes, paperwork you need.">' + esc(draft.notes || '') + '</textarea></div></div></div>' +
        '<p class="form-error" id="request-error" role="alert" hidden></p>' +
        '<div class="action-row" style="margin-top:8px">' +
          '<button type="submit" class="btn-desk" id="request-submit">Send request to the desk</button>' +
          '<button type="button" class="btn-line" id="request-clear">Clear form</button>' +
        '</div>' +
      '</form>' +
    '</section>';
  }

  function readDraft(form) {
    const d = { commodity: draft.commodity, specs: {} };
    Array.prototype.forEach.call(form.elements, el => {
      if (!el.name || el.name === 'commodity') return;
      const v = el.value.trim();
      if (el.name.indexOf('spec.') === 0) { if (v) d.specs[el.name.slice(5)] = v; }
      else d[el.name] = v;
    });
    return d;
  }

  function wireForm() {
    const form = document.getElementById('request-form');
    function pick(key) {
      draft = Object.assign(readDraft(form), { commodity: key, specs: {}, product_type: '', quantity: '' });
      document.getElementById('request-details').innerHTML = detailFields();
      document.getElementById('request-quantity').innerHTML = quantityFields();
    }
    T7.picker.wire(form, pick);
    form.addEventListener('change', e => {
      if (e.target.name === 'commodity') { pick(e.target.value); return; }
      draft = readDraft(form);
    });
    form.addEventListener('input', e => {
      const wrap = e.target.closest('.field');
      if (wrap) { wrap.classList.remove('is-invalid'); const er = wrap.querySelector('.field-error'); if (er) er.textContent = ''; }
      document.getElementById('request-error').hidden = true;
    });
    document.getElementById('request-clear').addEventListener('click', () => {
      draft = { commodity: draft.commodity, specs: {} };
      render();
      document.getElementById('request').scrollIntoView({ block: 'start' });
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
      const min = draft.budget_min === '' ? null : Number(draft.budget_min);
      const max = draft.budget_max === '' ? null : Number(draft.budget_max);
      if (draft.quantity !== '' && !(Number(draft.quantity) > 0)) bad('quantity', 'Enter a number above zero, or leave it empty.');
      if (min != null && max != null && max < min) bad('budget_max', 'This is lower than the budget from.');
      if (first) { first.focus(); return; }

      const btn = document.getElementById('request-submit');
      btn.disabled = true;
      btn.textContent = 'Sending…';
      try {
        const made = await T7.api.createRequest({
          commodity: draft.commodity, product_type: draft.product_type, specs: draft.specs,
          quantity: draft.quantity ? Number(draft.quantity) : null, quantity_unit: c.unit,
          budget_min: min, budget_max: max, delivery_country: draft.delivery_country,
          timeframe: draft.timeframe, notes: draft.notes
        });
        draft = { commodity: draft.commodity, specs: {} };
        T7.toast('Request ' + made.ref + ' sent to the desk');
        await load();
        document.getElementById('requests').scrollIntoView({ block: 'start', behavior: 'smooth' });
      } catch (err) {
        console.error(err);
        btn.disabled = false;
        btn.textContent = 'Send request to the desk';
        const box = document.getElementById('request-error');
        box.textContent = err.message || 'We could not send that. Please try again.';
        box.hidden = false;
      }
    });
  }

  /* ---------- Page ---------- */
  function render() {
    const answered = enquiries.filter(e => e.status === 'answered').length;
    root.innerHTML =
      '<div class="dash-head">' +
        '<div><p class="eyebrow">Buyer account</p>' +
          '<p class="dash-name">' + esc(profile.company || T7.auth.displayName(profile)) + '</p>' +
          '<p class="muted">' + esc(profile.email) + (answered ? ' · ' + answered + ' enquir' + (answered === 1 ? 'y has' : 'ies have') + ' a reply' : '') + '</p></div>' +
        '<div class="action-row"><a class="btn-desk" href="trade.html">Browse lots</a>' +
          '<a class="btn-line" href="#request">Request a commodity</a>' +
          '<a class="btn-line" href="signin.html?as=seller">' + (profile.is_seller ? 'Switch to selling' : 'Start selling') + '</a>' +
          '<a class="btn-line" href="signin.html?signout=1">Sign out</a></div>' +
      '</div>' +
      enquiriesSection() +
      requestsSection() +
      requestForm();
    wireForm();
  }

  async function load() {
    const form = document.getElementById('request-form');
    if (form) draft = readDraft(form);
    const [e, r] = await Promise.all([T7.api.myEnquiries(), T7.api.myRequests()]);
    enquiries = e; requests = r;
    render();
  }

  root.addEventListener('click', async e => {
    const chat = e.target.closest('[data-chat]');
    if (chat) {
      openId = chat.dataset.chat;
      const form = document.getElementById('request-form');
      if (form) draft = readDraft(form);
      render();
      const t = document.getElementById('e-' + openId);
      if (t && window.innerWidth < 900) t.scrollIntoView({ block: 'start' });
      return;
    }
    const w = e.target.closest('[data-withdraw]');
    if (w) {
      if (!w.dataset.sure) {
        w.dataset.sure = '1';
        w.textContent = 'Yes, withdraw it';
        setTimeout(() => { if (w.isConnected) { delete w.dataset.sure; w.textContent = 'Withdraw request'; } }, 4000);
        return;
      }
      w.disabled = true;
      try { await T7.api.withdrawRequest(w.dataset.withdraw); T7.toast('Request withdrawn'); await load(); }
      catch (err) { console.error(err); w.disabled = false; T7.toast(err.message || 'That did not work. Please try again.'); }
    }
  });

  T7.chat.wire(root, async id => { openId = id; await load(); });

  T7.auth.ready().then(p => {
    /* A seller-only account opening this page is offered buying first. */
    if (p && p.role === 'seller' && !T7.auth.can('buyer')) {
      location.replace('signin.html?as=buyer&next=' + encodeURIComponent('buyer.html' + location.search + location.hash));
      return null;
    }
    return T7.auth.require(['buyer']);
  }).then(p => {
    if (!p) return;
    profile = p;
    return load().then(() => {
      const hash = location.hash.slice(1);
      if (/^e-/.test(hash) && enquiries.some(e => 'e-' + e.id === hash)) { openId = hash.slice(2); render(); }
      const target = document.getElementById(/^e-/.test(hash) ? 'enquiries' : hash);
      if (target) target.scrollIntoView({ block: 'start' });
    });
  }).catch(err => {
    console.error(err);
    root.innerHTML = '<div class="empty"><h3>We could not load your account</h3><p>' + esc(err.message || 'Please try again in a moment.') +
      '</p><button type="button" class="btn-desk" onclick="location.reload()">Try again</button></div>';
  });
})();
