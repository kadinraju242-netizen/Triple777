/* ============================================================
   Triple 7 Holdings — lot page
   ------------------------------------------------------------
   One lot: photo, price, every detail the seller gave, and — for
   a buyer — the enquiry box right on the page. Sending an enquiry
   is one click: the message is pre-written and the buyer's name
   and contact details are attached by the database from their
   profile.

   A field is printed only if it has a value; absent fields are
   dropped rather than shown as a dash, because a dash reads as
   "none" when the truth is "not stated".
   ============================================================ */
(function () {
  const root    = document.getElementById('lot-root');
  const titleEl = document.getElementById('desk-title');
  const crumbEl = document.getElementById('crumb-lot');
  const subEl   = document.getElementById('desk-sub');
  if (!root) return;

  const cat = T7.catalog;
  const esc = T7.esc;
  const lotId = new URLSearchParams(location.search).get('id');
  let profile = null;

  function notFound(heading, body) {
    titleEl.textContent = heading;
    if (crumbEl) crumbEl.textContent = 'Not found';
    document.title = heading + ' — Trade Desk — Triple 7 Holdings';
    root.innerHTML =
      '<div class="empty">' +
        '<h3>' + esc(heading) + '</h3>' +
        '<p>' + esc(body) + '</p>' +
        '<a href="trade.html" class="btn-desk">Back To The Board</a>' +
      '</div>';
  }

  function specRows(l) {
    const c = cat.get(l.commodity);
    const specs = l.specs || {};
    const rows = [
      ['Lot ID', l.lot_id],
      ['Category', cat.label(l.commodity)],
      [c ? c.typeLabel : 'Type', l.type],
      [c ? c.unitLabel.replace(' in grams', '') : 'Weight', cat.weight(l)]
    ];
    if (c) c.fields.forEach(f => rows.push([f.label, specs[f.key]]));
    rows.push(['Pieces in this lot', l.quantity > 1 ? l.quantity : null]);
    rows.push(['Origin', l.origin]);
    rows.push(['Listed', new Date(l.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })]);
    return rows
      .filter(r => r[1] != null && r[1] !== '')
      .map(r => '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>')
      .join('');
  }

  function related(all, current) {
    const rest = all.filter(l => l.commodity === current.commodity && l.lot_id !== current.lot_id).slice(0, 3);
    if (!rest.length) return '';
    return '<section class="dash-section" style="margin-top:56px;margin-bottom:0">' +
             '<h2>More ' + esc(cat.get(current.commodity).plural.toLowerCase()) +
               ' <a class="reset-link" href="trade.html?commodity=' + esc(current.commodity) + '">See all</a></h2>' +
             '<div class="board-grid">' +
               rest.map(l => {
                 const href = 'lot.html?id=' + encodeURIComponent(l.lot_id);
                 return '<article class="lot-card">' +
                   '<a href="' + href + '" aria-hidden="true" tabindex="-1">' + T7.lotMedia(l, { card: true }) + '</a>' +
                   '<div class="lot-card-body">' +
                     '<div class="lot-meta"><span class="lot-id">' + esc(l.lot_id) + '</span></div>' +
                     '<a class="lot-name textlink" href="' + href + '">' + esc(l.name) + '</a>' +
                     '<p class="lot-desc">' + esc(cat.summary(l).join(' · ')) + '</p>' +
                     '<div class="lot-foot"><span class="lot-price">' + esc(cat.money(l.price_zar)) + '</span>' +
                     '<a class="lot-open" href="' + href + '">View lot</a></div>' +
                   '</div></article>';
               }).join('') +
             '</div>' +
           '</section>';
  }

  /* ---------- The action box: depends on who is looking ---------- */
  function actionBox(l) {
    const box = document.getElementById('enquire');
    const mine = profile.role === 'seller' && l.seller_id === profile.id;
    const status = cat.status[l.status] || { label: l.status, tone: 'done' };

    if (mine) {
      box.innerHTML =
        '<h2>This is your listing</h2>' +
        '<p><span class="pill is-' + status.tone + '">' + esc(status.label) + '</span></p>' +
        (l.review_note ? '<p class="review-note">Note from the desk: ' + esc(l.review_note) + '</p>' : '') +
        '<div class="action-row"><a class="btn-desk" href="seller.html">Open My Dashboard</a></div>';
      return;
    }
    if (l.status !== 'live') {
      box.innerHTML =
        '<h2>No longer available</h2>' +
        '<p>This lot has been ' + (l.status === 'sold' ? 'sold' : 'taken off the board') + '.</p>' +
        '<div class="action-row"><a class="btn-desk" href="trade.html?commodity=' + esc(l.commodity) + '">See Similar Lots</a></div>';
      return;
    }
    if (profile.role === 'seller') {
      box.innerHTML =
        '<h2>Enquiries come from buyers</h2>' +
        '<p>You are signed in with a seller account, which lists lots rather than enquiring on them.</p>' +
        '<div class="action-row"><a class="btn-line" href="seller.html">Go To My Dashboard</a></div>';
      return;
    }
    enquiryForm(l, box);
  }

  function enquiryForm(l, box, error) {
    const suggestion = 'Hi, I am interested in ' + l.name + ' (' + l.lot_id + '). Is it still available?';
    box.innerHTML =
      '<h2>Ask the seller about this lot</h2>' +
      '<p>Your name, email and phone number are sent with your message so the seller can reply to you directly.</p>' +
      '<form id="enquiry-form" novalidate>' +
        '<label class="sr-only" for="message">Your message</label>' +
        '<textarea id="message" name="message" maxlength="1500" required>' + esc(suggestion) + '</textarea>' +
        '<p class="form-error" id="enquiry-error" role="alert"' + (error ? '' : ' hidden') + '>' + esc(error || '') + '</p>' +
        '<div class="action-row">' +
          '<button type="submit" class="btn-desk" id="enquiry-send">Send Enquiry</button>' +
          '<span class="field-hint">No payment is taken on this site.</span>' +
        '</div>' +
      '</form>' +
      '<div class="past-enquiries" id="past-enquiries" hidden></div>';

    const form = document.getElementById('enquiry-form');
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const message = form.elements.message.value.trim();
      const err = document.getElementById('enquiry-error');
      if (message.length < 2) {
        err.textContent = 'Write a short message for the seller first.';
        err.hidden = false;
        form.elements.message.focus();
        return;
      }
      const btn = document.getElementById('enquiry-send');
      btn.disabled = true;
      btn.textContent = 'Sending…';
      try {
        const sent = await T7.api.sendEnquiry(l.id, message);
        box.innerHTML =
          '<div class="enquire-sent">' +
            '<span class="pill is-good">Enquiry sent</span>' +
            '<h2>The seller has your message</h2>' +
            '<p style="margin:0">Your reference is <strong>' + esc(sent.ref) + '</strong>. The seller will reply to ' +
              esc(profile.email) + (profile.phone ? ' or ' + esc(profile.phone) : '') + '.</p>' +
            '<div class="action-row" style="margin-top:8px">' +
              '<a class="btn-desk" href="trade.html">Back To The Board</a>' +
              '<a class="btn-line" href="trade.html#my-enquiries">My Enquiries</a>' +
            '</div>' +
          '</div>';
        T7.toast('Enquiry ' + sent.ref + ' sent');
      } catch (e2) {
        console.error(e2);
        enquiryForm(l, box, e2.message || 'We could not send that. Please try again.');
        document.getElementById('message').value = message;
      }
    });

    /* Remind a buyer of anything they have already sent about this lot. */
    T7.api.myEnquiries().then(rows => {
      const here = rows.filter(r => r.lot_id === l.id);
      const past = document.getElementById('past-enquiries');
      if (!here.length || !past) return;
      past.hidden = false;
      past.innerHTML = here.map(r =>
        '<span>You enquired ' + esc(T7.ago(r.created_at)) + ' (' + esc(r.ref) + ') — ' +
        esc({ new: 'waiting for the seller', answered: 'the seller has replied', closed: 'closed' }[r.status] || r.status) + '.</span>').join('');
    }).catch(() => {});
  }

  function render(l, all) {
    document.title = l.name + ' · ' + l.lot_id + ' — Trade Desk — Triple 7 Holdings';
    titleEl.textContent = l.name;
    if (crumbEl) crumbEl.textContent = l.lot_id;
    if (subEl) subEl.textContent = [l.lot_id].concat(cat.summary(l)).join(' · ');

    root.innerHTML =
      '<div class="lot-layout">' +
        '<div class="lot-figure">' + T7.lotMedia(l, { wide: true }) + '</div>' +
        '<div>' +
          '<div class="lot-meta">' +
            '<span class="tag">' + esc(cat.label(l.commodity)) + '</span>' +
            (l.status === 'live' ? '<span class="tag is-verified">Checked by the desk</span>' : '') +
            '<span class="lot-id">' + esc(l.lot_id) + '</span>' +
          '</div>' +
          '<div class="lot-price-block">' +
            '<span class="lot-price">' + esc(cat.money(l.price_zar)) + '</span>' +
            '<span>Seller’s asking price' + (l.quantity > 1 ? ' for the whole lot' : '') + '</span>' +
          '</div>' +
          (l.description ? '<p style="margin-top:18px;color:var(--text-dark-2);max-width:56ch">' + esc(l.description) + '</p>' : '') +
          '<div class="enquire" id="enquire"></div>' +
          '<dl class="spec-list">' + specRows(l) + '</dl>' +
          '<p class="lot-tools no-print">' +
            '<button type="button" class="reset-link" id="print-lot">Print this lot sheet</button>' +
          '</p>' +
        '</div>' +
      '</div>' +
      related(all, l);

    actionBox(l);
    document.getElementById('print-lot').addEventListener('click', () => window.print());

    if (location.hash === '#enquire') {
      const box = document.getElementById('enquire');
      box.scrollIntoView({ block: 'center' });
      const ta = box.querySelector('textarea');
      if (ta) ta.focus({ preventScroll: true });
    }
  }

  if (!lotId) {
    notFound('No lot selected', 'Open a lot from the board to see its detail.');
    return;
  }

  T7.auth.require(['buyer', 'seller']).then(p => {
    if (!p) return;
    profile = p;
    return Promise.all([T7.api.getLot(lotId), T7.api.listLots()]).then(([lot, all]) => {
      if (!lot) {
        notFound('Lot not found', 'Lot ' + lotId + ' is not on the board. It may have been sold or withdrawn.');
        return;
      }
      render(lot, all);
    });
  }).catch(err => {
    console.error(err);
    notFound('We could not load this lot', 'Please try again in a moment, or call the Kimberley desk on +27 73 569 4045.');
  });
})();
