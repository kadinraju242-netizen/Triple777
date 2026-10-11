/* ============================================================
   Triple 7 Holdings — enquiry conversations
   ------------------------------------------------------------
   Every enquiry is two conversations, both with the Triple 7 desk:

     buyer  <-> desk     (channel "buyer")
     desk   <-> seller   (channel "seller")

   The buyer and the seller never see each other. This file draws a
   conversation for whoever is looking — the buyer (buyer.html), the
   seller (seller.html) or the desk (admin.html) — and sends replies.
   The database decides which side a message lands on; the desk is
   the only one who can choose.

   Used as:  T7.chat.list(rows, openId, who)       the list on the left
             T7.chat.thread(row, who, opts)        the open conversation
             T7.chat.wire(root, onSent)            reply boxes
   ============================================================ */
window.T7 = window.T7 || {};

(function () {
  const esc = s => T7.esc(s);
  const when = iso => {
    const d = new Date(iso);
    const days = (Date.now() - d.getTime()) / 86400000;
    return days < 6 ? T7.ago(iso) : d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  /* Who wrote it, from the reader's point of view. */
  function author(m, who) {
    if (m.sender === 'desk') return who === 'desk' ? 'You (desk)' : 'Triple 7 desk';
    if (m.sender === who) return 'You';
    return m.sender === 'buyer' ? 'Buyer' : 'Seller';
  }

  function bubble(m, who) {
    const mine = m.sender === who || (who === 'desk' && m.sender === 'desk');
    return '<li class="msg' + (mine ? ' is-mine' : '') + ' from-' + esc(m.sender) + '">' +
             '<p class="msg-meta"><b>' + esc(author(m, who)) + '</b><span>' + esc(when(m.created_at)) + '</span></p>' +
             '<p class="msg-body">' + esc(m.body).replace(/\n/g, '<br>') + '</p>' +
           '</li>';
  }

  function statusPill(row, who) {
    const st = T7.catalog.enquiryStatus[row.status] || { label: row.status, tone: 'done' };
    const label = who === 'buyer' ? st.buyer
      : who === 'seller' ? ({ with_seller: 'Waiting for your reply', seller_replied: 'You replied', closed: 'Closed' }[row.status] || 'Answered by the desk')
      : st.label;
    const tone = who === 'seller' ? (row.status === 'with_seller' ? 'wait' : row.status === 'closed' ? 'done' : 'good')
      : who === 'buyer' ? (row.status === 'answered' ? 'good' : row.status === 'closed' ? 'done' : 'wait')
      : st.tone;
    return '<span class="pill is-' + tone + '">' + esc(label) + '</span>';
  }

  /* Does this row need the reader's attention? */
  function needsYou(row, who) {
    if (who === 'desk') return row.status === 'new' || row.status === 'seller_replied';
    if (who === 'seller') return row.status === 'with_seller';
    return row.status === 'answered';
  }

  function list(rows, openId, who) {
    return '<ul class="chat-list" role="list">' + rows.map(r => {
      const lot = r.lot;
      const last = (r.messages || []).slice(-1)[0];
      const preview = last ? last.body : r.message || '';
      return '<li><button type="button" class="chat-item' + (r.id === openId ? ' is-open' : '') + (needsYou(r, who) ? ' is-due' : '') + '" data-chat="' + esc(r.id) + '">' +
               '<span class="chat-item-top"><b>' + esc(lot ? lot.name : 'Lot no longer listed') + '</b>' + statusPill(r, who) + '</span>' +
               '<span class="chat-item-sub">' + esc(r.ref) + (lot ? ', ' + esc(lot.lot_id) : '') + ', ' + esc(when(r.last_message_at || r.created_at)) + '</span>' +
               (preview ? '<span class="chat-item-preview">' + esc(preview.slice(0, 120)) + '</span>' : '') +
             '</button></li>';
    }).join('') + '</ul>';
  }

  function replyBox(row, channel, label, placeholder, prefill) {
    return '<form class="chat-reply" data-reply="' + esc(row.id) + '" data-channel="' + channel + '" novalidate>' +
             '<label for="reply-' + channel + '-' + esc(row.id) + '">' + esc(label) + '</label>' +
             '<textarea id="reply-' + channel + '-' + esc(row.id) + '" name="body" rows="3" maxlength="3000" placeholder="' + esc(placeholder) + '">' + esc(prefill || '') + '</textarea>' +
             '<p class="form-error" role="alert" hidden></p>' +
             '<div class="action-row"><button type="submit" class="btn-desk btn-sm">' + esc(channel === 'seller' && label.indexOf('Ask') === 0 ? 'Send to seller' : 'Send') + '</button></div>' +
           '</form>';
  }

  function lotLine(row, who) {
    const lot = row.lot;
    if (!lot) return '<p class="chat-lot muted">This lot is no longer on the board.</p>';
    const link = who === 'seller' || lot.status === undefined || lot.status === 'live' || who === 'desk'
      ? '<a class="textlink" href="lot.html?id=' + encodeURIComponent(lot.lot_id) + '">' + esc(lot.name) + '</a>' : esc(lot.name);
    return '<p class="chat-lot">' + link + '<span>' + esc(lot.lot_id) + ', ' + esc(T7.catalog.label(lot.commodity)) + ', ' + esc(T7.catalog.money(lot.price_zar)) + '</span></p>';
  }

  /* The open conversation.
       who = 'buyer'  : the buyer's question and the desk's replies
       who = 'seller' : the desk's questions about the seller's lot
       who = 'desk'   : both conversations side by side, with the buyer's contact details */
  function thread(row, who, opts) {
    const o = opts || {};
    const msgs = (row.messages || []).slice();
    const closed = row.status === 'closed';
    const head = '<div class="chat-head"><div>' + lotLine(row, who) + '</div>' + statusPill(row, who) + '</div>';

    if (who === 'buyer') {
      const first = { sender: 'buyer', body: row.message, created_at: row.created_at };
      return '<article class="chat-thread" id="e-' + esc(row.id) + '">' + head +
        '<ol class="msgs">' + [first].concat(msgs).map(m => bubble(m, 'buyer')).join('') + '</ol>' +
        (closed ? '<p class="chat-closed">The desk has closed this enquiry. Ask again from the lot page if you need to.</p>'
                : replyBox(row, 'buyer', 'Reply to the desk', 'Add a question or answer the desk')) +
      '</article>';
    }

    if (who === 'seller') {
      return '<article class="chat-thread" id="q-' + esc(row.id) + '">' + head +
        '<p class="chat-note">A buyer is interested in this lot. The desk asks on their behalf; reply here and the desk takes it from there.</p>' +
        '<ol class="msgs">' + msgs.map(m => bubble(m, 'seller')).join('') + '</ol>' +
        (closed ? '<p class="chat-closed">The desk has closed this enquiry.</p>'
                : replyBox(row, 'seller', 'Reply to the desk', 'Availability, viewing, price or paperwork')) +
      '</article>';
    }

    /* The desk */
    const buyerSide = [{ sender: 'buyer', body: row.message, created_at: row.created_at }].concat(msgs.filter(m => m.channel === 'buyer'));
    const sellerSide = msgs.filter(m => m.channel === 'seller');
    const lastBuyer = buyerSide.filter(m => m.sender === 'buyer').slice(-1)[0];
    const lastSeller = sellerSide.filter(m => m.sender === 'seller').slice(-1)[0];
    const askSeller = sellerSide.length ? '' : 'A buyer is asking about this lot: "' + (lastBuyer ? lastBuyer.body : '') + '"';
    return '<article class="chat-thread is-desk" id="e-' + esc(row.id) + '">' + head +
      (o.buyerCard || '') +
      '<div class="chat-columns">' +
        '<section aria-label="Conversation with the buyer"><h3>With the buyer</h3>' +
          '<ol class="msgs">' + buyerSide.map(m => bubble(m, 'desk')).join('') + '</ol>' +
          replyBox(row, 'buyer', 'Reply to the buyer', 'Answer the buyer. Pass on what the seller said, in your own words.',
                   row.status === 'seller_replied' && lastSeller ? 'The seller confirms: ' + lastSeller.body : '') +
        '</section>' +
        '<section aria-label="Conversation with the seller"><h3>With the seller' + (o.sellerName ? ' <span class="muted">' + esc(o.sellerName) + '</span>' : '') + '</h3>' +
          (sellerSide.length ? '<ol class="msgs">' + sellerSide.map(m => bubble(m, 'desk')).join('') + '</ol>'
                             : '<p class="chat-note">The seller has not been asked yet. Only ask what the buyer needs; leave out the buyer’s name and contact details.</p>') +
          replyBox(row, 'seller', sellerSide.length ? 'Message the seller' : 'Ask the seller', 'Your question for the seller', askSeller) +
        '</section>' +
      '</div>' +
      '<div class="action-row chat-actions">' +
        (closed ? '<button type="button" class="btn-line btn-sm" data-enq="new" data-id="' + esc(row.id) + '">Reopen</button>'
                : '<button type="button" class="btn-line btn-sm" data-enq="closed" data-id="' + esc(row.id) + '">Close enquiry</button>') +
        (o.extraActions || '') +
      '</div>' +
    '</article>';
  }

  /* Reply boxes inside `root`. onSent(enquiryId) is called after a
     message is saved, so the page can reload its data. */
  function wire(root, onSent) {
    if (root.dataset.chatWired) return;
    root.dataset.chatWired = '1';
    root.addEventListener('submit', async e => {
      const form = e.target.closest('[data-reply]');
      if (!form) return;
      e.preventDefault();
      const body = form.elements.body.value.trim();
      const err = form.querySelector('.form-error');
      if (!body) { err.textContent = 'Write a message first.'; err.hidden = false; form.elements.body.focus(); return; }
      const btn = form.querySelector('button[type=submit]');
      btn.disabled = true;
      const label = btn.textContent;
      btn.textContent = 'Sending…';
      try {
        await T7.api.sendMessage(form.dataset.reply, body, form.dataset.channel);
        T7.toast('Message sent');
        await onSent(form.dataset.reply);
      } catch (ex) {
        console.error(ex);
        btn.disabled = false;
        btn.textContent = label;
        err.textContent = ex.message || 'That did not send. Please try again.';
        err.hidden = false;
      }
    });
    root.addEventListener('input', e => {
      const form = e.target.closest('[data-reply]');
      if (form) form.querySelector('.form-error').hidden = true;
    });
  }

  T7.chat = { list: list, thread: thread, wire: wire, needsYou: needsYou, statusPill: statusPill };
})();
